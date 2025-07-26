#!/usr/bin/env node

/**
 * 🚨 CRITICAL DIAGNOSTIC: Database Saving Failure
 * 
 * This script diagnoses why tweets are posting to Twitter 
 * but not saving to the Supabase database
 */

import { MasterTweetStorageIntegrator } from './src/utils/masterTweetStorageIntegrator.ts';
import { PostTweetAgent } from './src/agents/postTweet.ts';

async function diagnoseDatabaseSaving() {
  console.log('🚨 === CRITICAL DIAGNOSTIC: DATABASE SAVING FAILURE ===');
  
  try {
    console.log('\n🔍 Step 1: Testing Ultimate Storage Architecture directly...');
    
    const testTweet = {
      tweet_id: `diagnostic_${Date.now()}`,
      content: 'DIAGNOSTIC TEST: If you see this tweet posted but not in database, the issue is confirmed.',
      content_type: 'diagnostic_test',
      viral_score: 5,
      ai_optimized: true,
      generation_method: 'diagnostic'
    };
    
    console.log('📝 Attempting to store test tweet...');
    const storageResult = await MasterTweetStorageIntegrator.storeTweet(testTweet);
    
    if (storageResult.success) {
      console.log('✅ ULTIMATE STORAGE WORKING: Test tweet saved successfully');
      console.log(`   Database ID: ${storageResult.database_id}`);
      console.log(`   Storage time: ${storageResult.performance_metrics?.storage_time_ms}ms`);
    } else {
      console.log('❌ ULTIMATE STORAGE FAILED:', storageResult.error);
    }
    
    console.log('\n🔍 Step 2: Testing PostTweetAgent storage method...');
    
    // Test the exact storage method used by PostTweetAgent
    try {
      const postAgent = new PostTweetAgent();
      // Access the private method for testing (this is hacky but necessary for diagnosis)
      console.log('📝 Testing PostTweetAgent storage logic...');
      
      // Simulate the exact call made after successful Twitter posting
      await postAgent.storeTweetWithAIMetrics(
        'diagnostic_post_agent_test', 
        'PostTweetAgent diagnostic test content',
        'diagnostic',
        8,
        6
      );
      
      console.log('✅ PostTweetAgent storage method working');
      
    } catch (error) {
      console.log('❌ PostTweetAgent storage method failed:', error.message);
    }
    
    console.log('\n🔍 Step 3: Check environment variables...');
    
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'TWITTER_BEARER_TOKEN',
      'TWITTER_API_KEY',
      'TWITTER_API_SECRET',
      'TWITTER_ACCESS_TOKEN',
      'TWITTER_ACCESS_TOKEN_SECRET'
    ];
    
    let envIssues = 0;
    requiredEnvVars.forEach(envVar => {
      const value = process.env[envVar];
      if (!value) {
        console.log(`❌ Missing: ${envVar}`);
        envIssues++;
      } else {
        console.log(`✅ Present: ${envVar} (${value.substring(0, 10)}...)`);
      }
    });
    
    if (envIssues > 0) {
      console.log(`⚠️ Found ${envIssues} environment variable issues`);
    } else {
      console.log('✅ All environment variables present');
    }
    
    console.log('\n🔍 Step 4: Check recent database entries...');
    
    const { secureSupabaseClient } = await import('./src/utils/secureSupabaseClient.ts');
    
    if (secureSupabaseClient.supabase) {
      const { data: recentTweets, error } = await secureSupabaseClient.supabase
        .from('tweets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) {
        console.log('❌ Database query failed:', error.message);
      } else {
        console.log(`📊 Found ${recentTweets?.length || 0} recent tweets in database:`);
        recentTweets?.forEach((tweet, i) => {
          const createdAt = new Date(tweet.created_at);
          const hoursAgo = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
          console.log(`   ${i + 1}. ${createdAt.toLocaleString()} (${hoursAgo.toFixed(1)}h ago)`);
          console.log(`      Content: ${tweet.content.substring(0, 50)}...`);
          console.log(`      Method: ${tweet.generation_method || 'unknown'}`);
        });
      }
    } else {
      console.log('❌ Supabase client not initialized');
    }
    
    console.log('\n🔍 Step 5: Check for deployment differences...');
    
    // Check if we're in production environment
    const isProduction = process.env.NODE_ENV === 'production';
    const renderService = process.env.RENDER_SERVICE_NAME;
    
    console.log(`Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    if (renderService) {
      console.log(`Render Service: ${renderService}`);
    }
    
    console.log('\n📊 === DIAGNOSTIC SUMMARY ===');
    
    if (storageResult?.success) {
      console.log('✅ Database storage functionality: WORKING');
      console.log('🎯 LIKELY ISSUE: Environment variable mismatch or different posting agent in production');
      console.log('');
      console.log('🔍 NEXT STEPS:');
      console.log('1. Check if production environment has correct env vars');
      console.log('2. Verify which posting agent is actually being used in live deployment');
      console.log('3. Check if PostTweetAgent.run() is throwing errors silently');
      console.log('4. Add more logging to trace the exact failure point');
    } else {
      console.log('❌ Database storage functionality: BROKEN');
      console.log('🎯 CRITICAL ISSUE: Ultimate Storage Architecture is failing');
      console.log('');
      console.log('🔍 IMMEDIATE FIXES NEEDED:');
      console.log('1. Fix Ultimate Storage Architecture');
      console.log('2. Test database connectivity');
      console.log('3. Verify Supabase permissions');
    }
    
  } catch (error) {
    console.error('💥 DIAGNOSTIC FAILED:', error);
    console.log('This suggests a critical system-level issue');
  }
}

diagnoseDatabaseSaving().catch(console.error); 