import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

async function notificationsTableExists() {
  const res = await pool.query(`SELECT to_regclass('public.notifications') AS r`);
  return !!res.rows?.[0]?.r;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = req.cookies.get('session')?.value;
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const exists = await notificationsTableExists();
    if (!exists) {
      return NextResponse.json({ error: 'Notifications unavailable' }, { status: 404 });
    }

    const id = Number(params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'Invalid notification id' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const status = String(body?.status ?? '').toUpperCase();

    if (status !== 'READ' && status !== 'UNREAD') {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const updated = await pool.query(
      `UPDATE public.notifications
       SET status = $1,
           read_at = CASE WHEN $1 = 'READ' THEN COALESCE(read_at, NOW()) ELSE NULL END,
           updated_at = NOW()
       WHERE id = $2 AND recipient_account_number = $3
       RETURNING id, type, title, body, status, created_at, updated_at, read_at, metadata`,
      [status, id, session]
    );

    if ((updated.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ notification: updated.rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}

