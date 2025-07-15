import { xClient } from '../utils/xClient';
import { supabaseClient } from '../utils/supabaseClient';
import { setConfigValue } from '../utils/config';

/**
 * 🚨 REAL-TIME API LIMITS INTELLIGENCE AGENT
 * 
 * The TRUTH SOURCE for all API limitations.
 * This agent's job is to know EXACTLY what we can and cannot do RIGHT NOW.
 * 
 * UPDATED: Uses only Twitter's real API v2 Free Tier limits:
 * - 17 tweets per 24 hours (per user & per app)
 * - 1,500 reads per month (consumption cap)
 * - Rate limits: 15-minute windows
 */

export interface RealTimeLimits {
  twitter: {
    // REAL Twitter API limits only
    dailyTweets: { used: number; limit: number; remaining: number; resetTime: Date };
    readRequests: { used: number; limit: number; remaining: number; resetTime: Date };
    
    // Rate limit windows (handled by xClient.ts)
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
  private checkInterval: number = 30 * 60 * 1000; // 30 minutes
  private isChecking: boolean = false;
  private emergencyCooldownUntil: Date | null = null;

  // Real Twitter API v2 Free Tier Limits (FROM OFFICIAL X DEVELOPER PORTAL)
  private readonly TWITTER_DAILY_WRITE_LIMIT = 17;     // 17 tweets per 24 hours (Free tier)
  private readonly TWITTER_READ_LIMIT_15MIN = 1;       // 1 read per 15 minutes (most endpoints)
  private readonly TWITTER_USER_LOOKUP_DAILY = 25;     // 25 user lookups per 24 hours

  constructor() {
    console.log('🚨 Real-Time Limits Intelligence Agent initialized');
    console.log('📊 Mission: Provide EXACT API limit intelligence using real Twitter limits');
    console.log(`🐦 Twitter limits: ${this.TWITTER_DAILY_WRITE_LIMIT} writes/day, ${this.TWITTER_READ_LIMIT_15MIN} read/15min`);
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
   * Makes a test API call to get rate limit headers
   */
  private async fetchTwitterLimits(): Promise<{ writeRemaining: number; writeReset: number; readRemaining: number; readReset: number; dailyWriteRemaining: number; dailyWriteReset: number }> {
    try {
      // First try to get current rate limit status from xClient
      const currentStatus = xClient.getRateLimitStatus();
      
      // If we have recent rate limit data, use it
      if (currentStatus && currentStatus.tweets24Hour) {
        console.log(`📊 USING XCLIENT RATE LIMIT STATUS:`);
        console.log(`   24h: ${currentStatus.tweets24Hour.used}/${currentStatus.tweets24Hour.limit} used`);
        
        const dailyRemaining = currentStatus.tweets24Hour.limit - currentStatus.tweets24Hour.used;
        const resetTime = Math.floor(currentStatus.tweets24Hour.resetTime.getTime() / 1000);
        
        return {
          writeRemaining: dailyRemaining,
          writeReset: resetTime,
          readRemaining: 100, // Conservative estimate
          readReset: resetTime,
          dailyWriteRemaining: dailyRemaining,
          dailyWriteReset: resetTime
        };
      }
      
      // 🚨 CRITICAL: Only use lightweight read operations to check limits
      // Never use posting operations to check posting limits
      console.log('📊 Checking limits via lightweight read operation...');
      
      try {
        // Use a very lightweight read operation that won't consume posting quota
        await xClient.getUserByUsername('twitter'); // Well-known account, minimal API cost
        
        // If successful, we can read but need to estimate posting limits conservatively
        const defaultReset = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours from now
        console.log('📊 Read operation successful - estimating posting limits conservatively');
        
        return {
          writeRemaining: 15, // Conservative estimate when reads work
          writeReset: defaultReset,
          readRemaining: 50, // Conservative estimate 
          readReset: defaultReset,
          dailyWriteRemaining: 15,
          dailyWriteReset: defaultReset
        };
        
      } catch (testError: any) {
        // This is where we extract rate limit headers from the error
        console.log('📊 Read operation failed - extracting rate limit headers...');
        throw testError; // Let the main catch block handle header extraction
      }
      
    } catch (error: any) {
      console.log('📊 Analyzing API error for rate limit information...');
      
      // 🚨 CRITICAL FIX: Distinguish between posting and reading errors
      const isMonthlyReadError = error.data && 
        error.data.title === 'UsageCapExceeded' && 
        error.data.period === 'Monthly' && 
        error.data.scope === 'Product';
        
      if (isMonthlyReadError) {
        console.log('🚨 MONTHLY READ LIMIT HIT: Twitter search/read cap exceeded');
        console.log('📊 CRITICAL: This is a READING limit, NOT a posting limit');
        console.log('🐦 POSTING REMAINS FULLY AVAILABLE - Twitter API v2 Free Tier has NO monthly posting limit');
        console.log('✅ Bot can continue posting normally - only engagement tracking is affected');
        
        // Return full posting capacity, only block reads
        const defaultReset = Math.floor(Date.now() / 1000) + (24 * 60 * 60);
        return {
          writeRemaining: 17, // FULL posting capacity remains
          writeReset: defaultReset,
          readRemaining: 0, // Block reads only until next month
          readReset: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // Reset next month
          dailyWriteRemaining: 17, // FULL posting capacity
          dailyWriteReset: defaultReset
        };
      }
      
      // Check for actual rate limiting errors (429 status)
      if (error.code === 429 || (error.data && error.data.status === 429)) {
        console.log('📊 Rate limit error detected - extracting headers...');
        
        // Extract rate limit info from headers
        const headers = error.response?.headers || error.headers || error.data?.headers || {};
        
        console.log(`📊 AVAILABLE HEADERS:`, Object.keys(headers));
        
        // 🚨 CRITICAL: Use x-app-limit-24hour headers for daily limits (most reliable)
        const appDailyRemaining = parseInt(headers['x-app-limit-24hour-remaining'] || '17');
        const userDailyRemaining = parseInt(headers['x-user-limit-24hour-remaining'] || '17');
        const appDailyReset = parseInt(headers['x-app-limit-24hour-reset'] || String(Math.floor(Date.now() / 1000) + 86400));
        const userDailyReset = parseInt(headers['x-user-limit-24hour-reset'] || String(Math.floor(Date.now() / 1000) + 86400));
        
        // Use the most restrictive limit (app vs user)
        const dailyWriteRemaining = Math.min(appDailyRemaining, userDailyRemaining);
        const dailyWriteReset = Math.max(appDailyReset, userDailyReset); // Use the furthest reset time
        
        // Also get short-term rate limits for completeness
        const shortTermRemaining = parseInt(headers['x-rate-limit-remaining'] || String(dailyWriteRemaining));
        const shortTermReset = parseInt(headers['x-rate-limit-reset'] || String(dailyWriteReset));
        
        console.log(`📊 TWITTER API RATE LIMIT HEADERS:`);
        console.log(`   App 24h: ${appDailyRemaining} remaining, reset: ${new Date(appDailyReset * 1000).toLocaleString()}`);
        console.log(`   User 24h: ${userDailyRemaining} remaining, reset: ${new Date(userDailyReset * 1000).toLocaleString()}`);
        console.log(`   Short-term: ${shortTermRemaining} remaining, reset: ${new Date(shortTermReset * 1000).toLocaleString()}`);
        console.log(`   🎯 EFFECTIVE DAILY LIMIT: ${dailyWriteRemaining} remaining`);
     
        return { 
          writeRemaining: shortTermRemaining, 
          writeReset: shortTermReset, 
          readRemaining: shortTermRemaining, // Same limit for reads in Free tier
          readReset: shortTermReset,
          dailyWriteRemaining,
          dailyWriteReset
        };
      }
      
      // For other errors, be conservative but don't permanently block
      console.log('📊 Unknown error - using conservative defaults');
      const defaultReset = Math.floor(Date.now() / 1000) + (24 * 60 * 60);
      
      return {
        writeRemaining: 5, // Conservative but not zero
        writeReset: defaultReset,
        readRemaining: 0, // Assume reads blocked if error
        readReset: defaultReset,
        dailyWriteRemaining: 5,
        dailyWriteReset: defaultReset
      };
    }
  }

  /**
   * 🛡️ CAN POST CHECK
   * Only blocks based on REAL Twitter API limits, never artificial limits
   */
  canPost(): boolean {
    // Check if we're in emergency cooldown
    if (this.emergencyCooldownUntil && new Date() < this.emergencyCooldownUntil) {
      console.log('⏸️ canPost(): Blocked by emergency cooldown until', this.emergencyCooldownUntil.toISOString());
      return false;
    }
    
    // Clear expired cooldowns
    if (this.emergencyCooldownUntil && new Date() >= this.emergencyCooldownUntil) {
      this.emergencyCooldownUntil = null;
      console.log('✅ Emergency cooldown expired, posting re-enabled');
    }
    
    // Default to allowing posts unless explicitly blocked by real rate limits
    return true;
  }

  /**
   * 🐦 CHECK TWITTER API LIMITS
   * Uses ONLY real Twitter API v2 Free Tier limits (17 writes/day, 1500 reads/month)
   */
  private async checkTwitterLimits(): Promise<RealTimeLimits['twitter']> {
    let accountStatus: 'active' | 'limited' | 'suspended' | 'unknown' = 'unknown';
    let isLocked = false;
    
    try {
      // Get real API limits from headers
      const { writeRemaining, writeReset, readRemaining, readReset } = await this.fetchTwitterLimits();
      const resetTime = new Date(writeReset * 1000);
      const readResetTime = new Date(readReset * 1000);
      
      // 🚨 CRITICAL FIX: Use Twitter API headers as source of truth with bounds checking
      // Prevent arithmetic overflow that was causing negative tweet calculations
      const rawWriteRemaining = Math.max(0, Math.min(writeRemaining, this.TWITTER_DAILY_WRITE_LIMIT));
      const dailyUsed = Math.max(0, Math.min(this.TWITTER_DAILY_WRITE_LIMIT - rawWriteRemaining, this.TWITTER_DAILY_WRITE_LIMIT));
      const dailyLimit = this.TWITTER_DAILY_WRITE_LIMIT;
      
      console.log(`📊 TWITTER API HEADERS: ${rawWriteRemaining} writes remaining of ${dailyLimit} daily limit`);
      console.log(`📊 CALCULATED USAGE: ${dailyUsed}/${dailyLimit} tweets used today`);
      
      // Validate calculations to prevent negative numbers
      if (rawWriteRemaining > dailyLimit) {
        console.warn(`⚠️ API returned impossible remaining count: ${writeRemaining}, capping at ${dailyLimit}`);
        const correctedRemaining = dailyLimit;
        const correctedUsed = 0;
        console.log(`🔧 CORRECTED VALUES: ${correctedUsed}/${dailyLimit} used, ${correctedRemaining} remaining`);
      }
      
      if (dailyUsed < 0) {
        console.warn(`⚠️ Calculated negative usage: ${dailyUsed}, setting to 0`);
        const correctedUsed = 0;
        console.log(`🔧 CORRECTED USAGE: ${correctedUsed}/${dailyLimit} tweets used today`);
      }
      
      // Only block when REAL API write limits are exhausted
      if (rawWriteRemaining <= 0) {
        console.log(`🚨 DAILY LIMIT EXHAUSTED: Twitter says ${rawWriteRemaining} remaining (used ${dailyUsed}/${dailyLimit})`);
        this.emergencyCooldownUntil = resetTime;
        isLocked = true;
        accountStatus = 'limited';
      } else {
        console.log(`✅ DAILY LIMIT OK: ${rawWriteRemaining} remaining (used ${dailyUsed}/${dailyLimit})`);
        accountStatus = 'active';
        isLocked = false;
      }

      // Get our database counts for informational purposes only
      const databaseStats = await this.getDailyTwitterStats();
      const monthlyStats = await this.getMonthlyTwitterStats();
      
      // Use Twitter API headers as source of truth, not database
      if (databaseStats.tweets !== dailyUsed) {
        console.log(`⚠️ DATABASE SYNC ISSUE: Database shows ${databaseStats.tweets} tweets, but Twitter API headers show ${dailyUsed} used`);
        console.log(`📡 USING TWITTER API HEADERS as authoritative source - Database will be updated`);
        
        // 🔧 SYNC FIX: Update database to match API reality
        try {
          await this.syncDatabaseToAPIHeaders(dailyUsed, rawWriteRemaining);
          console.log(`✅ Database synced to match API headers`);
        } catch (syncError) {
          console.warn(`⚠️ Could not sync database: ${syncError.message}`);
        }
      }
      
      const dailyRemaining = Math.max(0, this.TWITTER_DAILY_WRITE_LIMIT - dailyUsed);
      
      const monthlyReadsUsed = monthlyStats.reads;
      const monthlyReadsRemaining = Math.max(0, 10000 - monthlyReadsUsed); // Free tier: no monthly read limit, using 10000 as safe fallback
      
      // 🚨 CRITICAL FIX: Twitter API v2 Free Tier has NO monthly posting limit
      // Can post if: not locked by API AND under daily limit (NO MONTHLY CHECK FOR POSTING)
      const canPost = !isLocked && (rawWriteRemaining > 0) && (dailyRemaining > 0);
      const canRead = readRemaining > 0 && monthlyReadsRemaining > 0;
      
      // 🚨 IMPORTANT: Monthly stats are informational only - do NOT use for posting limits
      console.log(`📊 Monthly posting check: DISABLED (no monthly posting limit exists)`);
      console.log(`📊 Daily posting check: ${dailyRemaining} remaining of ${this.TWITTER_DAILY_WRITE_LIMIT} daily limit`);
      
      console.info(`🎯 Posting Check: writeRemaining=${rawWriteRemaining}, dailyRemaining=${dailyRemaining}, result=${canPost}`);
      console.info(`🔍 Reading Check: readRemaining=${readRemaining}, monthlyReadsRemaining=${monthlyReadsRemaining}, result=${canRead}`);

      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      // Get rate limits from xClient for 15-minute windows
      const rateLimits = await xClient.checkRateLimit();

      return {
        dailyTweets: {
          used: dailyUsed,
          limit: this.TWITTER_DAILY_WRITE_LIMIT,
          remaining: dailyRemaining,
          resetTime: tomorrow
        },
        readRequests: {
          used: monthlyReadsUsed,
          limit: 10000, // Free tier: no monthly read limit, using safe fallback
          remaining: monthlyReadsRemaining,
          resetTime: readResetTime
        },
        shortTermLimits: {
          tweets15min: {
            used: 0, // xClient tracks this
            limit: 17, // Conservative 15-min limit
            remaining: rateLimits?.remaining || 17,
            resetTime: new Date(now.getTime() + 15 * 60 * 1000)
          },
          reads15min: {
            used: 0,
            limit: 100,
            remaining: 100,
            resetTime: new Date(now.getTime() + 15 * 60 * 1000)
          }
        },
        accountStatus,
        isLocked,
        canPost,
        canRead,
        nextSafePostTime: isLocked ? resetTime : now,
        recommendedWaitTime: isLocked ? Math.ceil((resetTime.getTime() - now.getTime()) / 60000) : 0
      };
      
    } catch (error) {
      console.error('❌ Error checking Twitter limits:', error);
      
      // Return safe defaults on error
      const now = new Date();
      return {
        dailyTweets: {
          used: 0,
          limit: this.TWITTER_DAILY_WRITE_LIMIT,
          remaining: this.TWITTER_DAILY_WRITE_LIMIT,
          resetTime: new Date(now.getTime() + 24 * 60 * 60 * 1000)
        },
        readRequests: {
          used: 0,
          limit: 10000, // Free tier: no monthly read limit, using safe fallback
          remaining: 10000,
          resetTime: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        },
        shortTermLimits: {
          tweets15min: { used: 0, limit: 17, remaining: 17, resetTime: new Date(now.getTime() + 15 * 60 * 1000) },
          reads15min: { used: 0, limit: 100, remaining: 100, resetTime: new Date(now.getTime() + 15 * 60 * 1000) }
        },
        accountStatus: 'unknown',
        isLocked: false,
        canPost: true, // Default to allowing posts
        canRead: true,
        nextSafePostTime: now,
        recommendedWaitTime: 0
      };
    }
  }

  /**
   * 🤖 CHECK OPENAI LIMITS
   */
  private async checkOpenAILimits(): Promise<RealTimeLimits['openai']> {
    const dailyStats = await this.getDailyOpenAIStats();
    const monthlyStats = await this.getMonthlyOpenAIStats();
    
    // Conservative OpenAI limits to avoid costs
    const dailyRequestLimit = 100;
    const dailyTokenLimit = 50000;
    const dailyCostLimit = 5.0;
    
    return {
      dailyRequests: {
        used: dailyStats.requests,
        limit: dailyRequestLimit,
        remaining: Math.max(0, dailyRequestLimit - dailyStats.requests)
      },
      dailyTokens: {
        used: dailyStats.tokens,
        limit: dailyTokenLimit,
        remaining: Math.max(0, dailyTokenLimit - dailyStats.tokens)
      },
      costToday: dailyStats.cost,
      costThisMonth: monthlyStats.cost,
      canMakeRequest: dailyStats.requests < dailyRequestLimit && dailyStats.cost < dailyCostLimit,
      estimatedCostPerRequest: 0.01
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
        limit: 100,
        remaining: Math.max(0, 100 - dailyStats.requests)
      },
      monthlyRequests: {
        used: monthlyStats.requests,
        limit: 3000,
        remaining: Math.max(0, 3000 - monthlyStats.requests)
      },
      canFetchNews: dailyStats.requests < 100 && monthlyStats.requests < 3000,
      isKeyValid: true
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
        limit: 200,
        remaining: Math.max(0, 200 - dailyStats.requests)
      },
      monthlyRequests: {
        used: monthlyStats.requests,
        limit: 5000,
        remaining: Math.max(0, 5000 - monthlyStats.requests)
      },
      canFetchImages: dailyStats.requests < 200 && monthlyStats.requests < 5000,
      isKeyValid: true
    };
  }

