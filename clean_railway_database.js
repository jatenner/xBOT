#!/usr/bin/env node
/**
 * 🧹 CLEAN RAILWAY DATABASE
 * Uses Railway environment variables to clean production DB
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function cleanRailwayDB() {
  console.log('🧹 === CLEANING RAILWAY PRODUCTION DATABASE ===');
  console.log('🎯 This will delete ALL wrong tweet IDs from production');
  console.log('⏰ Time:', new Date().toLocaleString());
  console.log('');

  // Use Railway production environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log(`📍 Connecting to: ${supabaseUrl}`);
  console.log('');

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Count existing records
    console.log('📊 STEP 1: COUNT EXISTING RECORDS');
    console.log('='.repeat(50));
    
    const tables = ['tweets', 'real_tweet_metrics', 'content_decisions'];
    const counts = {};
    
    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        counts[table] = count || 0;
        console.log(`   ${table}: ${count || 0} records`);
      } else {
        console.log(`   ${table}: ${error.message}`);
        counts[table] = 'error';
      }
    }
    
    const totalRecords = Object.values(counts).filter(c => typeof c === 'number').reduce((a, b) => a + b, 0);
    
    if (totalRecords === 0) {
      console.log('');
      console.log('✅ Database is already clean! No records to delete.');
      return;
    }
    
    console.log('');
    console.log('🗑️ STEP 2: DELETE ALL RECORDS');
    console.log('='.repeat(50));
    
    let totalDeleted = 0;
    
    // 2. Delete from each table
    for (const table of tables) {
      if (counts[table] === 0 || counts[table] === 'error') {
        console.log(`⏭️  Skipping ${table}`);
        continue;
      }
      
      console.log(`🗑️  Deleting from ${table}...`);
      
      const { error } = await supabase
        .from(table)
        .delete()
        .neq('id', 0); // Delete all
      
      if (error) {
        console.log(`   ❌ Error: ${error.message}`);
      } else {
        console.log(`   ✅ Deleted ${counts[table]} records`);
        totalDeleted += counts[table];
      }
    }
    
    console.log('');
    console.log('✅ STEP 3: VERIFY');
    console.log('='.repeat(50));
    
    // 3. Verify
    for (const table of tables) {
      const { count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      console.log(`   ${table}: ${count || 0} remaining`);
    }
    
    console.log('');
    console.log('🎉 RAILWAY DATABASE CLEANED!');
    console.log(`   Total deleted: ${totalDeleted} records`);
    console.log(`   Ready for fresh, correct data ✅`);
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    process.exit(1);
  }
}

cleanRailwayDB();

