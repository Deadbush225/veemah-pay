import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import bcrypt from 'bcryptjs';

const LOCK_THRESHOLD = 3; // number of failed PIN attempts before lock

function getClientIp(req: NextRequest) {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0]?.trim() || xf.trim();
  return (
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-client-ip') ||
    ''
  );
}

function getApproxLocation(req: NextRequest) {
  const city = req.headers.get('x-vercel-ip-city') || '';
  const region = req.headers.get('x-vercel-ip-country-region') || '';
  const country = req.headers.get('x-vercel-ip-country') || req.headers.get('cf-ipcountry') || '';
  const parts = [city, region, country].map((p) => p.trim()).filter(Boolean);
  return parts.join(', ');
}

function formatDateForEmail(d: Date) {
  try {
    return new Intl.DateTimeFormat('en-PH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila',
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

async function sendResendEmail(args: { to: string; subject: string; html: string; text: string }) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.log('[EMAIL MOCK]', { to: args.to, subject: args.subject });
      return false;
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
        to: args.to,
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error('Resend API Error:', errText);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[EMAIL SEND ERROR]', e);
    return false;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const identifier = String(
    body?.email ?? body?.account_number ?? body?.accountNumber ?? body?.identifier ?? ''
  ).trim();
  const pin = body?.pin;
  const password = body?.password;

  // "pin" field might come from legacy clients or the web form using the "pin" variable name for password
  // But strictly, we expect `email` + `password` (new) or `email` + `pin` (old)
  const credential = password || pin;

  if (!identifier || credential === undefined || credential === null || String(credential).length === 0) {
    return NextResponse.json({ error: 'Email and Password/PIN are required.' }, { status: 400 });
  }

  try {
    const colCheck = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts'`
    );
    const cols: string[] = colCheck.rows.map((r: any) => r.column_name);
    const hasFailedAttempts = cols.includes('failed_attempts');
    const hasEmail = cols.includes('email');
    const hasPassword = cols.includes('password');
    const hasRole = cols.includes('role');

    let result;
    // Select password if column exists
    const selectCols = `account_number, name, balance::float AS balance, status, pin${hasEmail ? ', email' : ''}${hasPassword ? ', password' : ''}${hasRole ? ', role' : ''}`;

    const ident = identifier;
    const isNumericAccountNumber = /^[0-9]+$/.test(ident);

    if (hasEmail && !isNumericAccountNumber && ident.includes('@')) {
      result = await pool.query(
        `SELECT ${selectCols} FROM accounts WHERE LOWER(email) = LOWER($1)`,
        [ident]
      );
    } else {
      result = await pool.query(
        `SELECT ${selectCols} FROM accounts WHERE account_number = $1`,
        [ident]
      );
    }

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Invalid email or account not found.' }, { status: 401 });
    }

    const row = result.rows[0];

    // Require email verification if email exists and pending record is present
    if (hasEmail && row.email) {
      try {
        const verTable = await pool.query(`SELECT to_regclass('public.email_verification_codes') AS r`);
        if (!verTable.rows?.[0]?.r) {
          return NextResponse.json({ error: 'Database missing email verification table. Run migrations.' }, { status: 500 });
        }
        const ver = await pool.query(
          `SELECT 1 FROM email_verification_codes WHERE email = $1 AND verified_at IS NULL`,
          [row.email]
        );
        if ((ver.rowCount ?? 0) > 0) {
          return NextResponse.json({ error: 'Email not verified. Check your inbox for the verification code.' }, { status: 403 });
        }
      } catch (e) {
        console.error('Email verification check failed:', e);
      }
    }

    if (row.status === 'Locked') {
      return NextResponse.json({ error: 'Account locked. Please contact support.' }, { status: 403 });
    }
    if (row.status === 'Archived') {
      return NextResponse.json({ error: 'Account archived. Access disabled.' }, { status: 403 });
    }

    // AUTHENTICATION LOGIC
    // 1. Try Password (if row has it and user provided it)
    // 2. Fallback to PIN
    let authenticated = false;

    if (hasPassword && row.password && password) {
      // Check password (hashed)
      const match = await bcrypt.compare(password, row.password);
      if (match) {
        authenticated = true;
      } else if (password === row.password) {
          // Fallback for existing plaintext passwords (legacy support)
          authenticated = true;
          // Optionally upgrade to hash here, but let's keep it simple for now
      }
    } else {
      // Fallback: Check PIN (legacy or if user has no password set)
      // Note: If user has a password but tries to login with PIN on web, we might allow it if we want hybrid auth,
      // but "professional" implies checking the correct credential.
      // However, to avoid breaking legacy, we check against PIN if password check didn't pass or wasn't attempted.
      if (String(row.pin) === String(credential)) {
        authenticated = true;
      }
    }

    if (!authenticated) {
      if (hasFailedAttempts) {
        // Increment failed attempts; lock account if threshold reached
        const updated = await pool.query(
          `UPDATE accounts
           SET failed_attempts = failed_attempts + 1,
               status = CASE WHEN failed_attempts + 1 >= $2 THEN 'Locked' ELSE status END
           WHERE account_number = $1
           RETURNING failed_attempts, status`,
          [row.account_number, LOCK_THRESHOLD]
        );
        const u = updated.rows[0];
        if (u.status === 'Locked') {
          return NextResponse.json({ error: 'Account locked after multiple failed attempts.' }, { status: 403 });
        }
      }
      return NextResponse.json({ error: 'Invalid Password or PIN.' }, { status: 401 });
    }

    // Successful login: reset failed_attempts if available
    if (hasFailedAttempts) {
      await pool.query(
        'UPDATE accounts SET failed_attempts = 0 WHERE account_number = $1',
        [row.account_number]
      );
    }

    const isAdminEmail = hasEmail && typeof row.email === 'string' && row.email.toLowerCase().endsWith('@veemahpay.com');
    const isAdminRole = hasRole && ['admin', 'super_admin'].includes(String(row.role || '').toLowerCase());
    const isAdmin = String(row.account_number) === '0000' || isAdminRole || isAdminEmail;

    if (hasEmail && typeof row.email === 'string' && row.email.includes('@')) {
      const now = new Date();
      const ip = getClientIp(req);
      const ua = req.headers.get('user-agent') || '';
      const location = getApproxLocation(req);
      const when = formatDateForEmail(now);

      const locationLine = location ? `Location: ${location}` : `Location: Unknown`;
      const ipLine = ip ? `IP: ${ip}` : `IP: Unknown`;
      const deviceLine = ua ? `Device: ${ua}` : `Device: Unknown`;

      const subject = 'New login to your VeemahPay account.';
      const text = [
        'New login to your VeemahPay account.',
        '',
        `Date: ${when}`,
        ipLine,
        locationLine,
        deviceLine,
        '',
        "If this wasn't you, change your password and PIN immediately.",
      ].join('\n');
      const html = [
        `<p>New login to your VeemahPay account.</p>`,
        `<p><strong>Date:</strong> ${when}</p>`,
        `<p><strong>IP:</strong> ${ip || 'Unknown'}</p>`,
        `<p><strong>Location:</strong> ${location || 'Unknown'}</p>`,
        `<p><strong>Device:</strong> ${ua || 'Unknown'}</p>`,
        `<p>If this wasn't you, change your password and PIN immediately.</p>`,
      ].join('');

      try {
        await sendResendEmail({ to: row.email, subject, html, text });
      } catch {}
    }

    const res = NextResponse.json({
      account: {
        account_number: row.account_number,
        name: row.name,
        balance: row.balance,
        status: row.status,
        email: hasEmail ? row.email : undefined,
        role: hasRole ? row.role : undefined
      },
      isAdmin
    });
    // Minimal session cookie storing the account number
    res.cookies.set('session', String(row.account_number), {
      httpOnly: true,
      maxAge: 60 * 60, // 1 hour
      path: '/',
    });
    // Hint cookie for admin determination
    if (isAdmin) {
      res.cookies.set('session_admin', '1', {
        httpOnly: true,
        maxAge: 60 * 60,
        path: '/',
      });
    } else {
      res.cookies.set('session_admin', '', { httpOnly: true, maxAge: 0, path: '/' });
    }
    return res;
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Login service unavailable. Please try again.' }, { status: 500 });
  }
}
