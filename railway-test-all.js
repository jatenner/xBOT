#!/usr/bin/env node

/**
 * COMPREHENSIVE RAILWAY CONNECTION TEST
 * Tests all aspects of Railway CLI integration
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🧪 COMPREHENSIVE RAILWAY CLI TEST SUITE\n');
console.log('='.repeat(80) + '\n');

const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

function exec(command, silent = true) {
  try {
    const output = execSync(command, { 
      encoding: 'utf-8',
      stdio: silent ? 'pipe' : 'inherit',
      timeout: 10000 
    });
    return { success: true, output };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function pass(message) {
  passed++;
  console.log(`✅ ${message}`);
}

function fail(message, error = null) {
  failed++;
  console.log(`❌ ${message}`);
  if (error) console.log(`   Error: ${error}`);
}

// Test 1: Railway CLI Installation
test('Railway CLI Installation', () => {
  const result = exec('which railway');
  if (result.success) {
    pass(`Railway CLI installed at: ${result.output.trim()}`);
  } else {
    fail('Railway CLI not found');
  }
});

// Test 2: Railway CLI Version
test('Railway CLI Version', () => {
  const result = exec('railway --version');
  if (result.success) {
    pass(`Version: ${result.output.trim()}`);
  } else {
    fail('Could not get Railway CLI version');
  }
});

// Test 3: Authentication
test('Authentication', () => {
  const result = exec('railway whoami');
  if (result.success) {
    pass(`Authenticated as: ${result.output.trim()}`);
  } else {
    fail('Not authenticated', result.error);
  }
});

// Test 4: Configuration File
test('Configuration File', () => {
  const configPath = require('path').join(process.env.HOME, '.railway', 'config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    pass(`Config file exists with ${Object.keys(config.projects || {}).length} project(s)`);
  } else {
    fail('Config file not found');
  }
});

// Test 5: Project Link
test('Project Link', () => {
  const result = exec('railway status');
  if (result.success) {
    const output = result.output;
    if (output.includes('XBOT')) {
      pass('Correctly linked to XBOT project');
    } else {
      fail('Linked to wrong project', output);
    }
  } else {
    fail('Project not linked', result.error);
  }
});

// Test 6: Service Link
test('Service Link', () => {
  const result = exec('railway status');
  if (result.success) {
    const output = result.output;
    if (output.includes('xBOT')) {
      pass('Service xBOT is linked');
    } else {
      fail('Service not linked', output);
    }
  } else {
    fail('Could not check service', result.error);
  }
});

// Test 7: Environment
test('Environment', () => {
  const result = exec('railway status');
  if (result.success) {
    const output = result.output;
    if (output.includes('production')) {
      pass('Environment: production');
    } else {
      fail('Wrong environment', output);
    }
  } else {
    fail('Could not check environment', result.error);
  }
});

// Test 8: Variables Access
test('Variables Access', () => {
  const result = exec('railway variables');
  if (result.success) {
    pass('Can access environment variables');
  } else {
    fail('Cannot access variables', result.error);
  }
});

// Test 9: Domain Access
test('Domain Access', () => {
  const result = exec('railway domain');
  if (result.success) {
    const match = result.output.match(/https:\/\/[^\s]+/);
    if (match) {
      pass(`Domain: ${match[0]}`);
    } else {
      pass('Domain command works');
    }
  } else {
    fail('Cannot access domain', result.error);
  }
});

// Test 10: JSON Status
test('JSON Status', () => {
  const result = exec('railway status --json');
  if (result.success) {
    try {
      const data = JSON.parse(result.output);
      if (data.id === 'c987ff2e-2bc7-4c65-9187-11c1a82d4ac1') {
        pass('JSON status returns correct project ID');
      } else {
        fail('Wrong project ID in JSON status');
      }
    } catch (e) {
      fail('Invalid JSON response', e.message);
    }
  } else {
    fail('Cannot get JSON status', result.error);
  }
});

// Test 11: Helper Scripts
test('Helper Scripts', () => {
  const scripts = [
    'railway-diagnostic.js',
    'railway-logs.js',
    'fix_railway_connection.js'
  ];
  
  const missing = scripts.filter(s => !fs.existsSync(s));
  if (missing.length === 0) {
    pass('All helper scripts exist');
  } else {
    fail(`Missing scripts: ${missing.join(', ')}`);
  }
});

// Test 12: NPM Scripts
test('NPM Scripts', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  const railwayScripts = Object.keys(pkg.scripts).filter(s => s.startsWith('railway:'));
  if (railwayScripts.length >= 5) {
    pass(`${railwayScripts.length} Railway npm scripts configured`);
  } else {
    fail('Missing Railway npm scripts');
  }
});

// Run all tests
async function runTests() {
  for (const { name, fn } of tests) {
    console.log(`\n📋 Test: ${name}`);
    await fn();
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total:  ${tests.length}`);
  
  if (failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Railway CLI is fully functional.\n');
  } else {
    console.log(`\n⚠️  ${failed} test(s) failed. Run diagnostics for details:\n`);
    console.log('   node railway-diagnostic.js\n');
  }
  
  console.log('Quick Commands:');
  console.log('  npm run railway:status     - Check status');
  console.log('  npm run railway:logs       - View logs');
  console.log('  npm run railway:diagnostic - Run diagnostics');
  console.log('  npm run railway:fix        - Fix connection');
  console.log('');
  
  process.exit(failed === 0 ? 0 : 1);
}

runTests().catch(console.error);

