/**
 * URL Validation Utility
 * Validates URLs using HEAD requests with timeout and redirect following
 */

export interface UrlValidationResult {
  url: string;
  isValid: boolean;
  statusCode?: number;
  error?: string;
}

export class UrlValidator {
  private readonly timeout: number = 6000; // 6 seconds
  private readonly maxRedirects: number = 5;

  async validateUrl(url: string): Promise<UrlValidationResult> {
    try {
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
      
      return {
        url,
        isValid: false,
        error: errorMessage
      };
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