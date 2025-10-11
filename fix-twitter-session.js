/**
 * 🔧 TWITTER SESSION FIXER
 * Fix cookie format issues for Playwright compatibility
 */

const fs = require('fs');
const path = require('path');

async function fixTwitterSession() {
    console.log('🔧 SESSION_FIXER: Starting Twitter session repair...');
    
    try {
        // Read the current session
        const sessionPath = path.join(__dirname, 'data', 'twitter_session.json');
        const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
        
        console.log(`📊 SESSION_FIXER: Found ${sessionData.cookies?.length || 0} total cookies`);
        
        if (!sessionData.cookies) {
            throw new Error('No cookies found in session data');
        }
        
        // Filter and fix Twitter cookies only
        const twitterCookies = sessionData.cookies
            .filter(cookie => {
                // Keep only Twitter/X.com related cookies
                const isTwitter = cookie.domain && (
                    cookie.domain.includes('x.com') || 
                    cookie.domain.includes('twitter.com') ||
                    cookie.name === 'auth_token' ||
                    cookie.name === 'ct0'
                );
                return isTwitter && cookie.name && cookie.value;
            })
            .map(cookie => {
                // Fix cookie format for Playwright
                const fixedCookie = {
                    name: cookie.name,
                    value: cookie.value,
                    domain: cookie.domain || '.x.com',
                    path: cookie.path || '/',
                    httpOnly: cookie.httpOnly || false,
                    secure: cookie.secure !== false, // Default to true
                    sameSite: cookie.sameSite || 'Lax'
                };
                
                // Fix expires timestamp (convert from microseconds to seconds)
                if (cookie.expires && cookie.expires > 0) {
                    // If expires is in microseconds (very large number), convert to seconds
                    if (cookie.expires > 10000000000000) {
                        fixedCookie.expires = Math.floor(cookie.expires / 1000000);
                    } else if (cookie.expires > 10000000000) {
                        // If expires is in milliseconds, convert to seconds
                        fixedCookie.expires = Math.floor(cookie.expires / 1000);
                    } else {
                        // Already in seconds
                        fixedCookie.expires = cookie.expires;
                    }
                    
                    // Ensure expires is not in the past and not too far in future
                    const now = Math.floor(Date.now() / 1000);
                    const maxFuture = now + (365 * 24 * 60 * 60); // 1 year from now
                    
                    if (fixedCookie.expires < now) {
                        // If expired, set to 30 days from now
                        fixedCookie.expires = now + (30 * 24 * 60 * 60);
                    } else if (fixedCookie.expires > maxFuture) {
                        // If too far in future, cap at 1 year
                        fixedCookie.expires = maxFuture;
                    }
                } else {
                    // Set default expires to 30 days from now
                    fixedCookie.expires = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
                }
                
                return fixedCookie;
            });
        
        console.log(`✅ SESSION_FIXER: Filtered to ${twitterCookies.length} Twitter cookies`);
        
        // Check for essential cookies
        const hasAuthToken = twitterCookies.some(c => c.name === 'auth_token');
        const hasCt0 = twitterCookies.some(c => c.name === 'ct0');
        
        console.log(`🔑 SESSION_FIXER: Essential cookies - auth_token: ${hasAuthToken}, ct0: ${hasCt0}`);
        
        if (!hasAuthToken || !hasCt0) {
            console.warn('⚠️ SESSION_FIXER: Missing essential Twitter cookies!');
        }
        
        // Create fixed session data
        const fixedSession = {
            cookies: twitterCookies,
            timestamp: new Date().toISOString(),
            cookieCount: twitterCookies.length,
            fixed: true
        };
        
        // Save fixed session
        const fixedPath = path.join(__dirname, 'data', 'twitter_session_fixed.json');
        fs.writeFileSync(fixedPath, JSON.stringify(fixedSession, null, 2));
        
        // Create base64 version for Railway
        const base64Session = Buffer.from(JSON.stringify(fixedSession)).toString('base64');
        const base64Path = path.join(__dirname, 'session_b64_fixed.txt');
        fs.writeFileSync(base64Path, base64Session);
        
        console.log('✅ SESSION_FIXER: Fixed session saved');
        console.log(`📁 Fixed JSON: ${fixedPath}`);
        console.log(`📁 Base64: ${base64Path}`);
        console.log(`🍪 Twitter cookies: ${twitterCookies.length}`);
        
        // Show sample of fixed cookies
        console.log('\n🔍 Sample fixed cookies:');
        twitterCookies.slice(0, 3).forEach(cookie => {
            console.log(`   ${cookie.name}: domain=${cookie.domain}, expires=${new Date(cookie.expires * 1000).toISOString()}`);
        });
        
        return { success: true, cookieCount: twitterCookies.length, base64Session };
        
    } catch (error) {
        console.error('❌ SESSION_FIXER: Failed:', error.message);
        return { success: false, error: error.message };
    }
}

// Run the fixer
fixTwitterSession().then(result => {
    if (result.success) {
        console.log('\n🎉 SESSION_FIXER: Twitter session successfully repaired!');
        console.log('🔄 Ready to update Railway with fixed session');
    } else {
        console.error('\n❌ SESSION_FIXER: Repair failed:', result.error);
        process.exit(1);
    }
});
