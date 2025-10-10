/**
 * 🚀 BULLETPROOF POSTING SYSTEM - BROWSER CRASH RESISTANT
 * 
 * This system is designed to handle Railway resource constraints and browser crashes
 * by prioritizing HTTP posting and implementing intelligent fallback strategies.
 */

import { bulletproofPost, getBulletproofStatus } from './bulletproofHttpPoster';

interface BulletproofPostResult {
  success: boolean;
  tweetId?: string;
  error?: string;
  method?: string;
  resourcesUsed: {
    memoryMB: number;
    durationMs: number;
  };
  retryAfter?: number;
}

export class BulletproofPoster {
  private static instance: BulletproofPoster;
  private isPosting = false;
  private postQueue: Array<{
    content: string;
    resolve: (result: BulletproofPostResult) => void;
    reject: (error: any) => void;
  }> = [];
  
  static getInstance(): BulletproofPoster {
    if (!BulletproofPoster.instance) {
      BulletproofPoster.instance = new BulletproofPoster();
    }
    return BulletproofPoster.instance;
  }

  /**
   * 🚀 MAIN POSTING METHOD - Crash Resistant
   */
  async postContent(content: string): Promise<BulletproofPostResult> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;

    console.log('🛡️ BULLETPROOF_POSTER: Starting crash-resistant post...');
    
    // Queue system prevents resource exhaustion
    if (this.isPosting) {
      console.log('📋 QUEUE: Adding to bulletproof queue (preventing crashes)');
      return new Promise<BulletproofPostResult>((resolve, reject) => {
        this.postQueue.push({ content, resolve, reject });
      });
    }

    this.isPosting = true;

    try {
      // Use the bulletproof HTTP poster
      console.log('🚀 BULLETPROOF_HTTP: Using crash-resistant posting...');
      const result = await bulletproofPost(content);

      const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      const bulletproofResult: BulletproofPostResult = {
        success: result.success,
        tweetId: result.tweetId,
        error: result.error,
        method: result.method || 'http',
        resourcesUsed: {
          memoryMB: Math.round(endMemory - startMemory),
          durationMs: Date.now() - startTime
        },
        retryAfter: result.retryAfter
      };

      if (result.success) {
        console.log(`✅ BULLETPROOF_SUCCESS: Posted via ${result.method || 'HTTP'} in ${bulletproofResult.resourcesUsed.durationMs}ms`);
      } else {
        console.error(`❌ BULLETPROOF_FAILED: ${result.error}`);
      }

      return bulletproofResult;

    } catch (error: any) {
      const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      
      console.error('❌ BULLETPROOF_POSTER: Unexpected error:', error.message);
      
      return {
        success: false,
        error: `Unexpected error: ${error.message}`,
        resourcesUsed: {
          memoryMB: Math.round(endMemory - startMemory),
          durationMs: Date.now() - startTime
        }
      };
    } finally {
      this.isPosting = false;
      this.processQueue();
    }
  }

  /**
   * ⏳ Process Post Queue
   */
  private processQueue(): void {
    if (this.postQueue.length === 0 || this.isPosting) return;
    
    const next = this.postQueue.shift();
    if (next) {
      console.log(`📋 BULLETPROOF_QUEUE: Processing queued post (${this.postQueue.length} remaining)`);
      
      // Process next item
      this.postContent(next.content)
        .then(next.resolve)
        .catch(next.reject);
    }
  }

  /**
   * 📊 Get System Status
   */
  async getStatus() {
    const bulletproofStatus = await getBulletproofStatus();
    
    return {
      isPosting: this.isPosting,
      queueLength: this.postQueue.length,
      bulletproof: bulletproofStatus,
      systemHealth: {
        memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        uptime: process.uptime(),
        healthy: bulletproofStatus.isHealthy && this.postQueue.length < 5
      }
    };
  }
}

// Export singleton instance
export const bulletproofPoster = BulletproofPoster.getInstance();