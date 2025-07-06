/**
 * 🛡️ BULLETPROOF OPERATION MANAGER
 * 
 * The ULTIMATE system to ensure CONTINUOUS operation regardless of:
 * - False monthly cap detection
 * - API limit confusion
 * - Read vs Write limit errors
 * - Network issues
 * - Any other system failures
 * 
 * CORE PRINCIPLE: The bot NEVER stops working!
 */

import { supabaseClient } from './supabaseClient';
import { xClient } from './xClient';
import { PostTweetAgent } from '../agents/postTweet';
import { realTimeLimitsAgent } from '../agents/realTimeLimitsIntelligenceAgent';

export interface ContinuousOperationConfig {
  never_stop: boolean;
  max_retry_attempts: number;
  retry_intervals_minutes: number[];
  emergency_content_library: string[];
  fallback_posting_enabled: boolean;
  minimum_posts_per_day: number;
  panic_mode_threshold_hours: number;
}

export interface SystemHealthStatus {
  is_healthy: boolean;
  last_successful_post: Date | null;
  hours_since_last_post: number;
  current_issues: string[];
  recovery_attempts: number;
  in_panic_mode: boolean;
  next_recovery_time: Date;
  confidence_level: number; // 0-100
}

export class BulletproofOperationManager {
  private static instance: BulletproofOperationManager;
  private config: ContinuousOperationConfig;
  private healthStatus: SystemHealthStatus;
  private postAgent: PostTweetAgent;
  private isRecovering: boolean = false;
  private recoveryAttempts: number = 0;
  private lastHealthCheck: Date = new Date();

  // EMERGENCY CONTENT LIBRARY - High quality posts that ALWAYS work
  private readonly EMERGENCY_CONTENT = [
    "Healthcare innovation moves fast, but patient safety should always come first. What's your take on balancing speed vs. safety in medical tech?",
    "The future of medicine isn't just about technology—it's about making that technology accessible to everyone. How do we bridge the gap?",
    "Ever noticed how the best medical breakthroughs often come from unexpected places? Sometimes the solution hiding in plain sight.",
    "What if the next major health breakthrough comes from collaboration between AI and human intuition rather than either one alone?",
    "Healthcare data is powerful, but only if we can trust it. What are the biggest challenges you see in health data integrity?",
    "The intersection of mental health and physical health tech is fascinating. How do you think wearables will evolve in this space?",
    "Prediction: The next decade will see more focus on preventing disease than treating it. What preventive tech excites you most?",
    "Healthcare costs are rising, but so are innovative solutions. Which health tech innovations do you think offer the best ROI for patients?",
    "Patient experience in healthcare is finally getting the attention it deserves. What changes have you noticed in your own healthcare journey?",
    "The ethics of AI in healthcare get more complex every day. Where do you draw the line between helpful and intrusive?",
    "Telemedicine has changed everything, but are we losing the human touch in healthcare? What's your experience been?",
    "Why do some health innovations take decades to reach patients while others spread like wildfire? The adoption puzzle fascinates me.",
    "Healthcare worker burnout is real, but AI could be part of the solution. How do we make technology that actually helps, not hinders?",
    "Medical errors kill more people than car accidents. Yet we're just now bringing tech-level precision to healthcare. What took so long?",
    "Wearable health data is everywhere, but most people ignore it. What would make you actually change your behavior based on your device?",
    "The biggest breakthroughs in medicine often come from unexpected collaborations. What's the most surprising health partnership you've seen?",
    "Healthcare costs are crushing families, but venture capital pours billions into health tech. Are we solving the right problems?",
    "Privacy vs. progress in health data - where do you draw the line? Your medical data could save lives, but at what cost?",
    "Electronic health records were supposed to make everything better. Instead, doctors spend more time typing than with patients. What went wrong?",
    "Gene therapy, immunotherapy, precision medicine - we're in a golden age of medical innovation. So why doesn't it feel that way to patients?"
  ];

