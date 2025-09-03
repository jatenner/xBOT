/**
 * CONTENT PERFORMANCE LEARNER
 * Learns from engagement data to improve future content generation
 */

import { admin } from '../lib/supabaseClients';

export interface ContentPattern {
  pattern_type: 'hook' | 'format' | 'topic' | 'length' | 'timing';
  pattern_value: string;
  success_rate: number;
  avg_engagement: number;
  follower_conversion: number;
  sample_size: number;
  confidence_score: number;
}

export interface LearningInsights {
  successful_patterns: ContentPattern[];
  failing_patterns: ContentPattern[];
  recommendations: string[];
  optimal_posting_times: string[];
  viral_content_traits: string[];
}

export class ContentPerformanceLearner {
  private static instance: ContentPerformanceLearner;

  public static getInstance(): ContentPerformanceLearner {
    if (!ContentPerformanceLearner.instance) {
      ContentPerformanceLearner.instance = new ContentPerformanceLearner();
    }
    return ContentPerformanceLearner.instance;
  }

  /**
   * ANALYZE CONTENT PERFORMANCE - Learn what works vs what doesn't
   */
  async analyzeContentPerformance(): Promise<LearningInsights> {
    console.log('🧠 LEARNING_ENGINE: Analyzing content performance patterns...');

    try {
      // Get recent posts with engagement data
      const { data: posts, error } = await admin
        .from('posts')
        .select(`
          content,
          likes,
          retweets,
          replies,
          impressions,
          followers_gained,
          created_at,
          post_metrics (
            likes,
            retweets,
            replies,
            impressions,
            followers_before,
            followers_after
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('❌ Failed to fetch posts for learning:', error);
        return this.getDefaultInsights();
      }

      if (!posts || posts.length === 0) {
        console.log('⚠️ No posts found for learning analysis');
        return this.getDefaultInsights();
      }

      console.log(`📊 ANALYZING: ${posts.length} posts for learning patterns`);

      // Analyze successful vs failing patterns
      const successfulPosts = posts.filter(post => this.isSuccessfulPost(post));
      const failingPosts = posts.filter(post => this.isFailingPost(post));

      console.log(`✅ SUCCESSFUL: ${successfulPosts.length} posts`);
      console.log(`❌ FAILING: ${failingPosts.length} posts`);

      // Extract patterns from successful content
      const successfulPatterns = this.extractPatterns(successfulPosts, true);
      const failingPatterns = this.extractPatterns(failingPosts, false);

      // Generate actionable recommendations
      const recommendations = this.generateRecommendations(successfulPatterns, failingPatterns);

      const insights: LearningInsights = {
        successful_patterns: successfulPatterns,
        failing_patterns: failingPatterns,
        recommendations,
        optimal_posting_times: this.findOptimalTimes(successfulPosts),
        viral_content_traits: this.identifyViralTraits(successfulPosts)
      };

      console.log(`🎯 INSIGHTS: ${recommendations.length} recommendations generated`);
      console.log(`⏰ TIMING: ${insights.optimal_posting_times.length} optimal time slots found`);

      return insights;

    } catch (error) {
      console.error('❌ Content performance analysis failed:', error);
      return this.getDefaultInsights();
    }
  }

  /**
   * GET CONTENT IMPROVEMENT SUGGESTIONS based on learned patterns
   */
  async getImprovementSuggestions(contentType: 'single' | 'thread'): Promise<{
    hooks: string[];
    formats: string[];
    topics: string[];
    avoid_patterns: string[];
    optimal_length: number;
  }> {
    const insights = await this.analyzeContentPerformance();

    const hooks = insights.successful_patterns
      .filter(p => p.pattern_type === 'hook')
      .sort((a, b) => b.success_rate - a.success_rate)
      .slice(0, 5)
      .map(p => p.pattern_value);

    const formats = insights.successful_patterns
      .filter(p => p.pattern_type === 'format')
      .sort((a, b) => b.follower_conversion - a.follower_conversion)
      .slice(0, 3)
      .map(p => p.pattern_value);

    const topics = insights.successful_patterns
      .filter(p => p.pattern_type === 'topic')
      .sort((a, b) => b.avg_engagement - a.avg_engagement)
      .slice(0, 5)
      .map(p => p.pattern_value);

    const avoid_patterns = insights.failing_patterns
      .filter(p => p.confidence_score > 0.7)
      .map(p => p.pattern_value);

    const lengthPatterns = insights.successful_patterns
      .filter(p => p.pattern_type === 'length');
    
    const optimal_length = lengthPatterns.length > 0
      ? Math.round(lengthPatterns.reduce((sum, p) => sum + parseInt(p.pattern_value), 0) / lengthPatterns.length)
      : (contentType === 'thread' ? 180 : 220);

    return {
      hooks,
      formats,
      topics,
      avoid_patterns,
      optimal_length
    };
  }

  /**
   * DETERMINE IF POST WAS SUCCESSFUL based on engagement metrics
   */
  private isSuccessfulPost(post: any): boolean {
    const likes = post.likes || 0;
    const retweets = post.retweets || 0;
    const replies = post.replies || 0;
    const impressions = post.impressions || 1;
    const followersGained = post.followers_gained || 0;

    // Calculate engagement rate
    const engagementRate = (likes + retweets + replies) / impressions;
    
    // A post is successful if:
    // 1. High engagement rate (>3%) OR
    // 2. Gained followers (>2) OR  
    // 3. High absolute engagement (>20 total interactions)
    return engagementRate > 0.03 || followersGained > 2 || (likes + retweets + replies) > 20;
  }

  /**
   * DETERMINE IF POST FAILED based on poor metrics
   */
  private isFailingPost(post: any): boolean {
    const likes = post.likes || 0;
    const retweets = post.retweets || 0;
    const replies = post.replies || 0;
    const impressions = post.impressions || 1;
    const followersGained = post.followers_gained || 0;

    const engagementRate = (likes + retweets + replies) / impressions;
    const totalEngagement = likes + retweets + replies;

    // A post failed if:
    // 1. Very low engagement rate (<0.5%) AND
    // 2. No followers gained AND
    // 3. Low absolute engagement (<5 total interactions)
    return engagementRate < 0.005 && followersGained <= 0 && totalEngagement < 5;
  }

  /**
   * EXTRACT PATTERNS from successful/failing content
   */
  private extractPatterns(posts: any[], isSuccessful: boolean): ContentPattern[] {
    const patterns: ContentPattern[] = [];

    posts.forEach(post => {
      const content = post.content || '';
      const engagement = (post.likes || 0) + (post.retweets || 0) + (post.replies || 0);
      const followersGained = post.followers_gained || 0;

      // Extract hook patterns (first 50 characters)
      const hook = content.substring(0, 50).toLowerCase();
      if (hook.includes('most people')) {
        patterns.push(this.createPattern('hook', 'most people', engagement, followersGained));
      }
      if (hook.includes('shocking truth')) {
        patterns.push(this.createPattern('hook', 'shocking truth', engagement, followersGained));
      }
      if (hook.includes('did you know')) {
        patterns.push(this.createPattern('hook', 'did you know', engagement, followersGained));
      }

      // Extract format patterns
      if (content.includes('1/') || content.includes('🧵')) {
        patterns.push(this.createPattern('format', 'thread', engagement, followersGained));
      } else {
        patterns.push(this.createPattern('format', 'single', engagement, followersGained));
      }

      // Extract topic patterns
      if (content.toLowerCase().includes('sleep')) {
        patterns.push(this.createPattern('topic', 'sleep', engagement, followersGained));
      }
      if (content.toLowerCase().includes('nutrition')) {
        patterns.push(this.createPattern('topic', 'nutrition', engagement, followersGained));
      }
      if (content.toLowerCase().includes('exercise')) {
        patterns.push(this.createPattern('topic', 'exercise', engagement, followersGained));
      }

      // Extract length patterns
      const lengthCategory = this.categorizeLength(content.length);
      patterns.push(this.createPattern('length', lengthCategory, engagement, followersGained));
    });

    // Aggregate patterns and calculate success rates
    return this.aggregatePatterns(patterns, isSuccessful);
  }

  private createPattern(type: string, value: string, engagement: number, followersGained: number): any {
    return {
      pattern_type: type,
      pattern_value: value,
      engagement,
      followers_gained: followersGained
    };
  }

  private categorizeLength(length: number): string {
    if (length < 100) return 'short';
    if (length < 200) return 'medium';
    return 'long';
  }

  private aggregatePatterns(patterns: any[], isSuccessful: boolean): ContentPattern[] {
    const grouped = new Map<string, any[]>();
    
    patterns.forEach(pattern => {
      const key = `${pattern.pattern_type}:${pattern.pattern_value}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(pattern);
    });

    const result: ContentPattern[] = [];

    grouped.forEach((patternGroup, key) => {
      const [type, value] = key.split(':');
      const totalEngagement = patternGroup.reduce((sum, p) => sum + p.engagement, 0);
      const totalFollowers = patternGroup.reduce((sum, p) => sum + p.followers_gained, 0);
      const avgEngagement = totalEngagement / patternGroup.length;
      const avgFollowers = totalFollowers / patternGroup.length;

      result.push({
        pattern_type: type as any,
        pattern_value: value,
        success_rate: isSuccessful ? 0.8 : 0.2, // Simplified for now
        avg_engagement: avgEngagement,
        follower_conversion: avgFollowers,
        sample_size: patternGroup.length,
        confidence_score: Math.min(patternGroup.length / 5, 1) // More samples = higher confidence
      });
    });

    return result.filter(p => p.sample_size >= 2); // Only patterns with enough data
  }

