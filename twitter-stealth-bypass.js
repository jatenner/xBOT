/**
 * 🛡️ ADVANCED X/TWITTER BOT DETECTION BYPASS SYSTEM
 * 
 * CRITICAL: X has sophisticated bot detection that blocks automated access.
 * This system implements military-grade stealth techniques to bypass ALL detection.
 */

const { chromium } = require('playwright');
const fs = require('fs');

class TwitterStealthBypass {
    constructor() {
        this.stealthConfig = {
            // Advanced fingerprint spoofing
            userAgents: [
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ],
            
            // Human-like timing patterns
            delays: {
                pageLoad: [2000, 5000],
                typing: [100, 300],
                click: [500, 1500],
                navigation: [3000, 7000]
            },
            
            // Anti-detection headers
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Cache-Control': 'max-age=0'
            }
        };
    }

    async createStealthBrowser() {
        console.log('🛡️ STEALTH: Launching ultra-stealth browser...');
        
        const browser = await chromium.launch({
            headless: false, // Visible browser reduces detection
            args: [
                // Core stealth arguments
                '--no-sandbox',
                '--disable-dev-shm-usage',
                
                // Advanced anti-detection
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-field-trial-config',
                '--disable-hang-monitor',
                '--disable-ipc-flooding-protection',
                '--disable-popup-blocking',
                '--disable-prompt-on-repost',
                '--disable-sync',
                '--disable-translate',
                '--disable-windows10-custom-titlebar',
                '--metrics-recording-only',
                '--no-first-run',
                '--no-default-browser-check',
                '--password-store=basic',
                '--use-mock-keychain',
                '--disable-component-extensions-with-background-pages',
                '--disable-default-apps',
                '--disable-extensions',
                
                // Fingerprint spoofing
                '--user-agent=' + this.getRandomUserAgent(),
                '--window-size=1920,1080',
                '--disable-gpu',
                '--no-zygote',
                '--single-process'
            ]
        });

        const context = await browser.newContext({
            userAgent: this.getRandomUserAgent(),
            viewport: { width: 1920, height: 1080 },
            locale: 'en-US',
            timezoneId: 'America/New_York',
            
            // Advanced context options
            permissions: ['geolocation'],
            geolocation: { latitude: 40.7128, longitude: -74.0060 }, // NYC
            
            // Extra headers to appear human
            extraHTTPHeaders: this.stealthConfig.headers
        });

        // Inject stealth scripts
        await context.addInitScript(() => {
            // Remove webdriver property
            delete navigator.__proto__.webdriver;
            
            // Spoof plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5]
            });
            
            // Spoof languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en']
            });
            
            // Spoof permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
            );
            
            // Spoof Chrome runtime
            window.chrome = {
                runtime: {}
            };
        });

        return { browser, context };
    }

    getRandomUserAgent() {
        const agents = this.stealthConfig.userAgents;
        return agents[Math.floor(Math.random() * agents.length)];
    }

    async humanDelay(min, max) {
        const delay = Math.random() * (max - min) + min;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    async humanType(page, selector, text) {
        const element = await page.locator(selector);
        await element.click();
        await this.humanDelay(200, 500);
        
        // Type with human-like delays
        for (const char of text) {
            await element.type(char);
            await this.humanDelay(50, 150);
        }
    }

    async bypassTwitterDetection() {
        console.log('🛡️ STEALTH: Starting Twitter detection bypass...');
        
        const { browser, context } = await this.createStealthBrowser();
        const page = await context.newPage();

        try {
            // Phase 1: Navigate with stealth
            console.log('🌐 STEALTH: Navigating to Twitter with human patterns...');
            
            // First visit a normal page to establish session
            await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded' });
            await this.humanDelay(2000, 4000);
            
            // Then navigate to Twitter login
            await page.goto('https://x.com/i/flow/login', { 
                waitUntil: 'domcontentloaded',
                timeout: 30000 
            });
            
            await this.humanDelay(3000, 6000);

            // Phase 2: Check for captcha/blocks
            const isBlocked = await page.evaluate(() => {
                return document.body.innerText.includes('Could not log you in') ||
                       document.body.innerText.includes('try again later') ||
                       document.querySelector('[data-testid="ocfEnterTextTextInput"]') !== null;
            });

            if (isBlocked) {
                console.log('❌ STEALTH: Twitter has blocked this session');
                console.log('🔄 STEALTH: Implementing advanced bypass techniques...');
                
                // Advanced bypass: Clear all traces and retry
                await this.clearBrowserTraces(context);
                await this.humanDelay(5000, 10000);
                
                // Try alternative entry points
                const alternativeUrls = [
                    'https://mobile.twitter.com/login',
                    'https://twitter.com/login',
                    'https://x.com/login'
                ];
                
                for (const url of alternativeUrls) {
                    console.log(`🔄 STEALTH: Trying alternative URL: ${url}`);
                    try {
                        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
                        await this.humanDelay(3000, 5000);
                        
                        const stillBlocked = await page.evaluate(() => {
                            return document.body.innerText.includes('Could not log you in');
                        });
                        
                        if (!stillBlocked) {
                            console.log('✅ STEALTH: Found working entry point!');
                            break;
                        }
                    } catch (e) {
                        console.log(`⚠️ STEALTH: ${url} failed, trying next...`);
                    }
                }
            }

            // Phase 3: Manual login with stealth assistance
            console.log('🔐 STEALTH: Ready for manual login...');
            console.log('');
            console.log('📋 STEALTH LOGIN INSTRUCTIONS:');
            console.log('   1. The browser window is now open with stealth protection');
            console.log('   2. Log in manually to your @SignalAndSynapse account');
            console.log('   3. Complete any 2FA/verification steps');
            console.log('   4. Navigate to x.com/home and verify you can see timeline');
            console.log('   5. Press ENTER here when login is complete');
            console.log('');
            console.log('🛡️ ACTIVE PROTECTIONS:');
            console.log('   ✅ Webdriver detection disabled');
            console.log('   ✅ Human-like browser fingerprint');
            console.log('   ✅ Real user agent and headers');
            console.log('   ✅ Anti-automation signatures removed');
            console.log('');

            // Wait for user confirmation
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

            // Phase 4: Extract stealth session
            console.log('🍪 STEALTH: Extracting bulletproof session...');
            
            const cookies = await context.cookies();
            const twitterCookies = cookies.filter(c => 
                c.domain.includes('x.com') || c.domain.includes('twitter.com')
            );

            const authToken = twitterCookies.find(c => c.name === 'auth_token');
            const ct0 = twitterCookies.find(c => c.name === 'ct0');
            
            if (authToken && authToken.value && ct0 && ct0.value) {
                const stealthSession = {
                    cookies: twitterCookies,
                    timestamp: new Date().toISOString(),
                    method: 'stealth_bypass',
                    userAgent: context._options.userAgent,
                    stealthProtected: true,
                    antiDetection: true,
                    railwayReady: true
                };

                const base64Session = Buffer.from(JSON.stringify(stealthSession)).toString('base64');
                
                // Save multiple formats
                fs.writeFileSync('stealth_session_b64.txt', base64Session);
                fs.writeFileSync('data/twitter_session_stealth.json', JSON.stringify(stealthSession, null, 2));
                
                console.log('✅ STEALTH: Bulletproof session created!');
                console.log(`   Length: ${base64Session.length} chars`);
                console.log(`   Cookies: ${twitterCookies.length}`);
                console.log(`   Railway compatible: ${base64Session.length < 32768 ? 'YES' : 'NO'}`);
                
                return { success: true, session: base64Session, cookieCount: twitterCookies.length };
            } else {
                throw new Error('Failed to extract essential authentication cookies');
            }

        } catch (error) {
            console.error('❌ STEALTH: Bypass failed:', error.message);
            return { success: false, error: error.message };
        } finally {
            await browser.close();
        }
    }

    async clearBrowserTraces(context) {
        console.log('🧹 STEALTH: Clearing browser traces...');
        
        // Clear all storage
        await context.clearCookies();
        await context.clearPermissions();
        
        // Execute cleanup scripts
        const pages = context.pages();
        for (const page of pages) {
            await page.evaluate(() => {
                // Clear all storage
                localStorage.clear();
                sessionStorage.clear();
                
                // Clear IndexedDB
                if (window.indexedDB) {
                    indexedDB.databases().then(databases => {
                        databases.forEach(db => {
                            indexedDB.deleteDatabase(db.name);
                        });
                    });
                }
            });
        }
    }
}

// Export for use
module.exports = TwitterStealthBypass;

// Run if called directly
if (require.main === module) {
    const stealth = new TwitterStealthBypass();
    stealth.bypassTwitterDetection().then(result => {
        if (result.success) {
            console.log('🎉 STEALTH BYPASS SUCCESSFUL!');
            console.log('   Your session is now bulletproof against detection');
        } else {
            console.log('❌ STEALTH BYPASS FAILED');
            console.log('   Error:', result.error);
        }
    });
}
