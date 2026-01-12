/**
 * 🎯 ROOT TWEET RESOLVER
 * Ensures replies always target the ROOT tweet, not other replies
 */

import { UnifiedBrowserPool } from '../browser/UnifiedBrowserPool';
import { withAncestryLimit } from './ancestryConcurrencyLimiter';

export interface RootTweetResolution {
  originalTweetId: string;
  rootTweetId: string | null; // null = cannot determine root (fail-closed)
  isRootTweet: boolean;
  rootTweetUrl: string;
  rootTweetAuthor: string | null;
  rootTweetContent: string | null;
  // 🔒 FAIL-CLOSED: Status and confidence tracking
  status: 'OK' | 'UNCERTAIN' | 'ERROR';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  method: 'explicit_signals' | 'dom_verification' | 'json_extraction' | 'metadata' | 'fallback' | 'error';
  signals: {
    replying_to_text: boolean;
    social_context: boolean;
    main_article_reply_indicator: boolean;
    multiple_articles: boolean;
    verification_passed: boolean;
  };
  error?: string;
}

/**
 * Resolve a tweet ID to its root tweet using Playwright permalink inspection
 * 
 * FAIL-CLOSED: On any uncertainty, returns isRootTweet=false to prevent replying to replies
 */
export async function resolveRootTweetId(tweetId: string): Promise<RootTweetResolution> {
  // 🎯 CONCURRENCY LIMIT: Wrap in limiter to prevent pool overload
  return withAncestryLimit(async () => {
    const tweetUrl = `https://x.com/i/web/status/${tweetId}`;
    const decisionId = `ancestry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 🎯 PART A: Trace pool usage
    const pool = UnifiedBrowserPool.getInstance();
    const poolAny = pool as any;
    const poolMetricsBefore = pool.getMetrics();
    const poolId = `pool-${poolMetricsBefore.contextsCreated || 0}`;
    
    console.log(`[ANCESTRY_TRACE] start decision_id=${decisionId} target=${tweetId} used_pool=true pool_id=${poolId} queue_len=${poolAny.queue?.length || 0} active=${poolAny.getActiveCount?.() || 0}`);
    
    // Track ancestry attempt (for metrics)
    (global as any).ancestryAttemptsLast1h = ((global as any).ancestryAttemptsLast1h || 0) + 1;
    (global as any).ancestryUsedPoolLast1h = ((global as any).ancestryUsedPoolLast1h || 0) + 1;
    
    let page;
    let resolutionAttempted = false;
    let checksPerformed: string[] = [];
    let stageTimings: Record<string, number> = {};
    let currentStage = 'acquire_context';
    let stageStartTime = Date.now();
    let stageError: string | null = null;
    
    try {
      // 🎯 PART B: Stage 1 - Acquire context
      currentStage = 'acquire_context';
      stageStartTime = Date.now();
      try {
        page = await pool.acquirePage('resolve_root_tweet');
        stageTimings[currentStage] = Date.now() - stageStartTime;
        console.log(`[ANCESTRY_TRACE] stage=${currentStage} decision_id=${decisionId} duration_ms=${stageTimings[currentStage]} success=true`);
      } catch (acquireError: any) {
        stageTimings[currentStage] = Date.now() - stageStartTime;
        stageError = `acquire_context_timeout: ${acquireError.message}`;
        console.error(`[ANCESTRY_TRACE] stage=${currentStage} decision_id=${decisionId} duration_ms=${stageTimings[currentStage]} success=false error=${stageError}`);
        throw new Error(`ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT: ${acquireError.message}`);
      }
    
      // 🎯 PART B: Stage 2 - Navigate to tweet
      currentStage = 'navigate_to_tweet';
      stageStartTime = Date.now();
      try {
        await page.goto(tweetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        stageTimings[currentStage] = Date.now() - stageStartTime;
        console.log(`[ANCESTRY_TRACE] stage=${currentStage} decision_id=${decisionId} duration_ms=${stageTimings[currentStage]} success=true`);
      } catch (navError: any) {
        stageTimings[currentStage] = Date.now() - stageStartTime;
        stageError = `nav_timeout: ${navError.message}`;
        console.error(`[ANCESTRY_TRACE] stage=${currentStage} decision_id=${decisionId} duration_ms=${stageTimings[currentStage]} success=false error=${stageError}`);
        throw new Error(`ANCESTRY_NAV_TIMEOUT: ${navError.message}`);
      }
      
      await page.waitForTimeout(3000); // Let page settle
      
      // 🎯 PART C: Stage 3 - Detect consent wall
      currentStage = 'detect_consent_wall';
      stageStartTime = Date.now();
      try {
        const { detectConsentWall } = await import('../playwright/twitterSession');
        const consentResult = await detectConsentWall(page);
        stageTimings[currentStage] = Date.now() - stageStartTime;
        
        if (consentResult.detected && !consentResult.cleared) {
          stageError = `consent_wall_detected: variant=${consentResult.variant || 'unknown'}`;
          console.warn(`[ANCESTRY_TRACE] stage=${currentStage} decision_id=${decisionId} duration_ms=${stageTimings[currentStage]} consent_wall=true variant=${consentResult.variant}`);
          throw new Error(`CONSENT_WALL: ${consentResult.variant || 'unknown'}`);
        }
        console.log(`[ANCESTRY_TRACE] stage=${currentStage} decision_id=${decisionId} duration_ms=${stageTimings[currentStage]} consent_wall=false`);
      } catch (consentError: any) {
        if (consentError.message.includes('CONSENT_WALL')) {
          // Re-throw as CONSENT_WALL (will be mapped correctly)
          throw consentError;
        }
        // Other errors in consent detection are non-fatal, continue
        console.warn(`[ANCESTRY_TRACE] stage=${currentStage} decision_id=${decisionId} consent_check_error=${consentError.message}`);
      }
      
      resolutionAttempted = true;
      
      // 🎯 PART B: Stage 4 - Parse root signals
      currentStage = 'parse_root_signals';
      stageStartTime = Date.now();
      
      // Step 1: Try JSON extraction (most reliable, stable)
      const jsonAncestry = await tryJsonExtraction(page, tweetId);
      if (jsonAncestry) {
        stageTimings[currentStage] = Date.now() - stageStartTime;
        console.log(`[REPLY_SELECT] ✅ Resolved via JSON extraction: ${tweetId}`);
        console.log(`[ANCESTRY_TRACE] stage=${currentStage} decision_id=${decisionId} duration_ms=${stageTimings[currentStage]} method=json_extraction success=true`);
        return jsonAncestry;
      }
    
    // 🔒 ROBUST REPLY DETECTION: Multiple signals, no broad selectors
    const replyDetection = await page.evaluate(() => {
      const checks: { signal: string; found: boolean; details?: any }[] = [];
      
      // Check 1: Look for "Replying to @username" text (most reliable)
      const replyingToText = Array.from(document.querySelectorAll('*')).find(el => {
        const text = el.textContent || '';
        return /Replying to\s+@/i.test(text);
      });
      checks.push({ 
        signal: 'replying_to_text', 
        found: !!replyingToText,
        details: replyingToText ? (replyingToText.textContent?.substring(0, 50) || '') : undefined
      });
      
      // Check 2: Look for social context element (Twitter's official indicator)
      const socialContext = document.querySelector('[data-testid="socialContext"]');
      checks.push({ 
        signal: 'social_context', 
        found: !!socialContext,
        details: socialContext ? (socialContext.textContent?.substring(0, 50) || '') : undefined
      });
      
      // Check 3: Check if main tweet article has reply indicator
      const mainArticle = document.querySelector('article[data-testid="tweet"]:first-of-type');
      const hasReplyIndicator = mainArticle ? 
        Array.from(mainArticle.querySelectorAll('*')).some(el => {
          const text = el.textContent || '';
          return /Replying to/i.test(text);
        }) : false;
      checks.push({ 
        signal: 'main_article_reply_indicator', 
        found: hasReplyIndicator 
      });
      
      // Check 4: Look for conversation thread structure (multiple articles = likely reply chain)
      const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
      const hasMultipleArticles = articles.length > 1;
      checks.push({ 
        signal: 'multiple_articles', 
        found: hasMultipleArticles,
        details: articles.length 
      });
      
      // Determine if reply: ANY positive signal = reply
      const isReply = checks.some(c => c.found);
      
      return { isReply, checks };
    });
    
    checksPerformed = replyDetection.checks.map((c: any) => `${c.signal}=${c.found}`);
    
    if (!replyDetection.isReply) {
      // This appears to be a root tweet - verify with additional checks
      const verification = await page.evaluate(() => {
        // Get main tweet article
        const mainArticle = document.querySelector('article[data-testid="tweet"]:first-of-type');
        if (!mainArticle) return { verified: false, reason: 'no_main_article' };
        
        // Check if this article's URL matches the tweet ID in URL
        const articleLink = mainArticle.querySelector('a[href*="/status/"]');
        const href = articleLink?.getAttribute('href') || '';
        const match = href.match(/\/status\/(\d+)/);
        const articleTweetId = match ? match[1] : null;
        
        // Extract author and content for return
        const authorElement = mainArticle.querySelector('[data-testid="User-Name"] a');
        const author = authorElement?.textContent?.replace('@', '') || null;
        
        const tweetText = mainArticle.querySelector('[data-testid="tweetText"]');
        const content = tweetText?.textContent || null;
        
        return { 
          verified: true, 
          articleTweetId,
          author,
          content 
        };
      });
      
      if (verification.verified) {
        stageTimings[currentStage] = Date.now() - stageStartTime;
        console.log(`[REPLY_SELECT] ✅ ${tweetId} confirmed as ROOT tweet (checks: ${checksPerformed.join(', ')})`);
        console.log(`[ANCESTRY_TRACE] stage=${currentStage} decision_id=${decisionId} duration_ms=${stageTimings[currentStage]} method=dom_verification success=true`);
        
        return {
          originalTweetId: tweetId,
          rootTweetId: tweetId,
          isRootTweet: true,
          rootTweetUrl: tweetUrl,
          rootTweetAuthor: verification.author,
          rootTweetContent: verification.content,
          status: 'OK',
          confidence: 'HIGH',
          method: 'dom_verification',
          signals: {
            replying_to_text: false,
            social_context: false,
            main_article_reply_indicator: false,
            multiple_articles: replyDetection.checks.find((c: any) => c.signal === 'multiple_articles')?.found || false,
            verification_passed: true,
          },
        };
      } else {
        // Verification failed - UNCERTAIN status (fail-closed)
        stageTimings[currentStage] = Date.now() - stageStartTime;
        console.log(`[REPLY_SELECT] ⚠️ Could not verify root status for ${tweetId} (reason: ${verification.reason || 'unknown'})`);
        console.log(`[REPLY_SELECT]   Checks performed: ${checksPerformed.join(', ')}`);
        console.log(`[REPLY_SELECT]   FAIL-CLOSED: Treating as UNCERTAIN (will DENY)`);
        console.log(`[ANCESTRY_TRACE] stage=${currentStage} decision_id=${decisionId} duration_ms=${stageTimings[currentStage]} method=dom_verification success=false reason=${verification.reason || 'unknown'}`);
        
        return {
          originalTweetId: tweetId,
          rootTweetId: null, // Fail-closed: cannot determine root
          isRootTweet: false, // Fail-closed: assume not root when uncertain
          rootTweetUrl: tweetUrl,
          rootTweetAuthor: verification.author || null,
          rootTweetContent: verification.content || null,
          status: 'UNCERTAIN',
          confidence: 'LOW',
          method: 'dom_verification',
          signals: {
            replying_to_text: false,
            social_context: false,
            main_article_reply_indicator: false,
            multiple_articles: replyDetection.checks.find((c: any) => c.signal === 'multiple_articles')?.found || false,
            verification_passed: false,
          },
        };
      }
    }
    
    // This is a reply, find the root tweet
    const rootTweetData = await page.evaluate(() => {
      // Look for the first tweet in the thread (the one being replied to)
      const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
      
      if (articles.length > 0) {
        const rootArticle = articles[0]; // First tweet is the root
        
        // Extract tweet ID from the link
        const tweetLink = rootArticle.querySelector('a[href*="/status/"]');
        const href = tweetLink?.getAttribute('href') || '';
        const match = href.match(/\/status\/(\d+)/);
        const rootId = match ? match[1] : null;
        
        // Extract author
        const authorElement = rootArticle.querySelector('[data-testid="User-Name"] a');
        const author = authorElement?.textContent?.replace('@', '') || null;
        
        // Extract content
        const tweetText = rootArticle.querySelector('[data-testid="tweetText"]');
        const content = tweetText?.textContent || null;
        
        return { rootId, author, content };
      }
      
      return { rootId: null, author: null, content: null };
    });
    
      if (rootTweetData.rootId && rootTweetData.rootId !== tweetId) {
        stageTimings[currentStage] = Date.now() - stageStartTime;
        console.log(`[REPLY_SELECT] ✅ Resolved ${tweetId} → root ${rootTweetData.rootId} (checks: ${checksPerformed.join(', ')})`);
        console.log(`[ANCESTRY_TRACE] stage=${currentStage} decision_id=${decisionId} duration_ms=${stageTimings[currentStage]} method=explicit_signals success=true`);
        
        return {
          originalTweetId: tweetId,
          rootTweetId: rootTweetData.rootId,
          isRootTweet: false,
          rootTweetUrl: `https://x.com/i/web/status/${rootTweetData.rootId}`,
          rootTweetAuthor: rootTweetData.author,
          rootTweetContent: rootTweetData.content,
          status: 'OK',
          confidence: 'HIGH',
          method: 'explicit_signals',
          signals: {
            replying_to_text: replyDetection.checks.find((c: any) => c.signal === 'replying_to_text')?.found || false,
            social_context: replyDetection.checks.find((c: any) => c.signal === 'social_context')?.found || false,
            main_article_reply_indicator: replyDetection.checks.find((c: any) => c.signal === 'main_article_reply_indicator')?.found || false,
            multiple_articles: replyDetection.checks.find((c: any) => c.signal === 'multiple_articles')?.found || false,
            verification_passed: true,
          },
        };
      }
      
      // Could not resolve root - UNCERTAIN status (fail-closed)
      stageTimings[currentStage] = Date.now() - stageStartTime;
      console.log(`[REPLY_SELECT] ⚠️ Could not resolve root for ${tweetId}`);
      console.log(`[REPLY_SELECT]   Checks performed: ${checksPerformed.join(', ')}`);
      console.log(`[REPLY_SELECT]   Root ID extracted: ${rootTweetData.rootId || 'null'}`);
      console.log(`[REPLY_SELECT]   FAIL-CLOSED: Treating as UNCERTAIN (will DENY)`);
      console.log(`[ANCESTRY_TRACE] stage=${currentStage} decision_id=${decisionId} duration_ms=${stageTimings[currentStage]} method=explicit_signals success=false root_id=${rootTweetData.rootId || 'null'}`);
      
      return {
        originalTweetId: tweetId,
        rootTweetId: null, // Fail-closed: cannot determine root
        isRootTweet: false, // Fail-closed: assume not root when uncertain
        rootTweetUrl: tweetUrl,
        rootTweetAuthor: rootTweetData.author || null,
        rootTweetContent: rootTweetData.content || null,
        status: 'UNCERTAIN',
        confidence: 'LOW',
        method: 'explicit_signals',
        signals: {
          replying_to_text: replyDetection.checks.find((c: any) => c.signal === 'replying_to_text')?.found || false,
          social_context: replyDetection.checks.find((c: any) => c.signal === 'social_context')?.found || false,
          main_article_reply_indicator: replyDetection.checks.find((c: any) => c.signal === 'main_article_reply_indicator')?.found || false,
          multiple_articles: replyDetection.checks.find((c: any) => c.signal === 'multiple_articles')?.found || false,
          verification_passed: false,
      },
    };
      
    } catch (error: any) {
      // 🎯 PART B: Map error to specific stage deny reason
      const errorMsg = error.message || String(error);
      let denyReasonCode = 'ANCESTRY_ERROR';
      let denyReasonDetail = `stage=${currentStage} error=${errorMsg}`;
      
      if (errorMsg.includes('ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT') || errorMsg.includes('acquire_context_timeout')) {
        denyReasonCode = 'ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT';
      } else if (errorMsg.includes('ANCESTRY_NAV_TIMEOUT') || errorMsg.includes('nav_timeout')) {
        denyReasonCode = 'ANCESTRY_NAV_TIMEOUT';
      } else if (errorMsg.includes('CONSENT_WALL')) {
        denyReasonCode = 'CONSENT_WALL';
        denyReasonDetail = `stage=${currentStage} variant=${errorMsg.match(/variant=(\w+)/)?.[1] || 'unknown'}`;
      } else if (errorMsg.includes('timeout') || errorMsg.includes('queue timeout') || errorMsg.includes('pool overloaded')) {
        denyReasonCode = 'ANCESTRY_QUEUE_TIMEOUT';
      } else if (errorMsg.includes('parse') || errorMsg.includes('extraction failed') || errorMsg.includes('dom query failed')) {
        denyReasonCode = 'ANCESTRY_PARSE_TIMEOUT';
      }
      
      const totalDuration = Object.values(stageTimings).reduce((a, b) => a + b, 0);
      console.error(`[ANCESTRY_TRACE] error decision_id=${decisionId} target=${tweetId} stage=${currentStage} deny_reason_code=${denyReasonCode} duration_ms=${totalDuration} stage_timings=${JSON.stringify(stageTimings)}`);
      console.error(`[REPLY_SELECT] ❌ Error resolving root for ${tweetId}:`, error.message);
      console.error(`[REPLY_SELECT]   Resolution attempted: ${resolutionAttempted}`);
      console.error(`[REPLY_SELECT]   Checks performed: ${checksPerformed.length > 0 ? checksPerformed.join(', ') : 'none'}`);
      console.error(`[REPLY_SELECT]   FAIL-CLOSED: Returning ERROR status (will DENY)`);
      
      // Fail-closed: return ERROR status on error (will DENY)
      return {
        originalTweetId: tweetId,
        rootTweetId: null, // Fail-closed: cannot determine root
        isRootTweet: false, // Fail-closed: assume not root on error
        rootTweetUrl: tweetUrl,
        rootTweetAuthor: null,
        rootTweetContent: null,
        status: 'ERROR',
        confidence: 'LOW',
        method: 'error',
        signals: {
          replying_to_text: false,
          social_context: false,
          main_article_reply_indicator: false,
          multiple_articles: false,
          verification_passed: false,
        },
        error: `${denyReasonCode}: ${denyReasonDetail}`,
      };
    } finally {
      // 🎯 PART B: Stage 5 - Close context
      if (page) {
        currentStage = 'close_context';
        stageStartTime = Date.now();
        try {
          await pool.releasePage(page);
          stageTimings[currentStage] = Date.now() - stageStartTime;
          console.log(`[ANCESTRY_TRACE] stage=${currentStage} decision_id=${decisionId} duration_ms=${stageTimings[currentStage]} success=true`);
        } catch (closeError: any) {
          stageTimings[currentStage] = Date.now() - stageStartTime;
          console.warn(`[ANCESTRY_TRACE] stage=${currentStage} decision_id=${decisionId} duration_ms=${stageTimings[currentStage]} error=${closeError.message}`);
        }
      }
    }
  });
}

