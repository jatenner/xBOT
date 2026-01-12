#!/usr/bin/env tsx
/**
 * Query recent reply_decisions rows with stage timestamps
 */

import 'dotenv/config';
import { Client } from 'pg';

async function queryRecentDecisions() {
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

    // Query rows created in last 30 minutes
    const { rows } = await client.query(`
      SELECT 
        decision_id,
        decision,
        scored_at,
        template_selected_at,
        generation_started_at,
        generation_completed_at,
        posting_started_at,
        posting_completed_at,
        pipeline_error_reason,
        template_status,
        template_id,
        prompt_version,
        created_at
      FROM reply_decisions
      WHERE created_at >= NOW() - INTERVAL '30 minutes'
      ORDER BY created_at DESC
      LIMIT 20;
    `);

    console.log(`📊 RECENT REPLY DECISIONS (last 30 minutes): ${rows.length} rows\n`);

    if (rows.length === 0) {
      console.log('   No rows found in last 30 minutes');
      return;
    }

    rows.forEach((row: any, idx: number) => {
      console.log(`${idx + 1}. decision_id=${row.decision_id?.substring(0, 20)}...`);
      console.log(`   decision=${row.decision}`);
      console.log(`   created_at=${row.created_at}`);
      console.log(`   scored_at=${row.scored_at || 'NULL'}`);
      console.log(`   template_selected_at=${row.template_selected_at || 'NULL'}`);
      console.log(`   generation_started_at=${row.generation_started_at || 'NULL'}`);
      console.log(`   generation_completed_at=${row.generation_completed_at || 'NULL'}`);
      console.log(`   posting_started_at=${row.posting_started_at || 'NULL'}`);
      console.log(`   posting_completed_at=${row.posting_completed_at || 'NULL'}`);
      console.log(`   pipeline_error_reason=${row.pipeline_error_reason || 'NULL'}`);
      console.log(`   template_status=${row.template_status}`);
      console.log(`   template_id=${row.template_id || 'NULL'}`);
      console.log(`   prompt_version=${row.prompt_version || 'NULL'}`);
      console.log('');
    });

    // Count rows that progressed beyond scored_at
    const { rows: progressedRows } = await client.query(`
      SELECT COUNT(*) as count
      FROM reply_decisions
      WHERE created_at >= NOW() - INTERVAL '30 minutes'
        AND scored_at IS NOT NULL
        AND (template_selected_at IS NOT NULL 
             OR generation_started_at IS NOT NULL 
             OR generation_completed_at IS NOT NULL
             OR posting_started_at IS NOT NULL
             OR posting_completed_at IS NOT NULL)
        AND pipeline_error_reason != 'GENERATION_FAILED_MISSING_API_KEY'
        AND pipeline_error_reason IS DISTINCT FROM 'GENERATION_FAILED_MISSING_API_KEY';
    `);

    console.log(`✅ Rows progressed beyond scored_at (excluding missing-key errors): ${progressedRows[0].count}`);

  } catch (error: any) {
    console.error('❌ Query failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

queryRecentDecisions().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
