import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

async function sendEmail(email: string, code: string) {
  try {
    if (process.env.RESEND_API_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
          to: email,
          subject: 'Your VeemahPay reset code',
          html: `<p>Your password reset code is <strong>${code}</strong>. It expires in 15 minutes.</p>`,
          text: `Your password reset code is ${code}. It expires in 15 minutes.`
        })
      });
      if (!res.ok) {
        const err = await res.text();
        console.error('Resend error:', err);
        throw new Error('Email send failed');
      }
      return true;
    }
    // Optional SMTP support can be added with Nodemailer; for now, prefer RESEND_API_KEY path above.
  } catch (e) {
    console.error('[EMAIL SEND ERROR]', e);
  }
  console.log(`[EMAIL MOCK] To: ${email} | Code: ${code}`);
  return false;
}

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
  }

  try {
    const userRes = await pool.query('SELECT account_number FROM accounts WHERE email = $1', [email]);
    if (userRes.rowCount === 0) {
      return NextResponse.json({ error: 'Email not registered' }, { status: 404 });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await pool.query(
      'INSERT INTO password_reset_codes (email, code, expires_at) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at, created_at = now()',
      [email, code, expiresAt]
    );

    await sendEmail(email, code);

    const showDevCode = process.env.NODE_ENV !== 'production' && (process.env.DEV_SHOW_RESET_CODE === '1' || process.env.DEV_SHOW_RESET_CODE === 'true');
    return NextResponse.json({ message: 'Reset code sent to your email.', dev_code: showDevCode ? code : undefined });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
