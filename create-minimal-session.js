/**
 * 🧹 EMERGENCY TWITTER SESSION CLEANER
 * Create minimal session with only essential Twitter cookies
 */

const fs = require('fs');

async function createMinimalSession() {
    console.log('🧹 CLEANER: Creating minimal Twitter session...');
    
    try {
        // Read the latest session
        const sessionData = JSON.parse(fs.readFileSync('data/twitter_session_direct_1760131356959.json', 'utf8'));
        
        console.log(`📊 CLEANER: Found ${sessionData.cookies?.length || 0} total cookies`);
        
        // Extract only essential Twitter cookies
        const essentialCookies = sessionData.cookies?.filter(cookie => {
            const isEssential = (
                cookie.name === 'auth_token' ||
                cookie.name === 'ct0' ||
                cookie.name === 'twid' ||
                cookie.name === 'personalization_id' ||
                (cookie.domain && cookie.domain.includes('x.com') && cookie.value && cookie.value.length > 10)
            );
            return isEssential;
        }).map(cookie => ({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain || '.x.com',
            path: cookie.path || '/',
            httpOnly: cookie.httpOnly || false,
            secure: true,
            sameSite: 'Lax',
            expires: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days
        })) || [];
        
        console.log(`✅ CLEANER: Filtered to ${essentialCookies.length} essential cookies`);
        
        // Show what we found
        essentialCookies.forEach(cookie => {
            console.log(`   🍪 ${cookie.name}: ${cookie.value ? 'HAS_VALUE' : 'EMPTY'} (${cookie.domain})`);
        });
        
        // Create minimal session
        const minimalSession = {
            cookies: essentialCookies,
            timestamp: new Date().toISOString(),
            minimal: true
        };
        
        // Save files
        fs.writeFileSync('twitter_session_minimal.json', JSON.stringify(minimalSession, null, 2));
        
        const base64 = Buffer.from(JSON.stringify(minimalSession)).toString('base64');
        fs.writeFileSync('session_minimal_b64.txt', base64);
        
        console.log(`📁 CLEANER: Minimal session saved (${base64.length} chars)`);
        console.log(`🍪 CLEANER: Essential cookies: ${essentialCookies.length}`);
        
        return { success: true, base64, cookieCount: essentialCookies.length };
        
    } catch (error) {
        console.error('❌ CLEANER: Failed:', error.message);
        return { success: false, error: error.message };
    }
}

createMinimalSession();