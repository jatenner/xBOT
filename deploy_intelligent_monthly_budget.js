/**
 * DEPLOY INTELLIGENT MONTHLY BUDGET SYSTEM
 * Removes artificial 17 tweets/day limit and implements intelligent 1500 tweets/month distribution
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deployIntelligentMonthlyBudget() {
  console.log('🚀 DEPLOYING INTELLIGENT MONTHLY BUDGET SYSTEM');
  console.log('   Replacing artificial 17 tweets/day limit with dynamic 1500/month distribution');
  
  try {
    // 1. Create monthly_budget_state table
    console.log('📊 Creating monthly_budget_state table...');
    const { error: tableError } = await supabase.rpc('create_monthly_budget_table');
    
    // Create table manually if RPC doesn't exist
    await supabase.query(`
      CREATE TABLE IF NOT EXISTS monthly_budget_state (
        month TEXT PRIMARY KEY,
        tweets_used INTEGER DEFAULT 0,
        tweets_budget INTEGER DEFAULT 1500,
        days_remaining INTEGER DEFAULT 30,
        daily_targets JSONB DEFAULT '{}',
        strategic_reserves INTEGER DEFAULT 225,
        performance_multiplier REAL DEFAULT 1.0,
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    // 2. Update bot_config with intelligent budget settings
    console.log('⚙️ Updating bot configuration...');
    
    // Remove artificial restrictions
    await supabase
      .from('bot_config')
      .delete()
      .in('key', ['target_tweets_per_day', 'emergency_daily_limit']);
    
    // Add intelligent monthly budget config
    await supabase
      .from('bot_config')
      .upsert({
        key: 'monthly_budget_config',
        value: {
          monthly_tweet_budget: 1500, // Twitter API Free Tier limit
          dynamic_daily_targeting: true,
          max_daily_tweets: 75, // Safety cap (5% of monthly)
          min_daily_tweets: 20, // Minimum baseline activity
          baseline_daily_target: 50, // Default: ~1500/30 days
          strategic_reserve_percentage: 0.15, // 15% for opportunities
          performance_boost_enabled: true,
          opportunity_boost_enabled: true,
          intelligent_distribution: true
        },
        description: 'Intelligent monthly budget management - dynamic daily distribution based on trends and opportunities'
      });
    
    // Update runtime config
    await supabase
      .from('bot_config')
      .upsert({
        key: 'runtime_config',
        value: {
          posting_strategy: 'intelligent_monthly_budget',
          fallback_stagger_minutes: 30, // More responsive
          max_daily_tweets: 75, // Dynamic safety cap
          quality_readability_min: 55,
          quality_credibility_min: 0.85
        }
      });
    
    // 3. Initialize current month's budget state
    console.log('📅 Initializing current month budget...');
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    
    await supabase
      .from('monthly_budget_state')
      .upsert({
        month: currentMonth,
        tweets_used: 0,
        tweets_budget: 1500,
        days_remaining: getDaysRemainingInMonth(),
        daily_targets: {},
        strategic_reserves: 225, // 15% of 1500
        performance_multiplier: 1.0,
        last_updated: new Date().toISOString()
      });
    
    // 4. Test the new system
    console.log('🧪 Testing intelligent target calculation...');
    
    // Simulate checking what the new daily target would be
    const mockCalculation = {
      baseTarget: Math.floor(1500 / getDaysRemainingInMonth()),
      opportunityBoost: 0.2, // 20% boost example
      performanceModifier: 1.1, // 10% boost example
      budgetFactor: 1.0, // On track
      finalTarget: Math.min(75, Math.max(20, Math.floor(1500 / getDaysRemainingInMonth() * 1.32))) // Example calculation
    };
    
    console.log('📊 INTELLIGENT BUDGET CALCULATION:');
    console.log(`   Base Target: ${mockCalculation.baseTarget} tweets/day (1500 ÷ ${getDaysRemainingInMonth()} days)`);
    console.log(`   Opportunity Boost: +${(mockCalculation.opportunityBoost * 100).toFixed(0)}%`);
    console.log(`   Performance Boost: +${((mockCalculation.performanceModifier - 1) * 100).toFixed(0)}%`);
    console.log(`   Final Target: ${mockCalculation.finalTarget} tweets/day`);
    console.log(`   Monthly Utilization: 0/1500 (0%)`);
    
    // 5. Verify deployment
    console.log('✅ Verifying deployment...');
    
    const { data: budgetConfig } = await supabase
      .from('bot_config')
      .select('*')
      .eq('key', 'monthly_budget_config')
      .single();
    
    const { data: runtimeConfig } = await supabase
      .from('bot_config')
      .select('*')
      .eq('key', 'runtime_config')
      .single();
    
    const { data: monthlyState } = await supabase
      .from('monthly_budget_state')
      .select('*')
      .eq('month', currentMonth)
      .single();
    
    console.log('🔍 DEPLOYMENT VERIFICATION:');
    console.log(`   ✅ Monthly Budget Config: ${budgetConfig ? 'ACTIVE' : 'MISSING'}`);
    console.log(`   ✅ Runtime Config: ${runtimeConfig?.value?.posting_strategy || 'MISSING'}`);
    console.log(`   ✅ Monthly State: ${monthlyState ? `${monthlyState.tweets_used}/${monthlyState.tweets_budget}` : 'MISSING'}`);
    
    if (budgetConfig && runtimeConfig && monthlyState) {
      console.log('\n🎉 INTELLIGENT MONTHLY BUDGET SYSTEM DEPLOYED!');
      console.log('');
      console.log('🔥 BREAKTHROUGH FEATURES:');
      console.log('   📈 Dynamic daily targets (20-75 tweets/day based on opportunities)');
      console.log('   🎯 1500 tweets/month budget tracking');
      console.log('   🚀 Opportunity-based boost (trending topics = more posts)');
      console.log('   🧠 Performance-based adjustment (good engagement = more posts)');
      console.log('   ⚡ Strategic reserves for viral opportunities');
      console.log('   📊 End-of-month urgency mode');
      console.log('');
      console.log('📊 EXPECTED PERFORMANCE:');
      console.log('   • High opportunity days: 50-75 tweets');
      console.log('   • Normal days: 35-50 tweets'); 
      console.log('   • Low activity days: 20-35 tweets');
      console.log('   • Month-end catch-up: Up to 75 tweets');
      console.log('');
      console.log('🎯 This system will maximize your 1500 monthly tweets based on:');
      console.log('   - Trending healthcare/AI topics');
      console.log('   - Recent engagement performance');
      console.log('   - Remaining monthly budget');
      console.log('   - Strategic viral opportunities');
      
      return true;
    } else {
      console.log('❌ DEPLOYMENT INCOMPLETE - Some components missing');
      return false;
    }
    
  } catch (error) {
    console.error('❌ DEPLOYMENT FAILED:', error);
    return false;
  }
}

function getDaysRemainingInMonth() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.max(1, lastDay - now.getDate() + 1);
}

// Execute deployment
if (require.main === module) {
  deployIntelligentMonthlyBudget()
    .then(success => {
      if (success) {
        console.log('\n✅ Ready for next deployment!');
        process.exit(0);
      } else {
        console.log('\n❌ Deployment failed - check logs');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Fatal deployment error:', error);
      process.exit(1);
    });
}

module.exports = { deployIntelligentMonthlyBudget }; 