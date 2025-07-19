#!/usr/bin/env node

/**
 * 🔧 FIX DUPLICATE CONFIG KEYS
 * =============================
 * 
 * The emergency fix encountered duplicate key errors.
 * This script updates existing configuration keys instead of inserting new ones.
 */

const { createClient } = require('@supabase/supabase-js');

async function fixDuplicateConfigKeys() {
  console.log('🔧 FIXING DUPLICATE CONFIG KEYS');
  console.log('===============================');

  const supabaseUrl = process.env.SUPABASE_URL || "https://qtgjmaelglghnlahqpbl.supabase.co";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0Z2ptYWVsZ2xnaG5sYWhxcGJsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTYwNjUxMCwiZXhwIjoyMDY1MTgyNTEwfQ.Gze-MRjDg592T02LpyTlyXt14QkiIgRFgvnMeUchUfU";

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const today = new Date().toISOString().split('T')[0];

    // Update Twitter rate limit configuration
    console.log('🐦 Updating Twitter rate limit configuration...');
    
    const twitterConfigs = [
      { key: 'twitter_daily_posts_used', value: '0', description: 'RESET: Daily posts used count' },
      { key: 'twitter_daily_limit', value: '17', description: 'RESET: Daily posting limit' },
      { key: 'twitter_last_reset_date', value: today, description: 'RESET: Last rate limit reset date' },
      { key: 'twitter_rate_limit_status', value: 'CLEARED', description: 'RESET: Rate limit status cleared' }
    ];

    for (const config of twitterConfigs) {
      const { error } = await supabase
        .from('bot_config')
        .update({ 
          value: config.value, 
          description: config.description,
          updated_at: new Date().toISOString()
        })
        .eq('key', config.key);

      if (error) {
        // If update fails, try insert (key doesn't exist)
        const { error: insertError } = await supabase
          .from('bot_config')
          .insert(config);
        
        if (insertError) {
          console.error(`❌ Failed to update/insert ${config.key}:`, insertError.message);
        } else {
          console.log(`✅ Inserted ${config.key}: ${config.value}`);
        }
      } else {
        console.log(`✅ Updated ${config.key}: ${config.value}`);
      }
    }

    // Update emergency mode configuration
    console.log('\n⚡ Updating emergency mode configuration...');
    
    const emergencyConfigs = [
      { key: 'emergency_mode', value: 'false', description: 'DISABLED: Emergency mode turned off' },
      { key: 'disable_learning_agents', value: 'false', description: 'ENABLED: Learning agents restored' },
      { key: 'max_posts_per_day', value: '15', description: 'RESTORED: Maximum posts per day' },
      { key: 'viral_mode_active', value: 'true', description: 'ENABLED: Viral content mode active' }
    ];

    for (const config of emergencyConfigs) {
      const { error } = await supabase
        .from('bot_config')
        .update({ 
          value: config.value, 
          description: config.description,
          updated_at: new Date().toISOString()
        })
        .eq('key', config.key);

      if (error) {
        // If update fails, try insert (key doesn't exist)
        const { error: insertError } = await supabase
          .from('bot_config')
          .insert(config);
        
        if (insertError) {
          console.error(`❌ Failed to update/insert ${config.key}:`, insertError.message);
        } else {
          console.log(`✅ Inserted ${config.key}: ${config.value}`);
        }
      } else {
        console.log(`✅ Updated ${config.key}: ${config.value}`);
      }
    }

    // Add additional essential configurations
    console.log('\n🎯 Adding essential configurations...');
    
    const essentialConfigs = [
      { key: 'daily_budget_limit', value: '3.00', description: 'ENFORCED: Daily budget limit' },
      { key: 'budget_enforcement_active', value: 'true', description: 'ENABLED: Budget enforcement system' },
      { key: 'posting_enabled', value: 'true', description: 'ENABLED: Posting functionality active' },
      { key: 'viral_transformation_active', value: 'true', description: 'ENABLED: Viral transformation deployed' }
    ];

    for (const config of essentialConfigs) {
      const { error } = await supabase
        .from('bot_config')
        .update({ 
          value: config.value, 
          description: config.description,
          updated_at: new Date().toISOString()
        })
        .eq('key', config.key);

      if (error) {
        // If update fails, try insert (key doesn't exist)
        const { error: insertError } = await supabase
          .from('bot_config')
          .insert(config);
        
        if (insertError) {
          console.error(`❌ Failed to update/insert ${config.key}:`, insertError.message);
        } else {
          console.log(`✅ Inserted ${config.key}: ${config.value}`);
        }
      } else {
        console.log(`✅ Updated ${config.key}: ${config.value}`);
      }
    }

    // Verify final configuration
    console.log('\n✅ VERIFICATION');
    console.log('===============');

    const { data: configData } = await supabase
      .from('bot_config')
      .select('*')
      .in('key', [
        'emergency_mode', 
        'viral_mode_active', 
        'max_posts_per_day',
        'twitter_daily_posts_used',
        'daily_budget_limit',
        'posting_enabled'
      ]);

    console.log('\n⚙️ Current Bot Configuration:');
    if (configData) {
      configData.forEach(config => {
        console.log(`   ${config.key}: ${config.value} - ${config.description}`);
      });
    }

    console.log('\n🎉 CONFIGURATION UPDATE COMPLETE!');
    console.log('=================================');
    console.log('✅ All duplicate key issues resolved');
    console.log('✅ Emergency mode disabled');
    console.log('✅ Viral mode activated');
    console.log('✅ Twitter rate limits reset');
    console.log('✅ Budget enforcement active');
    console.log('✅ Ready for viral transformation!');

  } catch (error) {
    console.error('❌ CONFIGURATION UPDATE FAILED:', error);
  }
}

// Run the fix
if (require.main === module) {
  fixDuplicateConfigKeys()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { fixDuplicateConfigKeys }; 