#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

// Use Supabase client directly
const { createClient } = require('@supabase/supabase-js');

async function fixDatabaseSchema() {
  console.log('🔧 Fixing post_attribution table schema using Supabase...');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Check current schema
    console.log('📊 Checking current schema...');
    const { data: schemaData, error: schemaError } = await supabase.rpc('get_table_columns', {
      table_name: 'post_attribution'
    });
    
    if (schemaError) {
      console.log('⚠️  Could not get schema via RPC, trying direct query...');
      
      // Try direct SQL query
      const { data: directSchema, error: directError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type')
        .eq('table_name', 'post_attribution')
        .order('ordinal_position');
      
      if (directError) {
        console.error('❌ Could not access schema information:', directError.message);
        return;
      }
      
      console.log(`Found ${directSchema.length} columns:`);
      directSchema.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type}`);
      });
      
      // Check for essential columns
      const essential = ['engagement_rate', 'impressions', 'followers_gained', 'hook_pattern', 'topic'];
      const existing = directSchema.map(r => r.column_name);
      const missing = essential.filter(col => !existing.includes(col));
      
      if (missing.length > 0) {
        console.log(`❌ MISSING ESSENTIAL COLUMNS: ${missing.join(', ')}`);
        console.log('🔧 Adding missing columns...');
        
        for (const col of missing) {
          let alterSQL = '';
          if (col === 'engagement_rate') {
            alterSQL = 'ALTER TABLE post_attribution ADD COLUMN engagement_rate NUMERIC(5,4) DEFAULT 0;';
          } else if (col === 'impressions') {
            alterSQL = 'ALTER TABLE post_attribution ADD COLUMN impressions INTEGER DEFAULT 0;';
          } else if (col === 'followers_gained') {
            alterSQL = 'ALTER TABLE post_attribution ADD COLUMN followers_gained INTEGER DEFAULT 0;';
          } else if (col === 'hook_pattern') {
            alterSQL = 'ALTER TABLE post_attribution ADD COLUMN hook_pattern TEXT;';
          } else if (col === 'topic') {
            alterSQL = 'ALTER TABLE post_attribution ADD COLUMN topic TEXT;';
          }
          
          if (alterSQL) {
            try {
              const { error: alterError } = await supabase.rpc('exec_sql', { sql: alterSQL });
              if (alterError) {
                console.log(`⚠️  Column ${col} might already exist: ${alterError.message}`);
              } else {
                console.log(`✅ Added column: ${col}`);
              }
            } catch (error) {
              console.log(`⚠️  Column ${col} might already exist: ${error.message}`);
            }
          }
        }
        
        console.log('🎉 Schema fix completed!');
      } else {
        console.log('✅ All essential columns already exist');
      }
      
      // Check data count
      const { count, error: countError } = await supabase
        .from('post_attribution')
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        console.error('❌ Could not count posts:', countError.message);
      } else {
        console.log(`📈 Total posts in post_attribution: ${count}`);
        
        if (count > 0) {
          // Get sample data
          const { data: sampleData, error: sampleError } = await supabase
            .from('post_attribution')
            .select('posted_at, engagement_rate, impressions, followers_gained, topic, hook_pattern')
            .order('posted_at', { ascending: false })
            .limit(3);
          
          if (sampleError) {
            console.error('❌ Could not get sample data:', sampleError.message);
          } else {
            console.log('📊 Recent posts sample:');
            sampleData.forEach((post, i) => {
              console.log(`  Post ${i + 1}:`);
              console.log(`    - posted_at: ${post.posted_at}`);
              console.log(`    - engagement_rate: ${post.engagement_rate || 'NULL'}`);
              console.log(`    - impressions: ${post.impressions || 'NULL'}`);
              console.log(`    - followers_gained: ${post.followers_gained || 'NULL'}`);
              console.log(`    - topic: ${post.topic || 'NULL'}`);
              console.log(`    - hook_pattern: ${post.hook_pattern || 'NULL'}`);
            });
          }
        }
      }
      
    } else {
      console.log('Schema data:', schemaData);
    }
    
    console.log('✅ Database schema check completed!');
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
    throw error;
  }
}

fixDatabaseSchema().catch(console.error);
