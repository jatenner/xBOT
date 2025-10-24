/**
 * 🛡️ RESILIENT REPLY POSTER
 * 
 * A self-healing reply system that:
 * 1. Uses multiple detection strategies (visual position, not just selectors)
 * 2. Tracks success rates and auto-adapts
 * 3. Has multiple fallback methods
 * 4. Auto-recovers from Twitter UI changes
 */

import { Page } from 'playwright';
import { getSupabaseClient } from '../db/index';

export interface ReplyResult {
  success: boolean;
  tweetId?: string;
  error?: string;
  strategy?: string;
  diagnostics?: any;
}

interface StrategyMetrics {
  name: string;
  attempts: number;
  successes: number;
  failures: number;
  lastSuccess?: Date;
  avgResponseTime: number;
  enabled: boolean;
}

export class ResilientReplyPoster {
  private static strategyMetrics: Map<string, StrategyMetrics> = new Map();
  
  constructor(private page: Page) {
    this.initializeMetrics();
  }

  /**
   * 🎯 MAIN METHOD: Post reply with auto-healing
   */
  async postReply(content: string, replyToTweetId: string): Promise<ReplyResult> {
    console.log(`🛡️ RESILIENT_REPLY: Posting to tweet ${replyToTweetId}`);
    console.log(`📊 STRATEGY_HEALTH: ${this.getHealthSummary()}`);
    
    // Get strategies ordered by success rate
    const strategies = this.getOrderedStrategies();
    
    for (const strategy of strategies) {
      if (!strategy.enabled) {
        console.log(`⏭️ SKIPPING: ${strategy.name} (disabled due to failures)`);
        continue;
      }
      
      console.log(`🔄 TRYING: ${strategy.name} (success rate: ${this.getSuccessRate(strategy.name)}%)`);
      
      const startTime = Date.now();
      let result: ReplyResult;
      
      try {
        switch (strategy.name) {
          case 'visual_position':
            result = await this.strategyVisualPosition(content, replyToTweetId);
            break;
          case 'keyboard_shortcut':
            result = await this.strategyKeyboardShortcut(content, replyToTweetId);
            break;
          case 'icon_detection':
            result = await this.strategyIconDetection(content, replyToTweetId);
            break;
          case 'mobile_interface':
            result = await this.strategyMobileInterface(content, replyToTweetId);
            break;
          case 'legacy_selectors':
            result = await this.strategyLegacySelectors(content, replyToTweetId);
            break;
          default:
            continue;
        }
        
        const responseTime = Date.now() - startTime;
        
        if (result.success) {
          console.log(`✅ SUCCESS: ${strategy.name} worked in ${responseTime}ms`);
          await this.recordSuccess(strategy.name, responseTime);
          return { ...result, strategy: strategy.name };
        } else {
          console.log(`❌ FAILED: ${strategy.name} - ${result.error}`);
          await this.recordFailure(strategy.name, result.error || 'Unknown error');
        }
        
      } catch (error: any) {
        console.log(`💥 CRASHED: ${strategy.name} - ${error.message}`);
        await this.recordFailure(strategy.name, error.message);
      }
      
      // Brief pause between strategies
      await this.page.waitForTimeout(1000);
    }
    
    // All strategies failed - capture diagnostics
    console.log('❌ ALL_STRATEGIES_FAILED: Capturing diagnostics...');
    const diagnostics = await this.captureComprehensiveDiagnostics(replyToTweetId);
    
    return {
      success: false,
      error: 'All reply strategies failed',
      diagnostics
    };
  }

