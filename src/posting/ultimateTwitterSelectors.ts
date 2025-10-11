/**
 * 🎯 ULTIMATE TWITTER SELECTORS - OCTOBER 2025
 * These selectors work with the current X/Twitter interface
 */

export const ULTIMATE_SELECTORS = {
  composer: [
    // Current X interface (October 2025)
    'div[contenteditable="true"][role="textbox"]',
    'div[aria-label*="Post text"]',
    'div[aria-label*="What is happening"]',
    'div[aria-label*="What\'s happening"]',
    '[data-testid="tweetTextarea_0"]',
    'div[data-testid="tweetTextarea_0"] div[contenteditable="true"]',
    
    // Robust fallbacks
    '.public-DraftEditor-content',
    'div[contenteditable="true"]',
    '[role="textbox"]',
    'div[spellcheck="true"]'
  ],
  
  postButton: [
    '[data-testid="tweetButtonInline"]:not([aria-hidden="true"])',
    '[data-testid="tweetButton"]:not([aria-hidden="true"])',
    'button[data-testid="tweetButtonInline"]',
    'button[data-testid="tweetButton"]',
    'div[role="button"][aria-label*="Post"]',
    'button[aria-label*="Post"]'
  ],
  
  loginCheck: [
    'a[href="/login"]',
    'text=Log in',
    'text=Sign up',
    '[data-testid="loginButton"]'
  ]
};

export function isLoggedOut(page: any): Promise<boolean> {
  return page.locator(ULTIMATE_SELECTORS.loginCheck.join(',')).first().isVisible().catch(() => false);
}
