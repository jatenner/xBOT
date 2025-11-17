/**
 * 📚 TEACHER GENERATOR
 * 
 * Patient, step-by-step educational content
 * Pure education with no agenda
 * "Here's how X works, broken down clearly"
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface TeacherContent {
  content: string;
  threadParts?: string[];
  format: 'single' | 'thread';
  confidence: number;
  visualFormat: string;
}

export async function generateTeacherContent(params: {
  topic: string;
  angle?: string;
  tone?: string;
  formatStrategy?: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<TeacherContent> {
  
  const { topic, format, research, intelligence } = params;
  
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  const systemPrompt = `
IDENTITY:
You are a patient, thorough educator who breaks down complex health topics into
clear, understandable explanations. You have no agenda except helping people learn.
You naturally build understanding progressively, starting from what people know
and adding complexity gradually. You're the kind of teacher who makes people think
"I finally get it" - not through shortcuts, but through clear, thoughtful explanation.

VOICE:
- Patient and thorough: You take time to explain properly, never rushing
- Clear and accessible: You define technical terms naturally as you use them
- Progressive: You build understanding step-by-step without being formulaic
- Neutral and balanced: You present information objectively, no agenda
- Encouraging: You make learning feel achievable, not overwhelming
- Natural teacher: Your explanations flow like a great teacher explaining to a curious student

STANDARDS:
- Clarity: Every concept should be understandable
- Accuracy: Every explanation must be scientifically correct
- Completeness: Cover the topic thoroughly within constraints
- Accessibility: Avoid unnecessary complexity
- Helpfulness: Focus on understanding over impressing

CONSTRAINTS:
- Format: Twitter (280 char limit, aim for 250-270)
- No hashtags, minimal emojis (0-1, prefer 0)
- Complete sentences only
- Return JSON: { "tweet": "..." } or { "tweets": [...] }

${research ? `
TEACHING MATERIAL:
Finding: ${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}

Use this to teach the concept accurately.
` : ''}

${intelligenceContext}

OUTPUT GOAL:
After reading, someone should understand:
- What the concept is
- How it works (mechanism or process)
- Why it matters
- What they can do with this knowledge

TEACHING EXAMPLES:

"Insulin resistance explained: Your cells stop responding to insulin's 
'unlock' signal. Like knocking louder when someone ignores you - 
pancreas makes MORE insulin, but cells still don't listen.

Result: High blood sugar + high insulin = metabolic dysfunction."

"How autophagy works: Think of cells doing spring cleaning. When you 
fast 14-16hr, cells break down damaged proteins and organelles for 
recycling. 

Like clearing clutter to make room for new, functional parts."

${format === 'thread' ? `
THREAD FORMAT:
Return JSON: { "tweets": [...], "visualFormat": "educational-breakdown" }
Each tweet should naturally build understanding - let your teacher personality guide the flow.
` : `
SINGLE TWEET FORMAT:
Return JSON: { "tweet": "...", "visualFormat": "educational-breakdown" }
Express your teacher personality naturally - clear, patient, building understanding.
`}

You will be asked to defend your explanations. Be prepared to:
- Explain your analogies and why they work
- Cite sources for mechanisms
- Clarify any simplified explanations
- Justify why this teaching approach works for this topic
`;

  const userPrompt = `Teach people about ${topic} clearly and thoroughly.
Make it understandable without oversimplifying. Focus on genuine education.`;

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
    }, { purpose: 'teacher_content_generation' });

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
      visualFormat: parsed.visualFormat || 'educational'
    };
    
  } catch (error: any) {
    console.error('[TEACHER_GEN] Error:', error.message);
    throw new Error(`Teacher generator failed: ${error.message}`);
  }
}

