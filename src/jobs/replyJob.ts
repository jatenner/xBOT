/**
 * 💬 REPLY JOB - Autonomous Reply Generation
 * Generates replies using LLM and queues for posting
 * 
 * ═══════════════════════════════════════════════════════════════════════
 * 🔒 CRITICAL SAFETY INVARIANTS:
 * 
 * 1. ALL reply generation MUST go through generateReplyContent() router
 * 2. NO direct imports of single/thread generators allowed
 * 3. ALL decisions MUST pass: Context Lock + Semantic Gate + Anti-Spam
 * 4. Synthetic replies BLOCKED in production (require ALLOW_SYNTHETIC_REPLIES=true)
 * 5. PostingQueue verifies gate data present before posting
 * 
 * If you need to modify reply generation:
 * - Add logic to generateReplyContent() router
 * - Never import generators directly
 * - Never bypass gate checks
 * ═══════════════════════════════════════════════════════════════════════
 */

import { v4 as uuidv4 } from 'uuid';
import { ENV } from '../config/env';
import { log } from '../lib/logger';
import { getConfig } from '../config/config';
import { getEnvConfig, isLLMAllowed } from '../config/envFlags';
import { getSupabaseClient } from '../db/index';
import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { strategicReplySystem } from '../growth/strategicReplySystem';
import { getPersonalityScheduler, type GeneratorType } from '../scheduling/personalityScheduler';
import { ReplyDiagnosticLogger } from '../utils/replyDiagnostics';
import { formatContentForTwitter } from '../posting/aiVisualFormatter';

// ============================================================
// RATE LIMIT CONFIGURATION (from .env)
// ============================================================
const getReplyConfig = () => {
  const toNumber = (value: string | undefined, fallback: number) => {
    if (!value) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  // 🚀 RAMP MODE: Override quotas if enabled (synchronous check)
  const rampMode = process.env.RAMP_MODE === 'true';
  const rampLevel = process.env.RAMP_LEVEL;
  let effectiveMaxRepliesPerHour = toNumber(process.env.REPLIES_PER_HOUR, 4);
  
  if (rampMode) {
    const level = rampLevel === '2' ? 2 : rampLevel === '3' ? 3 : 1;
    const quotas: Record<1 | 2 | 3, { replies: number }> = {
      1: { replies: 1 },
      2: { replies: 2 },
      3: { replies: 4 },
    };
    effectiveMaxRepliesPerHour = quotas[level].replies;
  }
  
  const config = {
    MIN_MINUTES_BETWEEN: toNumber(process.env.REPLY_MINUTES_BETWEEN, 15),
    MAX_REPLIES_PER_HOUR: effectiveMaxRepliesPerHour,
    MAX_REPLIES_PER_DAY: toNumber(process.env.REPLY_MAX_PER_DAY, 250),
    BATCH_SIZE: toNumber(process.env.REPLY_BATCH_SIZE, 1),
    STAGGER_BASE_MIN: toNumber(process.env.REPLY_STAGGER_BASE_MIN, 5),
    STAGGER_INCREMENT_MIN: toNumber(process.env.REPLY_STAGGER_INCREMENT_MIN, 10),
  };
  log({ op: 'reply_config_loaded', config });
  return config;
};

const REPLY_CONFIG = getReplyConfig();

const HARVESTER_TRIGGER_THRESHOLD_DEFAULT = 40; // Lowered from 80 to be more realistic
const HARVESTER_CRITICAL_THRESHOLD = 20;
const HARVESTER_COOLDOWN_MS = 45 * 60 * 1000; // 45 minutes between forced runs
let lastHarvesterTriggerTs = 0;

/**
 * Calculate dynamic pool threshold based on reply recency
 * Prevents deadlock when system has been idle
 */
function getDynamicPoolThreshold(lastReplyAt: Date | null): number {
  if (!lastReplyAt) {
    return 10; // System never replied - be very lenient
  }
  
  const hoursSinceLastReply = (Date.now() - lastReplyAt.getTime()) / (60 * 60 * 1000);
  
  if (hoursSinceLastReply > 24) {
    console.log(`[REPLY_JOB] 📊 pool_threshold dynamic=5 lastReplyAgeHours=${hoursSinceLastReply.toFixed(1)} (24h+ idle)`);
    return 5; // Very idle - very lenient
  } else if (hoursSinceLastReply > 2) {
    console.log(`[REPLY_JOB] 📊 pool_threshold dynamic=8 lastReplyAgeHours=${hoursSinceLastReply.toFixed(1)} (2h+ idle)`);
    return 8; // Somewhat idle - lenient (was 20)
  } else {
    console.log(`[REPLY_JOB] 📊 pool_threshold dynamic=15 lastReplyAgeHours=${hoursSinceLastReply.toFixed(1)} (active)`);
    return 15; // Active - moderate threshold (was 40)
  }
}

// Global metrics
let replyLLMMetrics = {
  calls_total: 0,
  calls_failed: 0,
  failure_reasons: {} as Record<string, number>
};

export function getReplyLLMMetrics() {
  return { ...replyLLMMetrics };
}

/**
 * Log rate limit check failures for monitoring
 * 🚨 Alerts when rate limit checks fail repeatedly
 */
async function logRateLimitFailure(failureType: string, errorMessage: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    // Try to log to system_events table
    await supabase
      .from('system_events')
      .insert({
        event_type: 'rate_limit_check_failure',
        event_data: {
          failure_type: failureType,
          error_message: errorMessage,
          timestamp: new Date().toISOString()
        },
        severity: 'critical',
        created_at: new Date().toISOString()
      });
    
    console.log(`[RATE_LIMIT] 📝 Logged failure to system_events: ${failureType}`);
  } catch (error: any) {
    // If system_events doesn't exist, just log to console
    console.error('[RATE_LIMIT] ⚠️ Could not log to database:', error.message);
  }
}

/**
 * Check hourly reply quota WITH RETRY LOGIC
 * 🔒 FAIL-CLOSED: Blocks posting if check fails (safety first)
 */
type QuotaResultBase = {
  canReply: boolean;
  minutesUntilNext?: number;
  degradedReason?: string;
};

async function checkReplyHourlyQuota(): Promise<
  QuotaResultBase & {
    repliesThisHour: number;
  }
