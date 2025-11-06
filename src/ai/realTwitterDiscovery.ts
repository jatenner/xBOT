/**
 * REAL TWITTER DISCOVERY - Actual browser-based scraping
 * Replaces placeholder AI generation with real Twitter browsing
 */

import { UnifiedBrowserPool } from '../browser/UnifiedBrowserPool';
import { getSupabaseClient } from '../db';
import type { Page } from 'playwright';

export interface DiscoveredAccount {
  username: string;
  follower_count: number;
  following_count: number;
  tweet_count: number;
  bio: string;
  verified: boolean;
  discovery_method: 'hashtag' | 'network' | 'content' | 'follower_overlap';
  discovery_date: string;
  last_tweet_date?: string;
}

export interface ReplyOpportunity {
  account_username: string;
  tweet_id: string;
  tweet_url: string;
  tweet_content: string;
  tweet_author: string;
  reply_count: number;
  like_count: number;
  posted_minutes_ago: number;
  tweet_posted_at?: string; // ISO timestamp - needed for <24h filtering
  opportunity_score: number;
}

export class RealTwitterDiscovery {
  private static instance: RealTwitterDiscovery;
  
  private readonly HEALTH_ACCOUNTS = [
    'hubermanlab', 'peterattia', 'RhondaPatrick', 'drmarkhyman',
    'bengreenfieldhq', 'davidasinclair', 'foundmyfitness', 'LairdHamilton',
    'drdavinaguilera', 'drsten', 'DrLaPuma', 'WhitMD', 'KellyanneHulme'
  ];
  
  private readonly HEALTH_HASHTAGS = [
    'longevity', 'biohacking', 'nutrition', 'sleep', 'fitness',
    'wellness', 'health', 'neuroscience', 'exercise', 'fasting',
    'supplements', 'antiaging', 'healthspan', 'metabolichealth'
  ];

  private constructor() {}

  static getInstance(): RealTwitterDiscovery {
    if (!RealTwitterDiscovery.instance) {
      RealTwitterDiscovery.instance = new RealTwitterDiscovery();
    }
    return RealTwitterDiscovery.instance;
  }

  /**
   * Verify Twitter authentication
   */
  private async verifyAuth(page: Page): Promise<boolean> {
    try {
      // Navigate to Twitter homepage to activate session
      await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Wait for authenticated element with longer timeout (Twitter can be slow)
      await page.waitForSelector('[data-testid="SideNav_NewTweet_Button"]', { timeout: 30000 });
      
      console.log('[REAL_DISCOVERY] ✅ Authenticated session confirmed');
      return true;
    } catch (error: any) {
      console.error(`[REAL_DISCOVERY] ❌ Not authenticated - ${error.message}`);
      
      // Try alternative auth check
      try {
        const url = page.url();
        if (url.includes('/home') || url.includes('/compose')) {
          console.log('[REAL_DISCOVERY] ⚠️ On Twitter home, assuming authenticated despite missing button');
          return true;
        }
      } catch {}
      
      return false;
    }
  }

