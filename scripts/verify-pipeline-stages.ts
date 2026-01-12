#!/usr/bin/env tsx
/**
 * Verify pipeline stage timestamps
 */

import 'dotenv/config';
import { Client } from 'pg';

async function verifyPipelineStages() {
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

    // 1. Failure distribution by pipeline_error_reason
    console.log('📊 1. FAILURE DISTRIBUTION BY PIPELINE_ERROR_REASON (last 24h):');
    const { rows: failureDist } = await client.query(`
      SELECT 
        pipeline_error_reason,
        COUNT(*) as count
      FROM reply_decisions
      WHERE decision = 'ALLOW'
        AND template_status = 'FAILED'
        AND created_at >= NOW() - INTERVAL '24 hours'
        AND pipeline_error_reason IS NOT NULL
      GROUP BY pipeline_error_reason
      ORDER BY count DESC;
    `);
    
    if (failureDist.length === 0) {
      console.log('   No failures with pipeline_error_reason in last 24h');
    } else {
      failureDist.forEach((row: any) => {
        console.log(`   ${row.pipeline_error_reason || 'NULL'}: ${row.count}`);
      });
    }
    console.log('');

    // 2. Recent ALLOW decisions with stage timestamps
    console.log('📊 2. RECENT ALLOW DECISIONS WITH STAGE TIMESTAMPS (last 10):');
    const { rows: recentDecisions } = await client.query(`
      SELECT 
        decision_id,
        template_status,
        scored_at,
        template_selected_at,
        generation_started_at,
        generation_completed_at,
        posting_started_at,
        posting_completed_at,
        posted_reply_tweet_id,
        pipeline_error_reason,
        created_at,
        EXTRACT(EPOCH FROM (NOW() - created_at))/60 as age_minutes
      FROM reply_decisions
      WHERE decision = 'ALLOW'
      ORDER BY created_at DESC
      LIMIT 10;
    `);
    
    recentDecisions.forEach((row: any, i: number) => {
      console.log(`   ${i + 1}. decision_id=${row.decision_id?.substring(0, 8) || 'N/A'}... (age=${Math.round(row.age_minutes)}min)`);
      console.log(`      template_status=${row.template_status}`);
      console.log(`      scored_at=${row.scored_at ? 'SET' : 'NULL'}`);
      console.log(`      template_selected_at=${row.template_selected_at ? 'SET' : 'NULL'}`);
      console.log(`      generation_started_at=${row.generation_started_at ? 'SET' : 'NULL'}`);
      console.log(`      generation_completed_at=${row.generation_completed_at ? 'SET' : 'NULL'}`);
      console.log(`      posting_started_at=${row.posting_started_at ? 'SET' : 'NULL'}`);
      console.log(`      posting_completed_at=${row.posting_completed_at ? 'SET' : 'NULL'}`);
      console.log(`      posted_reply_tweet_id=${row.posted_reply_tweet_id || 'NULL'}`);
      console.log(`      pipeline_error_reason=${row.pipeline_error_reason || 'NULL'}`);
      console.log('');
    });

    // 3. Stage progression analysis
    console.log('📊 3. STAGE PROGRESSION ANALYSIS (last 24h, ALLOW only):');
    const { rows: stageAnalysis } = await client.query(`
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
        AND created_at >= NOW() - INTERVAL '24 hours';
    `);
    
    if (stageAnalysis.length > 0) {
      const s = stageAnalysis[0];
      console.log(`   Total ALLOW decisions: ${s.total}`);
      console.log(`   Scored: ${s.has_scored}/${s.total} (${Math.round(s.has_scored/s.total*100)}%)`);
      console.log(`   Template selected: ${s.has_template_selected}/${s.total} (${Math.round(s.has_template_selected/s.total*100)}%)`);
      console.log(`   Generation started: ${s.has_generation_started}/${s.total} (${Math.round(s.has_generation_started/s.total*100)}%)`);
      console.log(`   Generation completed: ${s.has_generation_completed}/${s.total} (${Math.round(s.has_generation_completed/s.total*100)}%)`);
      console.log(`   Posting started: ${s.has_posting_started}/${s.total} (${Math.round(s.has_posting_started/s.total*100)}%)`);
      console.log(`   Posting completed: ${s.has_posting_completed}/${s.total} (${Math.round(s.has_posting_completed/s.total*100)}%)`);
      console.log(`   Posted tweet ID: ${s.has_posted_tweet_id}/${s.total} (${Math.round(s.has_posted_tweet_id/s.total*100)}%)`);
    }
    console.log('');

    // 4. Average stage durations (for completed flows)
    console.log('📊 4. AVERAGE STAGE DURATIONS (completed flows, last 24h):');
    const { rows: durations } = await client.query(`
      SELECT 
        AVG(EXTRACT(EPOCH FROM (template_selected_at - scored_at))) as template_selection_sec,
        AVG(EXTRACT(EPOCH FROM (generation_started_at - template_selected_at))) as pre_generation_sec,
        AVG(EXTRACT(EPOCH FROM (generation_completed_at - generation_started_at))) as generation_sec,
        AVG(EXTRACT(EPOCH FROM (posting_started_at - generation_completed_at))) as pre_posting_sec,
        AVG(EXTRACT(EPOCH FROM (posting_completed_at - posting_started_at))) as posting_sec
      FROM reply_decisions
      WHERE decision = 'ALLOW'
        AND template_selected_at IS NOT NULL
        AND generation_completed_at IS NOT NULL
        AND posting_completed_at IS NOT NULL
        AND created_at >= NOW() - INTERVAL '24 hours';
    `);
    
    if (durations.length > 0 && durations[0].template_selection_sec) {
      const d = durations[0];
      console.log(`   Template selection: ${Math.round(d.template_selection_sec || 0)}s`);
      console.log(`   Pre-generation: ${Math.round(d.pre_generation_sec || 0)}s`);
      console.log(`   Generation: ${Math.round(d.generation_sec || 0)}s`);
      console.log(`   Pre-posting: ${Math.round(d.pre_posting_sec || 0)}s`);
      console.log(`   Posting: ${Math.round(d.posting_sec || 0)}s`);
    } else {
      console.log('   No completed flows in last 24h');
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

verifyPipelineStages().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
