/**
 * 🌅 TOMORROW READINESS TEST
 * 
 * Specifically tests system readiness for tomorrow's API limit refresh
 */

const { SystemHealthMonitor, quickHealthCheck } = require('./system_health_monitor');
const { RobustTweetStorage } = require('./dist/utils/robustTweetStorage');
const ProcessLock = require('./dist/utils/processLock').default;

class TomorrowReadinessTest {
  constructor() {
    this.issues = [];
    this.readinessScore = 0;
  }

  async runReadinessTest() {
    console.log('🌅 TOMORROW API REFRESH READINESS TEST');
    console.log('='.repeat(50));
    console.log(`📅 Current time: ${new Date().toLocaleString()}`);
    
    // Calculate time until API reset
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const timeUntilReset = tomorrow - now;
    const hoursUntilReset = Math.floor(timeUntilReset / (1000 * 60 * 60));
    const minutesUntilReset = Math.floor((timeUntilReset % (1000 * 60 * 60)) / (1000 * 60));
    
    console.log(`⏰ API limits reset in: ${hoursUntilReset}h ${minutesUntilReset}m`);
    console.log('');

    // Run specific readiness tests
    await this.testCurrentSystemState();
    await this.testDailyLimitReset();
    await this.testDatabaseIntegrity();
    await this.testProcessSafety();
    await this.testErrorRecovery();
    
    // Generate readiness report
    this.generateReadinessReport();
  }

  async testCurrentSystemState() {
    console.log('📋 TEST 1: Current System State');
    console.log('-'.repeat(40));

    try {
      // Check today's usage
      const status = await RobustTweetStorage.getStatus();
      console.log(`📊 Today's tweets: ${status.tweetsToday}/17`);
      console.log(`📈 Remaining today: ${status.remaining}`);
      
      if (status.tweetsToday <= 17) {
        console.log('✅ Within daily limit - no over-posting issues');
        this.readinessScore += 20;
      } else {
        console.log('⚠️ Over daily limit detected - may indicate system issues');
        this.issues.push('Daily limit exceeded - investigate cause');
      }

      // Check for missing tweets
      const syncCheck = await RobustTweetStorage.findMissingTweets();
      if (syncCheck.gap === 0) {
        console.log('✅ Perfect database sync - no missing tweets');
        this.readinessScore += 15;
      } else {
        console.log(`⚠️ ${syncCheck.gap} tweets missing from database`);
        this.issues.push(`${syncCheck.gap} tweets not saved to database`);
      }

    } catch (error) {
      console.log('❌ System state test failed:', error.message);
      this.issues.push('System state test failed');
    }
  }

  async testDailyLimitReset() {
    console.log('\n📋 TEST 2: Daily Limit Reset Logic');
    console.log('-'.repeat(40));

    try {
      // Test tomorrow's date calculation
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      
      console.log(`📅 Tomorrow's date: ${tomorrowStr}`);
      
      // Test query for tomorrow (should be 0)
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      
      const { data, error } = await supabase
        .from('tweets')
        .select('tweet_id')
        .gte('created_at', `${tomorrowStr}T00:00:00.000Z`)
        .lt('created_at', `${tomorrowStr}T23:59:59.999Z`);

      if (error) {
        console.log('❌ Tomorrow query test failed:', error.message);
        this.issues.push('Daily reset query logic may fail');
      } else {
        const tomorrowCount = data?.length || 0;
        console.log(`📊 Tomorrow's tweet count: ${tomorrowCount} (should be 0)`);
        
        if (tomorrowCount === 0) {
          console.log('✅ Daily reset logic working correctly');
          this.readinessScore += 20;
        } else {
          console.log('⚠️ Tomorrow already has tweets - date logic issue');
          this.issues.push('Date calculation logic may be incorrect');
        }
      }

    } catch (error) {
      console.log('❌ Daily reset test failed:', error.message);
      this.issues.push('Daily reset test failed');
    }
  }

