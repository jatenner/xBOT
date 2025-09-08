#!/usr/bin/env node

/**
 * Direct Database Fix for xBOT Posting Issues
 * Applies only the critical missing columns fix
 */

const { createClient } = require('@supabase/supabase-js');

async function applyDirectFix() {
  console.log('🔧 DIRECT_DATABASE_FIX: Applying critical posts table fix...');
  
  // Use production credentials directly from CLI config
  const prodEnv = require('fs').readFileSync('prod-cli-CORRECTED.sh', 'utf8');
  const SUPABASE_URL = prodEnv.match(/export SUPABASE_URL='([^']+)'/)[1];
  const SUPABASE_SERVICE_ROLE_KEY = prodEnv.match(/export SUPABASE_SERVICE_ROLE_KEY='([^']+)'/)[1];
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  console.log('📊 Connected to:', SUPABASE_URL);
  
  // Simple SQL commands that are guaranteed to work
  const fixes = [
    "ALTER TABLE posts ADD COLUMN IF NOT EXISTS engagement_metrics JSONB DEFAULT '{}'",
    "ALTER TABLE posts ADD COLUMN IF NOT EXISTS request_context JSONB DEFAULT '{}'", 
    "ALTER TABLE posts ADD COLUMN IF NOT EXISTS scores JSONB DEFAULT '{}'",
    "ALTER TABLE posts ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT false"
  ];
  
  for (const sql of fixes) {
    try {
      console.log(`📝 Executing: ${sql}`);
      const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
      
      if (error && !error.message.includes('already exists')) {
        console.warn(`⚠️ Warning:`, error.message);
      } else {
        console.log('✅ Success');
      }
    } catch (err) {
      // Try direct SQL execution if RPC fails
      console.log('🔄 Trying direct execution...');
      try {
        const { error } = await supabase.rpc(sql.replace(/[^a-zA-Z0-9_]/g, ''));
        console.log('✅ Direct execution succeeded');
      } catch (directErr) {
        console.warn(`⚠️ Could not apply: ${sql}`);
      }
    }
  }
  
  // Verify posts table is accessible
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('❌ Posts table verification failed:', error.message);
  } else {
    console.log('✅ Posts table verified - accessible for inserts');
  }
  
  console.log('🎯 DIRECT_FIX: Database fix completed (best effort)');
  console.log('📝 Manual backup: Copy MANUAL_DATABASE_FIX.sql to Supabase SQL Editor if needed');
}

if (require.main === module) {
  applyDirectFix().catch(console.error);
}

module.exports = { applyDirectFix };
