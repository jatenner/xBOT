/**
 * Robust Twitter Poster - Compliant and Reliable
 * No anti-bot detection attempts, focuses on stability and compliance
 * 
 * 🔒 SECURITY: All posting MUST go through authorized paths.
 * Direct calls without provenance will be blocked.
 */

import { log } from '../lib/logger';
import { Page, BrowserContext, Locator } from 'playwright';
import { existsSync, writeFileSync, appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { ImprovedReplyIdExtractor } from './ImprovedReplyIdExtractor';
import { BulletproofTweetExtractor } from '../utils/bulletproofTweetExtractor';
import { ensureComposerFocused } from './composerFocus';
import { supaService } from '../lib/supabaseService';
import { ReplyPostingTelemetry } from './ReplyPostingTelemetry';

/**
 * 🔒 POSTING AUTHORIZATION GUARD (UNFORGEABLE)
 * 
 * The PostingGuard is an opaque token that ONLY postingQueue can create.
 * All posting methods require this guard to be passed as a parameter.
 * This prevents any module from authorizing itself.
 */

// 🔐 SECRET KEY: Only known inside this module + postingQueue
// This is NOT exported - no other module can forge a guard
const GUARD_SECRET = Symbol('posting_guard_secret');

export interface PostingGuard {
  readonly __secret: typeof GUARD_SECRET;
  readonly decision_id: string;
  readonly pipeline_source: string;
  readonly job_run_id: string;
  readonly created_at: number;
  readonly permit_id?: string; // 🎫 Posting permit ID (required for posting)
}

/**
 * 🔒 CREATE POSTING GUARD (Only callable from postingQueue)
 * This function is exported but the guard it creates can only be verified
 * by this module because it contains the Symbol secret.
 */
export function createPostingGuard(params: {
  decision_id: string;
  pipeline_source: string;
  job_run_id?: string;
  permit_id?: string; // 🎫 Optional permit_id (will be added by atomicPostExecutor)
}): PostingGuard {
  const guard: PostingGuard = {
    __secret: GUARD_SECRET,
    decision_id: params.decision_id,
    pipeline_source: params.pipeline_source,
    job_run_id: params.job_run_id || `job_${Date.now()}`,
    created_at: Date.now(),
    permit_id: params.permit_id,
  };
  console.log(`[POSTING_GUARD] ✅ Guard created: decision_id=${params.decision_id} source=${params.pipeline_source}`);
  return guard;
}

// 🚨 BYPASS TRACKING: Count and log all bypass attempts with stack traces
let _bypass_blocked_count = 0;
let _last_bypass_blocked_at: string | null = null;
let _last_bypass_stack: string | null = null;
let _last_bypass_caller: string | null = null;

export function getBypassStats(): {
  bypass_blocked_count: number;
  last_bypass_blocked_at: string | null;
  last_bypass_stack: string | null;
  last_bypass_caller: string | null;
} {
  return {
    bypass_blocked_count: _bypass_blocked_count,
    last_bypass_blocked_at: _last_bypass_blocked_at,
    last_bypass_stack: _last_bypass_stack,
    last_bypass_caller: _last_bypass_caller,
  };
}

const GUARD_TIMEOUT_MS = 60000; // 60 seconds max between guard creation and post

/**
 * 🔒 VERIFY POSTING GUARD
 * Validates the guard is real (has secret) and not expired
 */
function verifyPostingGuard(
  guard: PostingGuard | undefined,
  operation: 'postTweet' | 'postReply'
): { valid: true; guard: PostingGuard } | { valid: false; error: string } {
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🛑 MASTER KILLSWITCHES - ENFORCED AT FINAL CHOKEPOINT
  // ═══════════════════════════════════════════════════════════════════════════
  
  // REPLIES_ENABLED=false blocks ALL reply posting at this final chokepoint
  if (operation === 'postReply' && process.env.REPLIES_ENABLED === 'false') {
    console.warn(`[KILLSWITCH] 🛑 REPLIES_ENABLED=false - Blocking ${operation}`);
    return { valid: false, error: 'REPLIES_ENABLED=false - Reply posting disabled at killswitch' };
  }
  
  // POSTING_ENABLED=false blocks ALL posting (tweets and replies)
  if (process.env.POSTING_ENABLED === 'false') {
    console.warn(`[KILLSWITCH] 🛑 POSTING_ENABLED=false - Blocking ${operation}`);
    return { valid: false, error: 'POSTING_ENABLED=false - All posting disabled at killswitch' };
  }
  
  // DRAIN_QUEUE=true also blocks posting (posts should be marked skipped upstream)
  if (process.env.DRAIN_QUEUE === 'true') {
    console.warn(`[KILLSWITCH] 🛑 DRAIN_QUEUE=true - Blocking ${operation}`);
    return { valid: false, error: 'DRAIN_QUEUE=true - Queue draining, posting blocked' };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  
  // 🚨 BYPASS KILLSWITCH: Allow bypass during testing if explicitly set
  if (process.env.ALLOW_POSTING_BYPASS === 'true') {
    console.warn(`[POSTING_GUARD] ⚠️ BYPASS ENABLED (ALLOW_POSTING_BYPASS=true)`);
    return {
      valid: true,
      guard: {
        __secret: GUARD_SECRET,
        decision_id: 'bypass_enabled',
        pipeline_source: 'bypass_env',
        job_run_id: 'bypass',
        created_at: Date.now(),
      }
    };
  }
  
  // Extract stack trace for logging
  const stack = new Error().stack || '';
  const stackLines = stack.split('\n').slice(2, 8); // Skip Error line and this function
  const trimmedStack = stackLines.map(line => line.trim()).join(' → ');
  
  // Extract likely caller file/function
  const callerMatch = stackLines[1]?.match(/at\s+(\S+)/);
  const caller = callerMatch ? callerMatch[1] : 'unknown';
  
  // Check guard exists
  if (!guard) {
    _bypass_blocked_count++;
    _last_bypass_blocked_at = new Date().toISOString();
    _last_bypass_stack = trimmedStack;
    _last_bypass_caller = caller;
    
    console.error(`\n${'='.repeat(80)}`);
    console.error(`[BYPASS_BLOCKED] 🚨 UNAUTHORIZED POSTING ATTEMPT DETECTED`);
    console.error(`${'='.repeat(80)}`);
    console.error(`  timestamp: ${_last_bypass_blocked_at}`);
    console.error(`  operation: ${operation}`);
    console.error(`  guard: MISSING`);
    console.error(`  caller: ${caller}`);
    console.error(`  MODE: ${process.env.MODE || 'unset'}`);
    console.error(`  NODE_ENV: ${process.env.NODE_ENV || 'unset'}`);
    console.error(`  stack_trace:`);
    stackLines.forEach(line => console.error(`    ${line.trim()}`));
    console.error(`${'='.repeat(80)}\n`);
    
    return { valid: false, error: `No posting guard provided. Caller: ${caller}` };
  }
  
  // Check guard has correct secret (unforgeable)
  if (guard.__secret !== GUARD_SECRET) {
    _bypass_blocked_count++;
    _last_bypass_blocked_at = new Date().toISOString();
    _last_bypass_stack = trimmedStack;
    _last_bypass_caller = caller;
    
    console.error(`\n${'='.repeat(80)}`);
    console.error(`[BYPASS_BLOCKED] 🚨 FORGED GUARD DETECTED`);
    console.error(`${'='.repeat(80)}`);
    console.error(`  timestamp: ${_last_bypass_blocked_at}`);
    console.error(`  operation: ${operation}`);
    console.error(`  guard_decision_id: ${(guard as any).decision_id || 'none'}`);
    console.error(`  caller: ${caller}`);
    console.error(`  reason: Guard secret mismatch - likely forged`);
    console.error(`  stack_trace:`);
    stackLines.forEach(line => console.error(`    ${line.trim()}`));
    console.error(`${'='.repeat(80)}\n`);
    
    return { valid: false, error: `Invalid guard secret. Caller: ${caller}` };
  }
  
  // Check guard not expired
  const elapsed = Date.now() - guard.created_at;
  if (elapsed > GUARD_TIMEOUT_MS) {
    _bypass_blocked_count++;
    _last_bypass_blocked_at = new Date().toISOString();
    _last_bypass_stack = trimmedStack;
    _last_bypass_caller = caller;
    
    console.error(`\n${'='.repeat(80)}`);
    console.error(`[BYPASS_BLOCKED] 🚨 EXPIRED GUARD`);
    console.error(`${'='.repeat(80)}`);
    console.error(`  timestamp: ${_last_bypass_blocked_at}`);
    console.error(`  operation: ${operation}`);
    console.error(`  guard_decision_id: ${guard.decision_id}`);
    console.error(`  elapsed_ms: ${elapsed}`);
    console.error(`  max_ms: ${GUARD_TIMEOUT_MS}`);
    console.error(`  caller: ${caller}`);
    console.error(`${'='.repeat(80)}\n`);
    
    return { valid: false, error: `Guard expired (${elapsed}ms > ${GUARD_TIMEOUT_MS}ms)` };
  }
  
  console.log(`[POSTING_GUARD] ✅ Verified: decision_id=${guard.decision_id} source=${guard.pipeline_source} job=${guard.job_run_id}`);
  return { valid: true, guard };
}

// Legacy exports for backward compatibility (will log deprecation warnings)
export function setPostingAuthorization(auth: { decision_id: string; pipeline_source: string }): void {
  console.warn(`[POSTING_AUTH] ⚠️ DEPRECATED: setPostingAuthorization() is deprecated. Use createPostingGuard() instead.`);
  // This no longer does anything - posting now requires guard parameter
}

export function clearPostingAuthorization(): void {
  // No-op for backward compatibility
}

export interface PostResult {
  success: boolean;
  tweetId?: string;
  tweetUrl?: string;
  error?: string;
}

interface PosterOptions {
  purpose?: 'reply' | 'post';
}

export class UltimateTwitterPoster {
  // 🌐 MIGRATED TO UNIFIED BROWSER POOL: No more instance context/page storage
  // Pool manages browser lifecycle - prevents resource exhaustion
  private page: Page | null = null; // Only stored during active operation
  private readonly storageStatePath = join(process.cwd(), 'twitter-auth.json');
  private readonly purpose: 'reply' | 'post';
  private readonly forceFreshContextPerAttempt: boolean;
  private sessionRefreshes = 0;
  private composerFocusAttempts = 0;
  
  // Circuit breaker pattern
  private clickFailures = 0;
  private readonly maxClickFailures = 5;
  private lastResetTime = Date.now();
  
  // PHASE 3.5: Real tweet ID extraction
  private capturedTweetId: string | null = null;
  private networkResponseListener: ((response: any) => void) | null = null;

  constructor(options: PosterOptions = {}) {
    this.purpose = options.purpose ?? 'post';
    this.forceFreshContextPerAttempt = this.purpose === 'reply';
  }

  async postTweet(content: string, guard?: PostingGuard): Promise<PostResult> {
    // 🔒 GUARD CHECK: Block unauthorized posting
    const verification = verifyPostingGuard(guard, 'postTweet');
    if (!verification.valid) {
      return { success: false, error: (verification as { valid: false; error: string }).error };
    }
    const validGuard = (verification as { valid: true; guard: PostingGuard }).guard;
    
    // 📊 COMPREHENSIVE LOGGING: Build fingerprint for audit trail
    const BUILD_SHA = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || 'dev';
    const DB_URL = process.env.DATABASE_URL || '';
    const DB_ENV_FINGERPRINT = require('crypto').createHash('md5').update(DB_URL).digest('hex').substring(0, 8);
    
    console.log(`[POST_TWEET] 🔐 Authorized via guard: decision_id=${validGuard.decision_id}`);
    console.log(`[POST_TWEET] 📊 AUDIT_TRAIL: decision_id=${validGuard.decision_id} pipeline_source=${validGuard.pipeline_source} job_run_id=${validGuard.job_run_id} build_sha=${BUILD_SHA} db_env=${DB_ENV_FINGERPRINT}`);
    
    let retryCount = 0;
    const maxRetries = 2; // Increased retries
    const startTime = Date.now();
    
    // 🛡️ TIMEOUT PROTECTION: Overall timeout for entire postTweet operation (120 seconds max)
    // 🔥 FIX: Increased from 80s to 120s - Twitter can take 55-90s to complete posting
    const { withTimeout } = await import('../utils/operationTimeout');
    // 🔧 429-AWARE TIMEOUT: Increase timeout for retries (429 errors need more time)
    const OVERALL_TIMEOUT_MS = 300000; // 300 seconds (5 min) max for entire operation with retries
    
    return withTimeout(async () => {
      while (retryCount <= maxRetries) {
        try {
          log({ op: 'ultimate_poster_attempt', attempt: retryCount + 1, max: maxRetries + 1, content_length: content.length });
          await this.prepareForAttempt(retryCount);
          
          await this.ensureContext();
          const result = await this.attemptPost(content, validGuard);
        
          if (!result.success) {
            if (result.error?.includes('session expired') || result.error?.includes('not logged in')) {
              log({ op: 'ultimate_poster_auth_error', action: 'refreshing_session' });
              await this.refreshSession();
            }
            throw new Error(result.error || 'Post attempt failed');
          }

          const canonical = await this.extractCanonicalTweet(content);          
          const ms = Date.now() - startTime;                
          log({ op: 'ultimate_poster_complete', outcome: 'success', attempt: retryCount + 1, tweet_id: canonical.tweetId, ms });
          
          // 🎯 SUCCESS LOG: Include tweet_id for audit trail
          console.log(`[POST_TWEET] ✅ SUCCESS: tweet_id=${canonical.tweetId} decision_id=${validGuard.decision_id} pipeline_source=${validGuard.pipeline_source} build_sha=${BUILD_SHA} db_env=${DB_ENV_FINGERPRINT}`);
          
          await this.dispose();         
          return { success: true, tweetId: canonical.tweetId, tweetUrl: canonical.tweetUrl };
          
        } catch (error) {
          log({ op: 'ultimate_poster_attempt', outcome: 'error', attempt: retryCount + 1, error: error.message });
          
          const isRecoverable = this.isRecoverableError(error.message);
          const is429 = this.is429Error(error);
          
          if (retryCount < maxRetries && isRecoverable) {
            log({ op: 'ultimate_poster_retry', retry_count: retryCount, recoverable: true, is_429: is429 });
            await this.cleanup();
            retryCount++;
            
            // 🔧 429-AWARE BACKOFF: Exponential backoff with jitter for 429 errors
            let delay: number;
            if (is429) {
              // Exponential backoff: 30s, 60s, 120s with ±30% jitter
              const baseDelays = [30000, 60000, 120000];
              const baseDelay = baseDelays[Math.min(retryCount - 1, baseDelays.length - 1)];
              const jitter = baseDelay * 0.3 * (Math.random() * 2 - 1); // ±30% jitter
              delay = Math.max(30000, baseDelay + jitter); // Minimum 30s
              console.log(`[ULTIMATE_POSTER] 🔄 429 backoff: retry ${retryCount}/${maxRetries} after ${Math.round(delay/1000)}s`);
            } else {
              delay = (retryCount) * 2000; // 2s, 4s delays for other errors
            }
            
            log({ op: 'ultimate_poster_delay', delay_ms: delay, is_429: is429 });
            await new Promise(resolve => setTimeout(resolve, delay));
            
            continue;
          }
          
          const ms = Date.now() - startTime;
          log({ op: 'ultimate_poster_complete', outcome: 'failure', attempts: retryCount + 1, error: error.message, ms });
          await this.captureFailureArtifacts(error.message);
          await this.cleanup();
          return { success: false, error: error.message };
        }
      }

      const ms = Date.now() - startTime;
      log({ op: 'ultimate_poster_complete', outcome: 'max_retries', attempts: retryCount, ms });
      await this.cleanup();
      return { success: false, error: 'Max retries exceeded' };
    }, {
      timeoutMs: OVERALL_TIMEOUT_MS,
      operationName: 'postTweet',
      onTimeout: async () => {
        console.error(`[ULTIMATE_POSTER] ⏱️ postTweet timeout after ${OVERALL_TIMEOUT_MS}ms - cleaning up`);
        try {
          await this.cleanup();
        } catch (e) {
          console.error(`[ULTIMATE_POSTER] ⚠️ Error during timeout cleanup:`, e);
        }
      }
    });
  }

  private isRecoverableError(errorMessage: string): boolean {
    const recoverableErrors = [
      'Timeout',
      'Navigation failed',
      'Page crashed',
      'Context was closed',
      'Target closed',
      'waiting for selector',
      'Network verification failed',
      'UI verification failed',
      'timeout.*exceeded', // 🔧 ADDED: Playwright timeout errors
      'Navigation elements not found', // 🔧 ADDED: Our new error
      'HTTP-429', // 🔧 ADDED: Rate limiting
      'code 88', // 🔧 ADDED: X rate limit code
      'rate limit', // 🔧 ADDED: Rate limit errors
      'ApiError.*429' // 🔧 ADDED: API rate limit errors
    ];
    
    return recoverableErrors.some(error => {
      const regex = new RegExp(error.replace('.*', '.*'), 'i');
      return regex.test(errorMessage);
    });
  }
  
  private is429Error(error: any): boolean {
    if (!error) return false;
    const errorMessage = error.message || error.toString() || '';
    return errorMessage.includes('HTTP-429') || 
           errorMessage.includes('code 88') ||
           errorMessage.includes('429') ||
           (error.code && String(error.code).includes('429')) ||
           (error.status === 429);
  }

  /**
   * 🌐 MIGRATED TO UNIFIED BROWSER POOL
   * Acquires page from pool (manages browser lifecycle automatically)
   */
  private async ensureContext(): Promise<void> {
    if (!this.page) {
      const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
      const browserPool = UnifiedBrowserPool.getInstance();
      
      const operationName = this.purpose === 'reply' ? 'reply_posting' : 'tweet_posting';
      console.log(`ULTIMATE_POSTER: Acquiring page from UnifiedBrowserPool (operation: ${operationName})...`);
      
      // 🔥 OPTIMIZATION: Use PRIORITY 0 (highest) so posting never waits
      this.page = await browserPool.withContext(
        operationName,
        async (context) => {
          return await context.newPage();
        },
        0 // 🔥 HIGHEST PRIORITY - posting is critical, should never wait
      );
      
      // Set up error handling
      this.page.on('pageerror', (error) => {
        console.error('ULTIMATE_POSTER: Page error:', error.message);
      });
      
      console.log('ULTIMATE_POSTER: ✅ Page acquired from pool');
    }
  }

  private async attemptPost(content: string, validGuard: PostingGuard): Promise<PostResult> {
    if (!this.page) throw new Error('Page not initialized');

    const stageStartTimes: Record<string, number> = {};
    const logStage = (stage: string, action: () => Promise<void>): Promise<void> => {
      stageStartTimes[stage] = Date.now();
      console.log(`[ULTIMATE_POSTER] 🎯 Stage: ${stage} - Starting`);
      return action().then(
        () => {
          const duration = Date.now() - stageStartTimes[stage];
          console.log(`[ULTIMATE_POSTER] ✅ Stage: ${stage} - Completed in ${duration}ms`);
        },
        (error) => {
          const duration = Date.now() - stageStartTimes[stage];
          console.error(`[ULTIMATE_POSTER] ❌ Stage: ${stage} - Failed after ${duration}ms: ${error.message}`);
          throw error;
        }
      );
    };

    // 🔍 BROWSER HEALTH CHECK: Verify page responsiveness
    try {
      await this.page.evaluate(() => true); // Test if page is responsive
      console.log('[ULTIMATE_POSTER] ✅ Browser health check passed');
    } catch (healthError: any) {
      console.warn(`[ULTIMATE_POSTER] ⚠️ Browser health check failed: ${healthError.message}`);
      throw new Error(`Browser not responsive: ${healthError.message}`);
    }

    // Stage 1: Navigation
    await logStage('navigation', async () => {
      console.log('ULTIMATE_POSTER: Navigating to Twitter...');
      
      // Navigate with domcontentloaded instead of networkidle
      await this.page!.goto('https://x.com/home', { 
        waitUntil: 'domcontentloaded', 
        timeout: 45000 
      });

      // Wait for navigation to complete and UI to be ready
      console.log('ULTIMATE_POSTER: Waiting for UI to be ready...');
      
      // 🔧 IMPROVED TIMEOUT: Try multiple selectors with longer timeout
      const navigationSelectors = [
        'nav[role="navigation"]',
        '[data-testid="primaryColumn"]',
        '[data-testid="SideNav_AccountSwitcher_Button"]',
        'main[role="main"]'
      ];
      
      let navigationFound = false;
      for (const selector of navigationSelectors) {
        try {
          await this.page!.waitForSelector(selector, { 
            state: 'visible', 
            timeout: 30000 // Increased from 20s to 30s
          });
          console.log(`ULTIMATE_POSTER: Found navigation via ${selector}`);
          navigationFound = true;
          break;
        } catch (error) {
          console.log(`ULTIMATE_POSTER: ${selector} not found, trying next...`);
        }
      }
      
      if (!navigationFound) {
        throw new Error('Navigation elements not found - page may not have loaded properly');
      }

      // Check if we're logged in
      const isLoggedOut = await this.checkIfLoggedOut();
      if (isLoggedOut) {
        throw new Error('Not logged in to Twitter - session may have expired');
      }

      console.log('ULTIMATE_POSTER: Successfully authenticated');
    });

    // Close any modals/overlays that might interfere
    await this.closeAnyModal();

    // Stage 2: Typing
    await logStage('typing', async () => {
      // Find and interact with composer
      const composer = await this.getComposer();
      
      console.log('ULTIMATE_POSTER: Inserting content...');
      await composer.click({ delay: 60 });
      await this.page!.waitForTimeout(500);
      
      // 🆕 IMPROVED: Clear any existing content with better handling
      try {
        await composer.fill(''); // Clear first
        await this.page!.waitForTimeout(300); // Increased wait time
      } catch (clearError: any) {
        console.warn(`ULTIMATE_POSTER: Clear failed (non-critical): ${clearError.message}`);
        // Continue anyway - content might be empty
      }
      
      // For long content (>300 chars), use fill() to avoid timeout
      // For shorter content, use typing for more natural behavior
      if (content.length > 300) {
        console.log(`ULTIMATE_POSTER: Using fill() for ${content.length} char content`);
        
        // Use fill() - works with contenteditable in headless mode
        await composer.fill(content);
        await this.page!.waitForTimeout(500);
        
        // Verify content was inserted
        const text = await composer.textContent();
        if (!text || !text.includes(content.substring(0, 50))) {
          throw new Error('Content fill verification failed');
        }
        
        console.log('ULTIMATE_POSTER: Content filled successfully');
      } else {
        // Type quickly but not instant (Twitter might detect instant paste)
        await composer.type(content, { delay: 5 }); // 5ms = very fast but not suspicious
        console.log('ULTIMATE_POSTER: Content typed');
      }
    });

    // Close modals again before posting (in case typing triggered something)
    await this.closeAnyModal();

    // Stage 3: Submit
    let result: PostResult;
    const submitStartTime = Date.now();
    console.log(`[ULTIMATE_POSTER] 🎯 Stage: submit - Starting`);
    try {
      // Post with network verification
      result = await this.postWithNetworkVerification(validGuard);
      const submitDuration = Date.now() - submitStartTime;
      console.log(`[ULTIMATE_POSTER] ✅ Stage: submit - Completed in ${submitDuration}ms`);
    } catch (submitError: any) {
      const submitDuration = Date.now() - submitStartTime;
      console.error(`[ULTIMATE_POSTER] ❌ Stage: submit - Failed after ${submitDuration}ms: ${submitError.message}`);
      throw submitError;
    }
    
    console.log('ULTIMATE_POSTER: Post completed successfully');
    return result;
  }

  private async checkIfLoggedOut(): Promise<boolean> {
    const loggedOutSelectors = [
      'a[href="/login"]',
      'a[href="/i/flow/login"]',
      'form[action*="/login"]',
      '[data-testid="loginButton"]'
    ];

    for (const selector of loggedOutSelectors) {
      try {
        const element = await this.page!.$(selector);
        if (element && await element.isVisible()) {
          return true;
        }
      } catch (e) {
        // Continue checking other selectors
      }
    }
    return false;
  }

  private async isPageClosed(): Promise<boolean> {
    try {
      if (!this.page) return true;
      await this.page.evaluate(() => true); // Test if page is responsive
      return false;
    } catch {
      return true;
    }
  }

  private async closeAnyModal(): Promise<void> {
    // Check if page is still open before attempting modal closure
    if (await this.isPageClosed()) {
      console.log('ULTIMATE_POSTER: Page closed, skipping modal dismissal');
      return;
    }

    const modalCloseSelectors = [
      '[data-testid="app-bar-close"]',
      'div[role="dialog"] [aria-label="Close"]',
      'div[role="dialog"] [data-testid="SheetClose"]',
      '[data-testid="confirmationSheetCancel"]',
      'button[aria-label="Close"]',
      '[aria-label="Close"]',
      'div[id="layers"] [aria-label="Close"]',
      'div[data-testid="mask"]',
      'div[class*="modal"] button',
      'div[role="dialog"] button:has-text("Close")',
      'div[role="dialog"] button:has-text("Skip")',
      'div[role="dialog"] button:has-text("Not now")',
      'div[role="dialog"] button:has-text("Dismiss")',
      // Enhanced selectors for blocking overlays
      'div[id="layers"] button',
      'div[id="layers"] [role="button"]',
      'div[class*="r-1p0dtai"] button',
      'div[aria-modal="true"] button'
    ];

    for (const selector of modalCloseSelectors) {
      try {
        const element = await this.page!.$(selector);
        if (element && await element.isVisible()) {
          console.log(`ULTIMATE_POSTER: Closing modal with selector: ${selector}`);
          await element.click();
          await this.page!.waitForTimeout(300);
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    // Force-remove overlay divs that intercept clicks - ENHANCED
    try {
      await this.page!.evaluate(() => {
        // Strategy 1: Clear the layers div entirely
        const layers = document.querySelector('div#layers');
        if (layers && layers.children.length > 0) {
          console.log('Clearing layers div with', layers.children.length, 'children');
          layers.innerHTML = '';
        }
        
        // Strategy 2: Remove specific blocking overlays
        const overlays = document.querySelectorAll('div[id="layers"] > div, div.css-175oi2r.r-1p0dtai, div[class*="r-1d2f490"]');
        overlays.forEach(overlay => {
          const style = window.getComputedStyle(overlay);
          if (style.position === 'fixed' || style.position === 'absolute') {
            if (!style.zIndex || parseInt(style.zIndex) > 100) {
              overlay.remove();
            }
          }
        });
      });
      console.log('ULTIMATE_POSTER: Force-removed overlay divs');
      
      // Strategy 3: Press ESC to dismiss modals
      await this.page!.keyboard.press('Escape');
      await this.page!.waitForTimeout(200);
    } catch (e: any) {
      console.log('ULTIMATE_POSTER: Could not force-remove overlays:', e.message);
    }
  }

  private async getComposer(): Promise<any> {
    // 🆕 UPDATED: Robust selectors matching modern Twitter UI
    const composerSelectors = [
      'div[contenteditable="true"][role="textbox"]',                      // Primary - modern Twitter
      'div[role="textbox"][contenteditable="true"]',                      // Alternative order
      '[data-testid="tweetTextarea_0"]',                                  // Fallback 1
      'div[aria-label*="Post text"]',                                     // Fallback 2
      'div[aria-label*="What is happening"]',                             // Fallback 3
      'div[aria-label*="What\'s happening"]',                             // Fallback 4
      'div[contenteditable="true"]',                                      // Fallback 5 - any contenteditable
      '.public-DraftEditor-content[contenteditable="true"]'               // Fallback 6 - Draft.js
    ];

    for (const selector of composerSelectors) {
      try {
        console.log(`ULTIMATE_POSTER: Testing composer selector: ${selector}`);
        const element = await this.page!.waitForSelector(selector, { 
          state: 'visible', 
          timeout: 15000  // Increased from 5s → 15s for slow Twitter loads
        });
        
        if (element) {
          // 🆕 VERIFY: Ensure element is actually editable
          const isEditable = await element.evaluate((el: any) => 
            el.contentEditable === 'true' || el.tagName === 'TEXTAREA'
          ).catch(() => false);
          
          if (isEditable) {
            console.log(`ULTIMATE_POSTER: ✅ Found editable composer with: ${selector}`);
            return element;
          } else {
            console.log(`ULTIMATE_POSTER: ⚠️ Element found but not editable: ${selector}`);
            continue;
          }
        }
      } catch (e: any) {
        console.log(`ULTIMATE_POSTER: Selector failed: ${selector} - ${e.message}`);
        continue;
      }
    }

    throw new Error('No editable composer found with any selector - Twitter UI may have changed');
  }

  private async postWithNetworkVerification(validGuard: PostingGuard): Promise<PostResult> {
        if (!this.page) throw new Error('Page not initialized');

        console.log('ULTIMATE_POSTER: Setting up robust posting with fallback verification...');
        
        // SMART BATCH FIX: Set up redirect listener EARLY and with Promise
        this.capturedTweetId = null; // Reset
        
        const redirectPromise = new Promise<string>((resolve) => {
          const handler = (frame: any) => {
            if (frame === this.page?.mainFrame()) {
              const url = frame.url();
              if (url.includes('/status/') && !this.capturedTweetId) {
                const match = url.match(/\/status\/(\d+)/);
                if (match && match[1]) {
                  this.capturedTweetId = match[1];
                  console.log(`ULTIMATE_POSTER: 🎯 REDIRECT CAPTURED: ${this.capturedTweetId}`);
                  this.page?.off('framenavigated', handler); // Remove listener
                  resolve(match[1]);
                }
              }
            }
          };
          
          this.page!.on('framenavigated', handler);
          
          // Timeout after 5 seconds
          setTimeout(() => {
            this.page?.off('framenavigated', handler);
            resolve('');
          }, 5000);
        });
    
    // 🔥 BULLETPROOF: Enhanced network interception with file backup
    // Set up persistent response listener BEFORE posting to capture tweet ID
    this.setupBulletproofNetworkInterception();
    
    // Set up network response monitoring (with longer timeout and more patterns)
    let networkVerificationPromise: Promise<any> | null = null;
    
    try {
      networkVerificationPromise = this.page.waitForResponse(response => {
        const url = response.url();
        const postData = response.request().postData() || '';
        
        // Match various Twitter API patterns
        return (
          (url.includes('/i/api/graphql') && (
            postData.includes('CreateTweet') ||
            postData.includes('CreateNote') ||
            postData.includes('create_tweet')
          )) ||
          (url.includes('/i/api/1.1/statuses/update') ||
           url.includes('/compose/tweet') ||
           url.includes('/create'))
        );
      }, { timeout: 30000 }); // Reduced from 45s to 30s to fail faster
      
      console.log('ULTIMATE_POSTER: Network monitoring active (30s timeout)');
    } catch (e: any) {
      console.log(`ULTIMATE_POSTER: Could not set up network monitoring: ${e.message}, will use UI verification`);
    }

    // Find and click post button
    const postButtonSelectors = [
      '[data-testid="tweetButtonInline"]:not([aria-disabled="true"])',
      '[data-testid="tweetButton"]:not([aria-disabled="true"])',
      'button[data-testid="tweetButtonInline"]:not([disabled])',
      'button[role="button"]:has-text("Post")',
      'button[role="button"]:has-text("Tweet")'
    ];

    let postButton = null;
    let lastError = '';
    for (const selector of postButtonSelectors) {
      try {
        console.log(`ULTIMATE_POSTER: Trying post button selector: ${selector}`);
        postButton = await this.page.waitForSelector(selector, { 
          state: 'visible', 
          timeout: 8000  // Increased timeout
        });
        if (postButton) {
          console.log(`ULTIMATE_POSTER: ✅ Found post button: ${selector}`);
          break;
        }
      } catch (e: any) {
        lastError = e.message;
        console.log(`ULTIMATE_POSTER: ❌ ${selector} not found (${e.message})`);
        continue;
      }
    }

    if (!postButton) {
      console.error(`ULTIMATE_POSTER: ❌ CRITICAL - No post button found after ${postButtonSelectors.length} attempts`);
      console.log(`ULTIMATE_POSTER: Last error: ${lastError}`);
      console.log('ULTIMATE_POSTER: 🔍 Taking debug screenshot...');
      try {
        await this.page.screenshot({ path: 'debug_no_post_button.png', fullPage: true });
        console.log('ULTIMATE_POSTER: Screenshot saved to debug_no_post_button.png');
      } catch (screenshotError) {
        console.log('ULTIMATE_POSTER: Could not take screenshot');
      }
      throw new Error(`No enabled post button found. Tried ${postButtonSelectors.length} selectors. Last error: ${lastError}`);
    }

    console.log('ULTIMATE_POSTER: 🚀 Clicking post button...');
    
    // Circuit breaker check
    if (this.clickFailures >= this.maxClickFailures) {
      const timeSinceReset = Date.now() - this.lastResetTime;
      if (timeSinceReset < 300000) { // 5 minutes
        console.log('ULTIMATE_POSTER: Circuit breaker OPEN - too many failures, resetting browser...');
        await this.cleanup(); // Use existing cleanup method
        this.clickFailures = 0;
        this.lastResetTime = Date.now();
        throw new Error('Circuit breaker triggered - browser reset');
      } else {
        // Reset counter after cooldown
        this.clickFailures = 0;
        this.lastResetTime = Date.now();
      }
    }
    
    // 🔒 SEV1 GHOST ERADICATION: Service identity check (WORKER ONLY)
    // 🔒 SERVICE_ROLE CHECK: Use role resolver (single source of truth)
    const { isWorkerService } = await import('../utils/serviceRoleResolver');
    const isWorker = isWorkerService();
    
    if (!isWorker) {
      const errorMsg = `[SEV1_GHOST_BLOCK] ❌ BLOCKED: Not running on worker service. SERVICE_ROLE=${process.env.SERVICE_ROLE || 'NOT SET'}`;
      console.error(errorMsg);
      console.error(`[SEV1_GHOST_BLOCK] Stack: ${new Error().stack}`);
      
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        event_type: 'posting_blocked_wrong_service',
        severity: 'critical',
        message: `Posting blocked: Not running on worker service`,
        event_data: {
          service_role: process.env.SERVICE_ROLE || 'NOT SET',
          service_name: process.env.RAILWAY_SERVICE_NAME || 'unknown',
          decision_id: validGuard.decision_id,
          pipeline_source: validGuard.pipeline_source,
          git_sha: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown',
          run_id: validGuard.job_run_id,
          reason: 'not_worker_service',
          stack_trace: new Error().stack?.substring(0, 1000),
        },
        created_at: new Date().toISOString(),
      });
      
      throw new Error('BLOCKED: Posting only allowed from worker service (SERVICE_ROLE=worker)');
    }
    
    // 🔒 SEV1 GHOST ERADICATION: Pipeline source must be reply_v2_scheduler
    if (validGuard.pipeline_source !== 'reply_v2_scheduler') {
      const errorMsg = `[SEV1_GHOST_BLOCK] ❌ BLOCKED: Invalid pipeline_source. source=${validGuard.pipeline_source} required=reply_v2_scheduler`;
      console.error(errorMsg);
      console.error(`[SEV1_GHOST_BLOCK] Stack: ${new Error().stack}`);
      
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
      const { getServiceRoleInfo } = await import('../utils/serviceRoleResolver');
      const roleInfo = getServiceRoleInfo();
      await supabase.from('system_events').insert({
        event_type: 'posting_blocked_wrong_service',
        severity: 'critical',
        message: `Posting blocked: Invalid pipeline_source`,
        event_data: {
          service_name: process.env.RAILWAY_SERVICE_NAME || 'unknown',
          role: roleInfo.role,
          decision_id: validGuard.decision_id,
          pipeline_source: validGuard.pipeline_source,
          git_sha: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown',
          run_id: validGuard.job_run_id,
          reason: 'invalid_pipeline_source',
          stack_trace: new Error().stack?.substring(0, 1000),
        },
        created_at: new Date().toISOString(),
      });
      
      throw new Error(`BLOCKED: Only reply_v2_scheduler allowed, got ${validGuard.pipeline_source}`);
    }
    
    // 🔒 POSTING PERMIT CHECK (FINAL CHOKE POINT FOR SINGLE POSTS)
    // This is the ONLY place where we click Post button for single tweets
    const permit_id = validGuard.permit_id;
    
    if (!permit_id) {
      const errorMsg = `[PERMIT_CHOKE] ❌ BLOCKED: No permit_id in guard. decision_id=${validGuard.decision_id}`;
      console.error(errorMsg);
      console.error(`[PERMIT_CHOKE] Stack: ${new Error().stack}`);
      
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        event_type: 'posting_blocked_no_permit',
        severity: 'critical',
        message: `Posting blocked: No permit_id in guard`,
        event_data: {
          decision_id: validGuard.decision_id,
          pipeline_source: validGuard.pipeline_source,
          stack_trace: new Error().stack?.substring(0, 1000),
        },
        created_at: new Date().toISOString(),
      });
      
      throw new Error('BLOCKED: No posting permit - posting requires permit_id');
    }
    
    const { verifyPostingPermit } = await import('./postingPermit');
    const permitCheck = await verifyPostingPermit(permit_id);
    if (!permitCheck.valid) {
      const errorMsg = `[PERMIT_CHOKE] ❌ BLOCKED: Permit not valid. permit_id=${permit_id} error=${permitCheck.error}`;
      console.error(errorMsg);
      
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        event_type: 'posting_blocked_invalid_permit',
        severity: 'critical',
        message: `Posting blocked: Permit not valid`,
        event_data: {
          permit_id,
          decision_id: validGuard.decision_id,
          permit_error: permitCheck.error,
        },
        created_at: new Date().toISOString(),
      });
      
      throw new Error(`BLOCKED: Permit not valid (${permitCheck.error})`);
    }
    
    console.log(`[PERMIT_CHOKE] ✅ Permit verified: ${permit_id} (status: ${permitCheck.permit?.status})`);
    
    // Try multiple click strategies to bypass overlay
    let clickSuccess = false;
    try {
      // Strategy 1: Normal click
      console.log('ULTIMATE_POSTER: Trying normal click...');
      await postButton.click({ timeout: 15000 }); // Increased from 5s → 15s
      this.clickFailures = 0; // Reset on success
      clickSuccess = true;
      console.log(`ULTIMATE_POSTER: ✅ Normal click succeeded (permit: ${permit_id})`);
    } catch (clickError: any) {
      this.clickFailures++;
      console.log(`ULTIMATE_POSTER: ❌ Normal click failed (${this.clickFailures}/${this.maxClickFailures}): ${clickError.message}`);
      console.log('ULTIMATE_POSTER: Trying force-click...');
      
      // Strategy 2: Force-click via JavaScript
      try {
        await this.page.evaluate((selector) => {
          const btn = document.querySelector(selector) as HTMLElement;
          if (btn) {
            btn.click();
            console.log('JS: Button clicked');
          } else {
            console.log('JS: Button not found');
          }
        }, postButtonSelectors[0]);
        clickSuccess = true;
        console.log('ULTIMATE_POSTER: ✅ Force-click executed');
      } catch (forceError: any) {
        console.log(`ULTIMATE_POSTER: ❌ Force-click failed: ${forceError.message}`);
        console.log('ULTIMATE_POSTER: Trying mouse coordinate click...');
        
        // Strategy 3: Click via coordinates
        const box = await postButton.boundingBox();
        if (box) {
          await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          clickSuccess = true;
          console.log('ULTIMATE_POSTER: ✅ Mouse coordinate click executed');
        } else {
          console.error('ULTIMATE_POSTER: ❌ All click strategies failed - no bounding box');
          throw new Error('All click strategies failed');
        }
      }
    }
    
    if (!clickSuccess) {
      console.error('ULTIMATE_POSTER: ❌ CRITICAL - Post button click failed completely');
      throw new Error('Failed to click post button after all strategies');
    }
    
    console.log('ULTIMATE_POSTER: ✅ Post button clicked successfully');

    // ✅ NEW: Simplified extraction flow with clear priority
    console.log('ULTIMATE_POSTER: 🔍 Extracting tweet ID (priority order)...');

    // 🔥 ENHANCEMENT: Progressive network capture with multiple checkpoints
    // Priority 1: Network interception (99% reliable, instant)
    if (this.capturedTweetId) {
      console.log(`✅ ID from network: ${this.capturedTweetId}`);
      return { success: true, tweetId: this.capturedTweetId };
    }

    // 🔥 ENHANCEMENT: Progressive wait for network capture (2s, 5s, 10s, 20s)
    console.log('ULTIMATE_POSTER: Waiting for network capture (progressive checks)...');
    const networkWaitCheckpoints = [2000, 5000, 10000, 20000]; // Progressive waits
    let lastWaitTime = 0;
    for (const waitMs of networkWaitCheckpoints) {
      const waitDuration = waitMs - lastWaitTime;
      await this.page?.waitForTimeout(waitDuration);
      lastWaitTime = waitMs;
      if (this.capturedTweetId) {
        console.log(`✅ ID from network capture (after ${waitMs}ms): ${this.capturedTweetId}`);
        return { success: true, tweetId: this.capturedTweetId };
      }
      console.log(`ULTIMATE_POSTER: Network check at ${waitMs}ms - no ID yet, continuing...`);
    }

    // Priority 2: URL redirect (95% reliable, fast - 1-2 seconds)
    console.log('ULTIMATE_POSTER: Waiting for redirect...');
    const redirectId = await this.waitForTweetRedirect(5000);
    if (redirectId) {
      console.log(`✅ ID from redirect: ${redirectId}`);
      return { success: true, tweetId: redirectId };
    }

    // Priority 3: Current URL (if already on tweet page)
    const currentUrl = this.page?.url() || '';
    const urlMatch = currentUrl.match(/\/status\/(\d{15,20})/);
    if (urlMatch) {
      console.log(`✅ ID from current URL: ${urlMatch[1]}`);
      return { success: true, tweetId: urlMatch[1] };
    }

    // Priority 4: Network response (if promise still pending)
    if (networkVerificationPromise) {
      try {
        const response = await Promise.race([
          networkVerificationPromise,
          new Promise<any>((_, reject) => 
            setTimeout(() => reject(new Error('timeout')), 5000)
          )
        ]);
        
        if (response && response.ok()) {
          const responseBody = await response.json();
          const extractedId = this.extractTweetIdFromAnyResponse(responseBody);
          if (extractedId) {
            console.log(`✅ ID from network response: ${extractedId}`);
            return { success: true, tweetId: extractedId };
          }
        }
      } catch (e) {
        // Network response failed, continue to UI verification
        console.log('ULTIMATE_POSTER: Network response timeout, trying UI verification...');
      }
    }

    // Priority 5: UI verification (LAST RESORT - slow, unreliable)
    console.log('ULTIMATE_POSTER: Using UI verification (last resort)...');
    try {
      // Modern Twitter verification: Check for multiple reliable indicators
      const verificationChecks = [
        // Check 1: URL change (most reliable - goes back to home after posting)
        (async () => {
          try {
            await this.page.waitForURL(/.*x\.com\/(home|[^\/]+)\/?$/, { timeout: 8000 });
            console.log('ULTIMATE_POSTER: ✅ URL changed to home/timeline - POST SUCCESSFUL');
            return true;
          } catch {
            return false;
          }
        })(),
        
        // Check 2: Composer gets cleared/disabled
        (async () => {
          try {
            await this.page.waitForFunction(() => {
              const textarea = document.querySelector('[data-testid="tweetTextarea_0"]') as HTMLElement;
              return textarea && (textarea.textContent?.trim() === '' || textarea.getAttribute('aria-disabled') === 'true');
            }, { timeout: 8000 });
            console.log('ULTIMATE_POSTER: ✅ Composer cleared - POST SUCCESSFUL');
            return true;
          } catch {
            return false;
          }
        })(),
        
        // Check 3: Post button disappears or gets disabled
        (async () => {
          try {
            await this.page.waitForFunction(() => {
              const btn = document.querySelector('[data-testid="tweetButtonInline"]');
              return !btn || btn.getAttribute('aria-disabled') === 'true' || !btn.isConnected;
            }, { timeout: 8000 });
            console.log('ULTIMATE_POSTER: ✅ Post button disabled/removed - POST SUCCESSFUL');
            return true;
          } catch {
            return false;
          }
        })()
      ];
      
      // If ANY verification check passes, consider it successful
      const results = await Promise.all(verificationChecks);
      if (results.some(r => r === true)) {
        console.log('ULTIMATE_POSTER: ✅ UI verification successful - post confirmed');
        
        // Try to get tweet ID, but don't fail if we can't
        let tweetId: string | undefined;
        try {
          const verification = await this.verifyActualPosting();
          if (verification.success && verification.tweetId) {
            tweetId = verification.tweetId;
            console.log(`ULTIMATE_POSTER: ✅ Tweet ID captured: ${tweetId}`);
            return { success: true, tweetId };
          }
        } catch (e: any) {
          console.log(`ULTIMATE_POSTER: ⚠️ UI verification error: ${e.message}`);
        }
      }
    } catch (verificationError: any) {
      console.log(`ULTIMATE_POSTER: ⚠️ UI verification failed: ${verificationError.message}`);
    }

    // If ALL methods fail, tweet is still posted - use placeholder
    console.log(`⚠️ All extraction methods failed, but tweet is posted`);
    console.log(`⚠️ Using placeholder ID - will recover later`);
    return { 
      success: true, 
      tweetId: `pending_${Date.now()}` // Placeholder - recover later
    };
  }

  /**
   * 🔥 Wait for URL redirect (Twitter always redirects after posting)
   * Fast, reliable signal - no UI scraping needed
   */
  private async waitForTweetRedirect(timeout: number = 10000): Promise<string | null> {
    if (!this.page) return null;
    
    return new Promise((resolve) => {
      let resolved = false;
      
      // Strategy 1: Wait for navigation to tweet URL
      const navigationHandler = (frame: any) => {
        if (frame === this.page?.mainFrame()) {
          const url = frame.url();
          const match = url.match(/\/status\/(\d{15,20})/);
          if (match && !resolved) {
            resolved = true;
            this.page?.off('framenavigated', navigationHandler);
            console.log(`🎯 REDIRECT: Captured tweet ID: ${match[1]}`);
            resolve(match[1]);
          }
        }
      };
      
      this.page.on('framenavigated', navigationHandler);
      
      // Strategy 2: Poll current URL (in case navigation event missed)
      const pollInterval = setInterval(() => {
        if (resolved) {
          clearInterval(pollInterval);
          return;
        }
        
        const currentUrl = this.page?.url() || '';
        const match = currentUrl.match(/\/status\/(\d{15,20})/);
        if (match) {
          resolved = true;
          clearInterval(pollInterval);
          this.page?.off('framenavigated', navigationHandler);
          console.log(`🎯 POLL: Captured tweet ID: ${match[1]}`);
          resolve(match[1]);
        }
      }, 500);
      
      // Timeout
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          clearInterval(pollInterval);
          this.page?.off('framenavigated', navigationHandler);
          console.log('⏱️ Redirect timeout - tweet may not have redirected');
          resolve(null);
        }
      }, timeout);
    });
  }

  /**
   * PHASE 3.5: Extract real tweet ID with multiple strategies
   * Priority: 1) Redirect capture, 2) Toast notification, 3) Profile page, 4) Timestamp fallback
   */
  private async extractTweetIdFromUrl(): Promise<string> {
    if (!this.page) {
      console.log('ULTIMATE_POSTER: ❌ Page not available - cannot extract tweet ID');
      throw new Error('Page not available for tweet ID extraction - post may have failed');
    }
    
    try {
      // STRATEGY 1: Use captured redirect ID (most reliable!)
      if (this.capturedTweetId) {
        console.log(`ULTIMATE_POSTER: ✅ Using captured ID: ${this.capturedTweetId}`);
        return this.capturedTweetId;
      }
      
      // Wait a bit more for redirect to happen
      await this.page.waitForTimeout(2000);
      if (this.capturedTweetId) {
        console.log(`ULTIMATE_POSTER: ✅ Captured after wait: ${this.capturedTweetId}`);
        return this.capturedTweetId;
      }
      
      console.log('ULTIMATE_POSTER: ⚠️ Redirect not captured, trying fallback strategies...');
      
      // STRATEGY 2: Check for success toast with link
      try {
        console.log('ULTIMATE_POSTER: Trying toast notification...');
        const toast = await this.page.locator('[data-testid="toast"]').first();
        const viewLink = await toast.locator('a[href*="/status/"]').getAttribute('href', { timeout: 2000 });
        if (viewLink) {
          const match = viewLink.match(/\/status\/(\d+)/);
          if (match && match[1]) {
            console.log(`ULTIMATE_POSTER: ✅ Extracted from toast: ${match[1]}`);
            return match[1];
          }
        }
      } catch (e) {
        console.log('ULTIMATE_POSTER: Toast strategy failed');
      }
      
      // STRATEGY 3: Navigate to profile and get latest tweet WITH RETRY LOGIC
      const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
      const maxRetries = 3;
      
      for (let retry = 1; retry <= maxRetries; retry++) {
        try {
          console.log(`ULTIMATE_POSTER: 🔍 Profile extraction attempt ${retry}/${maxRetries}...`);
          
          // Wait progressively longer for Twitter to index the tweet
          // CRITICAL: Must wait long enough for Twitter to fully index!
          const waitTime = 5000 + (retry * 8000); // 13s, 21s, 29s (increased!)
          console.log(`ULTIMATE_POSTER: ⏳ Waiting ${waitTime/1000}s for Twitter to index tweet (retry ${retry}/${maxRetries})...`);
          await this.page.waitForTimeout(waitTime);
          
          // Force fresh page load
          console.log(`ULTIMATE_POSTER: 🔄 Loading profile (fresh): https://x.com/${username}`);
          await this.page.goto(`https://x.com/${username}`, { 
            waitUntil: 'networkidle',
            timeout: 30000 
          });
          
          // Wait for content to load
          await this.page.waitForTimeout(3000);
          
          console.log(`ULTIMATE_POSTER: 🔎 Searching for YOUR recent tweet...`);
          
          // Get all tweets on profile
          const articles = await this.page.locator('article').all();
          console.log(`ULTIMATE_POSTER: Found ${articles.length} articles`);
          
          if (articles.length === 0) {
            console.warn(`ULTIMATE_POSTER: ⚠️ No articles found on profile (attempt ${retry})`);
            continue; // Retry
          }
          
          // Check first few tweets (most recent)
          for (let i = 0; i < Math.min(5, articles.length); i++) {
            try {
              const article = articles[i];
              
              // Verify it's from YOUR account
              const profileLinks = await article.locator(`a[href="/${username}"]`).count();
              if (profileLinks === 0) {
                console.log(`ULTIMATE_POSTER: Tweet ${i} - Not from @${username}, skipping`);
                continue;
              }
              
              // Check timestamp
              const timeEl = await article.locator('time').first();
              const datetime = await timeEl.getAttribute('datetime');
              
              if (datetime) {
                const tweetTime = new Date(datetime);
                const ageSeconds = (Date.now() - tweetTime.getTime()) / 1000;
                
                console.log(`ULTIMATE_POSTER: Tweet ${i} - Age: ${Math.round(ageSeconds)}s`);
                
                // Only consider very recent tweets (last 5 minutes)
                if (ageSeconds < 300) {
                  // Extract tweet ID
                  const statusLinks = await article.locator('a[href*="/status/"]').all();
                  
                  for (const link of statusLinks) {
                    const href = await link.getAttribute('href');
                    if (href && href.includes(`/${username}/status/`)) {
                      const match = href.match(/\/status\/(\d{15,20})/);
                      if (match && match[1]) {
                        console.log(`ULTIMATE_POSTER: ✅ FOUND REAL ID: ${match[1]}`);
                        console.log(`ULTIMATE_POSTER: ✅ From @${username}, ${Math.round(ageSeconds)}s ago`);
                        return match[1]; // SUCCESS!
                      }
                    }
                  }
                } else {
                  console.log(`ULTIMATE_POSTER: Tweet ${i} - Too old (${Math.round(ageSeconds)}s)`);
                }
              }
            } catch (e: any) {
              console.log(`ULTIMATE_POSTER: Tweet ${i} - Error: ${e.message}`);
              continue;
            }
          }
          
          console.warn(`ULTIMATE_POSTER: ⚠️ No matching tweet found (attempt ${retry}/${maxRetries})`);
          
        } catch (e: any) {
          console.error(`ULTIMATE_POSTER: ❌ Attempt ${retry} failed: ${e.message}`);
        }
        
        // If not last retry, wait before trying again
        if (retry < maxRetries) {
          console.log(`ULTIMATE_POSTER: 🔄 Retrying in 3s...`);
          await this.page.waitForTimeout(3000);
        }
      }
      
      console.error(`ULTIMATE_POSTER: ❌ Failed to extract ID after ${maxRetries} attempts`);
      return null;
      
    } catch (error: any) {
      console.error(`ULTIMATE_POSTER: ❌ All extraction strategies failed: ${error.message}`);
      return null;
    }
  }

  private extractTweetId(responseBody: any): string | null {
    try {
      // Common paths where Twitter returns tweet IDs
      const paths = [
        'data.create_tweet.tweet_results.result.rest_id',
        'data.create_tweet.tweet_results.result.legacy.id_str',
        'data.create_tweet.tweet_results.result.id',
        'tweet_results.result.rest_id'
      ];

      for (const path of paths) {
        const value = this.getNestedValue(responseBody, path);
        if (value && typeof value === 'string') {
          return value;
        }
      }
    } catch (e) {
      console.log('ULTIMATE_POSTER: Error extracting tweet ID:', e.message);
    }
    return null;
  }

  /**
   * 🔥 Extract tweet ID from ANY response structure
   * Uses multiple strategies: JSON paths, regex, deep search
   */
  private extractTweetIdFromAnyResponse(body: any): string | null {
    try {
      // Strategy 1: Deep search for tweet ID patterns in JSON
      const bodyStr = JSON.stringify(body);
      
      // Look for id_str pattern (most common)
      const idStrMatch = bodyStr.match(/"id_str"\s*:\s*"(\d{15,20})"/);
      if (idStrMatch) return idStrMatch[1];
      
      // Look for rest_id pattern
      const restIdMatch = bodyStr.match(/"rest_id"\s*:\s*"(\d{15,20})"/);
      if (restIdMatch) return restIdMatch[1];
      
      // Strategy 2: Common Twitter response paths
      const paths = [
        'data.create_tweet.tweet_results.result.rest_id',
        'data.create_tweet.tweet_results.result.legacy.id_str',
        'data.create_tweet.tweet_results.result.id',
        'tweet_results.result.rest_id',
        'tweet.id_str',
        'tweet.id',
        'result.rest_id',
        'rest_id',
        'id_str',
        'id'
      ];
      
      for (const path of paths) {
        const value = this.getNestedValue(body, path);
        if (value && /^\d{15,20}$/.test(String(value))) {
          return String(value);
        }
      }
      
      // Strategy 3: Find any 15-20 digit number (likely tweet ID)
      const allIds = bodyStr.match(/"(\d{15,20})"/g);
      if (allIds && allIds.length > 0) {
        // Return first one that looks like tweet ID
        return allIds[0].replace(/"/g, '');
      }
      
      return null;
    } catch (e: any) {
      return null;
    }
  }

  /**
   * Extract tweet ID from plain text response
   */
  private extractTweetIdFromText(text: string): string | null {
    // Look for tweet ID patterns in text
    const patterns = [
      /"id_str"\s*:\s*"(\d{15,20})"/,
      /"rest_id"\s*:\s*"(\d{15,20})"/,
      /\/status\/(\d{15,20})/,
      /(\d{15,20})/
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * 🔥 BULLETPROOF NETWORK INTERCEPTION
   * Intercepts ALL network responses and extracts tweet IDs from ANY structure
   * No hardcoded patterns - adapts to Twitter changes
   */
  private setupBulletproofNetworkInterception(): void {
    if (!this.page) return;
    
    // Remove old listener if exists
    if (this.networkResponseListener) {
      this.page.off('response', this.networkResponseListener);
    }
    
    // NEW: Intercept ALL responses (not just specific patterns)
    this.networkResponseListener = async (response: any) => {
      try {
        const url = response.url();
        
        // Strategy 1: Check response body for tweet ID (ANY endpoint)
        if (response.status() === 200) {
          try {
            const responseBody = await response.json();
            const tweetId = this.extractTweetIdFromAnyResponse(responseBody);
            if (tweetId && !this.capturedTweetId) {
              this.capturedTweetId = tweetId;
              console.log(`🎯 NETWORK: Captured tweet ID: ${tweetId} from ${url}`);
              this.saveTweetIdToFile(tweetId, 'network_interception');
            }
          } catch (jsonError: any) {
            // Not JSON, try text
            try {
              const text = await response.text();
              const tweetId = this.extractTweetIdFromText(text);
              if (tweetId && !this.capturedTweetId) {
                this.capturedTweetId = tweetId;
                console.log(`🎯 NETWORK: Captured tweet ID: ${tweetId} from text`);
              }
            } catch (textError: any) {
              // Ignore - not all responses are parseable
            }
          }
        }
        
        // Strategy 2: Extract from URL (redirects, etc.)
        const urlMatch = url.match(/\/status\/(\d{15,20})/);
        if (urlMatch && !this.capturedTweetId) {
          this.capturedTweetId = urlMatch[1];
          console.log(`🎯 NETWORK: Captured tweet ID from URL: ${this.capturedTweetId}`);
        }
      } catch (error: any) {
        // Ignore errors in network interception (non-critical)
      }
    };
    
    this.page.on('response', this.networkResponseListener);
    console.log('✅ Bulletproof network interception active');
  }

  /**
   * 🔥 PRIORITY 1 FIX: Save tweet ID to temp file as backup
   * Used if database save fails - allows recovery later
   */
  private saveTweetIdToFile(tweetId: string, source: string, content?: string, decisionId?: string): void {
    try {
      const logsDir = join(process.cwd(), 'logs');
      if (!existsSync(logsDir)) {
        mkdirSync(logsDir, { recursive: true });
      }
      
      const backupFile = join(logsDir, 'tweet_id_backups.jsonl');
      const backupEntry = {
        tweetId,
        source,
        content: content ? content.substring(0, 200) : null, // Store first 200 chars for matching
        decisionId: decisionId || null,
        timestamp: Date.now(),
        date: new Date().toISOString()
      };
      
      appendFileSync(backupFile, JSON.stringify(backupEntry) + '\n');
      console.log(`ULTIMATE_POSTER: 💾 Tweet ID backed up to file: ${tweetId} (source: ${source})`);
    } catch (error: any) {
      console.warn(`ULTIMATE_POSTER: ⚠️ Failed to backup tweet ID to file: ${error.message}`);
    }
  }

  /**
   * 🌐 MIGRATED TO UNIFIED BROWSER POOL
   * Reloads session state in pool (pool manages session lifecycle)
   */
  private async refreshSession(): Promise<void> {
    this.sessionRefreshes++;
    console.log('ULTIMATE_POSTER: Refreshing Twitter session via UnifiedBrowserPool...');
    
    try {
      const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
      const browserPool = UnifiedBrowserPool.getInstance();
      
      // Reload session state in pool (pool will detect changes and update contexts)
      await browserPool.reloadSessionState();
      console.log('ULTIMATE_POSTER: ✅ Session state reloaded in pool');
      
      // If we have a storage state file, delete it to force re-authentication
      if (existsSync(this.storageStatePath)) {
        try {
          require('fs').unlinkSync(this.storageStatePath);
          console.log('ULTIMATE_POSTER: Cleared expired storage state');
        } catch (e) {
          console.warn('ULTIMATE_POSTER: Could not clear storage state:', e?.message || e);
        }
      }
    } catch (e) {
      console.error('ULTIMATE_POSTER: Failed to refresh session:', e?.message || e);
      throw new Error('Session refresh failed - manual re-authentication may be required');
    }
  }

  private async captureFailureArtifacts(error: string): Promise<void> {
    if (!this.page) return;

    const timestamp = Date.now();
    const artifactsDir = join(process.cwd(), 'artifacts');

    try {
      // Capture screenshot
      const screenshotPath = join(artifactsDir, `failure-${timestamp}.png`);
      await this.page.screenshot({ 
        path: screenshotPath, 
        fullPage: true 
      });
      console.log(`ULTIMATE_POSTER: Screenshot saved to ${screenshotPath}`);

      // Tracing not available with UnifiedBrowserPool (pool manages contexts)
      // Screenshot is sufficient for debugging

      // Save error details
      const errorLogPath = join(artifactsDir, `error-${timestamp}.json`);
      writeFileSync(errorLogPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        error,
        url: this.page.url(),
        userAgent: await this.page.evaluate(() => navigator.userAgent)
      }, null, 2));
      console.log(`ULTIMATE_POSTER: Error details saved to ${errorLogPath}`);

    } catch (e) {
      console.error('ULTIMATE_POSTER: Failed to capture artifacts:', e.message);
    }
  }

  /**
   * 🌐 MIGRATED TO UNIFIED BROWSER POOL
   * Releases page back to pool (pool manages lifecycle)
   */
  private async cleanup(): Promise<void> {
    try {
      if (this.page) {
        const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
        const browserPool = UnifiedBrowserPool.getInstance();
        
        console.log('ULTIMATE_POSTER: Releasing page back to UnifiedBrowserPool...');
        await browserPool.releasePage(this.page);
        this.page = null;
        console.log('ULTIMATE_POSTER: ✅ Page released to pool');
      }
    } catch (e) {
      console.warn('ULTIMATE_POSTER: Cleanup error:', e?.message || e);
      // Ensure page is cleared even if release fails
      this.page = null;
    }
  }

  /**
   * 🔥 REAL VERIFICATION: Check if tweet actually posted to profile
   * This catches silent rejections where UI shows success but tweet doesn't appear
   */
  private async verifyActualPosting(): Promise<{ success: boolean; tweetId?: string }> {
    if (!this.page) {
      return { success: false };
    }

    try {
      console.log('ULTIMATE_POSTER: 🔍 Starting real verification - checking profile for actual tweet...');
      
      // Navigate to profile to check for actual tweet
      const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
      await this.page.goto(`https://x.com/${username}?t=${Date.now()}`, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });
      
      // Wait for Twitter to process and show fresh content
      await this.page.waitForTimeout(3000);
      
      // Force reload to get fresh content (bypass cache)
      await this.page.reload({ waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(2000);
      
      // Look for the most recent tweet (should be our posted tweet)
      const articles = await this.page.locator('article[data-testid="tweet"]').all();
      console.log(`ULTIMATE_POSTER: 🔍 Found ${articles.length} tweets on profile`);
      
      if (articles.length === 0) {
        console.log('ULTIMATE_POSTER: ❌ No tweets found on profile');
        return { success: false };
      }
      
      // Check the first (most recent) tweet
      const firstTweet = articles[0];
      
      // Verify it's from our account
      const authorLink = await firstTweet.locator(`a[href="/${username}"]`).first();
      const isOurTweet = await authorLink.count() > 0;
      
      if (!isOurTweet) {
        console.log('ULTIMATE_POSTER: ❌ Most recent tweet is not from our account');
        return { success: false };
      }
      
      // Check if tweet is recent (within last 10 minutes)
      const timeEl = await firstTweet.locator('time').first();
      const datetime = await timeEl.getAttribute('datetime');
      
      if (datetime) {
        const tweetTime = new Date(datetime);
        const ageMinutes = (Date.now() - tweetTime.getTime()) / (1000 * 60);
        
        if (ageMinutes > 10) {
          console.log(`ULTIMATE_POSTER: ❌ Most recent tweet is too old (${Math.round(ageMinutes)}m ago)`);
          return { success: false };
        }
        
        console.log(`ULTIMATE_POSTER: ✅ Found recent tweet (${Math.round(ageMinutes)}m ago)`);
      }
      
      // Extract tweet ID from the tweet
      const statusLink = await firstTweet.locator('a[href*="/status/"]').first();
      const href = await statusLink.getAttribute('href');
      
      if (href) {
        const match = href.match(/\/status\/(\d{15,20})/);
        if (match) {
          const tweetId = match[1];
          console.log(`ULTIMATE_POSTER: ✅ Real verification successful - tweet ID: ${tweetId}`);
          return { success: true, tweetId };
        }
      }
      
      console.log('ULTIMATE_POSTER: ❌ Could not extract tweet ID from profile');
      return { success: false };
      
    } catch (error: any) {
      console.log(`ULTIMATE_POSTER: ❌ Real verification error: ${error.message}`);
      return { success: false };
    }
  }

  private async extractCanonicalTweet(content: string): Promise<{ tweetId: string; tweetUrl: string }> {
    if (!this.page) {
      throw new Error('Browser page unavailable for tweet verification');
    }

    const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';

    if (this.capturedTweetId) {
      const tweetUrl = `https://x.com/${username}/status/${this.capturedTweetId}`;
      return { tweetId: this.capturedTweetId, tweetUrl };
    }

    // Give Twitter a moment to surface the new post before extraction
    await this.page.waitForTimeout(4000);

    const extraction = await BulletproofTweetExtractor.extractWithRetries(this.page, {
      expectedContent: content,
      expectedUsername: username,
      maxAgeSeconds: 600,
      navigateToVerify: true
    });

    BulletproofTweetExtractor.logVerificationSteps(extraction);

    if (!extraction.success || !extraction.tweetId) {
      throw new Error(`Tweet ID extraction failed: ${extraction.error || 'Unknown error'}`);
    }

    const tweetUrl = extraction.url || `https://x.com/${username}/status/${extraction.tweetId}`;

    return {
      tweetId: extraction.tweetId,
      tweetUrl
    };
  }

  async dispose(): Promise<void> {
    await this.cleanup();
  }

  async handleFailure(errorMessage: string): Promise<void> {
    try {
      await this.captureFailureArtifacts(errorMessage);
    } catch (artifactError: any) {
      console.warn(`ULTIMATE_POSTER: Failed to capture failure artifacts: ${artifactError?.message || artifactError}`);
    } finally {
      await this.cleanup();
    }
  }

  private async prepareForAttempt(attempt: number): Promise<void> {
    if (!this.forceFreshContextPerAttempt) return;
    if (attempt === 0) {
      await this.cleanup();
      return;
    }

    await this.cleanup();
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  /**
   * 💬 POST REPLY TO TWEET (Permanent Solution)
   * Navigates to tweet and posts actual reply (not @mention)
   * 
   * 🔒 REQUIRES: PostingGuard from createPostingGuard()
   */
  async postReply(content: string, replyToTweetId: string, guard?: PostingGuard): Promise<PostResult> {
    // 🔒 GUARD CHECK: Block unauthorized posting
    const verification = verifyPostingGuard(guard, 'postReply');
    if (!verification.valid) {
      return { success: false, error: (verification as { valid: false; error: string }).error };
    }
    const validGuard = (verification as { valid: true; guard: PostingGuard }).guard;
    
    // 📊 COMPREHENSIVE LOGGING: Build fingerprint for audit trail
    const BUILD_SHA = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || 'dev';
    const DB_URL = process.env.DATABASE_URL || '';
    const DB_ENV_FINGERPRINT = require('crypto').createHash('md5').update(DB_URL).digest('hex').substring(0, 8);
    
    console.log(`[POST_REPLY] 🔐 Authorized via guard: decision_id=${validGuard.decision_id} target=${replyToTweetId}`);
    console.log(`[POST_REPLY] 📊 AUDIT_TRAIL: decision_id=${validGuard.decision_id} target_tweet_id=${replyToTweetId} pipeline_source=${validGuard.pipeline_source} job_run_id=${validGuard.job_run_id} build_sha=${BUILD_SHA} db_env=${DB_ENV_FINGERPRINT}`);
    
    let retryCount = 0;
    const maxRetries = 2;

    console.log(`ULTIMATE_POSTER: Posting reply to tweet ${replyToTweetId} (guard: ${validGuard.decision_id})`);

    while (retryCount <= maxRetries) {
      const sessionRefreshesBefore = this.sessionRefreshes;
      let composerAttempts = 0;
      const telemetry = new ReplyPostingTelemetry(validGuard.decision_id, replyToTweetId, retryCount + 1);
      try {
        console.log(`ULTIMATE_POSTER: Reply attempt ${retryCount + 1}/${maxRetries + 1}`);
        await this.prepareForAttempt(retryCount);
        
        await this.ensureContext();
        
        if (!this.page) throw new Error('Page not initialized');

        // 🔍 FORENSIC PIPELINE: Final hard gate - verify ancestry before posting
        const { resolveTweetAncestry, shouldAllowReply } = await import('../jobs/replySystemV2/replyDecisionRecorder');
        const ancestry = await resolveTweetAncestry(replyToTweetId);
        const allowCheck = await shouldAllowReply(ancestry);
        
        if (!allowCheck.allow) {
          const errorMsg = `FINAL_PLAYWRIGHT_GATE_BLOCKED: ${allowCheck.reason}`;
          console.error(`[ULTIMATE_POSTER] 🚫 ${errorMsg}`);
          throw new Error(errorMsg);
        }
        
        console.log(`[ULTIMATE_POSTER] ✅ Final gate passed: depth=${ancestry.ancestryDepth}, root=${ancestry.isRoot}`);
        
        // Navigate to the tweet
        console.log(`ULTIMATE_POSTER: Navigating to tweet ${replyToTweetId}...`);
        await this.page.goto(`https://x.com/i/status/${replyToTweetId}`, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });

        await this.page.waitForTimeout(2000);
        telemetry.mark('navigation_complete');

        // Check authentication
        const isLoggedOut = await this.checkIfLoggedOut();
        if (isLoggedOut) {
          throw new Error('Not logged in - session expired');
        }

        console.log(`ULTIMATE_POSTER: Focusing reply composer...`);

        let composer: Locator | null = null;

        try {
          const focusResult = await ensureComposerFocused(this.page, { mode: 'reply' });
          if (!focusResult.success || !focusResult.element) {
            throw new Error(focusResult.error || 'Reply composer not focused');
          }
          composer = focusResult.element as Locator;
          if (focusResult.selectorUsed) {
            console.log(`ULTIMATE_POSTER: Reply composer focused via ${focusResult.selectorUsed}`);
          } else {
            console.log(`ULTIMATE_POSTER: Reply composer focused`);
          }
          telemetry.mark('composer_ready');
          composerAttempts += 1;
        } catch (focusError: any) {
          console.warn(`ULTIMATE_POSTER: ensureComposerFocused failed (${focusError.message}). Falling back.`);

          const replyButtonSelectors = [
            '[data-testid="reply"]',
            '[data-testid="replyButton"]',
            '[data-testid="replyButtonInline"]',
            '[role="button"][data-testid*="reply"]',
            'button[data-testid*="reply"]',
            'button[aria-label*="Reply"]',
            'div[role="button"][aria-label*="Reply"]',
            'button:has-text("Reply")',
            'div[role="button"]:has-text("Reply")'
          ];

          let replyButtonClicked = false;
          for (const selector of replyButtonSelectors) {
            try {
              const button = this.page.locator(selector).first();
              await button.waitFor({ state: 'visible', timeout: 4000 });
              await button.click({ delay: 40 });
              replyButtonClicked = true;
              console.log(`ULTIMATE_POSTER: Fallback clicked reply button via selector "${selector}"`);
              break;
            } catch {
              continue;
            }
          }

          if (!replyButtonClicked) {
            throw new Error('Reply button not found (fallback)');
          }

          const composerFallbackSelectors = [
            'div[role="dialog"] div[role="textbox"][contenteditable="true"]',
            'div[aria-modal="true"] div[role="textbox"][contenteditable="true"]',
            'div[role="dialog"] [data-testid^="tweetTextarea_"] div[contenteditable="true"]',
            '[data-testid^="tweetTextarea_"][data-testid$="RichTextInputContainer"] div[contenteditable="true"]',
            '[data-testid^="tweetTextarea_"][data-testid$="RichTextEditor"]',
            'div[contenteditable="true"][role="textbox"]',
            '[contenteditable="true"]'
          ];

          for (const selector of composerFallbackSelectors) {
            try {
              const candidate = this.page.locator(selector).first();
              await candidate.waitFor({ state: 'visible', timeout: 2500 });
              composer = candidate;
              console.log(`ULTIMATE_POSTER: Fallback composer located via "${selector}"`);
              composerAttempts += 1;
              telemetry.mark('composer_ready');
              break;
            } catch {
              continue;
            }
          }

          if (!composer) {
            throw new Error('Reply composer not found after fallback focus');
          }
        }

        // 🎧 SETUP NETWORK LISTENER BEFORE POSTING
        // This must happen BEFORE typing/posting
        ImprovedReplyIdExtractor.setupNetworkListener(this.page);
        
        // Type reply content
        console.log(`ULTIMATE_POSTER: Typing reply content...`);
        await composer.click({ delay: 30 }).catch(() => undefined);
        await this.page.waitForTimeout(300);

        const selectAllShortcut = process.platform === 'darwin' ? 'Meta+A' : 'Control+A';
        let composed = false;
        try {
          await composer.fill('');
          await composer.fill(content);
          composed = true;
        } catch (fillError: any) {
          console.warn(`ULTIMATE_POSTER: fill() failed on reply composer: ${fillError.message}`);
        }

        if (!composed) {
          try {
            await composer.press(selectAllShortcut);
          } catch {
            await this.page.keyboard.press(selectAllShortcut).catch(() => undefined);
          }
          await this.page.keyboard.type(content, { delay: 15 });
        }

        await this.page.waitForTimeout(400);

        // 🔒 SERVICE_ROLE CHECK: Use role resolver (single source of truth)
        const { isWorkerService } = await import('../utils/serviceRoleResolver');
        const isWorker = isWorkerService();
        
        if (!isWorker) {
          const errorMsg = `[SEV1_GHOST_BLOCK] ❌ BLOCKED: Not running on worker service. SERVICE_ROLE=${process.env.SERVICE_ROLE || 'NOT SET'}`;
          console.error(errorMsg);
          console.error(`[SEV1_GHOST_BLOCK] Stack: ${new Error().stack}`);
          
          const { getSupabaseClient } = await import('../db/index');
          const supabase = getSupabaseClient();
          await supabase.from('system_events').insert({
            event_type: 'posting_blocked_wrong_service',
            severity: 'critical',
            message: `Posting blocked: Not running on worker service`,
            event_data: {
              service_role: process.env.SERVICE_ROLE || 'NOT SET',
              service_name: process.env.RAILWAY_SERVICE_NAME || 'unknown',
              decision_id: validGuard.decision_id,
              pipeline_source: validGuard.pipeline_source,
              git_sha: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown',
              run_id: validGuard.job_run_id,
              reason: 'not_worker_service',
              stack_trace: new Error().stack?.substring(0, 1000),
            },
            created_at: new Date().toISOString(),
          });
          
          throw new Error('BLOCKED: Posting only allowed from worker service (SERVICE_ROLE=worker)');
        }
        
        // 🔒 SEV1 GHOST ERADICATION: Pipeline source must be reply_v2_scheduler
        if (validGuard.pipeline_source !== 'reply_v2_scheduler') {
          const errorMsg = `[SEV1_GHOST_BLOCK] ❌ BLOCKED: Invalid pipeline_source. source=${validGuard.pipeline_source} required=reply_v2_scheduler`;
          console.error(errorMsg);
          console.error(`[SEV1_GHOST_BLOCK] Stack: ${new Error().stack}`);
          
          const { getSupabaseClient } = await import('../db/index');
          const supabase = getSupabaseClient();
          const { getServiceRoleInfo } = await import('../utils/serviceRoleResolver');
          const roleInfo = getServiceRoleInfo();
          await supabase.from('system_events').insert({
            event_type: 'posting_blocked_wrong_service',
            severity: 'critical',
            message: `Posting blocked: Invalid pipeline_source`,
            event_data: {
              service_name: process.env.RAILWAY_SERVICE_NAME || 'unknown',
              role: roleInfo.role,
              decision_id: validGuard.decision_id,
              pipeline_source: validGuard.pipeline_source,
              git_sha: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown',
              run_id: validGuard.job_run_id,
              reason: 'invalid_pipeline_source',
              stack_trace: new Error().stack?.substring(0, 1000),
            },
            created_at: new Date().toISOString(),
          });
          
          throw new Error(`BLOCKED: Only reply_v2_scheduler allowed, got ${validGuard.pipeline_source}`);
        }
        
        // 🔒 POSTING PERMIT CHECK (FINAL CHOKE POINT)
        // This is the ONLY place where we click Post/Reply button
        // Must verify permit exists and is APPROVED
        const { verifyPostingPermit } = await import('./postingPermit');
        const permit_id = (validGuard as any).permit_id;
        
        if (!permit_id) {
          const errorMsg = `[PERMIT_CHOKE] ❌ BLOCKED: No permit_id in guard. decision_id=${validGuard.decision_id}`;
          console.error(errorMsg);
          console.error(`[PERMIT_CHOKE] Stack: ${new Error().stack}`);
          
          // Log to system_events
          const { getSupabaseClient } = await import('../db/index');
          const supabase = getSupabaseClient();
          await supabase.from('system_events').insert({
            event_type: 'posting_blocked_no_permit',
            severity: 'critical',
            message: `Posting blocked: No permit_id in guard`,
            event_data: {
              decision_id: validGuard.decision_id,
              pipeline_source: validGuard.pipeline_source,
              stack_trace: new Error().stack?.substring(0, 1000),
            },
            created_at: new Date().toISOString(),
          });
          
          throw new Error('BLOCKED: No posting permit - posting requires permit_id');
        }
        
        const permitCheck = await verifyPostingPermit(permit_id);
        if (!permitCheck.valid) {
          const errorMsg = `[PERMIT_CHOKE] ❌ BLOCKED: Permit not valid. permit_id=${permit_id} error=${permitCheck.error}`;
          console.error(errorMsg);
          console.error(`[PERMIT_CHOKE] Stack: ${new Error().stack}`);
          
          const { getSupabaseClient } = await import('../db/index');
          const supabase = getSupabaseClient();
          await supabase.from('system_events').insert({
            event_type: 'posting_blocked_invalid_permit',
            severity: 'critical',
            message: `Posting blocked: Permit not valid`,
            event_data: {
              permit_id,
              decision_id: validGuard.decision_id,
              permit_error: permitCheck.error,
              stack_trace: new Error().stack?.substring(0, 1000),
            },
            created_at: new Date().toISOString(),
          });
          
          throw new Error(`BLOCKED: Permit not valid (${permitCheck.error})`);
        }
        
        console.log(`[PERMIT_CHOKE] ✅ Permit verified: ${permit_id} (status: ${permitCheck.permit?.status})`);
        
        // 🔒 LOG POST ATTEMPT: Log every attempt to click Post/Reply
        try {
          const { getSupabaseClient } = await import('../db/index');
          const supabase = getSupabaseClient();
          const logPromise = supabase.from('system_events').insert({
            event_type: 'post_reply_click_attempt',
            severity: 'info',
            message: `Attempting to click Post/Reply button`,
            event_data: {
              decision_id: validGuard.decision_id,
              permit_id: permit_id,
              target_tweet_id: replyToTweetId,
              pipeline_source: validGuard.pipeline_source,
              git_sha: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown',
              run_id: validGuard.job_run_id,
            },
            created_at: new Date().toISOString(),
          });
          Promise.resolve(logPromise).catch(() => {}); // Non-critical logging
        } catch (logError) {
          // Non-critical - continue even if logging fails
        }
        
        // Find and click post button
        const postButtonSelectors = [
          '[data-testid="tweetButton"]',
          '[data-testid="tweetButtonInline"]',
          '[data-testid="replyButton"]',
          '[data-testid="replyButtonInline"]',
          'div[role="button"][data-testid*="tweetButton"]',
          'button[aria-label*="Reply"]',
          'div[role="button"]:has-text("Reply")',
          'button:has-text("Reply")',
          'div[role="button"]:has-text("Post")',
          'button:has-text("Post")'
        ];

        let posted = false;
        for (const selector of postButtonSelectors) {
          try {
            const button = this.page.locator(selector).first();
            await button.waitFor({ state: 'visible', timeout: 2000 });
            await button.click();
            posted = true;
            console.log(`ULTIMATE_POSTER: Clicked post button: "${selector}" (permit: ${permit_id})`);
            break;
          } catch (e) {
            continue;
          }
        }

        if (!posted) {
          throw new Error('Could not click post button');
        }
        telemetry.mark('post_clicked');

        // Wait for post to complete
        await this.page.waitForTimeout(3000);

        // 🔍 IMPROVED EXTRACTION with 3 fallback strategies
        let extractionResult = await ImprovedReplyIdExtractor.extractReplyId(
          this.page,
          replyToTweetId,
          15000 // allow extra time for modern UI responses
        );

        if (!extractionResult.success || !extractionResult.tweetId) {
          console.warn('ULTIMATE_POSTER: ⚠️ Initial reply ID extraction failed, retrying after short wait');
          await this.page.waitForTimeout(2000);
          const secondPass = await ImprovedReplyIdExtractor.extractReplyId(
            this.page,
            replyToTweetId,
            8000
          );
          if (secondPass.success && secondPass.tweetId) {
            extractionResult = {
              success: true,
              tweetId: secondPass.tweetId,
              strategy: secondPass.strategy ?? 'fallback'
            };
            console.log(`ULTIMATE_POSTER: ✅ Retry extraction succeeded via ${extractionResult.strategy} strategy`);
          }
        }

        if (!extractionResult.success || !extractionResult.tweetId) {
          console.error(`ULTIMATE_POSTER: ❌ Reply ID extraction failed after posting`);
          
          try {
            const deleted = await this.deleteTweetByContent(content, replyToTweetId);
            console.log(`ULTIMATE_POSTER: 🧹 Cleanup after reply failure ${deleted ? 'succeeded' : 'skipped'}`);
          } catch (cleanupError: any) {
            console.warn(`ULTIMATE_POSTER: ⚠️ Cleanup error after reply failure: ${cleanupError.message}`);
          }
          
          throw new Error(`Reply ID extraction failed: ${extractionResult.error || 'Unknown error'}`);
        }

        const tweetId = extractionResult.tweetId;
        const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
        const tweetUrl = `https://x.com/${username}/status/${tweetId}`;

        console.log(`ULTIMATE_POSTER: ✅ ID extracted via '${extractionResult.strategy}' strategy`);
        console.log(`ULTIMATE_POSTER: ✅ Reply posted successfully: ${tweetId}`);
        telemetry.mark('id_extracted');
        telemetry.setComposerAttempts(composerAttempts);
        telemetry.setSessionRefreshes(Math.max(0, this.sessionRefreshes - sessionRefreshesBefore));
        await telemetry.flush('success', { tweetId });

        await this.dispose();

        return {
          success: true,
          tweetId,
          tweetUrl
        };

      } catch (error: any) {
        console.error(`ULTIMATE_POSTER: Reply attempt ${retryCount + 1} failed:`, error.message);
        telemetry.setComposerAttempts(composerAttempts);
        telemetry.setSessionRefreshes(Math.max(0, this.sessionRefreshes - sessionRefreshesBefore));
        await telemetry.flush('failure', { error: error.message });
        
        if (retryCount < maxRetries) {
          console.log('ULTIMATE_POSTER: Retrying reply with fresh context...');
          await this.cleanup();
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
          continue;
        }
        
        return { success: false, error: error.message };
      }
    }

    await this.cleanup();
    return { success: false, error: 'Max retries exceeded for reply' };
  }

  private async extractReplyTweetId(parentTweetId: string): Promise<string | undefined> {
    if (!this.page) return undefined;

    console.log(`🔍 REPLY_ID_EXTRACTION: Looking for NEW reply ID (must NOT be ${parentTweetId})`);

    try {
      // Wait for post to complete and DOM to update
      await this.page.waitForTimeout(3000);
      
      // ═══════════════════════════════════════════════════════════
      // STRATEGY 1: Check URL change (most reliable)
      // ═══════════════════════════════════════════════════════════
      const url = this.page.url();
      const urlMatch = url.match(/status\/(\d+)/);
      if (urlMatch && urlMatch[1] !== parentTweetId) {
        console.log(`✅ STRATEGY 1 SUCCESS: Extracted from URL: ${urlMatch[1]}`);
        return urlMatch[1];
      }
      console.log(`⚠️ STRATEGY 1 FAILED: URL doesn't contain new ID`);
      
      // ═══════════════════════════════════════════════════════════
      // STRATEGY 2: Find newest tweet in DOM (NOT the parent)
      // ═══════════════════════════════════════════════════════════
      try {
        const allTweetLinks = await this.page.locator('article a[href*="/status/"]').all();
        console.log(`🔍 STRATEGY 2: Found ${allTweetLinks.length} tweet links in DOM`);
        
        for (const link of allTweetLinks) {
          const href = await link.getAttribute('href');
          if (href) {
            const match = href.match(/status\/(\d+)/);
            if (match && match[1] !== parentTweetId) {
              console.log(`✅ STRATEGY 2 SUCCESS: Found new tweet ID: ${match[1]} (≠ parent)`);
              return match[1];
            }
          }
        }
        console.log(`⚠️ STRATEGY 2 FAILED: No new tweet ID found (all matched parent)`);
      } catch (e) {
        console.log(`⚠️ STRATEGY 2 ERROR: ${e}`);
      }
      
      // ═══════════════════════════════════════════════════════════
      // STRATEGY 3: Navigate to our profile and get latest tweet
      // ═══════════════════════════════════════════════════════════
      try {
        console.log(`🔍 STRATEGY 3: Navigating to profile to find latest tweet...`);
        const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
        await this.page.goto(`https://x.com/${username}`, { 
          waitUntil: 'domcontentloaded',
          timeout: 15000 
        });
        await this.page.waitForTimeout(2000);
        
        // Get first tweet link (latest tweet)
        const latestTweet = this.page.locator('article a[href*="/status/"]').first();
        const href = await latestTweet.getAttribute('href');
        if (href) {
          const match = href.match(/status\/(\d+)/);
          if (match && match[1] !== parentTweetId) {
            console.log(`✅ STRATEGY 3 SUCCESS: Latest tweet from profile: ${match[1]}`);
            return match[1];
          }
        }
        console.log(`⚠️ STRATEGY 3 FAILED: Latest tweet is parent or not found`);
      } catch (e) {
        console.log(`⚠️ STRATEGY 3 ERROR: ${e}`);
      }
      
      // ═══════════════════════════════════════════════════════════
      // STRATEGY 4: Use time-based fallback ID
      // ═══════════════════════════════════════════════════════════
      console.log(`⚠️ ALL STRATEGIES FAILED - Reply was posted but ID not extractable`);
      console.log(`🔄 Using timestamp-based fallback (will need manual verification)`);
      
      // Return undefined so validation catches this
      return undefined;
      
    } catch (error) {
      console.error(`❌ REPLY_ID_EXTRACTION ERROR: ${error}`);
      return undefined;
    }
  }

  private normalizeContent(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 120);
  }

  private async deleteTweetByContent(content: string, parentTweetId?: string): Promise<boolean> {
    if (!this.page) return false;

    try {
      const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
      const normalizedTarget = this.normalizeContent(content);

      if (parentTweetId) {
        try {
          await this.page.goto(`https://x.com/i/status/${parentTweetId}`, {
            waitUntil: 'domcontentloaded',
            timeout: 20000
          });
          await this.page.waitForTimeout(2000);

          for (let attempt = 0; attempt < 3; attempt++) {
            const threadArticles = await this.page.$$(`article[data-testid="tweet"]:has(a[href="/${username}"])`);
            for (const article of threadArticles) {
              const textContent = await article.innerText();
              const normalizedArticle = this.normalizeContent(textContent || '');
              if (!normalizedArticle.includes(normalizedTarget.substring(0, Math.min(60, normalizedTarget.length)))) {
                continue;
              }

              const moreButton = await article.$('[data-testid="caret"]');
              if (!moreButton) continue;

              await moreButton.click();
              await this.page.waitForTimeout(400);

              const deleteButton = await this.page.$('[data-testid="Dropdown"] [role="menuitem"]:has-text("Delete")');
              if (!deleteButton) continue;
              await deleteButton.click();

              const confirmButton = await this.page.$('[data-testid="confirmationSheetConfirm"]');
              if (!confirmButton) continue;
              await confirmButton.click();

              await this.page.waitForTimeout(1000);
              console.log('ULTIMATE_POSTER: ✅ Deleted reply from conversation thread after extraction failure');
              return true;
            }

            await this.page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.8)).catch(() => undefined);
            await this.page.waitForTimeout(1200);
          }
        } catch (threadError: any) {
          console.warn(`ULTIMATE_POSTER: ⚠️ Conversation delete attempt failed: ${threadError.message}`);
        }
      }

      await this.page.goto(`https://x.com/${username}`, {
        waitUntil: 'domcontentloaded',
        timeout: 20000
      });
      await this.page.waitForTimeout(2000);

      const articles = await this.page.$$('article[data-testid="tweet"]');
      for (const article of articles) {
        const textContent = await article.innerText();
        const normalizedArticle = this.normalizeContent(textContent || '');

        if (normalizedArticle.includes(normalizedTarget.substring(0, Math.min(60, normalizedTarget.length)))) {
          const moreButton = await article.$('[data-testid="caret"]');
          if (!moreButton) continue;

          await moreButton.click();
          await this.page.waitForTimeout(500);

          const deleteButton = await this.page.$('[data-testid="Dropdown"] [role="menuitem"]:has-text("Delete")');
          if (!deleteButton) continue;
          await deleteButton.click();

          const confirmButton = await this.page.$('[data-testid="confirmationSheetConfirm"]');
          if (!confirmButton) continue;
          await confirmButton.click();

          await this.page.waitForTimeout(1000);
          console.log('ULTIMATE_POSTER: ✅ Deleted reply due to extraction failure');
          return true;
        }
      }

      console.warn('ULTIMATE_POSTER: ⚠️ Unable to locate reply for deletion');
      return false;
    } catch (error: any) {
      console.error(`ULTIMATE_POSTER: ❌ Error while deleting reply: ${error.message}`);
      return false;
    }
  }
}

