#!/usr/bin/env tsx
/**
 * Forensic audit of last 50 replies for quality issues
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Reply {
  id: string;
  tweet_id: string | null;
  target_tweet_id: string | null;
  content: string;
  posted_at: string;
  status: string;
}

function classifyReply(reply: Reply): string[] {
  const issues: string[] = [];
  const content = reply.content || '';
  
  // A) THREAD-LIKE
  const threadMarkers = [
    /\b\d+\/\d+\b/,           // "1/5", "2/3"
    /\(\d+\)/,                 // "(1)", "(2)"
    /🧵/,                      // Thread emoji
    /\bthread\b/i,             // Word "thread"
    /👇/,                      // Pointing down
    /\bPart\s+\d+/i,           // "Part 1"
    /\bcontinued\b/i,          // "continued"
    /^\d+\./m,                 // Numbered list
  ];
  
  const hasThreadMarkers = threadMarkers.some(pattern => pattern.test(content));
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);
  const hasMultipleParagraphs = paragraphs.length > 2;
  const hasBullets = (content.match(/^[•\-\*]/gm) || []).length > 2;
  
  if (hasThreadMarkers || hasMultipleParagraphs || hasBullets) {
    issues.push('THREAD-LIKE');
  }
  
  // B) NO CONTEXT (very hard to detect without root tweet text, use heuristics)
  const genericPhrases = [
    /^Studies show/i,
    /^Research suggests/i,
    /^Did you know/i,
    /improves? health/i,
    /important to/i,
  ];
  
  const startsGeneric = genericPhrases.some(pattern => pattern.test(content));
  const veryShort = content.length < 80; // Too short to be contextual
  const noSpecifics = !content.match(/\b\d+[%kmg]?\b/i); // No numbers/specifics
  
  if (startsGeneric || (veryShort && noSpecifics)) {
    issues.push('NO CONTEXT');
  }
  
  // C) WRONG TARGET
  if (!reply.target_tweet_id) {
    issues.push('WRONG TARGET');
  }
  
  // D) LOW QUALITY
  const tooLong = content.length > 280;
  const tooManyLines = (content.match(/\n/g) || []).length > 3;
  const preachy = content.match(/\b(should|must|need to|have to|always|never)\b/gi);
  const preachyCount = preachy ? preachy.length : 0;
  
  if (tooLong || tooManyLines || preachyCount > 2) {
    issues.push('LOW QUALITY');
  }
  
  return issues.length > 0 ? issues : ['OK'];
}

async function auditReplies() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 FORENSIC AUDIT: LAST 50 REPLIES');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const { data: replies, error } = await supabase
    .from('content_metadata')
    .select('id, tweet_id, target_tweet_id, content, posted_at, status')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .order('posted_at', { ascending: false })
    .limit(50);
  
  if (error) {
    console.error('Error:', error.message);
    return;
  }
  
  if (!replies || replies.length === 0) {
    console.log('⚠️  No posted replies found in database\n');
    
    // Check if any replies exist at all
    const { data: allReplies } = await supabase
      .from('content_metadata')
      .select('id, status, created_at')
      .eq('decision_type', 'reply')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (allReplies && allReplies.length > 0) {
      console.log(`ℹ️  Found ${allReplies.length} replies in DB (not yet posted):`);
      allReplies.forEach(r => {
        console.log(`   - ID: ${r.id.substring(0, 8)}... status: ${r.status} created: ${new Date(r.created_at).toLocaleString()}`);
      });
    }
    
    return;
  }
  
  console.log(`📊 Found ${replies.length} posted replies\n`);
  
  // Classify each reply
  const classifications = new Map<string, Reply[]>();
  classifications.set('OK', []);
  classifications.set('THREAD-LIKE', []);
  classifications.set('NO CONTEXT', []);
  classifications.set('WRONG TARGET', []);
  classifications.set('LOW QUALITY', []);
  
  for (const reply of replies) {
    const issues = classifyReply(reply as Reply);
    for (const issue of issues) {
      if (!classifications.has(issue)) {
        classifications.set(issue, []);
      }
      classifications.get(issue)!.push(reply as Reply);
    }
  }
  
  // Report
  console.log('📋 CLASSIFICATION RESULTS:\n');
  
  for (const [category, items] of classifications.entries()) {
    const percentage = ((items.length / replies.length) * 100).toFixed(1);
    console.log(`${category}: ${items.length} (${percentage}%)`);
  }
  
  console.log('\n');
  
  // Worst examples
  console.log('❌ 5 WORST EXAMPLES:\n');
  let worstCount = 0;
  for (const category of ['THREAD-LIKE', 'NO CONTEXT', 'WRONG TARGET', 'LOW QUALITY']) {
    const items = classifications.get(category) || [];
    for (let i = 0; i < Math.min(2, items.length) && worstCount < 5; i++) {
      worstCount++;
      const r = items[i];
      console.log(`${worstCount}. [${category}]`);
      console.log(`   Posted: ${new Date(r.posted_at).toLocaleString()}`);
      console.log(`   Target: ${r.target_tweet_id || 'null'}`);
      console.log(`   Content: "${r.content}"`);
      console.log('');
    }
  }
  
  // Best examples
  console.log('✅ 5 BEST EXAMPLES:\n');
  const okReplies = classifications.get('OK') || [];
  for (let i = 0; i < Math.min(5, okReplies.length); i++) {
    const r = okReplies[i];
    console.log(`${i+1}. [OK]`);
    console.log(`   Posted: ${new Date(r.posted_at).toLocaleString()}`);
    console.log(`   Target: ${r.target_tweet_id || 'null'}`);
    console.log(`   Content: "${r.content}"`);
    console.log('');
  }
  
  // Root cause analysis
  console.log('🔬 ROOT CAUSE HYPOTHESES:\n');
  
  if ((classifications.get('THREAD-LIKE')?.length || 0) > 0) {
    console.log('THREAD-LIKE:');
    console.log('  - Likely cause: OpenAI generating multi-part responses despite prompt');
    console.log('  - Code path: replyJob.ts → OpenAI call → no post-generation validation');
    console.log('  - Fix needed: Hard contract enforcement before posting');
    console.log('');
  }
  
  if ((classifications.get('NO CONTEXT')?.length || 0) > 0) {
    console.log('NO CONTEXT:');
    console.log('  - Likely cause: Weak keyword matching, no echo requirement');
    console.log('  - Code path: contextAnchorGuard only checks keyword presence');
    console.log('  - Fix needed: Require explicit paraphrase/echo in first sentence');
    console.log('');
  }
  
  if ((classifications.get('WRONG TARGET')?.length || 0) > 0) {
    console.log('WRONG TARGET:');
    console.log('  - Likely cause: target_tweet_id not populated');
    console.log('  - Code path: Reply generation not setting target properly');
    console.log('  - Fix needed: Ensure target_tweet_id is root tweet ID');
    console.log('');
  }
  
  if ((classifications.get('LOW QUALITY')?.length || 0) > 0) {
    console.log('LOW QUALITY:');
    console.log('  - Likely cause: Prompt allows preachy/long responses');
    console.log('  - Code path: Style prompt too permissive, no hard constraints');
    console.log('  - Fix needed: Template-based generation with strict length/tone');
    console.log('');
  }
}

auditReplies().catch(console.error);

