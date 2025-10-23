/**
 * CULTURAL BRIDGE GENERATOR
 * Connects health/science to broader human culture and knowledge
 * Makes complex ideas accessible through books, movies, philosophy, history, trends
 */

import { getOpenAIService } from '../services/openAIService';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { getContentGenerationModel } from '../config/modelConfig';
import { createBudgetedChatCompletion } from '../ai/openaiBudgetedClient';
import { VOICE_GUIDELINES } from './universalRules';

export interface CulturalBridgeContent {
  content: string;
  format: 'single' | 'thread';
  confidence: number;
}

function buildIntelligenceContext(intelligence?: IntelligencePackage): string {
  if (!intelligence) return '';
  
  let context = '\n🔬 INTELLIGENCE INSIGHTS:\n';
  if (intelligence.viral_patterns?.length) {
    context += `Viral patterns: ${intelligence.viral_patterns.slice(0, 3).join(', ')}\n`;
  }
  if (intelligence.competitive_insights) {
    context += `Market insight: ${intelligence.competitive_insights}\n`;
  }
  return context;
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

🚨 HARD RULES:
• Max 260 chars
• No first-person (I/me/my/we)
• Max 2 emojis

🌉 YOUR SUPERPOWER: Make science accessible through culture.

Connect health/science to books, movies, philosophy, history, cultural trends—anything in human knowledge. Make complex ideas relatable through familiar touchpoints.

You can reference anything: ancient wisdom, modern books, shows, historical examples, cultural phenomena. The learning system will discover what cultural bridges resonate.

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

  const userPrompt = `Connect ${topic} to broader culture/knowledge in a way that makes it accessible.`;

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
    }, 'cultural_bridge_content_generation');

    const result = JSON.parse(response.content);
    
    if (format === 'thread') {
      const tweets = result.tweets || [];
      if (!Array.isArray(tweets) || tweets.length === 0) {
        throw new Error('No thread tweets generated');
      }
      return {
        content: tweets.join('\n\n'),
        format: 'thread',
        confidence: 0.8
      };
    } else {
      const tweet = result.tweet || result.content || '';
      if (!tweet) {
        throw new Error('No tweet generated');
      }
      return {
        content: tweet,
        format: 'single',
        confidence: 0.8
      };
    }
  } catch (error: any) {
    console.error('[CULTURAL_BRIDGE] Generation failed:', error.message);
    throw error;
  }
}

