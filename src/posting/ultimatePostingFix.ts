/**
 * 🎯 ULTIMATE POSTING FIX
 * Combines all working strategies with updated selectors
 */

import { Page } from 'playwright';
import { ULTIMATE_SELECTORS, isLoggedOut } from './ultimateTwitterSelectors';

export class UltimateTwitterPoster {
  constructor(private page: Page) {}

  async postTweet(content: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
    try {
      console.log('🎯 ULTIMATE_POSTER: Starting with updated selectors...');
      
      // 🍪 CRITICAL: Load Twitter session first!
      console.log('🍪 ULTIMATE_SESSION: Loading Twitter session...');
      
      // Load session from environment
      const sessionB64 = process.env.TWITTER_SESSION_B64;
      if (!sessionB64) {
        throw new Error('TWITTER_SESSION_B64 not found in environment');
      }
      
      const sessionData = JSON.parse(Buffer.from(sessionB64, 'base64').toString());
      
      // 🍪 CRITICAL FIX: Parse session data properly
      let cookies = sessionData;
      
      // Debug: Log session data structure
      console.log('🔍 ULTIMATE_DEBUG: Session data type:', typeof sessionData);
      console.log('🔍 ULTIMATE_DEBUG: Is array:', Array.isArray(sessionData));
      
      if (!Array.isArray(sessionData)) {
        // If sessionData is an object, it might be a cookie object or contain cookies
        if (sessionData.cookies && Array.isArray(sessionData.cookies)) {
          // Session data has a cookies array property
          cookies = sessionData.cookies;
          console.log(`🔧 ULTIMATE_SESSION: Using cookies array from session data (${cookies.length} cookies)`);
        } else if (typeof sessionData === 'object') {
          // Try to convert object values to cookie array
          cookies = Object.values(sessionData).filter((cookie: any) => 
            cookie && 
            typeof cookie === 'object' && 
            cookie.name && 
            cookie.value
          );
          console.log(`🔧 ULTIMATE_SESSION: Converted ${cookies.length} valid cookies from object`);
        }
      }
      
      // Validate cookies before adding
      const validCookies = cookies.filter((cookie: any) => 
        cookie && 
        typeof cookie === 'object' && 
        typeof cookie.name === 'string' && 
        typeof cookie.value === 'string'
      );
      
      if (validCookies.length === 0) {
        throw new Error('No valid cookies found in session data');
      }
      
      console.log(`🍪 ULTIMATE_SESSION: Adding ${validCookies.length} valid cookies to browser`);
      await this.page.context().addCookies(validCookies);
      console.log(`✅ ULTIMATE_SESSION: ${validCookies.length} session cookies loaded successfully`);
      
      // Navigate to Twitter
      await this.page.goto('https://x.com', { waitUntil: 'networkidle' });
      console.log('🌐 ULTIMATE_NAVIGATION: Navigated to Twitter');
      
      // Check if logged out
      if (await isLoggedOut(this.page)) {
        throw new Error('Not logged in to Twitter - session may have expired');
      }
      console.log('✅ ULTIMATE_AUTH: Successfully logged in to Twitter');
      
      // Find composer with ultimate selectors
      let composer = null;
      let workingSelector = '';
      
      for (const selector of ULTIMATE_SELECTORS.composer) {
        try {
          console.log(`🔍 ULTIMATE_SELECTOR: Testing "${selector}"`);
          await this.page.waitForSelector(selector, { timeout: 3000 });
          composer = this.page.locator(selector).first();
          
          if (await composer.isVisible()) {
            workingSelector = selector;
            console.log(`✅ ULTIMATE_COMPOSER_FOUND: "${selector}" works!`);
            break;
          }
        } catch (e) {
          console.log(`❌ ULTIMATE_SELECTOR: "${selector}" failed`);
          continue;
        }
      }
      
      if (!composer) {
        throw new Error('No composer found with ultimate selectors');
      }
      
      // Focus and type content
      await composer.click();
      await composer.fill('');
      await composer.type(content, { delay: 50 });
      
      console.log(`✅ ULTIMATE_CONTENT: Typed ${content.length} characters`);
      
      // Find and click post button
      let postButton = null;
      for (const selector of ULTIMATE_SELECTORS.postButton) {
        try {
          postButton = this.page.locator(selector).first();
          if (await postButton.isVisible() && await postButton.isEnabled()) {
            console.log(`✅ ULTIMATE_POST_BUTTON: Found "${selector}"`);
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      if (!postButton) {
        throw new Error('No post button found');
      }
      
      await postButton.click();
      console.log('🚀 ULTIMATE_POST: Tweet submitted!');
      
      // 🕐 Add delay to avoid rate limiting
      console.log('⏳ ULTIMATE_DELAY: Waiting 3 seconds for Twitter to process...');
      await this.page.waitForTimeout(3000);
      
      // 🎯 CRITICAL: Actually verify the tweet was posted to Twitter
      console.log('🔍 ULTIMATE_VERIFICATION: Waiting for Twitter to confirm post...');
      
      try {
        // Method 1: Wait for navigation to status URL (most reliable)
        await this.page.waitForURL(/.*\/status\/\d+/, { timeout: 15000 });
        const tweetUrl = this.page.url();
        const tweetId = tweetUrl.split('/').pop();
        console.log(`✅ ULTIMATE_SUCCESS: Tweet posted with URL: ${tweetUrl}`);
        return { success: true, tweetId: tweetId };
      } catch (urlError) {
        console.log('⚠️ ULTIMATE_VERIFICATION: No status URL redirect, trying alternative verification...');
        
        // Method 2: Check if composer disappeared (weaker but still valid)
        try {
          await this.page.waitForSelector('[data-testid="tweetTextarea_0"]', { 
            state: 'detached', 
            timeout: 10000 
          });
          console.log('✅ ULTIMATE_SUCCESS: Composer disappeared - tweet likely posted');
          return { success: true, tweetId: `ultimate_${Date.now()}` };
        } catch (composerError) {
          console.log('❌ ULTIMATE_VERIFICATION: Composer still present - tweet may not have posted');
          
          // Method 3: STRICT VERIFICATION - Actually check if tweet posted
          console.log('🔄 ULTIMATE_STRICT_VERIFICATION: Checking if tweet actually posted...');
          
          // First check for Twitter error messages
          try {
            const errorMessage = await this.page.locator('[data-testid="toast"] [role="alert"], .r-1loqt21, [data-testid="error"]').first().textContent({ timeout: 2000 });
            if (errorMessage && errorMessage.trim()) {
              console.log(`❌ ULTIMATE_ERROR: Twitter error detected: ${errorMessage}`);
              return { success: false, error: `Twitter rejected post: ${errorMessage}` };
            }
          } catch (e) {
            // No error message found, continue with timeline check
          }
          
          // Navigate to timeline and verify tweet exists
          try {
            await this.page.goto('https://x.com/home', { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(3000);
            
            // Look for our tweet content in the timeline
            const searchText = content.substring(0, 30).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const tweetLocator = this.page.locator(`[data-testid="tweetText"]`).filter({ hasText: new RegExp(searchText, 'i') });
            
            const tweetExists = await tweetLocator.first().isVisible({ timeout: 5000 });
            
            if (tweetExists) {
              console.log('✅ ULTIMATE_SUCCESS: Tweet verified in timeline - actually posted!');
              return { success: true, tweetId: `ultimate_verified_${Date.now()}` };
            } else {
              console.log('❌ ULTIMATE_FAILURE: Tweet NOT in timeline - Twitter silently rejected it');
              return { success: false, error: 'Tweet was silently rejected by Twitter - not found in timeline' };
            }
            
          } catch (verificationError) {
            console.log('❌ ULTIMATE_VERIFICATION_ERROR: Could not verify posting');
            return { success: false, error: `Timeline verification failed: ${verificationError.message}` };
          }
        }
      }
      
    } catch (error) {
      console.error('❌ ULTIMATE_POSTER_ERROR:', error.message);
      return { success: false, error: error.message };
    }
  }
}
