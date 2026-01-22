#!/usr/bin/env tsx
/**
 * 🔍 POST_SUCCESS RECONCILE: Last 6 Hours
 * 
 * Verifies POST_SUCCESS events in the last 6 hours:
 * - Validates tweet_id format (18-20 digits)
 * - Verifies URLs are reachable
 * - Classifies as OK, LEGACY_INVALID, or NOT_FOUND
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { assertValidTweetId } from '../../src/posting/tweetIdValidator';
import https from 'https';
import http from 'http';

interface PostSuccessEvent {
  created_at: string;
  tweet_id: string;
  decision_id: string;
  url: string;
  validity: 'VALID' | 'LEGACY_INVALID';
  url_status: 'OK' | 'NOT_FOUND' | 'ERROR';
  url_status_code?: number;
}

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
      res.destroy();
      
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
  console.log('           🔍 POST_SUCCESS RECONCILE: Last 6 Hours');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const supabase = getSupabaseClient();

  // Query POST_SUCCESS events in last 6 hours
  const { data: events, error: eventError } = await supabase
    .from('system_events')
    .select('*')
    .eq('event_type', 'POST_SUCCESS')
    .gte('created_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false });

  // Also count legacy invalid for INFO
  const { data: legacyInvalid, error: legacyError } = await supabase
    .from('system_events')
    .select('id')
    .eq('event_type', 'POST_SUCCESS_LEGACY_INVALID')
    .gte('created_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString());

  if (legacyError) {
    console.warn(`⚠️  Error querying legacy invalid: ${legacyError.message}`);
  } else {
    console.log(`ℹ️  POST_SUCCESS_LEGACY_INVALID in last 6h: ${legacyInvalid?.length || 0}\n`);
  }

  if (eventError) {
    console.error(`❌ Error querying POST_SUCCESS: ${eventError.message}`);
    process.exit(1);
  }

  if (!events || events.length === 0) {
    console.log('✅ No POST_SUCCESS events found in last 6 hours');
    process.exit(0);
  }

  console.log(`📊 Found ${events.length} POST_SUCCESS events in last 6 hours\n`);

  const results: PostSuccessEvent[] = [];
  let hasInvalid = false;
  let hasNotFound = false;

  // Process each event
  for (const event of events) {
    const eventData = typeof event.event_data === 'string'
      ? JSON.parse(event.event_data)
      : event.event_data;

    const tweetId = eventData.tweet_id;
    const decisionId = eventData.decision_id;
    const tweetUrl = eventData.tweet_url || `https://x.com/Signal_Synapse/status/${tweetId}`;

    // Validate tweet_id format
    const validation = assertValidTweetId(tweetId);
    const validity: 'VALID' | 'LEGACY_INVALID' = validation.valid ? 'VALID' : 'LEGACY_INVALID';
    
    if (!validation.valid) {
      hasInvalid = true;
      console.log(`⚠️  Invalid tweet_id detected: ${tweetId} (${tweetId.length} digits) - ${validation.error}`);
    }

    // Check URL only for valid tweet_ids
    let urlStatus: 'OK' | 'NOT_FOUND' | 'ERROR' = 'ERROR';
    let urlStatusCode: number | undefined;

    if (validity === 'VALID') {
      console.log(`🔍 Checking URL: ${tweetUrl}...`);
      const urlCheck = await checkUrlExists(tweetUrl);
      urlStatusCode = urlCheck.statusCode;
      
      if (urlCheck.exists) {
        urlStatus = 'OK';
        console.log(`   ✅ Loads (HTTP ${urlCheck.statusCode})`);
      } else if (urlCheck.statusCode === 404) {
        urlStatus = 'NOT_FOUND';
        hasNotFound = true;
        console.log(`   ❌ NOT FOUND (HTTP 404)`);
      } else {
        urlStatus = 'ERROR';
        console.log(`   ⚠️  Error: ${urlCheck.error || 'Unknown'}`);
      }
    } else {
      console.log(`   ⏭️  Skipping URL check (invalid tweet_id)`);
    }

    results.push({
      created_at: event.created_at,
      tweet_id: tweetId,
      decision_id: decisionId,
      url: tweetUrl,
      validity,
      url_status: urlStatus,
      url_status_code: urlStatusCode,
    });
  }

  // Print summary table
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📊 SUMMARY TABLE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('| Tweet ID | Decision ID | Created | Validity | URL Status |');
  console.log('|----------|-------------|---------|----------|------------|');
  
  results.forEach((r) => {
    const tweetIdShort = r.tweet_id.length > 20 ? r.tweet_id.substring(0, 20) + '...' : r.tweet_id;
    const decisionIdShort = r.decision_id ? r.decision_id.substring(0, 8) + '...' : 'N/A';
    const created = new Date(r.created_at).toISOString().substring(0, 19) + 'Z';
    const validityMark = r.validity === 'VALID' ? '✅ VALID' : '❌ LEGACY_INVALID';
    const urlMark = r.url_status === 'OK' ? '✅ OK' : 
                   r.url_status === 'NOT_FOUND' ? '❌ NOT_FOUND' : 
                   '⚠️ ERROR';
    
    console.log(`| ${tweetIdShort} | ${decisionIdShort} | ${created} | ${validityMark} | ${urlMark} |`);
  });

  // Counts
  const validCount = results.filter(r => r.validity === 'VALID').length;
  const invalidCount = results.filter(r => r.validity === 'LEGACY_INVALID').length;
  const okCount = results.filter(r => r.url_status === 'OK').length;
  const notFoundCount = results.filter(r => r.url_status === 'NOT_FOUND').length;

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📈 COUNTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`Total events: ${results.length}`);
  console.log(`✅ Valid tweet_ids: ${validCount}`);
  console.log(`❌ Legacy invalid tweet_ids: ${invalidCount}`);
  console.log(`✅ URLs OK: ${okCount}`);
  console.log(`❌ URLs NOT_FOUND: ${notFoundCount}`);

  // Exit status
  if (hasInvalid) {
    console.log('\n❌ FAIL: Invalid tweet_id(s) found in last 6 hours');
    process.exit(1);
  }

  if (hasNotFound) {
    console.log('\n❌ FAIL: Valid tweet_id(s) with NOT_FOUND URLs');
    process.exit(1);
  }

  console.log('\n✅ PASS: All POST_SUCCESS events have valid tweet_ids and reachable URLs');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
