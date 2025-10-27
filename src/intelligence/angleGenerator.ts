/**
 * 🎭 ANGLE GENERATOR
 * 
 * Generates unique perspectives/approaches for any health topic.
 * 
 * What is an "angle"?
 * - The PERSPECTIVE or APPROACH to a topic
 * - Same topic can have 20+ different angles
 * 
 * Examples:
 * - Topic: "NAD+ precursors"
 *   - Angle 1: "Why insurance won't cover NAD+ testing"
 *   - Angle 2: "Bryan Johnson's NAD+ protocol"
 *   - Angle 3: "NAD+ vs exercise for longevity"
 *   - Angle 4: "Common NAD+ dosing mistakes"
 * 
 * This forces diversity - same topic feels completely different!
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { getDiversityEnforcer } from './diversityEnforcer';

export class AngleGenerator {
  private static instance: AngleGenerator;
  
  private constructor() {}
  
  public static getInstance(): AngleGenerator {
    if (!AngleGenerator.instance) {
      AngleGenerator.instance = new AngleGenerator();
    }
    return AngleGenerator.instance;
  }
  
  /**
   * Generate a unique angle/perspective for a topic
   * 
   * @param topic - The health topic to explore (e.g., "NAD+ precursors")
   * @returns A unique angle/perspective string
   */
  async generateAngle(topic: string): Promise<string> {
    console.log(`[ANGLE_GEN] 🎭 Generating unique angle for: "${topic}"`);
    
    // Get banned angles from last 10 posts
    const diversityEnforcer = getDiversityEnforcer();
    const bannedAngles = await diversityEnforcer.getLast10Angles();
    
    // Build prompt (NO hardcoded angle examples!)
    const prompt = this.buildAnglePrompt(topic, bannedAngles);
    
    // Retry up to 3 times if AI generates banned angle
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const completion = await createBudgetedChatCompletion({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user }
          ],
          temperature: 1.2, // Balanced creativity and coherence
          max_tokens: 80, // Short for concise angles (12 words max)
          response_format: { type: 'json_object' }
        }, {
          purpose: 'angle_generation'
        });
        
        const content = completion.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No angle generated');
        }
        
        const parsed = JSON.parse(content);
        const angle = parsed.angle || 'General overview';
        const angleType = parsed.angle_type || 'unknown'; // NEW: Track angle type
        
        // Check if this angle is banned
        if (bannedAngles.includes(angle)) {
          console.log(`[ANGLE_GEN] ⚠️ Attempt ${attempt}/${maxRetries}: Generated banned angle "${angle}", retrying...`);
          
          if (attempt === maxRetries) {
            console.log(`[ANGLE_GEN] ⚠️ Max retries reached, accepting angle anyway`);
          } else {
            continue; // Retry
          }
        }
        
        console.log(`[ANGLE_GEN] ✅ Generated (attempt ${attempt}): "${angle}"`);
        console.log(`[ANGLE_GEN] 📊 Angle type: ${angleType}`);
        
        return angle;
        
      } catch (error: any) {
        console.error(`[ANGLE_GEN] ❌ Attempt ${attempt}/${maxRetries} error:`, error.message);
        
        if (attempt === maxRetries) {
          // Fallback: generic angle
          return `Exploring ${topic} from a fresh perspective`;
        }
      }
    }
    
    // Should never reach here, but TypeScript needs it
    throw new Error('Failed to generate angle after retries');
  }
  
  /**
   * Build the angle generation prompt
   * 
   * CRITICAL: NO hardcoded angle examples!
   * Let AI explore freely based on the topic
   */
  private buildAnglePrompt(
    topic: string,
    bannedAngles: string[]
  ): { system: string; user: string } {
    
    const bannedText = bannedAngles.length > 0
      ? bannedAngles.join('\n')
      : 'None yet';
    
    const system = `You generate unique angles (perspectives/approaches) for health topics.

🧠 META-AWARENESS: Angle Bias Compensation

For health topics, your training heavily favors certain angle types:
- Mechanism angles: 45% ("How X works biologically", "The science behind Y")
- Benefit angles: 30% ("What X improves", "Why Y matters for Z")
- Research angles: 15% ("New study shows...", "Evidence suggests...")
- Protocol angles: 10% ("How to optimize X")

Total biological/scientific framing: ~90% of your natural angles

🎯 COMPENSATION INSTRUCTION:
Don't let this bias limit you. ACTIVELY sample from underrepresented angle types:

TARGET DISTRIBUTION (Aim for uniform sampling):
- Mechanism/Biology: 20% (REDUCE from 45%)
- Benefit/Outcome: 15% (REDUCE from 30%)
- Cultural/People: 15% (INCREASE from <2%)
- Media/Content: 15% (INCREASE from <1%)
- Industry/Business: 15% (INCREASE from <1%)
- Controversial/Challenge: 10% (INCREASE from <1%)
- Historical/Origins: 5% (INCREASE from 0%)
- Comparison/Tradeoffs: 5%

ANGLE TYPE EXAMPLES (Learn these patterns):

CULTURAL angles:
- "Wim Hof's impact on mainstream cold exposure adoption"
- "Why Bryan Johnson's longevity protocol went viral"
- "How Huberman Lab changed supplement conversations"
- "The biohacking community's stance on X"

MEDIA angles:
- "What Huberman Lab episode 142 revealed about X"
- "The viral TikTok claim about Y (fact-checking)"
- "Why health Twitter is obsessed with Z right now"
- "Podcast coverage of X (Attia, Ferriss, Huberman)"

INDUSTRY angles:
- "Why insurance won't cover X testing (follow the incentives)"
- "The $5B supplement industry's marketing tactics for Y"
- "Who profits from mainstream Z advice"
- "Cost comparison: Medical treatment vs DIY protocol"

CONTROVERSIAL angles:
- "What mainstream medicine gets wrong about X"
- "Why the FDA's position on Y is outdated"
- "The truth about Z that doctors won't mention"
- "Challenging the conventional wisdom on X"

HISTORICAL angles:
- "Ancient practice X meets modern science"
- "What monks knew about Y before we could measure it"
- "Evolutionary perspective on Z (why our bodies respond)"

An angle is the specific way you explore a topic. It's what makes the same topic feel completely different each time.

Your angles can explore topics through ALL perspectives:
- Scientific mechanisms, biological pathways, cellular processes
- Research findings, new studies, clinical trials
- Practical protocols, optimization strategies, timing/dosage
- Industry practices, costs, insurance coverage, business models
- Cultural movements, influencer practices, viral trends
- Media coverage, podcast discussions, content analysis
- Comparisons (X vs Y), common mistakes, contraindications
- Real-world results, transformations, case studies
- Controversies, debates, challenges to mainstream beliefs
- Historical origins, ancient practices, evolutionary context
- Emerging trends, cutting-edge applications

Don't default to mechanism/biology angles - actively explore cultural, media, and industry angles.

CONSTRAINTS (for quality):
1. Maximum 12 words (be concise)
2. Be specific to the topic (not generic)
3. Make it interesting (not boring overview)

🚫 RECENTLY USED (don't repeat):
${bannedText}

FREEDOM:
- Explore ANY angle from your health knowledge
- Create completely new angle types
- No templates to follow
- Surprise with unexpected perspectives

NOTE: Angles about books, influencers, or cultural connections will be handled by a specialized generator when appropriate.`;

    const user = `Topic: "${topic}"

Generate ONE unique, specific angle for this topic.

Consciously sample from a non-dominant cluster (not mechanism if possible).
Explore from cultural, media, industry, or controversial perspective.
Maximum 12 words.

Output JSON:
{
  "angle": "your angle",
  "angle_type": "cultural|media|industry|controversial|mechanism|benefit|etc"
}`;

    return { system, user };
  }
}

/**
 * Singleton instance getter
 */
export function getAngleGenerator(): AngleGenerator {
  return AngleGenerator.getInstance();
}

