#!/usr/bin/env tsx
/**
 * 🌾 MAC RUNNER CURATED HARVESTER
 * 
 * Harvests opportunities from curated handles using Mac runner's persistent profile.
 * Runs every 5 minutes via LaunchAgent.
 * 
 * Usage:
 *   pnpm run runner:harvest-once
 */

import fs from 'fs';
import path from 'path';

// Load .env.local first (preferred), then .env
const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

// Set runner mode to use persistent profile
process.env.RUNNER_MODE = 'true';
if (!process.env.RUNNER_PROFILE_DIR) {
  process.env.RUNNER_PROFILE_DIR = path.join(process.cwd(), '.runner-profile');
}

// Lazy imports after env is loaded
let getSupabaseClient: any;
let resolveTweetAncestry: any;
let filterTargetQuality: any;

const CURATED_HANDLES_STR = process.env.REPLY_CURATED_HANDLES || '';
const CURATED_HANDLES = CURATED_HANDLES_STR
  .split(',')
  .map(h => h.trim().toLowerCase().replace('@', ''))
  .filter(Boolean);

const MAX_TWEETS_PER_HANDLE = 10;
const MAX_AGE_HOURS = 48; // Check last 48h for duplicates
const HARVEST_AGE_HOURS = 24; // Only harvest tweets from last 24h

interface HarvestResult {
  handle: string;
  tweets_found: number;
  opportunities_inserted: number;
  skipped_duplicates: number;
  skipped_already_replied: number;
  skipped_non_root: number;
  skipped_low_quality: number;
  failures: string[];
}

/**
 * Check if tweet was already used/attempted in last 48h
 */
async function isTweetAlreadyUsed(tweetId: string): Promise<boolean> {
  if (!getSupabaseClient) {
    const db = await import('../../src/db');
    getSupabaseClient = db.getSupabaseClient;
  }
  const supabase = getSupabaseClient();
  const cutoffTime = new Date(Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000).toISOString();

  // Check reply_decisions
  const { data: decisions } = await supabase
    .from('reply_decisions')
    .select('decision_id')
    .eq('target_tweet_id', tweetId)
    .gte('created_at', cutoffTime)
    .limit(1);

  if (decisions && decisions.length > 0) {
    return true;
  }

  // Check system_events for POST_ATTEMPT or POST_SUCCESS
  const { data: events } = await supabase
    .from('system_events')
    .select('event_id')
    .in('event_type', ['POST_ATTEMPT', 'POST_SUCCESS'])
    .gte('created_at', cutoffTime)
    .like('event_data', `%"target_tweet_id":"${tweetId}"%`)
    .limit(1);

  return (events && events.length > 0) || false;
}

/**
 * Fetch user tweets using persistent Playwright profile
 */
