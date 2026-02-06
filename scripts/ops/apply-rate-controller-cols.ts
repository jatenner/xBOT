#!/usr/bin/env tsx
/**
 * One-off: Add rate controller columns to content_metadata (when it is a table).
 * Run: railway run --service xBOT pnpm exec tsx scripts/ops/apply-rate-controller-cols.ts
 */
import 'dotenv/config';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATION_PATH = path.join(
  process.cwd(),
  'supabase/migrations/20260206_add_rate_controller_cols_to_content_metadata.sql'
);

async function main(): Promise<void> {
  const conn = process.env.DATABASE_URL;
  if (!conn) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: conn });
  try {
    const sql = fs.readFileSync(MIGRATION_PATH, 'utf-8');
    console.log('[APPLY] Running 20260206_add_rate_controller_cols_to_content_metadata.sql');
    await pool.query(sql);
    console.log('[APPLY] Done');
    process.exit(0);
  } catch (e: any) {
    console.error('[APPLY] Failed:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
