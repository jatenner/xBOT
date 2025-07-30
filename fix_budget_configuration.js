#!/usr/bin/env node

/**
 * 🔧 BUDGET CONFIGURATION FIX
 * Ensures Railway environment has correct $7.50 budget settings
 */

const { spawn } = require('child_process');

async function setRailwayEnvVar(key, value) {
  return new Promise((resolve, reject) => {
    console.log(`🔧 Setting ${key}=${value}`);
    
    const process = spawn('railway', ['variables', 'set', `${key}=${value}`], {
      stdio: ['inherit', 'pipe', 'pipe']
    });
    
    let output = '';
    process.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      output += data.toString();
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${key} set successfully`);
        resolve(output);
      } else {
        console.log(`❌ Failed to set ${key}: ${output}`);
        reject(new Error(`Railway command failed with code ${code}`));
      }
    });
  });
}

async function fixBudgetConfiguration() {
  console.log('🔧 FIXING RAILWAY BUDGET CONFIGURATION');
  console.log('======================================');
  console.log('');
  
  try {
    // Set correct budget configuration
    await setRailwayEnvVar('DAILY_BUDGET_LIMIT', '7.5');
    await setRailwayEnvVar('EMERGENCY_BUDGET_LIMIT', '7.25');
    await setRailwayEnvVar('BUDGET_LOCKDOWN_THRESHOLD', '7.0');
    await setRailwayEnvVar('ENABLE_EMERGENCY_LOCKDOWN', 'true');
    
    console.log('');
    console.log('✅ BUDGET CONFIGURATION FIXED!');
    console.log('==============================');
    console.log('💰 Daily Budget Limit: $7.50');
    console.log('🚨 Emergency Lockdown: $7.25 (when 97% spent)');
    console.log('⚠️  Warning Threshold: $7.00 (when 93% spent)');
    console.log('🛡️ Emergency Protection: ENABLED');
    console.log('');
    console.log('🎯 Your bot can now operate with the full $7.50 budget!');
    
  } catch (error) {
    console.error('❌ Failed to fix budget configuration:', error.message);
    console.log('');
    console.log('🔧 MANUAL FIX REQUIRED:');
    console.log('Please run these commands in Railway dashboard or CLI:');
    console.log('');
    console.log('railway variables set DAILY_BUDGET_LIMIT=7.5');
    console.log('railway variables set EMERGENCY_BUDGET_LIMIT=7.25');
    console.log('railway variables set BUDGET_LOCKDOWN_THRESHOLD=7.0');
    console.log('railway variables set ENABLE_EMERGENCY_LOCKDOWN=true');
  }
}

if (require.main === module) {
  fixBudgetConfiguration();
}

module.exports = { fixBudgetConfiguration, setRailwayEnvVar };
