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
  
  // Lazy import health filter
  const { filterTargetQuality } = await import('../../src/gates/replyTargetQualityFilter');
  
  for (const candidate of candidates) {
    let shouldDelete = false;
    let reason = '';
    
    // Check 1: Older than 6 hours
    const createdAt = new Date(candidate.created_at);
    if (createdAt < sixHoursAgo) {
      shouldDelete = true;
      reason = 'older_than_6h';
    }
    
    // Check 2: Missing required metadata
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
    
    // Check 3: Fail health relevance scoring
    if (!shouldDelete && candidate.candidate_tweet_content) {
      const qualityResult = filterTargetQuality(
        candidate.candidate_tweet_content,
        candidate.candidate_author_username || 'unknown',
        undefined,
        candidate.candidate_tweet_content
      );
      
      if (!qualityResult.pass) {
        shouldDelete = true;
        reason = `non_health_${qualityResult.deny_reason_code || 'quality_filter'}`;
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
  
  console.log(`🗑️  Deleting ${idsToDelete.length} candidates:\n`);
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
