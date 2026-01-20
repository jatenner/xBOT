/**
 * 🔒 CONTEXT LOCK VERIFIER - Post-time verification before posting reply
 * Fetches target tweet to ensure it exists, is root, and content matches snapshot
 */

import { Page } from 'playwright';
import { createHash } from 'crypto';
import { getSupabaseClient } from '../db/index';

// Configurable thresholds
const CONTEXT_LOCK_MIN_SIMILARITY = parseFloat(process.env.CONTEXT_LOCK_SIM_THRESHOLD || process.env.CONTEXT_LOCK_MIN_SIMILARITY || '0.45');
const CONTEXT_LOCK_VERIFY_ENABLED = process.env.CONTEXT_LOCK_VERIFY_ENABLED !== 'false';

/**
 * Normalize tweet text for consistent hashing (matches scheduler normalization)
 * - Remove extra whitespace (collapse to single space)
 * - Normalize line breaks (collapse multiple newlines)
 * - Trim
 */
export function normalizeTweetText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

export interface VerificationResult {
  pass: boolean;
  skip_reason: string | null;
  details: {
    target_exists: boolean;
    is_root_tweet: boolean;
    content_similarity?: number;
    fetched_text?: string;
    snapshot_text?: string;
  };
}

/**
 * Compute normalized string similarity (Jaccard/token overlap)
 * Good enough for context drift detection
 */
function computeTextSimilarity(text1: string, text2: string): number {
  const normalize = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);

  const tokens1 = new Set(normalize(text1));
  const tokens2 = new Set(normalize(text2));

  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  const intersection = new Set(Array.from(tokens1).filter(t => tokens2.has(t)));
  const union = new Set([...Array.from(tokens1), ...Array.from(tokens2)]);

  return intersection.size / union.size; // Jaccard similarity
}

/**
 * Fetch tweet via Playwright and extract text + metadata
 * Exported for use by scheduler
 */
