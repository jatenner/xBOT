/**
 * 🎯 HARDENED PLAYWRIGHT COMPOSER FOCUS
 * Multiple strategies with retries to eliminate COMPOSER_NOT_FOCUSED errors
 */

import { Page } from 'playwright';

// Environment configuration with defaults
const PLAYWRIGHT_FOCUS_RETRIES = parseInt(process.env.PLAYWRIGHT_FOCUS_RETRIES || '4', 10);
const PLAYWRIGHT_FOCUS_TIMEOUT_MS = parseInt(process.env.PLAYWRIGHT_FOCUS_TIMEOUT_MS || '12000', 10);
const PLAYWRIGHT_REPLY_TIMEOUT_MS = parseInt(process.env.PLAYWRIGHT_REPLY_TIMEOUT_MS || '12000', 10);
const PLAYWRIGHT_COMPOSER_STRICT = (process.env.PLAYWRIGHT_COMPOSER_STRICT ?? 'true') === 'true';

// Comprehensive selector sets
const COMPOSER_SELECTORS = [
  '[data-testid="tweetTextarea_0"]',
  '[data-testid="tweetTextarea_1"]', 
  '[aria-label="Post text"]',
  'div[role="textbox"][contenteditable="true"]',
  '[data-testid="tweetTextEditor"]'
];

const REPLY_SELECTORS = [
  '[data-testid="reply"]',
  '[data-testid="tweetButtonInline"]', 
  '[role="button"][data-testid*="reply"]'
];

export interface ComposerFocusOptions {
  timeoutMs?: number;
  retries?: number;
  mode?: 'compose' | 'reply';
}

export interface ComposerFocusResult {
  success: boolean;
  element?: any;
  selectorUsed?: string;
  error?: string;
  retryCount?: number;
}

/**
 * 🎯 ENSURE COMPOSER FOCUSED - Main entry point
 */
export async function ensureComposerFocused(
  page: Page, 
  options: ComposerFocusOptions = {}
): Promise<ComposerFocusResult> {
  const { 
    timeoutMs = PLAYWRIGHT_FOCUS_TIMEOUT_MS, 
    retries = PLAYWRIGHT_FOCUS_RETRIES,
    mode = 'compose'
  } = options;

  let lastError = '';
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      console.log(`🎯 COMPOSER_FOCUS: Attempt ${attempt + 1}/${retries} (${mode} mode)`);
      
      // Try primary strategy based on mode
      if (mode === 'reply') {
        const replyResult = await tryReplyFlow(page, timeoutMs);
        if (replyResult.success) return { ...replyResult, retryCount: attempt };
      }
      
      const focusResult = await tryComposerSelectors(page, timeoutMs);
      if (focusResult.success) return { ...focusResult, retryCount: attempt };
      
      // Fallback strategies
      const keyboardResult = await tryKeyboardShortcut(page, timeoutMs);
      if (keyboardResult.success) return { ...keyboardResult, retryCount: attempt };
      
      const resetResult = await tryPageReset(page, timeoutMs);
      if (resetResult.success) return { ...resetResult, retryCount: attempt };
      
      lastError = focusResult.error || 'Unknown focus error';
      
    } catch (error: any) {
      lastError = error.message;
      console.log(`🔄 COMPOSER_FOCUS: Attempt ${attempt + 1} failed:`, error.message);
    }
    
    // Wait between retries
    if (attempt < retries - 1) {
      await page.waitForTimeout(1000 * (attempt + 1));
    }
  }
  
  const finalError = `COMPOSER_NOT_FOCUSED after ${retries} attempts: ${lastError}`;
  
  if (PLAYWRIGHT_COMPOSER_STRICT) {
    throw new Error(finalError);
  }
  
  return { success: false, error: finalError, retryCount: retries };
}

async function tryComposerSelectors(page: Page, timeoutMs: number): Promise<ComposerFocusResult> {
  for (const selector of COMPOSER_SELECTORS) {
    try {
      const element = await page.locator(selector).first();
      await element.waitFor({ state: 'visible', timeout: timeoutMs / COMPOSER_SELECTORS.length });
      
      // Verify it's actually editable
      const isEditable = await element.evaluate((el: any) => 
        el.contentEditable === 'true' || el.tagName === 'TEXTAREA'
      );
      
      if (isEditable) {
        await element.click({ delay: 50 });
        console.log(`✅ COMPOSER_FOCUS: Success with selector: ${selector}`);
        return { success: true, element, selectorUsed: selector };
      }
    } catch {
      continue;
    }
  }
  return { success: false, error: 'No composer selectors matched' };
}

async function tryReplyFlow(page: Page, timeoutMs: number): Promise<ComposerFocusResult> {
  for (const selector of REPLY_SELECTORS) {
    try {
      const replyBtn = await page.locator(selector).first();
      await replyBtn.waitFor({ state: 'visible', timeout: PLAYWRIGHT_REPLY_TIMEOUT_MS });
      await replyBtn.click({ delay: 50 });
      await page.waitForTimeout(500);
      
      // Now try to find the composer that opened
      const composerResult = await tryComposerSelectors(page, timeoutMs);
      if (composerResult.success) {
        return { ...composerResult, selectorUsed: `reply->${composerResult.selectorUsed}` };
      }
    } catch {
      continue;
    }
  }
  return { success: false, error: 'Reply flow failed' };
}

async function tryKeyboardShortcut(page: Page, timeoutMs: number): Promise<ComposerFocusResult> {
  try {
    await page.keyboard.press('n'); // Twitter shortcut for new tweet
    await page.waitForTimeout(800);
    
    const result = await tryComposerSelectors(page, timeoutMs);
    if (result.success) {
      return { ...result, selectorUsed: `keyboard->${result.selectorUsed}` };
    }
  } catch {
    // Silent failure
  }
  return { success: false, error: 'Keyboard shortcut failed' };
}

async function tryPageReset(page: Page, timeoutMs: number): Promise<ComposerFocusResult> {
  try {
    await page.evaluate(() => document.body.click());
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForLoadState('networkidle', { timeout: 5000 });
    await page.waitForTimeout(500);
    
    const result = await tryComposerSelectors(page, timeoutMs);
    if (result.success) {
      return { ...result, selectorUsed: `reset->${result.selectorUsed}` };
    }
  } catch {
    // Silent failure
  }
  return { success: false, error: 'Page reset failed' };
}