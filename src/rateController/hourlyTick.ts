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
import { getStrategy, pickNextAction, type TickContext } from '../strategy/adaptiveStrategy';

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

  // 1. Compute rate targets (still used for safety/COOLDOWN mode detection)
  const targets = await computeRateTargets();
  console.log(`[HOURLY_TICK] 📊 Rate controller: mode=${targets.mode}, risk=${targets.risk_score}, yield=${targets.yield_score}`);

  // 🛑 SAFETY: If rate controller says COOLDOWN, skip everything
  if (targets.mode === 'COOLDOWN') {
    console.log(`[HOURLY_TICK] 🛑 COOLDOWN mode — skipping all actions this tick`);
    const hourStart = new Date();
    hourStart.setMinutes(0, 0, 0);
    console.log(`[HOURLY_TICK] 📊 ${JSON.stringify({ timestamp: hourStart.toISOString(), mode: 'COOLDOWN', executed: { replies: 0, posts: 0 } })}`);
    return;
  }

  let executedReplies = 0;
  let executedPosts = 0;
  const xActionsEnabled = process.env.X_ACTIONS_ENABLED === 'true';

  // 2. 🧠 ADAPTIVE STRATEGY: Ask "what should I do?" for each action slot
  const strategy = await getStrategy();
  console.log(`[HOURLY_TICK] 🧠 Strategy loaded: gen=${strategy.generation} targets={replies=${strategy.target_replies_per_day}/day, singles=${strategy.target_singles_per_day}/day, threads=${strategy.target_threads_per_day}/day}`);

  // Gather context for strategy decisions
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();

  // Count today's actions
  const { count: repliesToday } = await supabase
    .from('content_metadata').select('*', { count: 'exact', head: true })
    .eq('status', 'posted').eq('decision_type', 'reply').gte('posted_at', todayISO);
  const { count: singlesToday } = await supabase
    .from('content_metadata').select('*', { count: 'exact', head: true })
    .eq('status', 'posted').eq('decision_type', 'single').gte('posted_at', todayISO);
  const { count: threadsToday } = await supabase
    .from('content_metadata').select('*', { count: 'exact', head: true })
    .eq('status', 'posted').eq('decision_type', 'thread').gte('posted_at', todayISO);

  // Get last action timestamps for pacing
  const { data: lastReply } = await supabase
    .from('content_metadata').select('posted_at')
    .eq('status', 'posted').eq('decision_type', 'reply')
    .order('posted_at', { ascending: false }).limit(1).maybeSingle();
  const { data: lastPost } = await supabase
    .from('content_metadata').select('posted_at')
    .eq('status', 'posted').in('decision_type', ['single', 'thread'])
    .order('posted_at', { ascending: false }).limit(1).maybeSingle();

  const minutesSinceLastReply = lastReply?.posted_at
    ? (Date.now() - new Date(lastReply.posted_at).getTime()) / (1000 * 60) : 999;
  const minutesSinceLastPost = lastPost?.posted_at
    ? (Date.now() - new Date(lastPost.posted_at).getTime()) / (1000 * 60) : 999;

  // Check candidate/content availability
  const { count: replyCandidates } = await supabase
    .from('reply_candidate_queue').select('*', { count: 'exact', head: true });
  const { count: queuedContent } = await supabase
    .from('content_metadata').select('*', { count: 'exact', head: true })
    .eq('status', 'queued').in('decision_type', ['single', 'thread']);

  const tickContext: TickContext = {
    replies_today: repliesToday || 0,
    singles_today: singlesToday || 0,
    threads_today: threadsToday || 0,
    minutes_since_last_reply: minutesSinceLastReply,
    minutes_since_last_post: minutesSinceLastPost,
    reply_candidates_available: replyCandidates || 0,
    queued_content_available: queuedContent || 0,
    safety_ok: !targets.blocked_until,
    x_actions_enabled: xActionsEnabled,
    heartbeat_ok: heartbeatSuccess,
    current_hour_utc: new Date().getUTCHours(),
  };

  // 3. Pick the best action RIGHT NOW
  const decision = await pickNextAction(strategy, tickContext);

  // 4. Execute the chosen action
  if (decision.action === 'wait') {
    console.log(`[HOURLY_TICK] ⏸️ Strategy says WAIT: ${decision.reason}`);
  } else if (decision.action === 'reply') {
    console.log(`[HOURLY_TICK] 💬 Strategy says REPLY (score=${decision.score.toFixed(2)})`);
    try {
      const result = await attemptScheduledReply();
      if (result.consumedSlot === false) {
        console.log(`[HOURLY_TICK] ⚠️ ${result.reason} — slot not consumed`);
      } else if (result.posted) {
        executedReplies++;
        console.log(`[HOURLY_TICK] ✅ Reply posted successfully`);
      } else {
        console.log(`[HOURLY_TICK] ⚠️ Reply skipped: ${result.reason}`);
      }
    } catch (error: any) {
      console.error(`[HOURLY_TICK] ❌ Reply failed: ${error.message}`);
    }
  } else if (decision.action === 'single' || decision.action === 'thread') {
    console.log(`[HOURLY_TICK] 📝 Strategy says ${decision.action.toUpperCase()} (score=${decision.score.toFixed(2)})`);
    try {
      await processPostingQueue();
      executedPosts++;
      console.log(`[HOURLY_TICK] ✅ Post processed successfully`);
    } catch (error: any) {
      console.error(`[HOURLY_TICK] ❌ Post failed: ${error.message}`);
    }
  }

  // 5. Log observability JSON
  const hourStart = new Date();
  hourStart.setMinutes(0, 0, 0);

  const logLine = JSON.stringify({
    timestamp: hourStart.toISOString(),
    mode: targets.mode,
    strategy: {
      action: decision.action,
      score: decision.score,
      scores: decision.scores,
      generation: strategy.generation,
      targets_per_day: {
        replies: strategy.target_replies_per_day,
        singles: strategy.target_singles_per_day,
        threads: strategy.target_threads_per_day,
      },
    },
    today: {
      replies: repliesToday || 0,
      singles: singlesToday || 0,
      threads: threadsToday || 0,
    },
    executed: {
      replies: executedReplies,
      posts: executedPosts,
    },
    risk: targets.risk_score,
    yield: targets.yield_score,
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
