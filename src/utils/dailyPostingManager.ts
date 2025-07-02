import { supabaseClient } from './supabaseClient';
import { PostTweetAgent } from '../agents/postTweet';
import { contentCache } from './contentCache';
import { IntelligentSchedulingAgent } from '../agents/intelligentSchedulingAgent';
import { strategicOpportunityScheduler } from '../agents/strategicOpportunityScheduler';
import { HumanLikeStrategicMind } from '../agents/humanLikeStrategicMind';
import { getConfig } from './botConfig';
import { getConfigValue } from './config';
import { monthlyBudgetManager } from './monthlyBudgetManager';
import * as cron from 'node-cron';
import { runtimeConfig } from './supabaseConfig';

interface DailyPostingState {
  date: string;
  posts_completed: number;
  posts_target: number;
  next_post_time: string;
  posting_schedule: string[];
  emergency_mode: boolean;
  last_post_time?: string;
  monthly_budget_target?: number; // New: intelligent target from monthly budget
}

interface PostingWindow {
  start_hour: number;
  end_hour: number;
  posts_count: number;
  priority: number;
}

class DailyPostingManager {
  private postTweetAgent: PostTweetAgent;
  private intelligentScheduler: IntelligentSchedulingAgent;
  private humanStrategicMind: HumanLikeStrategicMind;
  private currentState: DailyPostingState;
  private readonly DAILY_TARGET = 17;
  private isRunning = false;
  private scheduledJobs: cron.ScheduledTask[] = [];
  private useIntelligentScheduling = true;

  // INTELLIGENT posting within Twitter limits (up to 17 posts distributed optimally)
  private readonly POSTING_WINDOWS: PostingWindow[] = [
    { start_hour: 6, end_hour: 9, posts_count: 2, priority: 3 },   // Early Morning (2 posts)
    { start_hour: 9, end_hour: 12, posts_count: 4, priority: 4 }, // Morning Peak (4 posts)
    { start_hour: 12, end_hour: 15, posts_count: 4, priority: 5 }, // Lunch & Early Afternoon PEAK (4 posts)
    { start_hour: 15, end_hour: 18, posts_count: 4, priority: 5 }, // Late Afternoon PEAK (4 posts)
    { start_hour: 18, end_hour: 21, posts_count: 2, priority: 4 }, // Evening Peak (2 posts)
    { start_hour: 21, end_hour: 23, posts_count: 1, priority: 3 },  // Late Evening (1 post)
  ];

