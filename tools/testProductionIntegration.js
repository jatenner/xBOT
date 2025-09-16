#!/usr/bin/env ts-node
"use strict";
/**
 * PRODUCTION INTEGRATION TEST
 *
 * Tests both the Enhanced Growth Engine and Twitter Session Recovery
 * Provides diagnostics for the Railway deployment issues
 */
Object.defineProperty(exports, "__esModule", { value: true });
const growthEngineEnhanced_1 = require("../src/agents/growthEngineEnhanced");
const twitterSessionRecovery_1 = require("../src/utils/twitterSessionRecovery");
async function main() {
    console.log('🧪 PRODUCTION INTEGRATION DIAGNOSTICS');
    console.log('====================================\n');
    // Test 1: Session Health Check
    console.log('📋 Test 1: Twitter Session Health');
    console.log('----------------------------------');
    try {
        const sessionCheck = await (0, twitterSessionRecovery_1.quickSessionCheck)();
        console.log('✅ Session Check Complete:');
        console.log(`   - Healthy: ${sessionCheck.healthy}`);
        console.log(`   - Cookie Count: ${sessionCheck.cookieCount}`);
        console.log(`   - Message: ${sessionCheck.message}`);
        if (!sessionCheck.healthy) {
            console.log('\n🔧 Running Full Session Recovery...');
            const recovery = twitterSessionRecovery_1.TwitterSessionRecovery.getInstance();
            const recoveryResult = await recovery.attemptRecovery();
            console.log('Recovery Results:');
            console.log(`   - Attempted: ${recoveryResult.recovery.attempted}`);
            console.log(`   - Successful: ${recoveryResult.recovery.successful}`);
            console.log(`   - Method: ${recoveryResult.recovery.method || 'None'}`);
            if (recoveryResult.recovery.error) {
                console.log(`   - Error: ${recoveryResult.recovery.error}`);
            }
        }
    }
    catch (error) {
        console.error('❌ Session test failed:', error.message);
    }
    console.log('\n📋 Test 2: Enhanced Growth Engine');
    console.log('----------------------------------');
    try {
        const growthResult = await (0, growthEngineEnhanced_1.testEnhancedGrowthEngine)();
        console.log('✅ Growth Engine Test Complete');
    }
    catch (error) {
        console.error('❌ Growth engine test failed:', error.message);
    }
    console.log('\n📋 Test 3: Environment Diagnostics');
    console.log('-----------------------------------');
    console.log('Environment Variables:');
    console.log(`   - NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`   - APP_ENV: ${process.env.APP_ENV}`);
    console.log(`   - LIVE_POSTS: ${process.env.LIVE_POSTS}`);
    console.log(`   - USE_GROWTH_ENGINE: ${process.env.USE_GROWTH_ENGINE}`);
    console.log(`   - TWITTER_SESSION_B64: ${process.env.TWITTER_SESSION_B64 ? 'Present' : 'Missing'}`);
    console.log('\nFile System:');
    const fs = require('fs');
    const sessionPaths = [
        '/app/data/twitter_session.json',
        './data/twitter_session.json',
        process.cwd() + '/data/twitter_session.json'
    ];
    for (const path of sessionPaths) {
        const exists = fs.existsSync(path);
        console.log(`   - ${path}: ${exists ? 'EXISTS' : 'MISSING'}`);
        if (exists) {
            try {
                const content = JSON.parse(fs.readFileSync(path, 'utf8'));
                const cookieCount = content.cookies ? content.cookies.length : 0;
                console.log(`     └─ ${cookieCount} cookies`);
            }
            catch {
                console.log('     └─ Invalid JSON');
            }
        }
    }
    console.log('\n📋 Test 4: Integration Recommendations');
    console.log('--------------------------------------');
    console.log('To integrate the Enhanced Growth Engine with your xBOT:');
    console.log('');
    console.log('1. 🔧 Enable Growth Engine:');
    console.log('   Set environment variable: USE_GROWTH_ENGINE=true');
    console.log('');
    console.log('2. 🔄 Modify your autonomousPostingEngine.ts:');
    console.log('   Add this before posting:');
    console.log('   ```typescript');
    console.log('   import { enhancePostingDecision } from "./agents/growthEngineEnhanced";');
    console.log('   ');
    console.log('   const decision = await enhancePostingDecision({');
    console.log('     opportunityScore,');
    console.log('     timeContext,');
    console.log('     lastPostMinutes,');
    console.log('     dailyPostCount');
    console.log('   });');
    console.log('   ');
    console.log('   if (decision.content) {');
    console.log('     // Use growth engine content');
    console.log('     const content = decision.content.content;');
    console.log('   }');
    console.log('   ```');
    console.log('');
    console.log('3. 🛠️ Fix Session Issues:');
    console.log('   If session is unhealthy, run locally:');
    console.log('   npm run seed:session');
    console.log('   npm run b64:x-session');
    console.log('   # Copy output to Railway TWITTER_SESSION_B64 env var');
    console.log('');
    console.log('4. 📊 Monitor:');
    console.log('   Add session recovery to your posting flow:');
    console.log('   ```typescript');
    console.log('   import { executePostWithRecovery } from "./utils/twitterSessionRecovery";');
    console.log('   ');
    console.log('   const result = await executePostWithRecovery(() => postFunction());');
    console.log('   ```');
    console.log('\n✅ Diagnostics Complete!');
    console.log('See recommendations above for production integration.');
}
if (require.main === module) {
    main().catch(console.error);
}
//# sourceMappingURL=testProductionIntegration.js.map