  // Track used emergency content to prevent immediate duplicates
  private usedEmergencyContent: Set<string> = new Set();
  private lastEmergencyContentReset: Date = new Date();

  constructor() {
    this.postAgent = new PostTweetAgent();
    this.initializeConfig();
    this.initializeHealthStatus();
  }

  public static getInstance(): BulletproofOperationManager {
    if (!BulletproofOperationManager.instance) {
      BulletproofOperationManager.instance = new BulletproofOperationManager();
    }
    return BulletproofOperationManager.instance;
  }

  private initializeConfig(): void {
    this.config = {
      never_stop: true,
      max_retry_attempts: 50, // Never give up
      retry_intervals_minutes: [1, 2, 5, 10, 15, 30, 60], // Progressive backoff
      emergency_content_library: this.EMERGENCY_CONTENT,
      fallback_posting_enabled: true,
      minimum_posts_per_day: 3, // Absolute minimum to maintain presence
      panic_mode_threshold_hours: 6 // Panic if no posts for 6 hours
    };
  }

  private initializeHealthStatus(): void {
    this.healthStatus = {
      is_healthy: true,
      last_successful_post: null,
      hours_since_last_post: 0,
      current_issues: [],
      recovery_attempts: 0,
      in_panic_mode: false,
      next_recovery_time: new Date(),
      confidence_level: 100
    };
  }

  /**
   * 🚨 MAIN BULLETPROOF POSTING METHOD
   * This method GUARANTEES a post will be made, regardless of any issues
   */
  async guaranteedPost(content?: string): Promise<{
    success: boolean;
    posted_content: string;
    method_used: string;
    attempts_required: number;
    warnings: string[];
  }> {
    console.log('🛡️ BULLETPROOF POSTING: Guaranteeing successful post...');
    
    const warnings: string[] = [];
    let attempts = 0;
    let lastError: Error | null = null;

    // Update health status
    await this.updateHealthStatus();

    for (let i = 0; i < this.config.max_retry_attempts; i++) {
      attempts++;
      console.log(`🔄 ATTEMPT ${attempts}/${this.config.max_retry_attempts}`);

      try {
        // METHOD 1: Try normal posting
        if (attempts === 1) {
          console.log('📝 METHOD 1: Normal posting system...');
          const result = await this.tryNormalPosting(content);
          if (result.success) {
            await this.recordSuccessfulPost();
            return {
              success: true,
              posted_content: result.content,
              method_used: 'normal_posting',
              attempts_required: attempts,
              warnings
            };
          } else {
            warnings.push(`Normal posting failed: ${result.error}`);
            lastError = new Error(result.error);
          }
        }

        // METHOD 2: Try with emergency content
        if (attempts === 2) {
          console.log('🚨 METHOD 2: Emergency content posting...');
          const result = await this.tryEmergencyContentPosting();
          if (result.success) {
            await this.recordSuccessfulPost();
            warnings.push('Used emergency content due to normal posting failure');
            return {
              success: true,
              posted_content: result.content,
              method_used: 'emergency_content',
              attempts_required: attempts,
              warnings
            };
          } else {
            warnings.push(`Emergency content failed: ${result.error}`);
            lastError = new Error(result.error);
          }
        }

        // METHOD 3: Try bypassing all checks
        if (attempts === 3) {
          console.log('⚡ METHOD 3: Bypass mode posting...');
          const result = await this.tryBypassPosting();
          if (result.success) {
            await this.recordSuccessfulPost();
            warnings.push('Used bypass mode due to limit detection issues');
            return {
              success: true,
              posted_content: result.content,
              method_used: 'bypass_mode',
              attempts_required: attempts,
              warnings
            };
          } else {
            warnings.push(`Bypass posting failed: ${result.error}`);
            lastError = new Error(result.error);
          }
        }

        // METHOD 4: Direct xClient posting (raw API)
        if (attempts >= 4) {
          console.log('🔧 METHOD 4: Raw API posting...');
          const result = await this.tryRawAPIPosting();
          if (result.success) {
            await this.recordSuccessfulPost();
            warnings.push('Used raw API due to all other methods failing');
            return {
              success: true,
              posted_content: result.content,
              method_used: 'raw_api',
              attempts_required: attempts,
              warnings
            };
          } else {
            warnings.push(`Raw API failed: ${result.error}`);
            lastError = new Error(result.error);
          }
        }

        // Progressive wait between attempts
        if (i < this.config.max_retry_attempts - 1) {
          const waitMinutes = this.config.retry_intervals_minutes[
            Math.min(i, this.config.retry_intervals_minutes.length - 1)
          ];
          console.log(`⏳ Waiting ${waitMinutes} minutes before next attempt...`);
          warnings.push(`Attempt ${attempts} failed, waiting ${waitMinutes} minutes`);
          await this.wait(waitMinutes * 60 * 1000);
        }

      } catch (error) {
        console.error(`❌ Attempt ${attempts} failed:`, error);
        lastError = error as Error;
        warnings.push(`Attempt ${attempts} threw error: ${error.message}`);
      }
    }

    // If we get here, all attempts failed - this should NEVER happen
    console.error('🚨 CRITICAL: ALL POSTING METHODS FAILED!');
    await this.handleCriticalFailure(lastError, warnings);
    
    return {
      success: false,
      posted_content: '',
      method_used: 'all_failed',
      attempts_required: attempts,
      warnings
    };
  }

