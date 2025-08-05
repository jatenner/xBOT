#!/usr/bin/env node

/**
 * 🔄 TWITTER SESSION REFRESH UTILITY
 * Interactive session refresh and Railway upload helper
 */

import fs from 'fs';
import path from 'path';
import { TwitterSessionValidator } from './dist/src/utils/twitterSessionValidator.js';

async function main() {
    console.log('🔄 === TWITTER SESSION REFRESH UTILITY ===\n');
    
    const validator = new TwitterSessionValidator();
    
    // 1. Check current session status
    console.log('📊 Current Session Status:');
    const healthReport = validator.getSessionHealthReport();
    console.log(`   Status: ${healthReport.status}`);
    console.log(`   Health: ${healthReport.health}%`);
    console.log(`   Message: ${healthReport.message}\n`);
    
    // 2. Provide refresh instructions
    console.log('🛠️ SESSION REFRESH INSTRUCTIONS:\n');
    
    console.log('📋 STEP 1: Generate New Session Locally');
    console.log('   Run this command in your local environment:');
    console.log('   > npm run init-session\n');
    
    console.log('📋 STEP 2: Verify Session File');
    console.log('   Check that this file was created:');
    console.log('   > ./data/twitter_session.json');
    console.log('   > ls -la data/twitter_session.json\n');
    
    console.log('📋 STEP 3: Upload to Railway');
    console.log('   Option A - Environment Variable (Recommended):');
    console.log('   1. Copy the content of twitter_session.json');
    console.log('   2. In Railway dashboard, add environment variable:');
    console.log('      TWITTER_SESSION_DATA=<paste_json_content>');
    console.log('   3. Restart your Railway service\n');
    
    console.log('   Option B - Direct File Upload:');
    console.log('   1. Use Railway CLI or dashboard file manager');
    console.log('   2. Upload to: /app/data/twitter_session.json');
    console.log('   3. Ensure file permissions are correct\n');
    
    console.log('📋 STEP 4: Verify Deployment');
    console.log('   After restart, check Railway logs for:');
    console.log('   > ✅ Twitter session loaded successfully');
    console.log('   > ✅ Session is fresh (X hours old)\n');
    
    // 3. Quick session format check
    const localSessionPath = './data/twitter_session.json';
    if (fs.existsSync(localSessionPath)) {
        console.log('🔍 LOCAL SESSION FOUND - Quick Validation:');
        try {
            const sessionData = JSON.parse(fs.readFileSync(localSessionPath, 'utf8'));
            const cookieCount = sessionData.cookies ? sessionData.cookies.length : 0;
            const hasTimestamp = !!sessionData.timestamp;
            const ageHours = hasTimestamp ? (Date.now() - sessionData.timestamp) / (1000 * 60 * 60) : 0;
            
            console.log(`   ✅ Valid JSON format`);
            console.log(`   ✅ Contains ${cookieCount} cookies`);
            console.log(`   ${hasTimestamp ? '✅' : '❌'} Has timestamp`);
            if (hasTimestamp) {
                console.log(`   ✅ Age: ${Math.floor(ageHours)} hours`);
            }
            
            if (cookieCount > 10 && hasTimestamp && ageHours < 1) {
                console.log('   🎉 Session looks ready for upload!\n');
            } else {
                console.log('   ⚠️ Session may need regeneration\n');
            }
            
        } catch (error) {
            console.log(`   ❌ Invalid JSON format: ${error.message}\n`);
        }
    } else {
        console.log('⚠️ No local session found - run npm run init-session first\n');
    }
    
    // 4. Environment variable helper
    console.log('🔧 ENVIRONMENT VARIABLE HELPER:');
    console.log('   If using environment variable approach, your Railway env should include:');
    console.log('   TWITTER_SESSION_DATA={"cookies":[...],"timestamp":...}\n');
    
    // 5. Troubleshooting
    console.log('🔧 TROUBLESHOOTING:');
    console.log('   • If session keeps failing: Clear browser cache and retry init-session');
    console.log('   • If Railway deployment fails: Check file permissions and paths');
    console.log('   • If login still fails: Try headless=false during init-session');
    console.log('   • For persistent issues: Check Railway memory limits\n');
    
    console.log('📞 SUPPORT:');
    console.log('   Run health check: node session_health_check.js');
    console.log('   View current logs: npm run logs');
    console.log('   Test posting: node trigger_immediate_post.js\n');
    
    console.log('🏁 Refresh guide complete!');
    console.log('💡 Remember: Session refresh is typically needed every 24-48 hours');
}

main().catch(error => {
    console.error('❌ Refresh utility failed:', error);
    process.exit(1);
});