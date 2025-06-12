import { xClient } from '../utils/xClient';
import dotenv from 'dotenv';
import { PostTweetAgent } from './postTweet';
import { ReplyAgent } from './replyAgent';
import { ThreadAgent } from './threadAgent';

dotenv.config();

interface EngagementWindow {
  hour: number;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  multiplier: number;
  description: string;
}

interface StrategistDecision {
  action: 'post' | 'reply' | 'thread' | 'sleep';
  priority: number;
  reasoning: string;
  expectedEngagement: number;
  contentType?: string;
}

export class StrategistAgent {
  private lastPostTime: number = 0;
  private postCount24h: number = 0;
  private lastResetTime: number = Date.now();
  private postTweetAgent: PostTweetAgent;
  private replyAgent: ReplyAgent;
  private threadAgent: ThreadAgent;

  // Enhanced engagement windows for 10X results
  private readonly PEAK_ENGAGEMENT_WINDOWS: EngagementWindow[] = [
    // Weekday morning peak (healthcare professionals check feeds)
    { hour: 8, dayOfWeek: 1, multiplier: 1.4, description: 'Monday morning healthcare professional peak' },
    { hour: 9, dayOfWeek: 1, multiplier: 1.6, description: 'Monday morning prime time' },
    { hour: 10, dayOfWeek: 1, multiplier: 1.4, description: 'Monday late morning' },
    { hour: 8, dayOfWeek: 2, multiplier: 1.3, description: 'Tuesday morning engagement' },
    { hour: 9, dayOfWeek: 2, multiplier: 1.5, description: 'Tuesday morning peak' },
    { hour: 10, dayOfWeek: 2, multiplier: 1.3, description: 'Tuesday late morning' },
    { hour: 8, dayOfWeek: 3, multiplier: 1.3, description: 'Wednesday morning engagement' },
    { hour: 9, dayOfWeek: 3, multiplier: 1.5, description: 'Wednesday morning peak' },
    { hour: 10, dayOfWeek: 3, multiplier: 1.3, description: 'Wednesday late morning' },
    { hour: 8, dayOfWeek: 4, multiplier: 1.3, description: 'Thursday morning engagement' },
    { hour: 9, dayOfWeek: 4, multiplier: 1.5, description: 'Thursday morning peak' },
    { hour: 10, dayOfWeek: 4, multiplier: 1.3, description: 'Thursday late morning' },
    { hour: 8, dayOfWeek: 5, multiplier: 1.2, description: 'Friday morning engagement' },
    { hour: 9, dayOfWeek: 5, multiplier: 1.3, description: 'Friday morning peak' },
    { hour: 10, dayOfWeek: 5, multiplier: 1.2, description: 'Friday late morning' },

    // Lunch break engagement 
    { hour: 12, dayOfWeek: 1, multiplier: 1.2, description: 'Monday lunch break' },
    { hour: 13, dayOfWeek: 1, multiplier: 1.3, description: 'Monday lunch peak' },
    { hour: 12, dayOfWeek: 2, multiplier: 1.3, description: 'Tuesday lunch break' },
    { hour: 13, dayOfWeek: 2, multiplier: 1.4, description: 'Tuesday lunch peak' },
    { hour: 12, dayOfWeek: 3, multiplier: 1.4, description: 'Wednesday lunch break' },
    { hour: 13, dayOfWeek: 3, multiplier: 1.5, description: 'Wednesday lunch peak' },
    { hour: 12, dayOfWeek: 4, multiplier: 1.3, description: 'Thursday lunch break' },
    { hour: 13, dayOfWeek: 4, multiplier: 1.4, description: 'Thursday lunch peak' },
    { hour: 12, dayOfWeek: 5, multiplier: 1.2, description: 'Friday lunch break' },
    { hour: 13, dayOfWeek: 5, multiplier: 1.3, description: 'Friday lunch peak' },

    // Evening engagement (after-work news consumption)
    { hour: 18, dayOfWeek: 1, multiplier: 1.3, description: 'Monday evening after-work' },
    { hour: 19, dayOfWeek: 1, multiplier: 1.4, description: 'Monday evening peak' },
    { hour: 18, dayOfWeek: 2, multiplier: 1.4, description: 'Tuesday evening after-work' },
    { hour: 19, dayOfWeek: 2, multiplier: 1.5, description: 'Tuesday evening peak' },
    { hour: 18, dayOfWeek: 3, multiplier: 1.4, description: 'Wednesday evening after-work' },
    { hour: 19, dayOfWeek: 3, multiplier: 1.5, description: 'Wednesday evening peak' },
    { hour: 18, dayOfWeek: 4, multiplier: 1.3, description: 'Thursday evening after-work' },
    { hour: 19, dayOfWeek: 4, multiplier: 1.4, description: 'Thursday evening peak' },

    // Weekend patterns (lighter engagement but quality audience)
    { hour: 10, dayOfWeek: 0, multiplier: 1.2, description: 'Sunday morning leisure reading' },
    { hour: 11, dayOfWeek: 0, multiplier: 1.3, description: 'Sunday late morning' },
    { hour: 15, dayOfWeek: 0, multiplier: 1.1, description: 'Sunday afternoon' },
    { hour: 10, dayOfWeek: 6, multiplier: 1.1, description: 'Saturday morning' },
    { hour: 11, dayOfWeek: 6, multiplier: 1.2, description: 'Saturday late morning' },

    // THREAD-SPECIFIC WINDOWS (10X engagement potential)
    { hour: 9, dayOfWeek: 1, multiplier: 2.5, description: 'THREAD WINDOW: Monday morning viral potential' },
    { hour: 13, dayOfWeek: 2, multiplier: 2.8, description: 'THREAD WINDOW: Tuesday lunch viral window' },
    { hour: 9, dayOfWeek: 3, multiplier: 2.6, description: 'THREAD WINDOW: Wednesday morning breakthrough' },
    { hour: 19, dayOfWeek: 4, multiplier: 2.4, description: 'THREAD WINDOW: Thursday evening analysis' }
  ];

