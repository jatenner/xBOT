/**
 * ENGAGEMENT ATTRIBUTION SYSTEM
 * Tracks which posts drive follower growth and engagement
 */

import { getSupabaseClient } from '../db/index';

export interface PostAttribution {
  post_id: string;
  posted_at: Date;
  followers_before: number;
  followers_2h_after: number | null;
  followers_24h_after: number | null;
  followers_48h_after: number | null;
  followers_gained: number;
  engagement_rate: number;
  likes: number;
  retweets: number;
  replies: number;
  profile_clicks: number;
  impressions: number;
  hook_pattern: string;
  topic: string;
  generator_used: string;
  format: 'single' | 'thread';
  viral_score: number;
  last_updated: Date;
}

/**
 * Initialize post attribution tracking when posting
 */
export async function initializePostAttribution(
  postId: string,
  metadata: {
    hook_pattern: string;
    topic: string;
    generator: string;
    format: 'single' | 'thread';
    viral_score: number;
  }
): Promise<void> {
  const supabase = getSupabaseClient();
  
  // Get current follower count (TODO: integrate with Twitter API)
  const currentFollowers = await getCurrentFollowerCount();
  
  await supabase.from('post_attribution').insert({
    post_id: postId,
    posted_at: new Date(),
    followers_before: currentFollowers,
    followers_2h_after: null,
    followers_24h_after: null,
    followers_48h_after: null,
    followers_gained: 0,
    engagement_rate: 0,
    likes: 0,
    retweets: 0,
    replies: 0,
    profile_clicks: 0,
    impressions: 0,
    hook_pattern: metadata.hook_pattern,
    topic: metadata.topic,
    generator_used: metadata.generator,
    format: metadata.format,
    viral_score: metadata.viral_score,
    last_updated: new Date()
  });
  
  console.log(`[ATTRIBUTION] 📊 Initialized tracking for post ${postId}`);
}

/**
 * Update post attribution with engagement data
 * Should be called every 2 hours
 */
export async function updatePostAttribution(
  postId: string,
  metrics: {
    likes?: number;
    retweets?: number;
    replies?: number;
    profile_clicks?: number;
    impressions?: number;
  }
): Promise<void> {
  const supabase = getSupabaseClient();
  
  // Get current post data
  const { data: post, error } = await supabase
    .from('post_attribution')
    .select('*')
    .eq('post_id', postId)
    .single();
  
  if (error || !post) {
    console.error(`[ATTRIBUTION] ❌ Post ${postId} not found`);
    return;
  }
  
  const currentFollowers = await getCurrentFollowerCount();
  const postTime = new Date(post.posted_at as string);
  const hoursAgo = (Date.now() - postTime.getTime()) / (1000 * 60 * 60);
  
  // Calculate engagement rate
  const totalEngagement = (metrics.likes || 0) + (metrics.retweets || 0) + (metrics.replies || 0);
  const engagementRate = metrics.impressions 
    ? totalEngagement / metrics.impressions 
    : 0;
  
  // Update based on time elapsed
  const updates: any = {
    likes: metrics.likes || post.likes,
    retweets: metrics.retweets || post.retweets,
    replies: metrics.replies || post.replies,
    profile_clicks: metrics.profile_clicks || post.profile_clicks,
    impressions: metrics.impressions || post.impressions,
    engagement_rate: engagementRate,
    last_updated: new Date()
  };
  
  // Attribution windows
  const followersBefore = Number(post.followers_before) || 0;
  
  if (hoursAgo >= 2 && !post.followers_2h_after) {
    updates.followers_2h_after = currentFollowers;
    console.log(`[ATTRIBUTION] 📈 2h checkpoint: ${currentFollowers - followersBefore} followers`);
  }
  
  if (hoursAgo >= 24 && !post.followers_24h_after) {
    updates.followers_24h_after = currentFollowers;
    updates.followers_gained = currentFollowers - followersBefore;
    console.log(`[ATTRIBUTION] 📈 24h attribution: ${updates.followers_gained} followers gained`);
    
    // Learn from this post
    await learnFromPostPerformance(postId, post, updates);
  }
  
  if (hoursAgo >= 48 && !post.followers_48h_after) {
    updates.followers_48h_after = currentFollowers;
    updates.followers_gained = currentFollowers - followersBefore;
    console.log(`[ATTRIBUTION] 📈 48h final: ${updates.followers_gained} total followers`);
  }
  
  await supabase
    .from('post_attribution')
    .update(updates)
    .eq('post_id', postId);
}

/**
 * Learn from post performance
 * 🆕 Now tracks angle, tone, and format_strategy performance!
 */
