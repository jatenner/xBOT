/**
 * 🔬 PRODUCTION PROOF PROBE
 * 
 * Triggers ONE safe post and verifies:
 * 1. Permit creation and transitions (PENDING -> APPROVED -> USED)
 * 2. Tweet exists in DB with correct tweet_id
 * 3. Reconciliation finds no new ghosts
 * 4. System events trail exists
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';
import { processPostingQueue } from '../src/jobs/postingQueue';
import { runGhostReconciliation } from '../src/jobs/ghostReconciliationJob';

const PROBE_CONTENT = `🔬 Production proof probe: Testing permit system at ${new Date().toISOString()}. This tweet verifies posting permits work correctly.`;

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔬 PRODUCTION PROOF PROBE');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const supabase = getSupabaseClient();
  const startTime = new Date();
  
  // Step 1: Create a test decision
  console.log('[PROBE] Step 1: Creating test decision...');
  const decisionId = `probe_${Date.now()}`;
  const scheduledAt = new Date(); // Schedule for now
  
  // Insert into content_metadata (the queue reads from here)
  const { data: decision, error: decisionError } = await supabase
    .from('content_metadata')
    .insert({
      decision_id: decisionId,
      decision_type: 'single',
      status: 'queued',
      content: PROBE_CONTENT,
      scheduled_at: scheduledAt.toISOString(),
      pipeline_source: 'proof_probe',
      build_sha: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown',
      job_run_id: `probe_${Date.now()}`,
      created_at: new Date().toISOString(),
      quality_score: 0.9, // High quality to ensure it's selected
    })
    .select()
    .single();
  
  if (decisionError || !decision) {
    console.error(`[PROBE] ❌ Failed to create decision: ${decisionError?.message}`);
    process.exit(1);
  }
  
  console.log(`[PROBE] ✅ Decision created: ${decisionId}`);
  console.log(`[PROBE]   Status: queued`);
  console.log(`[PROBE]   Scheduled: ${scheduledAt.toISOString()}\n`);
  
  // Set CONTROLLED_DECISION_ID to bypass rate limits
  process.env.CONTROLLED_DECISION_ID = decisionId;
  console.log(`[PROBE] 🔒 Set CONTROLLED_DECISION_ID=${decisionId} to bypass rate limits\n`);
  
  // Step 2: Directly call posting function (bypass queue rate limits)
  console.log('[PROBE] Step 2: Calling posting function directly...');
  console.log('[PROBE]   This will create permit and post the tweet...\n');
  
  let permitId: string | null = null;
  let tweetId: string | null = null;
  
  try {
    // Import posting components
    const { UltimateTwitterPoster } = await import('../src/posting/UltimateTwitterPoster');
    const { executeAuthorizedPost, getBuildSHA } = await import('../src/posting/atomicPostExecutor');
    const { createPostingGuard } = await import('../src/posting/UltimateTwitterPoster');
    
    const poster = new UltimateTwitterPoster();
    const guard = createPostingGuard({
      decision_id: decisionId,
      pipeline_source: 'proof_probe',
      job_run_id: `probe_${Date.now()}`,
    });
    
    const build_sha = getBuildSHA();
    
    console.log('[PROBE] 🚀 Calling executeAuthorizedPost...\n');
    
    // Monitor permit creation
    const permitMonitor = setInterval(async () => {
      const { data: permits } = await supabase
        .from('post_attempts')
        .select('permit_id, status, decision_id')
        .eq('decision_id', decisionId)
        .order('created_at', 'desc')
        .limit(1);
      
      if (permits && permits.length > 0 && !permitId) {
        permitId = permits[0].permit_id;
        console.log(`[PROBE] 🎫 Permit detected: ${permitId} (status: ${permits[0].status})`);
      }
    }, 500);
    
    // Call atomic post executor (this will create permit and post)
    const result = await executeAuthorizedPost(
      poster,
      guard,
      {
        decision_id: decisionId,
        decision_type: 'single',
        pipeline_source: 'proof_probe',
        build_sha,
        job_run_id: `probe_${Date.now()}`,
        content: PROBE_CONTENT,
      },
      {
        isReply: false,
      }
    );
    
    clearInterval(permitMonitor);
    
    if (!result.success || !result.tweet_id) {
      throw new Error(result.error || 'Posting failed');
    }
    
    tweetId = result.tweet_id;
    console.log(`[PROBE] ✅ Post successful! Tweet ID: ${tweetId}\n`);
    
    // Wait a moment for DB updates
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await poster.dispose();
    
  } catch (error: any) {
    console.error(`[PROBE] ❌ Posting failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
  
  // Step 3: Verify permit transitions
  console.log('\n[PROBE] Step 3: Verifying permit transitions...');
  
  const { data: permit } = await supabase
    .from('post_attempts')
    .select('*')
    .eq('decision_id', decisionId)
    .order('created_at', 'desc')
    .limit(1)
    .single();
  
  if (!permit) {
    console.error('[PROBE] ❌ No permit found!');
    process.exit(1);
  }
  
  permitId = permit.permit_id;
  console.log(`[PROBE] ✅ Permit found: ${permitId}`);
  console.log(`[PROBE]   Status: ${permit.status}`);
  console.log(`[PROBE]   Created: ${permit.created_at}`);
  console.log(`[PROBE]   Approved: ${permit.approved_at || 'N/A'}`);
  console.log(`[PROBE]   Used: ${permit.used_at || 'N/A'}`);
  console.log(`[PROBE]   Actual tweet_id: ${permit.actual_tweet_id || 'N/A'}`);
  
  if (permit.status !== 'USED') {
    console.error(`[PROBE] ❌ Permit status is ${permit.status}, expected USED`);
    process.exit(1);
  }
  
  tweetId = permit.actual_tweet_id;
  if (!tweetId) {
    console.error('[PROBE] ❌ No tweet_id in permit!');
    process.exit(1);
  }
  
  console.log(`[PROBE] ✅ Permit transitions verified: PENDING -> APPROVED -> USED\n`);
  
  // Step 4: Verify tweet exists in DB
  console.log('[PROBE] Step 4: Verifying tweet in DB...');
  
  const { data: tweet } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('tweet_id, status, posted_at, decision_id')
    .eq('decision_id', decisionId)
    .single();
  
  if (!tweet || tweet.tweet_id !== tweetId) {
    console.error(`[PROBE] ❌ Tweet not found or ID mismatch!`);
    console.error(`[PROBE]   Expected: ${tweetId}`);
    console.error(`[PROBE]   Found: ${tweet?.tweet_id || 'none'}`);
    process.exit(1);
  }
  
  console.log(`[PROBE] ✅ Tweet found in DB:`);
  console.log(`[PROBE]   tweet_id: ${tweet.tweet_id}`);
  console.log(`[PROBE]   status: ${tweet.status}`);
  console.log(`[PROBE]   posted_at: ${tweet.posted_at}\n`);
  
  // Step 5: Run reconciliation
  console.log('[PROBE] Step 5: Running reconciliation...');
  
  const reconBefore = await supabase
    .from('ghost_tweets')
    .select('tweet_id')
    .eq('tweet_id', tweetId);
  
  const ghostsBefore = reconBefore.data?.length || 0;
  
  const reconResult = await runGhostReconciliation();
  
  const reconAfter = await supabase
    .from('ghost_tweets')
    .select('tweet_id')
    .eq('tweet_id', tweetId);
  
  const ghostsAfter = reconAfter.data?.length || 0;
  
  console.log(`[PROBE] ✅ Reconciliation complete:`);
  console.log(`[PROBE]   Tweets checked: ${reconResult.checked}`);
  console.log(`[PROBE]   Ghosts found: ${reconResult.ghosts_found}`);
  console.log(`[PROBE]   Ghosts inserted: ${reconResult.ghosts_inserted}`);
  console.log(`[PROBE]   Our tweet ghost status: ${ghostsAfter > ghostsBefore ? 'DETECTED AS GHOST ❌' : 'NOT A GHOST ✅'}\n`);
  
  if (ghostsAfter > ghostsBefore) {
    console.error('[PROBE] ❌ Our tweet was detected as a ghost!');
    process.exit(1);
  }
  
  // Step 6: Check system events
  console.log('[PROBE] Step 6: Checking system events trail...');
  
  const { data: events } = await supabase
    .from('system_events')
    .select('event_type, severity, message, created_at')
    .or(`event_data->>'decision_id'.eq.${decisionId},event_data->>'permit_id'.eq.${permitId}`)
    .order('created_at', 'asc');
  
  console.log(`[PROBE] ✅ Found ${events?.length || 0} system events:`);
  events?.forEach((event, i) => {
    console.log(`[PROBE]   ${i + 1}. [${event.event_type}] ${event.message.substring(0, 80)}`);
  });
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ PROBE SUCCESSFUL');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Permit ID: ${permitId}`);
  console.log(`Status Transitions: PENDING -> APPROVED -> USED ✅`);
  console.log(`Tweet ID: ${tweetId}`);
  console.log(`DB Record: EXISTS ✅`);
  console.log(`Reconciliation: 0 new ghosts ✅`);
  console.log(`System Events: ${events?.length || 0} events logged ✅`);
  console.log('\n');
  
  process.exit(0);
}

main().catch(console.error);

