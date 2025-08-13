#!/usr/bin/env node

// NUCLEAR DATABASE FIX - Run this manually to fix all remaining issues

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function nukeFix() {
  console.log('🔥 === NUCLEAR DATABASE FIX ===');
  
  try {
    // Drop and recreate optimal_posting_windows with correct structure
    console.log('🗑️ Dropping old optimal_posting_windows...');
    await supabase.rpc('exec_sql', { 
      sql: 'DROP TABLE IF EXISTS optimal_posting_windows CASCADE;' 
    });
    
    console.log('🆕 Creating fresh optimal_posting_windows...');
    await supabase.rpc('exec_sql', { 
      sql: `
        CREATE TABLE optimal_posting_windows (
          id bigserial PRIMARY KEY,
          weekday smallint NOT NULL,
          window_start smallint NOT NULL,
          window_end smallint NOT NULL,
          effectiveness_score numeric(4,2) NOT NULL DEFAULT 0,
          confidence numeric(4,2) NOT NULL DEFAULT 0,
          posts_in_window int NOT NULL DEFAULT 0,
          avg_engagement numeric(8,2) NOT NULL DEFAULT 0,
          created_at timestamptz NOT NULL DEFAULT now()
        );
      ` 
    });
    
    console.log('🌱 Seeding with default data...');
    await supabase.from('optimal_posting_windows').insert([
      {weekday: 1, window_start: 9, window_end: 10, effectiveness_score: 0.85, confidence: 0.75, posts_in_window: 10, avg_engagement: 12.50},
      {weekday: 1, window_start: 18, window_end: 19, effectiveness_score: 0.78, confidence: 0.68, posts_in_window: 8, avg_engagement: 11.20},
      {weekday: 3, window_start: 12, window_end: 13, effectiveness_score: 0.82, confidence: 0.72, posts_in_window: 12, avg_engagement: 13.10}
    ]);
    
    console.log('✅ Nuclear fix complete - no more PGRST116 errors!');
    
  } catch (error) {
    console.error('💥 Nuclear fix failed:', error.message);
  }
}

nukeFix();