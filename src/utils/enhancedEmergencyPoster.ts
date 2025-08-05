/**
 * 🚨 ENHANCED EMERGENCY POSTER
 * Advanced fallback posting system with multiple strategies
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { TwitterSessionValidator } from './twitterSessionValidator';
import { ULTRA_LIGHT_BROWSER_OPTIONS, EMERGENCY_BROWSER_OPTIONS } from '../config/ultraLightBrowserConfig';

export class EnhancedEmergencyPoster {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;
    private sessionValidator: TwitterSessionValidator;
    
    constructor() {
        this.sessionValidator = new TwitterSessionValidator();
    }
    
    /**
     * 🚀 SMART POSTING WITH FALLBACKS
     * Try multiple strategies to post successfully
     */
    async smartPost(content: string): Promise<{ success: boolean; method: string; error?: string }> {
        console.log('🚀 === ENHANCED EMERGENCY POSTING ===');
        console.log(`📝 Content: ${content.substring(0, 50)}...`);
        
        // Strategy 1: Validate existing session first
        console.log('🔍 Strategy 1: Validate existing session...');
        const sessionValid = await this.sessionValidator.validateExistingSession();
        
        if (sessionValid) {
            const quickTest = await this.sessionValidator.testSessionQuickly();
            if (quickTest) {
                console.log('✅ Session validated - attempting normal posting...');
                const result = await this.attemptNormalPosting(content);
                if (result.success) {
                    return result;
                }
            }
        }
        
        // Strategy 2: Mobile Twitter interface
        console.log('🔍 Strategy 2: Mobile Twitter fallback...');
        const mobileResult = await this.attemptMobilePosting(content);
        if (mobileResult.success) {
            return mobileResult;
        }
        
        // Strategy 3: Headless login attempt
        console.log('🔍 Strategy 3: Headless login attempt...');
        const headlessResult = await this.attemptHeadlessLogin(content);
        if (headlessResult.success) {
            return headlessResult;
        }
        
        // Strategy 4: Log detailed failure info
        console.log('🔍 Strategy 4: Comprehensive diagnostics...');
        await this.runDiagnostics();
        
        return {
            success: false,
            method: 'all_strategies_failed',
            error: 'All posting strategies failed - session refresh required'
        };
    }
    
    /**
     * 📱 MOBILE TWITTER POSTING
     * Use mobile interface which often has better compatibility
     */
    async attemptMobilePosting(content: string): Promise<{ success: boolean; method: string; error?: string }> {
        let browser: Browser | null = null;
        
        try {
            console.log('📱 Attempting mobile Twitter posting...');
            
            browser = await chromium.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--single-process'
                ]
            });
            
            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1'
            });
            
            const page = await context.newPage();
            
            // Load session if available
            try {
                const sessionData = JSON.parse(require('fs').readFileSync('/app/data/twitter_session.json', 'utf8'));
                if (sessionData.cookies) {
                    await context.addCookies(sessionData.cookies);
                }
            } catch (e) {
                console.log('⚠️ No session for mobile posting');
            }
            
            // Navigate to mobile Twitter
            await page.goto('https://mobile.twitter.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
            
            // Try to find compose button on mobile
            try {
                await page.waitForSelector('a[href="/compose/tweet"], [data-testid="SideNav_NewTweet_Button"]', { timeout: 10000 });
                await page.click('a[href="/compose/tweet"], [data-testid="SideNav_NewTweet_Button"]');
                
                // Type content
                await page.waitForSelector('textarea, [contenteditable="true"]', { timeout: 10000 });
                await page.fill('textarea, [contenteditable="true"]', content);
                
                // Post
                await page.click('[data-testid="tweetButton"], button[type="submit"]');
                
                console.log('✅ Mobile posting successful');
                return { success: true, method: 'mobile_twitter' };
                
            } catch (e) {
                console.log('❌ Mobile posting failed:', e.message);
                return { success: false, method: 'mobile_twitter', error: e.message };
            }
            
        } catch (error) {
            console.error('❌ Mobile posting error:', error);
            return { success: false, method: 'mobile_twitter', error: error.message };
        } finally {
            if (browser) {
                await browser.close().catch(() => {});
            }
        }
    }
    
    /**
     * 🔓 HEADLESS LOGIN ATTEMPT
     * Try to login without existing session
     */
    async attemptHeadlessLogin(content: string): Promise<{ success: boolean; method: string; error?: string }> {
        console.log('🔓 Headless login not implemented - requires credentials');
        console.log('💡 This would need Twitter username/password from environment');
        
        return {
            success: false,
            method: 'headless_login',
            error: 'Headless login not implemented - manual session refresh required'
        };
    }
    
    /**
     * 🔧 NORMAL POSTING WITH ENHANCED ERROR HANDLING
     */
    async attemptNormalPosting(content: string): Promise<{ success: boolean; method: string; error?: string }> {
        try {
            console.log('🔧 Attempting normal posting with enhanced error handling...');
            
            const browser = await chromium.launch(EMERGENCY_BROWSER_OPTIONS);
            const context = await browser.newContext();
            const page = await context.newPage();
            
            // Load session
            const sessionData = JSON.parse(require('fs').readFileSync('/app/data/twitter_session.json', 'utf8'));
            await context.addCookies(sessionData.cookies);
            
            // Navigate and post
            await page.goto('https://x.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
            
            // Wait for login confirmation
            await page.waitForSelector('[data-testid="SideNav_NewTweet_Button"]', { timeout: 10000 });
            
            // Open compose
            await page.click('[data-testid="SideNav_NewTweet_Button"]');
            
            // Type and post
            await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 10000 });
            await page.fill('[data-testid="tweetTextarea_0"]', content);
            await page.click('[data-testid="tweetButton"]');
            
            // Wait for success
            await page.waitForTimeout(3000);
            
            await browser.close();
            
            console.log('✅ Normal posting successful');
            return { success: true, method: 'normal_posting' };
            
        } catch (error) {
            console.error('❌ Normal posting failed:', error);
            return { success: false, method: 'normal_posting', error: error.message };
        }
    }
    
    /**
     * 🔍 RUN COMPREHENSIVE DIAGNOSTICS
     */
    async runDiagnostics(): Promise<void> {
        console.log('🔍 === COMPREHENSIVE DIAGNOSTICS ===');
        
        // Session health report
        const healthReport = this.sessionValidator.getSessionHealthReport();
        console.log('📊 Session Health Report:');
        console.log(`   Status: ${healthReport.status}`);
        console.log(`   Health: ${healthReport.health}%`);
        console.log(`   Message: ${healthReport.message}`);
        console.log(`   Recommendations: ${healthReport.recommendations.join(', ')}`);
        
        // Environment check
        console.log('🔧 Environment Check:');
        console.log(`   Railway: ${process.env.RAILWAY_ENVIRONMENT_NAME ? 'Yes' : 'No'}`);
        console.log(`   Node Version: ${process.version}`);
        console.log(`   Platform: ${process.platform}`);
        
        // Memory check
        const memUsage = process.memoryUsage();
        console.log('💾 Memory Usage:');
        console.log(`   RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB`);
        console.log(`   Heap Used: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
        console.log(`   External: ${Math.round(memUsage.external / 1024 / 1024)}MB`);
        
        // Fallback strategy
        const fallbackStrategy = this.sessionValidator.createFallbackStrategy();
        console.log('🚨 Fallback Strategy:');
        fallbackStrategy.forEach(line => console.log(line));
    }
}

export const enhancedEmergencyPoster = new EnhancedEmergencyPoster();