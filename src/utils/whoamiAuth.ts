/**
 * 🔐 WHOAMI AUTH CHECK
 * 
 * Verifies authentication by checking for logged-in indicators on x.com/home
 * More reliable than checking for login walls on profile pages
 */

import { Page } from 'playwright';

export interface WhoamiResult {
  logged_in: boolean;
  handle: string | null;
  url: string;
  title: string;
  reason: string;
}

/**
 * Check authentication status by navigating to home and looking for logged-in indicators
 */
export async function checkWhoami(page: Page): Promise<WhoamiResult> {
  try {
    // Navigate to home (requires auth)
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000); // Let page load
    
    const finalUrl = page.url();
    const title = await page.title().catch(() => 'unknown');
    
    // Check for logged-in indicators
    const loggedInIndicators = await page.evaluate(() => {
      // Account switcher button (most reliable)
      const accountSwitcher = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
      
      // Profile link in sidebar
      const profileLink = document.querySelector('a[href*="/"][href*="/status"]')?.closest('nav')?.querySelector('a[href^="/"]');
      
      // Timeline container
      const timeline = document.querySelector('[data-testid="primaryColumn"]') || document.querySelector('main');
      
      // Extract handle from profile link if available
      let handle: string | null = null;
      if (profileLink) {
        const href = (profileLink as HTMLAnchorElement).href;
        const match = href.match(/x\.com\/([^\/\?]+)/);
        if (match && match[1] && !match[1].includes('home') && !match[1].includes('explore')) {
          handle = match[1];
        }
      }
      
      // Try to get handle from account switcher
      if (!handle && accountSwitcher) {
        const text = accountSwitcher.textContent || '';
        const handleMatch = text.match(/@(\w+)/);
        if (handleMatch) {
          handle = handleMatch[1];
        }
      }
      
      return {
        hasAccountSwitcher: !!accountSwitcher,
        hasProfileLink: !!profileLink,
        hasTimeline: !!timeline,
        handle,
      };
    });
    
    const isLoggedIn = loggedInIndicators.hasAccountSwitcher || 
                       (loggedInIndicators.hasTimeline && !finalUrl.includes('/i/flow/login'));
    
    let reason = 'ok';
    if (!isLoggedIn) {
      if (finalUrl.includes('/i/flow/login') || finalUrl.includes('/login')) {
        reason = 'login_redirect';
      } else if (!loggedInIndicators.hasTimeline) {
        reason = 'no_timeline';
      } else {
        reason = 'no_indicators';
      }
    }
    
    return {
      logged_in: isLoggedIn,
      handle: loggedInIndicators.handle ? `@${loggedInIndicators.handle}` : null,
      url: finalUrl,
      title,
      reason,
    };
  } catch (error: any) {
    return {
      logged_in: false,
      handle: null,
      url: page.url(),
      title: await page.title().catch(() => 'unknown'),
      reason: `error: ${error.message}`,
    };
  }
}

