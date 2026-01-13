#!/usr/bin/env tsx
/**
 * Deterministically seed reply_candidate_queue with test candidates
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { getSupabaseClient } from '../src/db';
import { v4 as uuidv4 } from 'uuid';

async function main() {
  const count = parseInt(process.argv.find(arg => arg.startsWith('--count='))?.split('=')[1] || '20', 10);
  
  console.log(`=== Seeding Reply Candidates (count=${count}) ===\n`);
  
  const supabase = getSupabaseClient();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours TTL
  
  // Generate realistic tweet IDs (19-digit numbers)
  const baseTweetId = 2000000000000000000n;
  const seeded: string[] = [];
  
  for (let i = 0; i < count; i++) {
    const tweetId = String(baseTweetId + BigInt(i));
    const evaluationId = uuidv4();
    
    // Create candidate_evaluation entry first (scheduler requires this)
    const { error: evalError } = await supabase
      .from('candidate_evaluations')
      .insert({
        id: evaluationId,
        candidate_tweet_id: tweetId,
        candidate_author_username: `test_user_${i}`,
        candidate_content: `Test tweet content ${i}: This is a sample tweet for testing the reply system.`,
        candidate_posted_at: new Date(now.getTime() - i * 60 * 1000).toISOString(), // Staggered times
        topic_relevance_score: 0.7 + (i % 3) * 0.1,
        velocity_score: 0.5 + (i % 2) * 0.2,
        recency_score: 0.8 - (i % 4) * 0.1,
        author_signal_score: 0.6 + (i % 3) * 0.15,
        predicted_tier: (i % 3) + 1, // Rotate tiers 1, 2, 3
        predicted_24h_views: 1000 + i * 100,
        overall_score: 70 + (i % 5) * 5,
        passed_hard_filters: true,
        status: 'evaluated',
        source_type: 'seed_script',
        source_feed_name: 'seed_test',
        created_at: now.toISOString(),
      });
    
    if (evalError) {
      console.error(`❌ Failed to create evaluation for ${tweetId}: ${evalError.message}`);
      continue;
    }
    
    // Create queue entry
    const { error: queueError } = await supabase
      .from('reply_candidate_queue')
      .insert({
        evaluation_id: evaluationId,
        candidate_tweet_id: tweetId,
        overall_score: 70 + (i % 5) * 5,
        predicted_tier: (i % 3) + 1,
        predicted_24h_views: 1000 + i * 100,
        source_type: 'seed_script',
        source_feed_name: 'seed_test',
        expires_at: expiresAt.toISOString(),
        ttl_minutes: 120,
        status: 'queued',
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      });
    
    if (queueError) {
      console.error(`❌ Failed to queue ${tweetId}: ${queueError.message}`);
      continue;
    }
    
    seeded.push(tweetId);
    console.log(`✅ Seeded: ${tweetId} (tier ${(i % 3) + 1}, score ${70 + (i % 5) * 5})`);
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Seeded: ${seeded.length}/${count} candidates`);
  console.log(`Tweet IDs: ${seeded.slice(0, 5).join(', ')}${seeded.length > 5 ? '...' : ''}`);
}

main().catch(console.error);