async function fetchUserTweets(handle: string): Promise<Array<{
  tweet_id: string;
  text: string;
  posted_at: Date;
  author: string;
}>> {
  // Use runner's persistent profile launcher
  const { launchPersistent } = await import('../../src/infra/playwright/launcher');
  
  const tweets: Array<{ tweet_id: string; text: string; posted_at: Date; author: string }> = [];
  
  const context = await launchPersistent();
  const page = await context.newPage();
  
  try {
    const url = `https://x.com/${handle}`;
    console.log(`   🌐 Navigating to ${url}...`);
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000); // Let page load
    
    // Check for consent wall
    const consentWall = await page.locator('text="This post is from an account that no longer exists"').isVisible({ timeout: 2000 }).catch(() => false) ||
                       await page.locator('text="Something went wrong"').isVisible({ timeout: 2000 }).catch(() => false);
    
    if (consentWall) {
      throw new Error('CONSENT_WALL');
    }
    
    // Extract tweets from timeline
    const extractedTweets = await page.evaluate(() => {
      const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
      const results: Array<{ tweet_id: string; text: string; posted_at: string }> = [];
      
      for (const article of articles.slice(0, MAX_TWEETS_PER_HANDLE * 2)) { // Get more to filter
        // Extract tweet ID from link
        const link = article.querySelector('a[href*="/status/"]');
        if (!link) continue;
        
        const href = link.getAttribute('href') || '';
        const match = href.match(/\/status\/(\d+)/);
        if (!match) continue;
        
        const tweetId = match[1];
        
        // Extract text
        const textEl = article.querySelector('[data-testid="tweetText"]');
        const text = textEl?.textContent?.trim() || '';
        
        if (text.length < 10) continue; // Skip empty tweets
        
        // Extract timestamp
        const timeEl = article.querySelector('time');
        const postedAt = timeEl?.getAttribute('datetime') || new Date().toISOString();
        
        // Check if it's a reply (skip if has "Replying to" indicator)
        const replyingTo = article.querySelector('[data-testid="Tweet-User-Avatar"] ~ div:has-text("Replying to")');
        if (replyingTo) continue; // Skip replies
        
        results.push({ tweet_id: tweetId, text, posted_at: postedAt });
      }
      
      return results;
    });
    
    // Filter by age (last 24h)
    const cutoffTime = Date.now() - HARVEST_AGE_HOURS * 60 * 60 * 1000;
    
    for (const tweet of extractedTweets.slice(0, MAX_TWEETS_PER_HANDLE)) {
      const postedAt = new Date(tweet.posted_at).getTime();
      if (postedAt >= cutoffTime) {
        tweets.push({
          tweet_id: tweet.tweet_id,
          text: tweet.text,
          posted_at: new Date(tweet.posted_at),
          author: handle,
        });
      }
    }
  } finally {
    await context.close();
  }
  
  return tweets;
}

