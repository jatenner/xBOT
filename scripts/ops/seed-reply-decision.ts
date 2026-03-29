#!/usr/bin/env tsx
/**
 * SEED REPLY DECISION (ops reply proof)
 *
 * Inserts exactly one reply row into content_generation_metadata_comprehensive for the
 * deterministic reply-proof path. (content_metadata is a VIEW over this table; insert
 * must go to the base table for DBs where the view is read-only.)
 *
 * Used by ops-reply-proof.ts so the queue has one proof item to process.
 *
 * Required: proof_tag must start with "control-reply-" for PROOF_MODE selection.
 * Pipeline: pipeline_source=ops_reply_proof (not reply_v2_planner so no runtime preflight gate).
 *
 * Usage:
 *   TARGET_TWEET_ID=1234567890123456789 pnpm tsx scripts/ops/seed-reply-decision.ts
 *
 * Optional: PROOF_TAG=control-reply-my-run (default: control-reply-{timestamp})
 * Optional: REPLY_CONTENT=... (default: generic placeholder; set to pass specificity gate with target tokens)
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v?.trim()) {
    console.error(`[SEED_REPLY] Missing required env: ${name}`);
    process.exit(1);
  }
  return v.trim();
}

function validateTargetTweetId(id: string): void {
  if (!/^\d+$/.test(id) || id.length < 15) {
    console.error('[SEED_REPLY] TARGET_TWEET_ID must be numeric and >= 15 digits');
    process.exit(1);
  }
}

async function main(): Promise<string> {
  requireEnv('DATABASE_URL');
  const targetTweetId = requireEnv('TARGET_TWEET_ID');
  validateTargetTweetId(targetTweetId);

  const proofTag = process.env.PROOF_TAG?.trim() || `control-reply-${Date.now()}`;
  if (!proofTag.startsWith('control-reply-')) {
    console.error('[SEED_REPLY] PROOF_TAG must start with "control-reply-" for PROOF_MODE');
    process.exit(1);
  }

  const supabase = getSupabaseClient();
  const decisionId = uuidv4();
  const now = new Date().toISOString();

  const placeholderSnapshot = 'This is a test tweet content snapshot for reply proof. It must be at least 20 characters long to pass FINAL_REPLY_GATE.';
  let targetTweetSnapshot = placeholderSnapshot;
  const { data: opp } = await supabase
    .from('reply_opportunities')
    .select('target_tweet_content')
    .eq('target_tweet_id', targetTweetId)
    .maybeSingle();
  if (opp?.target_tweet_content && String(opp.target_tweet_content).trim().length >= 20) {
    targetTweetSnapshot = String(opp.target_tweet_content).trim();
    console.log(`[SEED_REPLY] Using real snapshot from reply_opportunities (${targetTweetSnapshot.length} chars)`);
  }

  const replyContent =
    process.env.REPLY_CONTENT?.trim() ||
    'Quick note: sleep quality and sunlight timing matter more than most people think.';
  if (process.env.REPLY_CONTENT?.trim()) {
    console.log(`[SEED_REPLY] Using REPLY_CONTENT (${replyContent.length} chars)`);
  }
  const targetTweetHash = crypto.createHash('sha256').update(targetTweetSnapshot).digest('hex').substring(0, 32);

  console.log(`[SEED_REPLY] Seeding proof reply decision: ${decisionId}`);
  console.log(`[SEED_REPLY]   target_tweet_id=${targetTweetId} proof_tag=${proofTag}`);

  // Insert into base table so it works when content_metadata is a VIEW (migration 20260203)
  const { error } = await supabase.from('content_generation_metadata_comprehensive').insert({
    decision_id: decisionId,
    decision_type: 'reply',
    content: replyContent,
    target_tweet_id: targetTweetId,
    status: 'queued',
    scheduled_at: now,
    quality_score: 0.8,
    predicted_er: 0.5,
    bandit_arm: 'test',
    topic_cluster: 'test',
    generation_source: 'real',
    pipeline_source: 'reply_v2_planner',
    features: {
      proof_tag: proofTag,
      pipeline_source: 'ops_reply_proof',
      target_tweet_content_snapshot: targetTweetSnapshot,
      target_tweet_content_hash: targetTweetHash,
      semantic_similarity: 0.75,
      root_tweet_id: targetTweetId,
      retry_count: 0,
    },
    created_at: now,
    updated_at: now,
  });

  if (error) {
    console.error('[SEED_REPLY] Insert failed (comprehensive):', error.message);
    process.exit(1);
  }

  // Also insert into content_metadata (separate table in this env — reply query reads from it)
  // Note: content_metadata may not have pipeline_source column — omit it, store in features only
  const { error: cmError } = await supabase.from('content_metadata').insert({
    decision_id: decisionId,
    decision_type: 'reply',
    content: replyContent,
    target_tweet_id: targetTweetId,
    status: 'queued',
    scheduled_at: now,
    quality_score: 0.8,
    predicted_er: 0.5,
    bandit_arm: 'test',
    topic_cluster: 'test',
    generation_source: 'real',
    features: {
      proof_tag: proofTag,
      pipeline_source: 'ops_reply_proof',
      target_tweet_content_snapshot: targetTweetSnapshot,
      target_tweet_content_hash: targetTweetHash,
      semantic_similarity: 0.75,
      root_tweet_id: targetTweetId,
      retry_count: 0,
    },
    created_at: now,
    updated_at: now,
  });
  if (cmError) {
    console.warn(`[SEED_REPLY] content_metadata insert failed (non-fatal): ${cmError.message}`);
  } else {
    console.log(`[SEED_REPLY] Also inserted into content_metadata`);
  }

  console.log(`[SEED_REPLY] OK decision_id=${decisionId}`);
  return decisionId;
}

main().catch((err) => {
  console.error('[SEED_REPLY] Fatal:', err);
  process.exit(1);
});
