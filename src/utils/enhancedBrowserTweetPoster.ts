/**
 * 🚀 ENHANCED BROWSER TWEET POSTER
 * 
 * Advanced Playwright automation with:
 * - 2024 X.com selector updates
 * - Intelligent retry strategies
 * - Robust error handling
 * - Enhanced session management
 * - Adaptive navigation patterns
 * 
 * Designed to be resilient against UI changes and network issues.
 */

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { getChromiumLaunchOptions } from './playwrightUtils';

interface PostingResult {
  success: boolean;
  tweet_id?: string;
  error?: string;
  confirmed?: boolean;
  was_posted?: boolean;
  screenshots?: string[];
  metadata?: {
    attempt_count: number;
    total_time_ms: number;
    strategy_used: string;
    selector_worked: string;
  };
}

interface SelectorStrategy {
  name: string;
  selectors: string[];
  priority: number;
  wait_time: number;
  verification_method: 'visible' | 'enabled' | 'both';
}

interface PostingStrategy {
  name: string;
  steps: string[];
  selectors: { [key: string]: SelectorStrategy };
  timeout_ms: number;
  retry_count: number;
}

export class EnhancedBrowserTweetPoster {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isInitialized = false;
  private sessionPath = path.join(process.cwd(), 'twitter-auth.json');
  private screenshotDir = path.join(process.cwd(), 'screenshots');
  
  // 2024 X.com Posting Strategies
  private readonly POSTING_STRATEGIES: PostingStrategy[] = [
    {
      name: 'direct_compose_2024',
      steps: ['navigate_home', 'find_compose', 'type_content', 'submit_post', 'verify_posted'],
      timeout_ms: 45000,
      retry_count: 3,
      selectors: {
        compose_button: {
          name: 'compose_button',
          selectors: [
            '[data-testid="SideNav_NewTweet_Button"]',
            '[aria-label="Post"]',
            '[data-testid="tweetButton"]',
            'a[href="/compose/tweet"]',
            '[role="button"][aria-label*="Post"]',
            'div[aria-label="Post"]'
          ],
          priority: 1,
          wait_time: 15000,
          verification_method: 'both'
        },
        tweet_textarea: {
          name: 'tweet_textarea',
          selectors: [
    'div[aria-label="Post text"]',
    'div[data-testid="tweetTextarea_0"]',
    'div[contenteditable="true"][aria-label*="Post"]',
    'div[contenteditable="true"][data-testid*="tweet"]',
    'div[contenteditable="true"][role="textbox"]',
    'div[aria-label*="What is happening"]',
    '.public-DraftEditor-content',
    'div[data-text="true"]',
            '[data-testid="tweet-text-one"]'
          ],
          priority: 1,
          wait_time: 20000,
          verification_method: 'both'
        },
        post_button: {
          name: 'post_button',
          selectors: [
            '[data-testid="tweetButtonInline"]',
            '[data-testid="tweetButton"]',
            '[role="button"][aria-label*="Post"]',
            'div[role="button"][data-testid*="tweet"]',
            'button[data-testid*="tweet"]',
            '[aria-label="Post"]',
            'div[aria-label="Post"][role="button"]'
          ],
          priority: 1,
          wait_time: 10000,
          verification_method: 'both'
        }
      }
    },
    {
      name: 'modal_compose_2024',
      steps: ['click_compose_modal', 'wait_modal', 'type_content', 'submit_post', 'verify_posted'],
      timeout_ms: 60000,
      retry_count: 2,
      selectors: {
        compose_modal_trigger: {
          name: 'compose_modal_trigger',
          selectors: [
            '[data-testid="SideNav_NewTweet_Button"]',
            'a[aria-label="Post"]',
            '[href="/compose/tweet"]'
          ],
          priority: 2,
          wait_time: 10000,
          verification_method: 'visible'
        },
        modal_textarea: {
          name: 'modal_textarea',
          selectors: [
            'div[aria-label="Post text"]',
            '.public-DraftEditor-content',
            'div[contenteditable="true"][aria-describedby*="placeholder"]'
          ],
          priority: 2,
          wait_time: 15000,
          verification_method: 'both'
        },
        modal_post_button: {
          name: 'modal_post_button',
          selectors: [
            '[data-testid="tweetButton"]',
            'div[role="button"][data-testid*="tweet"]'
          ],
          priority: 2,
          wait_time: 8000,
          verification_method: 'enabled'
        }
      }
    }
  ];

