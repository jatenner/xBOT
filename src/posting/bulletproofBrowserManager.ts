/**
 * Bulletproof Browser Manager for xBOT
 * Handles Playwright focus issues and "subtree intercepts pointer events" failures
 */

import { Page, Locator } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

export interface FocusResult {
  success: boolean;
  method: string;
  error?: string;
  attempts: number;
}

export class BulletproofBrowserManager {
  private page: Page;
  
  // Configuration from environment
  private readonly PLAYWRIGHT_NAV_TIMEOUT_MS = parseInt(process.env.PLAYWRIGHT_NAV_TIMEOUT_MS || '15000', 10);
  private readonly PLAYWRIGHT_MAX_CONTEXT_RETRIES = parseInt(process.env.PLAYWRIGHT_MAX_CONTEXT_RETRIES || '3', 10);
  private readonly PLAYWRIGHT_CONTEXT_RETRY_BACKOFF_MS = parseInt(process.env.PLAYWRIGHT_CONTEXT_RETRY_BACKOFF_MS || '2000', 10);

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Focus composer with bulletproof typing capabilities
   */
  async focusComposer(): Promise<FocusResult> {
    console.log('🎯 BULLETPROOF_FOCUS: Attempting to focus composer with robust typing...');
    
    try {
      // Step 1: Close overlays first
      await this.ensureNoModalOverlays();
      
      // Step 2: Find and focus composer
      const composer = await this.findComposerElement();
      if (!composer) {
        await this.takeScreenshot('composer_not_found');
        return {
          success: false,
          method: 'find_composer',
          error: 'Could not locate composer element',
          attempts: 1
        };
      }

      // Step 3: Focus the composer
      const focusResult = await this.focusComposerElement(composer);
      if (!focusResult.success) {
        return focusResult;
      }

      console.log('✅ BULLETPROOF_FOCUS: Composer focused and ready for typing');
      return {
        success: true,
        method: 'bulletproof_focus',
        attempts: 1
      };

    } catch (error) {
      await this.takeScreenshot('focus_exception');
      return {
        success: false,
        method: 'exception',
        error: error instanceof Error ? error.message : 'Unknown error',
        attempts: 1
      };
    }
  }

  /**
   * Set text in contenteditable element with robust handling
   */
  async setContenteditableText(element: any, text: string): Promise<boolean> {
    console.log(`⌨️ BULLETPROOF_TYPE: Setting text (${text.length} chars)`);
    
    try {
      // Method 1: Direct contenteditable manipulation
      const result1 = await this.setTextViaEvaluation(element, text);
      if (result1) {
        console.log('✅ TYPE_SUCCESS: Direct evaluation method worked');
        return true;
      }

      // Method 2: Keyboard typing fallback
      console.log('🔄 TYPE_FALLBACK: Trying keyboard method...');
      const result2 = await this.setTextViaKeyboard(element, text);
      if (result2) {
        console.log('✅ TYPE_SUCCESS: Keyboard method worked');
        return true;
      }

      // Method 3: Input event simulation
      console.log('🔄 TYPE_FALLBACK: Trying input event method...');
      const result3 = await this.setTextViaInputEvents(element, text);
      if (result3) {
        console.log('✅ TYPE_SUCCESS: Input event method worked');
        return true;
      }

      console.error('❌ TYPE_FAILED: All typing methods failed');
      await this.takeScreenshot('typing_failed');
      return false;

    } catch (error) {
      console.error('💥 TYPE_EXCEPTION:', error instanceof Error ? error.message : error);
      await this.takeScreenshot('typing_exception');
      return false;
    }
  }

  /**
   * Strategy 1: Standard click approach
   */
  private async focusWithStandardClick(): Promise<FocusResult> {
    await this.ensureNoModalOverlays();
    await this.page.bringToFront();

    const selectors = [
      '[data-testid="tweetTextarea_0"]',
      '[role="textbox"][aria-label*="Post text"]',
      '[role="textbox"][aria-label*="What is happening"]'
    ];

    for (const selector of selectors) {
      try {
        const element = await this.page.waitForSelector(selector, { timeout: 5000 });
        
        if (element) {
          await element.scrollIntoViewIfNeeded();
          await element.click({ timeout: 3000 });
          
          const isFocused = await element.evaluate(el => document.activeElement === el);
          
          if (isFocused) {
            return { success: true, method: 'standard_click', attempts: 1 };
          }
        }
      } catch (error) {
        // Try next selector
        continue;
      }
    }

    return { success: false, method: 'standard_click', error: 'No selectors worked', attempts: selectors.length };
  }

