#!/usr/bin/env tsx
/**
 * 🔍 VERIFY REPLY PIPELINE LIVE
 * 
 * Queries last 2 hours of reply_decisions and shows pipeline progression
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';

async function main() {
  const supabase = getSupabaseClient();
  
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  
  console.log('═'.repeat(80));
  console.log('🔍 REPLY PIPELINE VERIFICATION');
  console.log('═'.repeat(80));
  console.log(`Querying decisions created after: ${twoHoursAgo}\n`);
  
  // Get all decisions
  const { data: decisions, error } = await supabase
    .from('reply_decisions')
    .select('*')
    .gte('created_at', twoHoursAgo)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
  
  if (!decisions || decisions.length === 0) {
    console.log('⚠️ No decisions found in last 2 hours');
    return;
  }
  
  // Counts
  const total = decisions.length;
  const allow = decisions.filter(d => d.decision === 'ALLOW').length;
  const deny = decisions.filter(d => d.decision === 'DENY').length;
  const templateSelected = decisions.filter(d => d.template_selected_at).length;
  const generationCompleted = decisions.filter(d => d.generation_completed_at).length;
  const postingCompleted = decisions.filter(d => d.posting_completed_at).length;
  
  // Pipeline progression
  const scored = decisions.filter(d => d.scored_at).length;
  const templateSelectedFromAllow = decisions.filter(d => d.decision === 'ALLOW' && d.template_selected_at).length;
  const generationCompletedFromAllow = decisions.filter(d => d.decision === 'ALLOW' && d.generation_completed_at).length;
  const postingCompletedFromAllow = decisions.filter(d => d.decision === 'ALLOW' && d.posting_completed_at).length;
  
  // Errors
  const withPipelineError = decisions.filter(d => d.pipeline_error_reason).length;
  const templateFailed = decisions.filter(d => d.template_status === 'FAILED').length;
  
  console.log('═'.repeat(80));
  console.log('📊 SUMMARY (Last 2 Hours)');
  console.log('═'.repeat(80));
  console.log(`Total decisions:        ${total.toString().padStart(6)}`);
  console.log(`ALLOW:                  ${allow.toString().padStart(6)}`);
  console.log(`DENY:                   ${deny.toString().padStart(6)}`);
  console.log('');
  console.log('Pipeline Progression:');
  console.log(`  scored_at:            ${scored.toString().padStart(6)}`);
  console.log(`  template_selected_at: ${templateSelected.toString().padStart(6)} (${templateSelectedFromAllow} from ALLOW)`);
  console.log(`  generation_completed_at: ${generationCompleted.toString().padStart(6)} (${generationCompletedFromAllow} from ALLOW)`);
  console.log(`  posting_completed_at: ${postingCompleted.toString().padStart(6)} (${postingCompletedFromAllow} from ALLOW)`);
  console.log('');
  console.log('Errors:');
  console.log(`  pipeline_error_reason: ${withPipelineError.toString().padStart(6)}`);
  console.log(`  template_status=FAILED: ${templateFailed.toString().padStart(6)}`);
  console.log('');
  
  // Top 10 newest ALLOW rows
  const allowDecisions = decisions
    .filter(d => d.decision === 'ALLOW')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10);
  
  console.log('═'.repeat(80));
  console.log('📋 TOP 10 NEWEST ALLOW DECISIONS');
  console.log('═'.repeat(80));
  
  if (allowDecisions.length === 0) {
    console.log('  ⚠️ No ALLOW decisions found in last 2 hours');
  } else {
    for (let i = 0; i < allowDecisions.length; i++) {
      const d = allowDecisions[i];
      console.log(`\n[${i + 1}] ${d.created_at}`);
      console.log(`    decision_id: ${d.decision_id || 'N/A'}`);
      console.log(`    target_tweet_id: ${d.target_tweet_id}`);
      console.log(`    scored_at: ${d.scored_at || 'NULL'}`);
      console.log(`    template_selected_at: ${d.template_selected_at || 'NULL'} (status=${d.template_status || 'NULL'})`);
      console.log(`    generation_completed_at: ${d.generation_completed_at || 'NULL'}`);
      console.log(`    posting_completed_at: ${d.posting_completed_at || 'NULL'}`);
      console.log(`    pipeline_error_reason: ${d.pipeline_error_reason || 'NULL'}`);
      if (d.template_error_reason) {
        console.log(`    template_error_reason: ${d.template_error_reason}`);
      }
    }
  }
  console.log('\n' + '═'.repeat(80));
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
