/**
 * Brain: Phase Advisor
 *
 * Produces tier-segmented recommendations calibrated to our account size.
 * Only recommends patterns proven at account tiers <= our current tier.
 *
 * Key principle: A pattern that works for 500K-follower accounts may not
 * work for a 200-follower account. The phase advisor ensures we only
 * get advice relevant to where WE are.
 */

import { getSupabaseClient } from '../db';
import { getSelfModel } from './db';
import type {
  AccountTier,
  GrowthPhase,
  PhasePattern,
  TimingWindow,
} from './types';

const LOG_PREFIX = '[brain/phase-advisor]';

const MIN_SAMPLES = 5;

// Map growth phase to which account tiers are relevant
const PHASE_TO_RELEVANT_TIERS: Record<GrowthPhase, AccountTier[]> = {
  cold_start: ['C'],                        // Only learn from small accounts
  early_traction: ['C', 'B'],               // Small and medium
  growth: ['C', 'B', 'A'],                  // All except elite
  authority: ['B', 'A', 'S'],               // Medium to elite
  scale: ['A', 'S'],                        // Only large and elite
};

// =============================================================================
// Main Query: Top patterns for our phase
// =============================================================================

export interface ContentTypeStrategy {
  recommended_hooks: PhasePattern[];
  recommended_tones: PhasePattern[];
  recommended_formats: PhasePattern[];
  recommended_triggers: PhasePattern[];
}

export interface PhaseAdvice {
  growth_phase: GrowthPhase;
  follower_count: number;
  relevant_tiers: AccountTier[];
  // Legacy combined (for backward compatibility)
  recommended_hooks: PhasePattern[];
  recommended_tones: PhasePattern[];
  recommended_formats: PhasePattern[];
  recommended_triggers: PhasePattern[];
  recommended_hours: TimingWindow[];
  strategy_notes: string[];
  // NEW: separated strategies
  reply_strategy: ContentTypeStrategy;
  content_strategy: ContentTypeStrategy;
}

