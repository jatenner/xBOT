import { TwitterApi } from 'twitter-api-v2';
import { supabaseClient } from '../utils/supabaseClient';
import { isBotDisabled } from '../utils/flagCheck';
import { safeWrite, safeRead } from '../utils/quotaGuard';
import { OpenAIService } from '../utils/openaiClient';

export class QuoteAgent {
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

  async run(): Promise<{ success: boolean; quoteId?: string; originalTweet?: string }> {
    try {
      // Check kill switch
      if (await isBotDisabled()) {
        console.log('🛑 Bot disabled, skipping quote tweet generation');
        return { success: false };
      }

      console.log('💬 QuoteAgent: Finding high-engagement tweet to quote...');

      // Find a high-engagement tweet about AI health
      const targetTweet = await this.findHighEngagementTweet();
      if (!targetTweet) {
        console.log('🔍 No suitable high-engagement tweet found');
        return { success: false };
      }

      // Generate commentary
      const commentary = await this.generateCommentary(targetTweet);
      if (!commentary) {
        console.log('❌ Failed to generate commentary');
        return { success: false };
      }

      // Post quote tweet
      const quoteId = await this.postQuoteTweet(commentary, targetTweet.id);
      if (!quoteId) {
        console.log('❌ Failed to post quote tweet');
        return { success: false };
      }

      console.log(`✅ Quote tweet posted: ${quoteId} quoting ${targetTweet.id}`);
      return { success: true, quoteId, originalTweet: targetTweet.text };

    } catch (error) {
      console.error('❌ QuoteAgent error:', error);
      return { success: false };
    }
  }

  private async findHighEngagementTweet(): Promise<any> {
    try {
      // Search for recent tweets about AI health with good engagement
      const searchQueries = [
        'AI health -is:retweet lang:en',
        'artificial intelligence healthcare -is:retweet lang:en',
        'machine learning medicine -is:retweet lang:en',
        'digital health AI -is:retweet lang:en'
      ];

      for (const query of searchQueries) {
        const result = await safeRead(async () => {
          return await this.twitterClient.v2.search(query, {
            max_results: 20,
            'tweet.fields': ['public_metrics', 'created_at', 'author_id'],
            'user.fields': ['verified', 'public_metrics']
          });
        });

        if (!result || !result.data) continue;

        // Filter for high engagement tweets
        const tweets = Array.isArray(result.data) ? result.data : [result.data];
        const highEngagementTweets = tweets.filter((tweet: any) => {
          const metrics = tweet.publicMetrics;
          const engagementScore = (metrics.like_count * 1) + 
                                 (metrics.retweet_count * 2) + 
                                 (metrics.reply_count * 3);
          
          return engagementScore >= 10 && // Minimum engagement threshold
                 tweet.text.length > 50 && // Substantial content
                 !tweet.text.includes('@' + process.env.BOT_USERNAME) && // Not mentioning us
                 this.isRelevantContent(tweet.text);
        });

        if (highEngagementTweets.length > 0) {
          // Sort by engagement and pick randomly from top 3
          highEngagementTweets.sort((a: any, b: any) => {
            const scoreA = (a.publicMetrics.like_count * 1) + 
                          (a.publicMetrics.retweet_count * 2) + 
                          (a.publicMetrics.reply_count * 3);
            const scoreB = (b.publicMetrics.like_count * 1) + 
                          (b.publicMetrics.retweet_count * 2) + 
                          (b.publicMetrics.reply_count * 3);
            return scoreB - scoreA;
          });

          const topTweets = highEngagementTweets.slice(0, 3);
          return topTweets[Math.floor(Math.random() * topTweets.length)];
        }
      }

      return null;

    } catch (error) {
      console.error('Error finding high engagement tweet:', error);
      return null;
    }
  }

  private isRelevantContent(text: string): boolean {
    const healthTechKeywords = [
      'AI', 'artificial intelligence', 'machine learning', 'healthcare', 'medical',
      'health tech', 'digital health', 'telemedicine', 'diagnosis', 'treatment',
      'patient', 'clinical', 'research', 'innovation', 'technology'
    ];

    const lowerText = text.toLowerCase();
    return healthTechKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
  }

  private async generateCommentary(tweet: any): Promise<string | null> {
    try {
      const prompt = `
Write a 120-character professional commentary for this health tech tweet. Be:
- Insightful and add value to the conversation
- Professional but engaging
- Focused on implications for healthcare professionals
- Supportive of innovation while being realistic

Original tweet: "${tweet.text}"

Commentary (max 120 chars):
`;

      const response = await this.openaiService.generateCompletion(prompt, {
        maxTokens: 100,
        temperature: 0.7
      });

      const commentary = response.trim();
      
      // Validate length
      if (commentary.length > 120) {
        // Truncate intelligently
        const truncated = commentary.substring(0, 117) + '...';
        return truncated;
      }

      return commentary;

    } catch (error) {
      console.error('Error generating commentary:', error);
      return null;
    }
  }

  private async postQuoteTweet(commentary: string, originalTweetId: string): Promise<string | null> {
    try {
      const result = await safeWrite(async () => {
        return await this.twitterClient.v2.tweet({
          text: commentary,
          quote_tweet_id: originalTweetId
        });
      });

      if (!result) {
        return null;
      }

      // Store quote tweet info
      await this.storeQuoteTweetInfo(result.data.id, commentary, originalTweetId);

      return result.data.id;

    } catch (error) {
      console.error('Error posting quote tweet:', error);
      return null;
    }
  }

  private async storeQuoteTweetInfo(quoteId: string, commentary: string, originalTweetId: string): Promise<void> {
    try {
      await supabaseClient.supabase
        ?.from('tweets')
        .insert({
          tweet_id: quoteId,
          content: commentary,
          posted_at: new Date().toISOString(),
          content_type: 'quote_tweet',
          quality_score: 70, // Quote tweets generally have decent engagement
          variant: 'quote',
          metadata: JSON.stringify({
            quoted_tweet_id: originalTweetId,
            commentary_length: commentary.length
          })
        });
    } catch (error) {
      console.error('Error storing quote tweet info:', error);
    }
  }
} 