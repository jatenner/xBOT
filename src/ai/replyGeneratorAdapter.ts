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
  template_id?: string; // 🎨 QUALITY TRACKING: Template to use
  prompt_version?: string; // 🎨 QUALITY TRACKING: Prompt version
  custom_prompt?: string; // 🎯 PHASE 6.4: Custom strategy prompt template
  external_insights?: string; // 🌐 External Twitter intelligence context
}

export interface ReplyGenerationResult {
  content: string;
  generator_used: string;
  is_fallback?: boolean;
  reply_archetype?: string; // Which archetype was used (for learning)
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

  // ── Load cached external intelligence (non-fatal) ──
  let replyGuidance = '';
  try {
    const { getCachedIntelligence } = await import('../intelligence/externalPatternAnalyzer');
    const intel = await getCachedIntelligence();
    if (intel) {
      const { generateReplyGuidance } = await import('../intelligence/externalPatternAnalyzer');
      replyGuidance = await generateReplyGuidance(intel);
    }
  } catch { /* non-fatal — generate without intelligence */ }

  // After existing replyGuidance loading, also load tick advice
  try {
    const { getTickAdvice } = await import('../intelligence/tickAdvisor');
    const advice = await getTickAdvice();
    if (advice && advice.reply_preferences && advice.confidence > 0.3) {
      const prefs = advice.reply_preferences;
      const adviceStr = [
        prefs.preferred_angles.length ? `Preferred angles: ${prefs.preferred_angles.join(', ')}` : '',
        prefs.preferred_tones.length ? `Preferred tones: ${prefs.preferred_tones.join(', ')}` : '',
        prefs.ideal_length_range ? `Ideal length: ${prefs.ideal_length_range[0]}-${prefs.ideal_length_range[1]} chars` : '',
        prefs.avoid_angles.length ? `Avoid: ${prefs.avoid_angles.join(', ')}` : '',
        advice.top_insights.length ? `Key insight: ${advice.top_insights[0]}` : '',
      ].filter(Boolean).join('. ');
      if (adviceStr) {
        replyGuidance = replyGuidance ? replyGuidance + ' ' + adviceStr : adviceStr;
      }
    }
  } catch { /* non-fatal */ }

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
  
  // Extract anchor terms from target tweet for prompt (nouns, hashtags, numbers)
  const extractAnchors = (text: string): string[] => {
    const anchors: string[] = [];
    const hashtags = text.match(/#\w+/gi) || [];
    anchors.push(...hashtags);
    const numbers = text.match(/\d+(\.\d+)?%?/g) || [];
    anchors.push(...numbers);
    const stopwords = new Set(['this', 'that', 'have', 'been', 'with', 'from', 'they', 'your', 'will', 'just', 'more', 'when', 'what', 'than', 'very', 'also', 'some', 'like', 'into']);
    const words = text.toLowerCase()
      .replace(/[^a-z0-9\s#]/gi, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 4 && !stopwords.has(w));
    const wordFreq = new Map<string, number>();
    words.forEach(w => wordFreq.set(w, (wordFreq.get(w) || 0) + 1));
    const uniqueWords = Array.from(wordFreq.entries())
      .filter(([w, count]) => count === 1)
      .map(([w]) => w)
      .sort((a, b) => b.length - a.length)
      .slice(0, 8);
    anchors.push(...uniqueWords);
    return anchors.slice(0, 8).slice(0, Math.max(3, anchors.length));
  };

  /** Mirror of replyContextGroundingGate extractKeyphrases so prompt requires phrases the gate will check */
  const extractKeyphrasesForGrounding = (text: string): string[] => {
    const stopwords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
      'what', 'when', 'where', 'why', 'how', 'which', 'who', 'whom', 'whose'
    ]);
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 4 && !stopwords.has(w));
    const phrases: string[] = [];
    for (let i = 0; i < words.length - 1; i++) {
      const phrase = `${words[i]} ${words[i + 1]}`;
      if (phrase.length > 8) phrases.push(phrase);
    }
    return [...phrases, ...words].slice(0, 15);
  };

