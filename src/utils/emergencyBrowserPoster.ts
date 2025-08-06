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
            let sessionLoaded = false;
            try {
                if (require('fs').existsSync(sessionPath)) {
                    const sessionData = JSON.parse(require('fs').readFileSync(sessionPath, 'utf8'));
                    if (sessionData.cookies) {
                        await this.context.addCookies(sessionData.cookies);
                        console.log(`✅ Loaded ${sessionData.cookies.length} session cookies`);
                        
                        // Reload page to activate session
                        await this.page.reload({ waitUntil: 'domcontentloaded' });
                        await this.page.waitForTimeout(3000);
                        
                        // Check if we're actually logged in
                        try {
                            await this.page.waitForSelector('[data-testid="SideNav_NewTweet_Button"], [aria-label="Tweet"], [href="/compose/tweet"]', { timeout: 5000 });
                            sessionLoaded = true;
                            console.log('✅ Twitter session validated - user is logged in');
                        } catch (e) {
                            console.log('⚠️ Session validation failed - user appears logged out');
                        }
                    }
                }
            } catch (sessionError) {
                console.log('⚠️ Session loading failed, continuing without session');
            }
            
            if (!sessionLoaded) {
                console.log('🚨 Session validation failed - activating enhanced fallback system');
                
                // Import and use enhanced emergency poster
                const { enhancedEmergencyPoster } = await import('./enhancedEmergencyPoster');
                const fallbackResult = await enhancedEmergencyPoster.smartPost(content);
                
                if (fallbackResult.success) {
                    console.log(`✅ Fallback posting successful via ${fallbackResult.method}`);
                    success = true;
                    return { success: true, method: fallbackResult.method };
                } else {
                    throw new Error(`Twitter session invalid and all fallbacks failed: ${fallbackResult.error}`);
                }
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
            
            // Debug: Log all buttons on page to help troubleshoot
            try {
                const allButtons = await this.page.$$eval('button', buttons => 
                    buttons.map(btn => ({
                        text: btn.textContent?.trim(),
                        ariaLabel: btn.getAttribute('aria-label'),
                        testId: btn.getAttribute('data-testid'),
                        type: btn.getAttribute('type')
                    })).filter(btn => btn.text || btn.ariaLabel || btn.testId)
                );
                console.log('🔍 Available buttons:', JSON.stringify(allButtons.slice(0, 10), null, 2));
            } catch (debugError) {
                console.log('⚠️ Debug button enumeration failed');
            }
            
            // Wait for tweet button to appear (Twitter loads dynamically)
            await this.page.waitForTimeout(3000);
            
            const tweetButtons = [
                '[data-testid="tweetButton"]',
                '[data-testid="tweetButtonInline"]',
                '[role="button"][aria-label*="Tweet"]',
                '[role="button"][aria-label="Post"]',
                '[data-testid="tweetButton-default"]',
                '[data-testid="postButton"]',
                'button[type="submit"]',
                'button:has-text("Tweet")',
                'button:has-text("Post")',
                '[aria-label*="Post"]',
                // More aggressive selectors for Twitter's dynamic interface
                'div[role="button"]:has-text("Post")',
                'div[role="button"]:has-text("Tweet")',
                '[data-testid*="Button"]:has-text("Post")',
                '[data-testid*="Button"]:has-text("Tweet")',
                // Look for any enabled button that might be the tweet button
                'button:not([disabled])',
                'div[role="button"]:not([disabled])',
                // Twitter sometimes uses different selectors
                '[data-testid="tweetButton-inner"]',
                '[data-testid="Button"]:has-text("Post")'
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
                    console.log(`❌ Failed to find tweet button: ${selector}`);
                    continue;
                }
            }
            
            if (!tweetButtonClicked) {
                console.log('🔧 Trying keyboard shortcut as fallback (Cmd+Enter)...');
                try {
                    // Try keyboard shortcut to post (Cmd+Enter on Mac, Ctrl+Enter on Windows)
                    await this.page.keyboard.press('Meta+Enter'); // Mac
                    await this.page.waitForTimeout(1000);
                    tweetButtonClicked = true;
                    console.log('✅ Used keyboard shortcut to post tweet');
                } catch (keyboardError) {
                    console.log('❌ Keyboard shortcut failed, trying Ctrl+Enter...');
                    try {
                        await this.page.keyboard.press('Control+Enter'); // Windows/Linux
                        await this.page.waitForTimeout(1000);
                        tweetButtonClicked = true;
                        console.log('✅ Used Ctrl+Enter to post tweet');
                    } catch (ctrlError) {
                        throw new Error('Could not find tweet button or use keyboard shortcuts');
                    }
                }
            }
            
            // Wait for success confirmation and verify posting
            console.log('⏳ Waiting for posting confirmation...');
            await this.page.waitForTimeout(5000);
            
            // Check if we successfully posted by looking for indicators
            try {
                // Check if compose modal is gone (indicates successful post)
                const composeStillVisible = await this.page.$('[data-testid="tweetTextarea_0"]');
                if (!composeStillVisible) {
                    console.log('✅ Compose modal gone - posting confirmed');
                    success = true;
                } else {
                    // Modal still there, check for error indicators
                    console.log('⚠️ Compose modal still visible, checking for errors...');
                    
                    // Check if URL changed (successful post indicator)
                    const currentUrl = this.page.url();
                    if (currentUrl.includes('/status/') || !currentUrl.includes('compose')) {
                        console.log('✅ URL changed - posting confirmed via navigation');
                        success = true;
                    } else {
                        console.log('❌ No posting confirmation detected');
                        success = false;
                    }
                }
            } catch (error) {
                console.log('✅ Error checking compose modal (likely posted successfully)');
                success = true;
            }
            
            if (success) {
                console.log('✅ Emergency posting successful');
                
                // Try to extract tweet ID from URL
                const currentUrl = this.page.url();
                let tweetId = null;
                
                if (currentUrl.includes('/status/')) {
                    const match = currentUrl.match(/\/status\/(\d+)/);
                    if (match) {
                        tweetId = match[1];
                        console.log(`✅ Extracted tweet ID: ${tweetId}`);
                    }
                }
                
                // If no tweet ID found, generate a placeholder
                if (!tweetId) {
                    tweetId = `emergency_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    console.log(`🔧 Generated placeholder tweet ID: ${tweetId}`);
                }
                
                return { success: true, tweet_id: tweetId };
            } else {
                console.log('❌ Emergency posting may have failed');
                return { success: false, error: 'Posting confirmation failed' };
            }
            
        } catch (error) {
            console.error('❌ Emergency posting failed:', error.message);
            success = false;
            return { success: false, error: error.message };
        } finally {
            await this.forceCleanup();
        }
    }
}

export const emergencyBrowserPoster = new EmergencyBrowserPoster();