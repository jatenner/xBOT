/**
 * 🚀 ENHANCED ADAPTIVE CONTENT SELECTION
 * 
 * ENHANCEMENTS:
 * 1. Integrates competitor intelligence for trending topics
 * 2. Separates view analysis from like analysis (different problems)
 * 3. Crisis mode detection for zero engagement
 * 4. Uses ViralTrendMonitor for real-time trending topics
 * 5. Better thresholds for low performance detection
 */

import { getSupabaseClient } from '../db/index';
import { CompetitorIntelligenceMonitor } from '../intelligence/competitorIntelligenceMonitor';
import { ViralTrendMonitor } from '../intelligence/viralTrendMonitor';

export interface AdaptiveDecision {
  hook_pattern: string;
  topic: string;
  generator: string;
  format: 'single' | 'thread';
  reasoning: string;
  intelligence_source?: 'internal' | 'competitor' | 'trending' | 'crisis';
}

export interface PerformanceAnalysis {
  avgEngagement: number;
  avgFollowers: number;
  avgViews: number;
  avgLikes: number;
  viewToLikeRatio: number;
  diagnosisType: 'no_visibility' | 'no_engagement' | 'normal' | 'strong';
  reasoning: string;
}

/**
 * 🧠 Main entry point - Enhanced adaptive selection
 */
export async function selectOptimalContentEnhanced(): Promise<AdaptiveDecision> {
  console.log('[ENHANCED_ADAPTIVE] 🚀 Starting enhanced adaptive selection...');
  
  const supabase = getSupabaseClient();
  
  // Get last 10 posts performance
  const { data: recentPosts } = await supabase
    .from('post_attribution')
    .select('*')
    .order('posted_at', { ascending: false })
    .limit(10);
  
  if (!recentPosts || recentPosts.length === 0) {
    console.log('[ENHANCED_ADAPTIVE] ℹ️ No performance data, using competitor intelligence');
    return await getCompetitorInspiredDecision();
  }
  
  // ═══════════════════════════════════════════════════════════
  // 🔬 ENHANCEMENT 1: SEPARATE VIEW vs LIKE ANALYSIS
  // ═══════════════════════════════════════════════════════════
  const analysis = analyzePerformanceDetailed(recentPosts);
  
  console.log(`[ENHANCED_ADAPTIVE] 📊 Performance Analysis:`);
  console.log(`   Engagement: ${(analysis.avgEngagement * 100).toFixed(2)}%`);
  console.log(`   Followers: ${analysis.avgFollowers.toFixed(1)}/post`);
  console.log(`   Views: ${analysis.avgViews.toFixed(0)}/post`);
  console.log(`   Likes: ${analysis.avgLikes.toFixed(1)}/post`);
  console.log(`   View→Like: ${(analysis.viewToLikeRatio * 100).toFixed(2)}%`);
  console.log(`   Diagnosis: ${analysis.diagnosisType}`);
  console.log(`   ${analysis.reasoning}`);
  
  // ═══════════════════════════════════════════════════════════
  // 🚨 CRISIS MODE DISABLED - Let system explore naturally
  // ═══════════════════════════════════════════════════════════
  // REASON: With 0 engagement across the board, crisis mode just creates
  // a feedback loop of the same failing content. Better to let the system
  // explore diverse topics and learn which ones get ANY engagement.
  
  // USER REQUIREMENT: Near-zero = truly abysmal performance
  if (analysis.diagnosisType === 'no_visibility' || 
      (analysis.avgEngagement < 0.005 && analysis.avgFollowers < 0.5)) {
    console.log('[ENHANCED_ADAPTIVE] ⚠️ Near-zero engagement detected - FORCING DIVERSE EXPLORATION');
    console.log('[ENHANCED_ADAPTIVE] 💡 Crisis mode DISABLED - using diverse exploration instead');
    return await selectDiverseExplorationContent();
  }
  
  // ═══════════════════════════════════════════════════════════
  // 🔥 LOW PERFORMANCE = DIVERSE EXPLORATION (not crisis mode)
  // ═══════════════════════════════════════════════════════════
  // USER REQUIREMENT: "Low" = below noise floor (not just below viral)
  // 1% ER or 1 follower/post = truly struggling
  if (analysis.avgEngagement < 0.01 || analysis.avgFollowers < 1) {
    console.log('[ENHANCED_ADAPTIVE] 🔄 Very low engagement (below noise floor) - using diverse exploration...');
    return await selectDiverseExplorationContent();
  }
  
  // ═══════════════════════════════════════════════════════════
  // 📈 STRONG PERFORMANCE: Double down on what works
  // ═══════════════════════════════════════════════════════════
  if (analysis.avgEngagement > 0.05 || analysis.avgFollowers > 10) {
    console.log('[ENHANCED_ADAPTIVE] 📈 Performance strong, doubling down...');
    return await selectBestPerformer(recentPosts);
  }
  
  // ═══════════════════════════════════════════════════════════
  // ⚖️ NORMAL: Thompson Sampling
  // ═══════════════════════════════════════════════════════════
  console.log('[ENHANCED_ADAPTIVE] ⚖️ Balanced approach - exploit + explore');
  return await thompsonSamplingSelection();
}

