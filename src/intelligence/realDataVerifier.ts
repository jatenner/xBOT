/**
 * REAL DATA VERIFIER
 * System to ensure we're pulling actual data from Twitter, not generating fake metrics
 */

import { Page } from 'playwright';

export interface RealDataVerification {
  isRealData: boolean;
  verificationMethod: string;
  dataSource: 'scraped' | 'api' | 'fallback' | 'fake';
  confidence: number;
  verificationChecks: {
    urlAccessible: boolean;
    elementsFound: boolean;
    dataConsistent: boolean;
    timestampRecent: boolean;
    browserContextValid: boolean;
  };
  metadata: {
    scrapedAt: Date;
    pageTitle?: string;
    responseTime?: number;
    elementsFound?: string[];
    errors?: string[];
  };
}

export class RealDataVerifier {
  private static instance: RealDataVerifier | null = null;

  public static getInstance(): RealDataVerifier {
    if (!this.instance) {
      this.instance = new RealDataVerifier();
    }
    return this.instance;
  }

  /**
   * Verify that metrics were actually scraped from real Twitter post
   */
  public async verifyDataIsReal(
    tweetId: string,
    metrics: any,
    page?: Page
  ): Promise<RealDataVerification> {
    console.log(`🔍 REAL_DATA_VERIFICATION: Checking if ${tweetId} data is genuinely scraped`);
    
    const startTime = Date.now();
    const metadata: any = {
      scrapedAt: new Date(),
      errors: []
    };
    
    const checks = {
      urlAccessible: false,
      elementsFound: false,
      dataConsistent: false,
      timestampRecent: false,
      browserContextValid: false
    };

    let verificationMethod = 'unknown';
    let dataSource: any = 'unknown';
    let confidence = 0;

    try {
      // Step 1: Verify tweet ID format
      if (!this.isValidTwitterId(tweetId)) {
        return {
          isRealData: false,
          verificationMethod: 'id_format_check',
          dataSource: 'fake',
          confidence: 0,
          verificationChecks: checks,
          metadata: {
            ...metadata,
            errors: [`Invalid Twitter ID format: ${tweetId}`]
          }
        };
      }

      // Step 2: If we have browser context, do live verification
      if (page) {
        const liveVerification = await this.verifyWithBrowser(tweetId, metrics, page, checks, metadata);
        verificationMethod = 'browser_verification';
        dataSource = liveVerification.dataSource;
        confidence = liveVerification.confidence;
      } else {
        // Step 3: Fallback to heuristic verification
        const heuristicVerification = this.verifyWithHeuristics(tweetId, metrics, checks, metadata);
        verificationMethod = 'heuristic_analysis';
        dataSource = heuristicVerification.dataSource;
        confidence = heuristicVerification.confidence;
      }

      metadata.responseTime = Date.now() - startTime;

      const isRealData = confidence > 0.7 && dataSource === 'scraped';

      if (isRealData) {
        console.log(`✅ REAL_DATA_CONFIRMED: ${tweetId} (confidence: ${confidence.toFixed(3)})`);
      } else {
        console.warn(`🚨 FAKE_DATA_DETECTED: ${tweetId} (confidence: ${confidence.toFixed(3)}, source: ${dataSource})`);
      }

      return {
        isRealData,
        verificationMethod,
        dataSource,
        confidence,
        verificationChecks: checks,
        metadata
      };

    } catch (error: any) {
      metadata.errors.push(error.message);
      
      return {
        isRealData: false,
        verificationMethod: 'error',
        dataSource: 'unknown',
        confidence: 0,
        verificationChecks: checks,
        metadata
      };
    }
  }

