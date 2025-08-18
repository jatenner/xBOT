/**
 * Resilient Playwright Browser Manager
 * Handles browser lifecycle, context management, and automatic recovery
 */

const { chromium } = require('playwright');

class BrowserManager {
  constructor() {
    this.browser = null;
    this.contexts = new Map();
    this.launchPromise = null;
    this.maxRetries = parseInt(process.env.PLAYWRIGHT_MAX_CONTEXT_RETRIES || '3');
    this.retryBackoff = parseInt(process.env.PLAYWRIGHT_CONTEXT_RETRY_BACKOFF_MS || '800');
    this.contextTimeout = parseInt(process.env.PLAYWRIGHT_CONTEXT_TIMEOUT_MS || '300000'); // 5 minutes
    this.persistBrowser = process.env.PLAYWRIGHT_PERSIST_BROWSER === 'true';
    
    // Circuit breaker for repeated failures
    this.failureCount = 0;
    this.circuitBreakerOpen = false;
    this.circuitBreakerTimeout = null;
    
    console.log(`🌐 BrowserManager initialized: persist=${this.persistBrowser}, maxRetries=${this.maxRetries}`);
    
    // Auto-cleanup orphaned contexts
    if (this.persistBrowser) {
      this.cleanupInterval = setInterval(() => this.cleanupOrphanedContexts(), 60000);
    }
  }

  /**
   * Get or create browser instance with circuit breaker protection
   */
  async getBrowser() {
    if (this.circuitBreakerOpen) {
      throw new Error('Browser circuit breaker is open - too many failures');
    }

    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    // Prevent concurrent launches
    if (this.launchPromise) {
      return await this.launchPromise;
    }

    this.launchPromise = this.launchBrowser();
    try {
      this.browser = await this.launchPromise;
      this.failureCount = 0; // Reset on success
      return this.browser;
    } catch (error) {
      this.handleBrowserFailure(error);
      throw error;
    } finally {
      this.launchPromise = null;
    }
  }

