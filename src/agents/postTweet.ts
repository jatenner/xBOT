
import { xClient } from '../utils/xClient';
import { minimalSupabaseClient } from '../utils/minimalSupabaseClient';
import { formatTweet } from '../utils/formatTweet';
import { SimpleViralHealthGenerator } from './simpleViralHealthGenerator';
import { LIVE_MODE } from '../config/liveMode';

export interface PostResult {
  success: boolean;
  tweetId?: string;
  content?: string;
  hasImage?: boolean;
  error?: string;
  budgetStatus?: string;
}

export class PostTweetAgent {
  private simpleHealthGenerator: SimpleViralHealthGenerator;
  private dailyPostCount = 0;
  private lastResetDate: string | null = null;
  private maxDailyPosts = 20; // Safety limit (higher than scheduler's 17)
  private estimatedCostPerPost = 0.15; // Conservative estimate
  private maxDailyBudget = 3.00; // Conservative daily budget

  constructor() {
    this.simpleHealthGenerator = new SimpleViralHealthGenerator();
    this.resetDailyCountIfNeeded();
  }

  private resetDailyCountIfNeeded(): void {
    const today = new Date().toDateString();
    if (this.lastResetDate !== today) {
      this.dailyPostCount = 0;
      this.lastResetDate = today;
      console.log('💰 Daily budget counter reset');
    }
  }

  private checkBudgetLimits(): { canPost: boolean; reason?: string } {
    this.resetDailyCountIfNeeded();
    
    // Check post count limit
    if (this.dailyPostCount >= this.maxDailyPosts) {
      return {
        canPost: false,
        reason: `Daily post limit reached (${this.dailyPostCount}/${this.maxDailyPosts})`
      };
    }

    // Check estimated budget
    const estimatedDailyCost = (this.dailyPostCount + 1) * this.estimatedCostPerPost;
    if (estimatedDailyCost > this.maxDailyBudget) {
      return {
        canPost: false,
        reason: `Daily budget would be exceeded ($${estimatedDailyCost.toFixed(2)} > $${this.maxDailyBudget})`
      };
    }

    return { canPost: true };
  }

  async run(force: boolean = false, testMode: boolean = false, optimizedContent?: string): Promise<PostResult> {
    try {
      console.log('🐦 PostTweetAgent starting...');

      // Check budget limits unless forced
      if (!force && !testMode) {
        const budgetCheck = this.checkBudgetLimits();
        if (!budgetCheck.canPost) {
          console.warn(`💰 Budget limit check failed: ${budgetCheck.reason}`);
          return {
            success: false,
            error: budgetCheck.reason,
            budgetStatus: 'LIMIT_EXCEEDED'
          };
        }
        
        console.log(`💰 Budget check passed: ${this.dailyPostCount + 1}/${this.maxDailyPosts} posts, ~$${((this.dailyPostCount + 1) * this.estimatedCostPerPost).toFixed(2)}/$${this.maxDailyBudget}`);
      }

      let content: string;

      if (optimizedContent) {
        console.log('🧠 Using provided optimized content');
        content = optimizedContent;
      } else {
        // Generate viral health content (ANY type that gets followers)
        console.log('🔥 Generating viral health content for maximum followers...');
        const healthContent = await this.simpleHealthGenerator.generateSimpleViralHealth();
        content = healthContent.content;
        console.log(`📊 Content type: ${healthContent.contentType}`);
        console.log(`📈 Follow potential: ${healthContent.followGrowthPotential}%`);
        console.log(`🎯 Engagement hooks: ${healthContent.engagementHooks.join(', ')}`);
      }

      // Format content
      try {
        const formatted = formatTweet(content);
        content = formatted.content || content;
      } catch (error) {
        console.warn('⚠️ Format tweet failed, using original content');
      }

      console.log(`📝 Final content: "${content}"`);

      // Post to Twitter if live mode
      if (LIVE_MODE && !testMode) {
        const result = await xClient.postTweet(content);

        if (result.success) {
          // Increment daily counter
          this.dailyPostCount++;
          
          console.log(`✅ Tweet posted successfully: ${result.tweetId}`);
          console.log(`💰 Daily usage: ${this.dailyPostCount}/${this.maxDailyPosts} posts, estimated cost: $${(this.dailyPostCount * this.estimatedCostPerPost).toFixed(2)}`);

          // Save to database
          try {
            if (minimalSupabaseClient.supabase) {
              await minimalSupabaseClient.supabase
                .from('tweets')
                .insert({
                  tweet_id: result.tweetId,
                  content: content,
                  tweet_type: optimizedContent ? 'intelligent' : 'simple_health',
                  created_at: new Date().toISOString()
                });
              console.log('📊 Tweet saved to database');
            }
          } catch (dbError) {
            console.warn('⚠️ Database save failed:', dbError);
          }

          return {
            success: true,
            tweetId: result.tweetId,
            content: content,
            budgetStatus: `${this.dailyPostCount}/${this.maxDailyPosts} posts used`
          };
        } else {
          return {
            success: false,
            error: result.error || 'Failed to post tweet',
            budgetStatus: `${this.dailyPostCount}/${this.maxDailyPosts} posts used`
          };
        }
      } else {
        console.log('🧪 DRY RUN - Tweet preview:', content);
        return {
          success: true,
          content: content,
          budgetStatus: testMode ? 'TEST_MODE' : 'DRY_RUN'
        };
      }
    } catch (error) {
      console.error('❌ PostTweetAgent error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        budgetStatus: `${this.dailyPostCount}/${this.maxDailyPosts} posts used`
      };
    }
  }

  // Method to get current budget status
  getBudgetStatus() {
    this.resetDailyCountIfNeeded();
    return {
      dailyPostCount: this.dailyPostCount,
      maxDailyPosts: this.maxDailyPosts,
      estimatedDailyCost: this.dailyPostCount * this.estimatedCostPerPost,
      maxDailyBudget: this.maxDailyBudget,
      remainingPosts: this.maxDailyPosts - this.dailyPostCount,
      remainingBudget: this.maxDailyBudget - (this.dailyPostCount * this.estimatedCostPerPost)
    };
  }
}
