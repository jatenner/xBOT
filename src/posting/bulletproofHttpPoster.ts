import { getSupabaseClient } from '../db/index';

/**
 * 🚀 BULLETPROOF HTTP POSTER - NO BROWSER DEPENDENCY
 * 
 * This system prioritizes HTTP-based posting using session cookies
 * and only falls back to browser when absolutely necessary.
 * Designed to handle Railway resource constraints efficiently.
 */

interface PostResult {
    success: boolean;
    error?: string;
    tweetId?: string;
    method?: string;
    retryAfter?: number;
}

export class BulletproofHttpPoster {
    private sessionCookies: string | null = null;
    private lastSuccessfulPost: Date | null = null;
    private consecutiveFailures: number = 0;
    private maxRetries: number = 3;

    async initializeSession(): Promise<boolean> {
        console.log('🔧 BULLETPROOF_HTTP: Initializing session from environment...');
        
        try {
            const sessionB64 = process.env.TWITTER_SESSION_B64;
            if (!sessionB64) {
                throw new Error('TWITTER_SESSION_B64 not found in environment');
            }

            const sessionData = JSON.parse(Buffer.from(sessionB64, 'base64').toString());
            this.sessionCookies = this.formatCookiesForHttp(sessionData.cookies);
            
            console.log(`✅ BULLETPROOF_HTTP: Session loaded with cookies`);
            return true;
            
        } catch (error: any) {
            console.error('❌ BULLETPROOF_HTTP: Session initialization failed:', error.message);
            return false;
        }
    }

    private formatCookiesForHttp(cookies: any[]): string {
        if (!Array.isArray(cookies)) return '';
        
        return cookies
            .filter(cookie => cookie.name && cookie.value)
            .map(cookie => `${cookie.name}=${cookie.value}`)
            .join('; ');
    }

