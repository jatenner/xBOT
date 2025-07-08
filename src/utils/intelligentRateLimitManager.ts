/**
 * 🧠 INTELLIGENT RATE LIMIT MANAGER
 * 
 * Handles all API rate limits intelligently with automatic recovery
 * Prevents the bot from getting stuck when hitting 429 errors
 * Provides smart waiting and retry strategies
 */

import { supabaseClient } from './supabaseClient';

export interface APILimit {
  service: 'twitter' | 'openai' | 'newsapi' | 'pexels';
  endpoint: string;
  used: number;
  limit: number;
  remaining: number;
  resetTime: Date;
  windowType: '15min' | '1hour' | '3hour' | '24hour' | '30day';
  lastError?: {
    code: number;
    message: string;
    timestamp: Date;
    retryAfter?: number; // seconds
  };
}

export interface RateLimitStatus {
  isLimited: boolean;
  blockedUntil?: Date;
  nextRetryTime?: Date;
  waitTimeMinutes?: number;
  canRetry: boolean;
  confidence: number; // 0-1 how confident we are in these numbers
  strategy: 'immediate' | 'exponential_backoff' | 'wait_for_reset' | 'blocked';
}

export interface RecoveryPlan {
  action: 'wait' | 'retry' | 'switch_endpoint' | 'disable_temporarily';
  waitTime: number; // minutes
  alternativeAction?: string;
  message: string;
  confidence: number;
}

class IntelligentRateLimitManager {
  private limits: Map<string, APILimit> = new Map();
  private errorHistory: Map<string, Array<{ timestamp: Date; error: any }>> = new Map();
  private lastUpdate: Date = new Date();
  private recoveryStrategies: Map<string, RecoveryPlan> = new Map();

  constructor() {
    console.log('🧠 Intelligent Rate Limit Manager initialized');
    this.initializeKnownLimits();
    this.startPeriodicCleanup();
  }

  /**
   * 🎯 MAIN FUNCTION: Check if we can make an API call
   */
  async canMakeCall(service: string, endpoint: string): Promise<RateLimitStatus> {
    const key = `${service}:${endpoint}`;
    const limit = this.limits.get(key);
    
    if (!limit) {
      // Unknown endpoint - allow but monitor
      return {
        isLimited: false,
        canRetry: true,
        confidence: 0.5,
        strategy: 'immediate'
      };
    }

    // Check if we're currently in a known rate limit
    if (limit.lastError && limit.lastError.code === 429) {
      const retryTime = this.calculateRetryTime(limit);
      if (new Date() < retryTime) {
        const waitMinutes = Math.ceil((retryTime.getTime() - Date.now()) / (1000 * 60));
        return {
          isLimited: true,
          blockedUntil: retryTime,
          nextRetryTime: retryTime,
          waitTimeMinutes: waitMinutes,
          canRetry: true,
          confidence: 0.9,
          strategy: 'wait_for_reset'
        };
      }
    }

    // Check current usage against limits
    if (limit.remaining <= 0) {
      const waitMinutes = Math.ceil((limit.resetTime.getTime() - Date.now()) / (1000 * 60));
      return {
        isLimited: true,
        blockedUntil: limit.resetTime,
        nextRetryTime: limit.resetTime,
        waitTimeMinutes: waitMinutes,
        canRetry: true,
        confidence: 0.8,
        strategy: 'wait_for_reset'
      };
    }

    // Check if we're close to limits (80% threshold)
    const usagePercent = limit.used / limit.limit;
    if (usagePercent >= 0.8) {
      return {
        isLimited: false,
        canRetry: true,
        confidence: 0.7,
        strategy: 'exponential_backoff',
        waitTimeMinutes: Math.ceil(usagePercent * 30) // Progressive slowdown
      };
    }

    return {
      isLimited: false,
      canRetry: true,
      confidence: 0.9,
      strategy: 'immediate'
    };
  }

