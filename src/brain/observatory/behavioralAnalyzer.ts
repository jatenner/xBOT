/**
 * Behavioral Analyzer
 *
 * DB-only job (no browser). Runs every 2 hours.
 *
 * Turns raw reply context data into statistical intelligence about
 * what behaviors correlate with growth at each follower range.
 *
 * Computes 4 types of analysis:
 * 1. Reply Success Model — what reply characteristics get the most engagement?
 * 2. Growth-Behavior Correlation — what behaviors change during growth events?
 * 3. Content Mix Model — what tweet type distribution correlates with growth?
 * 4. Timing Intelligence — what reply delays produce the best engagement?
 *
 * Writes to existing `external_patterns` table with new pattern_type values.
 * This means results flow automatically through the existing
 * external_patterns → tickAdvisor → intelligenceHelpers pipeline.
 */

import { getSupabaseClient } from '../../db';
import { FOLLOWER_RANGE_ORDER, getFollowerRange, type FollowerRange } from '../types';

const LOG_PREFIX = '[observatory/behavioral]';

export async function runBehavioralAnalyzer(): Promise<{
  patterns_written: number;
}> {
  const supabase = getSupabaseClient();
  let patternsWritten = 0;

  // =========================================================================
  // 1. Reply Timing Intelligence
  // =========================================================================
  try {
    const timingPatterns = await analyzeReplyTiming(supabase);
    for (const pattern of timingPatterns) {
      await upsertPattern(supabase, pattern);
      patternsWritten++;
    }
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Reply timing analysis error: ${err.message}`);
  }

  // =========================================================================
  // 2. Reply Target Size Intelligence
  // =========================================================================
  try {
    const targetPatterns = await analyzeReplyTargeting(supabase);
    for (const pattern of targetPatterns) {
      await upsertPattern(supabase, pattern);
      patternsWritten++;
    }
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Reply targeting analysis error: ${err.message}`);
  }

  // =========================================================================
  // 3. Content Mix Intelligence
  // =========================================================================
  try {
    const mixPatterns = await analyzeContentMix(supabase);
    for (const pattern of mixPatterns) {
      await upsertPattern(supabase, pattern);
      patternsWritten++;
    }
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Content mix analysis error: ${err.message}`);
  }

  // =========================================================================
  // 4. Growth-Behavior Correlation
  // =========================================================================
  try {
    const behaviorPatterns = await analyzeGrowthBehaviors(supabase);
    for (const pattern of behaviorPatterns) {
      await upsertPattern(supabase, pattern);
      patternsWritten++;
    }
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Growth behavior analysis error: ${err.message}`);
  }

  if (patternsWritten > 0) {
    console.log(`${LOG_PREFIX} Wrote ${patternsWritten} behavioral patterns`);
  }

  return { patterns_written: patternsWritten };
}

// =============================================================================
// Analysis 1: Reply Timing
// =============================================================================

async function analyzeReplyTiming(supabase: any): Promise<any[]> {
  // Get all reply tweets with delay data
  const { data: replies } = await supabase
    .from('brain_tweets')
    .select('likes, views, reply_delay_minutes, author_tier, author_followers')
    .eq('tweet_type', 'reply')
    .gt('reply_delay_minutes', 0)
    .not('likes', 'is', null)
    .limit(5000);

  if (!replies || replies.length < 20) return [];

  // Bucket by delay
  const buckets: Record<string, { likes: number[]; views: number[]; count: number }> = {
    '0-5min': { likes: [], views: [], count: 0 },
    '5-15min': { likes: [], views: [], count: 0 },
    '15-60min': { likes: [], views: [], count: 0 },
    '1h+': { likes: [], views: [], count: 0 },
  };

  for (const r of replies) {
    const delay = r.reply_delay_minutes;
    let bucket: string;
    if (delay <= 5) bucket = '0-5min';
    else if (delay <= 15) bucket = '5-15min';
    else if (delay <= 60) bucket = '15-60min';
    else bucket = '1h+';

    buckets[bucket].likes.push(r.likes ?? 0);
    buckets[bucket].views.push(r.views ?? 0);
    buckets[bucket].count++;
  }

  const patterns: any[] = [];
  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

  // Find the best-performing delay bucket
  const bucketScores = Object.entries(buckets)
    .filter(([, b]) => b.count >= 5)
    .map(([name, b]) => ({ name, avgLikes: avg(b.likes), avgViews: avg(b.views), count: b.count }))
    .sort((a, b) => b.avgLikes - a.avgLikes);

  for (const bucket of bucketScores) {
    const confidence = bucket.count >= 50 ? 'high' : bucket.count >= 20 ? 'medium' : 'low';
    const isTop = bucket === bucketScores[0];

    patterns.push({
      pattern_type: 'reply_timing',
      combo_key: `reply_timing:${bucket.name}`,
      hour_bucket: bucket.name,
      ext_sample_count: bucket.count,
      ext_avg_likes: Math.round(bucket.avgLikes * 10) / 10,
      ext_avg_views: Math.round(bucket.avgViews),
      combined_score: bucket.avgLikes,
      confidence,
      direction: isTop ? 'do_more' : bucket.avgLikes < bucketScores[0].avgLikes * 0.5 ? 'do_less' : 'neutral',
    });
  }

  return patterns;
}

