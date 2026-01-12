#!/usr/bin/env tsx
import 'dotenv/config';
import { Client } from 'pg';

async function queryBaselineBreakdown() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    const { rows } = await client.query(`
      SELECT 
        deny_reason_code,
        COUNT(*) as count
      FROM reply_decisions
      WHERE decision = 'DENY'
        AND created_at >= NOW() - INTERVAL '60 minutes'
        AND deny_reason_code IN ('CONSENT_WALL', 'ANCESTRY_TIMEOUT', 'ANCESTRY_ERROR')
      GROUP BY deny_reason_code
      ORDER BY count DESC;
    `);
    
    console.log('📊 BASELINE DENY REASON BREAKDOWN (last 60 min):\n');
    if (rows.length === 0) {
      console.log('   No matching decisions found');
    } else {
      rows.forEach((r: any) => {
        console.log(`   ${r.deny_reason_code}: ${r.count}`);
      });
    }
    
    // Also get total for rate calculation
    const { rows: totalRows } = await client.query(`
      SELECT COUNT(*) as total
      FROM reply_decisions
      WHERE created_at >= NOW() - INTERVAL '60 minutes';
    `);
    console.log(`\n   TOTAL decisions: ${totalRows[0].total}`);
  } catch (error: any) {
    console.error('❌ Query failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

queryBaselineBreakdown();
