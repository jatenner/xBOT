/**
 * 🔍 IMPROVED REPLY TWEET ID EXTRACTOR
 * 
 * Fixes reliability issues with tweet ID extraction after posting replies.
 * Uses layered fallback strategies to ensure we always get the real tweet ID.
 * 
 * Strategies:
 * 1. Network capture - Listen to Twitter API responses (most reliable)
 * 2. URL parsing - Extract from page URL after posting
 * 3. Profile scraping - Find the tweet from timeline (last resort)
 * 4. Conversation scrape - Inspect the parent thread for our reply
 */

import { Page, Response } from 'playwright';

export interface ExtractionResult {
  success: boolean;
  tweetId?: string;
  strategy?: 'network' | 'url' | 'profile' | 'fallback' | 'dom_same_page' | 'strong_evidence_placeholder';
  error?: string;
  /** True when composer dismissed and/or reply visible in DOM but ID not resolved */
  strongEvidence?: boolean;
  /** True when tweetId is a placeholder (reply posted but ID extraction failed) */
  provisionalId?: boolean;
  /** True when CreateTweet response had errors with code 226 (X automation/spam block) - do not retry or use provisional */
  xError226?: boolean;
  /** CreateTweet errors payload when xError226 is true (for diagnostics) */
  createTweetErrors?: any[];
}

/** Shared attempt context: when terminalPostFailure is set, abort extraction and retries. */
export interface ReplyAttemptContext {
  terminalPostFailure: string | null;
}

export interface ExtractReplyIdOptions {
  /** Skip profile/conversation (no navigation) to avoid 429/consent on retries */
  skipNavigationStrategies?: boolean;
  /** First ~60 chars of reply text to match our reply in DOM */
  replyTextSnippet?: string;
  maxWaitMs?: number;
  /** When set, 226 sets this and extraction aborts immediately */
  attemptContext?: ReplyAttemptContext;
  /** When set, 226 sets terminal226=true so timeout layer never overwrites 226 */
  terminal226Ref?: { terminal226: boolean };
}

export class ImprovedReplyIdExtractor {
  private static networkListenerActive = false;
  private static capturedTweetId: string | null = null;
  private static pendingResponse?: Promise<string | null>;
  private static responseListener?: (response: Response) => Promise<void>;
  /** Set when CreateTweet response has error code 226 (automation/spam block). Cleared at start of each extractReplyId. */
  private static lastCreateTweetError226 = false;
  private static lastCreateTweetErrorPayload: any[] | null = null;

