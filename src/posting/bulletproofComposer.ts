/**
 * 🛡️ BULLETPROOF COMPOSER - Railway-Ready Playwright Posting
 * 
 * Implements multi-locator strategy, overlay killing, keyboard fallbacks,
 * and content verification to ensure reliable posting on X (Twitter)
 */

import { Page, Locator } from 'playwright';

export interface ComposerStrategy {
  name: string;
  locator: (page: Page) => Locator;
  method: 'type' | 'fill' | 'keyboard';
}

export interface ComposerResult {
  success: boolean;
  strategy?: string;
  contentLength?: number;
  error?: string;
  retries?: number;
}

export class BulletproofComposer {
  private readonly MAX_RETRIES = 3;
  private readonly TYPING_DELAY = 50; // ms between keystrokes
  private readonly VERIFICATION_THRESHOLD = 0.9; // 90% content match required

  // Multi-locator strategy in priority order
  private readonly strategies: ComposerStrategy[] = [
    {
      name: 'primary_textarea',
      locator: (page) => page.locator('[data-testid="tweetTextarea_0"]'),
      method: 'type'
    },
    {
      name: 'role_textbox',
      locator: (page) => page.getByRole('textbox', { name: /post/i }),
      method: 'type'
    },
    {
      name: 'aria_label',
      locator: (page) => page.locator('[aria-label="Post text"]'),
      method: 'type'
    },
    {
      name: 'secondary_textarea',
      locator: (page) => page.locator('[data-testid="tweetTextarea_1"]'),
      method: 'type'
    },
    {
      name: 'keyboard_fallback',
      locator: (page) => page.locator('body'), // Fallback to body for keyboard method
      method: 'keyboard'
    }
  ];

  constructor(private page: Page) {}

  /**
   * 🎯 Main entry point: Post content with bulletproof reliability
   */
  async postContent(content: string): Promise<ComposerResult> {
    console.log(`🛡️ BULLETPROOF_COMPOSER: Posting ${content.length} chars`);
    
    // Step 1: Kill overlays that might block interaction
    await this.killOverlays();
    
    // Step 2: Try each strategy until one succeeds
    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      console.log(`🔄 ATTEMPT ${attempt + 1}/${this.MAX_RETRIES}`);
      
      for (const strategy of this.strategies) {
        try {
          const result = await this.tryStrategy(strategy, content);
          if (result.success) {
            console.log(`✅ SUCCESS: ${strategy.name} worked on attempt ${attempt + 1}`);
            return { ...result, strategy: strategy.name, retries: attempt };
          }
          console.log(`⚠️ ${strategy.name} failed: ${result.error}`);
        } catch (error) {
          console.log(`❌ ${strategy.name} error:`, error);
        }
      }
      
      // Between attempts, try to recover
      if (attempt < this.MAX_RETRIES - 1) {
        await this.recoverPage();
      }
    }

