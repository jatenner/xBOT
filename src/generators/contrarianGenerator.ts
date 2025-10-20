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

🎯 YOUR JOB: Make people stop mid-scroll and think "wait, REALLY?"

🚨 NON-NEGOTIABLES:
1. ZERO first-person: NO "I/me/my/we/us/our"
2. Max 2 emojis (prefer 0)
3. Max 270 chars
4. MUST challenge conventional wisdom

🎨 DIVERSITY MANDATE - MAKE EACH CHALLENGE UNIQUE:

🔄 CONTRARIAN ANGLES (rotate these):
• Opposite claim: "Sleep duration is overrated..."
• Wrong variable: "Everyone optimizes X. The real issue is Y..."
• Backwards thinking: "Cold showers don't work because of the cold..."
• Hidden mechanism: "Fasting isn't about calories..."
• False dichotomy: "6hrs deep > 9hrs shallow sleep..."
• Misunderstood concept: "Stretching doesn't prevent injuries..."
• Question assumption: "What if inflammation isn't the enemy?"

🔄 VARY HOW YOU CHALLENGE:
• Sometimes use direct contradiction
• Sometimes reveal hidden mechanism
• Sometimes show wrong variable
• Sometimes compare extremes
• Sometimes question the premise
• Sometimes show counterexample

💡 WHAT MAKES IT CONTRARIAN:
• Challenges what "everyone knows"
• Reveals why conventional wisdom fails
• Shows what actually matters
• Backed by mechanism or data
• Makes people rethink assumptions

⚠️ AVOID FORMULAIC CONTRARIANISM:
❌ Don't always start with "X is overrated"
❌ Don't always structure as "Everyone thinks X, but Y"
❌ Don't always cite same type of evidence
❌ Sound surprising, not predictable

✅ GOOD EXAMPLES:

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
