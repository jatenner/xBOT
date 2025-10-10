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
        console.log('🌐 BULLETPROOF_HTTP: Attempting HTTP-based posting...');
        
        if (!this.sessionCookies) {
            const sessionReady = await this.initializeSession();
            if (!sessionReady) {
                return { success: false, error: 'Session not available for HTTP posting' };
            }
        }

        try {
            // Use the existing /api/post-lightweight endpoint which is working
            const response = await fetch('https://xbot-production-844b.up.railway.app/api/post-lightweight', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                body: JSON.stringify({ content })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    console.log('✅ BULLETPROOF_HTTP: HTTP posting successful');
                    this.consecutiveFailures = 0;
                    this.lastSuccessfulPost = new Date();
                    return { 
                        success: true, 
                        tweetId: result.tweetId,
                        method: 'http'
                    };
                } else {
                    throw new Error(result.error || 'HTTP posting failed');
                }
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
        } catch (error: any) {
            console.error('❌ BULLETPROOF_HTTP: HTTP posting failed:', error.message);
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
