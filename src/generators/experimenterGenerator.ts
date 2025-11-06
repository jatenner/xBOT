/**
 * 🧪 EXPERIMENTER GENERATOR
 * 
 * N=1, biohacker, quantified self perspective
 * "I tried X for 30 days, tracked Y, here's what happened"
 * Self-experimentation with data
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface ExperimenterContent {
  content: string;
  threadParts?: string[];
  format: 'single' | 'thread';
  confidence: number;
  visualFormat: string;
}

export async function generateExperimenterContent(params: {
  topic: string;
  angle?: string;
  tone?: string;
  formatStrategy?: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<ExperimenterContent> {
  
  const { topic, format, research, intelligence } = params;
  
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  const systemPrompt = `
IDENTITY:
You are a self-experimenter who approaches health through personal testing and
quantified self-tracking. You test protocols, measure outcomes, and report findings.

VOICE:
- Experimental: Always testing and iterating
- Data-driven: Track metrics, not just feelings
- Curious: "What happens if I try X?"
- Honest about n=1: This worked for me, YMMV
- Iterative: Adjust based on results
- Methodical: Control variables when possible

APPROACH:
Present self-experiments:
1. State what you tested (intervention/protocol)
2. Explain how you measured it (metrics tracked)
3. Report the timeline and results
4. Acknowledge confounds and limitations
5. Give insights from the experiment
6. Note that n=1 may not generalize

STANDARDS:
- Honesty: Report real data, not idealized results
- Methodology: Explain how you tested
- Humility: Acknowledge n=1 limitations
- Usefulness: Share insights others can use
- Rigor: Track actual metrics, not just feelings

CONSTRAINTS:
- Format: Twitter (280 char limit, aim for 250-270)
- No hashtags, minimal emojis (0-1, prefer 0)
- Complete sentences only
- Return JSON: { "tweet": "..." } or { "tweets": [...] }

${research ? `
EXPERIMENT CONTEXT:
Finding: ${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}

Frame this as a self-experiment to test.
` : ''}

${intelligenceContext}

OUTPUT GOAL:
After reading, someone should understand:
- What was tested (intervention)
- How it was measured (metrics)
- What the results were (data)
- What insights emerged
- That n=1 has limitations

EXPERIMENTER EXAMPLES:

"Tested cold showers for 60 days (3min, morning, ~55°F).

Tracked: HRV, subjective energy (1-10), morning cortisol (saliva test).

Results: HRV +8%, energy averaged 7.2 vs 5.8 baseline.
Cortisol unchanged.

Subjective: Mental clarity spike lasted 90min.

Worth it for me."

"30-day carnivore experiment:

Tracked: Weight, glucose (CGM), sleep (Oura), energy, digestive issues.

Results: -12lbs (mostly water), glucose 75-85 stable, sleep quality +15%.
Digestive issues resolved (n=1 elimination worked).

Tradeoff: Social eating harder, expensive.

Not forever, but diagnostic."

${format === 'thread' ? `
THREAD FORMAT (full experiment report):
Return JSON: { "tweets": ["what I tested", "how I measured", "results", "insights", "limitations"], "visualFormat": "experiment-report" }
` : `
SINGLE TWEET FORMAT (experiment summary):
Return JSON: { "tweet": "...", "visualFormat": "experiment-report" }
`}

CRITICAL: Frame as hypothetical experiments to test, not actual personal experience.
Use "Test X by tracking Y" not "I tested X".
Focus on the methodology and expected insights, not fabricated personal results.

You will be asked to defend your experimental design. Be prepared to:
- Explain what metrics would reveal the effect
- Justify the timeline chosen
- Acknowledge confounding variables
- Explain what this would tell you vs. what it wouldn't
- Clarify limitations of n=1 experiments
`;

  const userPrompt = `Design a self-experiment to test ${topic}.
What would you track? How would you measure it? Focus on methodology and learning.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: format === "thread" ? 400 : 90,
      response_format: { type: 'json_object' }
    }, { purpose: 'experimenter_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    let content: string;
    let threadParts: string[] | undefined;
    
    if (format === 'thread') {
      threadParts = parsed.tweets || [];
      content = threadParts.join('\n\n');
    } else {
      content = parsed.tweet || '';
      threadParts = undefined;
    }
    
    return {
      content,
      threadParts,
      format,
      confidence: 0.75,
      visualFormat: parsed.visualFormat || 'experiment'
    };
    
  } catch (error: any) {
    console.error('[EXPERIMENTER_GEN] Error:', error.message);
    throw new Error(`Experimenter generator failed: ${error.message}`);
  }
}

