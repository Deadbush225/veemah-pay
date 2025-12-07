import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const search = (url.searchParams.get('q') || url.searchParams.get('search') || '').trim();
    const includeArchived = ['1','true','yes'].includes((url.searchParams.get('include_archived') || '').toLowerCase());

    const where: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (!includeArchived) {
      where.push(`status <> 'Archived'`);
    }
    if (search) {
      where.push(`(account_number LIKE $${idx} OR name ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    const sql = `SELECT account_number, name, balance::float AS balance, status FROM accounts ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY account_number`;
    const result = await pool.query(sql, params);
    return NextResponse.json({ accounts: result.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = req.cookies.get('session')?.value;
    if (session !== '0000') {
      return NextResponse.json({ error: 'Admin privileges required.' }, { status: 403 });
    }

    const url = new URL(req.url);
    const confirm = (url.searchParams.get('confirm') || '').toLowerCase();
    if (!['yes', 'true', '1'].includes(confirm)) {
      return NextResponse.json({ error: "Confirmation required. Pass ?confirm=yes to purge all non-admin accounts." }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Remove transactions referencing non-admin accounts (source or target)
      await client.query(
        `DELETE FROM transactions
         WHERE (account_number <> '0000') OR (target_account IS NOT NULL AND target_account <> '0000')`
      );

      // Optional: remove users referencing non-admin accounts, if users table exists
      const hasUsers = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = 'users'`
      );
      if ((hasUsers.rowCount ?? 0) > 0) {
        await client.query(`DELETE FROM users WHERE account_number <> '0000'`);
      }

      // Finally, remove all non-admin accounts
      await client.query(`DELETE FROM accounts WHERE account_number <> '0000'`);

      await client.query('COMMIT');
      return new NextResponse(null, { status: 204 });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}
