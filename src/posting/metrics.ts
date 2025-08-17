/**
 * Enhanced Metrics Module with Success Logging
 * Handles upserts to tweet_metrics and learning_posts with comprehensive logging
 */

// Get supabase client dynamically to avoid circular dependencies
async function getSupabase() {
  try {
    const { DatabaseManager } = await import('../lib/db');
    const dbManager = DatabaseManager.getInstance();
    return dbManager.getSupabaseClient();
  } catch (error) {
    // Fallback: create direct connection
    const { createClient } = await import('@supabase/supabase-js');
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Missing Supabase credentials');
    return createClient(url, key);
  }
}

export interface TweetMetrics {
  tweet_id: string;
  likes_count: number;
  retweets_count: number;
  replies_count: number;
  bookmarks_count?: number;
  impressions_count?: number;
  content?: string;
  collected_at?: string;
}

export interface LearningPost {
  tweet_id: string;
  format: 'single' | 'thread';
  likes_count: number;
  retweets_count: number;
  replies_count: number;
  bookmarks_count?: number;
  impressions_count?: number;
  content?: string;
  viral_potential_score?: number;
  created_at?: string;
}

/**
 * Upsert tweet metrics with success logging
 */
export async function upsertTweetMetrics(metrics: TweetMetrics): Promise<void> {
  try {
    const supabase = await getSupabase();
    const collected_at = metrics.collected_at || new Date().toISOString();
    
    const row = {
      tweet_id: metrics.tweet_id,
      collected_at,
      likes_count: metrics.likes_count,
      retweets_count: metrics.retweets_count,
      replies_count: metrics.replies_count,
      bookmarks_count: metrics.bookmarks_count || 0,
      impressions_count: metrics.impressions_count || 0,
      content: metrics.content || null
    };

    const { error } = await supabase
      .from('tweet_metrics')
      .upsert([row], { 
        onConflict: 'tweet_id,collected_at',
        ignoreDuplicates: false 
      });

    if (error) {
      console.error(`❌ METRICS_UPSERT_FAILED tweet_id=${metrics.tweet_id} error=${error.message} payload_keys=[${Object.keys(row).join(',')}]`);
      throw new Error(`tweet_metrics upsert failed: ${error.message}`);
    }

    console.log(`METRICS_UPSERT_OK ${JSON.stringify({
      tweet_id: metrics.tweet_id,
      collected_at
    })}`);

  } catch (error: any) {
    console.error(`❌ METRICS_UPSERT_FAILED tweet_id=${metrics.tweet_id} error=${error.message} payload_keys=[${Object.keys(metrics).join(',')}]`);
    throw error;
  }
}

/**
 * Upsert learning post with success logging
 */
export async function upsertLearningPost(post: LearningPost): Promise<void> {
  try {
    const supabase = await getSupabase();
    const created_at = post.created_at || new Date().toISOString();
    
    // Calculate viral potential score if not provided
    const viralScore = post.viral_potential_score || calculateViralPotentialScore({
      likes: post.likes_count,
      retweets: post.retweets_count,
      replies: post.replies_count,
      impressions: post.impressions_count || 0
    });
    
    const row = {
      tweet_id: post.tweet_id,
      created_at,
      format: post.format,
      likes_count: post.likes_count,
      retweets_count: post.retweets_count,
      replies_count: post.replies_count,
      bookmarks_count: post.bookmarks_count || 0,
      impressions_count: post.impressions_count || 0,
      viral_potential_score: viralScore,
      content: post.content || null
    };

    const { error } = await supabase
      .from('learning_posts')
      .upsert([row], { 
        onConflict: 'tweet_id',
        ignoreDuplicates: false 
      });

    if (error) {
      console.error(`❌ LEARNING_UPSERT_FAILED tweet_id=${post.tweet_id} error=${error.message} payload_keys=[${Object.keys(row).join(',')}]`);
      throw new Error(`learning_posts upsert failed: ${error.message}`);
    }

    console.log(`LEARNING_UPSERT_OK ${JSON.stringify({
      tweet_id: post.tweet_id
    })}`);

  } catch (error: any) {
    console.error(`❌ LEARNING_UPSERT_FAILED tweet_id=${post.tweet_id} error=${error.message} payload_keys=[${Object.keys(post).join(',')}]`);
    throw error;
  }
}

