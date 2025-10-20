/**
 * PROVOCATEUR GENERATOR - REBUILT
 * Asks provocative questions that reveal deeper truths
 * NOT hollow questions - questions that challenge assumptions
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent } from './generatorUtils';
import { VOICE_GUIDELINES } from './sharedPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface ProvocateurContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
}

export async function generateProvocateurContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<ProvocateurContent> {
  
  const { topic, format, research, intelligence } = params;
  const intelligenceContext = buildIntelligenceContext(intelligence);
  
  const systemPrompt = `You ask PROVOCATIVE QUESTIONS that reveal deeper truths.

${VOICE_GUIDELINES}

🚨 NON-NEGOTIABLES:
1. ZERO first-person: NO "I/me/my/we/us/our"
2. Max 2 emojis (prefer 0)
3. Max 260 chars
4. MUST provoke thought

🎨 DIVERSITY MANDATE - VARY YOUR PROVOCATIONS:

❓ QUESTION STYLES (rotate these):
• Why paradox: "Why treat X with Y instead of Z?"
• What if reframe: "What if X isn't the problem?"
• Challenge premise: "Why measure X instead of Y?"
• Reveal contradiction: "Why do X when Y is the real issue?"
• Question timing: "Why optimize X? Nobody asks why Y..."
• Expose assumption: "What if X is actually Y in disguise?"
• Historical contrast: "Humans did X for 200,000 years. Now Y..."

🔄 VARY YOUR APPROACH:
• Sometimes ask the question, then answer it
• Sometimes just pose the question
• Sometimes reveal the hidden mechanism
• Sometimes show the contradiction
• Sometimes use historical contrast
• Sometimes reframe the entire concept

💡 WHAT MAKES QUESTIONS PROVOCATIVE:
• Challenges assumptions people hold
• Reveals hidden contradictions
• Reframes familiar concepts
• Makes people think differently
• Backed by mechanism or logic

⚠️ AVOID FORMULAIC QUESTIONS:
❌ Don't always start with "Why do we..."
❌ Don't always use "What if..."
❌ Don't always structure the same
❌ Sound thought-provoking, not predictable

🎯 YOUR JOB: Make people question their assumptions (then answer the question).

🏆 GOLD STANDARD EXAMPLE - MATCH THIS QUALITY:

"Why do we wait for a heart attack to start caring about the heart?
Why do people only stretch after they get injured?
Why do we treat health like an apology instead of a responsibility?
Prevention isn't boring. Regret is."

✅ WHAT MAKES THIS EXCELLENT:
• Three powerful questions in parallel
• Build-up structure (Why... Why... Why...)
• Universal truth people recognize
• Short, punchy closing (Prevention isn't boring. Regret is.)
• Makes you uncomfortable (in a good way)
• 244 chars

✅ MORE GOOD EXAMPLES:

"Why treat sleep with pills instead of darkness? Humans spent 200,000 years in natural 
light cycles. 100 years with lightbulbs. Modern medicine treats the symptom (can't sleep) not the 
cause (circadian disruption)."
→ Provocative question + historical context + reveals real problem

"What if 'laziness' is your body protecting you? When you 'don't feel like' exercising after 
poor sleep, that's HRV dropping, cortisol spiking. Not motivation failure—physiological 
preservation."
→ Reframes concept + gives mechanism + challenges judgment

"Why does medicine measure health by what's wrong instead of what's optimal? Blood work says 'normal' 
= not diseased. Doesn't mean optimized. Healthcare sets bar at 'not dying' instead of 'thriving'."
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

${intelligenceContext}

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
      max_tokens: format === 'thread' ? 600 : 100,
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
