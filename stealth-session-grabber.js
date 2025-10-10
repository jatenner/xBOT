const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

/**
 * 🥷 STEALTH SESSION GRABBER - ANTI-DETECTION TWITTER SESSION EXTRACTOR
 * 
 * This script uses advanced stealth techniques to bypass Twitter's detection:
 * - Real browser fingerprints
 * - Human-like behavior patterns
 * - Anti-bot detection evasion
 * - Session persistence with auto-refresh
 */

class StealthSessionGrabber {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.sessionData = null;
    }

    // Advanced stealth browser configuration
    getStealthConfig() {
        return {
            headless: false, // Always visible to avoid headless detection
            args: [
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=VizDisplayCompositor',
                '--disable-background-networking',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-field-trial-config',
                '--disable-ipc-flooding-protection',
                '--no-sandbox',
                '--disable-web-security',
                '--disable-features=TranslateUI',
                '--disable-extensions',
                '--disable-component-extensions-with-background-pages',
                '--disable-default-apps',
                '--mute-audio',
                '--no-zygote',
                '--use-gl=swiftshader',
                '--enable-webgl',
                '--hide-scrollbars',
                '--disable-bundled-ppapi-flash',
                '--disable-plugins-discovery',
                '--deny-permission-prompts',
                '--disable-hang-monitor',
                '--disable-prompt-on-repost',
                '--disable-sync',
                '--force-fieldtrials=*BackgroundTracing/default/',
                '--enable-automation=false'
            ],
            ignoreDefaultArgs: ['--enable-automation'],
        };
    }

    // Human-like user agent rotation
    getRandomUserAgent() {
        const userAgents = [
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
        ];
        return userAgents[Math.floor(Math.random() * userAgents.length)];
    }

    // Advanced viewport randomization
    getRandomViewport() {
        const viewports = [
            { width: 1920, height: 1080 },
            { width: 1366, height: 768 },
            { width: 1440, height: 900 },
            { width: 1536, height: 864 }
        ];
        return viewports[Math.floor(Math.random() * viewports.length)];
    }

    async initializeBrowser() {
        console.log('🥷 STEALTH_SESSION: Initializing anti-detection browser...');
        
        try {
            // Launch browser with stealth config
            this.browser = await chromium.launch(this.getStealthConfig());
            
            // Create context with human-like fingerprint
            const viewport = this.getRandomViewport();
            const userAgent = this.getRandomUserAgent();
            
            this.context = await this.browser.newContext({
                userAgent,
                viewport,
                locale: 'en-US',
                timezoneId: 'America/New_York',
                permissions: ['geolocation'],
                geolocation: { latitude: 40.7128, longitude: -74.0060 }, // NYC
                colorScheme: 'light',
                reducedMotion: 'no-preference',
                forcedColors: 'none',
                extraHTTPHeaders: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                }
            });

            // Create page and inject stealth scripts
            this.page = await this.context.newPage();
            
            // Remove automation indicators
            await this.page.addInitScript(() => {
                // Remove webdriver property
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });

                // Mock plugins
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5],
                });

                // Mock languages
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['en-US', 'en'],
                });

                // Mock permissions
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters) => (
                    parameters.name === 'notifications' ?
                        Promise.resolve({ state: Notification.permission }) :
                        originalQuery(parameters)
                );

                // Hide automation
                window.chrome = {
                    runtime: {},
                };
            });

            console.log(`✅ STEALTH_SESSION: Browser initialized with viewport ${viewport.width}x${viewport.height}`);
            return true;

        } catch (error) {
            console.error('❌ STEALTH_SESSION: Browser initialization failed:', error.message);
            return false;
        }
    }

    async navigateToTwitter() {
        console.log('🌐 STEALTH_SESSION: Navigating to Twitter with human-like behavior...');
        
        try {
            // Navigate with realistic timing
            await this.page.goto('https://x.com/login', { 
                waitUntil: 'networkidle',
                timeout: 30000 
            });

            // Add human-like delay
            await this.page.waitForTimeout(2000 + Math.random() * 3000);

            // Check if we're on login page
            const isLoginPage = await this.page.locator('input[name="text"], input[autocomplete="username"]').isVisible();
            
            if (isLoginPage) {
                console.log('📝 STEALTH_SESSION: Login page detected - manual login required');
                console.log('');
                console.log('🔑 MANUAL LOGIN INSTRUCTIONS:');
                console.log('   1. Complete the login process in the browser window');
                console.log('   2. Navigate to your home timeline');
                console.log('   3. Make sure you can see tweets (not login/verification pages)');
                console.log('   4. Press ENTER in this terminal when ready');
                console.log('');
                
                // Wait for user input with readline
                const readline = require('readline');
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                
                await new Promise(resolve => {
                    rl.question('Press ENTER when login is complete: ', () => {
                        rl.close();
                        resolve();
                    });
                });
                
                console.log('⚡ STEALTH_SESSION: Proceeding with session capture...');
            }

            return true;

        } catch (error) {
            console.error('❌ STEALTH_SESSION: Navigation failed:', error.message);
            return false;
        }
    }

    async validateSession() {
        console.log('🔍 STEALTH_SESSION: Validating Twitter session...');
        
        try {
            // Check for timeline indicators
            const timelineSelectors = [
                '[data-testid="primaryColumn"]',
                '[data-testid="tweet"]',
                '[aria-label="Timeline"]',
                'article[data-testid="tweet"]'
            ];

            let isValidSession = false;
            for (const selector of timelineSelectors) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 5000 });
                    isValidSession = true;
                    break;
                } catch (e) {
                    // Continue checking other selectors
                }
            }

            if (!isValidSession) {
                // Check current URL for session validation
                const currentUrl = this.page.url();
                isValidSession = currentUrl.includes('home') || 
                                currentUrl.includes('timeline') || 
                                (!currentUrl.includes('login') && !currentUrl.includes('signup'));
            }

            if (isValidSession) {
                console.log('✅ STEALTH_SESSION: Valid Twitter session detected');
                return true;
            } else {
                console.log('❌ STEALTH_SESSION: Invalid session - still on login/verification page');
                return false;
            }

        } catch (error) {
            console.error('❌ STEALTH_SESSION: Session validation failed:', error.message);
            return false;
        }
    }

    async extractSessionData() {
        console.log('📦 STEALTH_SESSION: Extracting comprehensive session data...');
        
        try {
            // Get all cookies
            const cookies = await this.context.cookies();
            
            // Get localStorage data
            const localStorage = await this.page.evaluate(() => {
                const data = {};
                for (let i = 0; i < window.localStorage.length; i++) {
                    const key = window.localStorage.key(i);
                    data[key] = window.localStorage.getItem(key);
                }
                return data;
            });

            // Get sessionStorage data
            const sessionStorage = await this.page.evaluate(() => {
                const data = {};
                for (let i = 0; i < window.sessionStorage.length; i++) {
                    const key = window.sessionStorage.key(i);
                    data[key] = window.sessionStorage.getItem(key);
                }
                return data;
            });

            // Get user agent and other browser info
            const browserInfo = await this.page.evaluate(() => ({
                userAgent: navigator.userAgent,
                language: navigator.language,
                platform: navigator.platform,
                cookieEnabled: navigator.cookieEnabled,
                onLine: navigator.onLine
            }));

            this.sessionData = {
                timestamp: new Date().toISOString(),
                cookies,
                localStorage,
                sessionStorage,
                browserInfo,
                url: this.page.url()
            };

            console.log(`✅ STEALTH_SESSION: Extracted ${cookies.length} cookies and storage data`);
            return true;

        } catch (error) {
            console.error('❌ STEALTH_SESSION: Session extraction failed:', error.message);
            return false;
        }
    }

    async saveSessionData() {
        console.log('💾 STEALTH_SESSION: Saving session data...');
        
        try {
            // Ensure data directory exists
            const dataDir = path.join(__dirname, 'data');
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            // Save main session file
            const sessionPath = path.join(dataDir, 'twitter_session.json');
            fs.writeFileSync(sessionPath, JSON.stringify(this.sessionData, null, 2));

            // Create backup
            const backupPath = path.join(dataDir, `twitter_session_backup_${Date.now()}.json`);
            fs.writeFileSync(backupPath, JSON.stringify(this.sessionData, null, 2));

            // Create base64 encoded version for Railway
            const sessionB64 = Buffer.from(JSON.stringify(this.sessionData)).toString('base64');
            const b64Path = path.join(__dirname, 'session_b64_fresh.txt');
            fs.writeFileSync(b64Path, sessionB64);

            console.log('✅ STEALTH_SESSION: Session data saved successfully');
            console.log(`   📁 Main file: ${sessionPath}`);
            console.log(`   📁 Backup: ${backupPath}`);
            console.log(`   📁 Base64: ${b64Path}`);
            
            return { sessionPath, backupPath, b64Path };

        } catch (error) {
            console.error('❌ STEALTH_SESSION: Failed to save session data:', error.message);
            return null;
        }
    }

    async cleanup() {
        console.log('🧹 STEALTH_SESSION: Cleaning up browser resources...');
        
        try {
            if (this.page) await this.page.close();
            if (this.context) await this.context.close();
            if (this.browser) await this.browser.close();
            console.log('✅ STEALTH_SESSION: Cleanup completed');
        } catch (error) {
            console.error('❌ STEALTH_SESSION: Cleanup failed:', error.message);
        }
    }

    async run() {
        console.log('🚀 STEALTH SESSION GRABBER - ANTI-DETECTION MODE');
        console.log('================================================');
        console.log('🥷 Using advanced stealth techniques to bypass Twitter detection');
        console.log('🔒 Anti-bot measures: Fingerprint masking, human behavior, real browser');
        console.log('');

        try {
            // Initialize stealth browser
            const browserReady = await this.initializeBrowser();
            if (!browserReady) {
                throw new Error('Failed to initialize stealth browser');
            }

            // Navigate to Twitter
            const navigationSuccess = await this.navigateToTwitter();
            if (!navigationSuccess) {
                throw new Error('Failed to navigate to Twitter');
            }

            // Validate session
            const sessionValid = await this.validateSession();
            if (!sessionValid) {
                throw new Error('Invalid Twitter session detected');
            }

            // Extract session data
            const extractionSuccess = await this.extractSessionData();
            if (!extractionSuccess) {
                throw new Error('Failed to extract session data');
            }

            // Save session data
            const saveResult = await this.saveSessionData();
            if (!saveResult) {
                throw new Error('Failed to save session data');
            }

            console.log('');
            console.log('🎉 STEALTH_SESSION: SUCCESS! Fresh session captured');
            console.log('🔄 Ready to update Railway environment variable');
            
            return saveResult;

        } catch (error) {
            console.error('');
            console.error('❌ STEALTH_SESSION: FAILED -', error.message);
            console.error('');
            return null;
        } finally {
            await this.cleanup();
        }
    }
}

// Run the stealth session grabber
async function main() {
    const grabber = new StealthSessionGrabber();
    const result = await grabber.run();
    
    if (result) {
        console.log('');
        console.log('🚀 NEXT STEPS:');
        console.log('1. Fresh session data saved to:', result.b64Path);
        console.log('2. Ready to update Railway environment variable');
        console.log('3. System will automatically restart with new session');
        process.exit(0);
    } else {
        console.log('');
        console.log('❌ Session capture failed. Please try again.');
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { StealthSessionGrabber };
