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
 * 🚀 NOW USES GROWTH-BASED DECISION MAKING!
 */
export async function selectOptimalContent(): Promise<AdaptiveDecision> {
  console.log('[ADAPTIVE] 🧠 Analyzing system health with growth analytics...');
  
  const supabase = getSupabaseClient();
  
  // 🚀 NEW: Use growth analytics for decision making
  try {
    const { getSystemHealth } = await import('../analytics/growthAnalytics');
    const health = await getSystemHealth();
    
    console.log(`[ADAPTIVE] 🎯 System health: ${health.overallTrend}`);
    console.log(`[ADAPTIVE] 🎲 Recommended exploration: ${(health.explorationRecommendation * 100).toFixed(0)}%`);
    console.log(`[ADAPTIVE] 💡 ${health.pivotRecommendation}`);
    
    // Use growth-based decision making
    if (health.overallTrend === 'declining') {
      // PIVOT - try completely new approaches
      console.log('[ADAPTIVE] 🚨 PIVOT MODE: Declining performance, exploring aggressively');
      return await selectExploratoryContent();
    }
    
    if (health.overallTrend === 'accelerating') {
      // ACCELERATING - balance exploration and exploitation
      console.log('[ADAPTIVE] 🚀 ACCELERATING: Balancing proven + new');
      
      if (Math.random() < 0.4) {
        return await selectExploratoryContent();
      } else {
        // Get recent posts for best performer selection
        const { data: recentPosts } = await supabase
          .from('content_with_outcomes')
          .select('*')
          .order('posted_at', { ascending: false })
          .limit(20);
        
        return await selectBestPerformer(recentPosts || []);
      }
    }
    
    if (health.overallTrend === 'flat') {
      // FLAT - need more exploration
      console.log('[ADAPTIVE] ⚠️ FLAT: Need new approaches');
      return Math.random() < 0.6 ? await selectExploratoryContent() : await thompsonSamplingSelection();
    }
    
    // Default: Growing - balanced approach
    console.log('[ADAPTIVE] 📈 GROWING: Balanced exploration');
    return Math.random() < 0.5 ? await selectExploratoryContent() : await thompsonSamplingSelection();
    
  } catch (error: any) {
    console.warn('[ADAPTIVE] ⚠️ Growth analytics unavailable, using fallback');
    
    // FALLBACK: Use old logic if growth analytics fail
    const { data: recentPosts } = await supabase
      .from('content_with_outcomes')
      .select('*')
      .order('posted_at', { ascending: false })
      .limit(10);
    
    if (!recentPosts || recentPosts.length === 0) {
      console.log('[ADAPTIVE] ℹ️ No performance data, using AI exploration');
      return getDefaultDecision();
    }
    
    // Calculate average engagement
    const avgEngagement = recentPosts.reduce((sum: number, p: any) => 
      sum + (Number(p.engagement_rate) || 0), 0) / recentPosts.length;
    
    const avgFollowers = recentPosts.reduce((sum: number, p: any) => 
      sum + (Number(p.followers_gained) || 0), 0) / recentPosts.length;
    
    console.log(`[ADAPTIVE] 📊 Recent performance: ${(avgEngagement * 100).toFixed(2)}% engagement, ${avgFollowers.toFixed(1)} followers/post`);
    
    if (avgEngagement < 0.01 || avgFollowers < 1) {
      return await selectExploratoryContent();
    }
    
    if (avgEngagement > 0.05 && avgFollowers > 5) {
      return await selectBestPerformer(recentPosts);
    }
    
    return await thompsonSamplingSelection();
  }
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

