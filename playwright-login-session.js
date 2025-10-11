/**
 * 🎭 PLAYWRIGHT LOGIN SESSION CREATOR
 * This will create a session by actually logging in with Playwright
 */

const { chromium } = require('playwright');

async function createSessionViaPlaywright() {
    console.log('🎭 PLAYWRIGHT_LOGIN: Creating session via automated login...');
    
    let browser = null;
    try {
        browser = await chromium.launch({
            headless: false, // So you can see what's happening
            args: [
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security'
            ]
        });
        
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        
        const page = await context.newPage();
        
        console.log('🌐 PLAYWRIGHT_LOGIN: Going to Twitter login...');
        await page.goto('https://x.com/i/flow/login', { waitUntil: 'domcontentloaded' });
        
        console.log('⏸️ MANUAL LOGIN REQUIRED:');
        console.log('================================');
        console.log('1. Complete the login in the browser window');
        console.log('2. Make sure you reach the home timeline');
        console.log('3. Press ENTER in this terminal when done');
        
        // Wait for user input
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        await new Promise(resolve => {
            rl.question('Press ENTER when login is complete and you see the home timeline: ', () => {
                rl.close();
                resolve();
            });
        });
        
        console.log('🍪 PLAYWRIGHT_LOGIN: Extracting session from authenticated browser...');
        
        // Get all cookies from the authenticated context
        const cookies = await context.cookies();
        console.log(`📊 PLAYWRIGHT_LOGIN: Found ${cookies.length} total cookies`);
        
        // Filter for Twitter cookies
        const twitterCookies = cookies.filter(c => 
            c.domain.includes('x.com') || c.domain.includes('twitter.com')
        );
        
        console.log(`🍪 PLAYWRIGHT_LOGIN: Found ${twitterCookies.length} Twitter cookies`);
        
        // Check what we got
        const authToken = twitterCookies.find(c => c.name === 'auth_token');
        const ct0 = twitterCookies.find(c => c.name === 'ct0');
        const twid = twitterCookies.find(c => c.name === 'twid');
        
        console.log('🔍 PLAYWRIGHT_LOGIN: Essential cookies found:');
        console.log(`   auth_token: ${authToken && authToken.value ? `${authToken.value.length} chars ✅` : 'missing ❌'}`);
        console.log(`   ct0: ${ct0 && ct0.value ? `${ct0.value.length} chars ✅` : 'missing ❌'}`);
        console.log(`   twid: ${twid && twid.value ? `${twid.value.length} chars ✅` : 'missing ❌'}`);
        
        // Create session data (even if auth_token is missing - Playwright can still work)
        const sessionData = {
            cookies: twitterCookies,
            timestamp: new Date().toISOString(),
            method: 'playwright_login',
            url: page.url(),
            userAgent: context._options.userAgent,
            hasAuthToken: !!(authToken && authToken.value),
            playwrightCompatible: true
        };
        
        // Save session
        const fs = require('fs');
        const timestamp = Date.now();
        
        fs.writeFileSync(`data/twitter_session_playwright_${timestamp}.json`, JSON.stringify(sessionData, null, 2));
        fs.writeFileSync('data/twitter_session.json', JSON.stringify(sessionData, null, 2)); // Main file
        
        const base64 = Buffer.from(JSON.stringify(sessionData)).toString('base64');
        fs.writeFileSync('session_playwright_b64.txt', base64);
        
        console.log('💾 PLAYWRIGHT_LOGIN: Session saved successfully');
        console.log(`📁 File: data/twitter_session_playwright_${timestamp}.json`);
        console.log(`📁 Base64: session_playwright_b64.txt (${base64.length} chars)`);
        
        // Test if we can post
        console.log('🧪 PLAYWRIGHT_LOGIN: Testing if we can access compose...');
        try {
            await page.goto('https://x.com/compose/tweet', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);
            
            const canCompose = await page.evaluate(() => {
                return document.querySelector('[data-testid="tweetTextarea_0"]') !== null;
            });
            
            if (canCompose) {
                console.log('✅ PLAYWRIGHT_LOGIN: Can access compose - session should work!');
                sessionData.canCompose = true;
            } else {
                console.log('⚠️ PLAYWRIGHT_LOGIN: Cannot access compose - but session saved anyway');
                sessionData.canCompose = false;
            }
        } catch (error) {
            console.log('⚠️ PLAYWRIGHT_LOGIN: Could not test compose, but session saved');
        }
        
        return { success: true, cookieCount: twitterCookies.length, base64, hasAuthToken: sessionData.hasAuthToken };
        
    } catch (error) {
        console.error('❌ PLAYWRIGHT_LOGIN: Error:', error.message);
        return { success: false, error: error.message };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

createSessionViaPlaywright();
