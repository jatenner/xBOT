import { PostTweetAgent } from './postTweet';
import { UltraViralGenerator } from './ultraViralGenerator';
import { APIOptimizer } from '../utils/apiOptimizer';
import { supabase } from '../utils/supabaseClient';
import { isBotDisabled } from '../utils/flagCheck';

interface SuperDecision {
  action: 'post' | 'sleep' | 'prepare';
  priority: number;
  reasoning: string;
  viralPotential: number;
  contentPreview?: string;
  nextActionTime?: Date;
}

export class SuperStrategist {
  private apiOptimizer: APIOptimizer;
  private viralGenerator: UltraViralGenerator;
  private postAgent: PostTweetAgent;
  private lastPostTime: number = 0;

  // VIRAL TIMING WINDOWS - When tweets go viral
  private viralWindows = [
    { hour: 9, day: 1, multiplier: 3.2, description: 'Monday Morning Viral Window' },
    { hour: 13, day: 2, multiplier: 3.5, description: 'Tuesday Lunch Viral Explosion' },
    { hour: 9, day: 3, multiplier: 3.1, description: 'Wednesday Morning Breakthrough' },
    { hour: 19, day: 4, multiplier: 2.8, description: 'Thursday Evening Analysis Hour' },
    { hour: 10, day: 5, multiplier: 2.5, description: 'Friday Morning Last Push' }
  ];

  constructor() {
    this.apiOptimizer = new APIOptimizer(supabase!);
    this.viralGenerator = new UltraViralGenerator();
    this.postAgent = new PostTweetAgent();
    this.initializeOptimizer();
  }

  private async initializeOptimizer(): Promise<void> {
    await this.apiOptimizer.loadUsage();
  }

  async makeGodTierDecision(): Promise<SuperDecision> {
    console.log('🚀 === SUPER STRATEGIST ACTIVATED ===');
    
    // Load API usage first
    await this.apiOptimizer.loadUsage();
    
    // Check kill switch
    if (await isBotDisabled()) {
      return this.createSleepDecision('Bot disabled via kill switch');
    }

    const now = new Date();
    const apiStatus = this.apiOptimizer.getStatus();
    
    // Display God-Tier Intelligence Dashboard
    this.displayGodTierDashboard(now, apiStatus);

    // CRITICAL: Can we even post?
    if (!apiStatus.canPost) {
      const schedule = this.apiOptimizer.getOptimalPostingSchedule();
      return {
        action: 'sleep',
        priority: 0,
        reasoning: `🚨 MONTHLY CAP REACHED - Next post available: ${schedule.nextPostTime.toLocaleString()}`,
        viralPotential: 0,
        nextActionTime: schedule.nextPostTime
      };
    }

    // ULTRA INTELLIGENCE: Calculate current viral potential
    const viralPotential = this.calculateCurrentViralPotential(now);
    
    // SMART SPACING: Don't waste limited posts
    const timeSinceLastPost = (now.getTime() - this.lastPostTime) / (1000 * 60);
    const minimumSpacing = this.calculateOptimalSpacing(apiStatus.dailyWritesLeft, now);
    
    if (timeSinceLastPost < minimumSpacing) {
      return {
        action: 'sleep',
        priority: 1,
        reasoning: `⏰ SPACING CONTROL: Need ${(minimumSpacing - timeSinceLastPost).toFixed(1)}m more (${apiStatus.dailyWritesLeft} posts left today)`,
        viralPotential: viralPotential,
        nextActionTime: new Date(now.getTime() + ((minimumSpacing - timeSinceLastPost) * 60 * 1000))
      };
    }

    // VIRAL WINDOW DETECTION
    if (viralPotential >= 3.0) {
      // Generate ultra-viral content
      const viralTweet = await this.viralGenerator.generateViralTweet();
      
      return {
        action: 'post',
        priority: 10,
        reasoning: `🔥 VIRAL WINDOW DETECTED (${viralPotential.toFixed(1)}x) - POSTING GOD-TIER CONTENT`,
        viralPotential: viralPotential,
        contentPreview: viralTweet.content.substring(0, 100) + '...'
      };
    }

    // HIGH ENGAGEMENT WINDOW
    if (viralPotential >= 1.5 && apiStatus.dailyWritesLeft > 5) {
      const viralTweet = await this.viralGenerator.generateViralTweet();
      
      return {
        action: 'post',
        priority: 7,
        reasoning: `✨ HIGH ENGAGEMENT WINDOW (${viralPotential.toFixed(1)}x) - Quality content opportunity`,
        viralPotential: viralPotential,
        contentPreview: viralTweet.content.substring(0, 100) + '...'
      };
    }

    // CONSERVATIVE MODE: Save limited posts for better windows
    if (apiStatus.dailyWritesLeft <= 3) {
      return {
        action: 'sleep',
        priority: 2,
        reasoning: `💎 CONSERVATION MODE: Only ${apiStatus.dailyWritesLeft} posts left - waiting for viral window`,
        viralPotential: viralPotential,
        nextActionTime: this.getNextViralWindow(now)
      };
    }

    // MODERATE ENGAGEMENT - Only if we have plenty of posts left
    if (viralPotential >= 1.0 && apiStatus.dailyWritesLeft > 8) {
      const viralTweet = await this.viralGenerator.generateViralTweet();
      
      return {
        action: 'post',
        priority: 5,
        reasoning: `📈 MODERATE WINDOW (${viralPotential.toFixed(1)}x) - Safe to post with ${apiStatus.dailyWritesLeft} remaining`,
        viralPotential: viralPotential,
        contentPreview: viralTweet.content.substring(0, 100) + '...'
      };
    }

    // DEFAULT: Wait for better opportunity
    return {
      action: 'sleep',
      priority: 1,
      reasoning: `😴 LOW ENGAGEMENT WINDOW (${viralPotential.toFixed(1)}x) - Conserving ${apiStatus.dailyWritesLeft} posts for peak times`,
      viralPotential: viralPotential,
      nextActionTime: this.getNextViralWindow(now)
    };
  }

