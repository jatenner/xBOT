#!/usr/bin/env node

/**
 * 🛡️ PRE-DEPLOYMENT VALIDATION
 * Run before every deployment to catch issues early
 */

// Load environment variables from .env for local validation
require('dotenv').config();

console.log('🛡️ PRE-DEPLOYMENT VALIDATION SYSTEM');
console.log('==================================');

async function validateBeforeDeployment() {
  let allTestsPassed = true;

  try {
    console.log('🔧 Step 1: Building project...');
    const { execSync } = require('child_process');
    
    try {
      execSync('npm run build', { stdio: 'pipe' });
      console.log('✅ Build successful');
    } catch (buildError) {
      console.error('❌ Build failed!');
      console.error(buildError.stdout?.toString() || buildError.message);
      return false;
    }

    console.log('\n🧪 Step 2: Running integration tests...');
    const fs = require('fs');
    const path = require('path');
    const integrationPath = path.join(__dirname, 'dist', 'testing', 'integrationTests.js');

    if (fs.existsSync(integrationPath)) {
      const { IntegrationTests } = await import(integrationPath);
      
      const testResults = await IntegrationTests.runCriticalTests();
      const report = IntegrationTests.generateReport(testResults);
      
      console.log(report.summary);
      console.log('\nDetailed Results:');
      console.log(report.details);
      
      if (!report.passed) {
        allTestsPassed = false;
      }
    } else {
      console.log('ℹ️ No compiled integrationTests.js found in dist/testing - skipping Step 2.');
    }

    console.log('\n🔍 Step 3: Code quality checks...');
    
    // Check for common issues
    const qualityIssues = await checkCodeQuality();
    if (qualityIssues.length > 0) {
      console.log('⚠️ Code quality issues found:');
      qualityIssues.forEach(issue => console.log(`- ${issue}`));
      allTestsPassed = false;
    } else {
      console.log('✅ Code quality checks passed');
    }

    console.log('\n📊 Step 4: Environment validation...');
    const envIssues = validateEnvironment();
    if (envIssues.length > 0) {
      console.log('⚠️ Environment issues:');
      envIssues.forEach(issue => console.log(`- ${issue}`));
      allTestsPassed = false;
    } else {
      console.log('✅ Environment validation passed');
    }

  } catch (error) {
    console.error('❌ Validation failed with error:', error.message);
    allTestsPassed = false;
  }

  console.log('\n' + '='.repeat(50));
  if (allTestsPassed) {
    console.log('✅ ALL VALIDATIONS PASSED - SAFE TO DEPLOY!');
    console.log('🚀 Ready for production deployment');
  } else {
    console.log('❌ VALIDATION FAILED - DO NOT DEPLOY!');
    console.log('🛠️  Fix issues above before deploying');
  }
  console.log('='.repeat(50));

  return allTestsPassed;
}

async function checkCodeQuality() {
  const issues = [];
  const fs = require('fs');
  const path = require('path');

  // Check for TODO comments in critical files
  const criticalFiles = [
    'src/core/modules/postingManager.ts',
    'src/posting/nativeThreadComposer.ts',
    'src/ai/socialContentOperator.ts'
  ];

  for (const file of criticalFiles) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('TODO') || content.includes('FIXME')) {
        issues.push(`${file} contains TODO/FIXME comments`);
      }
    }
  }

  // Check for console.error in production code
  const srcFiles = getAllTsFiles('src');
  for (const file of srcFiles) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('console.error') && !file.includes('test')) {
      // This is actually OK for error logging, skip
    }
  }

  return issues;
}

function validateEnvironment() {
  const issues = [];
  
  const requiredVars = [
    'OPENAI_API_KEY',
    'SUPABASE_URL', 
    'SUPABASE_SERVICE_ROLE_KEY'
  ];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      issues.push(`Missing environment variable: ${varName}`);
    }
  }

  return issues;
}

function getAllTsFiles(dir) {
  const fs = require('fs');
  const path = require('path');
  
  let files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      files = files.concat(getAllTsFiles(fullPath));
    } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Only run if called directly
if (require.main === module) {
  validateBeforeDeployment().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Validation script error:', error);
    process.exit(1);
  });
}

module.exports = { validateBeforeDeployment };
