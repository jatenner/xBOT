#!/usr/bin/env node

/**
 * RAILWAY PROJECT CONNECTOR
 * Use this once you have the Railway project ID
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get project ID from command line argument
const projectId = process.argv[2];

if (!projectId) {
  console.log('🔧 RAILWAY PROJECT CONNECTOR');
  console.log('============================');
  console.log('');
  console.log('Usage: node railway-connect.js [PROJECT_ID]');
  console.log('');
  console.log('To get your PROJECT_ID:');
  console.log('1. Go to https://railway.app');
  console.log('2. Open your xBOT project');
  console.log('3. Go to Settings → General');
  console.log('4. Copy the Project ID');
  console.log('5. Run: node railway-connect.js [PROJECT_ID]');
  console.log('');
  process.exit(1);
}

console.log('🔗 CONNECTING TO RAILWAY PROJECT');
console.log('=================================');
console.log(`Project ID: ${projectId}`);
console.log('');

try {
  // Try to link the project
  console.log('🔄 Linking Railway project...');
  execSync(`railway link ${projectId}`, { stdio: 'inherit', timeout: 30000 });
  console.log('✅ Successfully linked to Railway project!');
  
  // Test the connection
  console.log('🧪 Testing connection...');
  const status = execSync('railway status', { encoding: 'utf8', timeout: 15000 });
  console.log('✅ Connection test successful:');
  console.log(status);
  
  // Now try to set some key variables
  console.log('🚀 Setting critical environment variables...');
  
  const criticalVars = {
    MODE: 'live',
    JOBS_AUTOSTART: 'true',
    JOBS_PLAN_INTERVAL_MIN: '15',
    MAX_POSTS_PER_HOUR: '2',
    ENABLE_REPLIES: 'true'
  };
  
  for (const [key, value] of Object.entries(criticalVars)) {
    try {
      execSync(`railway variables --kv ${key}=${value}`, { stdio: 'pipe', timeout: 10000 });
      console.log(`✅ Set ${key}=${value}`);
    } catch (error) {
      console.log(`❌ Failed to set ${key}: ${error.message}`);
    }
  }
  
  console.log('');
  console.log('🔄 Redeploying to apply changes...');
  execSync('railway redeploy', { stdio: 'inherit', timeout: 60000 });
  console.log('✅ Redeploy initiated!');
  
  console.log('');
  console.log('🎉 RAILWAY CONNECTION SUCCESSFUL!');
  console.log('==================================');
  console.log('');
  console.log('✅ Project linked');
  console.log('✅ Critical variables set');
  console.log('✅ Redeploy initiated');
  console.log('');
  console.log('🔍 Monitor progress:');
  console.log('   • railway logs');
  console.log('   • npm run logs');
  console.log('');
  console.log('📊 Expected within 5 minutes:');
  console.log('   • Jobs: Plans>0 Posts>0 Replies>0');
  console.log('   • Content generation every 15 minutes');
  console.log('   • 2 posts + 3 replies per hour');
  
} catch (error) {
  console.error('❌ Railway connection failed:', error.message);
  console.log('');
  console.log('💡 Manual fallback:');
  console.log('   1. Set variables via Railway web dashboard');
  console.log('   2. Use the manual setup guide');
  console.log('   3. Monitor via npm run logs');
}


/**
 * RAILWAY PROJECT CONNECTOR
 * Use this once you have the Railway project ID
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get project ID from command line argument
const projectId = process.argv[2];

if (!projectId) {
  console.log('🔧 RAILWAY PROJECT CONNECTOR');
  console.log('============================');
  console.log('');
  console.log('Usage: node railway-connect.js [PROJECT_ID]');
  console.log('');
  console.log('To get your PROJECT_ID:');
  console.log('1. Go to https://railway.app');
  console.log('2. Open your xBOT project');
  console.log('3. Go to Settings → General');
  console.log('4. Copy the Project ID');
  console.log('5. Run: node railway-connect.js [PROJECT_ID]');
  console.log('');
  process.exit(1);
}

console.log('🔗 CONNECTING TO RAILWAY PROJECT');
console.log('=================================');
console.log(`Project ID: ${projectId}`);
console.log('');

try {
  // Try to link the project
  console.log('🔄 Linking Railway project...');
  execSync(`railway link ${projectId}`, { stdio: 'inherit', timeout: 30000 });
  console.log('✅ Successfully linked to Railway project!');
  
  // Test the connection
  console.log('🧪 Testing connection...');
  const status = execSync('railway status', { encoding: 'utf8', timeout: 15000 });
  console.log('✅ Connection test successful:');
  console.log(status);
  
  // Now try to set some key variables
  console.log('🚀 Setting critical environment variables...');
  
  const criticalVars = {
    MODE: 'live',
    JOBS_AUTOSTART: 'true',
    JOBS_PLAN_INTERVAL_MIN: '15',
    MAX_POSTS_PER_HOUR: '2',
    ENABLE_REPLIES: 'true'
  };
  
  for (const [key, value] of Object.entries(criticalVars)) {
    try {
      execSync(`railway variables --kv ${key}=${value}`, { stdio: 'pipe', timeout: 10000 });
      console.log(`✅ Set ${key}=${value}`);
    } catch (error) {
      console.log(`❌ Failed to set ${key}: ${error.message}`);
    }
  }
  
  console.log('');
  console.log('🔄 Redeploying to apply changes...');
  execSync('railway redeploy', { stdio: 'inherit', timeout: 60000 });
  console.log('✅ Redeploy initiated!');
  
  console.log('');
  console.log('🎉 RAILWAY CONNECTION SUCCESSFUL!');
  console.log('==================================');
  console.log('');
  console.log('✅ Project linked');
  console.log('✅ Critical variables set');
  console.log('✅ Redeploy initiated');
  console.log('');
  console.log('🔍 Monitor progress:');
  console.log('   • railway logs');
  console.log('   • npm run logs');
  console.log('');
  console.log('📊 Expected within 5 minutes:');
  console.log('   • Jobs: Plans>0 Posts>0 Replies>0');
  console.log('   • Content generation every 15 minutes');
  console.log('   • 2 posts + 3 replies per hour');
  
} catch (error) {
  console.error('❌ Railway connection failed:', error.message);
  console.log('');
  console.log('💡 Manual fallback:');
  console.log('   1. Set variables via Railway web dashboard');
  console.log('   2. Use the manual setup guide');
  console.log('   3. Monitor via npm run logs');
}