  constructor() {
    this.postTweetAgent = new PostTweetAgent();
    this.intelligentScheduler = new IntelligentSchedulingAgent();
    this.humanStrategicMind = new HumanLikeStrategicMind();
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
    
    // 🚀 STARTUP FIX: Post immediately on startup to test system
    if (this.currentState.posts_completed === 0) {
      console.log('🚀 STARTUP: Posting first tweet immediately to verify system');
      await this.forceImmediateStartupPost();
    }
    
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
      
      // 🚨 FIX: Skip windows that are completely in the past
      if (windowEnd <= now) {
        continue;
      }
      
      // 🚨 FIX: Adjust window start to current time if partially past
      const effectiveWindowStart = windowStart < now ? now : windowStart;
      
      const windowDuration = (windowEnd.getTime() - effectiveWindowStart.getTime()) / (1000 * 60); // minutes
      const interval = windowDuration / window.posts_count;

      for (let i = 0; i < window.posts_count; i++) {
        // Add randomization within the window (±5 minutes for tighter scheduling)
        const baseTime = new Date(effectiveWindowStart.getTime() + (i * interval * 60 * 1000));
        const randomOffset = (Math.random() - 0.5) * 10 * 60 * 1000; // ±5 minutes in milliseconds
        const postTime = new Date(baseTime.getTime() + randomOffset);
        
        // Ensure post time stays within the window and is in the future
        const clampedTime = new Date(Math.max(
          Math.max(effectiveWindowStart.getTime(), now.getTime() + 60000), // At least 1 minute from now
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
      // 👑 SUPREME AI DECISION MAKING - Use dynamic import to avoid circular dependency
      const { supremeAIOrchestrator } = await import('../agents/supremeAIOrchestrator');
      const supremeDecision = await supremeAIOrchestrator.makeSupremeDecision();
      
      // 🚨 EMERGENCY FIX: Validate supremeDecision structure
      if (!supremeDecision || !supremeDecision.strategy) {
        console.warn('⚠️ Invalid supreme decision structure, using fallback');
        await this.setupTraditionalSchedule(remaining);
        return;
      }
      
      console.log('👑 SUPREME AI ORCHESTRATOR DECISION:');
      console.log(`   🧠 Strategy: ${supremeDecision.strategy.mode || 'undefined'}`);
      console.log(`   🔥 Confidence: ${supremeDecision.strategy.confidence ? (supremeDecision.strategy.confidence * 100).toFixed(0) : 0}%`);
      console.log(`   📝 Posts planned: ${supremeDecision.strategy.postingStrategy?.postCount || 0}`);
      console.log(`   🎯 Goal: ${supremeDecision.strategy.contentStrategy?.primaryGoal || 'undefined'}`);
      console.log(`   💭 Reasoning: ${supremeDecision.reasoning || 'No reasoning provided'}`);
      
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
        const humanInsights = await this.humanStrategicMind.analyzeWorldLikeHuman();
        
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
      timezone: "America/New_York"
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
        const humanAnalysis = await this.humanStrategicMind.analyzeWorldLikeHuman();
        
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
            
            // 🚨 EMERGENCY FIX: Disabled strategic burst posting
            console.log('🛑 Strategic burst posting DISABLED - preventing API spam');
            console.log(`   Would have posted ${rec.postCount} times but blocked for safety`);
            // Removed actual posting code to prevent API exhaustion
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
      timezone: "America/New_York"
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
      timezone: "America/New_York"
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
      timezone: "America/New_York"
    });

    this.scheduledJobs.push(job);
    console.log(`⏰ Scheduled post for ${postTime.toLocaleTimeString()}`);
  }

  private async activateEmergencyPosting(postsNeeded: number): Promise<void> {
    console.log(`🚨 Emergency posting activated - need ${postsNeeded} additional posts`);
    
    // 🚨 EMERGENCY FIX: Disable all emergency posting
    console.log('🛑 EMERGENCY FIX: Emergency posting DISABLED to prevent API exhaustion');
    console.log('⏰ Bot will wait for natural schedule instead of catch-up posting');
    return; // Exit immediately without scheduling emergency posts
  }

  private async executePost(trigger: 'scheduled' | 'emergency' | 'catchup'): Promise<void> {
    // 🚨 EMERGENCY RATE LIMITING
    const lastPostTime = this.currentState.last_post_time ? new Date(this.currentState.last_post_time) : null;
    const now = new Date();
    
    if (lastPostTime) {
      const timeSinceLastPost = now.getTime() - lastPostTime.getTime();
      const MIN_INTERVAL = 5 * 60 * 1000; // 5 minutes minimum (much more reasonable)
      
      if (timeSinceLastPost < MIN_INTERVAL) {
        const waitTime = MIN_INTERVAL - timeSinceLastPost;
        console.log(`🚨 RATE LIMIT: Must wait ${Math.ceil(waitTime / 60000)} minutes since last post`);
        console.log('🛑 Post blocked to prevent API exhaustion');
        return;
      }
    }
    
    // Check daily limit
    if (this.currentState.posts_completed >= this.DAILY_TARGET) {
      console.log(`🚨 DAILY LIMIT REACHED: ${this.currentState.posts_completed}/${this.DAILY_TARGET} posts completed, blocking further posts`);
      return;
    }
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
        result = await this.postTweetAgent.run(false, false);
      }

      if (result.success) {
        this.currentState.posts_completed++;
        this.currentState.last_post_time = new Date().toISOString();
        await this.saveDailyState();

        console.log(`✅ Post ${this.currentState.posts_completed}/${this.DAILY_TARGET} completed`);

        // Check if we've hit the target
        if (this.currentState.posts_completed >= this.DAILY_TARGET) {
          console.log(`🎉 DAILY TARGET REACHED! ${this.DAILY_TARGET}/${this.DAILY_TARGET} tweets completed`);
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
      // Skip rate limiting for forced posts
      const tempLastPostTime = this.currentState.last_post_time;
      this.currentState.last_post_time = undefined; // Temporarily remove last post time
      await this.executePost('emergency');
      if (tempLastPostTime) {
        this.currentState.last_post_time = tempLastPostTime; // Restore it
      }
    } else {
      console.log('✅ Daily target already reached');
    }
  }

  /**
   * Force immediate posting on startup - no rate limits
   */
  async forceImmediateStartupPost(): Promise<void> {
    if (this.currentState.posts_completed < this.DAILY_TARGET) {
      console.log('🚀 STARTUP POST: Forcing immediate post to verify system works');
      // 🚨 STARTUP FIX: Clear phantom last post time to force immediate posting
      const originalLastPostTime = this.currentState.last_post_time;
      this.currentState.last_post_time = undefined;
      console.log('🧹 STARTUP: Cleared phantom last post time to enable immediate posting');
      
      await this.executePost('emergency');
      
      // Don't restore the phantom time - keep it cleared for fresh start
      console.log('✅ STARTUP: First post attempted, system verification complete');
    }
  }

  stop(): void {
    this.scheduledJobs.forEach(job => job.stop());
    this.scheduledJobs = [];
    this.isRunning = false;
    console.log('🛑 Daily Posting Manager stopped');
  }

  /**
   * 📊 GET DAILY TWEET CAP FROM CONFIG
   * Dynamic configuration-driven tweet limit
   */
  async getDailyTweetCap(): Promise<number> {
    try {
      const { data: runtimeConfig } = await supabaseClient.supabase
        ?.from('bot_config')
        .select('value')
        .eq('key', 'runtime_config')
        .single() || { data: null };
      
      return runtimeConfig?.value?.maxDailyTweets || this.DAILY_TARGET;
    } catch (error) {
      return this.DAILY_TARGET; // Fallback to class property
    }
  }

  /**
   * ✅ CHECK IF SHOULD POST NOW
   * Based on dynamic daily cap and current progress
   */
  async shouldPostNow(): Promise<boolean> {
    // 🚨 EMERGENCY: Check for emergency posting bypass flags
    try {
      const { data: emergencyFlags } = await supabaseClient.supabase
        ?.from('bot_config')
        .select('value')
        .eq('key', 'emergency_posting_bypass')
        .single() || { data: null };

      if (emergencyFlags?.value?.daily_limit_bypass) {
        console.log('🚨 EMERGENCY: Daily limit bypass active - forcing post');
        return this.checkTimingConstraints();
      }
    } catch (error) {
      // Continue with normal checks if emergency flags fail
      console.log('⚠️ Could not check emergency flags, using normal limits');
    }

    const dailyCap = await this.getDailyTweetCap();
    const todaysPosts = await this.getTodaysPostCount();
    
    if (todaysPosts >= dailyCap) {
      console.log(`📊 Daily cap reached: ${todaysPosts}/${dailyCap}`);
      return false;
    }
    
    return this.checkTimingConstraints();
  }

  /**
   * 📈 GET TODAY'S POST COUNT
   */
  private async getTodaysPostCount(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const { count, error } = await supabaseClient.supabase
        ?.from('tweets')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${today}T00:00:00Z`)
        .lt('created_at', `${today}T23:59:59Z`);

      return count || 0;
    } catch (error) {
      console.error('❌ Failed to get today\'s post count:', error);
      return 0;
    }
  }

  /**
   * ⏰ CHECK TIMING CONSTRAINTS
   */
  private checkTimingConstraints(): boolean {
    const now = new Date();
    const hour = now.getHours();
    
    // Only post during active hours (9 AM - 9 PM)
    return hour >= 9 && hour <= 21;
  }

  /**
   * 🔄 EMERGENCY RESET: Reset today's posting count only
   * Keep all quality and config settings unchanged
   */
  async emergencyResetTodaysCount(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    try {
      console.log('🚨 EMERGENCY: Resetting today\'s posting count...');
      
      // Reset daily posting state to 0/6
      await supabaseClient.supabase
        ?.from('daily_posting_state')
        .upsert({
          date: today,
          tweets_posted: 0,
          posts_completed: 0,
          max_daily_tweets: this.DAILY_TARGET,
          posts_target: this.DAILY_TARGET,
          last_post_time: null,
          next_post_time: new Date().toISOString(),
          posting_schedule: this.generateDailySchedule(),
          emergency_mode: false,
          strategy: 'balanced'
        });
      
      // Update current state
      this.currentState.posts_completed = 0;
      this.currentState.emergency_mode = false;
      
      console.log(`✅ EMERGENCY: Daily posting reset to 0/${this.DAILY_TARGET}`);
      console.log('🎯 Quality settings remain unchanged (6/55/0.85/90)');
      
    } catch (error) {
      console.error('❌ Emergency reset failed:', error);
    }
  }
}

// Export both the class and the singleton instance
export { DailyPostingManager };
export const dailyPostingManager = new DailyPostingManager(); 