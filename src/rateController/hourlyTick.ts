/**
 * ⏰ HOURLY TICK JOB
 * 
 * Runs every hour to:
 * 1. Nav heartbeat (once per tick)
 * 2. Compute rate targets
 * 3. Execute replies (if X_ACTIONS_ENABLED + heartbeat OK) or posts
 * 4. Log observability JSON
 */

import { computeRateTargets } from './rateController';
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
 * Run navigation heartbeat once per tick. Returns true if successful.
 * safeGoto emits SAFE_GOTO_ATTEMPT/OK/FAIL; we write nav_heartbeat to db.
 */
export async function runNavHeartbeat(supabase: ReturnType<typeof getSupabaseClient>): Promise<boolean> {
  const { getConsentWallCooldown } = await import('../utils/consentWallCooldown');
  if (getConsentWallCooldown().isCooldownActive()) {
    const status = getConsentWallCooldown().getStatus();
    console.log(`[NAV_HEARTBEAT] SKIP_HEARTBEAT_CONSENT_COOLDOWN: cooldown active (${status.remainingSeconds ?? 0}s remaining)`);
    try {
      await supabase.from('system_events').insert({
        event_type: 'nav_heartbeat',
        severity: 'info',
        message: 'Heartbeat skipped: consent cooldown active',
        event_data: { success: false, reason: 'SKIP_HEARTBEAT_CONSENT_COOLDOWN', remaining_seconds: status.remainingSeconds },
        created_at: new Date().toISOString(),
      });
    } catch { /* non-blocking */ }
    return false;
  }

  const startMs = Date.now();
  const PRIMARY_URL = 'https://x.com/home?lang=en';
  const FALLBACK_URL = 'https://x.com/home';

  try {
    const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
    const { safeGoto } = await import('../utils/safeGoto');
    const pool = UnifiedBrowserPool.getInstance();

    // Use same persistent browser context as other authenticated nav (pool reuses contexts)
    const result = await pool.withContext('nav_heartbeat', async (ctx) => {
      const page = await ctx.newPage();
      // Try primary URL first (often bypasses consent variants)
      let gotoResult = await safeGoto(page, PRIMARY_URL, {
        operation: 'nav_heartbeat',
        timeout: 25000,
        recordWallOnBlock: false, // Don't trigger cooldown yet - allow fallback
      });
      // Fallback to /home if primary hit consent wall
      if (!gotoResult.success && gotoResult.consentWallBlocked) {
        console.log(`[NAV_HEARTBEAT] Primary URL hit consent wall, trying fallback ${FALLBACK_URL}`);
        gotoResult = await safeGoto(page, FALLBACK_URL, {
          operation: 'nav_heartbeat',
          timeout: 25000,
          recordWallOnBlock: true, // Record cooldown if fallback also fails
        });
      }
      await page.close();
      return gotoResult;
    }, 5);

    const durationMs = Date.now() - startMs;
    const success = result.success && !result.consentWallBlocked;
    const reason = success ? 'ok' : (result.consentWallBlocked ? 'consent_wall_blocked' : 'navigation_error');

    console.log(`[NAV_HEARTBEAT] ${success ? '✅' : '❌'} ${success ? 'SAFE_GOTO_OK' : 'SAFE_GOTO_FAIL'} duration_ms=${durationMs} reason=${reason}`);

    await supabase.from('system_events').insert({
      event_type: 'nav_heartbeat',
      severity: success ? 'info' : 'warning',
      message: success ? `Nav heartbeat OK (${durationMs}ms)` : `Nav heartbeat FAIL: ${reason}`,
      event_data: { success, reason, duration_ms: durationMs },
      created_at: new Date().toISOString(),
    });

    return success;
  } catch (err: unknown) {
    const durationMs = Date.now() - startMs;
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[NAV_HEARTBEAT] ❌ SAFE_GOTO_FAIL duration_ms=${durationMs} reason=${reason}`);

    await supabase.from('system_events').insert({
      event_type: 'nav_heartbeat',
      severity: 'warning',
      message: `Nav heartbeat FAIL: ${reason}`,
      event_data: { success: false, reason, duration_ms: durationMs },
      created_at: new Date().toISOString(),
    });

    return false;
  }
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

  const supabase = getSupabaseClient();

  // A) NAV HEARTBEAT (once per tick, no retry)
  const heartbeatSuccess = await runNavHeartbeat(supabase);

  // 1. Compute rate targets
  const targets = await computeRateTargets();
  console.log(`[HOURLY_TICK] 📊 Targets computed: mode=${targets.mode}, replies=${targets.target_replies_this_hour}, posts=${targets.target_posts_this_hour}, allow_search=${targets.allow_search}`);

  let executedReplies = 0;
  let executedPosts = 0;

  const xActionsEnabled = process.env.X_ACTIONS_ENABLED === 'true';
  const maxRepliesThisTick = Math.min(targets.target_replies_this_hour, 1); // C) Post at most 1 reply

  // 2. Execute replies — only if X_ACTIONS_ENABLED + heartbeat OK
  if (maxRepliesThisTick > 0) {
    if (!xActionsEnabled) {
      console.log(`[HOURLY_TICK] ⏭️ Reply loop: skipped (X_ACTIONS_ENABLED=false)`);
    } else if (!heartbeatSuccess) {
      console.log(`[HOURLY_TICK] ⏭️ Reply loop: skipped (heartbeat failed this tick)`);
    } else {
      console.log(`[HOURLY_TICK] 🔄 Reply loop: entered, target=${maxRepliesThisTick} (candidates from scheduler)`);

      const replyInterval = 60 / Math.max(1, maxRepliesThisTick);
      let attempts = 0;
      const maxAttempts = maxRepliesThisTick * 3;
      const skipReasons: Record<string, number> = {};
    
    while (executedReplies < maxRepliesThisTick && attempts < maxAttempts) {
      const delayMinutes = addJitter((executedReplies * replyInterval));
      
      // Wait for delay before executing (only if we've posted at least one)
      if (executedReplies > 0 && delayMinutes > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMinutes * 60 * 1000));
      }
      
      try {
        attempts++;
        console.log(`[HOURLY_TICK] 💬 Attempt ${attempts}: Executing reply (target: ${maxRepliesThisTick}, posted: ${executedReplies})`);
        const result = await attemptScheduledReply();

        // 🔒 CONSENT WALL ROUTING: consumedSlot=false means don't count this as a reply attempt
        if (result.consumedSlot === false) {
          attempts--; // Roll back - did not consume a slot
          console.log(`[HOURLY_TICK] ⚠️ ${result.reason} — not consuming attempt slot`);
          continue;
        }
        
        if (result.posted) {
          executedReplies++;
          console.log(`[HOURLY_TICK] ✅ Reply ${executedReplies}/${maxRepliesThisTick} posted successfully`);
        } else {
          const reason = result.reason || 'unknown';
          skipReasons[reason] = (skipReasons[reason] || 0) + 1;
          console.log(`[HOURLY_TICK] ⚠️ Reply attempt ${attempts} skipped: ${reason} (continuing to next candidate)`);
          
          // Check if we should stop (no more candidates likely)
          if (reason.includes('no_candidates') || reason.includes('queue_empty')) {
            console.log(`[HOURLY_TICK] 🛑 No candidates: ${reason} — stopping retry loop`);
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
    
    if (executedReplies < maxRepliesThisTick) {
      const why = Object.keys(skipReasons).length > 0 ? `skips: ${JSON.stringify(skipReasons)}` : 'no candidates passed preflight';
      console.log(`[HOURLY_TICK] ⚠️ Posted ${executedReplies}/${maxRepliesThisTick} replies (attempts: ${attempts}, ${why})`);
    }
    }
  } else {
    console.log(`[HOURLY_TICK] ⏭️ Reply loop: skipped (target_replies=0)`);
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
