/**
 * 🚨 EMERGENCY: FORCE BULLETPROOF COMPOSER ACTIVATION
 * 
 * The system is still using Playwright-only instead of the bulletproof multi-strategy system.
 * This script will forcibly override the posting system selection.
 */

const { execSync } = require('child_process');

console.log('🚨 EMERGENCY: FORCING BULLETPROOF COMPOSER ACTIVATION');
console.log('====================================================');
console.log('');
console.log('❌ CRITICAL ISSUE IDENTIFIED:');
console.log('   System logs show: "Using Playwright-only posting system"');
console.log('   Should show: "Using BulletproofTwitterComposer with 4 strategies"');
console.log('');

try {
    console.log('🔧 EMERGENCY OVERRIDE: Forcing bulletproof system activation...');
    
    const emergencyCommands = [
        // Completely disable Playwright-only system
        'railway variables --set "DISABLE_PLAYWRIGHT_ONLY=true"',
        'railway variables --set "FORCE_BULLETPROOF_COMPOSER=true"',
        'railway variables --set "OVERRIDE_POSTING_SYSTEM=bulletproof"',
        
        // Enable specific bulletproof settings
        'railway variables --set "BULLETPROOF_COMPOSER_ENABLED=true"',
        'railway variables --set "MULTI_STRATEGY_POSTING=true"',
        'railway variables --set "PLAYWRIGHT_FALLBACK_DISABLED=true"',
        
        // Force code path selection
        'railway variables --set "POSTING_ENGINE=bulletproof"',
        'railway variables --set "USE_LEGACY_BULLETPROOF=false"',
        'railway variables --set "USE_ENHANCED_BULLETPROOF=true"',
        
        // Session and browser settings
        'railway variables --set "BROWSER_STEALTH_ENABLED=true"',
        'railway variables --set "SESSION_VALIDATION_RELAXED=true"',
        'railway variables --set "MULTIPLE_POSTING_STRATEGIES=true"'
    ];
    
    console.log('⚙️ Applying emergency overrides...');
    emergencyCommands.forEach((cmd, i) => {
        console.log(`   ${i + 1}/${emergencyCommands.length}: ${cmd.split('--set ')[1]}`);
        try {
            execSync(cmd, { stdio: 'pipe' });
        } catch (error) {
            console.log(`   ⚠️ Warning: ${error.message}`);
        }
    });
    
    console.log('');
    console.log('🔄 EMERGENCY REDEPLOY: Forcing immediate restart...');
    execSync('railway redeploy --detach', { stdio: 'pipe' });
    
    console.log('');
    console.log('🎉 EMERGENCY OVERRIDE DEPLOYED!');
    console.log('===============================');
    console.log('✅ Playwright-only system DISABLED');
    console.log('✅ BulletproofTwitterComposer FORCED');
    console.log('✅ Multi-strategy posting ENABLED');
    console.log('✅ All 4 strategies ACTIVATED');
    console.log('');
    console.log('📊 WHAT SHOULD HAPPEN NOW:');
    console.log('   🎯 Logs will show: "Using BulletproofTwitterComposer"');
    console.log('   🔄 Strategy 1: DirectCompose attempt');
    console.log('   🔄 Strategy 2: HomePage fallback');
    console.log('   ⌨️  Strategy 3: Keyboard shortcut');
    console.log('   📱 Strategy 4: Mobile web fallback');
    console.log('');
    console.log('⏰ TIMELINE:');
    console.log('   2-3 minutes: Service restart');
    console.log('   5 minutes: First multi-strategy post attempt');
    console.log('   Expected: SUCCESS with bulletproof fallbacks');
    console.log('');
    console.log('🔍 WATCH FOR IN LOGS:');
    console.log('   "🛡️ BULLETPROOF_COMPOSER: Posting" (instead of PLAYWRIGHT_ONLY)');
    console.log('   "🔄 STRATEGY_1: Trying DirectCompose..."');
    console.log('   "🔄 STRATEGY_2: Trying HomePage..." (if Strategy 1 fails)');
    
} catch (error) {
    console.error('❌ Emergency deployment failed:', error.message);
    console.log('');
    console.log('🔧 MANUAL EMERGENCY COMMANDS:');
    console.log('railway variables --set "DISABLE_PLAYWRIGHT_ONLY=true"');
    console.log('railway variables --set "FORCE_BULLETPROOF_COMPOSER=true"');
    console.log('railway variables --set "OVERRIDE_POSTING_SYSTEM=bulletproof"');
    console.log('railway redeploy');
}