  const tweetAnchors = extractAnchors(request.target_tweet_content);
  const gateKeyphrases = extractKeyphrasesForGrounding(request.target_tweet_content);

  // 🔒 BUILD CONTEXT STRING: Include full conversation context
  let contextString = `TARGET TWEET: "${request.target_tweet_content}"`;
  if (gateKeyphrases.length > 0) {
    contextString += `\n\nREQUIRED PHRASES/WORDS (use at least one VERBATIM in your reply—the system checks for these): ${gateKeyphrases.join(', ')}`;
  } else if (tweetAnchors.length > 0) {
    contextString += `\n\nREQUIRED PHRASES/WORDS (use at least one VERBATIM): ${tweetAnchors.slice(0, 5).join(', ')}`;
  }
  if (tweetAnchors.length > 0) {
    contextString += `\n\nANCHORS (include at least one): ${tweetAnchors.slice(0, 5).join(', ')}`;
  }
  if (request.reply_context?.quoted_text) {
    contextString += `\n\nQUOTED TWEET (what they're responding to): "${request.reply_context.quoted_text}"`;
  }
  if (request.reply_context?.root_text && request.reply_context.root_tweet_id !== request.target_tweet_content) {
    contextString += `\n\nROOT TWEET (original post in thread): "${request.reply_context.root_text}"`;
  }
  if (request.reply_context?.thread_prev_text) {
    contextString += `\n\nPREVIOUS TWEET IN THREAD: "${request.reply_context.thread_prev_text}"`;
  }
  
  // 🎯 ARCHETYPE-FIRST REPLY GENERATION (with adaptive learning)
  const maxChars = parseInt(process.env.REPLY_MAX_CHARS || '220', 10);

  type ReplyArchetype = 'insight_addon' | 'reframe' | 'practical_implication' | 'sharp_one_liner' | 'mini_framework';

  // Select archetype using epsilon-greedy adaptive learning
  let archetype: ReplyArchetype;
  let archetypeReason = '';
  let archetypeMode = '';
  try {
    const { selectArchetypeAdaptive } = await import('../learning/archetypeLearning');
    const selection = await selectArchetypeAdaptive(request.target_tweet_content.length, replyIntent);
    archetype = selection.archetype;
    archetypeReason = selection.reason;
    archetypeMode = selection.mode;
    console.log(`[REPLY_ADAPTER] 🎯 Adaptive archetype: ${archetype} mode=${archetypeMode} reason=${archetypeReason}`);
    console.log(`[REPLY_ADAPTER] 📊 Archetype stats: ${JSON.stringify(selection.stats_snapshot)}`);
  } catch (adaptiveErr: any) {
    // Fallback to template-based selection if learning module fails
    console.warn(`[REPLY_ADAPTER] ⚠️ Adaptive selection failed (${adaptiveErr.message}), using fallback`);
    const templateId = request.template_id || '';
    if (templateId === 'myth_correction' || replyIntent === 'disagree') archetype = 'reframe';
    else if (templateId === 'question_hook') archetype = 'sharp_one_liner';
    else if (request.target_tweet_content.length > 200) archetype = Math.random() < 0.4 ? 'mini_framework' : 'insight_addon';
    else if (request.target_tweet_content.length < 80) archetype = Math.random() < 0.5 ? 'sharp_one_liner' : 'insight_addon';
    else archetype = 'insight_addon';
    archetypeReason = 'fallback';
    archetypeMode = 'fallback';
  }

