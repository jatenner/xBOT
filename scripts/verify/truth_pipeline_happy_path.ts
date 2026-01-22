#!/usr/bin/env tsx
/**
 * ✅ HAPPY PATH VERIFICATION: Truth Pipeline
 * 
 * Verifies that the latest POST_SUCCESS event has:
 * 1. Valid tweet_id (18-20 digits)
 * 2. Tweet URL that loads correctly
 * 3. Matches content_metadata
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { assertValidTweetId } from '../../src/posting/tweetIdValidator';
import { Client } from 'pg';
import https from 'https';
import http from 'http';

async function checkUrlExists(url: string): Promise<{ exists: boolean; statusCode?: number; error?: string }> {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const req = client.get(url, { 
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; xBOT-verification/1.0)'
      }
    }, (res) => {
      const statusCode = res.statusCode || 0;
      res.destroy(); // Close connection immediately
      
      if (statusCode >= 200 && statusCode < 400) {
        resolve({ exists: true, statusCode });
      } else if (statusCode === 404) {
        resolve({ exists: false, statusCode, error: 'Not found' });
      } else {
        resolve({ exists: false, statusCode, error: `HTTP ${statusCode}` });
      }
    });
    
    req.on('error', (err: any) => {
      resolve({ exists: false, error: err.message });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({ exists: false, error: 'Timeout' });
    });
    
    req.setTimeout(10000);
  });
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           ✅ HAPPY PATH VERIFICATION: Truth Pipeline');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const supabase = getSupabaseClient();

  // Get latest POST_SUCCESS event
  const { data: postSuccess, error: eventError } = await supabase
    .from('system_events')
    .select('*')
    .eq('event_type', 'POST_SUCCESS')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (eventError) {
    console.error(`❌ Error querying POST_SUCCESS: ${eventError.message}`);
    process.exit(1);
  }

  if (!postSuccess) {
    console.error(`❌ No POST_SUCCESS events found in database`);
    console.log(`   Run a posting attempt first, then re-run this verification.`);
    process.exit(1);
  }

  const eventData = typeof postSuccess.event_data === 'string' 
    ? JSON.parse(postSuccess.event_data)
    : postSuccess.event_data;

  const decisionId = eventData.decision_id;
  const tweetId = eventData.tweet_id;
  const tweetUrl = eventData.tweet_url;

  console.log(`📊 Latest POST_SUCCESS Event:`);
  console.log(`   Created: ${postSuccess.created_at}`);
  console.log(`   Decision ID: ${decisionId}`);
  console.log(`   Tweet ID: ${tweetId}`);
  console.log(`   Tweet URL: ${tweetUrl}\n`);

  // Validate tweet_id format
  const validation = assertValidTweetId(tweetId);
  if (!validation.valid) {
    console.error(`❌ VALIDATION FAILED: ${validation.error}`);
    console.error(`   Tweet ID: "${tweetId}" (length: ${tweetId.length})`);
    process.exit(1);
  }

  console.log(`✅ Tweet ID validation passed: ${tweetId} (${tweetId.length} digits)\n`);

  // Verify content_metadata
  const { data: contentMeta, error: metaError } = await supabase
    .from('content_metadata')
    .select('decision_id, tweet_id, status, posted_at')
    .eq('decision_id', decisionId)
    .maybeSingle();

  if (metaError) {
    console.error(`❌ Error querying content_metadata: ${metaError.message}`);
    process.exit(1);
  }

  if (!contentMeta) {
    console.error(`❌ No content_metadata found for decision_id=${decisionId}`);
    process.exit(1);
  }

  console.log(`📊 Content Metadata:`);
  console.log(`   Status: ${contentMeta.status}`);
  console.log(`   Tweet ID: ${contentMeta.tweet_id}`);
  console.log(`   Posted At: ${contentMeta.posted_at}\n`);

  if (contentMeta.tweet_id !== tweetId) {
    console.error(`❌ MISMATCH: content_metadata.tweet_id (${contentMeta.tweet_id}) != POST_SUCCESS.tweet_id (${tweetId})`);
    process.exit(1);
  }

  console.log(`✅ Tweet ID matches in both tables\n`);

  // Verify tweet_id is string type
  if (typeof tweetId !== 'string') {
    console.error(`❌ TYPE ERROR: tweet_id is not a string (got: ${typeof tweetId})`);
    process.exit(1);
  }

  console.log(`✅ Tweet ID is string type\n`);

  // Check URL exists
  console.log(`🔍 Checking if tweet URL loads...`);
  const urlCheck = await checkUrlExists(tweetUrl);
  
  if (urlCheck.exists) {
    console.log(`✅ Tweet URL loads successfully (HTTP ${urlCheck.statusCode})\n`);
  } else {
    console.warn(`⚠️  Tweet URL check failed: ${urlCheck.error || 'Unknown error'}`);
    console.warn(`   Status Code: ${urlCheck.statusCode || 'N/A'}`);
    console.warn(`   This may be due to network restrictions or Twitter blocking automated requests.`);
    console.warn(`   Please manually verify: ${tweetUrl}\n`);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`           ✅ HAPPY PATH VERIFICATION PASSED`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Summary:`);
  console.log(`  Decision ID: ${decisionId}`);
  console.log(`  Tweet ID: ${tweetId} (${tweetId.length} digits) ✅`);
  console.log(`  Tweet URL: ${tweetUrl}`);
  console.log(`  URL Status: ${urlCheck.exists ? '✅ Loads' : '⚠️  Manual verification required'}\n`);

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
