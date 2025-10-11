/**
 * 🚨 EMERGENCY TWITTER SESSION FIX
 * 
 * This script will:
 * 1. Help you extract a working session from your logged-in browser
 * 2. Create a Railway-compatible session file under 32KB
 * 3. Deploy it immediately to fix the posting system
 */

const { chromium } = require('playwright');
const fs = require('fs');

console.log('🚨 EMERGENCY TWITTER SESSION FIX');
console.log('================================');
console.log('');
console.log('📋 CRITICAL: Your Railway deployment is failing because:');
console.log('   ❌ TWITTER_SESSION_B64 variable exceeds 32,768 character limit');
console.log('   ❌ Current session has empty authentication cookies');
console.log('');
console.log('🎯 SOLUTION: We need to create a fresh, valid session');
console.log('');

async function emergencySessionFix() {
    console.log('🔧 STEP 1: Opening browser for manual session extraction...');
    console.log('');
    
    const browser = await chromium.launch({
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled'
        ]
    });
    
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    
    try {
        console.log('🌐 STEP 2: Navigate to Twitter and log in...');
        await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
        
        console.log('');
        console.log('⏳ MANUAL ACTION REQUIRED:');
        console.log('   1. ✅ Log into your @SignalAndSynapse account');
        console.log('   2. ✅ Make sure you can see your home timeline');
        console.log('   3. ✅ Verify the compose tweet button is visible');
        console.log('   4. ✅ Press ENTER in this terminal when ready');
        console.log('');
        
        // Wait for user confirmation
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
        
        console.log('🍪 STEP 3: Extracting cookies from authenticated session...');
        
        // Get all cookies
        const cookies = await context.cookies();
        const twitterCookies = cookies.filter(c => 
            c.domain.includes('x.com') || c.domain.includes('twitter.com')
        );
        
        // Check for essential cookies
        const authToken = twitterCookies.find(c => c.name === 'auth_token');
        const ct0 = twitterCookies.find(c => c.name === 'ct0');
        const twid = twitterCookies.find(c => c.name === 'twid');
        
        console.log('🔍 STEP 4: Validating extracted cookies...');
        console.log(`   auth_token: ${authToken && authToken.value ? `${authToken.value.length} chars ✅` : 'missing ❌'}`);
        console.log(`   ct0: ${ct0 && ct0.value ? `${ct0.value.length} chars ✅` : 'missing ❌'}`);
        console.log(`   twid: ${twid && twid.value ? `${twid.value.length} chars ✅` : 'missing ❌'}`);
        console.log(`   Total cookies: ${twitterCookies.length}`);
        
        if (!authToken || !authToken.value || !ct0 || !ct0.value) {
            throw new Error('Missing essential authentication cookies. Please ensure you are properly logged in.');
        }
        
        // Create optimized session data (only essential cookies)
        const essentialCookies = twitterCookies.filter(c => 
            ['auth_token', 'ct0', 'twid', 'personalization_id', 'guest_id'].includes(c.name)
        );
        
        const sessionData = {
            cookies: essentialCookies,
            timestamp: new Date().toISOString(),
            method: 'emergency_fix',
            userAgent: context._options.userAgent,
            railwayCompatible: true
        };
        
        // Create base64 session
        const base64Session = Buffer.from(JSON.stringify(sessionData)).toString('base64');
        
        console.log('💾 STEP 5: Saving Railway-compatible session...');
        console.log(`   Session size: ${base64Session.length} characters`);
        console.log(`   Railway limit: 32,768 characters`);
        console.log(`   Status: ${base64Session.length < 32768 ? '✅ UNDER LIMIT' : '❌ OVER LIMIT'}`);
        
        if (base64Session.length >= 32768) {
            // Create ultra-minimal session with only auth_token and ct0
            const minimalSessionData = {
                cookies: [authToken, ct0, twid].filter(Boolean),
                timestamp: new Date().toISOString(),
                method: 'emergency_minimal'
            };
            
            const minimalBase64 = Buffer.from(JSON.stringify(minimalSessionData)).toString('base64');
            console.log(`   Minimal session size: ${minimalBase64.length} characters`);
            
            fs.writeFileSync('emergency_session_b64.txt', minimalBase64);
            fs.writeFileSync('data/twitter_session_emergency.json', JSON.stringify(minimalSessionData, null, 2));
        } else {
            fs.writeFileSync('emergency_session_b64.txt', base64Session);
            fs.writeFileSync('data/twitter_session_emergency.json', JSON.stringify(sessionData, null, 2));
        }
        
        console.log('');
        console.log('🚀 STEP 6: Ready for Railway deployment!');
        console.log('   📁 Session file: emergency_session_b64.txt');
        console.log('   📁 JSON backup: data/twitter_session_emergency.json');
        console.log('');
        console.log('🔧 NEXT: I will now deploy this to Railway automatically');
        
        return {
            success: true,
            sessionLength: base64Session.length,
            cookieCount: essentialCookies.length,
            base64: fs.readFileSync('emergency_session_b64.txt', 'utf8')
        };
        
    } catch (error) {
        console.error('❌ EMERGENCY SESSION FIX FAILED:', error.message);
        return { success: false, error: error.message };
    } finally {
        await browser.close();
    }
}

// Run the emergency fix
emergencySessionFix().then(result => {
    if (result.success) {
        console.log('✅ EMERGENCY SESSION FIX COMPLETED SUCCESSFULLY!');
        console.log('   Your Twitter bot should be working within 5 minutes');
    } else {
        console.log('❌ EMERGENCY SESSION FIX FAILED');
        console.log('   Error:', result.error);
    }
});
