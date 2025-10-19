/**
 * 🎯 DYNAMIC FEW-SHOT PROVIDER
 * 
 * Fetches YOUR top-performing tweets from database
 * Uses YOUR proven content as training examples
 * 
 * This is FREE and learns YOUR voice/style
 */

import { getSupabaseClient } from '../db/index';

export interface TopTweet {
  content: string;
  likes: number;
  retweets: number;
  replies: number;
  engagement_rate: number;
  posted_at: string;
  topic?: string;
}

/**
 * Fetch YOUR top-performing tweets from database
 */
export async function fetchTopTweets(limit: number = 10): Promise<TopTweet[]> {
  const supabase = getSupabaseClient();
  
  try {
    // Query outcomes table for YOUR best tweets
    const { data, error } = await supabase
      .from('outcomes')
      .select('content, likes, retweets, replies, posted_at, topic_cluster')
      .order('likes', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('[DYNAMIC_FEW_SHOT] ❌ Database error:', error);
      return [];
    }
    
    if (!data || data.length === 0) {
      console.log('[DYNAMIC_FEW_SHOT] ℹ️ No tweets found yet, will use defaults');
      return [];
    }
    
    // Calculate engagement rate and format
    const topTweets: TopTweet[] = data.map(tweet => {
      const totalEngagement = (tweet.likes || 0) + (tweet.retweets || 0) + (tweet.replies || 0);
      const engagementRate = totalEngagement / Math.max(1, tweet.likes || 1);
      
      return {
        content: tweet.content || '',
        likes: tweet.likes || 0,
        retweets: tweet.retweets || 0,
        replies: tweet.replies || 0,
        engagement_rate: engagementRate,
        posted_at: tweet.posted_at || '',
        topic: tweet.topic_cluster || undefined
      };
    });
    
    console.log(`[DYNAMIC_FEW_SHOT] ✅ Loaded ${topTweets.length} top tweets (${topTweets[0]?.likes || 0} max likes)`);
    
    return topTweets;
    
  } catch (error: any) {
    console.error('[DYNAMIC_FEW_SHOT] ❌ Failed to fetch top tweets:', error.message);
    return [];
  }
}

/**
 * Format YOUR top tweets for prompt injection
 */
export function formatTopTweetsForPrompt(tweets: TopTweet[]): string {
  if (tweets.length === 0) {
    return '';
  }
  
  return `
🏆 YOUR TOP-PERFORMING TWEETS (Learn from YOUR success):

${tweets.slice(0, 5).map((tweet, idx) => `
${idx + 1}. "${tweet.content}"
   📊 ${tweet.likes} likes, ${tweet.retweets} retweets, ${tweet.replies} replies
   🎯 Engagement Rate: ${tweet.engagement_rate.toFixed(2)}
   📅 Posted: ${new Date(tweet.posted_at).toLocaleDateString()}
`).join('\n')}

These are YOUR most successful tweets. Study the style, tone, and structure.
Create new content that matches what YOUR audience actually responds to.
`;
}

/**
 * Get topic-specific examples from YOUR history
 */
export async function getTopTweetsForTopic(topic: string, limit: number = 3): Promise<TopTweet[]> {
  const supabase = getSupabaseClient();
  
  try {
    const { data, error } = await supabase
      .from('outcomes')
      .select('content, likes, retweets, replies, posted_at, topic_cluster')
      .ilike('topic_cluster', `%${topic}%`)
      .order('likes', { ascending: false })
      .limit(limit);
    
    if (error || !data || data.length === 0) {
      // Fallback to general top tweets
      return fetchTopTweets(limit);
    }
    
    return data.map(tweet => ({
      content: tweet.content || '',
      likes: tweet.likes || 0,
      retweets: tweet.retweets || 0,
      replies: tweet.replies || 0,
      engagement_rate: ((tweet.likes || 0) + (tweet.retweets || 0) + (tweet.replies || 0)) / Math.max(1, tweet.likes || 1),
      posted_at: tweet.posted_at || '',
      topic: tweet.topic_cluster || undefined
    }));
    
  } catch (error) {
    return fetchTopTweets(limit);
  }
}

/**
 * Cache top tweets to avoid repeated queries
 */
let cachedTopTweets: TopTweet[] | null = null;
let lastCacheTime: number = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

export async function getCachedTopTweets(): Promise<TopTweet[]> {
  const now = Date.now();
  
  if (cachedTopTweets && (now - lastCacheTime) < CACHE_DURATION) {
    return cachedTopTweets;
  }
  
  cachedTopTweets = await fetchTopTweets(10);
  lastCacheTime = now;
  
  return cachedTopTweets;
}

