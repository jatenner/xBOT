#!/usr/bin/env node

/**
 * Quick health check for Railway deployment
 * Monitors the latest deployment and shows real-time status
 */

const { execSync } = require('child_process');

function exec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

console.log('\n🏥 DEPLOYMENT HEALTH MONITOR\n');
console.log('━'.repeat(70));

// Get Railway status
console.log('\n📊 Railway Status:');
const status = exec('railway status');
console.log(status);

console.log('\n━'.repeat(70));
console.log('\n📝 Recent Deployment Logs (last 30 lines):');
console.log('   Looking for startup errors...\n');

// Get recent logs
const logs = exec('railway logs --limit 30');
console.log(logs);

console.log('\n━'.repeat(70));
console.log('\n💡 TIPS:');
console.log('   • If you see "Healthcheck failed", check Deploy Logs in Railway dashboard');
console.log('   • Look for errors like "EADDRINUSE", "Cannot find module", etc.');
console.log('   • The health endpoint should respond at: /status');
console.log('   • Server should bind to 0.0.0.0:PORT (not localhost)');
console.log('\n━'.repeat(70));

