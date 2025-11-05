/**
 * 🔎 VISUAL INTELLIGENCE: Account Finder
 * 
 * Automatically discovers micro-influencer accounts (1k-20k followers)
 * Strategies:
 * 1. Reply network analysis (who replies to big accounts)
 * 2. Following network (who micro-influencers follow)
 * 3. Health keyword search
 * 
 * Integrated with existing account_discovery job (runs weekly on Sunday)
 * Feature flagged: Only runs if VISUAL_INTELLIGENCE_ENABLED=true
 */

import { getSupabaseClient } from '../db/index';
import { log } from '../lib/logger';
import { UnifiedBrowserPool } from '../browser/UnifiedBrowserPool';
import type { Page } from 'playwright';

export class VIAccountFinder {
  private supabase = getSupabaseClient();
  private browserPool = UnifiedBrowserPool.getInstance();
  
  /**
   * Main entry point: Discover new micro-influencer accounts
   * Called by account_discovery job (weekly on Sunday)
   */
  async discoverNewAccounts(): Promise<void> {
    log({ op: 'vi_account_finder_start' });
    
    const discovered = {
      reply_network: 0,
      following_network: 0,
      keyword_search: 0
    };
    
    // Strategy 1: Analyze who replies to big accounts (most reliable)
    try {
      discovered.reply_network = await this.findViaReplyNetwork();
    } catch (error: any) {
      log({ op: 'vi_find_reply_error', error: error.message });
    }
    
    // Strategy 2: Check who micro-influencers follow (high quality)
    try {
      discovered.following_network = await this.findViaFollowingNetwork();
    } catch (error: any) {
      log({ op: 'vi_find_following_error', error: error.message });
    }
    
    // Strategy 3: Search health keywords (medium quality, more false positives)
    try {
      discovered.keyword_search = await this.findViaKeywords();
    } catch (error: any) {
      log({ op: 'vi_find_keyword_error', error: error.message });
    }
    
    log({ 
      op: 'vi_account_finder_complete', 
      ...discovered,
      total: discovered.reply_network + discovered.following_network + discovered.keyword_search
    });
  }
  
