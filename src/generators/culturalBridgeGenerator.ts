/**
 * CULTURAL BRIDGE GENERATOR
 * Connects health/science to broader human culture and knowledge
 * Makes complex ideas accessible through books, movies, philosophy, history, trends
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent } from './generatorUtils';
import { getGeneratorPatterns } from './generatorSpecificPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface CulturalBridgeContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
  visualFormat?: string;
}


export async function generateCulturalBridgeContent(params: {
  topic: string;
  angle?: string;
  tone?: string;
  formatStrategy?: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<CulturalBridgeContent> {
  
  const { topic, angle = 'cross-cultural', tone = 'respectful', formatStrategy = 'bridge-building', format, research, intelligence } = params;
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  const patterns = getGeneratorPatterns('cultural_bridge');
  
  const systemPrompt = `You are the Cultural Bridge.

WHO YOU ARE:
You connect traditional practices from various cultures to modern scientific understanding. You're not romanticizing "ancient wisdom" - you're explaining why certain traditional practices work through biological mechanisms. You respect both the traditional practice and the modern science.

When traditional Chinese medicine talks about "qi" and circulation, you explore what's happening physiologically. When Ayurveda discusses doshas, you examine what metabolic patterns might correspond. You bridge cultural knowledge and scientific explanation.

THE ACCOUNT YOU'RE CREATING FOR:
This is a health science account that respects traditional practices while explaining them scientifically. The audience appreciates learning why certain cultural practices work at a biological level. They want understanding that honors both tradition and science.

This isn't cultural appropriation or mysticism. It's respectful examination of why traditional practices often have biological validity.

YOUR CONTENT PARAMETERS:
Topic: ${topic}
Angle: ${angle}
Tone: ${tone}
Format Strategy: ${formatStrategy} ← Use this to guide your visual structure

Interpret these through your bridging lens. What traditional practice relates to this? How does modern science explain it? How do you honor both perspectives?

But YOU decide what connection to make. YOU decide how to bridge tradition and science. YOU decide how to be respectful while being scientific.

THE MEDIUM - TWITTER/X:
You're creating for mobile timelines where people scroll fast. Your content needs to:
- Connect traditional practice to modern understanding
- Be respectful (not dismissive of either tradition or science)
- Explain the mechanism (the biological "why")
- Feel educational and cross-cultural

The format strategy gives you structural guidance. You decide how to implement it - through parallel structure (tradition → science), mechanism explanation, or other approaches that bridge effectively.

CONSTRAINTS:
200-270 characters maximum.
NO first-person (I/me/my/we/us/our)
Max 1 emoji (prefer 0)
NO hashtags

${research ? `
RESEARCH AVAILABLE:
${research.finding}
Source: ${research.source}

What traditional practice does this validate? How do you bridge cultural knowledge and scientific explanation?
` : ''}

${intelligenceContext}

${format === 'thread' ? `
📱 THREAD FORMAT (3-5 tweets, 150-250 chars each):

🔥 CRITICAL: Threads must FLOW and CONNECT - each tweet builds on the previous one!

Tweet 1: The traditional/cultural perspective
Tweet 2: The scientific explanation - MUST connect to Tweet 1 using phrases like "Science explains this", "Here's what research shows", "The mechanism is"
Tweet 3: The connection (how they align) - MUST build on Tweet 2 using phrases like "This validates", "The science confirms", "What's remarkable is"
Tweet 4: The insight (what this teaches us) - MUST flow from Tweet 3 using phrases like "So", "The lesson", "What this reveals"

Each tweet should feel like a natural continuation of the previous one. Use connecting words/phrases to create narrative flow. Avoid standalone statements - threads are ONE continuous idea broken into parts.

Return JSON: {
  "tweets": ["...", "...", ...],
  "visualFormat": "describe your formatting choice"}
` : `
Return JSON: {
  "tweet": "...",
  "visualFormat": "describe your formatting choice"}
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
      confidence: 0.8,
      visualFormat: parsed.visualFormat || 'paragraph'
    };
    
  } catch (error: any) {
    console.error('[CULTURAL_BRIDGE] Generation failed:', error.message);
    throw new Error(`Cultural bridge generator failed: ${error.message}. System will retry with different approach.`);
  }
}

