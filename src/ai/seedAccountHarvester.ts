/**
 * 🌱 SEED ACCOUNT HARVESTER (PRIMARY DISCOVERY SOURCE)
 * 
 * Scrapes high-visibility health/fitness/science accounts for viral root tweets.
 * This is the PRIMARY source for reply opportunities, not a fallback.
 * 
 * Strategy:
 * - Maintain curated list of elite health accounts + viral aggregators
 * - Scrape their recent tweets (30-80 per account)
 * - Filter ROOT tweets only (no replies, retweets, quote-of-reply)
 * - Extract all metrics (likes, views, replies, retweets)
 * - Store as reply_opportunities with quality scoring
 */

import { Page } from 'playwright';
import { getSupabaseClient } from '../db/index';
import { scoreTargetQuality } from './targetQualityFilter';
import { checkFreshness } from './freshnessController';

// ═══════════════════════════════════════════════════════════════════════════
// SEED ACCOUNTS (HIGH-VISIBILITY HEALTH/FITNESS/SCIENCE)
// ═══════════════════════════════════════════════════════════════════════════

interface SeedAccount {
  username: string;
  category: 'health' | 'fitness' | 'nutrition' | 'longevity' | 'science' | 'aggregator';
  priority: number; // 0-1, higher = more valuable
  min_followers?: number;
}

const SEED_ACCOUNTS: SeedAccount[] = [
  // Elite Health/Science (1M+ followers)
  { username: 'hubermanlab', category: 'science', priority: 1.0 },
  { username: 'foundmyfitness', category: 'longevity', priority: 1.0 },
  { username: 'peterattiamd', category: 'health', priority: 1.0 },
  { username: 'bengreenfield', category: 'health', priority: 0.9 },
  
  // Fitness Authorities (500K+)
  { username: 'jeff_nippard', category: 'fitness', priority: 0.9 },
  { username: 'biolayne', category: 'nutrition', priority: 0.9 },
  { username: 'drandygalpin', category: 'science', priority: 0.9 },
  
  // Viral Health Aggregators
  { username: 'thefitnesschef_', category: 'aggregator', priority: 0.8 },
  { username: 'drericberg', category: 'health', priority: 0.8 },
  
  // Science Communicators
  { username: 'yudapearl', category: 'science', priority: 0.7 },
  { username: 'nicknorwitzphd', category: 'science', priority: 0.7 },
];

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface ScrapedTweet {
  tweet_id: string;
  tweet_url: string;
  author_handle: string;
  author_name: string;
  author_followers?: number;
  tweet_content: string;
  like_count: number;
  reply_count: number;
  retweet_count: number;
  view_count?: number;
  tweet_posted_at: Date;
  age_minutes: number;
  velocity: number;
  is_root_tweet: boolean;
  is_reply_tweet: boolean;
  is_retweet: boolean;
  is_quote: boolean;
  in_reply_to_tweet_id?: string;
  conversation_id?: string;
}

