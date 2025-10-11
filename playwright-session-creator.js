/**
 * 🎭 PLAYWRIGHT SESSION CREATOR
 * Create fresh session by navigating to Twitter
 */

const { chromium } = require('playwright');

async function createFreshSession() {
    console.log('🎭 PLAYWRIGHT_SESSION: Creating fresh Twitter session...');
    
    let browser = null;
    try {
        browser = await chromium.launch({
            headless: false, // Visible so you can see what's happening
            args: [
                '--no-sandbox',
                '--disable-dev-shm-usage'
            ]
        });
        
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        
        const page = await context.newPage();
        
        console.log('🌐 PLAYWRIGHT_SESSION: Navigating to Twitter...');
        await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
        
        // Wait a moment for the page to load
        await page.waitForTimeout(3000);
        
        // Check if we need to login
        const isLoggedIn = await page.evaluate(() => {
            return document.querySelector('[data-testid="tweetTextarea_0"]') !== null ||
                   document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]') !== null ||
                   document.querySelector('[aria-label="Post"]') !== null;
        });
        
        if (!isLoggedIn) {
            console.log('❌ PLAYWRIGHT_SESSION: Not logged in, redirecting to login...');
            await page.goto('https://x.com/login', { waitUntil: 'domcontentloaded' });
            
            console.log('🔑 MANUAL LOGIN REQUIRED:');
            console.log('   1. Log into your @SignalAndSynapse account in the browser window');
            console.log('   2. Make sure to stay logged in');
            console.log('   3. Press ENTER in this terminal when login is complete');
            
            // Wait for user input
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
            
            // Navigate back to home to verify login
            await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);
        }
        
        console.log('✅ PLAYWRIGHT_SESSION: Getting cookies from logged-in session...');
        
        // Get all cookies from the context
        const cookies = await context.cookies();
        const twitterCookies = cookies.filter(c => 
            c.domain.includes('x.com') || c.domain.includes('twitter.com')
        );
        
        console.log(`🍪 PLAYWRIGHT_SESSION: Found ${twitterCookies.length} Twitter cookies`);
        
        // Check for essential cookies
        const authToken = twitterCookies.find(c => c.name === 'auth_token');
        const ct0 = twitterCookies.find(c => c.name === 'ct0');
        
        console.log('🔍 PLAYWRIGHT_SESSION: Essential cookies:');
        console.log(`   auth_token: ${authToken && authToken.value ? `${authToken.value.length} chars ✅` : 'missing ❌'}`);
        console.log(`   ct0: ${ct0 && ct0.value ? `${ct0.value.length} chars ✅` : 'missing ❌'}`);
        
        if (authToken && authToken.value && ct0 && ct0.value) {
            // Create session data
            const sessionData = {
                cookies: twitterCookies,
                timestamp: new Date().toISOString(),
                method: 'playwright_fresh',
                userAgent: context._options.userAgent
            };
            
            // Save session
            const fs = require('fs');
            const timestamp = Date.now();
            
            fs.writeFileSync(`data/twitter_session_fresh_${timestamp}.json`, JSON.stringify(sessionData, null, 2));
            fs.writeFileSync('data/twitter_session.json', JSON.stringify(sessionData, null, 2)); // Main file
            
            const base64 = Buffer.from(JSON.stringify(sessionData)).toString('base64');
            fs.writeFileSync('session_fresh_b64.txt', base64);
            
            console.log('💾 PLAYWRIGHT_SESSION: Fresh session saved successfully');
            console.log(`📁 File: data/twitter_session_fresh_${timestamp}.json`);
            console.log(`📁 Base64: session_fresh_b64.txt (${base64.length} chars)`);
            
            return { success: true, cookieCount: twitterCookies.length, base64 };
        } else {
            console.log('❌ PLAYWRIGHT_SESSION: Still missing essential cookies');
            return { success: false, error: 'Missing essential cookies' };
        }
        
    } catch (error) {
        console.error('❌ PLAYWRIGHT_SESSION: Error:', error.message);
        return { success: false, error: error.message };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

createFreshSession();
