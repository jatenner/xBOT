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
  const startTime = Date.now();
  console.log('[HOURLY_TICK_START] 🕐 Starting hourly tick execution...');

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

  // 2. Execute replies with retry loop until targets met or pool exhausted
  if (targets.target_replies_this_hour > 0) {
    const replyInterval = 60 / targets.target_replies_this_hour; // Minutes between replies
    let attempts = 0;
    const maxAttempts = targets.target_replies_this_hour * 3; // Allow up to 3x attempts to account for skips
    const skipReasons: Record<string, number> = {};
    
    while (executedReplies < targets.target_replies_this_hour && attempts < maxAttempts) {
      attempts++;
      const delayMinutes = addJitter((executedReplies * replyInterval));
      
      // Wait for delay before executing (only if we've posted at least one)
      if (executedReplies > 0 && delayMinutes > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMinutes * 60 * 1000));
      }
      
      try {
        console.log(`[HOURLY_TICK] 💬 Attempt ${attempts}: Executing reply (target: ${targets.target_replies_this_hour}, posted: ${executedReplies})`);
        const result = await attemptScheduledReply();
        
        if (result.posted) {
          executedReplies++;
          console.log(`[HOURLY_TICK] ✅ Reply ${executedReplies}/${targets.target_replies_this_hour} posted successfully`);
        } else {
          const reason = result.reason || 'unknown';
          skipReasons[reason] = (skipReasons[reason] || 0) + 1;
          console.log(`[HOURLY_TICK] ⚠️ Reply attempt ${attempts} skipped: ${reason} (continuing to next candidate)`);
          
          // Check if we should stop (no more candidates likely)
          if (reason.includes('no_candidates') || reason.includes('queue_empty')) {
            console.log(`[HOURLY_TICK] 🛑 No more candidates available, stopping retry loop`);
            break;
          }
        }
      } catch (error: any) {
        console.error(`[HOURLY_TICK] ❌ Reply attempt ${attempts} failed: ${error.message}`);
        
        // Check for backoff/risk triggers
        if (error.message.includes('429') || error.message.includes('rate_limit') || error.message.includes('COOLDOWN')) {
          console.log(`[HOURLY_TICK] 🛑 Risk trigger detected, stopping retry loop`);
          break;
        }
      }
    }
    
    if (executedReplies < targets.target_replies_this_hour) {
      console.log(`[HOURLY_TICK] ⚠️ Only posted ${executedReplies}/${targets.target_replies_this_hour} replies (attempts: ${attempts}, skips: ${JSON.stringify(skipReasons)})`);
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

  const durationMs = Date.now() - startTime;
  const durationSec = (durationMs / 1000).toFixed(1);
  console.log(`[HOURLY_TICK_DONE] ✅ Hourly tick complete (duration: ${durationSec}s, executed: replies=${executedReplies}, posts=${executedPosts})`);
}
