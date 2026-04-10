/**
 * 226 (X automation/spam block) adaptive cooldowns and safe mode.
 * - Account: first 226 → 30min, second within 6h → 2h, third within 24h → 12h
 * - Target: do not reply to same target again (persisted)
 * - Author: do not reply to same author for 24h after 226
 * - Safe mode: reduced throughput, 1 reply per cycle, stricter target selection
 */

import { getSupabaseClient } from '../db/index';

const ACCOUNT_REF = 'default';
const COOLDOWN_FIRST_MS = 30 * 60 * 1000;       // 30 min
const COOLDOWN_SECOND_MS = 2 * 60 * 60 * 1000;  // 2 h (second within 6h)
const COOLDOWN_THIRD_MS = 12 * 60 * 60 * 1000;  // 12 h (third within 24h)
const AUTHOR_COOLDOWN_MS = 24 * 60 * 60 * 1000;  // 24 h
const TARGET_COOLDOWN_MS = 60 * 60 * 1000;       // 60 min (existing behavior)

const HOUR_MS = 60 * 60 * 1000;
const SIX_HOUR_MS = 6 * HOUR_MS;
const DAY_MS = 24 * HOUR_MS;

export interface X226Counts {
  count_1h: number;
  count_6h: number;
  count_24h: number;
}

export interface X226ThrottleState {
  safe_mode: boolean;
  account_cooldown_until: string | null;
  max_replies_per_hour: number;
  one_reply_per_cycle: boolean;
  skip_reason_account?: string;
  skip_reason_author?: string;
  skip_reason_target?: string;
}

/** In-memory target cooldowns (also persisted to DB on record) for fast checks */
const targetCooldownUntil: Map<string, number> = new Map();

/**
 * Get 226 event counts from system_events (CREATE_TWEET_226_BLOCKED).
 */
export async function get226Counts(): Promise<X226Counts> {
  const supabase = getSupabaseClient();
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - HOUR_MS).toISOString();
  const sixHoursAgo = new Date(now.getTime() - SIX_HOUR_MS).toISOString();
  const dayAgo = new Date(now.getTime() - DAY_MS).toISOString();

  const [r1, r6, r24] = await Promise.all([
    supabase.from('system_events').select('id', { count: 'exact', head: true }).eq('event_type', 'CREATE_TWEET_226_BLOCKED').gte('created_at', oneHourAgo),
    supabase.from('system_events').select('id', { count: 'exact', head: true }).eq('event_type', 'CREATE_TWEET_226_BLOCKED').gte('created_at', sixHoursAgo),
    supabase.from('system_events').select('id', { count: 'exact', head: true }).eq('event_type', 'CREATE_TWEET_226_BLOCKED').gte('created_at', dayAgo),
  ]);
  return {
    count_1h: r1.count ?? 0,
    count_6h: r6.count ?? 0,
    count_24h: r24.count ?? 0,
  };
}

/**
 * Compute account cooldown duration from counts: first 30m, second in 6h = 2h, third in 24h = 12h.
 */
function accountCooldownDurationMs(count6h: number, count24h: number): number {
  if (count24h >= 3) return COOLDOWN_THIRD_MS;
  if (count6h >= 2) return COOLDOWN_SECOND_MS;
  return COOLDOWN_FIRST_MS;
}

/**
 * Check if account is in 226 cooldown (from DB).
 */
export async function isAccountIn226Cooldown(): Promise<{ inCooldown: boolean; cooldownUntil?: string }> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('x_226_cooldowns')
    .select('cooldown_until')
    .eq('type', 'account')
    .eq('reference_id', ACCOUNT_REF)
    .gt('cooldown_until', new Date().toISOString())
    .order('cooldown_until', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.cooldown_until) return { inCooldown: false };
  return { inCooldown: true, cooldownUntil: data.cooldown_until };
}

/**
 * Check if target tweet is in 226 cooldown (memory + DB).
 */
