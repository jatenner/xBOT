/**
 * Reply Generator Adapter
 * 
 * CRITICAL: Replies must NEVER use regular post generators (which produce thread/single content)
 * This adapter ensures replies always use reply-specific prompts and logic
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { v4 as uuidv4 } from 'uuid';

export interface ReplyContext {
  target_text: string;
  quoted_text?: string;
  root_text?: string;
  thread_prev_text?: string;
  root_tweet_id?: string;
}

export interface ReplyGenerationRequest {
  target_username: string;
  target_tweet_content: string;
  topic?: string;
  angle?: string;
  tone?: string;
  model?: string;
  relevance_score?: number;
  replyability_score?: number;
  reply_context?: ReplyContext;
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
  
  // 🎯 REPLY_INTENT CLASSIFIER (rule-based)
  let replyIntent: 'question' | 'disagree' | 'add_insight' | 'agree+expand' = 'add_insight';
  const textLower = request.target_tweet_content.toLowerCase();
  
  if (/\?/.test(request.target_tweet_content) || /\b(what do you think|what's your take|your thoughts|opinion)\b/i.test(request.target_tweet_content)) {
    replyIntent = 'question';
  } else if (/\b(wrong|false|myth|debunk|disagree|actually|but|however)\b/i.test(request.target_tweet_content)) {
    replyIntent = 'disagree';
  } else if (/\b(exactly|right|true|agree|spot on|makes sense)\b/i.test(request.target_tweet_content)) {
    replyIntent = 'agree+expand';
  }
  
  // Detect if tweet is about partnership/announcement
  const isPartnership = /partner|announce|launch|collaborat|teaming up|excited to/i.test(request.target_tweet_content);
  const isHealthTopic = /health|wellness|fitness|nutrition|medical|disease|treatment|supplement|vitamin/i.test(request.target_tweet_content);
  
  // Use relevance_score if provided
  const relevanceScore = request.relevance_score ?? (isHealthTopic ? 0.7 : 0.3);
  
  // 🔒 BUILD CONTEXT STRING: Include full conversation context
  let contextString = `TARGET TWEET: "${request.target_tweet_content}"`;
  if (request.reply_context?.quoted_text) {
    contextString += `\n\nQUOTED TWEET (what they're responding to): "${request.reply_context.quoted_text}"`;
  }
  if (request.reply_context?.root_text && request.reply_context.root_tweet_id !== request.target_tweet_content) {
    contextString += `\n\nROOT TWEET (original post in thread): "${request.reply_context.root_text}"`;
  }
  if (request.reply_context?.thread_prev_text) {
    contextString += `\n\nPREVIOUS TWEET IN THREAD: "${request.reply_context.thread_prev_text}"`;
  }
  
  const prompt = `Generate a helpful, contextual reply to this tweet:

${contextString}
Author: @${request.target_username}
Reply Intent: ${replyIntent}
Health Relevance: ${relevanceScore >= 0.6 ? 'High' : relevanceScore >= 0.3 ? 'Medium' : 'Low'}

YOUR REPLY MUST:
1. **CRITICAL**: ALWAYS reference a SPECIFIC concrete detail from the target tweet (a claim, metric, term, intervention, mechanism, or named entity). If you cannot reference something specific, return {"content": "", "skip_reason": "no_concrete_detail"}.
2. Be 1-2 sentences, ≤220 characters (strict)
3. Sound confident and human, like a real person replying
4. Never roleplay as the author - don't use "we" or "our" unless the bot account (@SignalAndSynapse) is actually the author
5. NO corporate voice: Avoid "we're excited", "thrilled", "honored", "proud to announce"
6. NO emojis by default (unless the tweet is very casual/emoji-heavy)
7. NO forced health tie-ins if tweet isn't health-related - match the tweet's actual topic
8. NO generic congratulations for brand partnerships - only for personal milestones
9. NO generic research openers like "Interestingly,", "Research shows", "Studies suggest"
10. NO thread markers (🧵, 1/5, Part 1, etc.)
11. NO generic abstract lines like "ecosystem of our BEING", "ripple effect of life" unless explicitly supported by tweet content
12. Structure: 1 concrete point + 1 useful nuance/caution + 1 short question OR actionable suggestion

REPLY_INTENT GUIDANCE:
- question: Ask a sharp, specific question related to their tweet topic
- disagree: Politely challenge with evidence or alternative perspective (be respectful)
- add_insight: Provide a concise, valuable insight or fact related to their point
- agree+expand: Affirm their point, then add a related insight or question

TONE RULES:
- If partnership/announcement (NOT health-related): Skip generic congrats, ask a specific question about the announcement
- If health topic: Reference the specific health point mentioned, add brief insight
- If other topic: Match the tweet's topic exactly, don't force health angle
- Always sound conversational, not academic or corporate
- Be specific, not generic

GOOD REPLY EXAMPLES:
- "That's a great point about [specific thing from tweet]! Similar pattern seen in..." (references specific content)
- "What's the biggest challenge you're tackling first?" (partnership hook, no generic congrats)
- "Makes sense - when you consider how [specific aspect] works..." (builds on their idea)
- "Exactly - and [specific research/insight] backs this up..." (affirms then adds value)
- "Actually, [specific counterpoint] - here's why..." (respectful disagreement)

BAD REPLY EXAMPLES:
- "We're excited about this partnership!" (corporate voice, generic)
- "Interestingly, health analytics show..." (generic health filler, no specific reference)
- "Research shows sugar impacts..." (sounds like lecturing, no tweet reference)
- "We should explore public health strategies..." (roleplaying as author, generic)
- "Congrats on the partnership!" (generic, no value)
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
  
  // 🔒 QUALITY GATE: Check if reply was skipped due to no concrete detail
  if (replyData.skip_reason === 'no_concrete_detail' || !replyData.content) {
    console.log(`[REPLY_ADAPTER] ⏭️ SKIP: ${replyData.skip_reason || 'empty_content'} - reply not grounded in tweet content`);
    throw new Error(`UNGROUNDED_GENERATION_SKIP: ${replyData.skip_reason || 'empty_content'}`);
  }
  
  if (replyData.content.length > 220) {
    throw new Error('Invalid reply: too long (>220 chars)');
  }
  
  // 🔒 QUALITY GATE: Verify reply references concrete detail from tweet
  const tweetTextLower = request.target_tweet_content.toLowerCase();
  const replyTextLower = replyData.content.toLowerCase();
  
  // Extract key terms/phrases from tweet (non-stopwords, length > 4)
  const tweetTerms = tweetTextLower
    .split(/\s+/)
    .filter(w => w.length > 4 && !['that', 'this', 'with', 'from', 'have', 'been', 'were', 'what', 'when', 'where', 'which', 'their', 'there', 'these', 'those'].includes(w))
    .slice(0, 10);
  
  // Check if reply mentions at least one concrete term from tweet
  const hasConcreteReference = tweetTerms.some(term => replyTextLower.includes(term));
  
  if (!hasConcreteReference && tweetTerms.length > 0) {
    // Try checking for quoted tweet or root tweet terms if available
    let hasContextReference = false;
    if (request.reply_context?.quoted_text) {
      const quotedTerms = request.reply_context.quoted_text.toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 4)
        .slice(0, 10);
      hasContextReference = quotedTerms.some(term => replyTextLower.includes(term));
    }
    if (!hasContextReference && request.reply_context?.root_text) {
      const rootTerms = request.reply_context.root_text.toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 4)
        .slice(0, 10);
      hasContextReference = rootTerms.some(term => replyTextLower.includes(term));
    }
    
    if (!hasContextReference) {
      console.log(`[REPLY_ADAPTER] ⏭️ SKIP: ungrounded_generation_skip - reply does not reference concrete detail from tweet`);
      console.log(`[REPLY_ADAPTER]   Tweet terms: ${tweetTerms.slice(0, 5).join(', ')}`);
      console.log(`[REPLY_ADAPTER]   Reply: "${replyData.content.substring(0, 100)}..."`);
      throw new Error('UNGROUNDED_GENERATION_SKIP: reply does not reference concrete detail from tweet/context');
    }
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

