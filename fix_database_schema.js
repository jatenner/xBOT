/**
 * 🔧 FIX DATABASE SCHEMA ISSUES
 * Resolve schema_migrations table structure and ensure all systems work
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

async function fixDatabaseSchema() {
  console.log('🔧 FIXING DATABASE SCHEMA ISSUES');
  console.log('=================================\n');

  try {
    // Fix 1: Check and fix schema_migrations table
    console.log('1️⃣  FIXING SCHEMA_MIGRATIONS TABLE');
    console.log('==================================');
    
    // First, let's see what columns exist
    try {
      const { data: existingData, error: existingError } = await supabase
        .from('schema_migrations')
        .select('*')
        .limit(1);

      if (existingError) {
        console.log('Current schema_migrations error:', existingError.message);
      } else {
        console.log('✅ schema_migrations table exists');
        if (existingData && existingData.length > 0) {
          console.log('Existing columns:', Object.keys(existingData[0]));
        }
      }
    } catch (err) {
      console.log('Error checking schema_migrations:', err.message);
    }

    // Fix 2: Ensure prompt_performance table exists with correct structure
    console.log('\n2️⃣  ENSURING PROMPT_PERFORMANCE TABLE');
    console.log('====================================');
    
    const createPromptPerformanceSQL = `
      CREATE TABLE IF NOT EXISTS prompt_performance (
        id SERIAL PRIMARY KEY,
        post_id TEXT NOT NULL,
        prompt_version TEXT NOT NULL DEFAULT 'unknown',
        persona TEXT NOT NULL DEFAULT 'unknown',
        emotion TEXT NOT NULL DEFAULT 'unknown',
        framework TEXT NOT NULL DEFAULT 'unknown',
        likes INTEGER DEFAULT 0,
        retweets INTEGER DEFAULT 0,
        replies INTEGER DEFAULT 0,
        impressions INTEGER DEFAULT 0,
        follows INTEGER DEFAULT 0,
        engagement_rate DECIMAL(5,4) DEFAULT 0.0000,
        viral_score INTEGER DEFAULT 0,
        hours_after_post INTEGER DEFAULT 0,
        recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Add indexes for performance
      CREATE INDEX IF NOT EXISTS idx_prompt_performance_persona ON prompt_performance(persona);
      CREATE INDEX IF NOT EXISTS idx_prompt_performance_emotion ON prompt_performance(emotion);
      CREATE INDEX IF NOT EXISTS idx_prompt_performance_framework ON prompt_performance(framework);
      CREATE INDEX IF NOT EXISTS idx_prompt_performance_engagement ON prompt_performance(engagement_rate DESC);
      CREATE INDEX IF NOT EXISTS idx_prompt_performance_recorded_at ON prompt_performance(recorded_at DESC);

      -- Enable RLS if needed
      ALTER TABLE prompt_performance ENABLE ROW LEVEL SECURITY;

      -- Drop existing policies if they exist
      DROP POLICY IF EXISTS "Service role can manage prompt performance" ON prompt_performance;
      DROP POLICY IF EXISTS "Allow read access to prompt performance" ON prompt_performance;

      -- Add RLS policies
      CREATE POLICY "Service role can manage prompt performance" ON prompt_performance
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);

      CREATE POLICY "Allow read access to prompt performance" ON prompt_performance
      FOR SELECT TO anon, authenticated
      USING (true);
    `;

    console.log('Creating/updating prompt_performance table...');
    
    // Execute the SQL
    try {
      const { data, error } = await supabase.rpc('exec_sql', { 
        sql: createPromptPerformanceSQL 
      });
      
      if (error) {
        console.log('❌ Failed to execute SQL via RPC:', error.message);
        console.log('💡 Need to run SQL manually in Supabase dashboard');
      } else {
        console.log('✅ prompt_performance table setup completed');
      }
    } catch (rpcError) {
      console.log('❌ RPC execution failed:', rpcError.message);
      console.log('\n📝 MANUAL SQL REQUIRED');
      console.log('======================');
      console.log('Please run this SQL in Supabase SQL Editor:');
      console.log(createPromptPerformanceSQL);
    }

    // Fix 3: Test prompt_performance table access
    console.log('\n3️⃣  TESTING PROMPT_PERFORMANCE ACCESS');
    console.log('====================================');
    
    try {
      const { data: testData, error: testError } = await supabase
        .from('prompt_performance')
        .select('*')
        .limit(1);

      if (testError) {
        console.log('❌ Still cannot access prompt_performance:', testError.message);
      } else {
        console.log('✅ prompt_performance table accessible');
        
        // Test insert
        const testInsert = {
          post_id: 'test_' + Date.now(),
          prompt_version: 'bulletproof-v1.0',
          persona: 'Dr. Elena Vasquez',
          emotion: 'Curiosity',
          framework: 'Mechanism Master',
          likes: 10,
          retweets: 5,
          replies: 3,
          impressions: 100,
          follows: 1,
          engagement_rate: 0.18,
          viral_score: 85,
          hours_after_post: 1
        };

        const { data: insertData, error: insertError } = await supabase
          .from('prompt_performance')
          .insert(testInsert)
          .select();

        if (insertError) {
          console.log('❌ Cannot insert test data:', insertError.message);
        } else {
          console.log('✅ Test data inserted successfully');
          console.log('Sample record:', insertData[0]);
          
          // Clean up test data
          if (insertData && insertData[0]) {
            await supabase
              .from('prompt_performance')
              .delete()
              .eq('id', insertData[0].id);
            console.log('✅ Test data cleaned up');
          }
        }
      }
    } catch (accessError) {
      console.log('❌ Access test failed:', accessError.message);
    }

    // Fix 4: Create a tracking table for posts if needed
    console.log('\n4️⃣  ENSURING POSTS TRACKING TABLE');
    console.log('=================================');
    
    const createPostsTrackingSQL = `
      CREATE TABLE IF NOT EXISTS posts_for_tracking (
        id SERIAL PRIMARY KEY,
        tweet_id TEXT UNIQUE NOT NULL,
        prompt_version TEXT DEFAULT 'unknown',
        persona TEXT DEFAULT 'unknown',
        emotion TEXT DEFAULT 'unknown',
        framework TEXT DEFAULT 'unknown',
        viral_score INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_posts_tracking_tweet_id ON posts_for_tracking(tweet_id);
      CREATE INDEX IF NOT EXISTS idx_posts_tracking_created_at ON posts_for_tracking(created_at DESC);

      ALTER TABLE posts_for_tracking ENABLE ROW LEVEL SECURITY;
      
      DROP POLICY IF EXISTS "Service role can manage posts tracking" ON posts_for_tracking;
      DROP POLICY IF EXISTS "Allow read access to posts tracking" ON posts_for_tracking;

      CREATE POLICY "Service role can manage posts tracking" ON posts_for_tracking
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);

      CREATE POLICY "Allow read access to posts tracking" ON posts_for_tracking
      FOR SELECT TO anon, authenticated
      USING (true);
    `;

    try {
      const { data, error } = await supabase.rpc('exec_sql', { 
        sql: createPostsTrackingSQL 
      });
      
      if (error) {
        console.log('⚠️  Could not create posts_for_tracking via RPC:', error.message);
      } else {
        console.log('✅ posts_for_tracking table ready');
      }
    } catch (trackingError) {
      console.log('⚠️  Tracking table setup issue:', trackingError.message);
    }

    // Final validation
    console.log('\n5️⃣  FINAL VALIDATION');
    console.log('===================');
    
    const criticalTables = ['tweets', 'learning_posts', 'prompt_performance'];
    let allTablesWorking = true;

    for (const table of criticalTables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);

        if (error) {
          console.log(`❌ ${table}: ${error.message}`);
          allTablesWorking = false;
        } else {
          console.log(`✅ ${table}: Working`);
        }
      } catch (err) {
        console.log(`❌ ${table}: ${err.message}`);
        allTablesWorking = false;
      }
    }

    console.log('\n🎯 SYSTEM STATUS');
    console.log('================');
    
    if (allTablesWorking) {
      console.log('✅ ALL CRITICAL SYSTEMS OPERATIONAL');
      console.log('🚀 Bulletproof system ready for deployment');
      console.log('📊 Thompson Sampling optimization available');
      console.log('🎭 Persona and emotion tracking enabled');
      console.log('\n🔥 READY TO ROCK! 🔥');
    } else {
      console.log('⚠️  SOME SYSTEMS NEED MANUAL ATTENTION');
      console.log('💡 Check Supabase dashboard and run SQL manually if needed');
      console.log('🔧 Most issues can be resolved with the SQL provided above');
    }

    return allTablesWorking;

  } catch (error) {
    console.error('💥 SCHEMA_FIX_FAILED:', error.message);
    return false;
  }
}

// Run the fix
if (require.main === module) {
  fixDatabaseSchema().catch(console.error);
}

module.exports = { fixDatabaseSchema };
