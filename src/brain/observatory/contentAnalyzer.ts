/**
 * Content Analyzer
 *
 * LAYER 1: What is good content?
 *
 * Looks at ALL tweets across ALL accounts and finds patterns in what
 * gets high engagement relative to the author's size.
 *
 * Groups tweets by dimensions (hook type, tone, format, word count range,
 * posting hour, has media, etc.) and computes which combinations outperform.
 *
 * Outputs:
 * - Best performing content patterns by account tier
 * - Worst performing patterns to avoid
 * - Structural insights (optimal word count, best opening patterns, etc.)
 * - Breakout tweet examples (3x+ outperformance) with full text
 * - Flop tweet examples (0.2x underperformance) for contrast
 *
 * Runs every 4 hours.
 */

import { getSupabaseClient } from '../../db';

const LOG_PREFIX = '[observatory/content-analyzer]';

export interface ContentInsight {
  dimension: string;
  value: string;
  sample_size: number;
  avg_outperformance: number;
  avg_likes: number;
  account_tier: string;
  examples: { content: string; likes: number; author: string; outperformance: number }[];
}

export async function runContentAnalyzer(): Promise<{
  patterns_found: number;
  breakout_tweets: number;
  flop_tweets: number;
}> {
  const supabase = getSupabaseClient();

  // Get tweets that have outperformance ratios AND classifications
  const { data: classified } = await supabase
    .from('brain_classifications')
    .select(`
      tweet_id, hook_type, tone, format, emotional_trigger, specificity,
      brain_tweets!inner(
        content, likes, retweets, bookmarks, viral_multiplier,
        author_username, author_tier, posted_hour_utc, tweet_type,
        content_features
      )
    `)
    .not('hook_type', 'is', null)
    .limit(5000);

  if (!classified || classified.length < 20) {
    console.log(`${LOG_PREFIX} Not enough classified tweets (${classified?.length ?? 0})`);
    return { patterns_found: 0, breakout_tweets: 0, flop_tweets: 0 };
  }

  // Also get unclassified tweets that have outperformance data
  // These give us structural patterns (word count, length, etc.) even without AI labels
  const { data: allTweets } = await supabase
    .from('brain_tweets')
    .select('tweet_id, content, likes, viral_multiplier, author_username, author_tier, posted_hour_utc, tweet_type, content_features')
    .not('viral_multiplier', 'is', null)
    .gt('viral_multiplier', 0)
    .limit(10000);

  const insights: ContentInsight[] = [];

  // ─── Classified patterns (hook, tone, format, trigger) ───

  const dimensions = ['hook_type', 'tone', 'format', 'emotional_trigger'];

  for (const dim of dimensions) {
    const groups: Record<string, any[]> = {};

    for (const c of classified) {
      const val = (c as any)[dim];
      if (!val || val === 'other' || val === 'none') continue;
      const tier = (c as any).brain_tweets?.author_tier ?? 'all';
      const key = `${val}|${tier}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    }

    for (const [key, tweets] of Object.entries(groups)) {
      if (tweets.length < 3) continue;
      const [value, tier] = key.split('|');

      const outperformances = tweets
        .map((t: any) => t.brain_tweets?.viral_multiplier ?? 1)
        .filter((o: number) => o > 0);

      if (outperformances.length === 0) continue;

      const avgOutperformance = outperformances.reduce((s: number, o: number) => s + o, 0) / outperformances.length;
      const avgLikes = tweets.reduce((s: number, t: any) => s + ((t as any).brain_tweets?.likes ?? 0), 0) / tweets.length;

      // Get examples (best and worst)
      const sorted = [...tweets].sort((a: any, b: any) =>
        ((b as any).brain_tweets?.viral_multiplier ?? 0) - ((a as any).brain_tweets?.viral_multiplier ?? 0)
      );

      const examples = sorted.slice(0, 3).map((t: any) => ({
        content: ((t as any).brain_tweets?.content ?? '').substring(0, 200),
        likes: (t as any).brain_tweets?.likes ?? 0,
        author: (t as any).brain_tweets?.author_username ?? '',
        outperformance: (t as any).brain_tweets?.viral_multiplier ?? 0,
      }));

      insights.push({
        dimension: dim,
        value,
        sample_size: tweets.length,
        avg_outperformance: Math.round(avgOutperformance * 100) / 100,
        avg_likes: Math.round(avgLikes),
        account_tier: tier,
        examples,
      });
    }
  }

  // ─── Structural patterns (word count, reply vs original, posting hour) ───

  if (allTweets && allTweets.length > 20) {
    // Word count buckets
    const wordBuckets: Record<string, number[]> = {
      '1-20': [], '21-40': [], '41-60': [], '61-80': [], '81-120': [], '121+': [],
    };

    for (const t of allTweets) {
      const wc = t.content ? t.content.split(/\s+/).length : 0;
      const op = t.viral_multiplier ?? 1;
      if (wc <= 20) wordBuckets['1-20'].push(op);
      else if (wc <= 40) wordBuckets['21-40'].push(op);
      else if (wc <= 60) wordBuckets['41-60'].push(op);
      else if (wc <= 80) wordBuckets['61-80'].push(op);
      else if (wc <= 120) wordBuckets['81-120'].push(op);
      else wordBuckets['121+'].push(op);
    }

    for (const [bucket, ops] of Object.entries(wordBuckets)) {
      if (ops.length < 5) continue;
      const avg = ops.reduce((s, o) => s + o, 0) / ops.length;
      insights.push({
        dimension: 'word_count_range',
        value: bucket,
        sample_size: ops.length,
        avg_outperformance: Math.round(avg * 100) / 100,
        avg_likes: 0,
        account_tier: 'all',
        examples: [],
      });
    }

    // Reply vs original
    const typeGroups: Record<string, number[]> = {};
    for (const t of allTweets) {
      const type = t.tweet_type ?? 'original';
      if (!typeGroups[type]) typeGroups[type] = [];
      typeGroups[type].push(t.viral_multiplier ?? 1);
    }

    for (const [type, ops] of Object.entries(typeGroups)) {
      if (ops.length < 5) continue;
      const avg = ops.reduce((s, o) => s + o, 0) / ops.length;
      insights.push({
        dimension: 'tweet_type',
        value: type,
        sample_size: ops.length,
        avg_outperformance: Math.round(avg * 100) / 100,
        avg_likes: 0,
        account_tier: 'all',
        examples: [],
      });
    }

    // Posting hour
    const hourGroups: Record<string, number[]> = {};
    for (const t of allTweets) {
      if (t.posted_hour_utc === null || t.posted_hour_utc === undefined) continue;
      const h = String(t.posted_hour_utc);
      if (!hourGroups[h]) hourGroups[h] = [];
      hourGroups[h].push(t.viral_multiplier ?? 1);
    }

    for (const [hour, ops] of Object.entries(hourGroups)) {
      if (ops.length < 5) continue;
      const avg = ops.reduce((s, o) => s + o, 0) / ops.length;
      insights.push({
        dimension: 'posting_hour_utc',
        value: hour,
        sample_size: ops.length,
        avg_outperformance: Math.round(avg * 100) / 100,
        avg_likes: 0,
        account_tier: 'all',
        examples: [],
      });
    }

    // Opening pattern (first word)
    const openingGroups: Record<string, number[]> = {};
    for (const t of allTweets) {
      if (!t.content_features) continue;
      const opening = (t.content_features as any).opening_word;
      if (!opening) continue;
      if (!openingGroups[opening]) openingGroups[opening] = [];
      openingGroups[opening].push(t.viral_multiplier ?? 1);
    }

    for (const [word, ops] of Object.entries(openingGroups)) {
      if (ops.length < 5) continue;
      const avg = ops.reduce((s, o) => s + o, 0) / ops.length;
      insights.push({
        dimension: 'opening_word',
        value: word,
        sample_size: ops.length,
        avg_outperformance: Math.round(avg * 100) / 100,
        avg_likes: 0,
        account_tier: 'all',
        examples: [],
      });
    }
  }

  // ─── Count breakout and flop tweets ───

  const breakoutCount = (allTweets ?? []).filter(t => (t.viral_multiplier ?? 0) >= 3.0).length;
  const flopCount = (allTweets ?? []).filter(t => (t.viral_multiplier ?? 0) > 0 && (t.viral_multiplier ?? 0) < 0.3).length;

  // Sort insights by outperformance
  insights.sort((a, b) => b.avg_outperformance - a.avg_outperformance);

  // Store top insights in system_events for dashboard
  try {
    const topPatterns = insights.slice(0, 10).map(i =>
      `${i.dimension}="${i.value}": ${i.avg_outperformance}x (n=${i.sample_size})`
    );
    const worstPatterns = insights.slice(-5).map(i =>
      `${i.dimension}="${i.value}": ${i.avg_outperformance}x (n=${i.sample_size})`
    );

    await supabase.from('system_events').insert({
      event_type: 'content_analysis_report',
      severity: 'info',
      message: `Content analysis: ${insights.length} patterns, ${breakoutCount} breakout tweets, ${flopCount} flops`,
      event_data: {
        total_patterns: insights.length,
        breakout_tweets: breakoutCount,
        flop_tweets: flopCount,
        top_patterns: topPatterns,
        worst_patterns: worstPatterns,
      },
      created_at: new Date().toISOString(),
    });
  } catch { /* non-fatal */ }

  console.log(
    `${LOG_PREFIX} Analysis: ${insights.length} patterns, ` +
    `${breakoutCount} breakout tweets (3x+), ${flopCount} flops (<0.3x)`
  );

  return {
    patterns_found: insights.length,
    breakout_tweets: breakoutCount,
    flop_tweets: flopCount,
  };
}