/**
 * Try JSON extraction from page (most reliable method)
 * Extracts in_reply_to_status_id and conversation_id from Twitter's embedded JSON
 */
async function tryJsonExtraction(page: any, tweetId: string): Promise<RootTweetResolution | null> {
  try {
    const jsonData = await page.evaluate(() => {
      // Method 1: Look for Twitter's embedded JSON in script tags
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const script of scripts) {
        const text = script.textContent || '';
        // Look for JSON that contains tweet data
        if (text.includes('"tweetId"') || text.includes('"conversationId"') || text.includes('"inReplyToStatusId"')) {
          try {
            // Try to extract JSON object
            const jsonMatch = text.match(/\{.*"tweetId".*\}/s);
            if (jsonMatch) {
              const data = JSON.parse(jsonMatch[0]);
              if (data.tweetId || data.conversationId || data.inReplyToStatusId) {
                return data;
              }
            }
          } catch {}
        }
      }
      
      // Method 2: Look for data attributes on article
      const article = document.querySelector('article[data-testid="tweet"]');
      if (article) {
        const dataAttrs: Record<string, string> = {};
        Array.from(article.attributes).forEach(attr => {
          if (attr.name.startsWith('data-')) {
            dataAttrs[attr.name] = attr.value;
          }
        });
        // Check for conversation or reply indicators
        if (dataAttrs['data-conversation-id'] || dataAttrs['data-reply-to']) {
          return { articleData: dataAttrs };
        }
      }
      
      // Method 3: Look for meta tags
      const metaTags = Array.from(document.querySelectorAll('meta[property], meta[name]'));
      const metaData: Record<string, string> = {};
      metaTags.forEach(meta => {
        const prop = meta.getAttribute('property') || meta.getAttribute('name');
        const content = meta.getAttribute('content');
        if (prop && content) {
          metaData[prop] = content;
        }
      });
      if (metaData['twitter:data1'] || metaData['og:url']) {
        return { metaData };
      }
      
      return null;
    });
    
    if (!jsonData) {
      return null;
    }
    
    // Extract conversation_id or in_reply_to from JSON
    let rootTweetId: string | null = null;
    let isReply = false;
    
    if (jsonData.conversationId && jsonData.conversationId !== tweetId) {
      rootTweetId = jsonData.conversationId;
      isReply = true;
    } else if (jsonData.inReplyToStatusId) {
      rootTweetId = jsonData.inReplyToStatusId;
      isReply = true;
    } else if (jsonData.articleData) {
      const convId = jsonData.articleData['data-conversation-id'];
      if (convId && convId !== tweetId) {
        rootTweetId = convId;
        isReply = true;
      }
    }
    
    if (isReply && rootTweetId) {
      console.log(`[REPLY_SELECT] ✅ JSON extraction: ${tweetId} → root ${rootTweetId}`);
      return {
        originalTweetId: tweetId,
        rootTweetId: rootTweetId,
        isRootTweet: false,
        rootTweetUrl: `https://x.com/i/web/status/${rootTweetId}`,
        rootTweetAuthor: null,
        rootTweetContent: null,
        status: 'OK',
        confidence: 'HIGH',
        method: 'json_extraction',
        signals: {
          replying_to_text: false,
          social_context: false,
          main_article_reply_indicator: false,
          multiple_articles: false,
          verification_passed: true,
        },
      };
    }
    
    // If no reply indicators found, assume root
    if (!isReply) {
      console.log(`[REPLY_SELECT] ✅ JSON extraction: ${tweetId} appears to be root`);
      return {
        originalTweetId: tweetId,
        rootTweetId: tweetId,
        isRootTweet: true,
        rootTweetUrl: `https://x.com/i/web/status/${tweetId}`,
        rootTweetAuthor: null,
        rootTweetContent: null,
        status: 'OK',
        confidence: 'HIGH',
        method: 'json_extraction',
        signals: {
          replying_to_text: false,
          social_context: false,
          main_article_reply_indicator: false,
          multiple_articles: false,
          verification_passed: true,
        },
      };
    }
    
    return null; // Fall back to DOM if JSON extraction incomplete
  } catch (error: any) {
    console.warn(`[REPLY_SELECT] JSON extraction failed: ${error.message}`);
    return null;
  }
}

/**
 * Check if a tweet content looks like a reply (starts with @)
 */
export function looksLikeReply(tweetContent: string): boolean {
  const trimmed = tweetContent.trim();
  return trimmed.startsWith('@');
}

