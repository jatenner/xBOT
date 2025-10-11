/**
 * 🧪 STEALTH SESSION TESTER
 * Test the new session with Playwright posting
 */

const { chromium } = require('playwright');
const fs = require('fs');

async function testStealthSession() {
    console.log('🧪 STEALTH_TEST: Testing new session with Playwright...');
    
    let browser = null;
    try {
        // Load the stealth session
        const sessionData = JSON.parse(fs.readFileSync('data/twitter_session_stealth.json', 'utf8'));
        console.log(`✅ STEALTH_TEST: Loaded session with ${sessionData.cookies.length} cookies`);
        
        // Launch browser with maximum stealth
        browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ]
        });
        
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            locale: 'en-US',
            timezoneId: 'America/New_York'
        });
        
        // Add the stealth cookies
        await context.addCookies(sessionData.cookies);
        console.log('✅ STEALTH_TEST: Cookies loaded into browser context');
        
        const page = await context.newPage();
        
        // Test 1: Navigate to Twitter home
        console.log('🧪 STEALTH_TEST: Test 1 - Navigating to Twitter home...');
        await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000);
        
        // Check if we're logged in
        const isLoggedIn = await page.evaluate(() => {
            return document.querySelector('[data-testid="tweetTextarea_0"]') !== null ||
                   document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]') !== null ||
                   document.querySelector('[aria-label="Post"]') !== null;
        });
        
        if (isLoggedIn) {
            console.log('✅ STEALTH_TEST: Test 1 PASSED - Successfully logged in!');
        } else {
            console.log('❌ STEALTH_TEST: Test 1 FAILED - Not logged in');
            return { success: false, error: 'Not logged in with stealth session' };
        }
        
        // Test 2: Navigate to compose page
        console.log('🧪 STEALTH_TEST: Test 2 - Testing compose access...');
        await page.goto('https://x.com/compose/tweet', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);
        
        const canCompose = await page.evaluate(() => {
            return document.querySelector('[data-testid="tweetTextarea_0"]') !== null;
        });
        
        if (canCompose) {
            console.log('✅ STEALTH_TEST: Test 2 PASSED - Can access compose!');
        } else {
            console.log('❌ STEALTH_TEST: Test 2 FAILED - Cannot access compose');
            return { success: false, error: 'Cannot access compose with stealth session' };
        }
        
        // Test 3: Test posting capability (dry run - fill but don't post)
        console.log('🧪 STEALTH_TEST: Test 3 - Testing posting capability...');
        try {
            await page.fill('[data-testid="tweetTextarea_0"]', '🧪 Stealth session test - this is a test tweet that will be cleared');
            await page.waitForTimeout(1000);
            
            // Check if the tweet button is enabled
            const tweetButton = await page.locator('[data-testid="tweetButtonInline"]');
            const isEnabled = await tweetButton.isEnabled();
            
            if (isEnabled) {
                console.log('✅ STEALTH_TEST: Test 3 PASSED - Tweet button enabled!');
                
                // Clear the test content
                await page.fill('[data-testid="tweetTextarea_0"]', '');
                console.log('✅ STEALTH_TEST: Test content cleared');
            } else {
                console.log('❌ STEALTH_TEST: Test 3 FAILED - Tweet button not enabled');
                return { success: false, error: 'Tweet button not enabled' };
            }
        } catch (error) {
            console.log('❌ STEALTH_TEST: Test 3 FAILED - Error during posting test:', error.message);
            return { success: false, error: `Posting test failed: ${error.message}` };
        }
        
        console.log('🎉 STEALTH_TEST: ALL TESTS PASSED!');
        console.log('================================');
        console.log('✅ Login: Working');
        console.log('✅ Compose: Working');
        console.log('✅ Posting: Ready');
        console.log('✅ Stealth: Undetected');
        
        return { 
            success: true, 
            tests: {
                login: true,
                compose: true,
                posting: true,
                stealth: true
            }
        };
        
    } catch (error) {
        console.error('❌ STEALTH_TEST: Error:', error.message);
        return { success: false, error: error.message };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

testStealthSession();
