/**
 * 🪶 LIGHTWEIGHT RAILWAY-OPTIMIZED POSTER
 * Uses minimal resources to work within Railway's constraints
 */

import { Page } from 'playwright';

interface LightweightPostResult {
  success: boolean;
  tweetId?: string;
  error?: string;
  resourcesUsed: {
    memoryMB: number;
    durationMs: number;
  };
}

export class LightweightPoster {
  private static instance: LightweightPoster;
  private isPosting = false;
  private postQueue: string[] = [];
  private maxConcurrentPosts = 1; // CRITICAL: Only 1 at a time
  
  static getInstance(): LightweightPoster {
    if (!LightweightPoster.instance) {
      LightweightPoster.instance = new LightweightPoster();
    }
    return LightweightPoster.instance;
  }

  /**
   * 🚀 MAIN POSTING METHOD - Railway Optimized
   */
  async postContent(content: string): Promise<LightweightPostResult> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;

    console.log('🪶 LIGHTWEIGHT_POSTER: Starting optimized post...');
    
    // Queue system prevents resource exhaustion
    if (this.isPosting) {
      console.log('⏳ QUEUE: Adding to post queue (preventing resource overload)');
      this.postQueue.push(content);
      return new Promise<LightweightPostResult>((resolve) => {
        // Will be processed when current post completes
        setTimeout(async () => {
          const result = await this.postContent(content);
          resolve(result);
        }, 1000);
      });
    }

    this.isPosting = true;