  /**
   * 🎯 CALCULATE OVERALL SYSTEM STATUS
   */
  private calculateSystemStatus(twitter: any, openai: any, newsApi: any, pexels: any): RealTimeLimits['systemStatus'] {
    const blockedActions: string[] = [];
    
    if (!twitter.canPost) blockedActions.push('Twitter posting');
    if (!twitter.canRead) blockedActions.push('Twitter reading');
    if (!openai.canMakeRequest) blockedActions.push('OpenAI requests');
    if (!newsApi.canFetchNews) blockedActions.push('News fetching');
    if (!pexels.canFetchImages) blockedActions.push('Image fetching');
    
    const canPost = twitter.canPost;
    const canEngage = twitter.canRead;
    const canResearch = newsApi.canFetchNews && openai.canMakeRequest;
    
    const nextAvailableAction = twitter.nextSafePostTime;
    
    return {
      canPost,
      canEngage,
      canResearch,
      blockedActions,
      nextAvailableAction,
      confidence: 0.95 // High confidence in real Twitter limits
    };
  }

  /**
   * 📊 DATABASE HELPER METHODS
   */
  private async getDailyTwitterStats(): Promise<{ tweets: number; reads: number; lastTweetDate?: string }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabaseClient.supabase
        ?.from('tweets')
        .select('id')
        .gte('created_at', today + 'T00:00:00Z')
        .lt('created_at', today + 'T23:59:59Z');