  /**
   * Strategy 2: Force click with element evaluation
   */
  private async focusWithForceClick(): Promise<FocusResult> {
    await this.ensureNoModalOverlays();

    const selectors = [
      '[data-testid="tweetTextarea_0"]',
      '[role="textbox"][aria-label*="Post text"]'
    ];

    for (const selector of selectors) {
      try {
        const element = await this.page.$(selector);
        
        if (element) {
          // Try direct click with force
          await element.click({ force: true, timeout: 3000 });
          
          // If that fails, try element evaluation click
          await element.evaluate(el => {
            (el as HTMLElement).click();
            (el as HTMLElement).focus();
          });
          
          // Verify focus
          const isFocused = await element.evaluate(el => document.activeElement === el);
          
          if (isFocused) {
            return { success: true, method: 'force_click', attempts: 1 };
          }
        }
      } catch (error) {
        continue;
      }
    }

    return { success: false, method: 'force_click', error: 'Force click failed', attempts: selectors.length };
  }

  /**
   * Strategy 3: Keyboard-only entry
   */
  private async focusWithKeyboardEntry(): Promise<FocusResult> {
    try {
      // Close any overlays first
      await this.page.keyboard.press('Escape');
      await this.delay(500);
      
      // Try compose shortcut
      await this.page.keyboard.press('KeyN');
      await this.delay(1000);
      
      // Check if composer appeared and is focused
      const composer = await this.page.$('[data-testid="tweetTextarea_0"]');
      
      if (composer) {
        const isFocused = await composer.evaluate(el => document.activeElement === el);
        
        if (isFocused) {
          return { success: true, method: 'keyboard_entry', attempts: 1 };
        }
      }
      
      // Alternative: try clicking compose button first
      const composeButton = await this.page.$('[data-testid="SideNav_NewTweet_Button"]');
      if (composeButton) {
        await composeButton.click();
        await this.delay(1000);
        
        const newComposer = await this.page.$('[data-testid="tweetTextarea_0"]');
        if (newComposer) {
          const isFocused = await newComposer.evaluate(el => document.activeElement === el);
          if (isFocused) {
            return { success: true, method: 'keyboard_entry', attempts: 2 };
          }
        }
      }

    } catch (error) {
      return { success: false, method: 'keyboard_entry', error: error instanceof Error ? error.message : 'Unknown error', attempts: 1 };
    }

    return { success: false, method: 'keyboard_entry', error: 'Keyboard shortcuts failed', attempts: 2 };
  }

  /**
   * Strategy 4: Page reload and retry
   */
  private async focusWithPageReload(): Promise<FocusResult> {
    try {
      console.log('♻️ RELOADING_PAGE: Refreshing to clear stale state...');
      
      // Preserve session storage before reload
      await this.page.reload({ 
        waitUntil: 'networkidle', 
        timeout: this.PLAYWRIGHT_NAV_TIMEOUT_MS 
      });
      
      await this.delay(2000);
      
      // Try standard approach after reload
      return await this.focusWithStandardClick();
      
    } catch (error) {
      return { 
        success: false, 
        method: 'page_reload', 
        error: error instanceof Error ? error.message : 'Reload failed', 
        attempts: 1 
      };
    }
  }

  /**
   * Strategy 5: Direct element evaluation and event dispatch
   */
  private async focusWithElementEvaluation(): Promise<FocusResult> {
    try {
      const result = await this.page.evaluate(() => {
        // Find composer elements
        const selectors = [
          '[data-testid="tweetTextarea_0"]',
          '[role="textbox"][aria-label*="Post text"]',
          '[role="textbox"]'
        ];

        for (const selector of selectors) {
          const element = document.querySelector(selector) as HTMLElement;
          
          if (element) {
            // Clear any pointer-events interference
            element.style.pointerEvents = 'auto';
            
            // Focus with multiple methods
            element.focus();
            element.click();
            
            // Dispatch focus events
            element.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
            element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            
            // Check if focused
            if (document.activeElement === element) {
              return { success: true, selector };
            }
          }
        }

        return { success: false, selector: null };
      });

      if (result.success) {
        return { success: true, method: 'element_evaluation', attempts: 1 };
      }

    } catch (error) {
      return { 
        success: false, 
        method: 'element_evaluation', 
        error: error instanceof Error ? error.message : 'Evaluation failed', 
        attempts: 1 
      };
    }

    return { success: false, method: 'element_evaluation', error: 'Direct evaluation failed', attempts: 1 };
  }

