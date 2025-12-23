/**
 * 🎯 TWEET-BASED HARVESTER
 * 
 * Instead of scraping accounts, we search Twitter DIRECTLY for high-engagement tweets
 * No dependency on discovered_accounts - finds viral tweets from ANY account
 * 
 * Strategy:
 * 1. Search health hashtags/keywords on Twitter
 * 2. Twitter sorts by "Top" (most engaged tweets first)
 * 3. Scrape those tweets directly
 * 4. Filter by absolute engagement (2K+ likes OR 200+ comments)
 * 5. Store and reply
 */

import { UnifiedBrowserPool } from '../browser/UnifiedBrowserPool';
import { getSupabaseClient } from '../db';
import { realTwitterDiscovery } from '../ai/realTwitterDiscovery';
import type { Page } from 'playwright';

// BROAD MULTI-ANGLE SEARCH PATTERNS
// Strategy: Hit health Twitter from different angles to catch EVERYTHING
// Each search uses OR operators to cast wide net within that category
const BROAD_SEARCH_PATTERNS = [
  // Pattern 1: MAINSTREAM HEALTH (catches majority of conversations)
  '(health OR wellness OR fitness OR nutrition OR longevity) min_faves:800',
  
  // Pattern 2: DIET & NUTRITION (high-engagement category)
  '(diet OR keto OR carnivore OR vegan OR fasting OR weight loss) min_faves:700',
  
  // Pattern 3: OPTIMIZATION & BIOHACKING (engaged communities)
  '(biohacking OR longevity OR aging OR optimize OR performance) min_faves:700',
  
  // Pattern 4: FITNESS & TRAINING (large volume, fast moving)
  '(workout OR gym OR exercise OR training OR fitness OR muscle) min_faves:600',
  
  // Pattern 5: WELLNESS & MENTAL HEALTH (massive audience)
  '(sleep OR mental health OR anxiety OR stress OR meditation OR mindfulness) min_faves:600',
  
  // Pattern 6: SCIENCE & RESEARCH (quality insights)
  '(study OR research OR science OR protocol OR supplement OR vitamin OR clinical trial) min_faves:500',
  
  // Pattern 7: TRENDING HOT TOPICS (what\'s viral NOW)
  '(ozempic OR seed oils OR semaglutide OR testosterone OR gut health OR cortisol) min_faves:500'
];

// No rotation needed - search ALL patterns every cycle (only 7 searches, very fast)

interface TweetSearchResult {
  tweet_id: string;
  tweet_url: string;
  tweet_content: string;
  tweet_author: string;
  author_followers: number;
  like_count: number;
  reply_count: number;
  retweet_count: number;
  posted_minutes_ago: number;
}

/**
 * Search Twitter for high-engagement tweets on a specific topic
 */
