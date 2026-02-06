#!/usr/bin/env tsx
import 'dotenv/config';
import { Pool } from 'pg';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const r = await pool.query('SELECT * FROM rate_controller_state ORDER BY updated_at DESC LIMIT 5');
  console.log('Rows:', r.rows.length);
  r.rows.forEach((row) => console.log(JSON.stringify(row, null, 2)));
  const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='rate_controller_state' ORDER BY ordinal_position");
  console.log('Columns:', cols.rows.map((c) => c.column_name));
  await pool.end();
}
main();
