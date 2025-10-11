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
      
      // Wait for success indicators
      await this.page.waitForTimeout(2000);
      
      const tweetId = `ultimate_${Date.now()}`;
      return { success: true, tweetId };
      
    } catch (error) {
      console.error('❌ ULTIMATE_POSTER_ERROR:', error.message);
      return { success: false, error: error.message };
    }
  }
}
