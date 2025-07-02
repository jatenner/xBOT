const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function detailedConfigAudit() {
  console.log('🔍 === DETAILED CONFIGURATION AUDIT ===\n');

  // Fetch all the problematic config keys
  const problematicKeys = [
    'emergency_monthly_cap_mode',
    'smart_monthly_cap_mode', 
    'monthly_cap_workaround',
    'emergency_rate_limiting',
    'real_twitter_limits',
    'twitter_api_limits',
    'rate_limit_config',
    'monthly_budget_config'
  ];

  for (const key of problematicKeys) {
    try {
      const { data, error } = await supabase
        .from('bot_config')
        .select('key, value, updated_at')
        .eq('key', key)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error(`❌ Error fetching ${key}:`, error);
        continue;
      }

      if (!data) {
        console.log(`✅ ${key}: Not found (good!)\n`);
        continue;
      }

      console.log(`📄 ${key}:`);
      console.log(`   Updated: ${data.updated_at}`);
      
      let config;
      try {
        config = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      } catch (e) {
        config = data.value;
      }

      // Check for problematic values
      const issues = [];
      
      if (config.enabled === true) {
        issues.push('🚨 ENABLED - This is blocking posts!');
      }
      
      if (config.monthlyCapExceeded === true) {
        issues.push('🚨 monthlyCapExceeded flag is TRUE');
      }
      
      if (config.emergencyCooldownUntil) {
        const cooldownDate = new Date(config.emergencyCooldownUntil);
        if (cooldownDate > new Date()) {
          issues.push(`🚨 Emergency cooldown active until ${cooldownDate.toISOString()}`);
        }
      }
      
      if (config.maxDailyTweets && config.maxDailyTweets < 17) {
        issues.push(`🚨 maxDailyTweets=${config.maxDailyTweets} is below Twitter's 17/day limit`);
      }
      
      if (config.monthlyLimit && config.monthlyLimit < 500) {
        issues.push(`🚨 monthlyLimit=${config.monthlyLimit} is artificially low`);
      }

      if (config.mode === 'active' || config.status === 'active') {
        issues.push('🚨 Mode/Status is ACTIVE - blocking operations');
      }

      console.log(`   Value: ${JSON.stringify(config, null, 2)}`);
      
      if (issues.length > 0) {
        console.log('   ⚠️  ISSUES DETECTED:');
        issues.forEach(issue => console.log(`      • ${issue}`));
      } else {
        console.log('   ✅ No obvious issues detected');
      }
      
      console.log('');
    } catch (error) {
      console.error(`❌ Error processing ${key}:`, error);
    }
  }

  // Check for any other configs with "monthly" or "cap" in their value
  console.log('🔍 Searching for other configs mentioning "monthly" or "cap"...\n');
  
  try {
    const { data: allConfigs } = await supabase
      .from('bot_config')
      .select('key, value');

    const suspiciousConfigs = allConfigs?.filter(config => {
      const valueStr = JSON.stringify(config.value).toLowerCase();
      return valueStr.includes('monthly') || 
             valueStr.includes('cap') || 
             valueStr.includes('exceed') ||
             valueStr.includes('cooldown');
    });

    if (suspiciousConfigs && suspiciousConfigs.length > 0) {
      suspiciousConfigs.forEach(config => {
        console.log(`🔍 ${config.key}: Contains suspicious keywords`);
        console.log(`   Value: ${JSON.stringify(config.value, null, 2)}\n`);
      });
    } else {
      console.log('✅ No other suspicious configurations found');
    }
    
  } catch (error) {
    console.error('❌ Error searching for suspicious configs:', error);
  }
}

detailedConfigAudit().catch(console.error); 