/**
 * Check post_receipts table schema
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

    const res = await client.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'post_receipts'
      ORDER BY ordinal_position;
    `);

    console.log(`[CHECK] post_receipts schema (${res.rows.length} columns):\n`);
    
    for (const row of res.rows) {
      console.log(`  ${row.column_name} (${row.data_type}) ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${row.column_default || ''}`);
    }

    console.log('');
    await client.end();
  } catch (err: any) {
    console.error('[CHECK] ❌ Error:', err.message);
    await client.end().catch(() => {});
    process.exit(1);
  }
}

check();