export async function isTargetBlockedBy226(targetTweetId: string): Promise<boolean> {
  const until = targetCooldownUntil.get(targetTweetId);
  if (until != null && Date.now() < until) return true;
  if (until != null) targetCooldownUntil.delete(targetTweetId);

  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('x_226_cooldowns')
    .select('cooldown_until')
    .eq('type', 'target')
    .eq('reference_id', targetTweetId)
    .gt('cooldown_until', new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (data?.cooldown_until) {
    targetCooldownUntil.set(targetTweetId, new Date(data.cooldown_until).getTime());
    return true;
  }
  return false;
}

/**
 * Check if author (username) is in 226 cooldown.
 */
export async function isAuthorBlockedBy226(authorUsername: string): Promise<boolean> {
  if (!authorUsername?.trim()) return false;
  const key = authorUsername.trim().toLowerCase();
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('x_226_cooldowns')
    .select('cooldown_until')
    .eq('type', 'author')
    .eq('reference_id', key)
    .gt('cooldown_until', new Date().toISOString())
    .limit(1)
    .maybeSingle();
  return !!data?.cooldown_until;
}

/**
 * Safe mode: any 226 in last 6h or account in cooldown → reduce throughput, stricter selection.
 */
export async function is226SafeMode(): Promise<boolean> {
  const [counts, account] = await Promise.all([get226Counts(), isAccountIn226Cooldown()]);
  if (account.inCooldown) return true;
  if (counts.count_6h >= 1) return true;
  return false;
}

/**
 * Current throttle state for observability and rate shaping.
 */
export async function get226ThrottleState(): Promise<X226ThrottleState> {
  const [counts, account, safeMode] = await Promise.all([
    get226Counts(),
    isAccountIn226Cooldown(),
    is226SafeMode(),
  ]);
  const maxRepliesPerHour = safeMode ? 1 : Math.max(1, parseInt(process.env.X_MAX_ACTIONS_PER_HOUR || '1', 10));
  return {
    safe_mode: safeMode,
    account_cooldown_until: account.cooldownUntil ?? null,
    max_replies_per_hour: maxRepliesPerHour,
    one_reply_per_cycle: safeMode,
    skip_reason_account: account.inCooldown ? `account 226 cooldown until ${account.cooldownUntil}` : undefined,
  };
}

/**
 * Record a 226 and apply account/target/author cooldowns. Call from atomicPostExecutor after 226.
 */
export async function record226AndApplyCooldowns(params: {
  decision_id: string;
  target_tweet_id: string | null;
  target_username: string | null;
  template_id?: string | null;
  pipeline_source?: string | null;
}): Promise<{ account_cooldown_until: string }> {
  const supabase = getSupabaseClient();
  const { decision_id, target_tweet_id, target_username, template_id, pipeline_source } = params;
  const now = new Date();
  const nowIso = now.toISOString();

  const counts = await get226Counts();
  const durationMs = accountCooldownDurationMs(counts.count_6h, counts.count_24h);
  const accountCooldownUntil = new Date(now.getTime() + durationMs).toISOString();

  await supabase.from('x_226_cooldowns').insert({
    type: 'account',
    reference_id: ACCOUNT_REF,
    cooldown_until: accountCooldownUntil,
    created_at: nowIso,
    meta: { decision_id, count_1h: counts.count_1h, count_6h: counts.count_6h, count_24h: counts.count_24h, duration_minutes: Math.round(durationMs / 60000) },
  });

  if (target_tweet_id?.trim()) {
    const targetUntil = new Date(now.getTime() + TARGET_COOLDOWN_MS).toISOString();
    targetCooldownUntil.set(target_tweet_id.trim(), now.getTime() + TARGET_COOLDOWN_MS);
    await supabase.from('x_226_cooldowns').insert({
      type: 'target',
      reference_id: target_tweet_id.trim(),
      cooldown_until: targetUntil,
      created_at: nowIso,
      meta: { decision_id },
    });
  }

  if (target_username?.trim()) {
    const authorKey = target_username.trim().toLowerCase();
    const authorUntil = new Date(now.getTime() + AUTHOR_COOLDOWN_MS).toISOString();
    await supabase.from('x_226_cooldowns').insert({
      type: 'author',
      reference_id: authorKey,
      cooldown_until: authorUntil,
      created_at: nowIso,
      meta: { decision_id, username: target_username.trim() },
    });
  }

  console.log(`[X_226] record226 decision_id=${decision_id} account_cooldown_until=${accountCooldownUntil} count_1h=${counts.count_1h} count_6h=${counts.count_6h} count_24h=${counts.count_24h}`);

  // Learning: record 226 as negative outcome for down-ranking target/author/template combinations
  await supabase.from('system_events').insert({
    event_type: 'X_226_LEARNING_RECORD',
    severity: 'info',
    message: `226 learning signal: decision_id=${decision_id} target=${target_tweet_id ?? 'null'} author=${target_username ?? 'null'}`,
    event_data: {
      decision_id,
      target_tweet_id: target_tweet_id ?? null,
      target_username: target_username ?? null,
      template_id: template_id ?? null,
      pipeline_source: pipeline_source ?? null,
      outcome: 'blocked_226',
      created_at: nowIso,
    },
    created_at: nowIso,
  });

  return { account_cooldown_until: accountCooldownUntil };
}

/**
 * Set target cooldown only (e.g. from poster when 226 detected before record226AndApplyCooldowns).
 * Call from createTweet226Cooldown.addCreateTweet226Cooldown for backward compat.
 */
export function setTargetCooldown(targetTweetId: string): void {
  const until = Date.now() + TARGET_COOLDOWN_MS;
  targetCooldownUntil.set(targetTweetId.trim(), until);
}

/**
 * Load target cooldowns from DB into memory on startup (optional, for persistence across restarts).
 */
export async function load226TargetCooldownsIntoMemory(): Promise<void> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('x_226_cooldowns')
    .select('reference_id, cooldown_until')
    .eq('type', 'target')
    .gt('cooldown_until', new Date().toISOString());
  if (data) {
    for (const row of data) {
      targetCooldownUntil.set(row.reference_id, new Date(row.cooldown_until).getTime());
    }
    if (data.length > 0) console.log(`[X_226] loaded ${data.length} target cooldowns from DB`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REPLY AUTOMATION LANE: separate cooldown so original posts are unaffected
// ═══════════════════════════════════════════════════════════════════════════

const REPLY_226_COOLDOWN_HOURS = parseInt(process.env.REPLY_226_COOLDOWN_HOURS || '24', 10);
const REPLY_226_COOLDOWN_MS = REPLY_226_COOLDOWN_HOURS * 60 * 60 * 1000;

export interface ReplyAutomationCooldownState {
  inCooldown: boolean;
  reply_automation_cooldown_until: string | null;
  last_reply_226_at: string | null;
  recent_reply_226_count: number;
}

/**
 * Get reply automation cooldown state. When inCooldown is true, posting queue
 * should suppress all reply attempts and only process original posts.
 */
export async function getReplyAutomationCooldown(): Promise<ReplyAutomationCooldownState> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('reply_automation_state')
    .select('last_reply_226_at, recent_reply_226_count, reply_automation_cooldown_until')
    .eq('id', 1)
    .maybeSingle();
  if (error || !data) {
    return { inCooldown: false, reply_automation_cooldown_until: null, last_reply_226_at: null, recent_reply_226_count: 0 };
  }
  const until = data.reply_automation_cooldown_until as string | null;
  const inCooldown = !!until && new Date(until) > new Date();
  return {
    inCooldown,
    reply_automation_cooldown_until: until ?? null,
    last_reply_226_at: (data.last_reply_226_at as string) ?? null,
    recent_reply_226_count: Number(data.recent_reply_226_count) || 0,
  };
}

/**
 * Record a reply 226 and set reply-automation cooldown. Call only when the
 * failed post was a reply (not an original post). Original post automation
 * is unaffected.
 */
export async function recordReply226State(): Promise<{ reply_automation_cooldown_until: string }> {
  const supabase = getSupabaseClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const cooldownUntil = new Date(now.getTime() + REPLY_226_COOLDOWN_MS).toISOString();

  const { data: existing } = await supabase
    .from('reply_automation_state')
    .select('recent_reply_226_count')
    .eq('id', 1)
    .maybeSingle();

  const newCount = (Number(existing?.recent_reply_226_count) || 0) + 1;

  await supabase
    .from('reply_automation_state')
    .upsert(
      {
        id: 1,
        last_reply_226_at: nowIso,
        recent_reply_226_count: newCount,
        reply_automation_cooldown_until: cooldownUntil,
        updated_at: nowIso,
      },
      { onConflict: 'id' }
    );

  console.log(
    `[REPLY_226] reply automation cooldown set: cooldown_until=${cooldownUntil} recent_reply_226_count=${newCount} (original posts unaffected)`
  );
  return { reply_automation_cooldown_until: cooldownUntil };
}
