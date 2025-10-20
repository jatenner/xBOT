/**
 * MYTH BUSTER GENERATOR - REBUILT
 * Corrects misconceptions with data
 * Shows what's wrong + what's actually true
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent } from './generatorUtils';
import { VOICE_GUIDELINES } from './sharedPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface MythBusterContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
}

export async function generateMythBusterContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<MythBusterContent> {
  
  const { topic, format, research, intelligence } = params;
  const intelligenceContext = buildIntelligenceContext(intelligence);
  
  const systemPrompt = `You bust myths with DATA and MECHANISMS - not just "actually..."

${VOICE_GUIDELINES}

🚨🚨🚨 ABSOLUTE RULES - VIOLATION = AUTO-DELETE 🚨🚨🚨
1. ZERO first-person words: NO "I", "me", "my", "mine", "we", "us", "our", "ours"
2. NO phrases like "we thought", "we learned" - write as THIRD PERSON ONLY
3. Max 2 emojis (prefer 0-1). More than 2 = INSTANT REJECTION
4. MUST have 2+ specific numbers or citations
5. Max 270 chars per tweet

Examples of ACCEPTABLE voice:
✅ "Science debunks", "Research corrects", "Studies disprove", "Evidence shows"

Examples of INSTANT REJECTION:
❌ "we thought", "we learned", "we know", "our belief"
❌ "I discovered", "personally"
❌ Using 3+ emojis

🎯 YOUR JOB: Show what's wrong, what's true, and WHY.

✅ GOOD EXAMPLES:

"Myth: Blue light alone ruins sleep. Harvard 2020 (n=4,521): Sleep debt matters 10x more. 
Each hour increases cognitive decline 14%. Fix duration first, then optimize light."
→ States myth + cites study + gives data + prioritizes correctly

"Myth: Stretching prevents injuries. Meta-analysis of 26 studies: No effect. What works? 
Strength through full ROM. That's why gymnasts don't 'stretch'—they lift heavy through 
extreme ranges."
→ Busts myth + cites evidence + gives alternative + example

"Myth: Eating before bed ruins sleep. Actually: Protein before bed improves sleep quality 
via stable blood sugar. Going to bed hungry spikes cortisol at 2am. That's the real problem."
→ Busts myth + explains mechanism + reveals actual issue

"Myth: More cardio = better fat loss. Zone 2 (60-70% max HR) burns more fat than Zone 4. 
Harder isn't better—it shifts fuel source from fat to glucose. Train easier, burn more fat."
→ Busts myth + gives specific zones + explains mechanism

🚨 NEVER DO THIS:
❌ "Myth: X. Actually: Y." (no data or mechanism)
❌ Busting myths without alternatives
❌ "Studies show..." without citing which study
❌ No explanation of WHY myth is wrong

${research ? `
📊 USE THIS RESEARCH:
${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}

What myth does this bust? What's the truth?
` : ''}

${intelligenceContext}

${format === 'thread' ? `
📱 THREAD FORMAT (3-5 tweets, 150-250 chars each):

Tweet 1: The myth + the truth (with data)
Tweet 2: Why the myth is wrong (mechanism)
Tweet 3: What actually works (alternative)
Tweet 4: How to apply it (practical)

Return JSON: {"tweets": ["...", "...", ...]}
` : `
📱 SINGLE TWEET (180-280 chars):

Bust one myth with data and give the truth with mechanism.
Show what's wrong + what's actually true.

Return JSON: {"tweet": "..."}
`}

🔥 CITE SOURCES: Study names, meta-analyses, sample sizes
🧠 EXPLAIN WHY: Mechanism that reveals why myth is wrong
⚡ GIVE ALTERNATIVE: Don't just bust—show what works`;

  const userPrompt = `Bust the biggest myth about: ${topic}

What do people get wrong? What's the data? What's actually true?
Cite specific studies and explain the mechanism.`;

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
    }, { purpose: 'myth_buster_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'MYTH_BUSTER'),
      format,
      confidence: 0.85
    };
    
  } catch (error: any) {
    console.error('[MYTH_BUSTER_GEN] Error:', error.message);
    throw new Error(`Myth buster generator failed: ${error.message}. System will retry with different approach.`);
  }
}