/**
 * 🔬 Analyze performance with view/like separation
 */
function analyzePerformanceDetailed(recentPosts: any[]): PerformanceAnalysis {
  const avgEngagement = recentPosts.reduce((sum: number, p: any) => 
    sum + (Number(p.engagement_rate) || 0), 0) / recentPosts.length;
  
  const avgFollowers = recentPosts.reduce((sum: number, p: any) => 
    sum + (Number(p.followers_gained) || 0), 0) / recentPosts.length;
  
  // NEW: Separate view and like metrics
  const avgViews = recentPosts.reduce((sum: number, p: any) => 
    sum + (Number(p.impressions) || Number(p.views) || 0), 0) / recentPosts.length;
  
  const avgLikes = recentPosts.reduce((sum: number, p: any) => 
    sum + (Number(p.total_engagement) || Number(p.likes) || 0), 0) / recentPosts.length;
  
  const viewToLikeRatio = avgViews > 0 ? avgLikes / avgViews : 0;
  
  // Diagnosis logic
  let diagnosisType: PerformanceAnalysis['diagnosisType'];
  let reasoning: string;
  
  if (avgViews < 20 && avgLikes < 1) {
    diagnosisType = 'no_visibility';
    reasoning = 'Nobody is seeing your content - timing or topic issue';
  } else if (avgViews > 20 && avgLikes < 1) {
    diagnosisType = 'no_engagement';
    reasoning = 'People see content but not engaging - hook/content quality issue';
  } else if (avgEngagement > 0.05 || avgFollowers > 10) {
    diagnosisType = 'strong';
    reasoning = 'Strong performance - keep doing what works';
  } else {
    diagnosisType = 'normal';
    reasoning = 'Normal performance - continue learning';
  }
  
  return {
    avgEngagement,
    avgFollowers,
    avgViews,
    avgLikes,
    viewToLikeRatio,
    diagnosisType,
    reasoning
  };
}

/**
 * 🚨 CRISIS MODE: Aggressive exploration with competitor intelligence
 */
