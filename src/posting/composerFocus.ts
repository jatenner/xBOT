/**
 * 🎯 RESILIENT COMPOSER FOCUS HELPER
 * Handles X.com composer focus with multiple fallback strategies
 */

import { Page } from 'playwright';

// Environment configuration
const PLAYWRIGHT_NAV_TIMEOUT_MS = parseInt(process.env.PLAYWRIGHT_NAV_TIMEOUT_MS || '45000', 10);
const PLAYWRIGHT_REPLY_TIMEOUT_MS = parseInt(process.env.PLAYWRIGHT_REPLY_TIMEOUT_MS || '20000', 10);
const PLAYWRIGHT_CONTEXT_RETRY_BACKOFF_MS = parseInt(process.env.PLAYWRIGHT_CONTEXT_RETRY_BACKOFF_MS || '1200', 10);
const PLAYWRIGHT_MAX_CONTEXT_RETRIES = parseInt(process.env.PLAYWRIGHT_MAX_CONTEXT_RETRIES || '5', 10);

// Selector strategies for different composer states
const COMPOSER_SELECTORS = [
  'div[role="textbox"][data-testid="tweetTextarea_0"]',
  'div[role="textbox"][contenteditable="true"]',
  'textarea[aria-label*="Post"]',
  'div[aria-label="Post text"]',
  '[data-testid="tweetTextarea_0"]'
];

const REPLY_SELECTORS = [
  '[data-testid="reply"]',
  'div[role="button"][data-testid="reply"]',
  'button[aria-label^="Reply"]',
  'div[role="button"][aria-label^="Reply"]'
];

export interface ComposerFocusResult {
  success: boolean;
  element?: any;
  strategy?: 'direct' | 'reply_chain' | 'fallback';
  error?: string;
  retryCount?: number;
}

/**
 * 🎯 RESILIENT COMPOSER FOCUS
 * Tries multiple strategies with retries and backoff
 */
export async function focusComposer(page: Page, mode: 'direct' | 'reply' = 'direct'): Promise<ComposerFocusResult> {
  let retryCount = 0;
  
  while (retryCount < PLAYWRIGHT_MAX_CONTEXT_RETRIES) {
    try {
      // Ensure page is ready
      await page.bringToFront();
      await page.waitForLoadState('domcontentloaded', { timeout: PLAYWRIGHT_NAV_TIMEOUT_MS });
      
      if (mode === 'direct') {
        const result = await tryDirectComposer(page);
        if (result.success) return { ...result, retryCount };
      } else {
        const result = await tryReplyComposer(page);
        if (result.success) return { ...result, retryCount };
      }
      
      // Fallback strategy
      const fallbackResult = await tryFallbackComposer(page);
      if (fallbackResult.success) return { ...fallbackResult, retryCount };
      
    } catch (error: any) {
      console.log(`🔄 COMPOSER_FOCUS_RETRY ${retryCount + 1}/${PLAYWRIGHT_MAX_CONTEXT_RETRIES}:`, error.message);
    }
    
    retryCount++;
    if (retryCount < PLAYWRIGHT_MAX_CONTEXT_RETRIES) {
      await page.waitForTimeout(PLAYWRIGHT_CONTEXT_RETRY_BACKOFF_MS * retryCount);
    }
  }
  
  return {
    success: false,
    error: `COMPOSER_NOT_FOCUSED after ${PLAYWRIGHT_MAX_CONTEXT_RETRIES} attempts`,
    retryCount
  };
}

async function tryDirectComposer(page: Page): Promise<ComposerFocusResult> {
  for (const selector of COMPOSER_SELECTORS) {
    try {
      const element = await page.locator(selector).first();
      await element.waitFor({ state: 'visible', timeout: 5000 });
      
      // Scroll into view and focus
      await element.scrollIntoViewIfNeeded();
      await element.click({ delay: 50 });
      
      // Verify it's actually editable
      const isEditable = await element.evaluate((el: any) => 
        el.contentEditable === 'true' || el.tagName === 'TEXTAREA'
      );
      
      if (isEditable) {
        console.log('✅ COMPOSER_FOCUS: Direct composer ready');
        return { success: true, element, strategy: 'direct' };
      }
    } catch {
      continue;
    }
  }
  return { success: false, error: 'No direct composer found' };
}

async function tryReplyComposer(page: Page): Promise<ComposerFocusResult> {
  // First try to click reply button
  for (const selector of REPLY_SELECTORS) {
    try {
      const replyBtn = await page.locator(selector).first();
      await replyBtn.waitFor({ state: 'visible', timeout: PLAYWRIGHT_REPLY_TIMEOUT_MS });
      await replyBtn.click({ delay: 50 });
      await page.waitForTimeout(500);
      
      // Now try to find the composer
      const composerResult = await tryDirectComposer(page);
      if (composerResult.success) {
        return { ...composerResult, strategy: 'reply_chain' };
      }
    } catch {
      continue;
    }
  }
  return { success: false, error: 'Reply composer strategy failed' };
}

async function tryFallbackComposer(page: Page): Promise<ComposerFocusResult> {
  // Keyboard shortcut fallback
  try {
    await page.keyboard.press('n'); // Twitter shortcut for new tweet
    await page.waitForTimeout(800);
    
    const composerResult = await tryDirectComposer(page);
    if (composerResult.success) {
      return { ...composerResult, strategy: 'fallback' };
    }
  } catch {
    // Silent fallback failure
  }
  
  return { success: false, error: 'All composer strategies failed' };
}
