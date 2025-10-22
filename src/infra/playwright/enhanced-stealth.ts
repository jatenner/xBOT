/**
 * 🥷 ENHANCED STEALTH - Twitter Analytics Access
 * 
 * Specific improvements to bypass Twitter's analytics authentication detection
 */

import { Page, BrowserContext } from 'playwright';

/**
 * Warm up a session with natural browsing before accessing analytics
 * This is CRITICAL - Twitter flags cold sessions going straight to analytics
 */
export async function warmUpSession(page: Page): Promise<void> {
  console.log('🔥 [STEALTH] Warming up session with natural browsing...');
  
  try {
    // Step 1: Visit home page
    console.log('   📱 Visiting home page...');
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
    await naturalDelay(3000, 5000);
    
    // Step 2: Scroll timeline (humans always scroll)
    console.log('   📜 Scrolling timeline...');
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => {
        const scrollAmount = Math.random() * 400 + 300;
        window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
      });
      await naturalDelay(2000, 4000);
    }
    
    // Step 3: Visit profile (establish context)
    console.log('   👤 Visiting profile...');
    await page.goto('https://x.com/Signal_Synapse', { waitUntil: 'domcontentloaded' });
    await naturalDelay(2000, 3000);
    
    // Step 4: Scroll profile
    await page.evaluate(() => window.scrollBy({ top: 200, behavior: 'smooth' }));
    await naturalDelay(1000, 2000);
    
    console.log('✅ [STEALTH] Session warmed - ready for analytics access');
  } catch (error) {
    console.warn('⚠️  [STEALTH] Warmup failed (non-critical):', error.message);
  }
}

/**
 * Access analytics using human-like pattern
 * Goes through tweet page first, mimics clicking analytics button
 */
export async function accessAnalyticsSafely(
  page: Page, 
  tweetId: string
): Promise<boolean> {
  console.log(`🔐 [STEALTH] Safely accessing analytics for ${tweetId}...`);
  
  try {
    // Step 1: Visit tweet normally first
    console.log('   🐦 Loading tweet page...');
    await page.goto(`https://x.com/Signal_Synapse/status/${tweetId}`, {
      waitUntil: 'domcontentloaded'
    });
    await naturalDelay(2000, 4000);
    
    // Step 2: Scroll to "read" the tweet (humans do this)
    await page.evaluate(() => window.scrollBy({ top: 150, behavior: 'smooth' }));
    await naturalDelay(1000, 2000);
    
    // Step 3: Try to click analytics button (most human-like)
    console.log('   🎯 Attempting to click analytics button...');
    try {
      const analyticsButton = page.locator('[aria-label="View post analytics"]').first();
      await analyticsButton.click({ timeout: 3000 });
      await naturalDelay(2000, 3000);
      console.log('   ✅ Clicked analytics button (human-like access)');
      return true;
    } catch {
      // Fallback: Navigate directly (less human but works)
      console.log('   ⚠️  Button not found, using direct URL...');
      await page.goto(`https://x.com/Signal_Synapse/status/${tweetId}/analytics`, {
        waitUntil: 'domcontentloaded'
      });
      await naturalDelay(2000, 3000);
      return true;
    }
  } catch (error) {
    console.error('❌ [STEALTH] Safe analytics access failed:', error.message);
    return false;
  }
}

/**
 * Natural delay using Gaussian distribution
 * More realistic than uniform random delays
 */
export async function naturalDelay(minMs: number, maxMs: number): Promise<void> {
  const mean = (minMs + maxMs) / 2;
  const stdDev = (maxMs - minMs) / 6;
  
  // Box-Muller transform for Gaussian distribution
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const delay = Math.max(minMs, Math.min(maxMs, Math.round(mean + z0 * stdDev)));
  
  await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Enhanced canvas and WebGL fingerprinting protection
 */
export async function enhancedCanvasProtection(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    // Consistent seed per session for canvas noise
    const seed = Math.random();
    
    // Canvas fingerprinting protection
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type?: string) {
      const ctx = this.getContext('2d');
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, this.width, this.height);
        // Add consistent but subtle noise
        for (let i = 0; i < imageData.data.length; i += 4) {
          imageData.data[i] += Math.sin(seed + i) * 1.5;
        }
        ctx.putImageData(imageData, 0, 0);
      }
      return originalToDataURL.call(this, type);
    };
    
    // WebGL fingerprinting protection
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter: number) {
      if (parameter === 37445) return 'Intel Inc.'; // UNMASKED_VENDOR_WEBGL
      if (parameter === 37446) return 'Intel Iris OpenGL Engine'; // UNMASKED_RENDERER_WEBGL
      return getParameter.call(this, parameter);
    };
  });
  
  console.log('✅ [STEALTH] Enhanced canvas/WebGL protection applied');
}

/**
 * Rate limiter for analytics access
 */
export class AnalyticsRateLimiter {
  private lastAccess: number = 0;
  private accessCount: number = 0;
  private readonly minInterval: number = 5000; // 5 seconds minimum
  private readonly cooldownThreshold: number = 5; // After 5 accesses
  private readonly cooldownDuration: number = 120000; // 2 minutes
  
  async beforeAccess(): Promise<void> {
    const now = Date.now();
    const timeSinceLastAccess = now - this.lastAccess;
    
    // Enforce minimum interval
    if (timeSinceLastAccess < this.minInterval) {
      const wait = this.minInterval - timeSinceLastAccess;
      console.log(`⏱️  [RATE_LIMIT] Waiting ${Math.round(wait/1000)}s...`);
      await new Promise(resolve => setTimeout(resolve, wait));
    }
    
    // Check if cooldown needed
    this.accessCount++;
    if (this.accessCount >= this.cooldownThreshold) {
      console.log(`🛑 [RATE_LIMIT] Taking ${this.cooldownDuration/1000}s cooldown after ${this.accessCount} requests...`);
      await new Promise(resolve => setTimeout(resolve, this.cooldownDuration));
      this.accessCount = 0;
    }
    
    this.lastAccess = Date.now();
  }
  
  reset(): void {
    this.accessCount = 0;
    this.lastAccess = 0;
  }
}

/**
 * Refresh session cookies to keep them fresh
 */
export async function refreshSessionCookies(page: Page): Promise<number> {
  console.log('🔄 [STEALTH] Refreshing session cookies...');
  
  try {
    // Navigate to trigger cookie updates
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
    await naturalDelay(2000, 3000);
    
    // Extract updated cookies
    const cookies = await page.context().cookies();
    console.log(`✅ [STEALTH] Refreshed ${cookies.length} cookies`);
    
    return cookies.length;
  } catch (error) {
    console.warn('⚠️  [STEALTH] Cookie refresh failed:', error.message);
    return 0;
  }
}

/**
 * Check if session is still valid before analytics access
 */
export async function validateSession(page: Page): Promise<boolean> {
  try {
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Check for login button (indicates logged out)
    const loginButton = await page.locator('a[href="/login"]').count();
    if (loginButton > 0) {
      console.error('❌ [STEALTH] Session invalid - not logged in');
      return false;
    }
    
    // Check for timeline content (indicates logged in)
    const timeline = await page.locator('[aria-label="Timeline: Your Home Timeline"]').count();
    if (timeline > 0) {
      console.log('✅ [STEALTH] Session validated - logged in');
      return true;
    }
    
    console.warn('⚠️  [STEALTH] Session state unclear');
    return false;
  } catch (error) {
    console.error('❌ [STEALTH] Session validation failed:', error.message);
    return false;
  }
}

// Export singleton rate limiter
export const globalAnalyticsRateLimiter = new AnalyticsRateLimiter();