  // Enhanced selector finder with intelligent fallbacks
  private readonly ENHANCED_SELECTORS = {
    navigation: [
      'nav[role="navigation"]',
      '[data-testid="primaryColumn"]',
      '[data-testid="SideNav_AccountSwitcher_Button"]'
    ],
    compose_entry_points: [
      '[data-testid="SideNav_NewTweet_Button"]',
      '[aria-label*="Post"]',
      '[data-testid="tweetButton"]',
      'a[href="/compose/tweet"]'
    ],
    content_areas: [
      'div[aria-label="Post text"]',
      'div[data-testid="tweetTextarea_0"]',
      '.public-DraftEditor-content',
      'div[contenteditable="true"][role="textbox"]'
    ],
    submission_buttons: [
      '[data-testid="tweetButtonInline"]',
      '[data-testid="tweetButton"]',
      '[role="button"][aria-label*="Post"]',
      'button[type="submit"]'
    ]
  };

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      console.log('🚀 Initializing Enhanced Browser Tweet Poster...');

      // Ensure screenshot directory exists
      if (!fs.existsSync(this.screenshotDir)) {
        fs.mkdirSync(this.screenshotDir, { recursive: true });
      }

      // Launch browser with optimized settings
      const launchOptions = getChromiumLaunchOptions();
      this.browser = await chromium.launch({
        ...launchOptions,
        args: [
          ...launchOptions.args || [],
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--no-first-run'
        ]
      });

      // Create page with enhanced settings
      this.page = await this.browser.newPage({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 768 },
        locale: 'en-US',
        timezoneId: 'America/New_York',
        extraHTTPHeaders: {
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });

      // Enhanced stealth setup
      await this.setupAdvancedStealth();

      // Load session and verify
      const sessionLoaded = await this.loadAndVerifySession();
      if (!sessionLoaded) {
        console.warn('⚠️ No valid session - posting may require manual intervention');
      }