interface HarvestResult {
  account: string;
  scraped_count: number;
  root_only_count: number;
  stored_count: number;
  blocked_reply_count: number;
  blocked_quality_count: number;
  blocked_stale_count: number;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN HARVESTER
// ═══════════════════════════════════════════════════════════════════════════

export async function harvestSeedAccounts(
  page: Page,
  options: {
    accounts?: string[]; // Override seed list
    max_tweets_per_account?: number;
    max_accounts?: number;
  } = {}
): Promise<{
  total_scraped: number;
  total_stored: number;
  results: HarvestResult[];
}> {
  const {
    accounts = SEED_ACCOUNTS.map(a => a.username),
    max_tweets_per_account = 50,
    max_accounts = 8,
  } = options;
  
  const results: HarvestResult[] = [];
  let total_scraped = 0;
  let total_stored = 0;
  
  console.log(`[SEED_HARVEST] 🌱 Starting seed account harvest`);
  console.log(`[SEED_HARVEST]   Accounts: ${accounts.slice(0, max_accounts).length}`);
  console.log(`[SEED_HARVEST]   Max tweets per account: ${max_tweets_per_account}`);
  
  const accountsToProcess = accounts.slice(0, max_accounts);
  
  for (const username of accountsToProcess) {
    try {
      const result = await harvestAccount(page, username, max_tweets_per_account);
      results.push(result);
      total_scraped += result.scraped_count;
      total_stored += result.stored_count;
      
      console.log(`[SEED_HARVEST] ✅ @${username}: ${result.stored_count}/${result.scraped_count} stored`);
      
      // Small delay between accounts
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error: any) {
      console.error(`[SEED_HARVEST] ❌ @${username} failed:`, error.message);
      results.push({
        account: username,
        scraped_count: 0,
        root_only_count: 0,
        stored_count: 0,
        blocked_reply_count: 0,
        blocked_quality_count: 0,
        blocked_stale_count: 0,
        error: error.message,
      });
    }
  }
  
  console.log(`[SEED_HARVEST] 🌾 Summary: ${total_stored}/${total_scraped} opportunities stored`);
  
  return { total_scraped, total_stored, results };
}

async function harvestAccount(
  page: Page,
  username: string,
  max_tweets: number
): Promise<HarvestResult> {
  const result: HarvestResult = {
    account: username,
    scraped_count: 0,
    root_only_count: 0,
    stored_count: 0,
    blocked_reply_count: 0,
    blocked_quality_count: 0,
    blocked_stale_count: 0,
  };
  
  // Navigate to user profile
  const profileUrl = `https://x.com/${username}`;
  console.log(`[SEED_HARVEST] 📍 Navigating to ${profileUrl}`);
  
  try {
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000); // Let content load
  } catch (navError: any) {
    throw new Error(`Navigation failed: ${navError.message}`);
  }
  
  // Extract tweets from DOM
  const tweets = await extractTweetsFromProfile(page, max_tweets);
  result.scraped_count = tweets.length;
  
  console.log(`[SEED_HARVEST] 📊 @${username}: Extracted ${tweets.length} tweets`);
  
  // Filter ROOT tweets only with TRUE verification
  // A tweet is a root tweet ONLY if:
  // 1. Not a reply (no in_reply_to_tweet_id)
  // 2. Not a retweet
  // 3. conversation_id == tweet_id (best effort)
  const rootTweets = tweets.filter(t => {
    // Hard rejection if in_reply_to is present
    if (t.in_reply_to_tweet_id) {
      console.log(`[SEED_HARVEST] 🚫 REJECTED ${t.tweet_id}: is a reply (in_reply_to=${t.in_reply_to_tweet_id})`);
      return false;
    }
    // Reject retweets
    if (t.is_retweet) {
      return false;
    }
    // Reject if conversation_id != tweet_id (indicates thread participant)
    if (t.conversation_id && t.conversation_id !== t.tweet_id && t.conversation_id !== 'unknown') {
      console.log(`[SEED_HARVEST] 🚫 REJECTED ${t.tweet_id}: conversation_id mismatch`);
      return false;
    }
    return t.is_root_tweet && !t.is_reply_tweet;
  });
  result.root_only_count = rootTweets.length;
  result.blocked_reply_count = tweets.length - rootTweets.length;
  
  console.log(`[SEED_HARVEST] 🎯 @${username}: ${rootTweets.length} root tweets`);
  
  // Store opportunities
  for (const tweet of rootTweets) {
    try {
      // Quality filter
      const quality = scoreTargetQuality(
        tweet.tweet_content,
        tweet.author_handle,
        tweet.author_followers,
        tweet.view_count,
        tweet.like_count
      );
      
      if (!quality.pass) {
        result.blocked_quality_count++;
        console.log(`[SEED_HARVEST] 🚫 Quality blocked: ${tweet.tweet_id} (score=${quality.score})`);
        continue;
      }
      
      // Freshness filter
      const freshness = checkFreshness(tweet.like_count, tweet.age_minutes, tweet.velocity);
      
      if (!freshness.pass) {
        result.blocked_stale_count++;
        console.log(`[SEED_HARVEST] ⏱️ Stale: ${tweet.tweet_id} (${freshness.reason})`);
        continue;
      }
      
      // Determine tier
      const tier = determineTier(tweet.like_count, tweet.view_count);
      
      // Store
      await storeOpportunity(tweet, quality, tier);
      result.stored_count++;
      
      console.log(`[SEED_HARVEST] ✅ Stored: ${tweet.tweet_id} tier=${tier} quality=${quality.score}`);
    } catch (storeError: any) {
      console.error(`[SEED_HARVEST] ❌ Store failed for ${tweet.tweet_id}:`, storeError.message);
    }
  }
  
