#!/usr/bin/env tsx
/**
 * 🌾 Profile-Based Harvester - Single Cycle
 * 
 * Harvests reply opportunities from curated account profiles instead of search.
 * This is the fallback when search is rate-limited or budget exhausted.
 * 
 * Usage:
 *   pnpm tsx scripts/ops/run-profile-harvester-single-cycle.ts
 */

import 'dotenv/config';
import { Page } from 'playwright';
import { UnifiedBrowserPool } from '../../src/browser/UnifiedBrowserPool';
import { getSupabaseClient } from '../../src/db/index';
import { useNavBudget } from '../../src/utils/budgetStore';
import * as path from 'path';
import * as fs from 'fs';

// Curated list of target accounts (can be moved to DB table later)
const TARGET_ACCOUNTS = [
  'hubermanlab',      // Health/science
  'PeterAttiaMD',     // Longevity
  'foundmyfitness',   // Health optimization
  'drjasonfung',      // Metabolic health
  'garytaubes',       // Nutrition science
  'drstephenphilips', // Health
  'DrDavidPerlmutter', // Brain health
  'DrMarkHyman',      // Functional medicine
  'DrAseemMalhotra',  // Cardiology
  'DrEricBerg',       // Health education
];

interface HarvestResult {
  mode: 'profile';
  accounts_visited: number;
  dom_cards: number;
  status_urls: number;
  inserted_rows: number;
  rate_limited: boolean;
  blocked_until: string | null;
  budgets_remaining: { nav: number; search: number };
  proof_artifacts: {
    screenshot?: string;
    html?: string;
  };
}

