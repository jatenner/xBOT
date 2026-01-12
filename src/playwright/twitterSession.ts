/**
 * 🎯 CENTRALIZED TWITTER SESSION MANAGER
 * 
 * Single source of truth for Playwright Twitter session state:
 * - Consistent path across all contexts
 * - Loads storageState for every context
 * - Saves after consent acceptance and login
 * - Handles container restarts gracefully
 */

import { BrowserContext, Page } from 'playwright';
import { join } from 'path';
import fs from 'fs';
import { loadTwitterStorageState, saveStorageState, cloneStorageState, type TwitterStorageState } from '../utils/twitterSessionState';
import { SessionLoader } from '../utils/sessionLoader';

const CANONICAL_PATH = process.env.SESSION_CANONICAL_PATH || '/app/data/twitter_session.json';

export interface ConsentWallResult {
  detected: boolean;
  cleared: boolean;
  attempts: number;
  matchedSelector?: string;
  wallType?: 'consent' | 'login' | 'error' | 'rate_limit' | 'none';
  detail?: string;
}

/**
 * Get the canonical session file path (consistent across all contexts)
 */
export function getSessionPath(): string {
  return CANONICAL_PATH;
}

/**
 * Check if session file exists
 */
export function sessionFileExists(): boolean {
  try {
    return fs.existsSync(CANONICAL_PATH);
  } catch {
    return false;
  }
}

/**
 * Load storageState for a new context
 * Returns undefined if no state available (will log warning)
 */
export async function loadTwitterState(): Promise<TwitterStorageState | undefined> {
  const exists = sessionFileExists();
  if (!exists) {
    console.log(`[TWITTER_SESSION] ⚠️ Session file not found at ${CANONICAL_PATH} - will re-acquire state`);
  }
  
  const result = await loadTwitterStorageState();
  
  if (result.storageState && result.cookieCount > 0) {
    console.log(`[TWITTER_SESSION] ✅ Loaded storageState from ${result.source} (${result.cookieCount} cookies, path=${CANONICAL_PATH})`);
    return cloneStorageState(result.storageState);
  }
  
  console.warn(`[TWITTER_SESSION] ⚠️ No storageState available (source=${result.source})`);
  return undefined;
}

/**
 * Save storageState after consent acceptance or login
 * Uses canonical path for consistency
 */
export async function saveTwitterState(context: BrowserContext): Promise<boolean> {
  try {
    const savedPath = await saveStorageState(context, CANONICAL_PATH);
    if (savedPath) {
      console.log(`[TWITTER_SESSION] ✅ Persisted storageState to ${savedPath}`);
      return true;
    }
    return false;
  } catch (error: any) {
    console.error(`[TWITTER_SESSION] ❌ Failed to save storageState: ${error.message}`);
    return false;
  }
}

/**
 * Detect consent wall with multiple patterns
 */
export async function detectConsentWall(page: Page): Promise<ConsentWallResult> {
  const diagnostics = await page.evaluate(() => {
    const hasComposeBox = !!document.querySelector('[data-testid="tweetTextarea_0"]');
    const hasAccountMenu = !!document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
    const bodyText = document.body.textContent || '';
    
    // Multiple consent wall patterns
    const hasConsentWall = 
      bodyText.includes('Accept all cookies') ||
      bodyText.includes('Accept cookies') ||
      bodyText.includes('Cookie') ||
      bodyText.includes('cookie preferences') ||
      bodyText.includes('cookie settings') ||
      !!document.querySelector('[role="dialog"][aria-label*="cookie" i]') ||
      !!document.querySelector('[data-testid*="cookie" i]') ||
      !!document.querySelector('button:has-text("Accept")') ||
      !!document.querySelector('button:has-text("Accept all")');
    
    const hasLoginWall = 
      bodyText.includes('Sign in') ||
      bodyText.includes('Log in') ||
      !!document.querySelector('a[href*="/i/flow/login"]');
    
    const hasErrorWall = 
      bodyText.includes('Something went wrong') ||
      bodyText.includes('Try again');
    
    const hasRateLimit = 
      bodyText.includes('rate limit') ||
      bodyText.includes('Too many requests');
    
    const tweetContainers = document.querySelectorAll('article[data-testid="tweet"]');
    
    return {
      logged_in: hasComposeBox || hasAccountMenu,
      wall_detected: hasLoginWall || hasConsentWall || hasErrorWall || hasRateLimit,
      wall_type: hasLoginWall ? 'login' : hasConsentWall ? 'consent' : hasErrorWall ? 'error' : hasRateLimit ? 'rate_limit' : 'none',
      tweet_containers_found: tweetContainers.length,
    };
  });
  
  return {
    detected: diagnostics.wall_detected && diagnostics.wall_type === 'consent',
    cleared: false,
    attempts: 0,
    wallType: diagnostics.wall_type as any,
  };
}

/**
 * Accept consent wall with multiple strategies
 * Returns true if consent was accepted and containers increased
 */
