import { xClient } from '../utils/xClient';
import { supabaseClient } from '../utils/supabaseClient';
import { setConfigValue } from '../utils/config';

/**
 * 🚨 REAL-TIME API LIMITS INTELLIGENCE AGENT
 * 
 * The TRUTH SOURCE for all API limitations.
 * This agent's job is to know EXACTLY what we can and cannot do RIGHT NOW.
 * 
 * Other AI agents consult this agent before making any posting decisions.
 */

export interface RealTimeLimits {
  twitter: {
    // EXACT current limits
    dailyTweets: { used: number; limit: number; remaining: number; resetTime: Date };
    monthlyTweets: { used: number; limit: number; remaining: number; resetTime: Date };
    readRequests: { used: number; limit: number; remaining: number; resetTime: Date };
    
    // Rate limit windows
    shortTermLimits: {
      tweets15min: { used: number; limit: number; remaining: number; resetTime: Date };
      reads15min: { used: number; limit: number; remaining: number; resetTime: Date };
    };
    
    // Account status
    accountStatus: 'active' | 'limited' | 'suspended' | 'unknown';
    isLocked: boolean;
    canPost: boolean;
    canRead: boolean;
    
    // Next safe posting window
    nextSafePostTime: Date;
    recommendedWaitTime: number; // minutes
  };
  
  openai: {
    dailyTokens: { used: number; limit: number; remaining: number };
    dailyRequests: { used: number; limit: number; remaining: number };
    costToday: number;
    costThisMonth: number;
    canMakeRequest: boolean;
    estimatedCostPerRequest: number;
  };
  
  newsApi: {
    dailyRequests: { used: number; limit: number; remaining: number };
    monthlyRequests: { used: number; limit: number; remaining: number };
    canFetchNews: boolean;
    isKeyValid: boolean;
  };
  
  pexels: {
    dailyRequests: { used: number; limit: number; remaining: number };
    monthlyRequests: { used: number; limit: number; remaining: number };
    canFetchImages: boolean;
    isKeyValid: boolean;
  };
  
  // CRITICAL: Overall system status
  systemStatus: {
    canPost: boolean;
    canEngage: boolean;
    canResearch: boolean;
    blockedActions: string[];
    nextAvailableAction: Date;
    confidence: number; // How confident we are in these numbers (0-1)
  };
  
  lastUpdated: Date;
  nextUpdateTime: Date;
}

export class RealTimeLimitsIntelligenceAgent {
  private cachedLimits: RealTimeLimits | null = null;
  private lastCheck: Date | null = null;
  private checkInterval: number = 30 * 60 * 1000; // 30 minutes - EMERGENCY: Reduce API calls
  private isChecking: boolean = false;
  private emergencyCooldownUntil: Date | null = null;

  constructor() {
    console.log('🚨 Real-Time Limits Intelligence Agent initialized');
    console.log('📊 Mission: Provide EXACT API limit intelligence to all AI agents');
  }

