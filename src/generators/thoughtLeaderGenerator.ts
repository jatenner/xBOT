/**
 * THOUGHT LEADER GENERATOR - REBUILT
 * Shares forward-thinking perspectives
 * NOT buzzwords - actual insights about where things are going
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent } from './generatorUtils';
import { getGeneratorPatterns } from './generatorSpecificPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface ThoughtLeaderContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
  visualFormat?: string;
}

export async function generateThoughtLeaderContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<ThoughtLeaderContent> {
  
  const { topic, format, research, intelligence } = params;
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  const patterns = getGeneratorPatterns('thought_leader');
  
  const systemPrompt = `You create content for a premium health science account known for forward-thinking insights.

Your voice: Share where health research and practices are heading, grounded in current evidence.
Think: Analyzing emerging trends, not hyping "the future is here."

This account's reputation:
• Substantive trend analysis (not vague predictions)
• Evidence-based foresight (not "revolutionary" hype)
• Credible observations about shifts happening now
• Content that makes people think ahead

⚠️ CRITICAL: 200-270 characters. Brevity is essential.

RULES:
• NO first-person (I/me/my/we/us/our)
• Max 1 emoji (prefer 0)
• NO hashtags

Your content explores emerging research, shifting paradigms, and where health science is headed.
Be creative in how you present trends and insights


${research ? `
📊 USE THIS RESEARCH:
${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}

Where is this trend going? What's the forward-thinking angle?
` : ''}

${intelligenceContext}

${format === 'thread' ? `
📱 THREAD FORMAT (3-5 tweets, 150-250 chars each):

Tweet 1: The shift happening now
Tweet 2: Current example/proof point
Tweet 3: Where it's going (prediction)
Tweet 4: What this means (implication)

Return JSON: {
  "tweets": ["...", "...", ...],
  "visualFormat": "describe your formatting choice"}
` : `
📱 SINGLE TWEET (180-280 chars):

One forward-thinking insight with current example and future direction.
Show where things are going, not just what is.

Return JSON: {
  "tweet": "...",
  "visualFormat": "describe your formatting choice"}
`}

🔥 SHOW TRENDS: Where is this moving? What's the trajectory?
🧠 GIVE EXAMPLES: Current proof points of the shift
⚡ PREDICT: Where will this be in 2-5 years?`;

  const userPrompt = `Create forward-thinking content about ${topic}. Explore trends, predictions, or paradigm shifts in whatever format is most compelling.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.85,
      max_tokens: format === 'thread' ? 600 : 150, // ✅ Reduced to stay under 280 chars
      response_format: { type: 'json_object' }
    }, { purpose: 'thought_leader_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'THOUGHT_LEADER'),
      format,
      confidence: 0.8,
      visualFormat: parsed.visualFormat || 'paragraph'
    };
    
  } catch (error: any) {
    console.error('[THOUGHT_LEADER_GEN] Error:', error.message);
    throw new Error(`Thought leader generator failed: ${error.message}. System will retry with different approach.`);
  }
}