    return {
      success: false,
      error: `All strategies failed after ${this.MAX_RETRIES} attempts`,
      retries: this.MAX_RETRIES
    };
  }

  /**
   * 🧹 Kill overlays that might intercept clicks
   */
  private async killOverlays(): Promise<void> {
    console.log('🧹 KILLING_OVERLAYS: Removing potential blockers...');
    
    const overlaySelectors = [
      '[aria-label="Close"]',
      '[data-testid="app-bar-close"]',
      '[data-testid="confirmationSheetCancel"]',
      '.css-175oi2r[style*="pointer-events"]', // Pointer intercept layers
      '[role="dialog"] [aria-label*="close"]',
      '[class*="Modal"] [aria-label="Close"]'
    ];

    for (const selector of overlaySelectors) {
      try {
        const elements = await this.page.locator(selector).all();
        for (const element of elements) {
          if (await element.isVisible()) {
            await element.click({ timeout: 1000 });
            console.log(`🗑️ Closed overlay: ${selector}`);
            await this.page.waitForTimeout(300);
          }
        }
      } catch (error) {
        // Ignore overlay closing errors
      }
    }
  }

  /**
   * 🎯 Try a specific composer strategy
   */
  private async tryStrategy(strategy: ComposerStrategy, content: string): Promise<ComposerResult> {
    try {
      const locator = strategy.locator(this.page);
      
      if (strategy.method === 'keyboard') {
        return await this.keyboardStrategy(content);
      }
      
      // Wait for element to be available
      await locator.waitFor({ state: 'visible', timeout: 5000 });
      
      // Clear any existing content
      await locator.click();
      await this.page.keyboard.press('Control+a');
      await this.page.keyboard.press('Delete');
      await this.page.waitForTimeout(200);
      
      // Type content based on method
      if (strategy.method === 'type') {
        await locator.type(content, { delay: this.TYPING_DELAY });
      } else if (strategy.method === 'fill') {
        await locator.fill(content);
      }
      
      await this.page.waitForTimeout(500);
      
      // Verify content was typed correctly
      const verification = await this.verifyContent(locator, content);
      
      if (verification.success) {
        return { success: true, contentLength: verification.actualLength };
      } else {
        return { 
          success: false, 
          error: `Content verification failed: expected ${content.length}, got ${verification.actualLength}` 
        };
      }
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * ⌨️ Keyboard fallback strategy
   */
  private async keyboardStrategy(content: string): Promise<ComposerResult> {
    console.log('⌨️ KEYBOARD_FALLBACK: Using keyboard shortcut to open composer');
    
    try {
      // Press 'n' to open new tweet composer (Twitter keyboard shortcut)
      await this.page.keyboard.press('KeyN');
      await this.page.waitForTimeout(1000);
      
      // Try to find composer after keyboard shortcut
      const composer = this.page.locator('[data-testid="tweetTextarea_0"]').first();
      await composer.waitFor({ state: 'visible', timeout: 3000 });
      
      // Type content with keyboard
      await composer.click();
      await composer.type(content, { delay: this.TYPING_DELAY });
      await this.page.waitForTimeout(500);
      
      // Verify
      const verification = await this.verifyContent(composer, content);
      
      if (verification.success) {
        return { success: true, contentLength: verification.actualLength };
      } else {
        return { 
          success: false, 
          error: `Keyboard strategy verification failed: expected ${content.length}, got ${verification.actualLength}` 
        };
      }
      
    } catch (error) {
      return {
        success: false,
        error: `Keyboard strategy failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * ✅ Verify content was typed correctly
   */
  private async verifyContent(locator: Locator, expectedContent: string): Promise<{
    success: boolean;
    actualLength: number;
  }> {
    try {
      // Try multiple methods to read content
      let actualContent = '';
      
      // Method 1: innerText
      try {
        actualContent = await locator.innerText();
      } catch {}
      
      // Method 2: inputValue (for input elements)
      if (!actualContent) {
        try {
          actualContent = await locator.inputValue();
        } catch {}
      }
      
      // Method 3: textContent
      if (!actualContent) {
        try {
          actualContent = await locator.textContent() || '';
        } catch {}
      }
      
      const actualLength = actualContent.trim().length;
      const expectedLength = expectedContent.trim().length;
      const ratio = expectedLength > 0 ? actualLength / expectedLength : 0;
      
      console.log(`📏 VERIFICATION: Expected ${expectedLength} chars, got ${actualLength} chars (${(ratio * 100).toFixed(1)}%)`);
      
      return {
        success: ratio >= this.VERIFICATION_THRESHOLD,
        actualLength
      };
      
    } catch (error) {
      console.error('❌ VERIFICATION_ERROR:', error);
      return { success: false, actualLength: 0 };
    }
  }

  /**
   * 🔄 Recover page state between attempts
   */
  private async recoverPage(): Promise<void> {
    console.log('🔄 RECOVERING: Refreshing page state...');
    
    try {
      // Press Escape to close any modals
      await this.page.keyboard.press('Escape');
      await this.page.waitForTimeout(500);
      
      // Navigate to compose page if available
      try {
        await this.page.goto('https://x.com/compose/tweet', { 
          waitUntil: 'domcontentloaded',
          timeout: 10000 
        });
        await this.page.waitForTimeout(1000);
      } catch {
        // If compose page fails, try home page
        await this.page.goto('https://x.com/home', { 
          waitUntil: 'domcontentloaded',
          timeout: 10000 
        });
        await this.page.waitForTimeout(1000);
      }
      
      // Kill overlays again after navigation
      await this.killOverlays();
      
    } catch (error) {
      console.error('❌ RECOVERY_ERROR:', error);
    }
  }

  /**
   * 🚀 Submit the post (call after postContent succeeds)
   */
  async submitPost(): Promise<{ success: boolean; error?: string }> {
    console.log('🚀 SUBMITTING: Looking for post button...');
    
    try {
      // Multiple selectors for post button
      const postButtonSelectors = [
        '[data-testid="tweetButtonInline"]',
        '[data-testid="tweetButton"]',
        'button[type="submit"]',
        'button:has-text("Post")',
        '[aria-label*="Post"]'
      ];
      
      for (const selector of postButtonSelectors) {
        try {
          const button = this.page.locator(selector).first();
          if (await button.isVisible({ timeout: 2000 }) && await button.isEnabled()) {
            await button.click();
            console.log(`✅ SUBMIT_SUCCESS: Clicked ${selector}`);
            await this.page.waitForTimeout(2000); // Wait for post to process
            return { success: true };
          }
        } catch (error) {
          console.log(`⚠️ ${selector} not available:`, error);
        }
      }
      
      return { success: false, error: 'No clickable post button found' };
      
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown submit error' 
      };
    }
  }

  /**
   * 🎨 Configure page for headless stability (Railway optimization)
   */
  static async configureForRailway(page: Page): Promise<void> {
    console.log('🎨 RAILWAY_CONFIG: Optimizing for headless stability...');
    
    try {
      // Reduce animations and improve stability
      await page.addInitScript(() => {
        // Disable animations
        const style = document.createElement('style');
        style.innerHTML = `
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-delay: -0.01ms !important;
            transition-duration: 0.01ms !important;
            transition-delay: -0.01ms !important;
          }
        `;
        document.head.appendChild(style);
        
        // Disable smooth scrolling
        if ('scrollBehavior' in document.documentElement.style) {
          document.documentElement.style.scrollBehavior = 'auto';
        }
      });
      
      // Set reduced motion preference
      await page.emulateMedia({ reducedMotion: 'reduce' });
      
      console.log('✅ RAILWAY_CONFIG: Page optimized for headless posting');
      
    } catch (error) {
      console.error('❌ RAILWAY_CONFIG_ERROR:', error);
    }
  }
}

export default BulletproofComposer;
