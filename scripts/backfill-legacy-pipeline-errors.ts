#!/usr/bin/env tsx
/**
 * Backfill legacy rows with LEGACY_PRE_INSTRUMENTATION
 */

import 'dotenv/config';
import { Client } from 'pg';

async function backfillLegacy() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const client = new Client({
    connectionString: dbUrl,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Count rows to update
    const { rows: countRows } = await client.query(`
      SELECT COUNT(*) as count
      FROM reply_decisions
      WHERE decision = 'ALLOW'
        AND template_status = 'FAILED'
        AND pipeline_error_reason IS NULL;
    `);

    const count = parseInt(countRows[0].count);
    console.log(`📊 Found ${count} rows with NULL pipeline_error_reason to backfill\n`);

    if (count === 0) {
      console.log('✅ No rows to backfill');
      return;
    }

    // Update rows
    console.log('🔄 Backfilling legacy rows...');
    const { rowCount } = await client.query(`
      UPDATE reply_decisions
      SET pipeline_error_reason = 'LEGACY_PRE_INSTRUMENTATION'
      WHERE decision = 'ALLOW'
        AND template_status = 'FAILED'
        AND pipeline_error_reason IS NULL;
    `);

    console.log(`✅ Updated ${rowCount} rows\n`);

    // Verify
    const { rows: verifyRows } = await client.query(`
      SELECT 
        pipeline_error_reason,
        COUNT(*) as count
      FROM reply_decisions
      WHERE decision = 'ALLOW'
        AND template_status = 'FAILED'
      GROUP BY pipeline_error_reason
      ORDER BY count DESC;
    `);

    console.log('📊 Updated failure distribution:');
    verifyRows.forEach((row: any) => {
      console.log(`   ${row.pipeline_error_reason || 'NULL'}: ${row.count}`);
    });

    console.log('\n✅ Backfill complete');

  } catch (error: any) {
    console.error('❌ Backfill failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

backfillLegacy().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
