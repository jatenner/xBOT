/**
 * Retrospective Analyzer
 *
 * When the growth detector flags an account as growing, this analyzer
 * looks BACK at what they did. It compares the BEFORE period (pre-growth)
 * with the DURING period (growth phase) and identifies what changed.
 *
 * This is the core intelligence engine — it answers:
 * "What did this account change that caused them to grow?"
 *
 * Runs every 2 hours. Processes pending growth events.
 */

import { getSupabaseClient } from '../../db';
import { createBudgetedChatCompletion } from '../../services/openaiBudgetedClient';
import { getPendingGrowthEvents } from '../db';

const LOG_PREFIX = '[observatory/retrospective]';
const MAX_PER_RUN = 5;
const BEFORE_PERIOD_DAYS = 14; // Look 14 days before growth started

interface PeriodStats {
  total_tweets: number;
  tweets_per_day: number;
  reply_ratio: number;
  original_ratio: number;
  thread_ratio: number;
  avg_likes: number;
  avg_retweets: number;
  avg_replies: number;
  avg_word_count: number;
  top_reply_targets: string[];
  avg_reply_target_followers: number | null;
  active_hours: Record<string, number>;
  top_topics: string[];
  hook_distribution: Record<string, number>;
  tone_distribution: Record<string, number>;
}

export async function runRetrospectiveAnalyzer(): Promise<{
  analyzed: number;
  insufficient_data: number;
  errors: number;
}> {
  const pendingEvents = await getPendingGrowthEvents(MAX_PER_RUN);

  if (pendingEvents.length === 0) {
    return { analyzed: 0, insufficient_data: 0, errors: 0 };
  }

  const supabase = getSupabaseClient();
  let analyzed = 0;
  let insufficientData = 0;
  let errors = 0;

  for (const event of pendingEvents) {
    try {
      const result = await analyzeGrowthEvent(supabase, event);

      if (result === 'insufficient_data') {
        await supabase
          .from('brain_growth_events')
          .update({ retrospective_status: 'insufficient_data' })
          .eq('id', event.id);
        insufficientData++;
        continue;
      }

      if (result === 'error') {
        errors++;
        continue;
      }

      analyzed++;
    } catch (err: any) {
      console.error(`${LOG_PREFIX} Error analyzing @${event.username}: ${err.message}`);
      errors++;
    }
  }

  if (analyzed > 0 || insufficientData > 0) {
    console.log(`${LOG_PREFIX} Analyzed ${analyzed}, insufficient data ${insufficientData}, errors ${errors}`);
  }

  return { analyzed, insufficient_data: insufficientData, errors };
}