  /**
   * 🚨 HANDLE API ERROR - Learn from failures
   */
  async handleAPIError(service: string, endpoint: string, error: any): Promise<RecoveryPlan> {
    const key = `${service}:${endpoint}`;
    console.log(`🚨 API Error for ${key}:`, error.status || error.code, error.message);

    // Record the error
    this.recordError(key, error);

    // Update rate limit info based on error
    await this.updateLimitFromError(key, error);

    // Generate recovery plan
    const plan = this.generateRecoveryPlan(key, error);
    this.recoveryStrategies.set(key, plan);

    // Log to database for analysis
    await this.logErrorToDatabase(service, endpoint, error, plan);

    return plan;
  }

  /**
   * ✅ HANDLE SUCCESSFUL CALL - Update counters
   */
  async handleSuccessfulCall(service: string, endpoint: string, responseHeaders?: any): Promise<void> {
    const key = `${service}:${endpoint}`;
    
    // Clear any previous errors for this endpoint
    const limit = this.limits.get(key);
    if (limit?.lastError) {
      delete limit.lastError;
    }

    // Update limits from response headers if available
    if (responseHeaders) {
      await this.updateLimitFromHeaders(key, responseHeaders);
    } else {
      // Just increment usage counter
      await this.incrementUsage(key);
    }

    // Log successful call
    await this.logSuccessToDatabase(service, endpoint);
  }

  /**
   * 🔄 UPDATE LIMITS FROM ERROR RESPONSE
   */
  private async updateLimitFromError(key: string, error: any): Promise<void> {
    const limit = this.limits.get(key) || this.createDefaultLimit(key);
    
    if (error.status === 429 || error.code === 429) {
      // Rate limit hit
      limit.lastError = {
        code: 429,
        message: error.message || 'Rate limit exceeded',
        timestamp: new Date(),
        retryAfter: this.extractRetryAfter(error)
      };

      // If we have retry-after info, use it
      if (limit.lastError.retryAfter) {
        limit.resetTime = new Date(Date.now() + (limit.lastError.retryAfter * 1000));
      }

      // Mark remaining as 0
      limit.remaining = 0;
    }

    this.limits.set(key, limit);
  }

  /**
   * 📊 UPDATE LIMITS FROM RESPONSE HEADERS
   */
  private async updateLimitFromHeaders(key: string, headers: any): Promise<void> {
    const limit = this.limits.get(key) || this.createDefaultLimit(key);

    // Parse Twitter rate limit headers
    if (headers['x-rate-limit-limit']) {
      limit.limit = parseInt(headers['x-rate-limit-limit']);
    }
    if (headers['x-rate-limit-remaining']) {
      limit.remaining = parseInt(headers['x-rate-limit-remaining']);
    }
    if (headers['x-rate-limit-reset']) {
      limit.resetTime = new Date(parseInt(headers['x-rate-limit-reset']) * 1000);
    }

    // Calculate used
    limit.used = limit.limit - limit.remaining;

    this.limits.set(key, limit);
  }

  /**
   * ⏰ CALCULATE RETRY TIME
   */
  private calculateRetryTime(limit: APILimit): Date {
    if (limit.lastError?.retryAfter) {
      return new Date(limit.lastError.timestamp.getTime() + (limit.lastError.retryAfter * 1000));
    }

    // Use the reset time with a small buffer
    const bufferMinutes = 5;
    return new Date(limit.resetTime.getTime() + (bufferMinutes * 60 * 1000));
  }

