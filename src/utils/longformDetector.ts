/**
 * LONGFORM DETECTION UTILITY FOR PLAYWRIGHT
 * 
 * Auto-detects if the Twitter/X account has access to longform tweets (>280 chars)
 * Returns true if the account can post >280 chars in a single tweet
 */

import { Page } from 'playwright';

export interface LongformCapability {
  available: boolean;
  maxChars: number;
  detectionMethod: string;
  timestamp: number;
}

export class LongformDetector {
  private static instance: LongformDetector;
  private cachedResult: LongformCapability | null = null;
  private cacheExpiryMs = 24 * 60 * 60 * 1000; // 24 hours

  private constructor() {}

  public static getInstance(): LongformDetector {
    if (!LongformDetector.instance) {
      LongformDetector.instance = new LongformDetector();
    }
    return LongformDetector.instance;
  }

  /**
   * Detect if longform tweets are available for this account
   * Uses multiple detection methods for reliability
   */
  public async detectLongformAvailable(page: Page): Promise<boolean> {
    try {
      // Check cache first
      if (this.cachedResult && this.isCacheValid()) {
        console.log(`📋 Using cached longform detection: ${this.cachedResult.available}`);
        return this.cachedResult.available;
      }

      console.log('🔍 Detecting longform tweet capability...');
      
      // Method 1: Direct composer test (most reliable)
      const composerResult = await this.detectViaComposer(page);
      if (composerResult.available !== undefined) {
        this.cacheResult(composerResult as LongformCapability);
        return composerResult.available;
      }

      // Method 2: Settings page inspection
      const settingsResult = await this.detectViaSettings(page);
      if (settingsResult.available !== undefined) {
        this.cacheResult(settingsResult as LongformCapability);
        return settingsResult.available;
      }

      // Method 3: Account features inspection
      const featuresResult = await this.detectViaFeatures(page);
      if (featuresResult.available !== undefined) {
        this.cacheResult(featuresResult as LongformCapability);
        return featuresResult.available;
      }

      // Default to false if all methods fail
      console.log('⚠️ All longform detection methods failed, defaulting to false');
      this.cacheResult({
        available: false,
        maxChars: 280,
        detectionMethod: 'fallback',
        timestamp: Date.now()
      });
      
      return false;

    } catch (error) {
      console.error('❌ Longform detection error:', error);
      return false;
    }
  }

  /**
   * Method 1: Test composer directly with >280 chars
   * Most reliable method - actually tests the functionality
   */
  private async detectViaComposer(page: Page): Promise<Partial<LongformCapability>> {
    try {
      console.log('🔍 Testing composer with longform content...');
      
      // Navigate to compose tweet
      await page.goto('https://x.com/compose/tweet', { 
        waitUntil: 'networkidle',
        timeout: 15000 
      });

      // Wait for composer to load
      await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 15000 });
      
      // Create test content that's definitely >280 chars
      const testContent = 'L'.repeat(1200); // 1200 chars, safely >280
      
      // Fill the composer
      await page.fill('[data-testid="tweetTextarea_0"]', testContent);
      await page.waitForTimeout(1000); // Let UI update

      // Check if tweet button is enabled
      const tweetButton = page.locator('[data-testid="tweetButtonInline"]').first();
      const isEnabled = await tweetButton.evaluate((btn: HTMLButtonElement) => {
        return !btn.hasAttribute('disabled') && !btn.disabled;
      });

      // Check character counter for additional info
      const charCounter = await this.getCharacterCount(page);
      
      // Clear the composer
      await page.keyboard.press('Control+A'); // Select all
      await page.keyboard.press('Delete');
      await page.keyboard.press('Escape').catch(() => {}); // Close composer

