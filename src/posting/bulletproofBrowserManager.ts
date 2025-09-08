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
   * Focus composer with multiple fallback strategies
   */
  async focusComposer(): Promise<FocusResult> {
    console.log('🎯 BULLETPROOF_FOCUS: Attempting to focus composer with fallbacks...');
    
    const strategies = [
      () => this.focusWithStandardClick(),
      () => this.focusWithForceClick(),
      () => this.focusWithKeyboardEntry(),
      () => this.focusWithPageReload(),
      () => this.focusWithElementEvaluation()
    ];

    for (let i = 0; i < strategies.length; i++) {
      const strategyName = [
        'standard_click',
        'force_click', 
        'keyboard_entry',
        'page_reload',
        'element_evaluation'
      ][i];

      try {
        console.log(`🔧 FOCUS_STRATEGY_${i + 1}: Trying ${strategyName}...`);
        
        const result = await strategies[i]();
        
        if (result.success) {
          console.log(`✅ FOCUS_SUCCESS: ${strategyName} worked after ${result.attempts} attempts`);
          return { ...result, method: strategyName };
        }
        
        console.log(`❌ FOCUS_FAILED: ${strategyName} failed - ${result.error}`);
        
      } catch (error) {
        console.log(`💥 FOCUS_ERROR: ${strategyName} threw error - ${error instanceof Error ? error.message : error}`);
      }
      
      // Small delay between strategies
      await this.delay(500);
    }

    await this.takeScreenshot('all_focus_strategies_failed');
    
    return {
      success: false,
      method: 'all_failed',
      error: 'All focus strategies failed',
      attempts: strategies.length
    };
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
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default BulletproofBrowserManager;