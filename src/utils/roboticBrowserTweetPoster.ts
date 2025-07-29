/**
 * 🤖 ROBOTIC BROWSER TWEET POSTER v2.0
 * ====================================
 * Enhanced browser automation with:
 * - 3x retry logic on all operations
 * - Screenshot debugging on failures
 * - Fallback selector strategies
 * - Comprehensive error recovery
 * - Real-time session health monitoring
 */

import { chromium, Browser, Page, ElementHandle, Locator } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { getChromiumLaunchOptions } from './playwrightUtils';

interface PostingResult {
    success: boolean;
    tweetId?: string;
    error?: string;
    attempts: number;
    screenshots: string[];
    sessionValid: boolean;
}

interface SelectorStrategy {
    primary: string;
    fallbacks: string[];
    description: string;
    validator?: (element: ElementHandle) => Promise<boolean>;
}

interface OperationConfig {
    maxRetries: number;
    timeoutMs: number;
    screenshotOnFailure: boolean;
    waitForStabilization: number;
}

export class RoboticBrowserTweetPoster {
    private browser: Browser | null = null;
    private page: Page | null = null;
    private isInitialized = false;
    private sessionPath = path.join(process.cwd(), 'twitter-auth.json');
    private screenshotDir = path.join(process.cwd(), 'logs', 'screenshots');
    private retryCount = 0;

    // Enhanced selectors with multiple fallback strategies
    private readonly SELECTORS: Record<string, SelectorStrategy> = {
        compose: {
            primary: '[data-testid="SideNav_NewTweet_Button"]',
            fallbacks: [
                'a[href="/compose/tweet"]',
                '[aria-label*="Tweet"]',
                'button[data-testid="tweetButtonInline"]',
                '[data-testid="toolBar"] button'
            ],
            description: 'Compose tweet button'
        },
        tweetTextArea: {
            primary: '[data-testid="tweetTextarea_0"]',
            fallbacks: [
                'div[role="textbox"][data-testid*="tweet"]',
                'div[contenteditable="true"][data-testid*="textInput"]',
                'div.public-DraftEditor-content',
                'div[aria-label*="Tweet text"]'
            ],
            description: 'Tweet text input area'
        },
        postButton: {
            primary: '[data-testid="tweetButtonInline"]',
            fallbacks: [
                '[data-testid="tweetButton"]',
                'button[role="button"]:has-text("Post")',
                'button[role="button"]:has-text("Tweet")',
                '[data-testid="tweetButton"]'
            ],
            description: 'Post/Tweet button'
        },
        confirmationIndicator: {
            primary: '[data-testid="toast"]',
            fallbacks: [
                'div[data-testid="Notification"]',
                'div[role="alert"]',
                'div[class*="toast"]',
                'div[aria-live="polite"]'
            ],
            description: 'Success confirmation'
        },
        loginIndicator: {
            primary: '[data-testid="SideNav_AccountSwitcher_Button"]',
            fallbacks: [
                '[data-testid="AppTabBar_Profile_Link"]',
                'nav[role="navigation"] a[href*="/home"]',
                'div[data-testid="primaryColumn"]',
                'main[role="main"]'
            ],
            description: 'Logged in state indicator'
        }
    };

    // Operation configurations
    private readonly CONFIGS: Record<string, OperationConfig> = {
        default: {
            maxRetries: 3,
            timeoutMs: 15000,
            screenshotOnFailure: true,
            waitForStabilization: 2000
        },
        posting: {
            maxRetries: 3,
            timeoutMs: 30000,
            screenshotOnFailure: true,
            waitForStabilization: 3000
        },
        navigation: {
            maxRetries: 2,
            timeoutMs: 20000,
            screenshotOnFailure: true,
            waitForStabilization: 1500
        }
    };

    constructor() {
        // Ensure screenshot directory exists
        if (!fs.existsSync(this.screenshotDir)) {
            fs.mkdirSync(this.screenshotDir, { recursive: true });
        }
    }

