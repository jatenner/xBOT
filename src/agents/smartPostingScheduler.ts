/**
 * 🧠 SMART POSTING SCHEDULER
 * 
 * Intelligent timing and decision-making for posting
 * - Uses the intelligent posting decision agent
 * - Adapts schedule based on performance
 * - Thinks strategically about spacing and timing
 * - Prevents mindless rapid-fire posting
 */

import * as cron from 'node-cron';
import { PostTweetAgent } from './postTweet';
import { intelligentPostingDecision, PostingDecision } from './intelligentPostingDecisionAgent';
import { supabaseClient } from '../utils/supabaseClient';

interface ScheduleEntry {
  time: string; // cron format
  description: string;
  priority: 'high' | 'medium' | 'low';
  enabled: boolean;
}

interface DayStats {
  postsPlanned: number;
  postsCompleted: number;
  lastPostTime?: Date;
  averageEngagement: number;
  bestPerformingHour: number;
}

export class SmartPostingScheduler {
  private postAgent: PostTweetAgent;
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();
  private isRunning = false;
  private lastDecision: PostingDecision | null = null;
  private dayStats: DayStats = {
    postsPlanned: 0,
    postsCompleted: 0,
    averageEngagement: 0,
    bestPerformingHour: 14
  };

  // Intelligent schedule that adapts to performance
  private baseSchedule: ScheduleEntry[] = [
    { time: '0 9 * * *', description: 'Morning engagement window', priority: 'high', enabled: true },
    { time: '0 11 * * *', description: 'Late morning opportunity', priority: 'medium', enabled: true },
    { time: '0 14 * * *', description: 'Peak engagement window', priority: 'high', enabled: true },
    { time: '30 15 * * *', description: 'Afternoon opportunity', priority: 'medium', enabled: true },
    { time: '0 17 * * *', description: 'End of day engagement', priority: 'medium', enabled: true },
    { time: '0 19 * * *', description: 'Evening audience', priority: 'high', enabled: true },
    { time: '30 20 * * *', description: 'Late evening opportunity', priority: 'low', enabled: false }
  ];

  constructor() {
    this.postAgent = new PostTweetAgent();
    console.log('🧠 Smart Posting Scheduler initialized with intelligent decision-making');
  }

  /**
   * 🚀 START INTELLIGENT SCHEDULING
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Smart scheduler already running');
      return;
    }

    console.log('🧠 === STARTING SMART POSTING SCHEDULER ===');
    this.isRunning = true;

    // Initialize daily stats
    await this.loadDayStats();

    // Set up adaptive schedule
    await this.createAdaptiveSchedule();

    // Set up decision review cycle (every 30 minutes)
    this.scheduledJobs.set('decision-review', cron.schedule('*/30 * * * *', async () => {
      await this.reviewPostingDecision();
    }));

    // Set up daily stats update (every hour)
    this.scheduledJobs.set('stats-update', cron.schedule('0 * * * *', async () => {
      await this.updateDayStats();
    }));

    // Set up weekly schedule optimization (Sundays at midnight)
    this.scheduledJobs.set('weekly-optimization', cron.schedule('0 0 * * 0', async () => {
      await this.optimizeWeeklySchedule();
    }));

    console.log('✅ Smart scheduler started with intelligent decision-making');
    console.log(`📊 Today's target: ${this.dayStats.postsPlanned} posts`);
    console.log(`🎯 Completed: ${this.dayStats.postsCompleted} posts`);
  }

  /**
   * 🛑 STOP SCHEDULER
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log('🛑 Stopping smart posting scheduler...');
    
    for (const [name, job] of this.scheduledJobs) {
      job.stop();
      console.log(`⏹️ Stopped job: ${name}`);
    }
    
    this.scheduledJobs.clear();
    this.isRunning = false;
    
    console.log('✅ Smart scheduler stopped');
  }

  /**
   * 🎯 REVIEW POSTING DECISION
   */
  private async reviewPostingDecision(): Promise<void> {
    try {
      console.log('🧠 === INTELLIGENT POSTING DECISION REVIEW ===');
      
      const decision = await intelligentPostingDecision.makePostingDecision();
      this.lastDecision = decision;
      
      if (decision.shouldPost) {
        console.log(`🎯 DECISION: POST NOW`);
        console.log(`📊 Strategy: ${decision.strategy}`);
        console.log(`🎯 Confidence: ${Math.round(decision.confidence * 100)}%`);
        console.log(`💭 Reason: ${decision.reason}`);
        
        if (decision.contentGuidance) {
          console.log(`💡 Content type: ${decision.contentGuidance.type}`);
          console.log(`👥 Target: ${decision.contentGuidance.targetAudience}`);
        }
        
        // Execute posting
        const result = await this.executeIntelligentPost(decision);
        
        if (result.success) {
          await this.updatePostSuccess(decision);
        } else {
          await this.updatePostFailure(decision, result.error);
        }
      } else {
        console.log(`⏳ DECISION: WAIT`);
        console.log(`📊 Strategy: ${decision.strategy}`);
        console.log(`💭 Reason: ${decision.reason}`);
        
        if (decision.waitTime) {
          console.log(`⏰ Wait time: ${decision.waitTime} minutes`);
        }
        
        console.log(`🔄 Next review: ${decision.nextDecisionTime.toLocaleString()}`);
      }
      
    } catch (error) {
      console.error('❌ Error in posting decision review:', error);
    }
  }

  /**
   * 📤 EXECUTE INTELLIGENT POST
   */
  private async executeIntelligentPost(decision: PostingDecision): Promise<any> {
    try {
      console.log('📤 Executing intelligent post...');
      
      // Post with decision context
      const result = await this.postAgent.run(false, false);
      
      if (result.success) {
        console.log('✅ Post executed successfully');
        
        // Record decision effectiveness
        await this.recordDecisionOutcome(decision, true, result);
        
        // Update day stats
        this.dayStats.postsCompleted += 1;
        this.dayStats.lastPostTime = new Date();
        
        // Save stats to database
        await this.saveDayStats();
        
      } else {
        console.log(`❌ Post failed: ${result.reason || result.error}`);
        await this.recordDecisionOutcome(decision, false, result);
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Error executing post:', error);
      await this.recordDecisionOutcome(decision, false, { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * 📊 CREATE ADAPTIVE SCHEDULE
   */
  private async createAdaptiveSchedule(): Promise<void> {
    console.log('📊 Creating adaptive posting schedule...');
    
    // Get recent performance data
    const performanceData = await this.getRecentPerformance();
    
    // Adjust schedule based on performance
    const adaptedSchedule = this.adaptScheduleToPerformance(performanceData);
    
    // Create cron jobs for each schedule entry
    for (const entry of adaptedSchedule) {
      if (entry.enabled) {
        const jobName = `scheduled-${entry.description.replace(/\s+/g, '-').toLowerCase()}`;
        
        const job = cron.schedule(entry.time, async () => {
          console.log(`⏰ Scheduled check: ${entry.description}`);
          await this.reviewPostingDecision();
        });
        
        this.scheduledJobs.set(jobName, job);
        console.log(`✅ Scheduled: ${entry.description} (${entry.time})`);
      } else {
        console.log(`⏸️ Disabled: ${entry.description}`);
      }
    }
    
    console.log(`📅 Created ${this.scheduledJobs.size - 3} intelligent posting checkpoints`); // -3 for non-posting jobs
  }

  /**
   * 📈 ADAPT SCHEDULE TO PERFORMANCE
   */
  private adaptScheduleToPerformance(performanceData: any): ScheduleEntry[] {
    const adapted = [...this.baseSchedule];
    
    // Enable more opportunities if performing well
    if (performanceData.avgEngagement > 20) {
      console.log('📈 High performance detected - enabling more posting opportunities');
      adapted.forEach(entry => {
        if (entry.priority === 'medium' || entry.priority === 'low') {
          entry.enabled = true;
        }
      });
    }
    
    // Be more conservative if performing poorly
    else if (performanceData.avgEngagement < 5) {
      console.log('📉 Low performance detected - reducing posting frequency');
      adapted.forEach(entry => {
        if (entry.priority === 'low') {
          entry.enabled = false;
        }
      });
    }
    
    // Adjust for best performing hour
    if (performanceData.bestHour !== undefined) {
      const bestHourEntry = adapted.find(entry => 
        entry.time.includes(`${performanceData.bestHour} `) || 
        entry.time.includes(` ${performanceData.bestHour} `)
      );
      
      if (bestHourEntry) {
        bestHourEntry.priority = 'high';
        bestHourEntry.enabled = true;
        console.log(`🎯 Prioritized ${performanceData.bestHour}:00 based on performance`);
      }
    }
    
    return adapted;
  }

  /**
   * 📊 LOAD DAY STATS
   */
  private async loadDayStats(): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get today's posts
      const { data: todaysPosts } = await supabaseClient.supabase
        ?.from('tweets')
        .select('*')
        .gte('created_at', today + 'T00:00:00')
        .order('created_at', { ascending: false }) || { data: [] };
      
      const posts = todaysPosts || [];
      
      this.dayStats = {
        postsPlanned: 12, // Base target
        postsCompleted: posts.length,
        lastPostTime: posts.length > 0 ? new Date(posts[0].created_at) : undefined,
        averageEngagement: posts.length > 0 
          ? posts.reduce((sum, post) => sum + (post.likes + post.retweets + post.replies), 0) / posts.length
          : 0,
        bestPerformingHour: posts.length > 0
          ? this.findBestHour(posts)
          : 14 // Default to 2 PM
      };
      
      console.log('📊 Day stats loaded:');
      console.log(`   📝 Posts completed: ${this.dayStats.postsCompleted}/${this.dayStats.postsPlanned}`);
      console.log(`   📈 Avg engagement: ${this.dayStats.averageEngagement.toFixed(1)}`);
      console.log(`   🎯 Best hour: ${this.dayStats.bestPerformingHour}:00`);
      
    } catch (error) {
      console.error('❌ Error loading day stats:', error);
      // Use defaults
      this.dayStats = {
        postsPlanned: 12,
        postsCompleted: 0,
        averageEngagement: 0,
        bestPerformingHour: 14
      };
    }
  }

  /**
   * 💾 SAVE DAY STATS
   */
  private async saveDayStats(): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      await supabaseClient.supabase
        ?.from('bot_config')
        .upsert({
          key: `day_stats_${today}`,
          value: JSON.stringify(this.dayStats)
        });
        
    } catch (error) {
      console.warn('⚠️ Could not save day stats:', error);
    }
  }

  /**
   * 🔄 UPDATE DAY STATS
   */
  private async updateDayStats(): Promise<void> {
    await this.loadDayStats();
    console.log(`📊 Stats updated: ${this.dayStats.postsCompleted}/${this.dayStats.postsPlanned} posts today`);
  }

  /**
   * 📈 GET RECENT PERFORMANCE
   */
  private async getRecentPerformance(): Promise<any> {
    try {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const { data: recentPosts } = await supabaseClient.supabase
        ?.from('tweets')
        .select('*')
        .gte('created_at', weekAgo.toISOString())
        .order('created_at', { ascending: false }) || { data: [] };
      
      const posts = recentPosts || [];
      
      const avgEngagement = posts.length > 0 
        ? posts.reduce((sum, post) => sum + (post.likes + post.retweets + post.replies), 0) / posts.length
        : 10;
      
      const bestHour = this.findBestHour(posts);
      
      return {
        avgEngagement,
        bestHour,
        totalPosts: posts.length,
        trend: this.calculateTrend(posts)
      };
      
    } catch (error) {
      console.error('❌ Error getting performance data:', error);
      return { avgEngagement: 10, bestHour: 14, totalPosts: 0, trend: 'stable' };
    }
  }

  /**
   * 🕐 FIND BEST PERFORMING HOUR
   */
  private findBestHour(posts: any[]): number {
    if (posts.length === 0) return 14;
    
    const hourPerformance = new Map<number, number[]>();
    
    posts.forEach(post => {
      const hour = new Date(post.created_at).getHours();
      const engagement = post.likes + post.retweets + post.replies;
      
      if (!hourPerformance.has(hour)) hourPerformance.set(hour, []);
      hourPerformance.get(hour)!.push(engagement);
    });
    
    let bestHour = 14;
    let bestAvg = 0;
    
    hourPerformance.forEach((engagements, hour) => {
      const avg = engagements.reduce((sum, e) => sum + e, 0) / engagements.length;
      if (avg > bestAvg) {
        bestAvg = avg;
        bestHour = hour;
      }
    });
    
    return bestHour;
  }

  /**
   * 📊 CALCULATE TREND
   */
  private calculateTrend(posts: any[]): 'improving' | 'declining' | 'stable' {
    if (posts.length < 6) return 'stable';
    
    const recent = posts.slice(0, 3);
    const older = posts.slice(3, 6);
    
    const recentAvg = recent.reduce((sum, post) => sum + (post.likes + post.retweets + post.replies), 0) / recent.length;
    const olderAvg = older.reduce((sum, post) => sum + (post.likes + post.retweets + post.replies), 0) / older.length;
    
    if (recentAvg > olderAvg * 1.2) return 'improving';
    if (recentAvg < olderAvg * 0.8) return 'declining';
    return 'stable';
  }

  /**
   * 📝 RECORD DECISION OUTCOME
   */
  private async recordDecisionOutcome(decision: PostingDecision, success: boolean, result: any): Promise<void> {
    try {
      await supabaseClient.supabase
        ?.from('decision_outcomes')
        .insert({
          decision_strategy: decision.strategy,
          decision_reason: decision.reason,
          decision_confidence: decision.confidence,
          success,
          result_data: JSON.stringify(result),
          expected_likes: decision.performanceExpectation.expectedLikes,
          expected_viral_potential: decision.performanceExpectation.viralPotential,
          content_guidance: decision.contentGuidance ? JSON.stringify(decision.contentGuidance) : null
        });
        
      console.log(`📝 Recorded decision outcome: ${success ? 'SUCCESS' : 'FAILURE'}`);
      
    } catch (error) {
      console.warn('⚠️ Could not record decision outcome:', error);
    }
  }

  /**
   * ✅ UPDATE POST SUCCESS
   */
  private async updatePostSuccess(decision: PostingDecision): Promise<void> {
    console.log('✅ Post successful - updating metrics');
    // Could trigger learning updates here
  }

  /**
   * ❌ UPDATE POST FAILURE
   */
  private async updatePostFailure(decision: PostingDecision, error?: string): Promise<void> {
    console.log(`❌ Post failed: ${error}`);
    // Could adjust strategy here
  }

  /**
   * 🔄 OPTIMIZE WEEKLY SCHEDULE
   */
  private async optimizeWeeklySchedule(): Promise<void> {
    console.log('🔄 === WEEKLY SCHEDULE OPTIMIZATION ===');
    
    const performanceData = await this.getRecentPerformance();
    
    console.log(`📊 Weekly performance: ${performanceData.avgEngagement.toFixed(1)} avg engagement`);
    console.log(`📈 Trend: ${performanceData.trend}`);
    console.log(`🎯 Best hour: ${performanceData.bestHour}:00`);
    
    // Recreate adaptive schedule
    await this.stop();
    await this.start();
    
    console.log('✅ Weekly optimization complete');
  }

  /**
   * 📊 GET SCHEDULER STATUS
   */
  getStatus(): {
    isRunning: boolean;
    activeJobs: number;
    lastDecision: PostingDecision | null;
    dayStats: DayStats;
  } {
    return {
      isRunning: this.isRunning,
      activeJobs: this.scheduledJobs.size,
      lastDecision: this.lastDecision,
      dayStats: this.dayStats
    };
  }

  /**
   * 🎯 FORCE DECISION REVIEW (for testing)
   */
  async forceDecisionReview(): Promise<PostingDecision> {
    const decision = await intelligentPostingDecision.makePostingDecision();
    this.lastDecision = decision;
    console.log('🎯 Forced decision review completed');
    return decision;
  }
}

export const smartPostingScheduler = new SmartPostingScheduler(); 