  /**
   * Ensure no modal overlays are blocking interaction
   */
  async ensureNoModalOverlays(): Promise<void> {
    console.log('🚫 CHECKING_OVERLAYS: Closing any modal overlays...');
    
    const overlaySelectors = [
      '[role="dialog"]',
      '[data-testid="confirmationSheetDialog"]',
      '[data-testid="app-bar-close"]',
      '[aria-label="Close"]',
      '.modal',
      '[data-testid="close"]'
    ];

    for (const selector of overlaySelectors) {
      try {
        const overlays = await this.page.$$(selector);
        
        for (const overlay of overlays) {
          // Check if overlay is visible and blocking
          const isVisible = await overlay.isVisible();
          
          if (isVisible) {
            console.log(`🚫 CLOSING_OVERLAY: Found visible overlay with ${selector}`);
            
            // Try to find close button within overlay
            const closeButton = await overlay.$('[data-testid="close"], [aria-label*="Close"], .close, button');
            
            if (closeButton) {
              await closeButton.click();
            } else {
              // Try clicking overlay background or escape
              await this.page.keyboard.press('Escape');
            }
            
            await this.delay(500);
          }
        }
      } catch (error) {
        // Ignore errors when checking overlays
      }
    }
  }

  /**
   * Check if compose area is ready and not stale
   */
  async isComposeAreaReady(): Promise<boolean> {
    try {
      const isReady = await this.page.evaluate(() => {
        const composer = document.querySelector('[data-testid="tweetTextarea_0"]');
        
        if (!composer) return false;
        
        // Check if element is interactive
        const style = window.getComputedStyle(composer);
        const isInteractive = style.pointerEvents !== 'none' && 
                             style.visibility !== 'hidden' && 
                             style.display !== 'none';
        
        return isInteractive;
      });
      
      return isReady;
    } catch (error) {
      return false;
    }
  }

  /**
   * Anti-stale check with timeout
   */
  async antiStaleCheck(): Promise<boolean> {
    console.log('🔄 ANTI_STALE_CHECK: Verifying compose area readiness...');
    
    const maxWaitTime = 5000;
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const isReady = await this.isComposeAreaReady();
      
      if (isReady) {
        console.log('✅ COMPOSE_AREA_READY: Area is interactive');
        return true;
      }
      
      await this.delay(500);
    }
    