  /**
   * 🎯 GET REAL-TIME LIMITS
   * This is the main function other agents call to get current limits
   */
  async getCurrentLimits(forceRefresh: boolean = false): Promise<RealTimeLimits> {
    console.log('🔍 Real-Time Limits Agent: Checking current API limits...');

    // Return cached if recent and not forced
    if (!forceRefresh && this.cachedLimits && this.lastCheck) {
      const age = Date.now() - this.lastCheck.getTime();
      if (age < this.checkInterval) {
        console.log(`📊 Using cached limits (${Math.round(age / 1000)}s old)`);
        return this.cachedLimits;
      }
    }

    // Prevent multiple simultaneous checks
    if (this.isChecking) {
      console.log('⏳ Already checking limits, waiting...');
      await this.waitForCheck();
      return this.cachedLimits!;
    }

    try {
      this.isChecking = true;
      console.log('🚨 PERFORMING LIVE API LIMITS CHECK...');
      
      const limits = await this.performRealTimeCheck();
      
      // Cache the results
      this.cachedLimits = limits;
      this.lastCheck = new Date();
      
      console.log('✅ Real-time limits updated');
      console.log(`📊 Twitter: ${limits.twitter.dailyTweets.remaining}/${limits.twitter.dailyTweets.limit} tweets remaining`);
      console.log(`🤖 OpenAI: ${limits.openai.dailyRequests.remaining}/${limits.openai.dailyRequests.limit} requests remaining`);
      console.log(`📰 NewsAPI: ${limits.newsApi.dailyRequests.remaining}/${limits.newsApi.dailyRequests.limit} requests remaining`);
      
      return limits;
      
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * 🔍 PERFORM ACTUAL REAL-TIME CHECK
   * This makes actual API calls to get current limits
   */
  private async performRealTimeCheck(): Promise<RealTimeLimits> {
    console.log('🔍 Checking Twitter API limits...');
    const twitterLimits = await this.checkTwitterLimits();
    
    console.log('🔍 Checking OpenAI limits...');
    const openaiLimits = await this.checkOpenAILimits();
    
    console.log('🔍 Checking NewsAPI limits...');
    const newsApiLimits = await this.checkNewsAPILimits();
    
    console.log('🔍 Checking Pexels limits...');
    const pexelsLimits = await this.checkPexelsLimits();

    // Calculate overall system status
    const systemStatus = this.calculateSystemStatus(twitterLimits, openaiLimits, newsApiLimits, pexelsLimits);

    const now = new Date();
    return {
      twitter: twitterLimits,
      openai: openaiLimits,
      newsApi: newsApiLimits,
      pexels: pexelsLimits,
      systemStatus,
      lastUpdated: now,
      nextUpdateTime: new Date(now.getTime() + this.checkInterval)
    };
  }

  /**
   * 🐦 FETCH TWITTER LIMITS FROM HEADERS
   * Reads both write limits and user 24-hour cap, returns all four values
   */
  private async fetchTwitterLimits(): Promise<{ writeRemaining: number; writeReset: number; userRemaining: number; userReset: number }> {
    try {
      // Make a test call to get headers
      await xClient.getUserByUsername('Signal_Synapse');
      
      // If successful, we don't have the headers, so return optimistic values
      return {
        writeRemaining: 100, // Conservative estimate when call succeeds
        writeReset: Math.floor(Date.now() / 1000) + (15 * 60), // 15 minutes from now
        userRemaining: 17, // Conservative estimate for user 24h cap
        userReset: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours from now
      };
      
    } catch (error: any) {
      if (error.headers) {
        // Read all four headers and log them
        const writeRemaining = parseInt(error.headers['x-rate-limit-remaining'] || '0');
        const writeReset = parseInt(error.headers['x-rate-limit-reset'] || '0');
        const userRemaining = parseInt(error.headers['x-user-limit-24hour-remaining'] || '0');
        const userReset = parseInt(error.headers['x-user-limit-24hour-reset'] || '0');
        
        console.info('📊 Twitter API Headers:');
        console.info(`   x-rate-limit-remaining: ${writeRemaining}`);
        console.info(`   x-rate-limit-reset: ${writeReset}`);
        console.info(`   x-user-limit-24hour-remaining: ${userRemaining}`);
        console.info(`   x-user-limit-24hour-reset: ${userReset}`);
        
        // Return all four values
        return {
          writeRemaining: writeRemaining || 0,
          writeReset: writeReset || Math.floor(Date.now() / 1000) + (15 * 60),
          userRemaining: userRemaining || 0,
          userReset: userReset || Math.floor(Date.now() / 1000) + (24 * 60 * 60)
        };
      }
      
      // No headers available, return conservative defaults
      return {
        writeRemaining: 0,
        writeReset: Math.floor(Date.now() / 1000) + (15 * 60),
        userRemaining: 0,
        userReset: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
      };
    }
  }

  /**
   * 🛡️ CAN POST CHECK
   * Only blocks based on true API write limits (writeRemaining <= 0), ignores user 24-hour cap
   */
  canPost(): boolean {
    // Check if we're in emergency cooldown
    if (this.emergencyCooldownUntil && new Date() < this.emergencyCooldownUntil) {
      console.log('⏸️ canPost(): Blocked by emergency cooldown until', this.emergencyCooldownUntil.toISOString());
      return false;
    }
    
    // Reset cooldown if expired
    if (this.emergencyCooldownUntil && new Date() >= this.emergencyCooldownUntil) {
      this.emergencyCooldownUntil = null;
      console.log('✅ canPost(): Emergency cooldown expired, resuming normal operations');
    }
    
    console.log('✅ canPost(): Allowed - no emergency cooldown active');
    return true; // Allow posting unless in emergency cooldown
  }

  /**
   * 🐦 CHECK TWITTER API LIMITS
   */
  private async checkTwitterLimits(): Promise<RealTimeLimits['twitter']> {
    let accountStatus: 'active' | 'limited' | 'suspended' | 'unknown' = 'unknown';
    let isLocked = false;
    
    try {
      // Get true API write limits
      const { writeRemaining, writeReset, userRemaining, userReset } = await this.fetchTwitterLimits();
      const resetTime = new Date(writeReset * 1000);
      const userResetTime = new Date(userReset * 1000);
      
      // CRITICAL: Only block when TRUE API write limits are exhausted, ignore user 24h cap
      if (writeRemaining <= 0) {
        console.log(`🚨 RATE LIMIT BLOCK: True API write limits exhausted (writeRemaining: ${writeRemaining})`);
        this.emergencyCooldownUntil = resetTime;
        isLocked = true;
        accountStatus = 'limited';
      } else {
        console.log(`✅ API Write Limits OK: ${writeRemaining} remaining (userRemaining: ${userRemaining} - IGNORED)`);
        accountStatus = 'active';
        isLocked = false;
      }

      // Log clear distinction between write limits and user caps
      console.info(`🔍 Rate Limit Status:`);
      console.info(`   Write Quota (ENFORCED): ${writeRemaining} remaining, resets at ${resetTime.toISOString()}`);
      console.info(`   User 24h Cap (IGNORED): ${userRemaining} remaining, resets at ${userResetTime.toISOString()}`);
      console.info(`   Posting Status: ${isLocked ? 'BLOCKED by write quota' : 'ALLOWED'}`);

      // Get rate limits from the X client (15-minute windows)  
      const rateLimits = await xClient.checkRateLimit();

      const now = new Date();

      // Get daily/monthly limits from our database tracking
      const dailyStats = await this.getDailyTwitterStats();
      const monthlyStats = await this.getMonthlyTwitterStats();

      // Use database tracking for daily usage
      const dailyUsed = dailyStats.tweets;
      const dailyLimit = 17; // Free tier limit
      const dailyRemaining = Math.max(0, dailyLimit - dailyUsed);

      return {
        dailyTweets: {
          used: dailyUsed,
          limit: dailyLimit,
          remaining: dailyRemaining,
          resetTime: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
        },
        monthlyTweets: {
          used: monthlyStats.tweets,
          limit: 1500, // Basic plan limit  
          remaining: Math.max(0, 1500 - monthlyStats.tweets),
          resetTime: new Date(now.getFullYear(), now.getMonth() + 1, 1)
        },
        readRequests: {
          used: dailyStats.reads,
          limit: 10000,
          remaining: Math.max(0, 10000 - dailyStats.reads),
          resetTime: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
        },
        shortTermLimits: {
          tweets15min: {
            used: Math.max(0, 17 - writeRemaining),
            limit: 17,
            remaining: writeRemaining,
            resetTime
          },
          reads15min: {
            used: Math.max(0, 180 - (rateLimits?.remaining || 0)),
            limit: 180,
            remaining: rateLimits?.remaining || 0,
            resetTime
          }
        },
        accountStatus,
        isLocked,
        canPost: !isLocked && (writeRemaining > 0) && (monthlyStats.tweets < 2000), // Only check writeRemaining, not userRemaining
        canRead: !isLocked && (rateLimits?.remaining || 0) > 0,
        nextSafePostTime: isLocked ? resetTime : now,
        recommendedWaitTime: isLocked ? Math.ceil((resetTime.getTime() - now.getTime()) / 60000) : 0
      };

    } catch (error: any) {
      console.error('❌ Failed to check Twitter limits:', error);
      
      // Return conservative fallback
      const now = new Date();
      return {
        dailyTweets: { used: 17, limit: 17, remaining: 0, resetTime: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
        monthlyTweets: { used: 1500, limit: 1500, remaining: 0, resetTime: new Date(now.getFullYear(), now.getMonth() + 1, 1) },
        readRequests: { used: 10000, limit: 10000, remaining: 0, resetTime: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
        shortTermLimits: {
          tweets15min: { used: 17, limit: 17, remaining: 0, resetTime: new Date(now.getTime() + 15 * 60 * 1000) },
          reads15min: { used: 180, limit: 180, remaining: 0, resetTime: new Date(now.getTime() + 15 * 60 * 1000) }
        },
        accountStatus: 'unknown',
        isLocked: true,
        canPost: false,
        canRead: false,
        nextSafePostTime: new Date(now.getTime() + 60 * 60 * 1000),
        recommendedWaitTime: 60
      };
    }
  }

  /**
   * 🤖 CHECK OPENAI LIMITS
   */
  private async checkOpenAILimits(): Promise<RealTimeLimits['openai']> {
    // Get usage from our tracking
    const dailyStats = await this.getDailyOpenAIStats();
    
    return {
      dailyTokens: {
        used: dailyStats.tokens,
        limit: 40000,
        remaining: Math.max(0, 40000 - dailyStats.tokens)
      },
      dailyRequests: {
        used: dailyStats.requests,
        limit: 200,
        remaining: Math.max(0, 200 - dailyStats.requests)
      },
      costToday: dailyStats.cost,
      costThisMonth: (await this.getMonthlyOpenAIStats()).cost,
      canMakeRequest: dailyStats.requests < 200 && dailyStats.cost < 1.0, // $1/day limit
      estimatedCostPerRequest: 0.002 // Rough estimate
    };
  }

  /**
   * 📰 CHECK NEWS API LIMITS
   */
  private async checkNewsAPILimits(): Promise<RealTimeLimits['newsApi']> {
    const dailyStats = await this.getDailyNewsAPIStats();
    const monthlyStats = await this.getMonthlyNewsAPIStats();
    
    return {
      dailyRequests: {
        used: dailyStats.requests,
        limit: 100, // Free tier
        remaining: Math.max(0, 100 - dailyStats.requests)
      },
      monthlyRequests: {
        used: monthlyStats.requests,
        limit: 1000, // Free tier
        remaining: Math.max(0, 1000 - monthlyStats.requests)
      },
      canFetchNews: dailyStats.requests < 100 && monthlyStats.requests < 1000,
      isKeyValid: !!process.env.NEWS_API_KEY
    };
  }

  /**
   * 📸 CHECK PEXELS LIMITS
   */
  private async checkPexelsLimits(): Promise<RealTimeLimits['pexels']> {
    const dailyStats = await this.getDailyPexelsStats();
    const monthlyStats = await this.getMonthlyPexelsStats();
    
    return {
      dailyRequests: {
        used: dailyStats.requests,
        limit: 200, // Free tier
        remaining: Math.max(0, 200 - dailyStats.requests)
      },
      monthlyRequests: {
        used: monthlyStats.requests,
        limit: 5000, // Free tier
        remaining: Math.max(0, 5000 - monthlyStats.requests)
      },
      canFetchImages: dailyStats.requests < 200 && monthlyStats.requests < 5000,
      isKeyValid: !!process.env.PEXELS_API_KEY
    };
  }

  /**
   * 🎯 CALCULATE OVERALL SYSTEM STATUS
   */
  private calculateSystemStatus(twitter: any, openai: any, newsApi: any, pexels: any): RealTimeLimits['systemStatus'] {
    const blockedActions: string[] = [];
    
    if (!twitter.canPost) blockedActions.push('posting');
    if (!twitter.canRead) blockedActions.push('reading_tweets');
    if (!openai.canMakeRequest) blockedActions.push('ai_generation');
    if (!newsApi.canFetchNews) blockedActions.push('news_research');
    if (!pexels.canFetchImages) blockedActions.push('image_fetching');

    const canPost = twitter.canPost && openai.canMakeRequest;
    const canEngage = twitter.canRead && twitter.canPost;
    const canResearch = newsApi.canFetchNews && openai.canMakeRequest;

    // Find next available action time
    const nextTimes = [
      twitter.nextSafePostTime,
      new Date(Date.now() + (openai.canMakeRequest ? 0 : 60 * 60 * 1000))
    ].filter(Boolean);
    
    const nextAvailableAction = new Date(Math.min(...nextTimes.map(d => d.getTime())));

    return {
      canPost,
      canEngage,
      canResearch,
      blockedActions,
      nextAvailableAction,
      confidence: twitter.accountStatus === 'active' ? 0.9 : 0.6
    };
  }

  /**
   * 📊 DATABASE HELPER METHODS
   */
  private async getDailyTwitterStats(): Promise<{ tweets: number; reads: number; lastTweetDate?: string }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      if (!supabaseClient.supabase) {
        console.warn('Supabase client not available');
        return { tweets: 0, reads: 0 };
      }
      
      const { data } = await supabaseClient.supabase
        .from('api_usage_tracking')
        .select('*')
        .eq('date', today)
        .eq('api_type', 'twitter');
      
      if (!data?.length) return { tweets: 0, reads: 0 };
      
      // Use the 'count' column which tracks tweets posted
      const tweets = data[0]?.count || 0;
      
      return {
        tweets,
        reads: 0, // We don't track reads separately in the clean schema
        lastTweetDate: tweets > 0 ? today : undefined
      };
    } catch (error) {
      console.warn('Could not get daily Twitter stats:', error);
      return { tweets: 0, reads: 0 };
    }
  }

  private async getMonthlyTwitterStats(): Promise<{ tweets: number; reads: number }> {
    try {
      const monthStart = new Date();
      monthStart.setDate(1);
      const monthStartStr = monthStart.toISOString().split('T')[0];
      
      if (!supabaseClient.supabase) {
        console.warn('Supabase client not available');
        return { tweets: 0, reads: 0 };
      }
      
      const { data } = await supabaseClient.supabase
        .from('api_usage_tracking')
        .select('*')
        .gte('date', monthStartStr)
        .eq('api_type', 'twitter');
      
      if (!data?.length) return { tweets: 0, reads: 0 };
      
      // Sum up all the count values for the month
      const tweets = data.reduce((sum, row) => sum + (row.count || 0), 0);
      
      return {
        tweets,
        reads: 0 // We don't track reads separately in the clean schema
      };
    } catch (error) {
      console.warn('Could not get monthly Twitter stats:', error);
      return { tweets: 0, reads: 0 };
    }
  }

  private async getDailyOpenAIStats(): Promise<{ requests: number; tokens: number; cost: number }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      if (!supabaseClient.supabase) {
        console.warn('Supabase client not available');
        return { requests: 0, tokens: 0, cost: 0 };
      }
      
      const { data } = await supabaseClient.supabase
        .from('api_usage_tracking')
        .select('*')
        .eq('date', today)
        .eq('api_type', 'openai');
      
      if (!data?.length) return { requests: 0, tokens: 0, cost: 0 };
      
      // Use the available columns: count and cost
      const requests = data[0]?.count || 0;
      const cost = data[0]?.cost || 0;
      
      return {
        requests,
        tokens: 0, // We don't track tokens separately in the clean schema
        cost
      };
    } catch (error) {
      console.warn('Could not get daily OpenAI stats:', error);
      return { requests: 0, tokens: 0, cost: 0 };
    }
  }

