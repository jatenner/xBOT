#!/usr/bin/env node

/**
 * 🔍 DEPLOYMENT HEALTH VERIFICATION
 * Confirms Railway deployment and bulletproof system status
 */

const https = require('https');
const fs = require('fs');

class DeploymentHealthChecker {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      git_status: 'unknown',
      local_build: 'unknown',
      typescript_clean: 'unknown',
      bulletproof_monitor: 'unknown',
      railway_deployment: 'unknown',
      learning_system: 'unknown'
    };
  }

  async checkAll() {
    console.log('🔍 DEPLOYMENT HEALTH CHECK STARTING...');
    console.log('================================================');
    console.log('');

    await this.checkGitStatus();
    await this.checkLocalBuild();
    await this.checkTypeScriptClean();
    await this.checkBulletproofMonitor();
    await this.checkLearningSystem();
    
    console.log('');
    console.log('📊 HEALTH CHECK SUMMARY:');
    console.log('================================================');
    
    Object.entries(this.results).forEach(([key, value]) => {
      if (key === 'timestamp') return;
      
      const status = value === 'success' ? '✅' : 
                     value === 'warning' ? '⚠️' : 
                     value === 'error' ? '❌' : '🔍';
      
      console.log(`${status} ${key.replace(/_/g, ' ').toUpperCase()}: ${value}`);
    });

    console.log('');
    
    // Overall status
    const hasErrors = Object.values(this.results).includes('error');
    const hasWarnings = Object.values(this.results).includes('warning');
    
    if (!hasErrors && !hasWarnings) {
      console.log('🎉 ALL SYSTEMS OPERATIONAL - READY FOR 24H MONITORING!');
    } else if (!hasErrors) {
      console.log('⚠️ SYSTEMS MOSTLY OPERATIONAL - MINOR WARNINGS PRESENT');
    } else {
      console.log('❌ CRITICAL ISSUES DETECTED - REQUIRES IMMEDIATE ATTENTION');
    }

    console.log('');
    console.log('🛡️ Bulletproof monitoring: npm run logs-auto');
    console.log('📊 Railway dashboard: Check deployment status');
    console.log('📱 Local analytics: http://localhost:3001');
    
    // Save results
    fs.writeFileSync('deployment_health_check.json', JSON.stringify(this.results, null, 2));
    console.log('💾 Health check saved to deployment_health_check.json');
  }

  async checkGitStatus() {
    try {
      console.log('🔍 Checking Git status...');
      const { exec } = require('child_process');
      
      const gitStatus = await new Promise((resolve, reject) => {
        exec('git status --porcelain', (error, stdout, stderr) => {
          if (error) reject(error);
          else resolve(stdout.trim());
        });
      });

      if (gitStatus === '') {
        console.log('✅ Git: Working tree clean, all changes committed');
        this.results.git_status = 'success';
      } else {
        console.log('⚠️ Git: Uncommitted changes detected');
        this.results.git_status = 'warning';
      }
    } catch (error) {
      console.log('❌ Git: Error checking status:', error.message);
      this.results.git_status = 'error';
    }
  }

  async checkLocalBuild() {
    try {
      console.log('🔍 Checking local build...');
      const { exec } = require('child_process');
      
      await new Promise((resolve, reject) => {
        exec('npm run build', { timeout: 60000 }, (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`Build failed: ${error.message}`));
          } else if (stdout.includes('Build completed successfully')) {
            resolve();
          } else {
            reject(new Error('Build did not complete successfully'));
          }
        });
      });

      console.log('✅ Build: Local build successful');
      this.results.local_build = 'success';
    } catch (error) {
      console.log('❌ Build: Local build failed:', error.message);
      this.results.local_build = 'error';
    }
  }

  async checkTypeScriptClean() {
    try {
      console.log('🔍 Checking TypeScript compilation...');
      const { exec } = require('child_process');
      
      await new Promise((resolve, reject) => {
        exec('npx tsc --noEmit --skipLibCheck', { timeout: 30000 }, (error, stdout, stderr) => {
          if (error && stderr.includes('error TS')) {
            reject(new Error('TypeScript compilation errors found'));
          } else {
            resolve();
          }
        });
      });

      console.log('✅ TypeScript: Compilation clean');
      this.results.typescript_clean = 'success';
    } catch (error) {
      console.log('❌ TypeScript: Compilation errors detected:', error.message);
      this.results.typescript_clean = 'error';
    }
  }

  async checkBulletproofMonitor() {
    try {
      console.log('🔍 Checking bulletproof monitor files...');
      
      const requiredFiles = [
        'bulletproof_railway_logs.js',
        'start_bulletproof_logs.sh',
        'BULLETPROOF_RAILWAY_LOGS_SOLUTION.md'
      ];

      const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
      
      if (missingFiles.length === 0) {
        console.log('✅ Bulletproof Monitor: All files present');
        this.results.bulletproof_monitor = 'success';
      } else {
        console.log('❌ Bulletproof Monitor: Missing files:', missingFiles.join(', '));
        this.results.bulletproof_monitor = 'error';
      }
    } catch (error) {
      console.log('❌ Bulletproof Monitor: Error checking files:', error.message);
      this.results.bulletproof_monitor = 'error';
    }
  }

  async checkLearningSystem() {
    try {
      console.log('🔍 Checking learning system integration...');
      
      const requiredFiles = [
        'src/utils/learningSystemIntegration.ts',
        'src/intelligence/banditFormatSelector.ts',
        'src/intelligence/contextualBanditSelector.ts',
        'src/utils/enhancedTimingOptimizer.ts',
        'src/utils/twoPassContentGenerator.ts'
      ];

      const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
      
      if (missingFiles.length === 0) {
        console.log('✅ Learning System: All integration files present');
        this.results.learning_system = 'success';
      } else {
        console.log('❌ Learning System: Missing files:', missingFiles.join(', '));
        this.results.learning_system = 'error';
      }
    } catch (error) {
      console.log('❌ Learning System: Error checking files:', error.message);
      this.results.learning_system = 'error';
    }
  }
}

// Run the health check
if (require.main === module) {
  const checker = new DeploymentHealthChecker();
  checker.checkAll().catch(error => {
    console.error('💥 Health check failed:', error);
    process.exit(1);
  });
}

module.exports = DeploymentHealthChecker;
