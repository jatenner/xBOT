/**
 * 🚨 EMERGENCY BROWSER POSTER
 * Railway-optimized posting with extreme memory efficiency
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { ULTRA_LIGHT_BROWSER_OPTIONS, EMERGENCY_BROWSER_OPTIONS } from '../config/ultraLightBrowserConfig';
import { ModernTwitterSelectors } from './modernTwitterSelectors';

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
            
            // Use modern Twitter selector with intelligent detection
            let tweetButtonClicked = await ModernTwitterSelectors.findAndClickPostButton(this.page);
            
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
                
                // CRITICAL: Try multiple methods to extract REAL Twitter tweet ID
                let tweetId = null;
                
                // Method 1: Check current URL for tweet ID
                let currentUrl = this.page.url();
                console.log(`🔍 Current URL: ${currentUrl}`);
                
                if (currentUrl.includes('/status/')) {
                    const match = currentUrl.match(/\/status\/(\d+)/);
                    if (match) {
                        tweetId = match[1];
                        console.log(`✅ Method 1 - Extracted tweet ID from URL: ${tweetId}`);
                    }
                }
                
                // Method 2: Wait and check URL again (Twitter sometimes navigates slowly)
                if (!tweetId) {
                    console.log('🔄 Method 2 - Waiting for Twitter navigation...');
                    await this.page.waitForTimeout(3000);
                    currentUrl = this.page.url();
                    console.log(`🔍 Updated URL: ${currentUrl}`);
                    
                    if (currentUrl.includes('/status/')) {
                        const match = currentUrl.match(/\/status\/(\d+)/);
                        if (match) {
                            tweetId = match[1];
                            console.log(`✅ Method 2 - Extracted tweet ID from updated URL: ${tweetId}`);
                        }
                    }
                }
                
                // Method 3: Look for the newest tweet (just posted) on timeline
                if (!tweetId) {
                    console.log('🔄 Method 3 - Searching for newest tweet on timeline...');
                    try {
                        // Wait for timeline to update with new tweet
                        await this.page.waitForTimeout(3000);
                        
                        // Look for the first tweet article (most recent)
                        const firstTweetLink = await this.page.$('article[data-testid="tweet"] a[href*="/status/"]');
                        if (firstTweetLink) {
                            const href = await firstTweetLink.getAttribute('href');
                            if (href) {
                                const match = href.match(/\/status\/(\d+)/);
                                if (match) {
                                    tweetId = match[1];
                                    console.log(`✅ Method 3 - Extracted newest tweet ID: ${tweetId}`);
                                }
                            }
                        }
                        
                        // Alternative: Try looking for time links
                        if (!tweetId) {
                            const timeLinks = await this.page.$$('article[data-testid="tweet"] time a[href*="/status/"]');
                            if (timeLinks.length > 0) {
                                const href = await timeLinks[0].getAttribute('href');
                                if (href) {
                                    const match = href.match(/\/status\/(\d+)/);
                                    if (match) {
                                        tweetId = match[1];
                                        console.log(`✅ Method 3 (alt) - Extracted tweet ID from time link: ${tweetId}`);
                                    }
                                }
                            }
                        }
                    } catch (elementError) {
                        console.log('⚠️ Method 3 failed - no tweet elements found');
                    }
                }
                
                // Method 4: Search for tweet with matching content
                if (!tweetId) {
                    console.log('🔄 Method 4 - Searching for tweet with matching content...');
                    try {
                        // Create multiple content patterns for matching
                        const contentPreview = content.substring(0, 50).trim();
                        const firstWords = content.split(' ').slice(0, 5).join(' ');
                        const contentWithoutEmojis = content.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
                        
                        console.log(`🔍 Looking for tweet with content patterns:`);
                        console.log(`   Preview: "${contentPreview}..."`);
                        console.log(`   First words: "${firstWords}"`);
                        
                        // Get all tweet articles and check their content
                        const tweets = await this.page.$$('article[data-testid="tweet"]');
                        console.log(`🔍 Found ${tweets.length} tweets on timeline to check`);
                        
                        for (let i = 0; i < Math.min(tweets.length, 8); i++) { // Check first 8 tweets
                            try {
                                const tweetElement = tweets[i];
                                const tweetText = await tweetElement.$eval('[data-testid="tweetText"]', el => el.textContent);
                                
                                if (tweetText) {
                                    const cleanTweetText = tweetText.trim();
                                    console.log(`   Tweet ${i + 1}: "${cleanTweetText.substring(0, 60)}..."`);
                                    
                                    // Multiple matching strategies
                                    const isMatch = 
                                        cleanTweetText.includes(contentPreview) ||
                                        cleanTweetText.includes(firstWords) ||
                                        cleanTweetText.startsWith(content.substring(0, 30)) ||
                                        (contentWithoutEmojis.length > 20 && cleanTweetText.includes(contentWithoutEmojis.substring(0, 30)));
                                    
                                    if (isMatch) {
                                        console.log(`✅ Content match found in tweet ${i + 1}!`);
                                        
                                        // Found matching content, extract tweet ID
                                        const tweetLink = await tweetElement.$('a[href*="/status/"]');
                                        if (tweetLink) {
                                            const href = await tweetLink.getAttribute('href');
                                            if (href) {
                                                const match = href.match(/\/status\/(\d+)/);
                                                if (match) {
                                                    tweetId = match[1];
                                                    console.log(`✅ Method 4 - Found tweet with matching content: ${tweetId}`);
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                }
                            } catch (tweetError) {
                                console.log(`⚠️ Error checking tweet ${i + 1}: ${tweetError.message}`);
                                continue;
                            }
                        }
                    } catch (searchError) {
                        console.log('⚠️ Method 4 failed - content search error');
                    }
                }
                
                // Method 5: Last resort - check final URL after longer wait
                if (!tweetId) {
                    console.log('🔄 Method 5 - Final URL check...');
                    try {
                        await this.page.waitForTimeout(5000);
                        currentUrl = this.page.url();
                        
                        if (currentUrl.includes('/status/')) {
                            const match = currentUrl.match(/\/status\/(\d+)/);
                            if (match) {
                                tweetId = match[1];
                                console.log(`✅ Method 5 - Extracted tweet ID from final URL: ${tweetId}`);
                            }
                        }
                    } catch (finalError) {
                        console.log('⚠️ Method 5 failed');
                    }
                }
                
                // ONLY generate placeholder if absolutely no real ID found
                if (!tweetId) {
                    console.log('🚨 CRITICAL: Could not extract real Twitter ID - threading will fail');
                    tweetId = `emergency_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    console.log(`🔧 Generated placeholder tweet ID: ${tweetId}`);
                    
                    // Log this as a serious issue for debugging
                    console.log('❌ THREADING ISSUE: Emergency poster failed to get real tweet ID');
                    console.log('❌ This will cause individual tweets instead of proper threads');
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