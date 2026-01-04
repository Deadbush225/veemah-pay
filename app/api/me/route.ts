import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = req.cookies.get('session')?.value;
  if (!session) {
    // Return a 200 with authenticated: false so client startup doesn't log errors
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }

  try {
    const colsRes = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounts'`
    );
    const cols: string[] = colsRes.rows.map((r: any) => String(r.column_name));
    const hasEmail = cols.includes('email');
    const hasRole = cols.includes('role');
    const hasPassword = cols.includes('password');

    const selectCols = [
      'account_number',
      'name',
      cols.includes('balance') ? 'balance::float AS balance' : null,
      cols.includes('status') ? 'status' : null,
      hasRole ? 'role' : null,
      hasEmail ? 'email' : null,
      hasPassword ? `(password IS NOT NULL AND password <> '') AS "hasPassword"` : `false AS "hasPassword"`,
    ]
      .filter(Boolean)
      .join(', ');

    const result = await pool.query(`SELECT ${selectCols} FROM accounts WHERE account_number = $1`, [session]);
    if (result.rowCount === 0) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }
    const acc = result.rows[0];
    const hintCookie = req.cookies.get('session_admin')?.value === '1';
    const isAdminEmail = typeof acc.email === 'string' && acc.email.toLowerCase().endsWith('@veemahpay.com');
    const isAdminRole = typeof acc.role === 'string' && ['admin', 'super_admin'].includes(String(acc.role || '').toLowerCase());
    const isAdmin = hintCookie || String(acc.account_number) === '0000' || isAdminRole || isAdminEmail;
    return NextResponse.json({ authenticated: true, account: acc, isAdmin });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}
