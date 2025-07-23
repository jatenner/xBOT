
import { xClient } from '../utils/xClient';
import { minimalSupabaseClient } from '../utils/minimalSupabaseClient';
import { formatTweet } from '../utils/formatTweet';
import { SimpleViralHealthGenerator } from './simpleViralHealthGenerator';
import { DiverseContentAgent } from './diverseContentAgent';
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
  private diverseContentAgent: DiverseContentAgent;
  private dailyPostCount = 0;
  private lastResetDate: string | null = null;
  private maxDailyPosts = 20; // Safety limit (higher than scheduler's 17)
  private estimatedCostPerPost = 0.15; // Conservative estimate
  private maxDailyBudget = 3.00; // Conservative daily budget

  constructor() {
    this.simpleHealthGenerator = new SimpleViralHealthGenerator();
    this.diverseContentAgent = new DiverseContentAgent();
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

  private async generateSimpleDiverseContent(): Promise<string> {
    const templates = [
      "Take {amount} {supplement} {timing}. Most people are deficient and it improves {benefit} by {percent}%.",
      "Exercise between {time} when {hormone} peaks. {effect} is highest and performance improves {percent}%.",
      "New {source} study: {action} {result}. Even {minimal} helps.",
      "{nutrient}: {amount} with {cofactor} in the {timing}. Without {cofactor}, {problem}.",
      "Breathe through your nose during exercise. Increases {metric} by {percent}% vs mouth breathing.",
      "Sleep in {temp}°F room. Core temperature drop triggers {benefit1} and {benefit2}.",
      "Fast for {hours} hours but break it with {macros}. Maintains {goal1} while {goal2}."
    ];

    const variables = {
      amount: ['2g', '5g', '1000mg', '4000 IU', '200mg', '3g'],
      supplement: ['magnesium glycinate', 'vitamin D', 'omega-3', 'creatine', 'zinc', 'B12'],
      timing: ['30 minutes before bed', 'in the morning', 'with dinner', 'post-workout', 'on empty stomach'],
      benefit: ['deep sleep', 'energy levels', 'recovery', 'focus', 'muscle growth', 'fat burning'],
      percent: ['23', '40', '15', '300', '50', '67', '85'],
      time: ['6-8 AM', '2-4 PM', 'evening', 'morning'],
      hormone: ['cortisol', 'testosterone', 'growth hormone', 'insulin'],
      effect: ['Testosterone', 'Focus', 'Energy', 'Recovery'],
      source: ['Harvard', 'Stanford', 'Japanese', 'MIT', 'Mayo Clinic'],
      action: ['5 minutes of morning sunlight', 'walking after meals', 'cold exposure'],
      result: ['regulates circadian rhythm better than melatonin', 'reduces blood sugar spikes by 45%'],
      minimal: ['2 minutes', '30 seconds', '10 minutes'],
      nutrient: ['Vitamin D', 'Magnesium', 'Omega-3', 'Creatine'],
      cofactor: ['K2', 'magnesium', 'healthy fats', 'vitamin C'],
      problem: ['calcium goes to arteries instead of bones', 'absorption drops 70%'],
      metric: ['oxygen efficiency', 'performance', 'endurance'],
      temp: ['67', '65', '68'],
      benefit1: ['deeper sleep', 'better recovery', 'growth hormone release'],
      benefit2: ['fat burning', 'muscle repair', 'immune function'],
      hours: ['16', '18', '12', '14'],
      macros: ['protein + fat', 'healthy fats', 'lean protein'],
      goal1: ['muscle', 'energy', 'metabolism'],
      goal2: ['burning fat', 'staying alert', 'losing weight']
    };

    const template = templates[Math.floor(Math.random() * templates.length)];
    let content = template;

    // Replace placeholders with random values
    for (const [key, values] of Object.entries(variables)) {
      const placeholder = `{${key}}`;
      if (content.includes(placeholder)) {
        const randomValue = values[Math.floor(Math.random() * values.length)];
        content = content.replace(placeholder, randomValue);
      }
    }

    return content;
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
        // Use diverse content agent to prevent repetition
        console.log('🎨 Generating diverse, non-repetitive health content...');
        
        // Check content variety first
        const variety = await this.diverseContentAgent.getContentVariety();
        console.log(`📊 Content variety score: ${(variety.varietyScore * 100).toFixed(1)}%`);
        
        // Generate diverse content
        const diverseContent = await this.diverseContentAgent.generateDiverseContent();
        
        if (diverseContent.success && diverseContent.content && diverseContent.content.length > 50) {
          content = diverseContent.content;
          console.log(`📊 Content type: ${diverseContent.type}`);
          console.log(`🎯 Non-repetitive content generated`);
          console.log(`📝 Content preview: "${diverseContent.content.substring(0, 100)}..."`);
        } else {
          // Log the error for debugging
          console.error('❌ Diverse content generation failed:', diverseContent.error || 'Content too short or empty');
          console.log('🔄 Trying direct diverse content generation...');
          
          // Try a direct, simple approach
          try {
            const directContent = await this.generateSimpleDiverseContent();
            if (directContent && directContent.length > 50) {
              content = directContent;
              console.log(`✅ Direct diverse content generated: "${directContent.substring(0, 100)}..."`);
            } else {
              throw new Error('Direct generation failed');
            }
          } catch (directError) {
            // Last resort fallback
            console.warn('⚠️ All diverse content methods failed, using fallback generator');
            const healthContent = await this.simpleHealthGenerator.generateSimpleViralHealth();
            content = healthContent.content;
            console.log(`📊 Fallback content type: ${healthContent.contentType}`);
          }
        }
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
