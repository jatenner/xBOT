#!/usr/bin/env node

/**
 * 🧠 ADAPTIVE LEARNING SCHEDULE SYSTEM
 * ===================================
 * High-frequency posting (30min) with intelligent optimization based on learning data
 */

const fs = require('fs');
const path = require('path');

function createAdaptiveLearningScheduler() {
    console.log('🧠 Creating Adaptive Learning Scheduler...');
    
    const schedulerContent = `/**
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
      console.log(\`⏰ Outside active hours (\${currentHour}:00). Active: \${this.activeHoursStart}:00 - \${this.activeHoursEnd}:00\`);
      return false;
    }

    // If we have learning insights, use them
    if (this.learningInsights?.optimal_hours) {
      const isOptimalHour = this.learningInsights.optimal_hours.includes(currentHour);
      if (isOptimalHour) {
        console.log(\`🎯 OPTIMAL HOUR DETECTED: \${currentHour}:00 - prioritizing post\`);
        return true;
      }
      
      // Check engagement rate for this hour
      const hourEngagement = this.learningInsights.engagement_rate_by_hour[currentHour] || 0;
      if (hourEngagement > 0.04) { // Above 4% engagement
        console.log(\`📈 HIGH ENGAGEMENT HOUR: \${currentHour}:00 (\${(hourEngagement*100).toFixed(1)}%)\`);
        return true;
      }
    }

    // Default: Post every 30 minutes during active hours
    const minutes = new Date().getMinutes();
    const shouldPost = minutes % this.basePostingInterval === 0;
    
    if (shouldPost) {
      console.log(\`⏰ Regular posting schedule: \${currentHour}:\${minutes.toString().padStart(2, '0')}\`);
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
        console.log(\`🎯 HIGH CONVERSION HOUR: \${currentHour}:00 (\${(conversionRate*100).toFixed(1)}% conversion)\`);
        return true;
      }
    }

    // Default: Reply every 90 minutes
    const totalMinutes = (currentHour * 60) + minutes;
    const shouldReply = totalMinutes % this.baseReplyInterval === 0;
    
    if (shouldReply) {
      console.log(\`💬 Regular reply schedule: \${currentHour}:\${minutes.toString().padStart(2, '0')}\`);
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
          console.log(\`🎯 OPTIMIZED: Posting frequency adapted to \${this.basePostingInterval} minutes\`);
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
    const totalPosts = Object.values(hourCounts).reduce((a: number, b: number) => a + b, 0);
    
    // Find hours with above-average performance
    const avgPostsPerHour = totalPosts / Object.keys(hourCounts).length;
    const optimalHours = Object.entries(hourCounts)
      .filter(([hour, count]) => count > avgPostsPerHour * 1.2) // 20% above average
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
    let confidence = 0.5;
    
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
        confidence = 0.3;
      }
    }
    
    return {
      shouldPost,
      shouldReply,
      strategy,
      confidence
    };
  }
}`;

    fs.writeFileSync(
        path.join(process.cwd(), 'src/utils/adaptiveLearningScheduler.ts'),
        schedulerContent
    );
    
    console.log('✅ Adaptive Learning Scheduler created');
}

function updateMasterControllerWithAdaptiveSchedule() {
    console.log('🎛️ Updating Master Controller with adaptive schedule...');
    
    const controllerPath = path.join(process.cwd(), 'src/core/masterAutonomousController.ts');
    
    if (fs.existsSync(controllerPath)) {
        let content = fs.readFileSync(controllerPath, 'utf8');
        
        // Replace the posting cycle with adaptive scheduling
        content = content.replace(
            /}, 4 \* 60 \* 60 \* 1000\)\); \/\/ 4 hours for learning cycle/,
            '}, 30 * 60 * 1000)); // 30 minutes adaptive learning cycle'
        );
        
        // Replace the reply cycle timing
        content = content.replace(
            /}, 4 \* 60 \* 60 \* 1000\)\); \/\/ 4 hours/,
            '}, 90 * 60 * 1000)); // 1.5 hours (90 minutes)'
        );
        
        // Update the posting cycle logic with adaptive decision making
        content = content.replace(
            /console\.log\('🧠 SMART LEARNING: Controlled posting for data collection'\);/,
            `console.log('🧠 ADAPTIVE LEARNING: Intelligent scheduling with optimization');
    
    // Import adaptive scheduler
    const { AdaptiveLearningScheduler } = await import('../utils/adaptiveLearningScheduler');
    const scheduler = AdaptiveLearningScheduler.getInstance();
    
    // Update learning insights every cycle
    await scheduler.updateLearningInsights();
    
    // Get adaptive strategy
    const strategy = scheduler.getAdaptiveStrategy();
    console.log(\`📊 Strategy: \${strategy.strategy} | Confidence: \${(strategy.confidence*100).toFixed(1)}%\`);
    
    if (!strategy.shouldPost) {
      console.log('⏰ Not optimal time for posting - skipping cycle');
      return;
    }`
        );
        
        // Add learning insights update to the posting cycle
        content = content.replace(
            /this\.operationalMetrics\.posting\.lastPostTime = new Date\(\);/,
            `this.operationalMetrics.posting.lastPostTime = new Date();
      
      // Update learning insights after successful post
      await scheduler.updateLearningInsights();`
        );
        
        fs.writeFileSync(controllerPath, content);
        console.log('✅ Master Controller updated with adaptive scheduling');
    }
}

function createIntelligentTimingOptimizer() {
    console.log('⏰ Creating Intelligent Timing Optimizer...');
    
    const optimizerContent = `/**
 * ⏰ INTELLIGENT TIMING OPTIMIZER
 * Learns optimal posting times from actual engagement data
 */

import { supabaseClient } from './supabaseClient';

export interface TimingInsights {
  optimal_posting_hours: number[];
  optimal_reply_hours: number[];
  peak_engagement_windows: { start: number; end: number; score: number }[];
  follower_growth_by_hour: { [hour: number]: number };
  engagement_patterns: {
    weekday_vs_weekend: { weekday: number; weekend: number };
    morning_vs_evening: { morning: number; evening: number };
    hourly_performance: { [hour: number]: number };
  };
}

export class IntelligentTimingOptimizer {
  private static instance: IntelligentTimingOptimizer;
  
  static getInstance(): IntelligentTimingOptimizer {
    if (!this.instance) {
      this.instance = new IntelligentTimingOptimizer();
    }
    return this.instance;
  }

  /**
   * 📊 Analyze timing performance from learning data
   */
  async analyzeOptimalTiming(): Promise<TimingInsights | null> {
    try {
      if (!supabaseClient.supabase) return null;

      // Get posts from last 30 days with performance data
      const { data: posts } = await supabaseClient.supabase
        .from('learning_posts')
        .select('*')
        .eq('was_posted', true)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (!posts || posts.length < 10) {
        console.log('📊 Not enough data for timing analysis (need 10+ posts)');
        return null;
      }

      const insights = this.calculateTimingInsights(posts);
      
      console.log('⏰ Timing Analysis Complete:', {
        total_posts_analyzed: posts.length,
        optimal_hours: insights.optimal_posting_hours,
        peak_windows: insights.peak_engagement_windows.length
      });

      return insights;

    } catch (error) {
      console.error('❌ Error analyzing timing:', error);
      return null;
    }
  }

  /**
   * 🧮 Calculate insights from post data
   */
  private calculateTimingInsights(posts: any[]): TimingInsights {
    const hourlyPerformance: { [hour: number]: { total: number; engagement: number; followers: number } } = {};
    
    // Initialize hourly data
    for (let hour = 0; hour < 24; hour++) {
      hourlyPerformance[hour] = { total: 0, engagement: 0, followers: 0 };
    }

    // Analyze each post
    posts.forEach(post => {
      const hour = new Date(post.created_at).getHours();
      const engagement = (post.likes_count || 0) + (post.retweets_count || 0) + (post.replies_count || 0);
      const followers = post.converted_followers || 0;
      
      hourlyPerformance[hour].total++;
      hourlyPerformance[hour].engagement += engagement;
      hourlyPerformance[hour].followers += followers;
    });

    // Calculate averages and find optimal hours
    const hourlyAvgEngagement: { [hour: number]: number } = {};
    const hourlyAvgFollowers: { [hour: number]: number } = {};
    
    Object.entries(hourlyPerformance).forEach(([hour, data]) => {
      const hourNum = parseInt(hour);
      hourlyAvgEngagement[hourNum] = data.total > 0 ? data.engagement / data.total : 0;
      hourlyAvgFollowers[hourNum] = data.total > 0 ? data.followers / data.total : 0;
    });

    // Find top performing hours
    const engagementHours = Object.entries(hourlyAvgEngagement)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 6)
      .map(([hour]) => parseInt(hour));

    const followerHours = Object.entries(hourlyAvgFollowers)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 4)
      .map(([hour]) => parseInt(hour));

    // Find peak engagement windows (consecutive high-performing hours)
    const peakWindows = this.findPeakWindows(hourlyAvgEngagement);

    // Calculate weekday vs weekend and morning vs evening performance
    const patterns = this.calculateEngagementPatterns(posts);

    return {
      optimal_posting_hours: engagementHours,
      optimal_reply_hours: followerHours,
      peak_engagement_windows: peakWindows,
      follower_growth_by_hour: hourlyAvgFollowers,
      engagement_patterns: patterns
    };
  }

  /**
   * 🔍 Find consecutive high-performing hour windows
   */
  private findPeakWindows(hourlyEngagement: { [hour: number]: number }): { start: number; end: number; score: number }[] {
    const windows = [];
    const threshold = Object.values(hourlyEngagement).reduce((a, b) => a + b, 0) / 24 * 1.2; // 20% above average
    
    let windowStart = -1;
    let windowScore = 0;
    
    for (let hour = 0; hour < 24; hour++) {
      if (hourlyEngagement[hour] > threshold) {
        if (windowStart === -1) {
          windowStart = hour;
          windowScore = hourlyEngagement[hour];
        } else {
          windowScore += hourlyEngagement[hour];
        }
      } else {
        if (windowStart !== -1) {
          windows.push({
            start: windowStart,
            end: hour - 1,
            score: windowScore / (hour - windowStart)
          });
          windowStart = -1;
          windowScore = 0;
        }
      }
    }
    
    return windows.sort((a, b) => b.score - a.score).slice(0, 3);
  }

  /**
   * 📈 Calculate engagement patterns
   */
  private calculateEngagementPatterns(posts: any[]): any {
    let weekdayEngagement = 0, weekendEngagement = 0;
    let morningEngagement = 0, eveningEngagement = 0;
    let weekdayCount = 0, weekendCount = 0;
    let morningCount = 0, eveningCount = 0;
    
    posts.forEach(post => {
      const date = new Date(post.created_at);
      const hour = date.getHours();
      const dayOfWeek = date.getDay();
      const engagement = (post.likes_count || 0) + (post.retweets_count || 0) + (post.replies_count || 0);
      
      if (dayOfWeek === 0 || dayOfWeek === 6) { // Weekend
        weekendEngagement += engagement;
        weekendCount++;
      } else { // Weekday
        weekdayEngagement += engagement;
        weekdayCount++;
      }
      
      if (hour >= 6 && hour < 12) { // Morning
        morningEngagement += engagement;
        morningCount++;
      } else if (hour >= 18 && hour < 24) { // Evening
        eveningEngagement += engagement;
        eveningCount++;
      }
    });
    
    return {
      weekday_vs_weekend: {
        weekday: weekdayCount > 0 ? weekdayEngagement / weekdayCount : 0,
        weekend: weekendCount > 0 ? weekendEngagement / weekendCount : 0
      },
      morning_vs_evening: {
        morning: morningCount > 0 ? morningEngagement / morningCount : 0,
        evening: eveningCount > 0 ? eveningEngagement / eveningCount : 0
      },
      hourly_performance: Object.fromEntries(
        Array.from({length: 24}, (_, hour) => {
          const hourPosts = posts.filter(p => new Date(p.created_at).getHours() === hour);
          const avgEngagement = hourPosts.length > 0 
            ? hourPosts.reduce((sum, p) => sum + ((p.likes_count || 0) + (p.retweets_count || 0) + (p.replies_count || 0)), 0) / hourPosts.length
            : 0;
          return [hour, avgEngagement];
        })
      )
    };
  }
}`;

    fs.writeFileSync(
        path.join(process.cwd(), 'src/utils/intelligentTimingOptimizer.ts'),
        optimizerContent
    );
    
    console.log('✅ Intelligent Timing Optimizer created');
}

function main() {
    console.log('🧠 === ADAPTIVE LEARNING SCHEDULE SYSTEM ===');
    console.log('==========================================');
    console.log('');
    console.log('📅 NEW POSTING SCHEDULE:');
    console.log('   📝 Posts: Every 30 minutes (6 AM - 11 PM)');
    console.log('   💬 Replies: Every 1.5 hours during active time');
    console.log('   👍 Likes: Every 3 hours (unchanged)');
    console.log('');
    console.log('🧠 ADAPTIVE INTELLIGENCE:');
    console.log('   • Learns optimal posting hours from engagement data');
    console.log('   • Adjusts frequency based on performance (20-45 min intervals)');
    console.log('   • Prioritizes high-engagement time windows');
    console.log('   • Optimizes reply timing for follower conversion');
    console.log('   • Adapts to weekday vs weekend patterns');
    console.log('');
    console.log('📊 LEARNING OPTIMIZATIONS:');
    console.log('   • High performance = more frequent posting');
    console.log('   • Low engagement hours = reduced activity');
    console.log('   • Peak windows = priority posting');
    console.log('   • Follower conversion data = reply timing optimization');
    console.log('');

    createAdaptiveLearningScheduler();
    updateMasterControllerWithAdaptiveSchedule();
    createIntelligentTimingOptimizer();

    console.log('');
    console.log('🎉 ADAPTIVE LEARNING SCHEDULE READY!');
    console.log('');
    console.log('📈 EXPECTED ACTIVITY LEVELS:');
    console.log('   📝 Posts: 30-34 per day (every 30 min, 17 hours active)');
    console.log('   💬 Replies: 11-12 per day (every 90 min)');
    console.log('   👍 Likes: 6-8 per day (strategic timing)');
    console.log('');
    console.log('🎯 ADAPTIVE OPTIMIZATION:');
    console.log('   • System learns from each interaction');
    console.log('   • Frequency adapts based on success rate');
    console.log('   • Timing optimizes for maximum engagement');
    console.log('   • Quality gates ensure only excellent content');
    console.log('');
    console.log('🚀 Much more data = much faster learning!');
}

if (require.main === module) {
    main();
} 