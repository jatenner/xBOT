/**
 * 🚫 X/CLOUDFLARE BLOCK DETECTION
 * 
 * Detects when X.com (Twitter) presents human verification challenges or Cloudflare blocks.
 * These are NOT bugs - they are X's anti-automation measures. We detect and gracefully pause.
 * 
 * NO CAPTCHA/CLOUDFLARE BYPASS TACTICS. This is detection + observability only.
 */

/**
 * Custom error for X human verification requirement
 */
export class XHumanVerificationRequiredError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly detectedPattern: string
  ) {
    super(message);
    this.name = 'XHumanVerificationRequiredError';
    Object.setPrototypeOf(this, XHumanVerificationRequiredError.prototype);
  }
}

/**
 * Patterns that indicate X/Cloudflare is blocking automation
 */
const BLOCK_PATTERNS = [
  // Cloudflare challenges
  'Verify you are human',
  'Just a moment...',
  'Checking your browser',
  'Enable JavaScript and cookies to continue',
  'cf-wrapper',
  'cf-browser-verification',
  'challenge-platform',
  
  // X-specific blocks
  'Something went wrong. Try reloading.',
  'Try again',
  'Rate limit exceeded',
  'automated behavior',
  
  // Generic challenge indicators
  'Security check',
  'Access denied',
  'Blocked',
  'captcha',
  'CAPTCHA'
];

/**
 * URL patterns that commonly trigger blocks
 */
const SENSITIVE_URLS = [
  '/home',
  '/compose/tweet',
  '/i/api/graphql',
  '/status/'
];

/**
 * Detects if X/Cloudflare is presenting a human verification challenge
 * 
 * @param html - Page HTML content
 * @param url - Current page URL
 * @returns true if block detected, false otherwise
 */
export function detectXHumanChallenge(html: string, url: string): boolean {
  if (!html || html.length === 0) {
    return false;
  }
  
  // Check for block patterns in HTML
  const htmlLower = html.toLowerCase();
  for (const pattern of BLOCK_PATTERNS) {
    if (htmlLower.includes(pattern.toLowerCase())) {
      console.warn(`[X_BLOCK_DETECTION] 🚫 Detected pattern: "${pattern}" in ${url}`);
      return true;
    }
  }
  
  // Check if HTML is suspiciously short (often indicates redirect/challenge page)
  if (html.length < 1000 && url.includes('x.com')) {
    console.warn(`[X_BLOCK_DETECTION] 🚫 Suspiciously short HTML (${html.length} chars) at ${url}`);
    return true;
  }
  
  return false;
}

/**
 * Validates that a page is actually X.com and not a challenge/block page
 * 
 * @param html - Page HTML content
 * @param url - Current page URL
 * @throws XHumanVerificationRequiredError if block detected
 */
export function assertNoXBlock(html: string, url: string): void {
  if (detectXHumanChallenge(html, url)) {
    const pattern = BLOCK_PATTERNS.find(p => 
      html.toLowerCase().includes(p.toLowerCase())
    ) || 'unknown';
    
    throw new XHumanVerificationRequiredError(
      `X/Cloudflare human verification required at ${url}`,
      url,
      pattern
    );
  }
}

/**
 * Safe wrapper for Playwright page operations that auto-detects blocks
 * 
 * @param page - Playwright page
 * @returns Object with detection results
 */
export async function checkPageForBlock(page: any): Promise<{
  blocked: boolean;
  url: string;
  pattern?: string;
}> {
  try {
    const url = page.url();
    const html = await page.content();
    
    if (detectXHumanChallenge(html, url)) {
      const pattern = BLOCK_PATTERNS.find(p => 
        html.toLowerCase().includes(p.toLowerCase())
      ) || 'unknown';
      
      return { blocked: true, url, pattern };
    }
    
    return { blocked: false, url };
  } catch (error: any) {
    console.error('[X_BLOCK_DETECTION] Error checking page:', error.message);
    return { blocked: false, url: 'unknown' };
  }
}

/**
 * Global automation block state (in-memory)
 */
export const xAutomationState = {
  blocked: false,
  lastError: null as string | null,
  blockedAt: null as Date | null,
  cooldownUntil: null as Date | null,
  cooldownMinutes: 60, // Default 60-minute cooldown
  
  /**
   * Mark X automation as blocked
   */
  markBlocked(error: string): void {
    this.blocked = true;
    this.lastError = error;
    this.blockedAt = new Date();
    this.cooldownUntil = new Date(Date.now() + this.cooldownMinutes * 60 * 1000);
    
    console.error('═══════════════════════════════════════════════════════════════');
    console.error('[X_BLOCKED] 🚫 X AUTOMATION BLOCKED - Human verification required');
    console.error(`[X_BLOCKED] Error: ${error}`);
    console.error(`[X_BLOCKED] Blocked at: ${this.blockedAt.toISOString()}`);
    console.error(`[X_BLOCKED] Cooldown until: ${this.cooldownUntil.toISOString()}`);
    console.error(`[X_BLOCKED] Duration: ${this.cooldownMinutes} minutes`);
    console.error('[X_BLOCKED] All X automation (posting/replies/scraping) will be paused.');
    console.error('[X_BLOCKED] System will continue running in degraded mode.');
    console.error('═══════════════════════════════════════════════════════════════');
  },
  
  /**
   * Check if cooldown has expired and automation can be retried
   */
  canRetry(): boolean {
    if (!this.blocked) {
      return true;
    }
    
    if (!this.cooldownUntil) {
      return false;
    }
    
    const now = new Date();
    if (now >= this.cooldownUntil) {
      console.log('[X_BLOCK_DETECTION] ⏰ Cooldown expired, resetting automation state');
      this.reset();
      return true;
    }
    
    return false;
  },
  
  /**
   * Reset automation state (manual override or after cooldown)
   */
  reset(): void {
    this.blocked = false;
    this.lastError = null;
    this.blockedAt = null;
    this.cooldownUntil = null;
    console.log('[X_BLOCK_DETECTION] ✅ X automation state reset');
  },
  
  /**
   * Get status summary
   */
  getStatus(): {
    blocked: boolean;
    lastError: string | null;
    blockedAt: string | null;
    cooldownUntil: string | null;
    canRetry: boolean;
  } {
    return {
      blocked: this.blocked,
      lastError: this.lastError,
      blockedAt: this.blockedAt?.toISOString() || null,
      cooldownUntil: this.cooldownUntil?.toISOString() || null,
      canRetry: this.canRetry()
    };
  }
};

