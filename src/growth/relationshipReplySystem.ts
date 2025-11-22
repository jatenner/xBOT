/**
 * 🤝 RELATIONSHIP REPLY SYSTEM
 * 
 * Generates replies that build relationships and convert to followers.
 * Focus: Value-first, relationship-building, not just engagement.
 */

import { getSupabaseClient } from '../db';
import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';

export interface ReplyTarget {
  tweet_id: string;
  username: string;
  content: string;
  likes: number;
  replies: number;
  posted_at: string;
  context?: string; // Additional context about the account/tweet
}

export type ReplyStrategy = 'value_first' | 'controversy' | 'story';

export class RelationshipReplySystem {
  private static instance: RelationshipReplySystem;

  public static getInstance(): RelationshipReplySystem {
    if (!RelationshipReplySystem.instance) {
      RelationshipReplySystem.instance = new RelationshipReplySystem();
    }
    return RelationshipReplySystem.instance;
  }

  /**
   * Generate relationship-building reply (not just engagement)
   * 
   * Strategy breakdown:
   * - Value-First (60%): Add genuine insight, reference their content, show expertise
   * - Controversy (25%): Challenge popular opinion, back with data, create discussion
   * - Story (15%): Personal anecdote, relatable experience, builds connection
   */
  async generateRelationshipReply(target: ReplyTarget): Promise<{
    reply: string;
    strategy: ReplyStrategy;
    expectedConversion: 'high' | 'medium' | 'low';
  }> {
    // Select strategy based on target context
    const strategy = this.selectStrategy(target);
    
    console.log(`[RELATIONSHIP_REPLY] 🎯 Strategy: ${strategy} for @${target.username}`);

    switch (strategy) {
      case 'value_first':
        return await this.generateValueFirstReply(target);
      case 'controversy':
        return await this.generateControversyReply(target);
      case 'story':
        return await this.generateStoryReply(target);
    }
  }

  /**
   * Value-First Reply Formula
   * Template: "Great point about [their topic]. The mechanism is [insight]. I've seen this work when [example]. Have you tried [related approach]?"
   */
  private async generateValueFirstReply(target: ReplyTarget): Promise<{
    reply: string;
    strategy: ReplyStrategy;
    expectedConversion: 'high' | 'medium' | 'low';
  }> {
    const systemPrompt = `You are a health expert replying to someone's tweet. Your goal is to:
1. Add genuine value (insight they didn't have)
2. Reference their content (show you read it)
3. Show expertise without showing off
4. End with question (drives conversation and relationship)

Reply should be:
- 200-250 characters
- Natural, conversational tone
- No first-person (I/me/my)
- No hashtags
- 0-1 emoji max
- Value-first, not self-promotional

Example good reply:
"Great point about sleep architecture. The mechanism is REM protection, not total hours. UC Berkeley study found 6-hour sleepers with protected REM outperformed 8-hour sleepers. Have you tried REM-focused protocols?"

Example bad reply:
"Follow me for more sleep tips!" ❌`;

    const userPrompt = `Generate a value-first reply to this tweet:

@${target.username}: "${target.content}"

Add genuine insight, reference their point, show expertise naturally, end with question.`;

    try {
      const response = await createBudgetedChatCompletion({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 150,
      }, { purpose: 'relationship_reply_generation' });

      const reply = response.choices[0].message.content?.trim() || '';
      
      return {
        reply,
        strategy: 'value_first',
        expectedConversion: 'high'
      };
    } catch (error: any) {
      console.error('[RELATIONSHIP_REPLY] Error generating value-first reply:', error.message);
      throw error;
    }
  }

  /**
   * Controversy Reply Formula
   * Template: "Actually, [challenge their point]. Here's what the data shows: [evidence]. [Why this matters]."
   */
  private async generateControversyReply(target: ReplyTarget): Promise<{
    reply: string;
    strategy: ReplyStrategy;
    expectedConversion: 'high' | 'medium' | 'low';
  }> {
    const systemPrompt = `You are a health expert with a contrarian take. Your goal is to:
1. Challenge popular opinion (respectfully)
2. Back with data/evidence
3. Create discussion (not argument)
4. Position as expert with different perspective

Reply should be:
- 200-250 characters
- Respectful but firm
- Data-driven
- No first-person
- No hashtags
- 0-1 emoji max

Example:
"Actually, the mechanism is different. Study of 5,000 people showed X approach outperformed Y by 43%. The key is [insight]. What's your take on this data?"`;

    const userPrompt = `Generate a controversy reply (respectful challenge) to:

@${target.username}: "${target.content}"

Challenge their point with data, create discussion, position as expert.`;

    try {
      const response = await createBudgetedChatCompletion({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.75,
        max_tokens: 150,
      }, { purpose: 'controversy_reply_generation' });

      const reply = response.choices[0].message.content?.trim() || '';
      
      return {
        reply,
        strategy: 'controversy',
        expectedConversion: 'high'
      };
    } catch (error: any) {
      console.error('[RELATIONSHIP_REPLY] Error generating controversy reply:', error.message);
      throw error;
    }
  }

  /**
   * Story Reply Formula
   * Template: "Similar experience: [story]. The key was [insight]. [Relatable outcome]."
   */
  private async generateStoryReply(target: ReplyTarget): Promise<{
    reply: string;
    strategy: ReplyStrategy;
    expectedConversion: 'high' | 'medium' | 'low';
  }> {
    const systemPrompt = `You are a health expert sharing a relatable story. Your goal is to:
1. Share personal anecdote (without first-person)
2. Make it relatable
3. Extract insight from story
4. Build connection through shared experience

Reply should be:
- 200-250 characters
- Story-based but concise
- Relatable
- No first-person (I/me/my)
- No hashtags
- 0-1 emoji max

Example:
"Similar experience: Patient tried X protocol for 6 months with no results. Switched to Y approach and saw changes in 2 weeks. The key was [mechanism]. Sometimes the obvious solution isn't the right one."`;

    const userPrompt = `Generate a story-based reply to:

@${target.username}: "${target.content}"

Share relatable story, extract insight, build connection.`;

    try {
      const response = await createBudgetedChatCompletion({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 150,
      }, { purpose: 'story_reply_generation' });

      const reply = response.choices[0].message.content?.trim() || '';
      
      return {
        reply,
        strategy: 'story',
        expectedConversion: 'medium'
      };
    } catch (error: any) {
      console.error('[RELATIONSHIP_REPLY] Error generating story reply:', error.message);
      throw error;
    }
  }

  /**
   * Select optimal strategy based on target
   */
  private selectStrategy(target: ReplyTarget): ReplyStrategy {
    // High engagement tweets → Value-first (add to conversation)
    if (target.likes > 100 || target.replies > 20) {
      return 'value_first';
    }

    // Controversial topics → Controversy (challenge respectfully)
    const controversialKeywords = ['wrong', 'myth', 'lie', 'scam', 'overrated', 'doesn\'t work'];
    if (controversialKeywords.some(keyword => target.content.toLowerCase().includes(keyword))) {
      return 'controversy';
    }

    // Personal stories → Story (relate and connect)
    const storyKeywords = ['I', 'my', 'experience', 'tried', 'tested', 'found'];
    if (storyKeywords.some(keyword => target.content.toLowerCase().includes(keyword))) {
      return 'story';
    }

    // Default: Value-first (60% of replies)
    return Math.random() < 0.6 ? 'value_first' :
           Math.random() < 0.85 ? 'controversy' : 'story';
  }
}

