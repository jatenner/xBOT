/**
 * Strategic Reply System
 * 
 * Replies to bigger accounts to "borrow" their audiences
 * Provides VALUE, not spam - intelligent engagement
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { getSupabaseClient } from '../db';
import { dynamicAccountDiscovery, type DiscoveredAccount } from './dynamicAccountDiscovery';
import { replyLearningSystem } from './replyLearningSystem';

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
  
  private constructor() {
    // Initialize systems
    replyLearningSystem.loadHistoricalData();
  }
  
  public static getInstance(): StrategicReplySystem {
    if (!StrategicReplySystem.instance) {
      StrategicReplySystem.instance = new StrategicReplySystem();
    }
    return StrategicReplySystem.instance;
  }
  
  /**
   * Find optimal reply targets - tweets from big accounts to engage with
   * LEARNING-DRIVEN: Prioritizes accounts that have yielded followers
   */
  public async findReplyTargets(count: number = 3): Promise<ReplyTarget[]> {
    console.log('[STRATEGIC_REPLY] 🎯 Finding optimal reply targets (learning-driven)...');
    
    // Get best performing accounts from learning system
    const bestAccounts = replyLearningSystem.getBestAccounts(count);
    
    // Get performance data for prioritization
    const performanceMap = new Map<string, number>();
    bestAccounts.forEach(username => {
      const priority = replyLearningSystem.getAccountPriority(username);
      performanceMap.set(username, priority);
    });
    
    // Get top accounts from dynamic discovery (includes performance boost)
    const topAccounts = dynamicAccountDiscovery.getTopAccounts(count, performanceMap);
    
    console.log(`[STRATEGIC_REPLY] 📊 Total available targets: ${dynamicAccountDiscovery.getTotalTargets()}`);
    console.log(`[STRATEGIC_REPLY] 🎯 Total potential reach: ${dynamicAccountDiscovery.getTotalPotentialReach().toLocaleString()} followers`);
    
    const targets: ReplyTarget[] = [];
    
    for (const discovered of topAccounts) {
      const account: BigAccount = {
        username: discovered.username,
        followers: discovered.followers,
        category: discovered.category,
        engagement_velocity: discovered.engagement_velocity
      };
      
      targets.push({
        account,
        tweet_url: `https://x.com/${account.username}/status/mock${Date.now()}`,
        tweet_content: this.getMockTweetContent(account.category),
        reply_angle: this.getReplyAngle(account.category),
        estimated_reach: Math.floor(account.followers * 0.02) // 2% of followers might see
      });
    }
    
    console.log(`[STRATEGIC_REPLY] ✅ Selected ${targets.length} high-priority targets`);
    targets.forEach(t => {
      console.log(`  - @${t.account.username} (${t.account.followers.toLocaleString()} followers, ${t.account.category})`);
    });
    
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

CONTEXT-AWARE RESPONSES:
- If they're discussing research → cite additional studies naturally
- If they're sharing personal experience → be supportive and add practical insight
- If they're asking a question → give a direct, helpful answer
- If they're making a claim → add supporting evidence or nuance
- Sound like a knowledgeable friend, not a research paper

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
    
    // 🔧 EXPANDED: Check for health/science words (broader value signals)
    const hasHealthInsight = /(research|study|evidence|shows|found|indicates|suggests|data|results)/i.test(reply);
    if (hasHealthInsight) score += 0.25;
    
    // Check for substantive content (not just generic praise)
    const hasSubstance = reply.length > 80 && !/^(great|nice|awesome|interesting|love this)/i.test(reply);
    if (hasSubstance) score += 0.15;
    
    // Check NOT spam
    const notSpam = !/check out|click here|follow me|my content|great post|dm me/i.test(reply);
    if (notSpam) score += 0.2;
    
    // Check NOT repetition of original
    const notRepetitive = !reply.toLowerCase().includes(original.toLowerCase().slice(0, 30));
    if (notRepetitive) score += 0.2;
    
    // 🎯 RELAXED: Accept if reply has ANY of: numbers, mechanism, health insight, OR substantive content
    const providesValue = hasNumbers || hasMechanism || hasHealthInsight || hasSubstance;
    
    return {
      value: providesValue,
      insight: hasMechanism || hasHealthInsight,
      not_spam: notSpam,
      score: Math.min(score, 1.0)
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
   * Track reply performance - INTEGRATED WITH LEARNING SYSTEM
   */
  public async trackReplyPerformance(data: {
    reply_id: string;
    target_account: string;
    reply_content: string;
    generator_used?: string;
    likes: number;
    followers_gained: number;
    profile_clicks?: number;
    posted_at: string;
  }): Promise<void> {
    console.log(`[STRATEGIC_REPLY] 📊 Tracking reply to @${data.target_account}: +${data.followers_gained} followers`);
    
    // Use learning system to track and optimize
    await replyLearningSystem.trackReplyPerformance({
      reply_id: data.reply_id,
      target_account: data.target_account,
      generator_used: (data.generator_used as any) || 'unknown',
      followers_gained: data.followers_gained,
      profile_clicks: data.profile_clicks || 0,
      likes: data.likes,
      posted_at: data.posted_at
    });
    
    // Also persist to database
    try {
      const supabase = getSupabaseClient();
      
      await supabase
        .from('strategic_replies')
        .insert({
          reply_id: data.reply_id,
          target_account: data.target_account,
          reply_content: data.reply_content,
          generator_used: data.generator_used,
          likes: data.likes,
          followers_gained: data.followers_gained,
          profile_clicks: data.profile_clicks || 0,
          posted_at: data.posted_at,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.warn('[STRATEGIC_REPLY] ⚠️ Could not persist to DB');
    }
  }
  
  /**
   * Get learning insights
   */
  public getLearningInsights() {
    return replyLearningSystem.getInsights();
  }
}

export const strategicReplySystem = StrategicReplySystem.getInstance();

