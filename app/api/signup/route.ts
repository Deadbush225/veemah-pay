import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  const { name, pin, initial_balance, email, password, terms_accepted } = await req.json();

  // Basic validation
  const nm = String(name ?? '').trim();
  const pn = String(pin ?? '').trim();
  const em = String(email ?? '').trim();
  const pwd = String(password ?? '').trim();
  const terms = !!terms_accepted;
  const init = initial_balance === undefined || initial_balance === null
    ? 0
    : Number(initial_balance);

  // Removed account_number validation as it is now auto-generated
  
  if (!nm) {
    return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
  }
  if (!em || !em.includes('@')) {
    return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
  }
  if (!/^[0-9]{5}$/.test(pn)) {
    return NextResponse.json({ error: 'PIN must be 5 digits.' }, { status: 400 });
  }
  if (pwd.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }
  if (!terms) {
    return NextResponse.json({ error: 'You must accept the terms.' }, { status: 400 });
  }
  if (Number.isNaN(init) || init < 0) {
    return NextResponse.json({ error: 'Initial balance must be a nonnegative number.' }, { status: 400 });
  }

  try {
    const colCheck = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts'`
    );
    const cols: string[] = colCheck.rows.map((r: any) => r.column_name);
    const hasEmail = cols.includes('email');
    const hasPassword = cols.includes('password');
    const hasTerms = cols.includes('terms_accepted');
    if (hasEmail) {
      try {
        const existsEmail = await pool.query('SELECT 1 FROM accounts WHERE email = $1', [em]);
        if (Number(existsEmail.rowCount ?? 0) > 0) {
          return NextResponse.json({ error: 'Email already registered.' }, { status: 409 });
        }
        // Optional: enforce uniqueness at DB level if not already present
        await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS accounts_email_key ON accounts(email)');
      } catch (e) {
        // If index creation fails due to existing duplicates, rely on application-level check above
      }
    }
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pending_signups (
        email TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        hashed_password TEXT NOT NULL,
        pin TEXT NOT NULL,
        initial_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
        terms_accepted BOOLEAN NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    const pendExists = await pool.query('SELECT 1 FROM pending_signups WHERE email = $1', [em]);
    if (Number(pendExists.rowCount ?? 0) > 0) {
      return NextResponse.json({ error: 'Email already registered.' }, { status: 409 });
    }
    // Ensure DB pin constraints permit 4–5 digits, for legacy compatibility
    const pinLenRes = await pool.query(
      `SELECT character_maximum_length, data_type FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'pin'`
    );
    const pinLen = Number(pinLenRes.rows?.[0]?.character_maximum_length ?? 0);
    const pinType = String(pinLenRes.rows?.[0]?.data_type ?? '');
    if (pinType.includes('character') && pinLen > 0 && pinLen < 5) {
      await pool.query(`ALTER TABLE accounts ALTER COLUMN pin TYPE VARCHAR(5)`);
    }
    await pool.query(`ALTER TABLE accounts DROP CONSTRAINT IF EXISTS pin_format_check`);
    await pool.query(`ALTER TABLE accounts ADD CONSTRAINT pin_format_check CHECK (char_length(pin) BETWEEN 4 AND 5 AND pin ~ '^[0-9]+$')`);

    // Do NOT create an account row yet. Store pending signup and send verification code.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pending_signups (
        email TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        hashed_password TEXT NOT NULL,
        pin TEXT NOT NULL,
        initial_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
        terms_accepted BOOLEAN NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    const hashed = await bcrypt.hash(pwd, 10);
    await pool.query(
      `INSERT INTO pending_signups (email, name, hashed_password, pin, initial_balance, terms_accepted)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (email) DO UPDATE SET 
         name = EXCLUDED.name,
         hashed_password = EXCLUDED.hashed_password,
         pin = EXCLUDED.pin,
         initial_balance = EXCLUDED.initial_balance,
         terms_accepted = EXCLUDED.terms_accepted,
         created_at = now()`,
      [em, nm, hashed, pn, init, terms]
    );

    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_verification_codes (
        email TEXT PRIMARY KEY,
        account_number TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        verified_at TIMESTAMPTZ NULL
      )
    `);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await pool.query(
      `INSERT INTO email_verification_codes (email, account_number, code, expires_at, created_at, verified_at)
       VALUES ($1,'-',$2,$3,now(),NULL)
       ON CONFLICT (email) DO UPDATE SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at, account_number = '-', verified_at = NULL, created_at = now()`,
      [em, code, expiresAt]
    );

    if (process.env.RESEND_API_KEY) {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
          to: em,
          subject: 'Verify your VeemahPay account',
          html: `<p>Welcome to VeemahPay!</p><p>Your verification code is <strong>${code}</strong>. It expires in 30 minutes.</p>`,
          text: `Welcome to VeemahPay! Your verification code is ${code}. It expires in 30 minutes.`
        })
      });
      if (!resendRes.ok) {
        const errText = await resendRes.text();
        console.error('Resend API Error:', errText);
      }
    } else {
      console.log('[EMAIL VERIFICATION MOCK] To:', em, '| Code:', code);
    }

    const showDevCode =
      process.env.NODE_ENV !== 'production' &&
      (process.env.DEV_SHOW_RESET_CODE === '1' || process.env.DEV_SHOW_RESET_CODE === 'true');
    return NextResponse.json({ verification_required: true, dev_code: showDevCode ? code : undefined });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}
