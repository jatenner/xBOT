/**
 * Pattern Engine
 *
 * The core intelligence computation. Runs every 6 hours.
 *
 * For each (niche × from_range × to_range) cell with 5+ accounts that
 * crossed a follower range boundary, computes the full growth playbook:
 *
 * - How many posts/day, replies/day, threads/day
 * - Average word count for posts vs replies
 * - Reply ratio, reply target size distribution
 * - Best posting hours, media types, CTA usage
 * - Top hook types, tones, formats (from AI classification)
 * - Algorithm signals (algo_score, bookmark_save_rate)
 * - Bio characteristics of growers
 * - Comparison to stagnant accounts in the same range
 *
 * Output: brain_growth_playbooks table — one row per (niche, from, to)
 */

import { getSupabaseClient } from '../../db';
import { FOLLOWER_RANGE_ORDER, type FollowerRange } from '../types';

const LOG_PREFIX = '[observatory/pattern-engine]';
const MIN_SAMPLES = 5;

export async function runPatternEngine(): Promise<{
  playbooks_computed: number;
  cells_skipped: number;
}> {
  const supabase = getSupabaseClient();
  let computed = 0;
  let skipped = 0;

  // Find all accounts that crossed range boundaries
  const { data: allAccounts } = await supabase
    .from('brain_accounts')
    .select('username, follower_range, follower_range_at_first_snapshot, niche_cached, followers_count')
    .eq('is_active', true)
    .not('follower_range', 'is', null)
    .not('follower_range_at_first_snapshot', 'is', null)
    .limit(10000);

  if (!allAccounts || allAccounts.length === 0) {
    return { playbooks_computed: 0, cells_skipped: 0 };
  }

  // Filter to accounts that actually moved forward
  const movers = allAccounts.filter(a => {
    const fromIdx = FOLLOWER_RANGE_ORDER.indexOf(a.follower_range_at_first_snapshot as FollowerRange);
    const toIdx = FOLLOWER_RANGE_ORDER.indexOf(a.follower_range as FollowerRange);
    return fromIdx >= 0 && toIdx >= 0 && toIdx > fromIdx;
  });

  if (movers.length === 0) {
    console.log(`${LOG_PREFIX} No accounts have crossed range boundaries yet`);
    return { playbooks_computed: 0, cells_skipped: 0 };
  }

  // Group by transition: (from_range → to_range)
  // Each account contributes to the step they crossed (nano→micro, not nano→small directly)
  const transitionGroups: Record<string, Array<{ username: string; niche: string | null; followers_count: number }>> = {};

  for (const acct of movers) {
    const fromIdx = FOLLOWER_RANGE_ORDER.indexOf(acct.follower_range_at_first_snapshot as FollowerRange);
    const toIdx = FOLLOWER_RANGE_ORDER.indexOf(acct.follower_range as FollowerRange);

    for (let step = fromIdx; step < toIdx; step++) {
      const from = FOLLOWER_RANGE_ORDER[step];
      const to = FOLLOWER_RANGE_ORDER[step + 1];
      const key = `${from}→${to}`;

      if (!transitionGroups[key]) transitionGroups[key] = [];
      transitionGroups[key].push({
        username: acct.username,
        niche: acct.niche_cached,
        followers_count: acct.followers_count,
      });
    }
  }

  // Process each transition cell
  for (const [key, accounts] of Object.entries(transitionGroups)) {
    const [fromRange, toRange] = key.split('→');

    // Cross-niche playbook (all accounts in this transition)
    if (accounts.length >= MIN_SAMPLES) {
      const playbook = await computePlaybook(supabase, fromRange, toRange, accounts, null);
      if (playbook) {
        await upsertPlaybook(supabase, fromRange, toRange, null, playbook);
        computed++;
      }
    } else {
      skipped++;
    }

    // Niche-specific playbooks
    const byNiche: Record<string, typeof accounts> = {};
    for (const acct of accounts) {
      const niche = acct.niche || 'other';
      if (!byNiche[niche]) byNiche[niche] = [];
      byNiche[niche].push(acct);
    }

    for (const [niche, nicheAccounts] of Object.entries(byNiche)) {
      if (nicheAccounts.length >= MIN_SAMPLES) {
        const playbook = await computePlaybook(supabase, fromRange, toRange, nicheAccounts, niche);
        if (playbook) {
          await upsertPlaybook(supabase, fromRange, toRange, niche, playbook);
          computed++;
        }
      }
    }
  }

  if (computed > 0 || skipped > 0) {
    console.log(`${LOG_PREFIX} Computed ${computed} playbooks, skipped ${skipped} cells (insufficient data). ${movers.length} total movers found.`);
  }

  return { playbooks_computed: computed, cells_skipped: skipped };
}

