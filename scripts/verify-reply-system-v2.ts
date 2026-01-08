/**
 * 🔬 VERIFY REPLY SYSTEM V2
 * 
 * Dry-run verification:
 * - >=100 candidates/hour
 * - Queue stays populated
 * - Parody accounts excluded
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';
import { runFullCycle } from '../src/jobs/replySystemV2/orchestrator';
import { refreshCandidateQueue } from '../src/jobs/replySystemV2/queueManager';

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔬 REPLY SYSTEM V2 VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const supabase = getSupabaseClient();
  const startTime = Date.now();
  
  // Test 1: Run fetch/evaluate cycle
  console.log('[VERIFY] Test 1: Running fetch/evaluate cycle...');
  const cycleResult = await runFullCycle();
  console.log(`[VERIFY] ✅ Fetched: ${cycleResult.fetched}, Evaluated: ${cycleResult.evaluated}, Passed: ${cycleResult.passed_filters}\n`);
  
  // Test 2: Check candidate rate (should be >=100/hour)
  const elapsedMinutes = (Date.now() - startTime) / (1000 * 60);
  const candidatesPerHour = (cycleResult.fetched / elapsedMinutes) * 60;
  console.log(`[VERIFY] Test 2: Candidate rate check...`);
  console.log(`[VERIFY]   Candidates/hour: ${candidatesPerHour.toFixed(1)} (target: >=100)`);
  if (candidatesPerHour >= 100) {
    console.log(`[VERIFY] ✅ PASS: Candidate rate meets target\n`);
  } else {
    console.log(`[VERIFY] ⚠️ WARN: Candidate rate below target\n`);
  }
  
  // Test 3: Check queue population
  console.log(`[VERIFY] Test 3: Queue population check...`);
  await refreshCandidateQueue();
  const { data: queue } = await supabase
    .from('reply_candidate_queue')
    .select('candidate_tweet_id, predicted_tier, overall_score')
    .eq('status', 'queued')
    .gt('expires_at', new Date().toISOString())
    .order('overall_score', { ascending: false });
  
  const queueSize = queue?.length || 0;
  console.log(`[VERIFY]   Queue size: ${queueSize} (target: >=10)`);
  if (queueSize >= 10) {
    console.log(`[VERIFY] ✅ PASS: Queue is populated\n`);
  } else {
    console.log(`[VERIFY] ⚠️ WARN: Queue below target\n`);
  }
  
  // Test 4: Check parody exclusion
  console.log(`[VERIFY] Test 4: Parody exclusion check...`);
  const { data: parodies } = await supabase
    .from('candidate_evaluations')
    .select('candidate_tweet_id, is_parody, passed_hard_filters')
    .eq('is_parody', true)
    .limit(10);
  
  const parodyCount = parodies?.length || 0;
  const parodiesPassed = parodies?.filter(p => p.passed_hard_filters === true).length || 0;
  
  console.log(`[VERIFY]   Parody accounts found: ${parodyCount}`);
  console.log(`[VERIFY]   Parodies that passed filters: ${parodiesPassed}`);
  if (parodiesPassed === 0) {
    console.log(`[VERIFY] ✅ PASS: Parody accounts correctly excluded\n`);
  } else {
    console.log(`[VERIFY] ❌ FAIL: ${parodiesPassed} parody accounts passed filters!\n`);
  }
  
  // Test 5: Check tier distribution
  console.log(`[VERIFY] Test 5: Tier distribution check...`);
  const { data: tierDist } = await supabase
    .from('candidate_evaluations')
    .select('predicted_tier')
    .eq('passed_hard_filters', true)
    .eq('status', 'evaluated');
  
  const tierCounts = {
    1: tierDist?.filter(t => t.predicted_tier === 1).length || 0,
    2: tierDist?.filter(t => t.predicted_tier === 2).length || 0,
    3: tierDist?.filter(t => t.predicted_tier === 3).length || 0,
    4: tierDist?.filter(t => t.predicted_tier === 4).length || 0,
  };
  
  console.log(`[VERIFY]   Tier distribution:`);
  console.log(`[VERIFY]     Tier 1 (>=5000 views): ${tierCounts[1]}`);
  console.log(`[VERIFY]     Tier 2 (>=1000 views): ${tierCounts[2]}`);
  console.log(`[VERIFY]     Tier 3 (>=500 views): ${tierCounts[3]}`);
  console.log(`[VERIFY]     Tier 4 (<500 views): ${tierCounts[4]}\n`);
  
  // Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('VERIFICATION SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Candidates/hour: ${candidatesPerHour.toFixed(1)} (target: >=100)`);
  console.log(`Queue size: ${queueSize} (target: >=10)`);
  console.log(`Parody exclusion: ${parodiesPassed === 0 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Tier 1+2 candidates: ${tierCounts[1] + tierCounts[2]} (ready for posting)`);
  console.log('\n');
  
  process.exit(0);
}

main().catch(console.error);

