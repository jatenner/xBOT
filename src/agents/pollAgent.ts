import { TwitterApi } from 'twitter-api-v2';
import { supabaseClient } from '../utils/supabaseClient';
import { isBotDisabled } from '../utils/flagCheck';
import { safeWrite } from '../utils/quotaGuard';
import { OpenAIService } from '../utils/openaiClient';

export class PollAgent {
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

  async run(): Promise<{ success: boolean; pollId?: string; topic?: string }> {
    try {
      // Check kill switch
      if (await isBotDisabled()) {
        console.log('🛑 Bot disabled, skipping poll generation');
        return { success: false };
      }

      // Check if we already posted a poll today
      if (await this.hasPostedPollToday()) {
        console.log('📊 Poll already posted today, skipping');
        return { success: false };
      }

      console.log('📊 PollAgent: Generating daily poll...');

      // Get trending topic for poll
      const topic = await this.getTrendingTopic();
      if (!topic) {
        console.log('📈 No suitable trending topic found for poll');
        return { success: false };
      }

      // Generate poll content
      const pollData = await this.generatePollContent(topic);
      if (!pollData) {
        console.log('❌ Failed to generate poll content');
        return { success: false };
      }

      // Post poll
      const pollId = await this.postPoll(pollData);
      if (!pollId) {
        console.log('❌ Failed to post poll');
        return { success: false };
      }

      console.log(`✅ Poll posted successfully: ${pollId} on topic: ${topic}`);
      return { success: true, pollId, topic };

    } catch (error) {
      console.error('❌ PollAgent error:', error);
      return { success: false };
    }
  }

  private async hasPostedPollToday(): Promise<boolean> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabaseClient.supabase
        ?.from('tweets')
        .select('id')
        .eq('content_type', 'poll')
        .gte('posted_at', `${today}T00:00:00.000Z`)
        .limit(1);

      return !error && data && data.length > 0;
    } catch (error) {
      console.error('Error checking daily poll status:', error);
      return false;
    }
  }

  private async getTrendingTopic(): Promise<string | null> {
    try {
      // Get trending topics from our trend analysis
      const { data, error } = await supabaseClient.supabase
        ?.from('trend_analysis')
        .select('topic, relevance_score')
        .gte('relevance_score', 0.8)
        .order('relevance_score', { ascending: false })
        .limit(10);

      if (error || !data || data.length === 0) {
        // Fallback to predefined health tech topics
        const fallbackTopics = [
          'AI in Healthcare',
          'Digital Therapeutics',
          'Telemedicine',
          'Health Data Privacy',
          'Medical AI Ethics',
          'Remote Patient Monitoring',
          'Healthcare Automation',
          'Precision Medicine'
        ];
        return fallbackTopics[Math.floor(Math.random() * fallbackTopics.length)];
      }

      // Pick a random topic from top trending
      const topTopics = data.slice(0, 5);
      return topTopics[Math.floor(Math.random() * topTopics.length)].topic;

    } catch (error) {
      console.error('Error getting trending topic:', error);
      return 'Healthcare Innovation';
    }
  }

  private async generatePollContent(topic: string): Promise<any> {
    try {
      const prompt = `
Create a Twitter poll about "${topic}" for health professionals. Include:
- A compelling question (under 200 chars to leave room for poll options)
- 4 poll options (each under 25 characters)
- Make it thought-provoking and relevant to healthcare professionals
- Focus on practical implications or future predictions

Format as JSON:
{
  "question": "Your poll question here",
  "options": ["Option 1", "Option 2", "Option 3", "Option 4"]
}
`;

      const response = await this.openaiService.generateCompletion(prompt, {
        maxTokens: 300,
        temperature: 0.8
      });

      try {
        const pollData = JSON.parse(response);
        
        // Validate poll data
        if (!pollData.question || !pollData.options || pollData.options.length !== 4) {
          throw new Error('Invalid poll format');
        }

        // Validate option lengths
        const validOptions = pollData.options.every((opt: string) => opt.length <= 25);
        if (!validOptions) {
          throw new Error('Poll options too long');
        }

        return pollData;

      } catch (parseError) {
        console.error('Error parsing poll JSON:', parseError);
        return null;
      }

    } catch (error) {
      console.error('Error generating poll content:', error);
      return null;
    }
  }

  private async postPoll(pollData: any): Promise<string | null> {
    try {
      const result = await safeWrite(async () => {
        return await this.twitterClient.v2.tweet({
          text: pollData.question,
          poll: {
            duration_minutes: 1440, // 24 hours
            options: pollData.options
          }
        });
      });

      if (!result) {
        return null;
      }

      // Store poll info
      await this.storePollInfo(result.data.id, pollData);

      return result.data.id;

    } catch (error) {
      console.error('Error posting poll:', error);
      return null;
    }
  }

  private async storePollInfo(pollId: string, pollData: any): Promise<void> {
    try {
      await supabaseClient.supabase
        ?.from('tweets')
        .insert({
          tweet_id: pollId,
          content: pollData.question,
          posted_at: new Date().toISOString(),
          content_type: 'poll',
          quality_score: 80, // Polls generally have good engagement
          variant: 'poll',
          metadata: JSON.stringify({
            poll_options: pollData.options,
            duration_hours: 24
          })
        });
    } catch (error) {
      console.error('Error storing poll info:', error);
    }
  }
} 