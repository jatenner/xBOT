/**
 * 🤖 AI STRATEGY DISCOVERY ENGINE
 * 
 * Analyzes YOUR posts and reverse-engineers what gets YOU followers
 * 
 * Budget-Conscious:
 * - Runs once per day (not per post)
 * - Uses gpt-4o-mini ($0.15/$0.60 per 1M tokens)
 * - Caches results for 24h
 * - Batches analysis (not individual posts)
 * - Cost: ~$0.10/day
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { getSupabaseClient } from '../db/index';

export interface FollowerStrategy {
  strategy_id: string;
  name: string;
  description: string;
  pattern: string;
  conversion_rate: number; // followers per 100 views
  confidence: number; // 0-1
  discovered_at: string;
  examples: string[];
  how_to_apply: string;
}

export interface StrategyInsights {
  best_strategies: FollowerStrategy[];
  avoid_strategies: FollowerStrategy[];
  optimal_timing: {
    best_times: string[];
    worst_times: string[];
    reasoning: string;
  };
  content_patterns: {
    high_converting_hooks: string[];
    high_converting_formats: string[];
    high_converting_topics: string[];
  };
  engagement_to_follower_ratio: {
    likes_per_follower: number;
    comments_per_follower: number;
    profile_clicks_per_follower: number;
  };
  custom_advice: string;
}

export class StrategyDiscoveryEngine {
  private static instance: StrategyDiscoveryEngine;
  private supabase = getSupabaseClient();
  private cachedInsights: StrategyInsights | null = null;
  private cacheTimestamp: number = 0;
  private CACHE_TTL_MS = 86400 * 1000; // 24 hours

  private constructor() {}

  public static getInstance(): StrategyDiscoveryEngine {
    if (!StrategyDiscoveryEngine.instance) {
      StrategyDiscoveryEngine.instance = new StrategyDiscoveryEngine();
    }
    return StrategyDiscoveryEngine.instance;
  }

  /**
   * Main analysis: Discovers what gets YOU followers
   * Runs once per day to save budget
   */
  async discoverStrategies(forceRefresh: boolean = false): Promise<StrategyInsights> {
    console.log('[AI_STRATEGY] 🧠 Starting strategy discovery...');

    // Check cache first
    if (!forceRefresh) {
      const cached = await this.getCachedInsights();
      if (cached) {
        console.log('[AI_STRATEGY] ✅ Using cached insights (saves budget)');
        return cached;
      }
    }

    try {
      // STEP 1: Gather data (last 7 days)
      const postData = await this.gatherPostData(7);

      if (postData.posts.length < 5) {
        console.log('[AI_STRATEGY] ⚠️ Not enough data yet, using defaults');
        return this.getDefaultInsights();
      }

      console.log(`[AI_STRATEGY] 📊 Analyzing ${postData.posts.length} posts...`);

      // STEP 2: AI analyzes patterns
      const insights = await this.analyzeWithAI(postData);

      // STEP 3: Cache results
      await this.cacheInsights(insights);

      // STEP 4: Store in database
      await this.storeInsights(insights);

      console.log('[AI_STRATEGY] ✅ Discovery complete!');
      console.log(`[AI_STRATEGY] 🎯 Found ${insights.best_strategies.length} high-converting strategies`);

      return insights;

    } catch (error: any) {
      console.error('[AI_STRATEGY] ❌ Error:', error.message);
      return this.getDefaultInsights();
    }
  }

  /**
   * Gather post data from database
   */
  private async gatherPostData(days: number): Promise<{
    posts: any[];
    summary: {
      total_posts: number;
      total_followers_gained: number;
      avg_followers_per_post: number;
      best_post: any;
      worst_post: any;
    };
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data: posts } = await this.supabase
      .from('posted_decisions')
      .select('*')
      .gte('posted_at', cutoffDate.toISOString())
      .order('posted_at', { ascending: false })
      .limit(100);

    if (!posts || posts.length === 0) {
      return {
        posts: [],
        summary: {
          total_posts: 0,
          total_followers_gained: 0,
          avg_followers_per_post: 0,
          best_post: null,
          worst_post: null
        }
      };
    }

    // Calculate metrics
    const postsWithMetrics = posts
      .map(p => {
        const perf = p.actual_performance as any || {};
        return {
          ...p,
          followers_gained: perf.followers_gained || 0,
          likes: perf.likes || 0,
          comments: perf.comments || 0,
          profile_clicks: perf.profile_clicks || 0,
          views: perf.views || 0,
          conversion_rate: perf.views > 0 
            ? ((perf.followers_gained || 0) / perf.views) * 100
            : 0
        };
      })
      .filter(p => p.views > 10); // Only posts with real data

    const totalFollowers = postsWithMetrics.reduce((sum, p) => sum + p.followers_gained, 0);
    const avgFollowers = postsWithMetrics.length > 0 ? totalFollowers / postsWithMetrics.length : 0;

    const bestPost = postsWithMetrics.sort((a, b) => b.followers_gained - a.followers_gained)[0];
    const worstPost = postsWithMetrics.sort((a, b) => a.followers_gained - b.followers_gained)[0];

    return {
      posts: postsWithMetrics,
      summary: {
        total_posts: postsWithMetrics.length,
        total_followers_gained: totalFollowers,
        avg_followers_per_post: avgFollowers,
        best_post: bestPost,
        worst_post: worstPost
      }
    };
  }

  /**
   * AI analyzes patterns and discovers strategies
   * BUDGET-CONSCIOUS: Single API call analyzing all posts at once
   */
  private async analyzeWithAI(data: any): Promise<StrategyInsights> {
    const prompt = this.buildAnalysisPrompt(data);

    console.log('[AI_STRATEGY] 💰 Making single AI call (budget-conscious)...');

    const completion = await createBudgetedChatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user }
      ],
      temperature: 0.3, // Lower temp for analysis
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    }, {
      purpose: 'strategy_discovery_analysis'
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No AI response');
    }

    const parsed = JSON.parse(content);

    // Format into our structure
    const insights: StrategyInsights = {
      best_strategies: (parsed.best_strategies || []).map((s: any, i: number) => ({
        strategy_id: `ai_strat_${Date.now()}_${i}`,
        name: s.name || 'Unknown Strategy',
        description: s.description || '',
        pattern: s.pattern || '',
        conversion_rate: s.conversion_rate || 0,
        confidence: s.confidence || 0.5,
        discovered_at: new Date().toISOString(),
        examples: s.examples || [],
        how_to_apply: s.how_to_apply || ''
      })),
      avoid_strategies: (parsed.avoid_strategies || []).map((s: any, i: number) => ({
        strategy_id: `ai_avoid_${Date.now()}_${i}`,
        name: s.name || 'Unknown',
        description: s.description || '',
        pattern: s.pattern || '',
        conversion_rate: s.conversion_rate || 0,
        confidence: s.confidence || 0.5,
        discovered_at: new Date().toISOString(),
        examples: s.examples || [],
        how_to_apply: ''
      })),
      optimal_timing: parsed.optimal_timing || {
        best_times: ['2 PM', '6 PM'],
        worst_times: ['3 AM'],
        reasoning: 'Need more data'
      },
      content_patterns: parsed.content_patterns || {
        high_converting_hooks: [],
        high_converting_formats: [],
        high_converting_topics: []
      },
      engagement_to_follower_ratio: parsed.engagement_to_follower_ratio || {
        likes_per_follower: 20,
        comments_per_follower: 5,
        profile_clicks_per_follower: 3
      },
      custom_advice: parsed.custom_advice || 'Keep posting consistently and analyzing data.'
    };

    return insights;
  }

  /**
   * Build prompt for AI analysis
   */
  private buildAnalysisPrompt(data: any): { system: string; user: string } {
    const { posts, summary } = data;

    // Create compact post summaries (to save tokens)
    const postSummaries = posts.slice(0, 20).map((p: any) => ({
      content_preview: (p.content || '').substring(0, 100),
      followers: p.followers_gained,
      likes: p.likes,
      views: p.views,
      profile_clicks: p.profile_clicks,
      conversion: p.conversion_rate.toFixed(2) + '%',
      topic: p.generation_metadata?.topic || 'unknown',
      format: p.content_format || 'unknown',
      time: new Date(p.created_at).toLocaleTimeString()
    }));

    const system = `You are an expert Twitter growth analyst specializing in follower acquisition.

Your task: Analyze post data and discover SPECIFIC strategies that get followers.

Focus on:
1. What patterns predict FOLLOWERS (not just likes)
2. Content, timing, format, topics that convert
3. Actionable insights (not generic advice)
4. Specific examples from the data

Return detailed JSON analysis.`;

    const user = `Analyze this Twitter account's performance:

SUMMARY:
- Total posts: ${summary.total_posts}
- Total followers gained: ${summary.total_followers_gained}
- Avg followers/post: ${summary.avg_followers_per_post.toFixed(2)}

BEST POST (${summary.best_post?.followers_gained || 0} followers):
- Content: "${summary.best_post?.content?.substring(0, 150) || 'N/A'}"
- Time: ${summary.best_post ? new Date(summary.best_post.created_at).toLocaleString() : 'N/A'}
- Format: ${summary.best_post?.content_format || 'unknown'}
- Conversion: ${summary.best_post?.conversion_rate?.toFixed(2) || 0}%

WORST POST (${summary.worst_post?.followers_gained || 0} followers):
- Content: "${summary.worst_post?.content?.substring(0, 150) || 'N/A'}"
- Time: ${summary.worst_post ? new Date(summary.worst_post.created_at).toLocaleString() : 'N/A'}
- Format: ${summary.worst_post?.content_format || 'unknown'}

RECENT POSTS:
${JSON.stringify(postSummaries, null, 2)}

DISCOVER:
1. What strategies GET FOLLOWERS (not just engagement)?
2. What should they do MORE of?
3. What should they AVOID?
4. What timing patterns work?
5. What content patterns convert?

Return JSON:
{
  "best_strategies": [
    {
      "name": "Strategy name",
      "description": "What it is",
      "pattern": "Specific pattern observed",
      "conversion_rate": 0.0,
      "confidence": 0.0-1.0,
      "examples": ["example 1", "example 2"],
      "how_to_apply": "Specific action steps"
    }
  ],
  "avoid_strategies": [...same format...],
  "optimal_timing": {
    "best_times": ["2 PM", "6 PM"],
    "worst_times": ["3 AM"],
    "reasoning": "Why these times"
  },
  "content_patterns": {
    "high_converting_hooks": ["hook pattern 1"],
    "high_converting_formats": ["format 1"],
    "high_converting_topics": ["topic 1"]
  },
  "engagement_to_follower_ratio": {
    "likes_per_follower": 20,
    "comments_per_follower": 5,
    "profile_clicks_per_follower": 3
  },
  "custom_advice": "Specific recommendations for THIS account"
}`;

    return { system, user };
  }

  /**
   * Cache insights in memory
   */
  private async cacheInsights(insights: StrategyInsights): Promise<void> {
    this.cachedInsights = insights;
    this.cacheTimestamp = Date.now();
    console.log('[AI_STRATEGY] 💾 Cached insights for 24h');
  }

  /**
   * Get cached insights
   */
  private async getCachedInsights(): Promise<StrategyInsights | null> {
    if (this.cachedInsights && (Date.now() - this.cacheTimestamp) < this.CACHE_TTL_MS) {
      return this.cachedInsights;
    }
    return null;
  }

  /**
   * Store insights in database for history
   */
  private async storeInsights(insights: StrategyInsights): Promise<void> {
    try {
      await this.supabase
        .from('ai_strategy_insights')
        .insert({
          discovered_at: new Date().toISOString(),
          insights: insights,
          strategies_count: insights.best_strategies.length
        });
    } catch (error) {
      console.log('[AI_STRATEGY] ⚠️ Could not store (non-critical)');
    }
  }

  /**
   * Get default insights when not enough data
   */
  private getDefaultInsights(): StrategyInsights {
    return {
      best_strategies: [
        {
          strategy_id: 'default_1',
          name: 'Controversial Takes',
          description: 'Challenge common beliefs with evidence',
          pattern: 'Most people think X, but research shows Y',
          conversion_rate: 5.0,
          confidence: 0.7,
          discovered_at: new Date().toISOString(),
          examples: ['Most people think sleep debt is real, but...'],
          how_to_apply: 'Lead with contrarian hook, back with research'
        }
      ],
      avoid_strategies: [],
      optimal_timing: {
        best_times: ['2 PM EST', '6 PM EST'],
        worst_times: ['3 AM EST'],
        reasoning: 'Standard peak engagement times (will personalize with more data)'
      },
      content_patterns: {
        high_converting_hooks: ['Most people think...', 'Here\'s why...'],
        high_converting_formats: ['threads', 'data-driven'],
        high_converting_topics: ['controversial health topics']
      },
      engagement_to_follower_ratio: {
        likes_per_follower: 20,
        comments_per_follower: 5,
        profile_clicks_per_follower: 3
      },
      custom_advice: 'Keep posting and building data. Analysis will improve with more posts.'
    };
  }

  /**
   * Get current strategies (cached or fresh)
   */
  async getCurrentStrategies(): Promise<FollowerStrategy[]> {
    const insights = await this.discoverStrategies();
    return insights.best_strategies;
  }

  /**
   * Get custom advice for content generation
   */
  async getContentAdvice(): Promise<string> {
    const insights = await this.discoverStrategies();
    return insights.custom_advice;
  }
}

export const getStrategyDiscoveryEngine = () => StrategyDiscoveryEngine.getInstance();