  /**
   * Discover accounts via Twitter search (REAL SCRAPING)
   * SMART BATCH FIX: Updated selectors + rate limiting + fallbacks
   */
  async discoverAccountsViaSearch(hashtag: string, limit: number = 10): Promise<DiscoveredAccount[]> {
    console.log(`[REAL_DISCOVERY] 🔍 Searching Twitter for #${hashtag}...`);
    
    const pool = UnifiedBrowserPool.getInstance();
    const page = await pool.acquirePage('hashtag_search');
    
    try {
      // 🔐 VERIFY AUTHENTICATION FIRST
      const isAuth = await this.verifyAuth(page);
      if (!isAuth) {
        console.error('[REAL_DISCOVERY] ⚠️ Skipping search - not authenticated');
        return [];
      }

      // SMART BATCH FIX: Use x.com and better search URL
      const searchUrl = `https://x.com/search?q=%23${hashtag}&src=typed_query&f=live`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // 🕐 GIVE TWITTER TIME TO LOAD
      await page.waitForTimeout(3000);
          
          // SMART BATCH FIX: Wait for tweets with multiple fallback selectors
          const tweetsLoaded = await Promise.race([
            page.waitForSelector('article[data-testid="tweet"]', { timeout: 15000 }).catch(() => null),
            page.waitForSelector('div[data-testid="cellInnerDiv"]', { timeout: 15000 }).catch(() => null),
            page.waitForSelector('article[role="article"]', { timeout: 15000 }).catch(() => null),
            page.waitForTimeout(10000).then(() => null)  // Give up after 10s
          ]);
          
          if (!tweetsLoaded) {
            console.warn(`[REAL_DISCOVERY] ⚠️ No tweets loaded for #${hashtag}`);
            return [];
          }
          
          // SMART BATCH FIX: Enhanced account extraction with multiple strategies
          const accounts = await page.evaluate(() => {
            const results: any[] = [];
            
            // Strategy 1: Try data-testid="tweet" articles
            let tweetElements = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
            
            // Strategy 2: Fallback to any articles
            if (tweetElements.length === 0) {
              tweetElements = Array.from(document.querySelectorAll('article[role="article"]'));
            }
            
            // Strategy 3: Fallback to cell divs
            if (tweetElements.length === 0) {
              tweetElements = Array.from(document.querySelectorAll('div[data-testid="cellInnerDiv"]'));
            }
            
            for (let i = 0; i < Math.min(tweetElements.length, 20); i++) {
              const tweet = tweetElements[i];
              
              // Multiple strategies to extract username
              let username = '';
              
              // Strategy A: User-Name testid
              const userNameEl = tweet.querySelector('[data-testid="User-Name"]');
              if (userNameEl) {
                const text = userNameEl.textContent || '';
                const matches = text.match(/@(\w+)/);
                if (matches && matches[1]) {
                  username = matches[1];
                }
              }
              
              // Strategy B: Profile link
              if (!username) {
                const profileLink = tweet.querySelector('a[href^="/"][href*="status"]');
                if (profileLink) {
                  const href = profileLink.getAttribute('href') || '';
                  const pathParts = href.split('/');
                  if (pathParts.length >= 2 && pathParts[1]) {
                    username = pathParts[1];
                  }
                }
              }
              
              // Strategy C: Any link with username pattern
              if (!username) {
                const links = tweet.querySelectorAll('a[href^="/"]');
                // Convert NodeList to Array for iteration
                for (const link of Array.from(links)) {
                  const href = link.getAttribute('href') || '';
                  const match = href.match(/^\/([a-zA-Z0-9_]+)$/);
                  if (match && match[1] && !match[1].includes('status')) {
                    username = match[1];
                    break;
                  }
                }
              }
              
              if (username && username !== 'home' && username !== 'search' && username !== 'notifications') {
                results.push({
                  username: username,
                  discovery_method: 'hashtag'
                });
              }
            }
            
            // Remove duplicates
            const unique = results.filter((item, index, arr) => 
              arr.findIndex(other => other.username === item.username) === index
            );
            
            return unique;
          });
          
          console.log(`[REAL_DISCOVERY] ✅ Found ${accounts.length} accounts for #${hashtag}`);
          
          // SMART BATCH FIX: Rate limit between account detail fetches
          const discovered: DiscoveredAccount[] = [];
          for (const account of accounts.slice(0, limit)) {
            try {
              const details = await this.getAccountDetails(page, account.username);
              if (details) {
                discovered.push({
                  ...details,
                  discovery_method: 'hashtag',
                  discovery_date: new Date().toISOString()
                });
              }
              
              // Rate limit: 3 seconds between account fetches
              await new Promise(resolve => setTimeout(resolve, 3000));
              
            } catch (err) {
              console.warn(`[REAL_DISCOVERY] ⚠️ Failed to get details for @${account.username}`);
              continue;
            }
          }
          
          return discovered;
          
    } catch (error: any) {
      console.error(`[REAL_DISCOVERY] ❌ Search failed for #${hashtag}:`, error.message);
      return [];
    } finally {
      await pool.releasePage(page);
    }
  }

