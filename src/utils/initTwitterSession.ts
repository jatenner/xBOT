/**
 * 🔑 TWITTER SESSION INITIALIZER
 * 
 * Run this script to manually log in to Twitter and save session cookies.
 * This session will be used by all scraping operations.
 * 
 * Usage: npm run build && node dist/utils/initTwitterSession.js
 */

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { getChromiumLaunchOptions } from './playwrightUtils';

class TwitterSessionInitializer {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private sessionPath = path.join(process.cwd(), 'twitter-auth.json');

  async initialize(): Promise<void> {
    try {
      console.log('🚀 Launching browser for manual Twitter login...');
      console.log('📝 You will need to log in manually when the browser opens.');
      
      // Get launch options with correct executable path (non-headless for manual login)
      const launchOptions = getChromiumLaunchOptions();
      launchOptions.headless = false; // Non-headless for manual login
      
      // Launch browser in non-headless mode for manual login
      this.browser = await chromium.launch(launchOptions);

      // Create page with realistic settings
      this.page = await this.browser.newPage({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 768 },
        locale: 'en-US',
        timezoneId: 'America/New_York'
      });

      // Navigate to Twitter login
      console.log('🔍 Navigating to Twitter login page...');
      try {
        await this.page.goto('https://twitter.com/login', { 
          waitUntil: 'domcontentloaded',
          timeout: 60000 
        });
      } catch (gotoError) {
        // Take screenshot for debugging and try with different wait strategy
        console.log('🔧 Login page navigation failed, trying fallback...');
        await this.page.screenshot({ path: 'twitter-login-error.png' });
        
        await this.page.goto('https://twitter.com/login', { 
          waitUntil: 'load',
          timeout: 60000 
        });
      }

      console.log('👆 Please complete the login process in the browser window.');
      console.log('⏳ Waiting for you to log in and navigate to your feed...');
      console.log('💡 Look for the Twitter home timeline to confirm you\'re logged in.');

      // Wait for successful login (home feed appears)
      await this.page.waitForSelector('[data-testid="primaryColumn"]', { 
        timeout: 300000 // 5 minutes to log in
      });

      console.log('✅ Login detected! Saving session...');
      await this.saveSession();

      console.log('🎉 Session saved successfully!');
      console.log(`📁 Session file: ${this.sessionPath}`);
      console.log('🤖 Your bot can now use this session for scraping.');

    } catch (error) {
      console.error('❌ Error during session initialization:', error);
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  private async saveSession(): Promise<void> {
    try {
      if (!this.page) {
        throw new Error('Page not initialized');
      }

      // Get all cookies
      const cookies = await this.page.context().cookies();
      
      // Get user agent
      const userAgent = await this.page.evaluate(() => (window as any).navigator.userAgent);

      // Create session data
      const sessionData = {
        cookies,
        userAgent,
        timestamp: Date.now(),
        createdAt: new Date().toISOString(),
        domain: 'twitter.com'
      };

      // Save to file
      fs.writeFileSync(this.sessionPath, JSON.stringify(sessionData, null, 2));
      
      console.log(`✅ Session saved with ${cookies.length} cookies`);
      console.log(`🕐 Created at: ${sessionData.createdAt}`);

    } catch (error) {
      console.error('❌ Error saving session:', error);
      throw error;
    }
  }

  async testSession(): Promise<boolean> {
    try {
      console.log('🧪 Testing saved session...');
      
      if (!fs.existsSync(this.sessionPath)) {
        console.log('❌ No session file found');
        return false;
      }

      const sessionData = JSON.parse(fs.readFileSync(this.sessionPath, 'utf8'));
      
      // Launch browser with session
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      this.page = await this.browser.newPage({
        userAgent: sessionData.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      // Load cookies
      await this.page.context().addCookies(sessionData.cookies);

      // Test by going to Twitter home
      try {
        await this.page.goto('https://twitter.com/home', { 
          waitUntil: 'domcontentloaded',
          timeout: 60000 
        });
      } catch (gotoError) {
        // Try with different wait strategy
        await this.page.goto('https://twitter.com/home', { 
          waitUntil: 'load',
          timeout: 60000 
        });
      }

      // Check if logged in (look for compose tweet button)
      const isLoggedIn = await this.page.locator('[data-testid="SideNav_NewTweet_Button"]').isVisible();
      
      if (isLoggedIn) {
        console.log('✅ Session is valid! Bot can use this session.');
        return true;
      } else {
        console.log('❌ Session expired or invalid. Please run initialization again.');
        return false;
      }

    } catch (error) {
      console.error('❌ Error testing session:', error);
      return false;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

// Main execution
async function main() {
  const initializer = new TwitterSessionInitializer();
  
  const args = process.argv.slice(2);
  const command = args[0] || 'init';

  try {
    if (command === 'test') {
      const isValid = await initializer.testSession();
      process.exit(isValid ? 0 : 1);
    } else {
      await initializer.initialize();
      console.log('\n🎯 Next steps:');
      console.log('1. Test the session: node dist/utils/initTwitterSession.js test');
      console.log('2. Run your scraper tests');
      console.log('3. Deploy to Render with the session file');
    }
  } catch (error) {
    console.error('💥 Session initialization failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

/**
 * 🔑 ENSURE TWITTER SESSION FOR RAILWAY
 * This function ensures the Twitter session is available at startup
 */
export async function ensureTwitterSession(): Promise<boolean> {
  console.log('🔑 === INITIALIZING TWITTER SESSION FOR RAILWAY ===');
  
  const sessionPath = path.join('/app/data', 'twitter_session.json');
  const fallbackPath = path.join(process.cwd(), 'twitter_session.json');
  
  try {
    // Create /app/data directory if it doesn't exist (Railway volume)
    const dataDir = path.dirname(sessionPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log(`📁 Created data directory: ${dataDir}`);
    }
    
    // 🔑 CHECK ENVIRONMENT VARIABLE FIRST (Railway deployment)
    if (process.env.TWITTER_SESSION_DATA) {
      console.log('🔑 Found TWITTER_SESSION_DATA environment variable');
      try {
        const sessionData = JSON.parse(process.env.TWITTER_SESSION_DATA);
        
        // Validate session data structure
        if (sessionData.cookies && Array.isArray(sessionData.cookies) && sessionData.cookies.length > 0) {
          // Write to expected path
          fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2));
          console.log(`✅ Twitter session loaded from environment variable`);
          console.log(`📊 Session contains ${sessionData.cookies.length} cookies`);
          
          // Check session age if timestamp exists
          if (sessionData.timestamp) {
            const ageHours = (Date.now() - sessionData.timestamp) / (1000 * 60 * 60);
            console.log(`⏰ Session age: ${Math.floor(ageHours)} hours old`);
            
            if (ageHours < 48) { // Allow 48 hours for environment sessions
              console.log('✅ Session is fresh and ready to use');
              return true;
            } else {
              console.log('⚠️ Session is older than 48 hours, but will still attempt to use');
            }
          } else {
            console.log('⚠️ No timestamp in session data, age unknown');
          }
          
          return true;
        } else {
          console.log('❌ Invalid session data in environment variable - missing or empty cookies array');
        }
      } catch (parseError) {
        console.log('❌ Failed to parse TWITTER_SESSION_DATA environment variable:', parseError);
      }
    }
    
    // Check if session exists in Railway volume
    if (fs.existsSync(sessionPath)) {
      console.log('✅ Twitter session found in Railway volume');
      
      // Test if session is valid
      const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
      const ageHours = (Date.now() - sessionData.timestamp) / (1000 * 60 * 60);
      
      if (ageHours < 24) { // Session valid for 24 hours
        console.log(`✅ Session is fresh (${Math.floor(ageHours)} hours old)`);
        return true;
      } else {
        console.log('⚠️ Session is stale, will need refresh');
      }
    }
    
    // Check for fallback session in project root
    if (fs.existsSync(fallbackPath)) {
      console.log('📋 Copying session from project root to Railway volume...');
      const sessionData = fs.readFileSync(fallbackPath, 'utf8');
      fs.writeFileSync(sessionPath, sessionData);
      console.log('✅ Session copied to Railway volume');
      return true;
    }
    
    // No session found - log warning but don't fail
    console.log('⚠️ No Twitter session found');
    console.log('💡 The bot will attempt to use headless mode or fallback posting');
    console.log(`📂 Expected session path: ${sessionPath}`);
    console.log('🔧 To add session: Run init-session locally then upload twitter_session.json to Railway');
    
    return false;
    
  } catch (error) {
    console.error('❌ Error ensuring Twitter session:', error);
    console.log('⚠️ Continuing without persistent session - browser posting may fail');
    return false;
  }
}

export { TwitterSessionInitializer }; 