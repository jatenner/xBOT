/**
 * Evidence Generator
 *
 * Assembles rich JSONL evidence packages from observatory data.
 * Writes compressed .jsonl.gz files that the AI reads at decision time.
 *
 * 5 package types:
 * 1. growth_journeys — Full growth stories with tweet evidence + follower curves
 * 2. content_patterns — Top tweets grouped by hook/tone/format
 * 3. account_profiles — Detailed profiles of interesting accounts
 * 4. failed_strategies — Our experiments that didn't work
 * 5. daily_snapshots — What happened on Twitter each day
 *
 * Runs every 6 hours. Append-only for journeys/strategies/snapshots.
 * Regenerates patterns/profiles weekly.
 */

import { getSupabaseClient } from '../../db';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

const LOG_PREFIX = '[observatory/evidence]';
const EVIDENCE_DIR = path.join(process.cwd(), 'data', 'evidence');

// Ensure directory exists
function ensureDir(): void {
  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  }
}

// Append a line to a JSONL.gz file
function appendToJsonlGz(filename: string, data: any): void {
  ensureDir();
  const filepath = path.join(EVIDENCE_DIR, filename);
  const line = JSON.stringify(data) + '\n';

  // For .gz files, we append to an uncompressed buffer file then compress periodically
  // For simplicity: write uncompressed .jsonl, compress separately
  const uncompressedPath = filepath.replace('.gz', '');
  fs.appendFileSync(uncompressedPath, line, 'utf-8');
}

// Write full file (for regenerated packages)
function writeJsonlGz(filename: string, items: any[]): void {
  ensureDir();
  const filepath = path.join(EVIDENCE_DIR, filename);
  const uncompressedPath = filepath.replace('.gz', '');
  const content = items.map(item => JSON.stringify(item)).join('\n') + '\n';
  fs.writeFileSync(uncompressedPath, content, 'utf-8');

  // Also write compressed version
  const compressed = zlib.gzipSync(Buffer.from(content, 'utf-8'));
  fs.writeFileSync(filepath, compressed);
}

// =============================================================================
// Main Generator
// =============================================================================

export async function runEvidenceGenerator(): Promise<{
  journeys: number;
  patterns: number;
  profiles: number;
  strategies: number;
  snapshots: number;
}> {
  const supabase = getSupabaseClient();
  const results = { journeys: 0, patterns: 0, profiles: 0, strategies: 0, snapshots: 0 };

  // 1. Growth Journeys (append new ones)
  try {
    results.journeys = await generateGrowthJourneys(supabase);
  } catch (e: any) {
    console.error(`${LOG_PREFIX} Growth journeys error: ${e.message}`);
  }

  // 2. Content Patterns (regenerate)
  try {
    results.patterns = await generateContentPatterns(supabase);
  } catch (e: any) {
    console.error(`${LOG_PREFIX} Content patterns error: ${e.message}`);
  }

  // 3. Account Profiles (regenerate)
  try {
    results.profiles = await generateAccountProfiles(supabase);
  } catch (e: any) {
    console.error(`${LOG_PREFIX} Account profiles error: ${e.message}`);
  }

  // 4. Failed Strategies (append new ones)
  try {
    results.strategies = await generateFailedStrategies(supabase);
  } catch (e: any) {
    console.error(`${LOG_PREFIX} Failed strategies error: ${e.message}`);
  }

  // 5. Daily Snapshot (append today)
  try {
    results.snapshots = await generateDailySnapshot(supabase);
  } catch (e: any) {
    console.error(`${LOG_PREFIX} Daily snapshot error: ${e.message}`);
  }

  const total = Object.values(results).reduce((s, v) => s + v, 0);
  if (total > 0) {
    console.log(`${LOG_PREFIX} Generated ${total} evidence packages: ${JSON.stringify(results)}`);
  }

  return results;
}

// =============================================================================
// Package 1: Growth Journeys
// =============================================================================