export async function getPhaseAdvice(): Promise<PhaseAdvice | null> {
  const selfModel = await getSelfModel();
  if (!selfModel) {
    console.warn(`${LOG_PREFIX} No self-model — cannot advise`);
    return null;
  }

  const supabase = getSupabaseClient();
  const relevantTiers = PHASE_TO_RELEVANT_TIERS[selfModel.growth_phase];

  // Query brain_tweets joined with brain_classifications for relevant tiers
  // NOW includes tweet_type to separate reply patterns from content patterns
  const { data: classified } = await supabase
    .from('brain_classifications')
    .select(`
      hook_type,
      tone,
      format,
      emotional_trigger,
      brain_tweets!inner(
        likes,
        views,
        engagement_rate,
        author_tier,
        posted_hour_utc,
        tweet_type
      )
    `)
    .in('brain_tweets.author_tier', relevantTiers)
    .not('hook_type', 'is', null)
    .limit(3000);

  const emptyStrategy: ContentTypeStrategy = {
    recommended_hooks: [],
    recommended_tones: [],
    recommended_formats: [],
    recommended_triggers: [],
  };

  if (!classified || classified.length === 0) {
    console.log(`${LOG_PREFIX} No classified data for tiers ${relevantTiers.join(',')}`);
    return {
      growth_phase: selfModel.growth_phase,
      follower_count: selfModel.follower_count,
      relevant_tiers: relevantTiers,
      recommended_hooks: [],
      recommended_tones: [],
      recommended_formats: [],
      recommended_triggers: [],
      recommended_hours: [],
      strategy_notes: getPhaseNotes(selfModel.growth_phase),
      reply_strategy: emptyStrategy,
      content_strategy: emptyStrategy,
    };
  }

  // Flatten for aggregation — now includes tweet_type
  const rows = classified.map((c: any) => ({
    hook_type: c.hook_type,
    tone: c.tone,
    format: c.format,
    emotional_trigger: c.emotional_trigger,
    likes: c.brain_tweets?.likes ?? 0,
    views: c.brain_tweets?.views ?? 0,
    engagement_rate: c.brain_tweets?.engagement_rate ?? 0,
    author_tier: c.brain_tweets?.author_tier ?? 'C',
    posted_hour_utc: c.brain_tweets?.posted_hour_utc,
    tweet_type: c.brain_tweets?.tweet_type ?? 'original',
  }));

  // ── Split by tweet_type ──
  const replyRows = rows.filter(r => r.tweet_type === 'reply');
  const originalRows = rows.filter(r => r.tweet_type !== 'reply');

  console.log(`${LOG_PREFIX} Phase data: ${originalRows.length} originals + ${replyRows.length} replies (tiers: ${relevantTiers.join(',')})`);

  // ── Aggregate ALL (combined — backward compat) ──
  const recommendedHooks = aggregateByDimension(rows, 'hook_type', relevantTiers);
  const recommendedTones = aggregateByDimension(rows, 'tone', relevantTiers);
  const recommendedFormats = aggregateByDimension(rows, 'format', relevantTiers);
  const recommendedTriggers = aggregateByDimension(rows, 'emotional_trigger', relevantTiers);
  const recommendedHours = aggregateByHour(rows, relevantTiers);

  // ── Aggregate REPLIES only ──
  const replyStrategy: ContentTypeStrategy = {
    recommended_hooks: aggregateByDimension(replyRows, 'hook_type', relevantTiers),
    recommended_tones: aggregateByDimension(replyRows, 'tone', relevantTiers),
    recommended_formats: aggregateByDimension(replyRows, 'format', relevantTiers),
    recommended_triggers: aggregateByDimension(replyRows, 'emotional_trigger', relevantTiers),
  };

  // ── Aggregate ORIGINALS only ──
  const contentStrategy: ContentTypeStrategy = {
    recommended_hooks: aggregateByDimension(originalRows, 'hook_type', relevantTiers),
    recommended_tones: aggregateByDimension(originalRows, 'tone', relevantTiers),
    recommended_formats: aggregateByDimension(originalRows, 'format', relevantTiers),
    recommended_triggers: aggregateByDimension(originalRows, 'emotional_trigger', relevantTiers),
  };

  return {
    growth_phase: selfModel.growth_phase,
    follower_count: selfModel.follower_count,
    relevant_tiers: relevantTiers,
    recommended_hooks: recommendedHooks,
    recommended_tones: recommendedTones,
    recommended_formats: recommendedFormats,
    recommended_triggers: recommendedTriggers,
    recommended_hours: recommendedHours,
    strategy_notes: getPhaseNotes(selfModel.growth_phase),
    reply_strategy: replyStrategy,
    content_strategy: contentStrategy,
  };
}

// =============================================================================
// Aggregation helpers
// =============================================================================

function aggregateByDimension(
  rows: any[],
  dimension: string,
  relevantTiers: AccountTier[],
): PhasePattern[] {
  const groups: Record<string, { likes: number[]; views: number[]; ers: number[]; tiers: Set<string> }> = {};

  for (const row of rows) {
    const value = row[dimension];
    if (!value || value === 'other' || value === 'none') continue;

    if (!groups[value]) groups[value] = { likes: [], views: [], ers: [], tiers: new Set() };
    groups[value].likes.push(row.likes);
    groups[value].views.push(row.views);
    groups[value].ers.push(row.engagement_rate);
    groups[value].tiers.add(row.author_tier);
  }

  const patterns: PhasePattern[] = [];

  for (const [value, g] of Object.entries(groups)) {
    if (g.likes.length < MIN_SAMPLES) continue;

    const avgLikes = g.likes.reduce((s, v) => s + v, 0) / g.likes.length;
    const avgViews = g.views.reduce((s, v) => s + v, 0) / g.views.length;
    const avgER = g.ers.length > 0 ? g.ers.reduce((s, v) => s + v, 0) / g.ers.length : 0;

    // Determine confidence based on sample size and tier coverage
    const tierCount = g.tiers.size;
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (g.likes.length >= 20 && tierCount >= 2) confidence = 'high';
    else if (g.likes.length >= 10) confidence = 'medium';

    // Use lowest relevant tier for the recommendation
    const tierOrder: AccountTier[] = ['C', 'B', 'A', 'S'];
    const lowestTier = relevantTiers.sort(
      (a, b) => tierOrder.indexOf(a) - tierOrder.indexOf(b)
    )[0] ?? 'C';

    patterns.push({
      dimension,
      value,
      avg_engagement_rate: Math.round(avgER * 10000) / 10000,
      avg_views: Math.round(avgViews),
      avg_likes: Math.round(avgLikes * 10) / 10,
      sample_size: g.likes.length,
      account_tier: lowestTier,
      confidence,
    });
  }

  // Sort by engagement rate (best first)
  patterns.sort((a, b) => b.avg_engagement_rate - a.avg_engagement_rate);

  return patterns.slice(0, 10);
}

