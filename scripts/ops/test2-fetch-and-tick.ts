/**
 * Test 2: Fetch candidates THEN run tick.
 * Step 1: Run orchestrator to find reply candidates
 * Step 2: Run hourly tick to pick and reply to one
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

if (!process.env.TWITTER_SESSION_B64) {
  const p = path.join(process.cwd(), 'twitter_session.b64');
  if (fs.existsSync(p)) process.env.TWITTER_SESSION_B64 = fs.readFileSync(p, 'utf-8').trim();
}

async function main() {
  console.log('=== TEST 2: FETCH + TICK ===');
  console.log(`LIVE_POSTS=${process.env.LIVE_POSTS}`);
  console.log(`X_MAX_ACTIONS_PER_DAY=${process.env.X_MAX_ACTIONS_PER_DAY}`);
  console.log('');

  // Step 1: Fetch reply candidates
  console.log('--- STEP 1: Fetching reply candidates ---');
  try {
    const { fetchAndEvaluateCandidates } = await import('../../src/jobs/replySystemV2/orchestrator');
    const result = await fetchAndEvaluateCandidates();
    console.log(`  Fetched: ${result.fetched}`);
    console.log(`  Evaluated: ${result.evaluated}`);
    console.log(`  Passed filters: ${result.passed_filters}`);
  } catch (e: any) {
    console.error(`  Fetch error: ${e.message}`);
    console.log('  Continuing to tick anyway...');
  }

  // Check queue
  const { getSupabaseClient } = await import('../../src/db');
  const s = getSupabaseClient();
  const { count } = await s
    .from('reply_candidate_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'queued');
  console.log(`  Candidates in queue: ${count ?? 0}`);

  if (!count || count === 0) {
    console.log('\n⚠️ No candidates in queue after fetch. The tick will skip.');
    console.log('This could mean:');
    console.log('  - All candidates were filtered out by hard filters');
    console.log('  - OpenAI judge calls failed (check budget)');
    console.log('  - No tweets in the feed sources matched criteria');
    console.log('\nRunning tick anyway to confirm behavior...');
  }

  // Step 2: Run hourly tick
  console.log('\n--- STEP 2: Running hourly tick ---');
  try {
    const { executeHourlyTick } = await import('../../src/rateController/hourlyTick');
    await executeHourlyTick();
    console.log('Tick complete.');
  } catch (e: any) {
    console.error(`  Tick error: ${e.message}`);
  }

  console.log('\n=== TEST 2 COMPLETE ===');
  console.log('Check Twitter to verify if a reply was posted.');
}

main().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