    /**
     * Initialize browser with enhanced reliability
     */
    async initialize(): Promise<boolean> {
        const config = this.CONFIGS.default;
        
        for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
            try {
                console.log(`🤖 Initializing robotic browser (attempt ${attempt}/${config.maxRetries})...`);

                if (this.isInitialized) {
                    return true;
                }

                // Enhanced browser launch with stealth
                const launchOptions = {
                    ...getChromiumLaunchOptions(),
                    args: [
                        ...getChromiumLaunchOptions().args || [],
                        '--disable-blink-features=AutomationControlled',
                        '--disable-dev-shm-usage',
                        '--disable-background-timer-throttling',
                        '--disable-backgrounding-occluded-windows',
                        '--disable-renderer-backgrounding'
                    ]
                };

                this.browser = await chromium.launch(launchOptions);
                
                this.page = await this.browser.newPage({
                    viewport: { width: 1280, height: 720 },
                    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                });

                // Advanced stealth techniques
                await this.setupAdvancedStealth();

                // Load and verify session
                const sessionValid = await this.loadAndVerifySession();
                if (!sessionValid) {
                    throw new Error('Invalid or expired Twitter session');
                }

                console.log('✅ Robotic browser initialized successfully');
                this.isInitialized = true;
                return true;

            } catch (error) {
                console.error(`❌ Browser initialization attempt ${attempt} failed:`, error);
                
                if (config.screenshotOnFailure) {
                    await this.captureScreenshot(`init_failure_attempt_${attempt}`);
                }

                await this.cleanup();

                if (attempt === config.maxRetries) {
                    console.error('💥 All browser initialization attempts failed');
                    return false;
                }

                // Wait before retry
                await this.sleep(2000 * attempt);
            }
        }

