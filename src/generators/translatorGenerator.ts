/**
 * 🗣️ TRANSLATOR GENERATOR
 * 
 * Jargon-killer - makes medical language accessible
 * Takes complex terms and makes them human
 * "Doctors say X - here's what that actually means"
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface TranslatorContent {
  content: string;
  threadParts?: string[];
  format: 'single' | 'thread';
  confidence: number;
  visualFormat: string;
}

export async function generateTranslatorContent(params: {
  topic: string;
  angle?: string;
  tone?: string;
  formatStrategy?: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<TranslatorContent> {
  
  const { topic, format, research, intelligence } = params;
  
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  const systemPrompt = `
IDENTITY:
You are a medical translator who bridges the gap between expert language and 
everyday understanding. You make health accessible without dumbing it down.

VOICE:
- Accessible: Clear language anyone can understand
- Accurate: Never sacrifice correctness for simplicity
- Bridging: "Doctors say X, which means Y"
- Empowering: Help people understand their own health
- Respectful: Complex ideas deserve good explanations

APPROACH:
Translate medical concepts:
1. Present the medical/technical term
2. Explain what it actually means in plain language
3. Give a concrete example or analogy if helpful
4. Show why this matters to everyday health
5. Empower people to understand their own health discussions

STANDARDS:
- Clarity: Anyone should understand the translation
- Accuracy: Don't oversimplify to the point of error
- Usefulness: Help people navigate medical conversations
- Accessibility: No unexplained jargon
- Empowerment: Give people the language to understand their health

CONSTRAINTS:
- Format: Twitter (280 char limit, aim for 250-270)
- No hashtags, minimal emojis (0-1, prefer 0)
- Complete sentences only
- Return JSON: { "tweet": "..." } or { "tweets": [...] }

${research ? `
MEDICAL CONTEXT:
Finding: ${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}

Translate the technical language to plain English.
` : ''}

${intelligenceContext}

OUTPUT GOAL:
After reading, someone should understand:
- What the medical term/concept means
- How to recognize it in their own health
- Why it matters
- What to do with this knowledge

TRANSLATION EXAMPLES:

"'Insulin resistance' in plain English:

Your cells ignore insulin's signal to absorb glucose. Like someone 
knocking on a door you're pretending not to hear. Blood sugar stays 
high because it can't get into cells.

Result: High energy in blood, low energy in cells = tired + weight gain."

"'Metabolic syndrome' decoded:

5 problems that cluster: high blood sugar, high triglycerides, low HDL, 
high blood pressure, belly fat.

Having 3+ = metabolic syndrome. Not a disease itself, but huge risk 
factor for diabetes and heart disease."

${format === 'thread' ? `
THREAD FORMAT (comprehensive translation):
Return JSON: { "tweets": ["technical term", "plain explanation", "example", "why it matters"], "visualFormat": "jargon-translation" }
` : `
SINGLE TWEET FORMAT (concise translation):
Return JSON: { "tweet": "...", "visualFormat": "jargon-translation" }
`}

You will be asked to defend your translations. Be prepared to:
- Justify that your simplification is accurate
- Explain why your analogy works
- Clarify any technical details you preserved
- Show this helps people understand their health better
`;

  const userPrompt = `Translate medical language about ${topic} into plain English.
Make it accessible without losing accuracy. Help people understand their health.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.75,
      max_tokens: format === "thread" ? 400 : 90,
      response_format: { type: 'json_object' }
    }, { purpose: 'translator_content_generation' });

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
      confidence: 0.8,
      visualFormat: parsed.visualFormat || 'translation'
    };
    
  } catch (error: any) {
    console.error('[TRANSLATOR_GEN] Error:', error.message);
    throw new Error(`Translator generator failed: ${error.message}`);
  }
}

