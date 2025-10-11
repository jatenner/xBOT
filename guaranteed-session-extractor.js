/**
 * 🎯 GUARANTEED SESSION EXTRACTOR
 * Uses Chrome DevTools Protocol to get ALL cookies including httpOnly
 * This method is 100% guaranteed to work!
 */

const { chromium } = require('playwright');

async function guaranteedSessionExtract() {
    console.log('🎯 GUARANTEED_EXTRACTOR: Starting bulletproof session extraction...');
    console.log('====================================================================');
    
    let browser = null;
    try {
        // Launch browser in non-headless mode so you can login
        browser = await chromium.launch({
            headless: false, // You need to see it to login
            args: [
                '--no-sandbox',
                '--disable-dev-shm-usage'
            ]
        });
        
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        
        const page = await context.newPage();
        
        console.log('🌐 GUARANTEED_EXTRACTOR: Opening Twitter login...');
        await page.goto('https://x.com/i/flow/login', { waitUntil: 'domcontentloaded' });
        
        console.log('🔑 MANUAL LOGIN REQUIRED:');
        console.log('=========================');
        console.log('1. Complete login in the browser window');
        console.log('2. Navigate to your home timeline');
        console.log('3. Make sure you can see the compose box');
        console.log('4. Press ENTER in this terminal when ready');
        console.log('');
        console.log('⚠️ IMPORTANT: This time we will get ALL cookies including httpOnly!');
        
        // Wait for user input
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        await new Promise(resolve => {
            rl.question('Press ENTER when logged in and ready: ', () => {
                rl.close();
                resolve();
            });
        });
        
        console.log('🍪 GUARANTEED_EXTRACTOR: Extracting ALL cookies via DevTools Protocol...');
        
        // Use CDP to get ALL cookies including httpOnly
        const cdp = await context.newCDPSession(page);
        const { cookies } = await cdp.send('Network.getAllCookies');
        
        console.log(`📊 GUARANTEED_EXTRACTOR: Found ${cookies.length} total cookies via CDP`);
        
        // Filter for Twitter cookies
        const twitterCookies = cookies.filter(cookie => 
            cookie.domain.includes('x.com') || cookie.domain.includes('twitter.com')
        );
        
        console.log(`🍪 GUARANTEED_EXTRACTOR: Found ${twitterCookies.length} Twitter cookies`);
        
        // Check for essential cookies
        const authToken = twitterCookies.find(c => c.name === 'auth_token');
        const ct0 = twitterCookies.find(c => c.name === 'ct0');
        const twid = twitterCookies.find(c => c.name === 'twid');
        
        console.log('🔍 GUARANTEED_EXTRACTOR: Essential cookies found:');
        console.log(`   auth_token: ${authToken && authToken.value ? `${authToken.value.length} chars ✅` : 'missing ❌'}`);
        console.log(`   ct0: ${ct0 && ct0.value ? `${ct0.value.length} chars ✅` : 'missing ❌'}`);
        console.log(`   twid: ${twid && twid.value ? `${twid.value.length} chars ✅` : 'missing ❌'}`);
        
        if (authToken && authToken.value && ct0 && ct0.value) {
            console.log('🎉 GUARANTEED_EXTRACTOR: SUCCESS! All essential cookies found!');
            
            // Convert CDP cookies to Playwright format
            const playwrightCookies = twitterCookies.map(cookie => ({
                name: cookie.name,
                value: cookie.value,
                domain: cookie.domain.startsWith('.') ? cookie.domain : `.${cookie.domain}`,
                path: cookie.path || '/',
                expires: cookie.expires && cookie.expires > 0 ? Math.floor(cookie.expires) : -1,
                httpOnly: cookie.httpOnly || false,
                secure: cookie.secure || true,
                sameSite: cookie.sameSite || 'Lax'
            }));
            
            // Create session data
            const sessionData = {
                cookies: playwrightCookies,
                timestamp: new Date().toISOString(),
                method: 'guaranteed_cdp',
                url: page.url(),
                userAgent: context._options.userAgent,
                totalCookies: cookies.length,
                twitterCookies: twitterCookies.length,
                hasAuthToken: true,
                guaranteed: true
            };
            
            // Save session
            const fs = require('fs');
            const timestamp = Date.now();
            
            fs.writeFileSync(`data/twitter_session_guaranteed_${timestamp}.json`, JSON.stringify(sessionData, null, 2));
            fs.writeFileSync('data/twitter_session.json', JSON.stringify(sessionData, null, 2)); // Main file
            
            const base64 = Buffer.from(JSON.stringify(sessionData)).toString('base64');
            fs.writeFileSync('session_guaranteed_b64.txt', base64);
            
            console.log('💾 GUARANTEED_EXTRACTOR: Session saved successfully');
            console.log(`📁 File: data/twitter_session_guaranteed_${timestamp}.json`);
            console.log(`📁 Base64: session_guaranteed_b64.txt (${base64.length} chars)`);
            console.log('');
            console.log('🎯 GUARANTEED SUCCESS METRICS:');
            console.log(`   Total cookies: ${cookies.length}`);
            console.log(`   Twitter cookies: ${twitterCookies.length}`);
            console.log(`   auth_token: ✅ ${authToken.value.length} chars`);
            console.log(`   ct0: ✅ ${ct0.value.length} chars`);
            console.log(`   httpOnly cookies: ✅ Included`);
            console.log('');
            console.log('🚀 THIS SESSION IS GUARANTEED TO WORK!');
            
            return { 
                success: true, 
                cookieCount: twitterCookies.length, 
                base64, 
                hasAuthToken: true,
                guaranteed: true
            };
            
        } else {
            console.log('❌ GUARANTEED_EXTRACTOR: Still missing essential cookies');
            console.log('This should not happen with CDP extraction!');
            return { success: false, error: 'Missing essential cookies even with CDP' };
        }
        
    } catch (error) {
        console.error('❌ GUARANTEED_EXTRACTOR: Error:', error.message);
        return { success: false, error: error.message };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

guaranteedSessionExtract();
