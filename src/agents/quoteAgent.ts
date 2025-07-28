/**
 * 🎯 QUOTE TWEET AGENT
 * 
 * Autonomously finds high-engagement tweets and creates value-added quote tweets.
 * Uses stealth scraping to find viral content and GPT to generate insightful responses.
 */

import { StealthTweetScraper, ScrapedTweet } from '../scraper/scrapeTweets';
import { openaiClient } from '../utils/openaiClient';
import { xClient } from '../utils/xClient';
import { minimalSupabaseClient } from '../utils/minimalSupabaseClient';
import { optimizedStrategy } from '../strategy/tweetingStrategy';

interface QuoteTweetCandidate {
  tweet: ScrapedTweet;
  viralScore: number;
  relevanceScore: number;
  quoteValue: number;
  reasons: string[];
}

interface QuoteTweetResult {
  success: boolean;
  quoteTweet?: {
    content: string;
    originalTweetId: string;
    originalAuthor: string;
    postedAt: Date;
  };
  error?: string;
  skippedReason?: string;
}

export class QuoteAgent {
  private scraper: StealthTweetScraper;
  private isInitialized = false;
  private lastQuoteTime: Date | null = null;
  private quotedTweetIds: Set<string> = new Set();
  private dailyQuoteCount = 0;
  private readonly MAX_DAILY_QUOTES = 3; // Conservative limit
  private readonly MIN_ENGAGEMENT_THRESHOLD = 50; // Minimum likes+retweets
  private readonly COOLDOWN_HOURS = 2; // Hours between quote attempts

  constructor() {
    this.scraper = new StealthTweetScraper();
    this.loadQuotedTweets();
  }