  const archetypeInstructions: Record<ReplyArchetype, string> = {
    insight_addon: `Add one specific thing they didn't say. Not agreement — new information.
Good: "The temperature drop is actually what triggers melatonin — 65°F is the sweet spot."
Bad: "Great point about sleep! Temperature also matters."`,

    reframe: `Flip their perspective. Same topic, different angle they hadn't considered.
Good: "The leverage isn't the workout — it's the 23 hours after."
Bad: "You make a good point, but consider another angle..."`,

    practical_implication: `Turn what they said into something someone can DO right now.
Good: "That cortisol spike is why a 10-min walk before coffee changes your whole morning."
Bad: "There are many practical implications of what you mentioned."`,

    sharp_one_liner: `ONE sentence. Maximum impact. Under 100 characters if possible.
Good: "Your body doesn't count calories — it counts hormones."
Bad: "While that's an interesting perspective, the real issue is that our bodies process things differently."`,

    mini_framework: `Name 2-3 parts of what they described. Pattern, not advice.
Good: "Two forces here: the habit (automatic) and the environment (what triggers it)."
Bad: "This is a great framework. There are several key components to consider in this area."`,
  };

  // Use strategy prompt if provided (Phase 6.4), otherwise fall back to archetype instructions
  const strategyBlock = request.custom_prompt
    ? `${request.custom_prompt}\n\nAdditional style guide: ${archetypeInstructions[archetype]}`
    : `Write a reply. ${archetypeInstructions[archetype]}`;

  const prompt = `@${request.target_username} tweeted: "${request.target_tweet_content}"

${strategyBlock}
${request.external_insights ? `\nCONTEXT FROM HEALTH TWITTER:\n${request.external_insights}\n` : ''}
Hard rules:
- Use a word from their tweet: ${gateKeyphrases.slice(0, 5).join(', ')}
- Under ${maxChars} chars. Under 140 is better. One sentence is best.
- Write like a smart person dashing off a reply, not a content creator crafting a post
- NEVER start with "Great point", "Interesting", "Your point about", or "That's a great"
- NEVER use the word "crucial" or "indeed" or "whilst"
- No emojis, no thread markers

JSON only: {"content": "your reply"}`;

  console.log(`[REPLY_ADAPTER] archetype=${archetype} intent=${replyIntent} target=@${request.target_username}`);

  console.log(`[REPLY_ADAPTER] Generating reply for @${request.target_username} using model=${request.model || 'gpt-4o-mini'}`);
  console.log(`[REPLY_ADAPTER] Tweet text (truncated): "${request.target_tweet_content.substring(0, 80)}..."`);
  console.log(`[REPLY_ADAPTER] Grounding keyphrases (${gateKeyphrases.length}): ${gateKeyphrases.slice(0, 5).join(', ')}`);
  console.log(`[REPLY_ADAPTER] Anchors (${tweetAnchors.length}): ${tweetAnchors.slice(0, 5).join(', ')}`);
  
  const response = await createBudgetedChatCompletion({
    model: request.model || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: `You are @${process.env.TWITTER_USERNAME || 'Neurix5'}. You reply like a smart friend who happens to know a lot about neuroscience and health. Short, punchy, specific. Never sound like an AI or a textbook.

VOICE:
- Casual. Conversational. Like a text message, not an essay.
- Have opinions: "this is underrated", "most people get this wrong"
- Be specific: "200mg magnesium glycinate" not "magnesium supplementation"
- One insight per reply. Don't try to be comprehensive.
- Under 100 chars is ideal. One sentence is perfect.

NEVER:
- Start with "Great point", "Interesting", "That's a great"
- Use words like "crucial", "indeed", "whilst", "moreover"
- Start with "Studies show" or "Research suggests"
- Sound like a Wikipedia article

GOOD: "the mechanism is actually cortisol suppressing melatonin — 200mg L-theanine fixes this"
BAD: "This is a great point! Studies have shown that cortisol levels can impact melatonin production."
${replyGuidance ? '\n\nDATA-DRIVEN GUIDANCE: ' + replyGuidance : ''}
JSON only: {"content": "..."}` },
      { role: 'user', content: prompt }
    ],
    temperature: 0.5, // Lower than 0.7: more focused output when heavily constrained
    top_p: 1.0,
    max_tokens: 150, // Allow 2-3 sentence replies with specific health insights
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
    const skipReason = replyData.skip_reason || 'empty_content';
    console.log(`[REPLY_ADAPTER] ⏭️ SKIP: ${skipReason} - reply not grounded in tweet content`);
    
