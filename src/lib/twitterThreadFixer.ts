/**
 * 🧵 TWITTER THREAD FIXER
 * Ensures threads post completely with real tweet IDs
 */

export class TwitterThreadFixer {
  
  /**
   * Extract tweet ID using multiple advanced methods
   */
  static async extractTweetId(page: any): Promise<string | null> {
    try {
      // Method 1: Wait for URL change and extract from there
      await page.waitForTimeout(2000);
      let currentUrl = page.url();
      console.log(`🔍 URL_EXTRACT_1: ${currentUrl}`);
      
      // Method 2: Look for redirect to tweet URL
      if (currentUrl.includes('/home') || currentUrl.includes('/compose')) {
        console.log('🔄 Waiting for redirect to tweet URL...');
        await page.waitForTimeout(3000);
        currentUrl = page.url();
        console.log(`🔍 URL_EXTRACT_2: ${currentUrl}`);
      }
      
      // Method 3: Multiple URL pattern matching
      const patterns = [
        /status\/(\d+)/,           // Standard /status/ID
        /tweet\/(\d+)/,            // Alternative /tweet/ID  
        /\/(\d{19})/,              // Any 19-digit Twitter ID
        /\/(\d{15,})/,             // Any long number (15+ digits)
        /(\d{19})/,                // 19-digit anywhere in URL
      ];
      
      for (const pattern of patterns) {
        const match = currentUrl.match(pattern);
        if (match) {
          console.log(`✅ TWEET_ID_EXTRACTED: ${match[1]} via ${pattern}`);
          return match[1];
        }
      }
      
      // Method 4: Look for tweet elements on page
      const tweetId = await this.extractIdFromPageElements(page);
      if (tweetId) {
        console.log(`✅ TWEET_ID_FROM_ELEMENT: ${tweetId}`);
        return tweetId;
      }
      
      // Method 5: Check browser history/navigation
      const historyId = await this.extractFromBrowserHistory(page);
      if (historyId) {
        console.log(`✅ TWEET_ID_FROM_HISTORY: ${historyId}`);
        return historyId;
      }
      
      console.warn(`❌ TWEET_ID_EXTRACTION_FAILED: URL=${currentUrl}`);
      return null;
      
    } catch (error) {
      console.error('Tweet ID extraction error:', error);
      return null;
    }
  }
  
  /**
   * Extract tweet ID from page elements
   */
  private static async extractIdFromPageElements(page: any): Promise<string | null> {
    try {
      // Look for tweet data attributes
      const selectors = [
        '[data-testid="tweet"] article',
        '[data-testid="tweetText"]',
        'article[data-testid="tweet"]',
        'div[data-testid="tweetText"]',
        'time[datetime] a[href*="/status/"]',
      ];
      
      for (const selector of selectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            // Try to get data attributes
            const tweetId = await element.evaluate((el: any) => {
              // Look for data attributes with tweet ID
              const attrs = el.getAttributeNames();
              for (const attr of attrs) {
                const value = el.getAttribute(attr);
                if (value && /^\d{19}$/.test(value)) {
                  return value;
                }
              }
              
              // Look for href with status
              const links = el.querySelectorAll('a[href*="/status/"]');
              for (const link of links) {
                const href = link.getAttribute('href');
                const match = href?.match(/status\/(\d+)/);
                if (match) return match[1];
              }
              
              return null;
            });
            
            if (tweetId) return tweetId;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      return null;
    } catch (error) {
      console.error('Page element extraction error:', error);
      return null;
    }
  }
  
  /**
   * Extract tweet ID from browser history/navigation
   */
  private static async extractFromBrowserHistory(page: any): Promise<string | null> {
    try {
      // Get current location using JavaScript
      const locationData = await page.evaluate(() => {
        return {
          href: window.location.href,
          pathname: window.location.pathname,
          search: window.location.search,
          hash: window.location.hash,
        };
      });
      
      console.log(`🔍 BROWSER_LOCATION:`, locationData);
      
      // Check all location parts for tweet ID
      const allParts = [
        locationData.href,
        locationData.pathname,
        locationData.search,
        locationData.hash
      ];
      
      for (const part of allParts) {
        if (part) {
          const match = part.match(/(\d{19})/);
          if (match) return match[1];
        }
      }
      
      return null;
    } catch (error) {
      console.error('Browser history extraction error:', error);
      return null;
    }
  }
  
  /**
   * Verify tweet was actually posted by checking its existence
   */
  static async verifyTweetExists(page: any, tweetId: string): Promise<boolean> {
    try {
      const tweetUrl = `https://x.com/Signal_Synapse/status/${tweetId}`;
      console.log(`🔍 VERIFYING_TWEET: ${tweetUrl}`);
      
      const response = await page.goto(tweetUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 10000 
      });
      
      if (response.status() === 200) {
        // Check if we can see the tweet content
        const tweetExists = await page.$('[data-testid="tweetText"]');
        console.log(`✅ TWEET_VERIFICATION: ${tweetExists ? 'EXISTS' : 'NOT_FOUND'}`);
        return !!tweetExists;
      }
      
      return false;
    } catch (error) {
      console.error('Tweet verification error:', error);
      return false;
    }
  }
}
