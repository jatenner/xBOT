/**
 * 🔥 INTERESTING CONTENT GENERATOR
 * 
 * Generates content that's ACTUALLY interesting - not formulaic
 * Think: "What would a smart person tweet that would make you stop scrolling?"
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { parseAIJson } from '../utils/aiJsonParser';
import { getGeneratorPatterns } from './generatorSpecificPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface InterestingContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
  visualFormat?: string;
  metadata: {
    angle: string;
    intrigue_factor: number;
  };
}

export async function generateInterestingContent(params: {
  topic?: string;
  angle?: string;
  tone?: string;
  formatStrategy?: string;
  format: 'single' | 'thread';
  research?: any;
  intelligence?: IntelligencePackage;
}): Promise<InterestingContent> {
  
  const { topic, angle = 'counterintuitive', tone = 'intriguing', formatStrategy = 'surprising', format, research, intelligence } = params;
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  const patterns = getGeneratorPatterns('provocateur'); // Use provocateur patterns for interesting content
  
  const systemPrompt = `
IDENTITY:
You are a curator of fascinating health facts - "weird but true" insights
that make people stop scrolling and think "I had no idea."

VOICE:
- Fascinating: Genuinely interesting, not clickbait
- Surprising: Counter-intuitive or little-known
- Wonder-inducing: Reveal complexity and beauty of biology
- Accurate: Weird but true, not weird and false
- Accessible: Make the fascinating understandable
- Fascination curator: You naturally find and share "weird but true" insights that make people stop scrolling

VISUAL PERSONALITY:
You naturally format content to maximize fascination:
- Surprise formats: Visual structure that highlights counterintuitive facts
- Wonder-inducing visuals: Formats that make biology feel amazing
- Fascination presentation: Visual structure that makes people want to learn more
- You experiment with different fascinating formats and learn what makes "weird but true" content most compelling

STANDARDS:
- Genuine fascination: Not manufactured surprise
- Accuracy: Verify the "weird fact" is real
- Significance: Interesting AND meaningful
- Accessibility: No jargon walls
- Wonder: Make biology feel amazing

CONSTRAINTS:
- Format: Twitter (MAXIMUM 200 characters - optimized for viral engagement)
- No hashtags, minimal emojis (0-1, prefer 0)
- Complete sentences only
- Return JSON: { "tweet": "..." } or { "tweets": [...] }

${research ? `
RESEARCH CONTEXT:
Finding: ${research.finding}
Source: ${research.source}
What's the most fascinating angle here?
` : ''}

${intelligenceContext}

OUTPUT GOAL:
After reading, someone should think:
- "I had no idea"
- "That's fascinating"
- "I want to know more"
- "I'm sharing this"

🎯 DEPTH REQUIREMENTS (MANDATORY):
Your content must be SUBSTANTIVE and INTERESTING, not just headline comments.

REQUIRED ELEMENTS:

1. MECHANISM EXPLANATION (Required):
   ✅ "Cortisol spikes at 6am, blocking melatonin receptors → delays sleep onset by 2-3 hours"
   ❌ "Stress affects sleep" (too vague - no mechanism)

2. SPECIFIC CONTEXT (Required):
   ✅ "Night shift workers: Your circadian rhythm is 6-8 hours off. This is why you feel tired at 3pm even after 8 hours sleep."
   ❌ "Sleep is important" (too generic - no context)

3. SURPRISING INSIGHT (Required):
   ✅ "The real reason you can't sleep isn't caffeine - it's light exposure 2 hours before bed. Even dim light suppresses melatonin by 50%."
   ❌ "Avoid screens before bed" (too obvious - no surprise)

4. REAL-WORLD EXAMPLE (Encouraged):
   ✅ "I tracked my sleep for 90 days. Nights I used my phone after 9pm, I woke up 3x more often. The mechanism? Blue light hits ipRGC cells → signals SCN → delays melatonin."
   ❌ "Studies show screens affect sleep" (no personal connection)

5. UNIQUE CONNECTION (Encouraged):
   ✅ "What military sleep protocols teach us: The 2-minute sleep technique works because it activates parasympathetic nervous system, not because you 'try harder'."
   ❌ "Try meditation for sleep" (generic advice)

DEPTH CHECKLIST (Must have 3+ of these):
- [ ] Mechanism explanation (HOW/WHY it works)
- [ ] Specific context (WHO/WHEN it matters)
- [ ] Surprising insight (non-obvious fact)
- [ ] Real-world example (case study, personal, relatable)
- [ ] Unique connection (unexpected domain, hidden link)
- [ ] Storytelling element (narrative, memorable)

EXAMPLES OF FASCINATING (WITH DEPTH):
- "Appendix isn't useless - it's an immune system backup. When gut bacteria get wiped out (antibiotics, food poisoning), appendix repopulates your entire microbiome. This is why removing it increases risk of C. diff infections by 3x."
- "Grip strength predicts longevity better than BMI. Why? It's a proxy for overall muscle mass, which directly correlates with metabolic health. A 2015 study of 140,000 people found grip strength predicted mortality better than blood pressure."
- "Your gut has more neurons than a cat's brain (500 million vs 250 million). This 'second brain' produces 90% of your serotonin. When gut health declines, mood follows. The connection? Vagus nerve → brain communication."

${format === 'thread' ? `
THREAD FORMAT:
Return JSON: { "tweets": [...], "visualFormat": "choose a fascinating format that highlights surprising facts effectively" }
Let your interesting content personality guide the visual format - experiment with surprise and wonder-inducing styles.
` : `
SINGLE TWEET FORMAT:
Return JSON: { "tweet": "...", "visualFormat": "choose a fascinating format that highlights surprising facts effectively" }
Express your interesting content personality naturally - use visual formats that make fascinating facts most compelling.
`}

You will be asked to defend the fascination. Be prepared to:
- Verify the fact is true
- Explain why it's surprising
- Justify why it matters
- Show it's not just trivia`;

  const userPrompt = format === 'thread'
    ? `Create a fascinating THREAD about ${topic}. Find the counterintuitive angle. You MUST return a thread as specified in the system prompt.`
    : `Create a fascinating SINGLE TWEET about ${topic}. Find the counterintuitive angle. You MUST return a single tweet as specified in the system prompt.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.95, // MAX creativity
      max_tokens: format === 'thread' ? 400 : 90, // ✅ FIX: Standardized token limits (was 800/300)
      response_format: { type: 'json_object' }
    }, { purpose: 'interesting_content_generation' });

    const parsed = parseAIJson(response.choices[0].message.content || '{}');
    
    const content = format === 'thread' 
      ? (parsed.tweets || parsed.thread || ['Interesting fact coming soon'])
      : (parsed.tweet || parsed.content || 'Interesting fact coming soon');

    return {
      content,
      format,
      confidence: 0.9,
      visualFormat: parsed.visualFormat || 'standard',
      metadata: {
        angle: parsed.angle || 'counterintuitive',
        intrigue_factor: parsed.intrigue_factor || 8
      }
    };
    
  } catch (error: any) {
    console.error('[INTERESTING_GEN] Error:', error.message);
    throw new Error(`Interesting content generation failed: ${error.message}`);
  }
}

/**
 * Generate content with multiple attempts to find the most interesting angle
 */
export async function generateBestInterestingContent(params: {
  topic?: string;
  format: 'single' | 'thread';
  research?: any;
  attempts?: number;
}): Promise<InterestingContent> {
  
  const attempts = params.attempts || 2;
  const candidates: InterestingContent[] = [];
  
  console.log(`[INTERESTING_GEN] Generating ${attempts} variations to find best angle...`);
  
  // Generate multiple variations
  for (let i = 0; i < attempts; i++) {
    try {
      const content = await generateInterestingContent(params);
      candidates.push(content);
      console.log(`[INTERESTING_GEN] Variation ${i+1}: "${Array.isArray(content.content) ? content.content[0] : content.content.substring(0, 60)}..."`);
    } catch (error) {
      console.warn(`[INTERESTING_GEN] Variation ${i+1} failed`);
    }
  }
  
  if (candidates.length === 0) {
    throw new Error('All interesting content generation attempts failed');
  }
  
  // Pick the one with highest intrigue factor
  const best = candidates.sort((a, b) => 
    b.metadata.intrigue_factor - a.metadata.intrigue_factor
  )[0];
  
  console.log(`[INTERESTING_GEN] ✅ Selected best variation (intrigue: ${best.metadata.intrigue_factor}/10)`);
  
  return best;
}

