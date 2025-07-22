
import { xClient } from '../utils/xClient';
import { supabaseClient } from '../utils/supabaseClient';
import { formatTweet } from '../utils/formatTweet';
import { SimpleViralHealthGenerator } from './simpleViralHealthGenerator';
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
  private simpleHealthGenerator: SimpleViralHealthGenerator;
  private viralGenerator: UltraViralGenerator;

  constructor() {
    this.simpleHealthGenerator = new SimpleViralHealthGenerator();
    this.viralGenerator = new UltraViralGenerator();
  }

  async run(force: boolean = false, testMode: boolean = false, optimizedContent?: string): Promise<PostResult> {
    try {
      console.log('🐦 PostTweetAgent starting...');
      
      let content: string;
      
      if (optimizedContent) {
        // Use content provided by the Growth Master
        console.log('🧠 Using Growth Master optimized content');
        content = optimizedContent;
      } else {
        // Generate simple viral health content by default
        console.log('🍌 Generating simple viral health content...');
        const healthContent = await this.simpleHealthGenerator.generateSimpleViralHealth();
        content = healthContent.content;
        console.log(`📊 Follow potential: ${healthContent.followGrowthPotential}%`);
      }
      
      // Format content
      const formatted = formatTweet(content);
      content = formatted.content || content;
      
      console.log(`📝 Final content: "${content}"`);
      
      // Post to Twitter if live mode
      if (LIVE_MODE && !testMode) {
        const result = await xClient.postTweet(content);
        
        if (result.success) {
          console.log(`✅ Tweet posted successfully: ${result.tweetId}`);
          
          // Save to database
          try {
            await supabaseClient.supabase
              ?.from('tweets')
              .insert({
                tweet_id: result.tweetId,
                content: content,
                tweet_type: optimizedContent ? 'intelligent' : 'simple_health',
                created_at: new Date().toISOString()
              });
            console.log('📊 Tweet saved to database');
          } catch (dbError) {
            console.warn('⚠️ Database save failed:', dbError);
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
      console.error('❌ PostTweetAgent error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
