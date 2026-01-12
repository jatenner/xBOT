#!/usr/bin/env tsx
import 'dotenv/config';
import { Client } from 'pg';

async function queryAncestryErrorDetails() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    const { rows } = await client.query(`
      SELECT 
        target_tweet_id,
        reason,
        status,
        method,
        cache_hit,
        created_at
      FROM reply_decisions
      WHERE decision = 'DENY'
        AND deny_reason_code = 'ANCESTRY_ERROR'
        AND created_at >= NOW() - INTERVAL '60 minutes'
      ORDER BY created_at DESC
      LIMIT 5;
    `);
    
    console.log('📊 TOP 5 ANCESTRY_ERROR DETAILS (last 60 min):\n');
    if (rows.length === 0) {
      console.log('   No ANCESTRY_ERROR decisions found');
    } else {
      rows.forEach((r: any, i: number) => {
        console.log(`${i + 1}. target_tweet_id: ${r.target_tweet_id}`);
        console.log(`   reason: ${r.reason?.substring(0, 150) || 'NULL'}`);
        console.log(`   status: ${r.status || 'NULL'}`);
        console.log(`   method: ${r.method || 'NULL'}`);
        console.log(`   cache_hit: ${r.cache_hit || false}`);
        console.log(`   created_at: ${r.created_at}\n`);
      });
    }
  } catch (error: any) {
    console.error('❌ Query failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

queryAncestryErrorDetails();
