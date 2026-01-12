#!/usr/bin/env tsx
/**
 * Query failure distribution by pipeline_error_reason
 */

import 'dotenv/config';
import { Client } from 'pg';

async function queryFailureDistribution() {
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

    console.log('📊 FAILURE DISTRIBUTION BY PIPELINE_ERROR_REASON (last 24h, ALLOW + FAILED):');
    const { rows: failures } = await client.query(`
      SELECT 
        pipeline_error_reason,
        COUNT(*) as count
      FROM reply_decisions
      WHERE decision = 'ALLOW'
        AND template_status = 'FAILED'
        AND created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY pipeline_error_reason
      ORDER BY count DESC;
    `);

    if (failures.length === 0) {
      console.log('   No FAILED rows in last 24h');
    } else {
      failures.forEach((row: any) => {
        console.log(`   ${row.pipeline_error_reason || 'NULL'}: ${row.count}`);
      });
    }
    console.log('');

    // Also show breakdown by template_error_reason for comparison
    console.log('📊 FAILURE DISTRIBUTION BY TEMPLATE_ERROR_REASON (last 24h, ALLOW + FAILED):');
    const { rows: templateFailures } = await client.query(`
      SELECT 
        template_error_reason,
        COUNT(*) as count
      FROM reply_decisions
      WHERE decision = 'ALLOW'
        AND template_status = 'FAILED'
        AND created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY template_error_reason
      ORDER BY count DESC;
    `);

    if (templateFailures.length === 0) {
      console.log('   No FAILED rows in last 24h');
    } else {
      templateFailures.forEach((row: any) => {
        console.log(`   ${row.template_error_reason || 'NULL'}: ${row.count}`);
      });
    }

    console.log('\n✅ Query complete');

  } catch (error: any) {
    console.error('❌ Query failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

queryFailureDistribution().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