async function selectCrisisModeContent(analysis: PerformanceAnalysis): Promise<AdaptiveDecision> {
  console.log('[CRISIS_MODE] 🚨 Activating crisis recovery strategy...');
  
  try {
    // STRATEGY 1: Use competitor's PROVEN trending topics
    const competitorMonitor = CompetitorIntelligenceMonitor.getInstance();
    const insights = await competitorMonitor.getCompetitorInsights();
    
    if (insights.trending_opportunities && insights.trending_opportunities.length > 0) {
      const hotTopic = insights.trending_opportunities[0];
      
      console.log(`[CRISIS_MODE] 🔥 Using competitor trending topic: "${hotTopic.topic}"`);
      console.log(`[CRISIS_MODE] 📊 Trending score: ${hotTopic.trending_score}`);
      
      return {
        hook_pattern: 'provocateur', // Bold, attention-grabbing
        topic: hotTopic.topic,
        generator: 'provocateur', // Use most aggressive generator
        format: 'single',
        reasoning: `CRISIS MODE: Using competitor proven topic "${hotTopic.topic}" (score: ${hotTopic.trending_score})`,
        intelligence_source: 'crisis'
      };
    }
  } catch (error) {
    console.warn('[CRISIS_MODE] ⚠️ Competitor intelligence failed, trying viral trends...');
  }
  
  // STRATEGY 2: Fallback to AI-generated diverse exploration (NO HARDCODED TOPICS!)
  console.warn('[CRISIS_MODE] ⚠️ Competitor intelligence failed, generating AI topic...');
  
  try {
    // Use DynamicTopicGenerator to create unique topic
    const { DynamicTopicGenerator } = await import('../intelligence/dynamicTopicGenerator');
    const topicGenerator = DynamicTopicGenerator.getInstance();
    
    const dynamicTopic = await topicGenerator.generateTopic({
      preferTrending: true // Focus on viral potential in crisis mode
    });
    
    console.log(`[CRISIS_MODE] 🤖 Generated AI topic: "${dynamicTopic.topic}"`);
    
    // Randomize generator - don't hardcode to mythbuster
    const allGenerators = [
      'dataNerd', 'provocateur', 'storyteller', 'mythBuster', 'contrarian', 
      'coach', 'explorer', 'thoughtLeader', 'newsReporter', 'philosopher', 
      'culturalBridge'
    ];
    const randomGenerator = allGenerators[Math.floor(Math.random() * allGenerators.length)];
    
    return {
      hook_pattern: ['bold_claim', 'contrarian', 'provocateur'][Math.floor(Math.random() * 3)] as string,
      topic: dynamicTopic.topic,
      generator: randomGenerator,
      format: 'single',
      reasoning: `CRISIS MODE: AI topic "${dynamicTopic.topic}" with ${randomGenerator} (viral: ${dynamicTopic.viral_potential})`,
      intelligence_source: 'crisis'
    };
  } catch (error) {
    console.error('[CRISIS_MODE] ❌ All AI generation failed, using generic prompt...');
    
    // Ultimate fallback: randomize generator
    const allGenerators = [
      'dataNerd', 'provocateur', 'storyteller', 'mythBuster', 'contrarian', 
      'coach', 'explorer', 'thoughtLeader', 'newsReporter', 'philosopher', 
      'culturalBridge'
    ];
    const randomGenerator = allGenerators[Math.floor(Math.random() * allGenerators.length)];
    
    return {
      hook_pattern: 'bold_claim',
      topic: 'Generate a completely unique health topic',
      generator: randomGenerator,
      format: 'single',
      reasoning: `CRISIS MODE: Delegating creativity to ${randomGenerator}`,
      intelligence_source: 'crisis'
    };
  }
}

/**
 * 🔄 EXPLORATORY CONTENT: Enhanced with competitor intelligence
 */
async function selectExploratoryContentEnhanced(analysis: PerformanceAnalysis): Promise<AdaptiveDecision> {
  const supabase = getSupabaseClient();
  
  // Check if it's a visibility problem or engagement problem
  if (analysis.diagnosisType === 'no_visibility') {
    console.log('[ENHANCED_ADAPTIVE] 🎯 Visibility issue: Using diverse exploration');
    // Note: ViralTrendMonitor.getTrendingHealthTopics() is not implemented yet
    // Using diverse exploration instead
  }
  
  if (analysis.diagnosisType === 'no_engagement') {
    console.log('[ENHANCED_ADAPTIVE] 🎣 Engagement issue: Using provocative hooks');
    
    // Get what competitors are using successfully
    try {
      const competitorMonitor = CompetitorIntelligenceMonitor.getInstance();
      const insights = await competitorMonitor.getCompetitorInsights();
      
      if (insights.trending_opportunities && insights.trending_opportunities.length > 0) {
        const hotTopic = insights.trending_opportunities[0];
        
        return {
          hook_pattern: 'provocateur',
          topic: hotTopic.topic,
          generator: 'provocateur',
          format: 'single',
          reasoning: `Engagement fix: Competitor successful topic "${hotTopic.topic}"`,
          intelligence_source: 'competitor'
        };
      }
    } catch (error) {
      console.warn('[ENHANCED_ADAPTIVE] ⚠️ Competitor intelligence unavailable');
    }
  }
  
  // Fallback to existing logic
  const { data: generatorPerf } = await supabase
    .from('generator_performance')
    .select('*')
    .order('posts_count', { ascending: true })
    .limit(3);
  
  const { data: topicPerf } = await supabase
    .from('topic_performance')
    .select('*')
    .order('last_used', { ascending: true })
    .limit(3);
  
  // If no generator performance data, randomize across ALL generators
  const allGenerators = [
    'dataNerd', 'provocateur', 'storyteller', 'mythBuster', 'contrarian', 
    'coach', 'explorer', 'thoughtLeader', 'newsReporter', 'philosopher', 
    'culturalBridge'
  ];
  const generator = String(generatorPerf?.[0]?.generator || allGenerators[Math.floor(Math.random() * allGenerators.length)]);
  
  // If no topic performance data, use AI generation instead of hardcoded
  let topic = String(topicPerf?.[0]?.topic || '');
  if (!topic || topic === 'null') {
    topic = 'Generate a unique health/wellness topic not recently covered';
  }
  
  return {
    hook_pattern: ['bold_claim', 'contrarian', 'story_opener', 'data_driven'][Math.floor(Math.random() * 4)] as string,
    topic,
    generator,
    format: 'single',
    reasoning: `Exploring underused: ${generator} + dynamic topic`,
    intelligence_source: 'internal'
  };
}