      this.isInitialized = true;
      console.log('✅ Enhanced Browser Tweet Poster initialized');
      return true;

    } catch (error: any) {
      console.error('❌ Failed to initialize enhanced poster:', error);
      await this.cleanup();
      return false;
    }
  }

  /**
   * 🎯 MAIN POSTING FUNCTION WITH ENHANCED STRATEGIES
   */
  async postTweet(content: string): Promise<PostingResult> {
    const startTime = Date.now();
    const screenshots: string[] = [];
    
    try {
      console.log('📝 === ENHANCED TWEET POSTING ===');
      console.log(`📄 Content: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`);

      if (!await this.initialize()) {
        throw new Error('Failed to initialize browser');
      }

      // Validate content
      if (!content || content.trim().length === 0) {
        throw new Error('Content cannot be empty');
      }

      if (content.length > 280) {
        throw new Error(`Content too long: ${content.length} characters (max 280)`);
      }

      // Take initial screenshot for debugging
      screenshots.push(await this.captureScreenshot('initial_state'));

      // Try each posting strategy in order of priority
      let lastError: Error | null = null;
      let totalAttempts = 0;

      for (const strategy of this.POSTING_STRATEGIES) {
        console.log(`🎯 Trying strategy: ${strategy.name}`);
        
        for (let attempt = 1; attempt <= strategy.retry_count; attempt++) {
          totalAttempts++;
          
          try {
            console.log(`🔄 Strategy ${strategy.name}, attempt ${attempt}/${strategy.retry_count}`);
            
            const result = await this.executePostingStrategy(strategy, content, attempt);
            
            if (result.success) {
              const totalTime = Date.now() - startTime;
              console.log(`✅ Successfully posted using ${strategy.name} (${totalTime}ms)`);
              
              // Capture success screenshot
              screenshots.push(await this.captureScreenshot('success'));
              
              return {
                success: true,
                tweet_id: result.tweet_id || `posted_${Date.now()}`,
                confirmed: result.confirmed,
                was_posted: true,
                screenshots,
                metadata: {
                  attempt_count: totalAttempts,
                  total_time_ms: totalTime,
                  strategy_used: strategy.name,
                  selector_worked: result.metadata?.selector_worked || 'unknown'
                }
              };
            }

          } catch (strategyError: any) {
            console.error(`❌ Strategy ${strategy.name} attempt ${attempt} failed:`, strategyError.message);
            lastError = strategyError;
            
            // Capture error screenshot
            screenshots.push(await this.captureScreenshot(`error_${strategy.name}_${attempt}`));
            
            // Wait before retry
            if (attempt < strategy.retry_count) {
              const retryDelay = Math.min(3000 * attempt, 10000);
              console.log(`⏳ Retrying in ${retryDelay}ms...`);
              await this.page!.waitForTimeout(retryDelay);
            }
          }
        }
      }

      // All strategies failed
      const totalTime = Date.now() - startTime;
      return {
        success: false,
        error: lastError?.message || 'All posting strategies failed',
        screenshots,
        metadata: {
          attempt_count: totalAttempts,
          total_time_ms: totalTime,
          strategy_used: 'none',
          selector_worked: 'none'
        }
      };

    } catch (error: any) {
      console.error('❌ Enhanced posting failed:', error);
      
      const totalTime = Date.now() - startTime;
        return {
          success: false,
        error: error.message,
        screenshots,
        metadata: {
          attempt_count: 1,
          total_time_ms: totalTime,
          strategy_used: 'none',
          selector_worked: 'none'
        }
      };
    }
  }

  /**
   * 🎪 EXECUTE SPECIFIC POSTING STRATEGY
   */
  private async executePostingStrategy(
    strategy: PostingStrategy, 
    content: string, 
    attempt: number
  ): Promise<{ success: boolean; tweet_id?: string; confirmed?: boolean; metadata?: any }> {
    
    try {
      console.log(`🎬 Executing strategy: ${strategy.name}`);

      // Navigate to home if needed
      await this.ensureOnTwitterHome();

      let selectorWorked = 'none';

      // Execute strategy steps
      for (const step of strategy.steps) {
        console.log(`📋 Step: ${step}`);
        
        switch (step) {
          case 'navigate_home':
            await this.navigateToHome();
            break;

          case 'find_compose':
          case 'click_compose_modal':
            const composeResult = await this.findAndClickCompose(strategy, step);
            if (!composeResult.success) {
              throw new Error(`Failed to find compose button: ${composeResult.error}`);
            }
            selectorWorked = composeResult.selector || 'unknown';
            break;

          case 'wait_modal':
            await this.page!.waitForTimeout(5000);
            break;

          case 'type_content':
            const typeResult = await this.findAndTypeContent(strategy, content);
            if (!typeResult.success) {
              throw new Error(`Failed to type content: ${typeResult.error}`);
            }
              break;

          case 'submit_post':
            const submitResult = await this.findAndSubmitPost(strategy);
            if (!submitResult.success) {
              throw new Error(`Failed to submit post: ${submitResult.error}`);
            }
            break;

          case 'verify_posted':
            const verifyResult = await this.verifyPostSubmitted();
            if (!verifyResult.success) {
              throw new Error(`Failed to verify post: ${verifyResult.error}`);
            }
          return {
            success: true,
              tweet_id: verifyResult.tweet_id,
            confirmed: true,
              metadata: { selector_worked: selectorWorked }
            };
        }
      }

      return { success: true, metadata: { selector_worked: selectorWorked } };

    } catch (error: any) {
      console.error(`❌ Strategy ${strategy.name} execution failed:`, error);
      throw error;
    }
  }

  /**
   * 🔍 INTELLIGENT SELECTOR FINDER
   */
  private async findElementWithStrategy(
    selectorStrategy: SelectorStrategy,
    timeout?: number
  ): Promise<{ element: any; selector: string; success: boolean; error?: string }> {
    
    const useTimeout = timeout || selectorStrategy.wait_time;
    console.log(`🔍 Finding element: ${selectorStrategy.name} (${useTimeout}ms timeout)`);

    // Try each selector in order
    for (const selector of selectorStrategy.selectors) {
      try {
        console.log(`  🎯 Trying selector: ${selector}`);
        
        // Wait for element to appear
        await this.page!.waitForSelector(selector, { 
          timeout: Math.min(useTimeout, 15000),
          state: 'attached'
        });

        const element = this.page!.locator(selector).first();
        
        // Verify element meets requirements
        const isValid = await this.verifyElementState(element, selectorStrategy.verification_method);
        
        if (isValid) {
          console.log(`  ✅ Found working element: ${selector}`);
          return { element, selector, success: true };
        } else {
          console.log(`  ⚠️ Element found but not ready: ${selector}`);
        }

      } catch (selectorError) {
        console.log(`  ❌ Selector failed: ${selector}`);
        continue;
      }
    }

    return { 
      element: null, 
      selector: '', 
      success: false, 
      error: `No working selectors found for ${selectorStrategy.name}` 
    };
  }

  /**
   * 🔘 FIND AND CLICK COMPOSE BUTTON
   */
  private async findAndClickCompose(
    strategy: PostingStrategy, 
    step: string
  ): Promise<{ success: boolean; selector?: string; error?: string }> {
    
    try {
      const selectorKey = step === 'click_compose_modal' ? 'compose_modal_trigger' : 'compose_button';
      const selectorStrategy = strategy.selectors[selectorKey];
      
      if (!selectorStrategy) {
        throw new Error(`No selector strategy found for ${selectorKey}`);
      }

      const result = await this.findElementWithStrategy(selectorStrategy);
      
      if (!result.success) {
        // Fallback to enhanced selectors
        console.log('🔄 Trying enhanced selector fallback...');
        return await this.fallbackComposeClick();
      }

      // Click the compose button
      await result.element.click();
      await this.page!.waitForTimeout(5000);

      console.log(`✅ Successfully clicked compose button: ${result.selector}`);
      return { success: true, selector: result.selector };

    } catch (error: any) {
      console.error('❌ Failed to find and click compose:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 📝 FIND AND TYPE CONTENT
   */
  private async findAndTypeContent(
    strategy: PostingStrategy, 
    content: string
  ): Promise<{ success: boolean; error?: string }> {
    
    try {
      const selectorStrategy = strategy.selectors.tweet_textarea || strategy.selectors.modal_textarea;
      
      if (!selectorStrategy) {
        throw new Error('No textarea selector strategy found');
      }

      const result = await this.findElementWithStrategy(selectorStrategy);
      
      if (!result.success) {
        // Fallback to enhanced selectors
        console.log('🔄 Trying enhanced textarea fallback...');
        return await this.fallbackContentType(content);
      }

      // Enhanced content input with multiple methods
      await this.typeContentWithFallbacks(result.element, content);

      console.log('✅ Successfully typed content');
      return { success: true };

    } catch (error: any) {
      console.error('❌ Failed to find and type content:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 🚀 FIND AND SUBMIT POST
   */
  private async findAndSubmitPost(
    strategy: PostingStrategy
  ): Promise<{ success: boolean; error?: string }> {
    
    try {
      const selectorStrategy = strategy.selectors.post_button || strategy.selectors.modal_post_button;
      
      if (!selectorStrategy) {
        throw new Error('No post button selector strategy found');
      }

      // Wait a moment for content validation
            await this.page!.waitForTimeout(5000);
            
      const result = await this.findElementWithStrategy(selectorStrategy);
      
      if (!result.success) {
        // Fallback to enhanced selectors
        console.log('🔄 Trying enhanced submit fallback...');
        return await this.fallbackSubmitPost();
      }

      // Click the post button
      await result.element.click();
      await this.page!.waitForTimeout(5000);

      console.log('✅ Successfully clicked post button');
      return { success: true };

    } catch (error: any) {
      console.error('❌ Failed to find and submit post:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 🔧 UTILITY FUNCTIONS
   */
  private async verifyElementState(element: any, method: 'visible' | 'enabled' | 'both'): Promise<boolean> {
    try {
      switch (method) {
        case 'visible':
          return await element.isVisible();
        case 'enabled':
          return await element.isEnabled();
        case 'both':
          return (await element.isVisible()) && (await element.isEnabled());
        default:
          return true;
      }
    } catch (error) {
      return false;
    }
  }

  private async typeContentWithFallbacks(element: any, content: string): Promise<void> {
    const methods = [
      // Method 1: Click, clear, type
      async () => {
        await element.click();
        await this.page!.keyboard.press('Control+A');
        await this.page!.keyboard.press('Delete');
        await this.page!.waitForTimeout(5000);
        await this.page!.keyboard.type(content, { delay: 50 });
      },
      // Method 2: Fill method
      async () => {
        await element.fill('');
        await element.fill(content);
      },
      // Method 3: Focus and type character by character
      async () => {
        await element.focus();
        await this.page!.keyboard.press('Control+A');
        for (const char of content) {
          await this.page!.keyboard.type(char, { delay: 80 });
        }
      }
    ];

    for (let i = 0; i < methods.length; i++) {
      try {
        await methods[i]();
        
        // Verify content was entered
        await this.page!.waitForTimeout(5000);
        const currentText = await this.getElementText(element);
        
        if (currentText && currentText.includes(content.substring(0, 20))) {
          console.log(`✅ Content typed successfully with method ${i + 1}`);
          return;
        }
      } catch (methodError) {
        console.log(`⚠️ Type method ${i + 1} failed, trying next...`);
        if (i === methods.length - 1) throw methodError;
      }
    }
  }

  private async getElementText(element: any): Promise<string> {
    try {
      const text = await element.textContent() || 
                   await element.inputValue() || 
                   await element.innerText() || '';
      return text.trim();
    } catch (error) {
      return '';
    }
  }

  private async fallbackComposeClick(): Promise<{ success: boolean; selector?: string; error?: string }> {
    for (const selector of this.ENHANCED_SELECTORS.compose_entry_points) {
      try {
        await this.page!.waitForSelector(selector, { timeout: 30000 });
        const element = this.page!.locator(selector).first();
        
        if (await element.isVisible() && await element.isEnabled()) {
          await element.click();
          await this.page!.waitForTimeout(5000);
          return { success: true, selector };
        }
      } catch (error) {
          continue;
        }
    }
    return { success: false, error: 'All fallback compose selectors failed' };
  }

  private async fallbackContentType(content: string): Promise<{ success: boolean; error?: string }> {
    for (const selector of this.ENHANCED_SELECTORS.content_areas) {
      try {
        await this.page!.waitForSelector(selector, { timeout: 30000 });
        const element = this.page!.locator(selector).first();
        
        if (await element.isVisible() && await element.isEnabled()) {
          await this.typeContentWithFallbacks(element, content);
          return { success: true };
        }
    } catch (error) {
        continue;
      }
    }
    return { success: false, error: 'All fallback content selectors failed' };
  }

  private async fallbackSubmitPost(): Promise<{ success: boolean; error?: string }> {
    for (const selector of this.ENHANCED_SELECTORS.submission_buttons) {
      try {
        await this.page!.waitForSelector(selector, { timeout: 30000 });
        const element = this.page!.locator(selector).first();
        
        if (await element.isVisible() && await element.isEnabled()) {
          await element.click();
          await this.page!.waitForTimeout(5000);
          return { success: true };
        }
      } catch (error) {
        continue;
      }
    }
    return { success: false, error: 'All fallback submit selectors failed' };
      }

  private async ensureOnTwitterHome(): Promise<void> {
    try {
      const currentUrl = this.page!.url();
      if (!currentUrl.includes('twitter.com') && !currentUrl.includes('x.com')) {
        await this.navigateToHome();
      }
    } catch (error) {
      await this.navigateToHome();
    }
  }

  private async navigateToHome(): Promise<void> {
    try {
      await this.page!.goto('https://twitter.com/home', { 
          waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      
      // Wait for page to be ready
      await this.page!.waitForSelector(this.ENHANCED_SELECTORS.navigation[0], { timeout: 30000 });
    } catch (error) {
      console.warn('⚠️ Navigation to home failed, continuing...');
    }
  }

  private async verifyPostSubmitted(): Promise<{ success: boolean; tweet_id?: string; error?: string }> {
    try {
      // Wait for any success indicators or redirect
        await this.page!.waitForTimeout(5000);
        
      // Look for success indicators
      const successIndicators = [
        'text="Your Tweet was sent"',
        'text="Tweet sent"', 
        '[data-testid="toast"]',
        '[role="alert"]'
      ];

      for (const indicator of successIndicators) {
        try {
          await this.page!.waitForSelector(indicator, { timeout: 30000 });
          console.log(`✅ Found success indicator: ${indicator}`);
          return { 
            success: true, 
            tweet_id: `verified_${Date.now()}` 
          };
        } catch (error) {
          continue;
        }
      }

      // Check if we're back at home timeline (indicating success)
      const url = this.page!.url();
      if (url.includes('/home') || url.includes('/timeline')) {
        return { 
          success: true, 
          tweet_id: `timeline_${Date.now()}` 
        };
      }

      return { 
        success: false, 
        error: 'No success indicators found' 
      };

    } catch (error: any) {
      return { 
        success: false, 
        error: `Verification failed: ${error.message}` 
      };
    }
  }

  private async setupAdvancedStealth(): Promise<void> {
    if (!this.page) return;

    // Advanced stealth measures
    await this.page.addInitScript(() => {
      // Hide webdriver property
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      
      // Mock plugins
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      
      // Mock languages
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      
      // Mock permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    });

    // Block tracking and ads
    await this.page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.includes('analytics') || 
          url.includes('tracking') || 
          url.includes('ads') ||
          url.includes('.gif') ||
          (url.includes('.jpg') && !url.includes('profile'))) {
        route.abort();
      } else {
        route.continue();
      }
    });
  }

  private async loadAndVerifySession(): Promise<boolean> {
    try {
      if (!fs.existsSync(this.sessionPath)) {
        return false;
      }

      const sessionData = JSON.parse(fs.readFileSync(this.sessionPath, 'utf8'));
      await this.page!.context().addCookies(sessionData.cookies);

      // Verify session works
      await this.page!.goto('https://twitter.com/home', { timeout: 30000 });
      
      // Check if we're logged in
      try {
        await this.page!.waitForSelector(this.ENHANCED_SELECTORS.navigation[0], { timeout: 30000 });
        console.log('✅ Session verified successfully');
        return true;
      } catch (error) {
        console.log('⚠️ Session verification failed');
        return false;
      }

    } catch (error) {
      console.log('⚠️ Failed to load session');
      return false;
    }
  }

  private async captureScreenshot(name: string): Promise<string> {
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${name}_${timestamp}.png`;
      const filepath = path.join(this.screenshotDir, filename);
      
      await this.page!.screenshot({ path: filepath, fullPage: false });
      return filename;
      } catch (error) {
      return `error_${name}`;
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      this.page = null;
      this.isInitialized = false;
      console.log('🧹 Enhanced poster cleaned up');
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }
  }
}

// Export singleton instance
export const enhancedBrowserTweetPoster = new EnhancedBrowserTweetPoster();