  /**
   * Launch new browser instance with enhanced stability
   */
  async launchBrowser() {
    console.log('🚀 Launching new browser instance...');
    
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-translate',
        '--disable-ipc-flooding-protection'
      ]
    });

    // Handle browser disconnection
    browser.on('disconnected', () => {
      console.warn('⚠️ Browser disconnected, will relaunch on next request');
      this.browser = null;
      this.contexts.clear();
    });

    console.log('✅ Browser launched successfully');
    return browser;
  }

  /**
   * Create new context with retry logic and exponential backoff
   */
  async createContext(contextId = 'default', options = {}) {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const browser = await this.getBrowser();
        
        // Close existing context if it exists
        if (this.contexts.has(contextId)) {
          try {
            await this.contexts.get(contextId).close();
          } catch (e) {
            console.warn(`⚠️ Failed to close existing context ${contextId}:`, e.message);
          }
        }

        const context = await browser.newContext({
          viewport: { width: 1920, height: 1080 },
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          ignoreHTTPSErrors: true,
          ...options
        });

        // Track context creation time for cleanup
        context._createdAt = Date.now();
        context._contextId = contextId;
        
        this.contexts.set(contextId, context);
        
        // Handle context close
        context.on('close', () => {
          this.contexts.delete(contextId);
        });

        console.log(`✅ Created context: ${contextId} (attempt ${attempt})`);
        return context;

      } catch (error) {
        console.error(`❌ Context creation attempt ${attempt} failed:`, error.message);
        
        if (error.message.includes('Target') && error.message.includes('closed')) {
          console.log('🔄 Browser target closed, relaunching...');
          this.browser = null; // Force relaunch
          
          if (attempt < this.maxRetries) {
            await this.sleep(this.retryBackoff * attempt);
            continue;
          }
        }
        
        if (attempt === this.maxRetries) {
          this.handleBrowserFailure(error);
          throw new Error(`Failed to create context after ${this.maxRetries} attempts: ${error.message}`);
        }
        
        await this.sleep(this.retryBackoff * attempt);
      }
    }
  }

  /**
   * Execute function with auto-managed context and recovery
   */
  async withContext(contextId, fn, options = {}) {
    let context = null;
    try {
      context = await this.createContext(contextId, options);
      return await fn(context);
    } catch (error) {
      if (error.message.includes('Target') && error.message.includes('closed')) {
        console.log(`🔄 TRACK_RETRY context_reset=true contextId=${contextId}`);
        // One retry attempt with fresh context
        try {
          context = await this.createContext(`${contextId}_retry`, options);
          return await fn(context);
        } catch (retryError) {
          console.error(`❌ Context retry failed for ${contextId}:`, retryError.message);
          throw retryError;
        }
      }
      throw error;
    } finally {
      if (context && !this.persistBrowser) {
        try {
          await context.close();
        } catch (e) {
          console.warn(`⚠️ Failed to close context ${contextId}:`, e.message);
        }
      }
    }
  }

  /**
   * Shared context for metrics scraping with circuit breaker
   */
  async withSharedContext(contextId, fn, options = {}) {
    if (this.circuitBreakerOpen) {
      console.warn(`⚠️ Circuit breaker open for ${contextId}, skipping operation`);
      return null;
    }

    try {
      // Get or create persistent context
      let context = this.contexts.get(contextId);
      
      if (!context || context.isClosed?.()) {
        context = await this.createContext(contextId, options);
      }
      
      const result = await fn(context);
      this.failureCount = Math.max(0, this.failureCount - 1); // Gradual recovery
      return result;
      
    } catch (error) {
      if (error.message.includes('Target') && error.message.includes('closed')) {
        console.log(`🔄 TRACK_REOPENED_CONTEXT contextId=${contextId}`);
        
        try {
          // Remove failed context and create new one
          this.contexts.delete(contextId);
          const newContext = await this.createContext(`${contextId}_new`, options);
          return await fn(newContext);
        } catch (retryError) {
          this.handleMetricsFailure(retryError, contextId);
          return null;
        }
      } else {
        this.handleMetricsFailure(error, contextId);
        return null;
      }
    }
  }

  /**
   * Handle browser failures with circuit breaker
   */
  handleBrowserFailure(error) {
    this.failureCount++;
    console.error(`❌ Browser failure ${this.failureCount}:`, error.message);
    
    if (this.failureCount >= 3) {
      this.openCircuitBreaker();
    }
  }

  /**
   * Handle metrics-specific failures
   */
  handleMetricsFailure(error, contextId) {
    this.failureCount++;
    console.error(`❌ Metrics failure ${this.failureCount} for ${contextId}:`, error.message);
    
    if (this.failureCount >= 5) {
      this.openCircuitBreaker();
    }
  }

  /**
   * Open circuit breaker to prevent cascading failures
   */
  openCircuitBreaker() {
    this.circuitBreakerOpen = true;
    console.warn('🚨 Browser circuit breaker opened - cooling down for 10 minutes');
    
    // Clear existing timeout
    if (this.circuitBreakerTimeout) {
      clearTimeout(this.circuitBreakerTimeout);
    }
    
    // Auto-reset after 10 minutes
    this.circuitBreakerTimeout = setTimeout(() => {
      this.circuitBreakerOpen = false;
      this.failureCount = 0;
      console.log('✅ Browser circuit breaker reset');
    }, 10 * 60 * 1000);
  }

  /**
   * Clean up orphaned contexts
   */
  async cleanupOrphanedContexts() {
    const now = Date.now();
    const orphanedContexts = [];

    for (const [contextId, context] of this.contexts.entries()) {
      if (context._createdAt && (now - context._createdAt) > this.contextTimeout) {
        orphanedContexts.push({ contextId, context });
      }
    }

    for (const { contextId, context } of orphanedContexts) {
      try {
        console.log(`🧹 Cleaning up orphaned context: ${contextId}`);
        await context.close();
        this.contexts.delete(contextId);
      } catch (error) {
        console.warn(`⚠️ Failed to cleanup context ${contextId}:`, error.message);
        // Force remove from tracking
        this.contexts.delete(contextId);
      }
    }

    if (orphanedContexts.length > 0) {
      console.log(`✅ Cleaned up ${orphanedContexts.length} orphaned contexts`);
    }
  }

  /**
   * Get status for health monitoring
   */
  getStatus() {
    return {
      connected: !!(this.browser && this.browser.isConnected()),
      contexts: this.contexts.size,
      circuitBreakerOpen: this.circuitBreakerOpen,
      failureCount: this.failureCount,
      activeContexts: Array.from(this.contexts.keys())
    };
  }

  /**
   * Close all contexts and browser
   */
  async close() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    if (this.circuitBreakerTimeout) {
      clearTimeout(this.circuitBreakerTimeout);
    }

    // Close all contexts
    const closePromises = [];
    for (const [contextId, context] of this.contexts.entries()) {
      closePromises.push(
        context.close().catch(error => 
          console.warn(`⚠️ Failed to close context ${contextId}:`, error.message)
        )
      );
    }
    
    await Promise.allSettled(closePromises);
    this.contexts.clear();

    // Close browser
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        console.warn('⚠️ Failed to close browser:', error.message);
      }
      this.browser = null;
    }

    console.log('✅ Browser manager shutdown complete');
  }

  /**
   * Utility sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
let browserManager = null;

function getBrowserManager() {
  if (!browserManager) {
    browserManager = new BrowserManager();
  }
  return browserManager;
}

module.exports = { getBrowserManager, BrowserManager };
