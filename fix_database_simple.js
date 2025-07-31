#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function fixDatabase() {
  console.log('🔧 === FIXING DATABASE SIMPLE ===');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // 1. Add predicted_engagement column
    console.log('1️⃣ Adding predicted_engagement column...');
    const { error: col1Error } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE learning_posts ADD COLUMN IF NOT EXISTS predicted_engagement DECIMAL(5,4) DEFAULT 0;`
    });
    
    if (col1Error) {
      console.log('   ⚠️ Column might already exist:', col1Error.message);
    } else {
      console.log('   ✅ predicted_engagement column added');
    }

    // 2. Add decision_trace column  
    console.log('2️⃣ Adding decision_trace column...');
    const { error: col2Error } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE learning_posts ADD COLUMN IF NOT EXISTS decision_trace JSONB DEFAULT '{}';`
    });
    
    if (col2Error) {
      console.log('   ⚠️ Column might already exist:', col2Error.message);
    } else {
      console.log('   ✅ decision_trace column added');
    }

    // 3. Test if we can insert into learning_posts
    console.log('3️⃣ Testing learning_posts insert...');
    const { error: testError } = await supabase
      .from('learning_posts')
      .insert({
        content: 'Test tweet',
        tweet_id: 'test_123',
        predicted_engagement: 0.25,
        decision_trace: { test: true },
        posted_at: new Date().toISOString()
      });
    
    if (testError) {
      console.log('   ❌ Insert test failed:', testError.message);
    } else {
      console.log('   ✅ Insert test passed');
      
      // Clean up test record
      await supabase.from('learning_posts').delete().eq('tweet_id', 'test_123');
    }

    console.log('🎉 Database fixes completed!');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixDatabase();