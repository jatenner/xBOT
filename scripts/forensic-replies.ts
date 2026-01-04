#!/usr/bin/env tsx
/**
 * Quick forensic analysis of last 30 posted replies
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
    .select('id, tweet_id, target_tweet_id, target_username, content, posted_at, created_at')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .order('posted_at', { ascending: false })
    .limit(30);
  
  if (error) {
    console.error('Error:', error.message);
    return;
  }
  
  if (!replies || replies.length === 0) {
    console.log('⚠️  No posted replies found\n');
    return;
  }
  
  console.log(`📊 Found ${replies.length} posted replies\n`);
  console.log('TABLE:');
  console.log('─'.repeat(120));
  console.log(String('ID').padEnd(10) + String('Target ID').padEnd(20) + String('Author').padEnd(20) + String('Posted').padEnd(25) + 'Reply Text');
  console.log('─'.repeat(120));
  
  for (const r of replies) {
    const id = String(r.id || '').substring(0, 8);
    const targetId = String(r.target_tweet_id || 'N/A').substring(0, 18);
    const author = '@' + String(r.target_username || 'unknown');
    const posted = new Date(r.posted_at || r.created_at).toLocaleString();
    const text = String(r.content || '').substring(0, 50) + '...';
    
    console.log(
      id.padEnd(10) +
      targetId.padEnd(20) +
      author.padEnd(20) +
      posted.padEnd(25) +
      text
    );
  }
  
  console.log('─'.repeat(120));
  console.log('\n');
  
  // Classify replies
  const buckets = {
    replied_to_reply: [] as any[],
    too_old: [] as any[],
    no_context: [] as any[],
    thread_like: [] as any[],
    ok: [] as any[]
  };
  
  for (const r of replies) {
    const content = r.content || '';
    const createdAt = new Date(r.created_at);
    const ageHours = (Date.now() - createdAt.getTime()) / (60 * 60 * 1000);
    
    // Check if replied to reply (heuristic: content starts with @)
    if (content.trim().startsWith('@') && content.includes('Replying to')) {
      buckets.replied_to_reply.push(r);
      continue;
    }
    
    // Check too old (>6h)
    if (ageHours > 6) {
      buckets.too_old.push(r);
      continue;
    }
    
    // Check thread-like
    const hasNumbering = /\b\d+[\)\.]\s/.test(content) || /\(\d+\)/.test(content);
    const hasBullets = /^[•\-\*]/m.test(content);
    const multiParagraph = content.split(/\n\n+/).length > 2;
    if (hasNumbering || hasBullets || multiParagraph) {
      buckets.thread_like.push(r);
      continue;
    }
    
    // TODO: Check no_context (need root tweet text to compare)
    // For now, just mark as ok
    buckets.ok.push(r);
  }
  
  console.log('📋 CLASSIFICATION RESULTS:\n');
  console.log(`replied_to_reply: ${buckets.replied_to_reply.length}`);
  console.log(`too_old: ${buckets.too_old.length}`);
  console.log(`no_context: ${buckets.no_context.length} (requires root text comparison)`);
  console.log(`thread_like: ${buckets.thread_like.length}`);
  console.log(`ok: ${buckets.ok.length}`);
  console.log('\n');
  
  // Show examples
  if (buckets.replied_to_reply.length > 0) {
    console.log('❌ EXAMPLE replied_to_reply:');
    const ex = buckets.replied_to_reply[0];
    console.log(`   Target: ${ex.target_tweet_id}`);
    console.log(`   Content: "${ex.content}"`);
    console.log('');
  }
  
  if (buckets.thread_like.length > 0) {
    console.log('❌ EXAMPLE thread_like:');
    const ex = buckets.thread_like[0];
    console.log(`   Target: ${ex.target_tweet_id}`);
    console.log(`   Content: "${ex.content}"`);
    console.log('');
  }
  
  console.log('🎯 DEFINITIVE FAILURE REASONS:\n');
  console.log(`1. Replied to replies: ${buckets.replied_to_reply.length} (${((buckets.replied_to_reply.length/replies.length)*100).toFixed(1)}%)`);
  console.log(`2. Thread-like format: ${buckets.thread_like.length} (${((buckets.thread_like.length/replies.length)*100).toFixed(1)}%)`);
  console.log(`3. Too old targets: ${buckets.too_old.length} (${((buckets.too_old.length/replies.length)*100).toFixed(1)}%)`);
  console.log('');
}

forensicAnalysis().catch(console.error);