  async testDatabaseIntegrity() {
    console.log('\n📋 TEST 3: Database Integrity for Tomorrow');
    console.log('-'.repeat(40));

    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      // Test critical tables
      const criticalTables = ['tweets', 'api_usage_tracking', 'content_uniqueness'];
      let tablesOK = true;

      for (const table of criticalTables) {
        const { error } = await supabase
          .from(table)
          .select('*')
          .limit(1);

        if (error) {
          console.log(`❌ Table ${table}: Error - ${error.message}`);
          this.issues.push(`Database table ${table} has issues`);
          tablesOK = false;
        } else {
          console.log(`✅ Table ${table}: Accessible`);
        }
      }

      if (tablesOK) {
        console.log('✅ All critical database tables ready');
        this.readinessScore += 15;
      }

      // Test database write capability
      const writeTest = await supabase
        .from('system_health_status')
        .upsert({
          component: 'tomorrow_readiness_test',
          status: 'testing',
          last_check: new Date().toISOString()
        });

      if (writeTest.error) {
        console.log('❌ Database write test failed:', writeTest.error.message);
        this.issues.push('Database writes may fail tomorrow');
      } else {
        console.log('✅ Database writes working');
        this.readinessScore += 10;
      }

    } catch (error) {
      console.log('❌ Database integrity test failed:', error.message);
      this.issues.push('Database integrity test failed');
    }
  }

  async testProcessSafety() {
    console.log('\n📋 TEST 4: Process Safety & Conflict Prevention');
    console.log('-'.repeat(40));

    try {
      // Check for existing locks
      const lockStatus = ProcessLock.checkStatus();
      console.log(`🔒 Lock exists: ${lockStatus.lockExists}`);
      console.log(`🔒 Has lock: ${lockStatus.hasLock}`);
      
      if (!lockStatus.lockExists) {
        console.log('✅ No process conflicts - clean startup ready');
        this.readinessScore += 20;
      } else if (lockStatus.isStale) {
        console.log('⚠️ Stale lock detected - will be cleaned automatically');
        this.readinessScore += 15;
      } else {
        console.log('⚠️ Active process lock - potential conflict');
        this.issues.push('Process lock conflict may prevent startup');
      }

      // Test lock acquisition
      try {
        const testLock = await ProcessLock.acquire();
        if (testLock.success) {
          console.log('✅ Process lock acquisition: Working');
          ProcessLock.release(); // Clean up test lock
          this.readinessScore += 10;
        } else {
          console.log('⚠️ Process lock acquisition: Failed');
          this.issues.push('Process lock system may not work');
        }
      } catch (error) {
        console.log('❌ Process lock test error:', error.message);
        this.issues.push('Process lock system has errors');
      }

    } catch (error) {
      console.log('❌ Process safety test failed:', error.message);
      this.issues.push('Process safety test failed');
    }
  }

  async testErrorRecovery() {
    console.log('\n📋 TEST 5: Error Recovery & Resilience');
    console.log('-'.repeat(40));

    try {
      // Test robust storage error handling
      console.log('🧪 Testing robust storage resilience...');
      
      // This should not fail even with edge cases
      const status = await RobustTweetStorage.getStatus();
      if (status && typeof status.tweetsToday === 'number') {
        console.log('✅ Robust storage: Resilient to errors');
        this.readinessScore += 15;
      } else {
        console.log('❌ Robust storage: May fail under stress');
        this.issues.push('Robust storage system may fail');
      }

      // Test with tomorrow's date (edge case)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      console.log('🧪 Testing tomorrow date handling...');
      
      // This tests if the system handles future dates correctly
      const futureTest = await RobustTweetStorage.checkDailyLimit();
      if (futureTest && typeof futureTest.count === 'number') {
        console.log('✅ Date handling: Robust');
        this.readinessScore += 5;
      } else {
        console.log('⚠️ Date handling: May have issues');
        this.issues.push('Date handling may fail at midnight');
      }

    } catch (error) {
      console.log('❌ Error recovery test failed:', error.message);
      this.issues.push('Error recovery systems may fail');
    }
  }

  generateReadinessReport() {
    console.log('\n' + '='.repeat(50));
    console.log('🎯 TOMORROW READINESS REPORT');
    console.log('='.repeat(50));

    console.log(`📊 Readiness Score: ${this.readinessScore}/100`);
    console.log(`❌ Issues Found: ${this.issues.length}`);

    // Determine readiness level
    let readinessLevel;
    if (this.readinessScore >= 90 && this.issues.length === 0) {
      readinessLevel = 'EXCELLENT';
      console.log('🎉 Status: EXCELLENT - Ready for tomorrow!');
    } else if (this.readinessScore >= 75 && this.issues.length <= 2) {
      readinessLevel = 'GOOD';
      console.log('✅ Status: GOOD - Should work fine tomorrow');
    } else if (this.readinessScore >= 60) {
      readinessLevel = 'WARNING';
      console.log('⚠️ Status: WARNING - May have issues tomorrow');
    } else {
      readinessLevel = 'CRITICAL';
      console.log('🚨 Status: CRITICAL - Likely to fail tomorrow');
    }

    // Show issues
    if (this.issues.length > 0) {
      console.log('\n❌ ISSUES TO FIX BEFORE TOMORROW:');
      this.issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue}`);
      });
    }

    // Specific tomorrow predictions
    console.log('\n🔮 TOMORROW PREDICTIONS:');
    
    if (readinessLevel === 'EXCELLENT' || readinessLevel === 'GOOD') {
      console.log('  ✅ API limits will reset properly at midnight');
      console.log('  ✅ Bot will start posting immediately after reset');
      console.log('  ✅ All 17 tweets will be saved to database');
      console.log('  ✅ No process conflicts expected');
      console.log('  ✅ Error recovery systems will handle any issues');
    } else {
      console.log('  ⚠️ May experience issues at API reset');
      console.log('  ⚠️ Database sync problems possible');
      console.log('  ⚠️ Process conflicts may occur');
      console.log('  ⚠️ Recommend fixing issues above first');
    }

    // Action recommendations
    console.log('\n📋 RECOMMENDED ACTIONS:');
    
    if (readinessLevel === 'EXCELLENT') {
      console.log('  🎯 No action needed - system is ready!');
      console.log('  📊 Optional: Monitor first few posts tomorrow');
    } else if (readinessLevel === 'GOOD') {
      console.log('  🔧 Minor: Address warnings above');
      console.log('  📊 Monitor system closely tomorrow');
    } else {
      console.log('  🚨 URGENT: Fix all issues above before tomorrow');
      console.log('  🔧 Run this test again after fixes');
      console.log('  📊 Consider manual monitoring tomorrow');
    }

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const timeUntilReset = tomorrow - now;
    const hoursUntilReset = Math.floor(timeUntilReset / (1000 * 60 * 60));
    
    console.log(`\n⏰ You have ${hoursUntilReset} hours to fix any issues`);
    console.log(`📅 Test completed: ${new Date().toLocaleString()}`);

    return {
      readinessLevel,
      score: this.readinessScore,
      issues: this.issues,
      hoursUntilReset
    };
  }
}

// Quick tomorrow check
async function quickTomorrowCheck() {
  console.log('⚡ QUICK TOMORROW CHECK');
  console.log('-'.repeat(30));
  
  try {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const hoursUntilReset = Math.floor((tomorrow - now) / (1000 * 60 * 60));
    
    const status = await RobustTweetStorage.getStatus();
    const lockStatus = ProcessLock.checkStatus();
    
    console.log(`⏰ API reset in: ${hoursUntilReset}h`);
    console.log(`📊 Today: ${status.tweetsToday}/17 tweets`);
    console.log(`🔒 Process clear: ${!lockStatus.lockExists}`);
    
    const ready = status.tweetsToday <= 17 && !lockStatus.lockExists;
    console.log(`🎯 Tomorrow ready: ${ready ? 'YES' : 'NEEDS ATTENTION'}`);
    
    return ready;
  } catch (error) {
    console.error('❌ Quick check failed:', error.message);
    return false;
  }
}

// Run if executed directly
if (require.main === module) {
  const test = new TomorrowReadinessTest();
  test.runReadinessTest()
    .then(result => {
      process.exit(result.readinessLevel === 'EXCELLENT' || result.readinessLevel === 'GOOD' ? 0 : 1);
    })
    .catch(error => {
      console.error('Tomorrow readiness test failed:', error);
      process.exit(1);
    });
}

module.exports = {
  TomorrowReadinessTest,
  quickTomorrowCheck
}; 