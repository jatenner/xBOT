import { PostTweetAgent } from './postTweet';
import { ReplyAgent } from './replyAgent';
import { ResearchAgent } from './researchAgent';
import { TimingOptimizationAgent } from './timingOptimizationAgent';
import { openaiClient } from '../utils/openaiClient';
import dotenv from 'dotenv';

dotenv.config();

interface StrategistDecision {
  action: 'post' | 'reply' | 'trend_research' | 'sleep';
  priority: number;
  reasoning: string;
}

export class StrategistAgent {
  private timingAgent: TimingOptimizationAgent;

  constructor() {
    this.timingAgent = new TimingOptimizationAgent();
  }

  async run(): Promise<void> {
    try {
      console.log('🧠 === Strategist Cycle Started ===');
      
      // Get timing optimization insights
      const timingAdvice = await this.timingAgent.shouldPostNow();
      const remainingToday = await this.timingAgent.getRemainingTweetsToday();
      
      console.log(`⏰ Timing Analysis: ${timingAdvice.reason} (${timingAdvice.confidence}% confidence)`);
      console.log(`📊 Remaining tweets today: ${remainingToday.remaining}, next optimal: ${remainingToday.nextOptimalTime}`);
      
      const decision = await this.makeDecision(timingAdvice, remainingToday);
      
      console.log(`🧠 StrategistAgent: Analyzing current situation...`);
      console.log(`Decision: ${decision.action} (priority: ${decision.priority})`);
      console.log(`Reasoning: ${decision.reasoning}`);
      
      await this.executeAction(decision.action);
      
      console.log('🧠 === Strategist Cycle Completed ===');
    } catch (error) {
      console.error('❌ Error in StrategistAgent:', error);
    }
  }

  private async makeDecision(timingAdvice?: any, remainingToday?: any): Promise<StrategistDecision> {
    try {
      const systemPrompt = `You are a strategic decision-making AI for a health technology Twitter bot. 

Your job is to analyze the current situation and decide what action to take next.

Available actions:
- post: Create and post an original tweet about current health tech news/research
- reply: Find and intelligently reply to relevant health tech conversations
- trend_research: Gather fresh research data and trending topics
- sleep: Take no action (when rate limits reached or no immediate need)

Decision factors to consider:
1. Time of day and engagement patterns
2. Recent posting frequency
3. Content freshness and relevance
4. Rate limiting considerations
5. Strategic engagement opportunities

Current context:
- Time: ${new Date().toISOString()}
- Day: ${new Date().toLocaleDateString('en-US', { weekday: 'long' })}
- Hour: ${new Date().getHours()} (24hr format)

Respond with a JSON object containing:
{
  "action": "post|reply|trend_research|sleep",
  "priority": 1-10,
  "reasoning": "Brief explanation of decision"
}`;

      const response = await openaiClient.client.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'system', content: systemPrompt }],
        temperature: 0.3,
        max_tokens: 200
      });

      const responseText = response.choices[0]?.message?.content;
      if (!responseText) {
        throw new Error('No response from OpenAI');
      }

      const decision = JSON.parse(responseText) as StrategistDecision;
      return decision;

    } catch (error) {
      console.warn('⚠️ Error in decision making, using fallback logic');
      return this.getFallbackDecision();
    }
  }

  private getFallbackDecision(): StrategistDecision {
    const hour = new Date().getHours();
    const random = Math.random();

    // Peak hours (9-12 AM, 7-9 PM EST): prioritize posting
    if ((hour >= 9 && hour <= 12) || (hour >= 19 && hour <= 21)) {
      if (random < 0.7) {
        return {
          action: 'post',
          priority: 8,
          reasoning: 'Peak engagement hours - time for original content'
        };
      } else {
        return {
          action: 'reply',
          priority: 6,
          reasoning: 'Peak hours - engage with community'
        };
      }
    }

    // Regular hours: balanced approach
    if (random < 0.4) {
      return {
        action: 'post',
        priority: 6,
        reasoning: 'Time for original tweet'
      };
    } else if (random < 0.7) {
      return {
        action: 'reply',
        priority: 5,
        reasoning: 'Engage with community conversations'
      };
    } else if (random < 0.9) {
      return {
        action: 'trend_research',
        priority: 4,
        reasoning: 'Gather fresh content for future posts'
      };
    } else {
      return {
        action: 'sleep',
        priority: 1,
        reasoning: 'No immediate actions needed or rate limits reached'
      };
    }
  }

  async executeAction(action: string): Promise<void> {
    try {
      switch (action) {
        case 'post':
          console.log('📝 Executing post action...');
          
          // Strategic image decision based on context
          const shouldIncludeImage = this.decideShouldIncludeImage();
          const shouldIncludeCTA = this.decideShouldIncludeCTA();
          
          const result = await new PostTweetAgent().run(shouldIncludeCTA, shouldIncludeImage);
          
          if (result.success) {
            console.log(`✅ Tweet posted: ${result.tweetId}`);
            console.log(`Content: ${result.content}`);
            if (result.hasImage) {
              console.log('📸 Tweet includes engaging image');
            }
          } else {
            console.error(`❌ Failed to post tweet: ${result.error}`);
          }
          break;

        case 'reply':
          console.log('💬 Executing reply action...');
          const replyResult = await new ReplyAgent().run();
          if (replyResult.success) {
            console.log(`✅ Reply posted: ${replyResult.tweetId}`);
          } else {
            console.error(`❌ Failed to post reply: ${replyResult.error}`);
          }
          break;

        case 'trend_research':
          console.log('🔍 Executing trend research...');
          const researchResult = await new ResearchAgent().run();
          if (researchResult.success) {
            console.log('✅ Research data updated');
          } else {
            console.error('❌ Research failed');
          }
          break;

        case 'sleep':
          console.log('😴 Sleeping - no action needed');
          break;

        default:
          console.log(`❓ Unknown action: ${action}`);
      }
    } catch (error) {
      console.error(`Error executing action ${action}:`, error);
    }
  }

  private decideShouldIncludeImage(): boolean {
    const currentHour = new Date().getHours();
    const dayOfWeek = new Date().getDay();
    
    // Always include images during peak engagement hours (9 AM - 12 PM, 7 PM - 9 PM EST)
    const peakHours = [9, 10, 11, 19, 20];
    if (peakHours.includes(currentHour)) {
      console.log('🕘 Peak hour detected - including image for maximum engagement');
      return true;
    }
    
    // Include images more often on weekends for casual browsing
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      console.log('📅 Weekend detected - including image for casual engagement');
      return Math.random() < 0.85; // 85% chance on weekends
    }
    
    // Include images 75% of the time during weekdays
    const includeImage = Math.random() < 0.75;
    console.log(`📊 Strategic image decision: ${includeImage ? 'including' : 'skipping'} image`);
    return includeImage;
  }

  private decideShouldIncludeCTA(): boolean {
    // Include Snap2Health CTA 20% of the time to avoid over-promotion
    const includeCTA = Math.random() < 0.2;
    if (includeCTA) {
      console.log('📢 Including Snap2Health CTA for brand awareness');
    }
    return includeCTA;
  }
}

// Allow running as standalone script
if (require.main === module) {
  const agent = new StrategistAgent();
  agent.run();
} 