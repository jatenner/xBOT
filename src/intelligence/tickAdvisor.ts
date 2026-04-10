/**
 * Tick Advisor
 *
 * Consulted every tick to provide actionable recommendations for the strategy
 * layer. Reads from the `external_patterns` table (populated by patternAggregator)
 * and surfaces what's working, what to avoid, and experiment nudges.
 *
 * Results are cached for 5 minutes to avoid DB pressure.
 * This module should NEVER crash — all queries are wrapped in try/catch with
 * sensible defaults.
 */

import { getSupabaseClient } from '../db/index';
import { getCurrentFollowerCount } from '../tracking/followerCountTracker';

const TAG = '[TICK_ADVISOR]';

function computeStage(followers: number): string {
  if (followers < 500) return 'bootstrap';
  if (followers < 2000) return 'early';
  if (followers < 10000) return 'growth';
  return 'established';
}

// ─── Types ───

export interface TickAdvice {
  reply_preferences: {
    preferred_angles: string[];
    preferred_tones: string[];
    preferred_formats: string[];
    ideal_length_range: [number, number];
    ideal_delay_minutes_max: number;
    avoid_angles: string[];
    optimal_target_follower_range?: [number, number];
    optimal_reply_delay_minutes?: number;
  };
  content_preferences: {
    preferred_formats: string[];
    preferred_angles: string[];
    hot_topics: string[];
  };
  targeting_preferences: {
    preferred_tiers: string[];
    preferred_hour_buckets: string[];
  };
  recommended_content_mix?: {
    reply_pct: number;
    original_pct: number;
    thread_pct: number;
    source_range: string;
    confidence: string;
  };
  experiment_nudge?: {
    hypothesis_id: string;
    suggested_condition: Record<string, any>;
    reason: string;
  };
  top_insights: string[];
  confidence: number;
  our_stage: string;
  generated_at: string;
}

// ─── Cache ───

let cachedAdvice: TickAdvice | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Helpers ───

function uniqueNonAny(values: (string | null | undefined)[]): string[] {
  const set = new Set<string>();
  for (const v of values) {
    if (v && v !== 'any') set.add(v);
  }
  return Array.from(set);
}

function confidenceToNumber(c: string): number {
  if (c === 'high') return 1.0;
  if (c === 'medium') return 0.6;
  return 0.3;
}

function defaultAdvice(): TickAdvice {
  return {
    reply_preferences: {
      preferred_angles: [],
      preferred_tones: [],
      preferred_formats: [],
      ideal_length_range: [80, 240],
      ideal_delay_minutes_max: 60,
      avoid_angles: [],
    },
    content_preferences: {
      preferred_formats: [],
      preferred_angles: [],
      hot_topics: [],
    },
    targeting_preferences: {
      preferred_tiers: [],
      preferred_hour_buckets: [],
    },
    top_insights: [],
    confidence: 0,
    our_stage: 'bootstrap',
    generated_at: new Date().toISOString(),
  };
}

// ─── Main ───

