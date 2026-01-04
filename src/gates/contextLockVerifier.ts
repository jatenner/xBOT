/**
 * 🔒 CONTEXT LOCK VERIFIER - Post-time verification before posting reply
 * Fetches target tweet to ensure it exists, is root, and content matches snapshot
 */

import { Page } from 'playwright';

// Configurable thresholds
const CONTEXT_LOCK_MIN_SIMILARITY = parseFloat(process.env.CONTEXT_LOCK_MIN_SIMILARITY || '0.80');
const CONTEXT_LOCK_VERIFY_ENABLED = process.env.CONTEXT_LOCK_VERIFY_ENABLED !== 'false';

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

  const intersection = new Set([...tokens1].filter(t => tokens2.has(t)));
  const union = new Set([...tokens1, ...tokens2]);

  return intersection.size / union.size; // Jaccard similarity
}

/**
 * Fetch tweet via Playwright and extract text + metadata
 */
async function fetchTweetData(targetTweetId: string): Promise<{
  text: string;
  isReply: boolean;
} | null> {
  let page: Page | null = null;

  try {
    // Get browser pool
    const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
    const pool = UnifiedBrowserPool.getInstance();

    page = await pool.acquirePage('context_verifier');

    const tweetUrl = `https://x.com/i/status/${targetTweetId}`;
    console.log(`[CONTEXT_LOCK_VERIFY] 🌐 Navigating to ${tweetUrl}`);

    await page.goto(tweetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    // Wait for tweet article to load
    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });
    await page.waitForTimeout(2000); // Let content stabilize

    // Extract tweet text
    const tweetText = await page
      .$eval('article[data-testid="tweet"] div[data-testid="tweetText"]', el => el.textContent || '')
      .catch(() => '');

    if (!tweetText) {
      console.warn(`[CONTEXT_LOCK_VERIFY] ⚠️ Could not extract tweet text for ${targetTweetId}`);
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
        const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
        const pool = UnifiedBrowserPool.getInstance();
        await pool.releasePage(page, 'context_verifier');
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
  targetTweetContentHash: string
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

    // Compare fetched text to snapshot
    const fetchedText = tweetData.text;
    const similarity = computeTextSimilarity(fetchedText, targetTweetContentSnapshot);

    console.log(
      `[CONTEXT_LOCK_VERIFY] 📊 Content similarity: ${similarity.toFixed(3)} (threshold: ${CONTEXT_LOCK_MIN_SIMILARITY})`
    );

    if (similarity < CONTEXT_LOCK_MIN_SIMILARITY) {
      console.warn(`[CONTEXT_LOCK_VERIFY] ⚠️ Content mismatch detected`);
      console.warn(`[CONTEXT_LOCK_VERIFY]   Snapshot: "${targetTweetContentSnapshot.substring(0, 80)}..."`);
      console.warn(`[CONTEXT_LOCK_VERIFY]   Fetched:  "${fetchedText.substring(0, 80)}..."`);

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
    }

    // All checks passed
    console.log(`[CONTEXT_LOCK_VERIFY] ✅ Verification passed for ${targetTweetId}`);
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