async function harvestHandle(handle: string): Promise<HarvestResult> {
  const result: HarvestResult = {
    handle,
    tweets_found: 0,
    opportunities_inserted: 0,
    skipped_duplicates: 0,
    skipped_already_replied: 0,
    skipped_non_root: 0,
    skipped_low_quality: 0,
    failures: [],
  };
  
  try {
    console.log(`\n📥 Harvesting @${handle}...`);
    
    // Fetch tweets
    const tweets = await fetchUserTweets(handle);
    result.tweets_found = tweets.length;
    console.log(`   ✅ Found ${tweets.length} tweets`);
    
    if (tweets.length === 0) {
      return result;
    }
    
    // Process each tweet
    if (!getSupabaseClient) {
      const db = await import('../../src/db');
      getSupabaseClient = db.getSupabaseClient;
    }
    const supabase = getSupabaseClient();
    
    for (const tweet of tweets) {
      try {
        // Check if already used
        const alreadyUsed = await isTweetAlreadyUsed(tweet.tweet_id);
        if (alreadyUsed) {
          result.skipped_already_replied++;
          continue;
        }
        
        // Lazy import modules
        if (!resolveTweetAncestry) {
          const recorder = await import('../../src/jobs/replySystemV2/replyDecisionRecorder');
          resolveTweetAncestry = recorder.resolveTweetAncestry;
        }
        if (!filterTargetQuality) {
          const filter = await import('../../src/gates/replyTargetQualityFilter');
          filterTargetQuality = filter.filterTargetQuality;
        }
        if (!getSupabaseClient) {
          const db = await import('../../src/db');
          getSupabaseClient = db.getSupabaseClient;
        }
        
        // Validate root + quality filter
        const ancestry = await resolveTweetAncestry(tweet.tweet_id);
        
        if (!ancestry.isRoot || ancestry.targetInReplyToTweetId !== null) {
          result.skipped_non_root++;
          continue;
        }
        
        const qualityResult = filterTargetQuality(
          ancestry.normalizedSnapshot || tweet.text,
          handle,
          undefined,
          ancestry.normalizedSnapshot || tweet.text
        );
        
        if (!qualityResult.pass) {
          result.skipped_low_quality++;
          continue;
        }
        
        // Check for duplicate in reply_opportunities
        const { data: existing } = await supabase
          .from('reply_opportunities')
          .select('id')
          .eq('target_tweet_id', tweet.tweet_id)
          .limit(1)
          .maybeSingle();
        
        if (existing) {
          result.skipped_duplicates++;
          continue;
        }
        
        // Insert opportunity
        const { error: insertError } = await supabase
          .from('reply_opportunities')
          .insert({
            target_tweet_id: tweet.tweet_id,
            target_username: handle,
            target_tweet_url: `https://x.com/i/status/${tweet.tweet_id}`,
            target_tweet_content: tweet.text.substring(0, 500),
            tweet_posted_at: tweet.posted_at.toISOString(),
            is_root_tweet: true,
            root_tweet_id: tweet.tweet_id,
            target_in_reply_to_tweet_id: null,
            status: 'pending',
            replied_to: false,
            opportunity_score: qualityResult.score || 75.0,
            discovery_method: 'mac_curated',
            account_username: handle,
          });
        
        if (insertError) {
          if (insertError.message.includes('duplicate') || insertError.message.includes('unique')) {
            result.skipped_duplicates++;
          } else {
            result.failures.push(`Insert error for ${tweet.tweet_id}: ${insertError.message}`);
          }
        } else {
          result.opportunities_inserted++;
        }
      } catch (tweetError: any) {
        result.failures.push(`Tweet ${tweet.tweet_id}: ${tweetError.message}`);
      }
    }
    
  } catch (error: any) {
    if (error.message.includes('CONSENT_WALL')) {
      result.failures.push('CONSENT_WALL');
    } else {
      result.failures.push(`Harvest failed: ${error.message}`);
    }
  }
  
  return result;
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🌾 MAC RUNNER CURATED HARVESTER');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (CURATED_HANDLES.length === 0) {
    console.error('❌ No curated handles configured. Set REPLY_CURATED_HANDLES');
    process.exit(1);
  }
  
  console.log(`🎯 Harvesting ${CURATED_HANDLES.length} curated handles: ${CURATED_HANDLES.join(', ')}\n`);
  
  const results: HarvestResult[] = [];
  
  for (const handle of CURATED_HANDLES) {
    const result = await harvestHandle(handle);
    results.push(result);
    
    // Small delay between handles
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Final report
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📊 HARVEST REPORT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  let totalHandles = 0;
  let totalTweets = 0;
  let totalInserted = 0;
  let totalDuplicates = 0;
  let totalSkipped = 0;
  const allFailures: string[] = [];
  
  for (const result of results) {
    console.log(`@${result.handle}:`);
    console.log(`   Tweets found: ${result.tweets_found}`);
    console.log(`   Opportunities inserted: ${result.opportunities_inserted}`);
    console.log(`   Skipped duplicates: ${result.skipped_duplicates}`);
    console.log(`   Skipped already replied: ${result.skipped_already_replied}`);
    console.log(`   Skipped non-root: ${result.skipped_non_root}`);
    console.log(`   Skipped low quality: ${result.skipped_low_quality}`);
    if (result.failures.length > 0) {
      console.log(`   ❌ Failures: ${result.failures.slice(0, 3).join(', ')}`);
    }
    console.log('');
    
    totalHandles++;
    totalTweets += result.tweets_found;
    totalInserted += result.opportunities_inserted;
    totalDuplicates += result.skipped_duplicates;
    totalSkipped += result.skipped_already_replied + result.skipped_non_root + result.skipped_low_quality;
    allFailures.push(...result.failures);
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📈 SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Handles checked: ${totalHandles}`);
  console.log(`Tweets found: ${totalTweets}`);
  console.log(`Opportunities inserted: ${totalInserted}`);
  console.log(`Skipped (duplicates/replied/non-root/low-quality): ${totalSkipped + totalDuplicates}`);
  console.log(`Failures: ${allFailures.length}`);
  if (allFailures.length > 0) {
    console.log(`   ${allFailures.slice(0, 5).join('\n   ')}`);
  }
  console.log('');
  
  if (totalInserted > 0) {
    console.log(`✅ Successfully inserted ${totalInserted} opportunities`);
  } else {
    console.log(`⚠️  No opportunities inserted. Check failures above.`);
  }
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
