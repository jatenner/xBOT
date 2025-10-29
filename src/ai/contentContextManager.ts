/**
 * 📊 CONTENT CONTEXT MANAGER
 * Gathers all context needed for intelligent content generation:
 * - Recent posts history
 * - Performance insights (what worked/flopped)
 * - Trending topics
 * - Patterns to follow/avoid
 */

import { getSupabaseClient } from '../db/index';

interface PerformanceInsights {
  topPerformers: Array<{
    content: string;
    engagement: number;
    likes: number;
    followers_gained: number;
  }>;
  recentFlops: Array<{
    content: string;
    engagement: number;
  }>;
  winningPatterns: string[];
  patternsToAvoid: string[];
  avgEngagement: number;
  postsAnalyzed: number;
}

interface ContentContext {
  recentPosts: string[];
  recentTopics: string[];
  performanceInsights: PerformanceInsights;
  trendingTopics: string[];
}

export class ContentContextManager {
  private static instance: ContentContextManager;
  private supabase = getSupabaseClient();

  public static getInstance(): ContentContextManager {
    if (!ContentContextManager.instance) {
      ContentContextManager.instance = new ContentContextManager();
    }
    return ContentContextManager.instance;
  }

  /**
   * Get all context needed for content generation
   */
  async getFullContext(): Promise<ContentContext> {
    console.log('📊 CONTEXT_MANAGER: Gathering full context...');

    const [recentPosts, performanceInsights, trendingTopics] = await Promise.all([
      this.getRecentPosts(),
      this.getPerformanceInsights(),
      this.getTrendingTopics()
    ]);

    const recentTopics = this.extractTopics(recentPosts);

    console.log(`   Recent posts: ${recentPosts.length}`);
    console.log(`   Recent topics: ${recentTopics.join(', ')}`);
    console.log(`   Avg engagement: ${(performanceInsights.avgEngagement * 100).toFixed(2)}%`);
    console.log(`   Top performers: ${performanceInsights.topPerformers.length}`);

    return {
      recentPosts,
      recentTopics,
      performanceInsights,
      trendingTopics
    };
  }

  /**
   * Get recent posts (last 30) to avoid repetition
   */
  private async getRecentPosts(): Promise<string[]> {
    try {
      // Use content_metadata table which has all the rich metadata
      const { data } = await this.supabase
        .from('content_metadata')
        .select('content, topic_cluster, generator_name, angle, tone, format_strategy')
        .eq('status', 'posted')
        .order('posted_at', { ascending: false })
        .limit(30);

      if (!data || data.length === 0) {
        console.warn('   ⚠️ No posted content found in content_metadata');
        return [];
      }

      return data.map((p: any) => String(p.content).substring(0, 200));
    } catch (error: any) {
      console.warn('   ⚠️ Could not fetch recent posts:', error.message);
      return [];
    }
  }

  /**
   * Extract topics from recent posts
   */
  private extractTopics(posts: string[]): string[] {
    const topics = new Set<string>();

    const topicKeywords = [
      { keyword: /sleep/i, topic: 'sleep' },
      { keyword: /gut|microbiome|probiotic/i, topic: 'gut health' },
      { keyword: /anxiety|stress|mental/i, topic: 'mental health' },
      { keyword: /exercise|workout|gym/i, topic: 'exercise' },
      { keyword: /diet|nutrition|food/i, topic: 'nutrition' },
      { keyword: /vitamin|supplement/i, topic: 'supplements' },
      { keyword: /meditation|mindfulness/i, topic: 'meditation' },
      { keyword: /habit|routine/i, topic: 'habits' },
      { keyword: /cold|shower|exposure/i, topic: 'cold exposure' },
      { keyword: /caffeine|coffee/i, topic: 'caffeine' },
      { keyword: /inflammation/i, topic: 'inflammation' },
      { keyword: /immune|immunity/i, topic: 'immunity' },
      { keyword: /energy|fatigue/i, topic: 'energy' },
      { keyword: /focus|concentration/i, topic: 'focus' }
    ];

    for (const post of posts) {
      for (const { keyword, topic } of topicKeywords) {
        if (keyword.test(post)) {
          topics.add(topic);
        }
      }
    }

    return Array.from(topics).slice(0, 10);
  }

