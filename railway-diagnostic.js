#!/usr/bin/env node

/**
 * COMPREHENSIVE RAILWAY CLI DIAGNOSTIC & HELPER TOOL
 * Diagnoses connection issues and provides actionable solutions
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(process.env.HOME, '.railway', 'config.json');
const XBOT_PROJECT_PATH = '/Users/jonahtenner/Desktop/xBOT';

class RailwayDiagnostic {
  constructor() {
    this.issues = [];
    this.fixes = [];
  }

  log(icon, message, data = null) {
    console.log(`${icon} ${message}`);
    if (data) console.log(`   ${JSON.stringify(data, null, 2)}`);
  }

  error(message, fix = null) {
    this.issues.push(message);
    if (fix) this.fixes.push(fix);
    this.log('❌', message);
    if (fix) this.log('💡', `Fix: ${fix}`);
  }

  success(message) {
    this.log('✅', message);
  }

  info(message) {
    this.log('ℹ️ ', message);
  }

  exec(command, silent = false) {
    try {
      const output = execSync(command, { 
        encoding: 'utf-8',
        stdio: silent ? 'pipe' : 'inherit',
        timeout: 10000
      });
      return { success: true, output };
    } catch (error) {
      return { success: false, error: error.message, stderr: error.stderr?.toString() };
    }
  }

  // Check if Railway CLI is installed
  checkCLIInstalled() {
    this.info('Checking Railway CLI installation...');
    const result = this.exec('which railway', true);
    
    if (result.success) {
      this.success(`Railway CLI installed at: ${result.output.trim()}`);
      
      // Check version
      const version = this.exec('railway --version', true);
      if (version.success) {
        this.success(`Railway CLI version: ${version.output.trim()}`);
      }
      return true;
    } else {
      this.error('Railway CLI not found', 'Install with: npm install -g @railway/cli');
      return false;
    }
  }

  // Check if user is authenticated
  checkAuthentication() {
    this.info('Checking Railway authentication...');
    const result = this.exec('railway whoami', true);
    
    if (result.success) {
      this.success(`Authenticated as: ${result.output.trim()}`);
      return true;
    } else {
      this.error('Not authenticated', 'Run: railway login');
      return false;
    }
  }

  // Check Railway config
  checkConfig() {
    this.info('Checking Railway configuration...');
    
    if (!fs.existsSync(CONFIG_PATH)) {
      this.error('Railway config not found', 'Run: railway login');
      return null;
    }

    try {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      this.success('Railway config file exists');
      return config;
    } catch (error) {
      this.error('Invalid Railway config', 'Run: railway login');
      return null;
    }
  }

  // Check project linking
  checkProjectLink(config) {
    this.info('Checking project link...');
    
    const projectConfig = config?.projects?.[XBOT_PROJECT_PATH];
    
    if (!projectConfig) {
      this.error('xBOT directory not linked to any project', 'Need to link to XBOT project');
      return null;
    }

    this.success(`Linked to project: ${projectConfig.name}`);
    this.success(`  Project ID: ${projectConfig.project}`);
    this.success(`  Environment: ${projectConfig.environmentName}`);
    
    if (projectConfig.service) {
      this.success(`  Service: ${projectConfig.service}`);
    } else {
      this.error('No service linked', 'Need to link to a service');
    }

    return projectConfig;
  }

  // Verify connection
  verifyConnection() {
    this.info('Verifying Railway connection...');
    const result = this.exec('railway status', true);
    
    if (result.success) {
      this.success('Railway connection verified!');
      console.log(result.output);
      return true;
    } else {
      this.error('Railway connection failed', result.stderr || result.error);
      return false;
    }
  }

  // List available projects
  listProjects(config) {
    this.info('Available Railway projects:');
    const projects = new Set();
    
    if (config?.projects) {
      Object.values(config.projects).forEach(p => {
        if (p.name) projects.add(p.name);
      });
    }

    if (projects.size > 0) {
      projects.forEach(name => console.log(`  - ${name}`));
    } else {
      this.error('No projects found');
    }
  }

  // Auto-fix common issues
  async autoFix(config) {
    this.info('Attempting auto-fix...');

    // Check if linked to wrong project
    const projectConfig = config?.projects?.[XBOT_PROJECT_PATH];
    
    if (!projectConfig) {
      this.info('Project not linked. Attempting to link to XBOT...');
      // Note: This would require interactive input, so we just provide instructions
      this.info('Run manually: railway link');
      this.info('Then select: XBOT project, production environment, xBOT service');
      return false;
    }

    if (projectConfig.name !== 'XBOT') {
      this.error(`Linked to wrong project: ${projectConfig.name}`, 
        'Use the fix_railway_connection.js script to switch to XBOT');
      return false;
    }

    if (!projectConfig.service) {
      this.error('No service linked', 
        'Update config to include service ID: 21eb1b60-57f1-40fe-bd0e-d589345fc37f');
      return false;
    }

    this.success('Configuration looks correct!');
    return true;
  }

  // Get recent logs safely
  getRecentLogs() {
    this.info('Fetching recent logs (use Ctrl+C to stop)...');
    console.log('─'.repeat(80));
    
    // Use timeout to prevent hanging
    const result = this.exec('timeout 5 railway logs || railway logs --deployment $(railway list | head -1)', false);
    
    console.log('─'.repeat(80));
  }

  // Generate report
  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('RAILWAY CLI DIAGNOSTIC REPORT');
    console.log('='.repeat(80));

    if (this.issues.length === 0) {
      this.success('All checks passed! Railway CLI is properly configured.');
    } else {
      console.log('\n🔴 ISSUES FOUND:');
      this.issues.forEach((issue, i) => {
        console.log(`  ${i + 1}. ${issue}`);
      });

      if (this.fixes.length > 0) {
        console.log('\n💡 RECOMMENDED FIXES:');
        this.fixes.forEach((fix, i) => {
          console.log(`  ${i + 1}. ${fix}`);
        });
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('QUICK COMMANDS:');
    console.log('  railway status          - Check current project status');
    console.log('  railway logs            - View live logs');
    console.log('  railway variables       - View environment variables');
    console.log('  railway link            - Link to different project');
    console.log('  railway open            - Open project in browser');
    console.log('='.repeat(80) + '\n');
  }

  // Main diagnostic flow
  async run() {
    console.log('\n🔍 RAILWAY CLI COMPREHENSIVE DIAGNOSTIC\n');

    const cliInstalled = this.checkCLIInstalled();
    if (!cliInstalled) {
      this.generateReport();
      return;
    }

    const isAuthenticated = this.checkAuthentication();
    if (!isAuthenticated) {
      this.generateReport();
      return;
    }

    const config = this.checkConfig();
    if (!config) {
      this.generateReport();
      return;
    }

    this.listProjects(config);
    this.checkProjectLink(config);
    
    const connected = this.verifyConnection();
    
    if (!connected) {
      await this.autoFix(config);
    }

    this.generateReport();

    // Offer to show logs
    if (connected && this.issues.length === 0) {
      console.log('\n📋 Would you like to see recent logs? (Run with --logs flag)');
      if (process.argv.includes('--logs')) {
        this.getRecentLogs();
      }
    }
  }
}

// Run diagnostic
const diagnostic = new RailwayDiagnostic();
diagnostic.run().catch(console.error);

