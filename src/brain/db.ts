/**
 * Brain System v2 — Database Access Layer
 *
 * Typed CRUD helpers for all brain tables.
 * All brain modules import from here, never directly from supabase.
 */

import { getSupabaseClient } from '../db';
import type {
  BrainTweet,
  BrainTweetSnapshot,
  BrainAccount,
  BrainKeyword,
  BrainClassification,
  SelfModelState,
  FeedbackEvent,
  AccountTier,
  GrowthPhase,
} from './types';

function supabase() {
  return getSupabaseClient();
}

// =============================================================================
// brain_tweets
// =============================================================================

export async function upsertBrainTweets(tweets: Partial<BrainTweet>[]): Promise<number> {
  if (tweets.length === 0) return 0;

  const { data, error } = await supabase()
    .from('brain_tweets')
    .upsert(tweets, { onConflict: 'tweet_id', ignoreDuplicates: false })
    .select('tweet_id');

  if (error) {
    console.error('[brain/db] upsertBrainTweets error:', error.message);
    return 0;
  }
  return data?.length ?? 0;
}

export async function getBrainTweetsForRescrape(limit: number = 20): Promise<Pick<BrainTweet, 'tweet_id' | 'author_username' | 'likes' | 'views' | 'rescrape_count'>[]> {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase()
    .from('brain_tweets')
    .select('tweet_id, author_username, likes, views, rescrape_count')
    .gt('posted_at', cutoff)
    .gte('likes', 20)
    .lt('rescrape_count', 5)
    .order('last_rescrape_at', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) {
    console.error('[brain/db] getBrainTweetsForRescrape error:', error.message);
    return [];
  }
  return data ?? [];
}

export async function getBrainTweetsForClassification(limit: number = 50): Promise<Pick<BrainTweet, 'tweet_id' | 'content' | 'author_username' | 'author_followers' | 'likes' | 'views' | 'viral_multiplier'>[]> {
  // Classify ALL tweets — winners AND failures. To understand Twitter we need the
  // full spectrum. Prioritize: mega-viral first, then solid, then average, then low.
  // This ensures we learn from the best AND worst tweets.

  // Strategy: fetch unclassified tweets ordered by likes DESC (biggest wins first)
  // This means the backlog naturally processes mega-viral → solid → average → failures
  const { data: tweets } = await supabase()
    .from('brain_tweets')
    .select('tweet_id, content, author_username, author_followers, likes, views, viral_multiplier')
    .order('likes', { ascending: false })
    .limit(limit * 3); // Overfetch to account for already-classified

  if (!tweets || tweets.length === 0) return [];

  const tweetIds = tweets.map(t => t.tweet_id);
  const { data: classified } = await supabase()
    .from('brain_classifications')
    .select('tweet_id')
    .in('tweet_id', tweetIds);

  const classifiedSet = new Set((classified ?? []).map(c => c.tweet_id));
  return tweets.filter(t => !classifiedSet.has(t.tweet_id)).slice(0, limit);
}

export async function getBrainTweetsForDeepAnalysis(limit: number = 5): Promise<Pick<BrainTweet, 'tweet_id' | 'author_username' | 'viral_multiplier'>[]> {
  // Viral tweets without Stage 4 classification
  const { data: viral } = await supabase()
    .from('brain_tweets')
    .select('tweet_id, author_username, viral_multiplier')
    .gt('viral_multiplier', 5)
    .order('viral_multiplier', { ascending: false })
    .limit(limit * 3);

  if (!viral || viral.length === 0) return [];

  const ids = viral.map(v => v.tweet_id);
  const { data: classified } = await supabase()
    .from('brain_classifications')
    .select('tweet_id')
    .in('tweet_id', ids)
    .eq('classification_stage', 4);

  const doneSet = new Set((classified ?? []).map(c => c.tweet_id));
  return viral.filter(v => !doneSet.has(v.tweet_id)).slice(0, limit);
}