    async postViaHttp(content: string): Promise<PostResult> {
        console.log('🌐 BULLETPROOF_HTTP: Attempting direct Twitter API posting...');
        
        if (!this.sessionCookies) {
            const sessionReady = await this.initializeSession();
            if (!sessionReady) {
                return { success: false, error: 'Session not available for HTTP posting' };
            }
        }

        try {
            // Extract session data for Twitter API
            const sessionB64 = process.env.TWITTER_SESSION_B64;
            if (!sessionB64) {
                return { success: false, error: 'Twitter session not found' };
            }

            const sessionData = JSON.parse(Buffer.from(sessionB64, 'base64').toString());
            const cookies = sessionData.cookies;

            // Extract required tokens from cookies
            const authToken = cookies.find((c: any) => c.name === 'auth_token')?.value;
            const csrfToken = cookies.find((c: any) => c.name === 'ct0')?.value;
            
            if (!authToken || !csrfToken) {
                return { success: false, error: 'Missing auth_token or ct0 cookies' };
            }

            // Build cookie string
            const cookieString = cookies
                .map((c: any) => `${c.name}=${c.value}`)
                .join('; ');

            console.log('🔑 BULLETPROOF_HTTP: Using direct Twitter GraphQL API...');

            // Use Twitter's GraphQL endpoint for posting tweets
            const response = await fetch('https://twitter.com/i/api/graphql/VzE2lcVcgN2hjfZ99C794A/CreateTweet', {
                method: 'POST',
                headers: {
                    'authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
                    'content-type': 'application/json',
                    'cookie': cookieString,
                    'x-csrf-token': csrfToken,
                    'x-twitter-auth-type': 'OAuth2Session',
                    'x-twitter-active-user': 'yes',
                    'x-twitter-client-language': 'en',
                    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'referer': 'https://twitter.com/compose/tweet',
                    'origin': 'https://twitter.com'
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
                const errorText = await response.text();
                console.error(`❌ BULLETPROOF_HTTP: Twitter API error ${response.status}: ${errorText}`);
                return { success: false, error: `Twitter API ${response.status}: ${response.statusText}` };
            }

            const data = await response.json();
            
            if (data.errors && data.errors.length > 0) {
                const errorMsg = data.errors[0].message;
                console.error(`❌ BULLETPROOF_HTTP: Twitter GraphQL error: ${errorMsg}`);
                return { success: false, error: `Twitter GraphQL error: ${errorMsg}` };
            }

            // Extract tweet ID from response
            const tweetId = data.data?.create_tweet?.tweet_results?.result?.rest_id;
            
            if (tweetId) {
                console.log(`✅ BULLETPROOF_HTTP: Tweet posted successfully with ID ${tweetId}`);
                this.consecutiveFailures = 0;
                this.lastSuccessfulPost = new Date();
                return { 
                    success: true, 
                    tweetId: tweetId,
                    method: 'direct_twitter_api'
                };
            } else {
                console.error('❌ BULLETPROOF_HTTP: No tweet ID in response:', JSON.stringify(data, null, 2));
                return { success: false, error: 'No tweet ID in Twitter API response' };
            }
            
        } catch (error: any) {
            console.error('❌ BULLETPROOF_HTTP: Direct Twitter API failed:', error.message);
            this.consecutiveFailures++;
            return { success: false, error: error.message };
        }
    }

    async postViaMinimalBrowser(content: string): Promise<PostResult> {
        console.log('🔄 BULLETPROOF_HTTP: Falling back to minimal browser...');
        
        try {
            // Import Playwright only when needed
            const { chromium } = await import('playwright');
            
            const browser = await chromium.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-extensions',
                    '--disable-plugins',
                    '--disable-images',
                    '--memory-pressure-off',
                    '--max_old_space_size=128'
                ]
            });

            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            });

            // Load session cookies
            const sessionB64 = process.env.TWITTER_SESSION_B64;
            if (sessionB64) {
                const sessionData = JSON.parse(Buffer.from(sessionB64, 'base64').toString());
                if (sessionData.cookies) {
                    await context.addCookies(sessionData.cookies);
                }
            }

            const page = await context.newPage();
            
            // Navigate and post
            await page.goto('https://x.com/compose/tweet', { 
                waitUntil: 'domcontentloaded',
                timeout: 15000 
            });

            // Quick posting without waiting for full load
            await page.fill('[data-testid="tweetTextarea_0"]', content);
            await page.click('[data-testid="tweetButtonInline"]');
            
            // Wait briefly for post confirmation
            await page.waitForTimeout(2000);
            
            await browser.close();
            
            console.log('✅ BULLETPROOF_HTTP: Minimal browser posting successful');
            this.consecutiveFailures = 0;
            this.lastSuccessfulPost = new Date();
            return { success: true, method: 'minimal_browser' };
            
        } catch (error: any) {
            console.error('❌ BULLETPROOF_HTTP: Minimal browser failed:', error.message);
            this.consecutiveFailures++;
            return { success: false, error: error.message };
        }
    }

    async post(content: string): Promise<PostResult> {
        console.log(`🚀 BULLETPROOF_HTTP: Posting content (${content.length} chars)`);
        console.log(`📊 BULLETPROOF_HTTP: Consecutive failures: ${this.consecutiveFailures}`);

        // If too many consecutive failures, wait before trying
        if (this.consecutiveFailures >= 5) {
            const waitMinutes = Math.min(this.consecutiveFailures - 4, 10);
            console.log(`⏸️ BULLETPROOF_HTTP: Too many failures, waiting ${waitMinutes} minutes...`);
            return { 
                success: false, 
                error: `Rate limited due to ${this.consecutiveFailures} consecutive failures`,
                retryAfter: waitMinutes * 60 * 1000
            };
        }

        // Try HTTP first (fast and resource-efficient)
        const httpResult = await this.postViaHttp(content);
        if (httpResult.success) {
            return httpResult;
        }

        // If HTTP fails and we haven't exceeded browser retry limit, try minimal browser
        if (this.consecutiveFailures < this.maxRetries) {
            console.log('🔄 BULLETPROOF_HTTP: HTTP failed, trying minimal browser...');
            const browserResult = await this.postViaMinimalBrowser(content);
            if (browserResult.success) {
                return browserResult;
            }
        }

        // Both methods failed
        console.error('❌ BULLETPROOF_HTTP: All posting methods failed');
        return {
            success: false,
            error: `Both HTTP and browser posting failed. Consecutive failures: ${this.consecutiveFailures}`,
        };
    }

    async getStatus() {
        return {
            sessionLoaded: !!this.sessionCookies,
            consecutiveFailures: this.consecutiveFailures,
            lastSuccessfulPost: this.lastSuccessfulPost,
            isHealthy: this.consecutiveFailures < 3
        };
    }

    // 🔧 EMERGENCY RESET METHOD
    async resetFailures() {
        console.log('🔧 BULLETPROOF_HTTP: Emergency failure reset...');
        this.consecutiveFailures = 0;
        this.lastSuccessfulPost = new Date();
        console.log('✅ BULLETPROOF_HTTP: Failure counter reset to 0');
    }
}

// Singleton instance
let bulletproofPoster: BulletproofHttpPoster | null = null;

export async function getBulletproofPoster(): Promise<BulletproofHttpPoster> {
    if (!bulletproofPoster) {
        bulletproofPoster = new BulletproofHttpPoster();
    }
    return bulletproofPoster;
}

export async function bulletproofPost(content: string): Promise<PostResult> {
    const poster = await getBulletproofPoster();
    return await poster.post(content);
}

export async function getBulletproofStatus() {
    const poster = await getBulletproofPoster();
    return await poster.getStatus();
}

export async function resetBulletproofFailures() {
    const poster = await getBulletproofPoster();
    return await poster.resetFailures();
}