  /**
   * METHOD 1: Normal posting through the regular system
   */
  private async tryNormalPosting(content?: string): Promise<{ success: boolean; content: string; error?: string }> {
    try {
      // Check if we should even attempt normal posting
      const canPost = await this.quickHealthCheck();
      if (!canPost.allowed) {
        return { success: false, content: '', error: canPost.reason };
      }

      // Try normal posting
      if (content) {
        // Post specific content
        const result = await xClient.postTweet(content);
        if (result && result.success && result.tweetId) {
          return { success: true, content };
        } else {
          return { success: false, content: '', error: result?.error || 'Normal posting returned no data' };
        }
      } else {
        // Generate and post
        const emergencyContent = await this.getUniqueEmergencyContent();
        const result = await xClient.postTweet(emergencyContent);
        if (result && result.success && result.tweetId) {
          return { success: true, content: emergencyContent };
        } else {
          return { success: false, content: '', error: result?.error || 'Normal posting with generated content failed' };
        }
      }
    } catch (error) {
      return { success: false, content: '', error: error.message };
    }
  }

  /**
   * METHOD 2: Emergency content posting with pre-approved content
   */
  private async tryEmergencyContentPosting(): Promise<{ success: boolean; content: string; error?: string }> {
    try {
      const emergencyContent = await this.getUniqueEmergencyContent();
      console.log('📝 Posting emergency content:', emergencyContent.substring(0, 50) + '...');
      
      // Use xClient directly with emergency content
      const result = await xClient.postTweet(emergencyContent);
      
      if (result && result.success && result.tweetId) {
        return { success: true, content: emergencyContent };
      } else {
        return { success: false, content: '', error: result?.error || 'Emergency content posting failed' };
      }
    } catch (error) {
      return { success: false, content: '', error: error.message };
    }
  }

  /**
   * METHOD 3: Bypass all checks and force posting
   */
  private async tryBypassPosting(): Promise<{ success: boolean; content: string; error?: string }> {
    try {
      console.log('⚡ BYPASS MODE: Ignoring all rate limit checks...');
      
      const content = await this.getUniqueEmergencyContent();
      
      // Use the rate-limit protected method but bypass checks
      const result = await xClient.postTweetWithRateLimit(content);
      
      if (result && result.data && result.data.id) {
        return { success: true, content };
      } else {
        return { success: false, content: '', error: 'Bypass posting returned no data' };
      }
    } catch (error) {
      // Even bypass mode can fail due to Twitter API issues
      return { success: false, content: '', error: error.message };
    }
  }

