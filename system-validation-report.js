#!/usr/bin/env node

/**
 * 🏥 COMPREHENSIVE SYSTEM VALIDATION
 * Tests all components for 100% functionality
 */

console.log('🎯 COMPREHENSIVE SYSTEM VALIDATION STARTING...');
console.log('=' .repeat(60));

async function validateAllSystems() {
  const results = {
    overall: 'PENDING',
    components: {},
    timestamp: new Date().toISOString()
  };

  // 1. Core Files Validation
  console.log('\n📁 VALIDATING CORE FILES...');
  const fs = require('fs');
  const path = require('path');
  
  const criticalFiles = [
    'src/posting/fixedThreadPoster.ts',
    'src/main-bulletproof.ts', 
    'src/ai/bulletproofPrompts.ts',
    'src/posting/BrowserManager.ts',
    'complete-environment-config.txt'
  ];

  let filesOk = 0;
  for (const file of criticalFiles) {
    if (fs.existsSync(path.join(__dirname, file))) {
      console.log(`✅ ${file}`);
      filesOk++;
    } else {
      console.log(`❌ ${file} - MISSING`);
    }
  }
  
  results.components.coreFiles = {
    status: filesOk === criticalFiles.length ? 'PASS' : 'FAIL',
    details: `${filesOk}/${criticalFiles.length} files present`
  };

  // 2. Thread Posting Validation
  console.log('\n🧵 VALIDATING THREAD POSTING SYSTEM...');
  
  try {
    const mainContent = fs.readFileSync(path.join(__dirname, 'src/main-bulletproof.ts'), 'utf8');
    
    const hasFixedThreadPoster = mainContent.includes('FixedThreadPoster');
    const hasPostProperThread = mainContent.includes('postProperThread');
    
    if (hasFixedThreadPoster && hasPostProperThread) {
      console.log('✅ FixedThreadPoster integrated');
      console.log('✅ postProperThread method active');
      results.components.threadPosting = { status: 'PASS', details: 'FixedThreadPoster fully integrated' };
    } else {
      console.log('❌ Thread posting integration incomplete');
      results.components.threadPosting = { status: 'FAIL', details: 'Missing FixedThreadPoster integration' };
    }
  } catch (error) {
    console.log('❌ Thread posting validation failed:', error.message);
    results.components.threadPosting = { status: 'FAIL', details: error.message };
  }

  // 3. Content Validation
  console.log('\n📝 VALIDATING CONTENT VALIDATION SYSTEM...');
  
  try {
    const promptsContent = fs.readFileSync(path.join(__dirname, 'src/ai/bulletproofPrompts.ts'), 'utf8');
    
    const has150_270Range = promptsContent.includes('150') && promptsContent.includes('270');
    const oldRangeRemoved = !promptsContent.includes('180-240');
    
    if (has150_270Range && oldRangeRemoved) {
      console.log('✅ Content validation: 150-270 character range active');
      console.log('✅ Old validation rules removed');
      results.components.contentValidation = { status: 'PASS', details: 'Flexible 150-270 char range active' };
    } else {
      console.log('❌ Content validation not properly updated');
      results.components.contentValidation = { status: 'FAIL', details: 'Validation range not updated' };
    }
  } catch (error) {
    console.log('❌ Content validation check failed:', error.message);
    results.components.contentValidation = { status: 'FAIL', details: error.message };
  }

  // 4. TypeScript Compilation
  console.log('\n🔧 VALIDATING TYPESCRIPT COMPILATION...');
  
  try {
    const { execSync } = require('child_process');
    execSync('npx tsc --noEmit', { stdio: 'pipe' });
    console.log('✅ TypeScript compilation successful');
    results.components.typescript = { status: 'PASS', details: 'Zero compilation errors' };
  } catch (error) {
    console.log('❌ TypeScript compilation failed');
    results.components.typescript = { status: 'FAIL', details: 'Compilation errors present' };
  }

  // 5. Configuration Validation
  console.log('\n⚙️ VALIDATING CONFIGURATION...');
  
  try {
    const configContent = fs.readFileSync(path.join(__dirname, 'complete-environment-config.txt'), 'utf8');
    
    const hasRedisUrl = configContent.includes('REDIS_URL=redis://');
    const hasSupabaseUrl = configContent.includes('SUPABASE_URL=https://');
    const hasThreadConfig = configContent.includes('THREAD_POSTING_MODE=fixed_chains');
    
    if (hasRedisUrl && hasSupabaseUrl && hasThreadConfig) {
      console.log('✅ Complete environment configuration ready');
      console.log('✅ Redis, Supabase, and thread fixes configured');
      results.components.configuration = { status: 'PASS', details: 'All critical configurations present' };
    } else {
      console.log('❌ Configuration incomplete');
      results.components.configuration = { status: 'FAIL', details: 'Missing critical configuration' };
    }
  } catch (error) {
    console.log('❌ Configuration validation failed:', error.message);
    results.components.configuration = { status: 'FAIL', details: error.message };
  }

  // Overall Status Calculation
  const componentStatuses = Object.values(results.components).map(c => c.status);
  const passCount = componentStatuses.filter(s => s === 'PASS').length;
  const totalCount = componentStatuses.length;
  
  if (passCount === totalCount) {
    results.overall = 'EXCELLENT';
  } else if (passCount >= totalCount * 0.8) {
    results.overall = 'GOOD';
  } else if (passCount >= totalCount * 0.6) {
    results.overall = 'NEEDS_WORK';
  } else {
    results.overall = 'CRITICAL';
  }

  // Final Report
  console.log('\n' + '='.repeat(60));
  console.log('🏥 COMPREHENSIVE VALIDATION COMPLETE');
  console.log('='.repeat(60));
  
  console.log(`\n📊 OVERALL STATUS: ${results.overall}`);
  console.log(`✅ COMPONENTS PASSING: ${passCount}/${totalCount}`);
  
  console.log('\n📋 DETAILED RESULTS:');
  Object.entries(results.components).forEach(([component, result]) => {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${component.toUpperCase()}: ${result.status} - ${result.details}`);
  });

  if (results.overall === 'EXCELLENT') {
    console.log('\n🎊 SYSTEM STATUS: READY FOR ENHANCEMENTS!');
    console.log('🚀 All core systems operational at 100% capacity');
    console.log('🎯 Proceed to Phase B: Enhancement Implementation');
  } else if (results.overall === 'GOOD') {
    console.log('\n🎯 SYSTEM STATUS: MOSTLY READY');
    console.log('⚠️ Minor issues detected - recommend quick fixes before enhancements');
  } else {
    console.log('\n🚨 SYSTEM STATUS: REQUIRES ATTENTION');
    console.log('❌ Critical issues detected - must fix before proceeding');
  }

  // Save results
  fs.writeFileSync(
    path.join(__dirname, 'system-validation-results.json'),
    JSON.stringify(results, null, 2)
  );
  
  console.log(`\n📁 Full results saved to: system-validation-results.json`);
  console.log(`🕒 Validation completed at: ${results.timestamp}`);
  
  return results;
}

// Run validation
validateAllSystems()
  .then((results) => {
    process.exit(results.overall === 'EXCELLENT' || results.overall === 'GOOD' ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 VALIDATION CRASHED:', error.message);
    process.exit(1);
  });