  /**
   * Extract reply tweet ID with multiple fallback strategies
   * 
   * @param page - Playwright page instance
   * @param parentTweetId - The tweet we replied to
   * @param maxWaitMs - Maximum time to wait for extraction
   * @returns Extraction result with tweet ID or error
   */
  static async extractReplyId(
    page: Page,
    parentTweetId: string,
    maxWaitMs: number = 10000,
    options?: ExtractReplyIdOptions
  ): Promise<ExtractionResult> {
    const effectiveWait = options?.maxWaitMs ?? maxWaitMs;
    const skipNav = options?.skipNavigationStrategies === true;
    const replySnippet = options?.replyTextSnippet;
    const ctx = options?.attemptContext;
    if (ctx?.terminalPostFailure === 'POST_BLOCKED_BY_X_226') {
      return this.return226Failure(ctx);
    }
    this.lastCreateTweetError226 = false;
    this.lastCreateTweetErrorPayload = null;
    console.log(`[ID_EXTRACTOR] 🔍 Starting extraction for reply to ${parentTweetId} (skipNav=${skipNav})`);

    const startTime = Date.now();
    const check226 = (): ExtractionResult | null => {
      if (ctx?.terminalPostFailure === 'POST_BLOCKED_BY_X_226' || this.lastCreateTweetError226) {
        console.log('[ID_EXTRACTOR] skipping extraction due to confirmed X error 226');
        return this.return226Failure(ctx);
      }
      return null;
    };

    try {
      const awaitedId = await this.waitForCreateTweetResponse(page, effectiveWait, ctx, options?.terminal226Ref);
      const early = check226();
      if (early) return early;
      if (awaitedId) {
        this.teardownListener(page);
        const elapsed = Date.now() - startTime;
        console.log(`[ID_EXTRACTOR] ✅ CreateTweet response matched in ${elapsed}ms: ${awaitedId}`);
        return {
          success: true,
          tweetId: awaitedId,
          strategy: 'network'
        };
      }
    } catch (error: any) {
      const early = check226();
      if (early) return early;
      console.warn('[ID_EXTRACTOR] ⚠️ CreateTweet wait failed:', error.message);
    }

    // Strategy 1: Network capture (aborts as soon as 226 is set)
    const idFromNetwork = await this.tryNetworkCapture(page, effectiveWait, ctx, options?.terminal226Ref);
    const afterNet = check226();
    if (afterNet) return afterNet;
    if (idFromNetwork) {
      this.teardownListener(page);
      const elapsed = Date.now() - startTime;
      console.log(`[ID_EXTRACTOR] ✅ Network strategy succeeded in ${elapsed}ms: ${idFromNetwork}`);
      return {
        success: true,
        tweetId: idFromNetwork,
        strategy: 'network'
      };
    }

    // Strategy 2: DOM same page (no navigation - avoids 429)
    let r = check226(); if (r) return r;
    let idFromDom: string | null = null;
    try {
      idFromDom = await this.tryDomSamePage(page, parentTweetId, replySnippet, ctx);
    } catch (e: any) {
      r = check226(); if (r) return r;
      console.warn('[ID_EXTRACTOR] DOM same-page error (secondary):', e?.message);
    }
    r = check226(); if (r) return r;
    if (idFromDom) {
      this.teardownListener(page);
      const elapsed = Date.now() - startTime;
      console.log(`[ID_EXTRACTOR] ✅ DOM same-page strategy succeeded in ${elapsed}ms: ${idFromDom}`);
      return {
        success: true,
        tweetId: idFromDom,
        strategy: 'dom_same_page'
      };
    }

    // Strategy 3: URL parsing
    r = check226(); if (r) return r;
    let idFromUrl: string | null = null;
    try {
      idFromUrl = await this.tryUrlParse(page, parentTweetId);
    } catch (e: any) {
      r = check226(); if (r) return r;
      console.warn('[ID_EXTRACTOR] URL parse error (secondary):', e?.message);
    }
    r = check226(); if (r) return r;
    if (idFromUrl) {
      const elapsed = Date.now() - startTime;
      console.log(`[ID_EXTRACTOR] ✅ URL strategy succeeded in ${elapsed}ms: ${idFromUrl}`);
      return {
        success: true,
        tweetId: idFromUrl,
        strategy: 'url'
      };
    }

    if (!skipNav) {
      r = check226(); if (r) return r;
      // Strategy 4: Profile scraping (navigates - can hit 429)
      let idFromProfile: string | null = null;
      try {
        idFromProfile = await this.tryProfileScrape(page, parentTweetId, effectiveWait);
      } catch (e: any) {
        r = check226(); if (r) return r;
        console.warn('[ID_EXTRACTOR] Profile scrape error (secondary):', e?.message);
      }
      r = check226(); if (r) return r;
      if (idFromProfile) {
        const elapsed = Date.now() - startTime;
        console.log(`[ID_EXTRACTOR] ✅ Profile strategy succeeded in ${elapsed}ms: ${idFromProfile}`);
        return {
          success: true,
          tweetId: idFromProfile,
          strategy: 'profile'
        };
      }

      // Strategy 5: Conversation scrape (navigates - can hit 429)
      r = check226(); if (r) return r;
      let idFromConversation: string | null = null;
      try {
        idFromConversation = await this.tryConversationScrape(page, parentTweetId);
      } catch (e: any) {
        r = check226(); if (r) return r;
        console.warn('[ID_EXTRACTOR] Conversation scrape error (secondary):', e?.message);
      }
      r = check226(); if (r) return r;
      if (idFromConversation) {
        const elapsed = Date.now() - startTime;
        console.log(`[ID_EXTRACTOR] ✅ Conversation strategy succeeded in ${elapsed}ms: ${idFromConversation}`);
        return {
          success: true,
          tweetId: idFromConversation,
          strategy: 'fallback'
        };
      }
    } else {
      console.log('[ID_EXTRACTOR] ⏭️ Skipping profile/conversation (skipNavigationStrategies=true)');
    }

    r = check226(); if (r) return r;
    const elapsed = Date.now() - startTime;
    let strongEvidence = false;
    let domIdOnCheck: string | null = null;
    try {
      const ev = await this.checkStrongSuccessEvidenceWithId(page, parentTweetId, replySnippet);
      strongEvidence = ev.strong;
      domIdOnCheck = ev.idFromDom;
    } catch (e: any) {
      r = check226(); if (r) return r;
      console.warn('[ID_EXTRACTOR] checkStrongSuccessEvidence error (secondary):', e?.message);
    }
    if (domIdOnCheck) {
      console.log(`[ID_EXTRACTOR] ✅ Recovered ID from strong-evidence check: ${domIdOnCheck}`);
      return {
        success: true,
        tweetId: domIdOnCheck,
        strategy: 'dom_same_page',
      };
    }
    console.error(`[ID_EXTRACTOR] ❌ All strategies failed after ${elapsed}ms strongEvidence=${strongEvidence}`);

    if (this.lastCreateTweetError226) {
      console.log('[ID_EXTRACTOR] skipping extraction due to confirmed X error 226');
      return this.return226Failure(ctx);
    }
    if (strongEvidence) {
      const placeholderId = `posted_strong_evidence_${parentTweetId}_${Date.now()}`;
      console.log(`[ID_EXTRACTOR] 📌 Strong evidence: returning provisional success with placeholder id (no retries)`);
      return {
        success: true,
        tweetId: placeholderId,
        strategy: 'strong_evidence_placeholder',
        strongEvidence: true,
        provisionalId: true,
      };
    }

    return {
      success: false,
      error: 'All extraction strategies failed',
      strongEvidence: false,
    };
  }