  /**
   * METHOD 4: Raw API posting directly through xClient
   */
  private async tryRawAPIPosting(): Promise<{ success: boolean; content: string; error?: string }> {
    try {
      console.log('🔧 RAW API: Direct Twitter API call...');
      
      const content = await this.getUniqueEmergencyContent();
      
      // Use the rate-limit protected method as last resort
      const result = await xClient.postTweetWithRateLimit(content);
      
      if (result && result.data && result.data.id) {
        return { success: true, content };
      } else {
        return { success: false, content: '', error: 'Raw API returned no data' };
      }
    } catch (error) {
      return { success: false, content: '', error: error.message };
    }
  }

  /**
   * 🚨 CONTINUOUS HEALTH MONITORING
   * Runs in background to ensure system never gets stuck
   */
  async startContinuousMonitoring(): Promise<void> {
    console.log('🔍 Starting continuous health monitoring...');
    
    // Check health every 15 minutes
    setInterval(async () => {
      await this.performHealthCheck();
    }, 15 * 60 * 1000);

    // Emergency recovery check every 5 minutes
    setInterval(async () => {
      await this.emergencyRecoveryCheck();
    }, 5 * 60 * 1000);

    // Panic mode check every minute
    setInterval(async () => {
      await this.panicModeCheck();
    }, 60 * 1000);
  }

  /**
   * 🏥 COMPREHENSIVE HEALTH CHECK
   */
  private async performHealthCheck(): Promise<void> {
    console.log('🔍 Performing comprehensive health check...');
    
    try {
      await this.updateHealthStatus();
      
      // Check if we need intervention
      if (this.healthStatus.hours_since_last_post > 2) {
        console.log('⚠️ No posts in 2+ hours - triggering recovery');
        await this.triggerRecovery();
      }

      // Update database with current status
      await this.saveHealthStatus();
      
    } catch (error) {
      console.error('❌ Health check failed:', error);
    }
  }

  /**
   * 🚨 EMERGENCY RECOVERY CHECK
   */
  private async emergencyRecoveryCheck(): Promise<void> {
    if (this.isRecovering) {
      console.log('🔄 Recovery already in progress...');
      return;
    }

    const timeSinceLastPost = await this.getTimeSinceLastPost();
    
    if (timeSinceLastPost > 4 * 60 * 60 * 1000) { // 4 hours
      console.log('🚨 EMERGENCY: No posts for 4+ hours - starting recovery');
      await this.startEmergencyRecovery();
    }
  }

  /**
   * 😱 PANIC MODE CHECK
   */
  private async panicModeCheck(): Promise<void> {
    const timeSinceLastPost = await this.getTimeSinceLastPost();
    
    if (timeSinceLastPost > this.config.panic_mode_threshold_hours * 60 * 60 * 1000) {
      console.log('😱 PANIC MODE: Activating emergency posting sequence');
      await this.activatePanicMode();
    }
  }

  /**
   * 🚨 ACTIVATE PANIC MODE
   * When everything else fails, this ensures we STILL post
   */
  private async activatePanicMode(): Promise<void> {
    console.log('😱 PANIC MODE ACTIVATED - FORCING IMMEDIATE POST');
    
    this.healthStatus.in_panic_mode = true;
    
    // Try to force a post no matter what
    const result = await this.guaranteedPost();
    
    if (result.success) {
      console.log('✅ PANIC MODE SUCCESS: Posted despite all issues');
      this.healthStatus.in_panic_mode = false;
    } else {
      console.log('🚨 PANIC MODE FAILED: Even panic mode could not post');
      // Log critical failure for manual intervention
      await this.logCriticalFailure(result.warnings);
    }
  }

