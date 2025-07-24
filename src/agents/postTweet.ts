
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
      // Sleep & Recovery
      "Sleep in {temp}°F room with {supplement}. Core temperature drop triggers {benefit1} and improves {benefit2} by {percent}%.",
      "Wake up at {time} and get {light} within 15 minutes. {hormone} production increases {percent}% for the day.",
      
      // Exercise & Performance  
      "Exercise between {time1}-{time2} when {hormone} peaks. {metric} improves {percent}% vs other times.",
      "Rest {seconds} seconds between sets for {goal}. Shorter = {bad}, longer = {good}.",
      
      // Nutrition Timing
      "Eat protein within {minutes} minutes post-workout. Muscle synthesis increases {percent}% vs waiting.",
      "Fast for {hours} hours, break with {food}. Maintains {benefit1} while boosting {benefit2}.",
      
      // Breathing & Stress
      "Breathe {pattern} for {minutes} minutes. {benefit} improves {percent}% and {hormone} drops.",
      "{exercise} breathing before {activity}. Performance increases {percent}% from oxygen efficiency.",
      
      // Hydration & Temperature
      "Drink {amount} water upon waking. Metabolism increases {percent}% from rehydration after {hours}-hour fast.",
      "Cold exposure for {minutes} minutes daily. {hormone} increases {percent}% and fat burning improves.",
      
      // Cognitive & Focus
      "{activity} for {minutes} minutes daily. {brain_area} activity increases {percent}% within {timeframe}.",
      "Take {supplement} {timing}. Focus improves {percent}% and {side_effect} reduces.",
      
      // Hormones & Longevity
      "{activity} at {time} daily. {hormone} increases {percent}% naturally without supplements.",
      "Avoid {bad_habit} after {time}. {hormone} production improves {percent}% overnight."
    ];

    const variables = {
      temp: ['68', '65', '70', '67'],
      supplement: ['magnesium', '200mg L-theanine', 'melatonin', 'glycine'],
      benefit1: ['deep sleep', 'REM sleep', 'recovery', 'growth hormone'],
      benefit2: ['memory consolidation', 'muscle repair', 'fat burning', 'brain detox'],
      percent: ['23', '34', '45', '28', '31', '19', '42', '37'],
      
      time: ['6 AM', '7 AM', '5:30 AM', '6:30 AM'],
      time1: ['2 PM', '3 PM', '4 PM'],
      time2: ['6 PM', '7 PM', '5 PM'],
      light: ['10 minutes sunlight', 'bright light exposure', '5 minutes outdoor light'],
      hormone: ['cortisol', 'testosterone', 'growth hormone', 'insulin sensitivity'],
      
      seconds: ['90', '120', '60', '180'],
      minutes: ['30', '45', '20', '60', '15'],
      goal: ['strength', 'hypertrophy', 'power', 'endurance'],
      bad: ['incomplete recovery', 'reduced gains', 'poor form'],
      good: ['optimal adaptation', 'maximum gains', 'perfect technique'],
      
      hours: ['14', '16', '12', '18'],
      food: ['protein + fat', 'lean protein', 'MCT oil + protein', 'eggs + avocado'],
      
      pattern: ['4-7-8', 'box breathing', '4-4-4-4', '6-2-6-2'],
      exercise: ['Wim Hof', 'Box', 'Coherent', '4-7-8'],
      activity: ['meetings', 'workouts', 'studying', 'performance'],
      
      amount: ['16 oz', '20 oz', '24 oz', '500ml'],
      brain_area: ['prefrontal cortex', 'hippocampus', 'attention networks'],
      timeframe: ['2 weeks', '1 month', '10 days'],
      
      side_effect: ['brain fog', 'anxiety', 'fatigue', 'stress'],
      bad_habit: ['blue light', 'caffeine', 'large meals', 'intense exercise'],
      metric: ['VO2 max', 'power output', 'endurance', 'strength']
    };

    // Select random template
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    // Replace variables
    let content = template;
    for (const [key, values] of Object.entries(variables)) {
      const placeholder = `{${key}}`;
      if (content.includes(placeholder)) {
        const value = values[Math.floor(Math.random() * values.length)];
        content = content.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
      }
    }
    
    // Clean up any remaining placeholders
    content = content.replace(/\{[^}]+\}/g, '');
    
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