  constructor() {
    this.postTweetAgent = new PostTweetAgent();
    this.replyAgent = new ReplyAgent();
    this.threadAgent = new ThreadAgent();
  }

  async run(): Promise<StrategistDecision> {
    console.log('🧠 === Strategist Cycle Started ===');
    
    // Get current time context
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();
    const timeStr = now.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
    
    console.log(`🧠 StrategistAgent: Analyzing current situation...`);
    console.log(`📅 Current time: ${timeStr}, Day: ${currentDay}, Hour: ${currentHour}`);

    // Reset daily counter if needed
    this.resetDailyCounterIfNeeded();

    // Get current engagement context
    const engagementContext = this.getCurrentEngagementContext(currentHour, currentDay);
    console.log(`🎯 ${engagementContext.description} (${engagementContext.multiplier}x)`);

    // Make intelligent decision based on context
    const decision = await this.makeStrategicDecision(engagementContext, now);
    
    console.log(`🚀 Decision: ${decision.action.toUpperCase()} - ${decision.reasoning} (${decision.expectedEngagement.toFixed(2)}x)`);
    console.log(`Decision: ${decision.action} (priority: ${decision.priority})`);
    
    return decision;
  }

  private async makeStrategicDecision(engagementContext: EngagementWindow, now: Date): Promise<StrategistDecision> {
    const timeSinceLastPost = now.getTime() - this.lastPostTime;
    const minutesSinceLastPost = timeSinceLastPost / (1000 * 60);
    
    // 10X ENGAGEMENT STRATEGY: THREAD WINDOWS
    if (engagementContext.multiplier >= 2.4) {
      return {
        action: 'thread',
        priority: 10,
        reasoning: `THREAD OPPORTUNITY - ${engagementContext.description} - 10X viral potential`,
        expectedEngagement: engagementContext.multiplier * 4, // Threads get 4x base engagement
        contentType: 'viral_thread'
      };
    }

    // HIGH ENGAGEMENT WINDOWS (1.3x+): POST original content for maximum viral potential
    if (engagementContext.multiplier >= 1.3) {
      // Don't spam - ensure quality over quantity
      if (minutesSinceLastPost >= 30) { // 30 min minimum
        return {
          action: 'post',
          priority: 9,
          reasoning: `PEAK ENGAGEMENT WINDOW - ${engagementContext.description} - maximum viral potential`,
          expectedEngagement: engagementContext.multiplier,
          contentType: 'original_research'
        };
      } else {
        // Recently posted, but still high engagement - look for reply opportunities
        return {
          action: 'reply',
          priority: 7,
          reasoning: `High engagement window but posted recently (${minutesSinceLastPost.toFixed(0)}m ago) - engaging in conversations`,
          expectedEngagement: engagementContext.multiplier * 0.6,
          contentType: 'expert_reply'
        };
      }
    }

    // GOOD ENGAGEMENT (1.1x+): Strategic choice
    if (engagementContext.multiplier >= 1.1) {
      if (minutesSinceLastPost >= 90) { // 1.5 hours for good windows
        return {
          action: 'post',
          priority: 6,
          reasoning: `Good engagement window with sufficient cooldown - posting quality content`,
          expectedEngagement: engagementContext.multiplier,
          contentType: 'current_events'
        };
      } else {
        return {
          action: 'reply',
          priority: 5,
          reasoning: `Good engagement, building community through replies`,
          expectedEngagement: engagementContext.multiplier * 0.7,
          contentType: 'value_add_reply'
        };
      }
    }

    // DECENT ENGAGEMENT (0.7x+): Careful strategy
    if (engagementContext.multiplier >= 0.7) {
      // Check daily limits
      if (this.postCount24h >= 8) {
        return {
          action: 'reply',
          priority: 4,
          reasoning: `Daily post limit reached (${this.postCount24h}/8) - focusing on replies`,
          expectedEngagement: engagementContext.multiplier * 0.5,
          contentType: 'community_engagement'
        };
      }

      if (minutesSinceLastPost >= 120) { // 2 hours
        return {
          action: 'post',
          priority: 4,
          reasoning: `Decent timing with good cooldown - quality over quantity`,
          expectedEngagement: engagementContext.multiplier,
          contentType: 'informational'
        };
      } else {
        return {
          action: 'reply',
          priority: 3,
          reasoning: `Decent engagement - replying to maintain presence`,
          expectedEngagement: engagementContext.multiplier * 0.6,
          contentType: 'discussion_participant'
        };
      }
    }

    // MEDIUM ENGAGEMENT (0.5x+): Reply focus during business hours
    if (engagementContext.multiplier >= 0.5 && this.isBusinessHours(now)) {
      return {
        action: 'reply',
        priority: 3,
        reasoning: `Medium engagement but business hours - community building through replies`,
        expectedEngagement: engagementContext.multiplier * 0.4,
        contentType: 'professional_reply'
      };
    }

    // LOW ENGAGEMENT: Sleep until better timing
    return {
      action: 'sleep',
      priority: 1,
      reasoning: `Low engagement window (${engagementContext.multiplier}x) - waiting for better timing`,
      expectedEngagement: 0,
      contentType: 'none'
    };
  }

