import { PostTweetAgent } from './postTweet';
import { supabase } from '../utils/supabaseClient';

export class QuickPostModeAgent {
  private postTweetAgent: PostTweetAgent;
  private lastPostTime: number = 0;

  constructor() {
    this.postTweetAgent = new PostTweetAgent();
  }

  async run(): Promise<void> {
    try {
      console.log('🚀 === QUICK POST MODE ACTIVATED ===');
      console.log('📊 High-frequency posting for maximum engagement');

      // Check minimum interval (30 minutes for aggressive posting)
      const now = Date.now();
      const timeSinceLastPost = now - this.lastPostTime;
      const minInterval = 30 * 60 * 1000; // 30 minutes

      if (timeSinceLastPost < minInterval && this.lastPostTime > 0) {
        const waitTime = Math.ceil((minInterval - timeSinceLastPost) / 60000);
        console.log(`⏰ Waiting ${waitTime} minutes before next post`);
        return;
      }

      // Get latest post from database to check actual timing
      const { data: latestTweet } = await supabase
        .from('tweets')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (latestTweet) {
        const dbLastPost = new Date(latestTweet.created_at).getTime();
        const actualTimeSince = now - dbLastPost;
        
        if (actualTimeSince < minInterval) {
          const waitTime = Math.ceil((minInterval - actualTimeSince) / 60000);
          console.log(`⏰ Last DB tweet ${Math.ceil(actualTimeSince/60000)} min ago, waiting ${waitTime} more minutes`);
          return;
        }
      }

      // Execute high-value post
      console.log('📝 Generating breakthrough health tech insight...');
      
      const result = await this.postTweetAgent.run();
      
      if (result.success) {
        this.lastPostTime = now;
        console.log('✅ QUICK POST SUCCESS');
        console.log(`📊 Tweet: ${result.content?.substring(0, 100)}...`);
        
        // Update activity tracking
        await this.updateActivityLog(result);
      } else {
        console.log('❌ Quick post failed:', result.error);
      }

    } catch (error) {
      console.error('❌ Quick Post Mode error:', error);
    }
  }

  private async updateActivityLog(result: any): Promise<void> {
    try {
      await supabase
        .from('bot_config')
        .upsert({
          key: 'last_quick_post',
          value: new Date().toISOString()
        });
    } catch (error) {
      console.warn('Failed to update activity log:', error);
    }
  }

  // Method to force immediate posting (bypassing timing restrictions)
  async forcePost(): Promise<any> {
    console.log('🔥 FORCE POST MODE - Bypassing all restrictions');
    
    try {
      const result = await this.postTweetAgent.run();
      this.lastPostTime = Date.now();
      
      if (result.success) {
        console.log('✅ FORCE POST SUCCESS');
        await this.updateActivityLog(result);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Force post error:', error);
      return { success: false, error: error.message };
    }
  }
} 