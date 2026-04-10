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

import { resolveSessionPath } from '../utils/sessionPathResolver';

export interface ConsentWallResult {
  detected: boolean;
  cleared: boolean;
  attempts: number;
  matchedSelector?: string;
  wallType?: 'consent' | 'login' | 'error' | 'rate_limit' | 'none';
  detail?: string;
  variant?: string; // Variant detected (e.g., 'iframe', 'overlay', 'banner')
  screenshotPath?: string; // Path to screenshot if failed
  htmlSnippet?: string; // Small HTML snippet for debugging
  /** When wallType is consent, why it was classified (e.g. cookie_pattern vs generic_button). */
  classificationReason?: string;
}

/** Element-level diagnostics for interstitials (buttons, dialogs) for logging and failure messages. */
export interface InterstitialElementDiagnostics {
  url: string;
  hasComposer: boolean;
  buttons: { tag: string; role: string | null; text: string; ariaLabel: string | null; visible: boolean }[];
  dialogs: { role: string; ariaLabel: string | null; innerTextSnippet: string }[];
  bodyTextSnippet: string;
  consentRelatedText: string[];
}

/**
 * Get the canonical session file path (consistent across all contexts)
 */
export function getSessionPath(): string {
  return resolveSessionPath();
}

/**
 * Check if session file exists
 */
export function sessionFileExists(): boolean {
  try {
    return fs.existsSync(resolveSessionPath());
  } catch {
    return false;
  }
}

/**
 * Load storageState for a new context
 * Returns undefined if no state available (will log warning)
 */
export async function loadTwitterState(): Promise<TwitterStorageState | undefined> {
  const sessionPath = resolveSessionPath();
  const exists = sessionFileExists();
  if (!exists) {
    console.log(`[TWITTER_SESSION] ⚠️ Session file not found at ${sessionPath} - will re-acquire state`);
  }
  
  const result = await loadTwitterStorageState();
  
  if (result.storageState && result.cookieCount > 0) {
    console.log(`[TWITTER_SESSION] ✅ Loaded storageState from ${result.source} (${result.cookieCount} cookies, path=${sessionPath})`);
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
    const sessionPath = resolveSessionPath();
    const savedPath = await saveStorageState(context, sessionPath);
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
 * Get interstitial element diagnostics (buttons, dialogs, body snippet) for logging and failure messages.
 */
export async function getInterstitialElementDiagnostics(page: Page): Promise<InterstitialElementDiagnostics> {
  const url = page.url();
  const data = await page.evaluate(() => {
    const hasComposeBox = !!document.querySelector('[data-testid="tweetTextarea_0"]') ||
      !!document.querySelector('div[contenteditable="true"][role="textbox"]');
    const bodyText = (document.body.textContent || '').slice(0, 2000);
    const buttons: { tag: string; role: string | null; text: string; ariaLabel: string | null; visible: boolean }[] = [];
    const allClickables = document.querySelectorAll('button, [role="button"], a[role="button"], input[type="submit"], [data-testid*="cookie" i]');
    allClickables.forEach((el) => {
      const text = (el.textContent || '').trim().slice(0, 80);
      const ariaLabel = el.getAttribute('aria-label');
      const role = el.getAttribute('role') || (el.tagName.toLowerCase() === 'button' ? 'button' : null);
      const rect = el.getBoundingClientRect();
      const visible = rect.width > 0 && rect.height > 0;
      if (text || ariaLabel) {
        buttons.push({
          tag: el.tagName.toLowerCase(),
          role,
          text,
          ariaLabel,
          visible,
        });
      }
    });
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"]')).map((d) => ({
      role: d.getAttribute('role') || 'dialog',
      ariaLabel: d.getAttribute('aria-label'),
      innerTextSnippet: (d.textContent || '').trim().slice(0, 200),
    }));
    const consentRelatedText: string[] = [];
    const consentPatterns = [
      'Accept all cookies', 'Accept cookies', 'Cookie', 'cookie preferences', 'cookie settings',
      'Accept all', 'Accept', 'Agree', 'Allow all', 'Allow', 'Continue', 'Got it', 'Okay', 'OK', 'Got it',
    ];
    consentPatterns.forEach((p) => {
      if (bodyText.toLowerCase().includes(p.toLowerCase())) consentRelatedText.push(p);
    });
    return {
      hasComposeBox,
      bodyTextSnippet: bodyText.slice(0, 500),
      buttons,
      dialogs,
      consentRelatedText,
    };
  });
  return {
    url,
    hasComposer: data.hasComposeBox,
    buttons: data.buttons,
    dialogs: data.dialogs,
    bodyTextSnippet: data.bodyTextSnippet,
    consentRelatedText: data.consentRelatedText,
  };
}

