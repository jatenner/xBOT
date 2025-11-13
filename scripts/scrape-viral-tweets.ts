#!/usr/bin/env tsx
/**
 * VIRAL TWEET SCRAPER - Implementation Script
 * 
 * Scrapes high-performing tweets from Twitter using Playwright
 * Runs periodically to keep viral tweet library fresh
 * 
 * Usage:
 *   pnpm tsx scripts/scrape-viral-tweets.ts [--category health] [--max 100]
 */

import { chromium } from 'playwright';
import { getViralScraper, ViralTweet } from '../src/scraper/viralTweetScraper';

interface ScrapeOptions {
  category?: string;
  maxTweets?: number;
  minViews?: number;
  sources?: string[]; // Accounts to scrape from
}

async function scrapeViralTweets(options: ScrapeOptions = {}) {
  const {
    category = 'health',
    maxTweets = 100,
    minViews = 50000,
    sources = []
  } = options;
  
  console.log('🚀 VIRAL TWEET SCRAPER');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Category: ${category}`);
  console.log(`Target: ${maxTweets} tweets`);
  console.log(`Min views: ${minViews.toLocaleString()}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const browser = await chromium.launch({
    headless: false // Can see what's happening
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1024 }
  });
  
  const page = await context.newPage();
  
  const scrapedTweets: ViralTweet[] = [];
  
  try {
    // STRATEGY 1: Scrape from high-performing accounts
    const viralAccounts = [
      // Health/Science accounts with proven engagement
      'hubermanlab',      // Andrew Huberman - neuroscience
      'peterattiamd',     // Peter Attia - longevity
      'foundmyfitness',   // Rhonda Patrick - health science
      'kevinnbass',       // Kevin Bass - health research
      
      // General viral accounts (to learn format patterns)
      'CollinRugg',       // Master of viral formatting
      'waitbutwhy',       // Explanatory content
      'naval',            // Philosophical takes
      
      // Add custom sources
      ...sources
    ];
    
    console.log(`📋 Scraping from ${viralAccounts.length} accounts...\n`);
    
    for (const account of viralAccounts.slice(0, 5)) { // Start with first 5
      console.log(`👤 Scraping @${account}...`);
      
      await page.goto(`https://twitter.com/${account}`, {
        waitUntil: 'networkidle',
        timeout: 30000
      });
      
      await page.waitForTimeout(2000); // Let content load
      
      // Scroll to load more tweets
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await page.waitForTimeout(1000);
      }
      
      // Extract tweet data
      const tweets = await page.evaluate((minViews) => {
        const tweetElements = document.querySelectorAll('article[data-testid="tweet"]');
        const results: any[] = [];
        
        tweetElements.forEach(tweet => {
          try {
            // Get tweet text
            const textElement = tweet.querySelector('[data-testid="tweetText"]');
            const text = textElement?.textContent || '';
            
            // Get metrics
            const likeButton = tweet.querySelector('[data-testid="like"]');
            const retweetButton = tweet.querySelector('[data-testid="retweet"]');
            const replyButton = tweet.querySelector('[data-testid="reply"]');
            
            const normalizeCount = (value: string | null | undefined): number => {
              if (!value) return 0;
              const match = value.match(/[\d,]+/);
              if (!match) return 0;
              return parseInt(match[0].replace(/,/g, ''), 10);
            };

            const likes = normalizeCount(likeButton?.getAttribute('aria-label'));
            const retweets = normalizeCount(retweetButton?.getAttribute('aria-label'));
            const replies = normalizeCount(replyButton?.getAttribute('aria-label'));
            
            // Get tweet ID from link
            const linkElement = tweet.querySelector('a[href*="/status/"]');
            const tweetHref = linkElement?.getAttribute('href') || '';
            const tweetMatch = tweetHref.match(/status\/(\d+)/);
            const tweetId = tweetMatch ? tweetMatch[1] : '';
            
            // Rough views estimate (Twitter doesn't always show)
            // Use engagement as proxy: views ≈ likes * 50 (rough estimate)
            const estimatedViews = likes * 50;
            
            if (text && tweetId && estimatedViews >= minViews) {
              results.push({
                tweetId,
                text,
                likes,
                retweets,
                replies,
                views: estimatedViews
              });
            }
          } catch (e) {
            // Skip malformed tweets
          }
        });
        
        return results;
      }, minViews);
      
      console.log(`  ✅ Found ${tweets.length} tweets with ${minViews}+ views\n`);
      
      tweets.forEach((tweet: any) => {
        scrapedTweets.push({
          tweetId: tweet.tweetId,
          text: tweet.text,
          authorHandle: account,
          likes: tweet.likes,
          retweets: tweet.retweets,
          replies: tweet.replies,
          views: tweet.views,
          structure: 'single', // Will be updated if thread detected
          formattingPatterns: [],
          emojiCount: 0,
          characterCount: tweet.text.length,
          hasNumbers: /\d/.test(tweet.text),
          topicCategory: category,
          contentType: 'educational'
        });
      });
      
      if (scrapedTweets.length >= maxTweets) {
        console.log(`\n🎯 Reached target of ${maxTweets} tweets\n`);
        break;
      }
    }
    
    // STRATEGY 2: Could also scrape Twitter trending/explore page
    // (More complex, requires login and navigation)
    
    console.log(`\n📊 SCRAPING COMPLETE`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Total tweets: ${scrapedTweets.length}`);
    console.log(`Avg likes: ${Math.round(scrapedTweets.reduce((sum, t) => sum + t.likes, 0) / scrapedTweets.length)}`);
    console.log(`Avg views: ${Math.round(scrapedTweets.reduce((sum, t) => sum + t.views, 0) / scrapedTweets.length).toLocaleString()}`);
    
    // Store in database
    if (scrapedTweets.length > 0) {
      console.log(`\n💾 Storing tweets in database...`);
      const scraper = getViralScraper();
      await scraper.storeTweets(scrapedTweets);
      console.log(`✅ Tweets stored successfully\n`);
      
      // Show top patterns
      console.log(`\n📈 ANALYZING PATTERNS...`);
      const patterns = await scraper.getTopPatterns({ category });
      console.log(`\nTop 5 performing patterns:`);
      patterns.slice(0, 5).forEach((pattern, i) => {
        console.log(`${i + 1}. ${pattern.hookType || 'none'} + ${pattern.formattingPatterns.join(', ')}`);
        console.log(`   Engagement: ${(pattern.avgEngagement * 100).toFixed(2)}% | Samples: ${pattern.sampleSize}`);
      });
    }
    
  } catch (error: any) {
    console.error(`\n❌ Scraping error: ${error.message}`);
  } finally {
    await browser.close();
  }
  
  return scrapedTweets;
}

// Parse CLI arguments
const args = process.argv.slice(2);
const options: ScrapeOptions = {};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--category' && args[i + 1]) {
    options.category = args[i + 1];
    i++;
  } else if (args[i] === '--max' && args[i + 1]) {
    options.maxTweets = parseInt(args[i + 1]);
    i++;
  } else if (args[i] === '--min-views' && args[i + 1]) {
    options.minViews = parseInt(args[i + 1]);
    i++;
  }
}

// Run scraper
scrapeViralTweets(options)
  .then(() => {
    console.log('\n✅ Scraping complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Scraping failed:', error);
    process.exit(1);
  });