  private displayGodTierDashboard(now: Date, apiStatus: any): void {
    console.log('🧠 === GOD-TIER INTELLIGENCE DASHBOARD ===');
    console.log(`📅 Current Context: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`);
    console.log(`🕐 Hour: ${now.getHours()} | Day: ${now.getDay()}`);
    
    console.log('⚡ API STATUS:');
    console.log(`   📊 Posts remaining today: ${apiStatus.dailyWritesLeft}/20`);
    console.log(`   📈 Monthly posts left: ${apiStatus.monthlyWritesLeft}`);
    console.log(`   🎯 Can post: ${apiStatus.canPost ? '✅ YES' : '❌ NO'}`);
    
    const viralPotential = this.calculateCurrentViralPotential(now);
    console.log('🔥 VIRAL ANALYSIS:');
    console.log(`   📊 Current viral potential: ${viralPotential.toFixed(1)}x`);
    console.log(`   🎭 Window quality: ${this.getViralQuality(viralPotential)}`);
    
    console.log('🎯 DECISION FACTORS:');
    console.log(`   ⏰ Time since last post: ${((now.getTime() - this.lastPostTime) / (1000 * 60)).toFixed(1)}m`);
    console.log(`   📈 Optimal spacing: ${this.calculateOptimalSpacing(apiStatus.dailyWritesLeft, now).toFixed(1)}m`);
    console.log('=================================');
  }

