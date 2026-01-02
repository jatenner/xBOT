#!/usr/bin/env tsx
/**
 * Forensic analysis: Last 30 replies with detailed classification
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function forensicAnalysis() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 FORENSIC ANALYSIS: LAST 30 POSTED REPLIES');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const { data: replies, error } = await supabase
    .from('content_metadata')
    .select('id, tweet_id, target_tweet_id, target_username, content, posted_at, created_at, metadata')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .order('posted_at', { ascending: false })
    .limit(30);
  
  if (error || !replies || replies.length === 0) {
    console.log('⚠️  No posted replies found\n');
    return;
  }
  
  console.log(`📊 Found ${replies.length} posted replies\n`);
  console.log('TABLE:\n');
  console.log('ID | Target | Author | Reply Text (first 60 chars)');
  console.log('─'.repeat(80));
  
  for (const r of replies) {
    const id = r.tweet_id?.substring(0, 12) || 'N/A';
    const target = r.target_tweet_id?.substring(0, 15) || 'N/A';
    const author = r.target_username || 'N/A';
    const text = r.content?.substring(0, 60) || '';
    console.log(`${id} | ${target} | @${author} | ${text}...`);
  }
  
  console.log('\n');
  console.log('CLASSIFICATION:\n');
  
  // Classify each reply
  const buckets = {
    replied_to_reply: [] as any[],
    too_old: [] as any[],
    no_context: [] as any[],
    thread_like: [] as any[],
    ok: [] as any[]
  };
  
  for (const reply of replies) {
    const issues: string[] = [];
    
    // Check if target looks like a reply (heuristic: username starts with @)
    if (reply.content && reply.content.trim().startsWith('@')) {
      issues.push('replied_to_reply');
      buckets.replied_to_reply.push(reply);
    }
    
    // Check age (if we have created_at for target)
    // We don't have target_created_at, so skip this check
    
    // Check for thread-like structure
    const hasNumbering = /^\d+[\.)]/m.test(reply.content || '');
    const hasBullets = (reply.content?.match(/^[•\-\*]/gm) || []).length > 2;
    const lineBreaks = (reply.content?.match(/\n/g) || []).length;
    const hasMultiParagraphs = lineBreaks > 2;
    
    if (hasNumbering || hasBullets || hasMultiParagraphs) {
      issues.push('thread_like');
      buckets.thread_like.push(reply);
    }
    
    // Check context (basic: does reply share words with typical health topics?)
    const replyLower = (reply.content || '').toLowerCase();
    const hasHealthContext = /\b(health|diet|exercise|sleep|stress|nutrition|fitness|wellness)\b/i.test(replyLower);
    
    if (!hasHealthContext && replyLower.length > 50) {
      issues.push('no_context');
      buckets.no_context.push(reply);
    }
    
    if (issues.length === 0) {
      buckets.ok.push(reply);
    }
  }
  
  console.log('BUCKETS:\n');
  console.log(`  replied_to_reply: ${buckets.replied_to_reply.length}`);
  console.log(`  too_old: ${buckets.too_old.length}`);
  console.log(`  no_context: ${buckets.no_context.length}`);
  console.log(`  thread_like: ${buckets.thread_like.length}`);
  console.log(`  ok: ${buckets.ok.length}`);
  
  console.log('\n');
  console.log('DEFINITIVE FAILURE REASONS:\n');
  
  if (buckets.replied_to_reply.length > 0) {
    console.log(`1. REPLIED TO REPLIES: ${buckets.replied_to_reply.length} cases`);
    console.log('   Example:', buckets.replied_to_reply[0]?.content?.substring(0, 100));
    console.log('   Root cause: Harvester not filtering reply tweets OR posting to wrong ID\n');
  }
  
  if (buckets.thread_like.length > 0) {
    console.log(`2. THREAD-LIKE: ${buckets.thread_like.length} cases`);
    console.log('   Example:', buckets.thread_like[0]?.content?.substring(0, 100));
    console.log('   Root cause: No output contract enforcement\n');
  }
  
  if (buckets.no_context.length > 0) {
    console.log(`3. NO CONTEXT: ${buckets.no_context.length} cases`);
    console.log('   Example:', buckets.no_context[0]?.content?.substring(0, 100));
    console.log('   Root cause: Using reply text instead of root text OR weak anchoring\n');
  }
  
  console.log('✅ Analysis complete\n');
}

forensicAnalysis().catch(console.error);

