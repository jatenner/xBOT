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

import fs from 'fs';
import { createHash } from 'crypto';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import type { BrowserContextOptions } from 'playwright';
import { loadTwitterStorageState, cloneStorageState, type TwitterStorageState } from '../utils/twitterSessionState';

const clamp = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
};

const parseEnvInt = (key: string, fallback: number, min: number, max: number): number => {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) return fallback;
  return clamp(parsed, min, max);
};

const MAX_CONTEXTS_CONFIG = parseEnvInt('BROWSER_MAX_CONTEXTS', 5, 1, 15); // Increased max to 15 to allow higher values (was clamped at 10)
const MAX_OPERATIONS_CONFIG = parseEnvInt('BROWSER_MAX_OPERATIONS', 25, 5, 100);
const QUEUE_WAIT_TIMEOUT_CONFIG = parseEnvInt('BROWSER_QUEUE_TIMEOUT_MS', 60000, 10000, 300000);
const CIRCUIT_BREAKER_TIMEOUT_CONFIG = parseEnvInt('BROWSER_CIRCUIT_BREAKER_TIMEOUT_MS', 60000, 30000, 600000);
const HARD_FAILURE_COOLDOWN_MS = parseEnvInt('BROWSER_HARD_FAILURE_COOLDOWN_MS', 180000, 60000, 900000);

const RESOURCE_ERROR_PATTERNS = [
  'Resource temporarily unavailable',
  'Target page, context or browser has been closed',
  'zygote could not fork',
  'pthread_create'
];

const DISCONNECTED_ERROR_PATTERNS = [
  'Target page, context or browser has been closed',
  'Browser has been closed',
  'Protocol error',
  'Execution context was destroyed',
  'browserContext.newPage: Target page, context or browser has been closed'
];

interface ContextHandle {
  context: BrowserContext;
  inUse: boolean;
  lastUsed: Date;
  operationCount: number;
  maxOperations: number;
  sessionAppliedVersion: number;
}

interface QueuedOperation {
  id: string;
  priority: number;
  operation: (context: BrowserContext) => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  cancelTimeout?: () => void;
}

export class UnifiedBrowserPool {
  private static instance: UnifiedBrowserPool;
  private browser: Browser | null = null;
  private contexts: Map<string, ContextHandle> = new Map();
  private queue: QueuedOperation[] = [];
  private isProcessingQueue = false;
  private sessionLoaded = false;
  private cachedStorageState: TwitterStorageState | null = null;
  private sessionVersion = 0;
  private sessionWarningLogged = false;
  private sessionEnvHash: string | null = null;
  private sessionFileSignature: string | null = null;
  
  // Pool instance identification
  public readonly poolInstanceUid: string;
  
  // Configuration
  private readonly MAX_CONTEXTS = MAX_CONTEXTS_CONFIG; // Tunable via BROWSER_MAX_CONTEXTS (default=2 for Railway stability)
  private readonly MAX_OPERATIONS_PER_CONTEXT = MAX_OPERATIONS_CONFIG; // Tunable via BROWSER_MAX_OPERATIONS (default=25)
  private readonly CONTEXT_IDLE_TIMEOUT = 5 * 60 * 1000; // Close idle contexts after 5 min
  private readonly CLEANUP_INTERVAL = 60 * 1000; // Check every minute
  private readonly QUEUE_WAIT_TIMEOUT = QUEUE_WAIT_TIMEOUT_CONFIG; // Max wait in queue (default 60s)
  
  private cleanupTimer: NodeJS.Timeout | null = null;
  private watchdogTimer: NodeJS.Timeout | null = null;
  private metrics = {
    totalOperations: 0,
    queuedOperations: 0,
    activeContexts: 0,
    peakQueue: 0,
    contextsCreated: 0,
    contextsClosed: 0,
    successfulOperations: 0,
    failedOperations: 0,
    averageWaitTime: 0,
    totalWaitTime: 0,
    waitTimeSamples: 0,
    timeoutsLast1h: 0,
  };
  private resourceFailureCount = 0;
  
  // 🐕 POOL WATCHDOG: Track context acquisition wait times
  private acquireWaitStartTimes: Map<string, number> = new Map(); // operationId -> startTime
  private contextActiveStartTimes: Map<string, number> = new Map(); // contextId -> startTime
  
  // 🔥 MEMORY OPTIMIZATION: Track operations for browser restart cycle
  private totalOperationCount = 0; // Track total operations across all contexts
  private readonly BROWSER_RESTART_INTERVAL = 100; // Restart browser every 100 operations to free memory
  
  // Circuit breaker state
  private circuitBreaker = {
    failures: 0,
    lastFailure: 0,
    isOpen: false,
    openUntil: 0,
    reason: null as string | null
  };
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5; // Open after 5 failures
  private readonly CIRCUIT_BREAKER_TIMEOUT = CIRCUIT_BREAKER_TIMEOUT_CONFIG; // Stay open for configurable duration