async function learnFromPostPerformance(
  postId: string,
  post: any,
  metrics: any
): Promise<void> {
  const supabase = getSupabaseClient();
  
  // Get full post metadata (includes angle, tone, format_strategy)
  const { data: fullPost } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('angle, angle_type, tone, tone_cluster, tone_is_singular, format_strategy, visual_format')
    .eq('decision_id', postId)
    .single();
  
  const totalEngagement = (metrics.likes || 0) + (metrics.retweets || 0) + (metrics.replies || 0);
  
  // Update hook performance
  await supabase.from('hook_performance').upsert({
    hook_pattern: post.hook_pattern,
    times_used: 1, // Will be incremented
    total_followers_gained: metrics.followers_gained,
    total_engagement: totalEngagement,
    avg_engagement_rate: metrics.engagement_rate,
    last_updated: new Date()
  }, {
    onConflict: 'hook_pattern',
    ignoreDuplicates: false
  });
  
  // Update topic performance
  await supabase.from('topic_performance').upsert({
    topic: post.topic,
    posts_count: 1,
    total_followers_gained: metrics.followers_gained,
    avg_engagement_rate: metrics.engagement_rate,
    last_used: new Date(),
    last_updated: new Date()
  }, {
    onConflict: 'topic',
    ignoreDuplicates: false
  });
  
  // Update generator performance
  await supabase.from('generator_performance').upsert({
    generator: post.generator_used,
    posts_count: 1,
    total_followers_gained: metrics.followers_gained,
    avg_engagement_rate: metrics.engagement_rate,
    last_updated: new Date()
  }, {
    onConflict: 'generator',
    ignoreDuplicates: false
  });
  
  // 🆕 UPDATE ANGLE PERFORMANCE
  if (fullPost?.angle) {
    await updateDimensionPerformance(supabase, 'angle_performance', {
      dimension_value: fullPost.angle,
      type_field: fullPost.angle_type,
      metrics: {
        likes: metrics.likes || 0,
        retweets: metrics.retweets || 0,
        replies: metrics.replies || 0,
        impressions: metrics.impressions || 0,
        followers_gained: metrics.followers_gained || 0,
        engagement_rate: metrics.engagement_rate || 0
      }
    });
  }
  
  // 🆕 UPDATE TONE PERFORMANCE
  if (fullPost?.tone) {
    await updateDimensionPerformance(supabase, 'tone_performance', {
      dimension_value: fullPost.tone,
      type_field: fullPost.tone_cluster,
      is_singular: fullPost.tone_is_singular,
      metrics: {
        likes: metrics.likes || 0,
        retweets: metrics.retweets || 0,
        replies: metrics.replies || 0,
        impressions: metrics.impressions || 0,
        followers_gained: metrics.followers_gained || 0,
        engagement_rate: metrics.engagement_rate || 0
      }
    });
  }
  
  // 🆕 UPDATE FORMAT STRATEGY PERFORMANCE
  if (fullPost?.format_strategy) {
    await updateDimensionPerformance(supabase, 'format_strategy_performance', {
      dimension_value: fullPost.format_strategy,
      metrics: {
        followers_gained: metrics.followers_gained || 0,
        engagement_rate: metrics.engagement_rate || 0,
        total_engagement: totalEngagement
      }
    });
  }
  
  console.log(`[ATTRIBUTION] 🧠 Learned from post ${postId} (angle, tone, format_strategy tracked)`);
}

/**
 * 🆕 HELPER: Update dimension performance with incremental averaging
 * Handles the math for updating running averages
 */
