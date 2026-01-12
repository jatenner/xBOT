#!/usr/bin/env tsx
import 'dotenv/config';
import { Client } from 'pg';

async function queryAncestryBuckets() {
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
        AND created_at >= NOW() - INTERVAL '30 minutes'
        AND (
          deny_reason_code LIKE 'ANCESTRY_%' OR 
          deny_reason_code = 'CONSENT_WALL'
        )
      GROUP BY deny_reason_code
      ORDER BY count DESC;
    `);
    
    console.log('📊 ANCESTRY + CONSENT_WALL BREAKDOWN (last 30 min):\n');
    if (rows.length === 0) {
      console.log('   No ANCESTRY_* or CONSENT_WALL decisions found');
    } else {
      rows.forEach((r: any) => {
        console.log(`   ${r.deny_reason_code}: ${r.count}`);
      });
    }
  } catch (error: any) {
    console.error('❌ Query failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

queryAncestryBuckets();
