/**
 * Start a controlled window for single-post tests
 * Generates token and provides guidance for setting CONTROLLED_DECISION_ID
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';
import crypto from 'crypto';

const decisionId = process.argv[2];

if (!decisionId) {
  console.error('Usage: tsx scripts/start-controlled-window.ts <decision_id>');
  console.error('');
  console.error('Example:');
  console.error('  tsx scripts/start-controlled-window.ts 497a9126-e638-49ba-9420-192017d08f13');
  process.exit(1);
}

async function main() {
  const supabase = getSupabaseClient();
  
  // Verify decision_id exists and is queued
  const { data: decision, error: decisionError } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, status, content, scheduled_at')
    .eq('decision_id', decisionId)
    .single();
  
  if (decisionError || !decision) {
    console.error(`❌ Error: Decision ${decisionId} not found`);
    if (decisionError) {
      console.error(`   ${decisionError.message}`);
    }
    process.exit(1);
  }
  
  if (decision.status !== 'queued') {
    console.error(`❌ Error: Decision ${decisionId} is not queued (status: ${decision.status})`);
    console.error(`   Please ensure the decision is in 'queued' status before starting controlled window`);
    process.exit(1);
  }
  
  // Generate a random token
  const token = crypto.randomBytes(32).toString('hex');
  
  // Insert or update the token
  const { data: tokenData, error: tokenError } = await supabase
    .from('ops_control')
    .upsert(
      {
        key: 'controlled_post_token',
        value: token,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'key' }
    )
    .select()
    .single();
  
  if (tokenError) {
    console.error(`❌ Error setting token: ${tokenError.message}`);
    process.exit(1);
  }
  
  console.log(`✅ Controlled window started:`);
  console.log(`   Decision ID: ${decisionId}`);
  console.log(`   Status: ${decision.status}`);
  console.log(`   Content preview: ${(decision.content || '').substring(0, 60)}...`);
  console.log(`   Scheduled at: ${decision.scheduled_at}`);
  console.log(`   Token: ${token}`);
  console.log(`   Token updated at: ${tokenData?.updated_at}`);
  console.log(`\n📋 Set Railway variables:`);
  console.log(`   railway variables --set CONTROLLED_DECISION_ID=${decisionId}`);
  console.log(`   railway variables --set CONTROLLED_POST_TOKEN=${token}`);
  console.log(`\n⚠️  IMPORTANT:`);
  console.log(`   - Only this decision_id will be posted`);
  console.log(`   - Token can only be consumed once`);
  console.log(`   - Even if postingQueue runs multiple times, only first run can post`);
  console.log(`   - After posting, immediately lock down:`);
  console.log(`     railway variables --set POSTING_ENABLED=false`);
  console.log(`     railway variables --set DRAIN_QUEUE=true`);
  
  process.exit(0);
}

main().catch(console.error);

