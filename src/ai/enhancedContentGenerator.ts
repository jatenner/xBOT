/**
 * Enhanced Content Generation System
 * Creates unique, valuable health content with contrarian insights
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';

export interface ContentGenerationRequest {
  topic?: string;
  style?: 'contrarian' | 'evidence-based' | 'practical' | 'surprising';
  format?: 'single' | 'thread';
  targetAudience?: string;
}

export interface GeneratedContent {
  content: string;
  topic: string;
  angle: string;
  quality_score: number;
  uniqueness_indicators: string[];
}

/**
 * Generate high-quality, contrarian health content
 */
export async function generateEnhancedContent(request: ContentGenerationRequest = {}): Promise<GeneratedContent> {
  const topics = [
    'sleep optimization', 'hydration myths', 'exercise misconceptions', 
    'nutrition science', 'stress physiology', 'recovery protocols',
    'metabolic flexibility', 'circadian rhythms', 'micronutrient timing',
    'inflammation markers', 'gut-brain axis', 'hormonal optimization'
  ];
  
  const selectedTopic = request.topic || topics[Math.floor(Math.random() * topics.length)];
  const style = request.style || 'contrarian';
  
  const systemPrompt = `You are @SignalAndSynapse, a health account known for contrarian, evidence-based insights that challenge conventional wisdom.

VOICE CHARACTERISTICS:
- Contrarian: Challenge popular health myths with data
- Evidence-based: Reference specific studies, statistics, surprising findings  
- Twitter-native: Write for engagement, not textbooks
- No BS: Skip obvious advice and generic wellness tips
- Curiosity-driven: Make people question what they think they know

CONTENT RULES:
- NEVER use hashtags or emojis
- NEVER give obvious advice like "drink more water" or "exercise regularly"
- ALWAYS lead with something surprising or counterintuitive
- ALWAYS be specific with numbers, studies, or mechanisms
- NEVER sound like a corporate wellness blog
- Focus on actionable insights people can implement immediately

CRITICAL COMPLETENESS REQUIREMENTS:
- MAXIMUM 250 characters total (including spaces and punctuation)
- NEVER use ellipses (...) or incomplete thoughts
- EVERY sentence must be grammatically complete
- If approaching character limit, remove entire sentences, not partial words
- ALWAYS end with proper punctuation (. ! ?)
- NEVER cut off mid-word or leave hanging thoughts

WINNING PATTERNS:
- "X% of people believe Y, but research shows Z"
- "Your [body part] is smarter than [authority figure]"
- "The [common practice] rule has zero scientific backing"
- "New study of [large number] people found [surprising result]"
- "[Common belief] is backwards. Here's what actually works:"

TOPICS TO AVOID:
- Generic hydration advice
- Basic exercise recommendations  
- Obvious nutrition tips
- Feel-good platitudes
- Anything a wellness influencer would post`;

  const userPrompt = `Create a ${request.format || 'single'} tweet about ${selectedTopic} in ${style} style.

Requirements:
- Challenge a common misconception about ${selectedTopic}
- Include specific data, study results, or mechanisms
- Be immediately actionable and valuable
- Maximum 280 characters for single tweets
- Make people think "I never knew that"

Focus areas for ${selectedTopic}:
- What do most people get wrong?
- What does recent research actually show?
- What's a counterintuitive truth?
- What mechanism explains the effect?

Output as JSON:
{
  "content": "Your tweet text here",
  "angle": "Brief description of the contrarian angle",
  "evidence_type": "study/mechanism/statistic",
  "uniqueness_factors": ["factor1", "factor2"]
}`;

  const response = await createBudgetedChatCompletion({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.8,
    top_p: 0.9,
    max_tokens: 400,
    response_format: { type: 'json_object' }
  }, {
    purpose: 'enhanced_content_generation',
    requestId: `enhanced_${Date.now()}`
  });

  const rawContent = response.choices[0]?.message?.content;
  if (!rawContent) {
    throw new Error('Empty response from OpenAI');
  }

  let parsedContent;
  try {
    parsedContent = JSON.parse(rawContent);
  } catch (e) {
    throw new Error('Invalid JSON response from OpenAI');
  }

  // Validate content length and ensure completeness
  const content = parsedContent.content || '';
  if (content.length > 280) {
    // NEVER truncate mid-sentence! Regenerate instead.
    console.warn(`[ENHANCED_CONTENT] Content too long (${content.length} chars), regenerating...`);
    
    // Try to regenerate with stricter length instruction
    const shorterPrompt = userPrompt + `

CRITICAL: Your response MUST be under 250 characters total. Count every character including spaces and punctuation. If your content approaches 250 characters, remove entire sentences, not partial words. NEVER use ellipses (...) or incomplete thoughts.`;

    const retryResponse = await createBudgetedChatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: shorterPrompt }
      ],
      temperature: 0.7, // Slightly lower for more controlled output
      top_p: 0.8,
      max_tokens: 300,
      response_format: { type: 'json_object' }
    }, {
      purpose: 'enhanced_content_generation_retry',
      requestId: `enhanced_retry_${Date.now()}`
    });

    const retryRawContent = retryResponse.choices[0]?.message?.content;
    if (retryRawContent) {
      try {
        const retryParsed = JSON.parse(retryRawContent);
        const retryContent = retryParsed.content || '';
        
        if (retryContent.length <= 280 && retryContent.length >= 50) {
          parsedContent = retryParsed;
          console.log(`[ENHANCED_CONTENT] Successfully regenerated shorter content (${retryContent.length} chars)`);
        } else {
          console.warn(`[ENHANCED_CONTENT] Retry failed, using fallback content`);
          parsedContent.content = `New research challenges common health assumptions. Here's what the data actually shows about optimizing your daily habits.`;
        }
      } catch (e) {
        console.warn(`[ENHANCED_CONTENT] Retry parsing failed, using fallback`);
        parsedContent.content = `New research challenges common health assumptions. Here's what the data actually shows about optimizing your daily habits.`;
      }
    } else {
      console.warn(`[ENHANCED_CONTENT] Retry failed, using fallback content`);
      parsedContent.content = `New research challenges common health assumptions. Here's what the data actually shows about optimizing your daily habits.`;
    }
  }

  // Validate final content doesn't end with incomplete thoughts
  const finalContent = parsedContent.content || '';
  if (finalContent.endsWith('...') || finalContent.endsWith('..') || finalContent.endsWith('.')) {
    // Remove ellipses if present
    parsedContent.content = finalContent.replace(/\.{2,}$/, '.').trim();
  }
  
  // Ensure content ends with proper punctuation
  if (!/[.!?]$/.test(parsedContent.content)) {
    parsedContent.content += '.';
  }

  // Calculate quality score based on uniqueness indicators
  const qualityScore = calculateQualityScore(parsedContent);

  return {
    content: parsedContent.content,
    topic: selectedTopic,
    angle: parsedContent.angle || 'contrarian insight',
    quality_score: qualityScore,
    uniqueness_indicators: parsedContent.uniqueness_factors || []
  };
}