  /**
   * Discover reply opportunities from an account (REAL SCRAPING)
   * 
   * @param username - Twitter username to scrape
   * @param accountFollowers - Follower count of the account (for engagement rate calculation)
   * @param accountEngagementRate - Optional known engagement rate for the account
   */
  async findReplyOpportunitiesFromAccount(
    username: string, 
    accountFollowers: number = 0,
    accountEngagementRate?: number
  ): Promise<ReplyOpportunity[]> {
    console.log(`[REAL_DISCOVERY] 🎯 Finding reply opportunities from @${username} (${accountFollowers.toLocaleString()} followers)...`);
    
    const pool = UnifiedBrowserPool.getInstance();
    const page = await pool.acquirePage('timeline_scrape');
    
    try {
      // 🔐 VERIFY AUTHENTICATION FIRST
      const isAuth = await this.verifyAuth(page);
      if (!isAuth) {
        console.error(`[REAL_DISCOVERY] ⚠️ Skipping @${username} - not authenticated`);
        return [];
      }

      // Navigate to account timeline - FIXED: x.com + domcontentloaded
      await page.goto(`https://x.com/${username}`, { 
        waitUntil: 'domcontentloaded', 
        timeout: 30000 
      });
      
      // 🕐 GIVE TWITTER TIME TO LOAD
      await page.waitForTimeout(3000);
          
          // Extract recent tweets (FILTER OLD TWEETS IMMEDIATELY - permanent fix)
          const opportunities = await page.evaluate(() => {
            const results: any[] = [];
            const tweetElements = document.querySelectorAll('article[data-testid="tweet"]');
            const NOW = Date.now();
            const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
            let oldTweetsSkipped = 0;
            let noTimestampSkipped = 0;
            
            // 🔥 MEGA-IMPACT: Extract up to 40 tweets per account (more = catch viral tweets)
            // For mega-accounts (1M+), viral tweets might be further down timeline
            for (let i = 0; i < Math.min(tweetElements.length, 40); i++) {
              const tweet = tweetElements[i];
              
              // ⏰ PRE-FILTER: Check age FIRST (before extracting everything)
              const timeEl = tweet.querySelector('time');
              const datetime = timeEl?.getAttribute('datetime') || '';
              if (!datetime) {
                noTimestampSkipped++;
                continue; // Skip if no timestamp
              }
              
              const tweetTime = new Date(datetime).getTime();
              const ageMs = NOW - tweetTime;
              if (ageMs > MAX_AGE_MS) {
                oldTweetsSkipped++;
                continue; // Skip tweets older than 24 hours
              }
              
              // Now extract full data (only for recent tweets)
              
              // Get tweet content
              const contentEl = tweet.querySelector('[data-testid="tweetText"]');
              const content = contentEl?.textContent || '';
              
              // Get tweet link
              const linkEl = tweet.querySelector('a[href*="/status/"]');
              const href = linkEl?.getAttribute('href') || '';
              const match = href.match(/\/status\/(\d+)/);
              const tweetId = match ? match[1] : '';
              
              // Calculate minutes ago (we already have tweetTime from pre-filter)
              const postedMinutesAgo = Math.floor(ageMs / 60000);
              
              // Get engagement metrics - MULTI-STRATEGY FALLBACK (permanent fix)
              // Strategy 1: data-testid selectors (primary)
              let likeEl = tweet.querySelector('[data-testid="like"]');
              let replyEl = tweet.querySelector('[data-testid="reply"]');
              
              // Strategy 2: aria-label fallback (if testid fails)
              if (!likeEl) {
                likeEl = tweet.querySelector('[aria-label*="like"]') || 
                         tweet.querySelector('[data-testid="unlike"]'); // Liked tweets show "unlike"
              }
              if (!replyEl) {
                replyEl = tweet.querySelector('[aria-label*="repl"]');
              }
              
              // Strategy 3: SVG icon parents (last resort)
              if (!likeEl) {
                const likeSvg = tweet.querySelector('svg[viewBox="0 0 24 24"] path[d*="M20.884"]'); // Heart icon path
                likeEl = likeSvg?.closest('div[role="group"]')?.querySelector('span');
              }
              if (!replyEl) {
                const replySvg = tweet.querySelector('svg[viewBox="0 0 24 24"] path[d*="M1.751"]'); // Reply icon path
                replyEl = replySvg?.closest('div[role="group"]')?.querySelector('span');
              }
              
              const replyText = replyEl?.textContent || '0';
              const likeText = likeEl?.textContent || '0';
              
              // Robust number parsing (handles "1.2K", "5M", etc)
              const parseEngagement = (text: string): number => {
                if (!text || text === '0') return 0;
                const clean = text.trim().toUpperCase();
                if (clean.includes('K')) return Math.floor(parseFloat(clean) * 1000);
                if (clean.includes('M')) return Math.floor(parseFloat(clean) * 1000000);
                return parseInt(clean.replace(/[^\d]/g, '')) || 0;
              };
              
              const replyCount = parseEngagement(replyText);
              const likeCount = parseEngagement(likeText);
              
              // 🔍 VALIDATION: Log if engagement extraction failed (diagnostic)
              if (likeCount === 0 && replyCount === 0) {
                // Tweet might be loading or selectors changed
                // Don't log every time, but track failures
                if (Math.random() < 0.1) { // 10% sample
                  console.log(`[REAL_DISCOVERY] ⚠️ Zero engagement extracted - selectors may need update`);
                }
              }
              
              // Get author
              const authorEl = tweet.querySelector('[data-testid="User-Name"]');
              const authorMatch = (authorEl?.textContent || '').match(/@(\w+)/);
              const author = authorMatch ? authorMatch[1] : '';
              
            // ENGAGEMENT RATE BASED FILTERING (no absolute like counts!)
            const hasContent = content.length > 20;
            const noLinks = !content.includes('bit.ly') && !content.includes('amzn');
            
            // Pass through all tweets with basic filters
            // Tier filtering happens in the next step with engagement rate
            if (hasContent && noLinks && tweetId && author) {
              results.push({
                tweet_id: tweetId,
                tweet_url: `https://x.com/${author}/status/${tweetId}`,
                tweet_content: content,
                tweet_author: author,
                reply_count: replyCount,
                like_count: likeCount,
                posted_minutes_ago: postedMinutesAgo // 🕐 REAL timestamp!
              });
            }
            }
            
            return { results, oldTweetsSkipped, noTimestampSkipped };
          });
          
          // Log filtering stats
          if (opportunities.oldTweetsSkipped > 0 || opportunities.noTimestampSkipped > 0) {
            console.log(`[REAL_DISCOVERY] 🕐 Filtered: ${opportunities.oldTweetsSkipped} old tweets (>24h), ${opportunities.noTimestampSkipped} no timestamp`);
          }
          
          // Extract just the results array
          const rawOpportunities = opportunities.results;
          
        console.log(`[REAL_DISCOVERY] ✅ Scraped ${rawOpportunities.length} raw tweets from @${username}`);
        
        // 🔍 DIAGNOSTIC: Log engagement stats for visibility
        if (rawOpportunities.length > 0) {
          const sample = rawOpportunities[0];
          const avgLikes = rawOpportunities.reduce((sum: number, o: any) => sum + o.like_count, 0) / rawOpportunities.length;
          const maxLikes = Math.max(...rawOpportunities.map((o: any) => o.like_count));
          console.log(`[REAL_DISCOVERY] 📊 Sample: ${sample.like_count} likes, ${sample.reply_count} replies, ${sample.posted_minutes_ago}min ago`);
          console.log(`[REAL_DISCOVERY] 📊 Stats: avg=${avgLikes.toFixed(1)} likes, max=${maxLikes} likes across ${rawOpportunities.length} tweets`);
        }
        
        // Calculate engagement rate and tier for each opportunity
        const { getReplyQualityScorer } = await import('../intelligence/replyQualityScorer');
        const scorer = getReplyQualityScorer();
        
        // 🎯 ADAPTIVE QUALITY FILTER (permanent fix)
        // First pass: Try standard thresholds
        const tieredOpportunities = rawOpportunities
          .map((opp: any) => {
            const engagementRate = scorer.calculateEngagementRate(opp.like_count, accountFollowers);
            const tier = scorer.calculateTier({
              like_count: opp.like_count,
              reply_count: opp.reply_count,
              posted_minutes_ago: opp.posted_minutes_ago,
              account_followers: accountFollowers
            });
            const momentum = scorer.calculateMomentum(opp.like_count, opp.posted_minutes_ago);
            
            return {
              ...opp,
              account_username: username,
              account_followers: accountFollowers,
              engagement_rate: engagementRate,
              tier: tier,
              momentum_score: momentum,
              opportunity_score: this.calculateOpportunityScore(opp.like_count, opp.reply_count),
              expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString() // 6 hours
            };
          });
        
        // 🔄 FALLBACK STRATEGY: If standard thresholds reject everything, use adaptive thresholds
        let qualifiedOpportunities = tieredOpportunities.filter((opp: any) => opp.tier !== null);
        
        if (qualifiedOpportunities.length === 0 && rawOpportunities.length > 0) {
          // No tweets met standard thresholds - use percentile-based approach
          const sortedByEngagement = [...tieredOpportunities].sort((a, b) => b.engagement_rate - a.engagement_rate);
          const top30Percent = Math.ceil(sortedByEngagement.length * 0.3);
          
          // Take top 30% and assign adaptive tiers
          qualifiedOpportunities = sortedByEngagement.slice(0, top30Percent).map((opp, idx) => {
            const percentile = idx / top30Percent;
            const adaptiveTier = percentile < 0.2 ? 'golden' : percentile < 0.5 ? 'good' : 'acceptable';
            return { ...opp, tier: adaptiveTier };
          });
          
          if (qualifiedOpportunities.length > 0) {
            console.log(`[REAL_DISCOVERY] 🔄 Adaptive thresholds: accepted top ${qualifiedOpportunities.length} tweets (standard thresholds too strict)`);
          }
        }
        
        // Log tier breakdown
        const golden = qualifiedOpportunities.filter(o => o.tier === 'golden').length;
        const good = qualifiedOpportunities.filter(o => o.tier === 'good').length;
        const acceptable = qualifiedOpportunities.filter(o => o.tier === 'acceptable').length;
        
        console.log(`[REAL_DISCOVERY] 🎯 Quality filtered: ${qualifiedOpportunities.length} opportunities (${golden} golden, ${good} good, ${acceptable} acceptable)`);
        
        return qualifiedOpportunities;
          
    } catch (error: any) {
      console.error(`[REAL_DISCOVERY] ❌ Failed to find opportunities from @${username}:`, error.message);
      return [];
    } finally {
      await pool.releasePage(page);
    }
  }

