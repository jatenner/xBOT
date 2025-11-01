/**
 * PRE-FLIGHT THREAD VALIDATION
 * Fail fast (2 seconds) instead of wasting 120 seconds on doomed threads
 */

export interface ThreadValidationResult {
  valid: boolean;
  reason?: string;
  canRetry: boolean;
  retryDelay?: number; // milliseconds
}

export class ThreadValidator {
  /**
   * Pre-flight checks - validate BEFORE launching browser
   */
  static async validateThreadBeforePosting(thread_parts: string[]): Promise<ThreadValidationResult> {
    console.log('[THREAD_VALIDATOR] 🔍 Running pre-flight checks...');
    
    // ✅ CHECK 1: Content validation
    if (!thread_parts || thread_parts.length === 0) {
      return {
        valid: false,
        reason: 'No thread content provided',
        canRetry: false
      };
    }
    
    if (thread_parts.length < 2) {
      return {
        valid: false,
        reason: 'Thread must have at least 2 tweets',
        canRetry: false
      };
    }
    
    if (thread_parts.length > 8) {
      return {
        valid: false,
        reason: 'Thread too long (max 8 tweets for reliability)',
        canRetry: false
      };
    }
    
    // ✅ CHECK 2: Character limits
    for (let i = 0; i < thread_parts.length; i++) {
      const tweet = thread_parts[i];
      
      if (!tweet || tweet.trim().length === 0) {
        return {
          valid: false,
          reason: `Tweet ${i + 1} is empty`,
          canRetry: false
        };
      }
      
      if (tweet.length > 280) {
        return {
          valid: false,
          reason: `Tweet ${i + 1} exceeds 280 chars (${tweet.length})`,
          canRetry: false
        };
      }
      
      if (tweet.length < 10) {
        return {
          valid: false,
          reason: `Tweet ${i + 1} too short (${tweet.length} chars, spam risk)`,
          canRetry: false
        };
      }
    }
    
    // ✅ CHECK 3: Twitter session valid?
    try {
      const sessionValid = await this.checkTwitterSession();
      if (!sessionValid) {
        return {
          valid: false,
          reason: 'Twitter session expired - need to re-login',
          canRetry: true,
          retryDelay: 60 * 60 * 1000 // 1 hour (session needs manual refresh)
        };
      }
    } catch (error: any) {
      console.warn('[THREAD_VALIDATOR] ⚠️ Session check failed:', error.message);
      // Continue anyway - browser will catch this
    }
    
    // ✅ CHECK 4: Browser pool healthy?
    try {
      const poolHealth = await this.checkBrowserPoolHealth();
      if (!poolHealth.healthy) {
        return {
          valid: false,
          reason: `Browser pool overloaded (${poolHealth.queuedOperations} operations queued)`,
          canRetry: true,
          retryDelay: 10 * 60 * 1000 // 10 minutes (wait for queue to clear)
        };
      }
    } catch (error: any) {
      console.warn('[THREAD_VALIDATOR] ⚠️ Pool health check failed:', error.message);
      // Continue anyway
    }
    
    // ✅ CHECK 5: Recent thread success rate
    try {
      const recentThreads = await this.getRecentThreadAttempts(10);
      if (recentThreads.length >= 5) {
        const successRate = recentThreads.filter(t => t.success).length / recentThreads.length;
        
        if (successRate < 0.2) {
          return {
            valid: false,
            reason: `Thread success rate critically low (${(successRate * 100).toFixed(0)}%) - Twitter may be blocking`,
            canRetry: true,
            retryDelay: 2 * 60 * 60 * 1000 // 2 hours (wait for Twitter cooldown)
          };
        }
        
        console.log(`[THREAD_VALIDATOR] ✅ Recent success rate: ${(successRate * 100).toFixed(0)}%`);
      }
    } catch (error: any) {
      console.warn('[THREAD_VALIDATOR] ⚠️ Success rate check failed:', error.message);
      // Continue anyway
    }
    
    console.log('[THREAD_VALIDATOR] ✅ All pre-flight checks passed!');
    return {
      valid: true,
      canRetry: true
    };
  }
  