> {
  const MAX_RETRIES = 3;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const supabase = getSupabaseClient();
      const now = new Date();
      // 🔥 FIX: Use rolling 60 minutes (not calendar hour)
      const sixtyMinutesAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      // Count replies in last 60 minutes (rolling window)
      const { count, error } = await supabase
        .from('content_metadata')
        .select('*', { count: 'exact', head: true })
        .eq('decision_type', 'reply')
        .eq('status', 'posted')
        .gte('posted_at', sixtyMinutesAgo.toISOString());
      
      if (error) {
        console.error(`[REPLY_QUOTA] ❌ Database error (attempt ${attempt}/${MAX_RETRIES}):`, error.message);
        
        if (attempt < MAX_RETRIES) {
          // Retry with exponential backoff
          const delayMs = 1000 * attempt; // 1s, 2s, 3s
          console.log(`[REPLY_QUOTA] 🔄 Retrying in ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }
        
        // All retries failed - ENTER DEGRADED MODE (fail-open with warning)
        const degradedReason = 'hourly_quota_check_failed';
        console.error('[REPLY_QUOTA] ⚠️ Entering degraded mode (hourly quota check failed)');
        await logRateLimitFailure(degradedReason, error.message);
        return { canReply: true, repliesThisHour: 0, degradedReason };
      }
      
      const repliesThisHour = count || 0;
      const canReply = repliesThisHour < REPLY_CONFIG.MAX_REPLIES_PER_HOUR;
      
      // Log rate limit status
      if (!canReply) {
        console.log(`[REPLY_RATE_LIMIT] blocked=true count_last_60m=${repliesThisHour} cap=${REPLY_CONFIG.MAX_REPLIES_PER_HOUR}`);
      }
      
      let minutesUntilNext;
      if (!canReply) {
        // Calculate when oldest reply will fall out of 60-minute window
        const { data: oldestReply } = await supabase
          .from('content_metadata')
          .select('posted_at')
          .eq('decision_type', 'reply')
          .eq('status', 'posted')
          .gte('posted_at', sixtyMinutesAgo.toISOString())
          .order('posted_at', { ascending: true })
          .limit(1)
          .single();
        
        if (oldestReply) {
          const oldestTime = new Date(oldestReply.posted_at);
          const unlocksAt = new Date(oldestTime.getTime() + 60 * 60 * 1000);
          minutesUntilNext = Math.max(0, (unlocksAt.getTime() - now.getTime()) / (1000 * 60));
        } else {
          minutesUntilNext = 60; // Fallback
        }
      }
      
      // Success - return result
      return { canReply, repliesThisHour, minutesUntilNext };
      
    } catch (error: any) {
      console.error(`[REPLY_QUOTA] ❌ Quota check failed (attempt ${attempt}/${MAX_RETRIES}):`, error.message);
      
      if (attempt < MAX_RETRIES) {
        const delayMs = 1000 * attempt;
        console.log(`[REPLY_QUOTA] 🔄 Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      
      const degradedReason = 'hourly_quota_exception';
      console.error('[REPLY_QUOTA] ⚠️ Entering degraded mode (hourly quota exception)');
      await logRateLimitFailure(degradedReason, error.message);
      return { canReply: true, repliesThisHour: 0, degradedReason };
    }
  }
  
  // Should never reach here, but stay open if it does
  return { canReply: true, repliesThisHour: 0, degradedReason: 'hourly_quota_unexpected_fallback' };
}

/**
 * Check daily reply quota WITH RETRY LOGIC
 * 🔒 FAIL-CLOSED: Blocks posting if check fails (safety first)
 */
async function checkReplyDailyQuota(): Promise<
  QuotaResultBase & {
    repliesToday: number;
    resetTime?: Date;
  }
> {
  const MAX_RETRIES = 3;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const supabase = getSupabaseClient();
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today
      
      // Count replies in content_metadata
      const { count, error } = await supabase
        .from('content_metadata')
        .select('*', { count: 'exact', head: true })
        .eq('decision_type', 'reply')
        .eq('status', 'posted')
        .gte('posted_at', today.toISOString());
      
      if (error) {
        console.error(`[DAILY_QUOTA] ❌ Database error (attempt ${attempt}/${MAX_RETRIES}):`, error.message);
        
        if (attempt < MAX_RETRIES) {
          const delayMs = 1000 * attempt;
          console.log(`[DAILY_QUOTA] 🔄 Retrying in ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }
        
        const degradedReason = 'daily_quota_check_failed';
        console.error('[DAILY_QUOTA] ⚠️ Entering degraded mode (daily quota check failed)');
        await logRateLimitFailure(degradedReason, error.message);
        return { canReply: true, repliesToday: 0, degradedReason };
      }
      
      const repliesToday = count || 0;
      const canReply = repliesToday < REPLY_CONFIG.MAX_REPLIES_PER_DAY;
      
      // Calculate reset time (midnight tonight)
      const resetTime = new Date(today);
      resetTime.setDate(resetTime.getDate() + 1);
      
      return { canReply, repliesToday, resetTime };
      
    } catch (error: any) {
      console.error(`[DAILY_QUOTA] ❌ Check failed (attempt ${attempt}/${MAX_RETRIES}):`, error.message);
      
      if (attempt < MAX_RETRIES) {
        const delayMs = 1000 * attempt;
        console.log(`[DAILY_QUOTA] 🔄 Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      
      const degradedReason = 'daily_quota_exception';
      console.error('[DAILY_QUOTA] ⚠️ Entering degraded mode (daily quota exception)');
      await logRateLimitFailure(degradedReason, error.message);
      return { canReply: true, repliesToday: 0, degradedReason };
    }
  }
  
  return { canReply: true, repliesToday: 0, degradedReason: 'daily_quota_unexpected_fallback' };
}

/**
 * Check if enough time has passed since last reply
 */
async function checkTimeBetweenReplies(): Promise<{
  canReply: boolean;
  minutesSinceLast: number;
  minutesUntilNext?: number;
  lastReplyTime?: Date;
}> {
  const supabase = getSupabaseClient();
  
  try {
    // Get most recent reply
    // 🚨 CRITICAL FIX: Check content_metadata for last reply
    const { data, error } = await supabase
      .from('content_metadata')
      .select('posted_at')
      .eq('decision_type', 'reply')
      .eq('status', 'posted')
      .order('posted_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error || !data) {
      // No previous replies or error - allow
      return { canReply: true, minutesSinceLast: 999 };
    }
    
    // 🚨 FIX: Handle null posted_at (corrupted data from old system)
    if (!data.posted_at) {
      console.warn('[TIME_BETWEEN] ⚠️ Last reply has NULL posted_at - treating as stale, allowing replies');
      return { canReply: true, minutesSinceLast: 999 };
    }
    
    const lastReplyTime = new Date(String(data.posted_at));
    
    // 🚨 FIX: Handle invalid dates
    if (isNaN(lastReplyTime.getTime())) {
      console.warn('[TIME_BETWEEN] ⚠️ Invalid posted_at date - allowing replies');
      return { canReply: true, minutesSinceLast: 999 };
    }
    
    const now = new Date();
    const elapsedMs = now.getTime() - lastReplyTime.getTime();
    const minIntervalMs = REPLY_CONFIG.MIN_MINUTES_BETWEEN * 60 * 1000;
    const graceMs = 60 * 1000; // 60 second tolerance (increased from 30s to avoid edge cases)
    const staleThresholdMs = 60 * 60 * 1000; // 1 hour: treat as stale and allow replies

    let canReply = elapsedMs + graceMs >= minIntervalMs;

    if (!canReply && elapsedMs >= staleThresholdMs) {
      canReply = true;
      console.log('[TIME_BETWEEN] ⏰ Last reply is stale (>1h ago), allowing new replies');
    }

    const remainingMs = Math.max(0, minIntervalMs - elapsedMs);
    const minutesSinceLast = elapsedMs / (1000 * 60);
    const minutesUntilNext = canReply ? 0 : remainingMs / (1000 * 60);
    
    return {
      canReply,
      minutesSinceLast: Math.floor(minutesSinceLast),
      minutesUntilNext: Math.ceil(minutesUntilNext),
      lastReplyTime
    };
    
  } catch (error) {
    console.error('[TIME_BETWEEN] ❌ Check failed:', error);
    return { canReply: true, minutesSinceLast: 999 };
  }
}

export async function generateReplies(): Promise<void> {
  ReplyDiagnosticLogger.logCycleStart();
  
  // ===========================================================
  // STEP 1: CHECK PACING GUARD (PHASE 3 - THROUGHPUT)
  // ===========================================================
  
  const { checkReplyPacing, calculateNextRunHint } = await import('./replyPacingGuard');
  const pacingCheck = await checkReplyPacing();
  
  if (!pacingCheck.canReply) {
    const nextHint = calculateNextRunHint(pacingCheck);
    console.log(`[REPLY_JOB] next_run_hint_in_min=${nextHint} reason=${pacingCheck.reason}`);
    
    ReplyDiagnosticLogger.logBlocked(
      `Pacing guard: ${pacingCheck.reason}`,
      pacingCheck.nextAllowedInMin ? new Date(Date.now() + pacingCheck.nextAllowedInMin * 60 * 1000) : undefined
    );
    ReplyDiagnosticLogger.logCycleEnd(false, [pacingCheck.reason]);
    return;
  }
  
  // ===========================================================
  // STEP 2: CHECK LEGACY RATE LIMITS (FALLBACK)
  // ===========================================================
  
  // Check 1: Hourly quota
  const hourlyCheck = await checkReplyHourlyQuota();
  if (!hourlyCheck.canReply) {
    const nextAvailable = new Date(Date.now() + (hourlyCheck.minutesUntilNext || 0) * 60 * 1000);
    ReplyDiagnosticLogger.logBlocked('Hourly quota exceeded', nextAvailable);
    ReplyDiagnosticLogger.logCycleEnd(false, ['Hourly quota exceeded']);
    return;
  }
  if (hourlyCheck.degradedReason) {
    console.warn(`[REPLY_JOB] ⚠️ Hourly quota check degraded (${hourlyCheck.degradedReason}) - continuing with safeguards`);
  }
  
  // Check 2: Daily quota
  const dailyCheck = await checkReplyDailyQuota();
  if (!dailyCheck.canReply) {
    ReplyDiagnosticLogger.logBlocked('Daily quota exceeded', dailyCheck.resetTime);
    ReplyDiagnosticLogger.logCycleEnd(false, ['Daily quota exceeded']);
    return;
  }
  if (dailyCheck.degradedReason) {
    console.warn(`[REPLY_JOB] ⚠️ Daily quota check degraded (${dailyCheck.degradedReason}) - continuing with safeguards`);
  }
  
  // Check 3: Time between replies
  const timeCheck = await checkTimeBetweenReplies();
  if (!timeCheck.canReply) {
    const nextAvailable = new Date(Date.now() + (timeCheck.minutesUntilNext || 0) * 60 * 1000);
    ReplyDiagnosticLogger.logBlocked('Too soon since last reply', nextAvailable);
    ReplyDiagnosticLogger.logCycleEnd(false, ['Too soon since last reply']);
    return;
  }
  
  // Log quota status
  ReplyDiagnosticLogger.logQuotaStatus({
    quota_hourly: {
      used: hourlyCheck.repliesThisHour,
      limit: REPLY_CONFIG.MAX_REPLIES_PER_HOUR,
      available: REPLY_CONFIG.MAX_REPLIES_PER_HOUR - hourlyCheck.repliesThisHour
    },
    quota_daily: {
      used: dailyCheck.repliesToday,
      limit: REPLY_CONFIG.MAX_REPLIES_PER_DAY,
      available: REPLY_CONFIG.MAX_REPLIES_PER_DAY - dailyCheck.repliesToday
    },
    time_since_last: {
      minutes: timeCheck.minutesSinceLast,
      required: REPLY_CONFIG.MIN_MINUTES_BETWEEN,
      can_post: timeCheck.canReply
    }
  });
  
  // ===========================================================
  // STEP 2: PROCEED WITH GENERATION
  // ===========================================================
  
  console.log('[REPLY_JOB] 🎯 All rate limits passed - proceeding with generation');
  
  const config = getConfig();
  
  try {
    if (config.MODE === 'shadow') {
      await generateSyntheticReplies();
    } else {
      await generateRealReplies();
    }
    console.log('[REPLY_JOB] ✅ Reply generation completed');
    ReplyDiagnosticLogger.logCycleEnd(true);
  } catch (error: any) {
    console.error('[REPLY_JOB] ❌ Reply generation failed:', error.message);
    ReplyDiagnosticLogger.logCycleEnd(false, [error.message]);
    throw error;
  }
}

async function generateSyntheticReplies(): Promise<void> {
  // 🚨 FAIL-CLOSED BLOCK: Synthetic replies bypass ALL gates (context lock, semantic, anti-spam)
  // Only allow in explicit test mode
  const isTestMode = process.env.NODE_ENV === 'test' || process.env.ALLOW_SYNTHETIC_REPLIES === 'true';
  
  if (!isTestMode) {
    console.error('[SYNTHETIC_REPLIES] ⛔ BLOCKED: Synthetic replies bypass safety gates in production');
    console.error('[SYNTHETIC_REPLIES]   Set ALLOW_SYNTHETIC_REPLIES=true to enable for testing');
    console.warn('[SYNTHETIC_REPLIES] ⚠️ Skipping synthetic replies (production mode - fail-closed)');
    return; // SKIP not CRASH - fail-closed invariant
  }
  
  console.warn('[SYNTHETIC_REPLIES] ⚠️ Running in UNSAFE TEST mode - bypasses context lock, semantic gate, anti-spam');
  console.log('[REPLY_JOB] 🎭 Generating synthetic replies for shadow mode...');
  
  const decision_id = uuidv4();
  
  const supabase = getSupabaseClient();
  // 🎯 v2: Set content_slot for replies
  await supabase.from('content_metadata').insert([{
    decision_id,
    decision_type: 'reply',
    content: "Great point about nutrition! Here's an additional insight based on recent research...",
    content_slot: 'reply', // 🎯 v2: Store content slot for replies
    generation_source: 'synthetic',
    status: 'queued',
    scheduled_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    quality_score: 0.85,
    predicted_er: 0.028,
    topic_cluster: 'nutrition',
    target_tweet_id: 'mock_tweet_123',
    target_username: 'health_influencer',
    bandit_arm: 'supportive_reply'
  }]);
  
  console.log(`[REPLY_JOB] 🎭 Synthetic reply queued decision_id=${decision_id}`);
}

async function generateRealReplies(): Promise<void> {
  const llmCheck = isLLMAllowed();
  if (!llmCheck.allowed) {
    console.log(`[REPLY_JOB] ⏭️ LLM blocked: ${llmCheck.reason}`);
    return;
  }
  
  console.log('[REPLY_JOB] 🎯 Starting reply generation (AI-driven targeting)...');
 
  // Log account pool status
  const { getAccountPoolHealth } = await import('./accountDiscoveryJob');
  const poolHealth = await getAccountPoolHealth();
  console.log(`[REPLY_JOB] 📊 Account Pool Status:`);
  console.log(`  • Total accounts: ${poolHealth.total_accounts}`);
  console.log(`  • High quality: ${poolHealth.high_quality}`);
  console.log(`  • Recent discoveries: ${poolHealth.recent_discoveries}`);
  console.log(`  • Health: ${poolHealth.status.toUpperCase()}`);
  
  if (poolHealth.status === 'critical') {
    console.warn('[REPLY_JOB] ⚠️ CRITICAL: Account pool too small (<20 accounts)');
    console.log('[REPLY_JOB] 💡 Waiting for account_discovery job to populate pool...');
    return;
  }
  
  const supabaseClient = getSupabaseClient();
  
  // ============================================================
  // PREFLIGHT: ENSURE POOL HAS 10+ OPPORTUNITIES
  // ============================================================
  console.log('[REPLY_JOB] 🔍 Preflight check: Verifying opportunity pool...');
  
  let { count: poolCount, error: poolCheckError } = await supabaseClient
    .from('reply_opportunities')
    .select('id', { count: 'exact', head: true })
    .eq('replied_to', false)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());
 
  poolCount = poolCount || 0;
  console.log(`[REPLY_JOB] 📊 Opportunity pool: ${poolCount} available`);
  const targetRepliesThisCycle = poolCount >= 200 ? 6 : poolCount <= 50 ? 3 : 5;
  console.log(`[REPLY_JOB] 📋 Target: ${targetRepliesThisCycle} replies per cycle (auto-adjusted for pool size)`);

  // 🎯 DYNAMIC THRESHOLD: Get last reply time to calculate dynamic threshold
  const { data: lastReplyData } = await supabaseClient
    .from('content_metadata')
    .select('posted_at')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .order('posted_at', { ascending: false })
    .limit(1)
    .single();
  
  const lastReplyAt = lastReplyData?.posted_at ? new Date(lastReplyData.posted_at) : null;
  const HARVESTER_TRIGGER_THRESHOLD = getDynamicPoolThreshold(lastReplyAt);

  if (poolCount < HARVESTER_TRIGGER_THRESHOLD) {
    const now = Date.now();
    const sinceLastTrigger = now - lastHarvesterTriggerTs;
    const cooldownRemaining = HARVESTER_COOLDOWN_MS - sinceLastTrigger;

    console.warn(`[REPLY_JOB] ⚠️ Opportunity pool below dynamic threshold (${poolCount} < ${HARVESTER_TRIGGER_THRESHOLD})`);

    if (sinceLastTrigger >= HARVESTER_COOLDOWN_MS || poolCount < HARVESTER_CRITICAL_THRESHOLD) {
      console.log(`[REPLY_JOB] 🚨 Triggering harvesters (cooldown ${Math.max(0, cooldownRemaining)}ms remaining, critical=${poolCount < HARVESTER_CRITICAL_THRESHOLD})`);
      lastHarvesterTriggerTs = now;
      try {
        const { tweetBasedHarvester } = await import('./tweetBasedHarvester');
        console.log('[REPLY_JOB] 🌐 Running tweet-based harvester...');
        await tweetBasedHarvester();

        const { replyOpportunityHarvester } = await import('./replyOpportunityHarvester');
        console.log('[REPLY_JOB] 👥 Running mega-viral harvester...');
        await replyOpportunityHarvester();

        console.log('[REPLY_JOB] ✅ Harvester preflight complete');

        // 🔄 WAIT FOR HARVEST TO POPULATE POOL (fixes race condition)
        const MAX_WAIT_MS = 90000; // 90 seconds max wait
        const POLL_INTERVAL_MS = 10000; // Check every 10 seconds
        const startPoolCount = poolCount;
        const waitStartTime = Date.now();
        let pollCount = 0;
        
        console.log(`[REPLY_JOB] ⏳ Waiting for harvest to populate pool (start=${startPoolCount}, threshold=${HARVESTER_TRIGGER_THRESHOLD})`);
        
        while (Date.now() - waitStartTime < MAX_WAIT_MS) {
          pollCount++;
          
          // Wait before polling (skip first iteration)
          if (pollCount > 1) {
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
          }
          
          // Re-count pool
          const polled = await supabaseClient
            .from('reply_opportunities')
            .select('id', { count: 'exact', head: true })
            .eq('replied_to', false)
            .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());
          
          if (!polled.error) {
            poolCount = polled.count || 0;
            const elapsed = Date.now() - waitStartTime;
            console.log(`[REPLY_JOB] ⏳ waiting_for_harvest poll=${pollCount} elapsed=${elapsed}ms pool=${poolCount}/${HARVESTER_TRIGGER_THRESHOLD}`);
            
            // Break early if threshold met
            if (poolCount >= HARVESTER_TRIGGER_THRESHOLD) {
              console.log(`[REPLY_JOB] ✅ Pool threshold met after ${elapsed}ms (${startPoolCount} → ${poolCount})`);
              break;
            }
          }
        }
        
        const finalWaitTime = Date.now() - waitStartTime;
        console.log(`[REPLY_JOB] 📊 pool_after_harvest start=${startPoolCount} end=${poolCount} waited_ms=${finalWaitTime}`);
        
        // 🚀 DYNAMIC THRESHOLD: Allow proceeding with lower pool if conditions met
        if (poolCount < HARVESTER_TRIGGER_THRESHOLD) {
          // Check if we can proceed with reduced threshold
          const { data: lastReplyAttemptData } = await supabaseClient
            .from('content_metadata')
            .select('posted_at, created_at')
            .eq('decision_type', 'reply')
            .in('status', ['posted', 'queued', 'ready'])
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          const lastReplyAttemptAt = lastReplyAttemptData?.created_at ? new Date(lastReplyAttemptData.created_at) : null;
          const minutesSinceLastAttempt = lastReplyAttemptAt ? (Date.now() - lastReplyAttemptAt.getTime()) / (1000 * 60) : 999;
          
          // Count replies posted in last hour
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
          const { count: repliesLastHour } = await supabaseClient
            .from('content_metadata')
            .select('*', { count: 'exact', head: true })
            .eq('decision_type', 'reply')
            .eq('status', 'posted')
            .gte('posted_at', oneHourAgo);
          
          const canProceedWithReducedThreshold = poolCount >= 1 && (
            minutesSinceLastAttempt >= 30 || 
            (repliesLastHour || 0) === 0
          );
          
          if (canProceedWithReducedThreshold) {
            console.log(`[REPLY_JOB] 🚀 DYNAMIC_THRESHOLD: Proceeding with reduced pool (${poolCount} < ${HARVESTER_TRIGGER_THRESHOLD})`);
            console.log(`[REPLY_JOB]   eligible_pool_size=${poolCount} threshold_used=1 reason=reduced_threshold_met`);
            console.log(`[REPLY_JOB]   minutes_since_last_attempt=${Math.round(minutesSinceLastAttempt)} replies_last_hour=${repliesLastHour || 0}`);
          } else {
            console.warn(`[REPLY_JOB] ⚠️ pool_still_low after_wait_ms=${finalWaitTime} pool=${poolCount} threshold=${HARVESTER_TRIGGER_THRESHOLD} action=exit`);
            console.log(`[REPLY_JOB]   eligible_pool_size=${poolCount} threshold_used=${HARVESTER_TRIGGER_THRESHOLD} reason=threshold_not_met`);
            console.log(`[REPLY_JOB]   minutes_since_last_attempt=${Math.round(minutesSinceLastAttempt)} replies_last_hour=${repliesLastHour || 0}`);
            return;
          }
        } else {
          console.log(`[REPLY_JOB] ✅ Pool threshold met: ${poolCount} >= ${HARVESTER_TRIGGER_THRESHOLD}`);
          console.log(`[REPLY_JOB]   eligible_pool_size=${poolCount} threshold_used=${HARVESTER_TRIGGER_THRESHOLD} reason=normal_threshold_met`);
        }
      } catch (error: any) {
        console.error('[REPLY_JOB] ❌ Harvester preflight failed:', error.message);
        console.log('[REPLY_JOB] ⚠️ Proceeding with available opportunities...');
      }
    } else {
      console.log(`[REPLY_JOB] ⏳ Skipping harvester trigger (cooldown ${Math.round(cooldownRemaining / 1000)}s remaining)`);
    }
  }
  
  // 🚀 SMART OPPORTUNITY SELECTION (tier-based, not replied to, not expired)
  console.log('[REPLY_JOB] 🔍 Selecting best reply opportunities (tier-based prioritization)...');
  
  // ✅ MEMORY OPTIMIZATION: Process opportunities in batches (prevents memory spikes)
  const { paginatedQuery, clearArrays } = await import('../utils/memoryOptimization');
  
  // Process opportunities in batches of 20 (memory-efficient)
  const allOpportunities: any[] = [];
  const batchSize = 20;
  let offset = 0;
  
  // 🎯 Phase 3: Join with discovered_accounts to get priority_score for sorting
  // 🔒 FRESHNESS GATE: Only consider tweets < 180 min old
  const MAX_AGE_MIN = 180;
  const freshnessThreshold = new Date(Date.now() - MAX_AGE_MIN * 60 * 1000).toISOString();
  
  while (true) {
    const { data: batch, error: oppError } = await supabaseClient
      .from('reply_opportunities')
      .select('*')
      .eq('replied_to', false)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      .gte('tweet_posted_at', freshnessThreshold) // 🔒 FRESH-ONLY: Max 180 min old
      .order('opportunity_score', { ascending: false }) // ✅ Phase 3: Sort by boosted opportunity_score
      .range(offset, offset + batchSize - 1);
    
    if (oppError) {
      console.error('[REPLY_JOB] ❌ Failed to query opportunities:', oppError.message);
      break;
    }
    
    if (!batch || batch.length === 0) {
      break; // No more opportunities
    }
    
    allOpportunities.push(...batch);
    offset += batchSize;
    
    // If we got fewer than batchSize, we're done
    if (batch.length < batchSize) {
      break;
    }
    
    // Small delay for GC
    await new Promise(r => setTimeout(r, 10));
  }
  
  if (allOpportunities.length === 0) {
    console.log('[REPLY_JOB] ⚠️ No opportunities in pool, waiting for harvester...');
    return;
  }
  
  console.log(`[REPLY_JOB] 📊 Loaded ${allOpportunities.length} opportunities in batches`);
  
  const normalizeTierCounts = (opps: Array<{ tier?: string | null }>) =>
    opps.reduce<Record<string, number>>((acc, opp) => {
    const key = String(opp.tier || '').toUpperCase();
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
    }, {});

  const tierCounts = normalizeTierCounts(allOpportunities);
  const countTiers = (counts: Record<string, number>, ...tiers: string[]) =>
    tiers.reduce((sum, tier) => sum + (counts[tier] || 0), 0);

  const megaCount = countTiers(tierCounts, 'MEGA+', 'MEGA', 'ULTRA', 'TITAN');
  const viralCount = countTiers(tierCounts, 'VIRAL+', 'VIRAL', 'SUPER', 'HIGH');
  const trendingCount = countTiers(tierCounts, 'TRENDING+', 'TRENDING', 'GOOD');
  const freshCount = countTiers(tierCounts, 'FRESH+', 'FRESH', 'GOLDEN', 'ACCEPTABLE');

  console.log(`[REPLY_JOB] 📊 Opportunity pool: ${allOpportunities.length} total`);
  if (megaCount + viralCount + trendingCount + freshCount > 0) {
    console.log(`[REPLY_JOB]   🏆 MEGA (50K+ likes): ${megaCount}`);
    console.log(`[REPLY_JOB]   🚀 VIRAL (10K+ likes): ${viralCount}`);
    console.log(`[REPLY_JOB]   📈 TRENDING (2K-10K likes): ${trendingCount}`);
    console.log(`[REPLY_JOB]   🔥 FRESH (500-2K likes): ${freshCount}`);
  }
  
  // 🔥 WATERFALL PRIORITY: Sort by tier → ABSOLUTE likes
  // Strategy: Prioritize HIGHEST engagement first (TITAN > ULTRA > MEGA > SUPER > HIGH)
  // Goal: Reply to biggest tweets possible to maximize exposure
  const tierPriority = [
    'MEGA+',
    'TITAN',
    'MEGA',
    'ULTRA',
    'VIRAL+',
    'SUPER',
    'VIRAL',
    'HIGH',
    'TRENDING+',
    'TRENDING',
    'FRESH+',
    'FRESH',
    'GOLDEN',
    'GOOD',
    'ACCEPTABLE'
  ];

  const tierRank = (tier: unknown) => {
    const key = String(tier || '').toUpperCase();
    const index = tierPriority.indexOf(key);
    return index === -1 ? tierPriority.length : index;
  };

  // 🎯 Phase 3: Enhanced sorting with priority_score
  // First, fetch priority scores for all target usernames
  const uniqueUsernames = [...new Set(allOpportunities.map(opp => String(opp.target_username || '').toLowerCase().trim()))];
  const priorityMap = new Map<string, number>();
  
  if (uniqueUsernames.length > 0) {
    const { data: accountData } = await supabaseClient
      .from('discovered_accounts')
      .select('username, priority_score')
      .in('username', uniqueUsernames);
    
    if (accountData) {
      accountData.forEach(acc => {
        priorityMap.set(acc.username.toLowerCase(), Number(acc.priority_score || 0));
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🚀 VELOCITY-FIRST CANDIDATE GATE
  // ═══════════════════════════════════════════════════════════════════════════
  // Strategy: Prioritize ACTIVE tweets (high velocity) over stale viral tweets
  // 
  // Age limits:
  // - PREFERRED: <= 360 min (6 hours) - reply window for maximum visibility
  // - HARD MAX: <= 720 min (12 hours) - only allow if velocity is EXTREME
  // 
  // Velocity = likes / max(age_minutes, 10)  
  // - EXTREME: >= 100 (e.g., 10K likes in 100 min)
  // - HIGH:    >= 30
  // - MEDIUM:  >= 10
  // - LOW:     < 10
  // ═══════════════════════════════════════════════════════════════════════════
  
  const PREFERRED_MAX_AGE_MIN = 360;  // 6 hours
  const HARD_MAX_AGE_MIN = 720;       // 12 hours
  const EXTREME_VELOCITY_THRESHOLD = 100;
  
  function calculateVelocity(likes: number, ageMin: number): number {
    return likes / Math.max(ageMin, 10);
  }
  
  function getVelocityTier(velocity: number): string {
    if (velocity >= 100) return 'EXTREME';
    if (velocity >= 30) return 'HIGH';
    if (velocity >= 10) return 'MEDIUM';
    return 'LOW';
  }
  
  function calculateRankingScore(opp: any): { score: number; velocity: number; ageMin: number } {
    const likes = Number(opp.like_count) || 0;
    const ageMin = Number(opp.posted_minutes_ago) || 360;
    const velocity = calculateVelocity(likes, ageMin);
    
    // Core ranking: velocity * log(likes) * freshness
    // Velocity is the PRIMARY signal (active engagement NOW)
    // Log(likes) normalizes for scale (100K vs 10K)
    // Freshness multiplier penalizes old tweets
    
    let freshnessMultiplier = 1.0;
    if (ageMin <= 60) freshnessMultiplier = 2.0;       // Very fresh
    else if (ageMin <= 120) freshnessMultiplier = 1.5; // Fresh
    else if (ageMin <= 240) freshnessMultiplier = 1.0; // OK
    else if (ageMin <= 360) freshnessMultiplier = 0.7; // Getting old
    else freshnessMultiplier = 0.3;                    // Stale
    
    // Health relevance boost
    const healthScore = Number(opp.health_relevance_score) || 0;
    const healthMultiplier = healthScore >= 7 ? 1.5 : healthScore >= 5 ? 1.2 : 1.0;
    
    // Account priority from discovered_accounts
    const username = String(opp.target_username || '').toLowerCase().trim();
    const accountPriority = priorityMap.get(username) || 0;
    const priorityMultiplier = 1 + (accountPriority * 0.3);
    
    // Final score: velocity-weighted ranking
    const score = velocity * Math.log10(likes + 1) * freshnessMultiplier * healthMultiplier * priorityMultiplier;
    
    return { score, velocity, ageMin };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CANDIDATE GATE: Filter opportunities by age + velocity
  // ═══════════════════════════════════════════════════════════════════════════
  const candidateGateResults: { kept: number; skipped_stale: number; skipped_low_velocity: number } = {
    kept: 0, skipped_stale: 0, skipped_low_velocity: 0
  };
  
  const gatedOpportunities = allOpportunities.filter(opp => {
    const tweetId = opp.target_tweet_id || opp.tweet_id || 'unknown';
    const likes = Number(opp.like_count) || 0;
    const ageMin = Number(opp.posted_minutes_ago) || 9999;
    const velocity = calculateVelocity(likes, ageMin);
    const velocityTier = getVelocityTier(velocity);
    
    // HARD MAX: Skip anything older than 12 hours unless EXTREME velocity
    if (ageMin > HARD_MAX_AGE_MIN) {
      if (velocity >= EXTREME_VELOCITY_THRESHOLD) {
        console.log(`[CANDIDATE_GATE] tweet_id=${tweetId} tier=EXCEPTION age_min=${Math.round(ageMin)} likes=${likes} velocity=${velocity.toFixed(1)} action=keep reason=extreme_velocity_override`);
        candidateGateResults.kept++;
        return true;
      }
      console.log(`[CANDIDATE_GATE] tweet_id=${tweetId} tier=STALE age_min=${Math.round(ageMin)} likes=${likes} velocity=${velocity.toFixed(1)} action=skip reason=exceeds_hard_max_12h`);
      candidateGateResults.skipped_stale++;
      return false;
    }
    
    // PREFERRED MAX: Warn but allow if velocity is at least MEDIUM
    if (ageMin > PREFERRED_MAX_AGE_MIN) {
      if (velocity >= 10) {
        console.log(`[CANDIDATE_GATE] tweet_id=${tweetId} tier=WARN age_min=${Math.round(ageMin)} likes=${likes} velocity=${velocity.toFixed(1)} action=keep reason=acceptable_velocity_${velocityTier}`);
        candidateGateResults.kept++;
        return true;
      }
      console.log(`[CANDIDATE_GATE] tweet_id=${tweetId} tier=STALE age_min=${Math.round(ageMin)} likes=${likes} velocity=${velocity.toFixed(1)} action=skip reason=stale_low_velocity`);
      candidateGateResults.skipped_low_velocity++;
      return false;
    }
    
    // Within preferred window - keep all
    console.log(`[CANDIDATE_GATE] tweet_id=${tweetId} tier=FRESH age_min=${Math.round(ageMin)} likes=${likes} velocity=${velocity.toFixed(1)} action=keep reason=within_preferred_window`);
    candidateGateResults.kept++;
    return true;
  });
  
  console.log(`[CANDIDATE_GATE] ═══════════════════════════════════════════════`);
  console.log(`[CANDIDATE_GATE] SUMMARY: kept=${candidateGateResults.kept} skipped_stale=${candidateGateResults.skipped_stale} skipped_low_velocity=${candidateGateResults.skipped_low_velocity}`);
  console.log(`[CANDIDATE_GATE] ═══════════════════════════════════════════════`);
  
  // Sort by ranking score (velocity-weighted)
  const sortedOpportunities = [...gatedOpportunities].sort((a, b) => {
    const aRank = calculateRankingScore(a);
    const bRank = calculateRankingScore(b);
    return bRank.score - aRank.score;
  });
  
  // Log top opportunities with velocity
  console.log('[REPLY_JOB] 🎯 TOP OPPORTUNITIES BY VELOCITY-WEIGHTED SCORE:');
  for (const opp of sortedOpportunities.slice(0, 5)) {
    const { score, velocity, ageMin } = calculateRankingScore(opp);
    const tier = getVelocityTier(velocity);
    console.log(`[REPLY_JOB]   📊 @${opp.target_username} likes=${opp.like_count} age=${Math.round(ageMin)}min velocity=${velocity.toFixed(1)} (${tier}) score=${Math.round(score)}`);
  }

  const candidateOpportunities = sortedOpportunities.slice(0, 40);
  
  // ✅ MEMORY OPTIMIZATION: Clear intermediate arrays after use
  // These arrays are no longer needed after creating candidateOpportunities
  clearArrays(gatedOpportunities, sortedOpportunities);

  // 🚨 CRITICAL FIX: Check for TWEET IDs we've already replied to (not just usernames!)
  // This prevents multiple replies to the same tweet
  const { data: alreadyRepliedTweets } = await supabaseClient
    .from('content_metadata')
    .select('target_tweet_id')
    .eq('decision_type', 'reply')
    .in('status', ['posted', 'queued', 'ready']);

  const repliedTweetIds = new Set(
    (alreadyRepliedTweets || [])
      .map(r => r.target_tweet_id)
      .filter(id => id)
  );

  console.log(`[REPLY_JOB] 🔒 Already replied to ${repliedTweetIds.size} unique tweets`);

  // 📊 DIAGNOSTIC COUNTERS - Track filter reasons
  let diagCounters = {
    total_candidates: candidateOpportunities.length,
    null_tweet_id: 0,
    already_replied: 0,
    is_reply_tweet: 0,
    low_followers: 0,
    low_likes: 0,
    kept: 0
  };

  const dbOpportunities = candidateOpportunities
    .filter(opp => {
      if (!opp.target_tweet_id) {
        diagCounters.null_tweet_id++;
        console.log(`[REPLY_JOB] ⚠️ Skipping opportunity with NULL tweet_id from @${opp.target_username}`);
        return false;
      }
      if (repliedTweetIds.has(opp.target_tweet_id)) {
        diagCounters.already_replied++;
        // Only log first few to avoid spam
        if (diagCounters.already_replied <= 3) {
          console.log(`[REPLY_JOB] ⏭️ Already replied to tweet ${opp.target_tweet_id} from @${opp.target_username}`);
        }
        return false;
      }
      
      // 🚨 CRITICAL FILTER 0: Never reply to reply tweets (only target original posts)
      // Reply tweets typically start with "@username" at the beginning
      const tweetContent = String(opp.target_tweet_content || '').trim();
      if (tweetContent.startsWith('@')) {
        diagCounters.is_reply_tweet++;
        if (diagCounters.is_reply_tweet <= 3) {
          console.log(`[REPLY_JOB] 🚫 SKIPPING REPLY TWEET from @${opp.target_username} (content starts with @, indicating it's a reply to someone else)`);
        }
        return false;
      }
      
      // 🔥 FILTER 1: Minimum follower threshold (RELAXED - velocity-aware)
      // Use tiered approach: prefer high-follower, but allow medium-follower with high velocity
      const MIN_FOLLOWERS_STRICT = parseInt(process.env.REPLY_MIN_FOLLOWERS || '5000'); // Relaxed from 10K
      const MIN_FOLLOWERS_RELAXED = 1000; // Fallback tier
      const followers = Number(opp.target_followers) || 0;
      const minutesAgo = Number(opp.posted_minutes_ago) || 9999;
      const likes = Number(opp.like_count) || 0;
      
      // Calculate velocity (likes per minute)
      const velocity = minutesAgo > 0 ? likes / minutesAgo : 0;
      
      // Tier 1: High velocity overrides follower count (viral potential)
      const highVelocity = velocity >= 50; // 50+ likes/min = viral
      
      // Tier 2: Medium follower + decent engagement
      const mediumFollowerOk = followers >= MIN_FOLLOWERS_RELAXED && likes >= 200;
      
      // Tier 3: High follower (original strict tier)
      const highFollowerOk = followers >= MIN_FOLLOWERS_STRICT;
      
      if (followers > 0 && !highVelocity && !mediumFollowerOk && !highFollowerOk) {
        diagCounters.low_followers++;
        if (diagCounters.low_followers <= 3) {
          console.log(`[REPLY_JOB] ⏭️ Skipping low-volume account @${opp.target_username} (${followers} followers, ${likes} likes, velocity=${velocity.toFixed(1)})`);
        }
        return false;
      }
      
      // 🎯 FILTER 2: Minimum tweet likes (RELAXED - velocity-aware)
      // Prefer high-engagement, but allow fresh high-velocity tweets
      const MIN_LIKES_STRICT = parseInt(process.env.REPLY_MIN_TWEET_LIKES || '500'); // Relaxed from 5K to 500
      const MIN_LIKES_FRESH = 100; // For very recent (<30min) tweets
      
      // Fresh + rising = acceptable
      const freshAndRising = minutesAgo <= 30 && likes >= MIN_LIKES_FRESH;
      
      // High engagement = acceptable
      const highEngagement = likes >= MIN_LIKES_STRICT;
      
      if (!freshAndRising && !highEngagement) {
        diagCounters.low_likes++;
        if (diagCounters.low_likes <= 3) {
          console.log(`[REPLY_JOB] ⏭️ Skipping low-engagement tweet from @${opp.target_username} (${likes} likes, ${minutesAgo}min ago, velocity=${velocity.toFixed(1)})`);
        }
        return false;
      }
      
      diagCounters.kept++;
      return true;
    })
    .slice(0, 10);
  
  // 📊 DIAGNOSTIC SUMMARY - Always print this
  console.log('[REPLY_DIAG] ═══════════════════════════════════════');
  console.log(`[REPLY_DIAG] fetched_from_db=${diagCounters.total_candidates}`);
  console.log(`[REPLY_DIAG] skipped_null_tweet_id=${diagCounters.null_tweet_id}`);
  console.log(`[REPLY_DIAG] skipped_already_replied=${diagCounters.already_replied}`);
  console.log(`[REPLY_DIAG] skipped_is_reply_tweet=${diagCounters.is_reply_tweet}`);
  console.log(`[REPLY_DIAG] skipped_low_followers=${diagCounters.low_followers} (min=10000)`);
  console.log(`[REPLY_DIAG] skipped_low_likes=${diagCounters.low_likes} (min=5000)`);
  console.log(`[REPLY_DIAG] kept_after_filters=${diagCounters.kept}`);
  console.log('[REPLY_DIAG] ═══════════════════════════════════════');
  
  if (dbOpportunities.length === 0) {
    console.log('[REPLY_JOB] ⚠️ No opportunities kept after filtering');
    return;
  }
  
  const selectedTierCounts = normalizeTierCounts(dbOpportunities);
  const selectionMega = countTiers(selectedTierCounts, 'MEGA+', 'MEGA', 'ULTRA', 'TITAN');
  const selectionViral = countTiers(selectedTierCounts, 'VIRAL+', 'VIRAL', 'SUPER', 'HIGH');
  const selectionTrending = countTiers(selectedTierCounts, 'TRENDING+', 'TRENDING', 'GOOD');
  const selectionFresh = countTiers(selectedTierCounts, 'FRESH+', 'FRESH', 'GOLDEN', 'ACCEPTABLE');
  
  console.log(`[REPLY_JOB] 🎯 Selected ${dbOpportunities.length} best opportunities (waterfall priority):`);
  if (dbOpportunities.length > 0) {
    console.log(`[REPLY_JOB]   🏆 MEGA: ${selectionMega} | 🚀 VIRAL: ${selectionViral} | 📈 TRENDING: ${selectionTrending} | 🔥 FRESH: ${selectionFresh}`);
  }
  console.log(`[REPLY_JOB]   Filtered out ${repliedTweetIds.size} already-replied tweets`);
  
  // Log average engagement
  const avgLikes = dbOpportunities.reduce((sum, opp) => sum + (Number(opp.like_count) || 0), 0) / Math.max(dbOpportunities.length, 1);
  console.log(`[REPLY_JOB]   📊 Average engagement: ${Math.round(avgLikes).toLocaleString()} likes per opportunity`);
  
  // Convert to the format expected by strategic reply system
  const opportunities = dbOpportunities.map((opp: any) => ({
    target: {
      username: String(opp.target_username || 'unknown'),
      followers: Number(opp.target_followers) || 50000,
      follower_overlap_score: 0.5,
      reply_window: 'early' as const,
      rising_potential: 0.7,
      conversion_potential: Number(opp.opportunity_score || 0) / 100,
      times_replied: 0,
      avg_engagement_on_replies: 0,
      avg_followers_gained: 0,
      actual_conversion_rate: 0,
      priority_score: Number(opp.opportunity_score || 0),
      handle: `@${String(opp.target_username || 'unknown')}`,
      engagement_rate: 0.05
    },
    tweet_url: String(opp.target_tweet_url || ''),
    tweet_content: String(opp.target_tweet_content || ''), // ✅ FIX: Use actual tweet content from DB!
    tweet_posted_at: opp.tweet_posted_at,
    minutes_since_post: Number(opp.posted_minutes_ago) || 0,
    reply_strategy: 'Add value with research or insights',
    estimated_followers: Math.round((Number(opp.opportunity_score || 0) / 100) * 10),
    // 🎯 CRITICAL: Pass through root tweet data from DB
    is_root_tweet: opp.is_root_tweet || false,
    is_reply_tweet: opp.is_reply_tweet || false,
    root_tweet_id: opp.root_tweet_id || null
  }));
  
  console.log(`[REPLY_JOB] ✅ Found ${opportunities.length} reply opportunities from database pool`);
  
  // ============================================================
  // 🎯 PHASE 2: ROOT TWEET RESOLUTION
  // ============================================================
  // CRITICAL: Resolve each candidate to its root tweet BEFORE generating replies
  // This ensures we reply to ORIGINAL posts, not replies
  console.log('[REPLY_JOB] 🔍 Resolving candidates to root tweets...');
  const { resolveReplyCandidate } = await import('./replyRootResolver');
  
  // 📊 ROOT RESOLUTION DIAGNOSTIC COUNTERS
  let rootDiagCounters = {
    before_resolution: opportunities.length,
    invalid_url: 0,
    skipped_is_reply_tweet: 0, // NEW: Hard block for reply tweets
    could_not_resolve: 0,
    kept_after_resolution: 0
  };
  
  const resolvedOpportunities: any[] = [];
  for (const opp of opportunities) {
    // Extract tweet ID from URL
    const tweetId = opp.tweet_url.split('/').pop() || '';
    if (!tweetId) {
      rootDiagCounters.invalid_url++;
      console.log(`[REPLY_JOB] ⚠️ Skipping opportunity with invalid URL: ${opp.tweet_url}`);
      continue;
    }
    
    // 🚨 HARD BLOCK: Skip if opportunity is marked as reply tweet
    if (opp.is_reply_tweet === true) {
      console.log(`[REPLY_SELECT] candidate=${tweetId} is_reply=true resolved_root=none action=skip reason=target_is_reply_tweet`);
      rootDiagCounters.skipped_is_reply_tweet++;
      continue;
    }
    
    // 🎯 OPTIMIZATION: If DB already has root_tweet_id and is_root_tweet=true, skip live resolution
    let resolved: any;
    if (opp.is_root_tweet === true && opp.root_tweet_id) {
      console.log(`[REPLY_SELECT] candidate=${tweetId} using_db_root=${opp.root_tweet_id} (is_root_tweet=true)`);
      resolved = {
        originalCandidateId: tweetId,
        rootTweetId: opp.root_tweet_id,
        rootTweetUrl: opp.tweet_url,
        rootTweetAuthor: opp.target?.username || null,
        rootTweetContent: opp.tweet_content,
        isRootTweet: true,
        shouldSkip: false
      };
    } else {
      // Fall back to live resolution
      resolved = await resolveReplyCandidate(tweetId, opp.tweet_content);
      if (!resolved) {
        rootDiagCounters.could_not_resolve++;
        console.log(`[REPLY_JOB] 🚫 Skipped candidate ${tweetId} (could not resolve or should skip)`);
        continue;
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🔒 ROOT-ONLY ENFORCEMENT (FAIL-CLOSED)
    // ═══════════════════════════════════════════════════════════════════════
    const rootId = resolved.rootTweetId;
    const isReplyTweet = !resolved.isRootTweet;
    const rootMatchesTarget = rootId === tweetId;
    
    // BLOCK if target is a reply (root != target)
    if (!rootMatchesTarget && !resolved.isRootTweet) {
      console.log(`[ROOT_ONLY] target=${tweetId} root=${rootId} is_reply=true pass=false reason=target_is_reply_resolves_to_different_root`);
      rootDiagCounters.skipped_is_reply_tweet++;
      continue;
    }
    
    // BLOCK if explicitly marked as reply tweet
    if (isReplyTweet) {
      console.log(`[ROOT_ONLY] target=${tweetId} root=${rootId} is_reply=true pass=false reason=is_reply_tweet_flag`);
      rootDiagCounters.skipped_is_reply_tweet++;
      continue;
    }
    
    // PASS - confirmed root tweet
    console.log(`[ROOT_ONLY] target=${tweetId} root=${rootId} is_reply=false pass=true reason=confirmed_root_tweet`);
    
    // Update opportunity with root data
    const resolvedOpp = {
      ...opp,
      original_candidate_tweet_id: resolved.originalCandidateId,
      root_tweet_id: resolved.rootTweetId,
      root_tweet_url: resolved.rootTweetUrl,
      resolved_via_root: !resolved.isRootTweet,
      // Use ROOT tweet content for context
      tweet_url: resolved.rootTweetUrl,
      tweet_content: resolved.rootTweetContent || opp.tweet_content,
      target: {
        ...opp.target,
        // Update author if different
        username: resolved.rootTweetAuthor || opp.target.username,
      }
    };
    
    rootDiagCounters.kept_after_resolution++;
    resolvedOpportunities.push(resolvedOpp);
  }
  
  // 📊 ROOT RESOLUTION SUMMARY
  console.log('[REPLY_DIAG] ═══════════════════════════════════════');
  console.log(`[REPLY_DIAG] before_root_resolution=${rootDiagCounters.before_resolution}`);
  console.log(`[REPLY_DIAG] skipped_invalid_url=${rootDiagCounters.invalid_url}`);
  console.log(`[REPLY_DIAG] skipped_is_reply_tweet=${rootDiagCounters.skipped_is_reply_tweet}`);
  console.log(`[REPLY_DIAG] skipped_could_not_resolve=${rootDiagCounters.could_not_resolve}`);
  console.log(`[REPLY_DIAG] kept_after_root_resolution=${rootDiagCounters.kept_after_resolution}`);
  console.log('[REPLY_DIAG] ═══════════════════════════════════════');
  
  // Replace opportunities with resolved ones
  const opportunitiesBeforeResolution = opportunities.length;
  opportunities.length = 0; // Clear array
  opportunities.push(...resolvedOpportunities); // Replace with resolved
  
  if (opportunities.length === 0) {
    console.log('[REPLY_JOB] ⚠️ No opportunities after root resolution');
    return;
  }
  
  // ============================================================
  // SMART BATCH GENERATION: 5 REPLIES PER CYCLE
  // ============================================================
  // Job runs every 30 min (2 runs/hour)
  // Generate 5 per run = 10 attempts/hour
  // With ~42% success rate = ~4 posted replies/hour = ~100/day
  const TARGET_REPLIES_PER_CYCLE = targetRepliesThisCycle;
  const availableOpportunities = opportunities.length;
  
  // How many can we actually generate?
  const replyCount = Math.min(TARGET_REPLIES_PER_CYCLE, availableOpportunities);
  
  console.log(`[REPLY_JOB] 🎯 Batch Generation:`);
  console.log(`  • Target: ${TARGET_REPLIES_PER_CYCLE} replies per cycle`);
  console.log(`  • Available opportunities: ${availableOpportunities}`);
  console.log(`  • Will generate: ${replyCount} replies`);
  
  if (replyCount < TARGET_REPLIES_PER_CYCLE) {
    console.warn(`[REPLY_JOB] ⚠️ DEFICIT: Only ${replyCount}/${TARGET_REPLIES_PER_CYCLE} replies possible`);
    console.warn(`[REPLY_JOB] 💡 SLA MISS: Need ${TARGET_REPLIES_PER_CYCLE - replyCount} more opportunities`);
    ReplyDiagnosticLogger.logSlaMiss({
      expected: TARGET_REPLIES_PER_CYCLE,
      actual: replyCount,
      deficit: TARGET_REPLIES_PER_CYCLE - replyCount,
      reason: 'insufficient_opportunities'
    });
  }
  
  if (replyCount === 0) {
    console.log('[REPLY_JOB] ⚠️ No opportunities available to generate replies for');
    return;
  }
  
  for (let i = 0; i < opportunities.slice(0, replyCount).length; i++) {
    const opportunity = opportunities[i];
    const target = {
      account: {
        username: opportunity.target.username,
        category: 'health',
        followers: opportunity.target.followers,
        engagement_velocity: 'high' as const
      },
      tweet_url: opportunity.tweet_url || '',
      tweet_content: opportunity.tweet_content || '', // ✅ FIX: Pass actual tweet content to AI!
      estimated_reach: opportunity.estimated_followers || 0,
      reply_angle: opportunity.reply_strategy
    };
    try {
      // Pick a reply-appropriate generator (intelligent matching with learning)
      const replyGenerator = await selectReplyGenerator(target.account.category, target.account.username);
      console.log(`[REPLY_JOB] 🎭 Using ${replyGenerator} for reply to @${target.account.username} (${target.account.category})`);
      
      // ═══════════════════════════════════════════════════════════
      // 🚀 PHASE 4 ROUTING: Conditionally use orchestratorRouter for replies
      // ═══════════════════════════════════════════════════════════
      const { shouldUsePhase4Routing, routeContentGeneration } = await import('../ai/orchestratorRouter');
      const usePhase4Routing = shouldUsePhase4Routing();
      
      // Get priority_score from discovered_accounts if available
      let priorityScore: number | null = null;
      if (target.account.username) {
        try {
          const { getSupabaseClient } = await import('../db');
          const supabase = getSupabaseClient();
          const { data: account } = await supabase
            .from('discovered_accounts')
            .select('priority_score')
            .eq('username', target.account.username.toLowerCase())
            .maybeSingle();
          
          if (account && account.priority_score !== null) {
            priorityScore = account.priority_score;
            console.log(`[PHASE4][REPLY_JOB] Found priority_score=${priorityScore} for @${target.account.username}`);
          }
        } catch (error: any) {
          console.warn(`[PHASE4][REPLY_JOB] Failed to fetch priority_score:`, error.message);
        }
      }
      
      // 🔥 NEW: Generate reply using ACTUAL selected generator (with fallback)
      // 🎯 ENHANCED: Try relationship reply system first (follower-focused), then generator, then strategic
      let strategicReply;
      
      // 🔥 NEW: Generate reply using ACTUAL selected generator (with fallback)
      // 🎯 ENHANCED: Try relationship reply system first (follower-focused), then generator, then strategic
      
      // ═══════════════════════════════════════════════════════════
      // 🚀 PHASE 4: Route replies through orchestratorRouter when enabled
      // ═══════════════════════════════════════════════════════════
      if (usePhase4Routing) {
      // Extract tweet ID from URL first
      const tweetUrlStr = String(target.tweet_url || '');
      const tweetIdFromUrl = tweetUrlStr.split('/').pop() || 'unknown';
        
        // ═══════════════════════════════════════════════════════════════════════
        // 🔒 CONTEXT INPUT GATE (FAIL-CLOSED)
        // ═══════════════════════════════════════════════════════════════════════
        const parentText = target.tweet_content;
        const rootId = opportunity.root_tweet_id || tweetIdFromUrl;
        const MIN_CONTEXT_LENGTH = 40; // Minimum meaningful context
        
        // BLOCK: No text at all
        if (!parentText || typeof parentText !== 'string') {
          console.log(`[CONTEXT_INPUT] target_id=${tweetIdFromUrl} root_id=${rootId} text_len=0 pass=false reason=missing_target_text`);
          continue;
        }
        
        // BLOCK: Text too short
        const trimmedText = parentText.trim();
        if (trimmedText.length < MIN_CONTEXT_LENGTH) {
          console.log(`[CONTEXT_INPUT] target_id=${tweetIdFromUrl} root_id=${rootId} text_len=${trimmedText.length} pass=false reason=text_too_short_min_${MIN_CONTEXT_LENGTH}`);
          continue;
        }
        
        console.log(`[CONTEXT_INPUT] target_id=${tweetIdFromUrl} root_id=${rootId} text_len=${trimmedText.length} pass=true`);
        
        const { extractKeywords } = await import('../gates/ReplyQualityGate');
        const keywords = extractKeywords(parentText);
        
        // ✅ KEYWORD VALIDATION: Skip if no meaningful keywords
        if (keywords.length === 0) {
          console.log(`[REPLY_SKIP] target_id=${tweetIdFromUrl} reason=no_keywords`);
          continue; // Skip this opportunity
        }
        
        // Log context
        const parentExcerpt = parentText.substring(0, 80) + (parentText.length > 80 ? '...' : '');
        console.log(`[REPLY_CONTEXT] ok=true parent_id=${tweetIdFromUrl} keywords=${keywords.join(', ')} content_length=${parentText.length}`);
        console.log(`[REPLY_CONTEXT] parent_excerpt="${parentExcerpt}"`);
        
        // 🔁 RETRY LOOP: Generate reply with quality gate (max 2 attempts)
        const MAX_GENERATION_ATTEMPTS = 2;
        let generationAttempt = 0;
        
        while (generationAttempt < MAX_GENERATION_ATTEMPTS && !strategicReply) {
          generationAttempt++;
          
          try {
            console.log(`[PHASE4][Router][Reply] attempt=${generationAttempt}/${MAX_GENERATION_ATTEMPTS} decisionType=reply slot=reply priority=${priorityScore || 'N/A'}`);
            
            // Extract topic/angle from tweet content for router
            const replyTopic = target.reply_angle || target.account.category || 'health';
            const replyAngle = 'reply_context'; // Default angle for replies
            const replyTone = 'helpful'; // Default tone for replies
            
            // 🔥 CRITICAL: Build explicit contextual reply prompt (UPGRADED FOR QUALITY)
            const templateChoice = Math.floor(Math.random() * 3);
            const templates = [
              'AGREE + ADD: Echo their point, add mechanism/data, end with hook',
              'NUANCE + ADD: Respectful correction, one key fact, end with hook',
              'MINI-PLAYBOOK: 2-step suggestion, end with hook'
            ];
            const chosenTemplate = templates[templateChoice];
            
            const explicitReplyPrompt = `You are replying to this tweet:

ROOT_TWEET_TEXT: "${parentText}"
AUTHOR: @${target.account.username}
KEY_TOPICS: ${keywords.join(', ')}

YOUR REPLY MUST FOLLOW THIS TEMPLATE: ${chosenTemplate}

CRITICAL REQUIREMENTS:
1. **ECHO FIRST**: First sentence must paraphrase their claim. Use patterns like:
   - "You're basically saying X..."
   - "That point about X is spot on"
   - "Right — the key here is X"
   - "Makes sense — when you consider X"

2. **LENGTH**: 1-3 short lines, max 220 chars total

3. **ADD VALUE**: One practical insight, mechanism, or stat (not generic advice)

4. **END WITH HOOK**: Question OR "try this" suggestion (drive engagement)

HARD BANS:
- NO "Studies show" / "Research suggests" unless naming the study
- NO generic "improves health" endings
- NO medical disclaimers or lectures
- NO thread markers (1/, 🧵, Part, continued)
- NO multi-paragraph responses
- NO bullet lists

GOOD EXAMPLES:
- "That cortisol spike makes sense — happens when blood sugar crashes after refined carbs. Have you tried protein + fat instead?"
- "Right, fiber feeds gut bacteria → they produce butyrate → reduces inflammation. Takes 2-3 weeks to see effects though."
- "Makes sense. Two-step fix: 1) Cut seed oils, 2) Add omega-3s daily. Which one would be easier for you?"

BAD EXAMPLES:
- "Research shows fiber is important for gut health..." (generic, no echo)
- "Interestingly, I've noticed..." (about you, not them)
- "1/ Let me explain why this matters..." (thread marker)

Reply (1-3 lines, echo their point first):`;
            
            // Route through orchestratorRouter for generator-based replies
            const routerResponse = await routeContentGeneration({
              decision_type: 'reply',
              content_slot: 'reply',
              topic: replyTopic,
              angle: replyAngle,
              tone: replyTone,
              priority_score: priorityScore,
              target_username: target.account.username,
              target_tweet_content: parentText,
              generator_name: replyGenerator
            });
            
            // Extract content (handle array if returned)
            let replyContent = routerResponse.text;
            if (Array.isArray(replyContent)) {
              replyContent = replyContent[0]; // Take first element
            }
            
            // 🔥 QUALITY GATE 1: Validate reply quality (fail-closed)
            const { checkReplyQuality } = await import('../gates/ReplyQualityGate');
            const qualityCheck = checkReplyQuality(replyContent, parentText, generationAttempt);
            
            if (!qualityCheck.passed) {
              // Quality gate failed
              console.warn(`[PHASE4][Router][Reply] Quality gate failed: ${qualityCheck.reason}, issues: ${qualityCheck.issues.join(', ')}`);
              
              if (generationAttempt >= MAX_GENERATION_ATTEMPTS) {
                console.error(`[REPLY_JOB] ⛔ Reply quality gate failed after ${MAX_GENERATION_ATTEMPTS} attempts, skipping decision`);
                continue; // Skip this opportunity entirely
              }
              
              // Try again with next attempt
              console.log(`[PHASE4][Router][Reply] Retrying generation (attempt ${generationAttempt + 1}/${MAX_GENERATION_ATTEMPTS})...`);
              await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay before retry
              continue;
            }
            
            // 🔒 QUALITY GATE 2: Format Guard (single tweet, no thread markers)
            const { checkReplyFormat, collapseLineBreaks } = await import('../gates/replyFormatGuard');
            let formatCheck = checkReplyFormat(replyContent);
            
            if (!formatCheck.pass && formatCheck.action === 'regen' && generationAttempt < MAX_GENERATION_ATTEMPTS) {
              console.warn(`[REPLY_FORMAT] Failed format check: ${formatCheck.reason}, regenerating...`);
              await new Promise(resolve => setTimeout(resolve, 500));
              continue; // Retry generation
            } else if (!formatCheck.pass && formatCheck.action === 'skip') {
              console.error(`[REPLY_FORMAT] Format check failed permanently: ${formatCheck.reason}, skipping`);
              continue; // Skip this opportunity
            } else if (formatCheck.stats.lineBreaks > 2) {
              // Attempt to collapse line breaks
              const collapsed = collapseLineBreaks(replyContent);
              const recheck = checkReplyFormat(collapsed);
              if (recheck.pass) {
                replyContent = collapsed;
                console.log(`[REPLY_FORMAT] ✅ Collapsed line breaks: ${formatCheck.stats.lineBreaks} → ${recheck.stats.lineBreaks}`);
                formatCheck = recheck;
              }
            }
            
            // 🎯 QUALITY GATE 3: Context Anchor (must reference root tweet)
            const { checkContextAnchor, extractKeywords, buildAnchorRegenerationInstruction } = await import('../gates/contextAnchorGuard');
            const anchorCheck = checkContextAnchor(replyContent, parentText);
            
            if (!anchorCheck.pass && anchorCheck.action === 'regen' && generationAttempt < MAX_GENERATION_ATTEMPTS) {
              console.warn(`[REPLY_ANCHOR] Failed anchor check, regenerating with stricter instruction...`);
              
              // Add stricter instruction for next attempt
              const anchorInstruction = buildAnchorRegenerationInstruction(parentText, extractKeywords(parentText));
              console.log(`[REPLY_ANCHOR] Regen instruction: ${anchorInstruction}`);
              
              await new Promise(resolve => setTimeout(resolve, 500));
              continue; // Retry generation
            } else if (!anchorCheck.pass) {
              console.error(`[REPLY_ANCHOR] Anchor check failed permanently, skipping`);
              continue; // Skip this opportunity
            }
            
            // ✅ ALL GATES PASSED - Use this reply
            strategicReply = {
              content: replyContent,
              provides_value: true,
              adds_insight: true,
              not_spam: true,
              confidence: priorityScore && priorityScore >= 0.8 ? 0.9 : 0.7,
              visualFormat: routerResponse.visual_format || 'paragraph'
            };
            
            console.log(`[PHASE4][Router][Reply] ✅ All gates passed - Reply routed through orchestratorRouter (generator: ${routerResponse.generator_used})`);
            console.log(`[PHASE4][Router][Reply] ✅ Format: len=${formatCheck.stats.length} lines=${formatCheck.stats.lineBreaks} context_matched=${anchorCheck.matched.join(',') || 'lenient_pass'}`);
            
          } catch (routerError: any) {
            console.warn(`[PHASE4][Router][Reply] Router failed (attempt ${generationAttempt}):`, routerError.message);
            if (generationAttempt >= MAX_GENERATION_ATTEMPTS) {
              console.error(`[REPLY_JOB] ⛔ Router failed after ${MAX_GENERATION_ATTEMPTS} attempts, falling back to existing systems`);
              // Fall through to existing reply generation
              break;
            }
          }
        }
      }
      
      // If Phase 4 routing didn't produce a reply, use existing systems
      if (!strategicReply) {
      try {
        // Try relationship reply system first (optimized for follower conversion)
        const { RelationshipReplySystem } = await import('../growth/relationshipReplySystem');
        const relationshipSystem = RelationshipReplySystem.getInstance();
        
        // Extract tweet ID from URL for relationship system
        const tweetUrlStr = String(target.tweet_url || '');
        const tweetIdFromUrl = tweetUrlStr.split('/').pop() || 'unknown';
        
        const relationshipReply = await relationshipSystem.generateRelationshipReply({
          tweet_id: tweetIdFromUrl,
          username: target.account.username,
          content: target.tweet_content || '',
          likes: 0, // Will be filled from opportunity if available
          replies: 0,
          posted_at: new Date().toISOString(),
        });
        
        // Convert relationship reply format to strategic reply format
        strategicReply = {
          content: relationshipReply.reply,
          provides_value: true, // Relationship replies always provide value
          adds_insight: relationshipReply.strategy === 'value_first' || relationshipReply.strategy === 'controversy',
          not_spam: true, // Relationship replies are never spam
          confidence: relationshipReply.expectedConversion === 'high' ? 0.9 : 
                     relationshipReply.expectedConversion === 'medium' ? 0.7 : 0.5,
          visualFormat: 'paragraph' as const
        };
        
        console.log(`[REPLY_JOB] ✅ Relationship reply generated (strategy: ${relationshipReply.strategy}, conversion: ${relationshipReply.expectedConversion})`);
        
      } catch (relationshipError: any) {
        console.warn(`[REPLY_JOB] ⚠️ Relationship reply system failed, trying fallback:`, relationshipError.message);
        
        // ✅ P0 FIX: Don't fall back to regular generators (they produce standalone posts, not contextual replies)
        // If Phase 4 and Relationship systems both failed, use strategic fallback only
        try {
          if (!usePhase4Routing) {
            console.log(`[REPLY_JOB] ⚠️ Phase 4 routing disabled and relationship system failed, using strategic fallback`);
          }
          strategicReply = await strategicReplySystem.generateStrategicReply(target);
          console.log(`[REPLY_JOB] ✅ Strategic fallback succeeded`);
        } catch (generatorError: any) {
          console.warn(`[REPLY_JOB] ❌ Strategic fallback also failed:`, generatorError.message);
          // All systems failed - skip this opportunity
          }
        }
      }
      
      // Validate quality
      if (!strategicReply.provides_value || !strategicReply.not_spam) {
        console.log(`[REPLY_JOB] ⚠️ Reply quality too low (value: ${strategicReply.provides_value}, not_spam: ${strategicReply.not_spam})`);
        continue;
      }
      
      const decision_id = uuidv4();
      
      // ═══════════════════════════════════════════════════════════════════════
      // 🔒 NEW: CONTEXT LOCK - Create snapshot of target tweet text
      // ═══════════════════════════════════════════════════════════════════════
      const { createContextSnapshot } = await import('../gates/contextLockGuard');
      
      // Extract tweet ID from URL
      const tweetUrlStr = String(target.tweet_url || '');
      const tweetIdFromUrl = tweetUrlStr.split('/').pop() || 'unknown';
      
      let contextSnapshot;
      try {
        // Validate we have tweet content before creating snapshot
        if (!target.tweet_content || target.tweet_content.trim().length < 20) {
          console.log(`[CONTEXT_LOCK] ⛔ Skipping - no meaningful content for ${tweetIdFromUrl} (len=${(target.tweet_content || '').length})`);
          continue;
        }
        
        contextSnapshot = await createContextSnapshot(
          tweetIdFromUrl,
          target.tweet_content,
          target.account.username
        );
        console.log(`[CONTEXT_LOCK] ✅ Snapshot created for ${tweetIdFromUrl} hash=${contextSnapshot.target_tweet_text_hash.substring(0, 8)}...`);
      } catch (snapshotError: any) {
        console.error(`[CONTEXT_LOCK] ❌ Failed to create snapshot: ${snapshotError.message}`);
        continue;
      }
      
      // ═══════════════════════════════════════════════════════════════════════
      // 🧠 NEW: SEMANTIC GATE - Verify reply is related to target tweet
      // ═══════════════════════════════════════════════════════════════════════
      const { checkSemanticGate } = await import('../gates/semanticGate');
      
      const semanticResult = await checkSemanticGate(
        contextSnapshot.target_tweet_text,
        strategicReply.content
      );
      
      if (!semanticResult.pass) {
        console.log(`[SEMANTIC_GATE] ⛔ Blocked decision_id=${decision_id} reason=${semanticResult.reason} similarity=${(semanticResult.similarity * 100).toFixed(1)}%`);
        console.log(`[SEMANTIC_GATE]   Target: "${semanticResult.target_preview}..."`);
        console.log(`[SEMANTIC_GATE]   Reply:  "${semanticResult.reply_preview}..."`);
        
        // Store blocked decision for monitoring
        try {
          await supabaseClient.from('content_generation_metadata_comprehensive').insert({
            decision_id,
            decision_type: 'reply',
            content: strategicReply.content,
            target_tweet_id: tweetIdFromUrl,
            target_username: target.account.username,
            target_tweet_content_snapshot: contextSnapshot.target_tweet_text,
            target_tweet_content_hash: contextSnapshot.target_tweet_text_hash,
            root_tweet_id: opportunity.root_tweet_id || null,
            status: 'blocked',
            skip_reason: semanticResult.reason,
            semantic_similarity: semanticResult.similarity,
            generator_name: replyGenerator,
            pipeline_source: 'replyJobEnhanced',
            build_sha: process.env.RAILWAY_GIT_COMMIT_SHA || `local-${Date.now()}`,
            created_at: new Date().toISOString()
          });
        } catch (insertError: any) {
          console.warn(`[SEMANTIC_GATE] ⚠️ Failed to store blocked decision: ${insertError.message}`);
        }
        
        continue; // Skip this opportunity
      }
      
      console.log(`[SEMANTIC_GATE] ✅ Pass decision_id=${decision_id} similarity=${(semanticResult.similarity * 100).toFixed(1)}%`);
      
      // ═══════════════════════════════════════════════════════════════════════
      // 🚫 NEW: ANTI-SPAM GATE - Prevent duplicate replies
      // ═══════════════════════════════════════════════════════════════════════
      const { checkAntiSpam } = await import('../gates/antiSpamGuard');
      
      const antiSpamResult = await checkAntiSpam(
        opportunity.root_tweet_id || null,
        tweetIdFromUrl,
        target.account.username
      );
      
      if (!antiSpamResult.pass) {
        console.log(`[ANTI_SPAM] ⛔ Blocked decision_id=${decision_id} reason=${antiSpamResult.reason}`);
        if (antiSpamResult.cooldown_remaining_minutes) {
          console.log(`[ANTI_SPAM]   Cooldown: ${antiSpamResult.cooldown_remaining_minutes}min remaining`);
        }
        
        // Store blocked decision for monitoring
        try {
          await supabaseClient.from('content_generation_metadata_comprehensive').insert({
            decision_id,
            decision_type: 'reply',
            content: strategicReply.content,
            target_tweet_id: tweetIdFromUrl,
            target_username: target.account.username,
            target_tweet_content_snapshot: contextSnapshot.target_tweet_text,
            target_tweet_content_hash: contextSnapshot.target_tweet_text_hash,
            root_tweet_id: opportunity.root_tweet_id || null,
            status: 'blocked',
            skip_reason: antiSpamResult.reason,
            semantic_similarity: semanticResult.similarity,
            anti_spam_checks: antiSpamResult,
            generator_name: replyGenerator,
            created_at: new Date().toISOString()
          });
        } catch (insertError: any) {
          console.warn(`[ANTI_SPAM] ⚠️ Failed to store blocked decision: ${insertError.message}`);
        }
        
        continue; // Skip this opportunity
      }
      
      console.log(`[ANTI_SPAM] ✅ Pass decision_id=${decision_id} reason=${antiSpamResult.reason}`);
      // ═══════════════════════════════════════════════════════════════════════
      
      // Run gate chain
      const gateResult = await runGateChain(strategicReply.content, decision_id);
      
      if (!gateResult.passed) {
        console.log(`[GATE_CHAIN] ⛔ Blocked (${gateResult.gate}) decision_id=${decision_id}, reason=${gateResult.reason}`);
        continue;
      }
      
      // ============================================================
      // SMART SCHEDULING: 5 min and 20 min spacing
      // ============================================================
      // Reply 0: NOW + 5 min
      // Reply 1: NOW + 20 min
      // Next cycle (30 min later) will schedule at +35 min and +50 min
      // Result: 4 replies/hour at 0:05, 0:20, 0:35, 0:50
      const smartDelays = [5, 20]; // Minutes from NOW
      const staggerDelay = smartDelays[i] || (5 + i * 15); // Fallback for >2 replies
      
      const reply = {
        decision_id,
        content: strategicReply.content,
        target_username: target.account.username,
        target_tweet_id: tweetIdFromUrl,
        target_tweet_content: target.tweet_content,
        target_tweet_content_snapshot: contextSnapshot.target_tweet_text,
        target_tweet_content_hash: contextSnapshot.target_tweet_text_hash,
        semantic_similarity: semanticResult.similarity,
        generator_used: replyGenerator,
        estimated_reach: target.estimated_reach,
        tweet_url: tweetUrlStr,
        scheduled_at: new Date(Date.now() + staggerDelay * 60 * 1000).toISOString(),
        visual_format: strategicReply.visualFormat || null,
        topic: target.reply_angle || target.account.category || 'health',
        
        // 🎯 PHASE 2: Root resolution data from opportunity
        root_tweet_id: opportunity.root_tweet_id || null,
        // original_candidate_tweet_id: opportunity.original_candidate_tweet_id || null, // REMOVED: column doesn't exist in prod schema
        // resolved_via_root: opportunity.resolved_via_root || false // REMOVED: column doesn't exist in prod schema
      };
      
      // ============================================================
      // VISUAL FORMATTING: Apply AI formatter before queueing
      // ============================================================
      const formatterContext = {
        content: reply.content,
        generator: String(reply.generator_used || 'reply_specialist'),
        topic: String(reply.topic || target.account.category || 'health'),
        angle: String(target.reply_angle || 'value_add_reply'),
        tone: 'engaging_reply',
        formatStrategy: 'reply_value_add'
      };
      
      try {
        const formatResult = await formatContentForTwitter(formatterContext);
        
        // 🔥 CRITICAL: Validate formatter output BEFORE using it
        const { checkReplyQuality } = await import('../gates/ReplyQualityGate');
        const formattedQualityCheck = checkReplyQuality(formatResult.formatted, target.tweet_content || '', 0);
        
        if (formattedQualityCheck.passed) {
        reply.content = formatResult.formatted;
        reply.visual_format = formatResult.visualApproach;
        console.log(`[REPLY_JOB] 🎨 Visual format applied: ${formatResult.visualApproach}`);
        } else {
          // Formatter corrupted the content - use original
          console.warn(`[REPLY_JOB] ⚠️ Visual formatter output failed quality gate: ${formattedQualityCheck.reason}`);
          console.warn(`[REPLY_JOB] ⚠️ Keeping original content instead`);
        }
      } catch (formatError: any) {
        console.warn(`[REPLY_JOB] ⚠️ Visual formatter failed, using original reply: ${formatError.message}`);
      }
      
      // ============================================================
      // 🚧 PHASE 1: KIND GUARD - Lane separation (reply vs thread)
      // ============================================================
      const { checkReplyKindGuard } = await import('../gates/replyKindGuard');
      const kindCheck = checkReplyKindGuard(
        reply.content,
        reply.target_tweet_id,
        'reply' // Replies are always kind="reply"
      );
      
      if (!kindCheck.pass) {
        console.error(`[REPLY_KIND_GUARD] ❌ FAIL_CLOSED: ${kindCheck.reason}`);
        console.error(`[REPLY_KIND_GUARD] Content: "${reply.content.substring(0, 100)}..."`);
        continue; // Skip this reply
      }
      
      // ============================================================
      // 🎯 PHASE 2: TARGET GUARD - Root-only + freshness + context
      // ============================================================
      const { checkReplyTargetGuard } = await import('../gates/replyTargetGuard');
      const targetCheck = checkReplyTargetGuard(
        reply.target_tweet_id,
        opportunity.tweet_content || '',
        opportunity.tweet_posted_at || null,
        opportunity.is_reply_tweet || null
      );
      
      if (!targetCheck.pass) {
        console.error(`[REPLY_TARGET_GUARD] ❌ FAIL_CLOSED: ${targetCheck.reason}`);
        continue; // Skip this reply
      }
      
      // ============================================================
      // 🔒 OUTPUT CONTRACT: Final validation before queueing
      // ============================================================
      const { validateReplyContract, hashContent } = await import('../gates/replyOutputContract');
      const contractCheck = validateReplyContract(reply.content);
      
      if (!contractCheck.pass) {
        console.error(`[REPLY_QUALITY] fail_closed reason=${contractCheck.reason} content_hash=${hashContent(reply.content)}`);
        console.error(`[REPLY_QUALITY] Content: "${reply.content.substring(0, 100)}..."`);
        
        // If sanitization worked, use it
        if (contractCheck.sanitized) {
          reply.content = contractCheck.sanitized;
          console.log(`[REPLY_QUALITY] sanitize_success using_sanitized len=${contractCheck.sanitized.length}`);
        } else {
          // Skip this reply
          console.error(`[REPLY_QUALITY] action=skip target=@${target.account.username}`);
          continue;
        }
      }
      
      // 🎯 REPLY_TARGET LOG: Prove we're posting to ROOT tweets
      const targetTweetId = reply.target_tweet_id;
      const rootId = opportunity.root_tweet_id || targetTweetId;
      console.log(`[REPLY_TARGET] posting_to=${targetTweetId} (must_be_root) root=${rootId} author=@${target.account.username}`);
      
      // Queue for posting with smart spacing
      await queueReply(reply, staggerDelay);
      
      const scheduledTime = new Date(Date.now() + staggerDelay * 60 * 1000);
      console.log(`[REPLY_JOB] ✅ Reply queued (#${i+1}/${replyCount}):`);
      console.log(`  • Target: @${target.account.username}`);
      console.log(`  • Followers: ${target.account.followers.toLocaleString()}`);
      console.log(`  • Estimated reach: ${target.estimated_reach.toLocaleString()}`);
      console.log(`  • Generator: ${replyGenerator}`);
      console.log(`  • Scheduled: ${scheduledTime.toLocaleTimeString()} (in ${staggerDelay} min)`);
      console.log(`  • Content preview: "${strategicReply.content.substring(0, 60)}..."`);
      
      // Log to SLA tracker
      ReplyDiagnosticLogger.logReplyScheduled({
        decision_id,
        scheduled_at: scheduledTime,
        delay_minutes: staggerDelay,
        target: target.account.username,
        generator: replyGenerator
      });
      
      // Mark opportunity as replied in database
      await supabaseClient
        .from('reply_opportunities')
        .update({ 
          replied_to: true,
          reply_decision_id: decision_id,
          status: 'replied'
        })
        .eq('target_tweet_id', reply.target_tweet_id);
      
    } catch (error: any) {
      replyLLMMetrics.calls_failed++;
      const errorType = categorizeError(error);
      replyLLMMetrics.failure_reasons[errorType] = (replyLLMMetrics.failure_reasons[errorType] || 0) + 1;
      
      console.error(`[REPLY_JOB] ❌ Reply generation failed: ${error.message}`);
      
      if (errorType === 'insufficient_quota') {
        console.log('[REPLY_JOB] ⚠️ OpenAI quota exhausted - skipping remaining replies');
        break; // Exit loop if quota exhausted
      }
    }
  }
  
  // ============================================================
  // FINAL SUMMARY & SLA TRACKING
  // ============================================================
  const supabase = getSupabaseClient();
  const { count } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .is('posted_at', null);
  
  console.log(`\n[REPLY_JOB] 📊 CYCLE COMPLETE - SLA SUMMARY:`);
  console.log(`  • Expected: ${TARGET_REPLIES_PER_CYCLE} replies per cycle`);
  console.log(`  • Generated: ${replyCount} replies`);
  console.log(`  • SLA Status: ${replyCount >= TARGET_REPLIES_PER_CYCLE ? '✅ MET' : '⚠️ MISSED'}`);
  console.log(`  • Queue depth: ${count || 0} replies waiting`);
  console.log(`  • Next cycle: 30 minutes (will generate ${TARGET_REPLIES_PER_CYCLE} more)`);
  console.log(`  • Target rate: 10 attempts/hour → ~4 posted/hour (${TARGET_REPLIES_PER_CYCLE} per 30-min cycle)\n`);
}

/**
 * Select generator appropriate for replies - INTELLIGENT MATCHING
 * Matches generator to tweet category for maximum value addition
 */
async function selectReplyGenerator(category: string, target_account: string): Promise<GeneratorType> {
  // 🧠 PHASE 3: SMART GENERATOR SELECTION BASED ON LEARNING DATA
  // Query historical performance for this specific account
  try {
    const supabase = getSupabaseClient();
    
    // Get last 5 replies to this account
    const { data: accountHistory, error } = await supabase
      .from('content_metadata')
      .select(`
        decision_id,
        metadata
      `)
      .eq('decision_type', 'reply')
      .eq('status', 'posted')
      .eq('metadata->>target_username', target_account)
      .order('posted_at', { ascending: false })
      .limit(5);

    if (!error && accountHistory && accountHistory.length >= 2) {
      // We have history for this account - analyze generator performance
      const generatorPerformance = new Map<string, number[]>();
      
      for (const row of accountHistory) {
        const metadata = row.metadata as any || {};
        const generator = metadata.generator || metadata.content_generator || 'Unknown';
        const followersGained = Number(metadata.followers_gained) || 0;
        
        if (!generatorPerformance.has(generator)) {
          generatorPerformance.set(generator, []);
        }
        generatorPerformance.get(generator)!.push(followersGained);
      }
      
      // Find best generator
      let bestGenerator: GeneratorType | null = null;
      let bestAvg = 0;
      
      for (const [gen, results] of generatorPerformance.entries()) {
        const avg = results.reduce((a, b) => a + b, 0) / results.length;
        if (avg > bestAvg) {
          bestAvg = avg;
          bestGenerator = gen as GeneratorType;
        }
      }
      
      if (bestGenerator && bestAvg > 5) { // Must beat baseline of 5 followers
        console.log(`[GENERATOR_SELECT] 🧠 LEARNING: Using ${bestGenerator} for @${target_account} (${accountHistory.length} samples, +${bestAvg.toFixed(1)} avg followers)`);
        return bestGenerator;
      }
    }
  } catch (error: any) {
    console.warn(`[GENERATOR_SELECT] ⚠️ Learning query failed:`, error.message);
  }
  
  // No strong signal - use category mapping with exploration
  console.log(`[GENERATOR_SELECT] 🎲 No history for @${target_account}, using category-based selection`);
  
  const categoryMapping: Record<string, GeneratorType[]> = {
    neuroscience: ['data_nerd', 'news_reporter', 'thought_leader'],
    longevity: ['data_nerd', 'coach', 'thought_leader'],
    nutrition: ['myth_buster', 'coach', 'data_nerd'],
    science: ['data_nerd', 'news_reporter'],
    medical: ['data_nerd', 'news_reporter'],
    functional_medicine: ['coach', 'thought_leader', 'myth_buster'],
    biohacking: ['data_nerd', 'coach', 'news_reporter'],
    fitness: ['coach', 'myth_buster'],
    wellness: ['coach', 'thought_leader'],
    brain_health: ['data_nerd', 'news_reporter'],
    movement: ['coach', 'myth_buster'],
    optimization: ['data_nerd', 'coach']
  };
  
  const generators = categoryMapping[category] || ['data_nerd', 'coach', 'thought_leader'];
  const selected = generators[Math.floor(Math.random() * generators.length)];
  
  return selected;
}

async function generateReplyWithLLM(target: any) {
  const flags = getConfig();
  const decision_id = uuidv4();
  
  const prompt = `Generate a helpful, evidence-based reply to this health-related tweet:

Original tweet: "${target.content}"
Author: @${target.username}

Your reply should:
- Add genuine value with research or practical insights
- Be conversational and supportive
- Under 280 characters
- No hashtags or excessive emojis
- Never make false claims
- Sound like a knowledgeable friend, not a research paper
- Use context-appropriate language (formal for research, casual for personal posts)

Format as JSON:
{
  "content": "Your reply text here"
}`;

  replyLLMMetrics.calls_total++;
  
  console.log(`[OPENAI] using budgeted client purpose=reply_generation model=${flags.OPENAI_MODEL}`);
  
  const response = await createBudgetedChatCompletion({
    model: flags.OPENAI_MODEL,
    messages: [
      { role: 'system', content: 'You are a knowledgeable health enthusiast who provides genuine, evidence-based insights. Always respond with valid JSON format.' },
      { role: 'user', content: prompt }
    ],
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
    top_p: parseFloat(process.env.OPENAI_TOP_P || '1.0'),
    max_tokens: 200,
    response_format: { type: 'json_object' }
  }, {
    purpose: 'reply_generation',
    requestId: decision_id
  });

  const rawContent = response.choices[0]?.message?.content;
  if (!rawContent) throw new Error('Empty response from OpenAI');

  const replyData = JSON.parse(rawContent);
  if (!replyData.content || replyData.content.length > 280) {
    throw new Error('Invalid reply: missing content or too long');
  }

  const scheduledAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min from now

  return {
    decision_id,
    content: replyData.content,
    target_tweet_id: target.tweet_id,
    target_username: target.username,
    topic: target.topic,
    quality_score: calculateQuality(replyData.content),
    predicted_er: 0.025,
    scheduled_at: scheduledAt.toISOString()
  };
}

/**
 * Queue a reply for posting
 * @param reply Reply data
 * @param delayMinutes Optional delay before posting (for staggering)
 */
async function queueReply(reply: any, delayMinutes: number = 5): Promise<void> {
  const supabase = getSupabaseClient();
  
  // Calculate scheduled time with stagger delay
  const scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000);
  
      // 🎯 v2: Set content_slot for replies (replies use 'reply' slot type)
      const replyContentSlot = 'reply';
      
      // 🧪 Phase 4: Assign experiment metadata for replies (only if experiments enabled)
      let experimentAssignment: { experiment_group: string | null; hook_variant: string | null } = {
        experiment_group: null,
        hook_variant: null
      };
      
      const enableExperiments = process.env.ENABLE_PHASE4_EXPERIMENTS === 'true';
      const { shouldUsePhase4Routing } = await import('../ai/orchestratorRouter');
      if (enableExperiments && shouldUsePhase4Routing()) {
        try {
          const { assignExperiment } = await import('../experiments/experimentAssigner');
          // Replies use 'reply' slot type
          experimentAssignment = assignExperiment('reply');
        } catch (error: any) {
          console.warn(`[PHASE4][Experiment] Failed to assign experiment for reply:`, error.message);
        }
      }
      
      // 🎤 PHASE 5: Voice Guide - Choose voice characteristics for reply
      let voiceDecision: any = null;
      try {
        const { chooseVoiceForContent } = await import('../ai/voiceGuide');
        const generatorName = reply.generator_used || 'unknown';
        console.log(`[VOICE_GUIDE] replyJob: slot=reply generator=${generatorName} decisionType=reply`);
        
        voiceDecision = chooseVoiceForContent({
          slot: 'reply',
          generatorName: generatorName,
          decisionType: 'reply',
          topic: reply.topic || null
        });
        
        console.log(`[VOICE_GUIDE] replyJob decision: hook=${voiceDecision.hookType} tone=${voiceDecision.tone} structure=${voiceDecision.structure}`);
      } catch (error: any) {
        console.error(`[VOICE_GUIDE] ❌ Error in replyJob: ${error.message}`);
        console.error(`[VOICE_GUIDE] Error stack: ${error.stack}`);
        // Continue without voice decision - will use defaults
      }

      // Build insert payload (conditionally exclude experiment fields if experiments disabled)
      const replyInsertPayload: any = {
    decision_id: reply.decision_id,
    decision_type: 'reply',
        // 🔥 CRITICAL FIX: Ensure content is a string, not an array
        content: Array.isArray(reply.content) ? reply.content[0] : reply.content,
        content_slot: replyContentSlot, // 🎯 v2: Store content slot for replies
        generation_source: 'strategic_reply_system', // Single-reply only (never thread)
    status: 'queued',
    scheduled_at: scheduledAt.toISOString(), // Use calculated time
    quality_score: reply.quality_score || 0.85,
    predicted_er: reply.predicted_er || 0.028,
    topic_cluster: reply.topic || 'health',
        
        // 🎤 PHASE 5: Voice Guide metadata (if available)
        hook_type: voiceDecision?.hookType || 'none', // Replies typically don't use hooks
        structure_type: voiceDecision?.structure || 'reply', // Always 'reply' for replies
        
    target_tweet_id: reply.target_tweet_id,
    target_username: reply.target_username,
    generator_name: reply.generator_used || 'unknown',
    bandit_arm: `strategic_reply_${reply.generator_used || 'unknown'}`,
    created_at: new Date().toISOString(),
    features: {
      generator: reply.generator_used || 'unknown',
      tweet_url: reply.tweet_url || null,
      parent_tweet_id: reply.target_tweet_id,
      parent_username: reply.target_username
    },
        
        // ═══════════════════════════════════════════════════════════════════════
        // 🚨 CRITICAL: CONTEXT LOCK DATA - MUST be stored for gate verification
        // ═══════════════════════════════════════════════════════════════════════
        // 🔒 HARD ASSERTION: Reply decision cannot be queued unless snapshot exists
        target_tweet_content_snapshot: (() => {
          if (!reply.target_tweet_content_snapshot || reply.target_tweet_content_snapshot.length < 20) {
            console.error(`[REPLY_JOB] ❌ CRITICAL: Missing target_tweet_content_snapshot for decision_id=${reply.decision_id}`);
            throw new Error(`Reply decision missing required gate data: target_tweet_content_snapshot`);
          }
          return reply.target_tweet_content_snapshot;
        })(),
        target_tweet_content_hash: (() => {
          if (!reply.target_tweet_content_hash) {
            console.error(`[REPLY_JOB] ❌ CRITICAL: Missing target_tweet_content_hash for decision_id=${reply.decision_id}`);
            throw new Error(`Reply decision missing required gate data: target_tweet_content_hash`);
          }
          return reply.target_tweet_content_hash;
        })(),
        semantic_similarity: reply.semantic_similarity ?? 0.75, // Default similarity if missing
        root_tweet_id: reply.root_tweet_id || reply.target_tweet_id || null,
        
        // 🔒 PROVENANCE TRACKING - Required for debugging and auditing
        pipeline_source: 'replyJobEnhanced',
        build_sha: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || `local-${Date.now()}`
      };
      
      // Only add experiment fields if experiments are enabled (columns may not exist in schema)
      if (enableExperiments && experimentAssignment.experiment_group) {
        replyInsertPayload.experiment_group = experimentAssignment.experiment_group;
        replyInsertPayload.hook_variant = experimentAssignment.hook_variant;
      }
      
      const { data, error } = await supabase.from('content_metadata').insert([replyInsertPayload]);
  
  if (error) {
    console.error('[REPLY_JOB] ❌ Failed to queue reply:', error.message);
    throw error;
  }
  
  console.log(`[REPLY_JOB] 💾 Reply queued: ${reply.decision_id}`);
  console.log(`[REPLY_JOB] ⏰ Scheduled for: ${scheduledAt.toLocaleString()} (in ${delayMinutes} min)`);
}

async function discoverTargets() {
  // Mock target discovery
  return [
    {
      tweet_id: `tweet_${Date.now()}_1`,
      username: 'health_researcher',
      content: "New study shows Mediterranean diet reduces cardiovascular risk by 30%.",
      topic: 'nutrition'
    }
  ];
}

async function runGateChain(text: string, decision_id: string) {
  const flags = getConfig();
  const quality = calculateQuality(text);
  if (quality < flags.MIN_QUALITY_SCORE) {
    return { passed: false, gate: 'quality', reason: 'below_threshold' };
  }
  return { passed: true };
}

function calculateQuality(text: string): number {
  let score = 0.5;
  if (text.length >= 50 && text.length <= 250) score += 0.2;
  if (/\b(study|research)\b/i.test(text)) score += 0.15;
  if (!/\b(amazing|incredible)\b/i.test(text)) score += 0.15;
  return Math.min(1.0, score);
}

function categorizeError(error: any): string {
  const msg = error.message?.toLowerCase() || '';
  if (error.status === 429 || msg.includes('rate_limit')) return 'rate_limit';
  if (msg.includes('quota')) return 'insufficient_quota';
  if (msg.includes('budget')) return 'budget_exceeded';
  return 'unknown';
}