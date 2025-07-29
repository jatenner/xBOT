/**
 * 🧠 ADAPTIVE LEARNING SCHEDULER
 * Posts every 30 minutes (6 AM - 11 PM) but learns to optimize timing
 */

export interface LearningInsights {
  optimal_hours: number[];
  best_content_length: number;
  high_performing_hooks: string[];
  follower_conversion_rate_by_hour: { [hour: number]: number };
  engagement_rate_by_hour: { [hour: number]: number };
  posting_frequency_optimization: number; // minutes between posts
}

export class AdaptiveLearningScheduler {
  private static instance: AdaptiveLearningScheduler;
  private learningInsights: LearningInsights | null = null;
  private activeHoursStart = 6; // 6 AM
  private activeHoursEnd = 23;   // 11 PM
  private basePostingInterval = 30; // 30 minutes
  private baseReplyInterval = 90;   // 1.5 hours (90 minutes)
  
  static getInstance(): AdaptiveLearningScheduler {
    if (!this.instance) {
      this.instance = new AdaptiveLearningScheduler();
    }
    return this.instance;
  }

  /**
   * 🎯 Should we post now? (Intelligent decision based on learning)
   */
  shouldPostNow(): boolean {
    const currentHour = new Date().getHours();
    
    // Outside active hours - no posting
    if (currentHour < this.activeHoursStart || currentHour > this.activeHoursEnd) {
      console.log(`⏰ Outside active hours (${currentHour}:00). Active: ${this.activeHoursStart}:00 - ${this.activeHoursEnd}:00`);
      return false;
    }

    // If we have learning insights, use them
    if (this.learningInsights?.optimal_hours) {
      const isOptimalHour = this.learningInsights.optimal_hours.includes(currentHour);
      if (isOptimalHour) {
        console.log(`🎯 OPTIMAL HOUR DETECTED: ${currentHour}:00 - prioritizing post`);
        return true;
      }
      
      // Check engagement rate for this hour
      const hourEngagement = this.learningInsights.engagement_rate_by_hour[currentHour] || 0;
      if (hourEngagement > 0.04) { // Above 4% engagement
        console.log(`📈 HIGH ENGAGEMENT HOUR: ${currentHour}:00 (${(hourEngagement*100).toFixed(1)}%)`);
        return true;
      }
    } else {
      // LEARNING PHASE: More permissive posting to gather data
      // Post every 15 minutes during learning phase (first 100 posts)
      const minutes = new Date().getMinutes();
      const shouldPost = minutes % 15 === 0; // Every 15 minutes instead of 30
      
      if (shouldPost) {
        console.log(`🧠 LEARNING PHASE: Posting every 15 minutes to gather data (${currentHour}:${minutes.toString().padStart(2, '0')})`);
        return true;
      }
    }

    // Fallback: Post every 30 minutes during active hours
    const minutes = new Date().getMinutes();
    const shouldPost = minutes % this.basePostingInterval === 0;
    
    if (shouldPost) {
      console.log(`⏰ Regular posting schedule: ${currentHour}:${minutes.toString().padStart(2, '0')}`);
    }
    
    return shouldPost;
  }

  /**
   * 💬 Should we reply now? (Every 1.5 hours with optimization)
   */
  shouldReplyNow(): boolean {
    const currentHour = new Date().getHours();
    const minutes = new Date().getMinutes();
    
    // Outside active hours - no replies
    if (currentHour < this.activeHoursStart || currentHour > this.activeHoursEnd) {
      return false;
    }

    // If we have learning insights about reply timing
    if (this.learningInsights?.follower_conversion_rate_by_hour) {
      const conversionRate = this.learningInsights.follower_conversion_rate_by_hour[currentHour] || 0;
      if (conversionRate > 0.02) { // Above 2% follower conversion
        console.log(`🎯 HIGH CONVERSION HOUR: ${currentHour}:00 (${(conversionRate*100).toFixed(1)}% conversion)`);
        return true;
      }
    }

    // Default: Reply every 90 minutes
    const totalMinutes = (currentHour * 60) + minutes;
    const shouldReply = totalMinutes % this.baseReplyInterval === 0;
    
    if (shouldReply) {
      console.log(`💬 Regular reply schedule: ${currentHour}:${minutes.toString().padStart(2, '0')}`);
    }
    
    return shouldReply;
  }

