/**
 * 🎭 PLAYWRIGHT-ONLY POSTER - NO TWITTER API
 * 
 * This system ONLY uses Playwright browser automation
 * No Twitter API attempts, no HTTP posting, just pure browser posting
 */

import { getConfig } from '../config/config';

interface PlaywrightPostResult {
    success: boolean;
    tweetId?: string;
    error?: string;
    method: 'playwright_browser';
    duration: number;
}

export class PlaywrightOnlyPoster {
    private static instance: PlaywrightOnlyPoster;
    
    static getInstance(): PlaywrightOnlyPoster {
        if (!PlaywrightOnlyPoster.instance) {
            PlaywrightOnlyPoster.instance = new PlaywrightOnlyPoster();
        }
        return PlaywrightOnlyPoster.instance;
    }

    /**
     * 🎭 PLAYWRIGHT-ONLY POSTING
     * Uses only browser automation, no API calls
     */
    async postWithPlaywright(content: string): Promise<PlaywrightPostResult> {
        const startTime = Date.now();
        console.log('🎭 PLAYWRIGHT_ONLY: Starting browser-only posting...');
        console.log(`🎭 PLAYWRIGHT_ONLY: Content: "${content.substring(0, 50)}..."`);
        
        const { chromium } = await import('playwright');
        let browser: any = null;
        
        try {
            // Launch browser with minimal resource usage
            console.log('🚀 PLAYWRIGHT_ONLY: Launching browser...');
            browser = await chromium.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--single-process',
                    '--memory-pressure-off',
                    '--max_old_space_size=128',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor'
                ]
            });

            // Create context with realistic user agent
            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                viewport: { width: 1280, height: 720 }
            });

            // Load Twitter session cookies (fix cookie format issues)
            const sessionB64 = process.env.TWITTER_SESSION_B64;
            if (sessionB64) {
                try {
                    console.log('🍪 PLAYWRIGHT_ONLY: Loading Twitter session...');
                    const sessionData = JSON.parse(Buffer.from(sessionB64, 'base64').toString());
                    
                    if (sessionData.cookies && Array.isArray(sessionData.cookies)) {
                        // Fix cookie format issues
                        const validCookies = sessionData.cookies
                            .filter((cookie: any) => cookie.name && cookie.value)
                            .map((cookie: any) => ({
                                name: cookie.name,
                                value: cookie.value,
                                domain: cookie.domain || '.x.com',
                                path: cookie.path || '/',
                                // Fix expires issue - use proper format or remove
                                ...(cookie.expires && cookie.expires !== -1 ? 
                                    { expires: Math.floor(cookie.expires) } : 
                                    { expires: Math.floor(Date.now() / 1000) + 86400 * 30 } // 30 days from now
                                ),
                                httpOnly: cookie.httpOnly || false,
                                secure: cookie.secure !== false, // Default to true
                                sameSite: cookie.sameSite || 'Lax'
                            }));
                        
                        console.log(`🍪 PLAYWRIGHT_ONLY: Adding ${validCookies.length} cookies...`);
                        await context.addCookies(validCookies);
                        console.log('✅ PLAYWRIGHT_ONLY: Session cookies loaded successfully');
                    }
                } catch (error: any) {
                    console.warn('⚠️ PLAYWRIGHT_ONLY: Session loading failed:', error.message);
                    console.log('🔄 PLAYWRIGHT_ONLY: Continuing without session (may need to login)');
                }
            }

            // Navigate to Twitter compose page
            const page = await context.newPage();
            console.log('🌐 PLAYWRIGHT_ONLY: Navigating to Twitter...');
            
            await page.goto('https://x.com/compose/tweet', { 
                waitUntil: 'domcontentloaded',
                timeout: 30000 
            });

            // Wait for page to load
            await page.waitForTimeout(3000);

            // Check if we're logged in
            const isLoggedIn = await page.locator('[data-testid="tweetTextarea_0"]').isVisible().catch(() => false);
            
            if (!isLoggedIn) {
                console.error('❌ PLAYWRIGHT_ONLY: Not logged in to Twitter');
                return {
                    success: false,
                    error: 'Not logged in to Twitter - session may have expired',
                    method: 'playwright_browser',
                    duration: Date.now() - startTime
                };
            }

            console.log('✅ PLAYWRIGHT_ONLY: Successfully logged in');

            // Fill in the tweet content
            console.log('📝 PLAYWRIGHT_ONLY: Filling tweet content...');
            await page.fill('[data-testid="tweetTextarea_0"]', content);
            
            // Wait a moment for the UI to update
            await page.waitForTimeout(1000);

            // Click the tweet button
            console.log('🚀 PLAYWRIGHT_ONLY: Clicking Tweet button...');
            await page.click('[data-testid="tweetButtonInline"]');
            
            // Wait for the tweet to be posted
            console.log('⏳ PLAYWRIGHT_ONLY: Waiting for tweet to post...');
            await page.waitForTimeout(5000);

            // Check for success indicators
            const wasPosted = await page.locator('[data-testid="toast"]').isVisible().catch(() => false) ||
                             await page.url().includes('/status/') ||
                             !await page.locator('[data-testid="tweetTextarea_0"]').isVisible().catch(() => true);

            if (wasPosted) {
                const tweetId = `playwright_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const duration = Date.now() - startTime;
                
                console.log(`✅ PLAYWRIGHT_ONLY: Tweet posted successfully in ${duration}ms`);
                console.log(`🎯 PLAYWRIGHT_ONLY: Tweet ID: ${tweetId}`);
                
                return {
                    success: true,
                    tweetId: tweetId,
                    method: 'playwright_browser',
                    duration: duration
                };
            } else {
                console.error('❌ PLAYWRIGHT_ONLY: Tweet posting failed - no success indicators');
                return {
                    success: false,
                    error: 'Tweet posting failed - no success indicators detected',
                    method: 'playwright_browser',
                    duration: Date.now() - startTime
                };
            }
            
        } catch (error: any) {
            const duration = Date.now() - startTime;
            console.error(`❌ PLAYWRIGHT_ONLY: Browser posting failed: ${error.message}`);
            
            return {
                success: false,
                error: `Browser posting failed: ${error.message}`,
                method: 'playwright_browser',
                duration: duration
            };
            
        } finally {
            if (browser) {
                console.log('🔄 PLAYWRIGHT_ONLY: Closing browser...');
                await browser.close();
            }
        }
    }
}

export const playwrightOnlyPoster = PlaywrightOnlyPoster.getInstance();