  /**
   * 🔥 MEGA-VIRAL SEARCH (UPGRADED STRATEGY)
   * 
   * NEW APPROACH:
   * 1. Search Twitter for ALL viral tweets (no topic filter)
   * 2. Scrape 50-200 viral tweets (any topic)
   * 3. AI filters for health relevance (GPT-4o-mini)
   * 4. Returns 10-50 high-quality health opportunities
   * 
   * This finds MORE health tweets than topic-based search because:
   * - Health tweets don't always contain keyword "health"
   * - AI understands context (e.g., "sleep quality" is health)
   * - Broader net = more viral health content discovered
   * 
   * @param minLikes - Minimum likes threshold (10k/25k/50k/100k/250k)
   * @param maxReplies - Maximum reply count to avoid buried replies
   * @param searchLabel - Label for logging (TITAN/ULTRA/MEGA/SUPER/HIGH)
   */
  async findViralTweetsViaSearch(
    minLikes: number,
    maxReplies: number,
    searchLabel: string = 'VIRAL',
    maxAgeHours: number = 24
  ): Promise<ReplyOpportunity[]> {
    console.log(`[REAL_DISCOVERY] 🔍 ${searchLabel} search: ${minLikes}+ likes, <${maxAgeHours}h old (broad - all topics)...`);
    
    const pool = UnifiedBrowserPool.getInstance();
    const page = await pool.acquirePage('search_scrape');
    
    try {
      // 🔐 VERIFY AUTHENTICATION FIRST
      const isAuth = await this.verifyAuth(page);
      if (!isAuth) {
        console.error(`[REAL_DISCOVERY] ⚠️ Skipping search - not authenticated`);
        return [];
      }

      // Build Twitter search URL with filters
      // min_faves:{minLikes} filters for tweets with minimum likes
      // -filter:replies excludes reply tweets (get original content)
      // lang:en filters for English
      // 🔥 MEGA-VIRAL STRATEGY: Keep high thresholds, strict health filtering
      // MINIMUM 10K likes enforced - we want MASSIVE reach only
      // 🔥 NO TOPIC FILTER! Search ALL viral tweets, AI filters for health after
      const encodedQuery = encodeURIComponent(`min_faves:${minLikes} -filter:replies lang:en`);
      const searchUrl = `https://x.com/search?q=${encodedQuery}&src=typed_query&f=live`;
      
      console.log(`[REAL_DISCOVERY] 🌐 Navigating to search: ${searchUrl}`);
      await page.goto(searchUrl, { 
        waitUntil: 'domcontentloaded', 
        timeout: 30000 
      });
      
      // 🕐 GIVE TWITTER TIME TO LOAD
      await page.waitForTimeout(5000); // Longer for search results
      
      // Extract viral tweets from search results
      const opportunities = await page.evaluate(({ maxReplies, maxAgeHours }: { maxReplies: number, maxAgeHours: number }) => {
        const results: any[] = [];
        const tweetElements = document.querySelectorAll('article[data-testid="tweet"]');
        const NOW = Date.now();
        const MAX_AGE_MS = maxAgeHours * 60 * 60 * 1000; // Dynamic age limit
        
        // 🏥 HEALTH KEYWORD PATTERNS (for both bio and content relevance checking)
        const healthKeywords = {
          primary: ['health', 'wellness', 'fitness', 'nutrition', 'longevity', 'biohacking', 'medical', 'doctor', 'dr.'],
          secondary: ['supplement', 'diet', 'exercise', 'sleep', 'workout', 'protein', 'vitamin', 'gut', 'brain', 'hormone'],
          scientific: ['study', 'research', 'science', 'clinical', 'trial', 'evidence', 'mechanism', 'pathway']
        };
        
        // Helper: Check if text contains health keywords
        const getHealthScore = (text: string): number => {
          const lower = text.toLowerCase();
          let score = 0;
          
          // Count keyword occurrences
          healthKeywords.primary.forEach(kw => {
            if (lower.includes(kw)) score += 3;
          });
          healthKeywords.secondary.forEach(kw => {
            if (lower.includes(kw)) score += 2;
          });
          healthKeywords.scientific.forEach(kw => {
            if (lower.includes(kw)) score += 1;
          });
          
          return score;
        };
        
        // Extract up to 50 tweets from search results
        for (let i = 0; i < Math.min(tweetElements.length, 50); i++) {
          const tweet = tweetElements[i];
          
          // Get timestamp
          const timeEl = tweet.querySelector('time');
          const datetime = timeEl?.getAttribute('datetime') || '';
          if (!datetime) continue; // Skip if no timestamp
          
          const tweetTime = new Date(datetime).getTime();
          const ageMs = NOW - tweetTime;
          if (ageMs > MAX_AGE_MS) continue; // Skip if older than age limit
          
          const tweetPostedAt = datetime; // Save for later use
          
          // Get tweet content
          const contentEl = tweet.querySelector('[data-testid="tweetText"]');
          const content = contentEl?.textContent || '';
          
          // Get tweet link and ID
          const linkEl = tweet.querySelector('a[href*="/status/"]');
          const href = linkEl?.getAttribute('href') || '';
          const match = href.match(/\/status\/(\d+)/);
          const tweetId = match ? match[1] : '';
          
          // Get engagement metrics
          const likeEl = tweet.querySelector('[data-testid="like"]') || 
                         tweet.querySelector('[data-testid="unlike"]');
          const replyEl = tweet.querySelector('[data-testid="reply"]');
          
          const likeText = likeEl?.textContent || '0';
          const replyText = replyEl?.textContent || '0';
          
          // Parse engagement (handles "1.2K", "5M", etc)
          const parseEngagement = (text: string): number => {
            if (!text || text === '0') return 0;
            const clean = text.trim().toUpperCase();
            if (clean.includes('K')) return Math.floor(parseFloat(clean) * 1000);
            if (clean.includes('M')) return Math.floor(parseFloat(clean) * 1000000);
            return parseInt(clean.replace(/[^\d]/g, '')) || 0;
          };
          
          const likeCount = parseEngagement(likeText);
          const replyCount = parseEngagement(replyText);
          const postedMinutesAgo = Math.floor(ageMs / 60000);
          
          // Get author and bio
          const authorEl = tweet.querySelector('[data-testid="User-Name"]');
          const authorMatch = (authorEl?.textContent || '').match(/@(\w+)/);
          const author = authorMatch ? authorMatch[1] : '';
          
          // Try to get account bio from the tweet's author section
          // Bio isn't always visible in timeline, but we can check author name/handle for health indicators
          const authorName = authorEl?.textContent?.split('@')[0]?.trim() || '';
          const displayText = `${authorName} ${author}`.toLowerCase();
          
          // 🔥 NEW STRATEGY: NO HEALTH FILTERING IN BROWSER!
          // We scrape ALL viral tweets, AI filters for health AFTER
          
          // Basic filters only
          const hasContent = content.length > 20;
          const noLinks = !content.includes('bit.ly') && !content.includes('amzn');
          const notTooManyReplies = replyCount < maxReplies;
          const meetsMinimumEngagement = likeCount >= minLikes; // ✅ FIXED: Use parameter, not hardcoded!
          
          if (hasContent && noLinks && notTooManyReplies && meetsMinimumEngagement && tweetId && author) {
            results.push({
              tweet_id: tweetId,
              tweet_url: `https://x.com/${author}/status/${tweetId}`,
              tweet_content: content,
              tweet_author: author,
              author_name: authorName, // For AI judging
              reply_count: replyCount,
              like_count: likeCount,
              posted_minutes_ago: postedMinutesAgo,
              tweet_posted_at: tweetPostedAt // ✅ FIXED: Add timestamp
            });
          }
        }
        
        return results;
      }, { maxReplies, maxAgeHours }) as any[];
      
      console.log(`[REAL_DISCOVERY] ✅ Scraped ${opportunities.length} viral tweets (all topics)`);
      
      if (opportunities.length === 0) {
        console.log('[REAL_DISCOVERY] ⚠️ No viral tweets found in search');
        return [];
      }
      
      // 🧠 AI HEALTH FILTERING (NEW!)
      console.log(`[REAL_DISCOVERY] 🧠 AI filtering for health relevance...`);
      const { healthContentJudge } = await import('./healthContentJudge');
      
      const judgments = await healthContentJudge.batchJudge(
        opportunities.map(opp => ({
          content: opp.tweet_content,
          author: opp.tweet_author,
          authorBio: opp.author_name
        }))
      );
      
      // Filter for health-relevant only (score >= 6)
      const healthOpportunities = opportunities
        .map((opp, index) => ({
          ...opp,
          health_relevance_score: judgments[index].score,
          health_category: judgments[index].category,
          ai_judge_reason: judgments[index].reason
        }))
        .filter((opp, index) => judgments[index].isHealthRelevant);
      
      console.log(`[REAL_DISCOVERY] ✅ AI filtered: ${healthOpportunities.length}/${opportunities.length} health-relevant (${Math.round(healthOpportunities.length/opportunities.length*100)}%)`);
      
      if (healthOpportunities.length === 0) {
        console.log('[REAL_DISCOVERY] ⚠️ No health-relevant tweets found after AI filtering');
        return [];
      }
      
      // Log health category breakdown
      const categories: Record<string, number> = {};
      healthOpportunities.forEach(opp => {
        categories[opp.health_category] = (categories[opp.health_category] || 0) + 1;
      });
      console.log(`[REAL_DISCOVERY] 📊 Categories: ${Object.entries(categories).map(([cat, count]) => `${cat}:${count}`).join(', ')}`);
      
      // ✅ FIXED: Calculate NEW tier names based on like_count
      const calculateTierFromLikes = (likes: number): string => {
        if (likes >= 100000) return 'MEGA+';
        if (likes >= 50000) return 'MEGA';
        if (likes >= 25000) return 'VIRAL+';
        if (likes >= 10000) return 'VIRAL';
        if (likes >= 5000) return 'TRENDING+';
        if (likes >= 2000) return 'TRENDING';
        if (likes >= 1000) return 'FRESH+';
        return 'FRESH'; // 500-999 likes
      };
      
      const tieredOpportunities = healthOpportunities
        .map((opp: any) => {
          const tier = calculateTierFromLikes(opp.like_count);
          const momentum = opp.like_count / Math.max(opp.posted_minutes_ago, 1);
          
          return {
            ...opp,
            account_username: 'viral_search', // Mark as from search
            tier: tier,
            momentum_score: momentum,
            opportunity_score: this.calculateOpportunityScore(opp.like_count, opp.reply_count),
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // ✅ FIXED: 24 hours
            health_relevance_score: opp.health_relevance_score
          };
        });
      
      console.log(`[REAL_DISCOVERY] 🎯 Qualified ${tieredOpportunities.length} opportunities after tier assignment`);
      
      // ✅ FIXED: Log NEW tier breakdown
      const mega = tieredOpportunities.filter((o: any) => o.tier?.startsWith('MEGA')).length;
      const viral = tieredOpportunities.filter((o: any) => o.tier?.startsWith('VIRAL')).length;
      const trending = tieredOpportunities.filter((o: any) => o.tier?.startsWith('TRENDING')).length;
      const fresh = tieredOpportunities.filter((o: any) => o.tier?.startsWith('FRESH')).length;
      console.log(`[REAL_DISCOVERY]   💎 ${mega} MEGA, 🚀 ${viral} VIRAL, ⚡ ${trending} TRENDING, 🔥 ${fresh} FRESH`);
      
      return tieredOpportunities;
      
    } catch (error: any) {
      console.error(`[REAL_DISCOVERY] ❌ ${searchLabel} search failed:`, error.message);
      return [];
    } finally {
      await pool.releasePage(page);
    }
  }

