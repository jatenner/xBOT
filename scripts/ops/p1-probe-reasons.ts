#!/usr/bin/env tsx
/**
 * P1 Probe Reasons Report
 * 
 * Analyzes why probes fail and prints a summary table.
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { Client } from 'pg';

async function main() {
  const supabase = getSupabaseClient();
  const dbUrl = process.env.DATABASE_URL!;
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  
  await client.connect();

  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 P1 Probe Reasons Report');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. Accessibility status distribution for last 50 probed candidates
  console.log('1. Accessibility Status (last 50 probed candidates):');
  const { rows: accessibilityRows } = await client.query(`
    SELECT 
      COALESCE(accessibility_status, 'unknown') as status,
      COUNT(*) as count
    FROM (
      SELECT accessibility_status
      FROM reply_opportunities
      WHERE discovery_source LIKE 'public_search_%'
      AND replied_to = false
      ORDER BY created_at DESC
      LIMIT 50
    ) subq
    GROUP BY accessibility_status;
  `);

  if (accessibilityRows.length === 0) {
    console.log('   ⚠️  No probed candidates found\n');
  } else {
    accessibilityRows.forEach((row: any) => {
      console.log(`   ${row.status}: ${row.count}`);
    });
    console.log();
  }

  // 2. Skip reasons from system_events
  console.log('2. Skip Reasons (from system_events, last 100):');
  const { rows: skipReasons } = await client.query(`
    SELECT 
      event_data->>'reason' as reason,
      event_data->>'skip_reason' as skip_reason,
      COUNT(*) as count
    FROM system_events
    WHERE (
      event_type LIKE '%probe%' OR
      event_type LIKE '%preflight%' OR
      message LIKE '%skip%' OR
      message LIKE '%forbidden%' OR
      message LIKE '%login_wall%'
    )
    AND created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY reason, skip_reason
    ORDER BY count DESC
    LIMIT 20;
  `);

  if (skipReasons.length === 0) {
    console.log('   ⚠️  No skip reasons found in system_events\n');
  } else {
    skipReasons.forEach((row: any) => {
      const reason = row.reason || row.skip_reason || 'unknown';
      console.log(`   ${reason}: ${row.count}`);
    });
    console.log();
  }

  // 3. P1_PROBE_SUMMARY from logs (query system_events for probe summary)
  console.log('3. Recent P1_PROBE_SUMMARY (from system_events):');
  const { rows: probeSummaries } = await client.query(`
    SELECT 
      message,
      event_data,
      created_at
    FROM system_events
    WHERE message LIKE '%P1_PROBE_SUMMARY%'
    ORDER BY created_at DESC
    LIMIT 5;
  `);

  if (probeSummaries.length === 0) {
    console.log('   ⚠️  No P1_PROBE_SUMMARY found\n');
  } else {
    probeSummaries.forEach((row: any, idx: number) => {
      console.log(`   [${idx + 1}] ${row.created_at}: ${row.message}`);
      if (row.event_data) {
        console.log(`       Data: ${JSON.stringify(row.event_data)}`);
      }
    });
    console.log();
  }

  // 4. Top 3 failure reasons from reply_opportunities
  console.log('4. Top Failure Reasons (from reply_opportunities):');
  const { rows: failureReasons } = await client.query(`
    SELECT 
      accessibility_status,
      COUNT(*) as count
    FROM reply_opportunities
    WHERE discovery_source LIKE 'public_search_%'
    AND replied_to = false
    AND accessibility_status IS NOT NULL
    AND accessibility_status != 'ok'
    GROUP BY accessibility_status
    ORDER BY count DESC
    LIMIT 5;
  `);

  if (failureReasons.length === 0) {
    console.log('   ⚠️  No failure reasons found\n');
  } else {
    failureReasons.forEach((row: any) => {
      console.log(`   ${row.accessibility_status}: ${row.count}`);
    });
    console.log();
  }

  await client.end();
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
