#!/usr/bin/env tsx
/**
 * 🧹 CANDIDATE QUEUE CLEANUP
 * 
 * Removes stale, invalid, or non-health-relevant candidates from reply_candidate_queue
 * 
 * Usage:
 *   pnpm exec tsx scripts/runner/cleanup-candidate-queue.ts
 */

import fs from 'fs';
import path from 'path';

// Load .env.local first
const envLocalPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else {
  require('dotenv').config();
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🧹 CANDIDATE QUEUE CLEANUP');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const { getSupabaseClient } = await import('../../src/db');
  const supabase = getSupabaseClient();
  
  // Fetch all queued candidates
  const { data: candidates, error: fetchError } = await supabase
    .from('reply_candidate_queue')
    .select('*')
    .eq('status', 'queued')
    .order('created_at', { ascending: true });
  
  if (fetchError) {
    console.error(`❌ Failed to fetch candidates: ${fetchError.message}`);
    process.exit(1);
  }
  
  if (!candidates || candidates.length === 0) {
    console.log('✅ No candidates to clean up\n');
    return;
  }
  
  console.log(`📋 Found ${candidates.length} candidates in queue\n`);
  
  const now = new Date();
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  const idsToDelete: string[] = [];
  const reasons: Record<string, number> = {};
  
  // Get tweet IDs to check for parent tweets
  const tweetIds = candidates.map(c => c.candidate_tweet_id).filter(Boolean);
  
  // Batch check for parent tweets in reply_opportunities
  const { data: opportunities } = await supabase
    .from('reply_opportunities')
    .select('target_tweet_id, target_in_reply_to_tweet_id')
    .in('target_tweet_id', tweetIds);
  
  // Build map of tweet_id -> parent_tweet_id
  const parentMap = new Map<string, string | null>();
  opportunities?.forEach(opp => {
    parentMap.set(opp.target_tweet_id, opp.target_in_reply_to_tweet_id);
  });
  
  // Also check candidate_evaluations
  const { data: evaluations } = await supabase
    .from('candidate_evaluations')
    .select('candidate_tweet_id, target_in_reply_to_tweet_id')
    .in('candidate_tweet_id', tweetIds);
  
  evaluations?.forEach(evaluation => {
    if (!parentMap.has(evaluation.candidate_tweet_id)) {
      parentMap.set(evaluation.candidate_tweet_id, evaluation.target_in_reply_to_tweet_id || null);
    }
  });
  
  // Off-limits content patterns (matching replyTargetQualityFilter)
  const offLimitsPatterns = [
    /\b(hardcore|explicit|porn|xxx|nsfw\s*sexual|explicitly\s*sexual)\b/i,
    /\b(crypto\s*scam|nft\s*scam|investment\s*scam|ponzi|pyramid\s*scheme|get\s*rich\s*quick)\b/i,
    /\b(kill\s*all|death\s*to|exterminate|genocide|ethnic\s*cleansing)\b/i,
    /\b(terrorist|jihad|extremist\s*propaganda|radical\s*ideology|violent\s*extremism)\b/i,
  ];
  
  for (const candidate of candidates) {
    let shouldDelete = false;
    let reason = '';
    
    const username = (candidate.candidate_author_username || '').toLowerCase();
    const tweetId = candidate.candidate_tweet_id || '';
    const content = (candidate.candidate_tweet_content || '').toLowerCase();
    
    // Check 1: Test/synthetic candidates (highest priority)
    if (!shouldDelete) {
      // Test username (starts with "test_")
      if (username.startsWith('test_')) {
        shouldDelete = true;
        reason = 'test_username';
      }
      
      // Synthetic tweet ID (e.g., 2000000000000000xxx range)
      if (!shouldDelete && /^2000000000000000\d{3}$/.test(tweetId)) {
        shouldDelete = true;
        reason = 'synthetic_tweet_id';
      }
      
      // Test content
      if (!shouldDelete && content.includes('test tweet content')) {
        shouldDelete = true;
        reason = 'test_content';
      }
    }
    
    // Check 2: Parent tweet exists (reply candidate, not root)
    if (!shouldDelete && tweetId) {
      const parentTweetId = parentMap.get(tweetId);
      if (parentTweetId !== null && parentTweetId !== undefined) {
        shouldDelete = true;
        reason = 'has_parent_tweet';
      }
    }
    
    // Check 3: Off-limits content patterns
    if (!shouldDelete && content) {
      const hasOffLimitsPattern = offLimitsPatterns.some(pattern => pattern.test(content));
      if (hasOffLimitsPattern) {
        shouldDelete = true;
        reason = 'off_limits_content';
      }
    }
    
    // Check 4: Older than 6 hours
    if (!shouldDelete) {
      const createdAt = new Date(candidate.created_at);
      if (createdAt < sixHoursAgo) {
        shouldDelete = true;
        reason = 'older_than_6h';
      }
    }
    
    // Check 5: Missing required metadata
    if (!shouldDelete) {
      const hasRequiredFields = candidate.candidate_tweet_id && 
                                candidate.candidate_author_username &&
                                candidate.overall_score !== null &&
                                candidate.overall_score !== undefined;
      if (!hasRequiredFields) {
        shouldDelete = true;
        reason = 'missing_metadata';
      }
    }
    
    if (shouldDelete) {
      idsToDelete.push(candidate.id);
      reasons[reason] = (reasons[reason] || 0) + 1;
    }
  }
  
  if (idsToDelete.length === 0) {
    console.log('✅ No candidates need cleanup\n');
    return;
  }
  
  // Separate test candidates from other stale candidates
  const testReasons = ['test_username', 'synthetic_tweet_id', 'test_content'];
  const removedTestCandidates = Object.entries(reasons)
    .filter(([reason]) => testReasons.includes(reason))
    .reduce((sum, [, count]) => sum + count, 0);
  const removedOtherStale = idsToDelete.length - removedTestCandidates;
  
  console.log(`🗑️  Deleting ${idsToDelete.length} candidates:\n`);
  console.log(`   Removed test/synthetic candidates: ${removedTestCandidates}`);
  console.log(`   Removed other stale candidates: ${removedOtherStale}\n`);
  
  Object.entries(reasons)
    .sort((a, b) => b[1] - a[1])
    .forEach(([reason, count]) => {
      console.log(`   ${reason}: ${count}`);
    });
  console.log('');
  
  // Delete in batches
  const batchSize = 50;
  let deleted = 0;
  for (let i = 0; i < idsToDelete.length; i += batchSize) {
    const batch = idsToDelete.slice(i, i + batchSize);
    const { error: deleteError } = await supabase
      .from('reply_candidate_queue')
      .delete()
      .in('id', batch);
    
    if (deleteError) {
      console.error(`❌ Failed to delete batch: ${deleteError.message}`);
    } else {
      deleted += batch.length;
      console.log(`   ✅ Deleted ${deleted}/${idsToDelete.length} candidates...`);
    }
  }
  
  console.log(`\n✅ Cleanup complete: ${deleted} candidates removed\n`);
}

main().catch((error) => {
  console.error('❌ Cleanup failed:', error);
  process.exit(1);
});
