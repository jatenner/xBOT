#!/usr/bin/env node

/**
 * 🔧 DATABASE FIXES APPLIER
 * 
 * Applies the database fixes for missing columns and tweet ID type issues
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

async function applyDatabaseFixes() {
  console.log('🔧 === APPLYING DATABASE FIXES ===');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    console.log('1️⃣ Adding predicted_engagement column to learning_posts...');
    
    // Check if predicted_engagement column exists
    const { data: columns1, error: checkError1 } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'learning_posts' AND column_name = 'predicted_engagement'
      `
    });
    
    if (!columns1 || columns1.length === 0) {
      console.log('   Adding predicted_engagement column...');
      const { error: addColError } = await supabase.rpc('exec_sql', {
        sql: `ALTER TABLE learning_posts ADD COLUMN predicted_engagement DECIMAL(5,4) DEFAULT 0`
      });
      
      if (addColError) {
        console.log('   ❌ Error adding predicted_engagement:', addColError.message);
      } else {
        console.log('   ✅ predicted_engagement column added successfully');
      }
    } else {
      console.log('   ✅ predicted_engagement column already exists');
    }

    console.log('2️⃣ Adding decision_trace column to learning_posts...');
    
    // Check if decision_trace column exists
    const { data: columns2, error: checkError2 } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'learning_posts' AND column_name = 'decision_trace'
      `
    });
    
    if (!columns2 || columns2.length === 0) {
      console.log('   Adding decision_trace column...');
      const { error: addColError2 } = await supabase.rpc('exec_sql', {
        sql: `ALTER TABLE learning_posts ADD COLUMN decision_trace JSONB DEFAULT '{}'`
      });
      
      if (addColError2) {
        console.log('   ❌ Error adding decision_trace:', addColError2.message);
      } else {
        console.log('   ✅ decision_trace column added successfully');
      }
    } else {
      console.log('   ✅ decision_trace column already exists');
    }

    console.log('3️⃣ Fixing tweets table tweet_id column type...');
    
    // Check current tweet_id column type
    const { data: tweetIdType, error: typeError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT data_type FROM information_schema.columns 
        WHERE table_name = 'tweets' AND column_name = 'tweet_id'
      `
    });
    
    if (tweetIdType && tweetIdType.length > 0 && tweetIdType[0].data_type === 'integer') {
      console.log('   Converting tweet_id from integer to varchar...');
      
      // Drop constraint, change type, re-add constraint
      const { error: dropError } = await supabase.rpc('exec_sql', {
        sql: `ALTER TABLE tweets DROP CONSTRAINT IF EXISTS tweets_pkey`
      });
      
      const { error: alterError } = await supabase.rpc('exec_sql', {
        sql: `ALTER TABLE tweets ALTER COLUMN tweet_id TYPE VARCHAR(255)`
      });
      
      const { error: pkError } = await supabase.rpc('exec_sql', {
        sql: `ALTER TABLE tweets ADD PRIMARY KEY (tweet_id)`
      });
      
      if (alterError) {
        console.log('   ❌ Error changing tweet_id type:', alterError.message);
      } else {
        console.log('   ✅ tweet_id column type changed to VARCHAR(255)');
      }
    } else {
      console.log('   ✅ tweet_id column type is already correct');
    }

    console.log('4️⃣ Recording migration in history...');
    const { error: historyError } = await supabase.rpc('exec_sql', {
      sql: `
        INSERT INTO migration_history (filename, applied_at, notes) 
        VALUES (
          '20250201_fix_learning_posts_column.sql',
          NOW(),
          'Added predicted_engagement column and fixed tweet_id type'
        ) ON CONFLICT (filename) DO NOTHING
      `
    });
    
    if (historyError) {
      console.log('   ⚠️ Could not record in migration history:', historyError.message);
    } else {
      console.log('   ✅ Migration recorded in history');
    }

    console.log('🎉 === DATABASE FIXES COMPLETED SUCCESSFULLY ===');

  } catch (error) {
    console.error('❌ Database fixes failed:', error);
  }
}

applyDatabaseFixes();