    // 🔒 TASK 1: Instrument UNGROUNDED_GENERATION_SKIP
    const error = new Error(`UNGROUNDED_GENERATION_SKIP: ${skipReason}`);
    (error as any).ungroundedReasonCodes = [skipReason];
    (error as any).flaggedClaims = [];
    (error as any).evidenceSnippetsUsed = [];
    (error as any).modelOutputExcerpt = '';
    throw error;
  }
  
  // 🔒 LENGTH VALIDATION REMOVED: planOnlyContentGenerator.ts handles clamping for PLAN_ONLY decisions
  // For non-PLAN_ONLY paths, length validation should be handled by the caller
  // Removed throw to allow planOnlyContentGenerator to apply clamp with grounding preservation
  
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
    let matchedTerms: string[] = [];
    
    if (request.reply_context?.quoted_text) {
      const quotedTerms = request.reply_context.quoted_text.toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 4)
        .slice(0, 10);
      const matched = quotedTerms.filter(term => replyTextLower.includes(term));
      if (matched.length > 0) {
        hasContextReference = true;
        matchedTerms = matched;
      }
    }
    if (!hasContextReference && request.reply_context?.root_text) {
      const rootTerms = request.reply_context.root_text.toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 4)
        .slice(0, 10);
      const matched = rootTerms.filter(term => replyTextLower.includes(term));
      if (matched.length > 0) {
        hasContextReference = true;
        matchedTerms = matched;
      }
    }
    
    if (!hasContextReference) {
      console.log(`[REPLY_ADAPTER] ⏭️ SKIP: ungrounded_generation_skip - reply does not reference concrete detail from tweet`);
      console.log(`[REPLY_ADAPTER]   Tweet terms: ${tweetTerms.slice(0, 5).join(', ')}`);
      console.log(`[REPLY_ADAPTER]   Reply: "${replyData.content.substring(0, 100)}..."`);
      
      // 🔒 TASK 1: Instrument UNGROUNDED_GENERATION_SKIP with details
      const error = new Error('UNGROUNDED_GENERATION_SKIP: reply does not reference concrete detail from tweet/context');
      (error as any).ungroundedReasonCodes = ['no_concrete_reference'];
      (error as any).flaggedClaims = [];
      (error as any).evidenceSnippetsUsed = [];
      (error as any).modelOutputExcerpt = replyData.content.substring(0, 300);
      (error as any).tweetTerms = tweetTerms;
      (error as any).replyContent = replyData.content;
      throw error;
    }
  }

  // Check anchor match for logging
  const matchedAnchors = tweetAnchors.filter(anchor => 
    replyTextLower.includes(anchor.toLowerCase())
  );
  
  let finalContent = replyData.content;
  if (finalContent.length > maxChars) {
    finalContent = finalContent.substring(0, maxChars).trim();
    console.log(`[REPLY_ADAPTER] Trimmed reply to ${maxChars} chars (was ${replyData.content.length})`);
  }

  // ── Output enforcer: hard constraints on tick advisor recommendations ──
  try {
    const { enforceReplyConstraints } = await import('../intelligence/outputEnforcer');
    const { getTickAdvice } = await import('../intelligence/tickAdvisor');
    const advice = await getTickAdvice();
    const enforcement = await enforceReplyConstraints(finalContent, advice);

    if (!enforcement.approved) {
      console.log(`[REPLY_ENFORCER] Violations: ${enforcement.violations.join(', ')}`);
      // If reply is too long, try truncating at last sentence boundary
      if (enforcement.violations.some(v => v.includes('too long')) && finalContent.length > 120) {
        const sentences = finalContent.split(/[.!?]+/).filter(s => s.trim().length > 0);
        if (sentences.length > 1) {
          const shortened = sentences[0].trim() + '.';
          if (shortened.length >= 20 && shortened.length <= 150) {
            console.log(`[REPLY_ENFORCER] Auto-shortened: ${finalContent.length} → ${shortened.length} chars`);
            finalContent = shortened;
          }
        }
      }
    }
  } catch { /* non-fatal */ }

  console.log(`[REPLY_ADAPTER] ✅ Generated reply: ${finalContent.length} chars archetype=${archetype}`);
  console.log(`[REPLY_ADAPTER] Reply: "${finalContent}"`);
  console.log(`[REPLY_ADAPTER] Anchor check: matched=${matchedAnchors.length}/${tweetAnchors.length} anchors=${matchedAnchors.slice(0, 3).join(', ')}`);

  return {
    content: finalContent,
    generator_used: 'reply_adapter',
    is_fallback: false,
    reply_archetype: archetype,
  };
}

