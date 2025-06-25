import { xClient } from '../utils/xClient';
import { supabaseClient } from '../utils/supabaseClient';

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
  private checkInterval: number = 5 * 60 * 1000; // 5 minutes
  private isChecking: boolean = false;

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
   * 🐦 CHECK TWITTER API LIMITS
   */
  private async checkTwitterLimits(): Promise<RealTimeLimits['twitter']> {
    try {
      const client = xClient;
      
      // Try to get rate limit status
      let rateLimits;
      let canMakeRequests = true;
      
      try {
        rateLimits = await client.checkRateLimit();
      } catch (error: any) {
        console.log('⚠️ Could not fetch rate limits directly:', error.code);
        canMakeRequests = false;
        
        // If we get 429, extract what we can
        if (error.code === 429) {
          const resetTime = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now
          return {
            dailyTweets: { used: 20, limit: 20, remaining: 0, resetTime },
            monthlyTweets: { used: 1500, limit: 1500, remaining: 0, resetTime },
            readRequests: { used: 10000, limit: 10000, remaining: 0, resetTime },
            shortTermLimits: {
              tweets15min: { used: 17, limit: 17, remaining: 0, resetTime },
              reads15min: { used: 180, limit: 180, remaining: 0, resetTime }
            },
            accountStatus: 'limited',
            isLocked: true,
            canPost: false,
            canRead: false,
            nextSafePostTime: resetTime,
            recommendedWaitTime: Math.ceil((resetTime.getTime() - Date.now()) / 60000)
          };
        }
      }

      // Try to get user info to test basic access
      let accountStatus: 'active' | 'limited' | 'suspended' | 'unknown' = 'unknown';
      let isLocked = false;
      
      try {
        await client.getUserByUsername('signalAndSynapse'); // Test call
        accountStatus = 'active';
      } catch (error: any) {
        console.log('⚠️ Account access test failed:', error.code);
        if (error.code === 429) {
          accountStatus = 'limited';
          isLocked = true;
        } else if (error.code === 403) {
          accountStatus = 'suspended';
          isLocked = true;
        }
      }

      const now = new Date();
      const resetTime = new Date(now.getTime() + 15 * 60 * 1000); // Fallback: 15 minutes

      // Get daily/monthly limits from our database tracking
      const dailyStats = await this.getDailyTwitterStats();
      const monthlyStats = await this.getMonthlyTwitterStats();

      return {
        dailyTweets: {
          used: dailyStats.tweets,
          limit: 20, // Basic plan limit
          remaining: Math.max(0, 20 - dailyStats.tweets),
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
            used: Math.max(0, 17 - (rateLimits?.remaining || 0)),
            limit: 17,
            remaining: rateLimits?.remaining || 0,
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
        canPost: !isLocked && (dailyStats.tweets < 20) && (monthlyStats.tweets < 1500) && (rateLimits?.remaining || 0) > 0,
        canRead: !isLocked && (rateLimits?.remaining || 0) > 0,
        nextSafePostTime: isLocked ? resetTime : now,
        recommendedWaitTime: isLocked ? Math.ceil((resetTime.getTime() - now.getTime()) / 60000) : 0
      };

    } catch (error: any) {
      console.error('❌ Failed to check Twitter limits:', error);
      
      // Return conservative fallback
      const now = new Date();
      return {
        dailyTweets: { used: 20, limit: 20, remaining: 0, resetTime: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
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
  private async getDailyTwitterStats(): Promise<{ tweets: number; reads: number }> {
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
      
      return {
        tweets: data.reduce((sum, row) => sum + (row.tweets_posted || 0), 0),
        reads: data.reduce((sum, row) => sum + (row.reads_made || 0), 0)
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
      
      return {
        tweets: data.reduce((sum, row) => sum + (row.tweets_posted || 0), 0),
        reads: data.reduce((sum, row) => sum + (row.reads_made || 0), 0)
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
      
      return {
        requests: data.reduce((sum, row) => sum + (row.requests_made || 0), 0),
        tokens: data.reduce((sum, row) => sum + (row.tokens_used || 0), 0),
        cost: data.reduce((sum, row) => sum + (row.cost_incurred || 0), 0)
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
      
      return {
        cost: data.reduce((sum, row) => sum + (row.cost_incurred || 0), 0)
      };
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
}

// Export singleton instance
export const realTimeLimitsAgent = new RealTimeLimitsIntelligenceAgent(); 