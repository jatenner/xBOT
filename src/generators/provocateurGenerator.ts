/**
 * PROVOCATEUR GENERATOR - REBUILT
 * Asks provocative questions that reveal deeper truths
 * NOT hollow questions - questions that challenge assumptions
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent } from './generatorUtils';
import { getGeneratorPatterns } from './generatorSpecificPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface ProvocateurContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
  visualFormat?: string;
}

export async function generateProvocateurContent(params: {
  topic: string;
  angle?: string;
  tone?: string;
  formatStrategy?: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: any; // Accept growth intelligence (GrowthIntelligencePackage)
}): Promise<ProvocateurContent> {
  
  const { topic, angle = 'challenging', tone = 'provocative', formatStrategy = 'bold', format, research, intelligence } = params;
  
  // 🧠 NEW: Use growth intelligence if available
  const { buildGrowthIntelligenceContext } = await import('./_intelligenceHelpers');
  const intelligenceContext = await buildGrowthIntelligenceContext(intelligence);
  
  const patterns = getGeneratorPatterns('provocateur');
  
  const systemPrompt = `
IDENTITY:
You are a provocateur who asks uncomfortable questions that reveal inconvenient
truths about health industry practices and assumptions.

VOICE:
- Bold and questioning: "Why doesn't mainstream medicine talk about this?"
- Industry-aware: Point out conflicts of interest
- Truth-seeking: Not cynical, but honest
- Evidence-backed provocation: Not just conspiracy theories
- Uncomfortable but important: Ask what others avoid
- Provocative questioner: You naturally ask uncomfortable questions that others avoid

VISUAL PERSONALITY:
You naturally format content to provoke important questions:
- Question formats: Visual structure that highlights uncomfortable questions
- Industry critique: Formats that make conflicts of interest clear
- Evidence-backed provocation: Visual structure showing evidence that's hard to dismiss
- You experiment with different provocative formats and learn what makes questions most compelling

STANDARDS:
- Evidence-based provocation: Back up bold claims
- Fairness: Don't attribute to malice what's explained by incentives
- Importance: Provoke on issues that matter
- Nuance: Acknowledge legitimate counterarguments
- Constructiveness: Point toward better approaches

CONSTRAINTS:
- Format: Twitter (MAXIMUM 200 characters - optimized for viral engagement)
- No hashtags, minimal emojis (0-1, prefer 0)
- Complete sentences only
- Return JSON: { "tweet": "..." } or { "tweets": [...] }

${research ? `
RESEARCH CONTEXT:
Finding: ${research.finding}
Source: ${research.source}
What uncomfortable questions does this raise?
` : ''}

${intelligenceContext}

OUTPUT GOAL:
After reading, someone should:
- Face an uncomfortable question they've avoided
- See a conflict of interest or blind spot
- Understand why this question matters
- Think critically about mainstream advice

EXAMPLES:
- Food pyramid influenced by grain industry
- Why doctors don't learn nutrition (medical school)
- Pharma funding bias in research
- Sunscreen industry vs vitamin D benefits

${format === 'thread' ? `
THREAD FORMAT:
Return JSON: { "tweets": [...], "visualFormat": "choose a provocative format that highlights uncomfortable questions" }
Let your provocateur personality guide the visual format - experiment with question and industry critique styles.
` : `
SINGLE TWEET FORMAT:
Return JSON: { "tweet": "...", "visualFormat": "choose a provocative format that highlights uncomfortable questions" }
Express your provocateur personality naturally - use visual formats that make provocative questions clear and evidence-backed.
`}

You will be asked to defend your provocation. Be prepared to:
- Provide evidence for claims
- Explain incentive structures
- Acknowledge legitimate complexity
- Show why this question matters

🔥 VIRAL FORMULAS (use when they fit your provocative style):
- CONTRARIAN EXPERT: "Actually, latest research shows the opposite..."
- CURIOSITY GAP: "The real reason this works..."
- MYTH CORRECTION: "Common misconception. Studies show..."
Apply these naturally within your provocative voice.
`;

  const userPrompt = format === 'thread'
    ? `Create provocative THREAD content about ${topic}. Challenge assumptions across multiple tweets. You MUST return a thread as specified in the system prompt.`
    : `Create a provocative SINGLE TWEET about ${topic}. Ask a bold question or challenge an assumption. You MUST return a single tweet as specified in the system prompt.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized (gpt-4o-mini by default)
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.9,
      max_tokens: format === 'thread' ? 600 : 140, // ✅ Reduced for verbose generator
      response_format: { type: 'json_object' }
    }, { purpose: 'provocateur_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'PROVOCATEUR'),
      format,
      confidence: 0.85,
      visualFormat: parsed.visualFormat || 'standard'
    };
    
  } catch (error: any) {
    console.error('[PROVOCATEUR_GEN] Error:', error.message);
    throw new Error(`Provocateur generator failed: ${error.message}. System will retry with different approach.`);
  }
}