// =============================================================================
// Analysis 2: Reply Target Size
// =============================================================================

async function analyzeReplyTargeting(supabase: any): Promise<any[]> {
  const { data: replies } = await supabase
    .from('brain_tweets')
    .select('likes, views, reply_target_followers, author_followers')
    .eq('tweet_type', 'reply')
    .not('reply_target_followers', 'is', null)
    .not('author_followers', 'is', null)
    .gt('reply_target_followers', 0)
    .limit(5000);

  if (!replies || replies.length < 20) return [];

  // Bucket by ratio: target_followers / author_followers
  const buckets: Record<string, { likes: number[]; count: number }> = {
    'peer': { likes: [], count: 0 },        // 0.5x - 2x our size
    'bigger_2-10x': { likes: [], count: 0 }, // 2x - 10x
    'bigger_10-100x': { likes: [], count: 0 }, // 10x - 100x
    'mega_100x+': { likes: [], count: 0 },   // 100x+
    'smaller': { likes: [], count: 0 },       // < 0.5x our size
  };

  for (const r of replies) {
    if (!r.author_followers || r.author_followers === 0) continue;
    const ratio = r.reply_target_followers / r.author_followers;

    let bucket: string;
    if (ratio < 0.5) bucket = 'smaller';
    else if (ratio <= 2) bucket = 'peer';
    else if (ratio <= 10) bucket = 'bigger_2-10x';
    else if (ratio <= 100) bucket = 'bigger_10-100x';
    else bucket = 'mega_100x+';

    buckets[bucket].likes.push(r.likes ?? 0);
    buckets[bucket].count++;
  }

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  const patterns: any[] = [];

  const bucketScores = Object.entries(buckets)
    .filter(([, b]) => b.count >= 5)
    .map(([name, b]) => ({ name, avgLikes: avg(b.likes), count: b.count }))
    .sort((a, b) => b.avgLikes - a.avgLikes);

  for (const bucket of bucketScores) {
    const confidence = bucket.count >= 50 ? 'high' : bucket.count >= 20 ? 'medium' : 'low';
    const isTop = bucket === bucketScores[0];

    patterns.push({
      pattern_type: 'reply_targeting',
      combo_key: `reply_targeting:${bucket.name}`,
      target_tier: bucket.name,
      ext_sample_count: bucket.count,
      ext_avg_likes: Math.round(bucket.avgLikes * 10) / 10,
      combined_score: bucket.avgLikes,
      confidence,
      direction: isTop ? 'do_more' : bucket.avgLikes < bucketScores[0].avgLikes * 0.3 ? 'do_less' : 'neutral',
    });
  }

  return patterns;
}

// =============================================================================
// Analysis 3: Content Mix (tweet type distribution per follower range)
// =============================================================================