  private static return226Failure(ctx?: ReplyAttemptContext | null): ExtractionResult {
    if (ctx) ctx.terminalPostFailure = 'POST_BLOCKED_BY_X_226';
    return {
      success: false,
      error: 'POST_BLOCKED_BY_X_226',
      xError226: true,
      createTweetErrors: this.lastCreateTweetErrorPayload ?? undefined,
    };
  }

  /**
   * Strategy: Extract reply ID from current page DOM (no navigation).
   * Multiple passes with increasing wait to catch late-rendered reply.
   */
  private static async tryDomSamePage(
    page: Page,
    parentTweetId: string,
    replyTextSnippet?: string,
    _ctx?: ReplyAttemptContext | null
  ): Promise<string | null> {
    console.log('[ID_EXTRACTOR] 📄 Strategy: DOM same page (no navigation)...');
    const passes = [2500, 4000, 2000];
    for (let i = 0; i < passes.length; i++) {
      try {
        await page.waitForTimeout(passes[i]);
        const id = await page.evaluate(({ parentId, snippet }: { parentId: string; snippet?: string }) => {
          const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
          const candidates: { id: string; hasSnippet: boolean }[] = [];
          for (const el of articles) {
            const link = el.querySelector('a[href*="/status/"]');
            const href = link?.getAttribute('href');
            if (!href) continue;
            const m = href.match(/\/status\/(\d{18,20})/);
            if (!m || m[1] === parentId) continue;
            const text = el.textContent || '';
            candidates.push({ id: m[1], hasSnippet: !snippet || text.includes(snippet.slice(0, 40)) });
          }
          if (candidates.length === 0) return null;
          const withSnippet = candidates.find(c => c.hasSnippet);
          return (withSnippet || candidates[0]).id;
        }, { parentId: parentTweetId, snippet: replyTextSnippet || '' });
        if (id) return id;
      } catch (error: any) {
        console.log('[ID_EXTRACTOR] DOM same-page pass error:', error?.message);
      }
    }
    return null;
  }

