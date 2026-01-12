#!/usr/bin/env tsx
import 'dotenv/config';
import { Client } from 'pg';

async function queryOtherReasons() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    const { rows } = await client.query(`
      SELECT 
        deny_reason_code,
        reason,
        COUNT(*) as count
      FROM reply_decisions
      WHERE decision = 'DENY'
        AND created_at >= NOW() - INTERVAL '24 hours'
        AND (deny_reason_code = 'OTHER' OR deny_reason_code IS NULL)
      GROUP BY deny_reason_code, reason
      ORDER BY count DESC
      LIMIT 15;
    `);
    
    console.log('📊 OTHER/NULL DENY REASONS (last 24h):');
    if (rows.length === 0) {
      console.log('   No OTHER/NULL deny reasons found');
    } else {
      rows.forEach((r: any) => {
        const reason = r.reason ? r.reason.substring(0, 100) : 'NULL';
        console.log(`   ${r.deny_reason_code || 'NULL'}: ${r.count} - ${reason}`);
      });
    }
  } catch (error: any) {
    console.error('❌ Query failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

queryOtherReasons();
