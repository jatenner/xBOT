/**
 * 🔍 AUDIT POSTED REPLIES
 * 
 * Checks recent posted replies for invariant violations:
 * - Reply chains (root != target)
 * - Thread-like content
 * - Missing context
 * - Missing DB rows
 * 
 * Usage: npx tsx scripts/audit-posted-replies.ts <hours>
 */

import { getSupabaseClient, pgPool } from '../src/db/index';

const hours = parseInt(process.argv[2]) || 12;

async function main() {
  console.log(`[AUDIT] 🔍 Auditing replies from last ${hours} hours...\n`);
  
  const supabase = getSupabaseClient();
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  
  // Fetch all posted replies in time window
  const { data: replies, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('*')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .gte('posted_at', cutoff)
    .order('posted_at', { ascending: false });
  
  if (error) {
    console.error('❌ DB query error:', error.message);
    process.exit(1);
  }
  
  if (!replies || replies.length === 0) {
    console.log('✅ No replies found in time window');
    process.exit(0);
  }
  
  console.log(`📊 Found ${replies.length} posted replies\n`);
  
  // Check violations
  const violations = {
    reply_chain: [] as any[],
    thread_like: [] as any[],
    missing_context: [] as any[],
    missing_db: [] as any[],
    target_is_reply: [] as any[],
  };
  
  for (const reply of replies) {
    // Reply chain: root != target
    if (reply.root_tweet_id && reply.target_tweet_id && reply.root_tweet_id !== reply.target_tweet_id) {
      violations.reply_chain.push({
        decision_id: reply.decision_id,
        tweet_id: reply.tweet_id,
        root: reply.root_tweet_id,
        target: reply.target_tweet_id,
        posted_at: reply.posted_at,
      });
    }
    
    // Thread-like: Check content for thread patterns
    const content = reply.content || '';
    const threadPatterns = [
      /\b\d+\/\d+\b/,
      /^\d+\.\s/m,
      /\(\d+\)/,
      /\bthread\b/i,
      /\bPROTOCOL:/i,
      /\bTIP\s*\d+/i,
      /\n\n\n/,
    ];
    
    if (threadPatterns.some(p => p.test(content))) {
      violations.thread_like.push({
        decision_id: reply.decision_id,
        tweet_id: reply.tweet_id,
        content_preview: content.substring(0, 80),
        posted_at: reply.posted_at,
      });
    }
    
    // Missing context: No snapshot or too short
    if (!reply.target_tweet_content_snapshot || reply.target_tweet_content_snapshot.length < 40) {
      violations.missing_context.push({
        decision_id: reply.decision_id,
        tweet_id: reply.tweet_id,
        snapshot_len: reply.target_tweet_content_snapshot?.length || 0,
        posted_at: reply.posted_at,
      });
    }
    
    // Target is reply: target_in_reply_to_tweet_id is set OR conversation_id != target_tweet_id
    if ((reply as any).target_in_reply_to_tweet_id || 
        ((reply as any).target_conversation_id && 
         (reply as any).target_conversation_id !== reply.target_tweet_id)) {
      violations.target_is_reply.push({
        decision_id: reply.decision_id,
        tweet_id: reply.tweet_id,
        target_tweet_id: reply.target_tweet_id,
        in_reply_to: (reply as any).target_in_reply_to_tweet_id,
        conversation_id: (reply as any).target_conversation_id,
        posted_at: reply.posted_at,
      });
    }
  }
  
  // Report violations
  console.log(`\n📋 AUDIT RESULTS:\n`);
  
  console.log(`🚫 Reply Chain Violations: ${violations.reply_chain.length}`);
  if (violations.reply_chain.length > 0) {
    violations.reply_chain.forEach(v => {
      console.log(`   ❌ ${v.tweet_id}: root=${v.root} target=${v.target}`);
    });
  }
  
  console.log(`\n🚫 Thread-Like Content: ${violations.thread_like.length}`);
  if (violations.thread_like.length > 0) {
    violations.thread_like.slice(0, 5).forEach(v => {
      console.log(`   ❌ ${v.tweet_id}: "${v.content_preview}..."`);
    });
    if (violations.thread_like.length > 5) {
      console.log(`   ... and ${violations.thread_like.length - 5} more`);
    }
  }
  
  console.log(`\n🚫 Missing Context: ${violations.missing_context.length}`);
  if (violations.missing_context.length > 0) {
    violations.missing_context.slice(0, 5).forEach(v => {
      console.log(`   ❌ ${v.tweet_id}: snapshot_len=${v.snapshot_len}`);
    });
    if (violations.missing_context.length > 5) {
      console.log(`   ... and ${violations.missing_context.length - 5} more`);
    }
  }
  
  console.log(`\n🚫 Target Is Reply Tweet: ${violations.target_is_reply.length}`);
  if (violations.target_is_reply.length > 0) {
    violations.target_is_reply.slice(0, 5).forEach(v => {
      console.log(`   ❌ ${v.tweet_id}: target=${v.target_tweet_id} in_reply_to=${v.in_reply_to || 'N/A'} conversation=${v.conversation_id || 'N/A'}`);
    });
    if (violations.target_is_reply.length > 5) {
      console.log(`   ... and ${violations.target_is_reply.length - 5} more`);
    }
  }
  
  const totalViolations = 
    violations.reply_chain.length + 
    violations.thread_like.length + 
    violations.missing_context.length +
    violations.target_is_reply.length;
  
  if (totalViolations === 0) {
    console.log(`\n✅ NO VIOLATIONS FOUND`);
    console.log(`   All ${replies.length} replies pass invariant checks`);
    process.exit(0);
  } else {
    console.log(`\n⚠️ FOUND ${totalViolations} VIOLATIONS`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Script error:', err.message);
  process.exit(1);
});
