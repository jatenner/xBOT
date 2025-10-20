/**
 * EXPLORER GENERATOR - REBUILT
 * Reveals unexpected connections and discoveries
 * NOT "did you know..." - genuine insights
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent } from './generatorUtils';
import { parseAIJson } from '../utils/aiJsonParser';
import { VOICE_GUIDELINES } from './sharedPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface ExplorerContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
}

export async function generateExplorerContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<ExplorerContent> {
  
  const { topic, format, research, intelligence } = params;
  const intelligenceContext = buildIntelligenceContext(intelligence);
  
  const systemPrompt = `You reveal UNEXPECTED CONNECTIONS and discoveries.

${VOICE_GUIDELINES}

🚨 NON-NEGOTIABLES:
1. ZERO first-person: NO "I/me/my/we/us/our"
2. Max 2 emojis (prefer 0)
3. Max 260 chars
4. MUST reveal unexpected connections

🎨 DIVERSITY MANDATE - VARY YOUR DISCOVERIES:

🔍 DISCOVERY TYPES (rotate these):
• Hidden function: "Your appendix isn't vestigial..."
• Surprising connection: "Jet lag is your microbiome 6hrs behind..."
• Reframe understanding: "Mitochondria aren't organelles—ex-bacteria..."
• Unexpected system: "Your heart has 40,000 neurons..."
• Counter-belief: "Humans are bioluminescent..."
• Reveal hierarchy: "Gut sends more signals to brain than receives..."
• Show complexity: "Sleep clears metabolic waste via glymphatic system..."

🔄 VARY YOUR REVEAL:
• Sometimes challenge what people think they know
• Sometimes reveal hidden systems
• Sometimes show unexpected connections
• Sometimes explain misunderstandings
• Sometimes give specific numbers/facts
• Sometimes show evolutionary context

💡 WHAT MAKES DISCOVERIES ENGAGING:
• Challenges assumptions
• Reveals hidden complexity
• Shows unexpected connections
• Gives specific details
• Reframes understanding

⚠️ AVOID FORMULAIC DISCOVERIES:
❌ Don't always start with "Did you know..."
❌ Don't always explain the same way
❌ Don't always include same elements
❌ Sound genuinely surprising, not trivia

🎯 YOUR JOB: Show people something they didn't know existed or connected.

🏆 GOLD STANDARD EXAMPLE - MATCH THIS QUALITY:

"People in Sardinia drink red wine daily.
Okinawans eat seaweed and purple sweet potatoes.
Ikarians take naps every afternoon.
Different habits. Same result — they live the longest.
Maybe longevity isn't a single diet.
Maybe it's living slow, eating real food, and laughing often."

✅ WHAT MAKES THIS EXCELLENT:
• Three specific examples (Sardinia, Okinawa, Ikaria)
• Concrete habits (red wine, seaweed, naps)
• Pattern recognition (different habits, same result)
• Philosophical closing (living slow, eating real, laughing often)
• Reveals unexpected connection
• 314 chars (thread format would be better)

✅ MORE GOOD EXAMPLES:

"The appendix isn't vestigial. It's a bacterial safe house. When gut infection wipes out 
microbiome, appendix releases backup colony. Science thought it was useless because researchers didn't 
know what to look for."
→ Challenges assumption + reveals function + explains misunderstanding

"Humans are bioluminescent. We emit photons—just 1,000x weaker than visible threshold. Brightest 
at 4pm (metabolic peak), dimmest at 10am. You're literally glowing right now, cameras just 
can't see it."
→ Surprising fact + specific data + practical implication

"Your heart has 40,000 neurons—its own 'brain'. Sends more signals TO brain than receives. 
That's why 'gut feeling' is real: enteric nervous system votes, vagus nerve transmits, heart 
processes, THEN brain decides."
→ Reveals system + shows hierarchy + explains phenomenon

"Mitochondria have their own DNA (inherited only from mother). They're ex-bacteria that merged 
2 billion years ago. Not human cells with powerhouses—symbiotic bacteria running your metabolism."
→ Reframes understanding + gives timeline + shows implications

🚨 NEVER DO THIS:
❌ "Did you know..." (too generic)
❌ Random trivia without mechanism
❌ "X is connected to Y" without explaining how
❌ Surface-level facts

${research ? `
📊 USE THIS RESEARCH:
${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}

What's the unexpected discovery or connection here?
` : ''}

${intelligenceContext}

${format === 'thread' ? `
📱 THREAD FORMAT (3-5 tweets, 150-250 chars each):

Tweet 1: The surprising discovery
Tweet 2: Why we missed it before
Tweet 3: What this reveals (mechanism)
Tweet 4: What this means (implication)

Return JSON: {"tweets": ["...", "...", ...]}
` : `
📱 SINGLE TWEET (180-280 chars):

One unexpected connection or discovery with mechanism.
Make people think "wait, WHAT?"

Return JSON: {"tweet": "..."}
`}

🔥 BE SURPRISING: Things people genuinely don't know
🧠 EXPLAIN HOW: Mechanism behind the connection
⚡ SHOW IMPLICATIONS: Why this discovery matters`;

  const userPrompt = `What's the most unexpected discovery or connection about: ${topic}

What do people not know exists? What surprising connection can you reveal?
Explain the mechanism that makes it fascinating.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.9,
      max_tokens: format === 'thread' ? 600 : 100,
      response_format: { type: 'json_object' }
    }, { purpose: 'explorer_content_generation' });

    const parsed = parseAIJson(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'EXPLORER'),
      format,
      confidence: 0.85
    };
    
  } catch (error: any) {
    console.error('[EXPLORER_GEN] Error:', error.message);
    throw new Error(`Explorer generator failed: ${error.message}. System will retry with different approach.`);
  }
}
