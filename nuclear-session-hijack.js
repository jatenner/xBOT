/**
 * 🔥 NUCLEAR OPTION: DIRECT CHROME SESSION HIJACK
 * Connect directly to your existing Chrome session
 * NO LOGIN ATTEMPTS - just use what's already there
 */

const { chromium } = require('playwright');

async function hijackExistingSession() {
    console.log('🔥 NUCLEAR_HIJACK: Connecting to your existing Chrome session...');
    console.log('================================================================');
    
    try {
        // First, let's try to connect to your existing Chrome
        console.log('🎯 NUCLEAR_HIJACK: Step 1 - Close the Playwright browser window');
        console.log('🎯 NUCLEAR_HIJACK: Step 2 - Keep your regular Chrome with Twitter open');
        console.log('🎯 NUCLEAR_HIJACK: Step 3 - We\'ll connect to that instead');
        
        console.log('');
        console.log('⚠️ IMPORTANT:');
        console.log('1. Close the Playwright browser window that just opened');
        console.log('2. Make sure your regular Chrome has Twitter open and logged in');
        console.log('3. Press ENTER when ready');
        
        // Wait for user input
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        await new Promise(resolve => {
            rl.question('Press ENTER when Playwright browser is closed and regular Chrome is ready: ', () => {
                rl.close();
                resolve();
            });
        });
        
        console.log('🔥 NUCLEAR_HIJACK: Attempting to connect to existing Chrome...');
        
        // Try to connect to existing Chrome instance
        let browser;
        try {
            browser = await chromium.connectOverCDP('http://localhost:9222');
            console.log('✅ NUCLEAR_HIJACK: Connected to existing Chrome!');
        } catch (error) {
            console.log('❌ NUCLEAR_HIJACK: Could not connect to Chrome');
            console.log('💡 SOLUTION: Start Chrome with remote debugging');
            console.log('');
            console.log('Run this command in a new terminal:');
            console.log('/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug');
            console.log('');
            console.log('Then log into Twitter in that Chrome window and run this script again');
            return { success: false, error: 'Chrome remote debugging not available' };
        }
        
        // Get all contexts (tabs)
        const contexts = browser.contexts();
        console.log(`🔍 NUCLEAR_HIJACK: Found ${contexts.length} browser contexts`);
        
        for (let i = 0; i < contexts.length; i++) {
            const context = contexts[i];
            const pages = context.pages();
            
            for (let j = 0; j < pages.length; j++) {
                const page = pages[j];
                const url = page.url();
                
                if (url.includes('x.com') || url.includes('twitter.com')) {
                    console.log(`🎯 NUCLEAR_HIJACK: Found Twitter tab: ${url}`);
                    
                    // Get cookies from this existing session
                    const cookies = await context.cookies();
                    const twitterCookies = cookies.filter(c => 
                        c.domain.includes('x.com') || c.domain.includes('twitter.com')
                    );
                    
                    console.log(`🍪 NUCLEAR_HIJACK: Extracted ${twitterCookies.length} cookies from existing session`);
                    
                    // Check for auth token
                    const authToken = twitterCookies.find(c => c.name === 'auth_token');
                    const ct0 = twitterCookies.find(c => c.name === 'ct0');
                    
                    if (authToken && authToken.value) {
                        console.log('🎉 NUCLEAR_HIJACK: SUCCESS! Found auth_token in existing session!');
                        console.log(`   auth_token: ${authToken.value.length} chars ✅`);
                        console.log(`   ct0: ${ct0 ? ct0.value.length : 0} chars ${ct0 ? '✅' : '❌'}`);
                        
                        // Create session data
                        const sessionData = {
                            cookies: twitterCookies,
                            timestamp: new Date().toISOString(),
                            method: 'nuclear_hijack',
                            url: url,
                            hijacked: true,
                            guaranteed: true
                        };
                        
                        // Save session
                        const fs = require('fs');
                        const timestamp = Date.now();
                        
                        fs.writeFileSync(`data/twitter_session_hijacked_${timestamp}.json`, JSON.stringify(sessionData, null, 2));
                        fs.writeFileSync('data/twitter_session.json', JSON.stringify(sessionData, null, 2));
                        
                        const base64 = Buffer.from(JSON.stringify(sessionData)).toString('base64');
                        fs.writeFileSync('session_hijacked_b64.txt', base64);
                        
                        console.log('💾 NUCLEAR_HIJACK: Hijacked session saved successfully');
                        console.log(`📁 File: data/twitter_session_hijacked_${timestamp}.json`);
                        console.log(`📁 Base64: session_hijacked_b64.txt (${base64.length} chars)`);
                        
                        return { 
                            success: true, 
                            cookieCount: twitterCookies.length, 
                            base64,
                            hasAuthToken: true,
                            hijacked: true
                        };
                    } else {
                        console.log('❌ NUCLEAR_HIJACK: No auth_token found in existing session');
                    }
                }
            }
        }
        
        console.log('❌ NUCLEAR_HIJACK: No valid Twitter session found in existing Chrome');
        return { success: false, error: 'No valid Twitter session in existing Chrome' };
        
    } catch (error) {
        console.error('❌ NUCLEAR_HIJACK: Error:', error.message);
        return { success: false, error: error.message };
    }
}

hijackExistingSession();