  /**
   * Strategy 1: Find accounts that reply to established experts
   */
  private async findViaReplyNetwork(): Promise<number> {
    log({ op: 'vi_find_via_replies' });
    
    const bigAccounts = ['PeterAttiaMD', 'hubermanlab', 'foundmyfitness'];
    let discovered = 0;
    
    for (const bigAccount of bigAccounts) {
      let page: Page | null = null;
      
      try {
        page = await this.browserPool.acquirePage(`vi_reply_discover_${bigAccount}`);
        
        // Go to their profile
        await page.goto(`https://twitter.com/${bigAccount}`, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        
        await this.sleep(2000);
        
        // Click first tweet to see replies
        try {
          await page.click('[data-testid="tweet"]', { timeout: 5000 });
          await this.sleep(2000);
        } catch {
          // If can't click, skip this account
          continue;
        }
        
        // Extract reply authors
        const replyAuthors = await page.evaluate(() => {
          const tweets = document.querySelectorAll('[data-testid="tweet"]');
          const authors: string[] = [];
          
          tweets.forEach(tweet => {
            const authorElement = tweet.querySelector('[data-testid="User-Name"]');
            const text = authorElement?.textContent || '';
            const match = text.match(/@(\w+)/);
            if (match && match[1]) authors.push(match[1]);
          });
          
          return [...new Set(authors)]; // Remove duplicates
        });
        
        log({ op: 'vi_reply_authors_found', account: bigAccount, count: replyAuthors.length });
        
        // Evaluate first 5 (to avoid too much work)
        for (const author of replyAuthors.slice(0, 5)) {
          const added = await this.evaluateAndAdd(author, 'reply_network');
          if (added) discovered++;
          
          // Rate limit
          await this.sleep(3000);
        }
        
      } finally {
        if (page) {
          await this.browserPool.releasePage(page);
        }
      }
    }
    
    return discovered;
  }
  
  /**
   * Strategy 2: Find accounts that micro-influencers follow
   */
  private async findViaFollowingNetwork(): Promise<number> {
    log({ op: 'vi_find_via_following' });
    
    // Get our existing verified micro-influencers
    const { data: microAccounts } = await this.supabase
      .from('vi_scrape_targets')
      .select('username')
      .eq('tier', 'micro')
      .eq('is_health_verified', true)
      .limit(3); // Check 3 micro accounts
    
    if (!microAccounts || microAccounts.length === 0) {
      log({ op: 'vi_no_micro_seeds' });
      return 0;
    }
    
    let discovered = 0;
    
    for (const micro of microAccounts) {
      let page: Page | null = null;
      
      try {
        page = await this.browserPool.acquirePage(`vi_following_${micro.username}`);
        
        // Go to their following page
        await page.goto(`https://twitter.com/${micro.username}/following`, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        
        await this.sleep(2000);
        
        // Scroll to load more
        for (let i = 0; i < 2; i++) {
          await page.evaluate(() => window.scrollBy(0, 1000));
          await this.sleep(1000);
        }
        
        // Extract usernames they follow
        const following = await page.evaluate(() => {
          const cells = document.querySelectorAll('[data-testid="UserCell"]');
          const usernames: string[] = [];
          
          cells.forEach(cell => {
            const usernameElement = cell.querySelector('[dir="ltr"] span');
            const text = usernameElement?.textContent || '';
            const username = text.replace('@', '').trim();
            if (username) usernames.push(username);
          });
          
          return usernames;
        });
        
        log({ op: 'vi_following_found', account: micro.username, count: following.length });
        
        // Evaluate first 5
        for (const username of following.slice(0, 5)) {
          const added = await this.evaluateAndAdd(username, 'following_network');
          if (added) discovered++;
          
          await this.sleep(3000);
        }
        
      } finally {
        if (page) {
          await this.browserPool.releasePage(page);
        }
      }
    }
    
    return discovered;
  }
  
  /**
   * Strategy 3: Search health keywords
   */
  private async findViaKeywords(): Promise<number> {
    log({ op: 'vi_find_via_keywords' });
    
    const keywords = ['longevity tips', 'biohacking', 'sleep optimization'];
    let discovered = 0;
    
    for (const keyword of keywords) {
      let page: Page | null = null;
      
      try {
        page = await this.browserPool.acquirePage(`vi_keyword_${keyword}`);
        
        // Search Twitter
        const searchUrl = `https://twitter.com/search?q=${encodeURIComponent(keyword)}&f=live`;
        await page.goto(searchUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        
        await this.sleep(2000);
        
        // Scroll to load results
        for (let i = 0; i < 2; i++) {
          await page.evaluate(() => window.scrollBy(0, 1000));
          await this.sleep(1000);
        }
        
        // Extract tweet authors
        const authors = await page.evaluate(() => {
          const tweets = document.querySelectorAll('[data-testid="tweet"]');
          const usernames: string[] = [];
          
          tweets.forEach(tweet => {
            const authorElement = tweet.querySelector('[data-testid="User-Name"]');
            const text = authorElement?.textContent || '';
            const match = text.match(/@(\w+)/);
            if (match && match[1]) usernames.push(match[1]);
          });
          
          return [...new Set(usernames)];
        });
        
        log({ op: 'vi_keyword_authors_found', keyword, count: authors.length });
        
        // Evaluate first 3 (keyword search has more false positives)
        for (const author of authors.slice(0, 3)) {
          const added = await this.evaluateAndAdd(author, 'keyword_search');
          if (added) discovered++;
          
          await this.sleep(3000);
        }
        
      } finally {
        if (page) {
          await this.browserPool.releasePage(page);
        }
      }
    }
    
    return discovered;
  }
  
  /**
   * Evaluate account and add if it meets criteria
   */
  private async evaluateAndAdd(username: string, discoveryMethod: string): Promise<boolean> {
    // Check if already exists
    const { data: existing } = await this.supabase
      .from('vi_scrape_targets')
      .select('username')
      .eq('username', username)
      .single();
    
    if (existing) {
      log({ op: 'vi_account_exists', username });
      return false;
    }
    
    let page: Page | null = null;
    
    try {
      page = await this.browserPool.acquirePage(`vi_eval_${username}`);
      
      // Go to profile
      await page.goto(`https://twitter.com/${username}`, {
        waitUntil: 'domcontentloaded',
        timeout: 20000
      });
      
      await this.sleep(2000);
      
      // Extract follower count and bio
      const profileData = await page.evaluate(() => {
        // Follower count
        const followerLink = document.querySelector('a[href$="/verified_followers"] span, a[href$="/followers"] span');
        const followerText = followerLink?.textContent || '0';
        
        let followers = 0;
        if (followerText.includes('M')) {
          followers = Math.round(parseFloat(followerText.replace('M', '')) * 1000000);
        } else if (followerText.includes('K')) {
          followers = Math.round(parseFloat(followerText.replace('K', '')) * 1000);
        } else {
          followers = parseInt(followerText.replace(/,/g, '')) || 0;
        }
        
        // Bio
        const bioElement = document.querySelector('[data-testid="UserDescription"]');
        const bio = bioElement?.textContent || '';
        
        return { followers, bio };
      });
      
      log({ op: 'vi_account_evaluated', username, followers: profileData.followers });
      
      // Check if meets criteria
      const isMicro = profileData.followers >= 1000 && profileData.followers <= 20000;
      const isGrowth = profileData.followers > 20000 && profileData.followers <= 100000;
      const isHealthRelated = this.isHealthBio(profileData.bio);
      
      if ((isMicro || isGrowth) && isHealthRelated) {
        // High confidence - auto-add as active
        await this.supabase.from('vi_scrape_targets').insert({
          username,
          tier: isMicro ? 'micro' : 'growth',
          tier_weight: isMicro ? 2.0 : 1.0,
          followers_count: profileData.followers,
          bio_text: profileData.bio,
          discovery_method: discoveryMethod,
          inclusion_reason: `Auto-discovered: ${profileData.followers.toLocaleString()} followers, health bio`,
          is_active: true,
          is_health_verified: false // Needs eventual manual review
        });
        
        log({ 
          op: 'vi_account_added', 
          username, 
          tier: isMicro ? 'micro' : 'growth',
          followers: profileData.followers,
          discovery: discoveryMethod
        });
        
        return true;
      }
      
      log({ 
        op: 'vi_account_rejected', 
        username, 
        reason: `followers: ${profileData.followers}, health: ${isHealthRelated}` 
      });
      
      return false;
      
    } catch (error: any) {
      log({ op: 'vi_evaluate_error', username, error: error.message });
      return false;
      
    } finally {
      if (page) {
        await this.browserPool.releasePage(page);
      }
    }
  }
  
  /**
   * Check if bio indicates health/longevity niche
   */
  private isHealthBio(bio: string): boolean {
    const healthKeywords = [
      'longevity', 'biohacking', 'health optimization', 'wellness',
      'functional medicine', 'nutrition', 'fitness', 'supplements',
      'peptides', 'hormones', 'gut health', 'sleep', 'fasting',
      'md', 'phd', 'rd', 'nutritionist', 'doctor', 'physician',
      'health coach', 'personal trainer', 'biohacker',
      'autophagy', 'nad+', 'mitochondria', 'metabolic',
      'carnivore', 'keto', 'paleo', 'microbiome', 'exercise',
      'recovery', 'performance', 'aging', 'anti-aging'
    ];
    
    const excludeKeywords = [
      'crypto', 'web3', 'nft', 'blockchain', 'bitcoin', 'ethereum',
      'trading', 'forex', 'stocks', 'real estate', 'marketing'
    ];
    
    const bioLower = bio.toLowerCase();
    
    const hasHealthKeyword = healthKeywords.some(keyword => 
      bioLower.includes(keyword.toLowerCase())
    );
    
    const hasExcludeKeyword = excludeKeywords.some(keyword =>
      bioLower.includes(keyword.toLowerCase())
    );
    
    return hasHealthKeyword && !hasExcludeKeyword;
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Export function to be called by account_discovery job (weekly)
 */
export async function discoverMicroInfluencers(): Promise<void> {
  const finder = new VIAccountFinder();
  await finder.discoverNewAccounts();
}