async function generateGrowthJourneys(supabase: any): Promise<number> {
  // Find retrospectives that haven't been packaged yet
  const { data: retros } = await supabase
    .from('brain_retrospective_analyses')
    .select('*')
    .is('evidence_package', null)
    .not('before_stats', 'is', null)
    .limit(10);

  if (!retros || retros.length === 0) return 0;

  let count = 0;

  for (const retro of retros) {
    const username = retro.username;

    // Fetch account profile
    const { data: profile } = await supabase
      .from('brain_account_profiles')
      .select('*')
      .eq('username', username)
      .single();

    // Fetch follower curve
    const { data: snapshots } = await supabase
      .from('brain_account_snapshots')
      .select('followers_count, following_count, checked_at')
      .eq('username', username)
      .order('checked_at', { ascending: true })
      .limit(100);

    // Fetch tweets for before and during periods
    const beforeTweets = await fetchTweetsWithClassifications(supabase, username, retro.period_before_start, retro.period_before_end);
    const duringTweets = await fetchTweetsWithClassifications(supabase, username, retro.period_during_start, retro.period_during_end);

    // Fetch growth event
    const { data: event } = await supabase
      .from('brain_growth_events')
      .select('*')
      .eq('id', retro.growth_event_id)
      .single();

    // Build weekly behavior summary
    const weeklyBehavior = buildWeeklyBehavior(duringTweets);

    // Assemble evidence package
    const evidence = {
      type: 'growth_journey',
      version: 1,
      generated_at: new Date().toISOString(),

      account: {
        username,
        niche: profile?.niche ?? null,
        sub_niches: profile?.sub_niches ?? [],
        account_type: profile?.account_type ?? null,
        voice_style: profile?.voice_style ?? null,
        ff_ratio: profile?.ff_ratio ?? null,
      },

      growth_event: {
        start_followers: event?.followers_at_detection ?? null,
        end_followers: snapshots?.length > 0 ? snapshots[snapshots.length - 1].followers_count : null,
        growth_rate_weekly: event?.growth_rate_after ?? null,
        duration_days: retro.period_during_start && retro.period_during_end
          ? Math.round((new Date(retro.period_during_end).getTime() - new Date(retro.period_during_start).getTime()) / (24 * 60 * 60 * 1000))
          : null,
        phase_at_start: event?.growth_phase_at_detection ?? null,
      },

      follower_curve: (snapshots ?? []).map((s: any) => ({
        date: s.checked_at?.substring(0, 10),
        followers: s.followers_count,
      })),

      weekly_behavior: weeklyBehavior,

      tweet_evidence: {
        before: beforeTweets.slice(0, 30),
        during: duringTweets.slice(0, 50),
        top_5_by_likes: [...duringTweets].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0)).slice(0, 5),
        top_5_by_bookmarks: [...duringTweets].sort((a, b) => (b.bookmarks ?? 0) - (a.bookmarks ?? 0)).slice(0, 5),
      },

      key_changes: retro.key_changes ?? [],

      external_context: retro.external_correlations ?? {},
    };

    // Write to JSONL
    appendToJsonlGz('growth_journeys.jsonl.gz', evidence);

    // Store in DB as backup
    await supabase
      .from('brain_retrospective_analyses')
      .update({ evidence_package: evidence })
      .eq('id', retro.id);

    count++;
  }

  return count;
}