  /**
   * 🎯 STRATEGY 1: Visual Position Detection (Most Resilient)
   * 
   * Reply button is ALWAYS the first action button under a tweet
   * This works regardless of Twitter's selector changes
   */
  private async strategyVisualPosition(content: string, tweetId: string): Promise<ReplyResult> {
    try {
      // Navigate to tweet
      await this.page.goto(`https://x.com/i/status/${tweetId}`, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
      await this.page.waitForTimeout(2000);
      
      // Find the main tweet article
      const article = this.page.locator('article').first();
      await article.waitFor({ state: 'visible', timeout: 10000 });
      
      // Find action bar (contains reply, retweet, like buttons)
      // It's the first role="group" with multiple buttons
      const actionBar = article.locator('[role="group"]').first();
      await actionBar.waitFor({ state: 'visible', timeout: 5000 });
      
      // Reply button is ALWAYS the first button/clickable in action bar
      const replyButton = actionBar.locator('button, [role="button"]').first();
      
      console.log('🎯 VISUAL_POSITION: Found first action button (reply)');
      
      // Click and open composer
      await replyButton.click();
      await this.page.waitForTimeout(2000);
      
      // Type reply content
      const composer = await this.findComposer();
      if (!composer) {
        throw new Error('Composer not found after clicking reply');
      }
      
      await composer.fill(content);
      await this.page.waitForTimeout(500);
      
      // Post reply
      const posted = await this.submitReply();
      if (!posted) {
        throw new Error('Failed to submit reply');
      }
      
      // Extract tweet ID
      const tweetIdExtracted = await this.extractReplyTweetId();
      
      return {
        success: true,
        tweetId: tweetIdExtracted
      };
      
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 🎯 STRATEGY 2: Keyboard Shortcut (Fast & Reliable)
   */
  private async strategyKeyboardShortcut(content: string, tweetId: string): Promise<ReplyResult> {
    try {
      // Navigate to tweet
      await this.page.goto(`https://x.com/i/status/${tweetId}`, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
      await this.page.waitForTimeout(2000);
      
      // Focus the tweet
      await this.page.locator('article').first().click();
      await this.page.waitForTimeout(500);
      
      // Press 'r' to open reply composer
      await this.page.keyboard.press('r');
      await this.page.waitForTimeout(1500);
      
      // Type reply
      const composer = await this.findComposer();
      if (!composer) {
        throw new Error('Composer not found after keyboard shortcut');
      }
      
      await composer.fill(content);
      await this.page.waitForTimeout(500);
      
      // Submit
      const posted = await this.submitReply();
      if (!posted) {
        throw new Error('Failed to submit reply');
      }
      
      const tweetIdExtracted = await this.extractReplyTweetId();
      
      return {
        success: true,
        tweetId: tweetIdExtracted
      };
      
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 🎯 STRATEGY 3: Icon Detection (SVG-based)
   */
  private async strategyIconDetection(content: string, tweetId: string): Promise<ReplyResult> {
    try {
      await this.page.goto(`https://x.com/i/status/${tweetId}`, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
      await this.page.waitForTimeout(2000);
      
      // Find reply button by its SVG icon
      // Reply icon has a specific SVG path
      const replyIcon = this.page.locator('svg').locator('path[d*="M1.751"]').first();
      
      // Get the clickable button that contains this icon
      const replyButton = this.page.locator('button:has(svg path[d*="M1.751"])').first();
      
      await replyButton.waitFor({ state: 'visible', timeout: 5000 });
      await replyButton.click();
      await this.page.waitForTimeout(2000);
      
      const composer = await this.findComposer();
      if (!composer) {
        throw new Error('Composer not found');
      }
      
      await composer.fill(content);
      await this.page.waitForTimeout(500);
      
      const posted = await this.submitReply();
      if (!posted) {
        throw new Error('Failed to submit');
      }
      
      const tweetIdExtracted = await this.extractReplyTweetId();
      
      return {
        success: true,
        tweetId: tweetIdExtracted
      };
      
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 🎯 STRATEGY 4: Mobile Interface (Simpler DOM)
   */
  private async strategyMobileInterface(content: string, tweetId: string): Promise<ReplyResult> {
    try {
      // Switch to mobile viewport
      await this.page.setViewportSize({ width: 375, height: 667 });
      
      await this.page.goto(`https://mobile.twitter.com/i/status/${tweetId}`, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
      await this.page.waitForTimeout(3000);
      
      // Mobile has simpler selectors
      const replyButton = this.page.getByRole('button', { name: /reply/i }).first();
      await replyButton.click();
      await this.page.waitForTimeout(2000);
      
      const composer = await this.findComposer();
      if (!composer) {
        throw new Error('Mobile composer not found');
      }
      
      await composer.fill(content);
      await this.page.waitForTimeout(500);
      
      const posted = await this.submitReply();
      if (!posted) {
        throw new Error('Failed to submit on mobile');
      }
      
      // Switch back to desktop
      await this.page.setViewportSize({ width: 1280, height: 720 });
      
      const tweetIdExtracted = await this.extractReplyTweetId();
      
      return {
        success: true,
        tweetId: tweetIdExtracted
      };
      
    } catch (error: any) {
      // Make sure to reset viewport
      await this.page.setViewportSize({ width: 1280, height: 720 });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 🎯 STRATEGY 5: Legacy Selectors (Fallback)
   */
  private async strategyLegacySelectors(content: string, tweetId: string): Promise<ReplyResult> {
    try {
      await this.page.goto(`https://x.com/i/status/${tweetId}`, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
      await this.page.waitForTimeout(2000);
      
      // Try common selectors
      const selectors = [
        '[data-testid="reply"]',
        'button[aria-label*="Reply"]',
        '[aria-label*="Reply"][role="button"]'
      ];
      
      let clicked = false;
      for (const selector of selectors) {
        try {
          const button = this.page.locator(selector).first();
          await button.waitFor({ state: 'visible', timeout: 2000 });
          await button.click();
          clicked = true;
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (!clicked) {
        throw new Error('No legacy selector worked');
      }
      
      await this.page.waitForTimeout(2000);
      
      const composer = await this.findComposer();
      if (!composer) {
        throw new Error('Composer not found');
      }
      
      await composer.fill(content);
      await this.page.waitForTimeout(500);
      
      const posted = await this.submitReply();
      if (!posted) {
        throw new Error('Failed to submit');
      }
      
      const tweetIdExtracted = await this.extractReplyTweetId();
      
      return {
        success: true,
        tweetId: tweetIdExtracted
      };
      
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 🔍 Helper: Find composer textbox
   */
  private async findComposer() {
    const composerSelectors = [
      '[data-testid="tweetTextarea_0"]',
      'div[role="textbox"]',
      '[contenteditable="true"]',
      'div[aria-label*="Post"]',
      'div[aria-label*="Tweet"]'
    ];
    
    for (const selector of composerSelectors) {
      try {
        const composer = this.page.locator(selector).first();
        await composer.waitFor({ state: 'visible', timeout: 3000 });
        return composer;
      } catch (e) {
        continue;
      }
    }
    
    return null;
  }

  /**
   * 📤 Helper: Submit reply
   */
  private async submitReply(): Promise<boolean> {
    const submitSelectors = [
      '[data-testid="tweetButton"]',
      '[data-testid="tweetButtonInline"]',
      'button[data-testid="tweetButton"]',
      'div[role="button"]:has-text("Post")',
      'div[role="button"]:has-text("Reply")'
    ];
    
    for (const selector of submitSelectors) {
      try {
        const button = this.page.locator(selector).first();
        await button.waitFor({ state: 'visible', timeout: 2000 });
        await button.click();
        await this.page.waitForTimeout(3000);
        return true;
      } catch (e) {
        continue;
      }
    }
    
    return false;
  }

  /**
   * 🔢 Helper: Extract tweet ID from reply
   */
  private async extractReplyTweetId(): Promise<string | undefined> {
    try {
      // Wait for navigation or URL change
      await this.page.waitForTimeout(2000);
      
      // Try to extract from URL
      const url = this.page.url();
      const match = url.match(/status\/(\d+)/);
      if (match) {
        return match[1];
      }
      
      // Try to find in DOM
      const statusLink = this.page.locator('a[href*="/status/"]').first();
      const href = await statusLink.getAttribute('href');
      if (href) {
        const linkMatch = href.match(/status\/(\d+)/);
        if (linkMatch) {
          return linkMatch[1];
        }
      }
      
      return undefined;
      
    } catch (error) {
      return undefined;
    }
  }

  /**
   * 📊 METRICS & AUTO-HEALING
   */
  
  private initializeMetrics() {
    if (ResilientReplyPoster.strategyMetrics.size === 0) {
      const strategies = [
        'visual_position',
        'keyboard_shortcut',
        'icon_detection',
        'mobile_interface',
        'legacy_selectors'
      ];
      
      strategies.forEach(name => {
        ResilientReplyPoster.strategyMetrics.set(name, {
          name,
          attempts: 0,
          successes: 0,
          failures: 0,
          avgResponseTime: 0,
          enabled: true
        });
      });
    }
  }

  private async recordSuccess(strategyName: string, responseTime: number) {
    const metrics = ResilientReplyPoster.strategyMetrics.get(strategyName);
    if (metrics) {
      metrics.attempts++;
      metrics.successes++;
      metrics.lastSuccess = new Date();
      metrics.avgResponseTime = (metrics.avgResponseTime * (metrics.attempts - 1) + responseTime) / metrics.attempts;
      metrics.enabled = true; // Re-enable if it was disabled
      
      ResilientReplyPoster.strategyMetrics.set(strategyName, metrics);
      
      // Store in database
      await this.storeMetrics(strategyName, true, responseTime);
    }
  }

  private async recordFailure(strategyName: string, error: string) {
    const metrics = ResilientReplyPoster.strategyMetrics.get(strategyName);
    if (metrics) {
      metrics.attempts++;
      metrics.failures++;
      
      // Auto-disable if failure rate > 80%
      const failureRate = metrics.failures / metrics.attempts;
      if (failureRate > 0.8 && metrics.attempts > 5) {
        metrics.enabled = false;
        console.log(`⚠️ AUTO_DISABLED: ${strategyName} (failure rate: ${(failureRate * 100).toFixed(0)}%)`);
      }
      
      ResilientReplyPoster.strategyMetrics.set(strategyName, metrics);
      
      // Store in database
      await this.storeMetrics(strategyName, false, 0, error);
    }
  }

  private getSuccessRate(strategyName: string): number {
    const metrics = ResilientReplyPoster.strategyMetrics.get(strategyName);
    if (!metrics || metrics.attempts === 0) return 0;
    return Math.round((metrics.successes / metrics.attempts) * 100);
  }

  private getOrderedStrategies(): StrategyMetrics[] {
    const strategies = Array.from(ResilientReplyPoster.strategyMetrics.values());
    
    // Sort by:
    // 1. Enabled status
    // 2. Success rate
    // 3. Recent success
    // 4. Response time (faster is better)
    return strategies.sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      
      const aRate = a.attempts > 0 ? a.successes / a.attempts : 0;
      const bRate = b.attempts > 0 ? b.successes / b.attempts : 0;
      
      if (Math.abs(aRate - bRate) > 0.1) return bRate - aRate;
      
      if (a.lastSuccess && b.lastSuccess) {
        return b.lastSuccess.getTime() - a.lastSuccess.getTime();
      }
      
      return a.avgResponseTime - b.avgResponseTime;
    });
  }

  private getHealthSummary(): string {
    const strategies = Array.from(ResilientReplyPoster.strategyMetrics.values());
    const enabled = strategies.filter(s => s.enabled).length;
    const avgSuccessRate = strategies.reduce((sum, s) => {
      const rate = s.attempts > 0 ? s.successes / s.attempts : 0;
      return sum + rate;
    }, 0) / strategies.length;
    
    return `${enabled}/${strategies.length} enabled, ${(avgSuccessRate * 100).toFixed(0)}% avg success`;
  }

  private async storeMetrics(strategyName: string, success: boolean, responseTime: number, error?: string) {
    try {
      const supabase = getSupabaseClient();
      await supabase.from('reply_strategy_metrics').insert([{
        strategy_name: strategyName,
        success,
        response_time_ms: responseTime,
        error_message: error,
        timestamp: new Date().toISOString()
      }]);
    } catch (e) {
      // Don't fail reply posting if metrics storage fails
      console.log(`⚠️ METRICS: Failed to store - ${(e as Error).message}`);
    }
  }

  /**
   * 🔬 DIAGNOSTICS
   */
  
  private async captureComprehensiveDiagnostics(tweetId: string) {
    try {
      const diagnostics = {
        timestamp: new Date().toISOString(),
        tweetId,
        pageUrl: this.page.url(),
        screenshots: [] as string[],
        domStructure: null as any,
        clickableElements: [] as any[],
        strategyHealth: this.getHealthSummary()
      };
      
      // Screenshot
      try {
        const screenshotPath = `./diagnostics/failure_${Date.now()}.png`;
        await this.page.screenshot({ path: screenshotPath, fullPage: true });
        diagnostics.screenshots.push(screenshotPath);
      } catch (e) {}
      
      // Capture clickable elements
      diagnostics.clickableElements = await this.page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('button, [role="button"], [tabindex="0"]'));
        return elements.slice(0, 50).map((el, idx) => ({
          index: idx,
          tagName: el.tagName,
          className: el.className,
          ariaLabel: el.getAttribute('aria-label'),
          dataTestId: el.getAttribute('data-testid'),
          text: el.textContent?.substring(0, 50),
          visible: (el as HTMLElement).offsetParent !== null
        }));
      });
      
      // Store in database
      const supabase = getSupabaseClient();
      await supabase.from('reply_diagnostics').insert([{
        failure_type: 'all_strategies_failed',
        context: tweetId,
        timestamp: diagnostics.timestamp,
        dom_structure: diagnostics.clickableElements,
        page_url: diagnostics.pageUrl
      }]);
      
      return diagnostics;
      
    } catch (error: any) {
      console.log(`❌ DIAGNOSTICS: Failed - ${error.message}`);
      return null;
    }
  }
}

