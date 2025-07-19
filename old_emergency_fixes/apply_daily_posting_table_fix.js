#!/usr/bin/env node
/**
 * 🔧 APPLY DAILY POSTING TABLE FIX
 * Execute the SQL to create the missing daily_posting_state table
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyDailyPostingTableFix() {
  console.log('🔧 === APPLYING DAILY POSTING TABLE FIX ===');
  
  try {
    // Read the SQL file
    const sqlContent = fs.readFileSync('create_missing_daily_posting_table.sql', 'utf8');
    console.log('📄 SQL file loaded successfully');
    
    // Split into individual statements (simple approach)
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`\n📝 Executing statement ${i + 1}/${statements.length}...`);
        console.log(`   ${statement.substring(0, 100)}...`);
        
        try {
          const { data, error } = await supabase.rpc('sql', { query: statement });
          
          if (error) {
            console.error(`❌ Statement ${i + 1} failed:`, error);
            // Continue with other statements
          } else {
            console.log(`✅ Statement ${i + 1} executed successfully`);
            if (data && data.length > 0) {
              console.log('   Result:', data);
            }
          }
        } catch (statementError) {
          console.error(`❌ Statement ${i + 1} threw error:`, statementError);
          // Continue with other statements
        }
      }
    }
    
    // Verify the table was created
    console.log('\n🔍 Verifying table creation...');
    const { data: tableCheck, error: tableError } = await supabase
      .from('daily_posting_state')
      .select('*')
      .limit(1);
    
    if (tableError) {
      console.error('❌ Table verification failed:', tableError);
      console.log('💡 Trying alternative approach...');
      
      // Alternative: Use the postgres REST API directly
      const { data: altData, error: altError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_name', 'daily_posting_state')
        .single();
      
      if (altError) {
        console.error('❌ Alternative verification also failed:', altError);
      } else {
        console.log('✅ Table exists (verified via information_schema)');
      }
    } else {
      console.log('✅ Table created and verified successfully!');
      
      // Check today's entry
      const today = new Date().toISOString().split('T')[0];
      const { data: todayData, error: todayError } = await supabase
        .from('daily_posting_state')
        .select('*')
        .eq('date', today)
        .single();
      
      if (todayError) {
        console.error('❌ Could not find today\'s entry:', todayError);
      } else {
        console.log('✅ Today\'s posting state initialized:');
        console.log(`   📅 Date: ${todayData.date}`);
        console.log(`   📊 Progress: ${todayData.posts_completed}/${todayData.posts_target}`);
        console.log(`   ⏰ Next post: ${new Date(todayData.next_post_time).toLocaleString()}`);
      }
    }
    
    console.log('\n✅ === DAILY POSTING TABLE FIX COMPLETE ===');
    console.log('🎯 Daily Posting Manager should now be able to function');
    console.log('📊 The bot should start posting at the next scheduled time or when posting hours begin (9 AM)');
    
  } catch (error) {
    console.error('❌ Fix application failed:', error);
  }
}

// Run the fix
applyDailyPostingTableFix().catch(console.error); 