  /**
   * 🎯 GENERATE RECOVERY PLAN
   */
  private generateRecoveryPlan(key: string, error: any): RecoveryPlan {
    const [service, endpoint] = key.split(':');
    const errorHistory = this.errorHistory.get(key) || [];

    if (error.status === 429 || error.code === 429) {
      // Rate limit error
      const retryAfter = this.extractRetryAfter(error);
      const waitTime = retryAfter ? Math.ceil(retryAfter / 60) : this.estimateWaitTime(service, endpoint);

      return {
        action: 'wait',
        waitTime,
        message: `Rate limited on ${service} ${endpoint}. Waiting ${waitTime} minutes before retry.`,
        confidence: 0.9,
        alternativeAction: this.getAlternativeAction(service, endpoint)
      };
    }

    if (error.status === 401 || error.status === 403) {
      // Auth error - more serious
      return {
        action: 'disable_temporarily',
        waitTime: 60, // 1 hour
        message: `Authentication error on ${service}. Disabling for 1 hour.`,
        confidence: 0.95
      };
    }

    if (errorHistory.length >= 3) {
      // Multiple recent errors - back off
      return {
        action: 'wait',
        waitTime: Math.pow(2, errorHistory.length) * 10, // Exponential backoff
        message: `Multiple errors on ${service} ${endpoint}. Backing off.`,
        confidence: 0.8
      };
    }

    // Default - retry with short wait
    return {
      action: 'wait',
      waitTime: 5,
      message: `Temporary error on ${service}. Retrying in 5 minutes.`,
      confidence: 0.6
    };
  }

  /**
   * 🔍 EXTRACT RETRY-AFTER FROM ERROR
   */
  private extractRetryAfter(error: any): number | undefined {
    // Check various places where retry-after might be
    if (error.retryAfter) return error.retryAfter;
    if (error.headers?.['retry-after']) return parseInt(error.headers['retry-after']);
    if (error.response?.headers?.['retry-after']) return parseInt(error.response.headers['retry-after']);
    if (error.rateLimit?.reset) {
      const resetTime = new Date(error.rateLimit.reset * 1000);
      return Math.ceil((resetTime.getTime() - Date.now()) / 1000);
    }
    return undefined;
  }

  /**
   * ⏱️ ESTIMATE WAIT TIME BASED ON SERVICE
   */
  private estimateWaitTime(service: string, endpoint: string): number {
    const estimates = {
      'twitter:post': 60,        // 1 hour for posting
      'twitter:search': 15,      // 15 minutes for search
      'twitter:user': 15,        // 15 minutes for user lookup
      'openai:chat': 5,          // 5 minutes for OpenAI
      'newsapi:everything': 60,  // 1 hour for news
      'pexels:search': 30        // 30 minutes for images
    };

    const key = `${service}:${endpoint}`;
    return estimates[key as keyof typeof estimates] || 30; // Default 30 minutes
  }

  /**
   * 🔄 GET ALTERNATIVE ACTION
   */
  private getAlternativeAction(service: string, endpoint: string): string | undefined {
    const alternatives = {
      'twitter:post': 'Queue post for later when limits reset',
      'openai:chat': 'Use cached response or simpler prompt',
      'newsapi:everything': 'Use cached news or alternative source',
      'pexels:search': 'Use local images or alternative image service'
    };

    const key = `${service}:${endpoint}`;
    return alternatives[key as keyof typeof alternatives];
  }

  /**
   * 📝 RECORD ERROR IN HISTORY
   */
  private recordError(key: string, error: any): void {
    if (!this.errorHistory.has(key)) {
      this.errorHistory.set(key, []);
    }
    
    const history = this.errorHistory.get(key)!;
    history.push({ timestamp: new Date(), error });
    
    // Keep only last 10 errors
    if (history.length > 10) {
      history.shift();
    }
  }

  /**
   * 🏗️ CREATE DEFAULT LIMIT
   */
  private createDefaultLimit(key: string): APILimit {
    const [service, endpoint] = key.split(':');
    
    // Default limits based on known API limits
    const defaults = {
      'twitter:post': { limit: 17, windowType: '24hour' as const },
      'twitter:search': { limit: 450, windowType: '15min' as const },
      'twitter:user': { limit: 75, windowType: '15min' as const },
      'openai:chat': { limit: 1000, windowType: '24hour' as const },
      'newsapi:everything': { limit: 100, windowType: '24hour' as const },
      'pexels:search': { limit: 200, windowType: '1hour' as const }
    };

    const defaultConfig = defaults[key as keyof typeof defaults] || { limit: 100, windowType: '1hour' as const };
    
    return {
      service: service as any,
      endpoint,
      used: 0,
      limit: defaultConfig.limit,
      remaining: defaultConfig.limit,
      resetTime: this.calculateResetTime(defaultConfig.windowType),
      windowType: defaultConfig.windowType
    };
  }

