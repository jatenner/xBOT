#!/usr/bin/env tsx
/**
 * Verify template status fix: ensure no PENDING rows stuck for ALLOW decisions
 */

import 'dotenv/config';
import { Client } from 'pg';

async function verifyTemplateStatusFix() {
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

    // 1. Check for stale PENDING rows (ALLOW decisions older than 10 minutes)
    console.log('📊 1. STALE PENDING ROWS (ALLOW decisions >10 min old):');
    const { rows: staleRows } = await client.query(`
      SELECT 
        id,
        decision_id,
        target_tweet_id,
        template_status,
        template_error_reason,
        created_at,
        EXTRACT(EPOCH FROM (NOW() - created_at))/60 as age_minutes
      FROM reply_decisions
      WHERE decision = 'ALLOW'
        AND template_status = 'PENDING'
        AND created_at < NOW() - INTERVAL '10 minutes'
      ORDER BY created_at DESC
      LIMIT 10;
    `);
    
    if (staleRows.length === 0) {
      console.log('   ✅ No stale PENDING rows found');
    } else {
      console.log(`   ⚠️  Found ${staleRows.length} stale PENDING rows:`);
      staleRows.forEach((row: any, i: number) => {
        console.log(`   ${i + 1}. decision_id=${row.decision_id?.substring(0, 8) || 'N/A'}..., age=${Math.round(row.age_minutes)}min`);
      });
    }
    console.log('');

    // 2. Template status distribution (last 24h, ALLOW only)
    console.log('📊 2. TEMPLATE STATUS DISTRIBUTION (ALLOW decisions, last 24h):');
    const { rows: statusDist } = await client.query(`
      SELECT 
        template_status,
        COUNT(*) as count,
        COUNT(CASE WHEN template_error_reason IS NOT NULL THEN 1 END) as with_error_reason
      FROM reply_decisions
      WHERE decision = 'ALLOW'
        AND created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY template_status
      ORDER BY count DESC;
    `);
    
    statusDist.forEach((row: any) => {
      console.log(`   ${row.template_status || 'NULL'}: ${row.count} total (${row.with_error_reason} with error_reason)`);
    });
    console.log('');

    // 3. FAILED rows with error reasons
    console.log('📊 3. FAILED ROWS WITH ERROR REASONS (last 24h):');
    const { rows: failedRows } = await client.query(`
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
    
    if (failedRows.length === 0) {
      console.log('   No FAILED rows in last 24h');
    } else {
      failedRows.forEach((row: any) => {
        console.log(`   ${row.template_error_reason || 'NULL'}: ${row.count}`);
      });
    }
    console.log('');

    // 4. Recent ALLOW decisions (last 10)
    console.log('📊 4. RECENT ALLOW DECISIONS (last 10):');
    const { rows: recentAllow } = await client.query(`
      SELECT 
        decision_id,
        template_status,
        template_id,
        template_error_reason,
        created_at,
        EXTRACT(EPOCH FROM (NOW() - created_at))/60 as age_minutes
      FROM reply_decisions
      WHERE decision = 'ALLOW'
      ORDER BY created_at DESC
      LIMIT 10;
    `);
    
    recentAllow.forEach((row: any, i: number) => {
      console.log(`   ${i + 1}. decision_id=${row.decision_id?.substring(0, 8) || 'N/A'}...`);
      console.log(`      template_status=${row.template_status}, template_id=${row.template_id || 'NULL'}`);
      console.log(`      error_reason=${row.template_error_reason || 'NULL'}, age=${Math.round(row.age_minutes)}min`);
      console.log('');
    });

    // 5. Verify no PENDING rows older than 10 minutes for ALLOW
    const { rows: staleCount } = await client.query(`
      SELECT COUNT(*) as count
      FROM reply_decisions
      WHERE decision = 'ALLOW'
        AND template_status = 'PENDING'
        AND created_at < NOW() - INTERVAL '10 minutes';
    `);
    
    console.log(`📊 5. STALE PENDING COUNT (ALLOW >10min): ${staleCount[0]?.count || 0}`);
    if (staleCount[0]?.count > 0) {
      console.log(`   ⚠️  ${staleCount[0].count} rows need watchdog cleanup`);
    } else {
      console.log(`   ✅ No stale PENDING rows`);
    }

    console.log('\n✅ Verification complete');

  } catch (error: any) {
    console.error('❌ Verification failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyTemplateStatusFix().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
