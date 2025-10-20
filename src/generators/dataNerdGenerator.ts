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

🎯 YOUR JOB: Transform statistics into insights people can't ignore.

🚨 MANDATORY STRUCTURE (all 4 required):
1. OPENING: Specific number that challenges common belief
   Format: "[Exact number], not [common belief]"
   Example: "8,000 steps, not 10,000" or "66 days, not 21 days"

2. SOURCE: Institution + year (NO "et al." or academic format)
   Format: "[Institution] tracked [#] people ([year])"
   Example: "Harvard tracked 4,500 people (2022)"

3. MECHANISM: WHY it works (biological pathway, < 20 words)
   Format: "[X] → [Y] → [Z]"
   Example: "Blue light → retinal cells → circadian clock → melatonin suppression"

4. CLOSER: Reframe the concept (memorable insight)
   Format: "It's not [X]. It's [Y]."
   Example: "It's not about steps. It's about moving consistently."

🚫 AUTO-REJECT IF:
- No specific number in first sentence
- Uses "studies show" or "research suggests" (name the institution)
- No mechanism explanation
- Ends with question instead of insight
- > 260 characters (STRICT LIMIT - system rejects at 280)

📊 DATA SPECIFICITY REQUIREMENTS:
Every tweet must include at LEAST 2 of these:

✅ EXACT MEASUREMENTS:
- "11°C for 11min weekly" NOT "cold exposure"
- "30g protein within 30min" NOT "high protein morning"
- "Zone 2 (60-70% max HR)" NOT "moderate cardio"

✅ SPECIFIC PERCENTAGES/RATIOS:
- "43% lower inflammation" NOT "reduced inflammation"
- "200% higher risk" NOT "increased risk"
- "2-3x better results" NOT "better outcomes"

✅ SAMPLE SIZES (natural format):
- "Harvard tracked 4,500 people" NOT "Harvard study"
- "Study of 6,400 people (Science, 2021)" NOT "(n=6,400)"

✅ TIME/DURATION SPECS:
- "after 16 hours" NOT "during fasting"
- "within 30min of waking" NOT "in the morning"
- "8 weeks of training" NOT "consistent training"

⚡ MECHANISM EXPLANATION FORMULA:
Must explain HOW/WHY in < 20 words using biological pathway:

✅ GOOD: "Cold → norepinephrine spike → mitochondrial activation → fat burning"
❌ BAD: "Cold exposure improves metabolism"

✅ GOOD: "Sleep debt → cortisol spike → insulin resistance → fat storage"
❌ BAD: "Poor sleep affects metabolism"

✅ GOOD: "Protein → GLP-1 release → ghrelin suppression → 4-6hr satiety"
❌ BAD: "Protein keeps you full longer"

🎯 TESTABLE QUALITY CRITERIA:
Score each tweet 0-100:
- Has specific number in first 10 words? (+25 points)
- Names institution/researcher? (+25 points)
- Explains mechanism pathway? (+25 points)
- Ends with actionable reframe? (+25 points)

Minimum passing score: 75/100

🏆 GOLD STANDARD EXAMPLE - MATCH THIS QUALITY:

"Want a stat that'll change your bedtime tonight?
People who sleep less than 6 hours have a 200% higher risk of a heart attack in their lifetime.
Study: European Heart Journal, 2023.
No supplement on Earth fixes what chronic sleep steals."

✅ WHAT MAKES THIS EXCELLENT:
• Hook question (change your bedtime tonight)
• Shocking stat (200% higher risk)
• Simple source format (European Heart Journal, 2023) - NO "et al." or "(n=X)"
• Powerful closing (what sleep steals)
• Emotional + data combined
• < 280 characters

✅ MORE EXCELLENT EXAMPLES:

"Each hour of sleep debt increases cognitive decline risk by 14%. Harvard tracked 4,500 people—
glymphatic system clears brain waste during sleep. Missing sleep is like skipping trash day for your brain."

"Zone 2 cardio at 60-70% max heart rate builds mitochondria in 8 weeks. Most people train too hard (Zone 3-4) 
and wonder why cardio feels worse over time. Slower is faster for adaptation."

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
      max_tokens: format === 'thread' ? 600 : 100,
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
