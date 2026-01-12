#!/usr/bin/env tsx
/**
 * Analyze pipeline stage bottlenecks
 */

import 'dotenv/config';
import { Client } from 'pg';

async function analyzeBottlenecks() {
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

    // 1. Stage timestamp counts for last 2 hours
    console.log('📊 1. STAGE TIMESTAMP COUNTS (last 2 hours, ALLOW only):');
    const { rows: stageCounts } = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(scored_at) as has_scored,
        COUNT(template_selected_at) as has_template_selected,
        COUNT(generation_started_at) as has_generation_started,
        COUNT(generation_completed_at) as has_generation_completed,
        COUNT(posting_started_at) as has_posting_started,
        COUNT(posting_completed_at) as has_posting_completed,
        COUNT(posted_reply_tweet_id) as has_posted_tweet_id
      FROM reply_decisions
      WHERE decision = 'ALLOW'
        AND created_at >= NOW() - INTERVAL '2 hours';
    `);

    if (stageCounts.length > 0) {
      const s = stageCounts[0];
      console.log(`   Total ALLOW decisions: ${s.total}`);
      console.log(`   scored_at: ${s.has_scored}/${s.total} (${s.total > 0 ? Math.round(s.has_scored/s.total*100) : 0}%)`);
      console.log(`   template_selected_at: ${s.has_template_selected}/${s.total} (${s.total > 0 ? Math.round(s.has_template_selected/s.total*100) : 0}%)`);
      console.log(`   generation_started_at: ${s.has_generation_started}/${s.total} (${s.total > 0 ? Math.round(s.has_generation_started/s.total*100) : 0}%)`);
      console.log(`   generation_completed_at: ${s.has_generation_completed}/${s.total} (${s.total > 0 ? Math.round(s.has_generation_completed/s.total*100) : 0}%)`);
      console.log(`   posting_started_at: ${s.has_posting_started}/${s.total} (${s.total > 0 ? Math.round(s.has_posting_started/s.total*100) : 0}%)`);
      console.log(`   posting_completed_at: ${s.has_posting_completed}/${s.total} (${s.total > 0 ? Math.round(s.has_posting_completed/s.total*100) : 0}%)`);
      console.log(`   posted_reply_tweet_id: ${s.has_posted_tweet_id}/${s.total} (${s.total > 0 ? Math.round(s.has_posted_tweet_id/s.total*100) : 0}%)`);
    } else {
      console.log('   No ALLOW decisions in last 2 hours');
    }
    console.log('');

    // 2. Failure distribution by pipeline_error_reason (last 6 hours)
    console.log('📊 2. FAILURE DISTRIBUTION BY PIPELINE_ERROR_REASON (last 6h, ALLOW + FAILED):');
    const { rows: failures } = await client.query(`
      SELECT 
        pipeline_error_reason,
        COUNT(*) as count
      FROM reply_decisions
      WHERE decision = 'ALLOW'
        AND template_status = 'FAILED'
        AND created_at >= NOW() - INTERVAL '6 hours'
      GROUP BY pipeline_error_reason
      ORDER BY count DESC;
    `);

    if (failures.length === 0) {
      console.log('   No FAILED rows in last 6h');
    } else {
      failures.forEach((row: any) => {
        console.log(`   ${row.pipeline_error_reason || 'NULL'}: ${row.count}`);
      });
    }
    console.log('');

    // 3. Recent decisions with full stage progression
    console.log('📊 3. RECENT ALLOW DECISIONS WITH STAGE PROGRESSION (last 10):');
    const { rows: recent } = await client.query(`
      SELECT 
        decision_id,
        template_status,
        scored_at IS NOT NULL as has_scored,
        template_selected_at IS NOT NULL as has_template_selected,
        generation_started_at IS NOT NULL as has_generation_started,
        generation_completed_at IS NOT NULL as has_generation_completed,
        posting_started_at IS NOT NULL as has_posting_started,
        posting_completed_at IS NOT NULL as has_posting_completed,
        posted_reply_tweet_id IS NOT NULL as has_posted_tweet_id,
        pipeline_error_reason,
        created_at,
        EXTRACT(EPOCH FROM (NOW() - created_at))/60 as age_minutes
      FROM reply_decisions
      WHERE decision = 'ALLOW'
        AND created_at >= NOW() - INTERVAL '2 hours'
      ORDER BY created_at DESC
      LIMIT 10;
    `);

    if (recent.length === 0) {
      console.log('   No ALLOW decisions in last 2 hours');
    } else {
      recent.forEach((row: any, i: number) => {
        console.log(`   ${i + 1}. decision_id=${row.decision_id?.substring(0, 8) || 'N/A'}... (age=${Math.round(row.age_minutes)}min, status=${row.template_status})`);
        const stages = [];
        if (row.has_scored) stages.push('scored');
        if (row.has_template_selected) stages.push('template');
        if (row.has_generation_started) stages.push('gen_started');
        if (row.has_generation_completed) stages.push('gen_completed');
        if (row.has_posting_started) stages.push('post_started');
        if (row.has_posting_completed) stages.push('post_completed');
        if (row.has_posted_tweet_id) stages.push('posted');
        console.log(`      Stages: ${stages.length > 0 ? stages.join(' → ') : 'none'}`);
        if (row.pipeline_error_reason) {
          console.log(`      pipeline_error_reason: ${row.pipeline_error_reason}`);
        }
        console.log('');
      });
    }

    // 4. Bottleneck analysis
    console.log('📊 4. BOTTLENECK ANALYSIS:');
    const { rows: bottleneck } = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE scored_at IS NULL) as stuck_at_scored,
        COUNT(*) FILTER (WHERE scored_at IS NOT NULL AND template_selected_at IS NULL) as stuck_at_template,
        COUNT(*) FILTER (WHERE template_selected_at IS NOT NULL AND generation_started_at IS NULL) as stuck_at_pre_generation,
        COUNT(*) FILTER (WHERE generation_started_at IS NOT NULL AND generation_completed_at IS NULL) as stuck_at_generation,
        COUNT(*) FILTER (WHERE generation_completed_at IS NOT NULL AND posting_started_at IS NULL) as stuck_at_pre_posting,
        COUNT(*) FILTER (WHERE posting_started_at IS NOT NULL AND posting_completed_at IS NULL) as stuck_at_posting,
        COUNT(*) FILTER (WHERE posting_completed_at IS NOT NULL AND posted_reply_tweet_id IS NULL) as stuck_at_post_complete
      FROM reply_decisions
      WHERE decision = 'ALLOW'
        AND created_at >= NOW() - INTERVAL '2 hours'
        AND template_status != 'SET' OR posted_reply_tweet_id IS NULL;
    `);

    if (bottleneck.length > 0) {
      const b = bottleneck[0];
      const total = b.stuck_at_scored + b.stuck_at_template + b.stuck_at_pre_generation + 
                    b.stuck_at_generation + b.stuck_at_pre_posting + b.stuck_at_posting + b.stuck_at_post_complete;
      if (total > 0) {
        console.log(`   Stuck at scored: ${b.stuck_at_scored}`);
        console.log(`   Stuck at template selection: ${b.stuck_at_template}`);
        console.log(`   Stuck at pre-generation: ${b.stuck_at_pre_generation}`);
        console.log(`   Stuck at generation: ${b.stuck_at_generation}`);
        console.log(`   Stuck at pre-posting: ${b.stuck_at_pre_posting}`);
        console.log(`   Stuck at posting: ${b.stuck_at_posting}`);
        console.log(`   Stuck after posting complete: ${b.stuck_at_post_complete}`);
      } else {
        console.log('   No stuck decisions found');
      }
    }

    console.log('\n✅ Analysis complete');

  } catch (error: any) {
    console.error('❌ Analysis failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

analyzeBottlenecks().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
