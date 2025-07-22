
import { xClient } from '../utils/xClient';
import { supabaseClient } from '../utils/supabaseClient';
import { formatTweet } from '../utils/formatTweet';
import { UltraViralGenerator } from './ultraViralGenerator';
import { openaiClient } from '../utils/openaiClient';
import { LIVE_MODE } from '../config/liveMode';

export interface PostResult {
  success: boolean;
  tweetId?: string;
  content?: string;
  hasImage?: boolean;
  error?: string;
}

export class PostTweetAgent {
  private viralGenerator: UltraViralGenerator;

  constructor() {
    this.viralGenerator = new UltraViralGenerator();
  }

  async run(force: boolean = false, testMode: boolean = false): Promise<PostResult> {
    try {
      console.log('🐦 PostTweetAgent starting...');
      
      // Generate viral content
      const viralResult = await this.viralGenerator.generateViralTweet();
      let content = viralResult.content || 'Health tech breakthrough happening now! The future of medicine is here.';
      
      // Format content
      const formatted = formatTweet(content);
      content = formatted.content || content;
      
      // Post to Twitter if live mode
      if (LIVE_MODE && !testMode) {
        const result = await xClient.postTweet(content);
        
        if (result.success) {
          // Save to database
          try {
            await supabaseClient.supabase
              ?.from('tweets')
              .insert({
                tweet_id: result.tweetId,
                content: content,
                tweet_type: 'viral',
                created_at: new Date().toISOString()
              });
          } catch (dbError) {
            console.warn('Database save failed:', dbError);
          }
          
          return {
            success: true,
            tweetId: result.tweetId,
            content: content
          };
        } else {
          return {
            success: false,
            error: result.error || 'Failed to post tweet'
          };
        }
      } else {
        console.log('🧪 DRY RUN - Tweet preview:', content);
        return {
          success: true,
          content: content
        };
      }
    } catch (error) {
      console.error('PostTweetAgent error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