function aggregateByHour(rows: any[], relevantTiers: AccountTier[]): TimingWindow[] {
  const hourGroups: Record<number, { ers: number[]; views: number[] }> = {};

  for (const row of rows) {
    const hour = row.posted_hour_utc;
    if (hour === null || hour === undefined) continue;

    if (!hourGroups[hour]) hourGroups[hour] = { ers: [], views: [] };
    hourGroups[hour].ers.push(row.engagement_rate);
    hourGroups[hour].views.push(row.views);
  }

  const windows: TimingWindow[] = [];

  for (const [hourStr, g] of Object.entries(hourGroups)) {
    if (g.ers.length < MIN_SAMPLES) continue;

    const hour = Number(hourStr);
    const avgER = g.ers.reduce((s, v) => s + v, 0) / g.ers.length;
    const avgViews = g.views.reduce((s, v) => s + v, 0) / g.views.length;

    const lowestTier = relevantTiers[0] ?? 'C';

    // Sample-size-driven confidence. A "best hour" backed by 5 data points
    // is a guess; 50 data points is a signal. Downstream consumers can
    // filter out low-confidence timing windows when they want certainty.
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (g.ers.length >= 50) confidence = 'high';
    else if (g.ers.length >= 15) confidence = 'medium';

    windows.push({
      hour_utc: hour,
      day_of_week: null,
      avg_engagement_rate: Math.round(avgER * 10000) / 10000,
      avg_views: Math.round(avgViews),
      sample_size: g.ers.length,
      account_tier: lowestTier as AccountTier,
      confidence,
    });
  }

  windows.sort((a, b) => b.avg_engagement_rate - a.avg_engagement_rate);
  return windows.slice(0, 8);
}

// =============================================================================
// Phase-specific strategy notes
// =============================================================================

function getPhaseNotes(phase: GrowthPhase): string[] {
  switch (phase) {
    case 'cold_start':
      return [
        'Replies to bigger accounts are your primary growth lever — original posts get almost no organic reach.',
        'Focus on being USEFUL in replies: add data, add nuance, add a specific takeaway.',
        'Avoid threads — nobody scrolls threads from unknown accounts.',
        'Timing matters less at this stage — focus on quality and targeting the right accounts to reply to.',
        'Your goal is not views on your posts — it is profile clicks from your replies.',
      ];
    case 'early_traction':
      return [
        'Mix replies (60-70%) with original posts (30-40%) to start building your voice.',
        'Your followers are now seeing your originals — make them count.',
        'One-liners and short posts outperform long-form at this stage.',
        'Start testing different hooks and tones to find your voice.',
        'Track which reply targets convert to followers — double down on those account types.',
      ];
    case 'growth':
      return [
        'Shift toward more original content (50-60%) as your reach grows.',
        'Threads start becoming viable — you have enough followers to get them seen.',
        'Experiment with bold claims and contrarian takes — you have some social proof now.',
        'Timing starts to matter more — post during your proven best hours.',
        'Build authority in your niche — consistency of topic matters.',
      ];
    case 'authority':
      return [
        'Original posts should dominate (70%+). Your reach justifies it.',
        'Threads and long-form content perform well — you have the audience to support them.',
        'Reply strategically to even larger accounts — collaboration over competition.',
        'Your voice is established — lean into what makes you unique.',
        'Start thinking about cross-platform and collaboration amplifiers.',
      ];
    case 'scale':
      return [
        'You are the platform. Focus on unique insights and leadership content.',
        'Reply less, but when you do, reply to trending conversations for maximum visibility.',
        'Your engagement rate may drop as you scale — this is normal at your size.',
        'Focus on follower quality over quantity — engaged followers > passive followers.',
        'Consider Spaces, video, and cross-platform for the next growth phase.',
      ];
  }
}