    try {
      // Method 1: Try session-based HTTP posting (no browser needed)
      const httpResult = await this.tryHttpPosting(content);
      if (httpResult.success) {
        console.log('✅ HTTP_POST: Success without browser!');
        return this.createResult(httpResult, startTime, startMemory);
      }

      // Method 2: Minimal browser (only if HTTP fails)
      console.log('🌐 FALLBACK: Using minimal browser...');
      const browserResult = await this.tryMinimalBrowser(content);
      return this.createResult(browserResult, startTime, startMemory);

    } finally {
      this.isPosting = false;
      await this.processQueue(); // Process next in queue
    }
  }

  /**
   * 🚀 METHOD 1: HTTP-Only Posting (No Browser)
   * Uses existing session cookies with direct API calls
   */
  private async tryHttpPosting(content: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
    try {
      console.log('🔗 HTTP_POST: Attempting cookie-based posting...');
      
      // Load stored session cookies
      const sessionData = this.loadSessionCookies();
      if (!sessionData) {
        return { success: false, error: 'No session cookies available' };
      }

      // Extract required tokens
      const authToken = sessionData.cookies.find((c: any) => c.name === 'auth_token')?.value;
      const csrfToken = sessionData.cookies.find((c: any) => c.name === 'ct0')?.value;
      
      if (!authToken || !csrfToken) {
        return { success: false, error: 'Missing required tokens' };
      }

      // Build cookie string
      const cookieString = sessionData.cookies
        .map((c: any) => `${c.name}=${c.value}`)
        .join('; ');

      // Twitter's GraphQL endpoint for posting
      const response = await fetch('https://twitter.com/i/api/graphql/VzE2lcVcgN2hjfZ99C794A/CreateTweet', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
          'content-type': 'application/json',
          'cookie': cookieString,
          'x-csrf-token': csrfToken,
          'x-twitter-auth-type': 'OAuth2Session',
          'x-twitter-active-user': 'yes',
          'x-twitter-client-language': 'en'
        },
        body: JSON.stringify({
          variables: {
            tweet_text: content,
            dark_request: false,
            media: {
              media_entities: [],
              possibly_sensitive: false
            },
            semantic_annotation_ids: []
          },
          features: {
            tweetypie_unmention_optimization_enabled: true,
            responsive_web_edit_tweet_api_enabled: true,
            graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
            view_counts_everywhere_api_enabled: true,
            longform_notetweets_consumption_enabled: true,
            responsive_web_twitter_article_tweet_consumption_enabled: false,
            tweet_awards_web_tipping_enabled: false,
            longform_notetweets_rich_text_read_enabled: true,
            longform_notetweets_inline_media_enabled: true,
            responsive_web_graphql_exclude_directive_enabled: true,
            verified_phone_label_enabled: false,
            freedom_of_speech_not_reach_fetch_enabled: true,
            standardized_nudges_misinfo: true,
            tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
            responsive_web_media_download_video_enabled: false,
            responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
            responsive_web_graphql_timeline_navigation_enabled: true,
            responsive_web_enhance_cards_enabled: false
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.errors) {
        throw new Error(`Twitter API error: ${data.errors[0].message}`);
      }

      const tweetId = data.data?.create_tweet?.tweet_results?.result?.rest_id;
      
      if (tweetId) {
        console.log(`✅ HTTP_SUCCESS: Tweet posted with ID ${tweetId}`);
        return { success: true, tweetId };
      } else {
        throw new Error('No tweet ID in response');
      }

    } catch (error: any) {
      console.log(`❌ HTTP_POST_FAILED: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 🌐 METHOD 2: Minimal Browser (Fallback)
   * Ultra-lightweight browser configuration
   */
  private async tryMinimalBrowser(content: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
    const { chromium } = require('playwright');
    let browser = null;
    let context = null;

    try {
      console.log('🚀 MINIMAL_BROWSER: Launching ultra-light browser...');
      
      // Ultra-minimal browser configuration
      browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process',                    // CRITICAL: Single process
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
          '--memory-pressure-off',
          '--max_old_space_size=256',            // Limit to 256MB
          '--disable-extensions',
          '--disable-plugins',
          '--disable-images',                    // Don't load images
          '--disable-javascript',                // Minimal JS only
        ]
      });

      // Load session
      const sessionData = this.loadSessionCookies();
      context = await browser.newContext({
        storageState: sessionData
      });

      const page = await context.newPage();
      
      // Quick navigation and posting
      await page.goto('https://twitter.com/compose/tweet', { 
        waitUntil: 'domcontentloaded',  // Don't wait for everything
        timeout: 10000 
      });

      // Fast posting without waiting for animations
      await page.fill('[data-testid="tweetTextarea_0"]', content);
      await page.click('[data-testid="tweetButtonInline"]');
      
      // Wait for success indicator
      await page.waitForSelector('[data-testid="toast"]', { timeout: 5000 });
      
      console.log('✅ MINIMAL_BROWSER: Post successful');
      return { success: true };

    } catch (error: any) {
      console.log(`❌ MINIMAL_BROWSER_FAILED: ${error.message}`);
      return { success: false, error: error.message };
    } finally {
      // CRITICAL: Always cleanup to prevent memory leaks
      try {
        if (context) await context.close();
        if (browser) await browser.close();
      } catch (cleanupError) {
        console.warn('⚠️ Cleanup error:', cleanupError);
      }
    }
  }

  /**
   * 📂 Load Session Cookies
   */
  private loadSessionCookies(): any {
    try {
      const sessionB64 = process.env.TWITTER_SESSION_B64;
      if (sessionB64) {
        return JSON.parse(Buffer.from(sessionB64, 'base64').toString('utf8'));
      }
      return null;
    } catch (error) {
      console.warn('⚠️ Session loading error:', error);
      return null;
    }
  }

  /**
   * ⏳ Process Post Queue (Prevents Resource Overload)
   */
  private async processQueue(): Promise<LightweightPostResult | void> {
    if (this.postQueue.length === 0 || this.isPosting) return;
    
    const nextContent = this.postQueue.shift();
    if (nextContent) {
      return await this.postContent(nextContent);
    }
  }

  /**
   * 📊 Create Result with Resource Tracking
   */
  private createResult(
    result: { success: boolean; tweetId?: string; error?: string },
    startTime: number,
    startMemory: number
  ): LightweightPostResult {
    const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    
    return {
      ...result,
      resourcesUsed: {
        memoryMB: Math.round(endMemory - startMemory),
        durationMs: Date.now() - startTime
      }
    };
  }
}
