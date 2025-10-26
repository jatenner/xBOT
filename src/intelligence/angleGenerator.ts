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

An angle is the specific way you explore a topic. It's what makes the same topic feel completely different each time.

Your angles can explore topics through:
- Scientific mechanisms, biological pathways, cellular processes
- Research findings, new studies, clinical trials
- Practical protocols, optimization strategies, timing/dosage
- Industry practices, costs, insurance coverage, business models
- Comparisons (X vs Y), common mistakes, contraindications
- Real-world results, transformations, case studies
- Controversies, debates, challenges to mainstream beliefs
- Emerging trends, cutting-edge applications

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

Explore it from an interesting perspective.
Maximum 12 words.

Output JSON:
{
  "angle": "your angle"
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