  /**
   * Get full account details (REAL SCRAPING)
   */
  private async getAccountDetails(page: Page, username: string): Promise<DiscoveredAccount | null> {
    try {
      await page.goto(`https://x.com/${username}`, { 
        waitUntil: 'domcontentloaded', 
        timeout: 20000 
      });
      await page.waitForTimeout(2000);
      
      const details = await page.evaluate(() => {
        // Extract follower count
        const followerLinkEl = document.querySelector('a[href$="/verified_followers"]');
        const followerText = followerLinkEl?.textContent || '0';
        const followerMatch = followerText.match(/([\d.]+)([KMB]?)/);
        let followers = 0;
        if (followerMatch) {
          const num = parseFloat(followerMatch[1]);
          const multiplier = followerMatch[2];
          followers = multiplier === 'K' ? num * 1000 :
                     multiplier === 'M' ? num * 1000000 :
                     multiplier === 'B' ? num * 1000000000 : num;
        }
        
        // Extract bio
        const bioEl = document.querySelector('[data-testid="UserDescription"]');
        const bio = bioEl?.textContent || '';
        
        // Check if verified
        const verified = !!document.querySelector('[data-testid="icon-verified"]');
        
        return {
          follower_count: Math.round(followers),
          following_count: 0,
          tweet_count: 0,
          bio,
          verified
        };
      });
      
      return {
        username,
        ...details,
        discovery_method: 'content',
        discovery_date: new Date().toISOString()
      };
      
    } catch (error: any) {
      console.error(`[REAL_DISCOVERY] ⚠️ Could not get details for @${username}:`, error.message);
      return null;
    }
  }

