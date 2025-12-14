import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  const em = String(email ?? '').trim();
  if (!em || !em.includes('@')) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
  }

  try {
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
    const pendRes = await pool.query(`SELECT 1 FROM pending_signups WHERE email = $1`, [em]);
    if (pendRes.rowCount === 0) {
      return NextResponse.json({ error: 'No pending signup found for this email' }, { status: 404 });
    }

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
       VALUES ($1,$2,$3,$4,now(),NULL)
       ON CONFLICT (email) DO UPDATE SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at, account_number = EXCLUDED.account_number, verified_at = NULL, created_at = now()`,
      [em, '-', code, expiresAt]
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
          subject: 'Your VeemahPay verification code',
          html: `<p>Your verification code is <strong>${code}</strong>. It expires in 30 minutes.</p>`,
          text: `Your verification code is ${code}. It expires in 30 minutes.`
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
    return NextResponse.json({ sent: true, dev_code: showDevCode ? code : undefined });
  } catch (err: any) {
    console.error('[RESEND EMAIL VERIFICATION ERROR]', err);
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}
