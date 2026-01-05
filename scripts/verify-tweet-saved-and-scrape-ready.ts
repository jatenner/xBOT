#!/usr/bin/env npx tsx
/**
 * 🔍 VERIFY TWEET SAVED AND SCRAPE READY
 * 
 * Usage: npx tsx scripts/verify-tweet-saved-and-scrape-ready.ts <tweet_id>
 * 
 * Checks:
 * 1. Tweet exists in DB with all required fields
 * 2. Provenance is tracked (pipeline_source, build_sha)
 * 3. For replies: target data is complete
 * 4. Outcomes scraping is ready
 */

import 'dotenv/config';

const REQUIRED_FIELDS = [
  'decision_id',
  'decision_type',
  'status',
  'tweet_id',
  'created_at'
];

const REPLY_REQUIRED_FIELDS = [
  ...REQUIRED_FIELDS,
  'target_tweet_id',
  'root_tweet_id',
  'target_tweet_content_snapshot',
  'semantic_similarity'
];

const PROVENANCE_FIELDS = [
  'pipeline_source',
  'generator_name',
  'build_sha'
];

async function main() {
  const tweetId = process.argv[2];
  
  if (!tweetId) {
    console.error('Usage: npx tsx scripts/verify-tweet-saved-and-scrape-ready.ts <tweet_id>');
    process.exit(1);
  }
  
  console.log(`\n🔍 Verifying tweet: ${tweetId}\n`);
  console.log('='.repeat(60));
  
  const { getSupabaseClient } = await import('../src/db/index');
  const supabase = getSupabaseClient();
  
  // Fetch from main table
  const { data: decision, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('*')
    .eq('tweet_id', tweetId)
    .maybeSingle();
  
  if (error) {
    console.error('❌ DB ERROR:', error.message);
    process.exit(1);
  }
  
  if (!decision) {
    console.error('❌ FAIL: Tweet NOT FOUND in database');
    console.error(`   tweet_id: ${tweetId}`);
    console.error('   This is a SEV1: posting succeeded without persistence!');
    console.log('\n💡 Next steps:');
    console.log('   1. Check posting_attempts table for fallback record');
    console.log('   2. Run reconciliation job to backfill');
    console.log('   3. Fix the posting pipeline to ensure DB writes');
    process.exit(1);
  }
  
  console.log('✅ Tweet FOUND in database');
  console.log(`   decision_id: ${decision.decision_id}`);
  console.log(`   decision_type: ${decision.decision_type}`);
  console.log(`   status: ${decision.status}`);
  console.log(`   posted_at: ${decision.posted_at || 'NOT SET'}`);
  console.log('');
  
  // Check required fields
  const isReply = decision.decision_type === 'reply';
  const fieldsToCheck = isReply ? REPLY_REQUIRED_FIELDS : REQUIRED_FIELDS;
  
  console.log('📋 Required Fields Check:');
  const missingFields: string[] = [];
  
  for (const field of fieldsToCheck) {
    const value = decision[field];
    const hasValue = value !== null && value !== undefined && value !== '';
    
    if (hasValue) {
      let displayValue = typeof value === 'string' ? value.substring(0, 50) : value;
      if (typeof displayValue === 'string' && displayValue.length === 50) {
        displayValue += '...';
      }
      console.log(`   ✅ ${field}: ${displayValue}`);
    } else {
      console.log(`   ❌ ${field}: MISSING`);
      missingFields.push(field);
    }
  }
  
  console.log('');
  
  // Check provenance fields
  console.log('🔒 Provenance Tracking:');
  const missingProvenance: string[] = [];
  
  for (const field of PROVENANCE_FIELDS) {
    const value = decision[field];
    const hasValue = value !== null && value !== undefined && value !== '';
    
    if (hasValue) {
      console.log(`   ✅ ${field}: ${value}`);
    } else {
      console.log(`   ⚠️ ${field}: MISSING (optional but recommended)`);
      missingProvenance.push(field);
    }
  }
  
  console.log('');
  
  // Check reply-specific data
  if (isReply) {
    console.log('💬 Reply-Specific Checks:');
    
    const snapshotLen = (decision.target_tweet_content_snapshot || '').length;
    console.log(`   Snapshot length: ${snapshotLen} chars (min 20 required)`);
    if (snapshotLen < 20) {
      console.log(`   ⚠️ Snapshot too short!`);
    } else {
      console.log(`   ✅ Snapshot OK`);
    }
    
    const rootMatch = decision.root_tweet_id === decision.target_tweet_id;
    console.log(`   Root matches target: ${rootMatch ? '✅ YES (is root tweet)' : '❌ NO (is reply-to-reply!)'}`);
    
    const similarity = decision.semantic_similarity || 0;
    console.log(`   Semantic similarity: ${(similarity * 100).toFixed(1)}% (min 25% required)`);
    if (similarity < 0.25) {
      console.log(`   ⚠️ Below threshold!`);
    } else {
      console.log(`   ✅ Similarity OK`);
    }
    
    console.log('');
  }
  
  // Check outcomes scrape readiness
  console.log('📊 Outcomes Scrape Readiness:');
  
  // Check tweet_metrics table
  const { data: metrics } = await supabase
    .from('tweet_metrics')
    .select('*')
    .eq('tweet_id', tweetId)
    .order('scraped_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (metrics) {
    console.log(`   ✅ Found in tweet_metrics`);
    console.log(`   Last scraped: ${metrics.scraped_at}`);
    console.log(`   Views: ${metrics.views || 0} | Likes: ${metrics.likes || 0} | Replies: ${metrics.replies || 0}`);
  } else {
    console.log(`   ⏳ Not yet in tweet_metrics (will be scraped by metrics job)`);
  }
  
  // Check if tweet is eligible for scraping
  const hasPostedAt = !!decision.posted_at;
  const hasTweetId = !!decision.tweet_id;
  const isPosted = decision.status === 'posted';
  
  const scrapeReady = hasPostedAt && hasTweetId && isPosted;
  console.log(`   Scrape eligible: ${scrapeReady ? '✅ YES' : '❌ NO'}`);
  if (!scrapeReady) {
    if (!hasPostedAt) console.log(`      - Missing posted_at`);
    if (!hasTweetId) console.log(`      - Missing tweet_id`);
    if (!isPosted) console.log(`      - Status is "${decision.status}" not "posted"`);
  }
  
  console.log('');
  console.log('='.repeat(60));
  
  // Final verdict
  const hasAllRequired = missingFields.length === 0;
  const hasProvenance = missingProvenance.length === 0;
  
  if (hasAllRequired && scrapeReady) {
    console.log('✅ PASS: Tweet is properly saved and scrape-ready');
    process.exit(0);
  } else {
    console.log('❌ FAIL: Issues found');
    if (!hasAllRequired) {
      console.log(`   Missing required fields: ${missingFields.join(', ')}`);
    }
    if (!scrapeReady) {
      console.log(`   Not scrape-ready (see above)`);
    }
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