  /**
   * Check if Twitter session is valid (quick check, no browser launch)
   */
  private static async checkTwitterSession(): Promise<boolean> {
    try {
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
      
      // Check if we have a recent successful post (indicates valid session)
      const { data: recentPost } = await supabase
        .from('content_metadata')
        .select('posted_at')
        .eq('status', 'posted')
        .gte('posted_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // Last 30 min
        .limit(1)
        .single();
      
      if (recentPost) {
        console.log('[THREAD_VALIDATOR] ✅ Recent post found - session likely valid');
        return true;
      }
      
      // If no recent posts, assume session might be stale but don't block
      console.log('[THREAD_VALIDATOR] ⚠️ No recent posts - session status unknown');
      return true; // Don't block on this alone
      
    } catch (error) {
      return true; // Don't block on check failure
    }
  }
  
  /**
   * Check browser pool health
   */
  private static async checkBrowserPoolHealth(): Promise<{healthy: boolean; queuedOperations: number}> {
    try {
      const { BrowserSemaphore } = await import('../browser/BrowserSemaphore');
      const semaphore = BrowserSemaphore.getInstance();
      const status = semaphore.getStatus();
      
      const healthy = status.queued < 3; // Healthy if less than 3 operations queued
      
      console.log(`[THREAD_VALIDATOR] Browser pool: ${status.active.length} active, ${status.queued} queued`);
      
      return {
        healthy,
        queuedOperations: status.queued
      };
    } catch (error) {
      return {healthy: true, queuedOperations: 0}; // Assume healthy if can't check
    }
  }
  
  /**
   * Get recent thread posting attempts
   */
  private static async getRecentThreadAttempts(limit: number): Promise<Array<{success: boolean; timestamp: Date}>> {
    try {
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
      
      const { data: threads } = await supabase
        .from('content_metadata')
        .select('status, posted_at, updated_at')
        .eq('decision_type', 'thread')
        .in('status', ['posted', 'failed'])
        .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .order('updated_at', {ascending: false})
        .limit(limit);
      
      if (!threads || threads.length === 0) {
        return [];
      }
      
      return threads.map(t => ({
        success: t.status === 'posted',
        timestamp: new Date(String(t.updated_at))
      }));
      
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Calculate intelligent retry delay based on error type
   */
  static getRetryDelay(retryCount: number, lastError: string): number {
    console.log(`[THREAD_VALIDATOR] Calculating retry delay (attempt ${retryCount + 1})`);
    console.log(`[THREAD_VALIDATOR] Last error: ${lastError.substring(0, 100)}`);
    
    // Base delays by error type
    const errorPatterns: Record<string, number> = {
      'session': 60 * 60 * 1000,        // 1 hour (need new login)
      'rate limit': 2 * 60 * 60 * 1000, // 2 hours (Twitter cooldown)
      'timeout': 30 * 60 * 1000,        // 30 min (Railway resources)
      'selector': 10 * 60 * 1000,       // 10 min (Twitter UI change)
      'browser': 15 * 60 * 1000,        // 15 min (Browser issues)
      'network': 5 * 60 * 1000,         // 5 min (Network issues)
    };
    
    let baseDelay = 15 * 60 * 1000; // Default: 15 minutes
    
    // Match error pattern
    const lowerError = lastError.toLowerCase();
    for (const [pattern, delay] of Object.entries(errorPatterns)) {
      if (lowerError.includes(pattern)) {
        baseDelay = delay;
        console.log(`[THREAD_VALIDATOR] Matched pattern: "${pattern}" → ${delay / 60000}min base delay`);
        break;
      }
    }
    
    // Apply exponential backoff: 1x, 2x, 4x (max 4x)
    const multiplier = Math.pow(2, Math.min(retryCount, 2));
    const finalDelay = baseDelay * multiplier;
    
    console.log(`[THREAD_VALIDATOR] Retry ${retryCount + 1}: ${baseDelay / 60000}min × ${multiplier} = ${finalDelay / 60000}min`);
    
    return finalDelay;
  }
}