  private constructor() {
    // Generate unique instance ID
    this.poolInstanceUid = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // 🚀 BOOT LOG: Log pool initialization with clamp details
    const requestedEnv = process.env.BROWSER_MAX_CONTEXTS || 'default';
    const requestedNum = requestedEnv !== 'default' ? parseInt(requestedEnv, 10) : null;
    const appliedMaxContexts = this.MAX_CONTEXTS;
    const clampMax = 15; // Match parseEnvInt max parameter
    const wasClamped = requestedNum !== null && requestedNum > clampMax;
    console.log(`[BOOT] Browser pool uid=${this.poolInstanceUid} requested_env_max_contexts=${requestedEnv} applied_max_contexts=${appliedMaxContexts} clamp_max=${clampMax}${wasClamped ? ' (WAS_CLAMPED)' : ''}`);
    
    // Start periodic cleanup
    this.startCleanupTimer();
    
    // 🐕 POOL WATCHDOG: Start watchdog timer
    this.startWatchdog();
    
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
    const PAGE_ACQUIRE_TIMEOUT = 90000; // 90 seconds max (harvester needs time for slow timelines)
    
    const acquirePromise = this.withContext(operationName, async (context) => {
      const page = await context.newPage();
      return page;
    });
    
    let timeoutId: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        console.error(`[BROWSER_POOL] ⏱️ TIMEOUT: acquirePage('${operationName}') exceeded ${PAGE_ACQUIRE_TIMEOUT/1000}s`);
        console.error(`[BROWSER_POOL] 🚨 Browser pool may be corrupted, triggering recovery...`);
        reject(new Error(`Browser pool timeout after ${PAGE_ACQUIRE_TIMEOUT/1000}s - pool may be corrupted`));
      }, PAGE_ACQUIRE_TIMEOUT);
    });
    
    try {
      const result = await Promise.race([
        acquirePromise,
        timeoutPromise
      ]) as Page;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      return result;
    } catch (error: any) {
      // If timeout, browser pool is likely corrupted - log for monitoring
      if (error.message.includes('timeout')) {
        console.error(`[BROWSER_POOL] ❌ CRITICAL: Browser pool timeout - system may need restart`);
        this.metrics.failedOperations++;
      }
      throw error;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
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
    
    console.log(`[BROWSER_POOL] 📝 Request: ${operationName} (queue: ${this.queue.length}, active: ${this.getActiveCount()}, priority: ${priority})`);

    // ✅ RECOVER: Ensure browser/context are live before proceeding
    await this.ensureLiveContext(operationName);

    // 🔥 ENHANCEMENT: Async circuit breaker check
    const breakerOpen = await this.isCircuitBreakerOpen();
    if (breakerOpen) {
      const breakerReason = this.circuitBreaker.reason || 'circuit_breaker';
      throw new Error(`Browser pool circuit breaker open (${breakerReason})`);
    }
    
    // 🔥 OPTIMIZATION: Longer timeout for critical operations (posting, replies, ID extraction)
    // Posting operations are critical - they should wait longer than background jobs
    // ID extraction operations need extra time (progressive waits can take up to 67s)
    const isCriticalOperation = priority <= 1; // Priority 0 or 1 (replies, posting)
    const isIdExtractionOperation = operationName.includes('id_recovery') || 
                                    operationName.includes('extract') || 
                                    operationName.includes('recovery');
    const timeoutMs = isCriticalOperation || isIdExtractionOperation
      ? Math.max(this.QUEUE_WAIT_TIMEOUT * 5, 300000) // 🔥 ENHANCEMENT: 5x timeout or 5min min for critical/ID extraction ops
      : this.QUEUE_WAIT_TIMEOUT; // Normal timeout for background jobs
    
    // 🎯 THROTTLE: Hard cap on queue depth to prevent overload
    const MAX_QUEUE_DEPTH = parseInt(process.env.BROWSER_MAX_QUEUE_DEPTH || '30', 10); // Default 30
    if (this.queue.length >= MAX_QUEUE_DEPTH) {
      console.warn(`[BROWSER_POOL][THROTTLE] Queue depth ${this.queue.length} >= ${MAX_QUEUE_DEPTH}, rejecting ${operationName}`);
      this.metrics.totalOperations++; // Count as attempted but dropped
      return Promise.reject(new Error(`Queue depth limit exceeded (${this.queue.length}/${MAX_QUEUE_DEPTH})`));
    }
    
    // 🚨 POSTING PRIORITY GUARD: Drop background operations when queue is deep and posting is waiting
    const POSTING_PRIORITY_THRESHOLD = 3; // Drop background ops if queue depth exceeds this
    const isBackgroundOperation = priority > 1; // Priority > 1 means background (metrics, vi_scrape, etc.)
    const hasPostingWaiting = this.queue.some(op => op.priority <= 1); // Check if any posting/reply ops are waiting
    
    if (isBackgroundOperation && this.queue.length >= POSTING_PRIORITY_THRESHOLD && hasPostingWaiting) {
      console.log(`[BROWSER_POOL][GUARD] posting_priority queueDepth=${this.queue.length} dropped label=${operationName}`);
      this.metrics.totalOperations++; // Count as attempted but dropped
      return Promise.reject(new Error(`Background operation dropped due to posting priority (queue depth: ${this.queue.length})`));
    }

    // Update metrics
    this.metrics.totalOperations++;
    this.metrics.queuedOperations++;
    if (this.queue.length > this.metrics.peakQueue) {
      this.metrics.peakQueue = this.queue.length;
    }

    return new Promise<T>((resolve, reject) => {
      const queuedAt = Date.now();
      
      // 🐕 POOL WATCHDOG: Track acquire wait start time
      this.acquireWaitStartTimes.set(operationId, queuedAt);
      
      // 🔥 QUEUE TIMEOUT: Reject if waiting too long (prevents infinite waits)
      // 🔥 OPTIMIZATION: Critical operations get longer timeout
      const queueTimeoutTimer = setTimeout(() => {
        const waitTime = Date.now() - queuedAt;
        
        // 🎯 METRICS: Track timeout (reset hourly)
        this.metrics.timeoutsLast1h = (this.metrics.timeoutsLast1h || 0) + 1;
        
        console.error(`[BROWSER_POOL] ⏱️ QUEUE TIMEOUT: ${operationName} waited ${Math.round(waitTime/1000)}s (timeout: ${timeoutMs/1000}s)`);
        console.error(`[BROWSER_POOL] 📊 Current: ${this.queue.length} queued, ${this.getActiveCount()} active`);
        const timeoutPoolStats = {
          queue_len: this.queue.length,
          active: this.getActiveCount(),
          idle: this.contexts.size - this.getActiveCount(),
          max_contexts: this.MAX_CONTEXTS,
        };
        const operationType = isCriticalOperation ? 'CRITICAL' : (operationName.includes('resolve_root_tweet') ? 'ANCESTRY' : 'background');
        console.error(`[BROWSER_POOL] 🚨 Priority: ${priority} (${operationType}) pool=${JSON.stringify(timeoutPoolStats)}`);
        console.error(`[BROWSER_POOL] ⏱️ QUEUE TIMEOUT DETAILS: ${JSON.stringify(timeoutPoolStats)}`);
        
        // Remove from queue
        const index = this.queue.findIndex(op => op.id === operationId);
        if (index !== -1) {
          this.queue.splice(index, 1);
          this.metrics.queuedOperations--;
        }
        
        // 🐕 POOL WATCHDOG: Clear acquire wait tracking
        this.acquireWaitStartTimes.delete(operationId);
        
        reject(new Error(`Queue timeout after ${Math.round(waitTime/1000)}s - pool overloaded (priority: ${priority}, timeout: ${timeoutMs/1000}s, queue_len=${this.queue.length}, active=${this.getActiveCount()}/${this.MAX_CONTEXTS})`));
      }, timeoutMs);
      
      // Wrap operation to clear timeout when it starts
      const wrappedOperation = async (ctx: BrowserContext) => {
        clearTimeout(queueTimeoutTimer); // Cancel timeout - we're starting!
        
        // 🎯 METRICS: Record wait time for rolling average
        const waitTime = Date.now() - queuedAt;
        this.metrics.totalWaitTime = (this.metrics.totalWaitTime || 0) + waitTime;
        this.metrics.waitTimeSamples = (this.metrics.waitTimeSamples || 0) + 1;
        // Rolling average: keep last 100 samples
        if (this.metrics.waitTimeSamples > 100) {
          this.metrics.totalWaitTime = (this.metrics.totalWaitTime || 0) * 0.99; // Decay old samples
          this.metrics.waitTimeSamples = 100;
        }
        this.metrics.averageWaitTime = this.metrics.waitTimeSamples > 0 
          ? (this.metrics.totalWaitTime || 0) / this.metrics.waitTimeSamples 
          : 0;
        
        return operation(ctx);
      };
      
      this.queue.push({
        id: operationId,
        priority,
        operation: wrappedOperation as any,
        resolve: resolve as any,
        reject,
        cancelTimeout: () => clearTimeout(queueTimeoutTimer)
      });
      
      // ✅ FAIR SCHEDULING: Sort by priority, but ensure low-priority ops eventually get processed
      // Strategy: Process high-priority first, but always include at least 1 low-priority op per batch
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
        
        const breakerOpen = await this.isCircuitBreakerOpen();
        if (breakerOpen) {
          const breakerReason = this.circuitBreaker.reason || 'circuit_breaker';
          console.warn(`[BROWSER_POOL] 🚫 Circuit breaker (${breakerReason}) open - draining queue of ${this.queue.length} operations`);
          while (this.queue.length > 0) {
            const drained = this.queue.shift()!;
            this.metrics.queuedOperations = Math.max(0, this.metrics.queuedOperations - 1);
            drained.cancelTimeout?.();
            drained.reject(new Error(`Browser pool unavailable: ${breakerReason}`));
          }
          break;
        }
        
        // ═══════════════════════════════════════════════════════════
        // PARALLEL BATCH: Acquire up to MAX_CONTEXTS for concurrent execution
        // ═══════════════════════════════════════════════════════════
        
        const batch: Array<{op: QueuedOperation, context: ContextHandle}> = [];
        
        // ✅ FAIR SCHEDULING: Ensure both high-priority (posting) and low-priority (VI scraper) get processed
        // Strategy: With 3 contexts, we can run 1 posting + 1 VI scraper + 1 buffer simultaneously
        // This guarantees VI scraper always gets a turn even when posting is active
        
        // Separate queue into high and low priority
        const PRIORITY_THRESHOLD = 5; // Ops with priority <= 5 are high-priority
        const highPriorityOps = this.queue.filter(op => op.priority <= PRIORITY_THRESHOLD);
        const lowPriorityOps = this.queue.filter(op => op.priority > PRIORITY_THRESHOLD);
        
        // Try to acquire multiple contexts (up to MAX_CONTEXTS)
        // ✅ FAIR: If we have 2+ contexts, always include at least 1 low-priority op when available
        let lowPriorityIncluded = false;
        for (let i = 0; i < this.MAX_CONTEXTS && this.queue.length > 0; i++) {
          const contextHandle = await this.acquireContext();
          
          if (!contextHandle) {
            // No more contexts available for this batch
            break;
          }
          
          // ✅ FAIR SCHEDULING: Include low-priority op if we have capacity and haven't included one yet
          let op: QueuedOperation | undefined;
          if (this.MAX_CONTEXTS >= 2 && !lowPriorityIncluded && lowPriorityOps.length > 0 && i >= 1) {
            // Include at least 1 low-priority op when we have 2+ contexts (after processing at least 1 high-priority)
            op = lowPriorityOps.shift();
            lowPriorityIncluded = true;
          } else if (highPriorityOps.length > 0) {
            // Process high-priority first
            op = highPriorityOps.shift();
          } else if (lowPriorityOps.length > 0) {
            // Then process low-priority
            op = lowPriorityOps.shift();
          }
          
          if (!op) {
            // No more operations, release the context we just acquired
            this.releaseContext(contextHandle);
            break;
          }
          
          // Remove from main queue
          const queueIndex = this.queue.findIndex(q => q.id === op.id);
          if (queueIndex !== -1) {
            this.queue.splice(queueIndex, 1);
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
        
        // Execute all operations in parallel using Promise.allSettled
        // This ensures one failure doesn't stop others
        const results = await Promise.allSettled(
          batch.map(async ({ op, context }) => {
            const startTime = Date.now();
            let contextClosed = false;
            let usedRetryContext = false;
            let retryContextHandle: ContextHandle | null = null;
            
            // ✅ Extract operation label from operation ID (format: "operationName-timestamp-random")
            const operationLabel = op.id.split('-')[0];
            const timeoutMs = this.getOpTimeoutMs(operationLabel);
            console.log(`[BROWSER_POOL][TIMEOUT] label=${operationLabel} timeoutMs=${timeoutMs}`);
            
            try {
              console.log(`[BROWSER_POOL]   → ${op.id}: Starting...`);
              await this.ensureContextSession(context);
              
              // ✅ CRITICAL FIX: Race against timeout (per-label timeout)
              let result: any;
              try {
                result = await Promise.race([
                op.operation(context.context),
                  this.timeoutAfter(timeoutMs, op.id)
                ]);
              } catch (operationError: any) {
                // ✅ DEBUG: Log error details for diagnosis
                const errorName = operationError?.name || 'Unknown';
                const errorMsg = operationError?.message || String(operationError) || 'No message';
                const operationLabel = op.id.split('-')[0]; // Extract operation name (e.g., "thread_posting")
                console.log(`[BROWSER_POOL][DEBUG] caught_error op=${op.id} label=${operationLabel} name=${errorName} msg=${errorMsg.substring(0, 200)}`);
                
                // ✅ RECOVER: Catch disconnected errors and retry once
                const isDisconnected = this.isDisconnectedError(operationError);
                console.log(`[BROWSER_POOL][DEBUG] disconnected_match=${isDisconnected} op=${op.id} label=${operationLabel}`);
                
                if (isDisconnected) {
                  console.log(`[BROWSER_POOL][RECOVER] reason=browser_disconnected action=reset op=${op.id} label=${operationLabel} retry=1`);
                  
                  // Mark original context as closed (resetPool will close it)
                  contextClosed = true;
                  
                  // Reset pool and retry operation once
                  await this.resetPool();
                  await this.ensureLiveContext(op.id);
                  
                  // Re-acquire context for retry
                  retryContextHandle = await this.acquireContext();
                  if (!retryContextHandle) {
                    throw new Error(`Failed to acquire context for retry after disconnect`);
                  }
                  usedRetryContext = true;
                  
                  try {
                    await this.ensureContextSession(retryContextHandle);
                    // ✅ Use same timeout for retry (already logged above)
                    result = await Promise.race([
                      op.operation(retryContextHandle.context),
                      this.timeoutAfter(timeoutMs, `${op.id}-retry`)
              ]);
                  } catch (retryError: any) {
                    throw retryError; // Rethrow if retry also fails
                  }
                } else {
                  throw operationError; // Rethrow non-disconnected errors
                }
              }
              
              const duration = Date.now() - startTime;
              console.log(`[BROWSER_POOL]   ✅ ${op.id}: Completed (${duration}ms)`);
              
              op.resolve(result);
              this.metrics.successfulOperations++;
              
              // 🔥 MEMORY OPTIMIZATION: Track operations for browser restart cycle
              this.totalOperationCount++;
              
              // ✅ BACKGROUND RESTART: Schedule browser restart in background (never blocks)
              // Operations continue normally - restart happens independently
              if (this.totalOperationCount >= this.BROWSER_RESTART_INTERVAL) {
                console.log(`[BROWSER_POOL] 🔄 Browser restart scheduled after ${this.totalOperationCount} operations (will restart in background)`);
                
                // Schedule restart in background (fire and forget - never blocks operations)
                setImmediate(async () => {
                  try {
                    // Wait for operations to complete (but don't block new operations)
                    // Check periodically if safe to restart
                    const maxWaitTime = 30000; // Max 30 seconds wait
                    const checkInterval = 2000; // Check every 2 seconds
                    let waited = 0;
                    
                    while (this.getActiveCount() > 0 || this.queue.length > 0) {
                      if (waited >= maxWaitTime) {
                        console.log(`[BROWSER_POOL] ⏸️ Browser restart deferred - operations still active after ${waited}ms (will retry later)`);
                        return; // Will retry on next operation completion
                      }
                      
                      await new Promise(r => setTimeout(r, checkInterval));
                      waited += checkInterval;
                    }
                    
                    // Safe to restart - operations complete
                    console.log(`[BROWSER_POOL] 🔄 Restarting browser in background (no operations active)...`);
                    
                    // Close all contexts first
                    const contextsToClose = Array.from(this.contexts.keys());
                    for (const id of contextsToClose) {
                      const handle = this.contexts.get(id);
                      if (handle && !handle.inUse) {
                        try {
                          await handle.context.close();
                        } catch (e) {
                          // Ignore errors
                        }
                        this.contexts.delete(id);
                      }
                    }
                    
                    // Close browser
                    if (this.browser) {
                      await this.browser.close().catch(() => {});
                      this.browser = null;
                    }
                    
                    // Reset counters
                    this.totalOperationCount = 0;
                    this.sessionLoaded = false; // Will reload session on next use
                    
                    console.log(`[BROWSER_POOL] ✅ Browser restarted in background - memory should be freed`);
                  } catch (restartError: any) {
                    console.error(`[BROWSER_POOL] ⚠️ Browser restart failed:`, restartError.message);
                    // Continue anyway - browser will restart on next operation
                  }
                });
              }
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
                
                // 🐕 POOL WATCHDOG: Clear active tracking (forceCloseContext already handles this)
                
              } else {
                console.error(`[BROWSER_POOL]   ❌ ${op.id}: Failed (${duration}ms) - ${error.message}`);
              }
              
              op.reject(error);
              this.metrics.failedOperations++;
              const failureReason = isTimeout ? 'operation_timeout' : (error.message || 'operation_failed');
              this.recordFailure(failureReason);
              
            } finally {
              // Release context back to pool
              if (usedRetryContext && retryContextHandle) {
                // Release retry context if we used it
                this.releaseContext(retryContextHandle);
              } else if (!contextClosed) {
                // Release original context if it wasn't closed
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
   * ⏰ Get operation timeout based on label (posting operations get longer timeouts)
   */
  private getOpTimeoutMs(label?: string): number {
    const l = (label || '').toLowerCase();
    if (l.includes('thread_posting')) return 360_000; // 6 min
    if (l.includes('reply_posting')) return 300_000; // 5 min
    if (l.includes('tweet_posting')) return 300_000; // 5 min
    if (l.includes('posting_recovery')) return 360_000; // 6 min
    return 180_000; // default unchanged for everything else (was 60s, increased to 180s to match BrowserSemaphore)
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

  private isResourceExhaustionError(error: any): boolean {
    if (!error || typeof error.message !== 'string') {
      return false;
    }
    return RESOURCE_ERROR_PATTERNS.some(pattern => error.message.toLowerCase().includes(pattern.toLowerCase()));
  }

  /**
   * 🔍 Check if error indicates browser/context/page disconnection
   */
  private isDisconnectedError(err: unknown): boolean {
    if (!err) return false;
    
    // Extract error message from various sources
    let errorMsg = '';
    if (err instanceof Error) {
      errorMsg = err.message || '';
      // Also check cause and stack (using type-safe access)
      const errAny = err as any;
      if (errAny.cause && typeof errAny.cause === 'object' && 'message' in errAny.cause) {
        errorMsg += ' ' + String(errAny.cause.message);
      }
      if (err.stack) {
        errorMsg += ' ' + err.stack;
      }
    } else {
      errorMsg = String(err);
    }
    
    if (!errorMsg) return false;
    
    const lowerMsg = errorMsg.toLowerCase();
    
    // Check all patterns (case-insensitive)
    return DISCONNECTED_ERROR_PATTERNS.some(pattern => {
      const patternLower = pattern.toLowerCase();
      return lowerMsg.includes(patternLower) || 
             lowerMsg.includes('browsercontext.newpage') ||
             lowerMsg.includes('has been closed');
    });
  }

  /**
   * 🔄 Ensure browser and context are live, recreate if disconnected
   */
  private async ensureLiveContext(label?: string): Promise<void> {
    // Check browser connection
    if (!this.browser || !this.browser.isConnected()) {
      console.log(`[BROWSER_POOL][RECOVER] reason=browser_disconnected action=reset${label ? ` label=${label}` : ''}`);
      await this.resetPool();
      return;
    }

    // Check if we can still create pages (context health check)
    // If browser is connected but contexts are dead, we'll detect it during createNewContext
    // For now, just ensure browser is connected
  }

  private openCircuitBreaker(reason: string, cooldownMs: number = this.CIRCUIT_BREAKER_TIMEOUT): void {
    const newExpiry = Date.now() + cooldownMs;
    if (this.circuitBreaker.isOpen && this.circuitBreaker.reason === reason) {
      this.circuitBreaker.openUntil = Math.max(this.circuitBreaker.openUntil, newExpiry);
      return;
    }
    this.circuitBreaker.isOpen = true;
    this.circuitBreaker.reason = reason;
    this.circuitBreaker.openUntil = newExpiry;
    this.circuitBreaker.failures = Math.max(this.circuitBreaker.failures, this.CIRCUIT_BREAKER_THRESHOLD);
    console.error(`[BROWSER_POOL] 🚨 Circuit breaker OPEN (${reason}) for ${Math.round(cooldownMs / 1000)}s`);
  }

  private async handleResourceExhaustion(error: any): Promise<never> {
    const message = error?.message || 'unknown resource error';
    this.resourceFailureCount++;
    this.metrics.failedOperations++;
    console.error(`[BROWSER_POOL] ❌ RESOURCE EXHAUSTION: ${message}`);

    // Immediately open the circuit breaker with extended cooldown
    this.openCircuitBreaker('resource_exhaustion', HARD_FAILURE_COOLDOWN_MS);

    // Attempt graceful reset in background (best effort)
    if (this.resourceFailureCount === 1) {
      try {
        await this.resetPool();
      } catch (resetError: any) {
        console.error(`[BROWSER_POOL] ❌ Reset failed after resource exhaustion:`, resetError?.message || resetError);
      }
    } else {
      console.warn(`[BROWSER_POOL] ⚠️ Skipping repeated reset (count=${this.resourceFailureCount}) while circuit breaker cools down`);
    }

    // resetPool clears breaker state; ensure cooldown remains active
    this.openCircuitBreaker('resource_exhaustion', HARD_FAILURE_COOLDOWN_MS);

    throw error;
  }

  private getSessionCanonicalPath(): string {
    const { resolveSessionPath } = require('../utils/sessionPathResolver');
    return resolveSessionPath();
  }

  private computeSessionSignatures(): { envHash: string | null; fileSignature: string | null } {
    let envHash: string | null = null;
    const sessionB64 = process.env.TWITTER_SESSION_B64?.trim();
    if (sessionB64 && sessionB64.length > 0) {
      try {
        envHash = createHash('sha256').update(sessionB64).digest('hex');
      } catch (error: any) {
        console.warn(`[BROWSER_POOL] ⚠️ Session env hash failed: ${error.message}`);
      }
    }

    let fileSignature: string | null = null;
    const canonicalPath = this.getSessionCanonicalPath();
    try {
      const stats = fs.statSync(canonicalPath);
      fileSignature = `${stats.size}:${Math.floor(stats.mtimeMs)}`;
    } catch {
      fileSignature = null;
    }

    return { envHash, fileSignature };
  }

  private async ensureStorageState(forceReload = false): Promise<TwitterStorageState | undefined> {
    const hasCachedState = !!this.cachedStorageState;
    const signaturesBefore = this.computeSessionSignatures();
    const signatureChanged = hasCachedState && (
      (this.sessionEnvHash ?? null) !== (signaturesBefore.envHash ?? null) ||
      (this.sessionFileSignature ?? null) !== (signaturesBefore.fileSignature ?? null)
    );

    const needsReload = forceReload || !hasCachedState || signatureChanged;

    if (!needsReload && this.cachedStorageState) {
      return cloneStorageState(this.cachedStorageState);
    }

    const result = await loadTwitterStorageState();

    if (result.warnings && result.warnings.length > 0) {
      for (const warning of result.warnings) {
        console.warn(`[BROWSER_POOL] ⚠️ Session load warning: ${warning}`);
      }
    }

    const signaturesAfter = this.computeSessionSignatures();
    this.sessionEnvHash = signaturesAfter.envHash;
    this.sessionFileSignature = signaturesAfter.fileSignature;

    if (result.storageState && result.cookieCount > 0) {
      const serializedNew = JSON.stringify(result.storageState.cookies);
      const serializedExisting = this.cachedStorageState
        ? JSON.stringify(this.cachedStorageState.cookies)
        : null;
      const changed = !this.cachedStorageState || serializedExisting !== serializedNew || signatureChanged || forceReload;

      this.cachedStorageState = result.storageState;
      this.sessionLoaded = true;
      this.sessionWarningLogged = false;

      if (changed || forceReload) {
        this.sessionVersion++;
        console.log(`[BROWSER_POOL] ✅ Session ready (${result.cookieCount} cookies, source=${result.source}, version ${this.sessionVersion})`);
      }

      return cloneStorageState(result.storageState);
    }

    this.cachedStorageState = null;
    this.sessionLoaded = false;

    if (!this.sessionWarningLogged) {
      console.warn('[BROWSER_POOL] ⚠️ No authenticated Twitter session detected - contexts will run unauthenticated');
      this.sessionWarningLogged = true;
    }

    return undefined;
  }

  private async ensureContextSession(handle: ContextHandle): Promise<void> {
    try {
      const storageState = await this.ensureStorageState();
      if (!storageState || storageState.cookies.length === 0) {
        return;
      }

      if (handle.sessionAppliedVersion === this.sessionVersion) {
        return;
      }

      await handle.context.addCookies(storageState.cookies);
      handle.sessionAppliedVersion = this.sessionVersion;
      console.log(`[BROWSER_POOL] 🍪 Applied session cookies to context (version ${this.sessionVersion})`);
    } catch (error: any) {
      console.warn(`[BROWSER_POOL] ⚠️ Failed to apply session cookies: ${error.message}`);
    }
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
      
      // 🐕 POOL WATCHDOG: Clear active tracking
      this.contextActiveStartTimes.delete(contextId);
      
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
        
        // 🐕 POOL WATCHDOG: Track when context becomes active
        this.contextActiveStartTimes.set(id, Date.now());
        
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
    // ✅ RECOVER: Ensure browser is live before creating context
    await this.ensureLiveContext('createNewContext');
    
    // Ensure browser exists
    if (!this.browser || !this.browser.isConnected()) {
      try {
        await this.initializeBrowser();
      } catch (error: any) {
        if (this.isResourceExhaustionError(error)) {
          await this.handleResourceExhaustion(error);
        }
        throw error;
      }
    }

    const contextId = `ctx-${Date.now()}-${this.metrics.contextsCreated}`;
    console.log(`[BROWSER_POOL] 🆕 Creating context: ${contextId}`);
    
    const storageState = await this.ensureStorageState();
    const contextOptions: BrowserContextOptions = {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      viewport: { width: 1280, height: 720 }
    };

    if (storageState) {
      contextOptions.storageState = storageState;
    }
    
    let context: BrowserContext;
    try {
      context = await this.browser!.newContext(contextOptions);
    } catch (error: any) {
      // ✅ RECOVER: If disconnected error, reset pool and retry once
      if (this.isDisconnectedError(error)) {
        console.log(`[BROWSER_POOL][RECOVER] reason=context_creation_failed action=reset label=createNewContext`);
        console.log(`[BROWSER_POOL][RECOVER] retry=1 label=createNewContext`);
        
        await this.resetPool();
        await this.ensureLiveContext('createNewContext-retry');
        
        // Retry context creation
        if (!this.browser || !this.browser.isConnected()) {
          await this.initializeBrowser();
        }
        
        const retryStorageState = await this.ensureStorageState();
        const retryContextOptions: BrowserContextOptions = {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          viewport: { width: 1280, height: 720 }
        };
        if (retryStorageState) {
          retryContextOptions.storageState = retryStorageState;
        }
        
        context = await this.browser!.newContext(retryContextOptions);
      } else if (this.isResourceExhaustionError(error)) {
        await this.handleResourceExhaustion(error);
        throw error;
      } else {
      throw error;
      }
    }

    const handle: ContextHandle = {
      context,
      inUse: true,
      lastUsed: new Date(),
      operationCount: 0,
      maxOperations: this.MAX_OPERATIONS_PER_CONTEXT,
      sessionAppliedVersion: storageState ? this.sessionVersion : -1
    };

    this.contexts.set(contextId, handle);
    this.metrics.contextsCreated++;
    this.metrics.activeContexts = this.contexts.size;
    
    // 🐕 POOL WATCHDOG: Track when context becomes active
    this.contextActiveStartTimes.set(contextId, Date.now());

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

    try {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage', // Prevent /dev/shm exhaustion (Pro plan has 32GB, multi-process is safe)
          // ✅ REMOVED --single-process and --no-zygote to fix pthread_create exhaustion
          // Multi-process Chromium (standard config) has no per-process thread limit
          '--disable-gpu',
          '--disable-web-security',
          '--memory-pressure-off',
          '--max_old_space_size=256', // Limit V8 heap per process (Pro plan supports multiple processes)
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-extensions',
          '--disable-plugins',
          // Force new headless mode for better stability
          '--headless=new'
        ]
      });
    } catch (error: any) {
      if (this.isResourceExhaustionError(error)) {
        await this.handleResourceExhaustion(error);
      }
      throw error;
    }

    console.log('[BROWSER_POOL] ✅ Browser initialized');
  }

  /**
   * Release context back to pool
   */
  private releaseContext(handle: ContextHandle): void {
    handle.inUse = false;
    handle.lastUsed = new Date();
    
    // 🐕 POOL WATCHDOG: Clear active tracking
    const contextId = Array.from(this.contexts.entries())
      .find(([_, h]) => h === handle)?.[0];
    if (contextId) {
      this.contextActiveStartTimes.delete(contextId);
    }
    
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
   * 🐕 POOL WATCHDOG: Monitor acquire waits and stuck contexts
   * - Logs pool snapshot if acquire wait > 15s
   * - Force-closes contexts stuck > 90s
   */
  private startWatchdog(): void {
    const WATCHDOG_INTERVAL = 10000; // Check every 10s
    const ACQUIRE_WAIT_WARNING_MS = 15000; // Warn if waiting > 15s
    const CONTEXT_STUCK_MS = 90000; // Force-close contexts stuck > 90s
    
    this.watchdogTimer = setInterval(() => {
      try {
        const now = Date.now();
        
        // Check acquire waits
        for (const [operationId, startTime] of this.acquireWaitStartTimes.entries()) {
          const waitTime = now - startTime;
          if (waitTime > ACQUIRE_WAIT_WARNING_MS) {
            const poolSnapshot = this.getPoolSnapshot();
            console.warn(`[POOL_WATCHDOG] ⚠️ Long acquire wait detected: operation=${operationId} wait_ms=${waitTime} ${JSON.stringify(poolSnapshot)}`);
          }
        }
        
        // Check stuck contexts
        for (const [contextId, startTime] of this.contextActiveStartTimes.entries()) {
          const activeTime = now - startTime;
          if (activeTime > CONTEXT_STUCK_MS) {
            const handle = this.contexts.get(contextId);
            if (handle) {
              console.error(`[POOL_WATCHDOG] 🚨 Stuck context detected: context=${contextId} active_ms=${activeTime} force-closing...`);
              this.forceCloseContext(handle).catch(err => {
                console.error(`[POOL_WATCHDOG] ❌ Failed to force-close context: ${err.message}`);
              });
            }
          }
        }
      } catch (err: any) {
        console.error(`[POOL_WATCHDOG] ❌ Watchdog error: ${err.message}`);
      }
    }, WATCHDOG_INTERVAL);
  }

  /**
   * Get current pool snapshot for logging
   */
  private getPoolSnapshot(): any {
    const metrics = this.getMetrics();
    let semaphoreInflight = 0;
    try {
      const { getAncestryLimiter } = require('../utils/ancestryConcurrencyLimiter');
      const limiter = getAncestryLimiter();
      const limiterStats = limiter.getStats();
      semaphoreInflight = limiterStats.current || 0;
    } catch {}
    
    return {
      max_contexts: this.MAX_CONTEXTS,
      total_contexts: this.contexts.size,
      active: this.getActiveCount(),
      idle: Math.max(0, this.contexts.size - this.getActiveCount()),
      queue_len: this.queue.length,
      semaphore_inflight: semaphoreInflight,
      avg_wait_ms: Math.round(metrics.averageWaitTime || 0),
      peak_queue: metrics.peakQueue || 0,
      contexts_created_total: metrics.contextsCreated || 0,
    };
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
    this.resourceFailureCount = 0;
    
    // Close circuit if cooldown elapsed
    if (this.circuitBreaker.isOpen && Date.now() > this.circuitBreaker.openUntil) {
      const reason = this.circuitBreaker.reason || 'failures';
      console.log(`[BROWSER_POOL] ✅ Circuit breaker CLOSED (recovered from ${reason})`);
      this.circuitBreaker.isOpen = false;
      this.circuitBreaker.reason = null;
    }
  }

  /**
   * Circuit breaker: Record failed operation
   */
  private recordFailure(reason?: string): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();
    
    if (reason && reason.toLowerCase().includes('resource')) {
      this.openCircuitBreaker(reason, HARD_FAILURE_COOLDOWN_MS);
      return;
    }
    
    if (this.circuitBreaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD && !this.circuitBreaker.isOpen) {
      this.openCircuitBreaker('failure_threshold', this.CIRCUIT_BREAKER_TIMEOUT);
    }
  }

  /**
   * Check if circuit breaker allows operation
   * 🔥 ENHANCEMENT: Auto-recovery with health checks
   */
  public async isCircuitBreakerOpen(): Promise<boolean> {
    if (!this.circuitBreaker.isOpen) {
      return false;
    }
    
    if (Date.now() > this.circuitBreaker.openUntil) {
      const reason = this.circuitBreaker.reason || 'failures';
      
      // 🔧 FIX: Don't block recovery on health check - just try to reset
      // Health check is now more lenient and won't block recovery
      const isHealthy = await this.checkBrowserHealth();
      
      // 🔥 AUTO-RECOVERY: Reset browser pool if circuit breaker stuck
      if (reason.includes('resource') || reason.includes('failure_threshold')) {
        console.log(`[BROWSER_POOL] 🔧 Auto-recovering browser pool (circuit breaker cooldown elapsed)...`);
        try {
          // 🔧 FIX: Force close circuit breaker first, then reset pool
          // This prevents the reset from immediately failing due to circuit breaker
          this.circuitBreaker.isOpen = false;
          this.circuitBreaker.failures = 0;
          this.circuitBreaker.reason = null;
          
          // Now reset the pool
          await this.resetPool();
          console.log(`[BROWSER_POOL] ✅ Browser pool reset complete`);
        } catch (resetError: any) {
          console.error(`[BROWSER_POOL] ❌ Browser pool reset failed:`, resetError.message);
          // 🔧 FIX: Even if reset fails, close circuit breaker to allow retries
          console.log(`[BROWSER_POOL] 🔧 Force-closing circuit breaker despite reset failure`);
          this.circuitBreaker.isOpen = false;
          this.circuitBreaker.failures = 0;
          this.circuitBreaker.reason = null;
          return false; // Allow operations to proceed
        }
      }
      
      // 🔧 FIX: Always close circuit breaker after timeout, even if health check fails
      if (!isHealthy) {
        console.warn(`[BROWSER_POOL] ⚠️ Browser health check failed, but closing circuit breaker anyway to allow retry`);
      }
      
      console.log(`[BROWSER_POOL] 🔄 Circuit breaker cooldown elapsed (reason=${reason}) - allowing retries`);
      this.circuitBreaker.isOpen = false;
      this.circuitBreaker.reason = null;
      this.circuitBreaker.failures = 0;
      return false;
    }
    
    return true;
  }
  
  /**
   * 🔥 NEW: Check browser health before reset
   * 🔧 FIX: More lenient health check - don't block recovery if browser just needs restart
   */
  private async checkBrowserHealth(): Promise<boolean> {
    try {
      // 🔧 FIX: If browser doesn't exist, that's OK - we can create it
      // Only fail health check if browser exists but is disconnected
      if (this.browser && !this.browser.isConnected()) {
        console.warn(`[BROWSER_POOL] ⚠️ Browser exists but disconnected - will restart`);
        return false; // Browser needs restart
      }
      
      // If no browser, we can create one - that's healthy enough
      if (!this.browser) {
        console.log(`[BROWSER_POOL] ℹ️ No browser yet - will create on next operation`);
        return true; // Can create browser = healthy
      }
      
      // Browser exists and is connected - healthy
      return true;
    } catch (error: any) {
      console.warn(`[BROWSER_POOL] ⚠️ Health check error (allowing recovery):`, error.message);
      // 🔧 FIX: Don't block recovery on health check errors - let it try
      return true; // Allow recovery even if health check errors
    }
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
        openUntil: this.circuitBreaker.isOpen ? new Date(this.circuitBreaker.openUntil).toISOString() : null,
        reason: this.circuitBreaker.reason
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
      totalContexts: this.contexts.size,
      averageWaitTime: this.metrics.averageWaitTime,
      timeoutsLast1h: this.metrics.timeoutsLast1h,
    };
  }

  /**
   * Get queue length (for cleanup deferral)
   */
  public getQueueLength(): number {
    return this.queue.length;
  }

  public async reloadSessionState(): Promise<void> {
    this.cachedStorageState = null;
    await this.ensureStorageState(true);
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
   * 🚨 EMERGENCY CLEANUP: Force cleanup of idle contexts and free memory
   * Called when memory is critical to prevent OOM crashes
   * 
   * 🔥 ENHANCED: More aggressive cleanup - closes ALL contexts when memory is critical
   */
  public async emergencyCleanup(aggressive: boolean = false): Promise<void> {
    console.log(`[BROWSER_POOL] 🚨 EMERGENCY CLEANUP: ${aggressive ? 'AGGRESSIVE' : 'STANDARD'} mode - Freeing memory...`);
    
    const beforeCount = this.contexts.size;
    const now = Date.now();
    
    // 🚨 AGGRESSIVE MODE: Close ALL contexts when memory is critical
    // This is necessary when memory is stuck at 461MB+ and won't free up
    if (aggressive) {
      console.log(`[BROWSER_POOL] 🚨 AGGRESSIVE MODE: Closing ALL contexts to free memory...`);
      
      const contextsToClose: string[] = Array.from(this.contexts.keys());
      
      for (const id of contextsToClose) {
        const handle = this.contexts.get(id);
        if (handle) {
          try {
            // Force close even if in use
            handle.inUse = false; // Mark as not in use to allow closing
            try {
              await handle.context.close();
            } catch (e) {
              // Force close failed - context may already be closed
              // Continue anyway to remove from pool
              console.warn(`[BROWSER_POOL] ⚠️ Context ${id} already closed or error:`, e);
            }
            this.contexts.delete(id);
            this.metrics.contextsClosed++;
            console.log(`[BROWSER_POOL] 🚨 Force-closed context: ${id}`);
          } catch (e) {
            // Even if close fails, remove from map to prevent leaks
            this.contexts.delete(id);
            console.warn(`[BROWSER_POOL] ⚠️ Error force-closing context ${id}, removed from pool:`, e);
          }
        }
      }
      
      // ✅ OPTIMIZED: Don't cancel queued operations in aggressive mode
      // Instead, mark browser for restart and let operations complete
      // Operations will get new browser instance when they start
      if (this.queue.length > 0) {
        console.log(`[BROWSER_POOL] ⚠️ ${this.queue.length} operations queued during aggressive cleanup - they will use new browser instance`);
        // Don't cancel - let them complete with new browser
      }
      
      // Optionally close and restart browser if still critical
      if (this.browser && this.contexts.size === 0) {
        try {
          console.log(`[BROWSER_POOL] 🚨 Closing browser to free memory...`);
          await this.browser.close().catch(() => {});
          this.browser = null;
          this.sessionLoaded = false; // Will reload session next time
        } catch (e) {
          console.warn(`[BROWSER_POOL] ⚠️ Error closing browser:`, e);
        }
      }
    } else {
      // STANDARD MODE: Close only idle contexts (original behavior)
    const idleTimeout = 30000; // 30 seconds
    const contextsToClose: string[] = [];
    
    for (const [id, handle] of this.contexts.entries()) {
      const idleTime = now - handle.lastUsed.getTime();
      if (!handle.inUse && idleTime > idleTimeout) {
        contextsToClose.push(id);
      }
    }
    
    // Close idle contexts
    for (const id of contextsToClose) {
      const handle = this.contexts.get(id);
      if (handle) {
        try {
          await handle.context.close();
          this.contexts.delete(id);
          this.metrics.contextsClosed++;
          console.log(`[BROWSER_POOL] 🚨 Closed idle context: ${id}`);
        } catch (e) {
          console.warn(`[BROWSER_POOL] ⚠️ Error closing context ${id}:`, e);
          }
        }
      }
    }
    
    const afterCount = this.contexts.size;
    const closedCount = beforeCount - afterCount;
    
    console.log(`[BROWSER_POOL] 🚨 Emergency cleanup: ${closedCount} contexts closed (${beforeCount} → ${afterCount})`);
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    console.log('[BROWSER_POOL] 🛑 Shutting down...');
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
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
      this.cachedStorageState = null;
      this.sessionWarningLogged = false;
      this.metrics.failedOperations = 0;
      this.circuitBreaker.failures = 0;
      this.circuitBreaker.isOpen = false;
      this.circuitBreaker.reason = null;
      this.circuitBreaker.openUntil = 0;
      
      // Restart cleanup timer
      this.startCleanupTimer();
      
      console.log('[BROWSER_POOL] ✅ Browser pool reset complete - ready for new operations');
    } catch (error: any) {
      console.error('[BROWSER_POOL] ❌ Reset failed:', error.message);
      throw error;
    }
  }

  /**
   * 🔧 FORCE CLOSE CIRCUIT BREAKER (Emergency recovery)
   * Use when circuit breaker is stuck open and blocking operations
   */
  public forceCloseCircuitBreaker(): void {
    console.warn('[BROWSER_POOL] 🔧 FORCE CLOSING circuit breaker...');
    this.circuitBreaker.isOpen = false;
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.reason = null;
    this.circuitBreaker.openUntil = 0;
    this.circuitBreaker.lastFailure = 0;
    console.log('[BROWSER_POOL] ✅ Circuit breaker force-closed - operations can proceed');
  }

  /**
   * 🔧 EMERGENCY: Force reset everything (nuclear option)
   * Use when circuit breaker is completely stuck
   */
  public async emergencyReset(): Promise<void> {
    console.warn('[BROWSER_POOL] 🚨 EMERGENCY RESET: Force-closing circuit breaker and resetting pool...');
    
    // Force close circuit breaker first
    this.forceCloseCircuitBreaker();
    
    // Then reset the pool
    try {
      await this.resetPool();
      console.log('[BROWSER_POOL] ✅ Emergency reset complete');
    } catch (error: any) {
      console.error('[BROWSER_POOL] ⚠️ Pool reset failed, but circuit breaker is closed:', error.message);
      // Circuit breaker is already closed, so operations can proceed
    }
  }
}

// Export singleton instance getter
export const getBrowserPool = () => UnifiedBrowserPool.getInstance();