export async function fetchTweetData(targetTweetId: string): Promise<{
  text: string;
  isReply: boolean;
} | null> {
  let page: Page | null = null;
  let context: any = null;

  try {
    // Use CDP mode on Mac Runner
    if (process.env.RUNNER_MODE === 'true' && process.env.RUNNER_BROWSER === 'cdp') {
      const { launchRunnerPersistent } = await import('../infra/playwright/runnerLauncher');
      context = await launchRunnerPersistent(true); // headless
      page = await context.newPage();
      console.log(`[CONTEXT_LOCK_VERIFY] 🔌 Using CDP mode for tweet fetch`);
      
      // Setup resource blocking for CDP mode (images, media, fonts, stylesheets)
      try {
        const client = await page.context().newCDPSession(page);
        await client.send('Network.enable');
        await client.send('Network.setRequestInterception', {
          patterns: [
            { urlPattern: '*', resourceType: 'Image', interceptionStage: 'HeadersReceived' },
            { urlPattern: '*', resourceType: 'Media', interceptionStage: 'HeadersReceived' },
            { urlPattern: '*', resourceType: 'Font', interceptionStage: 'HeadersReceived' },
            { urlPattern: '*', resourceType: 'Stylesheet', interceptionStage: 'HeadersReceived' },
          ],
        });
        
        // Fallback: use route() for resource blocking
        await page.route('**/*', (route: any) => {
          const resourceType = route.request().resourceType();
          if (['image', 'media', 'font', 'stylesheet'].includes(resourceType)) {
            route.abort();
          } else {
            route.continue();
          }
        });
      } catch (routeError: any) {
        console.warn(`[CONTEXT_LOCK_VERIFY] ⚠️ Resource blocking setup failed: ${routeError.message}`);
      }
    } else {
      // Use browser pool on Railway
      const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
      const pool = UnifiedBrowserPool.getInstance();
      page = await pool.acquirePage('context_verifier');
    }

    const tweetUrl = `https://x.com/i/status/${targetTweetId}`;
    console.log(`[CONTEXT_LOCK_VERIFY] 🌐 Navigating to ${tweetUrl}`);

    await page.goto(tweetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 12000 // 12s timeout (reduced from 15s)
    });

    // Wait for shell indicators first (faster than tweet article)
    const shellOrTweet = await Promise.race([
      page.waitForSelector('nav[role="navigation"]', { timeout: 5000 }).then(() => 'shell').catch(() => null),
      page.waitForSelector('[data-testid="SideNav_NewTweet_Button"]', { timeout: 5000 }).then(() => 'shell').catch(() => null),
      page.waitForSelector('article[data-testid="tweet"]', { timeout: 8000 }).then(() => 'tweet').catch(() => null),
      new Promise(resolve => setTimeout(() => resolve(null), 9000)), // Fallback timeout
    ]).catch(() => null);
    
    if (!shellOrTweet) {
      // Shell present but tweet missing - try reload once
      console.warn(`[CONTEXT_LOCK_VERIFY] ⚠️ Shell present but tweet missing for ${targetTweetId}, attempting reload...`);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }
    
    // Wait for tweet article to load (with shorter timeout)
    try {
      await page.waitForSelector('article[data-testid="tweet"]', { timeout: 8000 });
    } catch (waitError: any) {
      // Check if shell is present but tweet is missing
      const hasShell = await page.$('nav[role="navigation"]').catch(() => null);
      if (hasShell) {
        console.warn(`[CONTEXT_LOCK_VERIFY] ⚠️ Shell present but tweet article not found for ${targetTweetId} - returning NO_CONTENT_DETECTED`);
        return null; // Treat as NO_CONTENT_DETECTED, not consent wall
      }
      throw waitError;
    }
    
    await page.waitForTimeout(1000); // Reduced from 2s - let content stabilize

    // Handle "Show more" button if present
    try {
      const showMoreButton = await page.$('article[data-testid="tweet"] span:has-text("Show more")').catch(() => null);
      if (showMoreButton) {
        await showMoreButton.click().catch(() => {});
        await page.waitForTimeout(1000); // Wait for expansion
      }
    } catch (e) {
      // Ignore show more errors
    }

    // Extract tweet text - collect all spans inside tweetText container
    const tweetText = await page.evaluate(() => {
      const article = document.querySelector('article[data-testid="tweet"]');
      if (!article) return '';
      
      // Try primary selector first
      const tweetTextEl = article.querySelector('[data-testid="tweetText"]');
      if (tweetTextEl) {
        // Collect all text from spans inside
        const spans = tweetTextEl.querySelectorAll('span');
        const texts: string[] = [];
        spans.forEach(span => {
          const text = span.textContent?.trim();
          if (text && text.length > 0) {
            texts.push(text);
          }
        });
        
        // If we got spans, join them; otherwise use textContent
        if (texts.length > 0) {
          return texts.join(' ');
        }
        return tweetTextEl.textContent || '';
      }
      
      // Fallback: try to find any text container in article
      const allText = article.textContent || '';
      return allText;
    }).catch(() => '');

    if (!tweetText || tweetText.trim().length < 10) {
      console.warn(`[CONTEXT_LOCK_VERIFY] ⚠️ Could not extract tweet text for ${targetTweetId} (length=${tweetText?.length || 0})`);
      
      // Save debug artifacts in CDP mode
      if (process.env.RUNNER_MODE === 'true' && process.env.RUNNER_BROWSER === 'cdp') {
        const fs = require('fs');
        const path = require('path');
        const debugDir = path.join(process.env.RUNNER_PROFILE_DIR || '.runner-profile', 'harvest_debug');
        if (!fs.existsSync(debugDir)) {
          fs.mkdirSync(debugDir, { recursive: true });
        }
        
        await page.screenshot({ path: path.join(debugDir, `${targetTweetId}_no_content.png`) }).catch(() => {});
        const html = await page.content().catch(() => '');
        if (html) {
          fs.writeFileSync(path.join(debugDir, `${targetTweetId}_no_content.html`), html);
        }
      }
      
      return null;
    }

    // Check if it's a reply (has "Replying to" link)
    const isReply = await page
      .$('article[data-testid="tweet"] div[dir="ltr"] a[href*="/"]')
      .then(el => {
        if (!el) return false;
        // Check if there's a "Replying to" text nearby
        return page!.$('div[dir="ltr"]:has-text("Replying to")').then(replyingTo => !!replyingTo);
      })
      .catch(() => false);

    console.log(`[CONTEXT_LOCK_VERIFY] ✅ Fetched tweet: length=${tweetText.length}, isReply=${isReply}`);

    return {
      text: tweetText.trim(),
      isReply
    };
  } catch (error: any) {
    console.error(`[CONTEXT_LOCK_VERIFY] ❌ Error fetching tweet ${targetTweetId}: ${error.message}`);
    return null;
  } finally {
    if (page) {
      try {
        if (context) {
          // CDP mode: close page and context
          await page.close();
          await context.close();
        } else {
          // Browser pool mode: release page
          const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
          const pool = UnifiedBrowserPool.getInstance();
          await pool.releasePage(page);
        }
      } catch (e) {
        console.error('[CONTEXT_LOCK_VERIFY] Error releasing page:', e);
      }
    }
  }
}

