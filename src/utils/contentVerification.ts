/**
 * 🔍 CONTENT VERIFICATION UTILITY
 * Verifies that tweet_id matches expected content
 * Prevents misattribution bugs
 */

export interface VerificationResult {
  isValid: boolean;
  similarity: number; // 0-1 score
  expectedPreview: string;
  actualPreview: string;
  error?: string;
}

/**
 * Calculate text similarity (simple Levenshtein-based)
 */
function calculateSimilarity(text1: string, text2: string): number {
  // Normalize: lowercase, remove extra whitespace
  const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ').substring(0, 200);
  const norm1 = normalize(text1);
  const norm2 = normalize(text2);
  
  // Exact match
  if (norm1 === norm2) return 1.0;
  
  // Calculate simple similarity (ratio of matching words)
  const words1 = new Set(norm1.split(/\s+/));
  const words2 = new Set(norm2.split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  // Jaccard similarity
  const similarity = intersection.size / union.size;
  
  // Also check for substring match (handles truncation)
  if (norm1.includes(norm2.substring(0, 50)) || norm2.includes(norm1.substring(0, 50))) {
    return Math.max(similarity, 0.8); // Boost if one is substring of other
  }
  
  return similarity;
}

/**
 * Verify that actual content matches expected content
 */
export function verifyContentMatch(
  expectedContent: string,
  actualContent: string | null | undefined,
  threshold: number = 0.7 // 70% similarity required
): VerificationResult {
  if (!actualContent) {
    return {
      isValid: false,
      similarity: 0,
      expectedPreview: expectedContent.substring(0, 100),
      actualPreview: 'NO CONTENT',
      error: 'Actual content is null or undefined'
    };
  }
  
  const similarity = calculateSimilarity(expectedContent, actualContent);
  const isValid = similarity >= threshold;
  
  return {
    isValid,
    similarity,
    expectedPreview: expectedContent.substring(0, 100),
    actualPreview: actualContent.substring(0, 100),
    error: isValid ? undefined : `Similarity ${(similarity * 100).toFixed(1)}% is below threshold ${(threshold * 100).toFixed(0)}%`
  };
}

/**
 * Verify thread content match
 */
export function verifyThreadContentMatch(
  expectedThreadParts: string[],
  actualContent: string | null | undefined,
  threshold: number = 0.6 // Lower threshold for threads (content might be truncated)
): VerificationResult {
  if (!actualContent) {
    return {
      isValid: false,
      similarity: 0,
      expectedPreview: expectedThreadParts[0]?.substring(0, 100) || 'NO THREAD',
      actualPreview: 'NO CONTENT',
      error: 'Actual content is null or undefined'
    };
  }
  
  // For threads, check if actual content matches first thread part (most important)
  const firstPart = expectedThreadParts[0] || '';
  const similarity = calculateSimilarity(firstPart, actualContent);
  const isValid = similarity >= threshold;
  
  return {
    isValid,
    similarity,
    expectedPreview: firstPart.substring(0, 100),
    actualPreview: actualContent.substring(0, 100),
    error: isValid ? undefined : `Thread similarity ${(similarity * 100).toFixed(1)}% is below threshold ${(threshold * 100).toFixed(0)}%`
  };
}

/**
 * Verify posted content by fetching actual tweet from Twitter
 * Uses browser automation to fetch tweet content and verify it matches
 */
export async function verifyPostedContent(
  tweetId: string,
  expectedContent: string
): Promise<VerificationResult> {
  try {
    const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
    const browserPool = UnifiedBrowserPool.getInstance();
    const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
    
    // Fetch actual tweet content from Twitter
    const actualContent = await browserPool.withContext(
      'content_verification',
      async (context) => {
        const page = await context.newPage();
        try {
          // Navigate to tweet
          const tweetUrl = `https://x.com/${username}/status/${tweetId}`;
          await page.goto(tweetUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
          
          // Wait for tweet content to load
          await page.waitForSelector('[data-testid="tweetText"]', { timeout: 10000 }).catch(() => null);
          
          // Extract tweet text
          const tweetText = await page.evaluate(() => {
            const textElement = document.querySelector('[data-testid="tweetText"]');
            return textElement?.textContent?.trim() || '';
          });
          
          return tweetText || null;
        } finally {
          await page.close();
        }
      },
      3 // Lower priority (background verification)
    );
    
    if (!actualContent) {
      return {
        isValid: false,
        similarity: 0,
        expectedPreview: expectedContent.substring(0, 100),
        actualPreview: 'NO CONTENT FOUND',
        error: 'Could not fetch tweet content from Twitter'
      };
    }
    
    // Verify content matches
    return verifyContentMatch(expectedContent, actualContent, 0.7);
  } catch (error: any) {
    return {
      isValid: false,
      similarity: 0,
      expectedPreview: expectedContent.substring(0, 100),
      actualPreview: 'VERIFICATION FAILED',
      error: `Verification error: ${error.message}`
    };
  }
}