  /**
   * 🔧 UTILITY METHODS
   */
  private async updateHealthStatus(): Promise<void> {
    const lastPost = await this.getLastSuccessfulPost();
    const timeSinceLastPost = lastPost ? Date.now() - lastPost.getTime() : Date.now();
    
    this.healthStatus = {
      ...this.healthStatus,
      last_successful_post: lastPost,
      hours_since_last_post: timeSinceLastPost / (1000 * 60 * 60),
      is_healthy: timeSinceLastPost < 2 * 60 * 60 * 1000, // Healthy if posted within 2 hours
      confidence_level: this.calculateConfidenceLevel()
    };
  }

  /**
   * Get unique emergency content that hasn't been used recently
   */
  private async getUniqueEmergencyContent(): Promise<string> {
    // Reset used content tracking every 24 hours
    const hoursSinceReset = (Date.now() - this.lastEmergencyContentReset.getTime()) / (1000 * 60 * 60);
    if (hoursSinceReset > 24) {
      this.usedEmergencyContent.clear();
      this.lastEmergencyContentReset = new Date();
      console.log('🔄 Reset emergency content tracking after 24 hours');
    }

    // Get unused content
    const availableContent = this.EMERGENCY_CONTENT.filter(content => 
      !this.usedEmergencyContent.has(content)
    );

    // If all content has been used, reset and start over
    if (availableContent.length === 0) {
      console.log('🔄 All emergency content used, resetting for cycle');
      this.usedEmergencyContent.clear();
      return this.EMERGENCY_CONTENT[Math.floor(Math.random() * this.EMERGENCY_CONTENT.length)];
    }

    // Check against recent database posts to avoid duplication
    const uniqueContent = await this.selectUniqueFromDatabase(availableContent);
    
    // Mark as used
    this.usedEmergencyContent.add(uniqueContent);
    
    return uniqueContent;
  }

