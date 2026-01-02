#!/usr/bin/env tsx
/**
 * Add missing original_candidate_tweet_id column to content_metadata
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function addColumn() {
  console.log('🔧 Adding original_candidate_tweet_id column to content_metadata...');
  
  // We can't use ALTER TABLE via Supabase client directly
  // But we can check if column exists and add data to existing rows
  
  // Try to select the column - if it fails, it doesn't exist
  const { error: checkError } = await supabase
    .from('content_metadata')
    .select('original_candidate_tweet_id')
    .limit(1);
  
  if (checkError && checkError.message.includes('column')) {
    console.log('❌ Column does not exist in schema');
    console.log('');
    console.log('⚠️  MANUAL ACTION REQUIRED:');
    console.log('Run this SQL in Supabase SQL Editor:');
    console.log('');
    console.log('ALTER TABLE content_metadata ADD COLUMN IF NOT EXISTS original_candidate_tweet_id TEXT;');
    console.log('');
    process.exit(1);
  } else {
    console.log('✅ Column already exists');
  }
}

addColumn();