async function analyzeGrowthEvent(
  supabase: any,
  event: { id: string; username: string; detected_at: string; followers_at_detection: number; growth_rate_after: number },
): Promise<'success' | 'insufficient_data' | 'error'> {
  const username = event.username;
  const detectedAt = new Date(event.detected_at);

  // Define periods
  const duringEnd = detectedAt;
  const duringStart = new Date(detectedAt.getTime() - 14 * 24 * 60 * 60 * 1000); // Last 14 days
  const beforeEnd = duringStart;
  const beforeStart = new Date(beforeEnd.getTime() - BEFORE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  // Fetch tweets for both periods
  const { data: beforeTweets } = await supabase
    .from('brain_tweets')
    .select('content, likes, retweets, replies, tweet_type, posted_at, author_followers, content_features')
    .eq('author_username', username)
    .gte('posted_at', beforeStart.toISOString())
    .lt('posted_at', beforeEnd.toISOString())
    .order('posted_at', { ascending: true });

  const { data: duringTweets } = await supabase
    .from('brain_tweets')
    .select('content, likes, retweets, replies, tweet_type, posted_at, author_followers, content_features')
    .eq('author_username', username)
    .gte('posted_at', duringStart.toISOString())
    .lte('posted_at', duringEnd.toISOString())
    .order('posted_at', { ascending: true });

  // Need at least 5 tweets in the during period to analyze
  if (!duringTweets || duringTweets.length < 5) {
    console.log(`${LOG_PREFIX} @${username}: insufficient during-period data (${duringTweets?.length ?? 0} tweets)`);
    return 'insufficient_data';
  }

  // Compute stats for both periods
  const beforeStats = computePeriodStats(beforeTweets ?? [], beforeStart, beforeEnd);
  const duringStats = computePeriodStats(duringTweets, duringStart, duringEnd);

  // Identify key changes
  const keyChanges = identifyKeyChanges(beforeStats, duringStats);

  // Get daily context for correlation
  const { data: context } = await supabase
    .from('brain_daily_context')
    .select('context_date, trending_topics')
    .gte('context_date', duringStart.toISOString().substring(0, 10))
    .lte('context_date', duringEnd.toISOString().substring(0, 10));

  const trendingDuringPeriod = (context ?? []).flatMap((c: any) => c.trending_topics ?? []);

  // AI analysis: what changed and why
  let analysisSummary: string | null = null;
  try {
    analysisSummary = await generateAIAnalysis(username, beforeStats, duringStats, keyChanges, event);
  } catch {
    // AI is non-fatal — structural analysis is still valuable
  }

  // Store the retrospective
  const { data: retro } = await supabase
    .from('brain_retrospective_analyses')
    .insert({
      username,
      growth_event_id: event.id,
      period_before_start: beforeStart.toISOString(),
      period_before_end: beforeEnd.toISOString(),
      period_during_start: duringStart.toISOString(),
      period_during_end: duringEnd.toISOString(),
      before_stats: beforeStats,
      during_stats: duringStats,
      key_changes: keyChanges,
      external_correlations: { trending_topics: trendingDuringPeriod },
      analysis_summary: analysisSummary,
      analysis_model: analysisSummary ? 'gpt-4o-mini' : 'heuristic_only',
    })
    .select('id')
    .single();

  // Link back to growth event
  if (retro) {
    await supabase
      .from('brain_growth_events')
      .update({
        retrospective_status: 'analyzed',
        retrospective_id: retro.id,
      })
      .eq('id', event.id);
  }

  console.log(
    `${LOG_PREFIX} ✅ @${username}: ${keyChanges.length} key changes detected ` +
    `(before: ${beforeStats.total_tweets} tweets, during: ${duringStats.total_tweets} tweets)`
  );

  return 'success';
}

// =============================================================================
// Period stats computation
// =============================================================================

function computePeriodStats(tweets: any[], periodStart: Date, periodEnd: Date): PeriodStats {
  const daySpan = Math.max(1, (periodEnd.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000));
  const total = tweets.length;

  const replyTweets = tweets.filter(t => t.tweet_type === 'reply');
  const threadTweets = tweets.filter(t => t.tweet_type === 'thread');
  const originalTweets = tweets.filter(t => t.tweet_type === 'original' || t.tweet_type === null);

  // Average metrics
  const avgLikes = total > 0 ? tweets.reduce((s, t) => s + (t.likes ?? 0), 0) / total : 0;
  const avgRetweets = total > 0 ? tweets.reduce((s, t) => s + (t.retweets ?? 0), 0) / total : 0;
  const avgReplies = total > 0 ? tweets.reduce((s, t) => s + (t.replies ?? 0), 0) / total : 0;

  // Word count from content
  const wordCounts = tweets.map(t => (t.content ?? '').split(/\s+/).length);
  const avgWordCount = wordCounts.length > 0 ? wordCounts.reduce((s, w) => s + w, 0) / wordCounts.length : 0;

  // Active hours
  const hourDist: Record<string, number> = {};
  for (const t of tweets) {
    if (t.posted_at) {
      const h = String(new Date(t.posted_at).getUTCHours());
      hourDist[h] = (hourDist[h] ?? 0) + 1;
    }
  }

  // Reply targets (extract from reply tweets — look at parent tweet)
  const replyTargets: string[] = [];
  // We don't have reply_to_user directly, but can infer from content @mentions
  for (const t of replyTweets) {
    const mentions = ((t.content ?? '') as string).match(/@([a-zA-Z0-9_]+)/g);
    if (mentions) replyTargets.push(...mentions.map(m => m.replace('@', '')));
  }
  const targetCounts: Record<string, number> = {};
  for (const t of replyTargets) {
    targetCounts[t] = (targetCounts[t] ?? 0) + 1;
  }
  const topTargets = Object.entries(targetCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  // Topic and hook distribution from content features
  const hookDist: Record<string, number> = {};
  const toneDist: Record<string, number> = {};
  const topics: string[] = [];

  // Note: these would be richer if we had brain_classifications joined
  // For now, extract what we can from content features JSONB
  for (const t of tweets) {
    const features = t.content_features;
    if (features) {
      if (features.starts_with_question) hookDist['question'] = (hookDist['question'] ?? 0) + 1;
      if (features.starts_with_bold_claim) hookDist['bold_claim'] = (hookDist['bold_claim'] ?? 0) + 1;
      if (features.starts_with_number) hookDist['data_driven'] = (hookDist['data_driven'] ?? 0) + 1;
      if (features.contains_specific_data) hookDist['specific_data'] = (hookDist['specific_data'] ?? 0) + 1;
    }
  }

  return {
    total_tweets: total,
    tweets_per_day: Math.round((total / daySpan) * 10) / 10,
    reply_ratio: total > 0 ? Math.round((replyTweets.length / total) * 100) / 100 : 0,
    original_ratio: total > 0 ? Math.round((originalTweets.length / total) * 100) / 100 : 0,
    thread_ratio: total > 0 ? Math.round((threadTweets.length / total) * 100) / 100 : 0,
    avg_likes: Math.round(avgLikes),
    avg_retweets: Math.round(avgRetweets),
    avg_replies: Math.round(avgReplies),
    avg_word_count: Math.round(avgWordCount),
    top_reply_targets: topTargets,
    avg_reply_target_followers: null, // Would need joined data
    active_hours: hourDist,
    top_topics: topics,
    hook_distribution: hookDist,
    tone_distribution: toneDist,
  };
}

// =============================================================================
// Key change detection
// =============================================================================

interface KeyChange {
  dimension: string;
  before_value: any;
  during_value: any;
  change_magnitude: number; // % change or absolute delta
  significance: 'high' | 'medium' | 'low';
  description: string;
}

function identifyKeyChanges(before: PeriodStats, during: PeriodStats): KeyChange[] {
  const changes: KeyChange[] = [];

  // Reply ratio change
  const replyDelta = during.reply_ratio - before.reply_ratio;
  if (Math.abs(replyDelta) > 0.15) {
    changes.push({
      dimension: 'reply_ratio',
      before_value: before.reply_ratio,
      during_value: during.reply_ratio,
      change_magnitude: replyDelta,
      significance: Math.abs(replyDelta) > 0.3 ? 'high' : 'medium',
      description: replyDelta > 0
        ? `Reply ratio increased from ${(before.reply_ratio * 100).toFixed(0)}% to ${(during.reply_ratio * 100).toFixed(0)}%`
        : `Reply ratio decreased from ${(before.reply_ratio * 100).toFixed(0)}% to ${(during.reply_ratio * 100).toFixed(0)}%`,
    });
  }

  // Posting frequency change
  if (before.tweets_per_day > 0) {
    const freqChange = (during.tweets_per_day - before.tweets_per_day) / before.tweets_per_day;
    if (Math.abs(freqChange) > 0.3) {
      changes.push({
        dimension: 'posting_frequency',
        before_value: before.tweets_per_day,
        during_value: during.tweets_per_day,
        change_magnitude: freqChange,
        significance: Math.abs(freqChange) > 1.0 ? 'high' : 'medium',
        description: `Posting frequency changed from ${before.tweets_per_day}/day to ${during.tweets_per_day}/day (${freqChange > 0 ? '+' : ''}${(freqChange * 100).toFixed(0)}%)`,
      });
    }
  } else if (during.tweets_per_day > 1) {
    changes.push({
      dimension: 'posting_frequency',
      before_value: 0,
      during_value: during.tweets_per_day,
      change_magnitude: 1.0,
      significance: 'high',
      description: `Started posting (was inactive, now ${during.tweets_per_day}/day)`,
    });
  }

  // Engagement change
  if (before.avg_likes > 0) {
    const engChange = (during.avg_likes - before.avg_likes) / before.avg_likes;
    if (engChange > 0.5) {
      changes.push({
        dimension: 'avg_engagement',
        before_value: before.avg_likes,
        during_value: during.avg_likes,
        change_magnitude: engChange,
        significance: engChange > 2.0 ? 'high' : 'medium',
        description: `Average likes jumped from ${before.avg_likes} to ${during.avg_likes} (${(engChange * 100).toFixed(0)}% increase)`,
      });
    }
  }

  // Word count change (shorter/longer content)
  if (before.avg_word_count > 0) {
    const wcChange = (during.avg_word_count - before.avg_word_count) / before.avg_word_count;
    if (Math.abs(wcChange) > 0.25) {
      changes.push({
        dimension: 'content_length',
        before_value: before.avg_word_count,
        during_value: during.avg_word_count,
        change_magnitude: wcChange,
        significance: Math.abs(wcChange) > 0.5 ? 'medium' : 'low',
        description: wcChange < 0
          ? `Content got shorter: ${before.avg_word_count} → ${during.avg_word_count} words avg`
          : `Content got longer: ${before.avg_word_count} → ${during.avg_word_count} words avg`,
      });
    }
  }

  // Reply target changes
  if (during.top_reply_targets.length > 0 && before.top_reply_targets.length > 0) {
    const newTargets = during.top_reply_targets.filter(t => !before.top_reply_targets.includes(t));
    if (newTargets.length >= 2) {
      changes.push({
        dimension: 'reply_targets',
        before_value: before.top_reply_targets,
        during_value: during.top_reply_targets,
        change_magnitude: newTargets.length / during.top_reply_targets.length,
        significance: 'medium',
        description: `New reply targets: @${newTargets.join(', @')}`,
      });
    }
  } else if (during.top_reply_targets.length > 0 && before.top_reply_targets.length === 0) {
    changes.push({
      dimension: 'reply_targets',
      before_value: [],
      during_value: during.top_reply_targets,
      change_magnitude: 1.0,
      significance: 'high',
      description: `Started replying to: @${during.top_reply_targets.join(', @')}`,
    });
  }

  // Active hours shift
  const beforePeakHour = Object.entries(before.active_hours).sort((a, b) => b[1] - a[1])[0];
  const duringPeakHour = Object.entries(during.active_hours).sort((a, b) => b[1] - a[1])[0];
  if (beforePeakHour && duringPeakHour && beforePeakHour[0] !== duringPeakHour[0]) {
    changes.push({
      dimension: 'timing',
      before_value: `Peak hour: ${beforePeakHour[0]} UTC`,
      during_value: `Peak hour: ${duringPeakHour[0]} UTC`,
      change_magnitude: 0,
      significance: 'low',
      description: `Peak posting hour shifted from ${beforePeakHour[0]}h to ${duringPeakHour[0]}h UTC`,
    });
  }

  // Sort by significance
  const sigOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
  changes.sort((a, b) => (sigOrder[b.significance] ?? 0) - (sigOrder[a.significance] ?? 0));

  return changes;
}

// =============================================================================
// AI analysis
// =============================================================================

async function generateAIAnalysis(
  username: string,
  before: PeriodStats,
  during: PeriodStats,
  changes: KeyChange[],
  event: { followers_at_detection: number; growth_rate_after: number },
): Promise<string> {
  const changesSummary = changes.map(c => `- ${c.description} (${c.significance} significance)`).join('\n');

  const response = await createBudgetedChatCompletion({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a Twitter growth analyst. Given before/during period stats and detected changes, explain WHY this account grew. Be specific and actionable. 2-3 sentences max.',
      },
      {
        role: 'user',
        content: `@${username} grew to ${event.followers_at_detection} followers (${event.growth_rate_after.toFixed(1)}% weekly growth).

BEFORE (14 days pre-growth):
- ${before.tweets_per_day} tweets/day, ${(before.reply_ratio * 100).toFixed(0)}% replies
- Avg ${before.avg_likes} likes, ${before.avg_word_count} words/tweet
- Reply targets: ${before.top_reply_targets.join(', ') || 'none'}

DURING (growth period):
- ${during.tweets_per_day} tweets/day, ${(during.reply_ratio * 100).toFixed(0)}% replies
- Avg ${during.avg_likes} likes, ${during.avg_word_count} words/tweet
- Reply targets: ${during.top_reply_targets.join(', ') || 'none'}

KEY CHANGES:
${changesSummary || 'No significant structural changes detected.'}

Why did this account grow?`,
      },
    ],
    temperature: 0.3,
    max_tokens: 200,
  }, { purpose: 'observatory_retrospective', priority: 'low' });

  return response.choices[0]?.message?.content?.trim() ?? '';
}
