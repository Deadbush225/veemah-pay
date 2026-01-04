import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

async function notificationsTableExists() {
  const res = await pool.query(`SELECT to_regclass('public.notifications') AS r`);
  return !!res.rows?.[0]?.r;
}

export async function GET(req: NextRequest) {
  const session = req.cookies.get('session')?.value;
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const exists = await notificationsTableExists();
    if (!exists) {
      return NextResponse.json({ notifications: [], unreadCount: 0 });
    }

    const url = new URL(req.url);
    const limitRaw = Number(url.searchParams.get('limit') ?? 20);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 20;

    const unreadRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM public.notifications WHERE recipient_account_number = $1 AND status = 'UNREAD'`,
      [session]
    );
    const unreadCount = Number(unreadRes.rows?.[0]?.count ?? 0);

    const listRes = await pool.query(
      `SELECT id, type, title, body, status, created_at, updated_at, read_at, metadata
       FROM public.notifications
       WHERE recipient_account_number = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [session, limit]
    );

    return NextResponse.json({ notifications: listRes.rows ?? [], unreadCount });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = req.cookies.get('session')?.value;
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const exists = await notificationsTableExists();
    if (!exists) {
      return NextResponse.json({ ok: true, unreadCount: 0 });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? '');
    const markAllRead = body?.markAllRead === true || action === 'mark_all_read';

    if (!markAllRead) {
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }

    await pool.query(
      `UPDATE public.notifications
       SET status = 'READ', read_at = NOW(), updated_at = NOW()
       WHERE recipient_account_number = $1 AND status = 'UNREAD'`,
      [session]
    );

    return NextResponse.json({ ok: true, unreadCount: 0 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}

