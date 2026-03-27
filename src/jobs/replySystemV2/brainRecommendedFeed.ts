/**
 * Brain-Recommended Feed for Reply System V2
 *
 * Queries brain_tweets for high-engagement tweets from accounts in our
 * target tier range. Returns the same CuratedTweet shape as other feeds
 * so the orchestrator can process them identically.
 *
 * This is the integration point between the brain system and the reply pipeline.
 * The brain finds good tweets domain-agnostically; the AI judge still evaluates
 * health_angle_fit before we actually reply.
 */

import { getSupabaseClient } from '../../db';
import type { CuratedTweet } from './curatedAccountsFeed';

const LOG_PREFIX = '[brain-recommended-feed]';
const MAX_TWEETS = 10;
const MIN_LIKES = 20;
const MAX_AGE_HOURS = 6;

/**
 * Fetch high-engagement tweets from brain_tweets that are good reply candidates.
 * Targets accounts 1-2 tiers above us based on self_model_state.
 */
export async function fetchBrainRecommendedFeed(): Promise<CuratedTweet[]> {
  const supabase = getSupabaseClient();

  try {
    // Get our growth phase to determine target tiers
    const { data: selfModel } = await supabase
      .from('self_model_state')
      .select('growth_phase, follower_count')
      .eq('id', 1)
      .single();

    const phase = selfModel?.growth_phase ?? 'cold_start';
    const targetTiers = getTargetTiers(phase);

    const cutoff = new Date(Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000).toISOString();

    // Query brain_tweets for recent, high-engagement tweets from target-tier accounts
    const { data: brainTweets, error } = await supabase
      .from('brain_tweets')
      .select('tweet_id, author_username, content, posted_at, likes, replies, retweets, author_tier')
      .in('author_tier', targetTiers)
      .gte('likes', MIN_LIKES)
      .gte('posted_at', cutoff)
      .eq('tweet_type', 'original')
      .order('likes', { ascending: false })
      .limit(MAX_TWEETS);

    if (error) {
      console.error(`${LOG_PREFIX} Query error:`, error.message);
      return [];
    }

    if (!brainTweets || brainTweets.length === 0) {
      console.log(`${LOG_PREFIX} No brain-recommended tweets for tiers ${targetTiers.join(',')}`);
      return [];
    }

    // Convert to CuratedTweet shape
    const tweets: CuratedTweet[] = brainTweets.map(bt => ({
      tweet_id: bt.tweet_id,
      author_username: bt.author_username,
      content: bt.content,
      posted_at: bt.posted_at ?? new Date().toISOString(),
      like_count: bt.likes ?? 0,
      reply_count: bt.replies ?? 0,
      retweet_count: bt.retweets ?? 0,
    }));

    console.log(`${LOG_PREFIX} Found ${tweets.length} brain-recommended tweets (tiers: ${targetTiers.join(',')})`);
    return tweets;
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Error:`, err.message);
    return [];
  }
}

function getTargetTiers(phase: string): string[] {
  switch (phase) {
    case 'cold_start': return ['B', 'A'];
    case 'early_traction': return ['B', 'A'];
    case 'growth': return ['A', 'S'];
    case 'authority': return ['A', 'S'];
    case 'scale': return ['S'];
    default: return ['B', 'A'];
  }
}