export async function updateBrainTweetRescrape(
  tweetId: string,
  metrics: { views: number; likes: number; retweets: number; replies: number; bookmarks: number; quotes: number },
  trajectory: string | null,
  peakVelocity: number | null,
  timeToPeak: number | null,
): Promise<void> {
  await supabase()
    .from('brain_tweets')
    .update({
      views: metrics.views,
      likes: metrics.likes,
      retweets: metrics.retweets,
      replies: metrics.replies,
      bookmarks: metrics.bookmarks,
      quotes: metrics.quotes,
      rescrape_count: supabase().rpc ? undefined : undefined, // increment handled below
      last_rescrape_at: new Date().toISOString(),
      engagement_trajectory: trajectory,
      peak_velocity: peakVelocity,
      time_to_peak_minutes: timeToPeak,
      peak_likes: metrics.likes,
      peak_views: metrics.views,
    })
    .eq('tweet_id', tweetId);

  // Increment rescrape_count via raw SQL workaround
  try {
    await supabase().rpc('increment_brain_tweet_rescrape', { p_tweet_id: tweetId });
  } catch {
    // RPC may not exist yet — silently ignore
  }
}

// =============================================================================
// brain_tweet_snapshots
// =============================================================================

export async function insertBrainTweetSnapshot(snapshot: Omit<BrainTweetSnapshot, 'id' | 'scraped_at'>): Promise<void> {
  const { error } = await supabase()
    .from('brain_tweet_snapshots')
    .insert({ ...snapshot, scraped_at: new Date().toISOString() });

  if (error) {
    console.error('[brain/db] insertBrainTweetSnapshot error:', error.message);
  }
}

export async function getSnapshotsForTweet(tweetId: string): Promise<BrainTweetSnapshot[]> {
  const { data, error } = await supabase()
    .from('brain_tweet_snapshots')
    .select('*')
    .eq('tweet_id', tweetId)
    .order('scraped_at', { ascending: true });

  if (error) {
    console.error('[brain/db] getSnapshotsForTweet error:', error.message);
    return [];
  }
  return data ?? [];
}

// =============================================================================
// brain_accounts
// =============================================================================

export async function upsertBrainAccounts(accounts: Partial<BrainAccount>[]): Promise<number> {
  if (accounts.length === 0) return 0;

  const { data, error } = await supabase()
    .from('brain_accounts')
    .upsert(accounts, { onConflict: 'username', ignoreDuplicates: false })
    .select('username');

  if (error) {
    console.error('[brain/db] upsertBrainAccounts error:', error.message);
    return 0;
  }
  return data?.length ?? 0;
}

export async function getAccountsForScraping(limit: number = 8): Promise<Pick<BrainAccount, 'username' | 'tier' | 'last_scraped_at' | 'scrape_priority'>[]> {
  const { data, error } = await supabase()
    .from('brain_accounts')
    .select('username, tier, last_scraped_at, scrape_priority')
    .eq('is_active', true)
    .order('last_scraped_at', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) {
    console.error('[brain/db] getAccountsForScraping error:', error.message);
    return [];
  }
  return data ?? [];
}

export async function getAccountsByTier(tier: AccountTier, limit: number = 100): Promise<Pick<BrainAccount, 'username' | 'followers_count' | 'avg_engagement_rate_30d' | 'tier_score'>[]> {
  const { data, error } = await supabase()
    .from('brain_accounts')
    .select('username, followers_count, avg_engagement_rate_30d, tier_score')
    .eq('tier', tier)
    .eq('is_active', true)
    .order('tier_score', { ascending: false })
    .limit(limit);

  if (error) return [];
  return data ?? [];
}

export async function getAllActiveAccounts(): Promise<any[]> {
  const { data, error } = await supabase()
    .from('brain_accounts')
    .select('username, tier, tier_score, avg_engagement_rate_30d, tweets_collected_count, growth_rate_7d, growth_acceleration')
    .eq('is_active', true);

  if (error) return [];
  return data ?? [];
}

