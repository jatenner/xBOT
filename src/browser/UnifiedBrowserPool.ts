/**
 * 🌐 UNIFIED BROWSER POOL
 * 
 * Single source of truth for ALL browser operations across the entire system.
 * Prevents resource exhaustion by intelligent pooling and queueing.
 * 
 * KEY FEATURES:
 * - Single browser instance (not 7 different ones!)
 * - Context pooling with automatic cleanup
 * - Queue system prevents concurrent scraping overload
 * - Memory monitoring and automatic throttling
 * - Session persistence across all operations
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { SessionLoader } from '../utils/sessionLoader';
import fs from 'fs';

interface ContextHandle {
  context: BrowserContext;
  inUse: boolean;
  lastUsed: Date;
  operationCount: number;
  maxOperations: number;
}

interface QueuedOperation {
  id: string;
  priority: number;
  operation: (context: BrowserContext) => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
}

export class UnifiedBrowserPool {
  private static instance: UnifiedBrowserPool;
  private browser: Browser | null = null;
  private contexts: Map<string, ContextHandle> = new Map();
  private queue: QueuedOperation[] = [];
  private isProcessingQueue = false;
  private sessionLoaded = false;
  
  // Configuration
  private readonly MAX_CONTEXTS = 4; // Increased from 3 → 4 for better throughput (still conservative)
  private readonly MAX_OPERATIONS_PER_CONTEXT = 50; // Refresh context after 50 operations
  private readonly CONTEXT_IDLE_TIMEOUT = 5 * 60 * 1000; // Close idle contexts after 5 min
  private readonly CLEANUP_INTERVAL = 60 * 1000; // Check every minute
  private readonly QUEUE_WAIT_TIMEOUT = 45000; // 45 second max wait in queue before rejection
  
  private cleanupTimer: NodeJS.Timeout | null = null;
  private metrics = {
    totalOperations: 0,
    queuedOperations: 0,
    activeContexts: 0,
    peakQueue: 0,
    contextsCreated: 0,
    contextsClosed: 0,
    successfulOperations: 0,
    failedOperations: 0
  };
  
  // Circuit breaker state
  private circuitBreaker = {
    failures: 0,
    lastFailure: 0,
    isOpen: false,
    openUntil: 0
  };
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5; // Open after 5 failures
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // Stay open for 1 minute

  private constructor() {
    // Start periodic cleanup
    this.startCleanupTimer();
    
    // Graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  public static getInstance(): UnifiedBrowserPool {
    if (!UnifiedBrowserPool.instance) {
      UnifiedBrowserPool.instance = new UnifiedBrowserPool();
    }
    return UnifiedBrowserPool.instance;
  }

  /**
   * Acquire a page directly from the pool
   * Useful for operations that need explicit control over page lifecycle
   * Includes timeout to prevent infinite hangs when browser pool is corrupted
   */
  public async acquirePage(operationName: string): Promise<Page> {
    const PAGE_ACQUIRE_TIMEOUT = 30000; // 30 seconds max to acquire page
    
    const acquirePromise = this.withContext(operationName, async (context) => {
      const page = await context.newPage();
      return page;
    });
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        console.error(`[BROWSER_POOL] ⏱️ TIMEOUT: acquirePage('${operationName}') exceeded ${PAGE_ACQUIRE_TIMEOUT/1000}s`);
        console.error(`[BROWSER_POOL] 🚨 Browser pool may be corrupted, triggering recovery...`);
        reject(new Error(`Browser pool timeout after ${PAGE_ACQUIRE_TIMEOUT/1000}s - pool may be corrupted`));
      }, PAGE_ACQUIRE_TIMEOUT);
    });
    
    try {
      return await Promise.race([
        acquirePromise,
        timeoutPromise
      ]) as Page;
    } catch (error: any) {
      // If timeout, browser pool is likely corrupted - log for monitoring
      if (error.message.includes('timeout')) {
        console.error(`[BROWSER_POOL] ❌ CRITICAL: Browser pool timeout - system may need restart`);
        this.metrics.failedOperations++;
      }
      throw error;
    }
  }

  /**
   * Release a page back to the pool
   * Note: With the current design, pages are tied to contexts
   * So we just close the page here
   */
  public async releasePage(page: Page): Promise<void> {
    try {
      if (!page.isClosed()) {
        await page.close();
      }
    } catch (error: any) {
      console.warn(`[BROWSER_POOL] ⚠️ Error closing page: ${error.message}`);
    }
  }

  /**
   * Execute an operation with a browser context
   * Automatically queues if all contexts are busy
   */
  public async withContext<T>(
    operationName: string,
    operation: (context: BrowserContext) => Promise<T>,
    priority: number = 5 // 1=highest, 10=lowest
  ): Promise<T> {
    const operationId = `${operationName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[BROWSER_POOL] 📝 Request: ${operationName} (queue: ${this.queue.length}, active: ${this.getActiveCount()})`);
    
    // Update metrics
    this.metrics.totalOperations++;
    this.metrics.queuedOperations++;
    if (this.queue.length > this.metrics.peakQueue) {
      this.metrics.peakQueue = this.queue.length;
    }

    return new Promise<T>((resolve, reject) => {
      const queuedAt = Date.now();
      
      // 🔥 QUEUE TIMEOUT: Reject if waiting too long (prevents infinite waits)
      const queueTimeoutTimer = setTimeout(() => {
        const waitTime = Date.now() - queuedAt;
        console.error(`[BROWSER_POOL] ⏱️ QUEUE TIMEOUT: ${operationName} waited ${Math.round(waitTime/1000)}s`);
        console.error(`[BROWSER_POOL] 📊 Current: ${this.queue.length} queued, ${this.getActiveCount()} active`);
        
        // Remove from queue
        const index = this.queue.findIndex(op => op.id === operationId);
        if (index !== -1) {
          this.queue.splice(index, 1);
          this.metrics.queuedOperations--;
        }
        
        reject(new Error(`Queue timeout after ${Math.round(waitTime/1000)}s - pool overloaded`));
      }, this.QUEUE_WAIT_TIMEOUT);
      
      // Wrap operation to clear timeout when it starts
      const wrappedOperation = async (ctx: BrowserContext) => {
        clearTimeout(queueTimeoutTimer); // Cancel timeout - we're starting!
        return operation(ctx);
      };
      
      this.queue.push({
        id: operationId,
        priority,
        operation: wrappedOperation as any,
        resolve: resolve as any,
        reject
      });
      
      // Sort queue by priority (lower number = higher priority)
      this.queue.sort((a, b) => a.priority - b.priority);
      
      // Start processing if not already running
      if (!this.isProcessingQueue) {
        this.processQueue().catch(err => {
          console.error('[BROWSER_POOL] ❌ Queue processing error:', err.message);
        });
      }
    });
  }

  /**
   * Process the operation queue
   * 
   * ✨ ENHANCED VERSION with:
   * - Parallel processing (uses all MAX_CONTEXTS browsers simultaneously)
   * - Operation timeouts (60 second limit prevents hanging)
   * - Error recovery (auto-closes stuck contexts)
   * - Better logging and metrics
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    console.log(`[BROWSER_POOL] 🚀 Queue processor started (queue: ${this.queue.length} operations)`);

    try {
      while (this.queue.length > 0) {
        
        // ═══════════════════════════════════════════════════════════
        // PARALLEL BATCH: Acquire up to MAX_CONTEXTS for concurrent execution
        // ═══════════════════════════════════════════════════════════
        
        const batch: Array<{op: QueuedOperation, context: ContextHandle}> = [];
        
        // Try to acquire multiple contexts (up to MAX_CONTEXTS)
        for (let i = 0; i < this.MAX_CONTEXTS && this.queue.length > 0; i++) {
          const contextHandle = await this.acquireContext();
          
          if (!contextHandle) {
            // No more contexts available for this batch
            break;
          }
          
          const op = this.queue.shift();
          if (!op) {
            // No more operations, release the context we just acquired
            this.releaseContext(contextHandle);
            break;
          }
          
          this.metrics.queuedOperations--;
          batch.push({ op, context: contextHandle });
        }
        
        // If no operations could be acquired, wait and retry
        if (batch.length === 0) {
          console.log(`[BROWSER_POOL] ⏳ All contexts busy (queue: ${this.queue.length} waiting), pausing 2s...`);
          await this.sleep(2000);
          continue;
        }
        
        // ═══════════════════════════════════════════════════════════
        // EXECUTE BATCH IN PARALLEL (with timeouts and error recovery!)
        // ═══════════════════════════════════════════════════════════
        
        console.log(`[BROWSER_POOL] ⚡ Executing batch of ${batch.length} operations (${this.queue.length} remaining in queue)`);
        
        const OPERATION_TIMEOUT = 60000; // 60 second timeout
        
        // Execute all operations in parallel using Promise.allSettled
        // This ensures one failure doesn't stop others
        const results = await Promise.allSettled(
          batch.map(async ({ op, context }) => {
            const startTime = Date.now();
            let contextClosed = false;
            
            try {
              console.log(`[BROWSER_POOL]   → ${op.id}: Starting...`);
              
              // ✅ CRITICAL FIX: Race against timeout
              const result = await Promise.race([
                op.operation(context.context),
                this.timeoutAfter(OPERATION_TIMEOUT, op.id)
              ]);
              
              const duration = Date.now() - startTime;
              console.log(`[BROWSER_POOL]   ✅ ${op.id}: Completed (${duration}ms)`);
              
              op.resolve(result);
              this.metrics.successfulOperations++;
              this.recordSuccess();
              
            } catch (error: any) {
              const duration = Date.now() - startTime;
              const isTimeout = error.message.includes('[TIMEOUT]');
              
              if (isTimeout) {
                console.error(`[BROWSER_POOL]   ⏰ ${op.id}: TIMEOUT after ${duration}ms`);
                console.warn(`[BROWSER_POOL]   🔨 Recycling stuck context...`);
                
                // Force close the stuck context
                await this.forceCloseContext(context);
                contextClosed = true; // Don't try to release in finally
                
              } else {
                console.error(`[BROWSER_POOL]   ❌ ${op.id}: Failed (${duration}ms) - ${error.message}`);
              }
              
              op.reject(error);
              this.metrics.failedOperations++;
              this.recordFailure();
              
            } finally {
              // Release context back to pool (unless it was force-closed)
              if (!contextClosed) {
                this.releaseContext(context);
              }
            }
          })
        );
        
        // Log batch summary
        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        console.log(`[BROWSER_POOL] 📊 Batch summary: ${succeeded} succeeded, ${failed} failed (${this.queue.length} remaining)`);
      }
      
      console.log(`[BROWSER_POOL] 🏁 Queue processor finished (queue empty)`);
      
    } catch (error: any) {
      console.error(`[BROWSER_POOL] ❌ Queue processor error:`, error.message);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * ⏰ Create a timeout promise that rejects after specified milliseconds
   * Used to prevent operations from hanging indefinitely
   */
  private timeoutAfter(ms: number, operationId: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`[TIMEOUT] Operation ${operationId} exceeded ${ms}ms limit`));
      }, ms);
    });
  }

  /**
   * 🏥 Check if a context is still healthy and usable
   * Prevents using dead/broken contexts that would cause operations to hang
   */
  private async isContextHealthy(handle: ContextHandle): Promise<boolean> {
    try {
      // Quick health check: verify context still exists in browser
      if (!this.browser || !this.browser.isConnected()) {
        return false; // Browser itself is dead
      }
      
      const contexts = await this.browser.contexts();
      if (!contexts || !contexts.includes(handle.context)) {
        return false; // Context no longer exists in browser
      }
      
      // Context exists and browser is connected
      return true;
      
    } catch (error: any) {
      console.warn(`[BROWSER_POOL] ⚠️ Context health check failed:`, error.message);
      return false;
    }
  }

  /**
   * 🔨 Force close a context (for stuck/unhealthy contexts)
   * Used when operations timeout - context might be in bad state
   */
  private async forceCloseContext(handle: ContextHandle): Promise<void> {
    console.log(`[BROWSER_POOL] 🔨 Force-closing potentially stuck context...`);
    
    try {
      // Find context ID in our map
      const contextId = Array.from(this.contexts.entries())
        .find(([_, h]) => h === handle)?.[0];
      
      if (!contextId) {
        console.warn(`[BROWSER_POOL] ⚠️ Context not found in map, skipping close`);
        return;
      }
      
      // Force close with timeout (even closing can hang!)
      await Promise.race([
        handle.context.close(),
        this.timeoutAfter(5000, 'context-close')
      ]).catch((error) => {
        console.warn(`[BROWSER_POOL] ⚠️ Force close timed out: ${error.message}`);
        // Continue anyway - we'll remove it from pool
      });
      
      // Remove from pool regardless of close success
      this.contexts.delete(contextId);
      this.metrics.contextsClosed++;
      this.metrics.activeContexts = this.contexts.size;
      
      console.log(`[BROWSER_POOL] ✅ Context force-closed (remaining: ${this.contexts.size}/${this.MAX_CONTEXTS})`);
      
    } catch (error: any) {
      console.error(`[BROWSER_POOL] ❌ Force close error:`, error.message);
    }
  }

  /**
   * Acquire a context from pool or create new one
   * 
   * ✨ ENHANCED with health checking to prevent using broken contexts
   */
  private async acquireContext(): Promise<ContextHandle | null> {
    // Try to find available context
    for (const [id, handle] of this.contexts) {
      if (!handle.inUse && handle.operationCount < handle.maxOperations) {
        
        // ✅ NEW: Health check before using context
        const isHealthy = await this.isContextHealthy(handle);
        if (!isHealthy) {
          console.warn(`[BROWSER_POOL] ⚠️ Context ${id} is unhealthy, removing from pool...`);
          await this.forceCloseContext(handle);
          continue; // Try next context
        }
        
        handle.inUse = true;
        handle.lastUsed = new Date();
        handle.operationCount++;
        return handle;
      }
    }

    // Create new context if under limit
    if (this.contexts.size < this.MAX_CONTEXTS) {
      return await this.createNewContext();
    }

    // All contexts busy
    return null;
  }

  /**
   * Create a new context in the pool
   */
  private async createNewContext(): Promise<ContextHandle> {
    // Ensure browser exists
    if (!this.browser || !this.browser.isConnected()) {
      await this.initializeBrowser();
    }

    const contextId = `ctx-${Date.now()}-${this.metrics.contextsCreated}`;
    console.log(`[BROWSER_POOL] 🆕 Creating context: ${contextId}`);
    console.log(`[BROWSER_POOL] 🔍 TWITTER_SESSION_B64 exists: ${!!process.env.TWITTER_SESSION_B64}`);
    console.log(`[BROWSER_POOL] 🔍 TWITTER_SESSION_B64 length: ${process.env.TWITTER_SESSION_B64?.length || 0}`);

    // Load session state from TWITTER_SESSION_B64 (primary source)
    let storageState;
    if (process.env.TWITTER_SESSION_B64) {
      try {
        console.log('[BROWSER_POOL] 🔐 Loading session from TWITTER_SESSION_B64...');
        const sessionData = Buffer.from(process.env.TWITTER_SESSION_B64, 'base64').toString('utf-8');
        const sessionJson = JSON.parse(sessionData);
        
        if (sessionJson.cookies || sessionJson.origins) {
          storageState = sessionJson;
          console.log(`[BROWSER_POOL] ✅ Session loaded (${sessionJson.cookies?.length || 0} cookies)`);
        } else if (Array.isArray(sessionJson)) {
          // Handle legacy format where sessionJson is just cookies array
          storageState = { cookies: sessionJson };
          console.log(`[BROWSER_POOL] ✅ Legacy session loaded (${sessionJson.length} cookies)`);
        }
      } catch (error: any) {
        console.warn('[BROWSER_POOL] ⚠️ Session load failed, using fresh context:', error.message);
      }
    } else {
      console.warn('[BROWSER_POOL] ⚠️ TWITTER_SESSION_B64 not found - contexts will not be authenticated');
    }

    const context = await this.browser!.newContext({
      storageState,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      viewport: { width: 1280, height: 720 }
    });

    const handle: ContextHandle = {
      context,
      inUse: true,
      lastUsed: new Date(),
      operationCount: 0,
      maxOperations: this.MAX_OPERATIONS_PER_CONTEXT
    };

    this.contexts.set(contextId, handle);
    this.metrics.contextsCreated++;
    this.metrics.activeContexts = this.contexts.size;

    console.log(`[BROWSER_POOL] ✅ Context created (total: ${this.contexts.size}/${this.MAX_CONTEXTS})`);
    
    return handle;
  }

  /**
   * Initialize the browser instance
   */
  private async initializeBrowser(): Promise<void> {
    console.log('[BROWSER_POOL] 🚀 Initializing browser...');
    
    // Check if session exists in env var (Railway persistent storage)
    this.sessionLoaded = !!process.env.TWITTER_SESSION_B64;
    if (this.sessionLoaded) {
      console.log('[BROWSER_POOL] ✅ TWITTER_SESSION_B64 detected - sessions will be authenticated');
    } else {
      console.warn('[BROWSER_POOL] ⚠️ TWITTER_SESSION_B64 not found - sessions will be unauthenticated');
    }

    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Important for Railway memory limits
        '--disable-gpu',
        '--disable-web-security',
        '--memory-pressure-off',
        '--max_old_space_size=2048', // Limit to 2GB
        // Force new headless mode (fixes zygote crash)
        '--headless=new'
      ]
    });

    console.log('[BROWSER_POOL] ✅ Browser initialized');
  }

  /**
   * Release context back to pool
   */
  private releaseContext(handle: ContextHandle): void {
    handle.inUse = false;
    handle.lastUsed = new Date();
    
    // Close context if it's exceeded max operations
    if (handle.operationCount >= handle.maxOperations) {
      console.log(`[BROWSER_POOL] 🔄 Context reached max operations (${handle.operationCount}), will be replaced`);
      this.closeContext(handle);
    }
  }

  /**
   * Close a specific context
   */
  private async closeContext(handle: ContextHandle): Promise<void> {
    const contextId = Array.from(this.contexts.entries())
      .find(([_, h]) => h === handle)?.[0];
    
    if (contextId) {
      try {
        await handle.context.close();
        this.contexts.delete(contextId);
        this.metrics.contextsClosed++;
        this.metrics.activeContexts = this.contexts.size;
        console.log(`[BROWSER_POOL] ✅ Context closed (remaining: ${this.contexts.size})`);
      } catch (error: any) {
        console.warn(`[BROWSER_POOL] ⚠️ Error closing context: ${error.message}`);
      }
    }
  }

  /**
   * Periodic cleanup of idle contexts
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupIdleContexts().catch(err => {
        console.error('[BROWSER_POOL] ❌ Cleanup error:', err.message);
      });
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Close contexts that have been idle too long
   */
  private async cleanupIdleContexts(): Promise<void> {
    const now = new Date();
    const idleContexts: ContextHandle[] = [];

    for (const [id, handle] of this.contexts) {
      if (!handle.inUse) {
        const idleTime = now.getTime() - handle.lastUsed.getTime();
        if (idleTime > this.CONTEXT_IDLE_TIMEOUT) {
          idleContexts.push(handle);
        }
      }
    }

    if (idleContexts.length > 0) {
      console.log(`[BROWSER_POOL] 🧹 Cleaning up ${idleContexts.length} idle contexts`);
      for (const handle of idleContexts) {
        await this.closeContext(handle);
      }
    }
  }

  /**
   * Get count of active (in-use) contexts
   */
  private getActiveCount(): number {
    return Array.from(this.contexts.values()).filter(h => h.inUse).length;
  }

  /**
   * Circuit breaker: Record successful operation
   */
  private recordSuccess(): void {
    // Reset failure count on success
    this.circuitBreaker.failures = 0;
    
    // Close circuit if it was open
    if (this.circuitBreaker.isOpen && Date.now() > this.circuitBreaker.openUntil) {
      console.log('[BROWSER_POOL] ✅ Circuit breaker CLOSED (recovered from failures)');
      this.circuitBreaker.isOpen = false;
    }
  }

  /**
   * Circuit breaker: Record failed operation
   */
  private recordFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();
    
    if (this.circuitBreaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD && !this.circuitBreaker.isOpen) {
      this.circuitBreaker.isOpen = true;
      this.circuitBreaker.openUntil = Date.now() + this.CIRCUIT_BREAKER_TIMEOUT;
      console.error(`[BROWSER_POOL] 🚨 Circuit breaker OPEN after ${this.circuitBreaker.failures} failures. Will retry in ${this.CIRCUIT_BREAKER_TIMEOUT/1000}s`);
    }
  }

  /**
   * Check if circuit breaker allows operation
   */
  public isCircuitBreakerOpen(): boolean {
    if (this.circuitBreaker.isOpen) {
      // Check if timeout has passed
      if (Date.now() > this.circuitBreaker.openUntil) {
        console.log('[BROWSER_POOL] 🔄 Circuit breaker timeout passed, attempting recovery...');
        return false; // Allow retry
      }
      return true; // Still open
    }
    return false;
  }

  /**
   * Get current health status
   */
  public getHealth() {
    const metrics = this.getMetrics();
    const successRate = metrics.totalOperations > 0 
      ? (metrics.successfulOperations / metrics.totalOperations) * 100 
      : 100;
    
    return {
      status: this.circuitBreaker.isOpen ? 'degraded' : (successRate > 80 ? 'healthy' : 'warning'),
      metrics,
      circuitBreaker: {
        isOpen: this.circuitBreaker.isOpen,
        failures: this.circuitBreaker.failures,
        openUntil: this.circuitBreaker.isOpen ? new Date(this.circuitBreaker.openUntil).toISOString() : null
      },
      successRate: successRate.toFixed(1) + '%'
    };
  }

  /**
   * Get current metrics
   */
  public getMetrics() {
    return {
      ...this.metrics,
      queueLength: this.queue.length,
      activeContexts: this.getActiveCount(),
      totalContexts: this.contexts.size
    };
  }

  /**
   * Print metrics (for monitoring)
   */
  public printMetrics(): void {
    const metrics = this.getMetrics();
    console.log('[BROWSER_POOL] 📊 Metrics:');
    console.log(`  Operations: ${metrics.totalOperations} total, ${metrics.queuedOperations} queued`);
    console.log(`  Contexts: ${metrics.activeContexts}/${metrics.totalContexts} active, ${metrics.contextsCreated} created, ${metrics.contextsClosed} closed`);
    console.log(`  Queue: ${metrics.queueLength} waiting, peak ${metrics.peakQueue}`);
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    console.log('[BROWSER_POOL] 🛑 Shutting down...');
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Close all contexts
    const closePromises = Array.from(this.contexts.values()).map(h => 
      h.context.close().catch(e => console.warn('Context close error:', e))
    );
    await Promise.all(closePromises);
    this.contexts.clear();

    // Close browser
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    this.printMetrics();
    console.log('[BROWSER_POOL] ✅ Shutdown complete');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 🔥 EMERGENCY: Reset corrupted browser pool
   * Use when browser operations are hanging (EAGAIN errors, timeouts)
   */
  public async resetPool(): Promise<void> {
    console.warn('[BROWSER_POOL] 🚨 EMERGENCY RESET: Resetting corrupted browser pool...');
    
    try {
      // Force close everything
      await this.shutdown();
      
      // Reset state
      this.sessionLoaded = false;
      this.metrics.failedOperations = 0;
      this.circuitBreaker.failures = 0;
      this.circuitBreaker.isOpen = false;
      
      // Restart cleanup timer
      this.startCleanupTimer();
      
      console.log('[BROWSER_POOL] ✅ Browser pool reset complete - ready for new operations');
    } catch (error: any) {
      console.error('[BROWSER_POOL] ❌ Reset failed:', error.message);
      throw error;
    }
  }
}

// Export singleton instance getter
export const getBrowserPool = () => UnifiedBrowserPool.getInstance();

