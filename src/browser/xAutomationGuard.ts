/**
 * 🛡️ X AUTOMATION GUARD
 * 
 * Wraps Playwright operations with X/Cloudflare block detection and cooldown logic.
 * Prevents thrashing when X blocks automation.
 */

import { Page } from 'playwright';
import { 
  XHumanVerificationRequiredError, 
  detectXHumanChallenge, 
  xAutomationState 
} from './xBlockDetection';

/**
 * Check if X automation is currently blocked (in cooldown)
 * @returns true if automation can proceed, false if in cooldown
 */
export function canProceedWithXAutomation(): boolean {
  if (!xAutomationState.blocked) {
    return true;
  }
  
  // Check if cooldown has expired
  if (xAutomationState.canRetry()) {
    return true;
  }
  
  const minutesRemaining = xAutomationState.cooldownUntil 
    ? Math.ceil((xAutomationState.cooldownUntil.getTime() - Date.now()) / 60000)
    : 0;
    
  console.log(
    `[X_AUTOMATION_GUARD] ⏸️ X automation paused (cooldown: ${minutesRemaining}min remaining)`
  );
  
  return false;
}

/**
 * Wrap a Playwright operation with X block detection
 * 
 * @param operation - Async function that performs Playwright operations
 * @param operationName - Human-readable name for logging
 * @returns Result of the operation
 * @throws XHumanVerificationRequiredError if block detected
 */
export async function guardedXOperation<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  // Check cooldown before attempting
  if (!canProceedWithXAutomation()) {
    throw new XHumanVerificationRequiredError(
      `X automation blocked - operation "${operationName}" skipped during cooldown`,
      'cooldown',
      'cooldown_active'
    );
  }
  
  try {
    const result = await operation();
    
    // Operation succeeded - reset failure count if any
    if (xAutomationState.blocked) {
      console.log(`[X_AUTOMATION_GUARD] ✅ Operation "${operationName}" succeeded after block - resetting state`);
      xAutomationState.reset();
    }
    
    return result;
  } catch (error: any) {
    // Check if this is an X block error
    if (error instanceof XHumanVerificationRequiredError) {
      console.error(`[X_AUTOMATION_GUARD] 🚫 X block detected during "${operationName}"`);
      xAutomationState.markBlocked(error.message);
      
      // Sync to global boot state
      try {
        const { syncXAutomationState } = await import('../railwayEntrypoint');
        syncXAutomationState(xAutomationState.getStatus());
      } catch (syncError) {
        // Entrypoint might not be loaded yet (e.g., in tests)
        console.warn('[X_AUTOMATION_GUARD] Could not sync to boot state:', syncError);
      }
      
      throw error;
    }
    
    // Not an X block error - rethrow
    throw error;
  }
}

/**
 * Check a Playwright page for X/Cloudflare blocks after navigation
 * 
 * @param page - Playwright page
 * @param url - Expected URL (for logging)
 * @throws XHumanVerificationRequiredError if block detected
 */
export async function assertPageNotBlocked(page: Page, url: string): Promise<void> {
  try {
    const html = await page.content();
    const actualUrl = page.url();
    
    if (detectXHumanChallenge(html, actualUrl)) {
      throw new XHumanVerificationRequiredError(
        `X/Cloudflare block detected at ${actualUrl}`,
        actualUrl,
        'human_verification_required'
      );
    }
  } catch (error: any) {
    if (error instanceof XHumanVerificationRequiredError) {
      throw error;
    }
    // Page might be closed or other error - log but don't block
    console.warn(`[X_AUTOMATION_GUARD] Could not check page for blocks: ${error.message}`);
  }
}

/**
 * Safe wrapper for posting operations
 * Checks cooldown, executes operation, handles X blocks
 */
export async function safePost<T>(
  postFn: () => Promise<T>,
  postType: 'single' | 'thread' | 'reply'
): Promise<T> {
  return guardedXOperation(postFn, `post_${postType}`);
}

/**
 * Safe wrapper for scraping operations
 * Checks cooldown, executes operation, handles X blocks
 */
export async function safeScrape<T>(
  scrapeFn: () => Promise<T>,
  scrapeType: string
): Promise<T> {
  return guardedXOperation(scrapeFn, `scrape_${scrapeType}`);
}