  private generateRecommendations(successful: ContentPattern[], failing: ContentPattern[]): string[] {
    const recommendations: string[] = [];

    // Hook recommendations
    const successfulHooks = successful.filter(p => p.pattern_type === 'hook');
    if (successfulHooks.length > 0) {
      const bestHook = successfulHooks.sort((a, b) => b.follower_conversion - a.follower_conversion)[0];
      recommendations.push(`Use hooks like "${bestHook.pattern_value}" - gains ${bestHook.follower_conversion.toFixed(1)} followers on average`);
    }

    // Format recommendations
    const threadSuccess = successful.find(p => p.pattern_type === 'format' && p.pattern_value === 'thread');
    const singleSuccess = successful.find(p => p.pattern_type === 'format' && p.pattern_value === 'single');
    
    if (threadSuccess && singleSuccess) {
      if (threadSuccess.follower_conversion > singleSuccess.follower_conversion) {
        recommendations.push('Threads perform better for follower growth - consider more thread content');
      } else {
        recommendations.push('Single tweets perform better for follower growth - focus on concise value');
      }
    }

    // Topic recommendations
    const topTopics = successful
      .filter(p => p.pattern_type === 'topic')
      .sort((a, b) => b.avg_engagement - a.avg_engagement)
      .slice(0, 2);
    
    topTopics.forEach(topic => {
      recommendations.push(`"${topic.pattern_value}" content gets ${topic.avg_engagement.toFixed(0)} average engagement`);
    });

    // Avoid failing patterns
    const highConfidenceFailures = failing.filter(p => p.confidence_score > 0.7);
    highConfidenceFailures.forEach(pattern => {
      recommendations.push(`Avoid "${pattern.pattern_value}" - consistently underperforms`);
    });

    return recommendations;
  }

