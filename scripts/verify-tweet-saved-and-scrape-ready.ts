#!/usr/bin/env tsx
/**
 * 🔍 VERIFY TWEET SAVED AND SCRAPE-READY
 * 
 * Checks if a tweet ID exists in the database with all required fields
 * for provenance tracking and outcome collection.
 * 
 * Usage: npx tsx scripts/verify-tweet-saved-and-scrape-ready.ts <tweet_id>
 * 
 * Exit codes:
 *   0 = All checks passed (tweet is saved and scrape-ready)
 *   1 = Missing or incomplete data
 *   2 = Tweet not found
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const REQUIRED_FIELDS = [
  'decision_id',
  'decision_type', 
  'status',
  'tweet_id',
  'posted_at',
];

const REPLY_FIELDS = [
  'target_tweet_id',
  'root_tweet_id',
  'target_tweet_content_snapshot',
  'target_tweet_content_hash',
  'semantic_similarity',
];

const PROVENANCE_FIELDS = [
  'pipeline_source',
  'build_sha',
];

interface VerificationResult {
  tweet_id: string;
  found: boolean;
  scrape_ready: boolean;
  missing_fields: string[];
  warnings: string[];
  data?: Record<string, any>;
}

async function verifyTweet(tweetId: string): Promise<VerificationResult> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const result: VerificationResult = {
    tweet_id: tweetId,
    found: false,
    scrape_ready: false,
    missing_fields: [],
    warnings: [],
  };

  // Query content_generation_metadata_comprehensive
  const { data, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('*')
    .eq('tweet_id', tweetId)
    .single();

  if (error || !data) {
    console.error(`❌ Tweet ${tweetId} NOT FOUND in content_generation_metadata_comprehensive`);
    result.found = false;
    return result;
  }

  result.found = true;
  result.data = data;

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    const value = data[field];
    if (value === null || value === undefined || value === '') {
      result.missing_fields.push(field);
    }
  }

  // Check reply-specific fields if this is a reply
  if (data.decision_type === 'reply') {
    for (const field of REPLY_FIELDS) {
      const value = data[field];
      if (value === null || value === undefined || value === '') {
        result.missing_fields.push(field);
      }
    }

    // Additional checks for reply quality
    if (data.target_tweet_content_snapshot && data.target_tweet_content_snapshot.length < 20) {
      result.warnings.push(`snapshot_too_short: ${data.target_tweet_content_snapshot.length} chars`);
    }

    if (data.semantic_similarity !== null && data.semantic_similarity < 0.25) {
      result.warnings.push(`low_similarity: ${data.semantic_similarity}`);
    }

    if (data.root_tweet_id !== data.target_tweet_id) {
      result.warnings.push(`root_mismatch: root=${data.root_tweet_id} target=${data.target_tweet_id}`);
    }
  }

  // Check provenance fields (warnings, not critical)
  for (const field of PROVENANCE_FIELDS) {
    const value = data[field];
    if (value === null || value === undefined || value === '') {
      result.warnings.push(`missing_provenance: ${field}`);
    }
  }

  // Check status
  if (data.status !== 'posted') {
    result.warnings.push(`status_not_posted: ${data.status}`);
  }

  // Check if scrape-ready (has outcome row or can be linked)
  const { data: outcomeData } = await supabase
    .from('outcomes')
    .select('id, collected_at')
    .eq('tweet_id', tweetId)
    .single();

  if (outcomeData) {
    console.log(`✅ Outcome collection exists: collected_at=${outcomeData.collected_at}`);
  } else {
    result.warnings.push('no_outcome_row_yet');
  }

  // Determine if scrape-ready
  result.scrape_ready = result.missing_fields.length === 0 && data.status === 'posted';

  return result;
}

async function main() {
  const tweetId = process.argv[2];

  if (!tweetId) {
    console.error('Usage: npx tsx scripts/verify-tweet-saved-and-scrape-ready.ts <tweet_id>');
    process.exit(1);
  }

  console.log(`\n🔍 Verifying tweet ${tweetId}...\n`);

  const result = await verifyTweet(tweetId);

  console.log('─'.repeat(60));

  if (!result.found) {
    console.log(`\n❌ RESULT: Tweet ${tweetId} NOT FOUND`);
    console.log('\n🚨 This tweet was posted via a BYPASS PATH that does not write to DB.');
    console.log('   The bypass path must be identified and blocked.\n');
    process.exit(2);
  }

  console.log(`\n📋 TWEET DATA:`);
  console.log(`   decision_id: ${result.data?.decision_id}`);
  console.log(`   decision_type: ${result.data?.decision_type}`);
  console.log(`   status: ${result.data?.status}`);
  console.log(`   posted_at: ${result.data?.posted_at}`);
  console.log(`   target_tweet_id: ${result.data?.target_tweet_id || 'N/A'}`);
  console.log(`   root_tweet_id: ${result.data?.root_tweet_id || 'N/A'}`);
  console.log(`   snapshot_length: ${result.data?.target_tweet_content_snapshot?.length || 0}`);
  console.log(`   semantic_similarity: ${result.data?.semantic_similarity ?? 'N/A'}`);
  console.log(`   pipeline_source: ${result.data?.pipeline_source || 'N/A'}`);
  console.log(`   build_sha: ${result.data?.build_sha || 'N/A'}`);

  if (result.missing_fields.length > 0) {
    console.log(`\n❌ MISSING FIELDS: ${result.missing_fields.join(', ')}`);
  }

  if (result.warnings.length > 0) {
    console.log(`\n⚠️ WARNINGS:`);
    for (const warning of result.warnings) {
      console.log(`   - ${warning}`);
    }
  }

  console.log('─'.repeat(60));

  if (result.scrape_ready) {
    console.log(`\n✅ RESULT: Tweet ${tweetId} is SAVED and SCRAPE-READY\n`);
    process.exit(0);
  } else {
    console.log(`\n❌ RESULT: Tweet ${tweetId} is NOT scrape-ready\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