async function extractTweetsFromProfile(page: Page, maxTweets: number = 20): Promise<{
  tweets: Array<{
    tweet_id: string;
    tweet_url: string;
    author_handle: string;
    content: string;
    like_count: number | null;
    reply_count: number | null;
    retweet_count: number | null;
    posted_at: Date;
    is_reply: boolean;
  }>;
  domCards: number;
  statusUrls: number;
}> {
  // Wait for timeline to load
  await page.waitForTimeout(3000);
  
  // Scroll to trigger tweet rendering
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(1000);
  }
  
  const result = await page.evaluate((max) => {
    const tweetCards = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
    const tweets: any[] = [];
    const statusUrls = new Set<string>();
    
    for (let i = 0; i < Math.min(tweetCards.length, max); i++) {
      const card = tweetCards[i];
      
      // Extract tweet ID
      const tweetLink = card.querySelector('a[href*="/status/"]') as HTMLAnchorElement;
      if (!tweetLink) continue;
      
      const href = tweetLink.href;
      const match = href.match(/\/status\/(\d+)/);
      if (!match) continue;
      
      const tweet_id = match[1];
      statusUrls.add(tweet_id);
      
      // Extract content
      const textContainer = card.querySelector('[data-testid="tweetText"]');
      const content = textContainer?.textContent?.trim() || '';
      
      // Check if reply
      const isReply = card.textContent?.includes('Replying to') || false;
      
      // Extract author
      const authorLink = card.querySelector('a[href^="/"]') as HTMLAnchorElement;
      const authorHandle = authorLink?.href.match(/\.com\/([^/]+)/)?.[1] || '';
      
      // Extract metrics
      const replyButton = card.querySelector('[data-testid="reply"]');
      const likeButton = card.querySelector('[data-testid="like"]');
      const retweetButton = card.querySelector('[data-testid="retweet"]');
      
      let replyCount: number | null = null;
      let likeCount: number | null = null;
      let retweetCount: number | null = null;
      
      if (replyButton) {
        const ariaLabel = replyButton.getAttribute('aria-label') || '';
        const match = ariaLabel.match(/([\d,]+)/);
        if (match) replyCount = parseInt(match[1].replace(/,/g, '')) || null;
      }
      
      if (likeButton) {
        const ariaLabel = likeButton.getAttribute('aria-label') || '';
        const match = ariaLabel.match(/([\d,]+)/);
        if (match) likeCount = parseInt(match[1].replace(/,/g, '')) || null;
      }
      
      if (retweetButton) {
        const ariaLabel = retweetButton.getAttribute('aria-label') || '';
        const match = ariaLabel.match(/([\d,]+)/);
        if (match) retweetCount = parseInt(match[1].replace(/,/g, '')) || null;
      }
      
      // Extract timestamp
      const timeElement = card.querySelector('time');
      const datetime = timeElement?.getAttribute('datetime') || '';
      const posted_at = datetime ? new Date(datetime) : new Date();
      
      // Skip replies and low engagement tweets
      if (isReply || (likeCount !== null && likeCount < 100)) continue;
      
      tweets.push({
        tweet_id,
        tweet_url: href,
        author_handle: authorHandle,
        content,
        like_count: likeCount,
        reply_count: replyCount,
        retweet_count: retweetCount,
        posted_at: posted_at.toISOString(),
        is_reply: isReply,
      });
    }
    
    return {
      tweets,
      domCards: tweetCards.length,
      statusUrls: statusUrls.size,
    };
  }, maxTweets);
  
  return {
    tweets: result.tweets.map(t => ({
      ...t,
      posted_at: new Date(t.posted_at),
    })),
    domCards: result.domCards,
    statusUrls: result.statusUrls,
  };
}

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('        🌾 PROFILE-BASED HARVESTER - SINGLE CYCLE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const supabase = getSupabaseClient();
  const pool = UnifiedBrowserPool.getInstance();
  const result: HarvestResult = {
    mode: 'profile',
    accounts_visited: 0,
    dom_cards: 0,
    status_urls: 0,
    inserted_rows: 0,
    rate_limited: false,
    blocked_until: null,
    budgets_remaining: { nav: 0, search: 0 },
    proof_artifacts: {},
  };
  
  // Get budgets
  const { getBudgets } = await import('../../src/utils/budgetStore');
  const budgets = await getBudgets();
  result.budgets_remaining = { nav: budgets.navRemaining, search: budgets.searchRemaining };
  
  // Check if we have nav budget
  if (budgets.navRemaining < TARGET_ACCOUNTS.length) {
    console.log(`⚠️  Insufficient nav budget: ${budgets.navRemaining} < ${TARGET_ACCOUNTS.length}`);
    console.log(`   Skipping profile harvester (need ${TARGET_ACCOUNTS.length} nav budget)`);
    console.log(JSON.stringify(result));
    process.exit(0);
  }
  
  const page = await pool.acquirePage('profile_harvester');
  const proofDir = path.join(process.cwd(), 'docs', 'proofs', 'harvest', `profile-${Date.now()}`);
  fs.mkdirSync(proofDir, { recursive: true });
  
  try {
    let totalInserted = 0;
    let totalDomCards = 0;
    let totalStatusUrls = 0;
    
    for (const account of TARGET_ACCOUNTS.slice(0, Math.min(5, budgets.navRemaining))) {
      // Use nav budget
      const budgetUsed = await useNavBudget(1);
      if (!budgetUsed) {
        console.log(`⚠️  Budget exhausted, stopping at account ${account}`);
        break;
      }
      
      const profileUrl = `https://x.com/${account}`;
      console.log(`\n[PROFILE_HARVEST] 📍 Visiting @${account}...`);
      
      try {
        await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);
        
        const extraction = await extractTweetsFromProfile(page, 20);
        totalDomCards += extraction.domCards;
        totalStatusUrls += extraction.statusUrls;
        
        console.log(`[PROFILE_HARVEST]   Found ${extraction.tweets.length} tweets (${extraction.domCards} DOM cards, ${extraction.statusUrls} status URLs)`);
        
        // Store opportunities
        const opportunities = extraction.tweets.map(tweet => ({
          tweet_id: tweet.tweet_id,
          tweet_url: tweet.tweet_url,
          author_handle: tweet.author_handle,
          tweet_content: tweet.content,
          like_count: tweet.like_count,
          reply_count: tweet.reply_count,
          retweet_count: tweet.retweet_count,
          discovery_source: 'profile',
          replied_to: false,
          created_at: tweet.posted_at.toISOString(),
        }));
        
        if (opportunities.length > 0) {
          const { error } = await supabase
            .from('reply_opportunities')
            .upsert(opportunities, {
              onConflict: 'tweet_id',
              ignoreDuplicates: true,
            });
          
          if (error) {
            console.error(`[PROFILE_HARVEST]   ❌ DB error: ${error.message}`);
          } else {
            const inserted = opportunities.length;
            totalInserted += inserted;
            console.log(`[PROFILE_HARVEST]   ✅ Stored ${inserted} opportunities`);
          }
        }
        
        result.accounts_visited++;
        
        // Small delay between accounts
        await page.waitForTimeout(2000);
      } catch (error: any) {
        console.error(`[PROFILE_HARVEST]   ❌ Error visiting @${account}: ${error.message}`);
        
        // Check for rate limit
        if (error.message?.includes('429') || error.message?.includes('rate limit')) {
          result.rate_limited = true;
          const { set429 } = await import('../../src/utils/backoffStore');
          await set429('harvest_profile');
          break;
        }
      }
    }
    
    // Take proof screenshot
    try {
      const screenshotPath = path.join(proofDir, 'final.png');
      await page.screenshot({ path: screenshotPath, fullPage: false });
      result.proof_artifacts.screenshot = screenshotPath;
      
      const htmlPath = path.join(proofDir, 'final.html');
      const html = await page.content();
      fs.writeFileSync(htmlPath, html);
      result.proof_artifacts.html = htmlPath;
    } catch (e) {
      console.warn(`[PROFILE_HARVEST] Failed to save proof artifacts: ${e}`);
    }
    
    result.dom_cards = totalDomCards;
    result.status_urls = totalStatusUrls;
    result.inserted_rows = totalInserted;
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                    RESULT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(JSON.stringify(result));
    
  } finally {
    await pool.releasePage(page);
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
