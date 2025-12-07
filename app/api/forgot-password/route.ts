import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// Mock email sender
async function sendEmail(email: string, code: string) {
  console.log(`[EMAIL MOCK] To: ${email} | Subject: Password Reset Code | Body: Your code is ${code}`);
  return true;
}

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
  }

  try {
    // Check if email exists
    const userRes = await pool.query('SELECT account_number FROM accounts WHERE email = $1', [email]);
    if (userRes.rowCount === 0) {
      // For security, don't reveal if email exists or not
      return NextResponse.json({ message: 'If that email is registered, we sent a code.' });
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    // Store code
    await pool.query(
      'INSERT INTO password_reset_codes (email, code, expires_at) VALUES ($1, $2, $3)',
      [email, code, expiresAt]
    );

    // Send email
    await sendEmail(email, code);

    return NextResponse.json({ message: 'If that email is registered, we sent a code.' });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
