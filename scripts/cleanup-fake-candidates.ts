#!/usr/bin/env tsx
/**
 * Cleanup fake test tweet IDs from reply_candidate_queue
 * Usage: railway run -s xBOT -- pnpm exec tsx scripts/cleanup-fake-candidates.ts [--dry-run]
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('           🧹 CLEANUP FAKE CANDIDATES\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No deletions will be performed\n');
  }
  
  const supabase = getSupabaseClient();
  
  // Find fake candidates
  const { data: fakeCandidates, error: selectError } = await supabase
    .from('reply_candidate_queue')
    .select('candidate_tweet_id, created_at')
    .or('candidate_tweet_id.like.2000000000000%,candidate_tweet_id.eq.2000000000000000003');
  
  if (selectError) {
    console.error(`❌ Error querying fake candidates: ${selectError.message}`);
    process.exit(1);
  }
  
  if (!fakeCandidates || fakeCandidates.length === 0) {
    console.log('✅ No fake candidates found\n');
    return;
  }
  
  console.log(`📊 Found ${fakeCandidates.length} fake candidates:\n`);
  fakeCandidates.slice(0, 10).forEach(c => {
    console.log(`  - ${c.candidate_tweet_id} (created: ${c.created_at})`);
  });
  if (fakeCandidates.length > 10) {
    console.log(`  ... and ${fakeCandidates.length - 10} more\n`);
  }
  
  if (isDryRun) {
    console.log(`\n✅ DRY RUN: Would delete ${fakeCandidates.length} fake candidates`);
    return;
  }
  
  // Delete fake candidates
  const fakeIds = fakeCandidates.map(c => c.candidate_tweet_id);
  const { error: deleteError } = await supabase
    .from('reply_candidate_queue')
    .delete()
    .in('candidate_tweet_id', fakeIds);
  
  if (deleteError) {
    console.error(`❌ Error deleting fake candidates: ${deleteError.message}`);
    process.exit(1);
  }
  
  console.log(`\n✅ Deleted ${fakeCandidates.length} fake candidates\n`);
}

main().catch((error) => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
