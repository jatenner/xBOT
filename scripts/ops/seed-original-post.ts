#!/usr/bin/env tsx
/**
 * SEED ORIGINAL POST (ops original-post proof)
 *
 * Inserts exactly one single (original) post into content_generation_metadata_comprehensive
 * for the original-post proof path. Used by ops-original-post-proof.ts.
 *
 * Usage:
 *   pnpm tsx scripts/ops/seed-original-post.ts
 *
 * Optional: PROOF_TAG=control-post-{timestamp} (default)
 */

import 'dotenv/config';
import { createHash } from 'crypto';
import { getSupabaseClient } from '../../src/db/index';
import { v4 as uuidv4 } from 'uuid';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v?.trim()) {
    console.error(`[SEED_ORIGINAL_POST] Missing required env: ${name}`);
    process.exit(1);
  }
  return v.trim();
}

async function main(): Promise<string> {
  requireEnv('DATABASE_URL');

  const proofTag = process.env.PROOF_TAG?.trim() || `control-post-${Date.now()}`;
  if (!proofTag.startsWith('control-post-')) {
    console.error('[SEED_ORIGINAL_POST] PROOF_TAG must start with "control-post-" for cert mode');
    process.exit(1);
  }

  const supabase = getSupabaseClient();
  const decisionId = uuidv4();
  const now = new Date().toISOString();

  // 5–10 safe proof variants; natural suffix (no visible "(Proof: ...)" in tweet body)
  const PROOF_VARIANTS = [
    'Sleep and light exposure are two of the highest-leverage levers for daily performance.',
    'Morning sunlight and consistent sleep times can significantly improve focus and energy.',
    'Small habits compound: a few minutes of movement and good sleep add up over time.',
    'Rest and light are underrated inputs for how you feel and perform every day.',
    'Prioritizing sleep and daylight often beats extra hours of low-quality work.',
    'Your body runs on light and rest—optimize both before chasing more productivity hacks.',
    'Consistent wake time and some daylight early in the day set the tone for the rest.',
    'Better sleep and more natural light are two changes that help almost everyone.',
  ];
  const naturalSuffixes = [' ·', ' —', ' …'];
  const variantIndex = Math.abs(createHash('sha256').update(decisionId).digest().readUInt32BE(0)) % PROOF_VARIANTS.length;
  const suffix = naturalSuffixes[variantIndex % naturalSuffixes.length];
  const content = PROOF_VARIANTS[variantIndex] + suffix;

  console.log(`[SEED_ORIGINAL_POST] Seeding proof original post: ${decisionId}`);
  console.log(`[SEED_ORIGINAL_POST]   proof_tag=${proofTag}`);

  const { error } = await supabase.from('content_generation_metadata_comprehensive').insert({
    decision_id: decisionId,
    decision_type: 'single',
    content,
    status: 'queued',
    scheduled_at: now,
    quality_score: 0.8,
    predicted_er: 0.5,
    bandit_arm: 'test',
    topic_cluster: 'test',
    generation_source: 'real',
    features: {
      proof_tag: proofTag,
      pipeline_source: 'ops_original_post_proof',
      retry_count: 0,
    },
    created_at: now,
    updated_at: now,
  });

  if (error) {
    console.error('[SEED_ORIGINAL_POST] Insert failed:', error.message);
    process.exit(1);
  }

  console.log(`[SEED_ORIGINAL_POST] OK decision_id=${decisionId}`);
  return decisionId;
}

main().catch((err) => {
  console.error('[SEED_ORIGINAL_POST] Fatal:', err);
  process.exit(1);
});
