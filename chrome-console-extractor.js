/**
 * 🍪 CHROME CONSOLE SESSION EXTRACTOR
 * 
 * INSTRUCTIONS:
 * 1. Go to your logged-in Twitter tab (x.com/home)
 * 2. Press F12 to open Developer Tools
 * 3. Go to the Console tab
 * 4. Copy and paste this entire code
 * 5. Press Enter to run it
 * 6. Copy the output and save it to a file
 */

console.log('🍪 CHROME CONSOLE EXTRACTOR - STARTING');
console.log('=====================================');

// Extract all cookies
const cookies = document.cookie.split(';').map(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    const value = rest.join('=');
    return {
        name: name,
        value: value,
        domain: '.x.com',
        path: '/',
        httpOnly: false,
        secure: true,
        sameSite: 'Lax',
        expires: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days
    };
}).filter(cookie => cookie.name && cookie.value);

console.log(`📊 Found ${cookies.length} cookies`);

// Check for essential cookies
const authToken = cookies.find(c => c.name === 'auth_token');
const ct0 = cookies.find(c => c.name === 'ct0');
const twid = cookies.find(c => c.name === 'twid');

console.log('🔍 Essential cookies:');
console.log(`   auth_token: ${authToken && authToken.value ? `${authToken.value.length} chars ✅` : 'missing ❌'}`);
console.log(`   ct0: ${ct0 && ct0.value ? `${ct0.value.length} chars ✅` : 'missing ❌'}`);
console.log(`   twid: ${twid && twid.value ? `${twid.value.length} chars ✅` : 'missing ❌'}`);

if (authToken && authToken.value && ct0 && ct0.value) {
    const sessionData = {
        cookies: cookies,
        timestamp: new Date().toISOString(),
        method: 'chrome_console',
        url: window.location.href,
        userAgent: navigator.userAgent
    };
    
    const base64 = btoa(JSON.stringify(sessionData));
    
    console.log('✅ SESSION CREATED SUCCESSFULLY!');
    console.log('================================');
    console.log('');
    console.log('📋 COPY THIS BASE64 SESSION DATA:');
    console.log('');
    console.log(base64);
    console.log('');
    console.log('📝 INSTRUCTIONS:');
    console.log('1. Copy the base64 string above');
    console.log('2. Save it to a file called "manual_session_b64.txt"');
    console.log('3. Tell your assistant you have the session data');
    console.log('');
    console.log(`📊 Session info: ${cookies.length} cookies, ${base64.length} chars`);
    
} else {
    console.log('❌ MISSING ESSENTIAL COOKIES');
    console.log('This means you might not be properly logged in.');
    console.log('Try refreshing the page and logging in again.');
}

console.log('🍪 CHROME CONSOLE EXTRACTOR - COMPLETE');
