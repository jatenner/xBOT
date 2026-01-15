#!/usr/bin/env tsx
/**
 * 🌾 HARVEST CURATED OPPORTUNITIES ONCE
 * 
 * Manually harvest opportunities from curated handles (first 5 only)
 * Uses existing harvester infrastructure to fetch and insert opportunities
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';
import { resolveTweetAncestry } from '../src/jobs/replySystemV2/replyDecisionRecorder';
import { filterTargetQuality } from '../src/gates/replyTargetQualityFilter';

const CURATED_HANDLES_STR = process.env.REPLY_CURATED_HANDLES || '';
const CURATED_HANDLES = CURATED_HANDLES_STR
  .split(',')
  .map(h => h.trim().toLowerCase().replace('@', ''))
  .filter(Boolean)
  .slice(0, 5); // First 5 only

const MAX_AGE_HOURS = 24;

interface HarvestResult {
  handle: string;
  tweets_found: number;
  opportunities_inserted: number;
  skipped_duplicates: number;
  consent_wall_count: number;
  failures: string[];
}

async function fetchUserTweets(handle: string): Promise<Array<{
  tweet_id: string;
  text: string;
  posted_at: Date;
  author: string;
}>> {
  // Use existing browser infrastructure
  const { withBrowser } = await import('../src/infra/playwright/withBrowser');
  
  const tweets: Array<{ tweet_id: string; text: string; posted_at: Date; author: string }> = [];
  
  try {
    await withBrowser(async (page) => {
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
        
        for (const article of articles.slice(0, 20)) { // First 20 tweets
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
      const cutoffTime = Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000;
      
      for (const tweet of extractedTweets) {
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
    });
  } catch (error: any) {
    if (error.message === 'CONSENT_WALL') {
      throw error; // Re-throw to be caught by caller
    }
    throw new Error(`Browser fetch failed: ${error.message}`);
  }
  
  return tweets;
}

async function harvestHandle(handle: string): Promise<HarvestResult> {
  const result: HarvestResult = {
    handle,
    tweets_found: 0,
    opportunities_inserted: 0,
    skipped_duplicates: 0,
    consent_wall_count: 0,
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
    const supabase = getSupabaseClient();
    
    for (const tweet of tweets) {
      try {
        // Validate root + quality filter
        const ancestry = await resolveTweetAncestry(tweet.tweet_id);
        
        if (!ancestry.isRoot || ancestry.targetInReplyToTweetId !== null) {
          continue; // Skip non-root tweets
        }
        
        const qualityResult = filterTargetQuality(
          ancestry.normalizedSnapshot || tweet.text,
          handle,
          undefined,
          ancestry.normalizedSnapshot || tweet.text
        );
        
        if (!qualityResult.pass) {
          continue; // Skip low-quality targets
        }
        
        // Insert opportunity
        const { error: insertError } = await supabase
          .from('reply_opportunities')
          .upsert({
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
            discovery_method: 'curated_manual_harvest',
            account_username: handle,
          }, {
            onConflict: 'target_tweet_id',
            ignoreDuplicates: false,
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
      result.consent_wall_count = 1;
    } else {
      result.failures.push(`Harvest failed: ${error.message}`);
    }
  }
  
  return result;
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🌾 HARVEST CURATED OPPORTUNITIES (ONCE)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (CURATED_HANDLES.length === 0) {
    console.error('❌ No curated handles configured. Set REPLY_CURATED_HANDLES');
    process.exit(1);
  }
  
  console.log(`🎯 Harvesting first 5 curated handles: ${CURATED_HANDLES.join(', ')}\n`);
  
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
  let totalConsentWalls = 0;
  const allFailures: string[] = [];
  
  for (const result of results) {
    console.log(`@${result.handle}:`);
    console.log(`   Tweets found: ${result.tweets_found}`);
    console.log(`   Opportunities inserted: ${result.opportunities_inserted}`);
    console.log(`   Skipped duplicates: ${result.skipped_duplicates}`);
    if (result.consent_wall_count > 0) {
      console.log(`   ⚠️  Consent wall: ${result.consent_wall_count}`);
    }
    if (result.failures.length > 0) {
      console.log(`   ❌ Failures: ${result.failures.slice(0, 3).join(', ')}`);
    }
    console.log('');
    
    totalHandles++;
    totalTweets += result.tweets_found;
    totalInserted += result.opportunities_inserted;
    totalDuplicates += result.skipped_duplicates;
    totalConsentWalls += result.consent_wall_count;
    allFailures.push(...result.failures);
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📈 SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Handles checked: ${totalHandles}`);
  console.log(`Tweets found: ${totalTweets}`);
  console.log(`Opportunities inserted: ${totalInserted}`);
  console.log(`Skipped duplicates: ${totalDuplicates}`);
  console.log(`Consent wall count: ${totalConsentWalls}`);
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