/**
 * Detect consent wall with multiple patterns.
 * On compose pages when composer is already visible, do NOT treat generic "Continue"/"Next" as consent
 * (compose modal has those). Only treat as consent when there is a true cookie/privacy pattern.
 */
export async function detectConsentWall(page: Page, options?: { composePage?: boolean }): Promise<ConsentWallResult> {
  const diagnostics = await page.evaluate(() => {
    const hasComposeBox = !!document.querySelector('[data-testid="tweetTextarea_0"]') ||
      !!document.querySelector('div[contenteditable="true"][role="textbox"]');
    const hasAccountMenu = !!document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
    const bodyText = document.body.textContent || '';
    const composerVisible = hasComposeBox || hasAccountMenu;

    // Cookie/consent-specific patterns only (true consent wall)
    const hasCookieConsentPattern =
      bodyText.includes('Accept all cookies') ||
      bodyText.includes('Accept cookies') ||
      bodyText.includes('cookie preferences') ||
      bodyText.includes('cookie settings') ||
      !!document.querySelector('[role="dialog"][aria-label*="cookie" i]') ||
      !!document.querySelector('[data-testid*="cookie" i]');
    // Generic button text that could be consent OR compose UI (Continue, Next, Got it, etc.)
    const hasAcceptLikeButton = Array.from(document.querySelectorAll('button, [role="button"]')).some((el) => {
      const t = (el.textContent || '').trim().toLowerCase();
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      return /accept|agree|allow|continue|ok(ay)?|got it|cookie/.test(t) || /accept|agree|allow|continue/.test(aria);
    });
    // When composer is visible, require cookie-specific pattern so we don't mistake compose modal for consent
    const hasConsentWall = hasCookieConsentPattern ||
      (bodyText.includes('Cookie') && !composerVisible) ||
      (bodyText.includes('Got it') && !composerVisible) ||
      (bodyText.includes('Accept all') && !composerVisible) ||
      (!composerVisible && hasAcceptLikeButton);
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
    let consent_reason = '';
    if (hasConsentWall) {
      if (hasCookieConsentPattern) consent_reason = 'cookie_or_privacy_pattern';
      else if (composerVisible) consent_reason = 'composer_visible_generic_ignored';
      else consent_reason = 'generic_accept_button_or_text';
    }
    return {
      logged_in: hasComposeBox || hasAccountMenu,
      wall_detected: hasLoginWall || hasConsentWall || hasErrorWall || hasRateLimit,
      wall_type: hasLoginWall ? 'login' : hasConsentWall ? 'consent' : hasErrorWall ? 'error' : hasRateLimit ? 'rate_limit' : 'none',
      tweet_containers_found: tweetContainers.length,
      consent_reason,
    };
  });
  const containers = diagnostics.tweet_containers_found || 0;
  const composePage = options?.composePage === true;
  const actuallyBlocked = diagnostics.wall_detected &&
    (diagnostics.wall_type === 'consent' || diagnostics.wall_type === 'login') &&
    (containers === 0 || (composePage && !diagnostics.logged_in));
  return {
    detected: actuallyBlocked,
    cleared: false,
    attempts: 0,
    wallType: diagnostics.wall_type as any,
    classificationReason: (diagnostics as any).consent_reason || undefined,
  };
}

/**
 * Accept consent wall with multiple strategies.
 * When options.composePage is true, success = composer visible (tweetTextarea_0 or contenteditable textbox).
 */
