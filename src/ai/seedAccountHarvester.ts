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
import { checkWhoami } from '../utils/whoamiAuth';

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
  like_count: number | null; // Can be null if metrics unknown
  reply_count: number | null;
  retweet_count: number | null;
  view_count?: number | null;
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
  // 🗄️ DB-BACKED SEEDS: Query seed_accounts table if accounts not provided
  let accountsToUse: string[] = [];
  
  if (options.accounts && options.accounts.length > 0) {
    // Use provided accounts (override)
    accountsToUse = options.accounts;
  } else {
    // Query DB for enabled seeds, ordered by priority (lower = higher priority)
    const supabase = getSupabaseClient();
    const seedsPerRun = parseInt(process.env.SEEDS_PER_RUN || '10', 10);
    
    const { data: dbSeeds, error: dbError } = await supabase
      .from('seed_accounts')
      .select('handle')
      .eq('enabled', true)
      .order('priority', { ascending: true })
      .limit(seedsPerRun);
    
    if (dbError) {
      console.warn(`[SEED_HARVEST] ⚠️ Failed to query seed_accounts: ${dbError.message}, falling back to hardcoded list`);
      accountsToUse = SEED_ACCOUNTS.map(a => a.username);
    } else if (dbSeeds && dbSeeds.length > 0) {
      accountsToUse = dbSeeds.map(s => s.handle);
      
      // Log seed usage
      const totalEnabled = await supabase
        .from('seed_accounts')
        .select('*', { count: 'exact', head: true })
        .eq('enabled', true);
      
      const sample = accountsToUse.slice(0, 5).join(', ');
      console.log(`[SEEDS] total_enabled=${totalEnabled.count || 0} using_this_run=${accountsToUse.length} sample=${sample}`);
    } else {
      // Fallback to hardcoded if DB is empty
      console.warn(`[SEED_HARVEST] ⚠️ No enabled seeds in DB, falling back to hardcoded list`);
      accountsToUse = SEED_ACCOUNTS.map(a => a.username);
    }
  }
  
  const seedsPerRun = parseInt(process.env.SEEDS_PER_RUN || '10', 10);
  const {
    max_tweets_per_account = 50,
    max_accounts = seedsPerRun || 10,
  } = options;
  
  const results: HarvestResult[] = [];
  let total_scraped = 0;
  let total_stored = 0;
  
  console.log(`[SEED_HARVEST] 🌱 Starting seed account harvest`);
  console.log(`[SEED_HARVEST]   Accounts: ${accountsToUse.slice(0, max_accounts).length}`);
  console.log(`[SEED_HARVEST]   Max tweets per account: ${max_tweets_per_account}`);
  
  const accountsToProcess = accountsToUse.slice(0, max_accounts);
  
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
  
  // Log tier distribution for this harvest run
  const supabase = getSupabaseClient();
  const { data: recentOpps } = await supabase
    .from('reply_opportunities')
    .select('tier, target_tweet_id, target_username, like_count, posted_minutes_ago, likes_per_min, opportunity_score')
    .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
    .order('opportunity_score', { ascending: false });
  
  if (recentOpps && recentOpps.length > 0) {
    const tierDist: Record<string, number> = {};
    for (const opp of recentOpps) {
      const tier = String(opp.tier || 'B').toUpperCase();
      tierDist[tier] = (tierDist[tier] || 0) + 1;
    }
    console.log(`[SEED_HARVEST] 📊 Tier distribution: S=${tierDist['S'] || 0} A=${tierDist['A'] || 0} B=${tierDist['B'] || 0}`);
    
    // Log top 5 Tier_S candidates
    const tierS = recentOpps.filter(opp => String(opp.tier || '').toUpperCase() === 'S').slice(0, 5);
    if (tierS.length > 0) {
      console.log(`[SEED_HARVEST] 🏆 Top 5 Tier_S candidates:`);
      tierS.forEach((opp, i) => {
        console.log(`  ${i + 1}. @${opp.target_username} tweet_id=${opp.target_tweet_id} likes=${opp.like_count} age=${Math.round(opp.posted_minutes_ago || 0)}min likes/min=${(opp.likes_per_min || 0).toFixed(2)} score=${Math.round(opp.opportunity_score || 0)}`);
      });
    }
  }
  
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
    // Increased timeout for navigation
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Wait for timeline container with increased timeout
    try {
      await page.waitForSelector('[data-testid="primaryColumn"], main, section', { timeout: 30000 });
    } catch (waitError) {
      console.warn(`[SEED_HARVEST] ⚠️ Timeline container not found after 30s, continuing anyway`);
    }
    
    await page.waitForTimeout(3000); // Let content load
    
    // ═══════════════════════════════════════════════════════════════════════════
    // AUTH DIAGNOSTIC: Check authentication status using WHOAMI
    // ═══════════════════════════════════════════════════════════════════════════
    const finalUrl = page.url();
    const pageTitle = await page.title().catch(() => 'unknown');
    
    // Extract tweets first to check if any found
    const tweets = await extractTweetsFromProfile(page, max_tweets);
    result.scraped_count = tweets.length;
    const tweetsFound = tweets.length;
    
    // Check WHOAMI (more reliable auth check)
    const whoami = await checkWhoami(page);
    console.log(`[WHOAMI] logged_in=${whoami.logged_in} handle=${whoami.handle || 'unknown'} url=${whoami.url} title=${whoami.title} reason=${whoami.reason}`);
    
    // Determine auth status: If tweets found AND whoami says logged in => ok
    const authOk = tweetsFound > 0 && whoami.logged_in;
    
    // Determine reason if auth failed
    let authReason = 'ok';
    if (!authOk) {
      if (!whoami.logged_in) {
        authReason = whoami.reason || 'not_logged_in';
      } else if (tweetsFound === 0) {
        authReason = 'no_tweets';
      } else {
        authReason = 'unknown';
      }
    }
    
    // Log auth diagnostic
    console.log(`[HARVESTER_AUTH] ok=${authOk} url=${finalUrl} tweets_found=${tweetsFound} reason=${authReason} whoami_logged_in=${whoami.logged_in}`);
    
    // If auth failed, capture debug info
    if (!authOk) {
      console.error(`[HARVESTER_AUTH] ❌ Auth check failed for @${username}`);
      console.error(`[HARVESTER_AUTH]   Final URL: ${finalUrl}`);
      console.error(`[HARVESTER_AUTH]   Page title: ${pageTitle}`);
      console.error(`[HARVESTER_AUTH]   Has login indicators: ${hasLoginIndicators}`);
      console.error(`[HARVESTER_AUTH]   Has timeline container: ${hasTimelineContainer}`);
      console.error(`[HARVESTER_AUTH]   Tweets found: ${tweetsFound}`);
      
      try {
        // Take screenshot
        const screenshotPath = '/tmp/harvester_auth_debug.png';
        await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {});
        const fs = await import('fs');
        const screenshotSize = fs.existsSync(screenshotPath) ? fs.statSync(screenshotPath).size : 0;
        console.log(`[HARVESTER_AUTH] 📸 Screenshot saved: ${screenshotPath} (${screenshotSize} bytes)`);
        
        // Dump HTML
        const htmlPath = '/tmp/harvester_auth_debug.html';
        fs.writeFileSync(htmlPath, pageContent);
        const htmlSize = fs.statSync(htmlPath).size;
        console.log(`[HARVESTER_AUTH] 📄 HTML dumped: ${htmlPath} (${htmlSize} bytes)`);
        console.log(`[HARVESTER_AUTH] 📄 First 300 chars of body: ${bodyText.substring(0, 300)}`);
      } catch (debugError: any) {
        console.error(`[HARVESTER_AUTH] ⚠️ Failed to capture debug info: ${debugError.message}`);
      }
    }
    
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
  
  // Store opportunities with quality/freshness filtering
  const scoredTweets: Array<{ tweet: ScrapedTweet; quality: any; freshness: any; tier: string }> = [];
  
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
      
      // Freshness filter (handle null metrics)
      const freshness = checkFreshness(tweet.like_count ?? 0, tweet.age_minutes, tweet.velocity);
      
      // Determine tier (handle null metrics)
      const tier = determineTier(tweet.like_count ?? 0, tweet.view_count ?? undefined);
      
      // Store scored tweet for potential fallback
      scoredTweets.push({ tweet, quality, freshness, tier });
      
      // Apply filters
      if (!quality.pass) {
        result.blocked_quality_count++;
        console.log(`[SEED_HARVEST] 🚫 Quality blocked: ${tweet.tweet_id} (score=${quality.score})`);
        continue;
      }
      
      // If metrics are unknown (null), allow storage with special handling
      if (tweet.like_count === null || tweet.like_count === undefined) {
        // Store with unknown metrics - don't block by freshness
        await storeOpportunity(tweet, quality, tier, 'normal', undefined, undefined, undefined, undefined, 'unknown');
        result.stored_count++;
        console.log(`[SEED_HARVEST] ✅ Stored (unknown metrics): ${tweet.tweet_id} tier=${tier} quality=${quality.score}`);
        continue;
      }
      
      if (!freshness.pass) {
        result.blocked_stale_count++;
        // Log detailed block reason
        const ageMin = Math.round(tweet.age_minutes);
        const computedMinLikes = ageMin <= 30 ? 25 : ageMin <= 90 ? 75 : ageMin <= 180 ? 150 : 2500;
        const likesPerMin = tweet.age_minutes > 0 ? (tweet.like_count / tweet.age_minutes) : 0;
        console.log(`[SEED_HARVEST] ⏱️ Stale: ${tweet.tweet_id} (${freshness.reason}) age=${ageMin}min computed_min_likes=${computedMinLikes} likes=${tweet.like_count} likes_per_min=${likesPerMin.toFixed(2)}`);
        continue;
      }
      
      // Store
      await storeOpportunity(tweet, quality, tier, 'normal');
      result.stored_count++;
      
      console.log(`[SEED_HARVEST] ✅ Stored: ${tweet.tweet_id} tier=${tier} quality=${quality.score} likes=${tweet.like_count ?? 'null'}`);
    } catch (storeError: any) {
      console.error(`[SEED_HARVEST] ❌ Store failed for ${tweet.tweet_id}:`, storeError.message);
    }
  }
  
  // 🚨 STARVATION PROTECTION: If we stored 0 opportunities, store top 2 highest-scoring tweets
  if (result.stored_count === 0 && scoredTweets.length > 0) {
    console.log(`[SEED_HARVEST] 🚨 STARVATION PROTECTION: Stored 0 opportunities, storing top 2 fallback candidates`);
    
    // Sort by quality score (highest first), then by age
    // For fallback, we bypass freshness checks but still require minimum engagement
    const MIN_LIKES_FOR_FALLBACK = 100; // Minimum likes to consider for fallback
    const fallbackCandidates = scoredTweets
      .filter(item => {
        // Must have minimum likes (bypass freshness age checks for fallback)
        return item.tweet.like_count >= MIN_LIKES_FOR_FALLBACK;
      })
      .sort((a, b) => {
        // Sort by quality score descending
        if (b.quality.score !== a.quality.score) {
          return b.quality.score - a.quality.score;
        }
        // Then by age (newer first)
        return a.tweet.age_minutes - b.tweet.age_minutes;
      })
      .slice(0, 2);
    
    for (const item of fallbackCandidates) {
      try {
        await storeOpportunity(item.tweet, item.quality, item.tier);
        result.stored_count++;
        console.log(`[SEED_HARVEST] ✅ Fallback stored: ${item.tweet.tweet_id} tier=${item.tier} quality=${item.quality.score}`);
      } catch (storeError: any) {
        console.error(`[SEED_HARVEST] ❌ Fallback store failed for ${item.tweet.tweet_id}:`, storeError.message);
      }
    }
  }
  
    result.blocked_reply_count = tweets.length - rootTweets.length;
    
    return result;
  } catch (navError: any) {
    throw new Error(`Navigation failed: ${navError.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TWEET EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════

async function extractTweetsFromProfile(page: Page, max_tweets: number): Promise<ScrapedTweet[]> {
  const tweets: ScrapedTweet[] = [];
  
  // Scroll and collect tweets
  let scrollAttempts = 0;
  const maxScrollAttempts = 5;
  
  // Scroll loop with small waits to trigger tweet rendering (3 scrolls)
  for (let scrollLoop = 0; scrollLoop < 3 && tweets.length < max_tweets; scrollLoop++) {
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(1000); // Small wait to trigger rendering
  }
  
  while (tweets.length < max_tweets && scrollAttempts < maxScrollAttempts) {
    // Extract visible tweets
    const newTweets = await page.evaluate(() => {
      // Try multiple selectors (Twitter/X UI changes frequently)
      let tweetCards = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
      
      // Fallback selectors if primary doesn't work
      if (tweetCards.length === 0) {
        tweetCards = Array.from(document.querySelectorAll('article[role="article"]'));
      }
      if (tweetCards.length === 0) {
        tweetCards = Array.from(document.querySelectorAll('div[data-testid="cellInnerDiv"]'));
      }
      if (tweetCards.length === 0) {
        tweetCards = Array.from(document.querySelectorAll('div[data-testid="tweet"]'));
      }
      
      console.log(`[SEED_HARVEST_DEBUG] Found ${tweetCards.length} tweet elements on page`);
      
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
          
          if (isReply) {
            // Try to get parent tweet ID from "Replying to" link
            const replyLink = card.querySelector('a[href*="/status/"]') as HTMLAnchorElement;
            if (replyLink && replyLink.href.includes('/status/')) {
              // Check if this is a "Replying to" link (usually appears before the tweet content)
              const replyToSection = card.querySelector('[data-testid="reply"]')?.closest('div');
              if (replyToSection) {
                const parentLink = replyToSection.querySelector('a[href*="/status/"]') as HTMLAnchorElement;
                if (parentLink) {
                  inReplyToTweetId = parentLink.href.match(/\/status\/(\d+)/)?.[1];
                }
              }
            }
          }
          
          // Conversation ID is typically the root tweet ID
          // For replies, we need to check if this is part of a thread
          // Best effort: if it's a reply, conversation_id != tweet_id
          conversationId = isReply ? (inReplyToTweetId || 'unknown') : tweetId;
          
          // Check if retweet
          const isRetweet = Boolean(card.querySelector('[data-testid="socialContext"]')?.textContent?.includes('reposted'));
          
          // Get metrics - try aria-label first (more reliable)
          let replyCount: number | null = null, retweetCount: number | null = null, likeCount: number | null = null, viewCount: number | null = null;
          
          // Try aria-label approach first (more reliable for engagement counts)
          const replyButton = card.querySelector('[data-testid="reply"]');
          const retweetButton = card.querySelector('[data-testid="retweet"]');
          const likeButton = card.querySelector('[data-testid="like"]');
          
          if (replyButton) {
            const ariaLabel = replyButton.getAttribute('aria-label') || '';
            const replyMatch = ariaLabel.match(/([\d,]+)/);
            if (replyMatch) {
              replyCount = parseInt(replyMatch[1].replace(/,/g, '')) || null;
            }
          }
          
          if (retweetButton) {
            const ariaLabel = retweetButton.getAttribute('aria-label') || '';
            const retweetMatch = ariaLabel.match(/([\d,]+)/);
            if (retweetMatch) {
              retweetCount = parseInt(retweetMatch[1].replace(/,/g, '')) || null;
            }
          }
          
          if (likeButton) {
            const ariaLabel = likeButton.getAttribute('aria-label') || '';
            const likeMatch = ariaLabel.match(/([\d,]+)/);
            if (likeMatch) {
              likeCount = parseInt(likeMatch[1].replace(/,/g, '')) || null;
            }
          }
          
          // Fallback to text content if aria-label didn't work
          if (replyCount === null || retweetCount === null || likeCount === null) {
            const metrics = card.querySelectorAll('[role="group"] [data-testid*="count"]');
            metrics.forEach(metric => {
              const text = metric.textContent || '';
              const value = parseInt(text.replace(/[^0-9]/g, '')) || null;
              const testId = metric.getAttribute('data-testid') || '';
              
              if (testId.includes('reply') && replyCount === null) replyCount = value;
              if (testId.includes('retweet') && retweetCount === null) retweetCount = value;
              if (testId.includes('like') && likeCount === null) likeCount = value;
            });
          }
          
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
  tier: string,
  storedReason?: string,
  likesPerMin?: number,
  repliesPerMin?: number,
  repostsPerMin?: number,
  opportunityScore?: number,
  metricsStatus?: 'known' | 'unknown'
): Promise<void> {
  const supabase = getSupabaseClient();
  
  // Calculate velocity metrics (per minute) - handle null metrics
  const ageMinutes = Math.max(tweet.age_minutes, 1); // Avoid division by zero
  const computedLikesPerMin = likesPerMin ?? (tweet.like_count !== null && tweet.like_count !== undefined ? tweet.like_count / ageMinutes : null);
  const computedRepliesPerMin = repliesPerMin ?? (tweet.reply_count !== null && tweet.reply_count !== undefined ? tweet.reply_count / ageMinutes : null);
  const computedRepostsPerMin = repostsPerMin ?? (tweet.retweet_count !== null && tweet.retweet_count !== undefined ? tweet.retweet_count / ageMinutes : null);
  
  // Determine metrics status
  const finalMetricsStatus = metricsStatus || (tweet.like_count === null || tweet.like_count === undefined ? 'unknown' : 'known');
  
  // 🎯 HIGH-VALUE TIER ASSIGNMENT
  // Tier_S: Fresh + high engagement (age<=90 AND (likes>=500 OR likes_per_min>=8))
  // Tier_A: Good engagement (age<=180 AND (likes>=200 OR likes_per_min>=3))
  // Tier_B: Otherwise (or unknown metrics)
  let valueTier: 'S' | 'A' | 'B';
  if (finalMetricsStatus === 'unknown' || tweet.like_count === null || tweet.like_count === undefined) {
    // Unknown metrics -> Tier B
    valueTier = 'B';
  } else if (tweet.age_minutes <= 90 && (tweet.like_count >= 500 || (computedLikesPerMin !== null && computedLikesPerMin >= 8))) {
    valueTier = 'S';
  } else if (tweet.age_minutes <= 180 && (tweet.like_count >= 200 || (computedLikesPerMin !== null && computedLikesPerMin >= 3))) {
    valueTier = 'A';
  } else {
    valueTier = 'B';
  }
  
  // Calculate score (views-first)
  const baseMetric = tweet.view_count || tweet.like_count;
  const freshnessMultiplier = tweet.age_minutes < 30 ? 2.0 :
                               tweet.age_minutes < 60 ? 1.5 :
                               tweet.age_minutes < 180 ? 1.0 :
                               tweet.age_minutes < 720 ? 0.7 : 0.5;
  
  const velocityMultiplier = Math.min(Math.max(tweet.velocity / 10, 0.8), 2.0);
  const qualityMultiplier = quality.multiplier;
  
  // Boost score for high-value tiers
  const tierMultiplier = valueTier === 'S' ? 2.0 : valueTier === 'A' ? 1.5 : 1.0;
  
  const score = baseMetric * freshnessMultiplier * velocityMultiplier * qualityMultiplier * tierMultiplier;
  
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
      tier: valueTier, // Use high-value tier (S/A/B)
      harvest_tier: tier, // Keep original harvest tier (A+/A/B/C/D)
      likes_per_min: likesPerMin,
      replies_per_min: repliesPerMin,
      reposts_per_min: repostsPerMin,
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

