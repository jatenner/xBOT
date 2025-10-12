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
  forceFormat?: boolean; // Force specific format instead of auto-deciding
}

export interface GeneratedContent {
  content: string | string[]; // Single tweet or array of tweets for threads
  topic: string;
  angle: string;
  format: 'single' | 'thread';
  quality_score: number;
  uniqueness_indicators: string[];
}

/**
 * Select optimal format based on topic complexity, style, and learning data
 */
function selectOptimalFormat(topic: string, style: string): 'single' | 'thread' {
  // Complex topics that benefit from thread format
  const threadFriendlyTopics = [
    'metabolic flexibility', 'gut-brain axis', 'hormonal optimization',
    'circadian rhythms', 'stress physiology', 'recovery protocols'
  ];
  
  // Topics that work well as single tweets
  const singleFriendlyTopics = [
    'hydration myths', 'exercise misconceptions', 'micronutrient timing'
  ];
  
  // ADAPTIVE LEARNING: Start with 10% threads, let system learn optimal frequency
  const baseThreadProbability = 0.10; // 10% baseline
  
  // TODO: Later integrate with learning system to adjust this probability based on:
  // - Thread vs single engagement rates
  // - Thread vs single follower conversion
  // - Thread vs single save/share rates
  // - Time-of-day performance differences
  
  const randomFactor = Math.random();
  
  // Boost thread probability for complex topics
  let threadProbability = baseThreadProbability;
  if (threadFriendlyTopics.includes(topic)) {
    threadProbability *= 2.0; // 20% for complex topics
  }
  
  // Reduce thread probability for simple topics  
  if (singleFriendlyTopics.includes(topic)) {
    threadProbability *= 0.5; // 5% for simple topics
  }
  
  const shouldCreateThread = randomFactor < threadProbability;
  
  console.log(`[FORMAT_SELECTION] Topic: ${topic}, Thread probability: ${(threadProbability * 100).toFixed(1)}%, Selected: ${shouldCreateThread ? 'thread' : 'single'}`);
  
  return shouldCreateThread ? 'thread' : 'single';
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
  
  // Intelligent format selection (unless forced)
  let selectedFormat = request.format || 'single';
  if (!request.forceFormat) {
    selectedFormat = selectOptimalFormat(selectedTopic, style);
  }
  
  console.log(`[ENHANCED_CONTENT] Generating ${selectedFormat} content for topic: ${selectedTopic}`);

  // Format-specific prompts and limits
  const isThread = selectedFormat === 'thread';
  const maxCharsPerTweet = isThread ? 250 : 250;
  const threadInstructions = isThread ? `

THREAD FORMAT REQUIREMENTS:
- Create 3-5 tweets that work as both a cohesive thread AND individual tweets
- Tweet 1: Hook with main contrarian insight (can stand alone)
- Tweet 2-3: Supporting evidence, mechanisms, or examples  
- Tweet 4-5: Actionable takeaway and engagement question
- Each tweet: ${maxCharsPerTweet} characters maximum
- Each tweet must be complete and valuable on its own
- NO "thread below" or "1/5" numbering
- NO cliffhangers or incomplete thoughts between tweets

Output as JSON array: ["tweet 1 text", "tweet 2 text", "tweet 3 text", ...]` : `

SINGLE TWEET REQUIREMENTS:
- Maximum ${maxCharsPerTweet} characters total
- Complete, standalone insight
- Include contrarian angle and supporting evidence in one tweet`;

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

  const userPrompt = `Create a ${selectedFormat} about ${selectedTopic} in ${style} style.

Requirements:
- Challenge a common misconception about ${selectedTopic}
- Provide specific evidence (studies, statistics, mechanisms)
- Make it actionable and immediately valuable
- What's a counterintuitive truth?
- What mechanism explains the effect?${threadInstructions}

${selectedFormat === 'single' ? `
Output as JSON:
{
  "content": "Your tweet text here",
  "angle": "Brief description of the contrarian angle",
  "evidence_type": "study/mechanism/statistic",
  "uniqueness_factors": ["factor1", "factor2"]
}` : `
Output as JSON:
{
  "content": ["tweet 1 text", "tweet 2 text", "tweet 3 text", ...],
  "angle": "Brief description of the contrarian angle",
  "evidence_type": "study/mechanism/statistic", 
  "uniqueness_factors": ["factor1", "factor2"]
}`}`;

  const response = await createBudgetedChatCompletion({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.8,
    top_p: 0.9,
    max_tokens: isThread ? 800 : 400, // More tokens for threads
    response_format: { type: 'json_object' }
  }, {
    purpose: 'enhanced_content_generation',
    requestId: `enhanced_${selectedFormat}_${Date.now()}`
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

  // Validate and process content based on format
  let finalContent: string | string[];
  
  if (selectedFormat === 'thread') {
    // Handle thread content (array of tweets)
    const threadContent = Array.isArray(parsedContent.content) 
      ? parsedContent.content 
      : [parsedContent.content]; // Fallback if LLM returns single string
    
    // Validate each tweet in thread
    const validatedThreadContent = threadContent
      .filter((tweet: string) => typeof tweet === 'string' && tweet.trim().length > 0)
      .slice(0, 5) // Max 5 tweets
      .map((tweet: string) => {
        let cleanTweet = tweet.trim();
        
        // Ensure each tweet is under character limit
        if (cleanTweet.length > maxCharsPerTweet) {
          // For threads, try to cut at sentence boundary
          const sentences = cleanTweet.split(/[.!?]+/);
          cleanTweet = sentences[0] + (sentences[0].endsWith('.') ? '' : '.');
          if (cleanTweet.length > maxCharsPerTweet) {
            cleanTweet = cleanTweet.substring(0, maxCharsPerTweet - 1) + '.';
          }
        }
        
        // Ensure proper punctuation
        if (!/[.!?]$/.test(cleanTweet)) {
          cleanTweet += '.';
        }
        
        return cleanTweet;
      });
    
    // Ensure we have at least 3 tweets for a thread
    if (validatedThreadContent.length < 3) {
      console.warn(`[ENHANCED_CONTENT] Thread too short (${validatedThreadContent.length} tweets), falling back to single`);
      selectedFormat = 'single';
      finalContent = validatedThreadContent[0] || 'New research challenges common health assumptions about optimizing daily habits.';
    } else {
      finalContent = validatedThreadContent;
    }
  } else {
    // Handle single tweet content
    const singleContent = Array.isArray(parsedContent.content) 
      ? parsedContent.content[0] 
      : parsedContent.content;
    
    finalContent = await validateAndFixSingleTweet(singleContent, userPrompt, systemPrompt);
  }

  // Calculate quality score
  const qualityScore = calculateQualityScore(parsedContent);

  return {
    content: finalContent,
    topic: selectedTopic,
    angle: parsedContent.angle || 'contrarian insight',
    format: selectedFormat,
    quality_score: qualityScore,
    uniqueness_indicators: parsedContent.uniqueness_factors || []
  };
}

/**
 * Validate and fix single tweet content (existing logic)
 */
async function validateAndFixSingleTweet(content: string, userPrompt: string, systemPrompt: string): Promise<string> {
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
          content = retryContent;
          console.log(`[ENHANCED_CONTENT] Successfully regenerated shorter content (${content.length} chars)`);
        } else {
          console.warn(`[ENHANCED_CONTENT] Retry failed, using fallback content`);
          content = `New research challenges common health assumptions. Here's what the data actually shows about optimizing your daily habits.`;
        }
      } catch (e) {
        console.warn(`[ENHANCED_CONTENT] Retry parsing failed, using fallback`);
        content = `New research challenges common health assumptions. Here's what the data actually shows about optimizing your daily habits.`;
      }
    } else {
      console.warn(`[ENHANCED_CONTENT] Retry failed, using fallback content`);
      content = `New research challenges common health assumptions. Here's what the data actually shows about optimizing your daily habits.`;
    }
  }

  // Validate final content doesn't end with incomplete thoughts
  if (content.endsWith('...') || content.endsWith('..')) {
    // Remove ellipses if present
    content = content.replace(/\.{2,}$/, '.').trim();
  }
  
  // Ensure content ends with proper punctuation
  if (!/[.!?]$/.test(content)) {
    content += '.';
  }

  return content;
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
