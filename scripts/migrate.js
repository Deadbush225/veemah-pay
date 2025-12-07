const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load env vars roughly (since dotenv might not be set up for this script context)
// But we know the URL from previous context: postgresql://bank_user:bank_pass@localhost:5432/bank_db
// Or use process.env.DATABASE_URL if available.
const connectionString = process.env.DATABASE_URL || 'postgresql://bank_user:bank_pass@localhost:5432/bank_db';

const pool = new Pool({ connectionString });

async function migrate() {
  try {
    const sqlPath = path.join(__dirname, '../db/migrations/005_add_password.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('Running migration...');
    await pool.query(sql);
    console.log('Migration complete.');
  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    await pool.end();
  }
}

migrate();
