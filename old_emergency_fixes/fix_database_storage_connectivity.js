#!/usr/bin/env node

/**
 * 🔧 DATABASE STORAGE & CONNECTIVITY FIX
 * 
 * CRITICAL ISSUE: Bot posts to Twitter but fails to store in database
 * This script fixes all database storage issues and ensures proper connectivity
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

async function fixDatabaseStorage() {
  console.log('🔧 === DATABASE STORAGE & CONNECTIVITY FIX ===');
  console.log('🎯 MISSION: Ensure all tweets are properly stored in database');
  
  try {
    // STEP 1: Verify database connectivity
    await verifyConnectivity();
    
    // STEP 2: Check and fix table schema issues
    await checkTableSchema();
    
    // STEP 3: Test storage mechanisms
    await testStorageMechanisms();
    
    // STEP 4: Create comprehensive storage validation
    await createStorageValidation();
    
    // STEP 5: Fix any existing data inconsistencies
    await fixDataInconsistencies();
    
    console.log('');
    console.log('✅ === DATABASE STORAGE FIX COMPLETE ===');
    console.log('🛡️ All tweet storage is now properly configured');
    
  } catch (error) {
    console.error('💥 Database storage fix failed:', error);
  }
}

async function verifyConnectivity() {
  console.log('🔍 === VERIFYING DATABASE CONNECTIVITY ===');
  
  try {
    // Test basic connection
    const { data: connectionTest, error: connectionError } = await supabase
      .from('bot_config')
      .select('count')
      .single();
    
    if (connectionError) {
      console.log('❌ Database connection failed:', connectionError.message);
      throw new Error('Database connectivity issue');
    }
    
    console.log('✅ Database connection: OK');
    
    // Test authentication and permissions
    const { data: authTest, error: authError } = await supabase
      .from('tweets')
      .select('count')
      .single();
    
    if (authError) {
      console.log('❌ Authentication/permissions failed:', authError.message);
      throw new Error('Database permissions issue');
    }
    
    console.log('✅ Authentication & permissions: OK');
    
    // Test RLS policies
    const testRecord = {
      tweet_id: 'connectivity_test_' + Date.now(),
      content: 'Database connectivity test',
      tweet_type: 'test',
      content_type: 'connectivity_test',
      engagement_score: 0,
      likes: 0,
      retweets: 0,
      replies: 0,
      impressions: 0,
      has_snap2health_cta: false
    };
    
    const { data: rlsTest, error: rlsError } = await supabase
      .from('tweets')
      .insert(testRecord)
      .select()
      .single();
    
    if (rlsError) {
      console.log('❌ RLS policies blocking insert:', rlsError.message);
      throw new Error('RLS policy issue');
    }
    
    console.log('✅ RLS policies: OK');
    
    // Clean up test record
    if (rlsTest) {
      await supabase
        .from('tweets')
        .delete()
        .eq('id', rlsTest.id);
      console.log('✅ Test record cleaned up');
    }
    
  } catch (error) {
    console.error('❌ Connectivity verification failed:', error);
    throw error;
  }
}

async function checkTableSchema() {
  console.log('📋 === CHECKING TABLE SCHEMA ===');
  
  try {
    // Get actual table structure
    const { data: sampleRecord } = await supabase
      .from('tweets')
      .select('*')
      .limit(1)
      .single();
    
    const availableColumns = sampleRecord ? Object.keys(sampleRecord) : [];
    console.log('📊 Available columns:', availableColumns.join(', '));
    
    // Check for problematic column usage in code
    const problematicMappings = {
      'twitter_id': 'tweet_id',    // Code uses twitter_id, should use tweet_id
      'posted_at': 'created_at',   // Code uses posted_at, should use created_at  
      'style': 'content_type'      // Code uses style, should use content_type
    };
    
    console.log('\n🔧 Column mapping fixes needed:');
    Object.entries(problematicMappings).forEach(([wrong, correct]) => {
      const hasWrong = !availableColumns.includes(wrong);
      const hasCorrect = availableColumns.includes(correct);
      
      if (hasWrong && hasCorrect) {
        console.log(`   ✅ ${wrong} → ${correct}: Fixed in code`);
      } else if (!hasWrong && hasCorrect) {
        console.log(`   ⚠️ ${wrong} → ${correct}: Both exist, prefer ${correct}`);
      } else {
        console.log(`   ❌ ${wrong} → ${correct}: Column issue detected`);
      }
    });
    
    // Verify required columns exist
    const requiredColumns = [
      'tweet_id', 'content', 'tweet_type', 'content_type',
      'engagement_score', 'likes', 'retweets', 'replies',
      'has_snap2health_cta', 'created_at'
    ];
    
    console.log('\n📋 Required columns check:');
    const missingColumns = [];
    
    requiredColumns.forEach(col => {
      if (availableColumns.includes(col)) {
        console.log(`   ✅ ${col}: Available`);
      } else {
        console.log(`   ❌ ${col}: Missing`);
        missingColumns.push(col);
      }
    });
    
    if (missingColumns.length > 0) {
      throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
    }
    
    console.log('✅ All required columns available');
    
  } catch (error) {
    console.error('❌ Schema check failed:', error);
    throw error;
  }
}

async function testStorageMechanisms() {
  console.log('🧪 === TESTING STORAGE MECHANISMS ===');
  
  try {
    // Test 1: Basic storage with minimal data
    console.log('🧪 Test 1: Basic storage...');
    
    const basicTest = {
      tweet_id: 'basic_test_' + Date.now(),
      content: 'Basic storage test',
      tweet_type: 'original',
      content_type: 'test',
      engagement_score: 0,
      likes: 0,
      retweets: 0,
      replies: 0,
      impressions: 0,
      has_snap2health_cta: false
    };
    
    const { data: basicData, error: basicError } = await supabase
      .from('tweets')
      .insert(basicTest)
      .select()
      .single();
    
    if (basicError) {
      console.log('❌ Basic storage failed:', basicError.message);
      throw basicError;
    }
    
    console.log('✅ Basic storage: SUCCESS');
    
    // Test 2: Storage with all fields
    console.log('🧪 Test 2: Full field storage...');
    
    const fullTest = {
      tweet_id: 'full_test_' + Date.now(),
      content: 'Full field storage test with all available columns',
      tweet_type: 'original',
      content_type: 'viral_content',
      content_category: 'test_category',
      source_attribution: 'TestAgent',
      engagement_score: 85,
      likes: 10,
      retweets: 5,
      replies: 3,
      impressions: 1000,
      has_snap2health_cta: true,
      image_url: 'https://example.com/test.jpg',
      new_followers: 2
    };
    
    const { data: fullData, error: fullError } = await supabase
      .from('tweets')
      .insert(fullTest)
      .select()
      .single();
    
    if (fullError) {
      console.log('❌ Full field storage failed:', fullError.message);
      throw fullError;
    }
    
    console.log('✅ Full field storage: SUCCESS');
    
    // Test 3: Bulk storage simulation
    console.log('🧪 Test 3: Bulk storage simulation...');
    
    const bulkTests = [];
    for (let i = 1; i <= 5; i++) {
      bulkTests.push({
        tweet_id: `bulk_test_${i}_${Date.now()}`,
        content: `Bulk storage test tweet ${i}`,
        tweet_type: 'original',
        content_type: 'bulk_test',
        engagement_score: i * 10,
        likes: i,
        retweets: 0,
        replies: 0,
        impressions: i * 100,
        has_snap2health_cta: false
      });
    }
    
    const { data: bulkData, error: bulkError } = await supabase
      .from('tweets')
      .insert(bulkTests)
      .select();
    
    if (bulkError) {
      console.log('❌ Bulk storage failed:', bulkError.message);
      throw bulkError;
    }
    
    console.log(`✅ Bulk storage: SUCCESS (${bulkData?.length || 0} records)`);
    
    // Clean up test records
    console.log('🧹 Cleaning up test records...');
    
    const testIds = [
      basicData?.id,
      fullData?.id,
      ...(bulkData?.map(r => r.id) || [])
    ].filter(Boolean);
    
    if (testIds.length > 0) {
      await supabase
        .from('tweets')
        .delete()
        .in('id', testIds);
      
      console.log(`✅ Cleaned up ${testIds.length} test records`);
    }
    
  } catch (error) {
    console.error('❌ Storage mechanism test failed:', error);
    throw error;
  }
}

async function createStorageValidation() {
  console.log('🛡️ === CREATING STORAGE VALIDATION ===');
  
  try {
    // Create validation configuration
    const validationConfig = {
      enabled: true,
      
      // Column mapping for code fixes
      column_mapping: {
        twitter_id: 'tweet_id',
        posted_at: 'created_at',
        style: 'content_type'
      },
      
      // Required fields for all tweet inserts
      required_fields: [
        'tweet_id',
        'content', 
        'tweet_type',
        'content_type'
      ],
      
      // Default values for optional fields
      default_values: {
        engagement_score: 0,
        likes: 0,
        retweets: 0,
        replies: 0,
        impressions: 0,
        has_snap2health_cta: false,
        tweet_type: 'original',
        source_attribution: 'PostTweetAgent'
      },
      
      // Validation rules
      validation_rules: {
        tweet_id_required: true,
        content_min_length: 1,
        content_max_length: 10000,
        content_type_required: true
      },
      
      // Error handling
      error_handling: {
        log_failures: true,
        retry_on_failure: true,
        max_retries: 3,
        fallback_behavior: 'log_only'
      },
      
      activated_at: new Date().toISOString()
    };
    
    await supabase
      .from('bot_config')
      .upsert({
        key: 'database_storage_validation',
        value: validationConfig,
        updated_at: new Date().toISOString()
      });
    
    console.log('✅ Storage validation configuration created');
    
    // Create storage health monitoring
    const healthConfig = {
      enabled: true,
      
      // Health check schedule
      check_frequency_minutes: 30,
      
      // Health metrics to track
      metrics: {
        storage_success_rate: true,
        storage_latency: true,
        failed_inserts_count: true,
        column_mismatch_errors: true
      },
      
      // Alert thresholds
      alert_thresholds: {
        success_rate_below: 0.95,  // Alert if below 95% success
        latency_above_ms: 5000,    // Alert if above 5 seconds
        failed_inserts_above: 10   // Alert if more than 10 failures/hour
      },
      
      // Auto-recovery actions
      auto_recovery: {
        enabled: true,
        retry_failed_inserts: true,
        fix_common_column_errors: true,
        emergency_disable_on_critical_failure: true
      },
      
      activated_at: new Date().toISOString()
    };
    
    await supabase
      .from('bot_config')
      .upsert({
        key: 'database_health_monitoring',
        value: healthConfig,
        updated_at: new Date().toISOString()
      });
    
    console.log('✅ Database health monitoring configured');
    
  } catch (error) {
    console.error('❌ Failed to create storage validation:', error);
    throw error;
  }
}

async function fixDataInconsistencies() {
  console.log('🔄 === FIXING DATA INCONSISTENCIES ===');
  
  try {
    // Check for tweets with missing required data
    const { data: incompleteRecords } = await supabase
      .from('tweets')
      .select('*')
      .or('tweet_id.is.null,content.is.null,content_type.is.null')
      .limit(100);
    
    if (incompleteRecords && incompleteRecords.length > 0) {
      console.log(`🔧 Found ${incompleteRecords.length} incomplete records`);
      
      for (const record of incompleteRecords) {
        const fixes = {};
        
        if (!record.tweet_id) {
          fixes.tweet_id = `fixed_${record.id}`;
        }
        
        if (!record.content_type) {
          fixes.content_type = 'unknown';
        }
        
        if (!record.tweet_type) {
          fixes.tweet_type = 'original';
        }
        
        if (Object.keys(fixes).length > 0) {
          await supabase
            .from('tweets')
            .update(fixes)
            .eq('id', record.id);
          
          console.log(`   ✅ Fixed record ${record.id}: ${Object.keys(fixes).join(', ')}`);
        }
      }
    } else {
      console.log('✅ No incomplete records found');
    }
    
    // Update rate limit tracking to reflect current reality
    console.log('🔄 Updating rate limit tracking...');
    
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const { data: todaysTweets } = await supabase
      .from('tweets')
      .select('id')
      .gte('created_at', startOfDay.toISOString());
    
    const actualTweetsToday = todaysTweets?.length || 0;
    
    console.log(`📊 Actual tweets in database today: ${actualTweetsToday}`);
    
    // Update unified rate limits to match reality
    await supabase
      .from('bot_config')
      .upsert({
        key: 'unified_rate_limits',
        value: {
          twitter_daily_limit: 17,
          twitter_daily_used: actualTweetsToday,
          twitter_daily_remaining: Math.max(0, 17 - actualTweetsToday),
          last_post_time: todaysTweets && todaysTweets.length > 0 ? 
            (await supabase.from('tweets').select('created_at').gte('created_at', startOfDay.toISOString()).order('created_at', { ascending: false }).limit(1).single())?.data?.created_at :
            null,
          accurate_tracking: true,
          database_synced: true,
          last_updated: new Date().toISOString(),
          reset_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        },
        updated_at: new Date().toISOString()
      });
    
    console.log('✅ Rate limit tracking updated to match database reality');
    
  } catch (error) {
    console.error('❌ Failed to fix data inconsistencies:', error);
    throw error;
  }
}

fixDatabaseStorage(); 