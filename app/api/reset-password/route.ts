import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { email, code, new_pin } = await req.json();

  if (!email || !code || !new_pin) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  if (!/^[0-9]{4}$/.test(new_pin)) {
    return NextResponse.json({ error: 'PIN must be 4 digits' }, { status: 400 });
  }

  try {
    // Verify code
    const codeRes = await pool.query(
      `SELECT * FROM password_reset_codes 
       WHERE email = $1 AND code = $2 AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`,
      [email, code]
    );

    if (codeRes.rowCount === 0) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }

    // Update PIN
    await pool.query(
      'UPDATE accounts SET pin = $1, failed_attempts = 0, status = \'Active\' WHERE email = $2',
      [new_pin, email]
    );

    // Delete used codes
    await pool.query('DELETE FROM password_reset_codes WHERE email = $1', [email]);

    return NextResponse.json({ message: 'Password reset successful' });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