  /**
   * Check for strong evidence that the reply was posted (composer dismissed and/or our reply in DOM).
   * Also attempts to recover the reply tweet ID from the DOM when snippet matches.
   * Used to avoid retries that hit 429/consent when post likely succeeded.
   */
  static async checkStrongSuccessEvidence(
    page: Page,
    parentTweetId: string,
    replyTextSnippet?: string
  ): Promise<boolean> {
    const { strong } = await this.checkStrongSuccessEvidenceWithId(page, parentTweetId, replyTextSnippet);
    return strong;
  }

  /**
   * Strong evidence check that can also return the reply ID if found in DOM (snippet match).
   */
  static async checkStrongSuccessEvidenceWithId(
    page: Page,
    parentTweetId: string,
    replyTextSnippet?: string
  ): Promise<{ strong: boolean; idFromDom: string | null }> {
    try {
      await page.waitForTimeout(1500);
      const composerGone = await page.locator('[data-testid="tweetTextarea_0"], [data-testid="tweetButtonInline"]').first().isVisible().then(v => !v).catch(() => true);
      const domResult = await page.evaluate(({ parentId, snippet }: { parentId: string; snippet?: string }) => {
        const articles = document.querySelectorAll('article[data-testid="tweet"]');
        let idFromDom: string | null = null;
        let hasNewReply = false;
        for (const el of articles) {
          const link = el.querySelector('a[href*="/status/"]');
          const href = link?.getAttribute('href');
          if (!href) continue;
          const m = href.match(/\/status\/(\d{18,20})/);
          if (!m || m[1] === parentId) continue;
          const text = el.textContent || '';
          const matchesSnippet = !snippet || text.includes(snippet.slice(0, 30));
          if (matchesSnippet) {
            idFromDom = m[1];
            hasNewReply = true;
            break;
          }
          hasNewReply = true;
        }
        return { idFromDom, hasNewReply };
      }, { parentId: parentTweetId, snippet: replyTextSnippet || '' });

      const urlChanged = await page.evaluate(({ parentId }: { parentId: string }) => {
        const u = window.location.href;
        const match = u.match(/\/status\/(\d{18,20})/);
        return match && match[1] !== parentId;
      }, { parentId: parentTweetId }).catch(() => false);

      const strong = composerGone && (domResult.hasNewReply || urlChanged);
      return { strong, idFromDom: domResult.idFromDom };
    } catch {
      return { strong: false, idFromDom: null };
    }
  }

