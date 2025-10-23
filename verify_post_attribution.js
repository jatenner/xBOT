#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

// Use Supabase client directly
const { createClient } = require('@supabase/supabase-js');

async function verifyPostAttribution() {
  console.log('🔍 Verifying post_attribution table...');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Check if table exists by trying to query it
    const { data, error } = await supabase
      .from('post_attribution')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ post_attribution table does not exist or is not accessible:', error.message);
      return;
    }
    
    console.log('✅ post_attribution table exists and is accessible!');
    
    // Get table info
    const { count, error: countError } = await supabase
      .from('post_attribution')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Could not count rows:', countError.message);
    } else {
      console.log(`📊 Total posts in post_attribution: ${count}`);
    }
    
    // Try to get sample data to verify schema
    const { data: sampleData, error: sampleError } = await supabase
      .from('post_attribution')
      .select('*')
      .limit(3);
    
    if (sampleError) {
      console.error('❌ Could not get sample data:', sampleError.message);
    } else {
      console.log('📊 Sample data structure:');
      if (sampleData.length > 0) {
        const firstRow = sampleData[0];
        Object.keys(firstRow).forEach(key => {
          console.log(`  - ${key}: ${typeof firstRow[key]} (${firstRow[key]})`);
        });
      } else {
        console.log('  (No data in table yet)');
      }
    }
    
    console.log('✅ post_attribution table verification completed!');
    console.log('🎉 Your learning loops should now work properly!');
    
  } catch (error) {
    console.error('❌ Verification error:', error.message);
  }
}

verifyPostAttribution().catch(console.error);
