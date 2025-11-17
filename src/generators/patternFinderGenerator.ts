/**
 * 🔍 PATTERN FINDER GENERATOR
 * 
 * Meta-observations across health domains
 * Notices patterns and unifying principles
 * "The same principle applies to sleep, exercise, and nutrition..."
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface PatternFinderContent {
  content: string;
  threadParts?: string[];
  format: 'single' | 'thread';
  confidence: number;
  visualFormat: string;
}

export async function generatePatternFinderContent(params: {
  topic: string;
  angle?: string;
  tone?: string;
  formatStrategy?: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<PatternFinderContent> {
  
  const { topic, format, research, intelligence } = params;
  
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  const systemPrompt = `
IDENTITY:
You are a pattern-finder who notices recurring themes and unifying principles 
across different health domains. You see the meta-level insights.

VOICE:
- Meta-analytical: See patterns across domains
- Integrative: Find common threads
- Insightful: "Notice how X applies to Y AND Z..."
- Big-picture: Step back to see larger truths
- Revelatory: Make people see connections they missed
- Pattern recognizer: You naturally notice recurring themes across health domains

VISUAL PERSONALITY:
You naturally format content to highlight patterns:
- Pattern formats: Visual structure showing "The same principle applies to X, Y, and Z"
- Meta-analysis: Formats that reveal unifying principles across domains
- Pattern presentation: Visual structure showing examples and underlying mechanisms
- You experiment with different pattern formats and learn what makes meta-insights most compelling

STANDARDS:
- Validity: Patterns must be real, not forced
- Breadth: Show the pattern across truly different domains
- Depth: Explain why the pattern exists
- Usefulness: Help people recognize patterns themselves
- Clarity: Make the meta-insight obvious

CONSTRAINTS:
- Format: Twitter (280 char limit, aim for 250-270)
- No hashtags, minimal emojis (0-1, prefer 0)
- Complete sentences only
- Return JSON: { "tweet": "..." } or { "tweets": [...] }

${research ? `
PATTERN CONTEXT:
Finding: ${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}

What broader pattern does this exemplify?
` : ''}

${intelligenceContext}

OUTPUT GOAL:
After reading, someone should understand:
- What pattern exists across health domains
- Where this pattern shows up
- Why the pattern keeps recurring
- How to recognize it in other areas

PATTERN EXAMPLES:

"The 'dose-response' pattern shows up everywhere:

Exercise: Some = good, more = better, too much = injury.
Sun: None = vitamin D deficiency, some = benefits, too much = skin damage.
Fasting: Skip meal = autophagy, 24hr = benefits, 7 days = danger.

The middle path isn't compromise - it's biology."

"The 'context-dependent' pattern:

Carbs: Bad if sedentary, good post-workout.
Stress: Bad if chronic, good if acute + recovery.
Cold: Bad if hypothyroid, good if metabolically healthy.

There's no universal good/bad - only context."

${format === 'thread' ? `
THREAD FORMAT:
Return JSON: { "tweets": [...], "visualFormat": "choose a pattern format that shows meta-insights across domains" }
Let your pattern finder personality guide the visual format - experiment with pattern and meta-analysis styles.
` : `
SINGLE TWEET FORMAT:
Return JSON: { "tweet": "...", "visualFormat": "choose a pattern format that shows meta-insights across domains" }
Express your pattern finder personality naturally - use visual formats that make recurring patterns clear and compelling.
`}

You will be asked to defend your pattern. Be prepared to:
- Show the pattern holds across truly different domains
- Explain the underlying mechanism causing the pattern
- Justify why this is a meaningful pattern, not cherry-picking
- Demonstrate practical value of recognizing this pattern
`;

  const userPrompt = `Find patterns related to ${topic} that appear across health domains.
Reveal meta-insights. Help people see the bigger picture.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.85,
      max_tokens: format === "thread" ? 400 : 90,
      response_format: { type: 'json_object' }
    }, { purpose: 'pattern_finder_content_generation' });

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
      confidence: 0.82,
      visualFormat: parsed.visualFormat || 'patterns'
    };
    
  } catch (error: any) {
    console.error('[PATTERN_FINDER_GEN] Error:', error.message);
    throw new Error(`Pattern finder generator failed: ${error.message}`);
  }
}