/**
 * 📈 Select best performing approach when doing well
 */
async function selectBestPerformer(recentPosts: any[]): Promise<AdaptiveDecision> {
  const sorted = [...recentPosts].sort((a, b) => 
    (Number(b.followers_gained) || 0) - (Number(a.followers_gained) || 0)
  );
  
  const best = sorted[0];
  
  // If no topic in best performer, use AI generation (no hardcoded fallback!)
  const allGenerators = [
    'dataNerd', 'provocateur', 'storyteller', 'mythBuster', 'contrarian', 
    'coach', 'explorer', 'thoughtLeader', 'newsReporter', 'philosopher', 
    'culturalBridge'
  ];
  
  return {
    hook_pattern: String(best.hook_pattern || 'story_opener'),
    topic: String(best.topic || 'Generate unique health topic based on best performer style'),
    generator: String(best.generator_used || allGenerators[Math.floor(Math.random() * allGenerators.length)]),
    format: 'single',
    reasoning: `Best performer: ${best.followers_gained || 0} followers, ${((Number(best.engagement_rate) || 0) * 100).toFixed(2)}% engagement`,
    intelligence_source: 'internal'
  };
}

/**
 * ⚖️ Thompson Sampling for balanced exploration/exploitation
 */
async function thompsonSamplingSelection(): Promise<AdaptiveDecision> {
  const supabase = getSupabaseClient();
  
  const { data: hooks } = await supabase
    .from('hook_performance')
    .select('*')
    .order('avg_followers_per_post', { ascending: false })
    .limit(5);
  
  const { data: topics } = await supabase
    .from('topic_performance')
    .select('*')
    .order('avg_followers_per_post', { ascending: false })
    .limit(5);
  
  const hookChoice = Math.random() < 0.8 && hooks?.[0] 
    ? hooks[0] 
    : (hooks?.[Math.floor(Math.random() * (hooks?.length || 1))] || hooks?.[0]);
  
  // ═══════════════════════════════════════════════════════════
  // 🚨 USER FIX: EXPLORATION MODE = AI-GENERATED TOPICS
  // ═══════════════════════════════════════════════════════════
  let selectedTopic: string;
  
  // If database has <3 topics OR random 50%, use AI generation (EXPLORATION!)
  const shouldUseAI = !topics || topics.length < 3 || Math.random() < 0.5;
  
  if (shouldUseAI) {
    console.log('[THOMPSON] 🤖 Using AI topic generation (exploration mode)');
    
    try {
      const { DynamicTopicGenerator } = await import('../intelligence/dynamicTopicGenerator');
      const { contentDiversityEngine } = await import('../ai/content/contentDiversityEngine');
      
      const topicGenerator = DynamicTopicGenerator.getInstance();
      const recentTopics = contentDiversityEngine.getRecentTopics();
      
      const dynamicTopic = await topicGenerator.generateTopic({ recentTopics });
      selectedTopic = dynamicTopic.topic;
      
      // Track to prevent immediate repeats
      contentDiversityEngine.trackTopic(selectedTopic);
      
      console.log(`[THOMPSON] ✨ AI generated: "${selectedTopic}"`);
    } catch (error) {
      console.error('[THOMPSON] ❌ AI generation failed, using fallback');
      selectedTopic = 'health optimization';
    }
  } else {
    // Use database topic (EXPLOITATION)
    const topicChoice = Math.random() < 0.8 && topics?.[0]
      ? topics[0]
      : (topics?.[Math.floor(Math.random() * (topics?.length || 1))] || topics?.[0]);
    
    selectedTopic = String(topicChoice?.topic || 'health optimization');
    console.log(`[THOMPSON] 📊 Using database topic: "${selectedTopic}" (${topicChoice?.avg_followers_per_post || 0} F/post)`);
  }
  
  // Randomize generator (not always provocateur)
  const allGenerators = [
    'dataNerd', 'provocateur', 'storyteller', 'mythBuster', 'contrarian', 
    'coach', 'explorer', 'thoughtLeader', 'newsReporter', 'philosopher', 
    'culturalBridge'
  ];
  const randomGenerator = allGenerators[Math.floor(Math.random() * allGenerators.length)];
  
  return {
    hook_pattern: String(hookChoice?.hook_pattern || 'contrarian'),
    topic: selectedTopic, // ✅ Now uses AI-generated OR database topic
    generator: randomGenerator,
    format: 'single',
    reasoning: `Thompson Sampling with ${randomGenerator} - ${shouldUseAI ? 'AI-generated' : 'database'} topic`,
    intelligence_source: 'internal'
  };
}

