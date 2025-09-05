/**
 * 🔍 VERIFY RAILWAY DEPLOYMENT
 * Check if correct bulletproof system is running in production
 */

console.log('🔍 VERIFYING RAILWAY DEPLOYMENT');
console.log('===============================\n');

console.log('📋 EXPECTED CONFIGURATION');
console.log('=========================');
console.log('✅ Git Commit: f1972e2 (DEPLOY BULLETPROOF SYSTEM)');
console.log('✅ Start Script: "node dist/main-bulletproof.js"');
console.log('✅ System: BulletproofMainSystem');
console.log('✅ Features: Thompson Sampling, Anti-repetition, Persona rotation\n');

console.log('🔍 CHECKING LOCAL BUILD');
console.log('=======================');

const fs = require('fs');
const path = require('path');

// Check if dist files exist
const distFiles = [
  'dist/main.js',
  'dist/main-bulletproof.js',
  'dist/ai/bulletproofPrompts.js',
  'dist/ai/enhancedViralOrchestrator.js',
  'dist/ai/promptEvolutionEngine.js'
];

console.log('Local build files:');
distFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const stats = fs.statSync(file);
    console.log(`✅ ${file} (${Math.round(stats.size/1024)}KB, ${stats.mtime.toLocaleString()})`);
  } else {
    console.log(`❌ ${file} - MISSING`);
  }
});

// Check package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
console.log(`\n📦 Package.json start script: "${packageJson.scripts.start}"`);

if (packageJson.scripts.start === 'node dist/main-bulletproof.js') {
  console.log('✅ Correct start script configured');
} else {
  console.log('❌ Wrong start script! Should be "node dist/main-bulletproof.js"');
}

console.log('\n🔧 DEPLOYMENT VERIFICATION STEPS');
console.log('=================================');

console.log('1. 📦 Check if bulletproof files are built locally');
if (fs.existsSync('dist/main-bulletproof.js')) {
  console.log('   ✅ dist/main-bulletproof.js exists');
} else {
  console.log('   ❌ dist/main-bulletproof.js MISSING - need to rebuild');
}

console.log('\n2. 📋 Check package.json start script');
console.log(`   Current: "${packageJson.scripts.start}"`);
console.log('   Expected: "node dist/main-bulletproof.js"');

console.log('\n3. 🚀 Check git status');
console.log('   Latest commit should include bulletproof deployment');

console.log('\n4. 🔄 Railway deployment status');
console.log('   Need to verify Railway is using latest commit with correct start script');

console.log('\n💡 POTENTIAL ISSUES & FIXES');
console.log('===========================');

const potentialIssues = [
  {
    issue: 'Railway still using old main.js instead of main-bulletproof.js',
    fix: 'Force rebuild and redeploy',
    command: 'npm run build && git add . && git commit -m "Force rebuild" && git push && railway redeploy'
  },
  {
    issue: 'Bulletproof files not in dist directory',
    fix: 'Rebuild TypeScript files',
    command: 'npm run build'
  },
  {
    issue: 'Railway cached old deployment',
    fix: 'Clear Railway cache and redeploy',
    command: 'railway redeploy --force'
  },
  {
    issue: 'Start script not updated in Railway environment',
    fix: 'Redeploy to pick up package.json changes',
    command: 'railway redeploy'
  }
];

potentialIssues.forEach((item, index) => {
  console.log(`\n${index + 1}. ❓ ${item.issue}`);
  console.log(`   🔧 Fix: ${item.fix}`);
  console.log(`   💻 Command: ${item.command}`);
});

console.log('\n🎯 RECOMMENDED ACTIONS');
console.log('======================');

console.log('1. 🔨 FORCE REBUILD AND REDEPLOY');
console.log('   npm run build-clean');
console.log('   git add dist/');
console.log('   git commit -m "🔄 Force rebuild bulletproof system"');
console.log('   git push');
console.log('   railway redeploy');

console.log('\n2. 📊 VERIFY DEPLOYMENT');
console.log('   railway logs | head -20');
console.log('   Look for "BULLETPROOF_SYSTEM" startup messages');

console.log('\n3. 🏥 HEALTH CHECK');
console.log('   Monitor first few posts for quality improvements');
console.log('   Expect: No hashtags, complete sentences, professional tone');

console.log('\n🚨 CRITICAL: ENSURE BULLETPROOF SYSTEM IS ACTIVE');
console.log('===============================================');
console.log('The quality audit showed 95% of posts had hashtags and 90% were incomplete.');
console.log('The bulletproof system fixes ALL these issues, but only when it\'s actually running.');
console.log('We MUST verify the correct system is deployed and active in production.');

module.exports = { verifyDeployment: true };