export async function acceptConsentWall(page: Page, maxAttempts: number = 3): Promise<ConsentWallResult> {
  const containersBefore = await page.evaluate(() => {
    return document.querySelectorAll('article[data-testid="tweet"]').length;
  });
  
  const strategies = [
    { name: 'getByText Accept all cookies', fn: async () => {
      const button = page.getByText('Accept all cookies', { exact: false }).first();
      if (await button.isVisible({ timeout: 2000 })) {
        await button.click();
        return true;
      }
    }},
    { name: 'getByText Accept cookies', fn: async () => {
      const button = page.getByText('Accept cookies', { exact: false }).first();
      if (await button.isVisible({ timeout: 2000 })) {
        await button.click();
        return true;
      }
    }},
    { name: 'getByText Accept', fn: async () => {
      const button = page.getByText('Accept', { exact: false }).first();
      if (await button.isVisible({ timeout: 2000 })) {
        await button.click();
        return true;
      }
    }},
    { name: 'getByRole button accept', fn: async () => {
      const button = page.getByRole('button', { name: /accept/i }).first();
      if (await button.isVisible({ timeout: 2000 })) {
        await button.click();
        return true;
      }
    }},
    { name: 'locator button filter accept', fn: async () => {
      const button = page.locator('button').filter({ hasText: /accept/i }).first();
      if (await button.isVisible({ timeout: 2000 })) {
        await button.click();
        return true;
      }
    }},
    { name: 'iframe accept button', fn: async () => {
      const iframes = await page.locator('iframe').all();
      for (const iframe of iframes) {
        try {
          const frame = await iframe.contentFrame();
          if (frame) {
            const button = frame.getByText(/accept/i).first();
            if (await button.isVisible({ timeout: 1000 })) {
              await button.click();
              return true;
            }
          }
        } catch (e) {
          // Try next iframe
        }
      }
    }},
    { name: 'keyboard TAB+ENTER', fn: async () => {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(500);
      await page.keyboard.press('Tab');
      await page.waitForTimeout(500);
      const focused = await page.evaluate(() => {
        const active = document.activeElement;
        return active?.textContent?.toLowerCase().includes('accept') || false;
      });
      if (focused) {
        await page.keyboard.press('Enter');
        return true;
      }
    }},
    { name: 'escape key', fn: async () => {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
      return true;
    }},
  ];
  
  let attempts = 0;
  let matchedSelector: string | null = null;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    attempts++;
    
    for (const strategy of strategies) {
      try {
        const clicked = await strategy.fn();
        if (clicked) {
          matchedSelector = strategy.name;
          console.log(`[CONSENT_WALL] 🍪 Clicked consent button via: ${strategy.name} (attempt ${attempts})`);
          
          // Wait for overlay to be detached
          await page.waitForFunction(
            () => {
              const overlays = document.querySelectorAll('[role="dialog"], [data-testid*="cookie"], [aria-label*="cookie"]');
              return overlays.length === 0;
            },
            { timeout: 5000 }
          ).catch(() => {
            // Overlay might not have role attributes, continue anyway
          });
          
          await page.waitForTimeout(2000); // Additional wait
          
          // Verify containers increased
          const containersAfter = await page.evaluate(() => {
            return document.querySelectorAll('article[data-testid="tweet"]').length;
          });
          
          if (containersAfter > containersBefore) {
            console.log(`[CONSENT_WALL] ✅ Consent cleared: ${containersBefore} -> ${containersAfter} containers`);
            return {
              detected: true,
              cleared: true,
              attempts,
              matchedSelector,
              wallType: 'consent',
            };
          }
        }
      } catch (e) {
        // Try next strategy
      }
    }
  }
  
  // Check final state
  const containersAfter = await page.evaluate(() => {
    return document.querySelectorAll('article[data-testid="tweet"]').length;
  });
  
  return {
    detected: true,
    cleared: containersAfter > containersBefore,
    attempts,
    matchedSelector: matchedSelector || undefined,
    wallType: 'consent',
    detail: containersAfter === 0 ? 'No containers found after attempts' : `Containers: ${containersBefore} -> ${containersAfter}`,
  };
}

/**
 * Ensure consent is accepted for a page
 * Detects, accepts, saves state, and retries original action if needed
 */
export async function ensureConsentAccepted(
  page: Page,
  retryAction?: () => Promise<void>
): Promise<ConsentWallResult> {
  // Detect consent wall
  const detection = await detectConsentWall(page);
  
  if (!detection.detected) {
    return { detected: false, cleared: false, attempts: 0 };
  }
  
  console.log(`[CONSENT_WALL] 🚧 Consent wall detected, attempting to clear...`);
  
  // Accept consent wall
  const result = await acceptConsentWall(page, 3);
  
  if (result.cleared) {
    // Save state after successful acceptance
    const context = page.context();
    await saveTwitterState(context);
    
    // Retry original action if provided
    if (retryAction) {
      console.log(`[CONSENT_WALL] 🔄 Retrying original action after consent acceptance...`);
      await retryAction();
    }
  } else {
    console.warn(`[CONSENT_WALL] ⚠️ Consent wall not cleared after ${result.attempts} attempts`);
  }
  
  return result;
}
