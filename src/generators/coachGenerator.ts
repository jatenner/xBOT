/**
 * COACH GENERATOR - REBUILT
 * Gives SPECIFIC, actionable protocols
 * NO GENERIC ADVICE - Exact numbers, temps, timing
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent } from './generatorUtils';

export interface CoachContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
}

export async function generateCoachContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
}): Promise<CoachContent> {
  
  const { topic, format, research } = params;
  
  const systemPrompt = `You give SPECIFIC, actionable protocols - not generic advice.

🎯 YOUR JOB: Give people something they can DO tomorrow with EXACT specs.

✅ GOOD EXAMPLES:

"Protocol: 30g protein within 30min of waking. Spikes GLP-1 which suppresses ghrelin for 
4-6 hours. That's why you won't crave carbs at 10am. Eggs, Greek yogurt, or protein shake."
→ Exact amount, timing, mechanism, examples

"Sleep protocol: Room 65-68°F, magnesium glycinate 400mg 2hrs before bed, blackout curtains. 
Your core temp needs to drop 2-3° to trigger sleep hormones. Most rooms are 72-75°."
→ Exact temps, dosage, timing, explains why

"Zone 2 cardio test: Can barely hold a conversation. If you can talk easily, go harder. 
If you can't talk at all, slow down. That's the mitochondrial adaptation zone."
→ Practical test, clear boundaries, explains benefit

"Fasting protocol: 16:8 window, eat 12pm-8pm. First meal protein-heavy (40g+). Breaks fast 
without spiking insulin. Black coffee okay—doesn't break autophagy until 50+ calories."
→ Exact window, first meal specs, what breaks it

🚨 NEVER DO THIS:
❌ "Try to sleep better" (too vague)
❌ "Eat more protein" (no specifics)
❌ "Exercise regularly" (what does that mean?)
❌ Generic advice without numbers

${research ? `
📊 USE THIS RESEARCH:
${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}

Turn this into a SPECIFIC protocol - exact numbers and timing.
` : ''}

${format === 'thread' ? `
📱 THREAD FORMAT (3-5 tweets, 150-250 chars each):

Tweet 1: The protocol with exact specs
Tweet 2: Why it works (mechanism)
Tweet 3: Common mistakes to avoid
Tweet 4: How to know it's working

NO templates. Just specific, actionable info.

Return JSON: {"tweets": ["...", "...", ...]}
` : `
📱 SINGLE TWEET (180-280 chars):

One protocol with EXACT specs people can follow tomorrow.
Include numbers, timing, or measurable tests.

Return JSON: {"tweet": "..."}
`}

🔥 BE EXACT: 30g protein, 65-68°F, 16:8 window, 400mg dose
🧠 EXPLAIN WHY: Mechanism that makes it work
⚡ BE PRACTICAL: People can do this tomorrow`;

  const userPrompt = `Give the most specific, actionable protocol for: ${topic}

What are the EXACT specs? Numbers, timing, doses, temps?
What's the mechanism that makes it work?`;

  try {
    const response = await createBudgetedChatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: format === 'thread' ? 600 : 150,
      response_format: { type: 'json_object' }
    }, { purpose: 'coach_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'COACH'),
      format,
      confidence: 0.85
    };
    
  } catch (error: any) {
    console.error('[COACH_GEN] Error:', error.message);
    throw new Error(`Coach generator failed: ${error.message}. System will retry with different approach.`);
  }
}
