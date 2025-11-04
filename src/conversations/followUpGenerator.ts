/**
 * 🎭 FOLLOW-UP REPLY GENERATOR
 * 
 * Generates contextual follow-up replies for ongoing conversations.
 * Maintains conversation flow and builds relationships.
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import type { ConversationOpportunity } from './conversationMonitor';

export interface FollowUpReply {
  content: string;
  tone: 'grateful' | 'informative' | 'inquisitive' | 'supportive';
  adds_value: boolean;
  continues_conversation: boolean;
}

export class FollowUpGenerator {
  private static instance: FollowUpGenerator;

  private constructor() {}

  public static getInstance(): FollowUpGenerator {
    if (!FollowUpGenerator.instance) {
      FollowUpGenerator.instance = new FollowUpGenerator();
    }
    return FollowUpGenerator.instance;
  }

  /**
   * Generate a contextual follow-up reply
   */
  public async generateFollowUp(opportunity: ConversationOpportunity): Promise<FollowUpReply> {
    console.log(`[FOLLOW_UP] 🎭 Generating follow-up for conversation with @${opportunity.target_username}`);
    console.log(`[FOLLOW_UP]   Depth: ${opportunity.conversation_depth}`);
    console.log(`[FOLLOW_UP]   Their reply: "${opportunity.their_reply_content.substring(0, 60)}..."`);

    const systemPrompt = this.buildSystemPrompt(opportunity);
    const userPrompt = this.buildUserPrompt(opportunity);

    try {
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
        purpose: 'conversation_follow_up',
        requestId: `conv_${opportunity.their_reply_id}`
      });

      const rawContent = response.choices[0]?.message?.content;
      if (!rawContent) {
        throw new Error('Empty response from OpenAI');
      }

      const parsed = JSON.parse(rawContent);

      console.log(`[FOLLOW_UP] ✅ Generated follow-up (${parsed.content.length} chars)`);

      return {
        content: parsed.content,
        tone: parsed.tone || 'supportive',
        adds_value: this.validateValue(parsed.content, opportunity),
        continues_conversation: this.validateContinuation(parsed.content)
      };

    } catch (error: any) {
      console.error('[FOLLOW_UP] ❌ Generation failed:', error.message);
      throw error;
    }
  }

  /**
   * Build system prompt for conversation context
   */
  private buildSystemPrompt(opportunity: ConversationOpportunity): string {
    return `You are a knowledgeable health expert engaging in a conversation on Twitter.

CONVERSATION CONTEXT:
- You replied to @${opportunity.target_username}'s tweet
- They replied back to you (great sign - they're engaged!)
- This is turn ${opportunity.conversation_depth} of the conversation
- They have ${opportunity.target_followers.toLocaleString()} followers (influential account)

YOUR ORIGINAL REPLY:
"${opportunity.our_reply_content}"

THEIR RESPONSE TO YOU:
"${opportunity.their_reply_content}"

GUIDELINES:
1. Be grateful they engaged (especially if turn 1)
2. Build on THEIR point (not yours)
3. Add new value (research, insight, or thoughtful question)
4. Keep conversation going naturally
5. 150-220 characters max
6. No hashtags, no excessive emojis
7. Be authentic and evidence-based
8. NEVER make false claims about credentials

TONE:
- Turn 1: Grateful and appreciative
- Turn 2+: Collaborative and insightful
- Always: Helpful and genuine

Output as JSON:
{
  "content": "Your follow-up reply here",
  "tone": "grateful" | "informative" | "inquisitive" | "supportive"
}`;
  }

  /**
   * Build user prompt with conversation details
   */
  private buildUserPrompt(opportunity: ConversationOpportunity): string {
    let strategy = '';

    // Different strategies based on conversation depth
    if (opportunity.conversation_depth === 1) {
      strategy = `This is their first response to you. Thank them for engaging, then add one specific insight or ask a thoughtful follow-up question.`;
    } else if (opportunity.conversation_depth === 2) {
      strategy = `This is turn 2. Build deeper rapport. Share a specific study or mechanism, or ask about their experience.`;
    } else {
      strategy = `Conversation is ${opportunity.conversation_depth} turns deep. Keep it valuable but concise. Consider wrapping up gracefully or asking a final thoughtful question.`;
    }

    // Analyze their response type
    let responseType = '';
    const theirContent = opportunity.their_reply_content.toLowerCase();
    
    if (theirContent.includes('?')) {
      responseType = 'They asked a question - answer it directly with evidence.';
    } else if (theirContent.includes('thank') || theirContent.includes('appreciate')) {
      responseType = 'They thanked you - acknowledge and add one more insight.';
    } else if (theirContent.includes('agree') || theirContent.includes('exactly') || theirContent.includes('yes')) {
      responseType = 'They agreed - expand on the shared understanding.';
    } else if (theirContent.includes('but') || theirContent.includes('however')) {
      responseType = 'They have a counterpoint - respectfully engage with their perspective.';
    } else {
      responseType = 'They added their own insight - build on it.';
    }

    return `${strategy}

${responseType}

Generate a natural, valuable follow-up that continues the conversation.`;
  }

  /**
   * Validate that reply adds value
   */
  private validateValue(content: string, opportunity: ConversationOpportunity): boolean {
    // Check it's not just "thanks" or generic
    const generic = ['thanks', 'thank you', 'great point', 'exactly', 'agreed'];
    const isOnlyGeneric = generic.some(g => 
      content.toLowerCase().trim() === g || 
      content.toLowerCase().trim() === g + '!'
    );

    if (isOnlyGeneric) return false;

    // Should reference their point or add new information
    const addsInfo = content.length > 50; // Substantive response
    const notRepetitive = !this.isTooSimilar(content, opportunity.our_reply_content);

    return addsInfo && notRepetitive;
  }

  /**
   * Validate that reply continues conversation naturally
   */
  private validateContinuation(content: string): boolean {
    // Should not be overly conclusive
    const conclusive = ['goodbye', 'bye', 'take care', 'good luck', 'all the best'];
    const isConclusive = conclusive.some(c => content.toLowerCase().includes(c));

    // Questions and insights continue conversations
    const hasQuestion = content.includes('?');
    const sharesInsight = content.length > 60;

    return !isConclusive && (hasQuestion || sharesInsight);
  }

  /**
   * Check if two strings are too similar
   */
  private isTooSimilar(str1: string, str2: string): boolean {
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);
    
    const commonWords = words1.filter(w => words2.includes(w)).length;
    const avgLength = (words1.length + words2.length) / 2;
    
    return commonWords / avgLength > 0.6; // More than 60% overlap
  }
}

// Export singleton
export const followUpGenerator = FollowUpGenerator.getInstance();

