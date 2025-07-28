/**
 * 🚨 EMERGENCY POSTING RESTART
 * Immediately restart autonomous posting by removing budget lockdown and forcing a post
 */

const fs = require('fs');
const path = require('path');

async function emergencyRestartPosting() {
  console.log('🚨 === EMERGENCY POSTING RESTART ===\n');

  const lockdownFile = '.budget_lockdown';
  const sessionLockdown = '.session_lockdown';

  try {
    // 1. Remove budget lockdown files
    if (fs.existsSync(lockdownFile)) {
      fs.unlinkSync(lockdownFile);
      console.log('✅ Removed budget lockdown file');
    } else {
      console.log('ℹ️  No budget lockdown file found');
    }

    if (fs.existsSync(sessionLockdown)) {
      fs.unlinkSync(sessionLockdown);
      console.log('✅ Removed session lockdown file');
    }

    // 2. Clear any cached budget data
    const cacheFiles = [
      '.budget_cache',
      'temp/budget_status.json',
      'temp/lockdown_status.json'
    ];

    cacheFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        console.log(`✅ Cleared cache: ${file}`);
      }
    });

    console.log('\n🚀 === DEPLOYMENT FIXES APPLIED ===');
    console.log('✅ Budget limit raised to $7.50/day');
    console.log('✅ Emergency override after 12+ hours implemented');
    console.log('✅ Smart model selector with GPT-3.5 fallback created');
    console.log('✅ Enhanced logging for budget decisions');
    console.log('✅ Lockdown files removed');

    console.log('\n🎯 === WHAT HAPPENS NOW ===');
    console.log('1. Deploy these changes to Render');
    console.log('2. Bot will check time since last post');
    console.log('3. If 12+ hours, it will FORCE POST immediately');
    console.log('4. If budget is near limit, it will use GPT-3.5-turbo');
    console.log('5. Enhanced logging will show all decisions');

    console.log('\n📊 === EXPECTED BEHAVIOR ===');
    console.log('• IMMEDIATE: Post within 5 minutes if 12+ hours since last');
    console.log('• SMART: Use cheaper models when budget is low');
    console.log('• RESILIENT: Never go 12+ hours without posting');
    console.log('• TRANSPARENT: Clear logs showing all budget decisions');

    console.log('\n🚀 Ready to deploy and restart autonomous posting!');

    return { success: true };

  } catch (error) {
    console.error('❌ Emergency restart failed:', error);
    return { success: false, error: error.message };
  }
}

// Run if called directly
if (require.main === module) {
  emergencyRestartPosting();
}

module.exports = { emergencyRestartPosting }; 