      if (isEnabled) {
        console.log('✅ Longform detected: Tweet button enabled with 1200+ chars');
        return {
          available: true,
          maxChars: 9000, // Twitter Blue longform limit
          detectionMethod: 'composer_test',
          timestamp: Date.now()
        };
      } else {
        console.log('❌ Longform not available: Tweet button disabled with 1200+ chars');
        return {
          available: false,
          maxChars: 280,
          detectionMethod: 'composer_test',
          timestamp: Date.now()
        };
      }

    } catch (error) {
      console.log('⚠️ Composer detection failed:', error.message);
      return {};
    }
  }

  /**
   * Method 2: Check Twitter Blue/Premium settings
   * Less reliable but useful as backup
   */
  private async detectViaSettings(page: Page): Promise<Partial<LongformCapability>> {
    try {
      console.log('🔍 Checking account settings for longform features...');

      // Navigate to settings
      await page.goto('https://x.com/settings/account', {
        waitUntil: 'domcontentloaded',
        timeout: 10000
      });

      // Look for Twitter Blue indicators
      const blueIndicators = [
        '[data-testid="subscriptionStatus"]',
        'text="Twitter Blue"',
        'text="Premium"',
        'text="Long-form tweets"',
        '[aria-label*="Blue"]'
      ];

      for (const indicator of blueIndicators) {
        try {
          const element = await page.locator(indicator).first();
          if (await element.isVisible({ timeout: 2000 })) {
            console.log('✅ Found Twitter Blue indicator in settings');
            return {
              available: true,
              maxChars: 9000,
              detectionMethod: 'settings_check',
              timestamp: Date.now()
            };
          }
        } catch {
          continue;
        }
      }

      console.log('❌ No Twitter Blue indicators found in settings');
      return {
        available: false,
        maxChars: 280,
        detectionMethod: 'settings_check',
        timestamp: Date.now()
      };

    } catch (error) {
      console.log('⚠️ Settings detection failed:', error.message);
      return {};
    }
  }

  /**
   * Method 3: Check for account features via profile/home
   * Looks for visual indicators of premium features
   */
  private async detectViaFeatures(page: Page): Promise<Partial<LongformCapability>> {
    try {
      console.log('🔍 Checking account features for premium indicators...');

      // Go to home timeline
      await page.goto('https://x.com/home', {
        waitUntil: 'domcontentloaded',
        timeout: 10000
      });

      // Look for premium feature indicators
      const premiumFeatures = [
        '[data-testid="birdwatch-note"]', // Community notes
        '[data-testid="editTweet"]',     // Edit button
        '[aria-label*="Verified"]',      // Blue checkmark
        '[data-testid="tweetButtonInline"] + [data-testid="scheduleOption"]' // Scheduling
      ];

      let premiumFeatureCount = 0;
      for (const feature of premiumFeatures) {
        try {
          const element = await page.locator(feature).first();
          if (await element.isVisible({ timeout: 1000 })) {
            premiumFeatureCount++;
          }
        } catch {
          continue;
        }
      }

      // If we find multiple premium features, likely has Twitter Blue
      if (premiumFeatureCount >= 2) {
        console.log(`✅ Found ${premiumFeatureCount} premium features, likely has longform`);
        return {
          available: true,
          maxChars: 9000,
          detectionMethod: 'features_check',
          timestamp: Date.now()
        };
      } else {
        console.log(`❌ Only found ${premiumFeatureCount} premium features, likely no longform`);
        return {
          available: false,
          maxChars: 280,
          detectionMethod: 'features_check',
          timestamp: Date.now()
        };
      }

    } catch (error) {
      console.log('⚠️ Features detection failed:', error.message);
      return {};
    }
  }

  /**
   * Get current character count from composer
   */
  private async getCharacterCount(page: Page): Promise<number> {
    try {
      // Twitter shows character count in various formats
      const counterSelectors = [
        '[data-testid="tweetTextarea_0_indicator"]',
        '[role="progressbar"]',
        '.public-DraftStyleDefault-block'
      ];

      for (const selector of counterSelectors) {
        try {
          const element = await page.locator(selector).first();
          if (await element.isVisible({ timeout: 1000 })) {
            const text = await element.textContent();
            const match = text?.match(/(\d+)/);
            if (match) {
              return parseInt(match[1]);
            }
          }
        } catch {
          continue;
        }
      }

      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * Cache the detection result
   */
  private cacheResult(result: LongformCapability): void {
    this.cachedResult = result;
    console.log(`📋 Cached longform detection: ${result.available} (method: ${result.detectionMethod})`);
  }

  /**
   * Check if cached result is still valid
   */
  private isCacheValid(): boolean {
    if (!this.cachedResult) return false;
    return (Date.now() - this.cachedResult.timestamp) < this.cacheExpiryMs;
  }

  /**
   * Clear cached result (useful for testing)
   */
  public clearCache(): void {
    this.cachedResult = null;
    console.log('🗑️ Cleared longform detection cache');
  }

  /**
   * Get cached result without detection
   */
  public getCachedResult(): LongformCapability | null {
    return this.isCacheValid() ? this.cachedResult : null;
  }

  /**
   * Get maximum characters allowed for this account
   */
  public async getMaxChars(page: Page): Promise<number> {
    const result = await this.detectLongformAvailable(page);
    return result ? 9000 : 280;
  }
}

/**
 * Convenience function for quick longform detection
 * Returns true if the account can post >280 chars in a single tweet
 */
export async function detectLongformAvailable(page: Page): Promise<boolean> {
  const detector = LongformDetector.getInstance();
  return await detector.detectLongformAvailable(page);
}

/**
 * Get maximum characters for this account
 */
export async function getMaxTweetLength(page: Page): Promise<number> {
  const detector = LongformDetector.getInstance();
  return await detector.getMaxChars(page);
}