async function searchTwitterForTweets(
  page: Page, 
  searchQuery: string
): Promise<TweetSearchResult[]> {
  console.log(`[TWEET_SEARCH] 🔍 Searching Twitter for "${searchQuery}"...`);
  
  try {
    // Search Twitter with "Top" filter (most engaged tweets first)
    const searchUrl = `https://x.com/search?q=${encodeURIComponent(searchQuery)}&src=typed_query&f=top`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Wait for tweets to load
    await page.waitForTimeout(4000);
    
    // 🚀 INCREASED SCROLLING: Load 15-20 tweets per topic (was 4-5)
    // 6 scrolls with staggered delays for smooth loading
    for (let scroll = 0; scroll < 6; scroll++) {
      await page.evaluate(() => window.scrollBy(0, 2000));
      await page.waitForTimeout(1500); // Reduced to 1.5s (was 2s) for efficiency
    }
    
    // Extract tweets with engagement data
    const tweets = await page.evaluate(() => {
      const results: any[] = [];
      const tweetElements = document.querySelectorAll('article[data-testid="tweet"]');
      const NOW = Date.now();
      const MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours - VISIBILITY FIX: Only fresh tweets get views
      
      // Extract up to 50 tweets from search results
      for (let i = 0; i < Math.min(tweetElements.length, 50); i++) {
        const tweet = tweetElements[i];
        
        // Get timestamp
        const timeEl = tweet.querySelector('time');
        const datetime = timeEl?.getAttribute('datetime') || '';
        if (!datetime) continue;
        
        const tweetTime = new Date(datetime).getTime();
        const ageMs = NOW - tweetTime;
        if (ageMs > MAX_AGE_MS) continue; // Skip >2h old
        
        // Get tweet ID and URL
        const linkEl = tweet.querySelector('a[href*="/status/"]');
        const href = linkEl?.getAttribute('href') || '';
        const match = href.match(/\/status\/(\d+)/);
        if (!match) continue;
        const tweetId = match[1];
        
        // Get author
        const authorEl = tweet.querySelector('[data-testid="User-Name"]');
        const authorText = authorEl?.textContent || '';
        const authorMatch = authorText.match(/@(\w+)/);
        const author = authorMatch ? authorMatch[1] : '';
        if (!author) continue;
        
        // Get content
        const contentEl = tweet.querySelector('[data-testid="tweetText"]');
        const content = contentEl?.textContent || '';
        if (content.length < 20) continue;
        
        // Get engagement metrics
        let likeEl = tweet.querySelector('[data-testid="like"]');
        let replyEl = tweet.querySelector('[data-testid="reply"]');
        let retweetEl = tweet.querySelector('[data-testid="retweet"]');
        
        // Fallback selectors
        if (!likeEl) likeEl = tweet.querySelector('[data-testid="unlike"]');
        if (!likeEl) likeEl = tweet.querySelector('[aria-label*="like"]');
        if (!replyEl) replyEl = tweet.querySelector('[aria-label*="repl"]');
        if (!retweetEl) retweetEl = tweet.querySelector('[aria-label*="repost"]');
        
        const parseEngagement = (el: Element | null): number => {
          if (!el) return 0;
          const text = el.textContent || '0';
          const clean = text.trim().toUpperCase();
          if (clean.includes('K')) return Math.floor(parseFloat(clean) * 1000);
          if (clean.includes('M')) return Math.floor(parseFloat(clean) * 1000000);
          return parseInt(clean.replace(/[^\d]/g, '')) || 0;
        };
        
        const likeCount = parseEngagement(likeEl);
        const replyCount = parseEngagement(replyEl);
        const retweetCount = parseEngagement(retweetEl);
        
              // Get author follower count (for context, but not for filtering!)
              // Note: Follower count is optional - we don't use it for filtering anymore
              let followerCount = 0;
              try {
                const followerSpans = authorEl?.querySelectorAll('span') || [];
                for (const span of Array.from(followerSpans)) {
                  const text = span.textContent || '';
                  if (text.toLowerCase().includes('follower')) {
                    const match = text.match(/([\d.]+)([KM]?)/);
                    if (match) {
                      const num = parseFloat(match[1]);
                      const multiplier = match[2] === 'K' ? 1000 : match[2] === 'M' ? 1000000 : 1;
                      followerCount = Math.floor(num * multiplier);
                      break;
                    }
                  }
                }
              } catch (e) {
                // Ignore follower count errors - it's optional
                followerCount = 0;
              }
        
        results.push({
          tweet_id: tweetId,
          tweet_url: `https://x.com/${author}/status/${tweetId}`,
          tweet_content: content,
          tweet_author: author,
          author_followers: followerCount,
          like_count: likeCount,
          reply_count: replyCount,
          retweet_count: retweetCount,
          posted_minutes_ago: Math.floor(ageMs / 60000)
        });
      }
      
      return results;
    });
    
    console.log(`[TWEET_SEARCH] ✅ Found ${tweets.length} tweets from search results`);
    
    // Log engagement distribution
    if (tweets.length > 0) {
      const maxLikes = Math.max(...tweets.map(t => t.like_count));
      const avgLikes = tweets.reduce((sum, t) => sum + t.like_count, 0) / tweets.length;
      console.log(`[TWEET_SEARCH] 📊 Engagement: avg=${Math.round(avgLikes)} likes, max=${maxLikes} likes`);
    }
    
    return tweets;
    
  } catch (error: any) {
    console.error(`[TWEET_SEARCH] ❌ Search failed for "${searchQuery}":`, error.message);
    return [];
  }
}