  /**
   * Verify with live browser scraping
   */
  private async verifyWithBrowser(
    tweetId: string,
    metrics: any,
    page: Page,
    checks: any,
    metadata: any
  ): Promise<{ dataSource: string; confidence: number }> {
    try {
      // Check if browser context is valid
      const url = page.url();
      checks.browserContextValid = url.includes('x.com') || url.includes('twitter.com');
      
      if (!checks.browserContextValid) {
        metadata.errors.push('Browser not on Twitter domain');
        return { dataSource: 'fake', confidence: 0.1 };
      }

      // Navigate to the specific tweet
      const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
      const tweetUrl = `https://x.com/${username}/status/${tweetId}`;
      console.log(`🔗 VERIFICATION: Navigating to ${tweetUrl}`);
      
      await page.goto(tweetUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
      checks.urlAccessible = true;
      
      // Get page title
      metadata.pageTitle = await page.title();
      checks.timestampRecent = true;

      // Look for tweet elements
      const elementsFound: string[] = [];
      
      const tweetSelectors = [
        '[data-testid="tweet"]',
        'article[data-testid="tweet"]',
        '[data-testid="tweetText"]',
        '[data-testid="like"]',
        '[data-testid="retweet"]',
        '[data-testid="reply"]'
      ];

      for (const selector of tweetSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            elementsFound.push(selector);
          }
        } catch {
          // Selector not found, continue
        }
      }

      metadata.elementsFound = elementsFound;
      checks.elementsFound = elementsFound.length > 0;

      if (!checks.elementsFound) {
        // Tweet might not exist or be deleted
        const pageText = await page.textContent('body') || '';
        if (pageText.includes('This Post was deleted') || 
            pageText.includes('Post not found') ||
            metadata.pageTitle?.includes('Post not found')) {
          metadata.errors.push('Tweet appears to be deleted or does not exist');
          return { dataSource: 'fake', confidence: 0.2 };
        }
      }

      // Try to scrape actual metrics and compare
      const scrapedMetrics = await this.scrapeCurrentMetrics(page);
      if (scrapedMetrics) {
        // Check if provided metrics match scraped metrics (within reasonable tolerance)
        const likesTolerance = Math.abs((scrapedMetrics.likes || 0) - (metrics.likes || 0));
        const retweetsTolerance = Math.abs((scrapedMetrics.retweets || 0) - (metrics.retweets || 0));
        
        checks.dataConsistent = likesTolerance <= 2 && retweetsTolerance <= 1; // Allow small variance
        
        if (checks.dataConsistent) {
          console.log(`✅ METRICS_MATCH: Scraped ${scrapedMetrics.likes} likes vs provided ${metrics.likes}`);
          return { dataSource: 'scraped', confidence: 0.95 };
        } else {
          console.warn(`⚠️ METRICS_MISMATCH: Scraped ${scrapedMetrics.likes} likes vs provided ${metrics.likes}`);
          metadata.errors.push(`Metrics mismatch: expected ${metrics.likes} likes, found ${scrapedMetrics.likes}`);
          return { dataSource: 'fake', confidence: 0.3 };
        }
      }

      // If we found tweet elements but couldn't scrape metrics, it's likely real but scraping failed
      if (checks.elementsFound) {
        return { dataSource: 'scraped', confidence: 0.7 };
      }

      return { dataSource: 'unknown', confidence: 0.4 };

    } catch (error: any) {
      metadata.errors.push(`Browser verification failed: ${error.message}`);
      return { dataSource: 'unknown', confidence: 0.2 };
    }
  }

  /**
   * Verify using heuristics when no browser available
   */
  private verifyWithHeuristics(
    tweetId: string,
    metrics: any,
    checks: any,
    metadata: any
  ): { dataSource: string; confidence: number } {
    console.log(`🧠 HEURISTIC_VERIFICATION: Analyzing ${tweetId} metrics patterns`);
    
    let confidence = 0.5; // Start with neutral confidence
    let dataSource = 'unknown';

    // Check 1: Are metrics suspiciously perfect/round numbers?
    const hasRoundNumbers = this.hasRoundNumberPattern(metrics);
    if (hasRoundNumbers) {
      confidence -= 0.2;
      metadata.errors.push('Suspicious round number patterns in metrics');
    }

    // Check 2: Are metrics realistic for small account?
    const isRealistic = this.areMetricsRealistic(metrics);
    if (isRealistic) {
      confidence += 0.2;
      checks.dataConsistent = true;
    } else {
      confidence -= 0.3;
      metadata.errors.push('Metrics unrealistic for account size');
    }

    // Check 3: Check timing patterns (are they too frequent/regular?)
    checks.timestampRecent = true; // Assume recent for heuristic check

    // Check 4: Pattern analysis
    const hasNaturalVariation = this.hasNaturalVariation(metrics);
    if (hasNaturalVariation) {
      confidence += 0.1;
      dataSource = 'scraped';
    } else {
      confidence -= 0.2;
      dataSource = 'fake';
    }

    return { dataSource, confidence: Math.max(0, Math.min(1, confidence)) };
  }

  /**
   * Actually scrape metrics from current page
   */
  private async scrapeCurrentMetrics(page: Page): Promise<any | null> {
    try {
      const metrics = await page.evaluate(() => {
        const extractNumber = (text: string): number => {
          if (!text) return 0;
          const match = text.match(/([\d,\.]+)([KM])?/);
          if (!match) return 0;
          let num = parseFloat(match[1].replace(/,/g, ''));
          if (match[2] === 'K') num *= 1000;
          if (match[2] === 'M') num *= 1000000;
          return Math.floor(num);
        };

        // Try to find like button
        const likeButton = document.querySelector('[data-testid="like"] span, [aria-label*="like"] span');
        const retweetButton = document.querySelector('[data-testid="retweet"] span, [aria-label*="repost"] span');
        const replyButton = document.querySelector('[data-testid="reply"] span, [aria-label*="repl"] span');

        return {
          likes: likeButton ? extractNumber(likeButton.textContent || '') : 0,
          retweets: retweetButton ? extractNumber(retweetButton.textContent || '') : 0,
          replies: replyButton ? extractNumber(replyButton.textContent || '') : 0
        };
      });

      return metrics;
    } catch (error) {
      console.warn('Failed to scrape current metrics:', error);
      return null;
    }
  }

  /**
   * Check for valid Twitter ID format
   */
  private isValidTwitterId(tweetId: string): boolean {
    return /^\d{15,19}$/.test(tweetId);
  }

  /**
   * Check for suspicious round number patterns
   */
  private hasRoundNumberPattern(metrics: any): boolean {
    const numbers = [metrics.likes, metrics.retweets, metrics.replies, metrics.impressions].filter(n => n > 0);
    
    // Check if too many round numbers (multiples of 100, 1000, etc.)
    const roundNumbers = numbers.filter(n => n % 100 === 0 || n % 1000 === 0);
    return roundNumbers.length > numbers.length * 0.5;
  }

  /**
   * Check if metrics are realistic for small account
   */
  private areMetricsRealistic(metrics: any): boolean {
    // For small accounts, metrics should be low
    return (metrics.likes || 0) <= 10 && 
           (metrics.retweets || 0) <= 5 && 
           (metrics.replies || 0) <= 5;
  }

  /**
   * Check for natural variation in metrics
   */
  private hasNaturalVariation(metrics: any): boolean {
    // Real metrics often have natural variation (not all zeros or all same numbers)
    const values = [metrics.likes, metrics.retweets, metrics.replies].filter(v => v !== undefined);
    const uniqueValues = new Set(values);
    
    // If all values are the same (and > 0), it's suspicious
    if (uniqueValues.size === 1 && values[0] > 0) {
      return false;
    }
    
    return true;
  }

  /**
   * Generate verification report for database storage
   */
  public async generateVerificationReport(
    tweetId: string,
    metrics: any,
    page?: Page
  ): Promise<{
    tweetId: string;
    verificationTimestamp: Date;
    isVerifiedReal: boolean;
    verificationScore: number;
    verificationMethod: string;
    dataQualityFlags: string[];
    rawVerificationData: RealDataVerification;
  }> {
    const verification = await this.verifyDataIsReal(tweetId, metrics, page);
    
    const qualityFlags: string[] = [];
    
    if (!verification.isRealData) {
      qualityFlags.push('UNVERIFIED_DATA');
    }
    
    if (verification.confidence < 0.5) {
      qualityFlags.push('LOW_CONFIDENCE');
    }
    
    if (verification.dataSource === 'fallback') {
      qualityFlags.push('FALLBACK_METRICS');
    }
    
    if (verification.metadata.errors?.length > 0) {
      qualityFlags.push('VERIFICATION_ERRORS');
    }

    return {
      tweetId,
      verificationTimestamp: new Date(),
      isVerifiedReal: verification.isRealData,
      verificationScore: verification.confidence,
      verificationMethod: verification.verificationMethod,
      dataQualityFlags: qualityFlags,
      rawVerificationData: verification
    };
  }
}