export async function acceptConsentWall(
  page: Page,
  maxAttempts: number = 3,
  options?: { composePage?: boolean }
): Promise<ConsentWallResult> {
  const containersBefore = await page.evaluate(() => {
    return document.querySelectorAll('article[data-testid="tweet"]').length;
  });
  const currentUrl = page.url();
  const initialUrl = currentUrl;
  const composePage = options?.composePage === true;

  // C1: Page-level click strategies (prioritize getByRole, then explicit text for X variants)
  const pageStrategies = [
    { name: 'getByRole button accept/agree/allow/continue/ok/got it', fn: async () => {
      try {
        const button = page.getByRole('button', { name: /accept|agree|allow|continue|ok(ay)?|got it/i }).first();
        if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
          await button.click({ timeout: 2000 });
          return true;
        }
      } catch {}
      return false;
    }},
    { name: 'getByRole link accept/agree/allow/continue/ok', fn: async () => {
      try {
        const link = page.getByRole('link', { name: /accept|agree|allow|continue|ok/i }).first();
        if (await link.isVisible({ timeout: 2000 }).catch(() => false)) {
          await link.click({ timeout: 2000 });
          return true;
        }
      } catch {}
      return false;
    }},
    { name: 'getByText Accept all cookies', fn: async () => {
      try {
        const button = page.getByText('Accept all cookies', { exact: false }).first();
        if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
          await button.click({ timeout: 2000 });
          return true;
        }
      } catch {}
      return false;
    }},
    { name: 'getByText Accept cookies', fn: async () => {
      try {
        const button = page.getByText('Accept cookies', { exact: false }).first();
        if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
          await button.click({ timeout: 2000 });
          return true;
        }
      } catch {}
      return false;
    }},
    { name: 'getByText Got it', fn: async () => {
      try {
        const el = page.getByText('Got it', { exact: false }).first();
        if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
          await el.click({ timeout: 2000 });
          return true;
        }
      } catch {}
      return false;
    }},
    { name: 'getByText Okay', fn: async () => {
      try {
        const el = page.getByRole('button', { name: /^okay$/i }).first();
        if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
          await el.click({ timeout: 2000 });
          return true;
        }
      } catch {}
      return false;
    }},
    { name: 'getByText Accept all', fn: async () => {
      try {
        const el = page.getByText('Accept all', { exact: false }).first();
        if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
          await el.click({ timeout: 2000 });
          return true;
        }
      } catch {}
      return false;
    }},
    { name: 'getByText Continue', fn: async () => {
      try {
        const el = page.getByRole('button', { name: /^continue$/i }).first();
        if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
          await el.click({ timeout: 2000 });
          return true;
        }
      } catch {}
      return false;
    }},
    { name: 'getByRole button OK', fn: async () => {
      try {
        const el = page.getByRole('button', { name: /^ok$/i }).first();
        if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
          await el.click({ timeout: 2000 });
          return true;
        }
      } catch {}
      return false;
    }},
  ];

  // C3: Fallback CSS/locator strategies (role=button, data-testid, etc.)
  const fallbackStrategies = [
    { name: 'locator button Accept', fn: async () => {
      try {
        const button = page.locator('button:has-text("Accept")').first();
        if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
          await button.click({ timeout: 2000 });
          return true;
        }
      } catch {}
      return false;
    }},
    { name: 'locator button Agree', fn: async () => {
      try {
        const button = page.locator('button:has-text("Agree")').first();
        if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
          await button.click({ timeout: 2000 });
          return true;
        }
      } catch {}
      return false;
    }},
    { name: 'locator div[role=button] Accept', fn: async () => {
      try {
        const button = page.locator('div[role="button"]:has-text("Accept")').first();
        if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
          await button.click({ timeout: 2000 });
          return true;
        }
      } catch {}
      return false;
    }},
    { name: 'locator span Got it', fn: async () => {
      try {
        const el = page.locator('span:has-text("Got it"), div:has-text("Got it")').first();
        if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
          await el.click({ timeout: 2000 });
          return true;
        }
      } catch {}
      return false;
    }},
    { name: 'data-testid cookie accept', fn: async () => {
      try {
        const el = page.locator('[data-testid*="cookie" i]').filter({ has: page.locator('button, [role="button"]') }).first();
        if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
          await el.locator('button, [role="button"]').first().click({ timeout: 2000 });
          return true;
        }
      } catch {}
      return false;
    }},
  ];
  
  // C2: Frame-level click helper (include Got it / Okay for X consent iframes)
  const tryFrameClick = async (frame: any, _strategyName: string): Promise<boolean> => {
    try {
      const button = frame.getByRole('button', { name: /accept|agree|allow|continue|ok(ay)?|got it/i }).first();
      if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
        await button.click({ timeout: 2000 });
        return true;
      }
    } catch {}
    try {
      const link = frame.getByRole('link', { name: /accept|agree|allow|continue|ok/i }).first();
      if (await link.isVisible({ timeout: 2000 }).catch(() => false)) {
        await link.click({ timeout: 2000 });
        return true;
      }
    } catch {}
    return false;
  };
  
  // Success detection: wait for consent wall to disappear OR logged-in selectors OR URL change
  const waitForSuccess = async (timeoutMs: number = 10000): Promise<boolean> => {
    try {
      await Promise.race([
        // Option 1: Consent wall selector disappears
        page.waitForFunction(
          () => {
            const overlays = document.querySelectorAll('[role="dialog"], [data-testid*="cookie"], [aria-label*="cookie"]');
            return overlays.length === 0;
          },
          { timeout: timeoutMs }
        ),
        // Option 2: Logged-in selectors appear
        Promise.all([
          page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: timeoutMs }).catch(() => null),
          page.waitForSelector('[data-testid="SideNav_AccountSwitcher_Button"]', { timeout: timeoutMs }).catch(() => null),
        ]).then(() => true),
        // Option 3: URL changes away from consent domain/path
        page.waitForFunction(
          (initial: string) => {
            const current = window.location.href;
            return !current.includes('/i/flow/consent') && current !== initial;
          },
          initialUrl,
          { timeout: timeoutMs }
        ),
      ]);
      return true;
    } catch {
      return false;
    }
  };
  
  let attempts = 0;
  let matchedSelector: string | null = null;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    attempts++;
    
    // C1: Try page-level clicks first
    for (const strategy of pageStrategies) {
      try {
        const clicked = await strategy.fn();
        if (clicked) {
          matchedSelector = strategy.name;
          console.log(`[CONSENT_WALL] 🍪 Clicked consent button via: ${strategy.name} (attempt ${attempts})`);
          
          // Wait for success indicators
          const success = await waitForSuccess(10000);
          if (success) {
            await page.waitForTimeout(2000); // Additional wait for page to settle
            
            // Verify containers increased OR logged-in selectors present
            const containersAfter = await page.evaluate(() => {
              return document.querySelectorAll('article[data-testid="tweet"]').length;
            });
            const hasLoggedInSelectors = await page.evaluate(() => {
              return !!(document.querySelector('[data-testid="tweetTextarea_0"]') || 
                       document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]'));
            });
            
            if (containersAfter > containersBefore || hasLoggedInSelectors) {
              console.log(`[CONSENT_WALL] ✅ Consent cleared: ${containersBefore} -> ${containersAfter} containers, logged_in=${hasLoggedInSelectors}`);
              return {
                detected: true,
                cleared: true,
                attempts,
                matchedSelector,
                wallType: 'consent',
              };
            }
          }
        }
      } catch (e) {
        // Try next strategy
      }
    }
    
    // C2: Try frame-level clicks
    try {
      const frames = page.frames();
      for (const frame of frames) {
        if (frame === page.mainFrame()) continue; // Skip main frame (already tried)
        try {
          const clicked = await tryFrameClick(frame, `frame_${frame.url()}`);
          if (clicked) {
            matchedSelector = `frame_click_${frame.url()}`;
            console.log(`[CONSENT_WALL] 🍪 Clicked consent button in frame: ${frame.url()} (attempt ${attempts})`);
            
            const success = await waitForSuccess(10000);
            if (success) {
              await page.waitForTimeout(2000);
              const containersAfter = await page.evaluate(() => {
                return document.querySelectorAll('article[data-testid="tweet"]').length;
              });
              const hasLoggedInSelectors = await page.evaluate(() => {
                return !!(document.querySelector('[data-testid="tweetTextarea_0"]') || 
                         document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]'));
              });
              
              if (containersAfter > containersBefore || hasLoggedInSelectors) {
                console.log(`[CONSENT_WALL] ✅ Consent cleared via frame: ${containersBefore} -> ${containersAfter} containers`);
                return {
                  detected: true,
                  cleared: true,
                  attempts,
                  matchedSelector,
                  wallType: 'consent',
                };
              }
            }
          }
        } catch (e) {
          // Try next frame
        }
      }
    } catch (e) {
      // Continue to fallback
    }
    
    // C3: Try fallback CSS selectors
    for (const strategy of fallbackStrategies) {
      try {
        const clicked = await strategy.fn();
        if (clicked) {
          matchedSelector = strategy.name;
          console.log(`[CONSENT_WALL] 🍪 Clicked consent button via: ${strategy.name} (attempt ${attempts})`);
          
          const success = await waitForSuccess(10000);
          if (success) {
            await page.waitForTimeout(2000);
            const containersAfter = await page.evaluate(() => {
              return document.querySelectorAll('article[data-testid="tweet"]').length;
            });
            const hasLoggedInSelectors = await page.evaluate(() => {
              return !!(document.querySelector('[data-testid="tweetTextarea_0"]') || 
                       document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]'));
            });
            
            if (containersAfter > containersBefore || hasLoggedInSelectors) {
              console.log(`[CONSENT_WALL] ✅ Consent cleared via fallback: ${containersBefore} -> ${containersAfter} containers`);
              return {
                detected: true,
                cleared: true,
                attempts,
                matchedSelector,
                wallType: 'consent',
              };
            }
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
  
  const cleared = containersAfter > containersBefore;
  
  // If not cleared, capture failure details
  let screenshotPath: string | undefined;
  let htmlSnippet: string | undefined;
  let variant: string | undefined;
  
  if (!cleared) {
    // Capture screenshot for debugging
    try {
      screenshotPath = `/tmp/consent_wall_failed_${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`[CONSENT_WALL] 📸 Screenshot saved: ${screenshotPath}`);
    } catch (e: any) {
      console.warn(`[CONSENT_WALL] ⚠️ Failed to capture screenshot: ${e.message}`);
    }
    
    // Capture HTML snippet (small, for debugging)
    try {
      htmlSnippet = await page.evaluate(() => {
        const dialogs = document.querySelectorAll('[role="dialog"], [data-testid*="cookie"], [aria-label*="cookie"]');
        if (dialogs.length > 0) {
          return dialogs[0].outerHTML.substring(0, 500); // First 500 chars
        }
        return document.body.innerHTML.substring(0, 500);
      });
    } catch (e: any) {
      console.warn(`[CONSENT_WALL] ⚠️ Failed to capture HTML: ${e.message}`);
    }
    
    // Detect variant
    try {
      const hasIframe = await page.locator('iframe').count() > 0;
      const hasDialog = await page.locator('[role="dialog"]').count() > 0;
      const hasBanner = await page.locator('[data-testid*="cookie"]').count() > 0;
      
      if (hasIframe) variant = 'iframe';
      else if (hasDialog) variant = 'dialog';
      else if (hasBanner) variant = 'banner';
      else variant = 'unknown';
    } catch (e) {
      variant = 'unknown';
    }
  }
  
  return {
    detected: true,
    cleared,
    attempts,
    matchedSelector: matchedSelector || undefined,
    wallType: 'consent',
    detail: containersAfter === 0 ? 'No containers found after attempts' : `Containers: ${containersBefore} -> ${containersAfter}`,
    variant,
    screenshotPath,
    htmlSnippet,
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
  // Check containers first - if containers exist, no consent wall blocking
  const containersBefore = await page.evaluate(() => {
    return document.querySelectorAll('article[data-testid="tweet"]').length;
  });
  
  if (containersBefore > 0) {
    // Containers exist - no consent wall blocking, but check if wall text is present (might be dismissed already)
    const detection = await detectConsentWall(page);
    if (!detection.detected) {
      return { detected: false, cleared: false, attempts: 0 };
    }
    // Wall text present but containers exist - might be a dismissed overlay, skip handling
    console.log(`[CONSENT_WALL] ℹ️ Consent wall text detected but containers exist (${containersBefore}) - likely already dismissed`);
    return { detected: false, cleared: true, attempts: 0 };
  }
  
  // No containers - consent wall is blocking
  console.log(`[CONSENT_WALL] 🚧 Consent wall detected (containers=0), attempting to clear...`);
  
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
