#!/usr/bin/env node

/**
 * 🏥 SYSTEM HEALTH CHECK
 * Validates all core components before implementing learning enhancements
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

class SystemHealthChecker {
  constructor() {
    this.results = {
      environment: { status: 'pending', checks: [] },
      database: { status: 'pending', checks: [] },
      build: { status: 'pending', checks: [] },
      posting: { status: 'pending', checks: [] },
      budget: { status: 'pending', checks: [] }
    };
  }

  async runAllChecks() {
    console.log('🏥 === SYSTEM HEALTH CHECK ===\n');
    
    try {
      await this.checkEnvironment();
      await this.checkDatabase();
      await this.checkBuild();
      await this.checkPostingSystem();
      await this.checkBudgetSystem();
      
      this.printResults();
      return this.isSystemHealthy();
    } catch (error) {
      console.error('❌ Health check failed:', error);
      return false;
    }
  }

  async checkEnvironment() {
    console.log('🔧 Checking Environment...');
    
    const requiredEnvVars = [
      'OPENAI_API_KEY',
      'SUPABASE_URL', 
      'SUPABASE_SERVICE_ROLE_KEY',
      'TWITTER_API_KEY',
      'TWITTER_API_SECRET',
      'TWITTER_ACCESS_TOKEN',
      'TWITTER_ACCESS_TOKEN_SECRET'
    ];

    // Check .env file exists
    if (!fs.existsSync('.env')) {
      this.addCheck('environment', '❌ .env file missing', false);
      return;
    }
    this.addCheck('environment', '✅ .env file exists', true);

    // Load environment variables
    require('dotenv').config();

    // Check required variables
    for (const envVar of requiredEnvVars) {
      const exists = !!process.env[envVar];
      this.addCheck('environment', `${exists ? '✅' : '❌'} ${envVar}`, exists);
    }

    // Check Node version
    const nodeVersion = process.version;
    const isValidNode = parseInt(nodeVersion.slice(1)) >= 18;
    this.addCheck('environment', `${isValidNode ? '✅' : '❌'} Node.js ${nodeVersion}`, isValidNode);

    this.results.environment.status = this.results.environment.checks.every(c => c.passed) ? 'passed' : 'failed';
  }

  async checkDatabase() {
    console.log('🗄️ Checking Database...');
    
    try {
      // Test Supabase connection
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      // Test basic connection
      const { data, error } = await supabase.from('tweets').select('count').limit(1);
      
      if (error) {
        this.addCheck('database', `❌ Database connection failed: ${error.message}`, false);
      } else {
        this.addCheck('database', '✅ Database connection successful', true);
      }

      // Check essential tables exist
      const requiredTables = ['tweets', 'bot_config', 'learning_posts', 'engagement_feedback_tracking'];
      
      for (const table of requiredTables) {
        try {
          const { data, error } = await supabase.from(table).select('*').limit(1);
          const exists = !error;
          this.addCheck('database', `${exists ? '✅' : '❌'} Table ${table}`, exists);
        } catch (err) {
          this.addCheck('database', `❌ Table ${table}`, false);
        }
      }

    } catch (error) {
      this.addCheck('database', `❌ Database setup error: ${error.message}`, false);
    }

    this.results.database.status = this.results.database.checks.every(c => c.passed) ? 'passed' : 'failed';
  }

  async checkBuild() {
    console.log('🔨 Checking Build System...');
    
    try {
      // Check TypeScript compilation
      const { stdout, stderr } = await execAsync('npx tsc --noEmit');
      
      if (stderr && stderr.includes('error')) {
        this.addCheck('build', `❌ TypeScript compilation errors`, false);
        console.log('Build errors:', stderr);
      } else {
        this.addCheck('build', '✅ TypeScript compilation clean', true);
      }

    } catch (error) {
      this.addCheck('build', `❌ Build check failed: ${error.message}`, false);
    }

    // Check essential files exist
    const essentialFiles = [
      'src/core/autonomousPostingEngine.ts',
      'src/core/masterAutonomousController.ts',
      'src/utils/browserTweetPoster.ts',
      'src/utils/emergencyBudgetLockdown.ts'
    ];

    for (const file of essentialFiles) {
      const exists = fs.existsSync(file);
      this.addCheck('build', `${exists ? '✅' : '❌'} ${file}`, exists);
    }

    this.results.build.status = this.results.build.checks.every(c => c.passed) ? 'passed' : 'failed';
  }

  async checkPostingSystem() {
    console.log('📝 Checking Posting System...');
    
    try {
      // Check posting engine can be imported
      const postingEnginePath = path.join(process.cwd(), 'src/core/autonomousPostingEngine.ts');
      const exists = fs.existsSync(postingEnginePath);
      this.addCheck('posting', `${exists ? '✅' : '❌'} Posting engine exists`, exists);

      // Check content validation systems
      const validationFiles = [
        'src/config/nuclearContentValidation.ts',
        'src/utils/contentFactChecker.ts',
        'src/utils/contentQualityAnalyzer.ts'
      ];

      for (const file of validationFiles) {
        const exists = fs.existsSync(file);
        this.addCheck('posting', `${exists ? '✅' : '❌'} ${path.basename(file)}`, exists);
      }

    } catch (error) {
      this.addCheck('posting', `❌ Posting system check failed: ${error.message}`, false);
    }

    this.results.posting.status = this.results.posting.checks.every(c => c.passed) ? 'passed' : 'failed';
  }

  async checkBudgetSystem() {
    console.log('💰 Checking Budget System...');
    
    try {
      // Check budget limit is set
      const budgetLimit = process.env.OPENAI_BUDGET_LIMIT || process.env.DAILY_BUDGET_LIMIT;
      const hasBudget = !!budgetLimit;
      this.addCheck('budget', `${hasBudget ? '✅' : '❌'} Budget limit configured (${budgetLimit || 'none'})`, hasBudget);

      // Check emergency lockdown exists
      const lockdownExists = fs.existsSync('src/utils/emergencyBudgetLockdown.ts');
      this.addCheck('budget', `${lockdownExists ? '✅' : '❌'} Emergency lockdown system`, lockdownExists);

    } catch (error) {
      this.addCheck('budget', `❌ Budget system check failed: ${error.message}`, false);
    }

    this.results.budget.status = this.results.budget.checks.every(c => c.passed) ? 'passed' : 'failed';
  }

  addCheck(category, message, passed) {
    this.results[category].checks.push({ message, passed });
    console.log(`  ${message}`);
  }

  printResults() {
    console.log('\n📊 === HEALTH CHECK RESULTS ===\n');
    
    for (const [category, result] of Object.entries(this.results)) {
      const status = result.status === 'passed' ? '✅' : '❌';
      const passedCount = result.checks.filter(c => c.passed).length;
      const totalCount = result.checks.length;
      
      console.log(`${status} ${category.toUpperCase()}: ${passedCount}/${totalCount} checks passed`);
      
      // Show failed checks
      const failed = result.checks.filter(c => !c.passed);
      if (failed.length > 0) {
        failed.forEach(check => console.log(`  ${check.message}`));
      }
      console.log();
    }
  }

  isSystemHealthy() {
    const allPassed = Object.values(this.results).every(result => result.status === 'passed');
    
    if (allPassed) {
      console.log('🎉 SYSTEM HEALTHY - Ready for learning enhancement implementation!\n');
    } else {
      console.log('⚠️ SYSTEM ISSUES DETECTED - Please fix above issues before proceeding\n');
    }
    
    return allPassed;
  }
}

// Run if called directly
if (require.main === module) {
  const checker = new SystemHealthChecker();
  checker.runAllChecks()
    .then(healthy => process.exit(healthy ? 0 : 1))
    .catch(err => {
      console.error('Health check error:', err);
      process.exit(1);
    });
}

module.exports = { SystemHealthChecker }; 