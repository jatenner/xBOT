#!/usr/bin/env node

/**
 * 🎯 SHOW WORKING SYSTEMS
 * 
 * Demonstrates which robust architecture systems are functional
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function showWorkingSystems() {
  console.log('🎯 === ROBUST ARCHITECTURE STATUS ===');
  console.log('Checking which systems are functional...\n');

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 1. Database Tables Check
  console.log('📊 DATABASE TABLES:');
  const tables = [
    'twitter_rate_limits', 'tweet_performance', 'daily_growth',
    'quality_improvements', 'cached_insights', 'content_templates',
    'system_logs', 'budget_transactions', 'daily_budget_status'
  ];

  let workingTables = 0;
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        console.log(`  ✅ ${table} (${count || 0} rows)`);
        workingTables++;
      } else {
        console.log(`  ❌ ${table}: ${error.message}`);
      }
    } catch (err) {
      console.log(`  ❌ ${table}: ${err.message}`);
    }
  }

  // 2. Budget System Check  
  console.log('\n💰 BUDGET SYSTEM:');
  try {
    const { data: budget, error } = await supabase
      .from('daily_budget_status')
      .select('*')
      .eq('date', new Date().toISOString().split('T')[0])
      .single();
    
    if (!error && budget) {
      console.log(`  ✅ Daily Budget: $${budget.total_spent}/$${budget.budget_limit}`);
      console.log(`  ✅ Emergency Brake: ${budget.emergency_brake_active ? 'ACTIVE' : 'Inactive'}`);
      console.log(`  ✅ Remaining: $${(budget.budget_limit - budget.total_spent).toFixed(2)}`);
    } else {
      console.log(`  ❌ Budget system error: ${error?.message || 'No data'}`);
    }
  } catch (err) {
    console.log(`  ❌ Budget system error: ${err.message}`);
  }

  // 3. Core Files Check
  console.log('\n📁 CORE FILES:');
  const fs = require('fs');
  const coreFiles = [
    'src/utils/unifiedBudgetManager.ts',
    'src/utils/twitterRateLimits.ts', 
    'src/utils/engagementGrowthTracker.ts',
    'src/utils/contentQualityEngine.ts',
    'src/utils/smartContentEngine.ts',
    'src/agents/streamlinedPostAgent.ts'
  ];

  let workingFiles = 0;
  for (const file of coreFiles) {
    if (fs.existsSync(file)) {
      console.log(`  ✅ ${file}`);
      workingFiles++;
    } else {
      console.log(`  ❌ ${file} - Missing`);
    }
  }

  // 4. Compiled Files Check
  console.log('\n⚡ COMPILED FILES:');
  const compiledFiles = [
    'dist/utils/unifiedBudgetManager.js',
    'dist/utils/twitterRateLimits.js',
    'dist/utils/engagementGrowthTracker.js',
    'dist/utils/contentQualityEngine.js',
    'dist/utils/smartContentEngine.js',
    'dist/agents/streamlinedPostAgent.js'
  ];

  let compiledWorking = 0;
  for (const file of compiledFiles) {
    if (fs.existsSync(file)) {
      console.log(`  ✅ ${file}`);
      compiledWorking++;
    } else {
      console.log(`  ❌ ${file} - Not compiled`);
    }
  }

  // 5. Environment Check
  console.log('\n🔧 ENVIRONMENT:');
  const requiredEnvs = [
    'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 
    'OPENAI_API_KEY', 'TWITTER_API_KEY'
  ];

  let envWorking = 0;
  for (const env of requiredEnvs) {
    if (process.env[env]) {
      console.log(`  ✅ ${env} - Set`);
      envWorking++;
    } else {
      console.log(`  ❌ ${env} - Missing`);
    }
  }

  // 6. Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 ROBUST ARCHITECTURE SUMMARY:');
  console.log(`📊 Database Tables: ${workingTables}/${tables.length} working`);
  console.log(`📁 Core Files: ${workingFiles}/${coreFiles.length} present`);
  console.log(`⚡ Compiled Files: ${compiledWorking}/${compiledFiles.length} built`);
  console.log(`🔧 Environment: ${envWorking}/${requiredEnvs.length} configured`);

  const overallScore = Math.round(
    ((workingTables / tables.length) + 
     (workingFiles / coreFiles.length) + 
     (compiledWorking / compiledFiles.length) + 
     (envWorking / requiredEnvs.length)) / 4 * 100
  );

  console.log(`\n🎯 OVERALL READINESS: ${overallScore}%`);

  if (overallScore >= 80) {
    console.log('🎉 ROBUST ARCHITECTURE IS READY!');
    console.log('✅ Most systems are functional');
    console.log('🚀 You can proceed with using the new architecture');
  } else if (overallScore >= 60) {
    console.log('⚠️ PARTIAL READINESS');
    console.log('📝 Some components need attention');
    console.log('🔧 Check the failed items above');
  } else {
    console.log('❌ SETUP REQUIRED');
    console.log('🛠️ Major components need configuration');
  }

  console.log('='.repeat(60));

  // 7. Next Steps
  if (workingTables < tables.length) {
    console.log('\n📝 NEXT STEPS FOR DATABASE:');
    console.log('1. Copy migrations/FIX_MISSING_COLUMNS.sql');
    console.log('2. Paste into Supabase SQL Editor');
    console.log('3. Click "Run" to add missing columns');
  }

  if (compiledWorking < compiledFiles.length) {
    console.log('\n📝 NEXT STEPS FOR COMPILATION:');
    console.log('1. Run: npm run build');
    console.log('2. Check for TypeScript errors');
    console.log('3. Fix any import/export issues');
  }

  return overallScore;
}

showWorkingSystems(); 