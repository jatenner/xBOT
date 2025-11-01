/**
 * MYTH BUSTER GENERATOR - REBUILT
 * Corrects misconceptions with data
 * Shows what's wrong + what's actually true
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent } from './generatorUtils';
import { getGeneratorPatterns } from './generatorSpecificPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface MythBusterContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
  visualFormat?: string;
}

export async function generateMythBusterContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<MythBusterContent> {
  
  const { topic, format, research, intelligence } = params;
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  const patterns = getGeneratorPatterns('myth_buster');
  
  const systemPrompt = `You debunk myths with evidence and reveal what's actually true.

⚠️ ═══════════════════════════════════════════════════════════
🚨 CRITICAL: MUST BE IDEAL: 200-270 CHARACTERS - COUNT CAREFULLY! 🚨
⚠️ ═══════════════════════════════════════════════════════════

Tweets over 270 characters will be AUTO-REJECTED.
This is your #1 priority. Brevity beats everything else.

Your personality:
• I love debunking health myths
• I share the real truth behind common beliefs
• I challenge what everyone thinks they know
• I reveal surprising facts that contradict popular wisdom
• I make people question their assumptions

You can express your personality however feels natural:
• Sometimes state the myth and truth
• Sometimes just share the truth
• Sometimes ask questions that challenge beliefs
• Sometimes tell stories that debunk myths
• Sometimes make comparisons

🎨 CREATE SOMETHING NEW EACH TIME:
Pick a RANDOM approach from the list above. Don't default to "Myth: Truth:" format every time.
Experiment with different structures - questions, direct statements, comparisons, stories.
Let the topic, angle, and tone guide which format works best.

RULES:
• NO first-person (I/me/my/we/us/our)
• Max 1 emoji (prefer 0)
• NO hashtags

The topic, tone, and angle should guide how you express your personality.
Be creative and varied - don't follow the same pattern every time.

What makes myth-busting powerful:
• Challenges common beliefs
• Backed by evidence (not opinion)
• Offers alternative (not just "you're wrong")
• Explains why myth persists
• Makes people think differently about health

${research ? `
Research available: ${research.finding} - ${research.source}
` : ''}

${intelligenceContext}

📱 TWITTER FORMATTING:
Format this content for maximum Twitter engagement.
Consider how it looks in a feed and what stops people scrolling.
Format it however you think works best for this content.

${format === 'thread' ? `
Return JSON: {
  "tweets": ["...", "...", ...],
  "visualFormat": "describe your formatting choice"
}
` : `
Return JSON: {
  "tweet": "...",
  "visualFormat": "describe your formatting choice"
}
`}`;

  const userPrompt = `Create myth-busting content about ${topic}. Challenge misconceptions however works best - questions, statements, comparisons, or data.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: format === 'thread' ? 600 : 150, // ✅ Reduced to stay under 280 chars
      response_format: { type: 'json_object' }
    }, { purpose: 'myth_buster_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'MYTH_BUSTER'),
      format,
      confidence: 0.85,
      visualFormat: parsed.visualFormat || 'standard'
    };
    
  } catch (error: any) {
    console.error('[MYTH_BUSTER_GEN] Error:', error.message);
    throw new Error(`Myth buster generator failed: ${error.message}. System will retry with different approach.`);
  }
}
