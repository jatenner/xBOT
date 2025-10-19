/**
 * PROVOCATEUR GENERATOR - REBUILT
 * Asks provocative questions that reveal deeper truths
 * NOT hollow questions - questions that challenge assumptions
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent } from './generatorUtils';
import { VOICE_GUIDELINES } from './sharedPatterns';
import { getContentGenerationModel } from '../config/modelConfig';

export interface ProvocateurContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
}

export async function generateProvocateurContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
}): Promise<ProvocateurContent> {
  
  const { topic, format, research } = params;
  
  const systemPrompt = `You ask PROVOCATIVE QUESTIONS that reveal deeper truths.

${VOICE_GUIDELINES}

🎯 YOUR JOB: Make people question their assumptions (then answer the question).

✅ GOOD EXAMPLES:

"Why do we 'fix' sleep with pills instead of darkness? Humans spent 200,000 years in natural 
light cycles. 100 years with lightbulbs. We're treating the symptom (can't sleep) not the 
cause (circadian disruption)."
→ Provocative question + historical context + reveals real problem

"What if 'laziness' is your body protecting you? When you 'don't feel like' exercising after 
poor sleep, that's HRV dropping, cortisol spiking. Not motivation failure—physiological 
preservation."
→ Reframes concept + gives mechanism + challenges judgment

"Why do we measure health by what's wrong instead of what's optimal? Blood work says 'normal' 
= not diseased. Doesn't mean optimized. We set bar at 'not dying' instead of 'thriving'."
→ Questions framework + shows gap + suggests better approach

"What if inflammation isn't the enemy? It's communication. Your immune system isn't 'overreacting'
—it's responding to chronic stimulus (processed food, poor sleep, stress). Fix signal, not 
response."
→ Reframes problem + explains mechanism + suggests solution

🚨 NEVER DO THIS:
❌ Hollow "What if..." without answering
❌ Questions without substance or data
❌ "Have you ever thought..." (too generic)
❌ Asking without revealing deeper truth

${research ? `
📊 USE THIS RESEARCH:
${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}

What provocative question does this research answer?
` : ''}

${format === 'thread' ? `
📱 THREAD FORMAT (3-5 tweets, 150-250 chars each):

Tweet 1: The provocative question
Tweet 2: Why we have it backwards
Tweet 3: The deeper truth (mechanism)
Tweet 4: What to do instead (solution)

MUST answer the question - no hollow questions.

Return JSON: {"tweets": ["...", "...", ...]}
` : `
📱 SINGLE TWEET (180-280 chars):

One provocative question that ANSWERS ITSELF with mechanism.
Challenge assumption + reveal truth.

Return JSON: {"tweet": "..."}
`}

🔥 BE PROVOCATIVE: Challenge how people think
🧠 REVEAL TRUTH: Answer the question with mechanism
⚡ SUGGEST SOLUTION: Show what to do instead`;

  const userPrompt = `Ask a provocative question about: ${topic}

What assumption needs challenging? What question reveals a deeper truth?
MUST answer the question - explain the mechanism.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized (gpt-4o-mini by default)
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.9,
      max_tokens: format === 'thread' ? 600 : 150,
      response_format: { type: 'json_object' }
    }, { purpose: 'provocateur_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'PROVOCATEUR'),
      format,
      confidence: 0.85
    };
    
  } catch (error: any) {
    console.error('[PROVOCATEUR_GEN] Error:', error.message);
    throw new Error(`Provocateur generator failed: ${error.message}. System will retry with different approach.`);
  }
}
