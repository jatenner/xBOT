#!/usr/bin/env node

/**
 * RAILWAY PROJECT CONNECTOR - UPDATED
 * Automatically fixes Railway CLI connection to XBOT project
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RAILWAY_CONFIG_PATH = path.join(process.env.HOME, '.railway', 'config.json');
const XBOT_PROJECT_PATH = '/Users/jonahtenner/Desktop/xBOT';
const XBOT_PROJECT_ID = 'c987ff2e-2bc7-4c65-9187-11c1a82d4ac1';
const XBOT_ENV_ID = '253a53f1-f80e-401a-8a7f-afdcf2648fad';
const XBOT_SERVICE_ID = '21eb1b60-57f1-40fe-bd0e-d589345fc37f';

class RailwayFixer {
  constructor() {
    console.log('🔧 RAILWAY PROJECT CONNECTOR (UPDATED)');
    console.log('======================================');
  }

  exec(command, silent = true) {
    try {
      return {
        success: true,
        output: execSync(command, { 
          encoding: 'utf-8',
          stdio: silent ? 'pipe' : 'inherit',
          timeout: 10000 
        })
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async fixRailwayConnection() {
    try {
      console.log('🔍 Checking Railway configuration...');
      
      // Check if config exists
      if (!fs.existsSync(RAILWAY_CONFIG_PATH)) {
        console.log('❌ Railway config not found - please run: railway login');
        return false;
      }
      
      // Read current config
      const config = JSON.parse(fs.readFileSync(RAILWAY_CONFIG_PATH, 'utf8'));
      console.log('✅ Railway config found');
      
      // Check current project link
      const currentProject = config.projects?.[XBOT_PROJECT_PATH];
      
      if (currentProject?.name === 'XBOT' && currentProject?.service === XBOT_SERVICE_ID) {
        console.log('✅ Already correctly linked to XBOT project!');
        return true;
      }

      // Backup config
      const backupPath = RAILWAY_CONFIG_PATH + '.backup.' + Date.now();
      fs.writeFileSync(backupPath, JSON.stringify(config, null, 2));
      console.log(`📋 Backed up config to: ${backupPath}`);
      
      // Update the project link
      console.log('🔗 Linking to XBOT project...');
      
      config.projects = config.projects || {};
      config.projects[XBOT_PROJECT_PATH] = {
        projectPath: XBOT_PROJECT_PATH,
        name: 'XBOT',
        project: XBOT_PROJECT_ID,
        environment: XBOT_ENV_ID,
        environmentName: 'production',
        service: XBOT_SERVICE_ID
      };

      // Remove any temp project links
      if (config.projects['/private/tmp']) {
        delete config.projects['/private/tmp'];
      }
      if (config.projects['/tmp']) {
        delete config.projects['/tmp'];
      }
      
      // Write updated config
      fs.writeFileSync(RAILWAY_CONFIG_PATH, JSON.stringify(config, null, 2));
      console.log('✅ Successfully linked to XBOT project!');
      
      return true;
      
    } catch (error) {
      console.error('❌ Failed to fix Railway connection:', error.message);
      return false;
    }
  }

  async testConnection() {
    try {
      console.log('🧪 Testing Railway connection...');
      
      // Test authentication
      const whoami = this.exec('railway whoami');
      if (!whoami.success) {
        console.log('❌ Not authenticated - run: railway login');
        return false;
      }
      console.log(`✅ Authenticated as: ${whoami.output.trim()}`);
      
      // Test project connection
      const status = this.exec('railway status');
      if (!status.success) {
        console.log('⚠️ Project not connected');
        return false;
      }
      
      console.log('✅ Railway project connected:');
      console.log(status.output);
      return true;
      
    } catch (error) {
      console.log('❌ Railway CLI test failed:', error.message);
      return false;
    }
  }

  displayHelp() {
    console.log('\n🎯 USEFUL RAILWAY COMMANDS:');
    console.log('   railway status           - Check connection status');
    console.log('   railway logs             - View live logs (Ctrl+C to stop)');
    console.log('   railway variables        - View environment variables');
    console.log('   railway open             - Open project in browser');
    console.log('   railway link             - Re-link to different project');
    console.log('\n📝 HELPER SCRIPTS:');
    console.log('   node railway-diagnostic.js           - Run comprehensive diagnostics');
    console.log('   node railway-diagnostic.js --logs    - Diagnostics + recent logs');
    console.log('   node bulletproof_system_monitor.js   - Direct API monitoring');
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
      console.log('\n✅ Railway connection fixed!');
      console.log('🔄 Testing connection again...\n');
      await fixer.testConnection();
    } else {
      console.log('\n❌ Could not fix Railway connection automatically');
      console.log('💡 Please run: railway login');
    }
  } else {
    console.log('\n✅ Railway connection is working perfectly!');
  }
  
  fixer.displayHelp();
}

main().catch(console.error);
