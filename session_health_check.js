#!/usr/bin/env node

/**
 * 🔍 TWITTER SESSION HEALTH CHECK
 * Comprehensive session validation and management tool
 */

import { TwitterSessionValidator } from './dist/src/utils/twitterSessionValidator.js';

async function main() {
    console.log('🔍 === TWITTER SESSION HEALTH CHECK ===\n');
    
    const validator = new TwitterSessionValidator();
    
    // 1. Basic session validation
    console.log('📋 1. BASIC SESSION VALIDATION');
    const isValid = await validator.validateExistingSession();
    console.log(`   Result: ${isValid ? '✅ VALID' : '❌ INVALID'}\n`);
    
    // 2. Health report
    console.log('📊 2. DETAILED HEALTH REPORT');
    const healthReport = validator.getSessionHealthReport();
    console.log(`   Status: ${healthReport.status}`);
    console.log(`   Health Score: ${healthReport.health}%`);
    console.log(`   Message: ${healthReport.message}`);
    console.log(`   Path: ${healthReport.path}`);
    if (healthReport.cookieCount) {
        console.log(`   Cookies: ${healthReport.cookieCount}`);
        console.log(`   Age: ${healthReport.ageHours} hours`);
    }
    console.log('   Recommendations:');
    healthReport.recommendations.forEach(rec => console.log(`     • ${rec}`));
    console.log('');
    
    // 3. Quick browser test (if session exists)
    if (isValid) {
        console.log('🚀 3. QUICK BROWSER TEST');
        try {
            const quickTest = await validator.testSessionQuickly();
            console.log(`   Result: ${quickTest ? '✅ PASSED' : '❌ FAILED'}`);
            
            if (!quickTest) {
                console.log('   ⚠️ Session file exists but login test failed');
                console.log('   💡 Session cookies may be expired');
            }
        } catch (error) {
            console.log(`   Result: ❌ ERROR - ${error.message}`);
        }
        console.log('');
    }
    
    // 4. Fallback strategy
    console.log('🛠️ 4. FALLBACK STRATEGY');
    const strategy = validator.createFallbackStrategy();
    strategy.forEach(line => console.log(`   ${line}`));
    console.log('');
    
    // 5. Summary and recommendations
    console.log('📝 5. SUMMARY & NEXT STEPS');
    
    if (healthReport.health >= 80) {
        console.log('   ✅ Session is healthy - posting should work');
        console.log('   💡 No action needed');
    } else if (healthReport.health >= 50) {
        console.log('   ⚠️ Session is aging - consider refresh');
        console.log('   💡 Run: npm run init-session');
    } else {
        console.log('   ❌ Session needs immediate attention');
        console.log('   💡 Required: Session refresh');
        console.log('   📋 Steps:');
        console.log('     1. Run: npm run init-session');
        console.log('     2. Upload new session to Railway');
        console.log('     3. Restart the bot');
    }
    
    console.log('\n🏁 Health check complete!');
}

main().catch(error => {
    console.error('❌ Health check failed:', error);
    process.exit(1);
});