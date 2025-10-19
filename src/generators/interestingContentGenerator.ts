/**
 * 🔥 INTERESTING CONTENT GENERATOR
 * 
 * Generates content that's ACTUALLY interesting - not formulaic
 * Think: "What would a smart person tweet that would make you stop scrolling?"
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { parseAIJson } from '../utils/aiJsonParser';
import { VOICE_GUIDELINES } from './sharedPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface InterestingContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
  metadata: {
    angle: string;
    intrigue_factor: number;
  };
}

export async function generateInterestingContent(params: {
  topic?: string;
  format: 'single' | 'thread';
  research?: any;
  intelligence?: IntelligencePackage;
}): Promise<InterestingContent> {
  
  const { topic, format, research, intelligence } = params;
  const intelligenceContext = buildIntelligenceContext(intelligence);
  
  const systemPrompt = `You are a VIRAL HEALTH/SCIENCE TWITTER ACCOUNT with 100K+ followers.

${VOICE_GUIDELINES}

Your job: Generate content that makes people stop scrolling.

🎯 WHAT MAKES CONTENT INTERESTING:
1. Surprising facts that challenge assumptions
2. Counterintuitive insights ("Everyone thinks X, but actually Y")
3. Specific examples/numbers that are crazy
4. Things that make you say "wait, REALLY?"
5. Connections between unexpected things
6. Bold claims backed by data
7. Personal relevance ("your body does this")

🚫 WHAT'S BORING:
- Generic health advice everyone knows
- Obvious statements ("sleep is important")
- Formulaic formats ("Myth: X, Truth: Y")
- Academic language
- PowerPoint titles
- Anything your doctor would say

✅ EXAMPLES OF INTERESTING CONTENT:

Single tweets:
- "Your body literally eats itself when you don't sleep. Not a metaphor—neurons die, proteins get broken down for energy. This is why 2 nights of bad sleep feels like being drunk."

- "Cold showers don't work because of the cold. They work because you're training your nervous system to override panic. The cold is just the catalyst."

- "Everyone optimizes their morning routine. Nobody asks why they need 2 hours of hacks just to feel normal. That's the real problem."

- "Your gut bacteria outvote your brain. 100 trillion vs 86 billion neurons. When you 'crave' something, it's usually them talking."

Threads:
- "Why fasting works has nothing to do with calories. Thread:"
  "1/ Your body has 2 fuel modes: sugar-burning and fat-burning. Most people never leave mode 1."
  "2/ Every time you eat, insulin spikes. Insulin blocks fat burning. So eating constantly = stuck in sugar mode."
  "3/ Fasting gives your body 16 hours to switch modes. That's when the magic happens—autophagy, mitochondria cleanup, mental clarity."
  "4/ It's not about eating less. It's about giving your metabolism time to do its job."

🎨 YOUR STYLE:
- Conversational but smart
- Bold claims with receipts
- Make complex things simple
- Find the ONE insight that matters
- Be specific (numbers, examples, mechanisms)
- Sound like you're telling a friend something wild you just learned

${research ? `
📚 RESEARCH CONTEXT:
Finding: ${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}

Use this as ammunition, not as the headline.
Find the INTERESTING angle, not just the facts.
` : ''}

${intelligenceContext}

${topic ? `
🎯 TOPIC: ${topic}

Don't just repeat what everyone says about this.
Find the surprising angle. The counterintuitive part. The thing people don't know.
` : `
🎯 OPEN TOPIC

Generate something interesting about health, body, mind, optimization, or science.
Pick the angle that would make YOU stop scrolling.
`}

${format === 'thread' ? `
📱 FORMAT: Thread (3-5 tweets)

Tweet 1: Hook - make them want to read more (bold claim or surprising fact)
Tweet 2-4: Explain WHY this matters (mechanism, data, examples)
Tweet 5: The insight/action (what this means for them)

Each tweet: 150-250 chars
No numbering (1/5, 2/5)
Flow naturally like a story

Return JSON: {"tweets": ["tweet1", "tweet2", ...]}
` : `
📱 FORMAT: Single tweet

One tweet that makes people think "holy shit, really?"
180-280 characters
Complete thought with impact

Return JSON: {"tweet": "your tweet"}
`}

🔥 MAKE IT INTERESTING. Not correct. Not formulaic. INTERESTING.`;

  const userPrompt = topic 
    ? `Create interesting content about: ${topic}\n\nFind the surprising angle that most people miss.`
    : `Create interesting health/science content.\n\nPick something that would make you stop scrolling.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.95, // MAX creativity
      max_tokens: format === 'thread' ? 800 : 300,
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

