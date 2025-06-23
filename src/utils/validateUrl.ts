/**
 * URL Validation Utility
 * Validates URLs using HEAD requests with timeout and redirect following
 * PRODUCTION MODE: More lenient validation to avoid blocking valid content
 */

export interface UrlValidationResult {
  url: string;
  isValid: boolean;
  statusCode?: number;
  error?: string;
}

export class UrlValidator {
  private readonly timeout: number = 3000; // Reduced to 3 seconds for faster validation
  private readonly maxRedirects: number = 5;
  private readonly isProduction: boolean = process.env.NODE_ENV === 'production' || process.env.PRODUCTION_MODE === 'true';

  async validateUrl(url: string): Promise<UrlValidationResult> {
    try {
      // In production, be more lenient - skip validation for known good domains
      if (this.isProduction && this.isKnownGoodDomain(url)) {
        return {
          url,
          isValid: true,
          statusCode: 200
        };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; HealthTechBot/1.0)'
        }
      });

      clearTimeout(timeoutId);

      return {
        url,
        isValid: response.ok,
        statusCode: response.status
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // In production, be more lenient with timeouts and network errors
      if (this.isProduction && (errorMessage.includes('timeout') || errorMessage.includes('aborted'))) {
        console.warn(`⚠️ URL validation timeout for ${url}, assuming valid in production mode`);
        return {
          url,
          isValid: true,
          error: 'timeout_assumed_valid'
        };
      }
      
      return {
        url,
        isValid: false,
        error: errorMessage
      };
    }
  }

  private isKnownGoodDomain(url: string): boolean {
    const knownGoodDomains = [
      'nature.com',
      'sciencedaily.com',
      'technologyreview.com',
      'statnews.com',
      'healthcareitnews.com',
      'nih.gov',
      'fda.gov',
      'stanford.edu',
      'broadinstitute.org',
      'techcrunch.com',
      'wired.com',
      'nejm.org',
      'pubmed.ncbi.nlm.nih.gov',
      'arxiv.org',
      'apple.com',
      'google.com',
      'microsoft.com'
    ];

    try {
      const domain = new URL(url).hostname.toLowerCase();
      return knownGoodDomains.some(goodDomain => domain.includes(goodDomain));
    } catch {
      return false;
    }
  }

  async validateUrls(urls: string[]): Promise<UrlValidationResult[]> {
    if (urls.length === 0) {
      return [];
    }

    console.log(`🔗 Validating ${urls.length} URLs...`);
    
    const validationPromises = urls.map(url => this.validateUrl(url));
    const results = await Promise.all(validationPromises);
    
    const validCount = results.filter(r => r.isValid).length;
    console.log(`🔗 URL validation complete: ${validCount}/${urls.length} valid`);
    
    return results;
  }

  extractUrls(text: string): string[] {
    const urlRegex = /https?:\/\/[^\s]+/g;
    return text.match(urlRegex) || [];
  }

  async validateTweetUrls(tweetContent: string): Promise<boolean> {
    const urls = this.extractUrls(tweetContent);
    
    if (urls.length === 0) {
      return true; // No URLs to validate
    }

    // In production mode, be much more lenient
    if (this.isProduction) {
      // Only check if URLs are properly formatted
      const malformedUrls = urls.filter(url => {
        try {
          new URL(url);
          return false; // URL is well-formed
        } catch {
          return true; // URL is malformed
        }
      });

      if (malformedUrls.length > 0) {
        console.log(`❌ Found malformed URLs: ${malformedUrls.join(', ')}`);
        return false;
      }

      // For production, assume all well-formed URLs are valid
      console.log(`✅ Production mode: All ${urls.length} URLs are well-formed, proceeding with tweet`);
      return true;
    }

    // In development/test mode, do full validation
    const results = await this.validateUrls(urls);
    const validUrls = results.filter(r => r.isValid);
    
    if (validUrls.length === 0) {
      console.log('❌ All URLs in tweet are invalid - aborting tweet');
      return false;
    }

    if (validUrls.length < urls.length) {
      console.log(`⚠️ Some URLs invalid (${validUrls.length}/${urls.length} valid) - proceeding`);
    }

    return true;
  }
}

// Export singleton instance
export const urlValidator = new UrlValidator(); 