/**
 * 🎨 DIVERSE EXPLORATION - AI-generated infinite topic variety
 * 
 * REPLACES hardcoded topic pools with intelligent topic generation.
 * 
 * When engagement is 0 across the board, the best strategy is to try
 * COMPLETELY DIFFERENT topics to see what resonates. This function
 * uses the TopicDiversityEngine to generate unique topics based on:
 * 1. What topics were recently posted (avoid repetition)
 * 2. What topics performed well (learn from success)
 * 3. What topics are overused (avoid beating dead horses)
 */
async function selectDiverseExplorationContent(): Promise<AdaptiveDecision> {
  console.log('[DIVERSE_EXPLORATION] 🎨 Using AI to generate unique topic...');
  
  try {
    // 🆕 USE NEW TOPIC DIVERSITY ENGINE
    const { TopicDiversityEngine } = await import('./topicDiversityEngine');
    const diversityEngine = TopicDiversityEngine.getInstance();
    
    // 🚀 USE ULTIMATE TOPIC GENERATION
    // - Adaptive exploration (adjusts based on performance)
    // - Multi-candidate generation (5 topics, pick best)
    // - Trending integration (when relevant)
    // - Performance learning (when available)
    // - Pure randomness (when exploring)
    
    console.log(`[DIVERSE_EXPLORATION] 🚀 Using ULTIMATE topic generation with adaptive intelligence`);
    
    const topicResult = await diversityEngine.generateUltimateTopic();
    
    console.log(`[DIVERSE_EXPLORATION] ✅ AI generated: "${topicResult.topic}"`);
    console.log(`[DIVERSE_EXPLORATION] 💡 Reasoning: ${topicResult.reasoning}`);
    console.log(`[DIVERSE_EXPLORATION] 🏷️ AI-assigned cluster: ${topicResult.cluster} (for tracking only)`);
    
    // 🎲 RANDOMIZE GENERATOR - USE ALL 11 GENERATORS (no hardcoded cluster mappings!)
    // Let the system explore different generators for any topic
    const allGenerators = [
      'dataNerd', 'provocateur', 'storyteller', 'mythBuster', 'contrarian', 
      'coach', 'explorer', 'thoughtLeader', 'newsReporter', 'philosopher', 
      'culturalBridge'
    ]; // ALL 11 generators (humanVoice uses different path)
    const selectedGenerator = allGenerators[Math.floor(Math.random() * allGenerators.length)];
    
    console.log(`[DIVERSE_EXPLORATION] 🎭 Selected generator: ${selectedGenerator} (randomized from all 11 generators)`);
    
    return {
      hook_pattern: ['bold_claim', 'contrarian', 'story_opener', 'data_driven'][Math.floor(Math.random() * 4)] as string,
      topic: topicResult.topic,
      generator: selectedGenerator,
      format: 'single',
      reasoning: `AI-generated diverse topic: ${topicResult.cluster} (${topicResult.reasoning})`,
      intelligence_source: 'internal'
    };
    
  } catch (error: any) {
    console.error('[DIVERSE_EXPLORATION] ❌ AI topic generation failed, delegating to content engine:', error.message);
    
    // NO HARDCODED FALLBACK - let the content engine be creative
    const allGenerators = [
      'dataNerd', 'provocateur', 'storyteller', 'mythBuster', 'contrarian', 
      'coach', 'explorer', 'thoughtLeader', 'newsReporter', 'philosopher', 
      'culturalBridge'
    ];
    const randomGenerator = allGenerators[Math.floor(Math.random() * allGenerators.length)];
    
    return {
      hook_pattern: ['bold_claim', 'contrarian', 'story_opener', 'data_driven'][Math.floor(Math.random() * 4)] as string,
      topic: 'Generate a completely unique health/wellness topic not covered recently',
      generator: randomGenerator,
      format: 'single',
      reasoning: 'AI failed, delegating creativity to content generator',
      intelligence_source: 'internal'
    };
  }
}

