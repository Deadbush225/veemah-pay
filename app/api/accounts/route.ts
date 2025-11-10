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