  /**
   * Setup network listener BEFORE posting.
   * Must be called before clicking the post button.
   * When CreateTweet returns 226, sets lastCreateTweetError226, attemptContext.terminalPostFailure, and terminal226Ref.terminal226 so extraction and timeout abort immediately.
   */
  static setupNetworkListener(
    page: Page,
    ref?: { attemptContext?: ReplyAttemptContext; terminal226Ref?: { terminal226: boolean } }
  ): void {
    if (this.responseListener) {
      page.off('response', this.responseListener);
      this.responseListener = undefined;
    }

    console.log('[ID_EXTRACTOR] 🎧 Setting up network listener');
    this.capturedTweetId = null;
    this.networkListenerActive = true;

    this.responseListener = async (response: Response) => {
      try {
        const url = response.url();

        // Twitter's CreateTweet endpoint
        if (url.includes('CreateTweet') || (url.includes('graphql') && url.includes('/CreateTweet'))) {
          console.log('[ID_EXTRACTOR] 📡 Intercepted CreateTweet response');

          try {
            const json = await response.json();
            const { getCreateTweetError226 } = await import('./tweetIdValidator');
            const err226 = getCreateTweetError226(json);
            if (err226?.is226) {
              this.lastCreateTweetError226 = true;
              this.lastCreateTweetErrorPayload = err226.errors;
              if (ref?.attemptContext) ref.attemptContext.terminalPostFailure = 'POST_BLOCKED_BY_X_226';
              if (ref?.terminal226Ref) ref.terminal226Ref.terminal226 = true;
              console.log('[CREATE_TWEET_ERROR] code=226 automation/spam block; errors count=', err226.errors.length);
            }
            let tweetId = this.parseTweetIdFromResponse(json);
            if (!tweetId) {
              const { extractTweetIdFromCreateTweetResponse } = await import('./tweetIdValidator');
              tweetId = extractTweetIdFromCreateTweetResponse(json);
            }
            if (tweetId) {
              console.log('[ID_EXTRACTOR] 🎯 Captured tweet ID from network:', tweetId);
              this.capturedTweetId = tweetId;
            }
          } catch (e) {
            console.log('[ID_EXTRACTOR] ⚠️ Failed to parse CreateTweet response');
          }
        }
      } catch (error: any) {
        // Ignore errors in listener
      }
    };

    page.on('response', this.responseListener);
    this.pendingResponse = this.awaitCreateTweetResponse(page)
      .then((id) => {
        if (id && !this.capturedTweetId) {
          console.log('[ID_EXTRACTOR] 🎯 Async CreateTweet response delivered tweet ID:', id);
          this.capturedTweetId = id;
        }
        return id;
      })
      .catch(() => null);
  }

