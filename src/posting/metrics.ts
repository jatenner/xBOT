/**
 * Enhanced Metrics Module with Success Logging and Self-Healing
 * Handles upserts to tweet_metrics and learning_posts with comprehensive logging
 */

// Process-lifetime self-heal tracking
let hasTriggeredSelfHeal = false;

// Import admin supabase client for all database writes
import { admin } from '../lib/supabaseClients';

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
 * Upsert tweet metrics with non-fatal error handling
 */
export async function upsertTweetMetrics(metrics: TweetMetrics): Promise<{ ok: boolean; retryable: boolean }> {
  try {
    const supabase = admin;
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
        onConflict: 'tweet_id,collected_at', // Match the composite primary key
        ignoreDuplicates: false 
      });

    if (error) {
      const errorMsg = error.message;
      const isSchemaError = errorMsg.includes('schema cache') || 
                           (errorMsg.includes('column') && errorMsg.includes('does not exist')) ||
                           (errorMsg.includes('relation') && errorMsg.includes('does not exist'));
      
      console.error(`❌ METRICS_UPSERT_FAILED tweet_id=${metrics.tweet_id} error=${errorMsg} payload_keys=[${Object.keys(row).join(',')}] retryable=${isSchemaError}`);
      
      if (isSchemaError && !hasTriggeredSelfHeal) {
        // First-time schema error - trigger self-heal and retry once
        hasTriggeredSelfHeal = true;
        console.log(`SCHEMA_SELF_HEAL: detected missing column; ensuring core schema + reload`);
        
        try {
          const { ensureSchemaAtBoot } = await import('../services/SchemaGuard');
          await ensureSchemaAtBoot();
          
          // Retry the upsert once after schema healing
          const { error: retryError } = await supabase
            .from('tweet_metrics')
            .upsert([row], { 
              onConflict: 'tweet_id,collected_at', // Match the composite primary key
              ignoreDuplicates: false 
            });
          
          if (!retryError) {
            console.log(`METRICS_UPSERT_OK ${JSON.stringify({
              tweet_id: metrics.tweet_id,
              collected_at
            })}`);
            return { ok: true, retryable: false };
          } else {
            // Self-heal didn't work - soft fail
            console.warn(`METRICS_UPSERT_SOFTFAIL tweet_id=${metrics.tweet_id} reason=${retryError.message} action=skipped (post succeeded)`);
            return { ok: false, retryable: false };
          }
        } catch (healError: any) {
          console.warn(`SCHEMA_SELF_HEAL_FAILED: ${healError.message}`);
          console.warn(`METRICS_UPSERT_SOFTFAIL tweet_id=${metrics.tweet_id} reason=${errorMsg} action=skipped (post succeeded)`);
          return { ok: false, retryable: false };
        }
      } else if (isSchemaError) {
        // Already tried self-heal - soft fail
        console.warn(`METRICS_UPSERT_SOFTFAIL tweet_id=${metrics.tweet_id} reason=${errorMsg} action=skipped (post succeeded)`);
        return { ok: false, retryable: false };
      } else {
        // Programming error - throw to fail fast
        throw new Error(`tweet_metrics upsert failed: ${errorMsg}`);
      }
    }

    console.log(`METRICS_UPSERT_OK ${JSON.stringify({
      tweet_id: metrics.tweet_id,
      collected_at
    })}`);

    return { ok: true, retryable: false };

  } catch (error: any) {
    const errorMsg = error.message;
    const isSchemaError = errorMsg.includes('schema cache') || 
                         (errorMsg.includes('column') && errorMsg.includes('does not exist')) ||
                         (errorMsg.includes('relation') && errorMsg.includes('does not exist'));
    
    console.error(`❌ METRICS_UPSERT_FAILED tweet_id=${metrics.tweet_id} error=${errorMsg} payload_keys=[${Object.keys(metrics).join(',')}] retryable=${isSchemaError}`);
    
    if (isSchemaError && !hasTriggeredSelfHeal) {
      // First-time schema error - trigger self-heal and retry
      hasTriggeredSelfHeal = true;
      console.log(`SCHEMA_SELF_HEAL: detected missing column; ensuring core schema + reload`);
      
      try {
        const { ensureSchema } = await import('../infra/db/SchemaGuard');
        await ensureSchema();
        
        // Retry the upsert once after schema healing 
        return await upsertTweetMetrics(metrics);
      } catch (healError: any) {
        console.warn(`SCHEMA_SELF_HEAL_FAILED: ${healError.message}`);
        console.warn(`METRICS_UPSERT_SOFTFAIL tweet_id=${metrics.tweet_id} reason=${errorMsg} action=skipped (post succeeded)`);
        return { ok: false, retryable: false };
      }
    } else if (isSchemaError) {
      // Already tried self-heal - soft fail
      console.warn(`METRICS_UPSERT_SOFTFAIL tweet_id=${metrics.tweet_id} reason=${errorMsg} action=skipped (post succeeded)`);
      return { ok: false, retryable: false };
    } else {
      throw error; // Re-throw programming errors
    }
  }
}

