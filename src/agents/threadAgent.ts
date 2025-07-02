import { TwitterApi } from 'twitter-api-v2';
import { supabaseClient } from '../utils/supabaseClient';
import { isBotDisabled } from '../utils/flagCheck';
import { safeWrite } from '../utils/quotaGuard';
import { OpenAIService } from '../utils/openaiClient';

export class ThreadAgent {
  private twitterClient: TwitterApi;
  private openaiService: OpenAIService;

  constructor() {
    this.twitterClient = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY!,
      appSecret: process.env.TWITTER_API_SECRET!,
      accessToken: process.env.TWITTER_ACCESS_TOKEN!,
      accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!,
    });
    this.openaiService = new OpenAIService();
  }

  async run(): Promise<{ success: boolean; threadId?: string; tweetCount?: number }> {
    try {
      // Check kill switch
      if (await isBotDisabled()) {
        console.log('🛑 Bot disabled, skipping thread generation');
        return { success: false };
      }

      console.log('🧵 ThreadAgent: Generating thread from long-form content...');

      // Get a long article from news cache
      const article = await this.getLongArticle();
      if (!article) {
        console.log('📰 No suitable long-form content found for threading');
        return { success: false };
      }

      // Generate thread content
      const threadTweets = await this.generateThreadFromArticle(article);
      if (!threadTweets || threadTweets.length < 2) {
        console.log('❌ Failed to generate valid thread content');
        return { success: false };
      }

      // Post thread
      const threadId = await this.postThread(threadTweets);
      if (!threadId) {
        console.log('❌ Failed to post thread');
        return { success: false };
      }

      console.log(`✅ Thread posted successfully: ${threadId} (${threadTweets.length} tweets)`);
      return { success: true, threadId, tweetCount: threadTweets.length };

    } catch (error) {
      console.error('❌ ThreadAgent error:', error);
      return { success: false };
    }
  }

  private async getLongArticle(): Promise<any> {
    try {
      const { data, error } = await supabaseClient.supabase
        ?.from('news_cache')
        .select('*')
        .gte('content_length', 1000) // Long articles only
        .order('created_at', { ascending: false })
        .limit(5);

      if (error || !data || data.length === 0) {
        return null;
      }

      // Pick a random article from the top 5
      return data[Math.floor(Math.random() * data.length)];
    } catch (error) {
      console.error('Error fetching long article:', error);
      return null;
    }
  }

  private async generateThreadFromArticle(article: any): Promise<string[]> {
    try {
      const prompt = `
Create a Twitter thread (4-6 tweets) from this health tech article. Each tweet should:
- Be under 280 characters
- Be numbered (1/n, 2/n, etc.)
- Flow naturally from one to the next
- Include relevant hashtags in the last tweet only
- Focus on key insights and actionable takeaways

Article: "${article.title}"
Content: "${article.content?.substring(0, 2000) || article.description}"

Format as JSON array of strings.
`;

      const response = await this.openaiService.generateCompletion(prompt, {
        maxTokens: 800,
        temperature: 0.7
      });

      // Parse the response
      let threadTweets: string[];
      try {
        threadTweets = JSON.parse(response);
      } catch {
        // Fallback: split by lines and clean up
        threadTweets = response.split('\n')
          .filter(line => line.trim().length > 0)
          .map(line => line.replace(/^["']|["']$/g, '').trim())
          .filter(line => line.length > 0);
      }

      // Validate and number tweets
      if (threadTweets.length < 2 || threadTweets.length > 6) {
        console.log(`⚠️ Invalid thread length: ${threadTweets.length} tweets`);
        return [];
      }

      // Ensure proper numbering
      const numberedTweets = threadTweets.map((tweet, index) => {
        const tweetNumber = index + 1;
        const totalTweets = threadTweets.length;
        
        // Remove existing numbering if present
        const cleanTweet = tweet.replace(/^\d+\/\d+\s*/, '').trim();
        
        // Add proper numbering
        return `${tweetNumber}/${totalTweets} ${cleanTweet}`;
      });

      return numberedTweets;

    } catch (error) {
      console.error('Error generating thread content:', error);
      return [];
    }
  }

  private async postThread(tweets: string[]): Promise<string | null> {
    try {
      let previousTweetId: string | null = null;

      for (let i = 0; i < tweets.length; i++) {
        const tweetContent = tweets[i];
        
        const result = await safeWrite(async () => {
          if (previousTweetId) {
            // Reply to previous tweet
            return await this.twitterClient.v2.reply(tweetContent, previousTweetId);
          } else {
            // First tweet in thread
            return await this.twitterClient.v2.tweet(tweetContent);
          }
        });

        if (!result) {
          console.log(`❌ Failed to post tweet ${i + 1}/${tweets.length}`);
          return null;
        }

        previousTweetId = result.data.id;
        console.log(`✅ Posted tweet ${i + 1}/${tweets.length}: ${result.data.id}`);

        // Small delay between tweets
        if (i < tweets.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Store thread info
      await this.storeThreadInfo(previousTweetId!, tweets.length);

      return tweets.length > 0 ? previousTweetId : null;

    } catch (error) {
      console.error('Error posting thread:', error);
      return null;
    }
  }

  private async storeThreadInfo(firstTweetId: string, tweetCount: number): Promise<void> {
    try {
      await supabaseClient.supabase
        ?.from('tweets')
        .insert({
          tweet_id: firstTweetId,
          content: `Thread with ${tweetCount} tweets`,
          posted_at: new Date().toISOString(),
          content_type: 'thread',
          quality_score: 75, // Threads generally have good engagement
          variant: 'thread'
        });
    } catch (error) {
      console.error('Error storing thread info:', error);
    }
  }
} 