import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  const { name, pin, initial_balance, email, password, terms_accepted } = await req.json();

  // Basic validation
  const nm = String(name ?? '').trim();
  const pn = String(pin ?? '').trim();
  const em = String(email ?? '').trim();
  const pwd = String(password ?? '').trim();
  const terms = !!terms_accepted;
  const init = initial_balance === undefined || initial_balance === null
    ? 0
    : Number(initial_balance);

  // Removed account_number validation as it is now auto-generated
  
  if (!nm) {
    return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
  }
  if (!em || !em.includes('@')) {
    return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
  }
  if (!/^[0-9]{4}$/.test(pn)) {
    return NextResponse.json({ error: 'PIN must be 4 digits.' }, { status: 400 });
  }
  if (pwd.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }
  if (!terms) {
    return NextResponse.json({ error: 'You must accept the terms.' }, { status: 400 });
  }
  if (Number.isNaN(init) || init < 0) {
    return NextResponse.json({ error: 'Initial balance must be a nonnegative number.' }, { status: 400 });
  }

  try {
    const colCheck = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts'`
    );
    const cols: string[] = colCheck.rows.map((r: any) => r.column_name);
    const hasEmail = cols.includes('email');
    const hasPassword = cols.includes('password');
    const hasTerms = cols.includes('terms_accepted');

    const lenRes = await pool.query(
      `SELECT character_maximum_length FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'account_number'`
    );
    const accLen = Number(lenRes.rows?.[0]?.character_maximum_length ?? 10);
    let acc = '';
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      const min = accLen >= 2 ? Math.pow(10, accLen - 1) : 0;
      const max = accLen >= 2 ? Math.pow(10, accLen) - 1 : 9;
      acc = String(Math.floor(min + Math.random() * (max - min + 1)));
      
      const exists = await pool.query('SELECT 1 FROM accounts WHERE account_number = $1', [acc]);
      if (exists.rowCount === 0) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return NextResponse.json({ error: 'Failed to generate unique account number. Please try again.' }, { status: 500 });
    }

    // Dynamic insert based on available columns
    const columns = ['account_number', 'name', 'balance', 'pin', 'status'];
    const values: (string | number | boolean)[] = [acc, nm, init, pn];
    const placeholders = ['$1', '$2', '$3', '$4', "'Active'"];
    let pIdx = 5;

    if (hasEmail) {
      columns.push('email');
      values.push(em);
      placeholders.push(`$${pIdx++}`);
    }
    if (hasPassword) {
      columns.push('password');
      // Hash the password
      const hashed = await bcrypt.hash(pwd, 10);
      values.push(hashed);
      placeholders.push(`$${pIdx++}`);
    }
    if (hasTerms) {
      columns.push('terms_accepted');
      values.push(terms);
      placeholders.push(`$${pIdx++}`);
    }

    const sql = `INSERT INTO accounts (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING account_number, name, balance::float AS balance, status${hasEmail ? ', email' : ''}`;
    
    const inserted = await pool.query(sql, values);
    const account = inserted.rows[0];
    const res = NextResponse.json({ account });
    
    // Log in new user by setting session cookie
    res.cookies.set('session', String(account.account_number), {
      httpOnly: true,
      maxAge: 60 * 60, // 1 hour
      path: '/',
    });
    return res;
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}
