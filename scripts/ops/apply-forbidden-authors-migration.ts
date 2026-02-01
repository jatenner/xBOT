#!/usr/bin/env tsx
/**
 * Apply forbidden_authors migration
 */

import 'dotenv/config';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const dbUrl = process.env.DATABASE_URL!;
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  
  await client.connect();
  
  const migrationPath = path.join(__dirname, '../../supabase/migrations/20260129_add_forbidden_authors.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  
  console.log('[MIGRATION] Applying forbidden_authors migration...');
  await client.query(migrationSql);
  console.log('[MIGRATION] ✅ Migration applied');
  
  // Verify table exists
  const { rows } = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'forbidden_authors';
  `);
  
  if (rows.length > 0) {
    console.log('[MIGRATION] ✅ Table verified: forbidden_authors');
  } else {
    console.log('[MIGRATION] ❌ Table not found');
  }
  
  await client.end();
}

main().catch(console.error);
