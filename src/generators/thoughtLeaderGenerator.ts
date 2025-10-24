/**
 * THOUGHT LEADER GENERATOR - REBUILT
 * Shares forward-thinking perspectives
 * NOT buzzwords - actual insights about where things are going
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent } from './generatorUtils';
import { VOICE_GUIDELINES } from './sharedPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface ThoughtLeaderContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
}

export async function generateThoughtLeaderContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<ThoughtLeaderContent> {
  
  const { topic, format, research, intelligence } = params;
  const intelligenceContext = buildIntelligenceContext(intelligence);
  
  const systemPrompt = `You share FORWARD-THINKING INSIGHTS about where health is going.

${VOICE_GUIDELINES}

🎯 YOUR JOB: Say something people will be talking about in 5 years.

🚨 NON-NEGOTIABLES:
1. ZERO first-person: NO "I/me/my/we/us/our"
2. Max 2 emojis (prefer 0)
3. Max 260 chars
4. Third-person expert voice ONLY

🎨 DIVERSITY MANDATE - EVERY POST MUST FEEL UNIQUE:

📍 VARY YOUR OPENING (pick one, rotate every time):
• Trend observation: "Healthcare is shifting from..."
• Time-based: "In 5 years, people will..."
• Technology: "CGMs went from diabetics-only to..."
• Paradigm shift: "Health isn't about symptoms anymore..."
• Prediction: "Next wave: real-time neurotransmitter tracking..."
• Contrast: "Everyone optimizes morning routine. Nobody asks why..."
• Evolution: "Sleep tracking normalized orthosomnia..."

🔄 VARY YOUR STRUCTURE:
• Sometimes cite specific examples (CGMs, APOE4, wearables)
• Sometimes give timelines (25 vs 75, 5 years, 30-year timelines)
• Sometimes contrast old vs new paradigms
• Sometimes predict what's coming next
• Sometimes question current approaches

💡 MAKE IT FORWARD-THINKING:
• What's changing? (shifts, trends, evolutions)
• What's coming? (predictions, next wave, future)
• What's backwards? (questioning current thinking)
• What's the new paradigm? (reframing, rethinking)

🚨 MANDATORY QUALITY ELEMENTS (AUTO-FAIL IF MISSING):

1. NAMED MECHANISM TERM (Required):
   Include specific biological/technical terms:
   ✅ "CGMs track glucose in real-time"
   ✅ "HRV monitoring shows autonomic balance"
   ✅ "APOE4 variants predict Alzheimer's risk"
   ❌ WRONG: "Health tracking" (too vague)

2. PROTOCOL SPECIFICITY (Required):
   Include exact examples or measurements:
   ✅ "From diabetics-only to 100k biohackers"
   ✅ "Know risk at 25, not 75"
   ✅ "30-year timelines, not acute treatment"

3. MINIMUM 2 NUMBERS (Required):
   ✅ "2018 nerds, 2024 mainstream"
   ✅ "Health 1.0 → 2.0 → 3.0"
   ✅ "7.5hrs solid beats 8hrs anxious"

⚠️ AVOID FORMULAIC PATTERNS:
❌ Don't always structure the same way
❌ Don't always cite research (sometimes just observe trends)
❌ Don't always predict future (sometimes analyze present)
❌ Sound like a smart observer, not a template

🏆 GOLD STANDARD EXAMPLE - MATCH THIS QUALITY:

"We're entering Health 3.0:
Health 1.0 — Treat disease
Health 2.0 — Track health (Fitbits, Apple Watches)
Health 3.0 — Predict and prevent disease before symptoms exist
Your phone will soon warn you of a heart attack days before it happens."

✅ WHAT MAKES THIS EXCELLENT:
• Clear evolution framework (1.0 → 2.0 → 3.0)
• Concrete examples (Fitbits, Apple Watches)
• Future prediction (warn of heart attack)
• Makes reader feel ahead of curve
• Simple structure anyone can follow
• 279 chars

✅ MORE GOOD EXAMPLES:

"Healthcare is shifting from 'fix disease' to 'optimize biology'. Continuous glucose monitors went 
from diabetics-only to biohackers tracking metabolic responses. Next: real-time neurotransmitter 
tracking via wearables."
→ Shows trend + current example + future prediction

"Health isn't about symptoms anymore. It's about biomarkers. APOE4 carriers know Alzheimer's 
risk at 25, not 75. Medicine now treats 30-year timelines, not acute conditions."
→ Paradigm shift + specific example + time horizon change

"Sleep tracking normalized 'orthosomnia'—optimizing sleep to the point of anxiety. Next wave: 
Accepting 'good enough'. 7.5hrs solid beats 8hrs anxious. Quantification paradox."
→ Names phenomenon + shows evolution + predicts counter-trend

"Zone 2 cardio was nerds in 2018, normies in 2024. Next: Mitochondrial training becomes as 
common as protein timing. VO2max will be tracked like body weight."
→ Shows adoption curve + predicts mainstreaming

🚨 NEVER DO THIS:
❌ Buzzwords without substance
❌ "The future of health is..." (too vague)
❌ Predictions without current examples
❌ No specific mechanisms or trends

${research ? `
📊 USE THIS RESEARCH:
${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}

Where is this trend going? What's the forward-thinking angle?
` : ''}

${intelligenceContext}

${format === 'thread' ? `
📱 THREAD FORMAT (3-5 tweets, 150-250 chars each):

Tweet 1: The shift happening now
Tweet 2: Current example/proof point
Tweet 3: Where it's going (prediction)
Tweet 4: What this means (implication)

Return JSON: {"tweets": ["...", "...", ...]}
` : `
📱 SINGLE TWEET (180-280 chars):

One forward-thinking insight with current example and future direction.
Show where things are going, not just what is.

Return JSON: {"tweet": "..."}
`}

🔥 SHOW TRENDS: Where is this moving? What's the trajectory?
🧠 GIVE EXAMPLES: Current proof points of the shift
⚡ PREDICT: Where will this be in 2-5 years?`;

  const userPrompt = `Create forward-thinking content about ${topic}. Explore trends, predictions, or paradigm shifts in whatever format is most compelling.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.85,
      max_tokens: format === 'thread' ? 600 : 150, // ✅ Reduced to stay under 280 chars
      response_format: { type: 'json_object' }
    }, { purpose: 'thought_leader_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'THOUGHT_LEADER'),
      format,
      confidence: 0.8
    };
    
  } catch (error: any) {
    console.error('[THOUGHT_LEADER_GEN] Error:', error.message);
    throw new Error(`Thought leader generator failed: ${error.message}. System will retry with different approach.`);
  }
}