/**
 * 🔒 TASK 2: Generate grounded-only fallback reply
 * 
 * This generates a reply that:
 * - References ONLY content from the target tweet snapshot
 * - No external facts, numbers, studies, or medical claims
 * - Allowed: questions, reflections, conditional advice, requests for clarification
 */
export async function generateGroundedFallbackReply(
  request: ReplyGenerationRequest
): Promise<ReplyGenerationResult> {
  const decision_id = uuidv4();
  
  // 🔒 TASK 2: Build grounded-only prompt
  const prompt = `Generate a simple, grounded reply to this tweet. You MUST reference or paraphrase ONLY content from the tweet itself.

TARGET TWEET: "${request.target_tweet_content}"

CRITICAL: Your reply MUST include at least one word or phrase that appears in the tweet above. If the tweet is in a non-English language, you can reference the topic or ask a question about what they mentioned.

STRICT RULES:
1. Reference or paraphrase ONLY what's in the tweet above - no external facts, numbers, studies, or medical claims
2. Allowed responses:
   - Ask a question about something mentioned in the tweet (use words from the tweet)
   - Reflect on what they said using their own words or topic
   - Offer conditional advice ("If [thing from tweet], then [related thing] might help")
   - Request clarification about something in the tweet
3. Forbidden:
   - External facts or statistics
   - References to studies or research
   - Medical claims or health advice beyond what's in the tweet
   - Generic statements not tied to the tweet content
4. Be 1-2 sentences, ≤220 characters
5. Sound conversational and human
6. If tweet is non-English: Reference the topic/concept even if you can't use exact words

Example grounded replies:
- "What's your experience been with [thing from tweet]?"
- "That's interesting - when you mention [thing from tweet], do you mean...?"
- "If [condition from tweet], have you tried [related thing from tweet]?"
- For non-English tweets: "What's your take on [topic/concept from tweet]?" or "How do you approach [topic from tweet]?"

Format as JSON:
{
  "content": "Your grounded reply here"
}`;

  console.log(`[REPLY_ADAPTER] 🔄 Generating grounded fallback reply for @${request.target_username}...`);
  
  const response = await createBudgetedChatCompletion({
    model: request.model || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a helpful conversationalist. Generate replies that reference ONLY content from the target tweet. No external facts or claims. Always respond with valid JSON format.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    top_p: 1.0,
    max_tokens: 200,
    response_format: { type: 'json_object' }
  }, {
    purpose: 'reply_generation_fallback',
    requestId: decision_id
  });

  const rawContent = response.choices[0]?.message?.content;
  if (!rawContent) throw new Error('Empty response from OpenAI');

  const replyData = JSON.parse(rawContent);
  
  if (!replyData.content || replyData.content.length === 0) {
    throw new Error('UNGROUNDED_GENERATION_SKIP: fallback reply is empty');
  }
  
  // 🔒 HARD LENGTH CAP: Use same limit as planOnlyContentGenerator (200 chars, configurable)
  const MAX_REPLY_LENGTH = parseInt(process.env.MAX_REPLY_LENGTH || '200', 10);
  if (replyData.content.length > MAX_REPLY_LENGTH) {
    throw new Error(`Invalid fallback reply: too long (>${MAX_REPLY_LENGTH} chars)`);
  }
  
  // 🔒 TASK 2: Verify fallback reply is grounded (relaxed check for non-English content)
  const tweetTextLower = request.target_tweet_content.toLowerCase();
  const replyTextLower = replyData.content.toLowerCase();
  
  // Extract key terms (including non-English words, shorter minimum length for non-English)
  const tweetTerms = tweetTextLower
    .split(/\s+/)
    .filter(w => w.length > 2 && !['that', 'this', 'with', 'from', 'have', 'been', 'were', 'what', 'when', 'where', 'which', 'their', 'there', 'these', 'those', 'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'].includes(w))
    .slice(0, 15); // More terms for non-English
  
  // Check if reply mentions at least one term from tweet (relaxed for fallback)
  const hasConcreteReference = tweetTerms.some(term => replyTextLower.includes(term));
  
  // Also check for semantic similarity (if reply paraphrases tweet content)
  const tweetWords = tweetTextLower.split(/\s+/).filter(w => w.length > 2);
  const replyWords = replyTextLower.split(/\s+/).filter(w => w.length > 2);
  const commonWords = tweetWords.filter(w => replyWords.includes(w));
  const semanticOverlap = tweetWords.length > 0 ? commonWords.length / Math.max(tweetWords.length, replyWords.length) : 0;
  
  // Fallback passes if: has concrete reference OR semantic overlap > 0.1 (relaxed threshold)
  if (!hasConcreteReference && semanticOverlap < 0.1 && tweetTerms.length > 0) {
    // Check context references
    let hasContextReference = false;
    if (request.reply_context?.quoted_text) {
      const quotedTerms = request.reply_context.quoted_text.toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 2)
        .slice(0, 15);
      hasContextReference = quotedTerms.some(term => replyTextLower.includes(term));
    }
    if (!hasContextReference && request.reply_context?.root_text) {
      const rootTerms = request.reply_context.root_text.toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 2)
        .slice(0, 15);
      hasContextReference = rootTerms.some(term => replyTextLower.includes(term));
    }
    
    if (!hasContextReference) {
      // Last resort: check if reply is a question or reflection about the tweet topic
      const isQuestion = /\?/.test(replyData.content);
      const isReflection = /\b(what|how|why|when|where|which|who|think|consider|wonder|curious|interesting|makes sense|understand)\b/i.test(replyData.content);
      
      if (!isQuestion && !isReflection) {
        throw new Error('UNGROUNDED_GENERATION_SKIP: fallback reply also not grounded');
      }
    }
  }
  
  console.log(`[REPLY_ADAPTER] ✅ Generated grounded fallback reply: ${replyData.content.length} chars`);
  
  return {
    content: replyData.content,
    generator_used: 'reply_adapter_fallback',
    is_fallback: true
  };
}