  /**
   * 🚀 Initialize the quote agent
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🎯 Initializing Quote Tweet Agent...');
      
      const scraperReady = await this.scraper.initialize();
      if (!scraperReady) {
        console.log('❌ Failed to initialize scraper for quote agent');
        return false;
      }

      await this.loadQuotedTweets();
      this.isInitialized = true;
      
      console.log('✅ Quote Tweet Agent initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Error initializing Quote Agent:', error);
      return false;
    }
  }

  /**
   * 🎯 Main quote tweet execution
   */
  async executeQuoteTweet(): Promise<QuoteTweetResult> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        return {
          success: false,
          error: 'Failed to initialize Quote Agent'
        };
      }
    }

    try {
      // Check cooldown and daily limits
      const cooldownCheck = this.checkCooldownAndLimits();
      if (!cooldownCheck.canProceed) {
        return {
          success: false,
          skippedReason: cooldownCheck.reason
        };
      }

      console.log('🔍 Searching for high-engagement tweets to quote...');
      
      // Find viral candidates
      const candidates = await this.findQuoteCandidates();
      if (candidates.length === 0) {
        return {
          success: false,
          skippedReason: 'No suitable quote candidates found'
        };
      }

      // Select best candidate
      const bestCandidate = this.selectBestCandidate(candidates);
      console.log(`🎯 Selected tweet from @${bestCandidate.tweet.author.username} with viral score ${bestCandidate.viralScore}`);

      // Generate quote tweet
      const quoteContent = await this.generateQuoteTweet(bestCandidate.tweet);
      if (!quoteContent) {
        return {
          success: false,
          error: 'Failed to generate quote tweet content'
        };
      }

      // Post quote tweet
      const postResult = await this.postQuoteTweet(quoteContent, bestCandidate.tweet);
      if (!postResult.success) {
        return {
          success: false,
          error: postResult.error
        };
      }

      // Track success
      await this.trackQuoteTweet(bestCandidate.tweet, quoteContent);
      
      console.log('✅ Quote tweet posted successfully!');
      return {
        success: true,
        quoteTweet: {
          content: quoteContent,
          originalTweetId: bestCandidate.tweet.tweetId,
          originalAuthor: bestCandidate.tweet.author.username,
          postedAt: new Date()
        }
      };

    } catch (error) {
      console.error('❌ Error executing quote tweet:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 🔍 Find high-engagement tweets suitable for quoting
   */
  private async findQuoteCandidates(): Promise<QuoteTweetCandidate[]> {
    const candidates: QuoteTweetCandidate[] = [];
    
    // Search queries based on health/AI topics and current strategy
    const searchQueries = [
      'AI healthcare breakthrough',
      'health technology innovation',
      'medical AI discovery',
      'digital health news',
      'biotechnology advancement',
      ...(optimizedStrategy.keywordsToPrioritize || []).slice(0, 3)
    ];

    for (const query of searchQueries) {
      try {
        console.log(`🔍 Searching for: "${query}"`);
        
        const searchResult = await this.scraper.searchTweets(query, 10);
        if (!searchResult.success || !searchResult.tweets) {
          continue;
        }

        for (const tweet of searchResult.tweets) {
          // Skip if already quoted
          if (this.quotedTweetIds.has(tweet.tweetId)) {
            continue;
          }

          // Skip if not enough engagement
          const totalEngagement = tweet.engagement.likes + tweet.engagement.retweets;
          if (totalEngagement < this.MIN_ENGAGEMENT_THRESHOLD) {
            continue;
          }

          // Skip replies or retweets
          if (tweet.isReply || tweet.content.startsWith('RT @')) {
            continue;
          }

          const candidate = await this.evaluateTweetCandidate(tweet);
          if (candidate.quoteValue > 0.6) { // Only consider high-value candidates
            candidates.push(candidate);
          }
        }

        // Small delay between searches
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`❌ Error searching for "${query}":`, error);
        continue;
      }
    }

    return candidates.sort((a, b) => b.quoteValue - a.quoteValue);
  }

  /**
   * 📊 Evaluate a tweet as a quote candidate
   */
  private async evaluateTweetCandidate(tweet: ScrapedTweet): Promise<QuoteTweetCandidate> {
    const engagement = tweet.engagement.likes + tweet.engagement.retweets + tweet.engagement.replies;
    
    // Viral score (0-1 based on engagement)
    const viralScore = Math.min(1, engagement / 1000); // 1000+ engagement = max viral score
    
    // Relevance score (0-1 based on health/AI keywords)
    const healthKeywords = ['health', 'medical', 'ai', 'technology', 'innovation', 'breakthrough', 'research', 'study', 'clinical', 'patient', 'treatment', 'therapy', 'biotech', 'pharma'];
    const contentLower = tweet.content.toLowerCase();
    const keywordMatches = healthKeywords.filter(keyword => contentLower.includes(keyword));
    const relevanceScore = Math.min(1, keywordMatches.length / 3); // 3+ keywords = max relevance
    
    // Quote value calculation
    const reasons: string[] = [];
    let quoteValue = 0;
    
    // High engagement boost
    if (engagement > 100) {
      quoteValue += 0.3;
      reasons.push('High engagement');
    }
    
    // Relevance boost
    if (relevanceScore > 0.5) {
      quoteValue += 0.3;
      reasons.push('Highly relevant content');
    }
    
    // Recency boost (newer tweets are better)
    const hoursOld = (Date.now() - new Date(tweet.timestamp).getTime()) / (1000 * 60 * 60);
    if (hoursOld < 24) {
      quoteValue += 0.2;
      reasons.push('Recent content');
    }
    
    // Content quality indicators
    if (tweet.content.includes('study') || tweet.content.includes('research')) {
      quoteValue += 0.1;
      reasons.push('Contains research/study');
    }
    
    if (tweet.content.includes('breakthrough') || tweet.content.includes('innovation')) {
      quoteValue += 0.1;
      reasons.push('Innovation/breakthrough content');
    }

    return {
      tweet,
      viralScore,
      relevanceScore,
      quoteValue: Math.min(1, quoteValue),
      reasons
    };
  }

  /**
   * 🎯 Select the best candidate from available options
   */
  private selectBestCandidate(candidates: QuoteTweetCandidate[]): QuoteTweetCandidate {
    // Prefer candidates with high quote value and recent content
    return candidates.reduce((best, current) => {
      const bestScore = best.quoteValue + (best.viralScore * 0.3);
      const currentScore = current.quoteValue + (current.viralScore * 0.3);
      return currentScore > bestScore ? current : best;
    });
  }

  /**
   * 🤖 Generate insightful quote tweet content
   */
  private async generateQuoteTweet(originalTweet: ScrapedTweet): Promise<string | null> {
    try {
      const strategicTones = optimizedStrategy.highPerformanceTones || ['insightful', 'engaging'];
      const primaryTone = strategicTones[0] || 'insightful';
      
      const prompt = `You are a health technology expert creating a quote tweet. 

Original tweet by @${originalTweet.author.username}:
"${originalTweet.content}"

Create a ${primaryTone} quote tweet that:
- Adds genuine value and insight
- Relates to health/medical technology
- Engages healthcare professionals and tech enthusiasts
- Uses a ${primaryTone} tone
- Is 200 characters or less
- Avoids hashtags unless essential
- Doesn't just agree - adds perspective, context, or implications

Make it thought-provoking and conversation-starting. Focus on the broader implications for healthcare or technology.

Quote tweet:`;

      const response = await openaiClient.generateCompletion(prompt);
      
      if (!response || response.length > 200) {
        console.log('⚠️ Generated quote tweet too long or empty, trying shorter version...');
        
        const shortPrompt = `Add insightful context to this health/tech tweet in under 180 chars:

"${originalTweet.content}"

Your ${primaryTone} perspective:`;

        const shortResponse = await openaiClient.generateCompletion(shortPrompt);
        return shortResponse && shortResponse.length <= 200 ? shortResponse.trim() : null;
      }

      return response.trim();

    } catch (error) {
      console.error('❌ Error generating quote tweet:', error);
      return null;
    }
  }

  /**
   * 📤 Post the quote tweet
   */
  private async postQuoteTweet(content: string, originalTweet: ScrapedTweet): Promise<{success: boolean, error?: string}> {
    try {
      // Format as quote tweet by including the original tweet URL
      const quoteTweetContent = `${content} ${originalTweet.url}`;
      
      console.log('📤 Posting quote tweet...');
      const result = await xClient.postTweet(quoteTweetContent);
      
      if (result.success) {
        this.lastQuoteTime = new Date();
        this.dailyQuoteCount++;
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }

    } catch (error) {
      console.error('❌ Error posting quote tweet:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 📊 Track quote tweet in database
   */
  private async trackQuoteTweet(originalTweet: ScrapedTweet, quoteContent: string): Promise<void> {
    try {
      // Add to quoted tweets set
      this.quotedTweetIds.add(originalTweet.tweetId);
      
      // Save to database
      await minimalSupabaseClient.supabase
        .from('quote_tweets')
        .insert({
          original_tweet_id: originalTweet.tweetId,
          original_author: originalTweet.author.username,
          original_content: originalTweet.content,
          quote_content: quoteContent,
          original_engagement: originalTweet.engagement.likes + originalTweet.engagement.retweets,
          created_at: new Date().toISOString()
        });

      // Update local storage
      this.saveQuotedTweets();

    } catch (error) {
      console.error('❌ Error tracking quote tweet:', error);
    }
  }

  /**
   * ⏰ Check cooldown and daily limits
   */
  private checkCooldownAndLimits(): {canProceed: boolean, reason?: string} {
    // Check daily limit
    if (this.dailyQuoteCount >= this.MAX_DAILY_QUOTES) {
      return {
        canProceed: false,
        reason: `Daily quote limit reached (${this.MAX_DAILY_QUOTES} quotes)`
      };
    }

    // Check cooldown
    if (this.lastQuoteTime) {
      const hoursSinceLastQuote = (Date.now() - this.lastQuoteTime.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastQuote < this.COOLDOWN_HOURS) {
        const remainingTime = Math.ceil(this.COOLDOWN_HOURS - hoursSinceLastQuote);
        return {
          canProceed: false,
          reason: `Cooldown active: ${remainingTime} hours remaining`
        };
      }
    }

    return { canProceed: true };
  }

  /**
   * 💾 Load previously quoted tweets from database
   */
  private async loadQuotedTweets(): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Load today's quotes for daily count
      const { data: todayQuotes } = await minimalSupabaseClient.supabase
        .from('quote_tweets')
        .select('*')
        .gte('created_at', today);

      this.dailyQuoteCount = todayQuotes?.length || 0;

      // Load recent quoted tweet IDs (last 7 days)
      const { data: recentQuotes } = await minimalSupabaseClient.supabase
        .from('quote_tweets')
        .select('original_tweet_id, created_at')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      this.quotedTweetIds.clear();
      recentQuotes?.forEach(quote => {
        this.quotedTweetIds.add(quote.original_tweet_id);
      });

      // Get last quote time
      if (todayQuotes && todayQuotes.length > 0) {
        const lastQuote = todayQuotes.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
        this.lastQuoteTime = new Date(lastQuote.created_at);
      }

      console.log(`📊 Loaded quote history: ${this.dailyQuoteCount} today, ${this.quotedTweetIds.size} recent`);

    } catch (error) {
      console.error('❌ Error loading quoted tweets:', error);
    }
  }

  /**
   * 💾 Save quoted tweets to local cache
   */
  private saveQuotedTweets(): void {
    // This could save to a local file if needed, but database is primary storage
    console.log(`💾 Quote tweet tracking updated: ${this.quotedTweetIds.size} recent tweets`);
  }

  /**
   * 📊 Get status information
   */
  getStatus(): {
    isInitialized: boolean;
    dailyQuoteCount: number;
    maxDailyQuotes: number;
    lastQuoteTime: Date | null;
    cooldownHours: number;
    quotedTweetsCount: number;
  } {
    return {
      isInitialized: this.isInitialized,
      dailyQuoteCount: this.dailyQuoteCount,
      maxDailyQuotes: this.MAX_DAILY_QUOTES,
      lastQuoteTime: this.lastQuoteTime,
      cooldownHours: this.COOLDOWN_HOURS,
      quotedTweetsCount: this.quotedTweetIds.size
    };
  }

  /**
   * 🔄 Reset daily counters (called at midnight)
   */
  resetDailyCounters(): void {
    this.dailyQuoteCount = 0;
    console.log('🔄 Quote tweet daily counters reset');
  }

  /**
   * 🔒 Close scraper resources
   */
  async close(): Promise<void> {
    if (this.scraper) {
      await this.scraper.close();
    }
  }
}

// Create singleton instance
export const quoteAgent = new QuoteAgent();

// Export for testing
export default QuoteAgent; 