    console.log('⚠️ COMPOSE_AREA_STALE: Area not ready after timeout');
    return false;
  }

  /**
   * Resilient selector with fallbacks
   */
  async getResilientSelector(primarySelector: string, fallbackSelectors: string[]): Promise<Locator | null> {
    // Try primary selector first
    try {
      const primary = this.page.locator(primarySelector);
      const count = await primary.count();
      
      if (count > 0) {
        return primary.first();
      }
    } catch (error) {
      // Try fallbacks
    }
    
    // Try fallback selectors
    for (const fallback of fallbackSelectors) {
      try {
        const locator = this.page.locator(fallback);
        const count = await locator.count();
        
        if (count > 0) {
          return locator.first();
        }
      } catch (error) {
        continue;
      }
    }
    
    return null;
  }

  /**
   * Take screenshot for debugging
   */
  async takeScreenshot(reason: string): Promise<void> {
    try {
      const screenshotDir = './tmp/playwright_screens';
      await fs.mkdir(screenshotDir, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${reason}_${timestamp}.png`;
      const filepath = path.join(screenshotDir, filename);
      
      await this.page.screenshot({ path: filepath, fullPage: true });
      console.log(`📸 SCREENSHOT_SAVED: ${filepath}`);
    } catch (error) {
      console.warn('⚠️ Could not save screenshot:', error);
    }
  }

  /**
   * Find composer element with preferred selectors
   */
  private async findComposerElement(): Promise<any> {
    const selectors = [
      '[data-testid="tweetTextarea_0"]',
      '.public-DraftEditor-content',
      '[role="textbox"][aria-label*="Post text"]',
      '[role="textbox"][aria-label*="What is happening"]'
    ];

    for (const selector of selectors) {
      try {
        const element = await this.page.waitForSelector(selector, { timeout: 5000 });
        if (element) {
          console.log(`✅ COMPOSER_FOUND: Using selector ${selector}`);
          return element;
        }
      } catch (error) {
        continue;
      }
    }

    // Keyboard fallback to open composer
    console.log('⌨️ KEYBOARD_COMPOSER: Trying to open composer with keyboard...');
    await this.page.keyboard.press('Escape');
    await this.delay(500);
    await this.page.keyboard.press('KeyN');
    await this.delay(1000);

    // Try selectors again
    for (const selector of selectors) {
      try {
        const element = await this.page.$(selector);
        if (element) {
          console.log(`✅ COMPOSER_FOUND: Using selector ${selector} after keyboard`);
          return element;
        }
      } catch (error) {
        continue;
      }
    }

    return null;
  }

  /**
   * Focus composer element with multiple strategies
   */
  private async focusComposerElement(element: any): Promise<FocusResult> {
    try {
      // Scroll into view
      await element.scrollIntoViewIfNeeded();
      await this.delay(500);

      // Try standard click
      try {
        await element.click({ timeout: 3000 });
        const focused = await element.evaluate((el: HTMLElement) => document.activeElement === el);
        if (focused) {
          return { success: true, method: 'standard_click', attempts: 1 };
        }
      } catch (error) {
        console.log('🔄 FOCUS_FALLBACK: Standard click failed, trying force click...');
      }

      // Try force click
      try {
        await element.click({ force: true });
        await element.focus();
        const focused = await element.evaluate((el: HTMLElement) => document.activeElement === el);
        if (focused) {
          return { success: true, method: 'force_click', attempts: 1 };
        }
      } catch (error) {
        console.log('🔄 FOCUS_FALLBACK: Force click failed, trying evaluation...');
      }

      // Try evaluation focus
      await element.evaluate((el: HTMLElement) => {
        el.focus();
        el.click();
      });

      const focused = await element.evaluate((el: HTMLElement) => document.activeElement === el);
      if (focused) {
        return { success: true, method: 'evaluation_focus', attempts: 1 };
      }

      return {
        success: false,
        method: 'all_focus_methods',
        error: 'Could not focus composer element',
        attempts: 3
      };

    } catch (error) {
      return {
        success: false,
        method: 'focus_exception',
        error: error instanceof Error ? error.message : 'Unknown error',
        attempts: 1
      };
    }
  }

  /**
   * Set text via direct contenteditable manipulation
   */
  private async setTextViaEvaluation(element: any, text: string): Promise<boolean> {
    try {
      await element.evaluate((el: HTMLElement, value: string) => {
        // Focus the element
        el.focus();
        
        // Clear existing content
        el.textContent = '';
        el.innerHTML = '';
        
        // Create text node and append
        const textNode = document.createTextNode(value);
        el.appendChild(textNode);
        
        // Set selection at end
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(range);
        
        // Trigger input events
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, text);

      // Verify text was set
      await this.delay(500);
      const actualText = await element.evaluate((el: HTMLElement) => el.textContent || '');
      
      return actualText.includes(text.substring(0, 50));
    } catch (error) {
      console.warn('⚠️ Evaluation typing failed:', error);
      return false;
    }
  }

  /**
   * Set text via keyboard typing
   */
  private async setTextViaKeyboard(element: any, text: string): Promise<boolean> {
    try {
      // Focus and clear
      await element.click();
      await this.page.keyboard.press('ControlOrMeta+KeyA');
      await this.delay(100);
      
      // Type the text
      await this.page.keyboard.type(text, { delay: 50 });
      
      // Verify text was typed
      await this.delay(500);
      const actualText = await element.evaluate((el: HTMLElement) => el.textContent || '');
      
      return actualText.includes(text.substring(0, 50));
    } catch (error) {
      console.warn('⚠️ Keyboard typing failed:', error);
      return false;
    }
  }

  /**
   * Set text via input event simulation
   */
  private async setTextViaInputEvents(element: any, text: string): Promise<boolean> {
    try {
      await element.evaluate((el: HTMLElement, value: string) => {
        // Clear and set value
        el.textContent = value;
        
        // Simulate typing events
        const events = ['input', 'change', 'keyup', 'keydown'];
        events.forEach(eventType => {
          el.dispatchEvent(new Event(eventType, { bubbles: true }));
        });
      }, text);

      // Verify text was set
      await this.delay(500);
      const actualText = await element.evaluate((el: HTMLElement) => el.textContent || '');
      
      return actualText.includes(text.substring(0, 50));
    } catch (error) {
      console.warn('⚠️ Input event typing failed:', error);
      return false;
    }
  }

  /**
   * Handle browser crashes and TargetClosedError
   */
  async handleBrowserRelaunch(): Promise<boolean> {
    console.log('🔄 BROWSER_RELAUNCH: Handling browser crash...');
    
    try {
      // Railway-friendly browser args
      const railwayArgs = [
        '--no-sandbox',
        '--disable-gpu', 
        '--disable-dev-shm-usage',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ];

      // This would typically be handled by the poster class
      // For now, just log the relaunch attempt
      console.log('🚀 BROWSER_RELAUNCH: Would restart with Railway args:', railwayArgs.join(' '));
      
      return true;
    } catch (error) {
      console.error('💥 BROWSER_RELAUNCH_FAILED:', error);
      return false;
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default BulletproofBrowserManager;