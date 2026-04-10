/**
 * Robust Twitter Poster - Compliant and Reliable
 * No anti-bot detection attempts, focuses on stability and compliance
 * 
 * 🔒 SECURITY: All posting MUST go through authorized paths.
 * Direct calls without provenance will be blocked.
 */

import { log } from '../lib/logger';
import { checkActionGate, recordAction } from '../safety/actionGate';
import { isShadowMode } from '../safety/shadowMode';
import { Page, BrowserContext, Locator } from 'playwright';
import { existsSync, writeFileSync, appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { ImprovedReplyIdExtractor } from './ImprovedReplyIdExtractor';
import { BulletproofTweetExtractor } from '../utils/bulletproofTweetExtractor';
import { ensureComposerFocused } from './composerFocus';
import { supaService } from '../lib/supabaseService';
import { ReplyPostingTelemetry } from './ReplyPostingTelemetry';
import { assertValidTweetId, extractTweetIdFromCreateTweetResponse, getCreateTweetResponseStructure } from './tweetIdValidator';
import { humanTypeIntoFocused } from '../infra/playwright/stealth';

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
  readonly action_type?: 'timeline_single' | 'thread' | 'reply'; // For ATTEMPT_SUMMARY observability
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
  action_type?: 'timeline_single' | 'thread' | 'reply';
}): PostingGuard {
  const guard: PostingGuard = {
    __secret: GUARD_SECRET,
    decision_id: params.decision_id,
    pipeline_source: params.pipeline_source,
    job_run_id: params.job_run_id || `job_${Date.now()}`,
    created_at: Date.now(),
    permit_id: params.permit_id,
    action_type: params.action_type,
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
  
  // X_ACTIONS_ENABLED / ActionGate (warmup, cooldown, pacing) — read at check time for controlled-live
  const gateResult = checkActionGate(operation);
  if (!gateResult.allowed) {
    console.log(`[X_ACTIONS] disabled — skipping ${operation} (${gateResult.reason || 'ActionGate'})`);
    return { valid: false, error: gateResult.reason || 'X actions disabled' };
  }
  if (operation === 'postReply') {
    console.log(`[X_ACTIONS] postReply armed: X_ACTIONS_ENABLED=${process.env.X_ACTIONS_ENABLED ?? 'unset'} (ActionGate passed)`);
  }

  // REPLIES_ENABLED=false blocks ALL reply posting at this final chokepoint
  if (operation === 'postReply' && process.env.REPLIES_ENABLED === 'false') {
    console.warn(`[KILLSWITCH] 🛑 REPLIES_ENABLED=false - Blocking ${operation}`);
    return { valid: false, error: 'REPLIES_ENABLED=false - Reply posting disabled at killswitch' };
  }
  
  // POSTING_ENABLED: Default OFF - only allow if explicitly 'true'
  if (process.env.POSTING_ENABLED !== 'true') {
    console.warn(`[KILLSWITCH] 🛑 POSTING_ENABLED not set to 'true' - Blocking ${operation}`);
    return { valid: false, error: 'POSTING_ENABLED must be explicitly set to "true" to enable posting' };
  }
  
  // DRAIN_QUEUE=true also blocks posting (posts should be marked skipped upstream)
  if (process.env.DRAIN_QUEUE === 'true') {
    console.warn(`[KILLSWITCH] 🛑 DRAIN_QUEUE=true - Blocking ${operation}`);
    return { valid: false, error: 'DRAIN_QUEUE=true - Queue draining, posting blocked' };
  }
  
  // 🛡️ SHADOW_MODE: Bypass is NEVER allowed when read-only (non-negotiable invariant)
  if (isShadowMode()) {
    console.warn(`[KILLSWITCH] 🛑 SHADOW_MODE=read-only - ALLOW_POSTING_BYPASS ignored`);
    return { valid: false, error: 'SHADOW_MODE=read-only - bypass disabled' };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  
  // 🚨 BYPASS KILLSWITCH: Allow bypass during testing if explicitly set (only when SHADOW_MODE=false)
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
  /** When true, submit was not performed (PROOF_SUBMIT_MODE=dry); no tweetId. */
  dryRunReady?: boolean;
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
  
  // PHASE 3.5: Real tweet ID extraction (validated from CreateTweet GraphQL response)
  private validatedTweetId: string | null = null;
  private capturedTweetId: string | null = null;
  private networkResponseListener: ((response: any) => void) | null = null;
  private createTweetResponsePromise: Promise<string | null> | null = null;
  /** Last CreateTweet response body (for structural inspection when id not parsed). No sensitive dump. */
  private lastCreateTweetResponseBody: any = null;
  /** Selector that matched in getComposer (for dry-run reuse). */
  private lastComposerSelectorUsed: string | null = null;
  /** PROOF dry-run: provenance from successful typing stage. */
  private typingProvenance: { selector: string; focusInComposer: boolean; textSnapshot: string } | null = null;
  /** Set true when closeAnyModal ran before submit (live only). For diagnostics. */
  private lastCleanupRanBeforeSubmit = false;
  /** One-line attempt observability: set in attemptPost/postReply, logged at end of postTweet/postReply. */
  private lastAttemptSummary: { typingMode?: string; clickDelayMs?: number; preSubmitDwellMs?: number } = {};

  private logAttemptSummary(guard: PostingGuard, contentLength: number, opts?: { targetTweetId?: string; platformError?: string }): void {
    const actionType = guard.action_type ?? 'timeline_single';
    const parts = [
      `decision_id=${guard.decision_id}`,
      `action_type=${actionType}`,
      `content_len=${contentLength}`,
    ];
    if (opts?.targetTweetId != null) parts.push(`target_tweet_id=${opts.targetTweetId}`);
    if (this.lastAttemptSummary.typingMode != null) parts.push(`typing_mode=${this.lastAttemptSummary.typingMode}`);
    if (this.lastAttemptSummary.preSubmitDwellMs != null) parts.push(`pre_submit_dwell_ms=${this.lastAttemptSummary.preSubmitDwellMs}`);
    if (this.lastAttemptSummary.clickDelayMs != null) parts.push(`click_delay_ms=${this.lastAttemptSummary.clickDelayMs}`);
    if (opts?.platformError != null) parts.push(`platform_error=${opts.platformError.replace(/\s+/g, ' ').slice(0, 120)}`);
    console.log(`[ATTEMPT_SUMMARY] ${parts.join(' ')}`);
  }

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
    
    // Extract decision_id and proof_tag for logging
    const decisionId = (validGuard as any)?.decision_id || 'unknown';
    const proofTag = (validGuard as any)?.proof_tag || null;
    const logPrefix = proofTag ? `[PROOF:${proofTag}]` : `[DECISION:${decisionId}]`;
    
    // 📊 COMPREHENSIVE LOGGING: Build fingerprint for audit trail
    const BUILD_SHA = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || 'dev';
    const DB_URL = process.env.DATABASE_URL || '';
    const DB_ENV_FINGERPRINT = require('crypto').createHash('md5').update(DB_URL).digest('hex').substring(0, 8);
    
    console.log(`${logPrefix} [POST_TWEET] 🔐 Authorized via guard: decision_id=${validGuard.decision_id}`);
    console.log(`${logPrefix} [POST_TWEET] 📊 AUDIT_TRAIL: decision_id=${validGuard.decision_id} pipeline_source=${validGuard.pipeline_source} job_run_id=${validGuard.job_run_id} build_sha=${BUILD_SHA} db_env=${DB_ENV_FINGERPRINT}`);
    console.log(`${logPrefix} [TIMEOUT_OBSERVABILITY] step=postTweet_start decision_id=${decisionId} content_length=${content.length}`);
    
    // Helper function to extract endpoint from error
    const extractEndpointFromError = (error: any): string => {
      const errorMessage = error?.message || error?.toString() || '';
      // Try to extract endpoint from ApiError messages
      const match = errorMessage.match(/https?:\/\/[^\s]+/);
      if (match) {
        try {
          const url = new URL(match[0]);
          return url.pathname || 'unknown';
        } catch {
          return 'unknown';
        }
      }
      // Check for common endpoints in error messages
      if (errorMessage.includes('Viewer')) return '/i/api/graphql/Viewer';
      if (errorMessage.includes('graphql')) return '/i/api/graphql';
      return 'unknown';
    };
    
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
        
          if (result.dryRunReady) {
            console.log('[ULTIMATE_POSTER] DRY_RUN_TERMINAL_SUCCESS');
            this.logAttemptSummary(validGuard, content.length);
            return { success: true, dryRunReady: true };
          }
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
          
          // 🔧 TASK: Wrap cleanup in try/catch so it cannot prevent DB writes
          try {
            await this.dispose();
          } catch (cleanupError: any) {
            // 🔧 TASK: If waitForResponse fails after tweet_id exists, log WARN but keep success
            console.warn(`[POST_TWEET] ⚠️ Cleanup error (non-critical): ${cleanupError.message}`);
            console.warn(`[POST_TWEET] ⚠️ Tweet was posted successfully (tweet_id=${canonical.tweetId}), cleanup error is non-blocking`);
            // Don't throw - tweet is posted, cleanup is best-effort
          }
          
          recordAction();
          this.logAttemptSummary(validGuard, content.length);
          return { success: true, tweetId: canonical.tweetId, tweetUrl: canonical.tweetUrl };
          
        } catch (error) {
          log({ op: 'ultimate_poster_attempt', outcome: 'error', attempt: retryCount + 1, error: error.message });
          
          const isRecoverable = this.isRecoverableError(error.message);
          const is429 = this.is429Error(error);
          
          // 🔒 GLOBAL CIRCUIT BREAKER: Record 429 hits to prevent executor thrashing
          if (is429) {
            const endpoint = extractEndpointFromError(error);
            const guardDecisionId = (validGuard as any)?.decision_id;
            const { recordRateLimitHit } = await import('../utils/rateLimitCircuitBreaker');
            // Phase 5A.2: Record with source_tag
            await recordRateLimitHit(endpoint, 429, 'HTTP-429', guardDecisionId, undefined, 'HTTP-429-DETECTED');
          }
          
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
          this.logAttemptSummary(validGuard, content.length, { platformError: (error as Error)?.message });
          await this.captureFailureArtifacts(error.message, (validGuard as any)?.decision_id);
          await this.cleanup();
          return { success: false, error: error.message };
        }
      }

      const ms = Date.now() - startTime;
      log({ op: 'ultimate_poster_complete', outcome: 'max_retries', attempts: retryCount, ms });
      this.logAttemptSummary(validGuard, content.length, { platformError: 'Max retries exceeded' });
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
    // Proof-only failures (e.g. PROOF_DRY_RUN_NOT_READY) must never trigger retries
    if (errorMessage?.includes('PROOF_')) return false;
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
   * Supports CDP mode when RUNNER_MODE=true and RUNNER_BROWSER=cdp
   */
  private async ensureContext(): Promise<void> {
    if (!this.page) {
      const runnerMode = process.env.RUNNER_MODE === 'true';
      const runnerBrowser = process.env.RUNNER_BROWSER || 'not set';
      
      // CDP mode: use same UnifiedBrowserPool as rest of app (pool connects to CDP when RUNNER_BROWSER=cdp)
      if (runnerMode && runnerBrowser === 'cdp') {
        const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
        const browserPool = UnifiedBrowserPool.getInstance();
        const operationName = this.purpose === 'reply' ? 'reply_posting' : 'tweet_posting';
        console.log(`[POSTING] Using CDP mode via UnifiedBrowserPool (operation: ${operationName})`);
        try {
          this.page = await browserPool.withContext(
            operationName,
            async (context) => context.newPage(),
            0
          );
          this.page.on('pageerror', (error) => {
            console.error('ULTIMATE_POSTER: Page error:', error.message);
          });
          console.log('[POSTING] ✅ Page acquired from pool (CDP)');
        } catch (cdpError: any) {
          console.error(`[POSTING] ❌ CDP connection failed: ${cdpError.message}`);
          throw new Error(`Failed to connect to CDP: ${cdpError.message}`);
        }
      } else {
        // Playwright mode: use UnifiedBrowserPool
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

    // 🔒 PROOF MODE: Verify authenticated account matches expected before posting
    const proofMode = process.env.PROOF_MODE === 'true';
    const proofExpectedAccount = process.env.PROOF_EXPECTED_ACCOUNT?.trim();
    if (proofMode && proofExpectedAccount && this.page) {
      const { checkWhoami } = await import('../utils/whoamiAuth');
      const whoami = await checkWhoami(this.page);
      const loggedHandle = whoami.handle ? whoami.handle.replace(/^@/, '').toLowerCase() : null;
      const expectedNormalized = proofExpectedAccount.replace(/^@/, '').toLowerCase();
      console.log(`[OPS_ORIGINAL_POST_PROOF] Preflight: authenticated_account=${loggedHandle ?? 'null'} expected=${expectedNormalized} logged_in=${whoami.logged_in}`);
      if (!whoami.logged_in || !loggedHandle) {
        throw new Error(`PROOF_ACCOUNT_PREFLIGHT_FAIL: Not logged in or could not detect handle (reason=${whoami.reason})`);
      }
      if (loggedHandle !== expectedNormalized) {
        throw new Error(`PROOF_ACCOUNT_MISMATCH: Logged-in account @${loggedHandle} does not match expected @${expectedNormalized}. Proof requires PROOF_EXPECTED_ACCOUNT=${proofExpectedAccount}.`);
      }
      console.log(`[OPS_ORIGINAL_POST_PROOF] Preflight: account OK (@${loggedHandle})`);
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
      const decisionId = (validGuard as any)?.decision_id || 'unknown';
      const proofTag = (validGuard as any)?.proof_tag || null;
      const logPrefix = proofTag ? `[PROOF:${proofTag}]` : `[DECISION:${decisionId}]`;
      
      console.log(`${logPrefix} ULTIMATE_POSTER: Navigating to Twitter...`);
      console.log(`${logPrefix} [TIMEOUT_OBSERVABILITY] step=before_navigation decision_id=${decisionId}`);
      
      // Navigate with domcontentloaded instead of networkidle
      await this.page!.goto('https://x.com/home', { 
        waitUntil: 'domcontentloaded', 
        timeout: 45000 
      });
      
      console.log(`${logPrefix} [TIMEOUT_OBSERVABILITY] step=after_navigation decision_id=${decisionId} url=${this.page!.url()}`);

      // Wait for navigation to complete and UI to be ready
      console.log(`${logPrefix} ULTIMATE_POSTER: Waiting for UI to be ready...`);
      
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

      // PROOF_MODE: Dwell after page ready then short scroll before composing (bounded, logged)
      const proofModeNav = process.env.PROOF_MODE === 'true' && (validGuard as any)?.proof_tag;
      if (proofModeNav) {
        const dwellMs = 1500 + Math.floor(Math.random() * (4500 - 1500 + 1));
        console.log(`[ULTIMATE_POSTER] PROOF_MODE: post-ready dwell ${dwellMs}ms (1.5–4.5s)`);
        await this.page!.waitForTimeout(dwellMs);
        const scrollPx = 80 + Math.floor(Math.random() * (280 - 80 + 1));
        const scrollDir = Math.random() < 0.5 ? 1 : -1;
        await this.page!.evaluate(({ px, dir }) => { window.scrollBy(0, dir * px); }, { px: scrollPx, dir: scrollDir });
        console.log(`[ULTIMATE_POSTER] PROOF_MODE: short scroll ${scrollDir * scrollPx}px on home feed`);
      }
    });

    // Close any modals/overlays that might interfere
    await this.closeAnyModal();

    // Stage 2: Typing
    const proofMode = process.env.PROOF_MODE === 'true';
    const jitter = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
    await logStage('typing', async () => {
      const decisionId = (validGuard as any)?.decision_id || 'unknown';
      const proofTag = (validGuard as any)?.proof_tag || null;
      const logPrefix = proofTag ? `[PROOF:${proofTag}]` : `[DECISION:${decisionId}]`;
      
      // Find and interact with composer
      console.log(`${logPrefix} [TIMEOUT_OBSERVABILITY] step=before_get_composer decision_id=${decisionId}`);
      const composer = await this.getComposer();
      console.log(`${logPrefix} [TIMEOUT_OBSERVABILITY] step=after_get_composer decision_id=${decisionId}`);
      if (proofMode) await this.page!.waitForTimeout(jitter(50, 200));
      
      console.log(`${logPrefix} ULTIMATE_POSTER: Inserting content...`);
      console.log(`${logPrefix} [TIMEOUT_OBSERVABILITY] step=before_click_compose decision_id=${decisionId}`);
      const clickDelayMs = proofMode ? jitter(60, 120) : 60;
      const useFocusPath = proofMode && Math.random() < 0.5;
      if (useFocusPath) {
        await composer.focus();
        console.log(`[ULTIMATE_POSTER] PROOF_MODE: composer focus path (no click)`);
        await this.page!.waitForTimeout(jitter(200, 450));
      } else {
        await composer.click({ delay: clickDelayMs });
      }
      await this.page!.waitForTimeout(proofMode ? jitter(400, 600) : 500);
      console.log(`${logPrefix} [TIMEOUT_OBSERVABILITY] step=after_click_compose decision_id=${decisionId}`);
      if (proofMode) await this.page!.waitForTimeout(jitter(50, 200));
      
      // 🆕 IMPROVED: Clear any existing content with better handling
      try {
        await composer.fill(''); // Clear first
        await this.page!.waitForTimeout(proofMode ? jitter(250, 400) : 300);
      } catch (clearError: any) {
        console.warn(`ULTIMATE_POSTER: Clear failed (non-critical): ${clearError.message}`);
        // Continue anyway - content might be empty
      }
      if (proofMode) await this.page!.waitForTimeout(jitter(50, 200));
      
      // Human-like typing for all content (stealth: variable delays + thinking pauses)
      console.log(`ULTIMATE_POSTER: humanTypeIntoFocused for ${content.length} char content`);
      const typeTimeout = Math.max(60000, content.length * 250); // generous timeout based on content length
      await Promise.race([
        humanTypeIntoFocused(this.page!, content),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`humanType timeout after ${typeTimeout}ms`)), typeTimeout)),
      ]);
      console.log('ULTIMATE_POSTER: Content typed (human-like)');

      // Composer-state hardening: verify typed content is present; if not, dispatch minimal input so button may enable
      const verifyText = await composer.textContent();
      const prefix = content.slice(0, 30);
      const hasContent = verifyText && verifyText.trim().length > 0;
      const hasPrefix = prefix.length > 0 && verifyText?.includes(prefix.slice(0, 15));
      if (!hasContent || !hasPrefix) {
        console.log(`[ULTIMATE_POSTER] Composer verify: hasContent=${!!hasContent} hasPrefix=${!!hasPrefix} len=${verifyText?.length ?? 0} — dispatching input/change`);
        await composer.evaluate((el) => {
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await this.page!.waitForTimeout(200);
      }

      // PROOF dry-run: persist typing-stage composer provenance for layered detection
      if (proofMode) {
        const focusInComposer = await composer.evaluate((el) => document.activeElement === el).catch(() => false);
        const textSnapshot = (await composer.textContent())?.trim().slice(0, 200) || '';
        this.typingProvenance = {
          selector: this.lastComposerSelectorUsed || 'unknown',
          focusInComposer,
          textSnapshot,
        };
      }
      this.lastAttemptSummary = { typingMode: 'human_like_typing', clickDelayMs };
    });

    // In live mode, only run modal/overlay cleanup before submit when a blocking overlay is actually detected (avoids nuking compose UI in #layers).
    const proofSubmitModePre = process.env.PROOF_SUBMIT_MODE?.toLowerCase().trim() || 'live';
    if (proofSubmitModePre !== 'dry') {
      const blockingOverlay = await this.hasBlockingOverlay();
      if (blockingOverlay) {
        this.lastCleanupRanBeforeSubmit = true;
        await this.closeAnyModal();
      } else {
        this.lastCleanupRanBeforeSubmit = false;
      }
    }
    // PROOF_MODE: 200–600 ms pause after typing before submit (bounded, logged)
    let preSubmitDwellMs = 50;
    if (proofMode) {
      const afterTypeMs = jitter(200, 600);
      preSubmitDwellMs = afterTypeMs;
      console.log(`[ULTIMATE_POSTER] PROOF_MODE: post-typing pause ${afterTypeMs}ms before submit`);
      await this.page!.waitForTimeout(afterTypeMs);
    } else {
      await this.page!.waitForTimeout(50);
    }
    this.lastAttemptSummary = { ...this.lastAttemptSummary, preSubmitDwellMs };

    // Stage 3: Submit
    let result: PostResult;
    const submitStartTime = Date.now();
    const decisionId = (validGuard as any)?.decision_id || 'unknown';
    const proofTag = (validGuard as any)?.proof_tag || null;
    const logPrefix = proofTag ? `[PROOF:${proofTag}]` : `[DECISION:${decisionId}]`;
    
    console.log(`${logPrefix} [ULTIMATE_POSTER] 🎯 Stage: submit - Starting`);
    console.log(`${logPrefix} [TIMEOUT_OBSERVABILITY] step=before_submit decision_id=${decisionId}`);

    // PROOF_SUBMIT_MODE=dry: short-circuit BEFORE any CreateTweet setup, network wait, or click
    const proofSubmitMode = process.env.PROOF_SUBMIT_MODE?.toLowerCase().trim() || 'live';
    if (proofSubmitMode === 'dry' && proofTag && this.page) {
      const dryResult = await this.runDrySubmitReadinessCheck(decisionId, proofTag, content ?? '');
      if (dryResult.ready) {
        console.log(`[DRY_RUN_READY_TO_SUBMIT] decision_id=${decisionId} proof_tag=${proofTag} artifact=${dryResult.artifactPath}`);
        return { success: true, dryRunReady: true };
      }
      console.log(`[DRY_RUN_NOT_READY] decision_id=${decisionId} reason=${dryResult.reason} artifact=${dryResult.artifactPath}`);
      throw new Error(`PROOF_DRY_RUN_NOT_READY: ${dryResult.reason} (artifact: ${dryResult.artifactPath})`);
    }

    try {
      result = await this.postWithNetworkVerification(validGuard, content);
      const submitDuration = Date.now() - submitStartTime;
      console.log(`${logPrefix} [ULTIMATE_POSTER] ✅ Stage: submit - Completed in ${submitDuration}ms`);
      console.log(`${logPrefix} [TIMEOUT_OBSERVABILITY] step=after_submit decision_id=${decisionId} success=true`);
    } catch (submitError: any) {
      const submitDuration = Date.now() - submitStartTime;
      console.error(`${logPrefix} [ULTIMATE_POSTER] ❌ Stage: submit - Failed after ${submitDuration}ms: ${submitError.message}`);
      console.error(`${logPrefix} [TIMEOUT_OBSERVABILITY] step=after_submit decision_id=${decisionId} success=false error=${submitError.message}`);
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

  /** Returns true only if a blocking overlay (dialog/aria-modal in #layers) is present. Used to avoid running aggressive cleanup when compose UI is in layers. */
  private async hasBlockingOverlay(): Promise<boolean> {
    if (!this.page) return false;
    return this.page.evaluate(() => {
      const layers = document.querySelectorAll('div[id="layers"] div[role="dialog"], div[id="layers"] div[aria-modal="true"]');
      return layers.length > 0;
    });
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

    // Only press Escape to dismiss; do NOT clear #layers or remove overlay divs (compose UI lives in layers).
    try {
      await this.page!.keyboard.press('Escape');
      await this.page!.waitForTimeout(200);
    } catch (e: any) {
      console.log('ULTIMATE_POSTER: Escape key failed:', e.message);
    }
  }

  private async getComposer(): Promise<any> {
    // 🔧 TASK: Resilient composer acquisition with retries, screenshots, and better logging
    // 🔧 FIX: Ensure page is not null before attempting to find composer
    if (!this.page) {
      throw new Error('Page is null - cannot find composer. Page may have been released prematurely.');
    }
    
    const composerSelectors = [
      'div[contenteditable="true"][role="textbox"]',                      // Primary - modern Twitter
      'div[role="textbox"][contenteditable="true"]',                      // Alternative order
      '[data-testid="tweetTextarea_0"]',                                  // Fallback 1
      'div[data-testid="tweetTextarea_0"] div[contenteditable="true"]',   // Nested contenteditable
      'div[aria-label*="Post text"]',                                     // Fallback 2
      'div[aria-label*="What is happening"]',                             // Fallback 3
      'div[aria-label*="What\'s happening"]',                             // Fallback 4
      'div[contenteditable="true"]',                                      // Fallback 5 - any contenteditable
      '.public-DraftEditor-content[contenteditable="true"]',             // Fallback 6 - Draft.js
      '[data-testid="tweetTextarea_0RichTextInputContainer"] div[contenteditable="true"]', // Rich text container
      'div[data-testid^="tweetTextarea_"] div[contenteditable="true"]',   // Any tweetTextarea variant
    ];

    const maxRetries = 3;
    const retryDelay = 1000; // 1 second between retries

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // 🔧 FIX: Check page is still valid before each attempt
      if (!this.page) {
        throw new Error('Page became null during composer search');
      }
      
      for (const selector of composerSelectors) {
        try {
          console.log(`ULTIMATE_POSTER: Testing composer selector: ${selector} (attempt ${attempt}/${maxRetries})`);
          
          // 🔧 FIX: Check page is still valid before each selector attempt
          if (!this.page) {
            throw new Error('Page is null');
          }
          
          // Try to find element with visibility check
          const element = await this.page.waitForSelector(selector, { 
            state: 'visible', 
            timeout: 10000  // 10s per selector attempt
          });
          
          if (element) {
            // 🔧 TASK: Validate visible + enabled
            const isVisible = await element.isVisible().catch(() => false);
            const isEnabled = await element.evaluate((el: any) => {
              return !el.disabled && 
                     !el.getAttribute('aria-disabled') && 
                     el.offsetParent !== null; // Element is in DOM and visible
            }).catch(() => false);
            
            if (!isVisible || !isEnabled) {
              console.log(`ULTIMATE_POSTER: ⚠️ Element found but not visible/enabled: ${selector} (visible=${isVisible}, enabled=${isEnabled})`);
              continue;
            }
            
            // 🔧 TASK: Verify element is actually editable
            const isEditable = await element.evaluate((el: any) => 
              el.contentEditable === 'true' || el.tagName === 'TEXTAREA'
            ).catch(() => false);
            
            if (isEditable) {
              this.lastComposerSelectorUsed = selector;
              console.log(`ULTIMATE_POSTER: ✅ Found editable composer with: ${selector}`);
              console.log(`[COMPOSER_SELECTOR_MATCH] selector=${selector} attempt=${attempt}`);
              return element;
            } else {
              console.log(`ULTIMATE_POSTER: ⚠️ Element found but not editable: ${selector}`);
              continue;
            }
          }
        } catch (e: any) {
          // 🔧 FIX: Check if error is due to null page
          if (!this.page) {
            throw new Error('Page became null during selector attempt');
          }
          console.log(`ULTIMATE_POSTER: Selector failed: ${selector} - ${e.message}`);
          continue;
        }
      }
      
      // 🔧 TASK: Retry with delay if not found on this attempt
      if (attempt < maxRetries) {
        // 🔧 FIX: Check page is still valid before retry
        if (!this.page) {
          throw new Error('Page became null before retry');
        }
        
        console.log(`ULTIMATE_POSTER: ⚠️ No composer found on attempt ${attempt}, retrying in ${retryDelay}ms...`);
        await this.page.waitForTimeout(retryDelay);
        
        // Try pressing 'N' to open composer (keyboard shortcut)
        try {
          if (!this.page) {
            throw new Error('Page is null');
          }
          await this.page.keyboard.press('Escape'); // Close any modals first
          await this.page.waitForTimeout(300);
          await this.page.keyboard.press('KeyN'); // Open composer
          await this.page.waitForTimeout(1000);
          console.log(`ULTIMATE_POSTER: ⌨️ Pressed 'N' to open composer`);
        } catch (keyError: any) {
          console.log(`ULTIMATE_POSTER: ⚠️ Keyboard shortcut failed: ${keyError.message}`);
        }
      }
    }

    // 🔧 TASK: If still failing, capture screenshot and DOM excerpt
    if (!this.page) {
      throw new Error('Page is null - cannot capture debug info');
    }
    
    const debugDir = join(process.env.RUNNER_PROFILE_DIR || process.cwd(), 'debug');
    try {
      mkdirSync(debugDir, { recursive: true });
      
      const timestamp = Date.now();
      const screenshotPath = join(debugDir, `composer-not-found-${timestamp}.png`);
      await this.page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`[COMPOSER_NOT_FOUND] Screenshot saved: ${screenshotPath}`);
      
      // Capture DOM excerpt around expected compose container
      const domExcerpt = await this.page.evaluate(() => {
        const composeAreas = [
          document.querySelector('[data-testid="tweetTextarea_0"]'),
          document.querySelector('div[contenteditable="true"][role="textbox"]'),
          document.querySelector('div[role="textbox"]'),
          document.querySelector('div[contenteditable="true"]'),
        ].filter(Boolean);
        
        const excerpts: string[] = [];
        composeAreas.forEach((el: any) => {
          if (el) {
            const parent = el.parentElement;
            if (parent) {
              excerpts.push(`Found: ${el.tagName} ${el.className || ''} ${el.getAttribute('data-testid') || ''}`);
              excerpts.push(`Parent: ${parent.tagName} ${parent.className || ''}`);
              excerpts.push(`HTML: ${parent.outerHTML.substring(0, 500)}`);
            }
          }
        });
        
        return excerpts.length > 0 ? excerpts.join('\n') : 'No compose areas found in DOM';
      });
      
      const domPath = join(debugDir, `composer-dom-${timestamp}.txt`);
      writeFileSync(domPath, `COMPOSER_NOT_FOUND Debug Info\n${'='.repeat(50)}\n\nAttempted Selectors:\n${composerSelectors.map(s => `  - ${s}`).join('\n')}\n\nDOM Excerpt:\n${domExcerpt}\n`);
      console.log(`[COMPOSER_NOT_FOUND] DOM excerpt saved: ${domPath}`);
      
      console.log(`[COMPOSER_NOT_FOUND] Attempted selectors: ${composerSelectors.join(', ')}`);
    } catch (debugError: any) {
      console.error(`[COMPOSER_NOT_FOUND] Failed to capture debug info: ${debugError.message}`);
    }

    throw new Error('No editable composer found with any selector - Twitter UI may have changed');
  }

  /** PROOF_SUBMIT_MODE=dry only. Layered composer detection (typing selector first, then full list, then broad). Rich artifact + precise reason. */
  private async runDrySubmitReadinessCheck(
    decisionId: string,
    proofTag: string,
    content: string
  ): Promise<{ ready: boolean; reason?: string; artifactPath: string }> {
    if (!this.page) return { ready: false, reason: 'no_page', artifactPath: '' };
    const debugDir = join(process.env.RUNNER_PROFILE_DIR || process.cwd(), 'debug');
    mkdirSync(debugDir, { recursive: true });
    const contentPrefix = (content || '').slice(0, 40);
    const typingSelector = this.typingProvenance?.selector || null;
    const composerSelectorsOrdered = [
      ...(typingSelector && typingSelector !== 'unknown' ? [typingSelector] : []),
      'div[contenteditable="true"][role="textbox"]',
      'div[role="textbox"][contenteditable="true"]',
      '[data-testid="tweetTextarea_0"]',
      'div[data-testid="tweetTextarea_0"] div[contenteditable="true"]',
      'div[contenteditable="true"]',
      '[role="textbox"]',
    ];
    const buttonSelectors = [
      '[data-testid="tweetButtonInline"]:not([aria-disabled="true"])',
      '[data-testid="tweetButton"]:not([aria-disabled="true"])',
      'button[data-testid="tweetButtonInline"]:not([disabled])',
      'button[data-testid="tweetButton"]:not([disabled])',
      'div[role="button"][data-testid="tweetButtonInline"]',
      'div[role="button"][data-testid="tweetButton"]',
      '[aria-label*="Post"]',
    ];
    console.log('[DRY_RUN_DIAG] entering page.evaluate readiness probe');
    const evalArgs = {
      contentPrefix,
      composerSelectorsOrdered: [...new Set(composerSelectorsOrdered)],
      buttonSelectors,
    };
    const diagnostics = await this.page.evaluate(function (args) {
      var url = window.location.href;
      var activeEl = document.activeElement;
      var activeSummary = 'none';
      if (activeEl) {
        var tag = (activeEl.tagName && activeEl.tagName.toLowerCase) ? activeEl.tagName.toLowerCase() : '?';
        var role = activeEl.getAttribute ? activeEl.getAttribute('role') : '';
        var testid = activeEl.getAttribute ? activeEl.getAttribute('data-testid') : '';
        activeSummary = (tag + ' ' + (role || '') + ' ' + (testid || '')).trim();
      }
      var contenteditableCount = document.querySelectorAll('div[contenteditable="true"]').length;
      var roleTextboxCount = document.querySelectorAll('[role="textbox"]').length;
      var allCandidates = [];
      var seen = [];
      var selList = args.composerSelectorsOrdered || [];
      for (var si = 0; si < selList.length; si++) {
        var sel = selList[si];
        try {
          var nodes = document.querySelectorAll(sel);
          for (var ni = 0; ni < nodes.length; ni++) {
            var node = nodes[ni];
            var nel = node;
            if (!node || (((nel as any).contentEditable !== 'true' && (!node.getAttribute || node.getAttribute('role') !== 'textbox') && node.tagName !== 'TEXTAREA'))) continue;
            var skip = false;
            for (var s = 0; s < seen.length; s++) { if (seen[s] === node) { skip = true; break; } }
            if (skip) continue;
            seen.push(node);
            var text = (node.textContent || '').trim();
            var rect = node.getBoundingClientRect ? node.getBoundingClientRect() : null;
            var w = rect ? rect.width : 0;
            var h = rect ? rect.height : 0;
            allCandidates.push({
              identity: sel,
              role: node.getAttribute ? (node.getAttribute('role') || '') : '',
              contenteditable: node.getAttribute ? (node.getAttribute('contenteditable') || '') : '',
              visible: (node as any).offsetParent !== null && w > 0 && h > 0,
              disabled: !!(node as any).disabled,
              ariaDisabled: node.getAttribute ? (node.getAttribute('aria-disabled') || '') : '',
              textLength: text.length,
              textPreview120: text.slice(0, 120),
              rect: rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null,
              isActive: document.activeElement === node,
            });
          }
        } catch (e) {}
      }
      var ceNodes = document.querySelectorAll('div[contenteditable="true"]');
      for (var cei = 0; cei < ceNodes.length; cei++) {
        var node = ceNodes[cei];
        var skip = false;
        for (var s = 0; s < seen.length; s++) { if (seen[s] === node) { skip = true; break; } }
        if (skip) continue;
        seen.push(node);
        var text = (node.textContent || '').trim();
        var rect = node.getBoundingClientRect ? node.getBoundingClientRect() : null;
        var w = rect ? rect.width : 0;
        var h = rect ? rect.height : 0;
        allCandidates.push({
          identity: 'div[contenteditable="true"]',
          role: node.getAttribute ? (node.getAttribute('role') || '') : '',
          contenteditable: node.getAttribute ? (node.getAttribute('contenteditable') || '') : '',
          visible: (node as any).offsetParent !== null && w > 0 && h > 0,
          disabled: !!(node as any).disabled,
          ariaDisabled: node.getAttribute ? (node.getAttribute('aria-disabled') || '') : '',
          textLength: text.length,
          textPreview120: text.slice(0, 120),
          rect: rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null,
          isActive: document.activeElement === node,
        });
      }
      var rtNodes = document.querySelectorAll('[role="textbox"]');
      for (var rti = 0; rti < rtNodes.length; rti++) {
        var node = rtNodes[rti];
        var skip = false;
        for (var s = 0; s < seen.length; s++) { if (seen[s] === node) { skip = true; break; } }
        if (skip) continue;
        seen.push(node);
        var text = (node.textContent || '').trim();
        var rect = node.getBoundingClientRect ? node.getBoundingClientRect() : null;
        var w = rect ? rect.width : 0;
        var h = rect ? rect.height : 0;
        allCandidates.push({
          identity: '[role="textbox"]',
          role: node.getAttribute ? (node.getAttribute('role') || '') : '',
          contenteditable: node.getAttribute ? (node.getAttribute('contenteditable') || '') : '',
          visible: (node as any).offsetParent !== null && w > 0 && h > 0,
          disabled: !!(node as any).disabled,
          ariaDisabled: node.getAttribute ? (node.getAttribute('aria-disabled') || '') : '',
          textLength: text.length,
          textPreview120: text.slice(0, 120),
          rect: rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null,
          isActive: document.activeElement === node,
        });
      }

      var best = null;
      var bestScore = -1;
      var prefix20 = (args.contentPrefix || '').slice(0, 20);
      for (var ci = 0; ci < allCandidates.length; ci++) {
        var c = allCandidates[ci];
        if (!c.visible || (c.contenteditable !== 'true' && c.role !== 'textbox')) continue;
        var score = 0;
        if (c.textLength > 0) score += 10;
        if (prefix20 && c.textPreview120.indexOf(prefix20) !== -1) score += 20;
        if (c.isActive) score += 5;
        if (c.textLength > 50) score += 5;
        if (score > bestScore) {
          bestScore = score;
          best = { identity: c.identity, role: c.role, contenteditable: c.contenteditable, visible: c.visible, disabled: c.disabled, ariaDisabled: c.ariaDisabled, textLength: c.textLength, textPreview120: c.textPreview120, rect: c.rect, isActive: c.isActive, index: ci };
        }
      }
      if (!best && allCandidates.length > 0) {
        for (var fi = 0; fi < allCandidates.length; fi++) {
          var fc = allCandidates[fi];
          if (fc.visible && (fc.contenteditable === 'true' || fc.role === 'textbox')) {
            best = { identity: fc.identity, role: fc.role, contenteditable: fc.contenteditable, visible: fc.visible, disabled: fc.disabled, ariaDisabled: fc.ariaDisabled, textLength: fc.textLength, textPreview120: fc.textPreview120, rect: fc.rect, isActive: fc.isActive, index: fi };
            bestScore = 0;
            break;
          }
        }
      }
      var chosenReason = 'first_visible_editable';
      if (bestScore >= 20) chosenReason = 'content_prefix_match';
      else if (bestScore >= 10) chosenReason = 'has_content';
      else if (bestScore >= 5) chosenReason = 'focus_or_content';
      var chosenCandidate = best ? { identity: best.identity, textLength: best.textLength, textPreview120: best.textPreview120, visible: best.visible, chosenReason: chosenReason } : null;
      var composerTextLength = chosenCandidate ? chosenCandidate.textLength : 0;
      var contentPrefixMatch = !!(chosenCandidate && prefix20 && chosenCandidate.textPreview120.indexOf(prefix20) !== -1);
      var focusInComposer = !!(best && best.isActive);

      var buttonCandidates = [];
      var btnList = args.buttonSelectors || [];
      for (var bi = 0; bi < btnList.length; bi++) {
        var bsel = btnList[bi];
        var count = 0, visible = 0, disabled = 0, ariaDisabled = 0, firstText = '', firstIdentity = '';
        try {
          var bnodes = document.querySelectorAll(bsel);
          count = bnodes.length;
          for (var bj = 0; bj < bnodes.length; bj++) {
            var html = bnodes[bj];
            if ((html as any).offsetParent !== null) visible++;
            if ((html as any).disabled) disabled++;
            if (html.getAttribute && html.getAttribute('aria-disabled') === 'true') ariaDisabled++;
            if (bj === 0) {
              firstText = (html.textContent || '').trim().slice(0, 50);
              var btag = (html.tagName && html.tagName.toLowerCase) ? html.tagName.toLowerCase() : '?';
              firstIdentity = (btag + ' ' + (html.getAttribute ? html.getAttribute('data-testid') : '') + ' ' + (html.getAttribute ? html.getAttribute('aria-label') : '')).trim();
            }
          }
        } catch (e) {}
        buttonCandidates.push({ selector: bsel, count: count, visible: visible, disabled: disabled, ariaDisabled: ariaDisabled, firstText: firstText, firstIdentity: firstIdentity });
      }
      var enabledButtonFound = false;
      for (var ek = 0; ek < buttonCandidates.length; ek++) {
        var bc = buttonCandidates[ek];
        if (bc.count > 0 && bc.visible > 0 && bc.disabled === 0 && bc.ariaDisabled === 0) {
          enabledButtonFound = true;
          break;
        }
      }
      var layers = document.querySelectorAll('div[id="layers"] div[role="dialog"], div[aria-modal="true"]');
      var overlayDetected = layers.length > 0;
      var readyToSubmit = !!(chosenCandidate && chosenCandidate.visible && composerTextLength > 0 && enabledButtonFound && !overlayDetected);
      var readinessReason = 'ready';
      if (!chosenCandidate) readinessReason = 'no_candidates_found';
      else if (!chosenCandidate.visible) readinessReason = 'candidates_found_none_visible';
      else if (composerTextLength === 0) readinessReason = 'content_missing';
      else if (prefix20 && !contentPrefixMatch) readinessReason = 'prefix_mismatch';
      else if (!enabledButtonFound) readinessReason = 'button_disabled_or_missing';
      else if (overlayDetected) readinessReason = 'overlay_blocking';
      if (readyToSubmit) readinessReason = 'ready';

      return {
        url: url,
        last_typing_selector: null,
        contenteditable_count: contenteditableCount,
        role_textbox_count: roleTextboxCount,
        active_element_summary: activeSummary,
        composer_candidates: allCandidates,
        chosen_candidate: chosenCandidate,
        chosen_reason: chosenCandidate ? chosenCandidate.chosenReason : null,
        composer_found: !!chosenCandidate,
        composer_text_length: composerTextLength,
        content_prefix_match: contentPrefixMatch,
        focus_in_composer: focusInComposer,
        button_candidates: buttonCandidates,
        enabled_button_found: enabledButtonFound,
        overlay_detected: overlayDetected,
        readiness_verdict: readyToSubmit ? 'ready' : 'not_ready',
        readiness_reason: readinessReason,
      };
    }, evalArgs);
    console.log('[DRY_RUN_DIAG] page.evaluate readiness probe complete');

    const diag = diagnostics as {
      url: string;
      last_typing_selector: string | null;
      contenteditable_count: number;
      role_textbox_count: number;
      active_element_summary: string;
      composer_candidates: { identity: string; role: string; contenteditable: string; visible: boolean; disabled: boolean; ariaDisabled: string; textLength: number; textPreview120: string; rect: { top: number; left: number; width: number; height: number } | null; isActive: boolean }[];
      chosen_candidate: { identity: string; textLength: number; textPreview120: string; visible: boolean; chosenReason: string } | null;
      chosen_reason: string | null;
      composer_found: boolean;
      composer_text_length: number;
      content_prefix_match: boolean;
      focus_in_composer: boolean;
      button_candidates: { selector: string; count: number; visible: number; disabled: number; ariaDisabled: number; firstText: string; firstIdentity: string }[];
      enabled_button_found: boolean;
      overlay_detected: boolean;
      readiness_verdict: string;
      readiness_reason: string;
    };
    diag.last_typing_selector = typingSelector;

    if (typingSelector) console.log(`[DRY_RUN_DIAG] reusing typing selector: ${typingSelector}`);
    console.log(`[DRY_RUN_DIAG] contenteditable_count=${diag.contenteditable_count} role_textbox_count=${diag.role_textbox_count} active=${diag.active_element_summary}`);
    if (diag.chosen_candidate) {
      console.log(`[DRY_RUN_DIAG] best candidate: ${diag.chosen_candidate.identity} textLength=${diag.chosen_candidate.textLength} reason=${diag.chosen_candidate.chosenReason}`);
    }
    console.log(`[DRY_RUN_DIAG] verdict=${diag.readiness_verdict} reason=${diag.readiness_reason}`);

    const artifact = {
      decision_id: decisionId,
      proof_tag: proofTag,
      mode: 'dry',
      url: diag.url,
      last_typing_selector: diag.last_typing_selector,
      contenteditable_count: diag.contenteditable_count,
      role_textbox_count: diag.role_textbox_count,
      active_element_summary: diag.active_element_summary,
      composer_candidates: diag.composer_candidates,
      chosen_candidate: diag.chosen_candidate,
      chosen_reason: diag.chosen_reason,
      composer_found: diag.composer_found,
      composer_text_length: diag.composer_text_length,
      content_prefix_match: diag.content_prefix_match,
      focus_in_composer: diag.focus_in_composer,
      button_candidates: diag.button_candidates,
      enabled_button_found: diag.enabled_button_found,
      overlay_detected: diag.overlay_detected,
      readiness_verdict: diag.readiness_verdict,
      readiness_reason: diag.readiness_reason,
    };
    const artifactPath = join(debugDir, `proof-submit-readiness-${Date.now()}.json`);
    writeFileSync(artifactPath, JSON.stringify(artifact, null, 2), 'utf-8');
    console.log(`[DRY_RUN_ARTIFACT] path=${artifactPath}`);

    const screenshotPath = join(debugDir, `proof-dry-run-ready-${Date.now()}.png`);
    try {
      await this.page.screenshot({ path: screenshotPath, fullPage: false });
      if (diag.readiness_verdict === 'ready') console.log(`[DRY_RUN_READY_TO_SUBMIT] Screenshot saved: ${screenshotPath}`);
    } catch (e: any) {
      console.warn(`[DRY_RUN] Screenshot failed: ${e?.message || e}`);
    }

    if (diag.readiness_verdict === 'ready') {
      return { ready: true, artifactPath };
    }
    const reason = diag.readiness_reason;
    return { ready: false, reason, artifactPath };
  }

  /** Live submit failure categories for diagnostics and retry policy. Dry path never uses these. */
  private static readonly SUBMIT_FAILURE = {
    NO_BUTTON_CANDIDATES: 'no_button_candidates',
    BUTTON_CANDIDATES_BUT_NONE_VISIBLE: 'button_candidates_but_none_visible',
    BUTTON_VISIBLE_BUT_DISABLED: 'button_visible_but_disabled',
    OVERLAY_BLOCKING_SUBMIT: 'overlay_blocking_submit',
    CLICK_ATTEMPTED_BUT_NO_CREATETWEET: 'click_attempted_but_no_createtweet',
    CREATETWEET_TIMEOUT_AFTER_CLICK: 'createtweet_timeout_after_click',
  } as const;

  /** Discovery selectors for post button (include disabled so we can wait and re-check). Live submit only. */
  private static readonly SUBMIT_BUTTON_DISCOVERY_SELECTORS = [
    '[data-testid="tweetButtonInline"]',
    '[data-testid="tweetButton"]',
    'button[data-testid="tweetButtonInline"]',
    'button[data-testid="tweetButton"]',
    'div[role="button"][data-testid="tweetButtonInline"]',
    'div[role="button"][data-testid="tweetButton"]',
    '[aria-label*="Post"]',
    'button[aria-label*="Post"]',
    '[data-testid*="tweetButton"]',
    'div[role="button"][data-testid*="tweetButton"]',
    'button',
    '[role="button"]',
    'span[role="button"]',
    '[data-testid*="Button"]',
  ];

  /**
   * Gather submit-state snapshot (URL, composer, all button candidates with details, overlay). Live only.
   */
  private async gatherLiveSubmitState(contentPrefix?: string): Promise<{
    url: string;
    composer_text_length: number;
    content_prefix_match: boolean;
    button_candidates: Array<{
      selector_family: string;
      index_in_selector: number;
      text: string;
      visible: boolean;
      disabled: boolean;
      aria_disabled: string;
      bounding_rect: { top: number; left: number; width: number; height: number } | null;
      data_testid: string;
      role: string;
    }>;
    candidate_count_by_selector: Record<string, number>;
    active_element_summary: string;
    overlay_present: boolean;
    compose_surface: { present: boolean; tagName: string; testid: string };
    total_raw_button_like: number;
    candidates_near_compose_surface: number;
  }> {
    if (!this.page) return { url: '', composer_text_length: 0, content_prefix_match: false, button_candidates: [], candidate_count_by_selector: {}, active_element_summary: 'no_page', overlay_present: false, compose_surface: { present: false, tagName: '', testid: '' }, total_raw_button_like: 0, candidates_near_compose_surface: 0 };
    const prefix = (contentPrefix ?? '').slice(0, 80);
    return this.page.evaluate(
      (args: { contentPrefix: string; discoverySelectors: string[] }) => {
        const url = window.location.href;
        const activeEl = document.activeElement;
        let activeSummary = 'none';
        if (activeEl) {
          const tag = (activeEl.tagName && (activeEl.tagName as string).toLowerCase) ? (activeEl.tagName as string).toLowerCase() : '?';
          const role = activeEl.getAttribute ? activeEl.getAttribute('role') : '';
          const testid = activeEl.getAttribute ? activeEl.getAttribute('data-testid') : '';
          activeSummary = (tag + ' ' + (role || '') + ' ' + (testid || '')).trim();
        }
        const composerSelectors = ['[data-testid="tweetTextarea_0"]', 'div[contenteditable="true"][role="textbox"]', 'div[role="textbox"][contenteditable="true"]'];
        let composerTextLength = 0;
        let composerPrefixMatch = false;
        for (let i = 0; i < composerSelectors.length; i++) {
          const el = document.querySelector(composerSelectors[i]);
          if (el) {
            const text = (el.textContent || '').trim();
            composerTextLength = text.length;
            composerPrefixMatch = !!(args.contentPrefix && text.slice(0, args.contentPrefix.length) === args.contentPrefix);
            break;
          }
        }
        const buttonCandidates: Array<{
          selector_family: string;
          index_in_selector: number;
          text: string;
          visible: boolean;
          disabled: boolean;
          aria_disabled: string;
          bounding_rect: { top: number; left: number; width: number; height: number } | null;
          data_testid: string;
          role: string;
        }> = [];
        const seen = new Set<Element>();
        for (const sel of args.discoverySelectors) {
          try {
            const nodes = document.querySelectorAll(sel);
            nodes.forEach((node, idx) => {
              if (seen.has(node)) return;
              seen.add(node);
              const rect = node.getBoundingClientRect ? node.getBoundingClientRect() : null;
              const w = rect ? rect.width : 0;
              const h = rect ? rect.height : 0;
              const visible = (node as HTMLElement).offsetParent !== null && w > 0 && h > 0;
              buttonCandidates.push({
                selector_family: sel,
                index_in_selector: idx,
                text: (node.textContent || '').trim().slice(0, 100),
                visible,
                disabled: !!(node as HTMLButtonElement).disabled,
                aria_disabled: (node.getAttribute && node.getAttribute('aria-disabled')) || '',
                bounding_rect: rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null,
                data_testid: (node.getAttribute && node.getAttribute('data-testid')) || '',
                role: (node.getAttribute && node.getAttribute('role')) || '',
              });
            });
          } catch (_) {}
        }
        const layers = document.querySelectorAll('div[id="layers"] div[role="dialog"], div[aria-modal="true"]');
        const overlayPresent = layers.length > 0;
        const composeSurface = document.querySelector('[data-testid="tweetTextarea_0"]') || document.querySelector('div[role="textbox"][contenteditable="true"]');
        const composeSurfaceSummary = composeSurface
          ? { present: true, tagName: composeSurface.tagName, testid: (composeSurface.getAttribute && composeSurface.getAttribute('data-testid')) || '' }
          : { present: false, tagName: '', testid: '' };
        const rawSet = new Set<Element>();
        try {
          document.querySelectorAll('button').forEach((el: Element) => rawSet.add(el));
          document.querySelectorAll('[role="button"]').forEach((el: Element) => rawSet.add(el));
          document.querySelectorAll('[data-testid*="Button"]').forEach((el: Element) => rawSet.add(el));
        } catch (_) {}
        const total_raw_button_like = rawSet.size;

        let candidates_near_compose_surface = 0;
        if (composeSurface) {
          const container = (composeSurface as Element).closest('section') || (composeSurface as Element).closest('div[data-testid]') || composeSurface.parentElement?.parentElement?.parentElement || document.body;
          const nearSelectors = ['button', '[role="button"]', '[data-testid*="tweetButton"]', '[aria-label*="Post"]', 'span[role="button"]'];
          nearSelectors.forEach((sel: string) => {
            try {
              container.querySelectorAll(sel).forEach((node: Element, idx: number) => {
                if (seen.has(node)) return;
                seen.add(node);
                const rect = node.getBoundingClientRect ? node.getBoundingClientRect() : null;
                const w = rect ? rect.width : 0;
                const h = rect ? rect.height : 0;
                const visible = (node as HTMLElement).offsetParent !== null && w > 0 && h > 0;
                buttonCandidates.push({
                  selector_family: 'near_compose',
                  index_in_selector: idx,
                  text: (node.textContent || '').trim().slice(0, 100),
                  visible,
                  disabled: !!(node as HTMLButtonElement).disabled,
                  aria_disabled: (node.getAttribute && node.getAttribute('aria-disabled')) || '',
                  bounding_rect: rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null,
                  data_testid: (node.getAttribute && node.getAttribute('data-testid')) || '',
                  role: (node.getAttribute && node.getAttribute('role')) || '',
                });
                candidates_near_compose_surface++;
              });
            } catch (_) {}
          });
        }

        const bySelector: Record<string, number> = {};
        buttonCandidates.forEach((c) => {
          bySelector[c.selector_family] = (bySelector[c.selector_family] || 0) + 1;
        });
        return { url, composer_text_length: composerTextLength, content_prefix_match: composerPrefixMatch, button_candidates: buttonCandidates, candidate_count_by_selector: bySelector, active_element_summary: activeSummary, overlay_present: overlayPresent, compose_surface: composeSurfaceSummary, total_raw_button_like, candidates_near_compose_surface };
      },
      { contentPrefix: prefix, discoverySelectors: UltimateTwitterPoster.SUBMIT_BUTTON_DISCOVERY_SELECTORS }
    );
  }

  /**
   * Capture submit-stage diagnostic artifact (live only). Call when submit fails: no button, or click but no CreateTweet.
   * Writes JSON + screenshot. If gatheredState provided, uses it; otherwise runs a fresh gather.
   */
  private async captureLiveSubmitStateDiagnostic(
    decisionId: string,
    failureCategory: string,
    options?: { contentPrefix?: string; chosenSelector?: string; clickCompleted?: boolean; gatheredState?: Awaited<ReturnType<UltimateTwitterPoster['gatherLiveSubmitState']>> }
  ): Promise<{ artifactPath: string; screenshotPath: string }> {
    if (!this.page) return { artifactPath: '', screenshotPath: '' };
    const debugDir = join(process.env.RUNNER_PROFILE_DIR || process.cwd(), 'debug');
    mkdirSync(debugDir, { recursive: true });
    const timestamp = Date.now();

    const diag = options?.gatheredState ?? (await this.gatherLiveSubmitState(options?.contentPrefix));

    const artifact = {
      decision_id: decisionId,
      failure_category: failureCategory,
      captured_at: new Date().toISOString(),
      cleanup_ran_before_submit: this.lastCleanupRanBeforeSubmit,
      ...(options?.chosenSelector ? { chosen_selector: options.chosenSelector } : {}),
      ...(options?.clickCompleted !== undefined ? { click_completed: options.clickCompleted } : {}),
      ...diag,
    };
    const artifactPath = join(debugDir, `live-submit-fail-${failureCategory}-${timestamp}.json`);
    writeFileSync(artifactPath, JSON.stringify(artifact, null, 2), 'utf-8');
    console.log(`[LIVE_SUBMIT_DIAG] failure_category=${failureCategory} artifact=${artifactPath}`);

    const screenshotPath = join(debugDir, `live-submit-fail-${failureCategory}-${timestamp}.png`);
    try {
      await this.page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`[LIVE_SUBMIT_DIAG] screenshot=${screenshotPath}`);
    } catch (e: unknown) {
      console.warn(`[LIVE_SUBMIT_DIAG] screenshot failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    return { artifactPath, screenshotPath };
  }

  private async postWithNetworkVerification(validGuard: PostingGuard, content?: string): Promise<PostResult> {
    const decisionId = validGuard.decision_id;
    if (!this.page) throw new Error('Page not initialized');

    console.log('ULTIMATE_POSTER: Setting up CreateTweet GraphQL response capture...');
    this.validatedTweetId = null;
    this.capturedTweetId = null;
    try {
      this.createTweetResponsePromise = this.waitForCreateTweetResponse();
      console.log('ULTIMATE_POSTER: ✅ CreateTweet GraphQL response capture active (30s timeout)');
    } catch (setupError: any) {
      console.error(`[ULTIMATE_POSTER] ❌ CreateTweet response setup failed: ${setupError.message}`);
      await this.capturePostIdCaptureFailed('CreateTweet response setup failed', setupError.message, decisionId);
      throw new Error(`POST_ID_CAPTURE_FAILED: CreateTweet GraphQL response setup failed: ${setupError.message}`);
    }

    const contentPrefix = (content ?? '').slice(0, 80);
    const maxButtonRetries = 3;
    const buttonRetryDelay = 2000;
    const { SUBMIT_FAILURE } = UltimateTwitterPoster;

    type ButtonCandidate = Awaited<ReturnType<UltimateTwitterPoster['gatherLiveSubmitState']>>['button_candidates'][0];
    let chosen: ButtonCandidate | null = null;
    let lastGatheredState: Awaited<ReturnType<UltimateTwitterPoster['gatherLiveSubmitState']>> | null = null;

    for (let attempt = 1; attempt <= maxButtonRetries; attempt++) {
      if (!this.page) throw new Error('Page is null');
      lastGatheredState = await this.gatherLiveSubmitState(contentPrefix);
      const state = lastGatheredState;

      console.log(`[LIVE_SUBMIT] total_raw_button_like=${state.total_raw_button_like} candidates_near_compose_surface=${state.candidates_near_compose_surface} cleanup_ran_before_submit=${this.lastCleanupRanBeforeSubmit}`);
      Object.entries(state.candidate_count_by_selector).forEach(([sel, count]) => {
        console.log(`[LIVE_SUBMIT] candidate_count selector=${sel} count=${count}`);
      });

      const actionable = state.button_candidates.find(
        (c) => c.visible && !c.disabled && c.aria_disabled !== 'true'
      );
      if (actionable) {
        chosen = actionable;
        console.log(`ULTIMATE_POSTER: ✅ Found actionable post button: ${chosen.selector_family} index=${chosen.index_in_selector} data-testid=${chosen.data_testid}`);
        break;
      }

      if (state.button_candidates.length === 0) {
        await this.captureLiveSubmitStateDiagnostic(decisionId, SUBMIT_FAILURE.NO_BUTTON_CANDIDATES, {
          contentPrefix,
          gatheredState: state,
        });
        throw new Error(`SUBMIT_FAILURE: ${SUBMIT_FAILURE.NO_BUTTON_CANDIDATES}`);
      }

      const anyVisible = state.button_candidates.some((c) => c.visible);
      if (!anyVisible) {
        await this.captureLiveSubmitStateDiagnostic(decisionId, SUBMIT_FAILURE.BUTTON_CANDIDATES_BUT_NONE_VISIBLE, {
          contentPrefix,
          gatheredState: state,
        });
        throw new Error(`SUBMIT_FAILURE: ${SUBMIT_FAILURE.BUTTON_CANDIDATES_BUT_NONE_VISIBLE}`);
      }

      if (state.overlay_present) {
        await this.captureLiveSubmitStateDiagnostic(decisionId, SUBMIT_FAILURE.OVERLAY_BLOCKING_SUBMIT, {
          contentPrefix,
          gatheredState: state,
        });
        throw new Error(`SUBMIT_FAILURE: ${SUBMIT_FAILURE.OVERLAY_BLOCKING_SUBMIT}`);
      }

      const anyVisibleDisabled = state.button_candidates.some(
        (c) => c.visible && (c.disabled || c.aria_disabled === 'true')
      );
      if (anyVisibleDisabled && attempt < maxButtonRetries) {
        console.log(`ULTIMATE_POSTER: ⚠️ Visible button(s) disabled; waiting ${buttonRetryDelay}ms and re-checking (attempt ${attempt}/${maxButtonRetries})`);
        await this.page.waitForTimeout(buttonRetryDelay);
        try {
          await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await this.page.waitForTimeout(500);
        } catch (_) {}
        continue;
      }

      if (anyVisibleDisabled) {
        await this.captureLiveSubmitStateDiagnostic(decisionId, SUBMIT_FAILURE.BUTTON_VISIBLE_BUT_DISABLED, {
          contentPrefix,
          gatheredState: state,
        });
        throw new Error(`SUBMIT_FAILURE: ${SUBMIT_FAILURE.BUTTON_VISIBLE_BUT_DISABLED}`);
      }
    }

    if (!chosen || !lastGatheredState) {
      await this.captureLiveSubmitStateDiagnostic(decisionId, SUBMIT_FAILURE.BUTTON_CANDIDATES_BUT_NONE_VISIBLE, {
        contentPrefix,
        gatheredState: lastGatheredState ?? undefined,
      });
      throw new Error(`SUBMIT_FAILURE: ${SUBMIT_FAILURE.BUTTON_CANDIDATES_BUT_NONE_VISIBLE}`);
    }

    const postButtonLocator = this.page.locator(chosen.selector_family).nth(chosen.index_in_selector);
    try {
      await postButtonLocator.waitFor({ state: 'visible', timeout: 5000 });
    } catch (e: any) {
      await this.captureLiveSubmitStateDiagnostic(decisionId, SUBMIT_FAILURE.BUTTON_CANDIDATES_BUT_NONE_VISIBLE, {
        contentPrefix,
        gatheredState: lastGatheredState ?? undefined,
      });
      throw new Error(`SUBMIT_FAILURE: ${SUBMIT_FAILURE.BUTTON_CANDIDATES_BUT_NONE_VISIBLE} (locator no longer visible): ${e?.message || e}`);
    }

    console.log('ULTIMATE_POSTER: 🚀 Clicking post button...');
    // PROOF_MODE: Longer pre-submit dwell (3–6s) to reduce automation signals; 226 mitigation.
    const proofModeDwell = process.env.PROOF_MODE === 'true' && (validGuard as any)?.proof_tag;
    if (proofModeDwell) {
      const dwellMs = 3000 + Math.floor(Math.random() * (6000 - 3000 + 1));
      console.log(`[ULTIMATE_POSTER] PROOF_MODE: pre-submit dwell ${dwellMs}ms (3–6s)`);
      await this.page!.waitForTimeout(dwellMs);
    }

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
    // 🔧 TASK: Allow RUNNER_MODE to bypass SERVICE_ROLE check (runner is trusted)
    const isRunnerMode = process.env.RUNNER_MODE === 'true';
    // 🧪 TEST BYPASS: RUNNER_TEST_MODE=true (requires RUNNER_MODE=true)
    const isTestMode = process.env.RUNNER_TEST_MODE === 'true' && process.env.RUNNER_MODE === 'true';
    const bypassServiceRole = isRunnerMode || isTestMode;
    
    if (!isWorker && !bypassServiceRole) {
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
    
    if (bypassServiceRole) {
      console.log(`[ULTIMATE_POSTER] 🧪 RUNNER MODE: BYPASS_ACTIVE: SERVICE_ROLE_CHECK`);
    }
    
    // 🔒 SEV1 GHOST ERADICATION: Pipeline source must be reply_v2_scheduler (or postingQueue for timeline posts)
    // 🔧 TASK: Allow postingQueue for timeline posts in RUNNER_MODE
    const allowedSources = ['reply_v2_scheduler', 'postingQueue'];
    if (!allowedSources.includes(validGuard.pipeline_source) && !isRunnerMode) {
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
    
    // 🎯 CANARY_MODE: Bypass permit check for canary testing
    const canaryModeForPermit = process.env.CANARY_MODE === 'true';
    
    if (!permit_id && !canaryModeForPermit) {
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
    
    // Verify permit is APPROVED (skip in canary mode)
    let permitCheck: { valid: boolean; approved?: boolean; permit?: { status?: string }; error?: string };
    if (canaryModeForPermit) {
      console.log(`[PERMIT_CHOKE] 🎯 CANARY_MODE: Bypassing permit verification`);
      permitCheck = { valid: true, approved: true };
    } else {
      permitCheck = await verifyPostingPermit(permit_id);
    }
    
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
    
    // Try multiple click strategies. PROOF_MODE: use normal click only (no keyboard submit) to reduce automation signals; 226 mitigation.
    let clickSuccess = false;
    const useKeyboardSubmit = false;
    try {
      if (useKeyboardSubmit) {
        console.log('ULTIMATE_POSTER: PROOF_MODE: submit via keyboard (focus + Enter)');
        await postButtonLocator.focus();
        await this.page!.waitForTimeout(150);
        await this.page!.keyboard.press('Enter');
        this.clickFailures = 0;
        clickSuccess = true;
        console.log(`ULTIMATE_POSTER: ✅ Keyboard submit succeeded (permit: ${permit_id})`);
      } else {
        // Strategy 1: Normal click
        console.log('ULTIMATE_POSTER: Trying normal click...');
        await postButtonLocator.click({ timeout: 15000 });
        this.clickFailures = 0;
        clickSuccess = true;
        console.log(`ULTIMATE_POSTER: ✅ Normal click succeeded (permit: ${permit_id})`);
      }
    } catch (clickError: any) {
      this.clickFailures++;
      console.log(`ULTIMATE_POSTER: ❌ Normal click failed (${this.clickFailures}/${this.maxClickFailures}): ${clickError.message}`);
      console.log('ULTIMATE_POSTER: Trying force-click...');

      // Strategy 2: Force-click via JavaScript (selector + index)
      try {
        await this.page.evaluate(
          (opts: { selector: string; index: number }) => {
            const nodes = document.querySelectorAll(opts.selector);
            const btn = nodes[opts.index] as HTMLElement | undefined;
            if (btn) {
              btn.click();
            }
          },
          { selector: chosen.selector_family, index: chosen.index_in_selector }
        );
        clickSuccess = true;
        console.log('ULTIMATE_POSTER: ✅ Force-click executed');
      } catch (forceError: any) {
        console.log(`ULTIMATE_POSTER: ❌ Force-click failed: ${forceError.message}`);
        console.log('ULTIMATE_POSTER: Trying mouse coordinate click...');

        // Strategy 3: Click via coordinates
        const box = await postButtonLocator.boundingBox();
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

    console.log(`[LIVE_SUBMIT] selector_chosen=${chosen.selector_family} index=${chosen.index_in_selector} data_testid=${chosen.data_testid} role=${chosen.role} click_completed=true`);
    console.log('ULTIMATE_POSTER: ✅ Post button clicked successfully');

    if (process.env.PROOF_MODE === 'true' && this.page) {
      try {
        const debugDir = join(process.env.RUNNER_PROFILE_DIR || process.cwd(), 'debug');
        mkdirSync(debugDir, { recursive: true });
        const screenshotPath = join(debugDir, `proof-post-click-${Date.now()}.png`);
        await this.page.screenshot({ path: screenshotPath, fullPage: false });
        console.log(`[PROOF_ARTIFACT] screenshot_after_click=${screenshotPath}`);
      } catch (e: any) {
        console.warn(`[PROOF_ARTIFACT] screenshot after click failed: ${e?.message || e}`);
      }
    }

    // 🔒 TASK: Wait for CreateTweet GraphQL response (REQUIRED - fail closed)
    // The listener was set up BEFORE clicking, so we wait AFTER clicking
    console.log('ULTIMATE_POSTER: 🔍 Waiting for CreateTweet GraphQL response (after post button click)...');
    
    if (!this.createTweetResponsePromise) {
      throw new Error('CreateTweet response promise not initialized - cannot capture tweet_id');
    }

    let validatedTweetId: string | null = null;
    try {
      // Wait for the CreateTweet response (with timeout)
      const forceTimeout = process.env.RUNNER_TEST_MODE === 'true' && 
                           process.env.FORCE_CREATETWEET_TIMEOUT_MS;
      const timeoutMs = forceTimeout ? parseInt(forceTimeout, 10) : 30000;
      
      validatedTweetId = await Promise.race([
        this.createTweetResponsePromise,
        new Promise<string | null>((_, reject) =>
          setTimeout(() => reject(new Error(`CreateTweet GraphQL response timeout (${timeoutMs}ms)`)), timeoutMs)
        ),
      ]);
      if (validatedTweetId) {
        console.log(`[LIVE_SUBMIT] CreateTweet listener observed request/response tweet_id=${validatedTweetId}`);
      }
    } catch (error: any) {
      console.error(`[ULTIMATE_POSTER] ❌ CreateTweet response wait failed: ${error.message}`);
      const isTimeout = error.message?.includes('CreateTweet GraphQL response timeout');
      if (isTimeout) {
        console.log(`[LIVE_SUBMIT] createtweet_timeout_after_click: listener did not observe request/response`);
        await this.captureLiveSubmitStateDiagnostic(decisionId, UltimateTwitterPoster.SUBMIT_FAILURE.CREATETWEET_TIMEOUT_AFTER_CLICK, {
          contentPrefix: (content ?? '').slice(0, 80),
          chosenSelector: chosen.selector_family,
          clickCompleted: true,
        });
      }
      await this.capturePostIdCaptureFailed(
        'CreateTweet response wait failed',
        error.message,
        decisionId,
        'POST_CLICK_NO_NETWORK_RESPONSE'
      );
      throw new Error(`POST_ID_CAPTURE_FAILED: POST_CLICK_NO_NETWORK_RESPONSE: ${error.message}`);
    }

    const username = process.env.TWITTER_USERNAME || process.env.TWITTER_SCREEN_NAME || 'SignalAndSynapse';
    const proofMode = process.env.PROOF_MODE === 'true';
    const proofTag = (validGuard as any)?.proof_tag ?? null;
    const expectedAccount = process.env.PROOF_EXPECTED_ACCOUNT?.trim() || username;

    let successDetectionPath: 'graphql_tweet_id' | 'url_status_id' | 'profile_match_status_id' = 'graphql_tweet_id';
    if (!validatedTweetId) {
      if (this.lastCreateTweetResponseBody) {
        const struct = getCreateTweetResponseStructure(this.lastCreateTweetResponseBody);
        if (struct.errorsPresent) {
          console.log(`[ULTIMATE_POSTER] CreateTweet response has errors: count=${struct.errorsCount} codes=${struct.errorCodes.join('; ')}`);
        } else if (struct.dataKeys.length > 0) {
          console.log(`[ULTIMATE_POSTER] CreateTweet response has data but no parseable tweet_id (shape may have changed)`);
        }
      }
      console.log(`[ULTIMATE_POSTER] Trying fallbacks: url -> profile -> home -> profile prefix`);
      const fallback = await this.fallbackTweetIdFromUrlThenProfile(content ?? '', username, {
        decisionId,
        proofTag: proofTag ?? undefined,
        expectedAccount,
      });
      if (fallback?.id) {
        const validation = assertValidTweetId(fallback.id);
        if (validation.valid) {
          validatedTweetId = fallback.id;
          this.validatedTweetId = fallback.id;
          this.capturedTweetId = fallback.id;
          successDetectionPath = fallback.source === 'url' ? 'url_status_id' : 'profile_match_status_id';
        }
      }
      if (!validatedTweetId && proofMode && proofTag) {
        try {
          const provisional = await this.proofProvisionalSuccess(content ?? '', expectedAccount.replace(/^@/, ''));
          if (provisional?.id) {
            validatedTweetId = provisional.id;
            this.validatedTweetId = provisional.id;
            this.capturedTweetId = provisional.id;
            successDetectionPath = 'profile_match_status_id';
          }
        } catch (provisionalError: any) {
          if (provisionalError?.message === 'PROOF: content found but status link missing') {
            const failureCode = 'POST_SUBMITTED_BUT_ID_NOT_RECOVERED';
            await this.capturePostIdCaptureFailed('Content found but status link missing', provisionalError.message, decisionId, failureCode, proofMode ? { decisionId, proofTag, expectedAccount } : undefined);
            throw new Error('POST_ID_CAPTURE_FAILED: PROOF content found on profile but status link could not be extracted');
          }
          throw provisionalError;
        }
      }
    }

    if (!validatedTweetId) {
      const struct = this.lastCreateTweetResponseBody ? getCreateTweetResponseStructure(this.lastCreateTweetResponseBody) : null;
      const is226 = struct?.errorsPresent && struct?.errorCodes?.some((c: string) => String(c) === '226');
      let failureCode: string;
      if (!this.lastCreateTweetResponseBody) {
        failureCode = 'POST_CLICK_NO_NETWORK_RESPONSE';
      } else if (is226) {
        failureCode = 'X_CREATE_TWEET_REJECTED_226';
        console.log(`[ULTIMATE_POSTER] X rejected the action server-side (226). No retries for this decision in proof mode.`);
      } else if (struct?.errorsPresent) {
        failureCode = 'CREATE_TWEET_RESPONSE_ERROR';
      } else if (struct?.dataKeys && struct.dataKeys.length > 0) {
        failureCode = 'CREATE_TWEET_UNPARSEABLE_SUCCESS_SHAPE';
      } else {
        failureCode = 'POST_SUBMITTED_BUT_ID_NOT_RECOVERED';
      }

      // 226 observability + post-click DOM clues (proof only)
      let observability226: {
        createTweetResponseShape: string;
        pageUrl: string;
        url_at_226_detection: string;
        toastOrAlertPresent: boolean;
        visibleErrorStrings: string[];
        toastTextPrimary: string | null;
        interstitialOrChallengePresent: boolean;
      } | undefined;
      let postClickDom: { composerCleared: boolean; tweetBoxClosed: boolean; homeTimelineVisible: boolean; typedContentStillInCompose: boolean } | undefined;
      const createTweetErrorsPayload = (() => {
        const errs = this.lastCreateTweetResponseBody?.errors;
        if (!Array.isArray(errs)) return null;
        return (errs as any[]).slice(0, 10).map((e: any) => ({
          code: e?.code != null ? String(e.code) : undefined,
          message: typeof e?.message === 'string' ? e.message.slice(0, 500) : undefined,
          kind: e?.kind != null ? String(e.kind).slice(0, 80) : undefined,
        }));
      })();
      if (proofMode && this.page) {
        const hasData = !!(struct?.dataKeys && struct.dataKeys.length > 0);
        const hasErrors = !!struct?.errorsPresent;
        const createTweetResponseShape = hasErrors && !hasData ? 'errors_only' : hasData && hasErrors ? 'data_and_errors' : hasData ? 'data_only' : 'other';
        const urlAt226 = this.page.url();
        const errorClues = await this.getPageErrorClues();
        const interstitialOrChallengePresent = await this.getInterstitialOrChallengePresent();
        observability226 = {
          createTweetResponseShape,
          pageUrl: urlAt226,
          url_at_226_detection: urlAt226,
          toastOrAlertPresent: errorClues.toastOrAlertPresent,
          visibleErrorStrings: errorClues.visibleErrorStrings,
          toastTextPrimary: errorClues.toastTextPrimary,
          interstitialOrChallengePresent,
        };
        postClickDom = await this.getPostClickDomClues(content ?? '');
        console.log(`[PROOF_226_OBS] create_tweet_response=${createTweetResponseShape} page_url=${urlAt226}`);
        console.log(`[PROOF_226_OBS] toast_or_alert_present=${observability226.toastOrAlertPresent} toast_text_primary=${observability226.toastTextPrimary ?? 'null'} visible_error_strings=${JSON.stringify(observability226.visibleErrorStrings.slice(0, 5))}`);
        console.log(`[PROOF_226_OBS] interstitial_or_challenge_present=${observability226.interstitialOrChallengePresent}`);
        console.log(`[PROOF_226_OBS] post_click_dom composer_cleared=${postClickDom.composerCleared} tweet_box_closed=${postClickDom.tweetBoxClosed} home_timeline_visible=${postClickDom.homeTimelineVisible} typed_content_still_in_compose=${postClickDom.typedContentStillInCompose}`);
      }

      await this.capturePostIdCaptureFailed(
        'No tweet_id from GraphQL or fallbacks',
        `failure_code=${failureCode}${struct?.errorCodes?.length ? ` error_codes=${struct.errorCodes.join(',')}` : ''}`,
        decisionId,
        failureCode,
        proofMode ? { decisionId, proofTag, expectedAccount, struct, observability226, postClickDom, createTweetErrorsPayload } : undefined
      );
      throw new Error(`POST_ID_CAPTURE_FAILED: ${failureCode}`);
    }

    const validation = assertValidTweetId(validatedTweetId);
    if (!validation.valid) {
      await this.capturePostIdCaptureFailed('Tweet ID validation failed', validation.error || 'Invalid format', decisionId);
      throw new Error(`POST_ID_CAPTURE_FAILED: Invalid tweet_id: ${validation.error}`);
    }

    console.log(`[POST_SUCCESS_DETECTION] ${successDetectionPath}=${validatedTweetId}`);
    console.log(`[ULTIMATE_POSTER] ✅ Validated tweet_id: ${validatedTweetId}`);

    const tweetUrl = `https://x.com/${username}/status/${validatedTweetId}`;
    
    try {
      // Quick check: navigate to tweet URL and verify it exists
      if (this.page) {
        const confirmationResult = await this.confirmTweetExists(validatedTweetId, username);
        if (!confirmationResult) {
          console.warn(`[ULTIMATE_POSTER] ⚠️ Post-confirmation failed for tweet_id=${validatedTweetId}, but continuing (tweet_id is validated from GraphQL)`);
        } else {
          console.log(`[ULTIMATE_POSTER] ✅ Post-confirmation successful: ${tweetUrl}`);
        }
      }
    } catch (confirmationError: any) {
      // Non-critical - tweet_id is already validated from GraphQL
      console.warn(`[ULTIMATE_POSTER] ⚠️ Post-confirmation error (non-critical): ${confirmationError.message}`);
    }

    recordAction();
    return { success: true, tweetId: validatedTweetId, tweetUrl };
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

  /** Normalize text for content matching: collapse whitespace, trim, strip trailing punctuation */
  private static normalizeForMatch(s: string): string {
    return s.replace(/\s+/g, ' ').trim().replace(/[,.:;!?]+$/, '').slice(0, 300);
  }

  /**
   * Fallback: get tweet ID from (1) current URL (2) redirect (3) profile (4) home timeline (5) profile 50-char prefix.
   * Returns id + source, and optional proof artifact flags (content_match_found, status_link_found).
   */
  private async fallbackTweetIdFromUrlThenProfile(
    content: string,
    username: string,
    proofContext?: { decisionId?: string; proofTag?: string; expectedAccount?: string }
  ): Promise<{ id: string; source: 'url' | 'profile' | 'home' } | null> {
    if (!this.page) return null;

    const norm = UltimateTwitterPoster.normalizeForMatch(content);
    const prefix50 = norm.slice(0, 50);

    const checkUrl = (): string | null => {
      const u = this.page?.url() || '';
      const m = u.match(/\/status\/(\d{15,20})/);
      return m && assertValidTweetId(m[1]).valid ? m[1] : null;
    };

    const urlIdNow = checkUrl();
    if (urlIdNow) {
      console.log(`[ULTIMATE_POSTER] Fallback: url_status_id=${urlIdNow} (current URL)`);
      return { id: urlIdNow, source: 'url' };
    }

    const urlId = await this.waitForTweetRedirect(5000);
    if (urlId && assertValidTweetId(urlId).valid) {
      console.log(`[ULTIMATE_POSTER] Fallback: url_status_id=${urlId}`);
      return { id: urlId, source: 'url' };
    }

    const findIdFromArticles = async (articles: Locator[], label: string): Promise<string | null> => {
      for (let i = 0; i < Math.min(articles.length, 10); i++) {
        const article = articles[i];
        const statusLink = await article.locator('a[href*="/status/"]').first().getAttribute('href').catch(() => null);
        if (!statusLink) continue;
        const match = statusLink.match(/\/status\/(\d{15,20})/);
        if (!match) continue;
        const tweetText = await article.locator('[data-testid="tweetText"]').first().textContent().catch(() => '');
        const text = UltimateTwitterPoster.normalizeForMatch(tweetText || '');
        const ok = text && (text.includes(norm) || norm.includes(text) || (prefix50.length >= 15 && text.includes(prefix50)));
        if (ok && assertValidTweetId(match[1]).valid) {
          console.log(`[ULTIMATE_POSTER] Fallback: ${label}=${match[1]}`);
          return match[1];
        }
      }
      return null;
    };

    try {
      await this.page.goto(`https://x.com/${username}?t=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 12000 });
      await this.page.waitForTimeout(2000);
      const profileArticles = await this.page.locator('article[data-testid="tweet"]').all();
      const profileId = await findIdFromArticles(profileArticles, 'profile_match_status_id');
      if (profileId) return { id: profileId, source: 'profile' };

      await this.page.goto(`https://x.com/home?t=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 12000 });
      await this.page.waitForTimeout(2000);
      const homeArticles = await this.page.locator('article[data-testid="tweet"]').all();
      const homeId = await findIdFromArticles(homeArticles, 'home_timeline_status_id');
      if (homeId) return { id: homeId, source: 'home' };

      await this.page.goto(`https://x.com/${username}?t=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 12000 });
      await this.page.waitForTimeout(1500);
      const profileArticles2 = await this.page.locator('article[data-testid="tweet"]').all();
      for (let i = 0; i < Math.min(profileArticles2.length, 5); i++) {
        const tweetText = await profileArticles2[i].locator('[data-testid="tweetText"]').first().textContent().catch(() => '');
        const text = UltimateTwitterPoster.normalizeForMatch(tweetText || '');
        if (prefix50.length >= 15 && text.includes(prefix50)) {
          const statusLink = await profileArticles2[i].locator('a[href*="/status/"]').first().getAttribute('href').catch(() => null);
          if (statusLink) {
            const m = statusLink.match(/\/status\/(\d{15,20})/);
            if (m && assertValidTweetId(m[1]).valid) {
              console.log(`[ULTIMATE_POSTER] Fallback: profile_prefix_match_status_id=${m[1]}`);
              return { id: m[1], source: 'profile' };
            }
          }
        }
      }
    } catch (e: any) {
      console.warn(`[ULTIMATE_POSTER] Fallback error: ${e?.message || e}`);
    }

    if (proofContext && this.page && process.env.PROOF_MODE === 'true') {
      try {
        const debugDir = join(process.env.RUNNER_PROFILE_DIR || process.cwd(), 'debug');
        mkdirSync(debugDir, { recursive: true });
        const screenshotPath = join(debugDir, `proof-after-profile-fallback-${Date.now()}.png`);
        await this.page.screenshot({ path: screenshotPath, fullPage: false });
        console.log(`[PROOF_ARTIFACT] screenshot_after_profile_fallback=${screenshotPath}`);
      } catch (e: any) {
        console.warn(`[PROOF_ARTIFACT] screenshot after profile fallback failed: ${e?.message || e}`);
      }
    }
    return null;
  }

  /**
   * Proof-only: find exact proof content on profile/timeline and capture /status/<id> (PROVISIONAL_SUCCESS).
   * If content found but no status link, throws specific error.
   */
  private async proofProvisionalSuccess(content: string, username: string): Promise<{ id: string } | null> {
    if (!this.page || !content || content.length < 10) return null;
    const norm = UltimateTwitterPoster.normalizeForMatch(content);
    try {
      await this.page.goto(`https://x.com/${username}?t=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 12000 });
      await this.page.waitForTimeout(2500);
      const articles = await this.page.locator('article[data-testid="tweet"]').all();
      for (let i = 0; i < Math.min(articles.length, 12); i++) {
        const tweetText = await articles[i].locator('[data-testid="tweetText"]').first().textContent().catch(() => '');
        const text = UltimateTwitterPoster.normalizeForMatch(tweetText || '');
        if (text === norm || (norm.length >= 30 && text.includes(norm))) {
          const statusLink = await articles[i].locator('a[href*="/status/"]').first().getAttribute('href').catch(() => null);
          if (!statusLink) {
            throw new Error('PROOF: content found but status link missing');
          }
          const m = statusLink.match(/\/status\/(\d{15,20})/);
          if (m && assertValidTweetId(m[1]).valid) {
            console.log(`[POST_SUCCESS_DETECTION] profile_match_status_id=${m[1]} (proof provisional)`);
            return { id: m[1] };
          }
        }
      }
    } catch (e: any) {
      if (e?.message === 'PROOF: content found but status link missing') throw e;
      console.warn(`[ULTIMATE_POSTER] Proof provisional error: ${e?.message || e}`);
    }
    return null;
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
   * 🔒 TASK: Removed setupBulletproofNetworkInterception - we ONLY use CreateTweet GraphQL response
   * This prevents capturing invalid tweet_ids from other network responses
   */
  // Removed - we now use waitForCreateTweetResponse() which only captures from CreateTweet GraphQL

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

  private async captureFailureArtifacts(error: string, decisionId?: string): Promise<void> {
    if (!this.page) return;

    const timestamp = Date.now();
    const artifactsDir = join(process.cwd(), 'artifacts');
    const did = decisionId ?? 'unknown';

    try {
      const screenshotPath = join(artifactsDir, `failure-${timestamp}.png`);
      await this.page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`ULTIMATE_POSTER: Screenshot saved to ${screenshotPath}`);

      const errorLogPath = join(artifactsDir, `error-${timestamp}.json`);
      writeFileSync(errorLogPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        error,
        url: this.page.url(),
        userAgent: await this.page.evaluate(() => navigator.userAgent)
      }, null, 2));
      console.log(`ULTIMATE_POSTER: Error details saved to ${errorLogPath}`);

      const { uploadArtifact } = await import('../utils/artifactUpload.js');
      const { existsSync } = await import('fs');
      if (existsSync(screenshotPath)) {
        await uploadArtifact(screenshotPath, { decisionId: did, label: 'poster_failure', isFailure: true });
      }
      if (existsSync(errorLogPath)) {
        await uploadArtifact(errorLogPath, { decisionId: did, label: 'poster_error', isFailure: true });
      }
    } catch (e) {
      console.error('ULTIMATE_POSTER: Failed to capture artifacts:', e.message);
    }
  }

  /**
   * 🔒 TASK: Wait for CreateTweet GraphQL response and extract validated tweet_id
   * This is the ONLY source of truth for tweet_id
   */
  private async waitForCreateTweetResponse(): Promise<string | null> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    // 🔒 TEST MODE: Force skip CreateTweet capture (for fail-closed verification)
    const forceSkip = process.env.RUNNER_TEST_MODE === 'true' && 
                      process.env.FORCE_SKIP_CREATETWEET_CAPTURE === 'true';
    if (forceSkip) {
      console.log(`[ULTIMATE_POSTER] 🔒 TEST MODE: FORCE_SKIP_CREATETWEET_CAPTURE=true - simulating CreateTweet failure`);
      throw new Error('TEST MODE: CreateTweet capture intentionally skipped for fail-closed verification');
    }

    // 🔒 TEST MODE: Force timeout (for fail-closed verification)
    const forceTimeout = process.env.RUNNER_TEST_MODE === 'true' && 
                         process.env.FORCE_CREATETWEET_TIMEOUT_MS;
    const timeoutMs = forceTimeout ? parseInt(forceTimeout, 10) : 30000;

    return new Promise((resolve, reject) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.page?.off('response', responseHandler);
          reject(new Error(`CreateTweet GraphQL response timeout (${timeoutMs}ms)`));
        }
      }, timeoutMs);

      const responseHandler = async (response: any) => {
        if (resolved) return; // Already resolved/rejected

        try {
          const url = response.url();
          const postData = response.request().postData() || '';

          // Match CreateTweet GraphQL endpoint specifically
          const isCreateTweet = url.includes('/i/api/graphql') && 
                                (postData.includes('CreateTweet') || 
                                 postData.includes('create_tweet') ||
                                 url.includes('CreateTweet'));

          if (!isCreateTweet) {
            return; // Not the response we're waiting for
          }

          console.log(`[ULTIMATE_POSTER] 🎯 CreateTweet GraphQL response received: ${url}`);

          if (response.status() !== 200) {
            console.error(`[ULTIMATE_POSTER] ❌ CreateTweet response status: ${response.status()}`);
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              this.page?.off('response', responseHandler);
              reject(new Error(`CreateTweet GraphQL response failed with status ${response.status()}`));
            }
            return;
          }

          try {
            const responseBody = await response.json();
            this.lastCreateTweetResponseBody = responseBody;
            const { getCreateTweetError226 } = await import('./tweetIdValidator');
            const err226 = getCreateTweetError226(responseBody);
            if (err226?.is226) {
              console.log('[CREATE_TWEET_ERROR] code=226 automation/spam block');
              if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                this.page?.off('response', responseHandler);
                reject(new Error(`POST_BLOCKED_BY_X_226: CreateTweet error 226 (automation/spam block)`));
              }
              return;
            }
            const tweetId = extractTweetIdFromCreateTweetResponse(responseBody);

            if (!tweetId) {
              console.log(`[ULTIMATE_POSTER] CreateTweet response had no parseable tweet_id; caller will try fallbacks`);
              if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                this.page?.off('response', responseHandler);
                resolve(null);
              }
              return;
            }

            const validation = assertValidTweetId(tweetId);
            if (!validation.valid) {
              console.error(`[ULTIMATE_POSTER] ❌ Invalid tweet_id from CreateTweet: ${validation.error}`);
              if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                this.page?.off('response', responseHandler);
                resolve(null);
              }
              return;
            }

            console.log(`[ULTIMATE_POSTER] ✅ Validated tweet_id from CreateTweet: ${tweetId}`);
            this.validatedTweetId = tweetId;
            this.capturedTweetId = tweetId;

            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              this.page?.off('response', responseHandler);
              resolve(tweetId);
            }
          } catch (jsonError: any) {
            console.error(`[ULTIMATE_POSTER] ❌ Failed to parse CreateTweet response: ${jsonError.message}`);
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              this.page?.off('response', responseHandler);
              reject(new Error(`Failed to parse CreateTweet response: ${jsonError.message}`));
            }
          }
        } catch (error: any) {
          // Ignore errors in handler (non-critical) - don't reject if already resolved
          if (!resolved) {
            console.warn(`[ULTIMATE_POSTER] ⚠️ Error in CreateTweet response handler: ${error.message}`);
          }
        }
      };

      this.page.on('response', responseHandler);
    });
  }

  /**
   * 🔒 TASK: Optional post-confirmation - verify tweet exists at URL
   */
  private async confirmTweetExists(tweetId: string, username: string): Promise<boolean> {
    if (!this.page) {
      return false;
    }

    try {
      const tweetUrl = `https://x.com/${username}/status/${tweetId}`;
      console.log(`[ULTIMATE_POSTER] 🔍 Confirming tweet exists: ${tweetUrl}`);

      // Navigate to tweet URL
      await this.page.goto(tweetUrl, { 
        waitUntil: 'networkidle',
        timeout: 15000 
      });

      // Check for "doesn't exist" error
      const errorText = await this.page.evaluate(() => {
        const bodyText = document.body.textContent || '';
        return bodyText.includes("doesn't exist") || 
               bodyText.includes("does not exist") ||
               bodyText.includes("This page doesn't exist");
      });

      if (errorText) {
        console.error(`[ULTIMATE_POSTER] ❌ Post-confirmation failed: Tweet ${tweetId} does not exist`);
        return false;
      }

      // Check for tweet article (tweet exists)
      const tweetArticle = await this.page.locator('article[data-testid="tweet"]').first();
      const exists = await tweetArticle.isVisible({ timeout: 5000 }).catch(() => false);

      if (exists) {
        console.log(`[ULTIMATE_POSTER] ✅ Post-confirmation successful: Tweet ${tweetId} exists`);
        return true;
      } else {
        console.warn(`[ULTIMATE_POSTER] ⚠️ Post-confirmation: Tweet article not found (may be loading)`);
        return false; // Conservative - assume it doesn't exist if we can't find it
      }
    } catch (error: any) {
      console.warn(`[ULTIMATE_POSTER] ⚠️ Post-confirmation error: ${error.message}`);
      return false; // Conservative - assume it doesn't exist on error
    }
  }

  /** PROOF_MODE: Collect visible error/toast/alert strings from page for 226 observability. */
  private async getPageErrorClues(): Promise<{ toastOrAlertPresent: boolean; visibleErrorStrings: string[]; toastTextPrimary: string | null }> {
    if (!this.page) return { toastOrAlertPresent: false, visibleErrorStrings: [], toastTextPrimary: null };
    try {
      return await this.page.evaluate(() => {
        const strings: string[] = [];
        const sel = [
          '[role="alert"]',
          '[data-testid*="error"]',
          '[data-testid*="toast"]',
          '[class*="toast"]',
          '[class*="snackbar"]',
          '[class*="Toast"]',
          '[aria-live="polite"]',
          '[aria-live="assertive"]',
          '[role="status"]',
        ];
        const seen = new Set<string>();
        sel.forEach((s) => {
          try {
            document.querySelectorAll(s).forEach((el) => {
              const t = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 300);
              if (t && t.length > 2 && !seen.has(t)) {
                seen.add(t);
                strings.push(t);
              }
            });
          } catch (_) {}
        });
        const visibleErrorStrings = strings.slice(0, 15);
        const toastTextPrimary = visibleErrorStrings.length > 0
          ? visibleErrorStrings.reduce((a, b) => (a.length >= b.length ? a : b), '')
          : null;
        return { toastOrAlertPresent: visibleErrorStrings.length > 0, visibleErrorStrings, toastTextPrimary };
      });
    } catch (e: any) {
      return { toastOrAlertPresent: false, visibleErrorStrings: [], toastTextPrimary: null };
    }
  }

  /** PROOF_MODE: Detect if an interstitial/challenge/modal (e.g. verification) is present. */
  private async getInterstitialOrChallengePresent(): Promise<boolean> {
    if (!this.page) return false;
    try {
      return await this.page.evaluate(() => {
        const sel = [
          '[data-testid*="challenge"]',
          '[data-testid*="captcha"]',
          '[data-testid*="verification"]',
          'form[action*="verify"]',
        ];
        for (const s of sel) {
          try {
            if (document.querySelector(s)) return true;
          } catch (_) {}
        }
        const dialogs = document.querySelectorAll('div[role="dialog"]');
        for (let i = 0; i < dialogs.length; i++) {
          const text = (dialogs[i].textContent || '').toLowerCase();
          if (text.includes('verify') || text.includes('phone') || text.includes('unusual') || text.includes('suspicious')) return true;
        }
        return false;
      });
    } catch (_) {
      return false;
    }
  }

  /** PROOF_MODE: After submit click, check DOM clues (server reject vs client failure). */
  private async getPostClickDomClues(typedContentPreview: string): Promise<{
    composerCleared: boolean;
    tweetBoxClosed: boolean;
    homeTimelineVisible: boolean;
    typedContentStillInCompose: boolean;
  }> {
    if (!this.page) return { composerCleared: false, tweetBoxClosed: false, homeTimelineVisible: false, typedContentStillInCompose: false };
    try {
      const preview = (typedContentPreview || '').slice(0, 40);
      return await this.page.evaluate((previewText) => {
        const composer = document.querySelector('div[contenteditable="true"][role="textbox"]');
        const composerText = (composer?.textContent || '').trim();
        const composerCleared = !composerText || composerText.length < 3;
        const tweetBox = document.querySelector('[data-testid="tweetTextarea_0"]') ?? document.querySelector('[data-testid="primaryColumn"] div[contenteditable="true"]');
        const tweetBoxClosed = !tweetBox || (tweetBox as HTMLElement).offsetParent === null;
        const main = document.querySelector('main[role="main"]');
        const homeTimelineVisible = !!main && (main.textContent || '').length > 100;
        const typedContentStillInCompose = previewText ? composerText.includes(previewText) : false;
        return { composerCleared, tweetBoxClosed, homeTimelineVisible, typedContentStillInCompose };
      }, preview);
    } catch (e: any) {
      return { composerCleared: false, tweetBoxClosed: false, homeTimelineVisible: false, typedContentStillInCompose: false };
    }
  }

  /**
   * Capture POST_ID_CAPTURE_FAILED with failure code and optional proof artifact (no secrets).
   */
  private async capturePostIdCaptureFailed(
    reason: string,
    detail: string,
    decisionId?: string,
    failureCode?: string,
    proofArtifact?: {
      decisionId?: string;
      proofTag?: string;
      expectedAccount?: string;
      struct?: ReturnType<typeof getCreateTweetResponseStructure>;
      observability226?: {
        createTweetResponseShape: string;
        pageUrl: string;
        url_at_226_detection: string;
        toastOrAlertPresent: boolean;
        visibleErrorStrings: string[];
        toastTextPrimary: string | null;
        interstitialOrChallengePresent: boolean;
      };
      postClickDom?: { composerCleared: boolean; tweetBoxClosed: boolean; homeTimelineVisible: boolean; typedContentStillInCompose: boolean };
      createTweetErrorsPayload?: Array<{ code?: string; message?: string; kind?: string }> | null;
    }
  ): Promise<void> {
    try {
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
      const debugDir = join(process.env.RUNNER_PROFILE_DIR || process.cwd(), 'debug');
      let screenshotPath: string | null = null;
      let domExcerpt: string | null = null;

      if (this.page) {
        try {
          mkdirSync(debugDir, { recursive: true });
          const timestamp = Date.now();
          screenshotPath = join(debugDir, `post-id-capture-failed-${timestamp}.png`);
          await this.page.screenshot({ path: screenshotPath, fullPage: true });
          domExcerpt = await this.page.evaluate(() => document.body.innerHTML.substring(0, 5000));
        } catch (captureError: any) {
          console.warn(`[ULTIMATE_POSTER] ⚠️ Failed to capture debug artifacts: ${captureError.message}`);
        }
      }

      const eventData: Record<string, unknown> = {
        decision_id: decisionId || null,
        reason,
        detail,
        failure_code: failureCode || 'POST_ID_CAPTURE_FAILED',
        screenshot_path: screenshotPath,
        dom_excerpt: domExcerpt ? domExcerpt.substring(0, 1000) : null,
        captured_tweet_id: this.capturedTweetId || null,
        validated_tweet_id: this.validatedTweetId || null,
        page_url: this.page?.url() || null,
      };

      let artifactPath: string | null = null;
      if (proofArtifact) {
        const artifact: Record<string, unknown> = {
          decision_id: proofArtifact.decisionId ?? decisionId,
          proof_tag: proofArtifact.proofTag ?? null,
          expected_account: proofArtifact.expectedAccount ?? null,
          failure_code: failureCode ?? null,
          response_top_keys: proofArtifact.struct?.topKeys ?? null,
          discovered_paths: proofArtifact.struct?.discoveredPaths?.slice(0, 40) ?? null,
          errors_present: proofArtifact.struct?.errorsPresent ?? null,
          errors_count: proofArtifact.struct?.errorsCount ?? null,
          error_codes: proofArtifact.struct?.errorCodes ?? null,
          create_tweet_errors_payload: proofArtifact.createTweetErrorsPayload ?? null,
          content_match_found: null,
          status_link_found: null,
          observability_226: proofArtifact.observability226 ?? null,
          post_click_dom: proofArtifact.postClickDom ?? null,
        };
        try {
          artifactPath = join(debugDir, `proof-capture-failed-${Date.now()}.json`);
          writeFileSync(artifactPath, JSON.stringify(artifact, null, 2), 'utf-8');
          console.log(`[PROOF_ARTIFACT] debug_json=${artifactPath}`);
          eventData.proof_artifact_path = artifactPath;
        } catch (e: any) {
          console.warn(`[PROOF_ARTIFACT] Failed to write JSON: ${e?.message || e}`);
        }
      }

      await supabase.from('system_events').insert({
        event_type: 'POST_ID_CAPTURE_FAILED',
        severity: 'error',
        message: `Failed to capture validated tweet_id: ${reason} (${failureCode || 'POST_ID_CAPTURE_FAILED'})`,
        event_data: eventData,
        created_at: new Date().toISOString(),
      });

      console.error(`[ULTIMATE_POSTER] ❌ POST_ID_CAPTURE_FAILED: ${failureCode || 'POST_ID_CAPTURE_FAILED'} - ${reason} - ${detail}`);
      if (screenshotPath) console.error(`[ULTIMATE_POSTER] 📸 Screenshot saved: ${screenshotPath}`);

      // 226 proof failure: artifact summary and optional manual-verify message
      if (failureCode === 'X_CREATE_TWEET_REJECTED_226' && proofArtifact) {
        const errorCodesStr = proofArtifact.struct?.errorCodes?.length ? proofArtifact.struct.errorCodes.join(',') : '226';
        console.error(`[PROOF_226_SUMMARY] failure_code=X_CREATE_TWEET_REJECTED_226`);
        console.error(`[PROOF_226_SUMMARY] error_codes=${errorCodesStr}`);
        console.error(`[PROOF_226_SUMMARY] screenshot_path=${screenshotPath ?? 'none'}`);
        console.error(`[PROOF_226_SUMMARY] debug_json_path=${artifactPath ?? 'none'}`);
        console.error(`[PROOF_226_SUMMARY] account_auth_navigation_composer_submit_click=succeeded_before_server_rejection`);
        if (proofArtifact.createTweetErrorsPayload?.length) {
          console.error(`[PROOF_226_SUMMARY] create_tweet_errors_payload=${JSON.stringify(proofArtifact.createTweetErrorsPayload)}`);
        }
        if (proofArtifact.observability226) {
          const obs = proofArtifact.observability226;
          console.error(`[PROOF_226_SUMMARY] create_tweet_response_shape=${obs.createTweetResponseShape} page_url=${obs.pageUrl} url_at_226=${obs.url_at_226_detection}`);
          console.error(`[PROOF_226_SUMMARY] toast_alert_present=${obs.toastOrAlertPresent} toast_text_primary=${obs.toastTextPrimary ?? 'null'} interstitial_or_challenge=${obs.interstitialOrChallengePresent}`);
          console.error(`[PROOF_226_SUMMARY] visible_errors=${JSON.stringify(obs.visibleErrorStrings)}`);
        }
        if (proofArtifact.postClickDom) {
          console.error(`[PROOF_226_SUMMARY] post_click_dom composer_cleared=${proofArtifact.postClickDom.composerCleared} tweet_box_closed=${proofArtifact.postClickDom.tweetBoxClosed} home_visible=${proofArtifact.postClickDom.homeTimelineVisible} content_still_in_compose=${proofArtifact.postClickDom.typedContentStillInCompose}`);
        }
        if (process.env.PROOF_ALLOW_MANUAL_VERIFY === 'true') {
          console.log(`[PROOF_MANUAL_VERIFY] X rejected automated submit (226). To validate posting mechanics, retry later or manually post from the same account/profile.`);
        }
      }
    } catch (error: any) {
      console.error(`[ULTIMATE_POSTER] ⚠️ Failed to log POST_ID_CAPTURE_FAILED: ${error.message}`);
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
          recordAction();
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

    if (this.validatedTweetId) {
      const validation = assertValidTweetId(this.validatedTweetId);
      if (!validation.valid) {
        throw new Error(`Invalid validated tweet_id: ${validation.error}`);
      }
      const tweetUrl = `https://x.com/${username}/status/${this.validatedTweetId}`;
      return { tweetId: this.validatedTweetId, tweetUrl };
    }

    throw new Error('POST_ID_CAPTURE_FAILED: No validated tweet_id available (GraphQL or fallbacks exhausted)');
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
  async postReply(
    content: string,
    replyToTweetId: string,
    guard?: PostingGuard,
    terminal226Ref?: { terminal226: boolean; decisionId?: string; targetTweetId?: string }
  ): Promise<PostResult> {
    // 🔒 GUARD CHECK: Block unauthorized posting
    const verification = verifyPostingGuard(guard, 'postReply');
    if (!verification.valid) {
      return { success: false, error: (verification as { valid: false; error: string }).error };
    }
    const validGuard = (verification as { valid: true; guard: PostingGuard }).guard;

    // Reply text review: length + first ~120 chars (for comparing blocked replies; no secrets)
    const replyPreview = content.slice(0, 120).replace(/\s+/g, ' ');
    console.log(`[REPLY_TEXT_REVIEW] decision_id=${validGuard.decision_id} length=${content.length} preview=${replyPreview}${content.length > 120 ? '…' : ''}`);

    // Terminal 226 guard: if a prior attempt already set 226 (e.g. extraction unwinding), do not start another attempt
    if (terminal226Ref?.terminal226) {
      const err = new Error(`POST_BLOCKED_BY_X_226: CreateTweet error 226. Parent=${replyToTweetId} decision_id=${validGuard.decision_id}`);
      (err as any).xError226 = true;
      throw err;
    }

    // 📊 COMPREHENSIVE LOGGING: Build fingerprint for audit trail
    const BUILD_SHA = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || 'dev';
    const DB_URL = process.env.DATABASE_URL || '';
    const DB_ENV_FINGERPRINT = require('crypto').createHash('md5').update(DB_URL).digest('hex').substring(0, 8);

    console.log(`[POST_REPLY] 🔐 Authorized via guard: decision_id=${validGuard.decision_id} target=${replyToTweetId}`);
    console.log(`[POST_REPLY] 📊 AUDIT_TRAIL: decision_id=${validGuard.decision_id} target_tweet_id=${replyToTweetId} pipeline_source=${validGuard.pipeline_source} job_run_id=${validGuard.job_run_id} build_sha=${BUILD_SHA} db_env=${DB_ENV_FINGERPRINT}`);

    let retryCount = 0;
    const maxRetries = 1; // At most 2 attempts to avoid 429/consent on repeated navigations
    // 🧪 TEST BYPASS: RUNNER_TEST_MODE=true (requires RUNNER_MODE=true)
    // Declare once at function scope for reuse
    const isTestMode = process.env.RUNNER_TEST_MODE === 'true' && process.env.RUNNER_MODE === 'true';

    console.log(`ULTIMATE_POSTER: Posting reply to tweet ${replyToTweetId} (guard: ${validGuard.decision_id})`);

    while (retryCount <= maxRetries) {
      if (terminal226Ref?.terminal226) {
        const err = new Error(`POST_BLOCKED_BY_X_226: CreateTweet error 226. Parent=${replyToTweetId} decision_id=${validGuard.decision_id}`);
        (err as any).xError226 = true;
        throw err;
      }
      const sessionRefreshesBefore = this.sessionRefreshes;
      let composerAttempts = 0;
      const telemetry = new ReplyPostingTelemetry(validGuard.decision_id, replyToTweetId, retryCount + 1);
      const attemptContext: { terminalPostFailure: string | null } = { terminalPostFailure: null };
      let last226CreateTweetErrors: any[] | undefined;
      try {
        console.log(`ULTIMATE_POSTER: Reply attempt ${retryCount + 1}/${maxRetries + 1}`);
        await this.prepareForAttempt(retryCount);
        
        await this.ensureContext();
        
        if (!this.page) throw new Error('Page not initialized');

        // 🔍 FORENSIC PIPELINE: Final hard gate - verify ancestry before posting
        // 🧪 TEST BYPASS: Reuse isTestMode from function scope
        const bypassAncestry = isTestMode;
        const canaryModeForAncestry = process.env.CANARY_MODE === 'true';
        
        // 🎯 CANARY BYPASS: If draft is marked canary_eligible, bypass ancestry check
        let canaryEligibleBypass = false;
        if (canaryModeForAncestry) {
          const { getSupabaseClient } = await import('../db/index');
          const supabase = getSupabaseClient();
          const { data: draftMeta } = await supabase
            .from('content_metadata')
            .select('features')
            .eq('decision_id', validGuard.decision_id)
            .maybeSingle();
          
          const features = (draftMeta?.features || {}) as Record<string, any>;
          canaryEligibleBypass = features.canary_eligible === true;
          
          if (canaryEligibleBypass) {
            console.log(`[ULTIMATE_POSTER] 🎯 CANARY_ELIGIBLE: Bypassing ancestry check (draft pre-verified)`);
          }
        }
        
        const { resolveTweetAncestry, shouldAllowReply } = await import('../jobs/replySystemV2/replyDecisionRecorder');
        
        let allowCheck: { allow: boolean; reason: string };
        let ancestry: any = null; // Initialize for logging
        
        if (bypassAncestry || canaryEligibleBypass) {
          if (bypassAncestry) {
            console.log(`[ULTIMATE_POSTER] 🧪 TEST MODE: BYPASS_ACTIVE: ANCESTRY_CHECK`);
            allowCheck = { allow: true, reason: 'TEST_BYPASS_ANCESTRY' };
            ancestry = { ancestryDepth: null, isRoot: true }; // Dummy for logging
          } else {
            console.log(`[ULTIMATE_POSTER] 🎯 CANARY_ELIGIBLE: BYPASS_ACTIVE: ANCESTRY_CHECK`);
            allowCheck = { allow: true, reason: 'CANARY_ELIGIBLE_BYPASS' };
            ancestry = { ancestryDepth: 0, isRoot: true }; // Dummy for logging (canary-eligible = root)
          }
        } else {
          // Set CANARY_MODE for ancestry resolution (enables escalation)
          if (canaryModeForAncestry) {
            process.env.CANARY_MODE = 'true';
          }
          
          // Clear cache for canary mode to force re-resolution with escalation
          if (canaryModeForAncestry) {
            const supabase = await import('../db/index').then(m => m.getSupabaseClient());
            await supabase.from('reply_ancestry_cache').delete().eq('tweet_id', replyToTweetId);
            console.log(`[ULTIMATE_POSTER] 🔄 CANARY_MODE: Cleared ancestry cache for re-resolution`);
          }
          
          ancestry = await resolveTweetAncestry(replyToTweetId);
          
          allowCheck = await shouldAllowReply(ancestry, { 
            decision_id: validGuard.decision_id,
            tweet_id: replyToTweetId,
          });
        }
        
        if (!allowCheck.allow) {
          // In canary mode, ANCESTRY_UNCERTAIN_SKIP means we should skip this candidate, not fail
          if (canaryModeForAncestry && allowCheck.reason === 'ANCESTRY_UNCERTAIN_SKIP') {
            const errorMsg = `CANARY_SKIP: ${allowCheck.reason}`;
            console.log(`[ULTIMATE_POSTER] ⏭️  ${errorMsg} - Skipping this candidate`);
            throw new Error(errorMsg);
          }
          
          const errorMsg = `FINAL_PLAYWRIGHT_GATE_BLOCKED: ${allowCheck.reason}`;
          console.error(`[ULTIMATE_POSTER] 🚫 ${errorMsg}`);
          throw new Error(errorMsg);
        }
        
        console.log(`[ULTIMATE_POSTER] ✅ Final gate passed: depth=${ancestry?.ancestryDepth ?? 'N/A'}, root=${ancestry?.isRoot ?? 'N/A'}`);
        
        // Navigate to the tweet
        console.log(`ULTIMATE_POSTER: Navigating to tweet ${replyToTweetId}...`);
        const parentTweetUrl = `https://x.com/i/status/${replyToTweetId}`;
        await this.page.goto(parentTweetUrl, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });

        await this.page.waitForTimeout(2000);
        
        // 🔒 CONSENT WALL: Handle immediately after navigation
        const { handleConsentWall } = await import('../utils/handleConsentWall');
        const consentResult = await handleConsentWall(this.page, { url: parentTweetUrl, operation: 'reply_post' });
        if (consentResult.classified === 'INFRA_BLOCK_CONSENT_WALL') {
          throw new Error(`INFRA_BLOCK_CONSENT_WALL: Consent wall not cleared after navigation`);
        }
        
        telemetry.mark('navigation_complete');

        // Check authentication
        const isLoggedOut = await this.checkIfLoggedOut();
        if (isLoggedOut) {
          throw new Error('Not logged in - session expired');
        }

        // 226 mitigation: pre-action (scroll + read simulation) before focusing composer
        const usePreAction = process.env.PROOF_MODE === 'true' || process.env.REPLY_PRE_ACTION_DWELL === 'true';
        if (usePreAction && this.page) {
          const initialWait = 1000 + Math.floor(Math.random() * 1000);
          await this.page.waitForTimeout(initialWait);
          await this.page.evaluate(() => {
            window.scrollBy(0, 180);
          }).catch(() => {});
          await this.page.waitForTimeout(800 + Math.floor(Math.random() * 400));
          await this.page.evaluate(() => {
            window.scrollBy(0, -80);
          }).catch(() => {});
          const readDwell = 3000 + Math.floor(Math.random() * 4000);
          console.log(`[REPLY_226_MITIGATION] pre-action: scroll + read simulation ${readDwell}ms`);
          await this.page.waitForTimeout(readDwell);
        }

        const replyStageStart = Date.now();
        const replyTimings: Record<string, number> = {};

        console.log(`ULTIMATE_POSTER: Focusing reply composer...`);

        let composer: Locator | null = null;

        // FAST PATH: Click reply icon → find dialog composer directly (skips ensureComposerFocused)
        // This is the proven reliable path: reply icon opens modal, dialog textbox is immediately available
        try {
          const replyIcon = this.page.locator('[data-testid="reply"]').first();
          await replyIcon.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
          await replyIcon.click({ timeout: 5000 });
          console.log(`ULTIMATE_POSTER: Clicked reply icon — looking for dialog composer...`);
          await this.page.waitForTimeout(1500);

          // Directly find the composer — dialog OR inline (fast: ~1-2s instead of 24s via ensureComposerFocused)
          const dialogSelectors = [
            'div[role="dialog"] div[role="textbox"][contenteditable="true"]',
            'div[aria-modal="true"] div[role="textbox"][contenteditable="true"]',
            'div[role="dialog"] [data-testid^="tweetTextarea_"] div[contenteditable="true"]',
            '[data-testid="tweetTextarea_0"] div[contenteditable="true"]', // Inline composer (no dialog)
            'div[contenteditable="true"][role="textbox"]',
          ];
          for (const selector of dialogSelectors) {
            try {
              const candidate = this.page.locator(selector).first();
              await candidate.waitFor({ state: 'visible', timeout: 3000 });
              composer = candidate;
              console.log(`ULTIMATE_POSTER: ⚡ Fast-path composer found via "${selector}"`);
              telemetry.mark('composer_ready');
              composerAttempts += 1;
              break;
            } catch { continue; }
          }
        } catch (replyIconErr: any) {
          console.log(`ULTIMATE_POSTER: Reply icon click failed (${replyIconErr.message}), falling back to full focus`);
        }

        // SLOW PATH: Only if fast path failed — use ensureComposerFocused as fallback
        if (!composer) {
          console.log(`ULTIMATE_POSTER: Fast path missed — trying ensureComposerFocused...`);
          try {
            const focusResult = await ensureComposerFocused(this.page, { mode: 'reply' });
            if (focusResult.success && focusResult.element) {
              composer = focusResult.element as Locator;
              console.log(`ULTIMATE_POSTER: Composer focused via ensureComposerFocused (${focusResult.selectorUsed || 'default'})`);
              telemetry.mark('composer_ready');
              composerAttempts += 1;
            }
          } catch (focusError: any) {
            console.warn(`ULTIMATE_POSTER: ensureComposerFocused failed (${focusError.message})`);
          }
        }

        // LAST RESORT: Click any reply button + find any contenteditable
        if (!composer) {
          console.log(`ULTIMATE_POSTER: All focus methods failed — last resort reply button click`);
          const replyButtonSelectors = [
            '[data-testid="reply"]', '[data-testid="replyButton"]',
            'button[aria-label*="Reply"]', 'div[role="button"]:has-text("Reply")',
          ];
          for (const selector of replyButtonSelectors) {
            try {
              const button = this.page.locator(selector).first();
              await button.waitFor({ state: 'visible', timeout: 3000 });
              await button.click({ delay: 40 });
              console.log(`ULTIMATE_POSTER: Last-resort clicked reply via "${selector}"`);
              await this.page.waitForTimeout(1500);
              break;
            } catch { continue; }
          }
          const lastResortSelectors = [
            'div[role="dialog"] div[role="textbox"][contenteditable="true"]',
            '[data-testid="tweetTextarea_0"] div[contenteditable="true"]',
            '[contenteditable="true"]',
          ];
          for (const selector of lastResortSelectors) {
            try {
              const candidate = this.page.locator(selector).first();
              await candidate.waitFor({ state: 'visible', timeout: 3000 });
              composer = candidate;
              console.log(`ULTIMATE_POSTER: Last-resort composer via "${selector}"`);
              composerAttempts += 1;
              telemetry.mark('composer_ready');
              break;
            } catch { continue; }
          }
          if (!composer) {
            throw new Error('Reply composer not found after all attempts');
          }
        }

        // 🎧 SETUP NETWORK LISTENER BEFORE POSTING (listener sets attemptContext + terminal226Ref on 226)
        ImprovedReplyIdExtractor.setupNetworkListener(this.page, { attemptContext, terminal226Ref });
        
        // Type reply content
        console.log(`ULTIMATE_POSTER: Typing reply content (${content.length} chars)...`);

        // Ensure composer is focused before typing — click with retry (critical for headless modal dialogs)
        for (let clickAttempt = 0; clickAttempt < 3; clickAttempt++) {
          try {
            await composer.click({ delay: 50, timeout: 5000 });
            console.log(`[REPLY_STAGE] composer_click=ok attempt=${clickAttempt + 1}`);
            break;
          } catch (clickErr: any) {
            console.warn(`[REPLY_STAGE] composer_click=failed attempt=${clickAttempt + 1}: ${clickErr.message}`);
            if (clickAttempt === 2) {
              // Last resort: focus via evaluate
              await composer.evaluate((el: any) => el.focus()).catch(() => {});
            }
            await this.page.waitForTimeout(500);
          }
        }
        await this.page.waitForTimeout(300);

        const selectAllShortcut = process.platform === 'darwin' ? 'Meta+A' : 'Control+A';
        let composed = false;
        let replyInputMethod: 'fill' | 'keyboard_type' | 'keyboard_type_fallback' = 'keyboard_type';
        let replyTypeDelayMs: number | null = null;

        // PRIMARY: Human-like typing (stealth: variable delays + thinking pauses)
        try {
          console.log(`[REPLY_STAGE] stage=pre_type method=humanType len=${content.length}`);
          const typeTimeout = Math.max(60000, content.length * 250);
          await Promise.race([
            humanTypeIntoFocused(this.page, content),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`humanType timeout after ${typeTimeout}ms`)), typeTimeout)),
          ]);
          composed = true;
          replyInputMethod = 'keyboard_type';
          replyTypeDelayMs = 90; // approximate avg for logging
          console.log(`[REPLY_STAGE] stage=typed method=humanType ok=true`);
        } catch (typeError: any) {
          console.warn(`ULTIMATE_POSTER: humanType failed: ${typeError.message}`);
        }

        // FALLBACK: keyboard.type with modest delay (if humanType failed, e.g. timeout)
        if (!composed) {
          try {
            console.log(`[REPLY_STAGE] stage=pre_type_fallback method=keyboard`);
            await Promise.race([
              this.page.keyboard.type(content, { delay: 25 }),
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error('keyboard.type fallback timeout')), 30000)),
            ]);
            composed = true;
            replyInputMethod = 'keyboard_type_fallback' as any;
            replyTypeDelayMs = 25;
            console.log(`[REPLY_STAGE] stage=typed method=keyboard_fallback ok=true`);
          } catch (fallbackError: any) {
            console.warn(`ULTIMATE_POSTER: keyboard.type fallback failed: ${fallbackError.message}`);
          }
        }

        // LAST RESORT: selectAll + keyboard.type
        this.lastAttemptSummary = { typingMode: replyInputMethod, clickDelayMs: 50, preSubmitDwellMs: 0 };
        if (!composed) {
          console.log(`[REPLY_STAGE] stage=last_resort_type`);
          try { await composer.press(selectAllShortcut); } catch {
            await this.page.keyboard.press(selectAllShortcut).catch(() => undefined);
          }
          await this.page.keyboard.type(content, { delay: 25 });
          composed = true;
          replyInputMethod = 'keyboard_type_fallback';
          replyTypeDelayMs = 25;
        }
        replyTimings.compose_and_type_ms = Date.now() - replyStageStart;
        console.log(`[REPLY_INPUT] reply_input_method=${replyInputMethod} content_len=${content.length}${replyTypeDelayMs != null ? ` delay_ms_per_char=${replyTypeDelayMs}` : ''} compose_time=${replyTimings.compose_and_type_ms}ms`);

        // Verify content was actually inserted
        try {
          const insertedText = await composer.textContent();
          if (!insertedText || !insertedText.includes(content.substring(0, 20))) {
            console.warn(`[REPLY_STAGE] content_verify=MISMATCH inserted="${(insertedText || '').slice(0, 40)}..." expected="${content.slice(0, 40)}..."`);
            // Dispatch input events to trigger React state update
            await composer.evaluate((el: any) => {
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }).catch(() => {});
          } else {
            console.log(`[REPLY_STAGE] content_verify=ok`);
          }
        } catch { /* non-blocking */ }

        await this.page.waitForTimeout(500);

        // 🔒 SERVICE_ROLE CHECK: Use role resolver (single source of truth)
        const { isWorkerService } = await import('../utils/serviceRoleResolver');
        const isWorker = isWorkerService();
        // 🔧 TASK: Allow RUNNER_MODE to bypass SERVICE_ROLE check (runner is trusted)
        const isRunnerModeReply = process.env.RUNNER_MODE === 'true';
        const isTestModeReply = process.env.RUNNER_TEST_MODE === 'true' && process.env.RUNNER_MODE === 'true';
        const bypassServiceRole = isRunnerModeReply || isTestModeReply;

        if (!isWorker && !bypassServiceRole) {
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
        
        if (bypassServiceRole) {
          console.log(`[ULTIMATE_POSTER] 🧪 TEST MODE: BYPASS_ACTIVE: SERVICE_ROLE_CHECK`);
        }
        
        // 🔒 SEV1 GHOST ERADICATION: Pipeline source must be reply_v2_scheduler (or postingQueue for timeline posts)
        // 🔧 TASK: Allow postingQueue for timeline posts in RUNNER_MODE
        // 🎯 CANARY_MODE: Allow canary_post for canary testing
        const canaryModeForPosting = process.env.CANARY_MODE === 'true';
        const allowedSources = ['reply_v2_scheduler', 'postingQueue'];
        if (canaryModeForPosting) {
          allowedSources.push('canary_post');
        }
        
        if (!allowedSources.includes(validGuard.pipeline_source) && !isRunnerModeReply) {
          const errorMsg = `[SEV1_GHOST_BLOCK] ❌ BLOCKED: Invalid pipeline_source. source=${validGuard.pipeline_source} required=${allowedSources.join(' or ')}`;
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
        // 🎯 CANARY_MODE: Bypass permit check for canary testing
        const canaryModeForPermit = process.env.CANARY_MODE === 'true';
        const { verifyPostingPermit } = await import('./postingPermit');
        const permit_id = (validGuard as any).permit_id;
        
        if (!permit_id && !canaryModeForPermit) {
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
        
        // Verify permit is APPROVED (skip in canary mode)
        let permitCheck: { valid: boolean; approved?: boolean; permit?: { status?: string }; error?: string };
        const canaryModeForPermitCheck = process.env.CANARY_MODE === 'true';
        if (canaryModeForPermitCheck) {
          console.log(`[PERMIT_CHOKE] 🎯 CANARY_MODE: Bypassing permit verification`);
          permitCheck = { valid: true, approved: true };
        } else {
          permitCheck = await verifyPostingPermit(permit_id);
        }
        
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
        
        // 226 mitigation: pre-submit dwell so submit isn't instant after typing
        // PROOF_MODE: use 5–20s human-like delay; otherwise env or default 2–5s
        const isProofModeDwell = process.env.PROOF_MODE === 'true';
        const replyDwellMinMs = isProofModeDwell
          ? parseInt(process.env.REPLY_PRE_SUBMIT_DWELL_MIN_MS || '5000', 10)
          : parseInt(process.env.REPLY_PRE_SUBMIT_DWELL_MIN_MS || '2000', 10);
        const replyDwellMaxMs = isProofModeDwell
          ? parseInt(process.env.REPLY_PRE_SUBMIT_DWELL_MAX_MS || '20000', 10)
          : parseInt(process.env.REPLY_PRE_SUBMIT_DWELL_MAX_MS || '5000', 10);
        const dwellMs = Math.min(30000, Math.max(0, replyDwellMinMs + Math.floor(Math.random() * (replyDwellMaxMs - replyDwellMinMs + 1))));
        if (dwellMs > 0) {
          console.log(`[REPLY_226_MITIGATION] pre-submit dwell ${dwellMs}ms${isProofModeDwell ? ' (PROOF_MODE 5–20s)' : ''}`);
          await this.page.waitForTimeout(dwellMs);
        }

        // Find and click post button — prefer dialog-scoped selectors (reply modal)
        const postButtonSelectors = [
          'div[role="dialog"] [data-testid="tweetButton"]',
          'div[role="dialog"] [data-testid="tweetButtonInline"]',
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
        const replyClickDelayMs = Math.min(150, Math.max(40, parseInt(process.env.REPLY_POST_CLICK_DELAY_MS || '80', 10) + Math.floor(Math.random() * 40)));
        for (const selector of postButtonSelectors) {
          try {
            const button = this.page.locator(selector).first();
            await button.waitFor({ state: 'visible', timeout: 2000 });
            await button.click({ delay: replyClickDelayMs });
            posted = true;
            console.log(`ULTIMATE_POSTER: Clicked post button: "${selector}" (permit: ${permit_id}, click_delay=${replyClickDelayMs}ms)`);
            break;
          } catch (e) {
            continue;
          }
        }

        if (!posted) {
          throw new Error('Could not click post button');
        }
        replyTimings.submit_ms = Date.now() - replyStageStart - (replyTimings.compose_and_type_ms || 0);
        telemetry.mark('post_clicked');

        // Wait for post to complete
        await this.page.waitForTimeout(3000);

        const replySnippet = typeof content === 'string' ? content.slice(0, 60) : undefined;

        const throw226 = async (extractionResult: { createTweetErrors?: any[] }) => {
          last226CreateTweetErrors = extractionResult.createTweetErrors;
          if (terminal226Ref) terminal226Ref.terminal226 = true;
          console.log('[REPLY_POST_BLOCKED] reason=X_226 terminal=true');
          console.log('[POST_ATTEMPT_ABORT] reason=X_226 cancelled_pending_extractors=true cancelled_retries=true');
          try {
            const { addCreateTweet226Cooldown } = await import('../utils/createTweet226Cooldown');
            addCreateTweet226Cooldown(replyToTweetId);
          } catch (_) { /* non-blocking */ }
          const err = new Error(`POST_BLOCKED_BY_X_226: CreateTweet error 226 (automation/spam block). Parent=${replyToTweetId} decision_id=${validGuard.decision_id}`);
          (err as any).xError226 = true;
          (err as any).createTweetErrors = extractionResult.createTweetErrors;
          throw err;
        };

        // 🔍 IMPROVED EXTRACTION with shared attempt context + terminal226Ref (abort on 226)
        let extractionResult = await ImprovedReplyIdExtractor.extractReplyId(
          this.page,
          replyToTweetId,
          15000,
          { replyTextSnippet: replySnippet, maxWaitMs: 15000, attemptContext, terminal226Ref }
        );

        if (extractionResult.xError226 || attemptContext.terminalPostFailure === 'POST_BLOCKED_BY_X_226') {
          await throw226(extractionResult);
        }

        if (!extractionResult.success || !extractionResult.tweetId) {
          if (attemptContext.terminalPostFailure === 'POST_BLOCKED_BY_X_226' || terminal226Ref?.terminal226) {
            await throw226(extractionResult);
          }
          if (extractionResult.strongEvidence && !terminal226Ref?.terminal226) {
            console.log('ULTIMATE_POSTER: Strong evidence of success (composer dismissed/reply in DOM), retrying extraction without navigation...');
            await this.page.waitForTimeout(2000).catch(() => {});
            const noNavPass = await ImprovedReplyIdExtractor.extractReplyId(
              this.page,
              replyToTweetId,
              12000,
              { skipNavigationStrategies: true, replyTextSnippet: replySnippet, maxWaitMs: 12000, attemptContext, terminal226Ref }
            );
            if (attemptContext.terminalPostFailure === 'POST_BLOCKED_BY_X_226' || terminal226Ref?.terminal226) await throw226(noNavPass);
            if (noNavPass.success && noNavPass.tweetId) {
              extractionResult = { success: true, tweetId: noNavPass.tweetId, strategy: noNavPass.strategy ?? 'dom_same_page' };
              console.log(`ULTIMATE_POSTER: ✅ No-nav retry succeeded via ${extractionResult.strategy}`);
            }
          }
          if (!extractionResult.success && !extractionResult.tweetId && attemptContext.terminalPostFailure !== 'POST_BLOCKED_BY_X_226' && !terminal226Ref?.terminal226) {
            console.warn('ULTIMATE_POSTER: ⚠️ Initial reply ID extraction failed, one full retry...');
            await this.page.waitForTimeout(2000).catch(() => {});
            const secondPass = await ImprovedReplyIdExtractor.extractReplyId(
              this.page,
              replyToTweetId,
              8000,
              { replyTextSnippet: replySnippet, attemptContext, terminal226Ref }
            );
            if (attemptContext.terminalPostFailure === 'POST_BLOCKED_BY_X_226' || terminal226Ref?.terminal226) await throw226(secondPass);
            if (secondPass.success && secondPass.tweetId) {
              extractionResult = {
                success: true,
                tweetId: secondPass.tweetId,
                strategy: secondPass.strategy ?? 'fallback'
              };
              console.log(`ULTIMATE_POSTER: ✅ Retry extraction succeeded via ${extractionResult.strategy} strategy`);
            }
          }
        }

        if (!extractionResult.success || !extractionResult.tweetId) {
          if (extractionResult.xError226 || attemptContext.terminalPostFailure === 'POST_BLOCKED_BY_X_226') {
            await throw226(extractionResult);
          }
          console.error(`ULTIMATE_POSTER: ❌ Reply ID extraction failed after posting`);
          if (extractionResult.strongEvidence) {
            console.warn('ULTIMATE_POSTER: ⚠️ Strong evidence of success - skipping retries to avoid 429/consent');
          }
          try {
            const deleted = await this.deleteTweetByContent(content, replyToTweetId);
            console.log(`ULTIMATE_POSTER: 🧹 Cleanup after reply failure ${deleted ? 'succeeded' : 'skipped'}`);
          } catch (cleanupError: any) {
            console.warn(`ULTIMATE_POSTER: cleanup error (secondary): ${cleanupError?.message}`);
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

        try {
          await this.dispose();
        } catch (disposeErr: any) {
          console.warn(`ULTIMATE_POSTER: dispose (secondary): ${disposeErr?.message}`);
        }
        replyTimings.total_ms = Date.now() - replyStageStart;
        recordAction();
        console.log(`[REPLY_TIMING] compose=${replyTimings.compose_and_type_ms || 0}ms submit=${replyTimings.submit_ms || 0}ms verify=${(replyTimings.total_ms - (replyTimings.compose_and_type_ms || 0) - (replyTimings.submit_ms || 0))}ms total=${replyTimings.total_ms}ms`);
        this.logAttemptSummary(validGuard, content.length, { targetTweetId: replyToTweetId });
        return {
          success: true,
          tweetId,
          tweetUrl
        };

      } catch (error: any) {
        const is226 = error?.message?.includes('POST_BLOCKED_BY_X_226') || error?.xError226 === true;
        const terminal226 = attemptContext?.terminalPostFailure === 'POST_BLOCKED_BY_X_226';
        if (terminal226 && !is226) {
          console.log('[POST_FINAL_REASON] POST_BLOCKED_BY_X_226 (preserved over secondary error)');
          const err = new Error(`POST_BLOCKED_BY_X_226: CreateTweet error 226. Parent=${replyToTweetId} decision_id=${validGuard.decision_id}`);
          (err as any).xError226 = true;
          (err as any).createTweetErrors = last226CreateTweetErrors;
          throw err;
        }
        console.error(`ULTIMATE_POSTER: Reply attempt ${retryCount + 1} failed:`, error.message);
        telemetry.setComposerAttempts(composerAttempts);
        telemetry.setSessionRefreshes(Math.max(0, this.sessionRefreshes - sessionRefreshesBefore));
        await telemetry.flush('failure', { error: error.message });
        if (is226) {
          this.logAttemptSummary(validGuard, content.length, { targetTweetId: replyToTweetId, platformError: error?.message });
          return { success: false, error: error.message };
        }
        try {
          await this.cleanup();
        } catch (cleanupErr: any) {
          console.warn(`ULTIMATE_POSTER: cleanup (secondary): ${cleanupErr?.message}`);
        }
        if (retryCount < maxRetries) {
          console.log('ULTIMATE_POSTER: Retrying reply with fresh context...');
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
          continue;
        }
        this.logAttemptSummary(validGuard, content.length, { targetTweetId: replyToTweetId, platformError: (error as Error)?.message });
        return { success: false, error: error.message };
      }
    }

    await this.cleanup();
    this.logAttemptSummary(validGuard, content.length, { targetTweetId: replyToTweetId, platformError: 'Max retries exceeded for reply' });
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

