import { Pool } from 'pg';

console.log('Attempting to connect to database...');
const envConn =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  '';

let connectionString = envConn;
let sslRequired = false;

if (!connectionString) {
  console.warn('No DATABASE_URL/POSTGRES_URL found. Using local Docker Postgres default.');
  connectionString = 'postgresql://postgres:postgres@localhost:5432/bank_db';
}

if (connectionString.includes('sslmode=require') || /neon\.tech|vercel\./.test(connectionString)) {
  sslRequired = true;
}

const poolConfig: any = { connectionString };
if (sslRequired) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

console.log('Creating DB Pool with SSL:', !!poolConfig.ssl);
export const pool = new Pool(poolConfig);

pool.connect()
  .then((client) => {
    client.release();
    console.log('Database connection verified.');
  })
  .catch((err) => {
    console.error('Database connection failed:', err.message);
    if (/password authentication failed/i.test(String(err?.message || ''))) {
      console.error('Check DATABASE_URL credentials or create bank_user/bank_pass');
    }
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
