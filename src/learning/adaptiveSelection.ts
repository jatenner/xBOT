/**
 * ADAPTIVE CONTENT SELECTION
 * Uses performance data to intelligently select next content approach
 */

import { getSupabaseClient } from '../db/index';

export interface AdaptiveDecision {
  hook_pattern: string;
  topic: string;
  generator: string;
  format: 'single' | 'thread';
  reasoning: string;
}

/**
 * Analyze recent performance and decide optimal next approach
 */
export async function selectOptimalContent(): Promise<AdaptiveDecision> {
  console.log('[ADAPTIVE] 🧠 Analyzing recent performance...');
  
  const supabase = getSupabaseClient();
  
  // Get last 10 posts performance
  const { data: recentPosts } = await supabase
    .from('post_attribution')
    .select('*')
    .order('posted_at', { ascending: false })
    .limit(10);
  
  if (!recentPosts || recentPosts.length === 0) {
    console.log('[ADAPTIVE] ℹ️ No performance data, using defaults');
    return getDefaultDecision();
  }
  
  // Calculate average engagement
  const avgEngagement = recentPosts.reduce((sum: number, p: any) => 
    sum + (Number(p.engagement_rate) || 0), 0) / recentPosts.length;
  
  const avgFollowers = recentPosts.reduce((sum: number, p: any) => 
    sum + (Number(p.followers_gained) || 0), 0) / recentPosts.length;
  
  console.log(`[ADAPTIVE] 📊 Recent performance: ${(avgEngagement * 100).toFixed(2)}% engagement, ${avgFollowers.toFixed(1)} followers/post`);
  
  // STRATEGY 1: If performance is truly poor (below learning threshold), pivot
  // USER REQUIREMENT: Need volume to be meaningful (100+ views average at minimum)
  if (avgEngagement < 0.01 || avgFollowers < 1) {
    console.log('[ADAPTIVE] 🔄 Performance very poor (below noise floor), exploring new approaches...');
    return await selectExploratoryContent();
  }
  
  // STRATEGY 2: If performance is TRULY strong (viral territory), double down
  // USER REQUIREMENT: Strong = 1000+ views, 100+ likes consistently
  // For averages, use: 5% ER (50 likes / 1000 views) + 5+ followers/post
  if (avgEngagement > 0.05 && avgFollowers > 5) {
    console.log('[ADAPTIVE] 📈 Performance TRULY strong (viral territory), doubling down...');
    return await selectBestPerformer(recentPosts);
  }
  
  // STRATEGY 3: Normal - use Thompson Sampling
  console.log('[ADAPTIVE] ⚖️ Balanced approach - exploit + explore');
  return await thompsonSamplingSelection();
}

/**
 * Select exploratory content when performance is low
 */
async function selectExploratoryContent(): Promise<AdaptiveDecision> {
  const supabase = getSupabaseClient();
  
  // Find underused generators
  const { data: generatorPerf } = await supabase
    .from('generator_performance')
    .select('*')
    .order('posts_count', { ascending: true })
    .limit(3);
  
  // Find fresh topics
  const { data: topicPerf } = await supabase
    .from('topic_performance')
    .select('*')
    .order('last_used', { ascending: true })
    .limit(3);
  
  const generator = String(generatorPerf?.[0]?.generator || 'provocateur');
  const topic = String(topicPerf?.[0]?.topic || 'sleep optimization');
  
  return {
    hook_pattern: 'bold_claim', // High variance hook
    topic,
    generator,
    format: 'single', // Single tweets only - daily thread handled by viralThreadJob
    reasoning: 'Exploring new approach due to declining performance'
  };
}

/**
 * Select best performing approach when doing well
 */
async function selectBestPerformer(recentPosts: any[]): Promise<AdaptiveDecision> {
  // Sort by followers gained
  const sorted = [...recentPosts].sort((a, b) => 
    (Number(b.followers_gained) || 0) - (Number(a.followers_gained) || 0)
  );
  
  const best = sorted[0];
  
  return {
    hook_pattern: String(best.hook_pattern || 'story_opener'),
    topic: String(best.topic || 'sleep optimization'),
    generator: String(best.generator_used || 'provocateur'),
    format: 'single', // Single tweets only - 1 thread/day handled by viralThreadJob
    reasoning: `Best recent post gained ${best.followers_gained || 0} followers`
  };
}

/**
 * Thompson Sampling for balanced exploration/exploitation
 */
async function thompsonSamplingSelection(): Promise<AdaptiveDecision> {
  const supabase = getSupabaseClient();
  
  // Get hook performance data
  const { data: hooks } = await supabase
    .from('hook_performance')
    .select('*')
    .order('avg_followers_per_post', { ascending: false })
    .limit(5);
  
  // Get topic performance data
  const { data: topics } = await supabase
    .from('topic_performance')
    .select('*')
    .order('avg_followers_per_post', { ascending: false })
    .limit(5);
  
  // Simple Thompson Sampling: pick best with 80% probability
  const hookChoice = Math.random() < 0.8 && hooks?.[0] 
    ? hooks[0] 
    : (hooks?.[Math.floor(Math.random() * (hooks?.length || 1))] || hooks?.[0]);
  
  const topicChoice = Math.random() < 0.8 && topics?.[0]
    ? topics[0]
    : (topics?.[Math.floor(Math.random() * (topics?.length || 1))] || topics?.[0]);
  
  return {
    hook_pattern: String(hookChoice?.hook_pattern || 'contrarian'),
    topic: String(topicChoice?.topic || 'exercise timing'),
    generator: 'provocateur', // TODO: Select based on topic
    format: 'single', // Single tweets only - 1 thread/day handled by viralThreadJob
    reasoning: 'Thompson Sampling - balanced exploit/explore'
  };
}

/**
 * Default decision when no data available
 */
function getDefaultDecision(): AdaptiveDecision {
  return {
    hook_pattern: 'bold_claim',
    topic: 'sleep optimization',
    generator: 'provocateur',
    format: 'single', // Single tweets only - 1 thread/day handled by viralThreadJob
    reasoning: 'Default - no performance data available yet'
  };
}

