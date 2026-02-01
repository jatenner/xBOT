#!/usr/bin/env tsx
/**
 * P1 Status Command
 * 
 * Prints comprehensive P1 status:
 * - public candidates count
 * - queue size
 * - last probe summary
 * - last decision + attempt status
 * - last posted URL (if any)
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';
import { Client } from 'pg';

async function main() {
  const supabase = getSupabaseClient();
  const dbUrl = process.env.DATABASE_URL!;
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  
  await client.connect();

  console.log('═══════════════════════════════════════════════════════════');
  console.log('🎯 P1 Status');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. Public candidates count
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { rows: publicCountRows } = await client.query(`
    SELECT COUNT(*) as count
    FROM reply_opportunities
    WHERE discovery_source LIKE 'public_search_%'
    AND replied_to = false
    AND created_at >= $1;
  `, [twoHoursAgo]);
  const publicCount = parseInt(publicCountRows[0]?.count || '0', 10);
  console.log(`1. Public candidates (last 2h): ${publicCount}${publicCount >= 25 ? ' ✅' : ' ⚠️'}`);

  // 2. Queue size
  const { rows: queueRows } = await client.query(`
    SELECT COUNT(*) as count
    FROM content_metadata
    WHERE decision_type = 'reply'
    AND status = 'queued'
    AND created_at >= NOW() - INTERVAL '24 hours';
  `);
  const queueSize = parseInt(queueRows[0]?.count || '0', 10);
  console.log(`2. Queued decisions (last 24h): ${queueSize}`);

  // 3. Last probe summary
  const { rows: probeSummaryRows } = await client.query(`
    SELECT message, event_data, created_at
    FROM system_events
    WHERE message LIKE '%P1_PROBE_SUMMARY%'
    ORDER BY created_at DESC
    LIMIT 1;
  `);
  if (probeSummaryRows.length > 0) {
    const summary = probeSummaryRows[0];
    console.log(`3. Last probe summary: ${summary.message}`);
    console.log(`   Time: ${summary.created_at}`);
    if (summary.event_data) {
      const data = summary.event_data as any;
      if (data.ok !== undefined) {
        console.log(`   ok: ${data.ok}${data.ok >= 1 ? ' ✅' : ' ❌'}`);
      }
    }
  } else {
    console.log(`3. Last probe summary: ⚠️  Not found`);
  }

  // 4. Last decision + attempt status
  const { rows: lastDecisionRows } = await client.query(`
    SELECT 
      decision_id,
      status,
      target_tweet_id,
      created_at,
      posted_at
    FROM content_metadata
    WHERE decision_type = 'reply'
    ORDER BY created_at DESC
    LIMIT 1;
  `);
  if (lastDecisionRows.length > 0) {
    const decision = lastDecisionRows[0];
    console.log(`\n4. Last decision:`);
    console.log(`   decision_id: ${decision.decision_id}`);
    console.log(`   status: ${decision.status}`);
    console.log(`   target_tweet_id: ${decision.target_tweet_id}`);
    console.log(`   created_at: ${decision.created_at}`);
    if (decision.posted_at) {
      console.log(`   posted_at: ${decision.posted_at} ✅`);
    }
  } else {
    console.log(`\n4. Last decision: ⚠️  Not found`);
  }

  // 5. Last posted URL (P1 flow - after architectural fix: 2026-02-01)
  const p1StartDate = '2026-02-01';
  const { rows: postedRows } = await client.query(`
    SELECT 
      decision_id,
      tweet_id,
      target_tweet_id,
      posted_at,
      content
    FROM content_metadata
    WHERE decision_type = 'reply'
    AND status = 'posted'
    AND tweet_id IS NOT NULL
    AND posted_at >= $1
    ORDER BY posted_at DESC
    LIMIT 1;
  `, [p1StartDate]);
  if (postedRows.length > 0) {
    const posted = postedRows[0];
    const replyUrl = `https://x.com/i/web/status/${posted.tweet_id}`;
    console.log(`\n5. Last posted reply:`);
    console.log(`   decision_id: ${posted.decision_id}`);
    console.log(`   tweet_id: ${posted.tweet_id}`);
    console.log(`   reply_url: ${replyUrl} ✅`);
    console.log(`   posted_at: ${posted.posted_at}`);
    console.log(`   target_tweet_id: ${posted.target_tweet_id}`);
  } else {
    console.log(`\n5. Last posted reply: ⚠️  None found`);
  }

  // 6. Auth status
  const executionMode = process.env.EXECUTION_MODE || 'control';
  const isRailwayMode = executionMode === 'control';
  console.log(`\n6. Auth status:`);
  console.log(`   Execution mode: ${executionMode}`);
  if (isRailwayMode) {
    console.log(`   Railway: Public discovery (auth not required)`);
  } else {
    console.log(`   Executor: Auth required (local Chrome profile)`);
  }

  await client.end();

  // Exit code based on P1 completion
  const hasPostedReply = postedRows.length > 0;
  const hasOkProbe = probeSummaryRows.length > 0 && 
    (probeSummaryRows[0].event_data as any)?.ok >= 1;
  
  if (hasPostedReply) {
    console.log(`\n✅ P1 COMPLETE: Reply posted (P1 flow)`);
    process.exit(0);
  } else if (hasOkProbe && publicCount >= 25) {
    console.log(`\n⏳ P1 IN PROGRESS: Ready for posting`);
    process.exit(0);
  } else {
    console.log(`\n⚠️  P1 NOT READY:`);
    if (publicCount < 25) {
      console.log(`   - Need ${25 - publicCount} more public candidates`);
    }
    if (!hasOkProbe) {
      console.log(`   - Need plan-only ok>=1`);
    }
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
