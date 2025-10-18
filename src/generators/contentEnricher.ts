/**
 * CONTENT ENRICHER
 * Post-generation enhancer that adds "contrast injections" to content
 * Makes 60% of posts more engaging by adding a "vs conventional wisdom" angle
 * 
 * This runs AFTER sanitization but BEFORE final posting
 * Optionally enriches content without changing core message
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';

export interface EnrichmentRequest {
  content: string | string[];
  topic: string;
  format: 'single' | 'thread';
  force?: boolean; // Force enrichment (skip 60% probability)
}

export interface EnrichmentResult {
  original_content: string | string[];
  enriched_content: string | string[];
  enriched: boolean;
  contrast_added: boolean;
  improvement_score: number; // 0-100
  explanation: string;
}

/**
 * Main enrichment function
 * Adds contrast injection to 60% of content (or all if force=true)
 */
export async function enrichContent(request: EnrichmentRequest): Promise<EnrichmentResult> {
  const { content, topic, format, force = false } = request;
  
  // 60% probability of enrichment (unless forced)
  const shouldEnrich = force || Math.random() < 0.6;
  
  if (!shouldEnrich) {
    return {
      original_content: content,
      enriched_content: content,
      enriched: false,
      contrast_added: false,
      improvement_score: 0,
      explanation: 'Skipped enrichment (random 40%)'
    };
  }
  
  const fullContent = Array.isArray(content) ? content.join('\n\n') : content;
  
  try {
    console.log('🎨 ENRICHMENT: Adding contrast injection...');
    
    const systemPrompt = `You are a content enrichment specialist. Your job is to add a "vs conventional wisdom" angle to health content WITHOUT changing the core message.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 YOUR JOB: ADD CONTRAST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BEFORE enrichment:
"Intermittent fasting 16:8 (eat 12pm-8pm) + 500mg NMN supplement daily. Fasting initiates autophagy, clearing damaged cells."

AFTER enrichment:
"Intermittent fasting 16:8 (eat 12pm-8pm) + 500mg NMN supplement daily. Fasting initiates autophagy, clearing damaged cells. Most people focus on WHEN to eat. Few realize fasting works BECAUSE of cellular cleanup, not calorie restriction."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ ENRICHMENT STRATEGIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. "Most people think X, but actually Y"
2. "Common advice focuses on A, but the real mechanism is B"
3. "Everyone talks about X, but misses Y"
4. "The popular approach does Z, but science shows W"
5. Add a comparison to conventional wisdom
6. Add a "why this matters" contrast

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ DON'T:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Change core facts or numbers
- Add first-person language
- Use banned phrases ("Who knew?", "Turns out", etc.)
- Make it longer than +50 characters total
- Change the main message

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📏 CHARACTER LIMITS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Single tweets: 270 characters max (after enrichment)
- Thread tweets: 250 characters max per tweet (after enrichment)
- If adding contrast would exceed limit, DON'T enrich

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return JSON:
{
  "enriched_content": "string or array of strings",
  "contrast_added": true/false,
  "improvement_score": 0-100,
  "explanation": "What contrast you added"
}`;

    const userPrompt = `Original content about "${topic}":
${fullContent}

Add a subtle "vs conventional wisdom" angle that makes this more engaging WITHOUT exceeding character limits.`;

    const completion = await createBudgetedChatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    }, {
      purpose: 'content_enrichment'
    });

    const aiContent = completion.choices[0]?.message?.content;
    if (!aiContent) {
      throw new Error('No enrichment generated');
    }

    const parsed = JSON.parse(aiContent);
    
    // Validate character limits
    const enrichedContent = parsed.enriched_content;
    const isValid = validateCharacterLimits(enrichedContent, format);
    
    if (!isValid) {
      console.log('⚠️ ENRICHMENT: Exceeded character limit, using original');
      return {
        original_content: content,
        enriched_content: content,
        enriched: false,
        contrast_added: false,
        improvement_score: 0,
        explanation: 'Enrichment exceeded character limit'
      };
    }
    
    console.log(`✓ ENRICHMENT: Success (improvement: ${parsed.improvement_score}/100)`);
    console.log(`  Added: ${parsed.explanation}`);
    
    return {
      original_content: content,
      enriched_content: enrichedContent,
      enriched: true,
      contrast_added: parsed.contrast_added || true,
      improvement_score: parsed.improvement_score || 50,
      explanation: parsed.explanation || 'Added contrast angle'
    };
    
  } catch (error) {
    console.error('❌ ENRICHMENT_ERROR:', error);
    
    // Return original content on error
    return {
      original_content: content,
      enriched_content: content,
      enriched: false,
      contrast_added: false,
      improvement_score: 0,
      explanation: `Error: ${error}`
    };
  }
}

/**
 * Validate that enriched content doesn't exceed character limits
 */
function validateCharacterLimits(content: string | string[], format: 'single' | 'thread'): boolean {
  if (format === 'single') {
    const text = Array.isArray(content) ? content[0] : content;
    return text.length <= 270;
  }
  
  // Thread format
  const tweets = Array.isArray(content) ? content : [content];
  return tweets.every(tweet => tweet.length <= 250);
}

/**
 * Check if content already has contrast language
 * (avoid double-contrasting)
 */
export function hasContrastLanguage(content: string): boolean {
  const contrastPatterns = [
    /most people (think|believe|focus on|say)/i,
    /common(ly)? (advice|belief|wisdom)/i,
    /everyone (thinks|says|talks about)/i,
    /conventional wisdom/i,
    /vs\s/i,
    /but actually/i,
    /but the real/i,
    /but (science|research|data) shows/i
  ];
  
  return contrastPatterns.some(pattern => pattern.test(content));
}

/**
 * Batch enrichment for multiple pieces of content
 */
export async function enrichContentBatch(requests: EnrichmentRequest[]): Promise<EnrichmentResult[]> {
  const results: EnrichmentResult[] = [];
  
  for (const request of requests) {
    const result = await enrichContent(request);
    results.push(result);
  }
  
  return results;
}