        return false;
    }

    /**
     * Post tweet with comprehensive retry and error handling
     */
    async postTweet(content: string): Promise<PostingResult> {
        const result: PostingResult = {
            success: false,
            attempts: 0,
            screenshots: [],
            sessionValid: false
        };

        const config = this.CONFIGS.posting;

        console.log('🤖 Starting robotic tweet posting process...');
        console.log(`📝 Content: ${content.slice(0, 100)}${content.length > 100 ? '...' : ''}`);

        for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
            result.attempts = attempt;
            this.retryCount = attempt - 1;

            try {
                console.log(`🎯 Posting attempt ${attempt}/${config.maxRetries}...`);

                // Verify session is still valid
                result.sessionValid = await this.verifySessionHealth();
                if (!result.sessionValid) {
                    throw new Error('Session expired - need to re-authenticate');
                }

                // Navigate to compose area
                await this.navigateToCompose();

                // Clear any existing content
                await this.clearTextArea();

                // Type the content
                await this.typeContentRobustly(content);

                // Verify content was typed correctly
                await this.verifyContentTyped(content);

                // Submit the tweet
                const tweetId = await this.submitTweetRobustly();

                if (tweetId) {
                    result.success = true;
                    result.tweetId = tweetId;
                    
                    console.log('🎉 Tweet posted successfully!');
                    console.log(`🆔 Tweet ID: ${tweetId}`);
                    
                    // Capture success screenshot
                    const screenshot = await this.captureScreenshot(`success_${Date.now()}`);
                    if (screenshot) result.screenshots.push(screenshot);
                    
                    return result;
                }

            } catch (error) {
                console.error(`❌ Posting attempt ${attempt} failed:`, error);
                result.error = error instanceof Error ? error.message : String(error);

                // Capture failure screenshot
                const screenshot = await this.captureScreenshot(`failure_attempt_${attempt}_${Date.now()}`);
                if (screenshot) result.screenshots.push(screenshot);

                // Session recovery if needed
                if (error instanceof Error && error.message.includes('session')) {
                    console.log('🔄 Attempting session recovery...');
                    const recovered = await this.recoverSession();
                    if (!recovered && attempt < config.maxRetries) {
                        console.log('💀 Session recovery failed, will retry...');
                        await this.sleep(5000);
                        continue;
                    }
                }

                // Page recovery
                if (attempt < config.maxRetries) {
                    console.log('🔄 Attempting page recovery...');
                    await this.recoverPage();
                    await this.sleep(3000 * attempt);
                }
            }
        }

        console.error('💥 All tweet posting attempts failed');
        return result;
    }

    /**
     * Navigate to compose area with multiple strategies
     */
    private async navigateToCompose(): Promise<void> {
        console.log('🧭 Navigating to compose area...');

        const element = await this.findElementWithStrategy(this.SELECTORS.compose);
        if (!element) {
            throw new Error('Could not find compose button with any strategy');
        }

        // Scroll into view
        await element.scrollIntoViewIfNeeded();
        await this.sleep(1000);

        // Click with retry
        await this.clickElementRobustly(element, 'compose button');

        // Wait for text area to appear
        await this.waitForElement(this.SELECTORS.tweetTextArea, 10000);
        
        console.log('✅ Successfully navigated to compose area');
    }

    /**
     * Type content with multiple fallback methods
     */
    private async typeContentRobustly(content: string): Promise<void> {
        console.log('⌨️  Typing content robustly...');

        const textArea = await this.findElementWithStrategy(this.SELECTORS.tweetTextArea);
        if (!textArea) {
            throw new Error('Could not find tweet text area');
        }

        // Strategy 1: Standard type
        try {
            await textArea.click();
            await this.sleep(500);
            await textArea.fill('');
            await this.sleep(500);
            await textArea.type(content, { delay: 50 });
            console.log('✅ Content typed using standard method');
            return;
        } catch (error) {
            console.log('⚠️  Standard typing failed, trying fallback...');
        }

        // Strategy 2: Focus and type
        try {
            await textArea.focus();
            await this.sleep(500);
            await this.page!.keyboard.press('Control+a');
            await this.sleep(200);
            await this.page!.keyboard.type(content, { delay: 30 });
            console.log('✅ Content typed using focus method');
            return;
        } catch (error) {
            console.log('⚠️  Focus typing failed, trying character-by-character...');
        }

        // Strategy 3: Character by character
        try {
            await textArea.click();
            await this.sleep(500);
            
            for (const char of content) {
                await this.page!.keyboard.type(char, { delay: 10 });
                await this.sleep(5);
            }
            console.log('✅ Content typed character-by-character');
            return;
        } catch (error) {
            throw new Error(`All typing strategies failed: ${error}`);
        }
    }

    /**
     * Submit tweet with multiple confirmation strategies
     */
    private async submitTweetRobustly(): Promise<string | null> {
        console.log('📤 Submitting tweet robustly...');

        const postButton = await this.findElementWithStrategy(this.SELECTORS.postButton);
        if (!postButton) {
            throw new Error('Could not find post button');
        }

        // Check if button is enabled
        const isEnabled = await postButton.isEnabled();
        if (!isEnabled) {
            throw new Error('Post button is disabled');
        }

        // Click the post button
        await this.clickElementRobustly(postButton, 'post button');

        // Wait for submission confirmation
        console.log('⏳ Waiting for submission confirmation...');
        
        try {
            // Method 1: Wait for toast notification
            const confirmation = await this.waitForElement(this.SELECTORS.confirmationIndicator, 15000);
            if (confirmation) {
                console.log('✅ Toast confirmation detected');
                return await this.extractTweetId();
            }
        } catch (error) {
            console.log('⚠️  No toast confirmation, trying URL change detection...');
        }

        // Method 2: Wait for URL change
        try {
            await this.page!.waitForFunction(
                () => window.location.href.includes('/status/') || 
                      window.location.pathname === '/home',
                { timeout: 30000 }
            );
            console.log('✅ URL change confirmation detected');
            return await this.extractTweetId();
        } catch (error) {
            console.log('⚠️  No URL change detected');
        }

        // Method 3: Check for compose area disappearance
        try {
            await this.page!.waitForSelector(this.SELECTORS.tweetTextArea.primary, { 
                state: 'detached', 
                timeout: 30000 
            });
            console.log('✅ Compose area disappearance confirmed');
            return await this.extractTweetId();
        } catch (error) {
            console.log('⚠️  Compose area still present');
        }

        throw new Error('Could not confirm tweet submission');
    }

    /**
     * Find element using strategy with fallbacks
     */
    private async findElementWithStrategy(strategy: SelectorStrategy): Promise<ElementHandle | null> {
        // Try primary selector first
        try {
            const element = await this.page!.waitForSelector(strategy.primary, { timeout: 30000 });
            if (element) {
                console.log(`✅ Found element using primary selector: ${strategy.description}`);
                return element;
            }
        } catch (error) {
            console.log(`⚠️  Primary selector failed for ${strategy.description}`);
        }

        // Try fallback selectors
        for (let i = 0; i < strategy.fallbacks.length; i++) {
            try {
                const element = await this.page!.waitForSelector(strategy.fallbacks[i], { timeout: 30000 });
                if (element) {
                    console.log(`✅ Found element using fallback ${i + 1}: ${strategy.description}`);
                    return element;
                }
            } catch (error) {
                console.log(`⚠️  Fallback ${i + 1} failed for ${strategy.description}`);
            }
        }

        return null;
    }

    /**
     * Click element with retry logic
     */
    private async clickElementRobustly(element: ElementHandle, description: string): Promise<void> {
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                // Ensure element is visible and stable
                await element.waitForElementState('visible', { timeout: 30000 });
                await element.waitForElementState('stable', { timeout: 30000 });
                
                // Try different click methods
                if (attempt === 1) {
                    await element.click();
                } else if (attempt === 2) {
                    await element.click({ force: true });
                } else {
                    // Last resort: JavaScript click
                    await element.evaluate(el => (el as HTMLElement).click());
                }

                console.log(`✅ Successfully clicked ${description}`);
                await this.sleep(1000);
                return;

            } catch (error) {
                console.log(`⚠️  Click attempt ${attempt} failed for ${description}: ${error}`);
                if (attempt < 3) {
                    await this.sleep(1000);
                }
            }
        }

        throw new Error(`Failed to click ${description} after 3 attempts`);
    }

    /**
     * Wait for element with multiple selector strategies
     */
    private async waitForElement(strategy: SelectorStrategy, timeoutMs: number = 10000): Promise<ElementHandle | null> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeoutMs) {
            const element = await this.findElementWithStrategy(strategy);
            if (element) {
                return element;
            }
            await this.sleep(500);
        }

        return null;
    }

    /**
     * Verify session health
     */
    private async verifySessionHealth(): Promise<boolean> {
        try {
            console.log('🔍 Verifying session health...');

            // Check if we're on X.com
            const currentUrl = this.page!.url();
            if (!currentUrl.includes('x.com') && !currentUrl.includes('twitter.com')) {
                await this.page!.goto('https://x.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
            }

            // Look for login indicators
            const loginElement = await this.findElementWithStrategy(this.SELECTORS.loginIndicator);
            
            if (loginElement) {
                console.log('✅ Session appears healthy');
                return true;
            } else {
                console.log('❌ Session appears invalid');
                return false;
            }

        } catch (error) {
            console.error('❌ Session health check failed:', error);
            return false;
        }
    }

    /**
     * Recover session
     */
    private async recoverSession(): Promise<boolean> {
        try {
            console.log('🔄 Attempting session recovery...');
            
            await this.page!.goto('https://x.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
            await this.sleep(3000);
            
            return await this.verifySessionHealth();

        } catch (error) {
            console.error('❌ Session recovery failed:', error);
            return false;
        }
    }

    /**
     * Setup advanced stealth techniques
     */
    private async setupAdvancedStealth(): Promise<void> {
        await this.page!.addInitScript(() => {
            // Remove webdriver property
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            
            // Mock plugins
            Object.defineProperty(navigator, 'plugins', { 
                get: () => [1, 2, 3, 4, 5].map(() => ({ name: 'Chrome PDF Plugin' })) 
            });
            
            // Mock languages
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            
            // Remove automation markers
            const originalQuery = window.document.querySelector;
            window.document.querySelector = function(selector) {
                if (selector === 'meta[name="webdriver"]') return null;
                return originalQuery.call(document, selector);
            };

            // Mock permissions
            const originalQuery2 = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery2(parameters)
            );

            // Clean up chrome detection
            delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Array;
            delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Promise;
            delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
        });
    }

    /**
     * Load and verify Twitter session
     */
    private async loadAndVerifySession(): Promise<boolean> {
        try {
            if (fs.existsSync(this.sessionPath)) {
                const sessionData = JSON.parse(fs.readFileSync(this.sessionPath, 'utf8'));
                console.log('🔐 Loading saved Twitter session...');
                
                await this.page!.goto('https://x.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
                
                if (sessionData.cookies && Array.isArray(sessionData.cookies)) {
                    await this.page!.context().addCookies(sessionData.cookies);
                    console.log(`✅ Loaded ${sessionData.cookies.length} session cookies`);
                }

                await this.sleep(2000);
                return await this.verifySessionHealth();
            } else {
                throw new Error('No saved session found');
            }
        } catch (error) {
            console.error('❌ Failed to load session:', error);
            return false;
        }
    }

    /**
     * Capture screenshot for debugging
     */
    private async captureScreenshot(name: string): Promise<string | null> {
        try {
            if (!this.page) return null;

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `${name}_${timestamp}.png`;
            const filepath = path.join(this.screenshotDir, filename);

            await this.page.screenshot({ 
                path: filepath, 
                fullPage: true,
                type: 'png'
            });

            console.log(`📸 Screenshot saved: ${filepath}`);
            return filepath;

        } catch (error) {
            console.error('❌ Failed to capture screenshot:', error);
            return null;
        }
    }

    /**
     * Clear text area
     */
    private async clearTextArea(): Promise<void> {
        const textArea = await this.findElementWithStrategy(this.SELECTORS.tweetTextArea);
        if (textArea) {
            await textArea.click();
            await this.page!.keyboard.press('Control+a');
            await this.page!.keyboard.press('Delete');
            await this.sleep(500);
        }
    }

    /**
     * Verify content was typed correctly
     */
    private async verifyContentTyped(expectedContent: string): Promise<void> {
        const textArea = await this.findElementWithStrategy(this.SELECTORS.tweetTextArea);
        if (!textArea) {
            throw new Error('Cannot verify content - text area not found');
        }

        const actualContent = await textArea.textContent() || await textArea.inputValue() || '';
        
        if (!actualContent.includes(expectedContent.slice(0, 50))) {
            throw new Error(`Content verification failed. Expected: ${expectedContent.slice(0, 50)}... Got: ${actualContent.slice(0, 50)}...`);
        }

        console.log('✅ Content verification passed');
    }

    /**
     * Extract tweet ID from current state
     */
    private async extractTweetId(): Promise<string | null> {
        try {
            // Wait a bit for URL to stabilize
            await this.sleep(2000);

            const currentUrl = this.page!.url();
            const statusMatch = currentUrl.match(/\/status\/(\d+)/);
            
            if (statusMatch) {
                return statusMatch[1];
            }

            // Alternative: Look for tweet element with data attributes
            try {
                const tweetElement = await this.page!.$('[data-testid="tweet"]');
                if (tweetElement) {
                    const href = await tweetElement.getAttribute('href');
                    if (href) {
                        const match = href.match(/\/status\/(\d+)/);
                        if (match) return match[1];
                    }
                }
            } catch (error) {
                console.log('Could not extract ID from tweet element');
            }

            return `posted_${Date.now()}`;

        } catch (error) {
            console.error('Failed to extract tweet ID:', error);
            return null;
        }
    }

    /**
     * Recover page state
     */
    private async recoverPage(): Promise<void> {
        try {
            console.log('🔄 Recovering page state...');
            
            await this.page!.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
            await this.sleep(3000);
            
            console.log('✅ Page recovery completed');

        } catch (error) {
            console.error('❌ Page recovery failed:', error);
        }
    }

    /**
     * Cleanup resources
     */
    private async cleanup(): Promise<void> {
        try {
            if (this.page) {
                await this.page.close();
                this.page = null;
            }
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
            }
            this.isInitialized = false;
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }

    /**
     * Utility: Sleep function
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get system status
     */
    async getStatus(): Promise<any> {
        return {
            initialized: this.isInitialized,
            session_valid: this.isInitialized ? await this.verifySessionHealth() : false,
            browser_active: !!this.browser,
            page_active: !!this.page,
            retry_count: this.retryCount,
            screenshot_dir: this.screenshotDir
        };
    }

    /**
     * Graceful shutdown
     */
    async shutdown(): Promise<void> {
        console.log('🤖 Shutting down robotic browser...');
        await this.cleanup();
        console.log('✅ Robotic browser shutdown complete');
    }
}

export default RoboticBrowserTweetPoster;