/**
 * 🆕 Get decision inspired by competitor intelligence (no data case)
 */
async function getCompetitorInspiredDecision(): Promise<AdaptiveDecision> {
  console.log('[ENHANCED_ADAPTIVE] 🔍 No historical data, using competitor intelligence...');
  
  try {
    const competitorMonitor = CompetitorIntelligenceMonitor.getInstance();
    const insights = await competitorMonitor.getCompetitorInsights();
    
    if (insights.trending_opportunities && insights.trending_opportunities.length > 0) {
      const hotTopic = insights.trending_opportunities[0];
      
      // Randomize which competitor topic to use (don't always use first)
      const randomIndex = Math.floor(Math.random() * insights.trending_opportunities.length);
      const selectedTopic = insights.trending_opportunities[randomIndex];
      
      // Randomize generator (don't always use contrarian)
      const allGenerators = [
        'dataNerd', 'provocateur', 'storyteller', 'mythBuster', 'contrarian', 
        'coach', 'explorer', 'thoughtLeader', 'newsReporter', 'philosopher', 
        'culturalBridge'
      ];
      const randomGenerator = allGenerators[Math.floor(Math.random() * allGenerators.length)];
      
      return {
        hook_pattern: ['bold_claim', 'contrarian', 'story_opener', 'data_driven'][Math.floor(Math.random() * 4)] as string,
        topic: selectedTopic.topic,
        generator: randomGenerator,
        format: 'single',
        reasoning: `Cold start: Using AI-generated trending topic "${selectedTopic.topic}" with ${randomGenerator}`,
        intelligence_source: 'competitor'
      };
    }
  } catch (error) {
    console.warn('[ENHANCED_ADAPTIVE] ⚠️ Competitor intelligence failed, using default');
  }
  
  // NO HARDCODED FALLBACK - randomize everything
  const allGenerators = [
    'dataNerd', 'provocateur', 'storyteller', 'mythBuster', 'contrarian', 
    'coach', 'explorer', 'thoughtLeader', 'newsReporter', 'philosopher', 
    'culturalBridge'
  ];
  const randomGenerator = allGenerators[Math.floor(Math.random() * allGenerators.length)];
  
  return {
    hook_pattern: ['bold_claim', 'contrarian', 'story_opener', 'data_driven'][Math.floor(Math.random() * 4)] as string,
    topic: 'Generate a unique health/wellness topic with high viral potential',
    generator: randomGenerator,
    format: 'single',
    reasoning: 'Cold start - using random generator with AI topic generation',
    intelligence_source: 'internal'
  };
}