/**
 * Upsert learning post with success logging
 */
export async function upsertLearningPost(post: LearningPost): Promise<{ ok: boolean; retryable: boolean }> {
  try {
    const supabase = admin;
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

    // Check if record exists first, then insert or update accordingly
    const { data: existingRecord, error: checkError } = await supabase
      .from('learning_posts')
      .select('id')
      .eq('tweet_id', post.tweet_id)
      .single();

    let error;
    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      error = checkError;
    } else if (existingRecord) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('learning_posts')
        .update(row)
        .eq('tweet_id', post.tweet_id);
      error = updateError;
    } else {
      // Insert new record
      const { error: insertError } = await supabase
        .from('learning_posts')
        .insert([row]);
      error = insertError;
    }

    if (error) {
      const errorMsg = error.message;
      const isSchemaError = errorMsg.includes('schema cache') || 
                           (errorMsg.includes('column') && errorMsg.includes('does not exist')) ||
                           (errorMsg.includes('relation') && errorMsg.includes('does not exist'));
      
      console.error(`❌ LEARNING_UPSERT_FAILED tweet_id=${post.tweet_id} error=${errorMsg} payload_keys=[${Object.keys(row).join(',')}] retryable=${isSchemaError}`);
      
      if (isSchemaError && !hasTriggeredSelfHeal) {
        // First-time schema error - trigger self-heal and retry once
        hasTriggeredSelfHeal = true;
        console.log(`SCHEMA_SELF_HEAL: detected missing column; ensuring core schema + reload`);
        
        try {
          const { ensureSchemaAtBoot } = await import('../services/SchemaGuard');
          await ensureSchemaAtBoot();
          
          // Retry the insert once after schema healing
          const { error: retryError } = await supabase
            .from('learning_posts')
            .insert([row]);
          
          if (!retryError) {
            console.log(`LEARNING_UPSERT_OK ${JSON.stringify({
              tweet_id: post.tweet_id
            })}`);
            return { ok: true, retryable: false };
          } else {
            // Self-heal didn't work - soft fail
            console.warn(`LEARNING_UPSERT_SOFTFAIL tweet_id=${post.tweet_id} reason=${retryError.message} action=skipped (post succeeded)`);
            return { ok: false, retryable: false };
          }
        } catch (healError: any) {
          console.warn(`SCHEMA_SELF_HEAL_FAILED: ${healError.message}`);
          console.warn(`LEARNING_UPSERT_SOFTFAIL tweet_id=${post.tweet_id} reason=${errorMsg} action=skipped (post succeeded)`);
          return { ok: false, retryable: false };
        }
      } else if (isSchemaError) {
        // Already tried self-heal - soft fail
        console.warn(`LEARNING_UPSERT_SOFTFAIL tweet_id=${post.tweet_id} reason=${errorMsg} action=skipped (post succeeded)`);
        return { ok: false, retryable: false };
      } else {
        // Programming error - throw to fail fast
        throw new Error(`learning_posts upsert failed: ${errorMsg}`);
      }
    }

    console.log(`LEARNING_UPSERT_OK ${JSON.stringify({
      tweet_id: post.tweet_id
    })}`);

    return { ok: true, retryable: false };

  } catch (error: any) {
    const errorMsg = error.message;
    const isSchemaError = errorMsg.includes('schema cache') || 
                         (errorMsg.includes('column') && errorMsg.includes('does not exist')) ||
                         (errorMsg.includes('relation') && errorMsg.includes('does not exist'));
    
    console.error(`❌ LEARNING_UPSERT_FAILED tweet_id=${post.tweet_id} error=${errorMsg} payload_keys=[${Object.keys(post).join(',')}] retryable=${isSchemaError}`);
    
    if (isSchemaError && !hasTriggeredSelfHeal) {
      // First-time schema error - trigger self-heal and retry
      hasTriggeredSelfHeal = true;
      console.log(`SCHEMA_SELF_HEAL: detected missing column; ensuring core schema + reload`);
      
      try {
        const { ensureSchema } = await import('../infra/db/SchemaGuard');
        await ensureSchema();
        
        // Retry the upsert once after schema healing 
        return await upsertLearningPost(post);
      } catch (healError: any) {
        console.warn(`SCHEMA_SELF_HEAL_FAILED: ${healError.message}`);
        console.warn(`LEARNING_UPSERT_SOFTFAIL tweet_id=${post.tweet_id} reason=${errorMsg} action=skipped (post succeeded)`);
        return { ok: false, retryable: false };
      }
    } else if (isSchemaError) {
      // Already tried self-heal - soft fail
      console.warn(`LEARNING_UPSERT_SOFTFAIL tweet_id=${post.tweet_id} reason=${errorMsg} action=skipped (post succeeded)`);
      return { ok: false, retryable: false };
    } else {
      throw error; // Re-throw programming errors
    }
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
 * Combined metrics storage for new posts (non-fatal)
 */
export async function storeNewPostMetrics(params: {
  tweet_id: string;
  format: 'single' | 'thread';
  content?: string;
  initial_metrics?: Partial<TweetMetrics>;
}): Promise<void> {
  const { tweet_id, format, content, initial_metrics = {} } = params;
  
  const metrics: TweetMetrics = {
    tweet_id,
    likes_count: initial_metrics.likes_count || 0,
    retweets_count: initial_metrics.retweets_count || 0,
    replies_count: initial_metrics.replies_count || 0,
    bookmarks_count: initial_metrics.bookmarks_count || 0,
    impressions_count: initial_metrics.impressions_count || 0,
    content,
    ...initial_metrics
  };

  const learningPost: LearningPost = {
    tweet_id,
    format,
    likes_count: initial_metrics.likes_count || 0,
    retweets_count: initial_metrics.retweets_count || 0,
    replies_count: initial_metrics.replies_count || 0,
    bookmarks_count: initial_metrics.bookmarks_count || 0,
    impressions_count: initial_metrics.impressions_count || 0,
    content
  };

  // Import retry queue for handling failures
  const { MetricsRetryQueue } = await import('../infra/MetricsRetryQueue');
  const retryQueue = MetricsRetryQueue.getInstance();

  // Try to store in both tables, schedule retries for schema failures
  let anyFailures = false;

  try {
    const metricsResult = await upsertTweetMetrics(metrics);
    if (!metricsResult.ok && metricsResult.retryable) {
      retryQueue.scheduleRetry(tweet_id, metrics, 'tweet_metrics schema error');
      anyFailures = true;
    }
  } catch (error: any) {
    console.error(`❌ Critical error in tweet metrics upsert: ${error.message}`);
    throw error; // Re-throw programming errors
  }

  try {
    const learningResult = await upsertLearningPost(learningPost);
    if (!learningResult.ok && learningResult.retryable) {
      retryQueue.scheduleRetry(tweet_id, learningPost, 'learning_posts schema error');
      anyFailures = true;
    }
  } catch (error: any) {
    console.error(`❌ Critical error in learning post upsert: ${error.message}`);
    throw error; // Re-throw programming errors
  }

  if (anyFailures) {
    console.log(`📅 POST_REPORTED_OK_WITH_PENDING_METRICS tweet_id=${tweet_id} queue_depth=${retryQueue.getQueueDepth()}`);
  }
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
    const supabase = admin;
    
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
