/**
 * Strategic Reply System
 * 
 * Replies to bigger accounts to "borrow" their audiences
 * Provides VALUE, not spam - intelligent engagement
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { getSupabaseClient } from '../db';

export interface BigAccount {
  username: string;
  followers: number;
  category: string;
  engagement_velocity: 'high' | 'medium' | 'low';
}

export interface ReplyTarget {
  account: BigAccount;
  tweet_url: string;
  tweet_content: string;
  reply_angle: string;
  estimated_reach: number;
}

export interface GeneratedReply {
  content: string;
  provides_value: boolean;
  adds_insight: boolean;
  not_spam: boolean;
  confidence: number;
}

export class StrategicReplySystem {
  private static instance: StrategicReplySystem;
  
  // Big accounts in health/wellness space to engage with
  private readonly BIG_ACCOUNTS: BigAccount[] = [
    { username: 'hubermanlab', followers: 5000000, category: 'neuroscience', engagement_velocity: 'high' },
    { username: 'PeterAttiaMD', followers: 800000, category: 'longevity', engagement_velocity: 'medium' },
    { username: 'foundmyfitness', followers: 400000, category: 'nutrition', engagement_velocity: 'medium' },
    { username: 'ScienceDaily', followers: 2000000, category: 'science', engagement_velocity: 'high' },
    { username: 'NIH', followers: 500000, category: 'medical', engagement_velocity: 'low' },
    { username: 'DrMarkHyman', followers: 600000, category: 'functional_medicine', engagement_velocity: 'medium' },
    { username: 'bengreenfield', followers: 300000, category: 'biohacking', engagement_velocity: 'high' },
  ];
  
  private constructor() {}
  
  public static getInstance(): StrategicReplySystem {
    if (!StrategicReplySystem.instance) {
      StrategicReplySystem.instance = new StrategicReplySystem();
    }
    return StrategicReplySystem.instance;
  }
  
  /**
   * Find optimal reply targets - tweets from big accounts to engage with
   */
  public async findReplyTargets(count: number = 3): Promise<ReplyTarget[]> {
    console.log('[STRATEGIC_REPLY] 🎯 Finding optimal reply targets...');
    
    // For MVP: Return mock targets based on big accounts
    // In production: Would scrape Twitter API or use Playwright to find recent tweets
    
    const targets: ReplyTarget[] = [];
    
    for (let i = 0; i < Math.min(count, this.BIG_ACCOUNTS.length); i++) {
      const account = this.BIG_ACCOUNTS[i];
      
      targets.push({
        account,
        tweet_url: `https://x.com/${account.username}/status/mock${Date.now()}`,
        tweet_content: this.getMockTweetContent(account.category),
        reply_angle: this.getReplyAngle(account.category),
        estimated_reach: Math.floor(account.followers * 0.02) // 2% of followers might see
      });
    }
    
    console.log(`[STRATEGIC_REPLY] ✅ Found ${targets.length} potential targets`);
    return targets;
  }
  
  /**
   * Generate VALUE-ADDING reply to a big account's tweet
   */
  public async generateStrategicReply(target: ReplyTarget): Promise<GeneratedReply> {
    console.log(`[STRATEGIC_REPLY] 💬 Generating reply for @${target.account.username}...`);
    
    const systemPrompt = `You are a health optimization expert replying to a tweet from @${target.account.username}.

YOUR GOAL: Provide genuine VALUE, not spam. Build on their point with:
- Specific research they didn't mention
- A mechanism that adds depth
- An actionable insight

CRITICAL RULES:
- NO "Great post!" or generic praise
- NO self-promotion or links
- NO "Check out my content"
- ADD something they missed
- Be SPECIFIC (studies, numbers, mechanisms)
- Keep it 150-220 characters

EXAMPLE OF GOOD REPLY:
Original: "Sleep deprivation affects memory"
Bad reply: "Great point! Sleep is so important 👍"
Good reply: "Building on this - the 2023 Berkeley study found REM in final 2hrs consolidates long-term memory. Cutting those = 40% memory loss. Protect morning sleep."

The good reply:
✅ Cites specific research
✅ Adds mechanism (REM consolidation)
✅ Gives actionable insight (protect morning sleep)
✅ Builds on original, doesn't repeat`;

    const userPrompt = `Original tweet from @${target.account.username}:
"${target.tweet_content}"

Category: ${target.account.category}
Reply angle: ${target.reply_angle}

Generate a VALUE-ADDING reply that:
1. References specific research
2. Explains a mechanism
3. Provides actionable insight
4. Builds on their point (doesn't repeat)
5. 150-220 characters

Output as JSON:
{
  "content": "Your reply text here"
}`;

    const response = await createBudgetedChatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: 150,
      response_format: { type: 'json_object' }
    }, {
      purpose: 'strategic_reply_generation',
      requestId: `reply_${Date.now()}`
    });

    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) {
      throw new Error('Empty response from OpenAI');
    }

    const parsed = JSON.parse(rawContent);
    
    // Validate reply quality
    const providesValue = this.validateReplyQuality(parsed.content, target.tweet_content);
    
    console.log(`[STRATEGIC_REPLY] ✅ Generated reply (${parsed.content.length} chars)`);
    
    return {
      content: parsed.content,
      provides_value: providesValue.value,
      adds_insight: providesValue.insight,
      not_spam: providesValue.not_spam,
      confidence: providesValue.score
    };
  }
  
  /**
   * Validate that reply provides real value
   */
  private validateReplyQuality(reply: string, original: string): {
    value: boolean;
    insight: boolean;
    not_spam: boolean;
    score: number;
  } {
    let score = 0;
    
    // Check for specific numbers/research
    const hasNumbers = /\d+%|\d+ (study|research|people|hours)/.test(reply);
    if (hasNumbers) score += 0.3;
    
    // Check for mechanism words
    const hasMechanism = /(because|mechanism|process|affects|triggers|causes)/i.test(reply);
    if (hasMechanism) score += 0.3;
    
    // Check NOT spam
    const notSpam = !/check out|click here|follow me|my content|great post/i.test(reply);
    if (notSpam) score += 0.2;
    
    // Check NOT repetition of original
    const notRepetitive = !reply.toLowerCase().includes(original.toLowerCase().slice(0, 30));
    if (notRepetitive) score += 0.2;
    
    return {
      value: hasNumbers || hasMechanism,
      insight: hasMechanism,
      not_spam: notSpam,
      score
    };
  }
  
  /**
   * Get mock tweet content based on category
   */
  private getMockTweetContent(category: string): string {
    const mockTweets = {
      neuroscience: 'New research shows dopamine regulation affects decision-making in unexpected ways',
      longevity: 'The latest longevity research suggests caloric restriction may not be the key factor',
      nutrition: 'Protein timing might matter more than we thought for muscle synthesis',
      science: 'Breakthrough study reveals new mechanism for cellular aging',
      medical: 'Clinical trial results show promising outcomes for cardiovascular health intervention',
      functional_medicine: 'Root cause approach to chronic inflammation yields surprising results',
      biohacking: 'Testing metabolic flexibility through ketone monitoring shows interesting patterns'
    };
    
    return mockTweets[category as keyof typeof mockTweets] || mockTweets.science;
  }
  
  /**
   * Get reply angle based on category
   */
  private getReplyAngle(category: string): string {
    const angles = {
      neuroscience: 'Add specific mechanism or lesser-known research',
      longevity: 'Provide protocol detail or counterintuitive finding',
      nutrition: 'Share timing/dosage specifics or bioavailability info',
      science: 'Connect to practical application or related finding',
      medical: 'Add patient outcome data or implementation insight',
      functional_medicine: 'Provide root cause detail or testing protocol',
      biohacking: 'Share measurement technique or optimization detail'
    };
    
    return angles[category as keyof typeof angles] || 'Add specific research or mechanism';
  }
  
  /**
   * Track reply performance
   */
  public async trackReplyPerformance(data: {
    reply_id: string;
    target_account: string;
    reply_content: string;
    likes: number;
    followers_gained: number;
    posted_at: string;
  }): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      
      await supabase
        .from('strategic_replies')
        .insert({
          reply_id: data.reply_id,
          target_account: data.target_account,
          reply_content: data.reply_content,
          likes: data.likes,
          followers_gained: data.followers_gained,
          posted_at: data.posted_at,
          created_at: new Date().toISOString()
        });
      
      console.log(`[STRATEGIC_REPLY] 📊 Tracked reply performance: ${data.followers_gained} followers gained`);
    } catch (error) {
      console.warn('[STRATEGIC_REPLY] ⚠️ Could not track to DB');
    }
  }
}

export const strategicReplySystem = StrategicReplySystem.getInstance();

