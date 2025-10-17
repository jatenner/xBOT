/**
 * 🔍 COMPETITIVE ANALYSIS SERVICE
 * 
 * Scrapes and learns from top health accounts
 * Discovers patterns that drive viral growth
 */

import { getSupabaseClient } from '../db';
import { HookAnalysisService } from './hookAnalysisService';

export interface CompetitorPost {
  tweet_id: string;
  tweet_text: string;
  likes: number;
  retweets: number;
  replies: number;
  posted_at: string;
  hook_text: string;
  success_score: number;
}

export interface CompetitiveInsight {
  pattern: string;
  effectiveness_score: number;
  sample_size: number;
  confidence: number;
}

export class CompetitiveAnalysisService {
  private static instance: CompetitiveAnalysisService;
  
  // Top health accounts to learn from
  private readonly TOP_ACCOUNTS = [
    { username: 'hubermanlab', followers: 5000000 },
    { username: 'peterattiamd', followers: 500000 },
    { username: 'foundmyfitness', followers: 300000 },
    { username: 'MaxLugavere', followers: 200000 },
    { username: 'BenGreenfieldFitness', followers: 150000 },
    { username: 'DrMarkHyman', followers: 400000 },
    { username: 'DaveAsprey', followers: 600000 },
    { username: 'bengreenfield', followers: 100000 }
  ];
  
  private constructor() {}
  
  static getInstance(): CompetitiveAnalysisService {
    if (!CompetitiveAnalysisService.instance) {
      CompetitiveAnalysisService.instance = new CompetitiveAnalysisService();
    }
    return CompetitiveAnalysisService.instance;
  }

  /**
   * Scrape top posts from competitor accounts
   */
  async scrapeCompetitorBestPosts(): Promise<void> {
    console.log('[COMPETITIVE] 🔍 Scraping top health accounts...');
    
    for (const account of this.TOP_ACCOUNTS) {
      try {
        const posts = await this.scrapeTopPostsFromAccount(account.username, account.followers);
        
        if (posts.length === 0) {
          console.log(`[COMPETITIVE] ⚠️ No posts scraped from @${account.username}`);
          continue;
        }
        
        // Store in database
        const supabase = getSupabaseClient();
        const hookAnalysis = HookAnalysisService.getInstance();
        
        for (const post of posts) {
          const hook = hookAnalysis.extractHook(post.tweet_text);
          const hookType = hookAnalysis.classifyHookType(hook);
          
          await supabase
            .from('competitive_intelligence')
            .upsert({
              competitor_username: account.username,
              competitor_followers: account.followers,
              tweet_id: post.tweet_id,
              tweet_text: post.tweet_text,
              likes_count: post.likes,
              retweets_count: post.retweets,
              replies_count: post.replies,
              posted_at: post.posted_at,
              hook_text: hook,
              hook_type: hookType,
              success_score: post.likes + (post.retweets * 2)
            }, { onConflict: 'tweet_id' });
        }
        
        console.log(`[COMPETITIVE] ✅ Scraped ${posts.length} posts from @${account.username}`);
        
        // Wait between accounts to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } catch (error: any) {
        console.error(`[COMPETITIVE] ❌ Failed to scrape @${account.username}:`, error.message);
      }
    }
  }

