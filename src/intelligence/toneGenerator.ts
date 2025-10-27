/**
 * 🎤 TONE GENERATOR
 * 
 * Generates unique voice/style/tone for health content.
 * 
 * What is "tone"?
 * - The VOICE, STYLE, and EMOTIONAL CHARACTER of how content is written
 * - Includes: formality, emotion, energy, approach
 * 
 * Examples:
 * - "Skeptical investigative with industry critique"
 * - "Casual conversational like talking to a friend"
 * - "Direct prescriptive coach-like"
 * - "Story-driven narrative with personal anecdotes"
 * - "Technical precise with exact numbers"
 * - "Provocative controversial challenging mainstream"
 * 
 * This forces variety - same topic + angle feels different with different tone!
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { getDiversityEnforcer } from './diversityEnforcer';

export class ToneGenerator {
  private static instance: ToneGenerator;
  
  private constructor() {}
  
  public static getInstance(): ToneGenerator {
    if (!ToneGenerator.instance) {
      ToneGenerator.instance = new ToneGenerator();
    }
    return ToneGenerator.instance;
  }
  
  /**
   * Generate a unique tone/voice/style for content
   * 
   * @returns A unique tone description string
   */
  async generateTone(): Promise<string> {
    console.log(`[TONE_GEN] 🎤 Generating unique tone/voice/style...`);
    
    // Get banned tones from last 10 posts
    const diversityEnforcer = getDiversityEnforcer();
    const bannedTones = await diversityEnforcer.getLast10Tones();
    
    // Build prompt (NO hardcoded tone examples!)
    const prompt = this.buildTonePrompt(bannedTones);
    
    // Retry up to 3 times if AI generates banned tone
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
          max_tokens: 60, // Short for concise tones (8 words max)
          response_format: { type: 'json_object' }
        }, {
          purpose: 'tone_generation'
        });
        
        const content = completion.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No tone generated');
        }
        
        const parsed = JSON.parse(content);
        const tone = parsed.tone || 'Professional informative';
        const isSingular = parsed.is_singular !== false; // NEW: Track if singular
        const toneCluster = parsed.tone_cluster || 'neutral'; // NEW: Track cluster
        
        // Check if this tone is banned
        if (bannedTones.includes(tone)) {
          console.log(`[TONE_GEN] ⚠️ Attempt ${attempt}/${maxRetries}: Generated banned tone "${tone}", retrying...`);
          
          if (attempt === maxRetries) {
            console.log(`[TONE_GEN] ⚠️ Max retries reached, accepting tone anyway`);
          } else {
            continue; // Retry
          }
        }
        
        console.log(`[TONE_GEN] ✅ Generated (attempt ${attempt}): "${tone}"`);
        console.log(`[TONE_GEN] 📊 Singular: ${isSingular}, Cluster: ${toneCluster}`);
        
        return tone;
        
      } catch (error: any) {
        console.error(`[TONE_GEN] ❌ Attempt ${attempt}/${maxRetries} error:`, error.message);
        
        if (attempt === maxRetries) {
          // Fallback: neutral tone
          return 'Clear and informative';
        }
      }
    }
    
    // Should never reach here, but TypeScript needs it
    throw new Error('Failed to generate tone after retries');
  }
  
  /**
   * Build the tone generation prompt
   * 
   * CRITICAL: NO hardcoded tone examples!
   * Let AI explore the full spectrum of tones/voices
   */
  private buildTonePrompt(bannedTones: string[]): { system: string; user: string } {
    
    const bannedText = bannedTones.length > 0
      ? bannedTones.join('\n')
      : 'None yet';
    
    const system = `You generate unique tones (voice/style) for health content.

🧠 META-AWARENESS: Tone Bias Compensation

Your training defaults for health content:
- Helpful/educational tones: 40% ("Informative", "Educational", "Supportive")
- Balanced/measured tones: 30% ("Thoughtful", "Analytical", "Balanced")
- Compound descriptor tones: 60% ("Witty yet thoughtful", "Bold but measured")

These compound tones are SAFETY HEDGES - mixing bold with safe to stay moderate.

🎯 COMPENSATION INSTRUCTION:

1. PREFER SINGULAR OVER COMPOUND (70% of time):
   COMPOUND (hedging): "Witty yet thoughtful" ← Contradictory, safe middle
   SINGULAR (committed): "Witty" ← Clear, committed, distinct
   
   COMPOUND (hedging): "Provocative with empathy" ← Neut

ralizing
   SINGULAR (committed): "Provocative" ← Bold choice
   
   Use compounds ONLY when truly needed (30%), default to singular.

2. SAMPLE FROM FULL SPECTRUM (not just helpful middle):
   
   BOLD/AGGRESSIVE (20% target):
   - Provocative, Irreverent, Combative, Urgent, Direct, Blunt
   
   NEUTRAL/FACTUAL (20% target):
   - Deadpan, Clinical, Detached, Analytical, Matter-of-fact
   
   WARM/SUPPORTIVE (20% target):
   - Empathetic, Encouraging, Compassionate, Nurturing
   
   PLAYFUL/LIGHT (20% target):
   - Witty, Sarcastic, Humorous, Cheeky, Lighthearted
   
   THOUGHTFUL/DEEP (20% target):
   - Contemplative, Philosophical, Curious, Reflective

3. COMMIT TO TONE FULLY:
   If you pick "Provocative" - BE provocative
   If you pick "Deadpan" - BE deadpan
   Don't hedge with "Provocative yet balanced"

A tone is the emotional character and delivery style of writing.

Your tones come from the FULL spectrum of:
- Formality levels (casual to academic)
- Emotional qualities (skeptical to enthusiastic)
- Energy levels (calm to urgent)
- Delivery styles (storytelling to prescriptive)
- Perspectives (supportive to critical)

But AVOID compound hedging. Commit to singular tones.

CONSTRAINTS (for quality):
1. Maximum 8 words (be concise)
2. Be descriptive (paint a clear voice)
3. Be specific (not just "casual" or "formal")

🚫 RECENTLY USED (don't repeat):
${bannedText}

FREEDOM:
- Create ANY tone combination
- Mix qualities in unexpected ways
- No templates to follow
- Explore the full spectrum`;

    const user = `Generate ONE unique tone for health content.

PREFER singular committed tones over compound hedged tones (70% of time).
If you use compound, must be genuinely complementary (not contradictory).

Sample from full spectrum - don't default to helpful/balanced middle.
Be descriptive and creative.
Maximum 8 words.

Output JSON:
{
  "tone": "your tone",
  "is_singular": true/false,
  "tone_cluster": "bold|neutral|warm|playful|thoughtful"
}`;

    return { system, user };
  }
}

/**
 * Singleton instance getter
 */
export function getToneGenerator(): ToneGenerator {
  return ToneGenerator.getInstance();
}

