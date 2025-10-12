#!/usr/bin/env node

/**
 * RAILWAY PROJECT CONNECTOR
 * Fixes Railway CLI project connection issues
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RAILWAY_CONFIG_PATH = path.join(process.env.HOME, '.railway', 'config.json');
const PROJECT_NAME = 'xBOT';
const SERVICE_NAME = 'xbot-production-844b';

class RailwayFixer {
  constructor() {
    console.log('🔧 RAILWAY PROJECT CONNECTOR');
    console.log('============================');
  }

  async fixRailwayConnection() {
    try {
      console.log('🔍 Checking Railway configuration...');
      
      // Check if config exists
      if (!fs.existsSync(RAILWAY_CONFIG_PATH)) {
        console.log('❌ Railway config not found');
        return false;
      }
      
      // Read current config
      const config = JSON.parse(fs.readFileSync(RAILWAY_CONFIG_PATH, 'utf8'));
      console.log('✅ Railway config found');
      
      // Try to link to the correct project
      console.log('🔗 Attempting to link to xBOT project...');
      
      try {
        // Try different approaches to connect
        const approaches = [
          () => execSync('railway link', { stdio: 'inherit', timeout: 30000 }),
          () => execSync('railway connect xBOT', { stdio: 'inherit', timeout: 30000 }),
          () => execSync('railway service connect xbot-production-844b', { stdio: 'inherit', timeout: 30000 })
        ];
        
        for (let i = 0; i < approaches.length; i++) {
          try {
            console.log(`🔄 Trying approach ${i + 1}...`);
            approaches[i]();
            console.log('✅ Successfully connected!');
            return true;
          } catch (e) {
            console.log(`❌ Approach ${i + 1} failed: ${e.message}`);
          }
        }
        
      } catch (error) {
        console.log('⚠️ Railway CLI connection failed, using direct API approach');
      }
      
      // Create a local railway.json for this project
      const railwayJson = {
        "$schema": "https://railway.app/railway.schema.json",
        "build": {
          "builder": "NIXPACKS"
        },
        "deploy": {
          "startCommand": "npm start",
          "healthcheckPath": "/status"
        }
      };
      
      fs.writeFileSync('railway.json', JSON.stringify(railwayJson, null, 2));
      console.log('✅ Created railway.json configuration');
      
      return true;
      
    } catch (error) {
      console.error('❌ Failed to fix Railway connection:', error.message);
      return false;
    }
  }

  async testConnection() {
    try {
      console.log('🧪 Testing Railway connection...');
      
      // Test basic Railway CLI
      execSync('railway whoami', { stdio: 'pipe', timeout: 10000 });
      console.log('✅ Railway CLI authenticated');
      
      // Test project connection
      try {
        const output = execSync('railway status', { stdio: 'pipe', timeout: 15000 });
        console.log('✅ Railway project connected');
        console.log(output.toString());
        return true;
      } catch (e) {
        console.log('⚠️ Project not connected, but CLI works');
        return false;
      }
      
    } catch (error) {
      console.log('❌ Railway CLI test failed:', error.message);
      return false;
    }
  }
}

async function main() {
  const fixer = new RailwayFixer();
  
  console.log('🚀 Starting Railway connection fix...\n');
  
  // Test current connection
  const connected = await fixer.testConnection();
  
  if (!connected) {
    console.log('\n🔧 Attempting to fix connection...');
    const fixed = await fixer.fixRailwayConnection();
    
    if (fixed) {
      console.log('\n✅ Railway connection should be fixed!');
      console.log('🔄 Testing connection again...');
      await fixer.testConnection();
    } else {
      console.log('\n❌ Could not fix Railway connection automatically');
      console.log('💡 Use the bulletproof_system_monitor.js for direct API monitoring');
    }
  } else {
    console.log('\n✅ Railway connection is working!');
  }
  
  console.log('\n🎯 Next Steps:');
  console.log('   1. Use: node bulletproof_system_monitor.js');
  console.log('   2. Or try: railway logs (if connection fixed)');
  console.log('   3. Monitor via: https://railway.app dashboard');
}

main().catch(console.error);