/**
 * Calculate viral potential score based on engagement metrics
 */
function calculateViralPotentialScore(metrics: {
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
}): number {
  const { likes, retweets, replies, impressions } = metrics;
  
  // Weighted engagement score (retweets are most valuable for virality)
  const engagementScore = (likes * 1) + (retweets * 5) + (replies * 3);
  
  // Impression ratio (engagement per 1000 impressions)
  const impressionRatio = impressions > 0 ? (engagementScore / impressions) * 1000 : 0;
  
  // Combined score (0-100 scale)
  const rawScore = Math.log10(engagementScore + 1) * 20 + impressionRatio * 30;
  
  // Normalize to 0-100 scale
  return Math.min(100, Math.max(0, Math.round(rawScore)));
}

/**
 * Combined metrics storage for new posts
 */
export async function storeNewPostMetrics(params: {
  tweet_id: string;
  format: 'single' | 'thread';
  content?: string;
  initial_metrics?: Partial<TweetMetrics>;
}): Promise<void> {
  const { tweet_id, format, content, initial_metrics = {} } = params;
  
  // Store initial metrics (typically zeros for new posts)
  await upsertTweetMetrics({
    tweet_id,
    likes_count: initial_metrics.likes_count || 0,
    retweets_count: initial_metrics.retweets_count || 0,
    replies_count: initial_metrics.replies_count || 0,
    bookmarks_count: initial_metrics.bookmarks_count || 0,
    impressions_count: initial_metrics.impressions_count || 0,
    content,
    ...initial_metrics
  });
  
  // Store in learning posts
  await upsertLearningPost({
    tweet_id,
    format,
    likes_count: initial_metrics.likes_count || 0,
    retweets_count: initial_metrics.retweets_count || 0,
    replies_count: initial_metrics.replies_count || 0,
    bookmarks_count: initial_metrics.bookmarks_count || 0,
    impressions_count: initial_metrics.impressions_count || 0,
    content
  });
}

/**
 * Update metrics for existing post
 */
export async function updatePostMetrics(params: {
  tweet_id: string;
  likes_count: number;
  retweets_count: number;
  replies_count: number;
  bookmarks_count?: number;
  impressions_count?: number;
}): Promise<void> {
  const now = new Date().toISOString();
  
  // Update tweet_metrics (time-series data)
  await upsertTweetMetrics({
    ...params,
    collected_at: now
  });
  
  // Update learning_posts (latest data)
  try {
    const supabase = await getSupabase();
    
    const { error } = await supabase
      .from('learning_posts')
      .update({
        likes_count: params.likes_count,
        retweets_count: params.retweets_count,
        replies_count: params.replies_count,
        bookmarks_count: params.bookmarks_count || 0,
        impressions_count: params.impressions_count || 0,
        viral_potential_score: calculateViralPotentialScore({
          likes: params.likes_count,
          retweets: params.retweets_count,
          replies: params.replies_count,
          impressions: params.impressions_count || 0
        })
      })
      .eq('tweet_id', params.tweet_id);
    
    if (error) {
      throw new Error(`learning_posts update failed: ${error.message}`);
    }
    
    console.log(`LEARNING_UPDATE_OK ${JSON.stringify({
      tweet_id: params.tweet_id,
      engagement: params.likes_count + params.retweets_count + params.replies_count
    })}`);
    
  } catch (error: any) {
    console.error(`❌ LEARNING_UPDATE_FAILED tweet_id=${params.tweet_id} error=${error.message}`);
    throw error;
  }
}
