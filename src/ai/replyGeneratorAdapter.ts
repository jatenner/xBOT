/**
 * Reply Generator Adapter
 * 
 * CRITICAL: Replies must NEVER use regular post generators (which produce thread/single content)
 * This adapter ensures replies always use reply-specific prompts and logic
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { v4 as uuidv4 } from 'uuid';

export interface ReplyGenerationRequest {
  target_username: string;
  target_tweet_content: string;
  topic?: string;
  angle?: string;
  tone?: string;
  model?: string;
}

export interface ReplyGenerationResult {
  content: string;
  generator_used: string;
}

/**
 * Generate reply content using REPLY-SPECIFIC logic
 * 
 * This function ensures replies:
 * - Never contain thread markers (1/5, 🧵, etc.)
 * - Always reference the parent tweet context
 * - Are always single tweets (not multi-part)
 * - Use conversational language (not standalone post language)
 */
export async function generateReplyContent(
  request: ReplyGenerationRequest
): Promise<ReplyGenerationResult> {
  const decision_id = uuidv4();
  
  // Extract keywords from parent tweet for context
  const keywords = extractKeywords(request.target_tweet_content);
  const keywordsStr = keywords.length > 0 ? keywords.join(', ') : 'health, wellness';
  
  const prompt = `Generate a helpful, contextual reply to this tweet:

ORIGINAL TWEET: "${request.target_tweet_content}"
AUTHOR: @${request.target_username}
TOPIC CONTEXT: ${request.topic || 'health'}

YOUR REPLY MUST:
1. Reference the original tweet (use at least 1 keyword: ${keywordsStr})
2. Add genuine value with research or practical insights
3. Be ≤220 characters (strict)
4. Sound like a natural conversation, NOT a standalone post
5. Do NOT use generic research openers like "Interestingly,", "Research shows", "Studies suggest"
6. Do NOT sound like you're starting a thread or article
7. Do NOT include any thread markers (🧵, 1/5, Part 1, etc.)
8. Do NOT make it sound like a lecture or textbook

GOOD REPLY EXAMPLES:
- "That's a great point! Similar pattern seen in..." (acknowledges their tweet)
- "Makes sense - when you consider how..." (builds on their idea)
- "Exactly - and the research backs this up..." (affirms then adds value)

BAD REPLY EXAMPLES:
- "Interestingly, my mood fluctuated wildly..." (sounds standalone)
- "Research shows sugar impacts..." (sounds like lecturing)
- "Let's explore this topic..." (sounds like starting a thread)
- "1/5 Start with..." (thread marker)
- "🧵 Thread on this..." (thread marker)

Reply as if you're continuing THEIR conversation, not starting your own.

Format as JSON:
{
  "content": "Your reply text here"
}`;

  console.log(`[REPLY_ADAPTER] Generating reply for @${request.target_username} using model=${request.model || 'gpt-4o-mini'}`);
  
  const response = await createBudgetedChatCompletion({
    model: request.model || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a knowledgeable health enthusiast who provides genuine, evidence-based insights in replies. Always respond with valid JSON format. NEVER use thread markers or numbered lists in replies.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    top_p: 1.0,
    max_tokens: 200,
    response_format: { type: 'json_object' }
  }, {
    purpose: 'reply_generation',
    requestId: decision_id
  });

  const rawContent = response.choices[0]?.message?.content;
  if (!rawContent) throw new Error('Empty response from OpenAI');

  const replyData = JSON.parse(rawContent);
  if (!replyData.content || replyData.content.length > 280) {
    throw new Error('Invalid reply: missing content or too long');
  }

  console.log(`[REPLY_ADAPTER] ✅ Generated reply: ${replyData.content.length} chars`);

  return {
    content: replyData.content,
    generator_used: 'reply_adapter'
  };
}

/**
 * Extract keywords from parent tweet for context
 */
function extractKeywords(text: string): string[] {
  const stopWords = ['that', 'this', 'with', 'from', 'have', 'been', 'were', 'what', 'when', 'where', 'which', 'their', 'there', 'these', 'those'];
  
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 4 && !stopWords.includes(w))
    .slice(0, 5); // Top 5 keywords
  
  return words;
}

