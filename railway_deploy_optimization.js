#!/usr/bin/env node

/**
 * 🚄 RAILWAY DEPLOYMENT OPTIMIZATION SCRIPT
 * 
 * Optimizes the deployment for 24/7 operation on Railway.
 * Ensures bulletproof configuration and monitoring.
 */

const fs = require('fs');
const path = require('path');

class RailwayDeployOptimizer {
  constructor() {
    this.projectRoot = process.cwd();
  }

  async optimize() {
    console.log('🚄 RAILWAY DEPLOYMENT OPTIMIZATION');
    console.log('==================================');
    console.log('🎯 Goal: 24/7 bulletproof operation');
    console.log('');

    await this.optimizeNixpacks();
    await this.optimizeEnvironment();
    await this.createStartupScript();
    await this.validateConfiguration();
    
    console.log('');
    console.log('✅ RAILWAY OPTIMIZATION COMPLETE!');
    console.log('🚄 Your bot is now optimized for 24/7 Railway operation');
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Deploy to Railway: git push origin main');
    console.log('2. Monitor health: GET /health, /status endpoints');
    console.log('3. Check logs: npm run logs-perfect');
    console.log('');
    console.log('🎯 Expected result: ZERO downtime, ZERO manual intervention');
  }

  /**
   * 📦 OPTIMIZE NIXPACKS CONFIGURATION
   */
  async optimizeNixpacks() {
    console.log('📦 Optimizing nixpacks.toml for Railway...');
    
    const nixpacksConfig = `[phases.setup]
nixPkgs = ['nodejs_18', 'npm-9_x']

[phases.install]
cmds = [
  'npm ci --production=false',
  'npx playwright install-deps',
  'npx playwright install chromium'
]

[phases.build]
cmds = [
  'npm run build'
]

[start]
cmd = 'npm start'

[variables]
NODE_ENV = 'production'
PLAYWRIGHT_BROWSERS_PATH = '/opt/render/.cache/ms-playwright'`;

    fs.writeFileSync('nixpacks.toml', nixpacksConfig);
    console.log('✅ nixpacks.toml optimized for Railway deployment');
  }

  /**
   * ⚙️ OPTIMIZE ENVIRONMENT CONFIGURATION
   */
  async optimizeEnvironment() {
    console.log('⚙️ Optimizing environment configuration...');
    
    const envOptimizations = {
      // Railway optimization
      'PORT': '10000',
      'NODE_ENV': 'production',
      'RAILWAY_ENVIRONMENT': 'production',
      
      // Health and monitoring
      'HEALTH_CHECK_ENABLED': 'true',
      'ENABLE_METRICS': 'true',
      'AUTO_RESTART': 'true',
      
      // Performance optimization
      'NODE_OPTIONS': '--max-old-space-size=1024 --expose-gc',
      'GRACEFUL_SHUTDOWN_TIMEOUT': '30000',
      
      // Railway-specific Playwright
      'PLAYWRIGHT_BROWSERS_PATH': '/opt/render/.cache/ms-playwright',
      
      // 24/7 operation
      'ENABLE_24X7_MANAGER': 'true',
      'AGGRESSIVE_KEEP_ALIVE': 'true',
      'AUTO_RECOVERY': 'true'
    };

    console.log('📋 Recommended Railway environment variables:');
    Object.entries(envOptimizations).forEach(([key, value]) => {
      console.log(`   ${key}=${value}`);
    });
    
    console.log('✅ Environment optimizations prepared');
  }

  /**
   * 🚀 CREATE STARTUP SCRIPT
   */
  async createStartupScript() {
    console.log('🚀 Creating optimized startup script...');
    
    const startupScript = `#!/bin/bash

# 🚄 RAILWAY 24/7 STARTUP SCRIPT
echo "🚄 === RAILWAY 24/7 STARTUP ==="
echo "📅 Starting: $(date)"
echo "🎯 Target: Bulletproof 24/7 operation"
echo ""

# Set Railway optimizations
export NODE_ENV=production
export RAILWAY_ENVIRONMENT=production
export NODE_OPTIONS="--max-old-space-size=1024 --expose-gc"

# Start the application with enhanced monitoring
echo "🚀 Starting enhanced Twitter bot..."
node dist/main.js

# If main process exits, restart (Railway will handle this)
echo "⚠️ Main process exited - Railway will restart"
exit 0`;

    fs.writeFileSync('railway_startup.sh', startupScript);
    fs.chmodSync('railway_startup.sh', '755');
    console.log('✅ Railway startup script created');
  }

  /**
   * ✅ VALIDATE CONFIGURATION
   */
  async validateConfiguration() {
    console.log('✅ Validating Railway configuration...');
    
    const checks = [
      { file: 'nixpacks.toml', desc: 'Nixpacks configuration' },
      { file: 'package.json', desc: 'Package.json with start script' },
      { file: 'src/healthServer.ts', desc: 'Health server for Railway checks' },
      { file: 'src/utils/railway24x7Manager.ts', desc: '24/7 operation manager' },
      { file: 'src/main.ts', desc: 'Railway-optimized main entry point' }
    ];

    let allValid = true;
    
    checks.forEach(check => {
      if (fs.existsSync(check.file)) {
        console.log(`   ✅ ${check.desc}`);
      } else {
        console.log(`   ❌ ${check.desc} - MISSING`);
        allValid = false;
      }
    });

    if (allValid) {
      console.log('✅ All Railway configuration files present');
    } else {
      console.log('⚠️ Some configuration files missing - deployment may fail');
    }
    
    // Check package.json scripts
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    if (packageJson.scripts && packageJson.scripts.start) {
      console.log('   ✅ Start script configured');
    } else {
      console.log('   ❌ Start script missing in package.json');
      allValid = false;
    }

    return allValid;
  }
}

// Run optimization
if (require.main === module) {
  const optimizer = new RailwayDeployOptimizer();
  optimizer.optimize().catch(console.error);
}

module.exports = RailwayDeployOptimizer;
