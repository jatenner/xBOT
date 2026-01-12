#!/usr/bin/env tsx
/**
 * Query deny_reason_code breakdown for last 30 minutes
 */

import 'dotenv/config';
import { Client } from 'pg';

async function queryDenyBreakdown() {
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

    // Query deny_reason_code breakdown for last 30 minutes
    const { rows } = await client.query(`
      SELECT 
        deny_reason_code,
        COUNT(*) as count
      FROM reply_decisions
      WHERE decision = 'DENY'
        AND created_at >= NOW() - INTERVAL '30 minutes'
        AND deny_reason_code IS NOT NULL
      GROUP BY deny_reason_code
      ORDER BY count DESC;
    `);

    console.log('📊 DENY REASON BREAKDOWN (last 30 minutes):\n');
    
    if (rows.length === 0) {
      console.log('   No DENY decisions with deny_reason_code in last 30 minutes');
    } else {
      rows.forEach((row: any) => {
        console.log(`   ${row.deny_reason_code}: ${row.count}`);
      });
    }

    // Also show total DENY vs ALLOW
    const { rows: totals } = await client.query(`
      SELECT 
        decision,
        COUNT(*) as count
      FROM reply_decisions
      WHERE created_at >= NOW() - INTERVAL '30 minutes'
      GROUP BY decision;
    `);

    console.log('\n📊 DECISION TOTALS (last 30 minutes):');
    totals.forEach((row: any) => {
      console.log(`   ${row.decision}: ${row.count}`);
    });

  } catch (error: any) {
    console.error('❌ Query failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

queryDenyBreakdown().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
