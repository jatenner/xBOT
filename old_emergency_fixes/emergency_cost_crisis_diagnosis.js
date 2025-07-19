#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function emergencyCostDiagnosis() {
  console.log('🚨 EMERGENCY COST CRISIS DIAGNOSIS');
  console.log('==================================');
  console.log('💰 SPENT: $92 in 9 days = $10.22/day average');
  console.log('📈 PROJECTED: $300+/month (CRITICAL!)');
  console.log('🎯 TARGET: $1-2/day maximum\n');

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase credentials');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Check 1: OpenAI Cost Configuration
  console.log('💸 CHECKING OPENAI COST SETTINGS:');
  console.log('==================================');

  try {
    const { data: configs, error } = await supabase
      .from('bot_config')
      .select('*')
      .in('key', [
        'openai_daily_cost',
        'runtime_config',
        'emergency_mode',
        'cost_optimizer_settings'
      ]);

    if (error) {
      console.log('❌ Error fetching cost configs:', error.message);
    } else {
      configs.forEach(config => {
        console.log(`📊 ${config.key}:`);
        if (typeof config.value === 'object') {
          console.log('   ', JSON.stringify(config.value, null, 2));
        } else {
          console.log('   ', config.value);
        }
      });
    }
  } catch (error) {
    console.log('❌ Cost config check failed:', error.message);
  }

  // Check 2: Recent API Usage Patterns
  console.log('\n📈 ANALYZING API USAGE PATTERNS:');
  console.log('=================================');

  try {
    const { data: apiUsage, error } = await supabase
      .from('api_usage_tracking')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.log('❌ Error fetching API usage:', error.message);
    } else if (apiUsage.length === 0) {
      console.log('⚠️  No API usage tracking found');
    } else {
      console.log(`✅ Found ${apiUsage.length} recent API usage records:`);
      
      // Group by API type and calculate totals
      const usageByType = {};
      const usageByDate = {};
      
      apiUsage.forEach(usage => {
        const apiType = usage.api_type || 'unknown';
        const date = usage.date || usage.created_at?.split('T')[0] || 'unknown';
        
        if (!usageByType[apiType]) {
          usageByType[apiType] = { calls: 0, cost: 0 };
        }
        if (!usageByDate[date]) {
          usageByDate[date] = { calls: 0, cost: 0 };
        }
        
        usageByType[apiType].calls += usage.count || 1;
        usageByType[apiType].cost += parseFloat(usage.cost || 0);
        
        usageByDate[date].calls += usage.count || 1;
        usageByDate[date].cost += parseFloat(usage.cost || 0);
      });

      console.log('\n💰 COST BY API TYPE:');
      Object.entries(usageByType).forEach(([type, data]) => {
        console.log(`   ${type}: ${data.calls} calls, $${data.cost.toFixed(2)}`);
      });

      console.log('\n📅 COST BY DATE:');
      Object.entries(usageByDate).slice(0, 7).forEach(([date, data]) => {
        console.log(`   ${date}: ${data.calls} calls, $${data.cost.toFixed(2)}`);
      });
    }
  } catch (error) {
    console.log('❌ API usage analysis failed:', error.message);
  }

  // Check 3: Scheduler Job Frequency
  console.log('\n⏰ CHECKING SCHEDULER FREQUENCY:');
  console.log('================================');

  try {
    const { data: schedulerJobs, error } = await supabase
      .from('scheduler_jobs')
      .select('*')
      .order('last_run', { ascending: false })
      .limit(10);

    if (error) {
      console.log('❌ Error fetching scheduler jobs:', error.message);
    } else if (schedulerJobs.length === 0) {
      console.log('⚠️  No scheduler jobs found');
    } else {
      console.log(`✅ Found ${schedulerJobs.length} scheduler jobs:`);
      schedulerJobs.forEach(job => {
        const lastRun = job.last_run ? new Date(job.last_run).toLocaleString() : 'never';
        console.log(`   ${job.job_name}: ${job.frequency}, last run: ${lastRun}`);
      });
    }
  } catch (error) {
    console.log('❌ Scheduler jobs check failed:', error.message);
  }

  // Check 4: Recent Tweets vs Cost Ratio
  console.log('\n🐦 COST EFFICIENCY ANALYSIS:');
  console.log('============================');

  try {
    const { data: recentTweets, error } = await supabase
      .from('tweets')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.log('❌ Error fetching recent tweets:', error.message);
    } else {
      const tweetCount = recentTweets.length;
      const costPerTweet = 92 / tweetCount;
      
      console.log(`📊 Tweets in last 9 days: ${tweetCount}`);
      console.log(`💰 Cost per tweet: $${costPerTweet.toFixed(2)}`);
      console.log(`🎯 Target cost per tweet: $0.10-0.20`);
      
      if (costPerTweet > 1) {
        console.log('🚨 CRITICAL: Cost per tweet is 5-10x too high!');
      } else if (costPerTweet > 0.5) {
        console.log('⚠️  WARNING: Cost per tweet is 2-5x too high');
      }
    }
  } catch (error) {
    console.log('❌ Cost efficiency analysis failed:', error.message);
  }

  // Diagnosis Summary
  console.log('\n🔍 LIKELY COST ISSUES:');
  console.log('======================');
  console.log('1. 🤖 OpenAI API calls too frequent/expensive');
  console.log('2. ⏰ Scheduler jobs running too often');
  console.log('3. 🧠 Learning agents making excessive API calls');
  console.log('4. 📊 No cost limits or budgets enforced');
  console.log('5. 🎯 Expensive models (GPT-4) instead of cheaper ones');

  console.log('\n🚨 IMMEDIATE ACTIONS NEEDED:');
  console.log('============================');
  console.log('1. EMERGENCY: Enable ultra-strict cost controls');
  console.log('2. REDUCE: Scheduler frequency (every 2-4 hours, not minutes)');
  console.log('3. LIMIT: Max $2/day budget with hard stops');
  console.log('4. SWITCH: To cheaper OpenAI models (GPT-3.5)');
  console.log('5. DISABLE: Learning agents temporarily');

  console.log('\n🔧 RUN EMERGENCY FIX:');
  console.log('=====================');
  console.log('node emergency_ultra_cost_protection.js');
}

// Run the diagnosis
emergencyCostDiagnosis().catch(console.error); 