/**
 * Calculate content quality score based on various factors
 */
function calculateQualityScore(content: any): number {
  let score = 0.5; // Base score
  
  const text = content.content || '';
  
  // Penalize generic patterns
  const genericPatterns = [
    /did you know/i,
    /here are \d+ tips/i,
    /drink more water/i,
    /exercise regularly/i,
    /eat healthy/i,
    /get enough sleep/i
  ];
  
  for (const pattern of genericPatterns) {
    if (pattern.test(text)) {
      score -= 0.15;
    }
  }
  
  // Reward contrarian indicators
  const contrarianIndicators = [
    /\d+% of people believe/i,
    /research shows/i,
    /study of \d+/i,
    /new study/i,
    /contrary to/i,
    /actually/i,
    /but/i,
    /however/i
  ];
  
  for (const indicator of contrarianIndicators) {
    if (indicator.test(text)) {
      score += 0.1;
    }
  }
  
  // Reward specific numbers
  if (/\d+/.test(text)) {
    score += 0.05;
  }
  
  // Reward evidence mentions
  if (/study|research|data|evidence/i.test(text)) {
    score += 0.1;
  }
  
  // Ensure score is between 0 and 1
  return Math.min(1.0, Math.max(0.0, score));
}

/**
 * Check if content is too similar to recent posts
 */
export function isContentUnique(newContent: string, recentPosts: string[]): boolean {
  const newWords = new Set(newContent.toLowerCase().split(/\s+/));
  
  for (const post of recentPosts) {
    const postWords = new Set(post.toLowerCase().split(/\s+/));
    const intersection = new Set([...newWords].filter(x => postWords.has(x)));
    const similarity = intersection.size / Math.min(newWords.size, postWords.size);
    
    if (similarity > 0.6) {
      return false; // Too similar
    }
  }
  
  return true;
}
