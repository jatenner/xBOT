/**
 * 🤖 HEADLESS X POSTER - TypeScript Integration
 * Integrates with your existing xBOT system architecture
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import { getConfig } from '../config/config';

export interface PostResult {
  success: boolean;
  tweetId?: string;
  error?: string;
  url?: string;
}

export interface SessionData {
  cookies: any[];
  origins?: any[];
}

export class HeadlessXPoster {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private sessionPath: string;

  constructor() {
    // Use environment variable for session path or fallback to local
    this.sessionPath = process.env.XBOT_SESSION_PATH || path.join(process.cwd(), 'data', 'twitter_session.json');
  }

  async initialize(): Promise<void> {
    console.log('🤖 Initializing Headless X Poster...');
    
    // Load session
    const sessionData = this.loadSession();
    if (!sessionData) {
      throw new Error('No valid session found. Please refresh your X session cookies.');
    }

    // Launch headless browser with enhanced stealth
    this.browser = await chromium.launch({
      headless: true, // COMPLETELY HEADLESS
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--no-zygote',
        '--disable-gpu',
        '--disable-features=TranslateUI,VizDisplayCompositor,IsolateOrigins,site-per-process',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-ipc-flooding-protection',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-client-side-phishing-detection',
        '--disable-component-extensions-with-background-pages',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-hang-monitor',
        '--disable-prompt-on-repost',
        '--disable-sync',
        '--metrics-recording-only',
        '--no-first-run',
        '--safebrowsing-disable-auto-update',
        '--enable-automation=false',
        '--password-store=basic',
        '--use-mock-keychain',
        '--window-size=1920,1080',
        '--hide-scrollbars',
        '--mute-audio'
      ]
    });

    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      ignoreHTTPSErrors: true,
      permissions: ['geolocation', 'notifications'],
      geolocation: { longitude: -74.006, latitude: 40.7128 },
      colorScheme: 'light'
    });

    // Apply stealth techniques
    await this.context.addInitScript(() => {
      // Remove webdriver traces
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      
      // Remove automation traces
      delete (window as any).__webdriver_evaluate;
      delete (window as any).__selenium_evaluate;
      delete (window as any).__webdriver_script_function;
      
      // Mock chrome
      (window as any).chrome = {
        runtime: { onConnect: null, onMessage: null },
        loadTimes: function() { return {}; },
        csi: function() { return {}; },
        app: { isInstalled: false }
      };
      
      // Mock plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { description: 'Portable Document Format', filename: 'internal-pdf-viewer', length: 1, name: 'PDF Viewer' }
        ]
      });
      
      // Mock languages
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    });

    // Apply session cookies
    await this.context.addCookies(sessionData.cookies);
    console.log(`✅ Headless browser initialized with ${sessionData.cookies.length} cookies`);
  }

  private loadSession(): SessionData | null {
    try {
      // First try to load from file
      if (fs.existsSync(this.sessionPath)) {
        const data = fs.readFileSync(this.sessionPath, 'utf8');
        const session = JSON.parse(data);
        console.log(`📋 Loaded ${session.cookies?.length || 0} cookies from file`);
        return session;
      }
      
      // Fallback to TWITTER_SESSION_B64 environment variable
      if (process.env.TWITTER_SESSION_B64) {
        console.log('📋 Loading session from TWITTER_SESSION_B64 environment variable');
        const decoded = Buffer.from(process.env.TWITTER_SESSION_B64, 'base64').toString('utf8');
        const session = JSON.parse(decoded);
        console.log(`📋 Loaded ${session.cookies?.length || 0} cookies from environment`);
        return session;
      }
      
      console.error('❌ No session found in file or environment variable');
      return null;
    } catch (error: any) {
      console.error('❌ Failed to load session:', error.message);
      return null;
    }
  }

  async postTweet(text: string): Promise<PostResult> {
    if (!this.context) {
      throw new Error('Poster not initialized. Call initialize() first.');
    }

    console.log(`🐦 Posting tweet: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    
    const page = await this.context.newPage();
    
    try {
      // Navigate to X.com
      console.log('🌐 Navigating to X.com...');
      await page.goto('https://x.com/home', { 
        waitUntil: 'domcontentloaded', 
        timeout: 30000 
      });
      
      // Wait for page to load
      await page.waitForTimeout(3000);
      
      // Check if logged in
      const composeButton = await page.$('[data-testid="SideNav_NewTweet_Button"]');
      if (!composeButton) {
        const title = await page.title();
        const url = page.url();
        throw new Error(`Not logged in. Title: "${title}", URL: ${url}`);
      }
      console.log('✅ Logged in successfully');
      
      // Click compose button
      console.log('🖱️ Opening compose dialog...');
      await composeButton.click();
      await page.waitForTimeout(2000);
      
      // Find text area
      const textArea = await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 10000 });
      if (!textArea) {
        throw new Error('Text area not found');
      }
      console.log('✅ Text area found');
      
      // Clear and type message
      await textArea.click();
      await page.keyboard.press('Meta+a'); // Select all
      await page.keyboard.press('Delete'); // Delete
      await page.waitForTimeout(500);
      
      // Type the message
      await textArea.fill(text);
      await page.waitForTimeout(2000); // Wait for X to process
      console.log('✅ Message typed');
      
      // Find enabled post button
      const postButtonSelectors = [
        '[data-testid="tweetButton"]',
        '[data-testid="tweetButtonInline"]',
        '[role="button"][aria-label*="Post"]'
      ];
      
      let postButton = null;
      for (const selector of postButtonSelectors) {
        try {
          const btn = await page.$(selector);
          if (btn) {
            const isEnabled = await btn.isEnabled();
            if (isEnabled) {
              postButton = btn;
              console.log(`✅ Found enabled post button: ${selector}`);
              break;
            }
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      if (!postButton) {
        throw new Error('No enabled post button found');
      }
      
      // Click post button
      console.log('📤 Posting tweet...');
      await postButton.click();
      
      // Wait for posting to complete
      await page.waitForTimeout(5000);
      
      // Check for success
      const currentUrl = page.url();
      const success = currentUrl.includes('/home') || currentUrl.includes('/status/');
      
      if (success) {
        console.log('🎉 Tweet posted successfully!');
        
        // Try to extract tweet ID
        const tweetIdMatch = currentUrl.match(/\/status\/(\d+)/);
        const tweetId = tweetIdMatch ? tweetIdMatch[1] : `posted_${Date.now()}`;
        
        return {
          success: true,
          tweetId,
          url: tweetIdMatch ? `https://x.com/i/status/${tweetId}` : undefined
        };
      } else {
        throw new Error(`Posting failed. Current URL: ${currentUrl}`);
      }
      
    } finally {
      await page.close();
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      console.log('✅ Headless browser closed');
    }
  }
}

// Export default for dynamic imports
export default HeadlessXPoster;
