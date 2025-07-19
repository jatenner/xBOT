const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditTwitterRateLimits() {
  console.log('🔍 === COMPREHENSIVE TWITTER RATE LIMITS AUDIT ===\n');

  // 1. OFFICIAL TWITTER API FREE TIER LIMITS
  console.log('📋 OFFICIAL Twitter API v2 Free Tier Limits:');
  console.log('   • Writes: 17 tweets per 24 hours (per user & per app)');
  console.log('   • Reads: 100 posts per month (consumption cap)');
  console.log('   • No enforced per-day read limit');
  console.log('   • Rate limit windows: 15-minute intervals\n');

  // 2. ENVIRONMENT VARIABLES AUDIT
  console.log('🔧 ENVIRONMENT VARIABLES:');
  const envVars = [
    'MAX_DAILY_TWEETS',
    'TWITTER_MONTHLY_CAP', 
    'MONTHLY_WRITE_CAP',
    'POST_FREQUENCY_MINUTES',
    'ENGAGEMENT_TARGET_DAILY',
    'DISABLE_BOT',
    'SMART_MONTHLY_CAP_MODE',
    'EMERGENCY_COST_MODE',
    'DAILY_POSTING_TARGET'
  ];

  envVars.forEach(varName => {
    const value = process.env[varName];
    const status = value ? '✅' : '❌';
    console.log(`   ${status} ${varName}: ${value || 'Not set'}`);
  });
  console.log('');

  // 3. SUPABASE BOT_CONFIG AUDIT
  console.log('💾 SUPABASE bot_config TABLE:');
  try {
    const { data: allConfig, error } = await supabase
      .from('bot_config')
      .select('key, value, updated_at')
      .order('key');

    if (error) {
      console.error('❌ Error querying bot_config:', error);
    } else if (allConfig && allConfig.length > 0) {
      const relevantKeys = allConfig.filter(config => 
        config.key.includes('daily') || 
        config.key.includes('monthly') || 
        config.key.includes('cap') || 
        config.key.includes('limit') ||
        config.key.includes('cooldown') ||
        config.key === 'runtime_config'
      );

      relevantKeys.forEach(config => {
        let displayValue = config.value;
        if (config.key === 'runtime_config') {
          try {
            const parsed = typeof config.value === 'string' ? JSON.parse(config.value) : config.value;
            displayValue = JSON.stringify(parsed, null, 2);
          } catch (e) {
            displayValue = config.value;
          }
        }
        console.log(`   📄 ${config.key}:`);
        console.log(`      Value: ${displayValue}`);
        console.log(`      Updated: ${config.updated_at}\n`);
      });
    } else {
      console.log('   📄 No relevant configuration found');
    }
  } catch (error) {
    console.error('❌ Database connection error:', error);
  }

  // 4. HARDCODED VALUES AUDIT
  console.log('⚙️ HARDCODED VALUES IN CODE:');
  console.log('   From realTimeLimitsIntelligenceAgent.ts:');
  console.log('     • TWITTER_MONTHLY_CAP fallback: 1500');
  console.log('     • Daily cap calculation: monthlyUsed + daysLeftInMonth');
  console.log('   From utils/apiOptimizer.ts:');
  console.log('     • MONTHLY_WRITES: 500');
  console.log('     • DAILY_READS: 1500');
  console.log('   From xClient.ts:');
  console.log('     • tweets3Hour.limit: 300');
  console.log('     • tweets24Hour.limit: 2400');
  console.log('');

  // 5. DETECT MISCONFIGURATIONS
  console.log('🚨 RATE LIMIT MISCONFIGURATIONS DETECTED:');
  
  const issues = [];
  
  // Check environment variables
  if (process.env.MAX_DAILY_TWEETS && parseInt(process.env.MAX_DAILY_TWEETS) < 17) {
    issues.push(`Environment: MAX_DAILY_TWEETS=${process.env.MAX_DAILY_TWEETS} is below Twitter's free tier limit of 17`);
  }
  
  if (process.env.TWITTER_MONTHLY_CAP && parseInt(process.env.TWITTER_MONTHLY_CAP) !== 1500) {
    issues.push(`Environment: TWITTER_MONTHLY_CAP=${process.env.TWITTER_MONTHLY_CAP} should be 1500 for reads, not writes`);
  }

  if (process.env.MONTHLY_WRITE_CAP && parseInt(process.env.MONTHLY_WRITE_CAP) < 500) {
    issues.push(`Environment: MONTHLY_WRITE_CAP=${process.env.MONTHLY_WRITE_CAP} is artificially low`);
  }

  // Check database config
  try {
    const { data: runtimeConfig } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', 'runtime_config')
      .single();

    if (runtimeConfig && runtimeConfig.value) {
      const config = typeof runtimeConfig.value === 'string' ? 
        JSON.parse(runtimeConfig.value) : runtimeConfig.value;
      
      if (config.maxDailyTweets && config.maxDailyTweets < 17) {
        issues.push(`Database: runtime_config.maxDailyTweets=${config.maxDailyTweets} is below Twitter's free tier limit of 17`);
      }
      
      if (config.monthlyWriteCap && config.monthlyWriteCap < 500) {
        issues.push(`Database: runtime_config.monthlyWriteCap=${config.monthlyWriteCap} is artificially low`);
      }
      
      if (config.emergencyCooldownUntil) {
        const cooldownDate = new Date(config.emergencyCooldownUntil);
        if (cooldownDate > new Date()) {
          issues.push(`Database: Emergency cooldown active until ${cooldownDate.toISOString()}`);
        }
      }
    }
  } catch (error) {
    issues.push('Database: Could not read runtime_config');
  }

  if (issues.length === 0) {
    console.log('   ✅ No obvious misconfigurations detected');
  } else {
    issues.forEach((issue, index) => {
      console.log(`   ${index + 1}. ❌ ${issue}`);
    });
  }
  
  console.log('\n🎯 RECOMMENDED FIXES:');
  console.log('   1. Remove/update artificial environment limits');
  console.log('   2. Update runtime_config.maxDailyTweets to 17');
  console.log('   3. Clear any emergency cooldown flags');
  console.log('   4. Implement dynamic rate limit detection from Twitter headers');
  console.log('   5. Use Twitter\'s actual 17/day write limit, not monthly caps');
}

// Run the audit
auditTwitterRateLimits().catch(console.error); 