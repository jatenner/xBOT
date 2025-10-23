/**
 * COACH GENERATOR - REBUILT
 * Gives SPECIFIC, actionable protocols
 * NO GENERIC ADVICE - Exact numbers, temps, timing
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent } from './generatorUtils';
import { parseAIJson } from '../utils/aiJsonParser';
import { VOICE_GUIDELINES } from './sharedPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface CoachContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
}

export async function generateCoachContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<CoachContent> {
  
  const { topic, format, research, intelligence } = params;
  const intelligenceContext = buildIntelligenceContext(intelligence);
  
  const systemPrompt = `You give SPECIFIC, actionable protocols - not generic advice.

${VOICE_GUIDELINES}

🎯 YOUR JOB: Give EXACT protocols people can implement tomorrow morning.

🚨 MANDATORY PROTOCOL ELEMENTS (all 3 required):
1. EXACT MEASUREMENT with units
   ✅ "30g protein" NOT ❌ "high protein"
   ✅ "65-68°F" NOT ❌ "cool room"
   ✅ "11 minutes weekly at 11°C" NOT ❌ "regular cold exposure"

2. EXACT TIMING with clock time or duration
   ✅ "within 30 minutes of waking" NOT ❌ "in the morning"
   ✅ "2 hours before bed (10pm if sleep at 12am)" NOT ❌ "before sleep"
   ✅ "16:8 window (12pm-8pm)" NOT ❌ "intermittent fasting"

3. TESTABLE THRESHOLD (how to know it's working)
   ✅ "Can barely hold conversation" NOT ❌ "moderate intensity"
   ✅ "Heart rate 60-70% max (180-age × 0.6-0.7)" NOT ❌ "comfortable pace"
   ✅ "Slight shiver at 11-13°C" NOT ❌ "cold enough"

🚫 AUTO-REJECT IF:
- Contains "try to" or "aim for" (give exact specs, not goals)
- No specific numbers (dosage, temp, time)
- No timing window specified
- Can't test if you're doing it right

🚨 MANDATORY QUALITY ELEMENTS (AUTO-FAIL IF MISSING):

1. NAMED MECHANISM TERM (Required):
   Must explain the biological mechanism:
   ✅ "GLP-1 spikes, suppresses ghrelin for 4-6 hours"
   ✅ "Core temp drops 2-3°, triggers melatonin"
   ✅ "Mitochondrial adaptation zone"
   ❌ WRONG: "Makes you feel better" (no mechanism)

2. PROTOCOL SPECIFICITY (Required - you're already good at this):
   ✅ "30g protein within 30 minutes of waking"
   ✅ "65-68°F room temperature"
   ✅ "Zone 2: 60-70% max HR"
   
3. FAILURE MODE/CONDITIONAL (Required - emphasize this more):
   EVERY protocol needs a limitation or exception:
   ✅ "Skip if cortisol already elevated (waking before 5am)"
   ✅ "Not for pregnant women or those with low blood pressure"
   ✅ "Doesn't work if carbs eaten first (insulin spike blocks)"
   ✅ "Only effective with 7+ hours sleep baseline"
   ❌ WRONG: Only mentioning what works, never what doesn't

📋 PROTOCOL STRUCTURE (use this format):

SENTENCE 1: The exact protocol with all numbers
Example: "30g protein within 30 minutes of waking—eggs, Greek yogurt, or protein shake."

SENTENCE 2: Why it works (mechanism in < 15 words)
Example: "Spikes GLP-1, suppresses ghrelin for 4-6 hours."

SENTENCE 3: Common mistake people make
Example: "Most people eat carbs first—insulin spike without satiety."

SENTENCE 4: How to know it's working
Example: "No 10am cravings. Steady energy until lunch."

⚡ COMPARISON PROTOCOL (alternative format):

Show what DOESN'T work vs what DOES:
"Room temperature 72-75°F → poor sleep (core temp can't drop).
Room temperature 65-68°F → quality sleep (2-3° core temp drop triggers melatonin).
Add: Magnesium glycinate 400mg 2hrs before bed."

🎯 TESTABLE THRESHOLDS (must include one):
- Physical sensation: "slight shiver", "can barely talk", "mild hunger"
- Measurable: "HR 60-70% max", "11-13°C water", "sleep latency < 15min"
- Time-based: "energy steady 4-6hrs", "no cravings until lunch"
- Observable: "HRV increases 10+ points", "REM% above 20"

🚫 FORBIDDEN PHRASES:
❌ "Try to" → ✅ Give exact spec
❌ "Aim for" → ✅ State minimum threshold
❌ "Regular" → ✅ Specify frequency (3x/week, daily, etc.)
❌ "Moderate" → ✅ Define with test (can barely talk)
❌ "Plenty of" → ✅ Give exact amount (30g, 2L, etc.)

🏆 GOLD STANDARD EXAMPLE - MATCH THIS QUALITY:

"A morning routine that actually works (10 minutes):
✅ Step outside → 2 min of sunlight
✅ Breathe through your nose → 30 deep breaths
✅ Drink water before caffeine
✅ 10 squats or push-ups
No biohacks. Just biology."

✅ WHAT MAKES THIS EXCELLENT:
• Specific timeframe (10 minutes total)
• Actionable steps with checkmarks
• Exact numbers (2 min, 30 breaths, 10 squats)
• Simple, clear structure
• Memorable closing (No biohacks. Just biology.)
• Anyone can do it tomorrow morning

✅ MORE EXCELLENT EXAMPLES:

"30g protein within 30min of waking spikes GLP-1, suppressing ghrelin for 4-6 hours. 
That's why carb cravings at 10am disappear. Best sources: eggs, Greek yogurt, protein shake."

"Room temperature 65-68°F, magnesium glycinate 400mg 2hrs before bed, blackout curtains. 
Core body temp needs to drop 2-3° to trigger sleep hormones. Most rooms are too warm (72-75°F)."

"Zone 2 cardio test: Can barely hold a conversation. If you can talk easily, go harder. 
If you can't talk at all, slow down. That's the mitochondrial adaptation zone."

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

${intelligenceContext}

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
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: format === 'thread' ? 600 : 200,
      response_format: { type: 'json_object' }
    }, { purpose: 'coach_content_generation' });

    const parsed = parseAIJson(response.choices[0].message.content || '{}');
    
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
