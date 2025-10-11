/**
 * 🌐 BROWSER-BASED SESSION GRABBER
 * Extract session from already logged-in Chrome tab
 */

const { chromium } = require('playwright');

async function grabFromBrowser() {
    console.log('🌐 BROWSER_GRABBER: Connecting to your logged-in Chrome...');
    
    let browser = null;
    try {
        // Connect to your existing Chrome instance
        browser = await chromium.connectOverCDP('http://localhost:9222');
        console.log('✅ BROWSER_GRABBER: Connected to Chrome');
        
        const contexts = browser.contexts();
        console.log(`📱 BROWSER_GRABBER: Found ${contexts.length} browser contexts`);
        
        for (let i = 0; i < contexts.length; i++) {
            const context = contexts[i];
            const pages = context.pages();
            
            for (let j = 0; j < pages.length; j++) {
                const page = pages[j];
                const url = page.url();
                
                if (url.includes('x.com') || url.includes('twitter.com')) {
                    console.log(`🎯 BROWSER_GRABBER: Found Twitter tab: ${url}`);
                    
                    // Get cookies from this page
                    const cookies = await context.cookies();
                    const twitterCookies = cookies.filter(c => 
                        c.domain.includes('x.com') || c.domain.includes('twitter.com')
                    );
                    
                    console.log(`🍪 BROWSER_GRABBER: Found ${twitterCookies.length} Twitter cookies`);
                    
                    // Check for essential cookies
                    const authToken = twitterCookies.find(c => c.name === 'auth_token');
                    const ct0 = twitterCookies.find(c => c.name === 'ct0');
                    
                    if (authToken && authToken.value && ct0 && ct0.value) {
                        console.log('✅ BROWSER_GRABBER: Found valid auth_token and ct0!');
                        console.log(`   auth_token: ${authToken.value.length} chars`);
                        console.log(`   ct0: ${ct0.value.length} chars`);
                        
                        // Create session data
                        const sessionData = {
                            cookies: twitterCookies,
                            timestamp: new Date().toISOString(),
                            method: 'browser_grab',
                            url: url
                        };
                        
                        // Save session
                        const fs = require('fs');
                        const timestamp = Date.now();
                        
                        fs.writeFileSync(`data/twitter_session_browser_${timestamp}.json`, JSON.stringify(sessionData, null, 2));
                        
                        const base64 = Buffer.from(JSON.stringify(sessionData)).toString('base64');
                        fs.writeFileSync('session_browser_b64.txt', base64);
                        
                        console.log('💾 BROWSER_GRABBER: Session saved successfully');
                        console.log(`📁 File: data/twitter_session_browser_${timestamp}.json`);
                        console.log(`📁 Base64: session_browser_b64.txt (${base64.length} chars)`);
                        
                        return { success: true, cookieCount: twitterCookies.length, base64 };
                    } else {
                        console.log('❌ BROWSER_GRABBER: Missing essential cookies');
                        console.log(`   auth_token: ${authToken ? 'found' : 'missing'}`);
                        console.log(`   ct0: ${ct0 ? 'found' : 'missing'}`);
                    }
                }
            }
        }
        
        console.log('❌ BROWSER_GRABBER: No valid Twitter session found');
        return { success: false, error: 'No valid Twitter session found' };
        
    } catch (error) {
        if (error.message.includes('ECONNREFUSED')) {
            console.log('❌ BROWSER_GRABBER: Chrome remote debugging not enabled');
            console.log('💡 SOLUTION: Start Chrome with: --remote-debugging-port=9222');
            return { success: false, error: 'Chrome remote debugging not enabled' };
        }
        console.error('❌ BROWSER_GRABBER: Error:', error.message);
        return { success: false, error: error.message };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

grabFromBrowser();