  /**
   * ⏰ CALCULATE RESET TIME
   */
  private calculateResetTime(windowType: string): Date {
    const now = new Date();
    
    switch (windowType) {
      case '15min':
        return new Date(now.getTime() + (15 * 60 * 1000));
      case '1hour':
        return new Date(now.getTime() + (60 * 60 * 1000));
      case '3hour':
        return new Date(now.getTime() + (3 * 60 * 60 * 1000));
      case '24hour':
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow;
      case '30day':
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        nextMonth.setDate(1);
        nextMonth.setHours(0, 0, 0, 0);
        return nextMonth;
      default:
        return new Date(now.getTime() + (60 * 60 * 1000));
    }
  }

  /**
   * ➕ INCREMENT USAGE
   */
  private async incrementUsage(key: string): Promise<void> {
    const limit = this.limits.get(key) || this.createDefaultLimit(key);
    limit.used += 1;
    limit.remaining = Math.max(0, limit.limit - limit.used);
    this.limits.set(key, limit);
  }

  /**
   * 🏃 INITIALIZE KNOWN LIMITS
   */
  private initializeKnownLimits(): void {
    // Initialize with known API limits
    const knownLimits = [
      'twitter:post',
      'twitter:search',
      'twitter:user',
      'openai:chat',
      'newsapi:everything',
      'pexels:search'
    ];

    knownLimits.forEach(key => {
      this.limits.set(key, this.createDefaultLimit(key));
    });
  }

  /**
   * 🧹 PERIODIC CLEANUP
   */
  private startPeriodicCleanup(): void {
    setInterval(() => {
      const now = new Date();
      
      // Reset limits that have expired
      for (const [key, limit] of this.limits.entries()) {
        if (now >= limit.resetTime) {
          limit.used = 0;
          limit.remaining = limit.limit;
          limit.resetTime = this.calculateResetTime(limit.windowType);
          delete limit.lastError;
        }
      }

      // Clean old error history
      for (const [key, history] of this.errorHistory.entries()) {
        const cutoff = new Date(now.getTime() - (24 * 60 * 60 * 1000)); // 24 hours
        const filtered = history.filter(h => h.timestamp > cutoff);
        if (filtered.length === 0) {
          this.errorHistory.delete(key);
        } else {
          this.errorHistory.set(key, filtered);
        }
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * 💾 LOG TO DATABASE
   */
  private async logErrorToDatabase(service: string, endpoint: string, error: any, plan: RecoveryPlan): Promise<void> {
    try {
      await supabaseClient.setBotConfig(`last_error_${service}_${endpoint}`, JSON.stringify({
        error: {
          code: error.status || error.code,
          message: error.message
        },
        plan,
        timestamp: new Date().toISOString()
      }));
    } catch (err) {
      console.error('Failed to log error to database:', err);
    }
  }

  private async logSuccessToDatabase(service: string, endpoint: string): Promise<void> {
    try {
      await supabaseClient.setBotConfig(`last_success_${service}_${endpoint}`, new Date().toISOString());
    } catch (err) {
      console.error('Failed to log success to database:', err);
    }
  }

  /**
   * 📊 PUBLIC API
   */
  getStatus(): { limits: APILimit[]; errors: any; strategies: any } {
    return {
      limits: Array.from(this.limits.values()),
      errors: Object.fromEntries(this.errorHistory),
      strategies: Object.fromEntries(this.recoveryStrategies)
    };
  }

  async getRecoveryPlan(service: string, endpoint: string): Promise<RecoveryPlan | null> {
    const key = `${service}:${endpoint}`;
    return this.recoveryStrategies.get(key) || null;
  }

  resetLimits(service?: string): void {
    if (service) {
      for (const [key, limit] of this.limits.entries()) {
        if (limit.service === service) {
          limit.used = 0;
          limit.remaining = limit.limit;
          delete limit.lastError;
        }
      }
    } else {
      this.limits.clear();
      this.initializeKnownLimits();
    }
  }
}

export const rateLimitManager = new IntelligentRateLimitManager(); 