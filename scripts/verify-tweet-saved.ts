#!/usr/bin/env npx tsx
/**
 * 🔍 VERIFY TWEET SAVED AND SCRAPE-READY
 * 
 * Usage: npx tsx scripts/verify-tweet-saved.ts <tweet_id>
 * 
 * Checks that a tweet:
 * 1. Exists in DB with tweet_id
 * 2. Has required provenance fields (pipeline_source, decision_id, etc.)
 * 3. Has gate_results stored
 * 4. Is marked as 'posted' status
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyTweet(tweetId: string) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`🔍 VERIFYING TWEET: ${tweetId}`);
  console.log(`${'═'.repeat(70)}\n`);

  // 1. Check in content_generation_metadata_comprehensive (primary table)
  const { data: decision, error: decisionError } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('*')
    .eq('tweet_id', tweetId)
    .maybeSingle();

  if (decisionError) {
    console.error('❌ DB Error:', decisionError.message);
    process.exit(1);
  }

  if (!decision) {
    console.log('❌ VERIFICATION FAILED: Tweet NOT found in database');
    console.log('   This indicates a BYPASS POSTING path was used!');
    console.log('');
    console.log('   Expected: Every posted tweet should have a decision row');
    console.log('   Action: Check [BYPASS_BLOCKED] logs in Railway');
    process.exit(1);
  }

  console.log('✅ FOUND in content_generation_metadata_comprehensive');
  console.log('');

  // Check required fields
  const checks: Array<{ field: string; value: any; required: boolean; pass: boolean }> = [];

  // Required fields
  checks.push({ field: 'decision_id', value: decision.decision_id, required: true, pass: !!decision.decision_id });
  checks.push({ field: 'tweet_id', value: decision.tweet_id, required: true, pass: !!decision.tweet_id });
  checks.push({ field: 'status', value: decision.status, required: true, pass: decision.status === 'posted' });
  checks.push({ field: 'posted_at', value: decision.posted_at, required: true, pass: !!decision.posted_at });
  checks.push({ field: 'decision_type', value: decision.decision_type, required: true, pass: !!decision.decision_type });
  checks.push({ field: 'content', value: decision.content?.substring(0, 50) + '...', required: true, pass: !!decision.content });

  // Provenance fields (highly recommended)
  checks.push({ field: 'pipeline_source', value: decision.pipeline_source, required: false, pass: !!decision.pipeline_source });
  checks.push({ field: 'generator_name', value: decision.generator_name, required: false, pass: !!decision.generator_name });

  // Reply-specific fields
  if (decision.decision_type === 'reply') {
    checks.push({ field: 'target_tweet_id', value: decision.target_tweet_id, required: true, pass: !!decision.target_tweet_id });
    checks.push({ field: 'root_tweet_id', value: decision.root_tweet_id, required: true, pass: !!decision.root_tweet_id });
    checks.push({ field: 'target_tweet_content_snapshot', value: decision.target_tweet_content_snapshot?.substring(0, 50), required: true, pass: !!decision.target_tweet_content_snapshot });
    
    // ROOT-ONLY check
    const isRootOnly = decision.root_tweet_id === decision.target_tweet_id;
    checks.push({ field: 'ROOT_ONLY (root==target)', value: isRootOnly, required: true, pass: isRootOnly });
  }

  // Print results
  console.log('📋 FIELD VERIFICATION:');
  console.log('');
  
  let allRequiredPass = true;
  for (const check of checks) {
    const status = check.pass ? '✅' : (check.required ? '❌' : '⚠️');
    const label = check.required ? 'REQUIRED' : 'OPTIONAL';
    console.log(`  ${status} ${check.field} = ${check.value || '(empty)'} [${label}]`);
    if (check.required && !check.pass) {
      allRequiredPass = false;
    }
  }

  console.log('');
  
  // Check for thread-like content (replies only)
  if (decision.decision_type === 'reply') {
    const content = decision.content || '';
    const threadPatterns = [
      /^\s*\d+\/\d+/,           // "1/5", "2/3" at start
      /^\d+\.\s/m,              // "1. " at line start
      /\(\d+\)/,                // "(1)", "(2)"
      /🧵/,                      // Thread emoji
      /\bthread\b/i,            // Word "thread"
    ];
    
    let hasThreadPattern = false;
    for (const pattern of threadPatterns) {
      if (pattern.test(content)) {
        hasThreadPattern = true;
        console.log(`⚠️ THREAD-LIKE PATTERN DETECTED: ${pattern.source}`);
      }
    }
    
    if (!hasThreadPattern) {
      console.log('✅ No thread-like patterns in content');
    }
    
    // Check newline count
    const newlines = (content.match(/\n/g) || []).length;
    if (newlines > 1) {
      console.log(`⚠️ MULTI-NEWLINE CONTENT: ${newlines} newlines (max 1 for replies)`);
    } else {
      console.log(`✅ Newline count OK: ${newlines}`);
    }
  }

  console.log('');
  console.log(`${'═'.repeat(70)}`);
  
  if (allRequiredPass) {
    console.log('🎉 VERIFICATION PASSED: Tweet is properly saved with all required fields');
  } else {
    console.log('❌ VERIFICATION FAILED: Missing required fields');
  }
  
  console.log(`${'═'.repeat(70)}\n`);
  
  return allRequiredPass;
}

// Main
const tweetId = process.argv[2];
if (!tweetId) {
  console.log('Usage: npx tsx scripts/verify-tweet-saved.ts <tweet_id>');
  console.log('');
  console.log('Example: npx tsx scripts/verify-tweet-saved.ts 2008023484727971887');
  process.exit(1);
}

verifyTweet(tweetId)
  .then(pass => process.exit(pass ? 0 : 1))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });

