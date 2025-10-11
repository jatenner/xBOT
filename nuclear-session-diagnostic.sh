#!/bin/bash

# 🚨 NUCLEAR OPTION: TWITTER SESSION VERIFICATION & FIX
# X's detection has gotten extremely aggressive - we need to verify everything

echo "🚨 NUCLEAR TWITTER SESSION DIAGNOSTIC"
echo "====================================="
echo ""
echo "📊 ANALYSIS FROM LOGS:"
echo "   ✅ Bot is generating content (AI working)"
echo "   ✅ Content is being scheduled (planning working)" 
echo "   ✅ 4 cookies are being loaded (session loading)"
echo "   ❌ Still getting 'Not logged in to Twitter'"
echo ""
echo "🔍 DIAGNOSIS: X has implemented new detection methods"
echo ""

# Create advanced session tester
cat > test_current_session.js << 'EOF'
const fs = require('fs');

console.log('🔍 TESTING CURRENT SESSION VALIDITY');
console.log('===================================');

// Check if bulletproof session exists
if (!fs.existsSync('bulletproof_session_b64.txt')) {
    console.log('❌ No bulletproof session found');
    console.log('🔧 SOLUTION: Need to create new session');
    process.exit(1);
}

const sessionB64 = fs.readFileSync('bulletproof_session_b64.txt', 'utf8').trim();
const sessionData = JSON.parse(Buffer.from(sessionB64, 'base64').toString());

console.log('📊 SESSION ANALYSIS:');
console.log('  Length:', sessionB64.length, 'chars');
console.log('  Cookies:', sessionData.cookies.length);
console.log('  Method:', sessionData.method);
console.log('  Created:', sessionData.timestamp);

console.log('');
console.log('🍪 COOKIE BREAKDOWN:');
sessionData.cookies.forEach((cookie, i) => {
    console.log(`  ${i + 1}. ${cookie.name}:`);
    console.log(`     Value: ${cookie.value ? cookie.value.substring(0, 20) + '...' : 'EMPTY'}`);
    console.log(`     Length: ${cookie.value ? cookie.value.length : 0} chars`);
    console.log(`     Domain: ${cookie.domain}`);
    console.log(`     HttpOnly: ${cookie.httpOnly}`);
});

// Check for required cookies
const requiredCookies = ['auth_token', 'ct0', 'twid'];
const missingCookies = [];
const emptyCookies = [];

requiredCookies.forEach(name => {
    const cookie = sessionData.cookies.find(c => c.name === name);
    if (!cookie) {
        missingCookies.push(name);
    } else if (!cookie.value || cookie.value.length < 5) {
        emptyCookies.push(name);
    }
});

console.log('');
console.log('🔍 VALIDATION RESULTS:');
if (missingCookies.length > 0) {
    console.log('❌ Missing cookies:', missingCookies.join(', '));
}
if (emptyCookies.length > 0) {
    console.log('❌ Empty cookies:', emptyCookies.join(', '));
}

if (missingCookies.length === 0 && emptyCookies.length === 0) {
    console.log('✅ All required cookies present');
    
    // Check if cookies might be expired
    const created = new Date(sessionData.timestamp);
    const now = new Date();
    const ageHours = (now - created) / (1000 * 60 * 60);
    
    console.log('⏰ Session age:', Math.round(ageHours * 100) / 100, 'hours');
    
    if (ageHours > 24) {
        console.log('⚠️ Session is over 24 hours old - may be expired');
        console.log('🔧 SOLUTION: Extract fresh cookies');
    } else {
        console.log('🤔 Session looks valid but X is still rejecting it');
        console.log('🚨 DIAGNOSIS: X has new detection methods');
        console.log('');
        console.log('🛡️ ADVANCED SOLUTIONS NEEDED:');
        console.log('   1. User-Agent spoofing');
        console.log('   2. Browser fingerprint matching');
        console.log('   3. Request timing patterns');
        console.log('   4. Additional headers');
    }
} else {
    console.log('🔧 SOLUTION: Fix missing/empty cookies');
}
EOF

echo "🔧 STEP 1: Testing current session..."
node test_current_session.js

echo ""
echo "🚨 IF SESSION IS VALID BUT STILL FAILING:"
echo "   X has implemented NEW detection methods"
echo "   We need ADVANCED bypass techniques"
echo ""
echo "🛡️ NUCLEAR SOLUTIONS:"
echo "   1. Browser fingerprint spoofing"
echo "   2. Request header manipulation" 
echo "   3. Timing pattern mimicking"
echo "   4. User-Agent rotation"
echo ""
echo "🔧 IMMEDIATE ACTION:"
echo "   Run: node test_current_session.js"
echo "   Then tell me the results"