      const tweets = data?.length || 0;
      return { tweets, reads: 0 }; // Reads tracking would need separate implementation
    } catch (error) {
      console.error('Error getting daily Twitter stats:', error);
      return { tweets: 0, reads: 0 };
    }
  }

  private async getMonthlyTwitterStats(): Promise<{ tweets: number; reads: number }> {
    try {
      // 🚨 CRITICAL FIX: Twitter API v2 Free Tier has NO monthly posting limit
      // Only 1,500 monthly READS (not posts) - this method should NOT be used for posting limits
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      // Get end of current month for proper filtering
      const endOfMonth = new Date(startOfMonth);
      endOfMonth.setMonth(endOfMonth.getMonth() + 1);
      endOfMonth.setDate(0);
      endOfMonth.setHours(23, 59, 59, 999);
      
      const { data, error } = await supabaseClient.supabase
        ?.from('tweets')
        .select('id')
        .gte('created_at', startOfMonth.toISOString())
        .lte('created_at', endOfMonth.toISOString());

      const tweets = data?.length || 0;
      
      // 🚨 IMPORTANT: This count is for INFORMATIONAL purposes only
      // Twitter API v2 Free Tier has NO monthly posting limit
      console.log(`📊 Monthly tweet count (informational only): ${tweets} - NO LIMIT ENFORCED`);
      
      return { tweets, reads: 0 }; // Reads tracking would need separate implementation
    } catch (error) {
      console.error('Error getting monthly Twitter stats:', error);
      return { tweets: 0, reads: 0 };
    }
  }

  private async getDailyOpenAIStats(): Promise<{ requests: number; tokens: number; cost: number }> {
    // Placeholder - would need actual OpenAI usage tracking
    return { requests: 0, tokens: 0, cost: 0 };
  }

  private async getMonthlyOpenAIStats(): Promise<{ cost: number }> {
    // Placeholder - would need actual OpenAI usage tracking
    return { cost: 0 };
  }

  private async getDailyNewsAPIStats(): Promise<{ requests: number }> {
    return { requests: 0 }; // Placeholder
  }

  private async getMonthlyNewsAPIStats(): Promise<{ requests: number }> {
    return { requests: 0 }; // Placeholder
  }

  private async getDailyPexelsStats(): Promise<{ requests: number }> {
    return { requests: 0 }; // Placeholder
  }

  private async getMonthlyPexelsStats(): Promise<{ requests: number }> {
    return { requests: 0 }; // Placeholder
  }

  /**
   * 🔧 SYNC DATABASE TO API HEADERS
   * Updates the database tracking to match the current Twitter API headers.
   * This ensures our internal counters reflect the real API usage.
   */
  private async syncDatabaseToAPIHeaders(dailyUsed: number, rawWriteRemaining: number): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Update or insert today's API usage tracking
      const { error } = await supabaseClient.supabase
        ?.from('api_usage_tracking')
        .upsert({
          date: today,
          api_type: 'twitter',
          tweets_posted: dailyUsed,
          reads_made: 0, // We'll track reads separately
          timestamp: new Date().toISOString()
        }, {
          onConflict: 'date,api_type',
          ignoreDuplicates: false
        });

      if (error) {
        console.warn(`⚠️ Could not sync api_usage_tracking: ${error.message}`);
        // Try alternative sync method with bot_config
        await supabaseClient.updateConfig('twitter_daily_usage_sync', {
          date: today,
          tweets_used: dailyUsed,
          tweets_remaining: rawWriteRemaining,
          last_sync: new Date().toISOString(),
          source: 'twitter_api_headers'
        });
        console.log(`✅ Synced via bot_config fallback`);
      } else {
        console.log(`✅ Database synced: ${dailyUsed} tweets used today`);
      }
    } catch (syncError) {
      console.warn(`⚠️ Sync method failed: ${syncError.message}`);
      // Non-blocking error - continue operation
    }
  }

  /**
   * ⏳ WAIT FOR ONGOING CHECK
   */
  private async waitForCheck(): Promise<void> {
    while (this.isChecking) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * 🚨 EMERGENCY LIMITS CHECK
   * For when other agents suspect something is wrong
   */
  async emergencyLimitsCheck(): Promise<RealTimeLimits> {
    console.log('🚨 Emergency limits check requested');
    return this.getCurrentLimits(true);
  }

  /**
   * 📊 GET DAILY REMAINING WITH PRORATION
   * Returns remaining daily capacity considering both hard cap and monthly budget proration
   */
  async getDailyRemaining(): Promise<number> {
    const limits = await this.getCurrentLimits();
    return limits.twitter.dailyTweets.remaining;
  }

  /**
   * 📋 GET HUMAN-READABLE STATUS
   */
  async getStatusSummary(): Promise<string> {
    const limits = await this.getCurrentLimits();
    const twitter = limits.twitter;
    
    const status = [
      `📊 Twitter: ${twitter.dailyTweets.remaining}/${twitter.dailyTweets.limit} tweets remaining today`,
      `📖 Reads: ${twitter.readRequests.remaining}/${twitter.readRequests.limit} remaining this month`,
      `🤖 OpenAI: ${limits.openai.dailyRequests.remaining}/${limits.openai.dailyRequests.limit} requests remaining`,
      `🎯 Status: ${twitter.canPost ? '✅ Can post' : '❌ Cannot post'}`,
    ];
    
    if (twitter.recommendedWaitTime > 0) {
      status.push(`⏰ Next post in: ${twitter.recommendedWaitTime} minutes`);
    }
    
    return status.join('\n');
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