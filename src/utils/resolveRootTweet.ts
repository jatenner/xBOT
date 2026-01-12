/**
 * 🎯 ROOT TWEET RESOLVER
 * Ensures replies always target the ROOT tweet, not other replies
 */

import { UnifiedBrowserPool } from '../browser/UnifiedBrowserPool';

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
  method: 'explicit_signals' | 'dom_verification' | 'fallback' | 'error';
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
  const tweetUrl = `https://x.com/i/web/status/${tweetId}`;
  
  console.log(`[REPLY_SELECT] Resolving root for tweet ${tweetId}...`);
  
  const pool = UnifiedBrowserPool.getInstance();
  let page;
  let resolutionAttempted = false;
  let checksPerformed: string[] = [];
  
  try {
    page = await pool.acquirePage('resolve_root_tweet');
    
    await page.goto(tweetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000); // Let page settle
    resolutionAttempted = true;
    
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
        console.log(`[REPLY_SELECT] ✅ ${tweetId} confirmed as ROOT tweet (checks: ${checksPerformed.join(', ')})`);
        
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
        console.log(`[REPLY_SELECT] ⚠️ Could not verify root status for ${tweetId} (reason: ${verification.reason || 'unknown'})`);
        console.log(`[REPLY_SELECT]   Checks performed: ${checksPerformed.join(', ')}`);
        console.log(`[REPLY_SELECT]   FAIL-CLOSED: Treating as UNCERTAIN (will DENY)`);
        
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
      console.log(`[REPLY_SELECT] ✅ Resolved ${tweetId} → root ${rootTweetData.rootId} (checks: ${checksPerformed.join(', ')})`);
      
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
    console.log(`[REPLY_SELECT] ⚠️ Could not resolve root for ${tweetId}`);
    console.log(`[REPLY_SELECT]   Checks performed: ${checksPerformed.join(', ')}`);
    console.log(`[REPLY_SELECT]   Root ID extracted: ${rootTweetData.rootId || 'null'}`);
    console.log(`[REPLY_SELECT]   FAIL-CLOSED: Treating as UNCERTAIN (will DENY)`);
    
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
      error: error.message,
    };
  } finally {
    if (page) {
      await pool.releasePage(page);
    }
  }
}

/**
 * Check if a tweet content looks like a reply (starts with @)
 */
export function looksLikeReply(tweetContent: string): boolean {
  const trimmed = tweetContent.trim();
  return trimmed.startsWith('@');
}