export async function updateAccountAfterScrape(
  username: string,
  success: boolean,
  tweetsFound: number,
): Promise<void> {
  if (success) {
    const { error } = await supabase()
      .from('brain_accounts')
      .update({
        last_scraped_at: new Date().toISOString(),
        scrape_success_count: supabase().rpc ? undefined : undefined,
        tweets_collected_count: supabase().rpc ? undefined : undefined,
        consecutive_failures: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('username', username);

    // Simple increment via RPC
    if (!error) {
      try {
        await supabase().rpc('increment_brain_account_scrape_success', {
          p_username: username,
          p_tweets_found: tweetsFound,
        });
      } catch {
        // RPC may not exist yet — silently ignore
      }
    }
  } else {
    await supabase()
      .from('brain_accounts')
      .update({
        last_scraped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('username', username);
  }
}

export async function updateAccountTiers(tiers: { username: string; tier: AccountTier; tier_score: number }[]): Promise<number> {
  let updated = 0;
  for (const { username, tier, tier_score } of tiers) {
    const { error } = await supabase()
      .from('brain_accounts')
      .update({ tier, tier_score, tier_updated_at: new Date().toISOString() })
      .eq('username', username);

    if (!error) updated++;
  }
  return updated;
}

// =============================================================================
// brain_keywords
// =============================================================================

export async function upsertBrainKeywords(keywords: Partial<BrainKeyword>[]): Promise<number> {
  if (keywords.length === 0) return 0;

  const { data, error } = await supabase()
    .from('brain_keywords')
    .upsert(keywords, { onConflict: 'keyword', ignoreDuplicates: true })
    .select('keyword');

  if (error) {
    console.error('[brain/db] upsertBrainKeywords error:', error.message);
    return 0;
  }
  return data?.length ?? 0;
}

export async function getKeywordsForSearch(limit: number = 3): Promise<Pick<BrainKeyword, 'keyword' | 'priority' | 'domain_hint' | 'last_searched_at'>[]> {
  const { data, error } = await supabase()
    .from('brain_keywords')
    .select('keyword, priority, domain_hint, last_searched_at')
    .eq('is_active', true)
    .order('last_searched_at', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) {
    console.error('[brain/db] getKeywordsForSearch error:', error.message);
    return [];
  }
  return data ?? [];
}

export async function updateKeywordAfterSearch(
  keyword: string,
  tweetsFound: number,
  avgEngagement: number | null,
  viralCount: number,
  uniqueAuthors: number,
): Promise<void> {
  await supabase()
    .from('brain_keywords')
    .update({
      tweets_found_last_run: tweetsFound,
      avg_engagement_found: avgEngagement,
      last_searched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('keyword', keyword);
}

export async function deactivateKeyword(keyword: string, reason: string): Promise<void> {
  await supabase()
    .from('brain_keywords')
    .update({
      is_active: false,
      deactivated_reason: reason,
      deactivated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('keyword', keyword);
}

// =============================================================================
// brain_classifications
// =============================================================================

export async function upsertBrainClassifications(classifications: Partial<BrainClassification>[]): Promise<number> {
  if (classifications.length === 0) return 0;

  const { data, error } = await supabase()
    .from('brain_classifications')
    .upsert(classifications, { onConflict: 'tweet_id', ignoreDuplicates: false })
    .select('tweet_id');

  if (error) {
    console.error('[brain/db] upsertBrainClassifications error:', error.message);
    return 0;
  }
  return data?.length ?? 0;
}

export async function getClassifiedTweetsByDimension(
  dimension: string,
  value: string,
  accountTier?: AccountTier,
  limit: number = 100,
): Promise<any[]> {
  let query = supabase()
    .from('brain_classifications')
    .select(`
      tweet_id,
      domain,
      hook_type,
      tone,
      format,
      emotional_trigger,
      specificity,
      actionability,
      identity_signal,
      brain_tweets!inner(views, likes, engagement_rate, author_tier, posted_hour_utc)
    `)
    .eq(dimension, value)
    .limit(limit);

  if (accountTier) {
    query = query.eq('brain_tweets.author_tier', accountTier);
  }

  const { data, error } = await query;
  if (error) return [];
  return data ?? [];
}

// =============================================================================
// self_model_state
// =============================================================================

export async function getSelfModel(): Promise<SelfModelState | null> {
  const { data, error } = await supabase()
    .from('self_model_state')
    .select('*')
    .eq('id', 1)
    .single();

  if (error) {
    console.error('[brain/db] getSelfModel error:', error.message);
    return null;
  }
  return data;
}

export async function updateSelfModel(updates: Partial<SelfModelState>): Promise<void> {
  const { error } = await supabase()
    .from('self_model_state')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', 1);

  if (error) {
    console.error('[brain/db] updateSelfModel error:', error.message);
  }
}

// =============================================================================
// feedback_events
// =============================================================================

export async function insertFeedbackEvent(event: Omit<FeedbackEvent, 'id' | 'created_at'>): Promise<string | null> {
  const { data, error } = await supabase()
    .from('feedback_events')
    .insert(event)
    .select('id')
    .single();

  if (error) {
    console.error('[brain/db] insertFeedbackEvent error:', error.message);
    return null;
  }
  return data?.id ?? null;
}

export async function getRecentFeedbackEvents(
  days: number = 7,
  actionType?: string,
): Promise<FeedbackEvent[]> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase()
    .from('feedback_events')
    .select('*')
    .gt('created_at', cutoff)
    .order('created_at', { ascending: false });

  if (actionType) {
    query = query.eq('action_type', actionType);
  }

  const { data, error } = await query;
  if (error) return [];
  return data ?? [];
}

export async function getFailureDiagnosisSummary(days: number = 30): Promise<{ diagnosis: string; count: number; avg_delta: number }[]> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase()
    .from('feedback_events')
    .select('failure_diagnosis, views_delta')
    .gt('created_at', cutoff)
    .not('failure_diagnosis', 'is', null);

  if (error || !data) return [];

  // Aggregate in code (Supabase doesn't support GROUP BY easily)
  const groups: Record<string, { count: number; totalDelta: number }> = {};
  for (const row of data) {
    const d = row.failure_diagnosis as string;
    if (!groups[d]) groups[d] = { count: 0, totalDelta: 0 };
    groups[d].count++;
    groups[d].totalDelta += row.views_delta ?? 0;
  }

  return Object.entries(groups)
    .map(([diagnosis, { count, totalDelta }]) => ({
      diagnosis,
      count,
      avg_delta: count > 0 ? totalDelta / count : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

// =============================================================================
// Utility: Brain system stats
// =============================================================================

export async function getBrainStats(): Promise<{
  tweets: number;
  accounts: number;
  keywords: number;
  classifications: number;
  feedback_events: number;
  accounts_by_tier: Record<string, number>;
}> {
  const [tweets, accounts, keywords, classifications, feedback] = await Promise.all([
    supabase().from('brain_tweets').select('id', { count: 'exact', head: true }),
    supabase().from('brain_accounts').select('id', { count: 'exact', head: true }),
    supabase().from('brain_keywords').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase().from('brain_classifications').select('id', { count: 'exact', head: true }),
    supabase().from('feedback_events').select('id', { count: 'exact', head: true }),
  ]);

  const { data: tierData } = await supabase()
    .from('brain_accounts')
    .select('tier')
    .eq('is_active', true);

  const accounts_by_tier: Record<string, number> = {};
  for (const row of tierData ?? []) {
    accounts_by_tier[row.tier] = (accounts_by_tier[row.tier] ?? 0) + 1;
  }

  return {
    tweets: tweets.count ?? 0,
    accounts: accounts.count ?? 0,
    keywords: keywords.count ?? 0,
    classifications: classifications.count ?? 0,
    feedback_events: feedback.count ?? 0,
    accounts_by_tier,
  };
}

// =============================================================================
// Observatory: Snapshot + Growth helpers
// =============================================================================

export async function insertAccountSnapshot(snapshot: { username: string; followers_count: number | null; following_count: number | null; bio_text?: string | null }): Promise<void> {
  const { error } = await supabase()
    .from('brain_account_snapshots')
    .insert({ ...snapshot, checked_at: new Date().toISOString() });

  if (error) {
    console.error('[brain/db] insertAccountSnapshot error:', error.message);
  }
}

export async function getAccountSnapshots(username: string, limit: number = 30): Promise<{ followers_count: number; following_count: number | null; checked_at: string }[]> {
  const { data, error } = await supabase()
    .from('brain_account_snapshots')
    .select('followers_count, following_count, checked_at')
    .eq('username', username)
    .order('checked_at', { ascending: false })
    .limit(limit);

  if (error) return [];
  return data ?? [];
}

export async function getGrowingAccounts(minStatus: string = 'interesting'): Promise<{ username: string; growth_status: string; growth_rate_7d: number; followers_count: number }[]> {
  const statuses = minStatus === 'hot' ? ['hot', 'explosive'] :
                   minStatus === 'explosive' ? ['explosive'] :
                   ['interesting', 'hot', 'explosive'];

  const { data, error } = await supabase()
    .from('brain_accounts')
    .select('username, growth_status, growth_rate_7d, followers_count')
    .in('growth_status', statuses)
    .eq('is_active', true)
    .order('growth_rate_7d', { ascending: false });

  if (error) return [];
  return data ?? [];
}

export async function getPendingGrowthEvents(limit: number = 10): Promise<{ id: string; username: string; detected_at: string; followers_at_detection: number; growth_rate_after: number }[]> {
  const { data, error } = await supabase()
    .from('brain_growth_events')
    .select('id, username, detected_at, followers_at_detection, growth_rate_after')
    .eq('retrospective_status', 'pending')
    .order('detected_at', { ascending: false })
    .limit(limit);

  if (error) return [];
  return data ?? [];
}