async function analyzeContentMix(supabase: any): Promise<any[]> {
  const patterns: any[] = [];

  for (const range of FOLLOWER_RANGE_ORDER) {
    // Get growing accounts in this range
    const { data: growingAccounts } = await supabase
      .from('brain_accounts')
      .select('username')
      .eq('follower_range', range)
      .in('growth_status', ['interesting', 'hot', 'explosive'])
      .limit(50);

    if (!growingAccounts || growingAccounts.length < 3) continue;

    // Get their tweet type distribution
    const usernames = growingAccounts.map((a: any) => a.username);
    const { data: tweets } = await supabase
      .from('brain_tweets')
      .select('tweet_type')
      .in('author_username', usernames)
      .limit(2000);

    if (!tweets || tweets.length < 20) continue;

    const total = tweets.length;
    const replyCount = tweets.filter((t: any) => t.tweet_type === 'reply').length;
    const threadCount = tweets.filter((t: any) => t.tweet_type === 'thread').length;
    const originalCount = total - replyCount - threadCount;

    const replyPct = Math.round((replyCount / total) * 100);
    const threadPct = Math.round((threadCount / total) * 100);
    const originalPct = 100 - replyPct - threadPct;

    patterns.push({
      pattern_type: 'content_mix',
      combo_key: `content_mix:${range}`,
      target_tier: range,
      ext_sample_count: growingAccounts.length,
      ext_avg_engagement_rate: replyPct / 100, // Repurpose: reply ratio
      ext_avg_likes: threadPct, // Repurpose: thread %
      ext_avg_views: originalPct, // Repurpose: original %
      combined_score: growingAccounts.length, // More data = higher score
      confidence: growingAccounts.length >= 10 ? 'high' : growingAccounts.length >= 5 ? 'medium' : 'low',
      direction: 'do_more',
    });
  }

  return patterns;
}

// =============================================================================
// Analysis 4: Growth-Behavior Correlation
// =============================================================================

async function analyzeGrowthBehaviors(supabase: any): Promise<any[]> {
  // Get retrospectives that have before/during stats
  const { data: retros } = await supabase
    .from('brain_retrospective_analyses')
    .select('before_stats, during_stats, follower_range_at_growth')
    .not('before_stats', 'is', null)
    .not('during_stats', 'is', null)
    .limit(200);

  if (!retros || retros.length < 5) return [];

  const patterns: any[] = [];

  // Aggregate behavioral shifts across all growth events
  const shifts = {
    reply_ratio_increase: 0,
    reply_ratio_decrease: 0,
    volume_increase: 0,
    volume_decrease: 0,
    total: 0,
  };

  for (const retro of retros) {
    const before = retro.before_stats;
    const during = retro.during_stats;
    if (!before || !during) continue;

    shifts.total++;

    if ((during.reply_ratio ?? 0) > (before.reply_ratio ?? 0) + 0.1) shifts.reply_ratio_increase++;
    if ((during.reply_ratio ?? 0) < (before.reply_ratio ?? 0) - 0.1) shifts.reply_ratio_decrease++;
    if ((during.tweets_per_day ?? 0) > (before.tweets_per_day ?? 0) * 1.3) shifts.volume_increase++;
    if ((during.tweets_per_day ?? 0) < (before.tweets_per_day ?? 0) * 0.7) shifts.volume_decrease++;
  }

  if (shifts.total >= 5) {
    // Reply ratio shift pattern
    if (shifts.reply_ratio_increase > shifts.reply_ratio_decrease) {
      patterns.push({
        pattern_type: 'reply_behavior',
        combo_key: 'reply_behavior:reply_ratio_increase_during_growth',
        ext_sample_count: shifts.total,
        ext_breakout_rate: shifts.reply_ratio_increase / shifts.total,
        combined_score: shifts.reply_ratio_increase / shifts.total,
        confidence: shifts.total >= 20 ? 'high' : shifts.total >= 10 ? 'medium' : 'low',
        direction: 'do_more',
      });
    }

    // Volume shift pattern
    if (shifts.volume_increase > shifts.volume_decrease) {
      patterns.push({
        pattern_type: 'reply_behavior',
        combo_key: 'reply_behavior:volume_increase_during_growth',
        ext_sample_count: shifts.total,
        ext_breakout_rate: shifts.volume_increase / shifts.total,
        combined_score: shifts.volume_increase / shifts.total,
        confidence: shifts.total >= 20 ? 'high' : shifts.total >= 10 ? 'medium' : 'low',
        direction: 'do_more',
      });
    }
  }

  return patterns;
}

// =============================================================================
// Helpers
// =============================================================================

async function upsertPattern(supabase: any, pattern: any): Promise<void> {
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from('external_patterns')
    .select('id, update_count')
    .eq('combo_key', pattern.combo_key)
    .single();

  if (existing) {
    await supabase
      .from('external_patterns')
      .update({
        ...pattern,
        last_updated_at: now,
        update_count: (existing.update_count ?? 0) + 1,
      })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('external_patterns')
      .insert({
        ...pattern,
        last_updated_at: now,
        update_count: 1,
      });
  }
}
