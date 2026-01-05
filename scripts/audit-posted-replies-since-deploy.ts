#!/usr/bin/env tsx
/**
 * 🔍 AUDIT POSTED REPLIES SINCE DEPLOY
 * 
 * Checks for safety violations in replies posted after the current deploy.
 * 
 * Flags:
 *   - thread_like: Content matches thread patterns (1/6, 🧵, TIP 3, etc)
 *   - reply_chain: Target is a reply, not a root tweet
 *   - missing_context: No snapshot or semantic_similarity
 * 
 * Usage: npx tsx scripts/audit-posted-replies-since-deploy.ts
 * 
 * Exit codes:
 *   0 = All clear, no violations
 *   1 = Violations found (SEV1)
 *   2 = Script error
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

// Thread-like patterns that should NEVER appear in replies
const THREAD_LIKE_PATTERNS = [
  /\b\d+\/\d+\b/,           // "1/6", "2/5"
  /🧵/,                      // Thread emoji
  /THREAD/i,                 // "THREAD"
  /PROTOCOL:/i,              // "PROTOCOL:"
  /TIP\s*\d+/i,              // "TIP 3", "TIP 1"
  /^\d+\./m,                 // Line starting with "1.", "2."
  /^Part\s+\d+/im,           // "Part 1", "Part 2"
];

interface ReplyAuditResult {
  decision_id: string;
  tweet_id: string | null;
  content: string;
  target_tweet_id: string | null;
  root_tweet_id: string | null;
  target_tweet_content_snapshot: string | null;
  semantic_similarity: number | null;
  status: string;
  skip_reason: string | null;
  pipeline_source: string | null;
  created_at: string;
  posted_at: string | null;
  
  // Computed flags
  is_thread_like: boolean;
  is_reply_chain: boolean;
  is_missing_context: boolean;
  violations: string[];
}

function checkThreadLike(content: string | null): boolean {
  if (!content) return false;
  return THREAD_LIKE_PATTERNS.some(pattern => pattern.test(content));
}

function checkReplyChain(
  snapshot: string | null,
  targetId: string | null,
  rootId: string | null
): boolean {
  // If snapshot starts with @ it's likely a reply
  if (snapshot && snapshot.trim().startsWith('@')) return true;
  
  // If root != target, target is not a root tweet
  if (targetId && rootId && targetId !== rootId) return true;
  
  return false;
}

function checkMissingContext(
  snapshot: string | null,
  similarity: number | null
): boolean {
  if (!snapshot || snapshot.length < 20) return true;
  if (similarity === null || similarity === undefined) return true;
  return false;
}

async function main() {
  console.log('\n🔍 AUDIT: Posted Replies Since Deploy\n');
  console.log('='.repeat(70));
  
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  // Get deploy boundary (last 2 hours as fallback)
  const deployBoundary = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  console.log(`📅 Audit window: Since ${deployBoundary}`);
  
  // Fetch posted replies
  const { data: replies, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('*')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .gte('posted_at', deployBoundary)
    .order('posted_at', { ascending: false })
    .limit(200);
  
  if (error) {
    console.error('❌ Database error:', error.message);
    process.exit(2);
  }
  
  console.log(`📊 Found ${replies?.length || 0} posted replies in audit window\n`);
  
  if (!replies || replies.length === 0) {
    console.log('✅ No posted replies to audit - all clear!\n');
    process.exit(0);
  }
  
  // Audit each reply
  const results: ReplyAuditResult[] = [];
  let threadLikeCount = 0;
  let replyChainCount = 0;
  let missingContextCount = 0;
  
  for (const reply of replies) {
    const isThreadLike = checkThreadLike(reply.content);
    const isReplyChain = checkReplyChain(
      reply.target_tweet_content_snapshot,
      reply.target_tweet_id,
      reply.root_tweet_id
    );
    const isMissingContext = checkMissingContext(
      reply.target_tweet_content_snapshot,
      reply.semantic_similarity
    );
    
    const violations: string[] = [];
    if (isThreadLike) {
      violations.push('thread_like');
      threadLikeCount++;
    }
    if (isReplyChain) {
      violations.push('reply_chain');
      replyChainCount++;
    }
    if (isMissingContext) {
      violations.push('missing_context');
      missingContextCount++;
    }
    
    results.push({
      decision_id: reply.decision_id,
      tweet_id: reply.tweet_id,
      content: reply.content,
      target_tweet_id: reply.target_tweet_id,
      root_tweet_id: reply.root_tweet_id,
      target_tweet_content_snapshot: reply.target_tweet_content_snapshot,
      semantic_similarity: reply.semantic_similarity,
      status: reply.status,
      skip_reason: reply.skip_reason,
      pipeline_source: reply.pipeline_source,
      created_at: reply.created_at,
      posted_at: reply.posted_at,
      is_thread_like: isThreadLike,
      is_reply_chain: isReplyChain,
      is_missing_context: isMissingContext,
      violations,
    });
  }
  
  // Summary
  console.log('📋 AUDIT SUMMARY');
  console.log('─'.repeat(70));
  console.log(`  Total posted replies:    ${results.length}`);
  console.log(`  thread_like violations:  ${threadLikeCount}`);
  console.log(`  reply_chain violations:  ${replyChainCount}`);
  console.log(`  missing_context:         ${missingContextCount}`);
  console.log('─'.repeat(70));
  
  // Show violations
  const violations = results.filter(r => r.violations.length > 0);
  
  if (violations.length > 0) {
    console.log(`\n🚨 VIOLATIONS FOUND (${violations.length}):\n`);
    
    for (const v of violations.slice(0, 10)) { // Show first 10
      console.log(`  tweet_id: ${v.tweet_id}`);
      console.log(`  decision_id: ${v.decision_id}`);
      console.log(`  posted_at: ${v.posted_at}`);
      console.log(`  violations: ${v.violations.join(', ')}`);
      console.log(`  content_preview: "${(v.content || '').substring(0, 80)}..."`);
      console.log(`  snapshot_len: ${v.target_tweet_content_snapshot?.length || 0}`);
      console.log(`  similarity: ${v.semantic_similarity}`);
      console.log(`  pipeline_source: ${v.pipeline_source}`);
      console.log('─'.repeat(70));
    }
    
    console.log(`\n❌ AUDIT FAILED: ${violations.length} violations found`);
    console.log('   This is SEV1 if any of these are thread_like or reply_chain.\n');
    process.exit(1);
  } else {
    console.log('\n✅ AUDIT PASSED: No violations found\n');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(2);
});

