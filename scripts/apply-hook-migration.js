#!/usr/bin/env node

/**
 * Apply Hook DNA Migration to Railway Database
 * This ensures the hook_dna table exists for the Hook Evolution Engine
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  try {
    console.log('🔧 Applying Hook DNA migration...');
    
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20251012_enhanced_learning_schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }
    
    console.log('✅ Hook DNA migration applied successfully!');
    
    // Test that the table exists
    const { data, error: testError } = await supabase
      .from('hook_dna')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.warn('⚠️ Table verification failed:', testError.message);
    } else {
      console.log('✅ hook_dna table verified and ready');
    }
    
  } catch (error) {
    console.error('❌ Script error:', error.message);
    process.exit(1);
  }
}

applyMigration();
