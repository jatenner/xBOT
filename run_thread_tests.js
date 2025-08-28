#!/usr/bin/env node

/**
 * 🧪 COMPREHENSIVE THREAD TESTING SCRIPT
 * Run all thread posting tests and generate detailed report
 */

console.log('🧪 COMPREHENSIVE THREAD TESTING SYSTEM');
console.log('======================================');
console.log('🎯 This will test the ENTIRE thread posting pipeline');
console.log('📊 Including real Twitter verification');
console.log('');

async function runAllTests() {
  try {
    // Import testing framework
    const { ThreadTestingFramework } = await import('./dist/testing/testing/threadTestingFramework.js');
    const testFramework = ThreadTestingFramework.getInstance();

    console.log('🚀 Starting comprehensive tests...');
    console.log('⏰ This may take 2-3 minutes to complete');
    console.log('');

    // Run all tests
    const results = await testFramework.runComprehensiveTests();

    // Generate and display report
    const report = testFramework.generateTestReport(results);
    console.log(report);

    // Exit with appropriate code
    const allPassed = results.every(r => r.success);
    process.exit(allPassed ? 0 : 1);

  } catch (error) {
    console.error('❌ TESTING FRAMEWORK ERROR:', error.message);
    console.error('❌ Stack:', error.stack);
    
    console.log('');
    console.log('🔧 TROUBLESHOOTING:');
    console.log('1. Ensure npm run build completed successfully');
    console.log('2. Check that all environment variables are set');
    console.log('3. Verify Twitter session is active');
    console.log('4. Run tests in Railway environment if local fails');
    
    process.exit(1);
  }
}

// Check environment
if (!process.env.OPENAI_API_KEY) {
  console.log('⚠️ OPENAI_API_KEY not available in local environment');
  console.log('🎯 Deploy this test to Railway to run with proper environment');
  console.log('');
  console.log('💡 To run locally, set environment variables:');
  console.log('   export OPENAI_API_KEY="your-key-here"');
  console.log('   export TWITTER_SESSION_B64="your-session-here"');
  process.exit(1);
}

runAllTests();
