const { getSupabaseClient } = require('../db/index');

/**
 * 🚀 BULLETPROOF HTTP POSTER - NO BROWSER DEPENDENCY
 * 
 * This system prioritizes HTTP-based posting using session cookies
 * and only falls back to browser when absolutely necessary.
 * Designed to handle Railway resource constraints efficiently.
 */

class BulletproofHttpPoster {
    constructor() {
        this.sessionCookies = null;
        this.lastSuccessfulPost = null;
        this.consecutiveFailures = 0;
        this.maxRetries = 3;
    }

    async initializeSession() {
        console.log('🔧 BULLETPROOF_HTTP: Initializing session from environment...');
        
        try {
            const sessionB64 = process.env.TWITTER_SESSION_B64;
            if (!sessionB64) {
                throw new Error('TWITTER_SESSION_B64 not found in environment');
            }

            const sessionData = JSON.parse(Buffer.from(sessionB64, 'base64').toString());
            this.sessionCookies = this.formatCookiesForHttp(sessionData.cookies);
            
            console.log(`✅ BULLETPROOF_HTTP: Session loaded with ${this.sessionCookies.length} cookies`);
            return true;
            
        } catch (error) {
            console.error('❌ BULLETPROOF_HTTP: Session initialization failed:', error.message);
            return false;
        }
    }

    formatCookiesForHttp(cookies) {
        if (!Array.isArray(cookies)) return [];
        
        return cookies
            .filter(cookie => cookie.name && cookie.value)
            .map(cookie => `${cookie.name}=${cookie.value}`)
            .join('; ');
    }

    async postViaHttp(content) {
        console.log('🌐 BULLETPROOF_HTTP: Attempting HTTP-based posting...');
        
        if (!this.sessionCookies) {
            const sessionReady = await this.initializeSession();
            if (!sessionReady) {
                throw new Error('Session not available for HTTP posting');
            }
        }

        try {
            const response = await fetch('https://api.twitter.com/1.1/statuses/update.json', {
                method: 'POST',
                headers: {
                    'Cookie': this.sessionCookies,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': 'https://twitter.com/compose/tweet'
                },
                body: new URLSearchParams({
                    status: content,
                    tweet_mode: 'extended'
                })
            });

            if (response.ok) {
                const result = await response.json();
                console.log('✅ BULLETPROOF_HTTP: HTTP posting successful');
                this.consecutiveFailures = 0;
                this.lastSuccessfulPost = new Date();
                return { success: true, data: result };
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
        } catch (error) {
            console.error('❌ BULLETPROOF_HTTP: HTTP posting failed:', error.message);
            this.consecutiveFailures++;
            return { success: false, error: error.message };
        }
    }

    async postViaMinimalBrowser(content) {
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
                    '--disable-javascript', // Minimal JS for posting only
                    '--memory-pressure-off',
                    '--max_old_space_size=256'
                ]
            });

            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            });

            // Load session cookies
            if (this.sessionCookies) {
                const sessionData = JSON.parse(Buffer.from(process.env.TWITTER_SESSION_B64, 'base64').toString());
                await context.addCookies(sessionData.cookies);
            }

            const page = await context.newPage();
            
            // Navigate and post
            await page.goto('https://twitter.com/compose/tweet', { 
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
            
        } catch (error) {
            console.error('❌ BULLETPROOF_HTTP: Minimal browser failed:', error.message);
            this.consecutiveFailures++;
            return { success: false, error: error.message };
        }
    }

    async post(content) {
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
            httpError: httpResult.error
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
let bulletproofPoster = null;

async function getBulletproofPoster() {
    if (!bulletproofPoster) {
        bulletproofPoster = new BulletproofHttpPoster();
    }
    return bulletproofPoster;
}

async function bulletproofPost(content) {
    const poster = await getBulletproofPoster();
    return await poster.post(content);
}

async function getBulletproofStatus() {
    const poster = await getBulletproofPoster();
    return await poster.getStatus();
}

module.exports = {
    BulletproofHttpPoster,
    getBulletproofPoster,
    bulletproofPost,
    getBulletproofStatus
};