/**
 * Main tweet-based harvester (runs every 15-30 min)
 */
export async function tweetBasedHarvester(): Promise<void> {
  console.log('[TWEET_HARVESTER] 🚀 Starting tweet-based harvesting...');
  
  try {
    const supabase = getSupabaseClient();
    
    // Step 1: Check current pool size
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const { count: currentOpportunities } = await supabase
      .from('reply_opportunities')
      .select('*', { count: 'exact', head: true })
      .gte('tweet_posted_at', twentyFourHoursAgo.toISOString());
    
    const poolSize = currentOpportunities || 0;
    console.log(`[TWEET_HARVESTER] 📊 Current pool: ${poolSize} opportunities (<24h old)`);
    
    // Step 2: Check if we need more opportunities
    const TARGET_POOL_SIZE = 250;
    
    if (poolSize >= TARGET_POOL_SIZE) {
      console.log(`[TWEET_HARVESTER] ✅ Pool is full (${poolSize}/${TARGET_POOL_SIZE}), skipping harvest`);
      return;
    }
    
    console.log(`[TWEET_HARVESTER] 🎯 Need ~${TARGET_POOL_SIZE - poolSize} more opportunities`);
    
    // Step 3: Search multiple topics in parallel (with semaphore protection)
    const { withBrowserLock, BrowserPriority } = await import('../browser/BrowserSemaphore');
    const pool = UnifiedBrowserPool.getInstance();
    
    // 🔒 BROWSER SEMAPHORE: Acquire browser lock for harvesting (priority 3)
    return await withBrowserLock('tweet_harvester', BrowserPriority.HARVESTING, async () => {
      let page = await pool.acquirePage('tweet_search');
      
      try {
      // 🔐 ROBUST AUTHENTICATION CHECK WITH FALLBACKS
      console.log('[TWEET_HARVESTER] 🔐 Checking authentication status...');
      
      // First, verify session is loaded by checking cookies
      const cookies = await page.context().cookies();
      console.log(`[TWEET_HARVESTER] 🍪 Session cookies loaded: ${cookies.length} cookies`);
      
      // Log cookie details for debugging
      const twitterCookies = cookies.filter(c => c.domain.includes('x.com') || c.domain.includes('twitter.com'));
      console.log(`[TWEET_HARVESTER] 🍪 Twitter-specific cookies: ${twitterCookies.length}`);
      
      if (twitterCookies.length === 0) {
        console.warn('[TWEET_HARVESTER] ⚠️ No Twitter cookies found - session may not be loaded properly');
      }
      
      // Try multiple authentication verification methods
      let isAuthenticated = false;
      let authMethod = '';
      
      // Method 1: Check for compose button (using same method as working realTwitterDiscovery)
      try {
        await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);
        
        // Check if we got redirected to login page
        const currentUrl = page.url();
        console.log(`[TWEET_HARVESTER] 🔍 Current URL after navigation: ${currentUrl}`);
        
        if (currentUrl.includes('/login') || currentUrl.includes('/i/flow/login')) {
          console.log('[TWEET_HARVESTER] ❌ Redirected to login page - session expired');
          throw new Error('Session expired - redirected to login');
        }
        
        // Use waitForSelector instead of isVisible for better reliability
        await page.waitForSelector('[data-testid="SideNav_NewTweet_Button"]', { timeout: 30000 });
        isAuthenticated = true;
        authMethod = 'compose_button';
        console.log('[TWEET_HARVESTER] ✅ Method 1: Compose button found');
      } catch (e) {
        console.log(`[TWEET_HARVESTER] ⚠️ Method 1 failed: ${e.message}, trying alternatives...`);
      }
      
      // Method 2: Check for user menu (alternative)
      if (!isAuthenticated) {
        try {
          await page.waitForSelector('[data-testid="SideNav_AccountSwitcher_Button"]', { timeout: 10000 });
          isAuthenticated = true;
          authMethod = 'user_menu';
          console.log('[TWEET_HARVESTER] ✅ Method 2: User menu found');
        } catch (e) {
          console.log('[TWEET_HARVESTER] ⚠️ Method 2 failed, trying public search...');
        }
      }
      
      // Method 3: Try public search (no auth required)
      if (!isAuthenticated) {
        try {
          console.log('[TWEET_HARVESTER] 🔍 Attempting public search (no authentication required)...');
          await page.goto('https://x.com/search?q=health&src=typed_query&f=live', { waitUntil: 'domcontentloaded', timeout: 15000 });
          await page.waitForTimeout(3000);
          
          // Check if we can see tweets (even without full auth)
          const tweetsVisible = await page.locator('article[data-testid="tweet"]').count() > 0;
          if (tweetsVisible) {
            isAuthenticated = true;
            authMethod = 'public_search';
            console.log('[TWEET_HARVESTER] ✅ Public search working - proceeding with limited access');
          }
        } catch (e) {
          console.log('[TWEET_HARVESTER] ⚠️ Public search also failed');
        }
      }
      
      if (!isAuthenticated) {
        console.error('[TWEET_HARVESTER] ❌ All authentication methods failed - cannot search');
        console.log('[TWEET_HARVESTER] 💡 This may be due to:');
        console.log('[TWEET_HARVESTER]   • Stale session cookies');
        console.log('[TWEET_HARVESTER]   • Twitter authentication changes');
        console.log('[TWEET_HARVESTER]   • Rate limiting or blocking');
        
        // 🔄 ATTEMPT SESSION REFRESH
        console.log('[TWEET_HARVESTER] 🔄 Attempting session refresh...');
        try {
          const { railwaySessionManager } = await import('../utils/railwaySessionManager');
          const refreshSuccess = await railwaySessionManager.refreshSession();
          if (refreshSuccess) {
            console.log('[TWEET_HARVESTER] ✅ Session refreshed, retrying authentication...');
            // Release current page and try again with fresh session
            await pool.releasePage(page);
            await pool.reloadSessionState();
            
            // Try one more time with fresh session
            const freshPage = await pool.acquirePage('tweet_search_fresh');
            try {
              await freshPage.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
              await freshPage.waitForTimeout(3000);
              await freshPage.waitForSelector('[data-testid="SideNav_NewTweet_Button"]', { timeout: 15000 });
              console.log('[TWEET_HARVESTER] ✅ Authentication successful after session refresh!');
              // Continue with fresh page
              page = freshPage;
              isAuthenticated = true;
              authMethod = 'session_refresh';
            } catch (retryError) {
              console.log('[TWEET_HARVESTER] ❌ Authentication still failed after session refresh');
              await pool.releasePage(freshPage);
            }
          }
        } catch (refreshError) {
          console.error('[TWEET_HARVESTER] ❌ Session refresh failed:', refreshError);
        }
        
        // If still not authenticated, try fallback harvester
        if (!isAuthenticated) {
          console.log('[TWEET_HARVESTER] 🔄 Attempting fallback to account-based harvester...');
          try {
            const { replyOpportunityHarvester } = await import('./replyOpportunityHarvester');
            await replyOpportunityHarvester();
            console.log('[TWEET_HARVESTER] ✅ Fallback harvester completed');
          } catch (fallbackError) {
            console.error('[TWEET_HARVESTER] ❌ Fallback harvester also failed:', fallbackError);
          }
          
          await pool.releasePage(page);
          return;
        }
      }
      
      console.log(`[TWEET_HARVESTER] ✅ Authenticated via ${authMethod} - starting multi-angle broad searches...`);
      
      const allTweets: TweetSearchResult[] = [];
      
      // ═══════════════════════════════════════════════════════════
      // MULTI-ANGLE BROAD SEARCH STRATEGY
      // Search 7 broad patterns that cover ALL of health Twitter
      // Each pattern catches a different angle/community
      // NO rotation needed - search all 7 every cycle (fast!)
      // ═══════════════════════════════════════════════════════════
      
      console.log(`[TWEET_HARVESTER] 🔍 Executing ${BROAD_SEARCH_PATTERNS.length} broad multi-angle searches...`);
      
      for (let i = 0; i < BROAD_SEARCH_PATTERNS.length; i++) {
        const pattern = BROAD_SEARCH_PATTERNS[i];
        console.log(`[TWEET_HARVESTER]   Search ${i + 1}/${BROAD_SEARCH_PATTERNS.length}: "${pattern.substring(0, 50)}..."`);
        
        const tweets = await searchTwitterForTweets(page, pattern);
        allTweets.push(...tweets);
        
        // Small delay between searches
        await page.waitForTimeout(2000);
      }
      
      // ═══════════════════════════════════════════════════════════
      // STRATEGY 3: TWITTER'S EXPLORE/TRENDING (find what's viral NOW)
      // ═══════════════════════════════════════════════════════════
      
      console.log('[TWEET_HARVESTER] 🔥 Checking Twitter Explore for trending health content...');
      try {
        await page.goto('https://x.com/explore', { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(3000);
        
        // Scrape trending tweets (Twitter curates these for high engagement!)
        const exploreTweets = await page.evaluate(() => {
          const results: any[] = [];
          const tweets = document.querySelectorAll('article[data-testid="tweet"]');
          
          for (let i = 0; i < Math.min(tweets.length, 30); i++) {
            const tweet = tweets[i];
            const contentEl = tweet.querySelector('[data-testid="tweetText"]');
            const content = contentEl?.textContent || '';
            
            // Only take health-related tweets
            const healthKeywords = /health|fitness|wellness|nutrition|longevity|diet|exercise|sleep|supplement|vitamin|gut|brain|mental|hormone|immune|aging|biohack/i;
            if (!healthKeywords.test(content)) continue;
            
            // Extract engagement and other data (same as before)
            const linkEl = tweet.querySelector('a[href*="/status/"]');
            const href = linkEl?.getAttribute('href') || '';
            const match = href.match(/\/status\/(\d+)/);
            if (!match) continue;
            
            // Get metrics...
            const likeEl = tweet.querySelector('[data-testid="like"]') || tweet.querySelector('[data-testid="unlike"]');
            const replyEl = tweet.querySelector('[data-testid="reply"]');
            
            const parseEng = (el: Element | null): number => {
              if (!el) return 0;
              const text = el.textContent || '0';
              const clean = text.trim().toUpperCase();
              if (clean.includes('K')) return Math.floor(parseFloat(clean) * 1000);
              if (clean.includes('M')) return Math.floor(parseFloat(clean) * 1000000);
              return parseInt(clean.replace(/[^\d]/g, '')) || 0;
            };
            
            const likes = parseEng(likeEl);
            const replies = parseEng(replyEl);
            
            // Extract author
            const authorEl = tweet.querySelector('[data-testid="User-Name"]');
            const authorMatch = (authorEl?.textContent || '').match(/@(\w+)/);
            const author = authorMatch ? authorMatch[1] : '';
            
            if (author && likes > 0) {
              results.push({
                tweet_id: match[1],
                tweet_url: `https://x.com/${author}/status/${match[1]}`,
                tweet_content: content,
                tweet_author: author,
                like_count: likes,
                reply_count: replies,
                author_followers: 0 // Don't care
              });
            }
          }
          
          return results;
        });
        
        console.log(`[TWEET_HARVESTER] 🔥 Found ${exploreTweets.length} health tweets from Explore`);
        allTweets.push(...exploreTweets);
        
      } catch (error: any) {
        console.warn('[TWEET_HARVESTER] ⚠️ Explore search failed:', error.message);
      }
      
      await pool.releasePage(page);
      
      console.log(`[TWEET_HARVESTER] 📊 Total tweets found: ${allTweets.length}`);
      
      // Step 4: Filter by engagement and tier
      const { getReplyQualityScorer } = await import('../intelligence/replyQualityScorer');
      const scorer = getReplyQualityScorer();
      
      const qualifiedTweets = allTweets
        .map(tweet => {
          const tier = scorer.calculateTier({
            like_count: tweet.like_count,
            reply_count: tweet.reply_count,
            posted_minutes_ago: tweet.posted_minutes_ago,
            account_followers: tweet.author_followers || 0
          });
          
          if (!tier) return null; // Doesn't qualify
          
          const engagementRate = tweet.author_followers > 0 
            ? tweet.like_count / tweet.author_followers 
            : 0;
          
          return {
            account_username: tweet.tweet_author,
            tweet_id: tweet.tweet_id,
            tweet_url: tweet.tweet_url,
            tweet_content: tweet.tweet_content,
            tweet_author: tweet.tweet_author,
            reply_count: tweet.reply_count,
            like_count: tweet.like_count,
            posted_minutes_ago: tweet.posted_minutes_ago,
            opportunity_score: scorer.calculateMomentum(tweet.like_count, tweet.posted_minutes_ago),
            tier,
            engagement_rate: engagementRate,
            account_followers: tweet.author_followers,
            expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
            replied_to: false
          };
        })
        .filter(Boolean);
      
      // Log tier breakdown
      const golden = qualifiedTweets.filter(t => t.tier === 'golden').length;
      const good = qualifiedTweets.filter(t => t.tier === 'good').length;
      const acceptable = qualifiedTweets.filter(t => t.tier === 'acceptable').length;
      
      console.log(`[TWEET_HARVESTER] 🎯 Qualified tweets: ${qualifiedTweets.length}`);
      console.log(`[TWEET_HARVESTER]   🏆 GOLDEN: ${golden} (800+ likes OR 80+ comments)`);
      console.log(`[TWEET_HARVESTER]   ✅ GOOD: ${good} (300+ likes OR 30+ comments)`);
      console.log(`[TWEET_HARVESTER]   📊 ACCEPTABLE: ${acceptable} (100+ likes OR 10+ comments)`);
      
      // Step 5: Store opportunities in database
      if (qualifiedTweets.length > 0) {
        await realTwitterDiscovery.storeOpportunities(qualifiedTweets as any);
        console.log(`[TWEET_HARVESTER] 💾 Stored ${qualifiedTweets.length} opportunities`);
      }
      
      // Step 6: Report stats
      const { count: finalPoolSize } = await supabase
        .from('reply_opportunities')
        .select('*', { count: 'exact', head: true })
        .gte('tweet_posted_at', twentyFourHoursAgo.toISOString());
      
        console.log(`[TWEET_HARVESTER] ✅ Pool size: ${poolSize} → ${finalPoolSize || 0}`);
        console.log(`[TWEET_HARVESTER] 🌾 Harvested: ${qualifiedTweets.length} from ${BROAD_SEARCH_PATTERNS.length + 1} multi-angle searches`);
        
      } catch (error: any) {
        await pool.releasePage(page);
        throw error;
      } finally {
        await pool.releasePage(page);
      }
    }); // End withBrowserLock
    
  } catch (error: any) {
    console.error('[TWEET_HARVESTER] ❌ Harvest failed:', error.message);
    throw error;
  }
}