  private getCurrentEngagementContext(hour: number, dayOfWeek: number): EngagementWindow {
    // Find the most specific engagement window for current time
    const matchingWindows = this.PEAK_ENGAGEMENT_WINDOWS.filter(
      window => window.hour === hour && window.dayOfWeek === dayOfWeek
    );

    if (matchingWindows.length > 0) {
      // Return the highest multiplier if multiple windows match
      return matchingWindows.reduce((highest, current) => 
        current.multiplier > highest.multiplier ? current : highest
      );
    }

    // Default baseline engagement
    return {
      hour,
      dayOfWeek,
      multiplier: 0.4,
      description: 'Baseline engagement window'
    };
  }

  private isBusinessHours(now: Date): boolean {
    const hour = now.getHours();
    const day = now.getDay();
    
    // Monday-Friday, 9 AM - 6 PM
    return day >= 1 && day <= 5 && hour >= 9 && hour <= 18;
  }

  private resetDailyCounterIfNeeded(): void {
    const now = Date.now();
    const timeSinceReset = now - this.lastResetTime;
    const hoursElapsed = timeSinceReset / (1000 * 60 * 60);

    if (hoursElapsed >= 24) {
      this.postCount24h = 0;
      this.lastResetTime = now;
      console.log('🔄 Daily post counter reset');
    }
  }

  // Public method for scheduler to execute decisions
  async executeDecision(decision: StrategistDecision): Promise<any> {
    try {
      console.log(`📝 Executing ${decision.action} action...`);

      switch (decision.action) {
        case 'post':
          const postResult = await this.postTweetAgent.run(false, true);
          
          if (postResult.success) {
            this.lastPostTime = Date.now();
            this.postCount24h++;
            console.log(`✅ Tweet posted: ${postResult.tweetId}`);
            console.log(`Content: ${postResult.content}`);
          }
          
          return postResult;

        case 'thread':
          console.log('🧵 Generating viral thread...');
          const threadContent = await this.threadAgent.generateViralThread();
          
          console.log(`🎯 Thread Quality: ${threadContent.qualityScore}/100`);
          console.log(`📈 Predicted Engagement: ${threadContent.predictedEngagement}% (10X TARGET)`);
          
          const threadIds = await this.threadAgent.postThread(threadContent);
          
          if (threadIds.length > 0) {
            this.lastPostTime = Date.now();
            this.postCount24h++; // Threads count as one post for rate limiting
            console.log(`✅ Thread posted: ${threadIds[0]} (${threadIds.length} tweets)`);
            console.log(`Hook: ${threadContent.hookTweet}`);
          }
          
          return {
            success: threadIds.length > 0,
            threadId: threadIds[0],
            tweetIds: threadIds,
            content: threadContent.hookTweet,
            qualityScore: threadContent.qualityScore,
            predictedEngagement: threadContent.predictedEngagement
          };

        case 'reply':
          const replyResult = await this.replyAgent.run();
          
          if (replyResult.success) {
            console.log(`✅ Reply posted: ${replyResult.replyId}`);
            console.log(`Replied to: ${replyResult.targetTweetId}`);
          }
          
          return replyResult;

        case 'sleep':
          console.log('😴 Sleeping - waiting for better engagement window');
          return {
            success: true,
            action: 'sleep',
            reasoning: decision.reasoning
          };

        default:
          throw new Error(`Unknown action: ${decision.action}`);
      }

    } catch (error) {
      console.error(`❌ Failed to execute ${decision.action}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
} 