  result.blocked_reply_count = tweets.length - rootTweets.length;
  
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// TWEET EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════

async function extractTweetsFromProfile(page: Page, max_tweets: number): Promise<ScrapedTweet[]> {
  const tweets: ScrapedTweet[] = [];
  
  // Scroll and collect tweets
  let scrollAttempts = 0;
  const maxScrollAttempts = 5;
  
  while (tweets.length < max_tweets && scrollAttempts < maxScrollAttempts) {
    // Extract visible tweets
    const newTweets = await page.evaluate(() => {
      const tweetCards = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
      
      return tweetCards.map(card => {
        try {
          // Get tweet ID from link
          const tweetLink = card.querySelector('a[href*="/status/"]') as HTMLAnchorElement;
          const tweetUrl = tweetLink?.href || '';
          const tweetId = tweetUrl.match(/\/status\/(\d+)/)?.[1] || '';
          
          if (!tweetId) return null;
          
          // Get content
          const textDiv = card.querySelector('[data-testid="tweetText"]');
          const content = textDiv?.textContent || '';
          
          // Check if reply (has "Replying to" text)        
          // More accurate: Check for "Replying to @username" indicator, not just reply button
          const replyingToIndicator = card.querySelector('[data-testid="reply"]')?.closest('div')?.textContent?.includes('Replying to');
          const hasReplyContext = card.textContent?.includes('Replying to');
          // Only mark as reply if we have explicit "Replying to" context, not just @ mentions in content
          const isReply = Boolean(hasReplyContext || replyingToIndicator);
          
          // Extract in_reply_to_tweet_id and conversation_id (Twitter truth)
          let inReplyToTweetId: string | undefined;
          let conversationId: string | undefined;
          
          if (replyingTo) {
            // Try to get parent tweet ID from "Replying to" link
            const replyLink = replyingTo.querySelector('a[href*="/status/"]');
            if (replyLink) {
              const parentUrl = (replyLink as HTMLAnchorElement).href;
              inReplyToTweetId = parentUrl.match(/\/status\/(\d+)/)?.[1];
            }
          }
          
          // Conversation ID is typically the root tweet ID
          // For replies, we need to check if this is part of a thread
          // Best effort: if it's a reply, conversation_id != tweet_id
          conversationId = isReply ? (inReplyToTweetId || 'unknown') : tweetId;
          
          // Check if retweet
          const isRetweet = Boolean(card.querySelector('[data-testid="socialContext"]')?.textContent?.includes('reposted'));
          
          // Get metrics
          const metrics = card.querySelectorAll('[role="group"] [data-testid*="count"]');
          let replyCount = 0, retweetCount = 0, likeCount = 0, viewCount: number | undefined;
          
          metrics.forEach(metric => {
            const text = metric.textContent || '';
            const value = parseInt(text.replace(/[^0-9]/g, '')) || 0;
            const testId = metric.getAttribute('data-testid') || '';
            
            if (testId.includes('reply')) replyCount = value;
            if (testId.includes('retweet')) retweetCount = value;
            if (testId.includes('like')) likeCount = value;
          });
          
          // Try to get view count (may not be available)
          const viewElement = Array.from(card.querySelectorAll('[role="group"] a')).find(
            el => el.textContent?.includes('View')
          );
          if (viewElement) {
            const viewText = viewElement.textContent || '';
            const viewMatch = viewText.match(/([\d,]+)\s*Views?/i);
            if (viewMatch) {
              viewCount = parseInt(viewMatch[1].replace(/,/g, ''));
            }
          }
          
          // Get author
          const authorLink = card.querySelector('a[href^="/"][href*="/status/"]') as HTMLAnchorElement;
          const authorHandle = authorLink?.href.match(/\.com\/([^/]+)/)?.[1] || '';
          const authorNameElement = card.querySelector('[data-testid="User-Name"]');
          const authorName = authorNameElement?.textContent?.split('@')[0]?.trim() || '';
          
          // Get timestamp
          const timeElement = card.querySelector('time');
          const datetime = timeElement?.getAttribute('datetime') || '';
          const postedAt = datetime ? new Date(datetime) : new Date();
          const ageMinutes = (Date.now() - postedAt.getTime()) / (60 * 1000);
          
          return {
            tweet_id: tweetId,          
            tweet_url: tweetUrl,        
            author_handle: authorHandle,
            author_name: authorName,    
            tweet_content: content,     
            like_count: likeCount,      
            reply_count: replyCount,    
            retweet_count: retweetCount,
            view_count: viewCount,      
            tweet_posted_at: postedAt.toISOString(),        
            age_minutes: ageMinutes,    
            is_reply: isReply,          
            is_retweet: isRetweet,
            in_reply_to_tweet_id: inReplyToTweetId,
            conversation_id: conversationId,
          };
        } catch (err) {
          return null;
        }
      }).filter(t => t !== null);
    });
    
    // Add new tweets (deduplicate)
    const existingIds = new Set(tweets.map(t => t.tweet_id));
    for (const tweet of newTweets as any[]) {
      if (!existingIds.has(tweet.tweet_id)) {
        tweets.push({
          ...tweet,
          tweet_posted_at: new Date(tweet.tweet_posted_at),
          velocity: tweet.like_count / Math.max(tweet.age_minutes, 10),
          is_root_tweet: !tweet.is_reply && !tweet.is_retweet,
          is_reply_tweet: tweet.is_reply,
          is_quote: false, // TODO: Detect quote tweets
        });
        existingIds.add(tweet.tweet_id);
      }
    }
    
    if (tweets.length >= max_tweets) break;
    
    // Scroll down
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(2000);
    scrollAttempts++;
  }
  
  return tweets.slice(0, max_tweets);
}

// ═══════════════════════════════════════════════════════════════════════════
// TIER DETERMINATION
// ═══════════════════════════════════════════════════════════════════════════

function determineTier(likes: number, views?: number): 'A+' | 'A' | 'B' | 'C' | 'D' {
  // Tier A+: 1M+ views OR 100K+ likes
  if ((views && views >= 1000000) || likes >= 100000) return 'A+';
  
  // Tier A: 100K+ likes (if no A+ from views)
  if (likes >= 100000) return 'A';
  
  // Tier B: 25K+ likes
  if (likes >= 25000) return 'B';
  
  // Tier C: 10K+ likes
  if (likes >= 10000) return 'C';
  
  // Tier D: 2.5K+ likes
  return 'D';
}

// ═══════════════════════════════════════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════════════════════════════════════

async function storeOpportunity(
  tweet: ScrapedTweet,
  quality: any,
  tier: string
): Promise<void> {
  const supabase = getSupabaseClient();
  
  // Calculate score (views-first)
  const baseMetric = tweet.view_count || tweet.like_count;
  const freshnessMultiplier = tweet.age_minutes < 30 ? 2.0 :
                               tweet.age_minutes < 60 ? 1.5 :
                               tweet.age_minutes < 180 ? 1.0 :
                               tweet.age_minutes < 720 ? 0.7 : 0.5;
  
  const velocityMultiplier = Math.min(Math.max(tweet.velocity / 10, 0.8), 2.0);
  const qualityMultiplier = quality.multiplier;
  
  const score = baseMetric * freshnessMultiplier * velocityMultiplier * qualityMultiplier;
  
  const { error } = await supabase
    .from('reply_opportunities')
    .upsert({
      target_tweet_id: tweet.tweet_id,
      target_tweet_url: tweet.tweet_url,
      target_username: tweet.author_handle,
      target_tweet_content: tweet.tweet_content,
      like_count: tweet.like_count,
      reply_count: tweet.reply_count,
      view_count: tweet.view_count,
      tweet_posted_at: tweet.tweet_posted_at.toISOString(),
      posted_minutes_ago: tweet.age_minutes,
      opportunity_score: score,
      status: 'pending',
      replied_to: false,
      is_root_tweet: true,
      is_reply_tweet: false,
      root_tweet_id: tweet.tweet_id,
      tier,
      harvest_tier: tier,
      target_quality_score: quality.score,
      target_quality_tier: quality.quality_tier,
      target_quality_reasons: quality.reasons,              
      account_username: 'xBOT_health', // Our account       
      harvest_source: 'seed_account',   
      harvest_source_detail: tweet.author_handle,
      target_in_reply_to_tweet_id: tweet.in_reply_to_tweet_id,
      target_conversation_id: tweet.conversation_id,
    }, {
      onConflict: 'target_tweet_id',
    });
  
  if (error) {
    throw new Error(`DB upsert failed: ${error.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export { SEED_ACCOUNTS, SeedAccount, HarvestResult };

