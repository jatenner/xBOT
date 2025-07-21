import { supabaseClient } from '../utils/supabaseClient';
import { unifiedPostingCoordinator } from '../utils/unifiedPostingCoordinator';

/**
 * 🧠 INTELLIGENT POSTING OPTIMIZER AGENT
 * 
 * Continuously learns from engagement data to optimize:
 * - Posting frequency (dynamic daily limits)
 * - Optimal posting times
 * - Content performance patterns
 * - Audience engagement cycles
 * 
 * This replaces static limits with AI-driven decisions
 */
export class IntelligentPostingOptimizerAgent {
  private static instance: IntelligentPostingOptimizerAgent;
  private learningActive = false;
  private currentOptimalFrequency = 8; // Starting point
  private optimalTimes: number[] = [9, 11, 14, 16, 17, 19, 20];
  private performanceMetrics: PerformanceMetrics[] = [];
  private lastOptimization = new Date();

  // Learning parameters
  private readonly MIN_POSTS_PER_DAY = 4;
  private readonly MAX_POSTS_PER_DAY = 15; // Twitter limit is 17, but we leave buffer
  private readonly LEARNING_WINDOW_DAYS = 7;
  private readonly MINIMUM_DATA_POINTS = 20;

  private constructor() {}

  static getInstance(): IntelligentPostingOptimizerAgent {
    if (!IntelligentPostingOptimizerAgent.instance) {
      IntelligentPostingOptimizerAgent.instance = new IntelligentPostingOptimizerAgent();
    }
    return IntelligentPostingOptimizerAgent.instance;
  }

  /**
   * 🚀 START CONTINUOUS LEARNING
   */
  async startContinuousLearning(): Promise<void> {
    if (this.learningActive) {
      console.log('🧠 Intelligent Posting Optimizer already active');
      return;
    }

    console.log('🧠 === STARTING INTELLIGENT POSTING OPTIMIZER ===');
    console.log('📊 Continuous learning from engagement data');
    console.log('🎯 Dynamic optimization of posting frequency and timing');
    console.log('📈 AI-driven decisions replace static limits');
    console.log('');

    this.learningActive = true;

    // Load historical performance data
    await this.loadPerformanceHistory();

    // Start continuous optimization cycles
    this.startOptimizationCycles();

    console.log('✅ Intelligent Posting Optimizer active');
    console.log(`📊 Current optimal frequency: ${this.currentOptimalFrequency} posts/day`);
    console.log(`⏰ Current optimal times: ${this.optimalTimes.join(', ')}`);
  }

  /**
   * 📊 GET CURRENT OPTIMAL SETTINGS
   */
  getCurrentOptimalSettings(): OptimalSettings {
    return {
      dailyPostLimit: this.currentOptimalFrequency,
      optimalHours: this.optimalTimes,
      minimumSpacing: this.calculateOptimalSpacing(),
      confidence: this.calculateConfidence(),
      lastOptimized: this.lastOptimization,
      dataPoints: this.performanceMetrics.length
    };
  }

  /**
   * 🔄 MAIN OPTIMIZATION CYCLE
   */
  private startOptimizationCycles(): void {
    // Hourly engagement analysis
    setInterval(async () => {
      await this.collectRealtimeEngagement();
    }, 60 * 60 * 1000); // Every hour

    // Daily optimization cycle  
    setInterval(async () => {
      await this.runDailyOptimization();
    }, 24 * 60 * 60 * 1000); // Every 24 hours

    // Weekly deep learning cycle
    setInterval(async () => {
      await this.runWeeklyDeepLearning();
    }, 7 * 24 * 60 * 60 * 1000); // Every week
  }

  /**
   * 📈 COLLECT REALTIME ENGAGEMENT DATA
   */
  private async collectRealtimeEngagement(): Promise<void> {
    try {
      console.log('📊 Collecting realtime engagement data...');

      // Get recent tweets with engagement data
      const { data: recentTweets } = await supabaseClient.supabase
        ?.from('tweets')
        .select('*')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false }) || { data: [] };

      if (recentTweets && recentTweets.length > 0) {
        for (const tweet of recentTweets) {
          const metrics: PerformanceMetrics = {
            timestamp: new Date(tweet.created_at),
            hour: new Date(tweet.created_at).getHours(),
            dayOfWeek: new Date(tweet.created_at).getDay(),
            engagementRate: this.calculateEngagementRate(tweet),
            likes: tweet.likes || 0,
            retweets: tweet.retweets || 0,
            replies: tweet.replies || 0,
            impressions: tweet.impressions || 0,
            contentType: tweet.content_type || 'unknown',
            viralScore: this.calculateViralScore(tweet)
          };

          this.performanceMetrics.push(metrics);
        }

        // Keep only recent data (rolling window)
        const cutoffDate = new Date(Date.now() - this.LEARNING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
        this.performanceMetrics = this.performanceMetrics.filter(m => m.timestamp > cutoffDate);

        console.log(`📊 Collected ${recentTweets.length} new data points`);
        console.log(`🗄️ Total metrics: ${this.performanceMetrics.length}`);
      }

    } catch (error) {
      console.error('❌ Failed to collect engagement data:', error);
    }
  }

  /**
   * 🎯 RUN DAILY OPTIMIZATION
   */
  private async runDailyOptimization(): Promise<void> {
    try {
      console.log('🎯 === DAILY POSTING OPTIMIZATION ===');

      if (this.performanceMetrics.length < this.MINIMUM_DATA_POINTS) {
        console.log(`📊 Insufficient data: ${this.performanceMetrics.length}/${this.MINIMUM_DATA_POINTS} points`);
        return;
      }

      // 1. Analyze optimal posting frequency
      const optimalFrequency = await this.analyzeOptimalFrequency();
      
      // 2. Analyze optimal posting times
      const optimalTimes = await this.analyzeOptimalTimes();

      // 3. Update settings if significant improvement detected
      await this.updateOptimalSettings(optimalFrequency, optimalTimes);

      this.lastOptimization = new Date();
      console.log('✅ Daily optimization complete');

    } catch (error) {
      console.error('❌ Daily optimization failed:', error);
    }
  }

  /**
   * 📊 ANALYZE OPTIMAL POSTING FREQUENCY
   */
  private async analyzeOptimalFrequency(): Promise<number> {
    console.log('📊 Analyzing optimal posting frequency...');

    // Group metrics by day and calculate daily performance
    const dailyPerformance = new Map<string, DailyMetrics>();

    for (const metric of this.performanceMetrics) {
      const dateKey = metric.timestamp.toISOString().split('T')[0];
      
      if (!dailyPerformance.has(dateKey)) {
        dailyPerformance.set(dateKey, {
          date: dateKey,
          postCount: 0,
          totalEngagement: 0,
          avgEngagementRate: 0,
          totalViralScore: 0
        });
      }

      const daily = dailyPerformance.get(dateKey)!;
      daily.postCount++;
      daily.totalEngagement += metric.engagementRate;
      daily.totalViralScore += metric.viralScore;
    }

    // Calculate average engagement per post count
    const frequencyPerformance = new Map<number, number>();

    for (const [date, metrics] of dailyPerformance) {
      metrics.avgEngagementRate = metrics.totalEngagement / metrics.postCount;
      
      if (!frequencyPerformance.has(metrics.postCount)) {
        frequencyPerformance.set(metrics.postCount, 0);
      }
      
      const current = frequencyPerformance.get(metrics.postCount)!;
      frequencyPerformance.set(metrics.postCount, current + metrics.avgEngagementRate);
    }

    // Find frequency with highest average engagement
    let bestFrequency = this.currentOptimalFrequency;
    let bestPerformance = 0;

    for (const [frequency, totalPerformance] of frequencyPerformance) {
      const avgPerformance = totalPerformance / frequency;
      console.log(`   📊 ${frequency} posts/day: ${avgPerformance.toFixed(2)} avg engagement`);
      
      if (avgPerformance > bestPerformance && frequency >= this.MIN_POSTS_PER_DAY && frequency <= this.MAX_POSTS_PER_DAY) {
        bestPerformance = avgPerformance;
        bestFrequency = frequency;
      }
    }

    console.log(`🎯 Optimal frequency: ${bestFrequency} posts/day (${bestPerformance.toFixed(2)} engagement)`);
    return bestFrequency;
  }

  /**
   * ⏰ ANALYZE OPTIMAL POSTING TIMES  
   */
  private async analyzeOptimalTimes(): Promise<number[]> {
    console.log('⏰ Analyzing optimal posting times...');

    // Group metrics by hour and calculate performance
    const hourlyPerformance = new Map<number, HourlyMetrics>();

    for (let hour = 0; hour < 24; hour++) {
      hourlyPerformance.set(hour, {
        hour,
        postCount: 0,
        totalEngagement: 0,
        avgEngagementRate: 0,
        avgViralScore: 0
      });
    }

    for (const metric of this.performanceMetrics) {
      const hourMetrics = hourlyPerformance.get(metric.hour)!;
      hourMetrics.postCount++;
      hourMetrics.totalEngagement += metric.engagementRate;
      hourMetrics.avgViralScore += metric.viralScore;
    }

    // Calculate averages and sort by performance
    const hourlyResults: HourlyResult[] = [];

    for (const [hour, metrics] of hourlyPerformance) {
      if (metrics.postCount > 0) {
        metrics.avgEngagementRate = metrics.totalEngagement / metrics.postCount;
        metrics.avgViralScore = metrics.avgViralScore / metrics.postCount;
        
        hourlyResults.push({
          hour,
          performance: metrics.avgEngagementRate + (metrics.avgViralScore * 0.1), // Weight viral score
          postCount: metrics.postCount,
          engagement: metrics.avgEngagementRate
        });
      }
    }

    // Sort by performance and take top performers
    hourlyResults.sort((a, b) => b.performance - a.performance);
    
    const topHours = hourlyResults
      .filter(result => result.postCount >= 2) // Require minimum data
      .slice(0, Math.min(8, hourlyResults.length)) // Top 8 hours max
      .map(result => result.hour)
      .sort((a, b) => a - b); // Sort chronologically

    console.log('⏰ Hourly performance analysis:');
    hourlyResults.slice(0, 10).forEach(result => {
      console.log(`   ${result.hour}:00 - Performance: ${result.performance.toFixed(2)} (${result.postCount} posts)`);
    });

    console.log(`🎯 Optimal hours: ${topHours.join(', ')}`);
    return topHours.length > 0 ? topHours : this.optimalTimes; // Fallback to current if insufficient data
  }

  /**
   * 🔧 UPDATE OPTIMAL SETTINGS
   */
  private async updateOptimalSettings(newFrequency: number, newTimes: number[]): Promise<void> {
    const frequencyChanged = newFrequency !== this.currentOptimalFrequency;
    const timesChanged = JSON.stringify(newTimes) !== JSON.stringify(this.optimalTimes);

    if (frequencyChanged || timesChanged) {
      console.log('🔧 === UPDATING OPTIMAL SETTINGS ===');
      
      if (frequencyChanged) {
        console.log(`📊 Frequency: ${this.currentOptimalFrequency} → ${newFrequency} posts/day`);
        this.currentOptimalFrequency = newFrequency;
        
        // Update unified coordinator with new limit
        // Note: We'll need to add this method to the coordinator
        console.log('🔧 Updating unified coordinator with new frequency...');
      }

      if (timesChanged) {
        console.log(`⏰ Times: [${this.optimalTimes.join(', ')}] → [${newTimes.join(', ')}]`);
        this.optimalTimes = newTimes;
      }

      // Store new settings in database
      await this.storeOptimalSettings();
      
      console.log('✅ Optimal settings updated');
    } else {
      console.log('📊 Current settings remain optimal');
    }
  }

  /**
   * 🧠 RUN WEEKLY DEEP LEARNING
   */
  private async runWeeklyDeepLearning(): Promise<void> {
    try {
      console.log('🧠 === WEEKLY DEEP LEARNING ANALYSIS ===');

      // Deep analysis of patterns
      await this.analyzeContentTypePerformance();
      await this.analyzeEngagementTrends();
      await this.analyzeDayOfWeekPatterns();
      await this.optimizeSpacingStrategy();

      console.log('✅ Weekly deep learning complete');

    } catch (error) {
      console.error('❌ Weekly deep learning failed:', error);
    }
  }

  /**
   * 📝 ANALYZE CONTENT TYPE PERFORMANCE
   */
  private async analyzeContentTypePerformance(): Promise<void> {
    console.log('📝 Analyzing content type performance...');

    const contentPerformance = new Map<string, ContentTypeMetrics>();

    for (const metric of this.performanceMetrics) {
      const type = metric.contentType;
      
      if (!contentPerformance.has(type)) {
        contentPerformance.set(type, {
          type,
          count: 0,
          totalEngagement: 0,
          avgEngagement: 0,
          totalViralScore: 0,
          avgViralScore: 0
        });
      }

      const typeMetrics = contentPerformance.get(type)!;
      typeMetrics.count++;
      typeMetrics.totalEngagement += metric.engagementRate;
      typeMetrics.totalViralScore += metric.viralScore;
    }

    // Calculate averages and log insights
    console.log('📊 Content type performance:');
    for (const [type, metrics] of contentPerformance) {
      metrics.avgEngagement = metrics.totalEngagement / metrics.count;
      metrics.avgViralScore = metrics.totalViralScore / metrics.count;
      
      console.log(`   ${type}: ${metrics.avgEngagement.toFixed(2)} engagement, ${metrics.avgViralScore.toFixed(2)} viral (${metrics.count} posts)`);
    }
  }

  /**
   * 🛠️ HELPER METHODS
   */
  private calculateEngagementRate(tweet: any): number {
    const totalEngagement = (tweet.likes || 0) + (tweet.retweets || 0) + (tweet.replies || 0);
    const impressions = tweet.impressions || 1;
    return (totalEngagement / impressions) * 100;
  }

  private calculateViralScore(tweet: any): number {
    const likes = tweet.likes || 0;
    const retweets = tweet.retweets || 0;
    const replies = tweet.replies || 0;
    
    // Weighted viral score (retweets are most important for virality)
    return (retweets * 3) + (likes * 1) + (replies * 2);
  }

  private calculateOptimalSpacing(): number {
    // Dynamic spacing based on frequency
    const hoursInDay = 24;
    const optimalHours = this.optimalTimes.length;
    return Math.max(90, Math.floor((hoursInDay * 60) / this.currentOptimalFrequency)); // At least 90 minutes
  }

  private calculateConfidence(): number {
    if (this.performanceMetrics.length < this.MINIMUM_DATA_POINTS) {
      return this.performanceMetrics.length / this.MINIMUM_DATA_POINTS;
    }
    
    const recentData = this.performanceMetrics.filter(
      m => m.timestamp > new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    );
    
    return Math.min(1.0, recentData.length / 10); // High confidence with 10+ recent data points
  }

  private async storeOptimalSettings(): Promise<void> {
    try {
      const settings = {
        dailyPostLimit: this.currentOptimalFrequency,
        optimalHours: this.optimalTimes,
        minimumSpacing: this.calculateOptimalSpacing(),
        lastOptimized: this.lastOptimization.toISOString(),
        confidence: this.calculateConfidence()
      };

      await supabaseClient.supabase
        ?.from('bot_config')
        .upsert({
          key: 'intelligent_posting_optimizer_settings',
          value: settings
        }, { onConflict: 'key' });

    } catch (error) {
      console.error('❌ Failed to store optimal settings:', error);
    }
  }

  private async loadPerformanceHistory(): Promise<void> {
    // Implementation for loading historical data
    console.log('📚 Loading performance history...');
    // This would load from the database
  }

  private async analyzeEngagementTrends(): Promise<void> {
    console.log('📈 Analyzing engagement trends...');
    // Implementation for trend analysis
  }

  private async analyzeDayOfWeekPatterns(): Promise<void> {
    console.log('📅 Analyzing day-of-week patterns...');
    // Implementation for weekly pattern analysis
  }

  private async optimizeSpacingStrategy(): Promise<void> {
    console.log('⏰ Optimizing spacing strategy...');
    // Implementation for spacing optimization
  }

  private getTimeToNextOptimalWindow(currentHour: number): number {
    // Find next optimal hour
    const nextHour = this.optimalTimes.find(hour => hour > currentHour);
    return nextHour ? (nextHour - currentHour) * 60 : ((24 - currentHour + this.optimalTimes[0]) * 60);
  }
}

// Types
interface PerformanceMetrics {
  timestamp: Date;
  hour: number;
  dayOfWeek: number;
  engagementRate: number;
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  contentType: string;
  viralScore: number;
}

interface OptimalSettings {
  dailyPostLimit: number;
  optimalHours: number[];
  minimumSpacing: number;
  confidence: number;
  lastOptimized: Date;
  dataPoints: number;
}

interface DailyMetrics {
  date: string;
  postCount: number;
  totalEngagement: number;
  avgEngagementRate: number;
  totalViralScore: number;
}

interface HourlyMetrics {
  hour: number;
  postCount: number;
  totalEngagement: number;
  avgEngagementRate: number;
  avgViralScore: number;
}

interface HourlyResult {
  hour: number;
  performance: number;
  postCount: number;
  engagement: number;
}

interface ContentTypeMetrics {
  type: string;
  count: number;
  totalEngagement: number;
  avgEngagement: number;
  totalViralScore: number;
  avgViralScore: number;
}

// Export singleton instance
export const intelligentPostingOptimizer = IntelligentPostingOptimizerAgent.getInstance(); 