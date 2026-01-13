#!/usr/bin/env tsx
/**
 * Query pipeline progression for ALLOW decisions
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';

async function main() {
  const supabase = getSupabaseClient();
  
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  console.log('═'.repeat(80));
  console.log('📊 PIPELINE PROGRESSION QUERY');
  console.log('═'.repeat(80));
  console.log(`Querying decisions created after: ${oneHourAgo}\n`);
  
  // Get all ALLOW decisions
  const { data: decisions, error } = await supabase
    .from('reply_decisions')
    .select('*')
    .eq('decision', 'ALLOW')
    .gte('created_at', oneHourAgo)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
  
  if (!decisions || decisions.length === 0) {
    console.log('⚠️ No ALLOW decisions found in last 60 minutes');
    return;
  }
  
  // Counts
  const total = decisions.length;
  const templateSelected = decisions.filter(d => d.template_selected_at).length;
  const generationCompleted = decisions.filter(d => d.generation_completed_at).length;
  const postingCompleted = decisions.filter(d => d.posting_completed_at).length;
  const posted = decisions.filter(d => d.posted_reply_tweet_id).length;
  const withErrors = decisions.filter(d => d.pipeline_error_reason).length;
  
  console.log('═'.repeat(80));
  console.log('📊 COUNTS (Last 60 Minutes)');
  console.log('═'.repeat(80));
  console.log(`Total ALLOW decisions:        ${total.toString().padStart(6)}`);
  console.log(`template_selected_at set:     ${templateSelected.toString().padStart(6)}`);
  console.log(`generation_completed_at set:  ${generationCompleted.toString().padStart(6)}`);
  console.log(`posting_completed_at set:     ${postingCompleted.toString().padStart(6)}`);
  console.log(`posted_reply_tweet_id set:    ${posted.toString().padStart(6)}`);
  console.log(`pipeline_error_reason set:    ${withErrors.toString().padStart(6)}`);
  console.log('');
  
  // Top 10 newest
  const top10 = decisions.slice(0, 10);
  
  console.log('═'.repeat(80));
  console.log('📋 TOP 10 NEWEST ALLOW DECISIONS');
  console.log('═'.repeat(80));
  
  for (let i = 0; i < top10.length; i++) {
    const d = top10[i];
    console.log(`\n[${i + 1}] ${d.created_at}`);
    console.log(`    decision_id: ${d.decision_id || 'N/A'}`);
    console.log(`    target_tweet_id: ${d.target_tweet_id || 'N/A'}`);
    console.log(`    template_status: ${d.template_status || 'NULL'}`);
    console.log(`    template_id: ${d.template_id || 'NULL'}`);
    console.log(`    prompt_version: ${d.prompt_version || 'NULL'}`);
    console.log(`    scored_at: ${d.scored_at || 'NULL'}`);
    console.log(`    template_selected_at: ${d.template_selected_at || 'NULL'}`);
    console.log(`    generation_completed_at: ${d.generation_completed_at || 'NULL'}`);
    console.log(`    posting_completed_at: ${d.posting_completed_at || 'NULL'}`);
    console.log(`    posted_reply_tweet_id: ${d.posted_reply_tweet_id || 'NULL'}`);
    if (d.pipeline_error_reason) {
      console.log(`    pipeline_error_reason: ${d.pipeline_error_reason}`);
    }
    if (d.template_error_reason) {
      console.log(`    template_error_reason: ${d.template_error_reason}`);
    }
  }
  console.log('\n' + '═'.repeat(80));
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
