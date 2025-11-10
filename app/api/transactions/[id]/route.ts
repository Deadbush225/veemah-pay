import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const colsRes = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transactions'`
    );
    const cols: string[] = colsRes.rows.map((r: any) => r.column_name);
    if (cols.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const has = (c: string) => cols.includes(c);

    const selectFields: string[] = [];
    selectFields.push('id');
    selectFields.push(has('type') ? 'type' : `('unknown')::text AS type`);
    selectFields.push(has('status') ? 'status' : `('Completed')::text AS status`);
    selectFields.push('account_number');
    selectFields.push(has('target_account') ? 'target_account' : 'NULL::text AS target_account');
    selectFields.push('amount::float AS amount');
    selectFields.push(has('fee') ? 'fee::float AS fee' : '0::float AS fee');
    selectFields.push(has('note') ? 'note' : 'NULL AS note');
    selectFields.push(has('created_by') ? 'created_by' : `('-')::text AS created_by`);
    selectFields.push(has('created_at') ? 'created_at' : 'now() AS created_at');
    selectFields.push(has('completed_at') ? 'completed_at' : 'NULL AS completed_at');
    selectFields.push(has('voided_at') ? 'voided_at' : 'NULL AS voided_at');
    selectFields.push(has('source_balance_before') ? 'source_balance_before::float AS source_balance_before' : 'NULL::float AS source_balance_before');
    selectFields.push(has('source_balance_after') ? 'source_balance_after::float AS source_balance_after' : 'NULL::float AS source_balance_after');
    selectFields.push(has('target_balance_before') ? 'target_balance_before::float AS target_balance_before' : 'NULL::float AS target_balance_before');
    selectFields.push(has('target_balance_after') ? 'target_balance_after::float AS target_balance_after' : 'NULL::float AS target_balance_after');

    const sql = `SELECT ${selectFields.join(', ')} FROM transactions WHERE id = $1`;
    const res = await pool.query(sql, [id]);
    if (res.rowCount === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ transaction: res.rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const body = await req.json();
  const session = req.cookies.get('session')?.value;
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const isAdmin = session === '0000';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const curRes = await client.query('SELECT * FROM transactions WHERE id = $1 FOR UPDATE', [id]);
    if (curRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const tx = curRes.rows[0];

    // Customers may only edit their own pending note
    if (!isAdmin && !(tx.status === 'Pending' && tx.account_number === session)) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update note on pending
    if (typeof body.note === 'string') {
      if (tx.status !== 'Pending') throw new Error('Only pending transactions can be updated');
      await client.query('UPDATE transactions SET note = $1 WHERE id = $2', [body.note, id]);
      await client.query(
        `INSERT INTO transaction_audit (transaction_id, action, performed_by, details)
         VALUES ($1,'update',$2,$3::jsonb)`,
        [id, session, JSON.stringify({ note: body.note })]
      );
    }

    // Complete pending
    if (body.action === 'complete') {
      if (!isAdmin) throw new Error('Admin required to complete');
      if (tx.status !== 'Pending') throw new Error('Only pending transactions can be completed');

      // Reload account balances
      const srcRes = await client.query('SELECT account_number, status, balance::float AS balance FROM accounts WHERE account_number = $1', [tx.account_number]);
      if (srcRes.rowCount === 0) throw new Error('Source account not found');
      const src = srcRes.rows[0];
      if (src.status !== 'Active') throw new Error('Source account unavailable');
      let trg: any = null;
      if (tx.type === 'transfer') {
        const tr = await client.query('SELECT account_number, status, balance::float AS balance FROM accounts WHERE account_number = $1', [tx.target_account]);
        if (tr.rowCount === 0) throw new Error('Target account not found');
        trg = tr.rows[0];
        if (trg.status !== 'Active') throw new Error('Target account unavailable');
      }

      let srcAfter = src.balance;
      let trgAfter = trg ? trg.balance : null;
      const amt = Number(tx.amount);
      if (tx.type === 'deposit') {
        srcAfter = src.balance + amt;
        await client.query('UPDATE accounts SET balance = balance + $1 WHERE account_number = $2', [amt, tx.account_number]);
      } else if (tx.type === 'withdraw') {
        if (amt > src.balance) throw new Error('Insufficient funds');
        srcAfter = src.balance - amt;
        await client.query('UPDATE accounts SET balance = balance - $1 WHERE account_number = $2', [amt, tx.account_number]);
      } else {
        if (amt > src.balance) throw new Error('Insufficient funds');
        srcAfter = src.balance - amt;
        trgAfter = trg.balance + amt;
        await client.query('UPDATE accounts SET balance = balance - $1 WHERE account_number = $2', [amt, tx.account_number]);
        await client.query('UPDATE accounts SET balance = balance + $1 WHERE account_number = $2', [amt, tx.target_account]);
      }

      await client.query(
        `UPDATE transactions SET status = 'Completed', completed_at = now(),
         source_balance_before = $1, source_balance_after = $2,
         target_balance_before = $3, target_balance_after = $4
         WHERE id = $5`,
        [src.balance, srcAfter, trg ? trg.balance : null, trgAfter, id]
      );
      await client.query('INSERT INTO transaction_audit (transaction_id, action, performed_by) VALUES ($1,\'complete\',$2)', [id, session]);
    }

    // Void: if completed, rollback; if pending, mark void
    if (body.action === 'void') {
      if (!isAdmin) throw new Error('Admin required to void');
      const reason = String(body.reason ?? '');
      if (tx.status === 'Completed') {
        const amt = Number(tx.amount);
        if (tx.type === 'deposit') {
          await client.query('UPDATE accounts SET balance = balance - $1 WHERE account_number = $2', [amt, tx.account_number]);
        } else if (tx.type === 'withdraw') {
          await client.query('UPDATE accounts SET balance = balance + $1 WHERE account_number = $2', [amt, tx.account_number]);
        } else {
          await client.query('UPDATE accounts SET balance = balance + $1 WHERE account_number = $2', [amt, tx.account_number]);
          await client.query('UPDATE accounts SET balance = balance - $1 WHERE account_number = $2', [amt, tx.target_account]);
        }
      }
      await client.query('UPDATE transactions SET status = \"Voided\", voided_at = now() WHERE id = $1', [id]);
      await client.query(
        `INSERT INTO transaction_audit (transaction_id, action, performed_by, reason)
         VALUES ($1,'void',$2,$3)`,
        [id, session, reason]
      );
      if (tx.status === 'Completed') {
        await client.query('INSERT INTO transaction_audit (transaction_id, action, performed_by) VALUES ($1,\'rollback\',$2)', [id, session]);
      }
    }

    await client.query('COMMIT');
    const out = await pool.query('SELECT * FROM transactions WHERE id = $1', [id]);
    return NextResponse.json({ transaction: out.rows[0] });
  } catch (err: any) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 400 });
  } finally {
    client.release();
  }
}