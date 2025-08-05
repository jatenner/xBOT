/**
 * 🚨 EMERGENCY BROWSER POSTER
 * Railway-optimized posting with extreme memory efficiency
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { ULTRA_LIGHT_BROWSER_OPTIONS, EMERGENCY_BROWSER_OPTIONS } from '../config/ultraLightBrowserConfig';

export class EmergencyBrowserPoster {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;
    
    constructor() {
        // Properties are initialized above
    }
    
    /**
     * Emergency browser initialization with maximum memory optimization
     */
    async initializeEmergencyBrowser() {
        try {
            console.log('🚨 Initializing emergency ultra-light browser...');
            
            // Force cleanup any existing processes
            await this.forceCleanup();
            
            // Use emergency config
            this.browser = await chromium.launch(EMERGENCY_BROWSER_OPTIONS);
            
            this.context = await this.browser.newContext({
                userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            });
            
            this.page = await this.context.newPage();
            
            console.log('✅ Emergency browser initialized');
            return true;
            
        } catch (error) {
            console.error('❌ Emergency browser init failed:', error.message);
            await this.forceCleanup();
            return false;
        }
    }
    
    /**
     * Force cleanup all browser resources
     */
    async forceCleanup() {
        try {
            if (this.page) {
                await this.page.close().catch(() => {});
                this.page = null;
            }
            
            if (this.context) {
                await this.context.close().catch(() => {});
                this.context = null;
            }
            
            if (this.browser) {
                await this.browser.close().catch(() => {});
                this.browser = null;
            }
            
            // Force garbage collection
            if (global.gc) {
                global.gc();
            }
            
            console.log('🧹 Emergency cleanup completed');
            
        } catch (error) {
            console.error('⚠️ Cleanup error:', error.message);
        }
    }
    
    /**
     * Emergency tweet posting with minimal resource usage
     */
    async emergencyPostTweet(content) {
        let success = false;
        
        try {
            console.log('🚨 EMERGENCY POSTING MODE');
            console.log(`📝 Content: ${content.substring(0, 50)}...`);
            
            // Initialize ultra-light browser
            const browserReady = await this.initializeEmergencyBrowser();
            if (!browserReady) {
                throw new Error('Emergency browser initialization failed');
            }
            
            // Load session first by going to main Twitter page
            console.log('🔐 Loading Twitter session...');
            await this.page.goto('https://x.com', {
                waitUntil: 'domcontentloaded',
                timeout: 15000
            });
            
            // Load session cookies if available
            const sessionPath = '/app/data/twitter_session.json';
            try {
                if (require('fs').existsSync(sessionPath)) {
                    const sessionData = JSON.parse(require('fs').readFileSync(sessionPath, 'utf8'));
                    if (sessionData.cookies) {
                        await this.context.addCookies(sessionData.cookies);
                        console.log(`✅ Loaded ${sessionData.cookies.length} session cookies`);
                        
                        // Reload page to activate session
                        await this.page.reload({ waitUntil: 'domcontentloaded' });
                        await this.page.waitForTimeout(3000);
                    }
                }
            } catch (sessionError) {
                console.log('⚠️ Session loading failed, continuing without session');
            }
            
            // Navigate to compose modal by clicking tweet button
            console.log('🚀 Opening tweet composer...');
            
            // Try multiple compose button selectors
            const composeButtons = [
                '[data-testid="SideNav_NewTweet_Button"]',
                '[aria-label="Tweet"]',
                '[href="/compose/tweet"]',
                'a[href="/compose/tweet"]'
            ];
            
            let composeClicked = false;
            for (const selector of composeButtons) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 3000 });
                    await this.page.click(selector);
                    composeClicked = true;
                    console.log(`✅ Clicked compose button: ${selector}`);
                    break;
                } catch (e) {
                    continue;
                }
            }
            
            if (!composeClicked) {
                throw new Error('Could not find tweet compose button');
            }
            
            // Wait for compose modal and type content
            console.log('📝 Typing tweet content...');
            const textareaSelectors = [
                '[data-testid="tweetTextarea_0"]',
                '[role="textbox"][aria-label*="Tweet"]',
                '.notranslate'
            ];
            
            let textareaFound = false;
            for (const selector of textareaSelectors) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 5000 });
                    await this.page.fill(selector, content);
                    textareaFound = true;
                    console.log(`✅ Typed content in: ${selector}`);
                    break;
                } catch (e) {
                    continue;
                }
            }
            
            if (!textareaFound) {
                throw new Error('Could not find tweet textarea');
            }
            
            // Click tweet button
            console.log('🚀 Publishing tweet...');
            const tweetButtons = [
                '[data-testid="tweetButton"]',
                '[data-testid="tweetButtonInline"]',
                '[role="button"][aria-label*="Tweet"]'
            ];
            
            let tweetButtonClicked = false;
            for (const selector of tweetButtons) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 3000 });
                    await this.page.click(selector);
                    tweetButtonClicked = true;
                    console.log(`✅ Clicked tweet button: ${selector}`);
                    break;
                } catch (e) {
                    continue;
                }
            }
            
            if (!tweetButtonClicked) {
                throw new Error('Could not find tweet button');
            }
            
            // Wait for success confirmation
            await this.page.waitForTimeout(3000);
            
            success = true;
            console.log('✅ Emergency posting successful');
            
        } catch (error) {
            console.error('❌ Emergency posting failed:', error.message);
            success = false;
        } finally {
            await this.forceCleanup();
        }
        
        return success;
    }
}

export const emergencyBrowserPoster = new EmergencyBrowserPoster();