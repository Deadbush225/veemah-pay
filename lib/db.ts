import { Pool } from 'pg';

console.log('Attempting to connect to database...');
// Support Vercel Postgres envs out of the box
const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  '';

if (!connectionString) {
  // Fail fast in dev so it's obvious why API calls fail
  console.error('Missing DATABASE_URL/POSTGRES_URL environment variable.');
  throw new Error('Missing DATABASE_URL/POSTGRES_URL environment variable.');
}

console.log('DB URL found, creating new Pool...');
export const pool = new Pool({
  connectionString,
  // Enable SSL for Neon/Vercel Postgres; skip cert validation for simplicity.
  // For production hardening, attach a CA cert instead of rejectUnauthorized: false.
  ssl: { rejectUnauthorized: false },
});

pool.on('connect', () => {
  console.log('Database pool connected.');
});

pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

export type Account = {
  account_number: string;
  name: string;
  balance: number;
  status: 'Active' | 'Locked' | 'Archived';
};

export type Transaction = {
  id: number;
  type: 'deposit' | 'withdraw' | 'transfer' | 'fee';
  status: 'Pending' | 'Completed' | 'Voided';
  account_number: string; // source
  target_account?: string | null; // optional target
  amount: number;
  fee?: number;
  note?: string | null;
  created_by: string;
  created_at: string;
  completed_at?: string | null;
  voided_at?: string | null;
  source_balance_before?: number | null;
  source_balance_after?: number | null;
  target_balance_before?: number | null;
  target_balance_after?: number | null;
};