/**
 * 🔒 CERT_MODE: Generate reply with guaranteed success
 * 
 * This function ensures:
 * - Max 220 chars (auto-truncates if needed)
 * - Always grounded (includes quote or key phrases from snapshot)
 * - Single tweet only
 * - No links, hashtags, @mentions unless target has them
 */
export async function generateCertModeReply(
  request: ReplyGenerationRequest
): Promise<ReplyGenerationResult> {
  const decision_id = uuidv4();
  
  // Extract a short quote (<=60 chars) from snapshot for guaranteed grounding
  const snapshot = request.target_tweet_content;
  const words = snapshot.split(/\s+/);
  let quote = '';
  
  // Find a quote-able phrase (10-15 words, <=60 chars)
  for (let i = 0; i < words.length - 10; i++) {
    const candidate = words.slice(i, i + 12).join(' ');
    if (candidate.length <= 60 && candidate.length >= 20) {
      quote = candidate;
      break;
    }
  }
  
  // Fallback: use first 50 chars if no good quote found
  if (!quote) {
    quote = snapshot.substring(0, 50).trim();
  }
  
  // Extract 2-3 key phrases (>=4 chars each) for grounding proof
  const keyPhrases = extractKeyPhrases(snapshot, 2);
  
  const prompt = `Generate a CERTIFIED reply to this tweet. This reply MUST succeed validation.

TARGET TWEET: "${snapshot}"

CRITICAL REQUIREMENTS:
1. **MUST include this exact quote from the tweet**: "${quote}"
   OR reference at least 2 of these key phrases: ${keyPhrases.join(', ')}
2. **STRICT LENGTH**: Maximum 200 characters (we need buffer for quote)
3. **SINGLE TWEET**: One sentence only, no thread markers
4. **GROUNDED**: Reference specific content from the tweet above
5. **NO LINKS**: Unless the target tweet has links
6. **NO HASHTAGS**: Unless the target tweet has hashtags
7. **NO @MENTIONS**: Unless replying to someone mentioned in the target

FORMAT:
- Start with quote or reference: "${quote}" or "When you mention [key phrase]..."
- Add brief insight or question
- Keep total length ≤200 chars

Example structure:
"${quote}" - [brief follow-up question or insight]

Format as JSON:
{
  "content": "Your reply here (≤200 chars)"
}`;

  console.log(`[REPLY_ADAPTER][CERT_MODE] Generating certified reply for @${request.target_username}...`);
  
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    attempts++;
    
    const response = await createBudgetedChatCompletion({
      model: request.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful conversationalist. Generate replies that ALWAYS include the required quote or key phrases. Always respond with valid JSON format. Maximum 200 characters.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5, // Lower temperature for more consistent output
      top_p: 0.9,
      max_tokens: 150,
      response_format: { type: 'json_object' }
    }, {
      purpose: 'reply_generation_cert',
      requestId: decision_id
    });

    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) {
      if (attempts < maxAttempts) continue;
      throw new Error('Empty response from OpenAI');
    }

    let replyData;
    try {
      replyData = JSON.parse(rawContent);
    } catch (e) {
      if (attempts < maxAttempts) continue;
      throw new Error('Invalid JSON response');
    }
    
    if (!replyData.content || replyData.content.length === 0) {
      if (attempts < maxAttempts) continue;
      throw new Error('Empty reply content');
    }
    
    // Auto-truncate if too long (safely, at word boundary)
    let replyContent = replyData.content;
    if (replyContent.length > 220) {
      console.log(`[REPLY_ADAPTER][CERT_MODE] Truncating reply from ${replyContent.length} to 220 chars...`);
      replyContent = replyContent.substring(0, 217);
      const lastSpace = replyContent.lastIndexOf(' ');
      if (lastSpace > 200) {
        replyContent = replyContent.substring(0, lastSpace) + '...';
      } else {
        replyContent = replyContent.substring(0, 217) + '...';
      }
    }
    
    // 🔒 CERT_MODE: Verify grounding proof
    const groundingProof = verifyGroundingProof(replyContent, snapshot, quote, keyPhrases);
    
    if (!groundingProof.passed) {
      console.log(`[REPLY_ADAPTER][CERT_MODE] Grounding proof failed (attempt ${attempts}/${maxAttempts}): ${groundingProof.reason}`);
      if (attempts < maxAttempts) {
        // Regenerate with stronger anchoring
        const strongerPrompt = `${prompt}

STRONGER ANCHORING REQUIRED:
- You MUST include the exact quote "${quote}" in your reply
- OR you MUST use at least 2 of these exact phrases: ${keyPhrases.join(', ')}
- Previous attempt failed grounding check: ${groundingProof.reason}
- Regenerate with stronger reference to the tweet content.`;
        continue;
      }
      throw new Error(`CERT_MODE grounding proof failed: ${groundingProof.reason}`);
    }
    
    // Final length check
    if (replyContent.length > 220) {
      throw new Error(`CERT_MODE reply still too long after truncation: ${replyContent.length} chars`);
    }
    
    console.log(`[REPLY_ADAPTER][CERT_MODE] ✅ Generated certified reply: ${replyContent.length} chars, grounded: ${groundingProof.method}`);
    
    return {
      content: replyContent,
      generator_used: 'reply_adapter_cert',
      is_fallback: false
    };
  }
  
  throw new Error('CERT_MODE generation failed after max attempts');
}

