/**
 * Check what advisory lock functions exist in the database
 */

import 'dotenv/config';
import { Client } from 'pg';

async function check() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL!,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('[CHECK] ✅ Connected\n');

    // Check for pg_try_advisory_lock functions
    const res = await client.query(`
      SELECT 
        n.nspname as schema,
        p.proname as function_name,
        pg_get_function_arguments(p.oid) as arguments,
        pg_get_functiondef(p.oid) as definition
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE p.proname IN ('pg_try_advisory_lock', 'pg_advisory_unlock')
      ORDER BY n.nspname, p.proname;
    `);

    console.log(`[CHECK] Found ${res.rows.length} functions:\n`);
    
    for (const row of res.rows) {
      console.log(`Schema: ${row.schema}`);
      console.log(`Function: ${row.function_name}(${row.arguments})`);
      console.log(`Definition:\n${row.definition}\n`);
      console.log('---\n');
    }

    await client.end();
  } catch (err: any) {
    console.error('[CHECK] ❌ Error:', err.message);
    await client.end().catch(() => {});
    process.exit(1);
  }
}

check();