  /**
   * 📊 Update learning insights from performance data
   */
  async updateLearningInsights(): Promise<void> {
    try {
      const { SmartLearningPostingEngine } = await import('./smartLearningPostingEngine');
      const engine = SmartLearningPostingEngine.getInstance();
      
      const insights = await engine.getLearningInsights();
      if (insights) {
        this.learningInsights = {
          optimal_hours: this.extractOptimalHours(insights),
          best_content_length: insights.optimal_length?.optimal || 150,
          high_performing_hooks: insights.best_hooks || [],
          follower_conversion_rate_by_hour: insights.timing_patterns?.conversion_by_hour || {},
          engagement_rate_by_hour: insights.timing_patterns?.engagement_by_hour || {},
          posting_frequency_optimization: this.calculateOptimalFrequency(insights)
        };
        
        console.log('📊 Learning insights updated:', this.learningInsights);
        
        // Adapt posting frequency based on learning
        if (this.learningInsights.posting_frequency_optimization) {
          this.basePostingInterval = this.learningInsights.posting_frequency_optimization;
          console.log(`🎯 OPTIMIZED: Posting frequency adapted to ${this.basePostingInterval} minutes`);
        }
      }
    } catch (error) {
      console.error('❌ Error updating learning insights:', error);
    }
  }

  /**
   * 🔍 Extract optimal posting hours from learning data
   */
  private extractOptimalHours(insights: any): number[] {
    if (!insights.timing_patterns?.distribution) return [];
    
    const hourCounts = insights.timing_patterns.distribution;
    const totalPosts = Object.values(hourCounts).reduce((a: number, b: number) => a + b, 0) as number;
    
    // Find hours with above-average performance
    const avgPostsPerHour = totalPosts / Object.keys(hourCounts).length;
    const optimalHours = Object.entries(hourCounts)
      .filter(([hour, count]) => (count as number) > avgPostsPerHour * 1.2) // 20% above average
      .map(([hour]) => parseInt(hour))
      .slice(0, 5); // Top 5 hours
    
    return optimalHours;
  }

  /**
   * ⏱️ Calculate optimal posting frequency based on engagement data
   */
  private calculateOptimalFrequency(insights: any): number {
    // If engagement rate is high, post more frequently
    const avgEngagement = insights.average_quality || 0;
    const successRate = insights.successful_posts / insights.total_attempts;
    
    if (avgEngagement > 75 && successRate > 0.8) {
      return 20; // Post every 20 minutes if quality is high
    } else if (avgEngagement > 70 && successRate > 0.6) {
      return 30; // Keep 30 minutes if doing well
    } else {
      return 45; // Slow down if quality/success is low
    }
  }

  /**
   * 🎯 Get next optimal posting time
   */
  getNextOptimalPostTime(): Date {
    const now = new Date();
    let nextPost = new Date(now);
    
    // If we have optimal hours, target the next one
    if (this.learningInsights?.optimal_hours && this.learningInsights.optimal_hours.length > 0) {
      const currentHour = now.getHours();
      const nextOptimalHour = this.learningInsights.optimal_hours.find(hour => hour > currentHour) ||
                             this.learningInsights.optimal_hours[0] + 24; // Next day
      
      nextPost.setHours(nextOptimalHour % 24, 0, 0, 0);
      if (nextOptimalHour >= 24) {
        nextPost.setDate(nextPost.getDate() + 1);
      }
      
      return nextPost;
    }
    
    // Default: Next 30-minute interval
    const nextInterval = Math.ceil(now.getMinutes() / this.basePostingInterval) * this.basePostingInterval;
    if (nextInterval >= 60) {
      nextPost.setHours(nextPost.getHours() + 1, 0, 0, 0);
    } else {
      nextPost.setMinutes(nextInterval, 0, 0);
    }
    
    return nextPost;
  }

  /**
   * 📈 Get adaptive posting strategy for current time
   */
  getAdaptiveStrategy(): {
    shouldPost: boolean;
    shouldReply: boolean;
    strategy: string;
    confidence: number;
  } {
    const shouldPost = this.shouldPostNow();
    const shouldReply = this.shouldReplyNow();
    
    let strategy = 'standard_schedule';
    let confidence = 0.7; // Increased from 0.5 to be more permissive
    
    if (this.learningInsights) {
      const currentHour = new Date().getHours();
      const isOptimal = this.learningInsights.optimal_hours.includes(currentHour);
      const engagement = this.learningInsights.engagement_rate_by_hour[currentHour] || 0;
      
      if (isOptimal && engagement > 0.05) {
        strategy = 'high_performance_window';
        confidence = 0.9;
      } else if (engagement > 0.03) {
        strategy = 'good_engagement_window';
        confidence = 0.7;
      } else if (engagement < 0.02) {
        strategy = 'low_engagement_window';
        confidence = 0.5; // Still allowing posts during low engagement for learning
      }
    } else {
      // LEARNING PHASE: Higher confidence to encourage data collection
      strategy = 'learning_data_collection';
      confidence = 0.8;
    }
    
    return {
      shouldPost,
      shouldReply,
      strategy,
      confidence
    };
  }
}