  private findOptimalTimes(successfulPosts: any[]): string[] {
    const timeSlots = new Map<string, number>();

    successfulPosts.forEach(post => {
      const createdAt = new Date(post.created_at);
      const hour = createdAt.getHours();
      const timeSlot = `${hour}:00`;
      
      timeSlots.set(timeSlot, (timeSlots.get(timeSlot) || 0) + 1);
    });

    return Array.from(timeSlots.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([time]) => time);
  }

  private identifyViralTraits(successfulPosts: any[]): string[] {
    const traits: string[] = [];
    
    const highEngagementPosts = successfulPosts
      .filter(post => (post.likes + post.retweets + post.replies) > 50)
      .map(post => post.content.toLowerCase());

    // Common viral patterns
    if (highEngagementPosts.some(content => content.includes('shocking'))) {
      traits.push('Use "shocking" for curiosity');
    }
    if (highEngagementPosts.some(content => content.includes('secret'))) {
      traits.push('Include "secret" information');
    }
    if (highEngagementPosts.some(content => content.match(/\d+%/))) {
      traits.push('Include specific percentages');
    }
    if (highEngagementPosts.some(content => content.includes('?'))) {
      traits.push('Use questions for engagement');
    }

    return traits;
  }

  private getDefaultInsights(): LearningInsights {
    return {
      successful_patterns: [],
      failing_patterns: [],
      recommendations: [
        'Use specific numbers and percentages',
        'Include actionable advice',
        'Ask engaging questions',
        'Avoid incomplete sentences'
      ],
      optimal_posting_times: ['9:00', '14:00', '19:00'],
      viral_content_traits: [
        'Controversial angles',
        'Specific statistics',
        'Actionable tips',
        'Question hooks'
      ]
    };
  }
}
