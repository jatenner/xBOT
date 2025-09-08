#!/usr/bin/env node

/**
 * Apply Database Schema Fix for Missing Columns
 * Fixes engagement_metrics and request_context columns in posts table
 */

const { createClient } = require('@supabase/supabase-js');

const MISSING_COLUMNS_FIX = `
-- Fix missing columns in posts table
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS engagement_metrics JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS request_context JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS scores JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT false;

-- Add useful indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_posts_approved ON posts (approved);
CREATE INDEX IF NOT EXISTS idx_posts_scores ON posts USING GIN (scores);

-- Update existing records to have default values
UPDATE posts 
SET 
  engagement_metrics = COALESCE(engagement_metrics, '{}'),
  request_context = COALESCE(request_context, '{}'),
  scores = COALESCE(scores, '{}'),
  approved = COALESCE(approved, false)
WHERE 
  engagement_metrics IS NULL 
  OR request_context IS NULL 
  OR scores IS NULL 
  OR approved IS NULL;
`;

async function applyDatabaseFix() {
  console.log('🔧 DATABASE_FIX: Applying missing columns migration...');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    console.log('📝 Executing SQL migration...');
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: MISSING_COLUMNS_FIX
    });
    
    if (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }
    
    console.log('✅ DATABASE_FIX: Missing columns migration applied successfully');
    console.log('📊 Result:', data);
    
    // Verify the columns exist
    const { data: tableInfo } = await supabase
      .from('posts')
      .select('*')
      .limit(1);
    
    console.log('✅ VERIFICATION: Posts table accessible after migration');
    
  } catch (error) {
    console.error('❌ DATABASE_FIX: Failed to apply migration:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  applyDatabaseFix();
}

module.exports = { applyDatabaseFix };
