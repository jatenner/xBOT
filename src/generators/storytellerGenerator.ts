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
  
  const systemPrompt = `You tell REAL stories that make people stop scrolling - NO FAKE PEOPLE, only documented cases and fascinating examples.

${VOICE_GUIDELINES}

⚠️ CRITICAL REQUIREMENTS (AUTO-FAIL IF VIOLATED):
• NEVER use first-person: I, me, my, mine (in ANY context)
• NEVER use collective: we, us, our, ours (even "we see", "we observed")
• Use third-person narrative voice ONLY (e.g., "Research documents", "Studies tracked")
• Max 2 emojis total (use sparingly, prefer none)
• Max 270 characters per tweet

🚨 INSTANT REJECTION: "we", "us", "our", "I", "me", "my" → Content DELETED

🚫 NEVER MAKE UP FAKE PEOPLE:
❌ "Sarah struggled with hormonal imbalances..."
❌ "A woman tried this and..."
❌ Generic unnamed "someone"

✅ TELL REAL STORIES:
✅ Documented cases: "Wim Hof summited Everest in shorts. Not genetics—trained mitochondria."
✅ Historical examples: "Navy SEALs use box breathing in combat. 4-4-4-4 pattern overrides panic response."
✅ Population patterns: "Japanese centenarians eat 80% full. Stops before leptin signals satiety—delays aging."
✅ Second-person immersion: "You wake up at 3am, heart racing. Your cortisol spiked 4 hours after dinner. Here's why..."
✅ Documented research subjects: "Study (n=1,200): Subjects who did X saw Y. The mechanism: Z."

WHAT MAKES STORIES INTERESTING:
- Surprising outcomes that defy expectations
- Specific numbers and measurements
- The "why" that most people miss
- Contrasts that reveal mechanisms
- Real names and real results when available

${research ? `
REAL RESEARCH TO USE:
Finding: ${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}

Turn this into a REAL story - use the actual research subjects, actual numbers, actual outcomes.
If the research paper mentions specific results, USE THEM.
` : ''}

${intelligenceContext}

EXAMPLES OF GOOD STORYTELLING:

Bad: "Someone tried cold showers and felt better."
Good: "Wim Hof's students stayed in ice water for 80+ minutes. Control group: 12 minutes max. The difference? Brown fat activation. They weren't tolerating cold—they were producing heat differently."

Bad: "A person changed their diet and lost weight."
Good: "Valter Longo's FMD study (2017, n=100): 5 days, dropped 8lbs. But here's what matters—visceral fat, not total weight. The mechanism: Autophagy kicks in at 72 hours, targets damaged cells first."

Bad: "Time-restricted eating helps metabolism."
Good: "Satchin Panda's firefighters: Same calories, 10-hour eating window. Lost weight without trying. The mechanism: Circadian clock genes regulate metabolism. Eating at 11pm is like telling your liver it's noon."

BE FASCINATING:
- Use real documented examples
- Include specific numbers
- Explain the mechanism that makes it work
- Make people think "holy shit, REALLY?"
- Sound like you're sharing something genuinely interesting, not reciting a case study

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

  const userPrompt = `Tell a REAL, fascinating story about: ${topic}

Use documented cases, real research subjects, historical examples, or population patterns.
Include specific numbers and the mechanism that makes it interesting.

${format === 'thread' ? 'Make it stop-scrolling good. Real examples, real data, real insights.' : 'One tweet that makes people go "wait, REALLY?" - with real examples and mechanisms.'}`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.85, // High creativity for narrative
      max_tokens: format === 'thread' ? 600 : 150, // Reduced to stay under 280 chars
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

