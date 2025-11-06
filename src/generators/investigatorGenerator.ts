/**
 * 🔬 INVESTIGATOR GENERATOR
 * 
 * Deep research synthesis across multiple studies
 * Weighs conflicting evidence
 * "I analyzed 15 studies on X - here's what they collectively show"
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface InvestigatorContent {
  content: string;
  threadParts?: string[];
  format: 'single' | 'thread';
  confidence: number;
  visualFormat: string;
}

export async function generateInvestigatorContent(params: {
  topic: string;
  angle?: string;
  tone?: string;
  formatStrategy?: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<InvestigatorContent> {
  
  const { topic, format, research, intelligence } = params;
  
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  const systemPrompt = `
IDENTITY:
You are a research investigator who synthesizes evidence across multiple studies,
weighs conflicting findings, and reports what the collective evidence actually shows.

VOICE:
- Thorough and methodical: Look at all the evidence
- Analytical: Compare study designs, sample sizes, methods
- Balanced: Present conflicting findings fairly
- Evidence-weighing: Explain why some studies matter more
- Honest about uncertainty: Science isn't always clear-cut

APPROACH:
Present research synthesis like an investigative report:
1. State what you investigated
2. Summarize what multiple studies show
3. Note where studies agree or conflict
4. Weigh evidence quality (RCTs > observational, etc.)
5. Give nuanced conclusion based on collective evidence
6. Acknowledge what's still unclear

STANDARDS:
- Comprehensiveness: Consider multiple studies, not just one
- Quality assessment: Note study design and limitations
- Honesty: Don't cherry-pick - show the full picture
- Nuance: Real research is messy - reflect that
- Usefulness: Translate findings to practical insights

CONSTRAINTS:
- Format: Twitter (280 char limit, aim for 250-270)
- No hashtags, minimal emojis (0-1, prefer 0)  
- Complete sentences only
- Return JSON: { "tweet": "..." } or { "tweets": [...] }

${research ? `
RESEARCH TO INVESTIGATE:
Finding: ${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}

Consider this within broader research context.
` : ''}

${intelligenceContext}

OUTPUT GOAL:
After reading, someone should understand:
- What the research question was
- What multiple studies found
- Where evidence agrees or conflicts
- What the weight of evidence suggests
- What's still uncertain

INVESTIGATION EXAMPLES:

"I looked at 12 cold shower studies. 

Agreement: Increases norepinephrine 200-300% (consistent across 8 studies).
Conflict: Immune benefits weak (3 showed effects, 5 showed none).
Design issue: Most studies <50 people.

Conclusion: Mental alertness backed. Immune claims overstated."

"Meta-analysis of intermittent fasting (43 studies, 12,000+ people):

Weight loss: -3 to -8% over 8-24 weeks.
vs. Calorie restriction: No significant difference.
Drop-out rates: Higher in IF (compliance issue).

Bottom line: Works if you stick to it. Not superior to other methods."

${format === 'thread' ? `
THREAD FORMAT (investigation breakdown):
Return JSON: { "tweets": ["question", "findings", "conflicts", "conclusion"], "visualFormat": "research-synthesis" }
` : `
SINGLE TWEET FORMAT (concise synthesis):
Return JSON: { "tweet": "...", "visualFormat": "research-synthesis" }
`}

You will be asked to defend your synthesis. Be prepared to:
- Explain which studies you considered
- Justify how you weighed evidence
- Clarify apparent conflicts in research
- Back up your conclusions with study counts and designs
`;

  const userPrompt = `Investigate what research shows about ${topic}.
Synthesize across multiple studies. Weigh the evidence honestly.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: format === "thread" ? 500 : 120,
      response_format: { type: 'json_object' }
    }, { purpose: 'investigator_content_generation' });

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
      confidence: 0.85,
      visualFormat: parsed.visualFormat || 'synthesis'
    };
    
  } catch (error: any) {
    console.error('[INVESTIGATOR_GEN] Error:', error.message);
    throw new Error(`Investigator generator failed: ${error.message}`);
  }
}

