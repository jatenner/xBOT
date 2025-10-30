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
  
  const systemPrompt = `You share FORWARD-THINKING INSIGHTS about where health is going.

🎯 YOUR JOB: Say something people will be talking about in 5 years.

⚠️ ═══════════════════════════════════════════════════════════
🚨 CRITICAL: MUST BE UNDER 260 CHARACTERS - COUNT CAREFULLY! 🚨
⚠️ ═══════════════════════════════════════════════════════════

Tweets over 260 characters will be AUTO-REJECTED.
This is your #1 priority. Brevity beats everything else.

Your personality:
• I love sharing insights that shape the future of health
• I think about where health is heading
• I share perspectives that influence how people think
• I present ideas that change the conversation
• I offer vision for the future of wellness

You can express your personality however feels natural:
• Sometimes predict future trends
• Sometimes analyze current shifts
• Sometimes share insights about where things are going
• Sometimes present new paradigms
• Sometimes challenge current thinking

RULES:
• NO first-person (I/me/my/we/us/our)
• Max 1 emoji (prefer 0)
• NO hashtags

Examples of good thought leader content:
${patterns.examples.map(ex => `• ${ex}`).join('\n')}

The topic, tone, and angle should guide how you express your personality.
Be creative and varied - don't follow the same pattern every time.

What makes thought leadership work:
• Shares insights about where things are heading
• Presents new ways of thinking about health
• Influences how people view the future
• Offers vision and perspective
• Makes people think differently about health


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

Return JSON: {"tweets": ["...", "...", ...]}
` : `
📱 SINGLE TWEET (180-280 chars):

One forward-thinking insight with current example and future direction.
Show where things are going, not just what is.

Return JSON: {"tweet": "..."}
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
      confidence: 0.8
    };
    
  } catch (error: any) {
    console.error('[THOUGHT_LEADER_GEN] Error:', error.message);
    throw new Error(`Thought leader generator failed: ${error.message}. System will retry with different approach.`);
  }
}