  /**
   * Calculate opportunity score for a tweet
   */
  private calculateOpportunityScore(likes: number, replies: number): number {
    // High likes + low replies = best opportunity (high visibility, low competition)
    const engagementScore = Math.min(likes / 100, 50); // Max 50 points
    const competitionScore = Math.max(50 - (replies / 2), 0); // Max 50 points
    return Math.min(engagementScore + competitionScore, 100);
  }

  /**
   * Batch discover accounts from health seed list
   */
  async discoverFromHealthAccounts(limit: number = 5): Promise<DiscoveredAccount[]> {
    console.log('[REAL_DISCOVERY] 🏥 Discovering from known health accounts...');
    
    const discovered: DiscoveredAccount[] = [];
    
    for (const username of this.HEALTH_ACCOUNTS.slice(0, limit)) {
      try {
        const account = await this.getAccountDetailsStandalone(username);
        if (account) {
          discovered.push({
            ...account,
            discovery_method: 'content',
            discovery_date: new Date().toISOString()
          });
        }
        
        // Small delay between accounts
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`[REAL_DISCOVERY] ⚠️ Failed to discover @${username}`);
      }
    }
    
    console.log(`[REAL_DISCOVERY] ✅ Discovered ${discovered.length} accounts from health seed list`);
    return discovered;
  }

  /**
   * Standalone method to get account details with its own page
   * PUBLIC: Used by accountDiscovery to scrape fallback accounts
   */
  public async getAccountDetailsStandalone(username: string): Promise<DiscoveredAccount | null> {
    const pool = UnifiedBrowserPool.getInstance();
    const page = await pool.acquirePage('account_details');
    
    try {
      return await this.getAccountDetails(page, username);
    } catch (error) {
      return null;
    } finally {
      await pool.releasePage(page);
    }
  }

  /**
   * Store discovered accounts in database
   */
  async storeAccounts(accounts: DiscoveredAccount[]): Promise<void> {
    if (accounts.length === 0) return;
    
    const supabase = getSupabaseClient();
    
    for (const account of accounts) {
      try {
        await supabase
          .from('discovered_accounts')
          .upsert({
            username: account.username,
            follower_count: account.follower_count,
            following_count: account.following_count,
            tweet_count: account.tweet_count,
            bio: account.bio,
            verified: account.verified,
            discovery_method: account.discovery_method,
            discovery_date: account.discovery_date,
            last_updated: new Date().toISOString()
          }, {
            onConflict: 'username'
          });
      } catch (error: any) {
        console.error(`[REAL_DISCOVERY] ⚠️ Failed to store @${account.username}:`, error.message);
      }
    }
    
    console.log(`[REAL_DISCOVERY] 💾 Stored ${accounts.length} accounts in database`);
  }

  /**
   * Store reply opportunities in database
   */
  async storeOpportunities(opportunities: ReplyOpportunity[]): Promise<void> {
    if (opportunities.length === 0) return;
    
    const supabase = getSupabaseClient();
    
    for (const opp of opportunities) {
      try {
        // Calculate tweet_posted_at from posted_minutes_ago
        const tweetPostedAt = opp.posted_minutes_ago 
          ? new Date(Date.now() - opp.posted_minutes_ago * 60 * 1000).toISOString()
          : new Date().toISOString();
        
        await supabase
          .from('reply_opportunities')
          .upsert({
            // Core fields
            account_username: opp.account_username,
            target_username: opp.tweet_author,
            target_tweet_id: opp.tweet_id,
            target_tweet_url: opp.tweet_url,
            target_tweet_content: opp.tweet_content,
            reply_count: opp.reply_count,
            like_count: opp.like_count,
            posted_minutes_ago: opp.posted_minutes_ago,
            opportunity_score: opp.opportunity_score,
            tweet_posted_at: tweetPostedAt,
            status: 'pending',
            // NEW: Engagement rate & tiering
            engagement_rate: (opp as any).engagement_rate,
            tier: (opp as any).tier,
            momentum_score: (opp as any).momentum_score,
            account_followers: (opp as any).account_followers,
            expires_at: (opp as any).expires_at,
            replied_to: false,
            // 🧠 NEW: AI health judgment fields
            health_relevance_score: (opp as any).health_relevance_score,
            health_category: (opp as any).health_category,
            ai_judge_reason: (opp as any).ai_judge_reason
          }, {
            onConflict: 'target_tweet_id'
          });
      } catch (error: any) {
        console.error(`[REAL_DISCOVERY] ⚠️ Failed to store opportunity ${opp.tweet_id}:`, error.message);
      }
    }
    
    // Log tier breakdown
    const golden = opportunities.filter((o: any) => o.tier === 'golden').length;
    const good = opportunities.filter((o: any) => o.tier === 'good').length;
    const acceptable = opportunities.filter((o: any) => o.tier === 'acceptable').length;
    
    console.log(`[REAL_DISCOVERY] 💾 Stored ${opportunities.length} opportunities: ${golden} golden, ${good} good, ${acceptable} acceptable`);
  }
}

export const realTwitterDiscovery = RealTwitterDiscovery.getInstance();

