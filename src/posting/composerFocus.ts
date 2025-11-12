/**
 * 🎯 HARDENED PLAYWRIGHT COMPOSER FOCUS
 * Multiple strategies with retries to eliminate COMPOSER_NOT_FOCUSED errors
 */

import { log } from '../lib/logger';
import { Page } from 'playwright';

// Configuration with defaults
const PLAYWRIGHT_FOCUS_RETRIES = 4;
const PLAYWRIGHT_FOCUS_TIMEOUT_MS = 12000;
const PLAYWRIGHT_REPLY_TIMEOUT_MS = 12000;
const PLAYWRIGHT_COMPOSER_STRICT = true;

// Comprehensive selector sets - UPDATED FOR CURRENT X INTERFACE
const COMPOSER_SELECTORS = [
  // Primary X/Twitter selectors (November 2025 refresh)
  '[data-testid="tweetTextarea_0"]',
  '[data-testid="tweetTextarea_1"]',
  '[data-testid^="tweetTextarea_"][data-testid$="RichTextEditor"]',
  '[data-testid^="tweetTextarea_"][data-testid$="RichTextInputContainer"] div[contenteditable="true"]',
  'div[data-testid^="tweetTextarea_"] div[contenteditable="true"]',
  'div[role="textbox"][data-testid^="tweetTextarea_"]',
  'div[aria-label*="Post text"]',
  'div[aria-label*="What is happening"]',
  'div[aria-label*="What\'s happening"]',
  'div[role="textbox"][contenteditable="true"]',
  'div[contenteditable="true"][role="textbox"]',

  // Generic fallbacks
  '[data-testid="tweetTextEditor"]',
  '.public-DraftEditor-content[contenteditable="true"]',
  '[placeholder*="What\'s happening"]',
  'div[contenteditable="true"]'
];

const REPLY_SELECTORS = [
  '[data-testid="reply"]',
  '[data-testid="tweetButtonInline"]',
  '[role="button"][data-testid*="reply"]',
  'button[aria-label*="Reply"]',
  'div[role="button"][aria-label*="Reply"]',
  'button:has-text("Reply")'
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

      const isEditable = await element.evaluate((el: any) => {
        const doc = el?.ownerDocument || document;
        const computedRole = (el.getAttribute('role') || '').toLowerCase();
        const tag = (el.tagName || '').toLowerCase();
        const contentEditable = el.contentEditable === 'true';

        if (contentEditable) return true;
        if (tag === 'textarea') return true;
        if (computedRole === 'textbox' && typeof (el as any).focus === 'function') return true;

        // Some of the new React rich text editors wrap the editable region in a descendant div
        const descendant = el.querySelector('[contenteditable="true"]');
        if (descendant) return true;

        // Look for aria-multiline textbox with descendant span
        return Boolean(
          el.querySelector('div[role="textbox"][contenteditable="true"]') ||
          el.querySelector('div[data-contents="true"][contenteditable="true"]')
        );
      });

      if (isEditable) {
        const elementHandle = await element.elementHandle();
        if (!elementHandle) {
          continue;
        }

        const editableHandle = await elementHandle.evaluateHandle((el: any) => {
          if (el.contentEditable === 'true' || el.tagName === 'TEXTAREA') return el;
          return (
            el.querySelector('[contenteditable="true"]') ||
            el.querySelector('textarea') ||
            el.querySelector('div[role="textbox"][contenteditable="true"]') ||
            el.querySelector('div[data-contents="true"][contenteditable="true"]') ||
            el
          );
        });

        const target = editableHandle.asElement() || elementHandle;

        await target.waitForElementState('stable').catch(() => undefined);
        await target.focus().catch(() => undefined);
        await target.click({ delay: 30 }).catch(() => undefined);
        await editableHandle.dispose();

        const locator = page.locator(selector).first();
        console.log(`✅ COMPOSER_FOCUS: Success with selector: ${selector}`);
        return { success: true, element: locator, selectorUsed: selector };
      }
    } catch (error: any) {
      continue;
    }
  }

  try {
    const roleTextbox = page.getByRole('textbox').first();
    await roleTextbox.waitFor({ state: 'visible', timeout: timeoutMs / 2 });
    await roleTextbox.click({ delay: 30 });
    console.log('✅ COMPOSER_FOCUS: Fallback via getByRole("textbox")');
    return { success: true, element: roleTextbox, selectorUsed: 'role=textbox' };
  } catch {
    // Ignore
  }

  const richTextFallback = page.locator('[contenteditable="true"]').first();
  try {
    await richTextFallback.waitFor({ state: 'visible', timeout: timeoutMs / 2 });
    await richTextFallback.click({ delay: 30 });
    console.log('✅ COMPOSER_FOCUS: Fallback via [contenteditable="true"]');
    return { success: true, element: richTextFallback, selectorUsed: '[contenteditable="true"] (fallback)' };
  } catch {
    // ignore
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