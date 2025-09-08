/**
 * Twitter UI Interaction Layer for xBOT
 * Handles DOM selectors and interactions with x.com interface
 */

import { Page } from 'playwright';

export interface TweetData {
  id: string;
  text: string;
  likes: number;
  replies: number;
  reposts: number;
  views: number;
  timestamp: Date;
}

export class TwitterUI {
  constructor(private page: Page) {}

  // Tweet composition and posting
  async composeTweet(text: string): Promise<void> {
    console.log('✍️ Composing tweet...');
    
    // Find and click compose button
    await this.page.click('[data-testid="SideNav_NewTweet_Button"]');
    await this.page.waitForSelector('[data-testid="tweetTextarea_0"]');
    
    // Type the tweet text
    await this.page.fill('[data-testid="tweetTextarea_0"]', text);
    
    console.log(`📝 Tweet composed: "${text.substring(0, 50)}..."`);
  }

  async postTweet(): Promise<string> {
    console.log('📤 Posting tweet...');
    
    // Click tweet button
    await this.page.click('[data-testid="tweetButtonInline"]');
    
    // Wait for tweet to be posted (URL change or success indicator)
    await this.page.waitForTimeout(3000);
    
    // Extract tweet ID from URL if possible
    const url = this.page.url();
    const tweetId = this.extractTweetIdFromUrl(url) || `tweet_${Date.now()}`;
    
    console.log(`✅ Tweet posted with ID: ${tweetId}`);
    return tweetId;
  }

  async composeThread(texts: string[]): Promise<void> {
    console.log(`🧵 Composing thread with ${texts.length} tweets...`);
    
    // Start with first tweet
    await this.composeTweet(texts[0]);
    
    // Add subsequent tweets
    for (let i = 1; i < texts.length; i++) {
      // Click add thread button
      await this.page.click('[data-testid="addButton"]');
      await this.page.waitForSelector(`[data-testid="tweetTextarea_${i}"]`);
      
      // Type next tweet
      await this.page.fill(`[data-testid="tweetTextarea_${i}"]`, texts[i]);
    }
    
    console.log('🧵 Thread composed');
  }

  // Reply functionality
  async replyToTweet(tweetId: string, replyText: string): Promise<string> {
    console.log(`💬 Replying to tweet ${tweetId}...`);
    
    // Navigate to tweet
    await this.page.goto(`https://x.com/i/status/${tweetId}`);
    
    // Find reply input
    await this.page.waitForSelector('[data-testid="tweetTextarea_0"]');
    await this.page.fill('[data-testid="tweetTextarea_0"]', replyText);
    
    // Post reply
    await this.page.click('[data-testid="tweetButtonInline"]');
    await this.page.waitForTimeout(2000);
    
    const replyId = `reply_${Date.now()}`;
    console.log(`✅ Reply posted with ID: ${replyId}`);
    return replyId;
  }

  // Metrics scraping
  async scrapeTweetMetrics(tweetElement: any): Promise<Partial<TweetData>> {
    try {
      // Extract text
      const textElement = await tweetElement.$('[data-testid="tweetText"]');
      const text = textElement ? await textElement.textContent() : '';

      // Extract engagement metrics
      const likeElement = await tweetElement.$('[data-testid="like"] span');
      const replyElement = await tweetElement.$('[data-testid="reply"] span');
      const repostElement = await tweetElement.$('[data-testid="retweet"] span');

      const likes = this.parseMetricCount(likeElement ? await likeElement.textContent() : '0');
      const replies = this.parseMetricCount(replyElement ? await replyElement.textContent() : '0');
      const reposts = this.parseMetricCount(repostElement ? await repostElement.textContent() : '0');

      // Extract timestamp
      const timeElement = await tweetElement.$('time');
      const datetime = timeElement ? await timeElement.getAttribute('datetime') : null;
      const timestamp = datetime ? new Date(datetime) : new Date();

      // Extract tweet ID
      const linkElement = await tweetElement.$('a[href*="/status/"]');
      const href = linkElement ? await linkElement.getAttribute('href') : '';
      const id = this.extractTweetIdFromUrl(href) || '';

      return {
        id,
        text,
        likes,
        replies,
        reposts,
        views: Math.max(likes + replies + reposts * 20, 100), // Estimate views
        timestamp
      };
    } catch (error) {
      console.error('Failed to scrape tweet metrics:', error);
      return {};
    }
  }

  async scrapeProfileTweets(handle: string, limit: number = 20): Promise<TweetData[]> {
    console.log(`📊 Scraping tweets from @${handle}...`);
    
    await this.page.goto(`https://x.com/${handle}`);
    await this.page.waitForLoadState('networkidle');

    // Scroll to load tweets
    await this.scrollToLoadContent();

    // Get tweet elements
    const tweetElements = await this.page.$$('[data-testid="tweet"]');
    const tweets: TweetData[] = [];

    for (const element of tweetElements.slice(0, limit)) {
      const tweetData = await this.scrapeTweetMetrics(element);
      if (tweetData.id && tweetData.text) {
        tweets.push(tweetData as TweetData);
      }
    }

    console.log(`✅ Scraped ${tweets.length} tweets from @${handle}`);
    return tweets;
  }

  // Utility functions
  private parseMetricCount(text: string): number {
    if (!text || text === '0') return 0;
    
    const cleanText = text.replace(/,/g, '');
    const match = cleanText.match(/(\d+\.?\d*)\s*([KM])?/i);
    
    if (!match) return 0;
    
    const number = parseFloat(match[1]);
    const suffix = match[2]?.toUpperCase();
    
    if (suffix === 'K') return Math.floor(number * 1000);
    if (suffix === 'M') return Math.floor(number * 1000000);
    return Math.floor(number);
  }

  private extractTweetIdFromUrl(url: string): string | null {
    const match = url.match(/\/status\/(\d+)/);
    return match ? match[1] : null;
  }

  private async scrollToLoadContent(): Promise<void> {
    let previousHeight = 0;
    let scrollAttempts = 0;
    const maxAttempts = 3;

    while (scrollAttempts < maxAttempts) {
      await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await this.page.waitForTimeout(2000);
      
      const newHeight = await this.page.evaluate(() => document.body.scrollHeight);
      if (newHeight === previousHeight) {
        scrollAttempts++;
      } else {
        scrollAttempts = 0;
      }
      previousHeight = newHeight;
    }
  }

  // Check UI state
  async checkIfLoggedIn(): Promise<boolean> {
    try {
      await this.page.waitForSelector('[data-testid="AppTabBar_Home_Link"]', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async isComposerOpen(): Promise<boolean> {
    const composer = await this.page.$('[data-testid="tweetTextarea_0"]');
    return composer !== null;
  }
}

export default TwitterUI;
