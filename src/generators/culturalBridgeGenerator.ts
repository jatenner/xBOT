/**
 * CULTURAL BRIDGE GENERATOR
 * Connects health/science to broader human culture and knowledge
 * Makes complex ideas accessible through books, movies, philosophy, history, trends
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent } from './generatorUtils';
import { VOICE_GUIDELINES } from './sharedPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface CulturalBridgeContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
}


export async function generateCulturalBridgeContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<CulturalBridgeContent> {
  
  const { topic, format, research, intelligence } = params;
  const intelligenceContext = buildIntelligenceContext(intelligence);
  
  const systemPrompt = `You connect science to broader human culture and knowledge.

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

🌉 YOUR SUPERPOWER: Make science accessible through culture.

Connect health/science to books, movies, philosophy, history, cultural trends—anything in human knowledge. Make complex ideas relatable through familiar touchpoints.

You can reference anything:
- Health influencers and their protocols (Bryan Johnson, Peter Attia, Andrew Huberman, Rhonda Patrick, David Sinclair, Ben Greenfield, Tim Ferriss, Layne Norton, etc.)
- Books (Peter Attia's "Outlive", Matthew Walker's "Why We Sleep", etc.)
- Ancient wisdom, historical practices, cultural traditions
- Modern shows, documentaries, cultural phenomena
- Real people's experiences, transformations, experiments

The learning system will discover what cultural bridges resonate.

What makes cultural bridges work:
• Genuine connection (not forced)
• Familiar touchpoint (people know it)
• Reveals new insight (not just trivia)
• Makes science accessible

${research ? `
Research available: ${research.finding} - ${research.source}
` : ''}

${intelligenceContext}

${format === 'thread' ? `
Return JSON: {"tweets": ["...", "...", ...]}
` : `
Return JSON: {"tweet": "..."}
`}`;

  const userPrompt = `Create content connecting ${topic} to culture, books, philosophy, or history. Make connections in whatever format is most engaging.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.85,
      max_tokens: 300,
      response_format: { type: 'json_object' }
    }, { purpose: 'cultural_bridge_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'CULTURAL_BRIDGE'),
      format,
      confidence: 0.8
    };
    
  } catch (error: any) {
    console.error('[CULTURAL_BRIDGE] Generation failed:', error.message);
    throw new Error(`Cultural bridge generator failed: ${error.message}. System will retry with different approach.`);
  }
}

