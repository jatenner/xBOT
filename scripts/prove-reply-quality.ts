#!/usr/bin/env tsx
/**
 * 🔍 PROVE REPLY QUALITY
 * 
 * Prints last 50 decisions with:
 * - Counts by deny_reason_code
 * - 5 sample blocked targets for each major block
 * - 10 most recent generated replies with: target snippet + reply text + grounding pass/fail
 * 
 * Usage:
 *   railway run -s xBOT -- pnpm exec tsx scripts/prove-reply-quality.ts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';
import { verifyContextGrounding } from '../src/gates/replyContextGroundingGate';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔍 PROVE REPLY QUALITY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const supabase = getSupabaseClient();
  
  // Get last 50 decisions
  const { data: decisions } = await supabase
    .from('reply_decisions')
    .select('decision_id, target_tweet_id, decision, deny_reason_code, created_at, posted_reply_tweet_id')
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (!decisions || decisions.length === 0) {
    console.log('⚠️  No decisions found\n');
    return;
  }
  
  // Count by deny_reason_code
  const denyCounts: Record<string, number> = {};
  const blockedDecisions: Record<string, Array<{ decision_id: string; target_tweet_id: string; created_at: string }>> = {};
  
  for (const decision of decisions) {
    if (decision.decision === 'DENY' && decision.deny_reason_code) {
      const reason = decision.deny_reason_code;
      denyCounts[reason] = (denyCounts[reason] || 0) + 1;
      
      if (!blockedDecisions[reason]) {
        blockedDecisions[reason] = [];
      }
      if (blockedDecisions[reason].length < 5) {
        blockedDecisions[reason].push({
          decision_id: decision.decision_id,
          target_tweet_id: decision.target_tweet_id,
          created_at: decision.created_at,
        });
      }
    }
  }
  
  console.log('📊 DENY REASON CODE COUNTS (Last 50 decisions):\n');
  const sortedReasons = Object.entries(denyCounts).sort((a, b) => b[1] - a[1]);
  for (const [reason, count] of sortedReasons) {
    console.log(`   ${reason}: ${count}`);
  }
  
  const successCount = decisions.filter(d => d.decision === 'ALLOW' && d.posted_reply_tweet_id).length;
  console.log(`\n✅ POST_SUCCESS: ${successCount}`);
  console.log(`📊 Total decisions: ${decisions.length}\n`);
  
  // Show 5 sample blocked targets for each major block
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📋 SAMPLE BLOCKED TARGETS (Top 5 per reason)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  for (const [reason, samples] of Object.entries(blockedDecisions)) {
    if (samples.length === 0) continue;
    
    console.log(`${reason} (${denyCounts[reason]} total):`);
    
    for (const sample of samples) {
      // Get target tweet content
      const { data: contentMeta } = await supabase
        .from('content_metadata')
        .select('target_tweet_content_snapshot')
        .eq('decision_id', sample.decision_id)
        .maybeSingle();
      
      const targetSnippet = contentMeta?.target_tweet_content_snapshot?.substring(0, 100) || 'N/A';
      console.log(`   - decision_id: ${sample.decision_id}`);
      console.log(`     target_tweet_id: ${sample.target_tweet_id}`);
      console.log(`     target_snippet: "${targetSnippet}..."`);
      console.log(`     created_at: ${sample.created_at}`);
      console.log('');
    }
  }
  
  // Get 10 most recent generated replies
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📝 RECENT GENERATED REPLIES (Last 10)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const { data: recentReplies } = await supabase
    .from('content_metadata')
    .select('decision_id, target_tweet_id, target_tweet_content_snapshot, content, target_username, created_at')
    .eq('decision_type', 'reply')
    .not('content', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (recentReplies && recentReplies.length > 0) {
    for (const reply of recentReplies) {
      const targetText = reply.target_tweet_content_snapshot || '';
      const replyText = reply.content || '';
      const authorUsername = reply.target_username || undefined;
      
      // Check grounding
      const groundingCheck = verifyContextGrounding(
        replyText,
        targetText,
        undefined,
        undefined,
        authorUsername
      );
      
      console.log(`Decision ID: ${reply.decision_id}`);
      console.log(`Target Tweet ID: ${reply.target_tweet_id}`);
      console.log(`Target Snippet: "${targetText.substring(0, 80)}..."`);
      console.log(`Reply Text: "${replyText.substring(0, 120)}..."`);
      console.log(`Grounding: ${groundingCheck.pass ? '✅ PASS' : '❌ FAIL'} (${groundingCheck.reason})`);
      if (groundingCheck.grounding_evidence) {
        console.log(`   Matched: ${groundingCheck.grounding_evidence.matched_keyphrases.slice(0, 3).join(', ')}`);
        console.log(`   Method: ${groundingCheck.grounding_evidence.matched_method}`);
      }
      console.log(`Created At: ${reply.created_at}`);
      console.log('');
    }
  } else {
    console.log('⚠️  No recent generated replies found\n');
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
