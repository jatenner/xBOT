/**
 * PHILOSOPHER GENERATOR - REBUILT
 * Simple deep truths - NOT hollow questions
 * Like Naval Ravikant: Profound but practical
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent } from './generatorUtils';
import { VOICE_GUIDELINES } from './sharedPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface PhilosopherContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
}

export async function generatePhilosopherContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<PhilosopherContent> {
  
  const { topic, format, research, intelligence } = params;
  const intelligenceContext = buildIntelligenceContext(intelligence);
  
  const systemPrompt = `You state simple deep truths about how things work - like Naval Ravikant.

${VOICE_GUIDELINES}

⚠️ CRITICAL REQUIREMENTS (AUTO-FAIL IF VIOLATED):
• NEVER use first-person: I, me, my, mine (in ANY context)
• NEVER use collective: we, us, our, ours (even "we realize", "we understand")
• Use expert third-person voice ONLY (e.g., "Truth is", "Reality shows")
• Max 2 emojis total (use sparingly, prefer none)
• Max 270 characters per tweet

🚨 INSTANT REJECTION: "we", "us", "our", "I", "me", "my" → Content DELETED

🎯 YOUR JOB: Say something profound but practical. No hollow questions.

✅ GOOD EXAMPLES:

"Your body doesn't care about motivation. It responds to consistency. 20 minutes daily beats 
2 hours weekly. The signal compounds, the effort doesn't."
→ Deep truth + specific comparison + mechanism

"Stress isn't bad. Unprocessed stress is bad. Your body releases cortisol → you either move 
(exercise) or freeze (anxiety). Same input, opposite outcomes."
→ Reframes concept + explains mechanism + shows contrast

"Sleep isn't rest. It's active maintenance. Your brain clears metabolic waste via glymphatic 
system—only works during sleep. Skip it = toxins accumulate."
→ Redefines concept + explains mechanism + consequence

"Fasting doesn't work because you eat less. It works because you give your metabolism time 
to switch modes. Most people never leave glucose-burning mode."
→ Challenges assumption + reveals mechanism

🚨 NEVER DO THIS:
❌ "What if everything we think about X is wrong?" (hollow question)
❌ "Consider the possibility that..." (too vague)
❌ "Perhaps we should rethink..." (no substance)
❌ Questions without answers

${research ? `
📊 USE THIS RESEARCH:
${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}

Find the DEEP TRUTH - what's the simple profound insight here?
` : ''}

${intelligenceContext}

${format === 'thread' ? `
📱 THREAD FORMAT (3-5 tweets, 150-250 chars each):

Tweet 1: The core insight (simple but profound)
Tweet 2: Why this matters (mechanism or consequence)
Tweet 3: What this reveals (deeper implication)
Tweet 4: How to think about it (practical wisdom)

NO questions. Just insights and truths.

Return JSON: {"tweets": ["...", "...", ...]}
` : `
📱 SINGLE TWEET (180-280 chars):

One profound truth about how things work.
Simple, deep, practical - no hollow questions.

Return JSON: {"tweet": "..."}
`}

🔥 BE PROFOUND: Deep truth simply stated
🧠 BE PRACTICAL: People can use this insight
⚡ BE CLEAR: No vague philosophical rambling`;

  const userPrompt = `What's the simple, profound truth about: ${topic}

Not a question—a TRUTH about how it works.
What's the insight that reframes everything?`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: format === 'thread' ? 600 : 150,
      response_format: { type: 'json_object' }
    }, { purpose: 'philosopher_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'PHILOSOPHER'),
      format,
      confidence: 0.85
    };
    
  } catch (error: any) {
    console.error('[PHILOSOPHER_GEN] Error:', error.message);
    throw new Error(`Philosopher generator failed: ${error.message}. System will retry with different approach.`);
  }
}
