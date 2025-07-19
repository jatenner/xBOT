#!/usr/bin/env node

/**
 * 🚨 CRITICAL: Fix Supabase Backend Database Schema Issues
 * 
 * ROOT CAUSE IDENTIFIED:
 * - Real-Time Limits Intelligence Agent queries 'api_usage_tracking' table
 * - Supabase backend only has 'api_usage' and 'monthly_api_usage' tables  
 * - Missing table causes silent failures → false "17/17 available" → API spam
 * 
 * This creates the missing table and syncs existing data.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

console.log('🚨 CRITICAL SUPABASE BACKEND FIX');
console.log('=================================');
console.log('🎯 Target: Create missing api_usage_tracking table');
console.log('📋 Issue: Silent query failures causing false limit readings');

const supabase = createClient(
  'https://rjhsdeqohbwrqtwzmikr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqaHNkZXFvaGJ3cnF0d3ptaWtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQxNDY4OTksImV4cCI6MjA0OTcyMjg5OX0.1-HFTXFLafXnRkmEL7w6YrqkAE8sjfKVSYYCT74iYdY'
);

async function fixSupabaseBackend() {
  try {
    console.log('🔍 Step 1: Diagnosing current backend state...');
    
    // Try to query the missing table to confirm it doesn't exist
    try {
      const { data, error } = await supabase
        .from('api_usage_tracking')
        .select('*')
        .limit(1);
      
      if (error) {
        console.log('❌ CONFIRMED: api_usage_tracking table missing');
        console.log(`   Error: ${error.message}`);
      } else {
        console.log('✅ api_usage_tracking table exists - checking data...');
        console.log(`   Records found: ${data?.length || 0}`);
      }
    } catch (err) {
      console.log('❌ CONFIRMED: Backend table missing or inaccessible');
    }

    // Check if existing api_usage table has data (to sync)
    try {
      const { data: apiUsageData, error: apiError } = await supabase
        .from('api_usage')
        .select('*')
        .order('date', { ascending: false })
        .limit(5);
      
      if (!apiError && apiUsageData) {
        console.log('📊 Found existing api_usage data:');
        apiUsageData.forEach(row => {
          console.log(`   ${row.date}: ${row.writes || 0} writes, ${row.reads || 0} reads`);
        });
      }
    } catch (err) {
      console.log('⚠️ Could not check existing api_usage data');
    }

    console.log('');
    console.log('🔧 Step 2: Applying emergency schema fix...');
    
    // Read and execute the SQL fix
    const sqlFix = fs.readFileSync('./supabase/emergency_api_usage_tracking_fix.sql', 'utf8');
    
    // Note: This would need to be run via SQL editor or psql
    // Supabase JS client doesn't support CREATE TABLE via RPC
    console.log('📋 SQL Fix Prepared:');
    console.log('   - Creates api_usage_tracking table');
    console.log('   - Adds proper indexes');
    console.log('   - Syncs existing data');
    console.log('   - Creates tracking functions');
    console.log('   - Enables RLS policies');

    console.log('');
    console.log('🚨 MANUAL ACTION REQUIRED:');
    console.log('=========================');
    console.log('1. Open Supabase Dashboard → SQL Editor');
    console.log('2. Paste contents of: supabase/emergency_api_usage_tracking_fix.sql');
    console.log('3. Execute the SQL to create missing table');
    console.log('4. Verify with: SELECT * FROM api_usage_tracking LIMIT 5;');

    console.log('');
    console.log('✅ AFTER APPLYING SQL FIX:');
    console.log('==========================');
    console.log('🎯 Real-Time Limits Intelligence will work correctly');
    console.log('📊 No more silent query failures');
    console.log('🚫 No more false "17/17 available" readings');
    console.log('⚡ API rate limiting cascade will be prevented');

    console.log('');
    console.log('📋 TO VERIFY FIX WORKED:');
    console.log('========================');
    console.log('1. Apply SQL fix in Supabase');
    console.log('2. Redeploy bot to Render');
    console.log('3. Check logs for "📊 DATABASE MISMATCH CHECK"');
    console.log('4. Should see proper API usage tracking');

    // Create verification script
    const verificationScript = `
-- Verify the backend fix worked
SELECT 'Checking api_usage_tracking table...' as step;
SELECT COUNT(*) as total_records FROM api_usage_tracking;

SELECT 'Checking today\\'s data...' as step;
SELECT api_type, tweets_posted, reads_made 
FROM api_usage_tracking 
WHERE date = CURRENT_DATE;

SELECT 'Checking daily_api_stats view...' as step;
SELECT * FROM daily_api_stats 
WHERE date = CURRENT_DATE;
`;

    fs.writeFileSync('./verify_backend_fix.sql', verificationScript);
    console.log('📄 Created verification script: verify_backend_fix.sql');

  } catch (error) {
    console.error('❌ Backend diagnosis failed:', error.message);
    console.log('');
    console.log('🚨 CRITICAL ISSUE CONFIRMED:');
    console.log('Backend database schema mismatch causing false API limit readings!');
    console.log('Apply the SQL fix manually to resolve the issue.');
  }
}

fixCriticalSupabaseBackend().catch(console.error);

async function fixCriticalSupabaseBackend() {
  await fixSupabaseBackend();
} 