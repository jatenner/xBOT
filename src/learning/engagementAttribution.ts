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
 */
async function learnFromPostPerformance(
  postId: string,
  post: any,
  metrics: any
): Promise<void> {
  const supabase = getSupabaseClient();
  
  // Update hook performance
  await supabase.from('hook_performance').upsert({
    hook_pattern: post.hook_pattern,
    times_used: 1, // Will be incremented
    total_followers_gained: metrics.followers_gained,
    total_engagement: metrics.likes + metrics.retweets + metrics.replies,
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
  
  console.log(`[ATTRIBUTION] 🧠 Learned from post ${postId}`);
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

