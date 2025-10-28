/**
 * STORYTELLER GENERATOR
 * Personality: Shares real stories, case studies, narratives
 * Voice: Narrative-driven, transformation-focused, relatable
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent, createFallbackContent } from './generatorUtils';
import { VOICE_GUIDELINES } from './sharedPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface StorytellerContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
}

export async function generateStorytellerContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<StorytellerContent> {
  
  const { topic, format, research, intelligence } = params;
  const intelligenceContext = buildIntelligenceContext(intelligence);
  
  const systemPrompt = `You tell real stories that make people stop scrolling.

${VOICE_GUIDELINES}

⚠️ ═══════════════════════════════════════════════════════════
🚨 CRITICAL: MUST BE UNDER 260 CHARACTERS - COUNT CAREFULLY! 🚨
⚠️ ═══════════════════════════════════════════════════════════

Tweets over 260 characters will be AUTO-REJECTED.
This is your #1 priority. Brevity beats everything else.

OTHER HARD RULES:
• NO first-person (I/me/my/we/us/our)
• Max 2 emojis (prefer 0-1)

⚠️ REMINDER: 260 CHARACTER ABSOLUTE LIMIT ⚠️
• NO fake unnamed people

📖 YOUR SUPERPOWER: Transform information into narrative.

You can tell stories about real people, populations, historical figures, research subjects, or universal human experiences. Make it specific, surprising, and memorable.

What works in stories:
• Specific beats generic (real names, real places, real outcomes)
• Surprising beats expected (defies assumptions)
• Concrete beats abstract (visualizable details)

Sometimes use numbers and mechanisms. Sometimes pure narrative. The learning system will discover what resonates.

${research ? `
Research available: ${research.finding} - ${research.source}
Mechanism: ${research.mechanism}
` : ''}

${intelligenceContext}

${format === 'thread' ? `
OUTPUT: Return valid JSON array of 3-5 tweets (150-230 chars each):
Tweet 1: The hook - real example or surprising fact
Tweet 2: The specifics - what actually happened  
Tweet 3: The mechanism - why it worked
Tweet 4: The insight - what this reveals

REAL examples only. Make it fascinating.
Format your response as JSON.
` : `
OUTPUT: Return single tweet in JSON format (180-260 chars MAX - MUST fit in 280 chars):
Real example with mechanism - make it stop-scrolling interesting

🚨 CRITICAL: Tweet MUST be under 260 characters. Count carefully.
Format your response as JSON.
`}`;

  const userPrompt = `Create narrative content about ${topic}. Use stories, examples, or case studies in whatever format is most engaging.

${format === 'thread' ? 'Make it a compelling thread with real examples.' : 'Make it memorable and specific.'}`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.85, // High creativity for narrative
      max_tokens: format === 'thread' ? 600 : 150, // ✅ Reduced to stay under 280 chars
      response_format: { type: 'json_object' }
    }, { purpose: 'storyteller_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'GENERATOR'),
      format,
      confidence: 0.8
    };
    
  } catch (error: any) {
    console.error('[STORYTELLER_GEN] Error:', error.message);
    
    // NO FALLBACK - Throw error to force retry with different generator
    // We will NOT post fake case studies as fallback content
    throw new Error(`Storyteller generator failed: ${error.message}. System will retry with different approach.`);
  }
}

