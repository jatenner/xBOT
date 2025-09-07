#!/usr/bin/env node

// Trigger Railway Redeploy
// Makes a small commit to trigger automatic redeployment

const { execSync } = require('child_process');

console.log('🚀 TRIGGERING RAILWAY REDEPLOY...');

try {
  // Create a timestamp file to trigger redeploy
  const timestamp = new Date().toISOString();
  const deployTrigger = `// Auto-redeploy trigger: ${timestamp}\nmodule.exports = { deployedAt: "${timestamp}" };`;
  
  require('fs').writeFileSync('.railway-deploy-trigger.js', deployTrigger);
  
  console.log('📝 Created deploy trigger file');
  
  // Commit and push
  execSync('git add .railway-deploy-trigger.js', { stdio: 'inherit' });
  execSync(`git commit -m "🔄 REDEPLOY: Twitter session updated - ${timestamp}"`, { stdio: 'inherit' });
  execSync('git push', { stdio: 'inherit' });
  
  console.log('✅ Railway redeploy triggered successfully');
  console.log('🔍 Monitor deployment: npm run logs');
  
} catch (error) {
  console.error('❌ Failed to trigger redeploy:', error.message);
  console.log('💡 Manual alternative: Make any small change and git push');
}
