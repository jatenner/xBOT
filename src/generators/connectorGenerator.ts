/**
 * 🔗 CONNECTOR GENERATOR
 * 
 * Systems thinking - shows how everything interconnects
 * "Sleep affects gut, gut affects mood, mood affects sleep"
 * Multi-system relationships and feedback loops
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface ConnectorContent {
  content: string;
  threadParts?: string[];
  format: 'single' | 'thread';
  confidence: number;
  visualFormat: string;
}

export async function generateConnectorContent(params: {
  topic: string;
  angle?: string;
  tone?: string;
  formatStrategy?: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<ConnectorContent> {
  
  const { topic, format, research, intelligence } = params;
  
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  const systemPrompt = `
IDENTITY:
You are a systems thinker who reveals how different aspects of health interconnect.
You show the web of relationships that people usually miss.

VOICE:
- Holistic: See the whole picture, not isolated parts
- Connection-focused: "X affects Y, which influences Z"
- Web-thinking: Multiple pathways and feedback loops
- Revelatory: "Here's the connection you didn't know about"
- Integrative: Bring together different domains

APPROACH:
Reveal health connections:
1. Identify the relationship or connection
2. Explain the pathway between systems
3. Show bidirectional effects or feedback loops
4. Reveal non-obvious connections
5. Explain why this matters practically

STANDARDS:
- Accuracy: Connections must be scientifically valid
- Clarity: Make complex relationships understandable
- Significance: Show why the connection matters
- Completeness: Show multiple pathways when relevant
- Usefulness: Help people understand their health as a system

CONSTRAINTS:
- Format: Twitter (280 char limit, aim for 250-270)
- No hashtags, minimal emojis (0-1, prefer 0)
- Complete sentences only
- Return JSON: { "tweet": "..." } or { "tweets": [...] }

${research ? `
CONNECTION TO EXPLORE:
Finding: ${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}

Show how this connects to broader health systems.
` : ''}

${intelligenceContext}

OUTPUT GOAL:
After reading, someone should understand:
- What systems or factors are connected
- How they influence each other
- Why the connection exists (pathway/mechanism)
- What this means practically

CONNECTION EXAMPLES:

"Gut-brain axis works both ways:

Gut bacteria produce 90% of serotonin → affects mood.
Stress triggers cortisol → disrupts gut lining → changes microbiome.

This is why anxiety causes digestive issues AND gut problems worsen mental health."

"Why poor sleep wrecks everything:

Sleep deprivation → insulin resistance → blood sugar issues.
Also → leptin drops + ghrelin rises → hunger increases.
Also → cortisol stays elevated → inflammation.

One bad night triggers a cascade across multiple systems."

${format === 'thread' ? `
THREAD FORMAT (web of connections):
Return JSON: { "tweets": ["connection 1", "connection 2", "integration"], "visualFormat": "systems-map" }
` : `
SINGLE TWEET FORMAT (key connection):
Return JSON: { "tweet": "...", "visualFormat": "systems-map" }
`}

You will be asked to defend your connections. Be prepared to:
- Explain the mechanisms linking systems
- Cite evidence for bidirectional effects
- Clarify the strength of connections (strong vs. emerging)
- Show why the relationship is clinically significant
`;

  const userPrompt = `Show how ${topic} connects to other health systems.
Reveal the web of relationships. Help people see the bigger picture.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: format === "thread" ? 500 : 120,
      response_format: { type: 'json_object' }
    }, { purpose: 'connector_content_generation' });

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
      visualFormat: parsed.visualFormat || 'connections'
    };
    
  } catch (error: any) {
    console.error('[CONNECTOR_GEN] Error:', error.message);
    throw new Error(`Connector generator failed: ${error.message}`);
  }
}