  private calculateCurrentViralPotential(now: Date): number {
    const hour = now.getHours();
    const day = now.getDay();
    
    // Check for exact viral windows
    const viralWindow = this.viralWindows.find(w => w.hour === hour && w.day === day);
    if (viralWindow) {
      return viralWindow.multiplier;
    }
    
    // General engagement patterns
    if (day >= 1 && day <= 5) { // Weekdays
      if (hour >= 8 && hour <= 10) return 1.8; // Morning
      if (hour >= 12 && hour <= 14) return 2.0; // Lunch
      if (hour >= 18 && hour <= 20) return 1.6; // Evening
    } else { // Weekends
      if (hour >= 10 && hour <= 12) return 1.2; // Weekend morning
    }
    
    return 0.8; // Low engagement time
  }

  private calculateOptimalSpacing(postsLeft: number, now: Date): number {
    const hoursLeftToday = 24 - now.getHours();
    
    if (postsLeft <= 0) return 999; // Can't post
    if (postsLeft === 1) return hoursLeftToday * 60; // Spread last post
    
    // Optimal spacing to use all posts
    return Math.max(45, (hoursLeftToday * 60) / postsLeft);
  }

  private getViralQuality(potential: number): string {
    if (potential >= 3.0) return '🔥 VIRAL EXPLOSION';
    if (potential >= 2.0) return '✨ HIGH VIRAL';
    if (potential >= 1.5) return '📈 GOOD ENGAGEMENT';
    if (potential >= 1.0) return '👍 MODERATE';
    return '😴 LOW';
  }

  private getNextViralWindow(now: Date): Date {
    const today = now.getDay();
    const currentHour = now.getHours();
    
    // Find next viral window today
    const todayWindows = this.viralWindows.filter(w => w.day === today && w.hour > currentHour);
    if (todayWindows.length > 0) {
      const nextWindow = todayWindows[0];
      const nextTime = new Date(now);
      nextTime.setHours(nextWindow.hour, 0, 0, 0);
      return nextTime;
    }
    
    // Find tomorrow's first window
    const tomorrow = (today + 1) % 7;
    const tomorrowWindows = this.viralWindows.filter(w => w.day === tomorrow);
    if (tomorrowWindows.length > 0) {
      const nextWindow = tomorrowWindows[0];
      const nextTime = new Date(now);
      nextTime.setDate(nextTime.getDate() + 1);
      nextTime.setHours(nextWindow.hour, 0, 0, 0);
      return nextTime;
    }
    
    // Default: Tomorrow 9 AM
    const defaultNext = new Date(now);
    defaultNext.setDate(defaultNext.getDate() + 1);
    defaultNext.setHours(9, 0, 0, 0);
    return defaultNext;
  }

  private createSleepDecision(reason: string): SuperDecision {
    return {
      action: 'sleep',
      priority: 0,
      reasoning: reason,
      viralPotential: 0
    };
  }

  async executeDecision(decision: SuperDecision): Promise<any> {
    if (decision.action === 'post') {
      // Track the API usage
      await this.apiOptimizer.trackWrite();
      
      // Generate and post viral content
      const viralContent = await this.viralGenerator.generateViralTweet();
      console.log(`🚀 POSTING VIRAL CONTENT (Score: ${viralContent.viralScore}/100)`);
      console.log(`📝 Style: ${viralContent.style || 'DEFAULT'}`);
      console.log(`🎯 Triggers: ${viralContent.engagement_triggers.join(', ')}`);
      
      // Execute the post
      const result = await this.postAgent.run(false, false, true);
      
      // Update timing
      this.lastPostTime = Date.now();
      
      return result;
    }
    
    console.log(`😴 SLEEPING: ${decision.reasoning}`);
    if (decision.nextActionTime) {
      console.log(`⏰ Next action scheduled: ${decision.nextActionTime.toLocaleString()}`);
    }
    
    return { success: true, action: 'sleep' };
  }

  // Generate content for dashboard preview
  async previewNextContent(): Promise<string> {
    const viralContent = await this.viralGenerator.generateViralTweet();
    return `${viralContent.style || 'DEFAULT'} (Score: ${viralContent.viralScore}): ${viralContent.content.substring(0, 150)}...`;
  }
} 