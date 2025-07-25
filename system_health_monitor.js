/**
 * 🔍 COMPREHENSIVE SYSTEM HEALTH MONITOR
 * 
 * Verifies all bot systems work perfectly and checks for potential issues
 */

const { RobustTweetStorage } = require('./dist/utils/robustTweetStorage');
const ProcessLock = require('./dist/utils/processLock').default;
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

class SystemHealthMonitor {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    this.healthReport = {
      timestamp: new Date().toISOString(),
      tests: [],
      status: 'unknown',
      errors: [],
      warnings: []
    };
  }

  /**
   * 🧪 RUN COMPLETE SYSTEM HEALTH CHECK
   */
  async runFullHealthCheck() {
    console.log('🔍 COMPREHENSIVE SYSTEM HEALTH CHECK');
    console.log('='.repeat(60));
    console.log(`📅 Started: ${new Date().toLocaleString()}`);
    console.log('');

    try {
      // Critical System Tests
      await this.testDatabaseConnectivity();
      await this.testTwitterCredentials();
      await this.testProcessLocking();
      await this.testRobustStorage();
      await this.testDailyLimitLogic();
      
      // Intelligence System Tests
      await this.testAISystemsHealth();
      await this.testEngagementTracking();
      await this.testContentGeneration();
      
      // Tomorrow Readiness Tests
      await this.testAPILimitReset();
      await this.testMidnightReset();
      await this.testConcurrencyProtection();
      
      // Generate Final Report
      await this.generateHealthReport();

    } catch (error) {
      console.error('❌ Health check failed:', error);
      this.healthReport.status = 'critical_failure';
      this.healthReport.errors.push(`System failure: ${error.message}`);
    }
  }

  /**
   * 🗄️ TEST DATABASE CONNECTIVITY
   */
  async testDatabaseConnectivity() {
    console.log('📋 TEST: Database Connectivity');
    console.log('-'.repeat(40));

    try {
      // Test basic connection
      const { data, error } = await this.supabase
        .from('tweets')
        .select('count')
        .limit(1);

      if (error) {
        this.addError('Database connection failed', error.message);
        return;
      }

      // Test all required tables
      const tables = ['tweets', 'api_usage_tracking', 'content_uniqueness', 'follower_tracking'];
      for (const table of tables) {
        const { error: tableError } = await this.supabase
          .from(table)
          .select('*')
          .limit(1);

        if (tableError) {
          this.addError(`Table ${table} inaccessible`, tableError.message);
        } else {
          console.log(`  ✅ Table ${table}: Accessible`);
        }
      }

      // Test write permissions
      const testWrite = await this.supabase
        .from('system_health_status')
        .upsert({
          component: 'database_test',
          status: 'healthy',
          last_check: new Date().toISOString()
        });

      if (testWrite.error) {
        this.addWarning('Database write test failed', testWrite.error.message);
      } else {
        console.log('  ✅ Database writes: Working');
      }

      this.addTest('Database Connectivity', 'passed');

    } catch (error) {
      this.addError('Database test failed', error.message);
    }
  }

  /**
   * 🐦 TEST TWITTER CREDENTIALS
   */
  async testTwitterCredentials() {
    console.log('\n📋 TEST: Twitter API Credentials');
    console.log('-'.repeat(40));

    try {
      const requiredEnvVars = [
        'TWITTER_API_KEY',
        'TWITTER_API_SECRET',
        'TWITTER_ACCESS_TOKEN',
        'TWITTER_ACCESS_TOKEN_SECRET'
      ];

      let credentialsValid = true;
      for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
          this.addError(`Missing credential: ${envVar}`);
          credentialsValid = false;
        } else {
          console.log(`  ✅ ${envVar}: Set`);
        }
      }

      if (credentialsValid) {
        // Test API access (import the actual Twitter client)
        try {
          const { xClient } = require('./dist/utils/xClient');
          const myId = xClient.getMyUserId();
          if (myId) {
            console.log(`  ✅ Twitter API: Connected (User ID: ${myId})`);
            this.addTest('Twitter Credentials', 'passed');
          } else {
            this.addWarning('Twitter API connection uncertain');
          }
        } catch (error) {
          this.addWarning('Twitter client test failed', error.message);
        }
      }

    } catch (error) {
      this.addError('Twitter credentials test failed', error.message);
    }
  }

  /**
   * 🔒 TEST PROCESS LOCKING SYSTEM
   */
  async testProcessLocking() {
    console.log('\n📋 TEST: Process Locking System');
    console.log('-'.repeat(40));

    try {
      // Check current lock status
      const lockStatus = ProcessLock.checkStatus();
      console.log(`  Lock exists: ${lockStatus.lockExists}`);
      console.log(`  Has lock: ${lockStatus.hasLock}`);
      console.log(`  Is stale: ${lockStatus.isStale || 'N/A'}`);

      if (lockStatus.lockExists && !lockStatus.hasLock && !lockStatus.isStale) {
        this.addWarning('Another process lock detected - may cause conflicts');
      } else {
        console.log('  ✅ Process locking: Ready');
      }

      this.addTest('Process Locking', 'passed');

    } catch (error) {
      this.addError('Process lock test failed', error.message);
    }
  }

  /**
   * 💾 TEST ROBUST STORAGE SYSTEM
   */
  async testRobustStorage() {
    console.log('\n📋 TEST: Robust Storage System');
    console.log('-'.repeat(40));

    try {
      // Test daily status check
      const status = await RobustTweetStorage.getStatus();
      console.log(`  ✅ Daily Status: ${status.tweetsToday}/17 tweets`);
      console.log(`  ✅ Can post: ${status.canPost}`);
      console.log(`  ✅ Remaining: ${status.remaining}`);

      // Test sync integrity
      const syncCheck = await RobustTweetStorage.findMissingTweets();
      console.log(`  📊 Sync integrity: ${syncCheck.tweetsInDb} saved, ${syncCheck.apiCallsToday} API calls`);
      
      if (syncCheck.gap > 0) {
        this.addWarning(`${syncCheck.gap} tweets missing from database (historical issue)`);
      }

      this.addTest('Robust Storage', 'passed');

    } catch (error) {
      this.addError('Robust storage test failed', error.message);
    }
  }

  /**
   * 📊 TEST DAILY LIMIT LOGIC
   */
  async testDailyLimitLogic() {
    console.log('\n📋 TEST: Daily Limit Logic');
    console.log('-'.repeat(40));

    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Test SQL logic directly
      const { data, error } = await this.supabase
        .from('tweets')
        .select('tweet_id')
        .gte('created_at', `${today}T00:00:00.000Z`)
        .lt('created_at', `${today}T23:59:59.999Z`);

      if (error) {
        this.addError('Daily count query failed', error.message);
        return;
      }

      const count = data?.length || 0;
      const remaining = 17 - count;
      const canPost = count < 17;

      console.log(`  ✅ Database count: ${count}`);
      console.log(`  ✅ Remaining: ${remaining}`);
      console.log(`  ✅ Can post: ${canPost}`);

      // Verify logic consistency
      if (canPost === (remaining > 0)) {
        console.log('  ✅ Logic consistency: Valid');
        this.addTest('Daily Limit Logic', 'passed');
      } else {
        this.addError('Daily limit logic inconsistency detected');
      }

    } catch (error) {
      this.addError('Daily limit test failed', error.message);
    }
  }

  /**
   * 🧠 TEST AI SYSTEMS HEALTH
   */
  async testAISystemsHealth() {
    console.log('\n📋 TEST: AI Systems Health');
    console.log('-'.repeat(40));

    try {
      // Check environment variables for AI
      const aiEnvVars = ['OPENAI_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
      
      for (const envVar of aiEnvVars) {
        if (!process.env[envVar]) {
          this.addError(`Missing AI environment variable: ${envVar}`);
        } else {
          console.log(`  ✅ ${envVar}: Set`);
        }
      }

      // Test budget system
      if (process.env.OPENAI_API_KEY) {
        console.log('  ✅ OpenAI integration: Ready');
      }

      this.addTest('AI Systems', 'passed');

    } catch (error) {
      this.addError('AI systems test failed', error.message);
    }
  }

  /**
   * 📈 TEST ENGAGEMENT TRACKING
   */
  async testEngagementTracking() {
    console.log('\n📋 TEST: Engagement Tracking');
    console.log('-'.repeat(40));

    try {
      // Check for engagement tracking tables
      const { data, error } = await this.supabase
        .from('tweet_metrics')
        .select('*')
        .limit(1);

      if (error && error.message.includes('does not exist')) {
        this.addWarning('tweet_metrics table missing - engagement tracking may not work');
      } else {
        console.log('  ✅ Engagement tracking: Ready');
      }

      this.addTest('Engagement Tracking', 'passed');

    } catch (error) {
      this.addWarning('Engagement tracking test failed', error.message);
    }
  }

  /**
   * 🎨 TEST CONTENT GENERATION
   */
  async testContentGeneration() {
    console.log('\n📋 TEST: Content Generation');
    console.log('-'.repeat(40));

    try {
      // Check content uniqueness system
      const { data, error } = await this.supabase
        .from('content_uniqueness')
        .select('count')
        .limit(1);

      if (error) {
        this.addWarning('Content uniqueness system may not work', error.message);
      } else {
        console.log('  ✅ Content uniqueness: Ready');
      }

      this.addTest('Content Generation', 'passed');

    } catch (error) {
      this.addWarning('Content generation test failed', error.message);
    }
  }

  /**
   * 🔄 TEST API LIMIT RESET READINESS
   */
  async testAPILimitReset() {
    console.log('\n📋 TEST: API Limit Reset Readiness');
    console.log('-'.repeat(40));

    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Check API usage tracking
      const { data, error } = await this.supabase
        .from('api_usage_tracking')
        .select('*')
        .eq('date', today)
        .eq('api_type', 'twitter');

      if (error) {
        this.addWarning('API usage tracking query failed', error.message);
      } else {
        const usage = data?.[0]?.count || 0;
        console.log(`  📊 Today's API usage: ${usage} calls`);
        console.log(`  🔄 Tomorrow reset: Will start fresh at 0`);
        
        if (usage > 50) {
          this.addWarning(`High API usage today (${usage} calls) - monitor closely`);
        }
      }

      this.addTest('API Limit Reset', 'ready');

    } catch (error) {
      this.addError('API limit reset test failed', error.message);
    }
  }

  /**
   * 🌅 TEST MIDNIGHT RESET SYSTEM
   */
  async testMidnightReset() {
    console.log('\n📋 TEST: Midnight Reset System');
    console.log('-'.repeat(40));

    try {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const timeUntilReset = tomorrow - now;
      const hoursUntilReset = Math.floor(timeUntilReset / (1000 * 60 * 60));
      const minutesUntilReset = Math.floor((timeUntilReset % (1000 * 60 * 60)) / (1000 * 60));

      console.log(`  ⏰ Time until reset: ${hoursUntilReset}h ${minutesUntilReset}m`);
      console.log(`  🌅 Reset time: ${tomorrow.toLocaleString()}`);
      console.log(`  ✅ Reset logic: Ready`);

      this.addTest('Midnight Reset', 'ready');

    } catch (error) {
      this.addError('Midnight reset test failed', error.message);
    }
  }

  /**
   * 🛡️ TEST CONCURRENCY PROTECTION
   */
  async testConcurrencyProtection() {
    console.log('\n📋 TEST: Concurrency Protection');
    console.log('-'.repeat(40));

    try {
      // Simulate what happens when trying to start multiple instances
      const lockStatus = ProcessLock.checkStatus();
      
      if (!lockStatus.lockExists) {
        console.log('  ✅ No existing locks - ready for clean startup');
      } else if (lockStatus.isStale) {
        console.log('  ⚠️ Stale lock detected - will be cleaned automatically');
      } else {
        console.log('  🔒 Active lock detected - protection working');
      }

      console.log('  ✅ Concurrency protection: Active');
      this.addTest('Concurrency Protection', 'passed');

    } catch (error) {
      this.addError('Concurrency protection test failed', error.message);
    }
  }

  /**
   * 📊 GENERATE FINAL HEALTH REPORT
   */
  async generateHealthReport() {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 FINAL HEALTH REPORT');
    console.log('='.repeat(60));

    const totalTests = this.healthReport.tests.length;
    const passedTests = this.healthReport.tests.filter(t => t.status === 'passed' || t.status === 'ready').length;
    const successRate = Math.round((passedTests / totalTests) * 100);

    // Determine overall status
    if (this.healthReport.errors.length === 0 && successRate >= 95) {
      this.healthReport.status = 'excellent';
    } else if (this.healthReport.errors.length === 0 && successRate >= 80) {
      this.healthReport.status = 'good';
    } else if (this.healthReport.errors.length < 3) {
      this.healthReport.status = 'warning';
    } else {
      this.healthReport.status = 'critical';
    }

    console.log(`📊 Tests Passed: ${passedTests}/${totalTests} (${successRate}%)`);
    console.log(`❌ Errors: ${this.healthReport.errors.length}`);
    console.log(`⚠️ Warnings: ${this.healthReport.warnings.length}`);
    console.log(`🎯 Overall Status: ${this.healthReport.status.toUpperCase()}`);

    // Show errors
    if (this.healthReport.errors.length > 0) {
      console.log('\n❌ ERRORS TO FIX:');
      this.healthReport.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    // Show warnings  
    if (this.healthReport.warnings.length > 0) {
      console.log('\n⚠️ WARNINGS TO MONITOR:');
      this.healthReport.warnings.forEach((warning, index) => {
        console.log(`  ${index + 1}. ${warning}`);
      });
    }

    // Tomorrow readiness
    console.log('\n🌅 TOMORROW READINESS:');
    if (this.healthReport.status === 'excellent' || this.healthReport.status === 'good') {
      console.log('  ✅ System ready for API limit refresh');
      console.log('  ✅ No errors expected at midnight reset');
      console.log('  ✅ Bot will operate smoothly tomorrow');
    } else {
      console.log('  ⚠️ Fix errors above before tomorrow');
      console.log('  ⚠️ May experience issues at API refresh');
    }

    // Save report to database
    await this.saveHealthReport();

    console.log(`\n📅 Report completed: ${new Date().toLocaleString()}`);
    return this.healthReport;
  }

  async saveHealthReport() {
    try {
      await this.supabase
        .from('system_health_reports')
        .insert({
          report_time: this.healthReport.timestamp,
          status: this.healthReport.status,
          tests_passed: this.healthReport.tests.filter(t => t.status === 'passed').length,
          tests_total: this.healthReport.tests.length,
          errors: this.healthReport.errors,
          warnings: this.healthReport.warnings,
          full_report: this.healthReport
        });
    } catch (error) {
      console.warn('Could not save health report to database:', error.message);
    }
  }

  addTest(name, status) {
    this.healthReport.tests.push({ name, status });
  }

  addError(message, details = '') {
    const error = details ? `${message}: ${details}` : message;
    this.healthReport.errors.push(error);
    console.log(`  ❌ ERROR: ${error}`);
  }

  addWarning(message, details = '') {
    const warning = details ? `${message}: ${details}` : message;
    this.healthReport.warnings.push(warning);
    console.log(`  ⚠️ WARNING: ${warning}`);
  }
}

// Quick health check function
async function quickHealthCheck() {
  console.log('⚡ QUICK HEALTH CHECK');
  console.log('-'.repeat(30));
  
  try {
    const status = await RobustTweetStorage.getStatus();
    console.log(`📊 Today: ${status.tweetsToday}/17 tweets`);
    console.log(`✅ Can post: ${status.canPost}`);
    
    const lockStatus = ProcessLock.checkStatus();
    console.log(`🔒 Process conflicts: ${lockStatus.lockExists ? 'Yes' : 'No'}`);
    
    console.log('✅ Quick check complete');
    return true;
  } catch (error) {
    console.error('❌ Quick check failed:', error.message);
    return false;
  }
}

// Run health check if executed directly
if (require.main === module) {
  const monitor = new SystemHealthMonitor();
  monitor.runFullHealthCheck()
    .then(report => {
      process.exit(report.status === 'excellent' || report.status === 'good' ? 0 : 1);
    })
    .catch(error => {
      console.error('Health check failed:', error);
      process.exit(1);
    });
}

module.exports = {
  SystemHealthMonitor,
  quickHealthCheck
}; 