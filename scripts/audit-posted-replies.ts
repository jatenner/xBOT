#!/usr/bin/env npx tsx
/**
 * 🔍 AUDIT POSTED REPLIES
 * 
 * Usage: npx tsx scripts/audit-posted-replies.ts [hours=24]
 * 
 * Audits all posted replies for violations:
 * - thread_like: Has thread patterns (1/5, 🧵, etc.)
 * - reply_chain: root_tweet_id != target_tweet_id
 * - missing_context: No target_tweet_content_snapshot
 * - too_long: > 240 chars
 * - multi_newline: > 1 newline
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface Violation {
  tweet_id: string;
  decision_id: string;
  type: string;
  details: string;
  content_preview: string;
}

async function auditReplies(hours: number) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`🔍 AUDITING POSTED REPLIES (last ${hours} hours)`);
  console.log(`${'═'.repeat(70)}\n`);

  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data: replies, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('*')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .gte('posted_at', since)
    .order('posted_at', { ascending: false });

  if (error) {
    console.error('❌ DB Error:', error.message);
    process.exit(1);
  }

  console.log(`📊 Found ${replies?.length || 0} posted replies\n`);

  if (!replies || replies.length === 0) {
    console.log('No replies to audit.');
    return;
  }

  const violations: Violation[] = [];
  const threadPatterns = [
    { pattern: /^\s*\d+\/\d+/, name: 'n/n_format' },
    { pattern: /^\d+\.\s/m, name: 'numbered_list' },
    { pattern: /\(\d+\)/, name: 'parenthetical_number' },
    { pattern: /🧵/, name: 'thread_emoji' },
    { pattern: /\bthread\b/i, name: 'thread_word' },
    { pattern: /TIP\s*\d+/i, name: 'tip_number' },
    { pattern: /PROTOCOL:/i, name: 'protocol_marker' },
  ];

  for (const reply of replies) {
    const content = reply.content || '';
    const preview = content.substring(0, 60) + (content.length > 60 ? '...' : '');

    // Check thread-like patterns
    for (const { pattern, name } of threadPatterns) {
      if (pattern.test(content)) {
        violations.push({
          tweet_id: reply.tweet_id,
          decision_id: reply.decision_id,
          type: 'thread_like',
          details: `Pattern: ${name}`,
          content_preview: preview,
        });
      }
    }

    // Check reply chain (root != target)
    if (reply.root_tweet_id && reply.target_tweet_id && reply.root_tweet_id !== reply.target_tweet_id) {
      violations.push({
        tweet_id: reply.tweet_id,
        decision_id: reply.decision_id,
        type: 'reply_chain',
        details: `root=${reply.root_tweet_id} target=${reply.target_tweet_id}`,
        content_preview: preview,
      });
    }

    // Check missing context
    if (!reply.target_tweet_content_snapshot || reply.target_tweet_content_snapshot.length < 40) {
      violations.push({
        tweet_id: reply.tweet_id,
        decision_id: reply.decision_id,
        type: 'missing_context',
        details: `snapshot_len=${reply.target_tweet_content_snapshot?.length || 0}`,
        content_preview: preview,
      });
    }

    // Check length
    if (content.length > 240) {
      violations.push({
        tweet_id: reply.tweet_id,
        decision_id: reply.decision_id,
        type: 'too_long',
        details: `len=${content.length} (max=240)`,
        content_preview: preview,
      });
    }

    // Check multi-newline
    const newlines = (content.match(/\n/g) || []).length;
    if (newlines > 1) {
      violations.push({
        tweet_id: reply.tweet_id,
        decision_id: reply.decision_id,
        type: 'multi_newline',
        details: `newlines=${newlines} (max=1)`,
        content_preview: preview,
      });
    }
  }

  // Print results
  console.log(`${'─'.repeat(70)}`);
  console.log(`📋 AUDIT RESULTS`);
  console.log(`${'─'.repeat(70)}\n`);

  if (violations.length === 0) {
    console.log('✅ NO VIOLATIONS FOUND - All replies pass audit checks\n');
  } else {
    console.log(`❌ FOUND ${violations.length} VIOLATIONS:\n`);

    // Group by type
    const byType: Record<string, Violation[]> = {};
    for (const v of violations) {
      byType[v.type] = byType[v.type] || [];
      byType[v.type].push(v);
    }

    for (const [type, vs] of Object.entries(byType)) {
      console.log(`\n🚨 ${type.toUpperCase()} (${vs.length}):`);
      for (const v of vs.slice(0, 5)) {
        console.log(`   tweet_id: ${v.tweet_id}`);
        console.log(`   decision: ${v.decision_id}`);
        console.log(`   details: ${v.details}`);
        console.log(`   preview: "${v.content_preview}"`);
        console.log('');
      }
      if (vs.length > 5) {
        console.log(`   ... and ${vs.length - 5} more`);
      }
    }
  }

  console.log(`${'═'.repeat(70)}`);
  console.log(`SUMMARY: ${replies.length} replies audited, ${violations.length} violations`);
  console.log(`${'═'.repeat(70)}\n`);

  // Return exit code based on violations
  return violations.length === 0;
}

// Main
const hours = parseInt(process.argv[2] || '24');
auditReplies(hours)
  .then(pass => process.exit(pass ? 0 : 1))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });

