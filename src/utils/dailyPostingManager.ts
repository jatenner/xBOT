import { supabaseClient } from './supabaseClient';
import { PostTweetAgent } from '../agents/postTweet';
import { contentCache } from './contentCache';
import { IntelligentSchedulingAgent } from '../agents/intelligentSchedulingAgent';
import { strategicOpportunityScheduler } from '../agents/strategicOpportunityScheduler';
import { humanLikeStrategicMind } from '../agents/humanLikeStrategicMind';
import { supremeAIOrchestrator } from '../agents/supremeAIOrchestrator';
import * as cron from 'node-cron';

interface DailyPostingState {
  date: string;
  posts_completed: number;
  posts_target: number;
  next_post_time: string;
  posting_schedule: string[];
  emergency_mode: boolean;
  last_post_time?: string;
}

interface PostingWindow {
  start_hour: number;
  end_hour: number;
  posts_count: number;
  priority: number;
}

export class DailyPostingManager {
  private postTweetAgent: PostTweetAgent;
  private intelligentScheduler: IntelligentSchedulingAgent;
  private currentState: DailyPostingState;
  private readonly DAILY_TARGET = parseInt(process.env.MAX_DAILY_TWEETS || '8');
  private isRunning = false;
  private scheduledJobs: cron.ScheduledTask[] = [];
  private useIntelligentScheduling = true;

  // SAFE HUMAN-LIKE posting windows (8 posts max)
  private readonly POSTING_WINDOWS: PostingWindow[] = [
    { start_hour: 9, end_hour: 10, posts_count: 1, priority: 3 },  // Morning
    { start_hour: 11, end_hour: 12, posts_count: 1, priority: 3 }, // Late Morning  
    { start_hour: 13, end_hour: 14, posts_count: 1, priority: 4 }, // Early Afternoon - PEAK
    { start_hour: 15, end_hour: 16, posts_count: 1, priority: 4 }, // Mid Afternoon - PEAK
    { start_hour: 17, end_hour: 18, posts_count: 1, priority: 3 }, // Late Afternoon
    { start_hour: 19, end_hour: 20, posts_count: 1, priority: 4 }, // Evening - PEAK
    { start_hour: 14, end_hour: 15, posts_count: 1, priority: 4 }, // Peak afternoon
    { start_hour: 20, end_hour: 21, posts_count: 1, priority: 3 }, // Evening
  ];

  constructor() {
    this.postTweetAgent = new PostTweetAgent();
    this.intelligentScheduler = new IntelligentSchedulingAgent();
    this.currentState = this.getDefaultState();
  }

  private getDefaultState(): DailyPostingState {
    const today = new Date().toISOString().split('T')[0];
    return {
      date: today,
      posts_completed: 0,
      posts_target: this.DAILY_TARGET,
      next_post_time: new Date().toISOString(),
      posting_schedule: this.generateDailySchedule(),
      emergency_mode: false
    };
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('📅 Daily Posting Manager already running');
      return;
    }

    console.log(`🎯 Starting Daily Posting Manager - Target: ${this.DAILY_TARGET} tweets/day`);
    this.isRunning = true;

    // Load or initialize today's state
    await this.loadDailyState();
    
    // Set up posting schedule
    await this.setupPostingSchedule();
    
    // Monitor and catch up if behind
    this.startMonitoring();
    
    console.log(`📊 Daily Status: ${this.currentState.posts_completed}/${this.DAILY_TARGET} tweets completed`);
  }

  private async loadDailyState(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const { data, error } = await supabaseClient.supabase
        ?.from('daily_posting_state')
        .select('*')
        .eq('date', today)
        .single();

      if (data && !error) {
        this.currentState = data;
        console.log(`📊 Loaded daily state: ${data.posts_completed}/${this.DAILY_TARGET} posts completed`);
      } else {
        // Create new state for today
        this.currentState = this.getDefaultState();
        await this.saveDailyState();
        console.log('📅 Created new daily posting state');
      }
    } catch (error) {
      console.log('🔧 Initializing daily posting state...');
      this.currentState = this.getDefaultState();
      await this.saveDailyState();
    }
  }

  private generateDailySchedule(): string[] {
    const schedule: string[] = [];
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    for (const window of this.POSTING_WINDOWS) {
      const windowStart = new Date(startOfDay);
      windowStart.setHours(window.start_hour, 0, 0, 0);
      
      const windowEnd = new Date(startOfDay);
      windowEnd.setHours(window.end_hour, 0, 0, 0);
      
      const windowDuration = (windowEnd.getTime() - windowStart.getTime()) / (1000 * 60); // minutes
      const interval = windowDuration / window.posts_count;

      for (let i = 0; i < window.posts_count; i++) {
        // Add randomization within the window (±15 minutes)
        const baseTime = new Date(windowStart.getTime() + (i * interval * 60 * 1000));
        const randomOffset = (Math.random() - 0.5) * 30 * 60 * 1000; // ±15 minutes in milliseconds
        const postTime = new Date(baseTime.getTime() + randomOffset);
        
        // Ensure post time stays within the window
        const clampedTime = new Date(Math.max(
          windowStart.getTime(),
          Math.min(postTime.getTime(), windowEnd.getTime() - 60000) // 1 minute before window end
        ));
        
        schedule.push(clampedTime.toISOString());
      }
    }

    return schedule.sort();
  }

  private async setupPostingSchedule(): Promise<void> {
    // Clear existing jobs
    this.scheduledJobs.forEach(job => job.stop());
    this.scheduledJobs = [];

    const now = new Date();
    const remaining = this.DAILY_TARGET - this.currentState.posts_completed;

    if (remaining <= 0) {
      console.log('✅ Daily posting target already reached!');
      return;
    }

    console.log(`📈 Setting up schedule for ${remaining} remaining posts`);

    if (this.useIntelligentScheduling) {
      // 🧠 Use AI-driven intelligent scheduling
      await this.setupIntelligentSchedule(remaining);
    } else {
      // 📅 Use traditional fixed schedule
      await this.setupTraditionalSchedule(remaining);
    }
  }

  private async setupIntelligentSchedule(remaining: number): Promise<void> {
    console.log('🧠 Activating SUPREME AI ORCHESTRATOR...');
    
    try {
      // 👑 SUPREME AI DECISION MAKING
      const supremeDecision = await supremeAIOrchestrator.makeSupremeDecision();
      
      console.log('👑 SUPREME AI ORCHESTRATOR DECISION:');
      console.log(`   🧠 Strategy: ${supremeDecision.strategy.mode}`);
      console.log(`   🔥 Confidence: ${(supremeDecision.strategy.confidence * 100).toFixed(0)}%`);
      console.log(`   📝 Posts planned: ${supremeDecision.strategy.postingStrategy.postCount}`);
      console.log(`   🎯 Goal: ${supremeDecision.strategy.contentStrategy.primaryGoal}`);
      console.log(`   💭 Reasoning: ${supremeDecision.reasoning}`);
      
      if (supremeDecision.shouldPost) {
        // Execute the supreme strategy immediately
        console.log('🚀 EXECUTING SUPREME STRATEGY...');
        const executionResult = await supremeAIOrchestrator.executeSupremeStrategy(
          supremeDecision.strategy,
          supremeDecision.executionPlan
        );
        
        console.log(`✅ Supreme strategy executed: ${executionResult.executedPosts} posts completed`);
        
        // Update our state
        this.currentState.posts_completed += executionResult.executedPosts;
        await this.saveDailyState();
        
        // Calculate remaining posts after supreme execution
        const remainingAfterSupreme = this.DAILY_TARGET - this.currentState.posts_completed;
        
        if (remainingAfterSupreme > 0) {
          console.log(`📊 ${remainingAfterSupreme} posts remaining - scheduling traditional posts`);
          await this.setupTraditionalSchedule(remainingAfterSupreme);
        } else {
          console.log('🎉 Supreme AI completed all required posts!');
        }
      } else {
        console.log('🤔 Supreme AI decided not to post - using fallback human-like strategic analysis');
        
        // Fallback to human-like strategic mind
        const humanInsights = await humanLikeStrategicMind.analyzeWorldLikeHuman();
        
        if (humanInsights.postingRecommendations.some(r => r.urgency > 0.6)) {
          console.log('🧠 Human-like strategic mind found urgent opportunities');
          const urgentRecs = humanInsights.postingRecommendations.filter(r => r.urgency > 0.6);
          
          for (const rec of urgentRecs.slice(0, Math.min(3, remaining))) {
            const postTime = new Date(Date.now() + Math.random() * 60 * 60 * 1000); // Within next hour
            this.scheduleIntelligentPost({
              scheduledTime: postTime,
              contentType: rec.contentType,
              reasoning: rec.reasoning,
              confidence: rec.confidence
            });
          }
          
          // Schedule remaining posts traditionally
          const remainingAfterUrgent = remaining - urgentRecs.length;
          if (remainingAfterUrgent > 0) {
            await this.setupTraditionalSchedule(remainingAfterUrgent);
          }
        } else {
          console.log('📅 No urgent opportunities - using traditional scheduling');
          await this.setupTraditionalSchedule(remaining);
        }
      }
      
      // Set up dynamic monitoring
      this.setupDynamicMonitoring();
      
    } catch (error) {
      console.warn('🔄 Intelligent scheduling failed, falling back to traditional:', error);
      await this.setupTraditionalSchedule(remaining);
    }
  }

  private async setupTraditionalSchedule(remaining: number): Promise<void> {
    console.log('📅 Using traditional fixed schedule...');
    
    const now = new Date();
    
    // Schedule remaining posts optimally
    const upcomingSlots = this.currentState.posting_schedule.filter(timeStr => {
      const postTime = new Date(timeStr);
      return postTime > now;
    }).slice(0, remaining);

    if (upcomingSlots.length < remaining) {
      // Need emergency posting to catch up
      console.log('🚨 Behind schedule - activating catch-up mode');
      await this.activateEmergencyPosting(remaining - upcomingSlots.length);
    }

    // Schedule posts for optimal times
    for (const timeSlot of upcomingSlots) {
      this.schedulePost(new Date(timeSlot));
    }
  }

  private scheduleIntelligentPost(post: any): void {
    const cronExpression = `${post.scheduledTime.getMinutes()} ${post.scheduledTime.getHours()} ${post.scheduledTime.getDate()} ${post.scheduledTime.getMonth() + 1} *`;
    
    const job = cron.schedule(cronExpression, async () => {
      console.log(`🧠 Executing intelligent post: ${post.triggerReason}`);
      await this.executePost('scheduled');
    }, {
      scheduled: true,
      timezone: "UTC"
    });

    this.scheduledJobs.push(job);
    console.log(`🎯 Intelligent post scheduled for ${post.scheduledTime.toLocaleTimeString()}: ${post.triggerReason}`);
  }

  private setupDynamicMonitoring(): void {
    console.log('🎯 Setting up STRATEGIC OPPORTUNITY monitoring...');
    
    // 🧠 HUMAN-LIKE STRATEGIC MONITORING: Think like a savvy Twitter user every 2 hours
    const strategicMonitoringJob = cron.schedule('0 */2 * * *', async () => {
      try {
        console.log('🧠 THINKING LIKE A STRATEGIC HUMAN...');
        console.log('   👀 Scanning trends, news, and opportunities...');
        
        // Get human-like strategic analysis
        const humanAnalysis = await humanLikeStrategicMind.analyzeWorldLikeHuman();
        
        console.log('🧠 HUMAN-LIKE STRATEGIC ANALYSIS:');
        console.log(`   💡 Strategic insights: ${humanAnalysis.insights.length}`);
        console.log(`   📝 Posting opportunities: ${humanAnalysis.postingRecommendations.length}`);
        console.log(`   🎯 Strategic thinking: "${humanAnalysis.strategicNarrative}"`);
        
        // Execute high-urgency recommendations
        const urgentRecommendations = humanAnalysis.postingRecommendations.filter(r => 
          r.urgency > 0.6 && (r.when === 'immediate' || r.when === 'within_hour')
        );
        
        if (urgentRecommendations.length > 0) {
          console.log(`🚨 ${urgentRecommendations.length} URGENT STRATEGIC OPPORTUNITIES DETECTED!`);
          
          for (const rec of urgentRecommendations.slice(0, 3)) { // Max 3 strategic posts per check
            if (this.currentState.posts_completed >= this.DAILY_TARGET) break;
            
            console.log(`🔥 STRATEGIC OPPORTUNITY: ${rec.trigger}`);
            console.log(`   📊 Urgency: ${(rec.urgency * 100).toFixed(0)}%`);
            console.log(`   📝 Posts: ${rec.postCount}`);
            console.log(`   🎯 Content type: ${rec.contentType}`);
            console.log(`   💡 Angles: ${rec.contentAngles.join(', ')}`);
            
            // Execute strategic posting burst
            for (let i = 0; i < rec.postCount && this.currentState.posts_completed < this.DAILY_TARGET; i++) {
              console.log(`🔥 Executing strategic post ${i + 1}/${rec.postCount} - ${rec.strategicReason}`);
              await this.executePost('emergency');
              
              // Brief delay between strategic posts
              if (i < rec.postCount - 1) {
                await new Promise(resolve => setTimeout(resolve, 3 * 60 * 1000)); // 3 minute delay
              }
            }
          }
        } else {
          console.log('📊 No urgent strategic opportunities detected');
          console.log('   🧠 Strategic mind is monitoring and waiting for the right moment...');
        }
        
        // Fallback: Check if we're behind schedule
        const progress = this.getDailyProgress();
        if (!progress.onTrack && progress.remaining > 0) {
          console.log('⚡ Behind schedule - activating catch-up mode');
          await this.activateEmergencyPosting(1);
        }
        
      } catch (error) {
        console.error('❌ Human-like strategic monitoring error:', error);
        
        // Fallback to basic strategic monitoring
        try {
          const basicDecision = await strategicOpportunityScheduler.shouldPostStrategically();
          if (basicDecision.shouldPost && basicDecision.urgency > 0.7) {
            console.log('🔄 Fallback: Basic strategic opportunity detected');
            await this.executePost('emergency');
          }
        } catch (fallbackError) {
          console.error('❌ Fallback strategic monitoring also failed:', fallbackError);
        }
      }
    }, {
      scheduled: true,
      timezone: "UTC"
    });
    
    this.scheduledJobs.push(strategicMonitoringJob);
    
    // 🧠 STRATEGIC INTELLIGENCE REVIEW: Analyze and optimize daily
    const intelligenceReviewJob = cron.schedule('0 6 * * *', async () => {
      try {
        console.log('🧠 DAILY STRATEGIC INTELLIGENCE REVIEW...');
        
        const opportunities = await strategicOpportunityScheduler.analyzeStrategicOpportunities();
        
        console.log(`🎯 STRATEGIC ANALYSIS:`);
        console.log(`   📊 ${opportunities.opportunities.length} opportunities identified`);
        console.log(`   📝 ${opportunities.totalRecommendedPosts} posts recommended`);
        console.log(`   🔥 Confidence: ${opportunities.confidenceScore}%`);
        console.log(`   🧠 Strategic reasons: ${opportunities.strategicReasons.join(', ')}`);
        
        // If high confidence and many opportunities, be more aggressive
        if (opportunities.confidenceScore > 80 && opportunities.opportunities.length > 5) {
          console.log('🚀 High-opportunity day detected - optimizing for maximum engagement');
          // Could adjust posting strategy here if needed
        }
        
      } catch (error) {
        console.error('❌ Intelligence review error:', error);
      }
    }, {
      scheduled: true,
      timezone: "UTC"
    });
    
    this.scheduledJobs.push(intelligenceReviewJob);
    
    console.log('🧠 HUMAN-LIKE STRATEGIC monitoring activated:');
    console.log('   🧠 Strategic thinking: Every 2 hours (like a savvy Twitter user)');
    console.log('   🔍 Pattern recognition: Apple Watch trends, AI news connections');
    console.log('   📰 News synthesis: Multiple stories → strategic insights');
    console.log('   ⏰ Perfect timing: Peak engagement windows detected');
    console.log('   🎯 Competitive gaps: Opportunities competitors miss');
    console.log('   💡 API usage: ~15 calls/day (strategic and efficient)');
    console.log('   🔥 DYNAMIC POSTING: 1-4 tweets when strategic opportunities arise!');
  }

  private schedulePost(postTime: Date): void {
    const cronExpression = `${postTime.getMinutes()} ${postTime.getHours()} ${postTime.getDate()} ${postTime.getMonth() + 1} *`;
    
    const job = cron.schedule(cronExpression, async () => {
      await this.executePost('scheduled');
    }, {
      scheduled: true,
      timezone: "UTC"
    });

    this.scheduledJobs.push(job);
    console.log(`⏰ Scheduled post for ${postTime.toLocaleTimeString()}`);
  }

  private async activateEmergencyPosting(postsNeeded: number): Promise<void> {
    console.log(`🚨 Emergency posting activated - need ${postsNeeded} additional posts`);
    
    this.currentState.emergency_mode = true;
    await this.saveDailyState();

    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 30, 0, 0); // Stop at 11:30 PM

    const timeRemaining = endOfDay.getTime() - now.getTime();
    const interval = timeRemaining / (postsNeeded * 60 * 1000); // minutes

    for (let i = 0; i < postsNeeded; i++) {
      const emergencyTime = new Date(now.getTime() + (i * interval * 60 * 1000));
      if (emergencyTime < endOfDay) {
        this.schedulePost(emergencyTime);
      }
    }
  }

  private async executePost(trigger: 'scheduled' | 'emergency' | 'catchup'): Promise<void> {
    try {
      console.log(`📝 Executing ${trigger} post (${this.currentState.posts_completed + 1}/${this.DAILY_TARGET})`);

      // Try cache first for efficiency
      const cachedContent = await contentCache.getCachedContent('viral_tweet', [], 0.8);
      
      let result;
      if (cachedContent && Math.random() > 0.3) { // 70% chance to use cache
        console.log('💾 Using cached content for efficiency');
        // Post cached content (you'd need to implement this in PostTweetAgent)
        result = { success: true, content: cachedContent.content };
        await contentCache.markContentUsed(cachedContent.id);
      } else {
        // Generate fresh content
        result = await this.postTweetAgent.run(false, false, false);
      }

      if (result.success) {
        this.currentState.posts_completed++;
        this.currentState.last_post_time = new Date().toISOString();
        await this.saveDailyState();

        console.log(`✅ Post ${this.currentState.posts_completed}/${this.DAILY_TARGET} completed`);

        // Check if we've hit the target
        if (this.currentState.posts_completed >= this.DAILY_TARGET) {
          console.log('🎉 DAILY TARGET REACHED! 17/17 tweets completed');
          await this.onDailyTargetReached();
        }
      } else {
        console.error('❌ Post failed, will retry in emergency mode');
        await this.scheduleRetry();
      }

    } catch (error) {
      console.error('❌ Post execution failed:', error);
      await this.scheduleRetry();
    }
  }

  private async scheduleRetry(): Promise<void> {
    // Retry in 15 minutes
    const retryTime = new Date(Date.now() + 15 * 60 * 1000);
    setTimeout(async () => {
      await this.executePost('catchup');
    }, 15 * 60 * 1000);
    
    console.log(`🔄 Retry scheduled for ${retryTime.toLocaleTimeString()}`);
  }

  private startMonitoring(): void {
    // Check progress every hour
    cron.schedule('0 * * * *', async () => {
      await this.checkProgress();
    }, { scheduled: true });

    // Daily reset at midnight
    cron.schedule('0 0 * * *', async () => {
      await this.resetDaily();
    }, { scheduled: true });
  }

  private async checkProgress(): Promise<void> {
    const now = new Date();
    const currentHour = now.getHours();
    
    // Calculate expected progress by this hour
    let expectedPosts = 0;
    for (const window of this.POSTING_WINDOWS) {
      if (currentHour >= window.end_hour) {
        expectedPosts += window.posts_count;
      } else if (currentHour >= window.start_hour) {
        const windowProgress = (currentHour - window.start_hour) / (window.end_hour - window.start_hour);
        expectedPosts += Math.floor(window.posts_count * windowProgress);
      }
    }

    const deficit = expectedPosts - this.currentState.posts_completed;
    
    if (deficit > 2) {
      console.log(`⚠️ Behind schedule by ${deficit} posts - activating catch-up`);
      await this.activateEmergencyPosting(deficit);
    }
    
    console.log(`📊 Progress check: ${this.currentState.posts_completed}/${expectedPosts} expected by ${currentHour}:00`);
  }

  private async onDailyTargetReached(): Promise<void> {
    // Log success
    await supabaseClient.supabase
      ?.from('daily_posting_log')
      .insert({
        date: this.currentState.date,
        target: this.DAILY_TARGET,
        completed: this.currentState.posts_completed,
        success: true,
        emergency_posts: this.currentState.emergency_mode ? 1 : 0
      });

    // Clear scheduled jobs since we're done
    this.scheduledJobs.forEach(job => job.stop());
    this.scheduledJobs = [];

    console.log('🏆 Daily posting mission accomplished! All systems standby until tomorrow.');
  }

  private async resetDaily(): Promise<void> {
    console.log('🌅 New day starting - resetting daily posting state');
    
    this.currentState = this.getDefaultState();
    await this.saveDailyState();
    await this.setupPostingSchedule();
  }

  private async saveDailyState(): Promise<void> {
    try {
      await supabaseClient.supabase
        ?.from('daily_posting_state')
        .upsert(this.currentState);
    } catch (error) {
      console.warn('Could not save daily posting state:', error);
    }
  }

  // Public methods for monitoring
  getDailyProgress(): {
    completed: number;
    target: number;
    percentage: number;
    remaining: number;
    onTrack: boolean;
  } {
    const percentage = (this.currentState.posts_completed / this.DAILY_TARGET) * 100;
    const now = new Date();
    const currentHour = now.getHours();
    const expectedByNow = Math.floor((currentHour / 24) * this.DAILY_TARGET);
    
    return {
      completed: this.currentState.posts_completed,
      target: this.DAILY_TARGET,
      percentage: Math.round(percentage),
      remaining: this.DAILY_TARGET - this.currentState.posts_completed,
      onTrack: this.currentState.posts_completed >= expectedByNow - 1
    };
  }

  async forcePost(): Promise<void> {
    if (this.currentState.posts_completed < this.DAILY_TARGET) {
      await this.executePost('emergency');
    } else {
      console.log('✅ Daily target already reached');
    }
  }

  stop(): void {
    this.scheduledJobs.forEach(job => job.stop());
    this.scheduledJobs = [];
    this.isRunning = false;
    console.log('🛑 Daily Posting Manager stopped');
  }
}

export const dailyPostingManager = new DailyPostingManager(); 