  /**
   * Strategy 1: Capture tweet ID from Twitter's API response
   * 
   * This is the most reliable method when it works. Must setup listener
   * before posting the reply.
   */
  private static async tryNetworkCapture(
    page: Page,
    maxWaitMs: number,
    ctx?: ReplyAttemptContext | null,
    terminal226Ref?: { terminal226: boolean }
  ): Promise<string | null> {
    console.log('[ID_EXTRACTOR] 📡 Strategy 1: Network capture...');

    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      if (this.lastCreateTweetError226 || ctx?.terminalPostFailure === 'POST_BLOCKED_BY_X_226') {
        this.teardownListener(page);
        return null;
      }
      if (this.capturedTweetId) {
        const id = this.capturedTweetId;
        this.capturedTweetId = null;
        this.teardownListener(page);
        return id;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    if (this.lastCreateTweetError226 || ctx?.terminalPostFailure === 'POST_BLOCKED_BY_X_226') {
      this.teardownListener(page);
      return null;
    }
    console.log('[ID_EXTRACTOR] ⏱️ Network capture timeout');

    const remainingMs = Math.max(500, maxWaitMs - (Date.now() - startTime));
    const waitResult = await this.waitForCreateTweetResponse(page, remainingMs, ctx, terminal226Ref);
    if (this.lastCreateTweetError226 || ctx?.terminalPostFailure === 'POST_BLOCKED_BY_X_226') {
      this.teardownListener(page);
      return null;
    }
    if (waitResult) {
      this.capturedTweetId = null;
      this.teardownListener(page);
      return waitResult;
    }

    this.teardownListener(page);
    return null;
  }

  /**
   * Strategy 2: Extract from URL after posting
   * 
   * Sometimes Twitter redirects to the reply tweet after posting.
   */
  private static async tryUrlParse(
    page: Page,
    parentTweetId: string
  ): Promise<string | null> {
    console.log('[ID_EXTRACTOR] 🔗 Strategy 2: URL parsing...');

    try {
      // Wait a bit for potential redirect
      await page.waitForTimeout(2000);

      const currentUrl = page.url();
      console.log('[ID_EXTRACTOR] Current URL:', currentUrl);

      // Extract tweet ID from URL
      const match = currentUrl.match(/\/status\/(\d{15,20})/);
      if (match && match[1] !== parentTweetId) {
        // Make sure it's not the parent tweet
        return match[1];
      }

      console.log('[ID_EXTRACTOR] URL parse failed - no new tweet ID in URL');
      return null;
    } catch (error: any) {
      console.log('[ID_EXTRACTOR] URL parse error:', error.message);
      return null;
    }
  }

  /**
   * Strategy 3: Scrape profile to find most recent reply
   * 
   * This is the most reliable fallback but takes longest.
   * Navigates to our profile and finds the most recent reply.
   */
  private static async tryProfileScrape(
    page: Page,
    parentTweetId: string,
    maxWaitMs: number
  ): Promise<string | null> {
    console.log('[ID_EXTRACTOR] 👤 Strategy 3: Profile scraping (fallback)...');

    try {
      // Get our username
      const username = await this.getOurUsername(page);
      if (!username) {
        console.log('[ID_EXTRACTOR] ⚠️ Could not determine our username');
        return null;
      }

      console.log('[ID_EXTRACTOR] Our username:', username);

      // Navigate to our profile
      await page.goto(`https://x.com/${username}/with_replies`, {
        waitUntil: 'domcontentloaded',
        timeout: 12000
      });

      await page.waitForTimeout(3000); // Wait for tweets to load

      // Find tweet articles
      const tweets = await page.$$('article[data-testid="tweet"]');
      console.log(`[ID_EXTRACTOR] Found ${tweets.length} tweets on profile`);

      // Check the top 10 tweets (our reply should be in the most recent)
      for (let i = 0; i < Math.min(10, tweets.length); i++) {
        const tweet = tweets[i];

        try {
          // Get tweet ID from link
          const link = await tweet.$('a[href*="/status/"]');
          if (!link) continue;

          const href = await link.getAttribute('href');
          if (!href) continue;

          const match = href.match(/\/status\/(\d{15,20})/);
          if (!match) continue;

          const tweetId = match[1];

          // Verify this is actually a reply to the parent tweet
          const isReply = await this.verifyReplyRelationship(
            page,
            tweetId,
            parentTweetId
          );

          if (isReply) {
            console.log(`[ID_EXTRACTOR] ✅ Found reply tweet #${i + 1}:`, tweetId);
            return tweetId;
          }
        } catch (e) {
          // Continue to next tweet
          continue;
        }
      }

      console.log('[ID_EXTRACTOR] ⚠️ No matching reply found in recent tweets');
      return null;
    } catch (error: any) {
      console.error('[ID_EXTRACTOR] Profile scrape error:', error.message);
      return null;
    }
  }

  /**
   * Strategy 4: Inspect the parent conversation for our reply node
   */
  private static async tryConversationScrape(
    page: Page,
    parentTweetId: string
  ): Promise<string | null> {
    console.log('[ID_EXTRACTOR] 🧵 Strategy 4: Conversation scrape...');

    try {
      const username = await this.getOurUsername(page);
      if (!username) {
        console.log('[ID_EXTRACTOR] ⚠️ Unable to determine username for conversation scrape');
        return null;
      }

      await page.goto(`https://x.com/i/status/${parentTweetId}`, {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });

      await page.waitForTimeout(3000);

      for (let attempt = 0; attempt < 3; attempt++) {
        const candidateArticles = await page.$$(
          `article[data-testid="tweet"]:has(a[href="/${username}"])`
        );

        console.log(`[ID_EXTRACTOR] Conversation scrape candidates (pass ${attempt + 1}): ${candidateArticles.length}`);

        for (const article of candidateArticles) {
          try {
            const link = await article.$('a[href*="/status/"]');
            if (!link) continue;

            const href = await link.getAttribute('href');
            if (!href) continue;

            const match = href.match(/\/status\/(\d{15,20})/);
            if (!match) continue;

            const tweetId = match[1];
            if (tweetId === parentTweetId) continue;

            console.log(`[ID_EXTRACTOR] ✅ Conversation scrape located reply: ${tweetId}`);
            return tweetId;
          } catch (error) {
            continue;
          }
        }

        // Scroll a bit more to load additional replies before next pass
        await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight * 0.8);
        }).catch(() => undefined);
        await page.waitForTimeout(1500);
      }