/**
 * Verify context lock by fetching target tweet
 * MUST be called immediately before posting reply
 */
export async function verifyContextLock(
  targetTweetId: string,
  targetTweetContentSnapshot: string,
  targetTweetContentHash: string,
  targetTweetContentPrefixHash?: string // 🔒 TASK 2: Optional prefix hash for fallback matching
): Promise<VerificationResult> {
  console.log(`[CONTEXT_LOCK_VERIFY] 🔍 Verifying context lock for tweet ${targetTweetId}`);

  // Check if verification is enabled
  if (!CONTEXT_LOCK_VERIFY_ENABLED) {
    console.log(`[CONTEXT_LOCK_VERIFY] ⏭️ Verification disabled via CONTEXT_LOCK_VERIFY_ENABLED=false`);
    return {
      pass: true,
      skip_reason: null,
      details: {
        target_exists: true, // Assume true when disabled
        is_root_tweet: true
      }
    };
  }

  try {
    // Fetch the target tweet
    const tweetData = await fetchTweetData(targetTweetId);

    if (!tweetData) {
      console.warn(`[CONTEXT_LOCK_VERIFY] ⚠️ Target tweet ${targetTweetId} not found or deleted`);
      return {
        pass: false,
        skip_reason: 'target_not_found_or_deleted',
        details: {
          target_exists: false,
          is_root_tweet: false
        }
      };
    }

    // Check if tweet is a reply (not root)
    if (tweetData.isReply) {
      console.warn(`[CONTEXT_LOCK_VERIFY] ⚠️ Target tweet ${targetTweetId} is a reply, not root`);
      return {
        pass: false,
        skip_reason: 'target_not_root',
        details: {
          target_exists: true,
          is_root_tweet: false,
          fetched_text: tweetData.text.substring(0, 100)
        }
      };
    }

    // 🔒 TASK 3: Hash-first matching with similarity fallback
    const fetchedText = tweetData.text;
    
    // Normalize fetched text using same function as scheduler
    const normalizedFetchedText = normalizeTweetText(fetchedText);
    const normalizedSnapshot = normalizeTweetText(targetTweetContentSnapshot);
    
    // Compute hash of normalized fetched text
    const liveHash = createHash('sha256')
      .update(normalizedFetchedText)
      .digest('hex');
    
    console.log(`[CONTEXT_LOCK_VERIFY] 🔐 Hash comparison: live=${liveHash.substring(0, 16)}... snapshot=${targetTweetContentHash.substring(0, 16)}...`);
    
    // 🔒 TASK 3: Hash match = PASS (exact match)
    if (liveHash === targetTweetContentHash) {
      console.log(`[CONTEXT_LOCK_VERIFY] ✅ Hash match (exact) for ${targetTweetId}`);
      
      // 🔒 TASK 4: Emit hash_match event
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        event_type: 'context_lock_hash_match',
        severity: 'info',
        message: `Context lock hash match: tweet_id=${targetTweetId}`,
        event_data: {
          target_tweet_id: targetTweetId,
          live_hash: liveHash.substring(0, 32),
          snapshot_hash: targetTweetContentHash.substring(0, 32),
          normalized_length: normalizedFetchedText.length,
        },
        created_at: new Date().toISOString(),
      });
      
      return {
        pass: true,
        skip_reason: null,
        details: {
          target_exists: true,
          is_root_tweet: true,
          content_similarity: 1.0, // Hash match = perfect similarity
          fetched_text: fetchedText.substring(0, 100)
        }
      };
    }
    
    // 🔒 TASK 2: Prefix hash fallback check (if prefix hash provided)
    if (targetTweetContentPrefixHash) {
      const prefixText = normalizedFetchedText.slice(0, 500);
      const livePrefixHash = createHash('sha256')
        .update(prefixText)
        .digest('hex');
      
      console.log(`[CONTEXT_LOCK_VERIFY] 🔐 Prefix hash comparison: live=${livePrefixHash.substring(0, 16)}... snapshot=${targetTweetContentPrefixHash.substring(0, 16)}...`);
      
      if (livePrefixHash === targetTweetContentPrefixHash) {
        console.log(`[CONTEXT_LOCK_VERIFY] ✅ Prefix hash match for ${targetTweetId}`);
        
        // 🔒 TASK 4: Emit prefix_hash_match event
        const supabase = getSupabaseClient();
        await supabase.from('system_events').insert({
          event_type: 'context_lock_prefix_hash_match',
          severity: 'info',
          message: `Context lock prefix hash match: tweet_id=${targetTweetId}`,
          event_data: {
            target_tweet_id: targetTweetId,
            live_prefix_hash: livePrefixHash.substring(0, 32),
            snapshot_prefix_hash: targetTweetContentPrefixHash.substring(0, 32),
            prefix_length: prefixText.length,
            full_hash_mismatch: true,
          },
          created_at: new Date().toISOString(),
        });
        
        return {
          pass: true,
          skip_reason: null,
          details: {
            target_exists: true,
            is_root_tweet: true,
            content_similarity: 0.95, // Prefix match = high similarity
            fetched_text: fetchedText.substring(0, 100)
          }
        };
      }
    }
    
    // Hash mismatch - compute similarity fallback
    console.log(`[CONTEXT_LOCK_VERIFY] ⚠️ Hash mismatch - computing similarity fallback...`);
    const similarity = computeTextSimilarity(normalizedFetchedText, normalizedSnapshot);
    
    console.log(
      `[CONTEXT_LOCK_VERIFY] 📊 Content similarity: ${similarity.toFixed(3)} (threshold: ${CONTEXT_LOCK_MIN_SIMILARITY})`
    );
    
    // 🔒 TASK 3: Similarity fallback check
    if (similarity >= CONTEXT_LOCK_MIN_SIMILARITY) {
      console.log(`[CONTEXT_LOCK_VERIFY] ✅ Similarity fallback passed for ${targetTweetId}`);
      
      // 🔒 TASK 4: Emit hash_mismatch_similarity_pass event
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        event_type: 'context_lock_hash_mismatch_similarity_pass',
        severity: 'info',
        message: `Context lock hash mismatch but similarity passed: tweet_id=${targetTweetId}`,
        event_data: {
          target_tweet_id: targetTweetId,
          live_hash: liveHash.substring(0, 32),
          snapshot_hash: targetTweetContentHash.substring(0, 32),
          similarity: similarity,
          threshold: CONTEXT_LOCK_MIN_SIMILARITY,
          normalized_length: normalizedFetchedText.length,
          snapshot_length: normalizedSnapshot.length,
        },
        created_at: new Date().toISOString(),
      });
      
      return {
        pass: true,
        skip_reason: null,
        details: {
          target_exists: true,
          is_root_tweet: true,
          content_similarity: similarity,
          fetched_text: fetchedText.substring(0, 100)
        }
      };
    }
    
    // Both hash and similarity failed
    console.warn(`[CONTEXT_LOCK_VERIFY] ⚠️ Content mismatch detected`);
    console.warn(`[CONTEXT_LOCK_VERIFY]   Snapshot: "${normalizedSnapshot.substring(0, 80)}..."`);
    console.warn(`[CONTEXT_LOCK_VERIFY]   Fetched:  "${normalizedFetchedText.substring(0, 80)}..."`);
    
    // 🔒 TASK 4: Emit context_lock_failed event
    const supabase = getSupabaseClient();
    await supabase.from('system_events').insert({
      event_type: 'context_lock_failed',
      severity: 'warning',
      message: `Context lock failed: hash mismatch and similarity below threshold`,
      event_data: {
        target_tweet_id: targetTweetId,
        live_hash: liveHash.substring(0, 32),
        snapshot_hash: targetTweetContentHash.substring(0, 32),
        similarity: similarity,
        threshold: CONTEXT_LOCK_MIN_SIMILARITY,
        normalized_length: normalizedFetchedText.length,
        snapshot_length: normalizedSnapshot.length,
        fetched_text_preview: fetchedText.substring(0, 200),
        snapshot_text_preview: targetTweetContentSnapshot.substring(0, 200),
      },
      created_at: new Date().toISOString(),
    });

    return {
      pass: false,
      skip_reason: 'context_mismatch',
      details: {
        target_exists: true,
        is_root_tweet: true,
        content_similarity: similarity,
        fetched_text: fetchedText.substring(0, 200),
        snapshot_text: targetTweetContentSnapshot.substring(0, 200)
      }
    };
  } catch (error: any) {
    console.error(`[CONTEXT_LOCK_VERIFY] ❌ Verification failed with error: ${error.message}`);

    // Fail-closed: block on error
    return {
      pass: false,
      skip_reason: 'verification_fetch_error',
      details: {
        target_exists: false,
        is_root_tweet: false
      }
    };
  }
}

