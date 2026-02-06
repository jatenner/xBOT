#!/usr/bin/env tsx
/**
 * Introspect content_metadata: table type, columns, and whether rate controller columns exist.
 */
import 'dotenv/config';
import { Pool } from 'pg';

async function main(): Promise<void> {
  const conn = process.env.DATABASE_URL;
  if (!conn) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: conn });
  try {
    const tableType = await pool.query(`
      SELECT table_type FROM information_schema.tables 
      WHERE table_schema='public' AND table_name='content_metadata'
    `);
    console.log('Table type:', tableType.rows[0]?.table_type || 'NOT_FOUND');

    const relkind = await pool.query(`
      SELECT c.relname, c.relkind FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'content_metadata'
    `);
    console.log('pg_class relkind:', relkind.rows[0]?.relkind || 'NOT_FOUND', '(r=table, v=view)');

    const cols = await pool.query(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='content_metadata' 
      ORDER BY ordinal_position
    `);
    console.log('Columns:', cols.rows.length);
    cols.rows.forEach((r) => console.log('  ', r.column_name, r.data_type));

    const required = ['prompt_version', 'strategy_id', 'hour_bucket', 'outcome_score'];
    const hasCols = cols.rows.map((r) => r.column_name);
    const missing = required.filter((c) => !hasCols.includes(c));
    console.log('Required rate controller cols present:', required.filter((c) => hasCols.includes(c)));
    console.log('Missing:', missing.length ? missing : 'none');
  } finally {
    await pool.end();
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