export async function getTickAdvice(): Promise<TickAdvice> {
  // Check cache
  if (cachedAdvice && Date.now() - cacheTime < CACHE_TTL_MS) {
    return cachedAdvice;
  }

  const advice = defaultAdvice();

  try {
    const supabase = getSupabaseClient();

    // Determine current growth stage
    const followerCount = await getCurrentFollowerCount();
    const ourStage = computeStage(followerCount);
    advice.our_stage = ourStage;

    // ─── Step 2: "do_more" patterns (medium/high confidence), stage-filtered ───
    let doMorePatterns: any[] = [];
    try {
      // Try stage-filtered first
      const { data: stageData, error: stageErr } = await supabase
        .from('external_patterns')
        .select('pattern_type, angle, tone, format, hour_bucket, topic, target_tier, combined_score, confidence, causal_status, avg_recency_days')
        .eq('direction', 'do_more')
        .eq('our_stage', ourStage)
        .in('confidence', ['medium', 'high'])
        .order('combined_score', { ascending: false })
        .limit(50);

      if (!stageErr && stageData && stageData.length >= 3) {
        doMorePatterns = stageData;
      } else {
        // Fall back to unfiltered
        const { data, error } = await supabase
          .from('external_patterns')
          .select('pattern_type, angle, tone, format, hour_bucket, topic, target_tier, combined_score, confidence, causal_status, avg_recency_days')
          .eq('direction', 'do_more')
          .in('confidence', ['medium', 'high'])
          .order('combined_score', { ascending: false })
          .limit(50);

        if (!error && data) doMorePatterns = data;
      }
    } catch (e: any) {
      console.warn(`${TAG} do_more query failed: ${e.message}`);
    }

    // Extract top angles, tones, formats from do_more patterns
    const doMoreAngles = uniqueNonAny(doMorePatterns.map(p => p.angle));
    const doMoreTones = uniqueNonAny(doMorePatterns.map(p => p.tone));
    const doMoreFormats = uniqueNonAny(doMorePatterns.map(p => p.format));
    const doMoreTopics = uniqueNonAny(doMorePatterns.map(p => p.topic));
    const doMoreTiers = uniqueNonAny(doMorePatterns.map(p => p.target_tier));
    const doMoreHours = uniqueNonAny(doMorePatterns.map(p => p.hour_bucket));

    advice.content_preferences.preferred_angles = doMoreAngles.slice(0, 5);
    advice.content_preferences.preferred_formats = doMoreFormats.slice(0, 5);
    advice.content_preferences.hot_topics = doMoreTopics.slice(0, 5);
    advice.targeting_preferences.preferred_tiers = doMoreTiers.slice(0, 3);
    advice.targeting_preferences.preferred_hour_buckets = doMoreHours.slice(0, 3);

    // ─── Step 3: "do_less" patterns (avoid list) ───
    let doLessPatterns: any[] = [];
    try {
      const { data, error } = await supabase
        .from('external_patterns')
        .select('angle, tone, format, causal_status, avg_recency_days')
        .eq('direction', 'do_less')
        .limit(30);

      if (!error && data) doLessPatterns = data;
    } catch (e: any) {
      console.warn(`${TAG} do_less query failed: ${e.message}`);
    }

    const avoidAngles = uniqueNonAny(doLessPatterns.map(p => p.angle));

    // ─── Step 4: Reply-specific patterns ───
    let replyDoMore: any[] = [];
    try {
      const { data, error } = await supabase
        .from('external_patterns')
        .select('angle, tone, format, ext_avg_reply_likes, combined_score, confidence, causal_status, avg_recency_days')
        .eq('pattern_type', 'reply')
        .eq('direction', 'do_more')
        .order('combined_score', { ascending: false })
        .limit(20);

      if (!error && data) replyDoMore = data;
    } catch (e: any) {
      console.warn(`${TAG} reply do_more query failed: ${e.message}`);
    }

    const replyAngles = uniqueNonAny(replyDoMore.map(p => p.angle));
    const replyTones = uniqueNonAny(replyDoMore.map(p => p.tone));
    const replyFormats = uniqueNonAny(replyDoMore.map(p => p.format));

    advice.reply_preferences.preferred_angles = replyAngles.slice(0, 5);
    advice.reply_preferences.preferred_tones = replyTones.slice(0, 5);
    advice.reply_preferences.preferred_formats = replyFormats.slice(0, 5);
    advice.reply_preferences.avoid_angles = avoidAngles.slice(0, 5);

    // Ideal length: default 80-240, adjust if top reply patterns have char_count data
    // (external_patterns doesn't store char_count directly, keep default)
    advice.reply_preferences.ideal_length_range = [80, 240];
    advice.reply_preferences.ideal_delay_minutes_max = 60;

    // ─── Step 4b: Behavioral intelligence (reply timing, targeting, content mix) ───
    try {
      // Reply timing: which delay bucket performs best?
      const { data: timingPatterns } = await supabase
        .from('external_patterns')
        .select('hour_bucket, ext_avg_likes, ext_sample_count, direction, confidence')
        .eq('pattern_type', 'reply_timing')
        .eq('direction', 'do_more')
        .order('ext_avg_likes', { ascending: false })
        .limit(1);

      if (timingPatterns && timingPatterns.length > 0) {
        const best = timingPatterns[0];
        // Map bucket name to delay value
        const delayMap: Record<string, number> = { '0-5min': 5, '5-15min': 15, '15-60min': 60, '1h+': 120 };
        const optimalDelay = delayMap[best.hour_bucket] ?? 60;
        advice.reply_preferences.optimal_reply_delay_minutes = optimalDelay;
        advice.reply_preferences.ideal_delay_minutes_max = optimalDelay;

        if (best.confidence !== 'low') {
          advice.top_insights.push(`⚡ Replies within ${best.hour_bucket} get the most engagement (${best.ext_sample_count} samples)`);
        }
      }

      // Reply targeting: which target size ratio works best?
      const { data: targetPatterns } = await supabase
        .from('external_patterns')
        .select('target_tier, ext_avg_likes, ext_sample_count, direction, confidence')
        .eq('pattern_type', 'reply_targeting')
        .eq('direction', 'do_more')
        .order('ext_avg_likes', { ascending: false })
        .limit(1);

      if (targetPatterns && targetPatterns.length > 0) {
        const best = targetPatterns[0];
        // Map target tier to follower range
        const rangeMap: Record<string, [number, number]> = {
          'peer': [0, 2],
          'bigger_2-10x': [2, 10],
          'bigger_10-100x': [10, 100],
          'mega_100x+': [100, 1000],
          'smaller': [0, 0.5],
        };
        const range = rangeMap[best.target_tier];
        if (range) {
          advice.reply_preferences.optimal_target_follower_range = range;
        }

        if (best.confidence !== 'low') {
          advice.top_insights.push(`🎯 Best reply targets: accounts ${best.target_tier} your size (${best.ext_sample_count} samples)`);
        }
      }

      // Content mix: optimal reply/original/thread ratio for our range
      const { data: mixPatterns } = await supabase
        .from('external_patterns')
        .select('target_tier, ext_avg_engagement_rate, ext_avg_likes, ext_avg_views, ext_sample_count, confidence')
        .eq('pattern_type', 'content_mix')
        .eq('direction', 'do_more')
        .order('ext_sample_count', { ascending: false })
        .limit(1);

      if (mixPatterns && mixPatterns.length > 0) {
        const mix = mixPatterns[0];
        advice.recommended_content_mix = {
          reply_pct: Math.round((mix.ext_avg_engagement_rate ?? 0.7) * 100),
          thread_pct: Math.round(mix.ext_avg_likes ?? 10),
          original_pct: Math.round(mix.ext_avg_views ?? 20),
          source_range: mix.target_tier ?? 'unknown',
          confidence: mix.confidence ?? 'low',
        };
      }
    } catch (e: any) {
      // Behavioral intelligence is non-fatal
      console.warn(`${TAG} Behavioral enrichment skipped: ${e.message}`);
    }

    // ─── Step 5: growth_knowledge insights + causal labels from patterns ───
    try {
      const { data, error } = await supabase
        .from('growth_knowledge')
        .select('insight, actionable_guidance, confidence')
        .order('confidence', { ascending: false })
        .limit(5);

      if (!error && data && data.length > 0) {
        advice.top_insights = data.map(row => {
          const parts: string[] = [];
          if (row.insight) parts.push(row.insight);
          if (row.actionable_guidance) parts.push(`Action: ${row.actionable_guidance}`);
          return parts.join(' — ') || 'No insight text';
        });
      }
    } catch (e: any) {
      console.warn(`${TAG} growth_knowledge query failed: ${e.message}`);
    }

    // Enrich top_insights with causal labels and recency from do_more patterns
    try {
      for (const p of doMorePatterns.slice(0, 10)) {
        // Skip internally_rejected patterns entirely
        if (p.causal_status === 'internally_rejected') continue;

        const dims: string[] = [];
        if (p.angle) dims.push(p.angle);
        if (p.tone) dims.push(p.tone);
        if (p.format) dims.push(p.format);
        if (dims.length === 0) continue;

        let label = '';
        if (p.causal_status === 'internally_confirmed') label = ' [confirmed]';
        else if (p.causal_status === 'tested_candidate') label = ' [testing]';
        else label = ' [correlation only]';

        let recencyTag = '';
        if (p.avg_recency_days != null) {
          if (p.avg_recency_days > 21) recencyTag = ' (stale signal)';
          else if (p.avg_recency_days < 7) recencyTag = ' (fresh)';
        }

        advice.top_insights.push(`${dims.join('/')}${label}${recencyTag}`);
      }
      // Keep only top 10 insights
      advice.top_insights = advice.top_insights.slice(0, 10);
    } catch (e: any) {
      console.warn(`${TAG} causal label enrichment failed (non-fatal): ${e.message}`);
    }

    // ─── Step 6: Experiment nudge ───
    try {
      const { data, error } = await supabase
        .from('external_hypotheses')
        .select('id, hypothesis, suggested_condition, reason')
        .eq('status', 'untested')
        .eq('is_active', true)
        .limit(1);

      if (!error && data && data.length > 0) {
        const h = data[0];
        advice.experiment_nudge = {
          hypothesis_id: h.id,
          suggested_condition: h.suggested_condition || {},
          reason: h.reason || h.hypothesis || 'Untested hypothesis available',
        };
      }
    } catch (e: any) {
      console.warn(`${TAG} external_hypotheses query failed: ${e.message}`);
    }

    // ─── Step 7: Brain v2 enrichment ───
    // Pull recommendations from the external brain (if available).
    // Brain provides tier-calibrated patterns that supplement the external_patterns data.
    try {
      const { brainQuery } = await import('../brain/brainQuery');

      // Phase-calibrated patterns (only recommends what works at our size)
      const phaseAdvice = await brainQuery.getTopPatternsForOurPhase();
      if (phaseAdvice) {
        // Merge brain-recommended hooks/tones/formats into advice
        // Brain recommendations are ADDITIVE — they don't replace external_patterns data
        const brainHooks = phaseAdvice.recommended_hooks.map(h => h.value);
        const brainTones = phaseAdvice.recommended_tones.map(t => t.value);
        const brainFormats = phaseAdvice.recommended_formats.map(f => f.value);

        if (brainHooks.length > 0) {
          // Add brain hooks to front of list (higher priority since they're tier-calibrated)
          advice.reply_preferences.preferred_angles = uniqueNonAny([...brainHooks, ...advice.reply_preferences.preferred_angles]).slice(0, 7);
          advice.content_preferences.preferred_angles = uniqueNonAny([...brainHooks, ...advice.content_preferences.preferred_angles]).slice(0, 7);
        }
        if (brainTones.length > 0) {
          advice.reply_preferences.preferred_tones = uniqueNonAny([...brainTones, ...advice.reply_preferences.preferred_tones]).slice(0, 7);
        }
        if (brainFormats.length > 0) {
          advice.reply_preferences.preferred_formats = uniqueNonAny([...brainFormats, ...advice.reply_preferences.preferred_formats]).slice(0, 7);
          advice.content_preferences.preferred_formats = uniqueNonAny([...brainFormats, ...advice.content_preferences.preferred_formats]).slice(0, 7);
        }

        // Add brain strategy notes as insights
        if (phaseAdvice.strategy_notes.length > 0) {
          advice.top_insights.push(...phaseAdvice.strategy_notes.slice(0, 2).map(n => `🧠 ${n}`));
        }

        console.log(`${TAG} Brain enrichment: +${brainHooks.length} hooks, +${brainTones.length} tones, +${brainFormats.length} formats (phase: ${phaseAdvice.growth_phase})`);
      }

      // Optimal timing from brain data
      const brainTiming = await brainQuery.getOptimalTimingWindows();
      if (brainTiming.length > 0) {
        const brainHours = brainTiming.slice(0, 3).map(w => {
          if (w.hour_utc < 6) return 'night';
          if (w.hour_utc < 12) return 'morning';
          if (w.hour_utc < 17) return 'midday';
          if (w.hour_utc < 21) return 'afternoon';
          return 'evening';
        });
        advice.targeting_preferences.preferred_hour_buckets = uniqueNonAny([
          ...brainHours,
          ...advice.targeting_preferences.preferred_hour_buckets,
        ]).slice(0, 5);
      }

      // Trending topics from brain
      const trending = await brainQuery.getTrendingTopics(5);
      if (trending.length > 0) {
        const trendingKeywords = trending.map(t => t.keyword);
        advice.content_preferences.hot_topics = uniqueNonAny([
          ...trendingKeywords,
          ...advice.content_preferences.hot_topics,
        ]).slice(0, 7);
      }
    } catch (e: any) {
      // Brain enrichment is non-fatal — tick advisor works fine without it
      console.warn(`${TAG} Brain enrichment skipped: ${e.message}`);
    }

    // ─── Step 7b: Growth Observatory enrichment ───
    // Pull strategy playbook from the observatory — what growing accounts
    // at our stage actually did to grow. This is the most actionable intelligence.
    try {
      const { brainQuery } = await import('../brain/brainQuery');

      const playbook = await brainQuery.getGrowthPlaybook();
      if (playbook.length > 0) {
        // Find the reply strategy
        const replyStrategy = playbook.find((s: any) => s.strategy_category === 'reply_targeting');
        if (replyStrategy?.winning_patterns) {
          const wp = replyStrategy.winning_patterns;
          if (wp.common_targets && Array.isArray(wp.common_targets)) {
            advice.top_insights.push(`🔭 Growing accounts reply to: @${wp.common_targets.slice(0, 3).join(', @')}`);
          }
          if (wp.reply_ratio) {
            advice.top_insights.push(`🔭 Growing accounts reply ${(wp.reply_ratio * 100).toFixed(0)}% of the time (win rate: ${((replyStrategy.win_rate ?? 0) * 100).toFixed(0)}%)`);
          }
        }

        // Find the content style strategy
        const contentStrategy = playbook.find((s: any) => s.strategy_category === 'content_style');
        if (contentStrategy?.winning_patterns) {
          const wp = contentStrategy.winning_patterns;
          if (wp.avg_word_count) {
            advice.top_insights.push(`🔭 Growing accounts avg ${wp.avg_word_count} words/tweet, ${wp.tweets_per_day}/day`);
          }
        }

        // Find the timing strategy
        const timingStrategy = playbook.find((s: any) => s.strategy_category === 'timing');
        if (timingStrategy?.winning_patterns?.active_hours_utc) {
          const hours = timingStrategy.winning_patterns.active_hours_utc;
          const buckets = hours.slice(0, 3).map((h: number) => {
            if (h < 6) return 'night';
            if (h < 12) return 'morning';
            if (h < 17) return 'midday';
            if (h < 21) return 'afternoon';
            return 'evening';
          });
          advice.targeting_preferences.preferred_hour_buckets = uniqueNonAny([
            ...buckets,
            ...advice.targeting_preferences.preferred_hour_buckets,
          ]).slice(0, 5);
        }

        console.log(`${TAG} Observatory enrichment: ${playbook.length} strategies from growth playbook`);
      }

      // Key differentiators as insights
      const insights = await brainQuery.getRetrospectiveInsights();
      for (const insight of (insights ?? []).slice(0, 2)) {
        if (insight.analysis_summary) {
          advice.top_insights.push(`🔭 ${insight.analysis_summary.substring(0, 120)}`);
        }
      }
    } catch (e: any) {
      // Observatory enrichment is non-fatal
      console.warn(`${TAG} Observatory enrichment skipped: ${e.message}`);
    }

    // Keep insights manageable
    advice.top_insights = advice.top_insights.slice(0, 15);

    // ─── Step 8: Overall confidence ───
    const allConfidences = doMorePatterns.map(p => confidenceToNumber(p.confidence));
    if (replyDoMore.length > 0) {
      for (const p of replyDoMore) allConfidences.push(confidenceToNumber(p.confidence));
    }
    if (allConfidences.length > 0) {
      advice.confidence = Math.round(
        (allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length) * 100
      ) / 100;
    }

    advice.generated_at = new Date().toISOString();

  } catch (err: any) {
    // Top-level catch: never crash
    console.error(`${TAG} Fatal error in getTickAdvice, returning defaults: ${err.message}`);
    const fallback = defaultAdvice();
    cachedAdvice = fallback;
    cacheTime = Date.now();
    return fallback;
  }

  // Cache and return
  cachedAdvice = advice;
  cacheTime = Date.now();

  const patternCount = advice.content_preferences.preferred_angles.length +
    advice.reply_preferences.preferred_angles.length;
  console.log(`${TAG} Advice generated: ${patternCount} preferred dimensions, confidence=${advice.confidence}, insights=${advice.top_insights.length}`);

  return advice;
}

/**
 * Force-clear the cache (useful after runPatternAggregation completes).
 */
export function clearTickAdviceCache(): void {
  cachedAdvice = null;
  cacheTime = 0;
}
