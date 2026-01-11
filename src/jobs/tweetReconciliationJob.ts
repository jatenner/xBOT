/**
 * 🔄 TWEET RECONCILIATION JOB
 * Daily job that finds and fixes missing tweets
 * Scrapes Twitter profile and matches against queued/failed posts
 */

import { getSupabaseClient } from '../db/index';
import { UnifiedBrowserPool } from '../browser/UnifiedBrowserPool';
import { createHash } from 'crypto';
import { log } from '../lib/logger';

const TWITTER_USERNAME = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
const MAX_TWEETS_TO_CHECK = 50; // Check last 50 tweets
const CONTENT_MATCH_THRESHOLD = 0.8; // 80% similarity required

interface TweetMatch {
  decisionId: string;
  tweetId: string;
  content: string;
  similarity: number;
}

export async function reconcileMissingTweets(): Promise<void> {
  console.log('[RECONCILIATION] 🔄 Starting tweet reconciliation job...');
  
  try {
    // Step 1: Get all posts from last 24 hours that might be missing
    const supabase = getSupabaseClient();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: suspiciousPosts, error: queryError } = await supabase
      .from('content_metadata')
      .select('decision_id, content, decision_type, status, created_at, tweet_id')
      .in('status', ['queued', 'posting', 'failed'])
      .gte('created_at', oneDayAgo)
      .is('tweet_id', null); // Only check posts without tweet_id
    
    if (queryError) {
      throw new Error(`Failed to query suspicious posts: ${queryError.message}`);
    }
    
    if (!suspiciousPosts || suspiciousPosts.length === 0) {
      console.log('[RECONCILIATION] ✅ No suspicious posts found - nothing to reconcile');
      return;
    }
    
    console.log(`[RECONCILIATION] 📋 Found ${suspiciousPosts.length} suspicious posts to check`);
    
    // Step 2: Scrape Twitter profile for recent tweets
    const recentTweets = await scrapeRecentTweets();
    
    if (recentTweets.length === 0) {
      console.log('[RECONCILIATION] ⚠️ No recent tweets found on profile - skipping reconciliation');
      return;
    }
    
    console.log(`[RECONCILIATION] 📊 Scraped ${recentTweets.length} recent tweets from profile`);
    
    // Step 3: Match suspicious posts with scraped tweets
    const matches: TweetMatch[] = [];
    
    for (const post of suspiciousPosts) {
      const postContent = String(post.content || '').trim();
      if (!postContent) continue;
      
      const postHash = createHash('md5').update(postContent.toLowerCase()).digest('hex');
      
      // Try to find matching tweet
      for (const tweet of recentTweets) {
        const similarity = calculateContentSimilarity(postContent, tweet.content);
        
        if (similarity >= CONTENT_MATCH_THRESHOLD) {
          matches.push({
            decisionId: post.decision_id,
            tweetId: tweet.tweetId,
            content: postContent,
            similarity
          });
          console.log(`[RECONCILIATION] ✅ Found match: decision_id=${post.decision_id}, tweet_id=${tweet.tweetId}, similarity=${(similarity * 100).toFixed(1)}%`);
          break; // Found match, move to next post
        }
      }
    }
    
    if (matches.length === 0) {
      console.log('[RECONCILIATION] ✅ No missing tweets found - all posts are correctly marked');
      return;
    }
    
    console.log(`[RECONCILIATION] 🎯 Found ${matches.length} missing tweets to recover`);
    
    // Step 4: Update database for matched tweets
    let successCount = 0;
    for (const match of matches) {
      try {
        const { error: updateError } = await supabase
          .from('content_metadata')
          .update({
            status: 'posted',
            tweet_id: match.tweetId,
            posted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('decision_id', match.decisionId);
        
        if (updateError) {
          throw updateError;
        }
        
        // Also update posted_decisions archive
        try {
          const { data: decisionData } = await supabase
            .from('content_metadata')
            .select('*')
            .eq('decision_id', match.decisionId)
            .single();
          
          if (decisionData) {
            await supabase
              .from('posted_decisions')
              .insert([{
                decision_id: decisionData.decision_id,
                content: decisionData.content,
                tweet_id: match.tweetId,
                decision_type: decisionData.decision_type || 'single',
                target_tweet_id: decisionData.target_tweet_id,
                target_username: decisionData.target_username,
                bandit_arm: decisionData.bandit_arm,
                timing_arm: decisionData.timing_arm,
                predicted_er: Math.min(1.0, Math.max(0.0, Number(decisionData.predicted_er) || 0)),
                quality_score: Math.min(1.0, Math.max(0.0, Number(decisionData.quality_score) || 0)),
                topic_cluster: decisionData.topic_cluster,
                posted_at: new Date().toISOString()
              }]);
          }
        } catch (archiveError: any) {
          // Archive update is best-effort
          console.warn(`[RECONCILIATION] ⚠️ Failed to update archive (non-critical): ${archiveError.message}`);
        }
        
        successCount++;
        console.log(`[RECONCILIATION] ✅ Recovered tweet: decision_id=${match.decisionId}, tweet_id=${match.tweetId}`);
      } catch (error: any) {
        console.error(`[RECONCILIATION] ❌ Failed to recover tweet ${match.decisionId}: ${error.message}`);
      }
    }
    
    log({ 
      op: 'tweet_reconciliation_complete', 
      suspicious_posts: suspiciousPosts.length,
      matches_found: matches.length,
      recovered: successCount 
    });
    
    console.log(`[RECONCILIATION] ✅ Reconciliation complete: ${successCount}/${matches.length} tweets recovered`);
  } catch (error: any) {
    console.error(`[RECONCILIATION] ❌ Reconciliation job failed: ${error.message}`);
    log({ op: 'tweet_reconciliation_error', error: error.message });
  }
}

async function scrapeRecentTweets(): Promise<Array<{ tweetId: string; content: string }>> {
  const browserPool = UnifiedBrowserPool.getInstance();
  
  return await browserPool.withContext('reconciliation', async (context) => {
    const page = await context.newPage();
    try {
      // Navigate to profile
      await page.goto(`https://x.com/${TWITTER_USERNAME}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      
      // Wait for timeline to load
      await page.waitForSelector('[data-testid="tweetText"]', { timeout: 15000 }).catch(() => null);
      
      // Scroll to load more tweets
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollBy(0, 1000));
        await page.waitForTimeout(2000);
      }
      
      // Extract tweet data
      const tweets = await page.evaluate(() => {
        const tweetElements = document.querySelectorAll('[data-testid="tweet"]');
        const results: Array<{ tweetId: string; content: string }> = [];
        
        for (const tweetEl of Array.from(tweetElements)) {
          try {
            // Extract tweet ID from link
            const linkEl = tweetEl.querySelector('a[href*="/status/"]');
            if (!linkEl) continue;
            
            const href = linkEl.getAttribute('href') || '';
            const tweetIdMatch = href.match(/\/status\/(\d+)/);
            if (!tweetIdMatch) continue;
            
            const tweetId = tweetIdMatch[1];
            
            // Extract content
            const textEl = tweetEl.querySelector('[data-testid="tweetText"]');
            const content = textEl?.textContent?.trim() || '';
            
            if (tweetId && content) {
              results.push({ tweetId, content });
            }
          } catch (e) {
            // Skip malformed tweets
          }
        }
        
        return results;
      });
      
      // Limit to most recent tweets
      return tweets.slice(0, MAX_TWEETS_TO_CHECK);
    } finally {
      await page.close();
    }
  });
}

function calculateContentSimilarity(content1: string, content2: string): number {
  const normalize = (text: string) => text.toLowerCase().trim().replace(/\s+/g, ' ');
  const norm1 = normalize(content1);
  const norm2 = normalize(content2);
  
  // Exact match
  if (norm1 === norm2) return 1.0;
  
  // Check if one contains the other (high similarity)
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    const shorter = Math.min(norm1.length, norm2.length);
    const longer = Math.max(norm1.length, norm2.length);
    return shorter / longer;
  }
  
  // Calculate Levenshtein similarity
  const distance = levenshteinDistance(norm1, norm2);
  const maxLength = Math.max(norm1.length, norm2.length);
  return maxLength > 0 ? 1 - (distance / maxLength) : 0;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}
