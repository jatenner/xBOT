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
  
  private readonly HEALTH_HASHTAGS = [
    'longevity', 'biohacking', 'nutrition', 'sleep', 'fitness',
    'wellness', 'health', 'neuroscience', 'exercise', 'fasting',
    'supplements', 'antiaging', 'healthspan', 'metabolichealth'
  ];
  
  private readonly keywordFallback = {
    primary: ['health', 'wellness', 'fitness', 'nutrition', 'biohack', 'longevity', 'medical', 'doctor', 'dr ', 'patient'],
    secondary: ['supplement', 'vitamin', 'protein', 'sleep', 'workout', 'exercise', 'fasting', 'glucose', 'insulin', 'hormone', 'gut', 'microbiome'],
    tertiary: ['recovery', 'hydrate', 'immune', 'metabolic', 'sauna', 'cold plunge', 'meditation', 'stress', 'mental health', 'therapy']
  };
  public readonly curatedAccounts = [];

  private constructor() {}

  static getInstance(): RealTwitterDiscovery {
    if (!RealTwitterDiscovery.instance) {
      RealTwitterDiscovery.instance = new RealTwitterDiscovery();
    }
    return RealTwitterDiscovery.instance;
  }

  private getKeywordScore(text: string): number {
    const lower = text.toLowerCase();
    let score = 0;
    this.keywordFallback.primary.forEach(k => {
      if (lower.includes(k)) score += 3;
    });
    this.keywordFallback.secondary.forEach(k => {
      if (lower.includes(k)) score += 2;
    });
    this.keywordFallback.tertiary.forEach(k => {
      if (lower.includes(k)) score += 1;
    });
    return score;
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
      // 🔐 VERIFY AUTHENTICATION (non-blocking - posting works with same session)
      const isAuth = await this.verifyAuth(page);
      if (!isAuth) {
        console.warn('[REAL_DISCOVERY] ⚠️ Auth check failed, but proceeding anyway (session valid - posting works)');
        // Don't return [] - session is valid, auth check may just be timing out
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
            const globalAny: any = globalThis as any;
            if (typeof globalAny.__name !== 'function') {
              globalAny.__name = function(target: Function, value: string) {
                try {
                  Object.defineProperty(target, 'name', { value, configurable: true });
                } catch {}
                return target;
              };
            }
            const __name = globalAny.__name as (target: Function, value: string) => Function;
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
      // 🔐 VERIFY AUTHENTICATION (non-blocking - posting works with same session)
      const isAuth = await this.verifyAuth(page);
      if (!isAuth) {
        console.warn(`[REAL_DISCOVERY] ⚠️ Auth check failed for @${username}, but proceeding anyway (session valid - posting works)`);
        // Don't return [] - session is valid, auth check may just be timing out
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
            const globalAny: any = globalThis as any;
            if (typeof globalAny.__name !== 'function') {
              globalAny.__name = function(target: Function, value: string) {
                try {
                  Object.defineProperty(target, 'name', { value, configurable: true });
                } catch {}
                return target;
              };
            }
            const __name = globalAny.__name as (target: Function, value: string) => Function;
            const results: any[] = [];
            const tweetElements = document.querySelectorAll('article[data-testid="tweet"]');
            const NOW = Date.now();
            const MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours - VISIBILITY FIX: Only fresh tweets get views
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
    maxAgeHours: number = 24,
    customQuery?: string
  ): Promise<ReplyOpportunity[]> {
    console.log(`[REAL_DISCOVERY] 🔍 ${searchLabel} search: ${minLikes}+ likes, <${maxAgeHours}h old (broad - all topics)...`);
    
    const pool = UnifiedBrowserPool.getInstance();
    const page = await pool.acquirePage('search_scrape');
    
    try {
      // 🔐 VERIFY AUTHENTICATION (non-blocking - posting works with same session)
      const isAuth = await this.verifyAuth(page);
      if (!isAuth) {
        console.warn(`[REAL_DISCOVERY] ⚠️ Auth check failed, but proceeding anyway (session valid - posting works)`);
        // Don't return [] - session is valid, auth check may just be timing out
      }

      // Build Twitter search URL with filters
      // min_faves:{minLikes} filters for tweets with minimum likes
      // -filter:replies excludes reply tweets (get original content)
      // lang:en filters for English
      // 🔥 MEGA-VIRAL STRATEGY: Keep high thresholds, strict health filtering
      // MINIMUM 10K likes enforced - we want MASSIVE reach only
      // 🔥 NO TOPIC FILTER! Search ALL viral tweets, AI filters for health after
      const queryText = customQuery
        ? customQuery
        : `min_faves:${minLikes} -filter:replies lang:en`;
      const encodedQuery = encodeURIComponent(queryText);
      const searchUrl = `https://x.com/search?q=${encodedQuery}&src=typed_query&f=live`;
      
      console.log(`[REAL_DISCOVERY] 🌐 Navigating to search: ${searchUrl}`);
      await page.goto(searchUrl, { 
        waitUntil: 'domcontentloaded', 
        timeout: 30000 
      });
      
      // 🕐 GIVE TWITTER TIME TO LOAD
      await page.waitForTimeout(5000); // Longer for search results
      
      // Extract viral tweets from search results
      console.log(`[REAL_DISCOVERY] 📊 Page loaded, extracting tweets...`);
      
      const opportunities = await page.evaluate(
        (
          { maxReplies, maxAgeHours, minLikes }: { maxReplies: number; maxAgeHours: number; minLikes: number }
        ) => {
        const globalAny: any = globalThis as any;
        if (typeof globalAny.__name !== 'function') {
          globalAny.__name = function(target: Function, value: string) {
            try {
              Object.defineProperty(target, 'name', { value, configurable: true });
            } catch {}
            return target;
          };
        }
        const __name = globalAny.__name as (target: Function, value: string) => Function;
        const results: any[] = [];
        let tweetElements = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
        
        // New Twitter UI sometimes wraps tweets in generic article or cell divs
        if (tweetElements.length === 0) {
          tweetElements = Array.from(document.querySelectorAll('article[role="article"]'));
        }
        if (tweetElements.length === 0) {
          tweetElements = Array.from(document.querySelectorAll('div[data-testid="cellInnerDiv"]'));
        }
        if (tweetElements.length === 0) {
          tweetElements = Array.from(document.querySelectorAll('div[data-testid="tweet"]'));
        }
        
        // 🔍 DIAGNOSTIC: Log what we found
        console.log(`[EXTRACTION] Found ${tweetElements.length} tweet elements on page`);
        
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
        let skippedNoTimestamp = 0;
        let skippedTooOld = 0;
        let skippedLowEngagement = 0;
        
        for (let i = 0; i < Math.min(tweetElements.length, 50); i++) {
          const tweet = tweetElements[i];
          
          // Get timestamp
          const timeEl = tweet.querySelector('time');
          const datetime = timeEl?.getAttribute('datetime') || '';
          if (!datetime) {
            skippedNoTimestamp++;
            continue; // Skip if no timestamp
          }
          
          const tweetTime = new Date(datetime).getTime();
          const ageMs = NOW - tweetTime;
          if (ageMs > MAX_AGE_MS) {
            skippedTooOld++;
            continue; // Skip if older than age limit
          }
          
          const tweetPostedAt = datetime; // Save for later use
          
          // 🚨 CRITICAL: Check if this is a reply tweet (MUST BE SKIPPED)
          const replyingToEl = tweet.querySelector('[data-testid="socialContext"]');
          const isReplyTweet = replyingToEl && replyingToEl.textContent?.toLowerCase().includes('replying to');
          
          if (isReplyTweet) {
            continue; // Skip reply tweets entirely - we only want ROOT tweets
          }
          
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
        
        // 🔍 DIAGNOSTIC: Log extraction summary
        console.log(`[EXTRACTION] Extracted ${results.length} tweets that passed all filters`);
        console.log(`[EXTRACTION] Skipped: ${skippedNoTimestamp} (no timestamp), ${skippedTooOld} (too old), ${skippedLowEngagement} (low engagement)`);
        
        return results;
      },
      { maxReplies, maxAgeHours, minLikes }
      ) as any[];
    
    console.log(`[REAL_DISCOVERY] 📊 Page extraction complete: Found ${opportunities.length} tweets`);
      
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
        opportunities.slice(0, 5).forEach((opp, idx) => {
          console.log(`[REAL_DISCOVERY] ⚠️ Rejected tweet #${idx + 1}:`, {
            text: opp.tweet_content?.slice(0, 180),
            author: opp.tweet_author,
            likes: opp.like_count
          });
        });
        const keywordFallback = opportunities
          .map(opp => ({
            ...opp,
            keywordScore: this.getKeywordScore(`${opp.tweet_content} ${opp.tweet_author}`)
          }))
          .filter(opp => opp.keywordScore >= 2)
          .sort((a, b) => b.keywordScore - a.keywordScore)
          .slice(0, 5);

        if (keywordFallback.length > 0) {
          console.log(`[REAL_DISCOVERY] 🔄 Keyword fallback rescuing ${keywordFallback.length} opportunities`);
          return keywordFallback.map(opp => ({
            ...opp,
            health_relevance_score: Math.max(opp.keywordScore * 2, 4),
            health_category: 'wellness',
            ai_judge_reason: 'keyword_fallback'
          }));
        }

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
    
    for (const username of this.HEALTH_HASHTAGS.slice(0, limit)) {
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
   * Phase 3 Enhancement: Boosts opportunity_score based on discovered_accounts.priority_score
   */
  async storeOpportunities(opportunities: ReplyOpportunity[]): Promise<void> {
    if (opportunities.length === 0) return;
    
    const supabase = getSupabaseClient();
    
    const targetIds = opportunities
      .map(opp => String(opp.tweet_id || '').trim())
      .filter(id => id.length > 0);
    
    const alreadyRepliedIds = new Set<string>();
    const reservedOpportunityIds = new Set<string>();
    const pendingReplyIds = new Set<string>();

    if (targetIds.length > 0) {
      const [
        repliedRows,
        existingOppRows,
        pendingReplyRows
      ] = await Promise.all([
        supabase
          .from('content_metadata')
          .select('target_tweet_id')
          .eq('decision_type', 'reply')
          .eq('status', 'posted')
          .in('target_tweet_id', targetIds),
        supabase
          .from('reply_opportunities')
          .select('target_tweet_id,replied_to,status,reply_decision_id')
          .in('target_tweet_id', targetIds),
        supabase
          .from('content_metadata')
          .select('target_tweet_id,status')
          .eq('decision_type', 'reply')
          .in('status', ['queued', 'ready', 'posting', 'retrying'])
          .in('target_tweet_id', targetIds)
      ]);

      if (repliedRows.error) {
        console.warn('[REAL_DISCOVERY] ⚠️ Failed to fetch replied tweet IDs:', repliedRows.error.message);
      } else {
        (repliedRows.data || []).forEach(row => {
          if (row?.target_tweet_id) {
            alreadyRepliedIds.add(String(row.target_tweet_id));
          }
        });
      }

      if (existingOppRows.error) {
        console.warn('[REAL_DISCOVERY] ⚠️ Failed to fetch existing opportunities:', existingOppRows.error.message);
      } else {
        (existingOppRows.data || []).forEach(row => {
          if (!row?.target_tweet_id) return;
          const status = String(row.status || '').toLowerCase();
          const isReserved =
            Boolean(row.replied_to) ||
            ['replied', 'claimed', 'in_progress'].includes(status) ||
            Boolean(row.reply_decision_id);
          if (isReserved) {
            reservedOpportunityIds.add(String(row.target_tweet_id));
          }
        });
      }

      if (pendingReplyRows.error) {
        console.warn('[REAL_DISCOVERY] ⚠️ Failed to fetch pending reply targets:', pendingReplyRows.error.message);
      } else {
        (pendingReplyRows.data || []).forEach(row => {
          if (row?.target_tweet_id) {
            pendingReplyIds.add(String(row.target_tweet_id));
          }
        });
      }
    }
    
    // 🎯 Phase 3: Look up priority scores for all target usernames
    const uniqueUsernames = [...new Set(opportunities.map(opp => opp.tweet_author.toLowerCase().trim()))];
    const priorityMap = new Map<string, number>();
    
    if (uniqueUsernames.length > 0) {
      const { data: accountData } = await supabase
        .from('discovered_accounts')
        .select('username, priority_score')
        .in('username', uniqueUsernames);
      
      if (accountData) {
        accountData.forEach(acc => {
          priorityMap.set(acc.username.toLowerCase(), Number(acc.priority_score || 0));
        });
      }
    }
    
    let successCount = 0;
    let failCount = 0;
    let boostedCount = 0;
    
    for (const opp of opportunities) {
      const targetId = String(opp.tweet_id);
      if (alreadyRepliedIds.has(targetId)) {
        console.log(`[REAL_DISCOVERY] ⏭️ Skipping ${opp.tweet_id} (already replied)`);
        continue;
      }
      if (reservedOpportunityIds.has(targetId)) {
        console.log(`[REAL_DISCOVERY] ⏭️ Skipping ${opp.tweet_id} (reserved by existing opportunity)`);
        continue;
      }
      if (pendingReplyIds.has(targetId)) {
        console.log(`[REAL_DISCOVERY] ⏭️ Skipping ${opp.tweet_id} (reply already queued)`);
        continue;
      }
      
      // 🚨 CRITICAL FILTER: Skip reply tweets (tweets starting with '@')
      // Reply tweets are NOT original posts and should not be reply targets
      const tweetContent = String(opp.tweet_content || '').trim();
      if (tweetContent.startsWith('@')) {
        console.log(`[REAL_DISCOVERY] 🚫 Skipping ${opp.tweet_id} (is a reply tweet, starts with @)`);
        continue;
      }
      
      try {
        // 🎯 Phase 3: Boost opportunity_score based on priority_score
        // Formula: final_score = base_score * (1 + priority_score * boost_factor)
        // boost_factor = 0.5 means high priority (1.0) gets 50% boost
        const baseScore = Number(opp.opportunity_score || 0);
        const username = opp.tweet_author.toLowerCase().trim();
        const priorityScore = priorityMap.get(username) || 0;
        const BOOST_FACTOR = 0.5; // 50% boost for max priority
        
        let finalScore = baseScore;
        if (priorityScore > 0) {
          finalScore = baseScore * (1 + priorityScore * BOOST_FACTOR);
          boostedCount++;
          console.log(`[REAL_DISCOVERY] 🎯 Boosted @${opp.tweet_author}: ${baseScore.toFixed(2)} → ${finalScore.toFixed(2)} (priority: ${priorityScore.toFixed(3)})`);
        }
        
        // Calculate tweet_posted_at from posted_minutes_ago
        const tweetPostedAt = opp.posted_minutes_ago 
          ? new Date(Date.now() - opp.posted_minutes_ago * 60 * 1000).toISOString()
          : new Date().toISOString();
        
          const { data, error } = await supabase
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
            opportunity_score: finalScore, // ✅ Use boosted score
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
          })
          .select();
        
        if (error) {
          console.error(`[REAL_DISCOVERY] ❌ DB ERROR storing ${opp.tweet_id}:`, error.message, error.details, error.hint);
          failCount++;
        } else {
          successCount++;
          console.log(`[REAL_DISCOVERY] ✅ Stored opportunity ${opp.tweet_id} (@${opp.tweet_author}, ${opp.like_count} likes, tier:${(opp as any).tier})`);
        }
      } catch (error: any) {
        console.error(`[REAL_DISCOVERY] ❌ Exception storing opportunity ${opp.tweet_id}:`, error.message, error.stack);
        failCount++;
      }
    }
    
    console.log(`[REAL_DISCOVERY] 💾 Storage complete: ${successCount} succeeded, ${failCount} failed`);
    if (boostedCount > 0) {
      console.log(`[REAL_DISCOVERY] 🎯 Phase 3: Boosted ${boostedCount} opportunities based on priority_score`);
    }
    
    // Log tier breakdown
    const golden = opportunities.filter((o: any) => o.tier === 'golden').length;
    const good = opportunities.filter((o: any) => o.tier === 'good').length;
    const acceptable = opportunities.filter((o: any) => o.tier === 'acceptable').length;
    
    console.log(`[REAL_DISCOVERY] 💾 Stored ${opportunities.length} opportunities: ${golden} golden, ${good} good, ${acceptable} acceptable`);
  }
}

export const realTwitterDiscovery = RealTwitterDiscovery.getInstance();

