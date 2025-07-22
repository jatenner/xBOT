import { minimalSupabaseClient } from './minimalSupabaseClient';

export interface ContentMetrics {
  contentHash: string;
  content: string;
  contentType: string;
  template: string;
  topic: string;
  tweetId?: string;
  posted: boolean;
  engagement?: {
    likes: number;
    retweets: number;
    replies: number;
    impressions: number;
  };
  postedAt?: Date;
}

export class ContentTracker {
  private static postedContent = new Set<string>();
  private static contentHistory: ContentMetrics[] = [];

  // Generate a hash for content to track duplicates
  static generateContentHash(content: string): string {
    return Buffer.from(content.toLowerCase().replace(/[^\w\s]/g, '')).toString('base64');
  }

  // Check if content has been posted before
  static async isContentUnique(content: string): Promise<boolean> {
    const hash = this.generateContentHash(content);
    
    // Check in-memory cache first
    if (this.postedContent.has(hash)) {
      return false;
    }

    // Check database for historical content
    try {
      if (minimalSupabaseClient.supabase) {
        const { data, error } = await minimalSupabaseClient.supabase
          .from('tweets')
          .select('content')
          .eq('content', content)
          .limit(1);

        if (error) {
          console.warn('⚠️ Content uniqueness check failed:', error);
          return true; // Assume unique if can't check
        }

        return !data || data.length === 0;
      }
    } catch (error) {
      console.warn('⚠️ Database uniqueness check failed:', error);
    }

    return true; // Assume unique if can't check database
  }

  // Track posted content
  static trackContent(metrics: ContentMetrics): void {
    const hash = this.generateContentHash(metrics.content);
    this.postedContent.add(hash);
    this.contentHistory.push(metrics);
    
    // Keep only last 1000 entries in memory
    if (this.contentHistory.length > 1000) {
      this.contentHistory.shift();
    }
  }

  // Get content performance analytics
  static getContentAnalytics(): {
    totalPosted: number;
    uniqueTemplates: number;
    uniqueTopics: number;
    topPerformingTypes: string[];
  } {
    const posted = this.contentHistory.filter(c => c.posted);
    const templates = new Set(posted.map(c => c.template));
    const topics = new Set(posted.map(c => c.topic));
    
    // Group by content type and calculate average engagement
    const typePerformance = new Map<string, number[]>();
    posted.forEach(content => {
      if (content.engagement) {
        const score = content.engagement.likes + content.engagement.retweets * 2 + content.engagement.replies * 3;
        const scores = typePerformance.get(content.contentType) || [];
        scores.push(score);
        typePerformance.set(content.contentType, scores);
      }
    });

    // Calculate average scores and sort
    const averages = Array.from(typePerformance.entries())
      .map(([type, scores]) => ({
        type,
        avgScore: scores.reduce((a, b) => a + b, 0) / scores.length
      }))
      .sort((a, b) => b.avgScore - a.avgScore);

    return {
      totalPosted: posted.length,
      uniqueTemplates: templates.size,
      uniqueTopics: topics.size,
      topPerformingTypes: averages.slice(0, 5).map(a => a.type)
    };
  }

  // Learn from engagement data and update database
  static async updateEngagementLearning(tweetId: string, engagement: ContentMetrics['engagement']): Promise<void> {
    try {
      if (minimalSupabaseClient.supabase && engagement) {
        // Update the tweets table with engagement data
        await minimalSupabaseClient.supabase
          .from('tweets')
          .update({
            likes: engagement.likes,
            retweets: engagement.retweets,
            replies: engagement.replies,
            impressions: engagement.impressions,
            engagement_score: engagement.likes + engagement.retweets * 2 + engagement.replies * 3,
            updated_at: new Date().toISOString()
          })
          .eq('tweet_id', tweetId);

        // Update local tracking
        const content = this.contentHistory.find(c => c.tweetId === tweetId);
        if (content) {
          content.engagement = engagement;
        }

        console.log(`📊 Updated engagement for tweet ${tweetId}:`, engagement);
      }
    } catch (error) {
      console.warn('⚠️ Engagement update failed:', error);
    }
  }

  // Get insights for content optimization
  static getContentInsights(): {
    shouldPost: boolean;
    recommendations: string[];
    optimalTypes: string[];
  } {
    const analytics = this.getContentAnalytics();
    
    return {
      shouldPost: this.postedContent.size < 10000, // Safety limit
      recommendations: [
        `Posted ${analytics.totalPosted} unique pieces of content`,
        `Using ${analytics.uniqueTemplates} different templates`,
        `Covering ${analytics.uniqueTopics} health topics`,
        analytics.topPerformingTypes.length > 0 
          ? `Top performing: ${analytics.topPerformingTypes.join(', ')}`
          : 'Gathering performance data...'
      ],
      optimalTypes: analytics.topPerformingTypes
    };
  }
}

export const contentTracker = ContentTracker; 