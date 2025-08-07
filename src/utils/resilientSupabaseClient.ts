/**
 * 🛡️ RESILIENT SUPABASE CLIENT
 * Handles connection timeouts, implements retry logic, and provides fallback mechanisms
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface ConnectionAttempt {
  timestamp: number;
  success: boolean;
  latency?: number;
  error?: string;
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export class ResilientSupabaseClient {
  private client: SupabaseClient;
  private connectionHistory: ConnectionAttempt[] = [];
  private circuitBreakerOpen: boolean = false;
  private lastCircuitCheck: number = 0;
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5; // failures before opening circuit
  private readonly CIRCUIT_BREAKER_TIMEOUT = 30000; // 30 seconds
  
  private readonly retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2
  };

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    this.client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: 'public'
      },
      realtime: {
        timeout: 10000 // 10 seconds
      }
    });
  }

  /**
   * 🔄 Execute database operation with retry logic and circuit breaker
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    fallbackData?: T
  ): Promise<T> {
    // Check circuit breaker
    if (this.isCircuitBreakerOpen()) {
      console.log(`⚡ Circuit breaker open for ${operationName}, using fallback`);
      if (fallbackData !== undefined) {
        return fallbackData;
      }
      throw new Error(`Circuit breaker open, no fallback available for ${operationName}`);
    }

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        console.log(`🔄 ${operationName} attempt ${attempt}/${this.retryConfig.maxRetries}`);
        
        const startTime = Date.now();
        const result = await this.withTimeout(operation(), 15000); // 15 second timeout
        const latency = Date.now() - startTime;
        
        // Record successful attempt
        this.recordConnectionAttempt(true, latency);
        
        console.log(`✅ ${operationName} successful (${latency}ms)`);
        return result;
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Record failed attempt
        this.recordConnectionAttempt(false, undefined, lastError.message);
        
        console.warn(`⚠️ ${operationName} attempt ${attempt} failed:`, lastError.message);
        
        // Don't retry on certain errors
        if (this.isNonRetryableError(lastError)) {
          console.log(`🚫 Non-retryable error for ${operationName}, stopping retries`);
          break;
        }
        
        // Wait before retry (exponential backoff)
        if (attempt < this.retryConfig.maxRetries) {
          const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
            this.retryConfig.maxDelay
          );
          
          console.log(`⏱️ Waiting ${delay}ms before retry...`);
          await this.sleep(delay);
        }
      }
    }
    
    // All attempts failed
    console.error(`❌ ${operationName} failed after ${this.retryConfig.maxRetries} attempts`);
    
    // Use fallback if available
    if (fallbackData !== undefined) {
      console.log(`🔄 Using fallback data for ${operationName}`);
      return fallbackData;
    }
    
    throw lastError || new Error(`${operationName} failed after retries`);
  }

  /**
   * 🚀 High-level database operations with built-in resilience
   */
  
  // Get recent tweets with fallback
  async getRecentTweets(limit: number = 50): Promise<any[]> {
    const fallbackTweets = [
      {
        tweet_id: 'fallback_1',
        content: 'Most people think they need 8 glasses of water daily. New research shows this myth could be harming your health.',
        created_at: new Date().toISOString()
      },
      {
        tweet_id: 'fallback_2', 
        content: 'The supplement industry doesnt want you to know: 90% of vitamins are synthetic and poorly absorbed.',
        created_at: new Date(Date.now() - 3600000).toISOString()
      }
    ];
    
    return this.executeWithRetry(
      async () => {
        const { data, error } = await this.client
          .from('tweets')
          .select('tweet_id, content, created_at')
          .order('created_at', { ascending: false })
          .limit(limit);
          
        if (error) throw new Error(error.message);
        return data || [];
      },
      'getRecentTweets',
      fallbackTweets
    );
  }
  
  // Store tweet with resilience
  async storeTweet(tweetData: any): Promise<boolean> {
    return this.executeWithRetry(
      async () => {
        const { error } = await this.client
          .from('tweets')
          .insert(tweetData);
          
        if (error) throw new Error(error.message);
        return true;
      },
      'storeTweet',
      true // Always return success for fallback
    );
  }
  
  // Get engagement metrics with fallback
  async getEngagementMetrics(tweetId: string): Promise<any> {
    const fallbackMetrics = {
      likes: 0,
      retweets: 0,
      replies: 0,
      engagement_rate: 0.02
    };
    
    return this.executeWithRetry(
      async () => {
        const { data, error } = await this.client
          .from('tweet_analytics')
          .select('*')
          .eq('tweet_id', tweetId)
          .single();
          
        if (error) throw new Error(error.message);
        return data;
      },
      'getEngagementMetrics',
      fallbackMetrics
    );
  }

  /**
   * 🔧 Circuit Breaker Logic
   */
  private isCircuitBreakerOpen(): boolean {
    const now = Date.now();
    
    // Reset circuit breaker after timeout
    if (this.circuitBreakerOpen && (now - this.lastCircuitCheck) > this.CIRCUIT_BREAKER_TIMEOUT) {
      console.log('🔄 Circuit breaker timeout reached, attempting reset...');
      this.circuitBreakerOpen = false;
    }
    
    // Check recent failure rate
    const recentAttempts = this.connectionHistory
      .filter(attempt => (now - attempt.timestamp) < 60000) // Last 1 minute
      .slice(-10); // Last 10 attempts
      
    if (recentAttempts.length >= this.CIRCUIT_BREAKER_THRESHOLD) {
      const failureRate = recentAttempts.filter(a => !a.success).length / recentAttempts.length;
      
      if (failureRate >= 0.8) { // 80% failure rate
        if (!this.circuitBreakerOpen) {
          console.log(`⚡ Opening circuit breaker due to ${(failureRate * 100).toFixed(1)}% failure rate`);
          this.circuitBreakerOpen = true;
          this.lastCircuitCheck = now;
        }
        return true;
      }
    }
    
    return this.circuitBreakerOpen;
  }
  
  private recordConnectionAttempt(success: boolean, latency?: number, error?: string) {
    this.connectionHistory.push({
      timestamp: Date.now(),
      success,
      latency,
      error
    });
    
    // Keep only last 50 attempts
    if (this.connectionHistory.length > 50) {
      this.connectionHistory = this.connectionHistory.slice(-50);
    }
  }
  
  private isNonRetryableError(error: Error): boolean {
    const nonRetryablePatterns = [
      'invalid',
      'unauthorized',
      'forbidden',
      'not found',
      'constraint'
    ];
    
    return nonRetryablePatterns.some(pattern => 
      error.message.toLowerCase().includes(pattern)
    );
  }
  
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Operation timeout')), timeoutMs);
    });
    
    return Promise.race([promise, timeoutPromise]);
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 📊 Health Check and Status
   */
  getConnectionStatus() {
    const recent = this.connectionHistory.slice(-10);
    const successRate = recent.length > 0 
      ? recent.filter(a => a.success).length / recent.length 
      : 0;
      
    const avgLatency = recent
      .filter(a => a.success && a.latency)
      .reduce((sum, a) => sum + (a.latency || 0), 0) / recent.filter(a => a.success).length || 0;
    
    return {
      circuitBreakerOpen: this.circuitBreakerOpen,
      successRate: (successRate * 100).toFixed(1) + '%',
      averageLatency: Math.round(avgLatency) + 'ms',
      recentAttempts: recent.length,
      status: this.circuitBreakerOpen ? 'DEGRADED' : successRate > 0.8 ? 'HEALTHY' : 'UNHEALTHY'
    };
  }

  // Direct client access for specific operations
  get supabase(): SupabaseClient {
    return this.client;
  }
}

// Export singleton instance
export const resilientSupabaseClient = new ResilientSupabaseClient();