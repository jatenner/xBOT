/**
 * 🧠 CENTRAL CONTROLLER v2 — Data-Driven Allocation Engine
 *
 * Decides what action to take based on:
 *   - Growth intelligence (real performance data by type/hour)
 *   - Allocation tracking (daily/hourly usage vs budget)
 *   - Target mix (70% replies, 25% singles, 5% threads)
 *   - Cooldown/safety state
 *
 * Decision output: 'single' | 'thread' | 'reply' | 'wait'
 * All decisions persisted with full allocation reasoning.
 */

export type ActionDecision = 'single' | 'thread' | 'reply' | 'wait';

// ─── Allocation Config (env-configurable) ───
const TARGET_REPLY_PCT = parseFloat(process.env.TARGET_REPLY_PCT || '70');
const TARGET_SINGLE_PCT = parseFloat(process.env.TARGET_SINGLE_PCT || '25');
const TARGET_THREAD_PCT = parseFloat(process.env.TARGET_THREAD_PCT || '5');
const MAX_REPLIES_PER_DAY = parseInt(process.env.MAX_REPLIES_PER_DAY || '20', 10);
const MAX_SINGLES_PER_DAY = parseInt(process.env.MAX_SINGLES_PER_DAY || '8', 10);
const MAX_THREADS_PER_DAY = parseInt(process.env.MAX_THREADS_PER_DAY || '2', 10);
const MAX_TOTAL_PER_DAY = parseInt(process.env.MAX_TOTAL_PER_DAY || '24', 10);

export interface AllocationState {
  // Daily counts
  repliesToday: number;
  singlesToday: number;
  threadsToday: number;
  totalToday: number;

  // Hourly counts
  repliesLastHour: number;
  singlesLastHour: number;
  threadsLastHour: number;

  // Current mix (% of today's posts)
  currentReplyPct: number;
  currentSinglePct: number;
  currentThreadPct: number;

  // Budget remaining
  repliesBudgetRemaining: number;
  singlesBudgetRemaining: number;
  threadsBudgetRemaining: number;
  totalBudgetRemaining: number;
}

export interface ControllerDecisionInput {
  // Cooldown state
  shadowMode: boolean;
  xActionsEnabled: boolean;
  cooldownActive: boolean;
  cooldownReason?: string;
  x226SafeMode: boolean;

  // Queue health
  queuedContentCount: number;
  queuedReplyCount: number;
  replyCandidateCount: number;

  // Rate limits (hourly slots remaining)
  contentSlotsRemaining: number;
  replySlotsRemaining: number;

  // Recent action mix (last hour)
  contentPostedLastHour: number;
  repliesPostedLastHour: number;

  // Time-of-day
  currentHour: number;
  isActiveHours: boolean;

  // Engagement signals
  avgEngagementRateLastDay?: number;
  replyRewardAvgLastDay?: number;

  // Growth intelligence
  growthIntel?: import('../intelligence/growthIntelligence').GrowthSnapshot | null;

  // Allocation state
  allocation?: AllocationState;
}

export interface ControllerDecision {
  action: ActionDecision;
  reasoning: string[];
  confidence: number; // 0-1
  scores: {
    single: number;
    thread: number;
    reply: number;
    wait: number;
  };
  input: ControllerDecisionInput;
  decidedAt: string;
}

/**
 * Choose the next action for xBOT based on current system state + growth intelligence data.
 *
 * Scoring policy (v2 — data-driven):
 *   - Base scores set by growth intelligence performance data (not hardcoded)
 *   - Threads heavily penalized (data: 23 avg views vs 771 for replies)
 *   - Hour-of-day scoring from real performance data
 *   - Action budget: replies dominate, singles secondary, threads rare
 */
