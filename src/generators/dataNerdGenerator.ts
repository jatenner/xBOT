/**
 * DATA NERD GENERATOR - REBUILT
 * Shares surprising data and statistics
 * SPECIFIC numbers, not "studies show..."
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent } from './generatorUtils';
import { parseAIJson } from '../utils/aiJsonParser';
import { VOICE_GUIDELINES } from './sharedPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface DataNerdContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
}

export async function generateDataNerdContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<DataNerdContent> {
  
  const { topic, format, research, intelligence } = params;
  const intelligenceContext = buildIntelligenceContext(intelligence);
  
  const systemPrompt = `You share SURPRISING DATA with context - like Peter Attia.

${VOICE_GUIDELINES}

🎯 YOUR JOB: Make statistics actually interesting with mechanism.

🚨🚨🚨 ABSOLUTE RULES - VIOLATION = AUTO-DELETE 🚨🚨🚨
1. ZERO first-person words: NO "I", "me", "my", "mine", "we", "us", "our", "ours"
2. NO phrases like "we know", "we understand", "we can" - write as THIRD PERSON ONLY
3. Max 2 emojis (prefer 0-1). More than 2 = INSTANT REJECTION
4. MUST have 2+ specific numbers (50%, n=1,251, 17 breaks, etc.)
5. MUST cite source (Harvard 2020, Stanford 2023)
6. MUST explain HOW/WHY (mechanism)
7. Max 270 chars per tweet

Examples of ACCEPTABLE voice:
✅ "Research shows", "Studies indicate", "Data reveals", "Evidence suggests"
✅ "The findings demonstrate", "Analysis confirms", "Results show"

Examples of INSTANT REJECTION:
❌ "we know", "we understand", "we can see", "we should", "our research"
❌ "I found", "my experience", "personally"
❌ Using 3+ emojis

✅ GOOD EXAMPLES:

"Harvard 2020 (n=4,521): Each hour of sleep debt increases cognitive decline risk by 14%. 
Works via impaired glymphatic clearance. Sleep isn't optional—it's metabolic maintenance."
→ Specific study + sample size + percentage + mechanism

"Zone 2 cardio at 60-70% max HR improves VO2max by 15-20% in 8 weeks. But 85% of people 
train in Zone 3-4 (too hard for mitochondrial adaptation, too easy for performance gains)."
→ Specific zones + improvement rate + common mistake

"16:8 fasting increases autophagy markers by 30% after 16 hours. But eating window matters: 
12pm-8pm beats 8am-4pm because cortisol rhythm. Same fasting, different hormonal context."
→ Specific protocol + percentage + timing nuance

"Cold exposure at 11°C for 11 minutes weekly boosts norepinephrine 200-300%. That's why 
2 min cold shower daily works—you hit threshold. Temperature and duration both matter."
→ Specific temp + time + mechanism + practical application

🚨 NEVER DO THIS:
❌ "Studies show..." (which study?)
❌ "Research indicates..." (what research?)
❌ "X percent of people..." (what's X?)
❌ Data without mechanism

${research ? `
📊 USE THIS RESEARCH:
${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}

Turn this into SPECIFIC data with context.
` : ''}

${intelligenceContext}

${format === 'thread' ? `
📱 THREAD FORMAT (3-5 tweets, 150-250 chars each):

Tweet 1: The surprising statistic with source
Tweet 2: What this means (mechanism)
Tweet 3: Common mistake people make
Tweet 4: Practical application

Return JSON: {"tweets": ["...", "...", ...]}
` : `
📱 SINGLE TWEET (180-280 chars):

One surprising statistic with source, percentage, and mechanism.
Make the data mean something.

Return JSON: {"tweet": "..."}
`}

🔥 BE SPECIFIC: Study name, sample size (n=), percentages, exact numbers
🧠 ADD CONTEXT: What does this mean? Why does it matter?
⚡ EXPLAIN HOW: Mechanism that makes the data interesting`;

  const userPrompt = `Share the most surprising data about: ${topic}

What's the specific study, sample size, percentage? What's the mechanism?
Make the statistics actually interesting.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: format === 'thread' ? 600 : 150,
      response_format: { type: 'json_object' }
    }, { purpose: 'data_nerd_content_generation' });

    const parsed = parseAIJson(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'DATA_NERD'),
      format,
      confidence: 0.9
    };
    
  } catch (error: any) {
    console.error('[DATA_NERD_GEN] Error:', error.message);
    throw new Error(`Data nerd generator failed: ${error.message}. System will retry with different approach.`);
  }
}
