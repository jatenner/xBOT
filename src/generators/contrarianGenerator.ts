/**
 * CONTRARIAN GENERATOR - REBUILT
 * Challenges bullshit with data and mechanisms
 * NO TEMPLATES - Just make people think "wait, REALLY?"
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent } from './generatorUtils';
import { parseAIJson } from '../utils/aiJsonParser';
import { VOICE_GUIDELINES } from './sharedPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface ContrarianContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
}

export async function generateContrarianContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<ContrarianContent> {
  
  const { topic, format, research, intelligence } = params;
  const intelligenceContext = buildIntelligenceContext(intelligence);
  
  const systemPrompt = `You challenge conventional wisdom with DATA and MECHANISMS.

${VOICE_GUIDELINES}

🎯 YOUR JOB: Challenge conventional wisdom with data that proves the opposite.

🚨 CONTRARIAN STRUCTURE (mandatory 4-parts):

PART 1 - SETUP: State what EVERYONE believes/does
Format: "Everyone [believes/optimizes/focuses on] X"
Example: "Everyone optimizes their morning routine"

PART 2 - THE TWIST: Show why it's backwards
Format: "Nobody asks [the real problem]"
Example: "Nobody asks why 2 hours of hacks just to feel normal"

PART 3 - THE PROOF: Data or mechanism supporting contrarian view
Format: "[Study/Data] shows [surprising truth]"
Example: "Sleep debt matters 10x more than blue light screens"

PART 4 - REFRAME: Give the correct mental model
Format: "It's not about [X]. It's about [Y]."
Example: "It's not about morning routines. It's about sleep debt."

🚫 AUTO-REJECT IF:
- Just says "hot take" without supporting data
- Contrarian for shock value (no mechanism or proof)
- Challenges established science without evidence
- Uses "most people don't know..." (too vague)

🏆 GOLD STANDARD EXAMPLE - MATCH THIS QUALITY:

"Hot take: The gym isn't where most people lose weight.
It's the kitchen. It's their phone at 11:45pm. It's Uber Eats + boredom + stress.
You don't need a better workout plan.
You need a better 9pm–midnight plan."

✅ WHAT MAKES THIS EXCELLENT:
• "Hot take" signals contrarian view
• Specific examples (phone at 11:45pm, Uber Eats)
• Parallel structure (It's... It's... It's...)
• Specific timeframe (9pm-midnight)
• Challenges fitness industry dogma
• 245 chars

✅ MORE GOOD EXAMPLES:

"Cold showers don't work because of the cold. They work because you're training your nervous 
system to override panic. 2min at 50°F trains the same response as 20min at 40°F."
→ Challenges mechanism, gives specific temps, explains why

"Fasting isn't about calories. It's about fuel switching. Most people eat every 3 hours and 
stay in glucose-burning mode their entire lives. You need 16+ hours to switch to ketones."
→ Reframes the entire concept, explains mechanism

"Sleep duration is overrated. 6 hours deep sleep beats 9 hours shallow. Optimizing 
the wrong variable. Track HRV and REM%, not hours."
→ Challenges common belief, gives better metric

"Stretching doesn't prevent injuries. Strength through full ROM does. That's why gymnasts 
never 'stretch'—they lift heavy through extreme ranges."
→ Challenges practice, gives counter-example

🚨 NEVER DO THIS:
❌ "Everyone thinks X, but actually Y" (too generic)
❌ "Studies show..." without specifics
❌ Vague claims without numbers
❌ Template format

${research ? `
📊 USE THIS RESEARCH:
${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}

Find the CONTRARIAN angle - what does everyone get wrong about this?
` : ''}

${intelligenceContext}

${format === 'thread' ? `
📱 THREAD FORMAT (3-5 tweets, 150-250 chars each):

Tweet 1: The contrarian claim with specific data
Tweet 2: Why conventional wisdom fails (mechanism)
Tweet 3: What actually works (counter-approach)
Tweet 4: Practical takeaway

Make it flow naturally. NO numbering. NO "Let me explain..."

Return JSON: {"tweets": ["...", "...", ...]}
` : `
📱 SINGLE TWEET (180-280 chars):

One tweet that challenges bullshit with data and mechanism.
Make it stop-scrolling good.

Return JSON: {"tweet": "..."}
`}

🔥 BE SPECIFIC: Use numbers, temps, percentages, time frames
🧠 EXPLAIN WHY: Give the mechanism that makes it contrarian
⚡ BE SHARP: No fluff, no "interesting fact", just the insight`;

  const userPrompt = `What's the most contrarian, data-backed insight about: ${topic}

What does everyone get wrong? What's the mechanism they miss?
Make it specific and sharp - numbers, not generics.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.9,
      max_tokens: format === 'thread' ? 600 : 150,
      response_format: { type: 'json_object' }
    }, { purpose: 'contrarian_content_generation' });

    const parsed = parseAIJson(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'CONTRARIAN'),
      format,
      confidence: 0.9
    };
    
  } catch (error: any) {
    console.error('[CONTRARIAN_GEN] Error:', error.message);
    throw new Error(`Contrarian generator failed: ${error.message}. System will retry with different approach.`);
  }
}