async function fetchTweetsWithClassifications(supabase: any, username: string, startDate: string | null, endDate: string | null): Promise<any[]> {
  if (!startDate || !endDate) return [];

  const { data: tweets } = await supabase
    .from('brain_tweets')
    .select('tweet_id, content, posted_at, tweet_type, likes, retweets, replies, bookmarks, engagement_rate, bookmark_to_like_ratio, reply_to_like_ratio, content_features, parent_tweet_id, media_type')
    .eq('author_username', username)
    .gte('posted_at', startDate)
    .lte('posted_at', endDate)
    .order('posted_at', { ascending: true });

  if (!tweets || tweets.length === 0) return [];

  // Try to join classifications
  const tweetIds = tweets.map((t: any) => t.tweet_id);
  const { data: classifications } = await supabase
    .from('brain_classifications')
    .select('tweet_id, hook_type, tone, format, emotional_trigger, specificity, novelty_level, controversy_level')
    .in('tweet_id', tweetIds);

  const classMap = new Map((classifications ?? []).map((c: any) => [c.tweet_id, c]));

  return tweets.map((t: any) => {
    const cls = classMap.get(t.tweet_id) as any;
    return {
      tweet_id: t.tweet_id,
      posted_at: t.posted_at,
      type: t.tweet_type ?? 'original',
      content: t.content,
      likes: t.likes ?? 0,
      retweets: t.retweets ?? 0,
      replies: t.replies ?? 0,
      bookmarks: t.bookmarks ?? 0,
      engagement_rate: t.engagement_rate,
      bookmark_to_like_ratio: t.bookmark_to_like_ratio,
      word_count: t.content ? t.content.split(/\s+/).length : 0,
      media_type: t.media_type ?? 'none',
      hook_type: cls?.hook_type ?? null,
      tone: cls?.tone ?? null,
      format: cls?.format ?? null,
      emotional_trigger: cls?.emotional_trigger ?? null,
      specificity: cls?.specificity ?? null,
      novelty_level: cls?.novelty_level ?? null,
    };
  });
}

function buildWeeklyBehavior(tweets: any[]): any[] {
  if (tweets.length === 0) return [];

  // Group by week
  const weeks: Record<string, any[]> = {};
  for (const t of tweets) {
    if (!t.posted_at) continue;
    const date = new Date(t.posted_at);
    // Get Monday of the week
    const day = date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
    const weekKey = monday.toISOString().substring(0, 10);
    if (!weeks[weekKey]) weeks[weekKey] = [];
    weeks[weekKey].push(t);
  }

  return Object.entries(weeks).sort(([a], [b]) => a.localeCompare(b)).map(([weekStart, tweets]) => {
    const originals = tweets.filter(t => t.type === 'original' || !t.type);
    const replies = tweets.filter(t => t.type === 'reply');
    const threads = tweets.filter(t => t.type === 'thread');

    // Reply targets
    const targets: Record<string, { count: number; totalLikes: number }> = {};
    for (const t of replies) {
      // Extract @mention from content as proxy for reply target
      const mentions = ((t.content ?? '') as string).match(/@([a-zA-Z0-9_]+)/g);
      if (mentions) {
        for (const m of mentions) {
          const name = m.replace('@', '');
          if (!targets[name]) targets[name] = { count: 0, totalLikes: 0 };
          targets[name].count++;
          targets[name].totalLikes += t.likes ?? 0;
        }
      }
    }

    const topTargets = Object.entries(targets)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([username, data]) => ({
        username,
        replies: data.count,
        avg_likes: Math.round(data.totalLikes / data.count),
      }));

    // Dominant hook/tone from classifications
    const hooks: Record<string, number> = {};
    const tones: Record<string, number> = {};
    for (const t of tweets) {
      if (t.hook_type) hooks[t.hook_type] = (hooks[t.hook_type] ?? 0) + 1;
      if (t.tone) tones[t.tone] = (tones[t.tone] ?? 0) + 1;
    }

    const dominantHook = Object.entries(hooks).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const dominantTone = Object.entries(tones).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    return {
      week: weekStart,
      originals: originals.length,
      replies: replies.length,
      threads: threads.length,
      avg_likes: Math.round(tweets.reduce((s, t) => s + (t.likes ?? 0), 0) / tweets.length),
      avg_word_count: Math.round(tweets.reduce((s, t) => s + (t.word_count ?? 0), 0) / tweets.length),
      reply_targets: topTargets,
      dominant_hook: dominantHook,
      dominant_tone: dominantTone,
    };
  });
}

// =============================================================================
// Package 2: Content Patterns (regenerate weekly)
// =============================================================================

async function generateContentPatterns(supabase: any): Promise<number> {
  const { data: classified } = await supabase
    .from('brain_classifications')
    .select(`
      tweet_id, hook_type, tone, format, emotional_trigger,
      brain_tweets!inner(content, likes, retweets, bookmarks, author_username, author_tier, posted_hour_utc)
    `)
    .not('hook_type', 'is', null)
    .limit(2000);

  if (!classified || classified.length < 10) return 0;

  // Group by hook_type + tone combos
  const groups: Record<string, any[]> = {};
  for (const c of classified) {
    const key = `${c.hook_type}|${c.tone}|${(c as any).brain_tweets?.author_tier ?? 'all'}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  }

  const patterns: any[] = [];

  for (const [key, tweets] of Object.entries(groups)) {
    if (tweets.length < 3) continue;
    const [hookType, tone, tier] = key.split('|');

    const sorted = tweets.sort((a: any, b: any) => ((b as any).brain_tweets?.likes ?? 0) - ((a as any).brain_tweets?.likes ?? 0));
    const avgLikes = tweets.reduce((s: number, t: any) => s + ((t as any).brain_tweets?.likes ?? 0), 0) / tweets.length;
    const avgBookmarks = tweets.reduce((s: number, t: any) => s + ((t as any).brain_tweets?.bookmarks ?? 0), 0) / tweets.length;

    patterns.push({
      type: 'content_pattern',
      generated_at: new Date().toISOString(),
      pattern: { hook_type: hookType, tone, account_tier: tier },
      sample_size: tweets.length,
      avg_likes: Math.round(avgLikes),
      avg_bookmarks: Math.round(avgBookmarks),
      top_examples: sorted.slice(0, 5).map((t: any) => ({
        tweet_id: t.tweet_id,
        author: (t as any).brain_tweets?.author_username,
        content: (t as any).brain_tweets?.content?.substring(0, 300),
        likes: (t as any).brain_tweets?.likes ?? 0,
        bookmarks: (t as any).brain_tweets?.bookmarks ?? 0,
        word_count: ((t as any).brain_tweets?.content ?? '').split(/\s+/).length,
        posted_hour_utc: (t as any).brain_tweets?.posted_hour_utc,
      })),
      worst_examples: sorted.slice(-3).map((t: any) => ({
        content: (t as any).brain_tweets?.content?.substring(0, 200),
        likes: (t as any).brain_tweets?.likes ?? 0,
        word_count: ((t as any).brain_tweets?.content ?? '').split(/\s+/).length,
      })),
    });
  }

  if (patterns.length > 0) {
    writeJsonlGz('content_patterns.jsonl.gz', patterns);
  }

  return patterns.length;
}

// =============================================================================
// Package 3: Account Profiles (regenerate weekly)
// =============================================================================

async function generateAccountProfiles(supabase: any): Promise<number> {
  const { data: accounts } = await supabase
    .from('brain_accounts')
    .select('username, followers_count, following_count, ff_ratio, growth_status, growth_rate_7d, niche_cached, account_type_cached')
    .in('growth_status', ['interesting', 'hot', 'explosive'])
    .eq('is_active', true)
    .limit(200);

  if (!accounts || accounts.length === 0) return 0;

  const profiles: any[] = [];

  for (const acct of accounts) {
    // Get profile
    const { data: profile } = await supabase
      .from('brain_account_profiles')
      .select('*')
      .eq('username', acct.username)
      .single();

    // Get follower history
    const { data: snapshots } = await supabase
      .from('brain_account_snapshots')
      .select('followers_count, checked_at')
      .eq('username', acct.username)
      .order('checked_at', { ascending: true })
      .limit(30);

    // Get recent tweets
    const { data: tweets } = await supabase
      .from('brain_tweets')
      .select('content, likes, tweet_type, posted_at')
      .eq('author_username', acct.username)
      .order('likes', { ascending: false })
      .limit(10);

    profiles.push({
      type: 'account_profile',
      generated_at: new Date().toISOString(),
      username: acct.username,
      followers: acct.followers_count,
      following: acct.following_count,
      ff_ratio: acct.ff_ratio,
      account_type: profile?.account_type ?? acct.account_type_cached,
      niche: profile?.niche ?? acct.niche_cached,
      sub_niches: profile?.sub_niches ?? [],
      voice_style: profile?.voice_style,
      growth_status: acct.growth_status,
      growth_rate_7d: acct.growth_rate_7d,
      posting_frequency: profile?.posting_frequency_daily,
      reply_ratio: profile?.reply_ratio,
      content_style: profile?.content_style_summary,
      recent_tweets: (tweets ?? []).map((t: any) => ({
        content: t.content?.substring(0, 200),
        likes: t.likes ?? 0,
        type: t.tweet_type,
      })),
      follower_history: (snapshots ?? []).map((s: any) => ({
        date: s.checked_at?.substring(0, 10),
        followers: s.followers_count,
      })),
    });
  }

  if (profiles.length > 0) {
    writeJsonlGz('account_profiles.jsonl.gz', profiles);
  }

  return profiles.length;
}

// =============================================================================
// Package 4: Failed Strategies (append new)
// =============================================================================

async function generateFailedStrategies(supabase: any): Promise<number> {
  const { data: failed } = await supabase
    .from('brain_strategy_memory')
    .select('*')
    .eq('verdict', 'failed')
    .order('updated_at', { ascending: false })
    .limit(20);

  if (!failed || failed.length === 0) return 0;

  let count = 0;
  for (const entry of failed) {
    const evidence = {
      type: 'failed_strategy',
      generated_at: new Date().toISOString(),
      strategy_name: entry.strategy_name,
      test_number: entry.test_number,
      test_period: { start: entry.test_period_start, end: entry.test_period_end },
      our_results: entry.our_results,
      benchmark: entry.benchmark,
      diagnosis: entry.diagnosis,
      verdict: entry.verdict,
      shelved_reason: entry.shelved_reason,
      revisit_at: entry.revisit_at,
    };

    appendToJsonlGz('failed_strategies.jsonl.gz', evidence);
    count++;
  }

  return count;
}

// =============================================================================
// Package 5: Daily Snapshot (append today)
// =============================================================================

async function generateDailySnapshot(supabase: any): Promise<number> {
  const today = new Date().toISOString().substring(0, 10);

  const { data: context } = await supabase
    .from('brain_daily_context')
    .select('*')
    .eq('context_date', today)
    .single();

  const { count: tweetsToday } = await supabase
    .from('brain_tweets')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', today + 'T00:00:00Z');

  const { count: censusToday } = await supabase
    .from('brain_account_snapshots')
    .select('id', { count: 'exact', head: true })
    .gte('checked_at', today + 'T00:00:00Z');

  const { count: growthToday } = await supabase
    .from('brain_growth_events')
    .select('id', { count: 'exact', head: true })
    .gte('detected_at', today + 'T00:00:00Z');

  // Top tweet of the day
  const { data: topTweet } = await supabase
    .from('brain_tweets')
    .select('author_username, content, likes')
    .gte('created_at', today + 'T00:00:00Z')
    .order('likes', { ascending: false })
    .limit(1)
    .single();

  const snapshot = {
    type: 'daily_snapshot',
    date: today,
    trending_topics: context?.trending_topics ?? [],
    major_events: context?.major_events ?? [],
    tweets_ingested: tweetsToday ?? 0,
    accounts_censused: censusToday ?? 0,
    growth_events_detected: growthToday ?? 0,
    top_tweet_of_day: topTweet ? {
      author: topTweet.author_username,
      content: topTweet.content?.substring(0, 200),
      likes: topTweet.likes,
    } : null,
  };

  appendToJsonlGz('daily_snapshots.jsonl.gz', snapshot);
  return 1;
}
