/**
 * 🧹 TWITTER COOKIE CLEANER
 * Run this in Chrome console to clear all Twitter cookies
 */

console.log('🧹 CLEARING ALL TWITTER COOKIES');
console.log('===============================');

// Get all cookies for this domain
const allCookies = document.cookie.split(';');

console.log(`📊 Found ${allCookies.length} cookies to clear`);

// Clear each cookie by setting it to expire in the past
allCookies.forEach(cookie => {
    const [name] = cookie.trim().split('=');
    if (name) {
        // Clear for x.com
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.x.com`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=x.com`;
        
        // Clear for twitter.com
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.twitter.com`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=twitter.com`;
        
        // Clear for current domain
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
        
        console.log(`🗑️ Cleared: ${name}`);
    }
});

console.log('✅ ALL TWITTER COOKIES CLEARED');
console.log('');
console.log('🔄 NEXT STEPS:');
console.log('1. Refresh this page (F5 or Cmd+R)');
console.log('2. You should be logged out');
console.log('3. Log in fresh with your credentials');
console.log('4. Run the cookie extractor again');
console.log('');
console.log('This will force Twitter to create fresh auth_token!');
