#!/usr/bin/env node

/**
 * 🔍 SIMPLE DATABASE TEST
 * 
 * Tests database tables directly using raw SQL to bypass schema cache issues
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

console.log('🔍 === SIMPLE DATABASE TEST ===');
console.log('🎯 Testing database tables with direct SQL queries\n');

async function simpleDatabaseTest() {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );
    
    console.log('✅ Connected to database');
    console.log('\n📋 Testing table structure with direct SQL...\n');
    
    // Test 1: Check if tables exist using direct SQL
    const tableTests = [
      'autonomous_decisions',
      'follower_growth_predictions', 
      'follower_tracking',
      'autonomous_growth_strategies'
    ];
    
    for (const tableName of tableTests) {
      console.log(`🔧 Testing table: ${tableName}`);
      
      try {
        // Try a simple SELECT to see if table exists and what columns it has
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${tableName}' ORDER BY ordinal_position;`
        });
        
        if (error) {
          console.log(`  ❌ ${tableName}: ${error.message}`);
        } else if (data && data.length > 0) {
          console.log(`  ✅ ${tableName}: Found ${data.length} columns`);
          data.forEach(col => {
            console.log(`    📝 ${col.column_name} (${col.data_type})`);
          });
        } else {
          console.log(`  ⚠️ ${tableName}: Table exists but no column info returned`);
        }
        
        // Try to insert a test record to verify functionality
        if (tableName === 'autonomous_decisions') {
          const { error: insertError } = await supabase.rpc('exec_sql', {
            sql: `INSERT INTO autonomous_decisions (content, action, confidence) VALUES ('Test content', 'post', 0.85) RETURNING id;`
          });
          
          if (insertError) {
            console.log(`    ❌ Insert test failed: ${insertError.message}`);
          } else {
            console.log(`    ✅ Insert test successful`);
            // Clean up
            await supabase.rpc('exec_sql', {
              sql: `DELETE FROM autonomous_decisions WHERE content = 'Test content';`
            });
          }
        }
        
      } catch (error) {
        console.log(`  ❌ ${tableName}: ${error.message}`);
      }
      
      console.log(''); // Empty line for readability
    }
    
    // Test 2: Try the exact SQL that was failing in your original screenshot
    console.log('🎯 Testing the specific SQL operations that were failing...\n');
    
    const problemQueries = [
      {
        name: 'Update follower_growth_predictions confidence',
        sql: `UPDATE follower_growth_predictions SET confidence = 0.75 WHERE confidence IS NULL;`
      },
      {
        name: 'Update follower_tracking followers_after', 
        sql: `UPDATE follower_tracking SET followers_after = followers_before WHERE followers_after IS NULL;`
      },
      {
        name: 'Update autonomous_growth_strategies is_active',
        sql: `UPDATE autonomous_growth_strategies SET is_active = true WHERE is_active IS NULL;`
      }
    ];
    
    for (const query of problemQueries) {
      console.log(`🔧 Testing: ${query.name}`);
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: query.sql });
        
        if (error) {
          console.log(`  ❌ FAILED: ${error.message}`);
        } else {
          console.log(`  ✅ SUCCESS: Query executed without errors`);
        }
      } catch (error) {
        console.log(`  ❌ ERROR: ${error.message}`);
      }
      
      console.log(''); // Empty line
    }
    
    console.log('📊 === TEST RESULTS SUMMARY ===');
    console.log('💡 If you see column information above, your tables are working!');
    console.log('🚀 If the UPDATE queries succeed, your database is fully functional!');
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
  }
}

simpleDatabaseTest().catch(console.error); 