export function chooseNextAction(input: ControllerDecisionInput): ControllerDecision {
  const reasoning: string[] = [];
  const scores = { single: 0, thread: 0, reply: 0, wait: 0 };
  const gi = input.growthIntel;

  // ─── HARD BLOCKS ───
  if (input.shadowMode) {
    reasoning.push('BLOCKED: Shadow mode active');
    return makeDecision('wait', reasoning, scores, input, 1.0);
  }
  if (!input.xActionsEnabled) {
    reasoning.push('BLOCKED: X actions disabled');
    return makeDecision('wait', reasoning, scores, input, 1.0);
  }
  if (input.cooldownActive) {
    reasoning.push(`BLOCKED: Cooldown active (${input.cooldownReason || 'unknown'})`);
    return makeDecision('wait', reasoning, scores, input, 1.0);
  }

  // ─── DATA-DRIVEN BASE SCORES ───
  // Use growth intelligence to set base scores proportional to real performance
  // Fallback to conservative defaults if no data
  let replyReward = 22; // default from data: replies avg 22 reward
  let singleReward = 1;  // default from data: singles avg 0.7 reward
  let threadReward = 1;  // default from data: threads avg 0.7 reward

  const usingDefaults = !gi || gi.by_action_type.every(d => d.sample_count < 3);
  console.log(`[LEARNING_STATE] system=central_controller mode=${usingDefaults ? 'fallback_defaults' : 'real_data'} reason=${!gi ? 'no_snapshot' : usingDefaults ? 'all_dimensions_below_3_samples' : 'sufficient_data'} data_quality=${gi?.data_quality ? JSON.stringify(gi.data_quality) : 'null'}`);

  if (gi) {
    for (const d of gi.by_action_type) {
      if (d.value === 'reply' && d.sample_count >= 3) replyReward = d.avg_reward;
      if (d.value === 'single' && d.sample_count >= 3) singleReward = d.avg_reward;
      if (d.value === 'thread' && d.sample_count >= 3) threadReward = d.avg_reward;
    }
    reasoning.push(`GI: reply_reward=${replyReward.toFixed(1)} single=${singleReward.toFixed(1)} thread=${threadReward.toFixed(1)} (${gi.total_with_outcomes} samples)`);
  } else {
    reasoning.push('GI: no snapshot available, using defaults');
  }

  // Normalize rewards to scores (scale so best = 70, worst = 5)
  const maxReward = Math.max(replyReward, singleReward, threadReward, 1);
  const normalize = (reward: number) => Math.max(5, Math.round((reward / maxReward) * 70));

  // Apply only if queue/slots available
  if ((input.queuedReplyCount > 0 || input.replyCandidateCount > 0) && input.replySlotsRemaining > 0) {
    scores.reply = normalize(replyReward);
    reasoning.push(`Replies: score=${scores.reply} (${input.queuedReplyCount} queued, ${input.replyCandidateCount} candidates)`);
  } else if (input.replySlotsRemaining <= 0) {
    reasoning.push('Reply rate limit reached');
  } else {
    reasoning.push('No reply candidates');
  }

  if (input.queuedContentCount > 0 && input.contentSlotsRemaining > 0) {
    scores.single = normalize(singleReward);
    // Threads: hard cap at score 10 unless they're genuinely top performer
    scores.thread = threadReward > singleReward * 2 ? normalize(threadReward) : Math.min(10, normalize(threadReward));
    reasoning.push(`Content: single=${scores.single} thread=${scores.thread} (${input.queuedContentCount} queued)`);
  } else if (input.contentSlotsRemaining <= 0) {
    reasoning.push('Content rate limit reached');
  } else {
    reasoning.push('No content queued');
  }

  scores.wait = 15;

  // ─── DATA-DRIVEN HOUR SCORING ───
  // Use real hour performance instead of hardcoded peak hours
  if (gi && gi.by_hour.length > 0) {
    const hourData = gi.by_hour.find(h => parseInt(h.value) === input.currentHour);
    const avgHourReward = gi.by_hour.reduce((s, h) => s + h.avg_reward, 0) / gi.by_hour.length;

    if (hourData && hourData.sample_count >= 2) {
      const hourMultiplier = hourData.avg_reward / Math.max(avgHourReward, 1);
      if (hourMultiplier > 1.5) {
        // High-performance hour — boost all actions
        scores.reply = Math.round(scores.reply * 1.3);
        scores.single = Math.round(scores.single * 1.2);
        reasoning.push(`Peak hour ${input.currentHour}:00 UTC (${hourMultiplier.toFixed(1)}x avg) — boosting`);
      } else if (hourMultiplier < 0.3) {
        // Low-performance hour — reduce posting, boost wait
        scores.reply = Math.round(scores.reply * 0.5);
        scores.single = Math.round(scores.single * 0.3);
        scores.thread = Math.round(scores.thread * 0.1);
        scores.wait += 25;
        reasoning.push(`Low hour ${input.currentHour}:00 UTC (${hourMultiplier.toFixed(1)}x avg) — reducing`);
      }
    }
  } else if (!input.isActiveHours) {
    // Fallback: no data, use simple active hours check
    scores.single = Math.round(scores.single * 0.3);
    scores.thread = Math.round(scores.thread * 0.1);
    scores.reply = Math.round(scores.reply * 0.5);
    scores.wait += 30;
    reasoning.push(`Off-peak (${input.currentHour}:00, no GI hour data) — reducing`);
  }

  // ─── 226 SAFE MODE ───
  if (input.x226SafeMode) {
    scores.reply = Math.round(scores.reply * 0.3);
    scores.wait += 25;
    reasoning.push('226 safe mode — reducing replies');
  }

  // ─── ALLOCATION INTELLIGENCE ───
  const alloc = input.allocation;
  if (alloc) {
    // Daily budget hard caps
    if (alloc.totalBudgetRemaining <= 0) {
      scores.single = 0; scores.thread = 0; scores.reply = 0;
      scores.wait = 100;
      reasoning.push(`DAILY CAP: ${alloc.totalToday}/${MAX_TOTAL_PER_DAY} total — waiting`);
    } else {
      if (alloc.repliesBudgetRemaining <= 0 && scores.reply > 0) {
        scores.reply = 0;
        reasoning.push(`Reply daily cap hit: ${alloc.repliesToday}/${MAX_REPLIES_PER_DAY}`);
      }
      if (alloc.singlesBudgetRemaining <= 0 && scores.single > 0) {
        scores.single = 0;
        reasoning.push(`Single daily cap hit: ${alloc.singlesToday}/${MAX_SINGLES_PER_DAY}`);
      }
      if (alloc.threadsBudgetRemaining <= 0 && scores.thread > 0) {
        scores.thread = 0;
        reasoning.push(`Thread daily cap hit: ${alloc.threadsToday}/${MAX_THREADS_PER_DAY}`);
      }

      // Mix pressure: boost underrepresented types, suppress overrepresented
      if (alloc.totalToday >= 3) { // Need minimum 3 posts for meaningful mix
        if (alloc.currentReplyPct < TARGET_REPLY_PCT - 10 && scores.reply > 0) {
          scores.reply += 20;
          reasoning.push(`Replies underweight: ${alloc.currentReplyPct.toFixed(0)}% vs ${TARGET_REPLY_PCT}% target — boosting`);
        }
        if (alloc.currentThreadPct > TARGET_THREAD_PCT + 5 && scores.thread > 0) {
          scores.thread = Math.round(scores.thread * 0.2);
          reasoning.push(`Threads overweight: ${alloc.currentThreadPct.toFixed(0)}% vs ${TARGET_THREAD_PCT}% target — suppressing`);
        }
        if (alloc.currentSinglePct > TARGET_SINGLE_PCT + 15 && scores.single > 0) {
          scores.single = Math.round(scores.single * 0.5);
          reasoning.push(`Singles overweight: ${alloc.currentSinglePct.toFixed(0)}% vs ${TARGET_SINGLE_PCT}% target — reducing`);
        }
      }
    }

    reasoning.push(`Alloc: today=${alloc.totalToday}/${MAX_TOTAL_PER_DAY} (R:${alloc.repliesToday} S:${alloc.singlesToday} T:${alloc.threadsToday}) mix=${alloc.currentReplyPct.toFixed(0)}/${alloc.currentSinglePct.toFixed(0)}/${alloc.currentThreadPct.toFixed(0)}`);
  }

  // Thread hard penalty: never choose thread if a reply is available
  if (scores.reply > 0 && scores.thread > 0) {
    scores.thread = Math.min(scores.thread, Math.round(scores.reply * 0.15));
  }
  // Thread never exceeds single
  if (scores.thread > scores.single && scores.single > 0) {
    scores.thread = Math.round(scores.single * 0.5);
  }

  // ─── SELECT WINNER ───
  const entries = Object.entries(scores) as [ActionDecision, number][];
  entries.sort((a, b) => b[1] - a[1]);
  const winner = entries[0][0];
  const winnerScore = entries[0][1];
  const runnerUp = entries[1][1];

  // Confidence based on margin between winner and runner-up
  const margin = winnerScore - runnerUp;
  const confidence = Math.min(1, Math.max(0.1, margin / 50));

  reasoning.push(`Decision: ${winner} (score=${winnerScore.toFixed(1)}, margin=${margin.toFixed(1)}, confidence=${confidence.toFixed(2)})`);

  return makeDecision(winner, reasoning, scores, input, confidence);
}

function makeDecision(
  action: ActionDecision,
  reasoning: string[],
  scores: ControllerDecision['scores'],
  input: ControllerDecisionInput,
  confidence: number
): ControllerDecision {
  return {
    action,
    reasoning,
    confidence,
    scores,
    input,
    decidedAt: new Date().toISOString(),
  };
}

/**
 * Gather live inputs from the current system state.
 */
export async function gatherControllerInputs(): Promise<ControllerDecisionInput> {
  const { getSupabaseClient } = await import('../db/index');
  const supabase = getSupabaseClient();
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const currentHour = now.getHours();

  // Cooldown state
  const { getCooldownStatus } = await import('../safety/actionGate');
  const cooldown = getCooldownStatus();
  const shadowMode = (process.env.SHADOW_MODE ?? 'true') !== 'false';
  const xActionsEnabled = process.env.X_ACTIONS_ENABLED === 'true';

  // 226 safe mode
  let x226SafeMode = false;
  try {
    const { is226SafeMode } = await import('../services/x226Cooldown');
    x226SafeMode = await is226SafeMode();
  } catch { /* non-blocking */ }

  // Queue health — content
  const { count: queuedContentCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')
    .in('decision_type', ['single', 'thread']);

  // Queue health — replies
  const { count: queuedReplyCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')
    .eq('decision_type', 'reply');

  // Reply candidates
  const { count: replyCandidateCount } = await supabase
    .from('reply_candidate_queue')
    .select('*', { count: 'exact', head: true });

  // Rate limits used
  const { count: contentPostedLastHour } = await supabase
    .from('posted_decisions')
    .select('*', { count: 'exact', head: true })
    .in('decision_type', ['single', 'thread'])
    .gte('posted_at', oneHourAgo);

  const { count: repliesPostedLastHour } = await supabase
    .from('posted_decisions')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .gte('posted_at', oneHourAgo);

  const maxContentPerHour = parseInt(process.env.MAX_POSTS_PER_HOUR || '2', 10);
  const maxRepliesPerHour = parseInt(process.env.REPLIES_PER_HOUR || '6', 10);

  // Avg engagement from last 24h
  let avgEngagementRateLastDay: number | undefined;
  try {
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data: outcomes } = await supabase
      .from('outcomes')
      .select('engagement_rate')
      .gte('created_at', oneDayAgo)
      .not('engagement_rate', 'is', null);
    if (outcomes && outcomes.length > 0) {
      const sum = outcomes.reduce((s: number, o: any) => s + (Number(o.engagement_rate) || 0), 0);
      avgEngagementRateLastDay = sum / outcomes.length;
    }
  } catch { /* non-blocking */ }

  // Load growth intelligence snapshot
  let growthIntel: any = null;
  try {
    const { getLatestGrowthSnapshot } = await import('../intelligence/growthIntelligence');
    growthIntel = await getLatestGrowthSnapshot();
  } catch { /* non-blocking */ }

  // Allocation state: daily counts by type (ET-aligned day: midnight ET = 04:00 UTC)
  const ET_OFFSET_HOURS = parseInt(process.env.TIMEZONE_OFFSET_HOURS || '4', 10); // EDT=4, EST=5
  const todayStart = new Date(now);
  todayStart.setUTCHours(ET_OFFSET_HOURS, 0, 0, 0);
  if (todayStart > now) todayStart.setUTCDate(todayStart.getUTCDate() - 1); // If before midnight ET, use yesterday's boundary
  const todayISO = todayStart.toISOString();

  const { count: repliesToday } = await supabase
    .from('posted_decisions').select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply').gte('posted_at', todayISO);
  const { count: singlesToday } = await supabase
    .from('posted_decisions').select('*', { count: 'exact', head: true })
    .eq('decision_type', 'single').gte('posted_at', todayISO);
  const { count: threadsToday } = await supabase
    .from('posted_decisions').select('*', { count: 'exact', head: true })
    .eq('decision_type', 'thread').gte('posted_at', todayISO);

  // Hourly counts by type
  const { count: singlesLastHour } = await supabase
    .from('posted_decisions').select('*', { count: 'exact', head: true })
    .eq('decision_type', 'single').gte('posted_at', oneHourAgo);
  const { count: threadsLastHour } = await supabase
    .from('posted_decisions').select('*', { count: 'exact', head: true })
    .eq('decision_type', 'thread').gte('posted_at', oneHourAgo);

  const rToday = repliesToday || 0;
  const sToday = singlesToday || 0;
  const tToday = threadsToday || 0;
  const totalToday = rToday + sToday + tToday;

  const allocation: AllocationState = {
    repliesToday: rToday,
    singlesToday: sToday,
    threadsToday: tToday,
    totalToday,
    repliesLastHour: repliesPostedLastHour || 0,
    singlesLastHour: singlesLastHour || 0,
    threadsLastHour: threadsLastHour || 0,
    currentReplyPct: totalToday > 0 ? (rToday / totalToday) * 100 : 0,
    currentSinglePct: totalToday > 0 ? (sToday / totalToday) * 100 : 0,
    currentThreadPct: totalToday > 0 ? (tToday / totalToday) * 100 : 0,
    repliesBudgetRemaining: Math.max(0, MAX_REPLIES_PER_DAY - rToday),
    singlesBudgetRemaining: Math.max(0, MAX_SINGLES_PER_DAY - sToday),
    threadsBudgetRemaining: Math.max(0, MAX_THREADS_PER_DAY - tToday),
    totalBudgetRemaining: Math.max(0, MAX_TOTAL_PER_DAY - totalToday),
  };

  return {
    shadowMode,
    xActionsEnabled,
    cooldownActive: cooldown.inCooldown,
    cooldownReason: cooldown.reason,
    x226SafeMode,
    queuedContentCount: queuedContentCount || 0,
    queuedReplyCount: queuedReplyCount || 0,
    replyCandidateCount: replyCandidateCount || 0,
    contentSlotsRemaining: Math.max(0, maxContentPerHour - (contentPostedLastHour || 0)),
    replySlotsRemaining: Math.max(0, maxRepliesPerHour - (repliesPostedLastHour || 0)),
    contentPostedLastHour: contentPostedLastHour || 0,
    repliesPostedLastHour: repliesPostedLastHour || 0,
    currentHour,
    isActiveHours: currentHour >= 8 && currentHour <= 23,
    avgEngagementRateLastDay,
    growthIntel,
    allocation,
  };
}

/**
 * Run the central controller: gather inputs → decide → persist → return.
 */
export async function runCentralController(): Promise<ControllerDecision> {
  const prefix = '[CENTRAL_CONTROLLER]';
  const input = await gatherControllerInputs();
  const decision = chooseNextAction(input);

  // Log decision
  console.log(`${prefix} action=${decision.action} confidence=${decision.confidence.toFixed(2)} scores={single=${decision.scores.single.toFixed(0)},thread=${decision.scores.thread.toFixed(0)},reply=${decision.scores.reply.toFixed(0)},wait=${decision.scores.wait.toFixed(0)}}`);
  for (const r of decision.reasoning) {
    console.log(`${prefix}   ${r}`);
  }

  // Persist decision reasoning to system_events
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    await supabase.from('system_events').insert({
      event_type: 'CENTRAL_CONTROLLER_DECISION',
      severity: 'info',
      message: `Controller decided: ${decision.action} (confidence=${decision.confidence.toFixed(2)})`,
      event_data: {
        action: decision.action,
        confidence: decision.confidence,
        scores: decision.scores,
        reasoning: decision.reasoning,
        input: {
          queuedContent: input.queuedContentCount,
          queuedReplies: input.queuedReplyCount,
          replyCandidates: input.replyCandidateCount,
          contentSlots: input.contentSlotsRemaining,
          replySlots: input.replySlotsRemaining,
          hour: input.currentHour,
          activeHours: input.isActiveHours,
          x226SafeMode: input.x226SafeMode,
          avgER: input.avgEngagementRateLastDay,
          gi_available: !!input.growthIntel,
          gi_best_action: input.growthIntel?.best_action_type || null,
          gi_best_hours: input.growthIntel?.best_hours || [],
          gi_samples: input.growthIntel?.total_with_outcomes || 0,
          alloc_today: input.allocation ? `R:${input.allocation.repliesToday} S:${input.allocation.singlesToday} T:${input.allocation.threadsToday}` : null,
          alloc_mix: input.allocation ? `${input.allocation.currentReplyPct.toFixed(0)}/${input.allocation.currentSinglePct.toFixed(0)}/${input.allocation.currentThreadPct.toFixed(0)}` : null,
          alloc_budget_remaining: input.allocation?.totalBudgetRemaining ?? null,
        },
      },
      created_at: decision.decidedAt,
    });
  } catch { /* non-blocking */ }

  return decision;
}