async function updateDimensionPerformance(
  supabase: any,
  tableName: string,
  data: {
    dimension_value: string;
    type_field?: string;
    is_singular?: boolean;
    metrics: {
      likes?: number;
      retweets?: number;
      replies?: number;
      impressions?: number;
      followers_gained?: number;
      engagement_rate?: number;
      total_engagement?: number;
    };
  }
): Promise<void> {
  const { dimension_value, type_field, is_singular, metrics } = data;
  
  // Get existing record
  const { data: existing } = await supabase
    .from(tableName)
    .select('*')
    .eq(tableName === 'angle_performance' ? 'angle' : 
        tableName === 'tone_performance' ? 'tone' : 'format_strategy', 
        dimension_value)
    .single();
  
  if (existing) {
    // Update existing record with incremental averaging
    const newTimesUsed = (existing.times_used || 0) + 1;
    const oldWeight = existing.times_used || 0;
    const newWeight = 1;
    const totalWeight = newTimesUsed;
    
    // Calculate new averages
    const newAvgEngagementRate = ((existing.avg_engagement_rate || 0) * oldWeight + (metrics.engagement_rate || 0) * newWeight) / totalWeight;
    const newAvgLikes = metrics.likes !== undefined ? 
      ((existing.avg_likes || 0) * oldWeight + metrics.likes * newWeight) / totalWeight : 
      existing.avg_likes;
    const newAvgRetweets = metrics.retweets !== undefined ?
      ((existing.avg_retweets || 0) * oldWeight + metrics.retweets * newWeight) / totalWeight :
      existing.avg_retweets;
    const newAvgFollowersGained = ((existing.avg_followers_gained || 0) * oldWeight + (metrics.followers_gained || 0) * newWeight) / totalWeight;
    
    // Calculate confidence score (0.0-1.0 based on sample size)
    const confidenceScore = Math.min(1.0, newTimesUsed / 30);
    
    const updates: any = {
      times_used: newTimesUsed,
      last_used: new Date(),
      total_engagement: (existing.total_engagement || 0) + (metrics.total_engagement || 0),
      total_followers_gained: (existing.total_followers_gained || 0) + (metrics.followers_gained || 0),
      avg_engagement_rate: newAvgEngagementRate,
      avg_followers_gained: newAvgFollowersGained,
      confidence_score: confidenceScore,
      last_updated: new Date()
    };
    
    if (metrics.likes !== undefined) {
      updates.total_likes = (existing.total_likes || 0) + metrics.likes;
      updates.avg_likes = newAvgLikes;
    }
    if (metrics.retweets !== undefined) {
      updates.total_retweets = (existing.total_retweets || 0) + metrics.retweets;
      updates.avg_retweets = newAvgRetweets;
    }
    if (metrics.replies !== undefined) {
      updates.total_replies = (existing.total_replies || 0) + metrics.replies;
    }
    if (metrics.impressions !== undefined) {
      updates.total_impressions = (existing.total_impressions || 0) + metrics.impressions;
    }
    
    await supabase
      .from(tableName)
      .update(updates)
      .eq(tableName === 'angle_performance' ? 'angle' : 
          tableName === 'tone_performance' ? 'tone' : 'format_strategy',
          dimension_value);
    
    console.log(`[ATTRIBUTION] 📊 Updated ${tableName}: "${dimension_value}" (n=${newTimesUsed}, conf=${confidenceScore.toFixed(2)})`);
    
  } else {
    // Insert new record
    const insertData: any = {
      times_used: 1,
      first_used: new Date(),
      last_used: new Date(),
      total_engagement: metrics.total_engagement || 0,
      total_followers_gained: metrics.followers_gained || 0,
      avg_engagement_rate: metrics.engagement_rate || 0,
      avg_followers_gained: metrics.followers_gained || 0,
      confidence_score: Math.min(1.0, 1 / 30), // Very low for first use
      created_at: new Date(),
      last_updated: new Date()
    };
    
    if (tableName === 'angle_performance') {
      insertData.angle = dimension_value;
      insertData.angle_type = type_field;
    } else if (tableName === 'tone_performance') {
      insertData.tone = dimension_value;
      insertData.tone_cluster = type_field;
      insertData.is_singular = is_singular !== false;
    } else {
      insertData.format_strategy = dimension_value;
    }
    
    if (metrics.likes !== undefined) {
      insertData.total_likes = metrics.likes;
      insertData.avg_likes = metrics.likes;
    }
    if (metrics.retweets !== undefined) {
      insertData.total_retweets = metrics.retweets;
      insertData.avg_retweets = metrics.retweets;
    }
    if (metrics.replies !== undefined) {
      insertData.total_replies = metrics.replies;
    }
    if (metrics.impressions !== undefined) {
      insertData.total_impressions = metrics.impressions;
    }
    
    await supabase
      .from(tableName)
      .insert([insertData]);
    
    console.log(`[ATTRIBUTION] 🆕 New ${tableName}: "${dimension_value}"`);
  }
}

/**
 * Get current follower count (placeholder for Twitter API integration)
 */
async function getCurrentFollowerCount(): Promise<number> {
  // TODO: Integrate with Twitter API to get actual follower count
  // For now, return a mock value or stored value
  return 30; // Placeholder
}

/**
 * Get posts that need attribution updates
 */
export async function getPostsNeedingAttribution(): Promise<PostAttribution[]> {
  const supabase = getSupabaseClient();
  
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  
  const { data, error } = await supabase
    .from('post_attribution')
    .select('*')
    .gte('posted_at', twoDaysAgo.toISOString())
    .or('followers_2h_after.is.null,followers_24h_after.is.null,followers_48h_after.is.null')
    .order('posted_at', { ascending: true });
  
  if (error) {
    console.error('[ATTRIBUTION] ❌ Error fetching posts:', error);
    return [];
  }
  
  return (data || []) as unknown as PostAttribution[];
}

/**
 * Run attribution update job (called every 2 hours)
 */
export async function runAttributionUpdate(): Promise<void> {
  console.log('[ATTRIBUTION] 🔄 Running attribution update...');
  
  const posts = await getPostsNeedingAttribution();
  console.log(`[ATTRIBUTION] 📊 Found ${posts.length} posts to update`);
  
  for (const post of posts) {
    try {
      // TODO: Fetch real metrics from Twitter API
      const metrics = {
        likes: Math.floor(Math.random() * 100), // Placeholder
        retweets: Math.floor(Math.random() * 20),
        replies: Math.floor(Math.random() * 10),
        profile_clicks: Math.floor(Math.random() * 50),
        impressions: Math.floor(Math.random() * 1000)
      };
      
      await updatePostAttribution(post.post_id, metrics);
    } catch (error: any) {
      console.error(`[ATTRIBUTION] ❌ Error updating ${post.post_id}:`, error.message);
    }
  }
  
  console.log('[ATTRIBUTION] ✅ Attribution update complete');
}

