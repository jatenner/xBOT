/**
 * 🔍 EXPLORATION MODE INTEGRATION
 * Central system to enhance all content generation with exploration mode
 * Avoids need to modify 10+ individual generator files
 */

import { getCurrentMode, getModeStatus } from '../exploration/explorationModeManager';
import { getVarietyRecommendation } from '../exploration/coldStartOptimizer';

export interface ExplorationEnhancedPrompt {
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  controversyLevel: number;
  forceUnique: boolean;
}

/**
 * Enhance any content generation prompt with exploration mode settings
 */
export async function enhancePromptForExploration(
  baseSystemPrompt: string,
  baseUserPrompt: string,
  topic: string
): Promise<ExplorationEnhancedPrompt> {
  const mode = await getCurrentMode();
  
  if (mode === 'exploration') {
    // Get variety recommendation
    const recommendation = await getVarietyRecommendation();
    
    // Enhanced system prompt for exploration
    const explorationSystemPrompt = `${baseSystemPrompt}

⚡ EXPLORATION MODE ACTIVE - High Variance Content Required

CRITICAL RULES FOR THIS MODE:
1. NO first-person language (never use "I", "me", "my", "I've", "my friend")
2. ALWAYS use third-person: "Researchers found...", "Patients who...", "Studies show..."
3. Tell TRUE stories about OTHER PEOPLE (doctors, patients, scientists)
4. Take CONTROVERSIAL positions (controversy level: ${recommendation.controversyLevel}/10)
5. Challenge mainstream advice and common assumptions
6. Include SHOCKING statistics or lesser-known research
7. Make content that starts debates and gets reactions
8. Be SPECIFIC: Name institutions (Mayo, Stanford, Harvard), cite actual studies
9. Vary format wildly: sometimes threads, sometimes one-liners, sometimes questions

GOAL: Find what gets engagement. Try extreme positions. Stand out. Be memorable.`;

    // Enhanced user prompt
    const explorationUserPrompt = `${baseUserPrompt}

EXPLORATION INSTRUCTIONS:
- Controversy target: ${recommendation.controversyLevel}/10
- Make this ${recommendation.recommendedType.replace(/_/g, ' ')} content
- ${recommendation.reason}
- Be BOLD and DIFFERENT from typical health content
- Include a surprising fact or contrarian take
- Third-person ONLY (tell stories about others)

Generate content that gets attention and reactions:`;

    return {
      systemPrompt: explorationSystemPrompt,
      userPrompt: explorationUserPrompt,
      temperature: 0.9, // Higher temperature for more variance
      controversyLevel: recommendation.controversyLevel,
      forceUnique: recommendation.shouldForceNew
    };
    
  } else {
    // Exploitation mode - normal sophisticated content
    return {
      systemPrompt: baseSystemPrompt + `\n\nIMPORTANT: NEVER use first-person language. Always use third-person: "Researchers found...", "Studies show...", "Doctors recommend..."`,
      userPrompt: baseUserPrompt,
      temperature: 0.7, // Normal temperature
      controversyLevel: 5,
      forceUnique: false
    };
  }
}

/**
 * Log content generation with exploration metadata
 */
export async function logExplorationGeneration(
  contentType: string,
  content: string,
  controversyLevel: number
): Promise<void> {
  const mode = await getCurrentMode();
  console.log(`[EXPLORATION] 📝 Generated ${contentType} in ${mode} mode (controversy: ${controversyLevel}/10)`);
  console.log(`[EXPLORATION] 📏 Content length: ${content.length} chars`);
  
  // Validate third-person
  const firstPersonPatterns = /\b(I|me|my|I'm|I've|mine|myself)\b/gi;
  const violations = content.match(firstPersonPatterns);
  if (violations && violations.length > 0) {
    console.warn(`[EXPLORATION] ⚠️ First-person violations detected: ${violations.join(', ')}`);
  }
}

/**
 * Get system-wide exploration status for monitoring
 */
export async function getExplorationStatus(): Promise<{
  mode: string;
  reason: string;
  nextAction: string;
}> {
  const status = await getModeStatus();
  const recommendation = await getVarietyRecommendation();
  
  return {
    mode: status.mode,
    reason: status.reason,
    nextAction: `Try ${recommendation.recommendedType} at controversy level ${recommendation.controversyLevel}`
  };
}