      console.log('[ID_EXTRACTOR] ⚠️ Conversation scrape exhausted without locating reply');
      return null;
    } catch (error: any) {
      console.error('[ID_EXTRACTOR] Conversation scrape error:', error.message);
      return null;
    }
  }

  /**
   * Parse tweet ID from Twitter's CreateTweet API response
   */
  private static parseTweetIdFromResponse(json: any): string | null {
    try {
      // Twitter's response structure can vary, try multiple paths
      const paths = [
        // GraphQL responses
        json?.data?.create_tweet?.tweet_results?.result?.rest_id,
        json?.data?.create_tweet?.tweet_results?.result?.tweet?.rest_id,
        json?.data?.create_tweet?.tweet_results?.result?.tweet?.legacy?.rest_id,
        json?.data?.CreateTweet?.tweet_results?.result?.rest_id,
        json?.data?.CreateTweet?.tweet_results?.result?.tweet?.rest_id,
        json?.data?.CreateTweet?.tweet_results?.result?.tweet?.legacy?.rest_id,
        json?.data?.tweetCreate?.tweet_results?.result?.rest_id,
        json?.data?.tweetCreate?.tweet_results?.result?.tweet?.rest_id,
        json?.data?.tweetCreate?.tweet_results?.result?.tweet?.legacy?.rest_id,
        json?.data?.tweetCreate?.tweet?.legacy?.rest_id,
        json?.data?.tweetCreate?.tweet?.rest_id,
        json?.data?.tweetCreate?.tweet_result?.result?.rest_id,
        json?.data?.tweetCreate?.tweet_result?.result?.tweet?.rest_id,
        json?.data?.tweetCreate?.tweet_result?.result?.tweet?.legacy?.rest_id,
        json?.data?.tweetCreate?.tweet_result?.result?.tweet_id,
        json?.data?.tweet_create?.tweet?.rest_id,
        json?.data?.tweet_create?.tweet?.legacy?.rest_id,
        json?.data?.tweet_create?.tweet_result?.result?.rest_id,
        
        // REST API responses
        json?.data?.tweet?.rest_id,
        json?.data?.tweetResult?.result?.rest_id,
        
        // Direct ID fields
        json?.rest_id,
        json?.id_str,
        json?.id
      ];

      for (const path of paths) {
        if (path && typeof path === 'string' && /^\d{15,20}$/.test(path)) {
          return path;
        }
        // Also handle numeric IDs
        if (path && typeof path === 'number') {
          return String(path);
        }
      }

      console.log('[ID_EXTRACTOR] ⚠️ Could not find tweet ID in response structure');
      return null;
    } catch (error: any) {
      console.error('[ID_EXTRACTOR] Error parsing response:', error.message);
      return null;
    }
  }

  private static async waitForCreateTweetResponse(
    page: Page,
    maxWaitMs: number,
    ctx?: ReplyAttemptContext | null,
    terminal226Ref?: { terminal226: boolean }
  ): Promise<string | null> {
    try {
      if (this.pendingResponse) {
        const existing = await Promise.race([
          this.pendingResponse,
          new Promise<string | null>((resolve) => setTimeout(() => resolve(null), maxWaitMs))
        ]);
        if (existing) return existing;
      }

      const response = await page.waitForResponse(
        (res) => res.url().includes('CreateTweet'),
        { timeout: maxWaitMs }
      );
      const json = await response.json().catch(() => null);
      if (!json) return null;
      const { getCreateTweetError226 } = await import('./tweetIdValidator');
      const err226 = getCreateTweetError226(json);
      if (err226?.is226) {
        this.lastCreateTweetError226 = true;
        this.lastCreateTweetErrorPayload = err226.errors;
        if (ctx) ctx.terminalPostFailure = 'POST_BLOCKED_BY_X_226';
        if (terminal226Ref) terminal226Ref.terminal226 = true;
        console.log('[CREATE_TWEET_ERROR] code=226 automation/spam block; errors count=', err226.errors.length);
      }
      let id = this.parseTweetIdFromResponse(json);
      if (!id) {
        const { extractTweetIdFromCreateTweetResponse } = await import('./tweetIdValidator');
        id = extractTweetIdFromCreateTweetResponse(json);
      }
      return id;
    } catch {
      return null;
    }
  }

  private static async awaitCreateTweetResponse(page: Page): Promise<string | null> {
    try {
      const response = await page.waitForResponse(
        (res) => res.url().includes('CreateTweet'),
        { timeout: 8000 }
      );
      const json = await response.json().catch(() => null);
      if (!json) return null;
      let id = this.parseTweetIdFromResponse(json);
      if (!id) {
        const { extractTweetIdFromCreateTweetResponse } = await import('./tweetIdValidator');
        id = extractTweetIdFromCreateTweetResponse(json);
      }
      return id;
    } catch {
      return null;
    }
  }

  private static teardownListener(page: Page): void {
    if (this.responseListener) {
      page.off('response', this.responseListener);
      this.responseListener = undefined;
    }
    this.networkListenerActive = false;
    this.pendingResponse = undefined;
  }

  /**
   * Get our Twitter username from the current page
   */
  private static async getOurUsername(page: Page): Promise<string | null> {
    try {
      // Try multiple methods to get username
      
      // Method 1: From profile link in navigation
      const profileLink = await page.$('a[data-testid="AppTabBar_Profile_Link"]');
      if (profileLink) {
        const href = await profileLink.getAttribute('href');
        if (href) {
          const match = href.match(/\/([^\/]+)$/);
          if (match && match[1]) {
            return match[1];
          }
        }
      }

      // Method 2: From account switcher
      const accountSwitcher = await page.$('[data-testid="SideNav_AccountSwitcher_Button"]');
      if (accountSwitcher) {
        const text = await accountSwitcher.textContent();
        if (text) {
          const match = text.match(/@([a-zA-Z0-9_]+)/);
          if (match && match[1]) {
            return match[1];
          }
        }
      }

      // Method 3: Parse from current URL if we're on our profile
      const url = page.url();
      if (url.includes('x.com/') || url.includes('twitter.com/')) {
        const match = url.match(/(?:x|twitter)\.com\/([a-zA-Z0-9_]+)/);
        if (match && match[1] && match[1] !== 'i' && match[1] !== 'home') {
          return match[1];
        }
      }

      return null;
    } catch (error: any) {
      console.error('[ID_EXTRACTOR] Error getting username:', error.message);
      return null;
    }
  }

  /**
   * Verify that a tweet is actually a reply to another tweet
   */
  private static async verifyReplyRelationship(
    page: Page,
    tweetId: string,
    parentTweetId: string
  ): Promise<boolean> {
    try {
      // Navigate to the potential reply
      await page.goto(`https://x.com/i/status/${tweetId}`, {
        waitUntil: 'domcontentloaded',
        timeout: 10000
      });

      await page.waitForTimeout(2000);

      // Look for "Replying to" text and link to parent
      const replyingTo = await page.$(`a[href*="/status/${parentTweetId}"]`);
      
      if (replyingTo) {
        console.log('[ID_EXTRACTOR] ✅ Verified: Tweet is reply to parent');
        return true;
      }

      // Alternative: Check if parent tweet is visible in thread
      const parentInThread = await page.$(`article[data-testid="tweet"] a[href*="/status/${parentTweetId}"]`);
      if (parentInThread) {
        console.log('[ID_EXTRACTOR] ✅ Verified: Parent visible in thread');
        return true;
      }

      console.log('[ID_EXTRACTOR] ❌ Tweet is not a reply to parent');
      return false;
    } catch (error: any) {
      console.error('[ID_EXTRACTOR] Error verifying relationship:', error.message);
      return false;
    }
  }

  /**
   * Cleanup - remove network listener
   */
  static cleanup(): void {
    this.networkListenerActive = false;
    this.capturedTweetId = null;
  }
}

