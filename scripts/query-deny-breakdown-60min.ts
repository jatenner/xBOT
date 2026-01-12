#!/usr/bin/env tsx
import 'dotenv/config';
import { Client } from 'pg';

async function queryDenyBreakdown() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    const { rows } = await client.query(`
      SELECT 
        deny_reason_code,
        COUNT(*) as count,
        MAX(reason) as sample_reason
      FROM reply_decisions
      WHERE decision = 'DENY'
        AND created_at >= NOW() - INTERVAL '60 minutes'
        AND deny_reason_code IS NOT NULL
      GROUP BY deny_reason_code
      ORDER BY count DESC
      LIMIT 10;
    `);
    
    console.log('📊 DENY REASON BREAKDOWN (last 60 min):');
    if (rows.length === 0) {
      console.log('   No DENY decisions with deny_reason_code in last 60 minutes');
    } else {
      rows.forEach((r: any) => {
        const sample = r.sample_reason ? r.sample_reason.substring(0, 80) : 'N/A';
        console.log(`   ${r.deny_reason_code}: ${r.count} (sample: ${sample})`);
      });
    }
  } catch (error: any) {
    console.error('❌ Query failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

queryDenyBreakdown();
