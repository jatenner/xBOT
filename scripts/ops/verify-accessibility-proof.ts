#!/usr/bin/env tsx
/**
 * Verify accessibility_status persistence and filtering
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { Client } from 'pg';

async function main() {
  const supabase = getSupabaseClient();
  const dbUrl = process.env.DATABASE_URL!;
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  
  await client.connect();
  
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('📊 ACCESSIBILITY STATUS VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  
  // 1. Overall accessibility_status distribution
  const { rows: statusDist } = await client.query(`
    SELECT accessibility_status, COUNT(*) as count
    FROM reply_opportunities
    WHERE replied_to = false
    GROUP BY accessibility_status
    ORDER BY accessibility_status;
  `);
  
  console.log('1. Overall accessibility_status distribution:');
  statusDist.forEach((r: any) => {
    console.log(`   ${r.accessibility_status || 'NULL'}: ${r.count}`);
  });
  
  // 2. Last 30 minutes by discovery_source
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { rows: recentBySource } = await client.query(`
    SELECT accessibility_status, discovery_source, COUNT(*) as count
    FROM reply_opportunities
    WHERE replied_to = false
    AND accessibility_checked_at >= $1
    GROUP BY accessibility_status, discovery_source
    ORDER BY accessibility_status, discovery_source;
  `, [thirtyMinAgo]);
  
  console.log('\n2. Last 30 minutes - accessibility_status by discovery_source:');
  if (recentBySource.length === 0) {
    console.log('   (no opportunities checked in last 30 minutes)');
  } else {
    recentBySource.forEach((r: any) => {
      console.log(`   ${r.accessibility_status || 'NULL'} | ${r.discovery_source || 'NULL'}: ${r.count}`);
    });
  }
  
  // 3. Sample checked opportunities
  const { rows: samples } = await client.query(`
    SELECT target_tweet_id, accessibility_status, accessibility_reason, discovery_source, accessibility_checked_at
    FROM reply_opportunities
    WHERE replied_to = false
    AND accessibility_checked_at IS NOT NULL
    ORDER BY accessibility_checked_at DESC
    LIMIT 10;
  `);
  
  console.log('\n3. Sample checked opportunities (last 10):');
  samples.forEach((r: any) => {
    console.log(`   tweet_id=${r.target_tweet_id} status=${r.accessibility_status} reason=${(r.accessibility_reason || '').substring(0, 40)} discovery=${r.discovery_source || 'NULL'} checked=${r.accessibility_checked_at}`);
  });
  
  // 4. Verify filtering - check if bad-status opportunities are in queue
  const { rows: badInQueue } = await client.query(`
    SELECT COUNT(*) as count
    FROM reply_candidate_queue q
    INNER JOIN reply_opportunities o ON q.candidate_tweet_id = o.target_tweet_id
    WHERE q.status = 'queued'
    AND o.replied_to = false
    AND o.accessibility_status IN ('forbidden', 'login_wall', 'deleted');
  `);
  
  console.log('\n4. Bad-status opportunities in queue (should be 0):');
  console.log(`   Count: ${badInQueue[0].count}`);
  if (badInQueue[0].count === '0') {
    console.log('   ✅ Filtering working correctly');
  } else {
    console.log('   ⚠️ WARNING: Bad-status opportunities found in queue!');
  }
  
  // 5. Decisions created in last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { rows: decisions } = await client.query(`
    SELECT status, COUNT(*) as count
    FROM content_generation_metadata_comprehensive
    WHERE decision_type = 'reply'
    AND created_at >= $1
    GROUP BY status
    ORDER BY status;
  `, [oneHourAgo]);
  
  console.log('\n5. Decisions created in last hour:');
  if (decisions.length === 0) {
    console.log('   (no decisions created in last hour)');
  } else {
    decisions.forEach((r: any) => {
      console.log(`   status=${r.status}: ${r.count}`);
    });
  }
  
  // 6. Posted tweets
  const { rows: posted } = await client.query(`
    SELECT decision_id, target_tweet_id, posted_tweet_id, posted_at
    FROM content_generation_metadata_comprehensive
    WHERE decision_type = 'reply'
    AND posted_tweet_id IS NOT NULL
    ORDER BY posted_at DESC
    LIMIT 5;
  `);
  
  console.log('\n6. Recently posted tweets:');
  if (posted.length === 0) {
    console.log('   (no posted tweets found)');
  } else {
    posted.forEach((r: any) => {
      console.log(`   decision_id=${r.decision_id} target=${r.target_tweet_id} posted=${r.posted_tweet_id} at=${r.posted_at}`);
    });
  }
  
  await client.end();
}

main().catch(console.error);