  /**
   * Get performance insights: what worked, what flopped
   */
  private async getPerformanceInsights(): Promise<PerformanceInsights> {
    try {
      // Get posts with engagement data
      const { data: posts } = await this.supabase
        .from('content_with_outcomes')  // ✅ ROOT CAUSE FIX: Use table with actual data
        .select('content, engagement_rate, likes, followers_gained')
        .not('engagement_rate', 'is', null)
        .order('posted_at', { ascending: false })
        .limit(50);

      if (!posts || posts.length === 0) {
        return {
          topPerformers: [],
          recentFlops: [],
          winningPatterns: [],
          patternsToAvoid: [],
          avgEngagement: 0.01,
          postsAnalyzed: 0
        };
      }

      // Calculate average engagement
      const avgEngagement = posts.reduce((sum, p) => sum + (Number(p.engagement_rate) || 0), 0) / posts.length;

      // Top performers (above 2x average engagement)
      const topPerformers = posts
        .filter(p => Number(p.engagement_rate) > avgEngagement * 2)
        .sort((a, b) => Number(b.engagement_rate) - Number(a.engagement_rate))
        .slice(0, 5)
        .map(p => ({
          content: String(p.content).substring(0, 150),
          engagement: Number(p.engagement_rate),
          likes: Number(p.likes) || 0,
          followers_gained: Number(p.followers_gained) || 0
        }));

      // Recent flops (below 50% of average)
      const recentFlops = posts
        .filter(p => Number(p.engagement_rate) < avgEngagement * 0.5)
        .slice(0, 5)
        .map(p => ({
          content: String(p.content).substring(0, 150),
          engagement: Number(p.engagement_rate)
        }));

      // Identify patterns
      const winningPatterns = this.identifyPatterns(topPerformers.map(p => p.content));
      const patternsToAvoid = this.identifyPatterns(recentFlops.map(p => p.content));

      return {
        topPerformers,
        recentFlops,
        winningPatterns,
        patternsToAvoid,
        avgEngagement,
        postsAnalyzed: posts.length
      };
    } catch (error: any) {
      console.warn('   ⚠️ Could not fetch performance insights:', error.message);
      return {
        topPerformers: [],
        recentFlops: [],
        winningPatterns: [],
        patternsToAvoid: [],
        avgEngagement: 0.01,
        postsAnalyzed: 0
      };
    }
  }

  /**
   * Identify patterns in content
   */
  private identifyPatterns(contents: string[]): string[] {
    if (contents.length === 0) return [];

    const patterns: string[] = [];

    // Check for common starting patterns
    const hasContrarian = contents.some(c => /everyone (thinks|believes)|myth|wrong about/i.test(c));
    if (hasContrarian) patterns.push('contrarian/myth-busting openings');

    const hasPersonal = contents.some(c => /I (tried|tested|changed)|my|friend/i.test(c));
    if (hasPersonal) patterns.push('personal stories/experiences');

    const hasNumbers = contents.some(c => /\d+%|\d+ (days|weeks|hours|minutes)/i.test(c));
    if (hasNumbers) patterns.push('specific numbers and timelines');

    const hasQuestions = contents.some(c => /^(why|what|how|ever notice|did you know)/i.test(c));
    if (hasQuestions) patterns.push('question-based hooks');

    const hasDirective = contents.some(c => /^(stop|start|don't|never|always)/i.test(c));
    if (hasDirective) patterns.push('direct commands/advice');

    return patterns.slice(0, 3); // Top 3 patterns
  }

  /**
   * Get trending topics (from competitor intelligence or viral trends)
   */
  private async getTrendingTopics(): Promise<string[]> {
    try {
      // Try to get from competitor intelligence
      const { data: trends } = await this.supabase
        .from('competitor_intelligence')
        .select('topic, trending_score')
        .order('trending_score', { ascending: false })
        .limit(5);

      if (trends && trends.length > 0) {
        return trends.map((t: any) => t.topic);
      }

      // Fallback to recent popular topics
      return [
        'sleep optimization',
        'gut-brain connection',
        'stress management',
        'performance optimization'
      ];
    } catch (error: any) {
      console.warn('   ⚠️ Could not fetch trending topics:', error.message);
      return [];
    }
  }
}

export const getContentContextManager = () => ContentContextManager.getInstance();