/**
 * Verify grounding proof for CERT_MODE
 */
function verifyGroundingProof(
  reply: string,
  snapshot: string,
  quote: string,
  keyPhrases: string[]
): { passed: boolean; method?: string; reason?: string } {
  const replyLower = reply.toLowerCase();
  const snapshotLower = snapshot.toLowerCase();
  const quoteLower = quote.toLowerCase();
  
  // Method 1: Check for exact quote match
  if (replyLower.includes(quoteLower)) {
    return { passed: true, method: 'exact_quote' };
  }
  
  // Method 2: Check for >=2 key phrases
  const matchedPhrases = keyPhrases.filter(phrase => {
    const phraseLower = phrase.toLowerCase();
    return replyLower.includes(phraseLower);
  });
  
  if (matchedPhrases.length >= 2) {
    return { passed: true, method: 'key_phrases', reason: `Matched ${matchedPhrases.length} phrases: ${matchedPhrases.join(', ')}` };
  }
  
  // Method 3: Check for partial quote (at least 10 chars overlap)
  if (quote.length >= 10) {
    const quoteWords = quoteLower.split(/\s+/);
    const minWords = Math.max(3, Math.floor(quoteWords.length * 0.5));
    let matchedWords = 0;
    for (const word of quoteWords) {
      if (word.length >= 4 && replyLower.includes(word)) {
        matchedWords++;
      }
    }
    if (matchedWords >= minWords) {
      return { passed: true, method: 'partial_quote', reason: `Matched ${matchedWords} words from quote` };
    }
  }
  
  return { 
    passed: false, 
    reason: `No quote match and only ${matchedPhrases.length} key phrases matched (need 2)` 
  };
}

/**
 * Extract key phrases from text (>=4 chars each)
 */
function extractKeyPhrases(text: string, count: number = 2): string[] {
  const words = text.split(/\s+/);
  const phrases: string[] = [];
  const stopWords = new Set(['that', 'this', 'with', 'from', 'have', 'been', 'were', 'what', 'when', 'where', 'which', 'their', 'there', 'these', 'those', 'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who']);
  
  // Extract 2-word phrases (>=4 chars each word)
  for (let i = 0; i < words.length - 1 && phrases.length < count; i++) {
    const word1 = words[i].toLowerCase().replace(/[^a-z0-9]/g, '');
    const word2 = words[i + 1].toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (word1.length >= 4 && word2.length >= 4 && !stopWords.has(word1) && !stopWords.has(word2)) {
      phrases.push(`${words[i]} ${words[i + 1]}`);
    }
  }
  
  // If not enough phrases, extract single words
  if (phrases.length < count) {
    for (const word of words) {
      const clean = word.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (clean.length >= 4 && !stopWords.has(clean) && !phrases.some(p => p.includes(clean))) {
        phrases.push(word);
        if (phrases.length >= count) break;
      }
    }
  }
  
  return phrases.slice(0, count);
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

