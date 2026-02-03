/**
 * ⏰ HOURLY TICK JOB
 * 
 * Runs every hour to:
 * 1. Compute rate targets for current hour
 * 2. Execute replies/posts with jitter spacing
 * 3. Log observability JSON
 */

import { computeRateTargets, getCurrentHourTargets } from './rateController';
import { getSupabaseClient } from '../db/index';
import { processPostingQueue } from '../jobs/postingQueue';
import { attemptScheduledReply } from '../jobs/replySystemV2/tieredScheduler';

const JITTER_MINUTES = 5; // ±5 minutes jitter

/**
 * Add jitter to scheduled time
 */
function addJitter(baseMinutes: number): number {
  const jitter = Math.floor(Math.random() * (JITTER_MINUTES * 2 + 1)) - JITTER_MINUTES;
  return baseMinutes + jitter;
}

/**
 * Execute hourly tick
 */
export async function executeHourlyTick(): Promise<void> {
  console.log('[HOURLY_TICK] 🕐 Starting hourly tick...');

  // 🔒 SCHEMA PREFLIGHT: Check schema before execution
  const { runSchemaPreflight, isSafeMode } = await import('./schemaPreflight');
  const preflight = await runSchemaPreflight();
  
  if (!preflight.passed) {
    console.error(`[HOURLY_TICK] ❌ Schema preflight failed - SAFE_MODE activated`);
    console.error(`[HOURLY_TICK] Missing: ${preflight.missing.join(', ')}`);
    console.log(`[HOURLY_TICK] 🛡️ Skipping execution (safe mode)`);
    return;
  }

  if (isSafeMode()) {
    console.log(`[HOURLY_TICK] 🛡️ SAFE_MODE active - skipping execution`);
    return;
  }

  // 1. Compute rate targets
  const targets = await computeRateTargets();

  console.log(`[HOURLY_TICK] 📊 Targets: mode=${targets.mode}, replies=${targets.target_replies_this_hour}, posts=${targets.target_posts_this_hour}, allow_search=${targets.allow_search}`);

  const supabase = getSupabaseClient();
  let executedReplies = 0;
  let executedPosts = 0;

  // 2. Execute replies with jitter spacing (execute immediately with delays)
  if (targets.target_replies_this_hour > 0) {
    const replyInterval = 60 / targets.target_replies_this_hour; // Minutes between replies
    for (let i = 0; i < targets.target_replies_this_hour; i++) {
      const delayMinutes = addJitter(i * replyInterval);
      // Wait for delay before executing
      if (delayMinutes > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMinutes * 60 * 1000));
      }
      
      try {
        console.log(`[HOURLY_TICK] 💬 Executing reply ${i + 1}/${targets.target_replies_this_hour} (delay: ${delayMinutes.toFixed(1)}min)`);
        const result = await attemptScheduledReply();
        if (result.posted) {
          executedReplies++;
          console.log(`[HOURLY_TICK] ✅ Reply ${i + 1} posted successfully`);
        } else {
          console.log(`[HOURLY_TICK] ⚠️ Reply ${i + 1} skipped: ${result.reason}`);
        }
      } catch (error: any) {
        console.error(`[HOURLY_TICK] ❌ Reply ${i + 1} failed: ${error.message}`);
      }
    }
  }

  // 3. Execute posts with jitter spacing (execute immediately with delays)
  if (targets.target_posts_this_hour > 0) {
    const postInterval = 60 / targets.target_posts_this_hour; // Minutes between posts
    for (let i = 0; i < targets.target_posts_this_hour; i++) {
      const delayMinutes = addJitter(i * postInterval);
      // Wait for delay before executing
      if (delayMinutes > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMinutes * 60 * 1000));
      }
      
      try {
        console.log(`[HOURLY_TICK] 📝 Executing post ${i + 1}/${targets.target_posts_this_hour} (delay: ${delayMinutes.toFixed(1)}min)`);
        await processPostingQueue();
        executedPosts++;
        console.log(`[HOURLY_TICK] ✅ Post ${i + 1} processed`);
      } catch (error: any) {
        console.error(`[HOURLY_TICK] ❌ Post ${i + 1} failed: ${error.message}`);
      }
    }
  }

  // 4. Log observability JSON
  const hourStart = new Date();
  hourStart.setMinutes(0, 0, 0);

  const logLine = JSON.stringify({
    timestamp: hourStart.toISOString(),
    mode: targets.mode,
    targets: {
      replies: targets.target_replies_this_hour,
      posts: targets.target_posts_this_hour,
    },
    executed: {
      replies: executedReplies,
      posts: executedPosts,
    },
    risk: targets.risk_score,
    yield: targets.yield_score,
    budgets_remaining: targets.budgets_remaining,
    blocked_until: targets.blocked_until?.toISOString() || null,
  });

  console.log(`[HOURLY_TICK] 📊 ${logLine}`);

  // Update state with executed counts
  await supabase
    .from('rate_controller_state')
    .update({
      executed_replies: executedReplies,
      executed_posts: executedPosts,
      updated_at: new Date().toISOString(),
    })
    .eq('hour_start', hourStart.toISOString());

  console.log('[HOURLY_TICK] ✅ Hourly tick complete');
}