async function computePlaybook(
  supabase: any,
  fromRange: string,
  toRange: string,
  accounts: Array<{ username: string; niche: string | null; followers_count: number }>,
  niche: string | null,
): Promise<Record<string, any> | null> {
  const usernames = accounts.map(a => a.username);
  const sampleSize = accounts.length;

  // Get tweets from these accounts (up to 100 per account)
  const { data: tweets } = await supabase
    .from('brain_tweets')
    .select('tweet_type, content, likes, views, retweets, replies, bookmarks, quotes, posted_hour_utc, media_type, author_followers, reply_to_username, reply_target_followers, reply_delay_minutes, content_features, algo_score, bookmark_save_rate, conversation_ratio, engagement_rate')
    .in('author_username', usernames)
    .limit(sampleSize * 100);

  if (!tweets || tweets.length < 10) return null;

  // Split by type
  const originals = tweets.filter((t: any) => t.tweet_type === 'original');
  const replyTweets = tweets.filter((t: any) => t.tweet_type === 'reply');
  const threadTweets = tweets.filter((t: any) => t.tweet_type === 'thread');
  const totalTweets = tweets.length;

  // Get posting frequency data
  const { data: freqData } = await supabase
    .from('brain_posting_frequency')
    .select('posts_per_day_7d, reply_ratio_7d')
    .in('username', usernames)
    .order('measured_at', { ascending: false })
    .limit(sampleSize);

  // Get classifications
  const tweetIds = tweets.map((t: any) => t.tweet_id).filter(Boolean).slice(0, 500);
  let classifications: any[] = [];
  if (tweetIds.length > 0) {
    const { data } = await supabase
      .from('brain_classifications')
      .select('hook_type, tone, format')
      .in('tweet_id', tweetIds);
    classifications = data ?? [];
  }

  // Compute averages
  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
  const dist = (arr: any[], field: string) => {
    const counts: Record<string, number> = {};
    let total = 0;
    for (const item of arr) {
      const val = item[field];
      if (val && val !== 'other') { counts[val] = (counts[val] ?? 0) + 1; total++; }
    }
    if (total === 0) return null;
    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(counts)) {
      result[k] = Math.round((v / total) * 100) / 100;
    }
    return result;
  };

  // Word count from content
  const wordCounts = (items: any[]) => items
    .filter((t: any) => t.content)
    .map((t: any) => (t.content as string).split(/\s+/).length);

  // Posting hours distribution
  const hourCounts: Record<number, number> = {};
  for (const t of tweets) {
    if (t.posted_hour_utc != null) {
      hourCounts[t.posted_hour_utc] = (hourCounts[t.posted_hour_utc] ?? 0) + 1;
    }
  }
  const bestHours = Object.entries(hourCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([h]) => Number(h));

  // Reply target distribution
  const replyTargets = replyTweets
    .filter((t: any) => t.reply_target_followers != null)
    .map((t: any) => t.reply_target_followers as number);

  const replyTargetDist: Record<string, number> = { peer: 0, bigger_2_10x: 0, bigger_10_100x: 0, mega: 0 };
  for (const tf of replyTargets) {
    if (tf < 2000) replyTargetDist.peer++;
    else if (tf < 50000) replyTargetDist.bigger_2_10x++;
    else if (tf < 500000) replyTargetDist.bigger_10_100x++;
    else replyTargetDist.mega++;
  }
  const rtTotal = replyTargets.length || 1;
  for (const k of Object.keys(replyTargetDist)) {
    replyTargetDist[k] = Math.round((replyTargetDist[k] / rtTotal) * 100) / 100;
  }

  // Media distribution
  const mediaDist = dist(tweets, 'media_type');

  // CTA rate from content_features
  const ctaCount = tweets.filter((t: any) => t.content_features?.has_cta).length;

  // Bio patterns
  const { data: bioData } = await supabase
    .from('brain_accounts')
    .select('bio_features')
    .in('username', usernames)
    .not('bio_features', 'is', null);

  const bioPatterns: Record<string, any> = {};
  if (bioData && bioData.length > 0) {
    const bios = bioData.map((b: any) => b.bio_features);
    bioPatterns.avg_bio_length = avg(bios.map((b: any) => b?.char_count ?? 0).filter((n: number) => n > 0));
    bioPatterns.has_credentials_rate = bios.filter((b: any) => b?.has_credentials).length / bios.length;
    bioPatterns.has_cta_rate = bios.filter((b: any) => b?.has_cta).length / bios.length;
    bioPatterns.has_social_proof_rate = bios.filter((b: any) => b?.has_social_proof).length / bios.length;
    bioPatterns.has_link_rate = bios.filter((b: any) => b?.has_link).length / bios.length;
  }

  // Content evolution
  let contentEvolution: Record<string, any> = {};
  try {
    const { data: evoData } = await supabase
      .from('brain_content_evolution')
      .select('dimension, old_primary, new_primary, growth_correlated')
      .in('username', usernames)
      .eq('growth_correlated', true);

    if (evoData && evoData.length > 0) {
      const shifts: Record<string, number> = {};
      for (const e of evoData) {
        const key = `${e.dimension}: ${e.old_primary}→${e.new_primary}`;
        shifts[key] = (shifts[key] ?? 0) + 1;
      }
      contentEvolution = shifts;
    }
  } catch {}

  // Stagnant comparison
  const stagnantComparison = await computeStagnantComparison(supabase, fromRange, niche);

  // Key differentiators
  const keyDiffs: Record<string, string> = {};
  const postsPerDay = avg((freqData ?? []).map((f: any) => f.posts_per_day_7d).filter(Boolean));
  const replyRatio = totalTweets > 0 ? replyTweets.length / totalTweets : 0;

  if (stagnantComparison) {
    if (postsPerDay && stagnantComparison.avg_posts_per_day) {
      const diff = postsPerDay - stagnantComparison.avg_posts_per_day;
      if (Math.abs(diff) > 0.5) {
        keyDiffs.posting_volume = `Growers post ${postsPerDay.toFixed(1)}/day vs stagnant ${stagnantComparison.avg_posts_per_day.toFixed(1)}/day`;
      }
    }
    if (replyRatio > 0 && stagnantComparison.reply_ratio != null) {
      const diff = replyRatio - stagnantComparison.reply_ratio;
      if (Math.abs(diff) > 0.1) {
        keyDiffs.reply_strategy = `Growers reply ${Math.round(replyRatio * 100)}% vs stagnant ${Math.round(stagnantComparison.reply_ratio * 100)}%`;
      }
    }
  }

  // Compute days to transition from snapshots
  let avgDays: number | null = null;
  try {
    const daysList: number[] = [];
    for (const acct of accounts.slice(0, 20)) {
      const { data: snaps } = await supabase
        .from('brain_account_snapshots')
        .select('followers_count, checked_at')
        .eq('username', acct.username)
        .order('checked_at', { ascending: true })
        .limit(50);

      if (snaps && snaps.length >= 2) {
        const first = new Date(snaps[0].checked_at);
        const last = new Date(snaps[snaps.length - 1].checked_at);
        const days = (last.getTime() - first.getTime()) / (24 * 60 * 60 * 1000);
        if (days > 0) daysList.push(days);
      }
    }
    avgDays = avg(daysList);
  } catch {}

  const confidence = sampleSize >= 20 ? 'high' : sampleSize >= 10 ? 'medium' : 'low';

  return {
    sample_size: sampleSize,
    avg_posts_per_day: postsPerDay,
    avg_replies_per_day: avg((freqData ?? []).map((f: any) => (f.posts_per_day_7d ?? 0) * (f.reply_ratio_7d ?? 0)).filter(Boolean)),
    avg_threads_per_day: totalTweets > 0 ? Math.round((threadTweets.length / totalTweets) * (postsPerDay ?? 1) * 100) / 100 : null,
    avg_word_count_posts: avg(wordCounts(originals)),
    avg_word_count_replies: avg(wordCounts(replyTweets)),
    reply_ratio: Math.round(replyRatio * 100) / 100,
    thread_ratio: totalTweets > 0 ? Math.round((threadTweets.length / totalTweets) * 100) / 100 : null,
    reply_target_distribution: replyTargets.length > 0 ? replyTargetDist : null,
    avg_reply_target_followers: avg(replyTargets),
    avg_reply_delay_minutes: avg(replyTweets.map((t: any) => t.reply_delay_minutes).filter(Boolean)),
    top_hook_types: dist(classifications, 'hook_type'),
    top_tones: dist(classifications, 'tone'),
    top_formats: dist(classifications, 'format'),
    best_posting_hours_utc: bestHours,
    media_type_distribution: mediaDist,
    cta_usage_rate: totalTweets > 0 ? Math.round((ctaCount / totalTweets) * 100) / 100 : null,
    avg_algo_score: avg(tweets.map((t: any) => t.algo_score).filter(Boolean)),
    avg_bookmark_save_rate: avg(tweets.map((t: any) => t.bookmark_save_rate).filter(Boolean)),
    avg_engagement_rate: avg(tweets.map((t: any) => t.engagement_rate).filter(Boolean)),
    avg_likes: avg(tweets.map((t: any) => t.likes ?? 0)),
    avg_views: avg(tweets.map((t: any) => t.views).filter((v: number) => v > 0)),
    bio_patterns: Object.keys(bioPatterns).length > 0 ? bioPatterns : null,
    content_evolution_patterns: Object.keys(contentEvolution).length > 0 ? contentEvolution : null,
    stagnant_comparison: stagnantComparison,
    key_differentiators: Object.keys(keyDiffs).length > 0 ? keyDiffs : null,
    avg_days_to_transition: avgDays,
    confidence,
  };
}