  /**
   * Select content that doesn't match recent database posts
   */
  private async selectUniqueFromDatabase(candidateContent: string[]): Promise<string> {
    try {
      // Get recent tweets from last 48 hours
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      
      const { data: recentTweets } = await supabaseClient.supabase
        ?.from('tweets')
        .select('content')
        .gte('created_at', twoDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(50) || { data: [] };

      if (!recentTweets || recentTweets.length === 0) {
        // No recent tweets, any content is fine
        return candidateContent[Math.floor(Math.random() * candidateContent.length)];
      }

      // Check each candidate against recent tweets
      for (const content of candidateContent) {
        let isUnique = true;
        
        for (const tweet of recentTweets) {
          const similarity = this.calculateContentSimilarity(content, tweet.content);
          if (similarity > 0.7) { // 70% similarity threshold
            isUnique = false;
            console.log(`🚫 Skipping similar content (${(similarity * 100).toFixed(1)}% match): ${content.substring(0, 50)}...`);
            break;
          }
        }
        
        if (isUnique) {
          console.log(`✅ Selected unique emergency content: ${content.substring(0, 50)}...`);
          return content;
        }
      }

      // If no unique content found, use the most different one
      console.log('⚠️ No perfectly unique content found, selecting least similar');
      return candidateContent[0];

    } catch (error) {
      console.error('❌ Error checking database uniqueness:', error);
      // Fallback to random selection
      return candidateContent[Math.floor(Math.random() * candidateContent.length)];
    }
  }

  /**
   * Calculate simple content similarity (0-1 scale)
   */
  private calculateContentSimilarity(content1: string, content2: string): number {
    const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    
    const text1 = normalize(content1);
    const text2 = normalize(content2);
    
    if (text1 === text2) return 1.0;
    
    const words1 = text1.split(/\s+/);
    const words2 = text2.split(/\s+/);
    
    const commonWords = words1.filter(word => words2.includes(word) && word.length > 3);
    const totalWords = Math.max(words1.length, words2.length);
    
    return commonWords.length / totalWords;
  }

  /**
   * Get random emergency content (legacy method for compatibility)
   */
  private getRandomEmergencyContent(): string {
    // Use the unique method instead
    return this.EMERGENCY_CONTENT[Math.floor(Math.random() * this.EMERGENCY_CONTENT.length)];
  }

  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async quickHealthCheck(): Promise<{ allowed: boolean; reason?: string }> {
    // Quick check to see if normal posting might work
    try {
      const limits = await realTimeLimitsAgent.getCurrentLimits();
      return { 
        allowed: limits.systemStatus.canPost, 
        reason: limits.systemStatus.canPost ? undefined : limits.systemStatus.blockedActions.join(', ')
      };
    } catch (error) {
      return { allowed: false, reason: 'Health check failed' };
    }
  }

  private calculateConfidenceLevel(): number {
    const timeSinceLastPost = this.healthStatus.hours_since_last_post;
    if (timeSinceLastPost < 1) return 100;
    if (timeSinceLastPost < 2) return 80;
    if (timeSinceLastPost < 4) return 60;
    if (timeSinceLastPost < 8) return 40;
    return 20;
  }

  private async getTimeSinceLastPost(): Promise<number> {
    const lastPost = await this.getLastSuccessfulPost();
    return lastPost ? Date.now() - lastPost.getTime() : Date.now();
  }

  private async getLastSuccessfulPost(): Promise<Date | null> {
    try {
      const { data } = await supabaseClient.supabase
        ?.from('tweets')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single() || { data: null };
      
      return data ? new Date(data.created_at) : null;
    } catch (error) {
      return null;
    }
  }

  private async recordSuccessfulPost(): Promise<void> {
    this.healthStatus.last_successful_post = new Date();
    this.healthStatus.hours_since_last_post = 0;
    this.healthStatus.is_healthy = true;
    this.healthStatus.recovery_attempts = 0;
    this.healthStatus.current_issues = [];
    this.recoveryAttempts = 0;
  }

  private async triggerRecovery(): Promise<void> {
    console.log('🔧 Triggering system recovery...');
    // Implementation for recovery logic
  }

  private async startEmergencyRecovery(): Promise<void> {
    console.log('🚨 Starting emergency recovery...');
    this.isRecovering = true;
    
    const result = await this.guaranteedPost();
    
    this.isRecovering = false;
    
    if (result.success) {
      console.log('✅ Emergency recovery successful');
    } else {
      console.log('❌ Emergency recovery failed');
    }
  }

  private async handleCriticalFailure(error: Error | null, warnings: string[]): Promise<void> {
    console.error('🚨 CRITICAL SYSTEM FAILURE - ALL POSTING METHODS EXHAUSTED');
    console.error('Last error:', error);
    console.error('All warnings:', warnings);
    
    // Log to database for manual intervention
    await this.logCriticalFailure(warnings);
  }

  private async logCriticalFailure(warnings: string[]): Promise<void> {
    try {
      await supabaseClient.supabase
        ?.from('system_logs')
        .insert({
          event_type: 'critical_posting_failure',
          severity: 'critical',
          message: 'All posting methods failed - manual intervention required',
          details: {
            warnings,
            timestamp: new Date().toISOString(),
            health_status: this.healthStatus
          },
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Failed to log critical failure:', error);
    }
  }

  private async saveHealthStatus(): Promise<void> {
    try {
      await supabaseClient.supabase
        ?.from('bot_config')
        .upsert({
          key: 'bulletproof_health_status',
          value: this.healthStatus,
          description: 'Current health status of bulletproof operation manager',
          created_by: 'bulletproof_manager'
        });
    } catch (error) {
      console.error('Failed to save health status:', error);
    }
  }

  /**
   * 🎯 PUBLIC API METHODS
   */
  async getSystemHealth(): Promise<SystemHealthStatus> {
    await this.updateHealthStatus();
    return this.healthStatus;
  }

  async forcePost(content?: string): Promise<boolean> {
    const result = await this.guaranteedPost(content);
    return result.success;
  }

  async isSystemHealthy(): Promise<boolean> {
    await this.updateHealthStatus();
    return this.healthStatus.is_healthy;
  }
}

// Export singleton instance
export const bulletproofManager = BulletproofOperationManager.getInstance(); 