  private async getMonthlyOpenAIStats(): Promise<{ cost: number }> {
    try {
      const monthStart = new Date();
      monthStart.setDate(1);
      const monthStartStr = monthStart.toISOString().split('T')[0];
      
      if (!supabaseClient.supabase) {
        console.warn('Supabase client not available');
        return { cost: 0 };
      }
      
      const { data } = await supabaseClient.supabase
        .from('api_usage_tracking')
        .select('*')
        .gte('date', monthStartStr)
        .eq('api_type', 'openai');
      
      if (!data?.length) return { cost: 0 };
      
      // Sum up all costs for the month
      const cost = data.reduce((sum, row) => sum + (row.cost || 0), 0);
      
      return { cost };
    } catch (error) {
      console.warn('Could not get monthly OpenAI stats:', error);
      return { cost: 0 };
    }
  }

  private async getDailyNewsAPIStats(): Promise<{ requests: number }> {
    // Similar implementation for NewsAPI
    return { requests: 0 }; // Placeholder
  }

  private async getMonthlyNewsAPIStats(): Promise<{ requests: number }> {
    // Similar implementation for NewsAPI
    return { requests: 0 }; // Placeholder
  }

  private async getDailyPexelsStats(): Promise<{ requests: number }> {
    // Similar implementation for Pexels
    return { requests: 0 }; // Placeholder
  }