  /**
   * Scrape top posts from a single account
   */
  private async scrapeTopPostsFromAccount(username: string, followers: number): Promise<CompetitorPost[]> {
    try {
      const browserManager = (await import('../lib/browser')).default;
      const page = await browserManager.newPage();
      
      await page.goto(`https://x.com/${username}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      
      await page.waitForTimeout(3000);
      
      // Scroll to load more tweets
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollBy(0, 1000));
        await page.waitForTimeout(1000);
      }
      
      // Extract tweets
      const tweets = await page.locator('article[data-testid="tweet"]').all();
      const posts: CompetitorPost[] = [];
      
      for (const tweet of tweets.slice(0, 15)) {
        try {
          const text = await tweet.locator('[data-testid="tweetText"]').innerText().catch(() => '');
          if (!text || text.length < 20) continue;
          
          // Get engagement metrics
          const likeButton = await tweet.locator('[data-testid="like"]').innerText().catch(() => '0');
          const retweetButton = await tweet.locator('[data-testid="retweet"]').innerText().catch(() => '0');
          const replyButton = await tweet.locator('[data-testid="reply"]').innerText().catch(() => '0');
          
          const likes = this.parseMetric(likeButton);
          const retweets = this.parseMetric(retweetButton);
          const replies = this.parseMetric(replyButton);
          
          // Get tweet URL for ID
          const tweetLink = await tweet.locator('a[href*="/status/"]').first().getAttribute('href').catch(() => '');
          const tweetId = tweetLink.match(/status\/(\d+)/)?.[1] || `comp_${Date.now()}_${Math.random()}`;
          
          posts.push({
            tweet_id: tweetId,
            tweet_text: text,
            likes,
            retweets,
            replies,
            posted_at: new Date().toISOString(),
            hook_text: text.split(' ').slice(0, 7).join(' '),
            success_score: likes + (retweets * 2)
          });
          
        } catch (error) {
          // Skip problematic tweets
          continue;
        }
      }
      
      await page.close();
      
      // Filter for high-performing posts only
      return posts.filter(p => p.success_score >= 50).sort((a, b) => b.success_score - a.success_score);
      
    } catch (error: any) {
      console.error(`[COMPETITIVE] ❌ Scraping failed for @${username}:`, error.message);
      return [];
    }
  }

  /**
   * Parse engagement metrics (handles K, M notation)
   */
  private parseMetric(text: string): number {
    if (!text || text === '') return 0;
    
    const match = text.match(/([0-9,.]+)([KM])?/);
    if (!match) return 0;
    
    const num = parseFloat(match[1].replace(/,/g, ''));
    const multiplier = match[2];
    
    if (multiplier === 'K') return Math.round(num * 1000);
    if (multiplier === 'M') return Math.round(num * 1000000);
    return Math.round(num);
  }

  /**
   * Analyze patterns from competitor posts
   */
  async analyzeCompetitorPatterns(): Promise<void> {
    console.log('[COMPETITIVE] 🧠 Analyzing competitor patterns...');
    
    const supabase = getSupabaseClient();
    
    // Get high-performing posts
    const { data: topPosts } = await supabase
      .from('competitive_intelligence')
      .select('hook_text, hook_type, success_score, topic_detected')
      .gte('success_score', 500) // High-performing posts only
      .order('success_score', { ascending: false })
      .limit(200);
    
    if (!topPosts || topPosts.length === 0) {
      console.log('[COMPETITIVE] ℹ️ No posts to analyze yet');
      return;
    }
    
    // Analyze hook patterns
    await this.analyzeHookPatterns(topPosts);
    
    // Analyze format patterns (threads vs singles)
    await this.analyzeFormatPatterns(topPosts);
    
    console.log('[COMPETITIVE] ✅ Pattern analysis complete');
  }

  /**
   * Analyze hook patterns
   */
  private async analyzeHookPatterns(posts: any[]): Promise<void> {
    const supabase = getSupabaseClient();
    const patterns: Record<string, { count: number; totalScore: number }> = {};
    
    for (const post of posts) {
      const hookType = post.hook_type || 'statement';
      
      if (!patterns[hookType]) {
        patterns[hookType] = { count: 0, totalScore: 0 };
      }
      
      patterns[hookType].count++;
      patterns[hookType].totalScore += post.success_score;
    }
    
    // Store insights
    for (const [pattern, data] of Object.entries(patterns)) {
      const avgScore = data.totalScore / data.count;
      const confidence = Math.min(1, data.count / 20); // More samples = higher confidence
      
      await supabase
        .from('competitive_insights')
        .upsert({
          insight_type: 'hook_pattern',
          pattern,
          effectiveness_score: avgScore,
          sample_size: data.count,
          confidence,
          updated_at: new Date().toISOString()
        }, { onConflict: 'insight_type,pattern' });
      
      console.log(`[COMPETITIVE] 📊 Hook pattern "${pattern}": ${data.count} samples, ${Math.round(avgScore)} avg score`);
    }
  }

  /**
   * Analyze format patterns
   */
  private async analyzeFormatPatterns(posts: any[]): Promise<void> {
    const supabase = getSupabaseClient();
    
    let threadCount = 0;
    let threadScore = 0;
    let singleCount = 0;
    let singleScore = 0;
    
    for (const post of posts) {
      const isThread = post.tweet_text.includes('🧵') || post.tweet_text.includes('Thread');
      
      if (isThread) {
        threadCount++;
        threadScore += post.success_score;
      } else {
        singleCount++;
        singleScore += post.success_score;
      }
    }
    
    // Store thread insight
    if (threadCount > 0) {
      await supabase
        .from('competitive_insights')
        .upsert({
          insight_type: 'format_pattern',
          pattern: 'thread',
          effectiveness_score: threadScore / threadCount,
          sample_size: threadCount,
          confidence: Math.min(1, threadCount / 20),
          updated_at: new Date().toISOString()
        }, { onConflict: 'insight_type,pattern' });
    }
    
    // Store single insight
    if (singleCount > 0) {
      await supabase
        .from('competitive_insights')
        .upsert({
          insight_type: 'format_pattern',
          pattern: 'single',
          effectiveness_score: singleScore / singleCount,
          sample_size: singleCount,
          confidence: Math.min(1, singleCount / 20),
          updated_at: new Date().toISOString()
        }, { onConflict: 'insight_type,pattern' });
    }
  }

  /**
   * Get top performing patterns
   */
  async getTopPerformingPatterns(limit: number = 5): Promise<CompetitiveInsight[]> {
    const supabase = getSupabaseClient();
    
    const { data } = await supabase
      .from('competitive_insights')
      .select('*')
      .gte('sample_size', 5) // Need at least 5 samples
      .order('effectiveness_score', { ascending: false })
      .limit(limit);
    
    return (data || []).map(d => ({
      pattern: String(d.pattern),
      effectiveness_score: Number(d.effectiveness_score),
      sample_size: Number(d.sample_size),
      confidence: Number(d.confidence)
    }));
  }

  /**
   * Get best hook type based on competitive intelligence
   */
  async getBestHookTypeFromCompetitors(): Promise<string> {
    const supabase = getSupabaseClient();
    
    const { data } = await supabase
      .from('competitive_insights')
      .select('pattern, effectiveness_score, sample_size')
      .eq('insight_type', 'hook_pattern')
      .gte('sample_size', 10)
      .order('effectiveness_score', { ascending: false })
      .limit(1)
      .single();
    
    return String(data?.pattern || 'question');
  }
}

export const competitiveAnalysisService = CompetitiveAnalysisService.getInstance();

