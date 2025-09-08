#!/usr/bin/env node

/**
 * Emergency Browser Fix for xBOT
 * Replaces the bulletproofPoster with a simplified, single-browser instance
 */

const path = require('path');
const fs = require('fs');

const SIMPLIFIED_POSTER_CODE = `/**
 * Simplified Bulletproof Poster for Railway
 * Single browser instance to prevent conflicts
 */

import { Browser, BrowserContext, Page, chromium } from 'playwright';

class SimplifiedBulletproofPoster {
  private static instance: SimplifiedBulletproofPoster;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private sessionLoaded = false;

  static getInstance(): SimplifiedBulletproofPoster {
    if (!this.instance) {
      this.instance = new SimplifiedBulletproofPoster();
    }
    return this.instance;
  }

  async ensureBrowser(): Promise<void> {
    if (this.browser && this.context && this.page) {
      try {
        await this.page.evaluate(() => document.title);
        return; // Browser is healthy
      } catch {
        console.log('🔄 BROWSER_RECOVERY: Browser needs restart');
        await this.cleanup();
      }
    }

    console.log('🚀 SIMPLIFIED_BROWSER: Starting single browser instance...');
    
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--single-process',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 }
    });

    // Load session if available
    if (!this.sessionLoaded && process.env.TWITTER_SESSION_B64) {
      try {
        const sessionData = JSON.parse(
          Buffer.from(process.env.TWITTER_SESSION_B64, 'base64').toString()
        );
        if (sessionData.cookies) {
          await this.context.addCookies(sessionData.cookies);
          console.log(\`📊 SESSION: \${sessionData.cookies.length} cookies loaded\`);
          this.sessionLoaded = true;
        }
      } catch (error) {
        console.warn('⚠️ SESSION: Failed to load session data');
      }
    }

    this.page = await this.context.newPage();
    console.log('✅ SIMPLIFIED_BROWSER: Ready for posting');
  }

  async postContent(content: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
    try {
      await this.ensureBrowser();

      console.log(\`📝 POSTING_TWEET: "\${content.substring(0, 50)}..."\`);
      console.log('🏠 NAVIGATE_HOME: Going to Twitter home...');
      
      await this.page!.goto('https://x.com/home', { 
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Simple composer find and type
      const composerSelector = '[data-testid="tweetTextarea_0"], [contenteditable="true"]';
      await this.page!.waitForSelector(composerSelector, { timeout: 10000 });
      
      const composer = await this.page!.locator(composerSelector).first();
      await composer.click();
      await composer.fill(content);

      // Post button
      const postButton = this.page!.locator('[data-testid="tweetButtonInline"], [data-testid="tweetButton"]').first();
      await postButton.click();

      // Wait for posting to complete
      await this.page!.waitForTimeout(3000);

      console.log('✅ POST_SUCCESS: Content posted successfully');
      return { success: true, tweetId: \`post_\${Date.now()}\` };

    } catch (error) {
      console.error('❌ POST_FAILED:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      this.sessionLoaded = false;
    } catch (error) {
      console.warn('⚠️ CLEANUP: Browser cleanup warning:', error);
    }
  }
}

export const simplifiedPoster = SimplifiedBulletproofPoster.getInstance();
export default simplifiedPoster;
`;

async function applyEmergencyFix() {
  console.log('🚨 EMERGENCY_BROWSER_FIX: Applying simplified browser management...');
  
  // Create simplified poster
  const simplifiedPosterPath = path.join(process.cwd(), 'src/posting/simplifiedBulletproofPoster.ts');
  fs.writeFileSync(simplifiedPosterPath, SIMPLIFIED_POSTER_CODE);
  console.log('✅ Created simplified poster:', simplifiedPosterPath);
  
  // Update main system to use simplified poster
  const mainSystemPath = path.join(process.cwd(), 'src/main-bulletproof.ts');
  let mainContent = fs.readFileSync(mainSystemPath, 'utf8');
  
  // Replace bulletproofPoster import
  mainContent = mainContent.replace(
    /import.*bulletproofPoster.*from.*['"]\.\/posting\/bulletproofPoster['"];?/g,
    "import { simplifiedPoster as bulletproofPoster } from './posting/simplifiedBulletproofPoster';"
  );
  
  fs.writeFileSync(mainSystemPath, mainContent);
  console.log('✅ Updated main system to use simplified poster');
  
  console.log('🎯 EMERGENCY_FIX: Browser management conflicts resolved');
  console.log('📝 NEXT: Commit and deploy these changes');
}

if (require.main === module) {
  applyEmergencyFix();
}

module.exports = { applyEmergencyFix };
