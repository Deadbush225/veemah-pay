import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  const { email, code, new_password } = await req.json();

  if (!email || !code || !new_password) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  if (new_password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  try {
    const colCheck = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts'`
    );
    const cols: string[] = colCheck.rows.map((r: any) => r.column_name);
    const hasEmail = cols.includes('email');
    const hasPassword = cols.includes('password');
    const hasFailedAttempts = cols.includes('failed_attempts');
    const hasStatus = cols.includes('status');

    if (!hasEmail) {
      return NextResponse.json({ error: 'Email not supported by accounts table' }, { status: 400 });
    }
    if (!hasPassword) {
      return NextResponse.json({ error: 'Password feature unavailable. Run migrations.' }, { status: 400 });
    }

    const codeRes = await pool.query(
      `SELECT * FROM password_reset_codes 
       WHERE email = $1 AND code = $2 AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`,
      [email, code]
    );

    if (codeRes.rowCount === 0) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }

    const hashed = await bcrypt.hash(new_password, 10);
    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (hasPassword) {
      updates.push(`password = $${idx++}`);
      params.push(hashed);
    }
    if (hasFailedAttempts) {
      updates.push(`failed_attempts = 0`);
    }
    if (hasStatus) {
      updates.push(`status = 'Active'`);
    }
    params.push(email);
    const sql = `UPDATE accounts SET ${updates.join(', ')} WHERE email = $${idx}`;
    const upd = await pool.query(sql, params);
    if (upd.rowCount === 0) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    await pool.query('DELETE FROM password_reset_codes WHERE email = $1', [email]);

    return NextResponse.json({ message: 'Password updated' });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
