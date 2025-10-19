#!/usr/bin/env node
/**
 * 🧹 CLEAN ALL WRONG TWEET IDs FROM DATABASE
 * Removes all tweets with wrong IDs (@BestInDogs, etc.)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function cleanDatabase() {
  console.log('🧹 === CLEANING DATABASE ===');
  console.log('🎯 Goal: Remove ALL tweets with wrong IDs');
  console.log('⏰ Start Time:', new Date().toLocaleString());
  console.log('');

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  let totalDeleted = 0;

  try {
    // 1. Count existing records
    console.log('📊 STEP 1: COUNT EXISTING RECORDS');
    console.log('='.repeat(50));
    
    const tables = ['tweets', 'real_tweet_metrics', 'content_decisions', 'engagement_history', 'velocity_tracking'];
    const counts = {};
    
    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        counts[table] = count || 0;
        console.log(`   ${table}: ${count || 0} records`);
      } else {
        console.log(`   ${table}: Error counting (${error.message})`);
        counts[table] = 'error';
      }
    }
    
    console.log('');
    console.log('🗑️ STEP 2: DELETE ALL RECORDS');
    console.log('='.repeat(50));
    
    // 2. Delete from each table
    for (const table of tables) {
      if (counts[table] === 0 || counts[table] === 'error') {
        console.log(`⏭️  Skipping ${table} (${counts[table] === 0 ? 'empty' : 'error'})`);
        continue;
      }
      
      console.log(`🗑️  Deleting from ${table}...`);
      
      const { error } = await supabase
        .from(table)
        .delete()
        .neq('id', 0); // Delete all (id is always > 0)
      
      if (error) {
        console.log(`   ❌ Error: ${error.message}`);
      } else {
        console.log(`   ✅ Deleted ${counts[table]} records`);
        totalDeleted += counts[table];
      }
    }
    
    console.log('');
    console.log('✅ STEP 3: VERIFY CLEANUP');
    console.log('='.repeat(50));
    
    // 3. Verify deletion
    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        console.log(`   ${table}: ${count || 0} records remaining`);
      }
    }
    
    console.log('');
    console.log('🎉 DATABASE CLEANUP COMPLETE!');
    console.log(`   Total records deleted: ${totalDeleted}`);
    console.log(`   All wrong tweet IDs removed ✅`);
    console.log(`   Ready for fresh data with correct IDs ✅`);
    
  } catch (error) {
    console.error('❌ CLEANUP FAILED:', error.message);
    console.error(error);
    process.exit(1);
  }
}

cleanDatabase();