async function computeStagnantComparison(
  supabase: any,
  fromRange: string,
  niche: string | null,
): Promise<Record<string, any> | null> {
  // Get stagnant accounts in same range
  let query = supabase
    .from('brain_accounts')
    .select('username')
    .eq('follower_range', fromRange)
    .eq('growth_status', 'boring')
    .eq('is_active', true)
    .gte('tweets_collected_count', 5)
    .limit(30);

  if (niche) query = query.eq('niche_cached', niche);

  const { data: stagnant } = await query;
  if (!stagnant || stagnant.length < 3) return null;

  const usernames = stagnant.map((a: any) => a.username);

  const { data: tweets } = await supabase
    .from('brain_tweets')
    .select('tweet_type, content, likes, views')
    .in('author_username', usernames)
    .limit(usernames.length * 50);

  if (!tweets || tweets.length < 10) return null;

  const originals = tweets.filter((t: any) => t.tweet_type === 'original');
  const replies = tweets.filter((t: any) => t.tweet_type === 'reply');

  const { data: freqData } = await supabase
    .from('brain_posting_frequency')
    .select('posts_per_day_7d, reply_ratio_7d')
    .in('username', usernames)
    .limit(usernames.length);

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null;

  return {
    sample_size: stagnant.length,
    avg_posts_per_day: avg((freqData ?? []).map((f: any) => f.posts_per_day_7d).filter(Boolean)),
    reply_ratio: tweets.length > 0 ? replies.length / tweets.length : 0,
    avg_likes: avg(tweets.map((t: any) => t.likes ?? 0)),
    avg_views: avg(tweets.map((t: any) => t.views).filter((v: number) => v > 0)),
    avg_word_count: avg(originals.filter((t: any) => t.content).map((t: any) => (t.content as string).split(/\s+/).length)),
  };
}

async function upsertPlaybook(
  supabase: any,
  fromRange: string,
  toRange: string,
  niche: string | null,
  data: Record<string, any>,
): Promise<void> {
  const record = {
    niche,
    from_range: fromRange,
    to_range: toRange,
    ...data,
    computed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Check existing (COALESCE unique constraint)
  const { data: existing } = await supabase
    .from('brain_growth_playbooks')
    .select('id')
    .eq('from_range', fromRange)
    .eq('to_range', toRange)
    [niche ? 'eq' : 'is']('niche', niche)
    .single();

  if (existing) {
    await supabase.from('brain_growth_playbooks').update(record).eq('id', existing.id);
  } else {
    await supabase.from('brain_growth_playbooks').insert(record);
  }
}
