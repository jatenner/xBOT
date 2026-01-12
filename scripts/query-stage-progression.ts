#!/usr/bin/env tsx
/**
 * Query stage progression for last 6 hours
 */

import 'dotenv/config';
import { Client } from 'pg';

async function queryStageProgression() {
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

    // Total ALLOW rows in last 6 hours
    console.log('📊 STAGE PROGRESSION (last 6 hours):\n');
    
    const { rows: summary } = await client.query(`
      SELECT 
        COUNT(*) as total_allow,
        COUNT(scored_at) as has_scored,
        COUNT(template_selected_at) as has_template_selected,
        COUNT(generation_started_at) as has_generation_started,
        COUNT(generation_completed_at) as has_generation_completed,
        COUNT(posting_started_at) as has_posting_started,
        COUNT(posting_completed_at) as has_posting_completed,
        COUNT(posted_reply_tweet_id) as has_posted_tweet_id
      FROM reply_decisions
      WHERE decision = 'ALLOW'
        AND created_at >= NOW() - INTERVAL '6 hours';
    `);

    if (summary.length > 0) {
      const s = summary[0];
      console.log(`Total ALLOW rows: ${s.total_allow}`);
      console.log(`  scored_at: ${s.has_scored}/${s.total_allow} (${s.total_allow > 0 ? Math.round(s.has_scored/s.total_allow*100) : 0}%)`);
      console.log(`  template_selected_at: ${s.has_template_selected}/${s.total_allow} (${s.total_allow > 0 ? Math.round(s.has_template_selected/s.total_allow*100) : 0}%)`);
      console.log(`  generation_started_at: ${s.has_generation_started}/${s.total_allow} (${s.total_allow > 0 ? Math.round(s.has_generation_started/s.total_allow*100) : 0}%)`);
      console.log(`  generation_completed_at: ${s.has_generation_completed}/${s.total_allow} (${s.total_allow > 0 ? Math.round(s.has_generation_completed/s.total_allow*100) : 0}%)`);
      console.log(`  posting_started_at: ${s.has_posting_started}/${s.total_allow} (${s.total_allow > 0 ? Math.round(s.has_posting_started/s.total_allow*100) : 0}%)`);
      console.log(`  posting_completed_at: ${s.has_posting_completed}/${s.total_allow} (${s.total_allow > 0 ? Math.round(s.has_posting_completed/s.total_allow*100) : 0}%)`);
      console.log(`  posted_reply_tweet_id: ${s.has_posted_tweet_id}/${s.total_allow} (${s.total_allow > 0 ? Math.round(s.has_posted_tweet_id/s.total_allow*100) : 0}%)`);
    }
    console.log('');

    // Top pipeline_error_reason counts for FAILED rows
    console.log('📊 FAILURE DISTRIBUTION BY PIPELINE_ERROR_REASON (last 6h, ALLOW + FAILED):');
    const { rows: failures } = await client.query(`
      SELECT 
        pipeline_error_reason,
        COUNT(*) as count
      FROM reply_decisions
      WHERE decision = 'ALLOW'
        AND template_status = 'FAILED'
        AND created_at >= NOW() - INTERVAL '6 hours'
        AND pipeline_error_reason IS NOT NULL
      GROUP BY pipeline_error_reason
      ORDER BY count DESC;
    `);

    if (failures.length === 0) {
      console.log('   No failures with pipeline_error_reason in last 6h');
    } else {
      failures.forEach((row: any) => {
        console.log(`   ${row.pipeline_error_reason || 'NULL'}: ${row.count}`);
      });
    }
    console.log('');

    // Recent rows with timestamps
    console.log('📊 RECENT ALLOW DECISIONS WITH TIMESTAMPS (last 5):');
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
      ORDER BY created_at DESC
      LIMIT 5;
    `);

    recent.forEach((row: any, i: number) => {
      console.log(`   ${i + 1}. decision_id=${row.decision_id?.substring(0, 8) || 'N/A'}... (age=${Math.round(row.age_minutes)}min, status=${row.template_status})`);
      console.log(`      scored: ${row.has_scored ? '✅' : '❌'}, template_selected: ${row.has_template_selected ? '✅' : '❌'}, generation_started: ${row.has_generation_started ? '✅' : '❌'}, generation_completed: ${row.has_generation_completed ? '✅' : '❌'}, posting_started: ${row.has_posting_started ? '✅' : '❌'}, posting_completed: ${row.has_posting_completed ? '✅' : '❌'}, posted_tweet_id: ${row.has_posted_tweet_id ? '✅' : '❌'}`);
      if (row.pipeline_error_reason) {
        console.log(`      pipeline_error_reason: ${row.pipeline_error_reason}`);
      }
      console.log('');
    });

    console.log('✅ Query complete');

  } catch (error: any) {
    console.error('❌ Query failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

queryStageProgression().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