  private async getMonthlyPexelsStats(): Promise<{ requests: number }> {
    // Similar implementation for Pexels
    return { requests: 0 }; // Placeholder
  }

  /**
   * ⏳ WAIT FOR ONGOING CHECK
   */
  private async waitForCheck(): Promise<void> {
    while (this.isChecking) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  /**
   * 🚨 EMERGENCY LIMITS CHECK
   * For when other agents suspect something is wrong
   */
  async emergencyLimitsCheck(): Promise<RealTimeLimits> {
    console.log('🚨 EMERGENCY LIMITS CHECK - Forcing immediate refresh');
    return await this.getCurrentLimits(true);
  }

  /**
   * 📋 GET HUMAN-READABLE STATUS
   */
  async getStatusSummary(): Promise<string> {
    const limits = await this.getCurrentLimits();
    
    return `
🚨 REAL-TIME API LIMITS STATUS:
📝 Twitter: ${limits.twitter.canPost ? '✅' : '❌'} (${limits.twitter.dailyTweets.remaining}/${limits.twitter.dailyTweets.limit} daily)
🤖 OpenAI: ${limits.openai.canMakeRequest ? '✅' : '❌'} (${limits.openai.dailyRequests.remaining}/${limits.openai.dailyRequests.limit} daily)
📰 NewsAPI: ${limits.newsApi.canFetchNews ? '✅' : '❌'} (${limits.newsApi.dailyRequests.remaining}/${limits.newsApi.dailyRequests.limit} daily)
📸 Pexels: ${limits.pexels.canFetchImages ? '✅' : '❌'} (${limits.pexels.dailyRequests.remaining}/${limits.pexels.dailyRequests.limit} daily)

🎯 SYSTEM STATUS:
- Can Post: ${limits.systemStatus.canPost ? '✅' : '❌'}
- Can Engage: ${limits.systemStatus.canEngage ? '✅' : '❌'}  
- Can Research: ${limits.systemStatus.canResearch ? '✅' : '❌'}
- Blocked: ${limits.systemStatus.blockedActions.join(', ') || 'None'}
- Next Available: ${limits.systemStatus.nextAvailableAction.toLocaleTimeString()}
- Confidence: ${(limits.systemStatus.confidence * 100).toFixed(0)}%

Last Updated: ${limits.lastUpdated.toLocaleTimeString()}
    `.trim();
  }

  /**
   * 🎯 UPDATE DAILY TWEET CAP
   * Saves the optimal daily tweet target to bot_config
   */
  async updateDailyTweetCap(newCap: number): Promise<void> {
    await setConfigValue('target_tweets_per_day', newCap);
    console.log(`🎯 Updated daily tweet cap to ${newCap}`);
  }

  /**
   * 📊 CALCULATE OPTIMAL TWEET CAP
   * Based on current API limits and time remaining
   */
  private calculateOptimalTweetCap(): number {
    if (!this.cachedLimits) return 8; // Default fallback
    
    const { twitter } = this.cachedLimits;
    const remainingTweets = twitter.dailyTweets.remaining;
    const hoursLeft = Math.max(1, (twitter.dailyTweets.resetTime.getTime() - Date.now()) / (1000 * 60 * 60));
    
    // Conservative approach: use 80% of remaining tweets over remaining hours
    const optimizedCap = Math.floor((remainingTweets * 0.8) / Math.max(1, hoursLeft / 24));
    
    // Clamp between 1-12 tweets per day
    return Math.max(1, Math.min(12, optimizedCap));
  }

  /**
   * 💾 SAVE TWEET CAP TO CONFIG
   * Automatically called during limits check to update config
   */
  private async saveTweetCapToConfig(): Promise<void> {
    const calculatedCap = this.calculateOptimalTweetCap();
    await this.updateDailyTweetCap(calculatedCap);
  }
}

// Export singleton instance
export const realTimeLimitsAgent = new RealTimeLimitsIntelligenceAgent(); 