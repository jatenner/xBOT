#!/usr/bin/env tsx
/**
 * Seed workload for Phase 5A.4 proof (Stability Under Real Load)
 * 
 * Creates proof-scoped decisions that will be picked up under PROOF_MODE filtering:
 * - 2 post decisions with proof_tag starting with 'control-post-'
 * - 1 reply decision with proof_tag starting with 'control-reply-'
 * 
 * Usage:
 *   RUNNER_MODE=true pnpm run proof:seed:5a4
 * 
 * Idempotent: Checks for existing decisions with same proof_tag prefix within last hour
 */

import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';
import { getSupabaseClient } from '../../src/db/index';

const PROOF_TAG_PREFIX_POST = 'control-post-5a4-stability-';
const PROOF_TAG_PREFIX_REPLY = 'control-reply-5a4-stability-';

async function checkExistingDecisions(supabase: any, proofTagPrefix: string): Promise<number> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('content_metadata')
    .select('decision_id')
    .like('features->>proof_tag', `${proofTagPrefix}%`)
    .gte('created_at', oneHourAgo)
    .limit(10);
  
  if (error) {
    console.warn(`⚠️  Error checking existing decisions: ${error.message}`);
    return 0;
  }
  
  return data?.length || 0;
}

async function seedPostDecision(supabase: any, index: number): Promise<string> {
  const proofTag = `${PROOF_TAG_PREFIX_POST}${Date.now()}-${index}`;
  const decisionId = uuidv4();
  const now = new Date().toISOString();
  
  const content = `🧪 Phase 5A.4 stability proof workload (post ${index}): Sleep quality and sunlight timing matter more than most people think. Generated at ${now}.`;
  
  const { error } = await supabase
    .from('content_metadata')
    .insert({
      decision_id: decisionId,
      decision_type: 'single',
      content: content,
      status: 'queued',
      scheduled_at: now, // Ready immediately
      generation_source: 'real',
      raw_topic: 'health_optimization',
      angle: 'practical_application',
      tone: 'educational',
      generator_name: 'teacher',
      format_strategy: 'direct_value',
      quality_score: 0.85,
      predicted_er: 0.045,
      bandit_arm: 'educational',
      topic_cluster: 'health_optimization',
      features: {
        proof_5a4_stability: true,
        proof_tag: proofTag,
        pipeline_source: 'control_posting_queue',
        created_at: now,
        retry_count: 0,
      },
      created_at: now,
      updated_at: now
    });
  
  if (error) {
    throw new Error(`Failed to create post decision ${index}: ${error.message}`);
  }
  
  console.log(`✅ Post decision ${index} created: ${decisionId} (proof_tag: ${proofTag})`);
  return decisionId;
}

async function seedReplyDecision(supabase: any): Promise<string> {
  const proofTag = `${PROOF_TAG_PREFIX_REPLY}${Date.now()}`;
  const decisionId = uuidv4();
  const now = new Date().toISOString();
  
  // Use a placeholder target_tweet_id (proof will process it if executor can handle it)
  // In PROOF_MODE, reply decisions may need real tweet context, but for stability proof
  // we're mainly validating that decisions transition from queued→posting/posted
  const targetTweetId = '2014718451563004351'; // Placeholder - may need adjustment
  
  const replyContent = `🧪 Phase 5A.4 stability proof workload (reply): Quick note: sleep quality and sunlight timing matter more than most people think. Generated at ${now}.`;
  
  const { error } = await supabase
    .from('content_metadata')
    .insert({
      decision_id: decisionId,
      decision_type: 'reply',
      content: replyContent,
      target_tweet_id: targetTweetId,
      status: 'queued',
      scheduled_at: now, // Ready immediately
      quality_score: 0.8,
      predicted_er: 0.5,
      bandit_arm: 'test',
      topic_cluster: 'test',
      generation_source: 'real',
      features: {
        proof_5a4_stability: true,
        proof_tag: proofTag,
        pipeline_source: 'control_reply_scheduler',
        root_tweet_id: targetTweetId,
        target_tweet_content_snapshot: 'Placeholder tweet content for stability proof workload validation.',
        target_tweet_content_hash: 'placeholder-hash',
        semantic_similarity: 0.75,
        created_at: now,
        retry_count: 0,
      },
      created_at: now,
      updated_at: now
    });
  
  if (error) {
    throw new Error(`Failed to create reply decision: ${error.message}`);
  }
  
  console.log(`✅ Reply decision created: ${decisionId} (proof_tag: ${proofTag})`);
  return decisionId;
}

async function main(): Promise<void> {
  if (process.env.RUNNER_MODE !== 'true') {
    console.error('❌ ERROR: RUNNER_MODE=true is required');
    console.error('   Usage: RUNNER_MODE=true pnpm run proof:seed:5a4');
    process.exit(1);
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('   🌱 Seeding Phase 5A.4 Stability Proof Workload');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const supabase = getSupabaseClient();
  
  // Check for existing decisions (idempotent-ish)
  const existingPosts = await checkExistingDecisions(supabase, PROOF_TAG_PREFIX_POST);
  const existingReplies = await checkExistingDecisions(supabase, PROOF_TAG_PREFIX_REPLY);
  
  if (existingPosts > 0 || existingReplies > 0) {
    console.log(`ℹ️  Found ${existingPosts} existing post decisions and ${existingReplies} reply decisions with proof_tag prefix`);
    console.log(`   Seeding additional decisions...\n`);
  }
  
  const decisionIds: string[] = [];
  
  try {
    // Seed 2 post decisions
    console.log('📝 Seeding post decisions...');
    for (let i = 1; i <= 2; i++) {
      const decisionId = await seedPostDecision(supabase, i);
      decisionIds.push(decisionId);
    }
    
    // Seed 1 reply decision
    console.log('\n📝 Seeding reply decision...');
    const replyDecisionId = await seedReplyDecision(supabase);
    decisionIds.push(replyDecisionId);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   ✅ Workload Seeding Complete');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log(`📊 Seeded ${decisionIds.length} decisions:`);
    decisionIds.forEach((id, idx) => {
      console.log(`   ${idx + 1}. ${id}`);
    });
    
    console.log('\n📋 Next steps:');
    console.log('   1. Run Phase 5A.4 proof: pnpm run executor:prove:stability-real-load');
    console.log('   2. Proof will process decisions with proof_tag starting with:');
    console.log('      - control-post-5a4-stability-* (for posts)');
    console.log('      - control-reply-5a4-stability-* (for replies)');
    
  } catch (error: any) {
    console.error(`\n❌ Error seeding workload: ${error.message}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
