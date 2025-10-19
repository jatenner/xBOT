/**
 * CONTENT AUTO-IMPROVER
 * Automatically improves content that fails quality gates
 * Uses validation feedback to generate better versions
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { getContentGenerationModel } from '../config/modelConfig';
import { validateContent, generateImprovementPrompt, ValidationResult } from './preQualityValidator';

export interface ImprovementResult {
  improved: boolean;
  content: string | string[];
  originalScore: number;
  newScore: number;
  attempts: number;
}

/**
 * Auto-improve content using AI
 * Max 2 attempts to avoid infinite loops
 */
export async function improveContent(
  originalContent: string | string[],
  validation: ValidationResult,
  context?: { topic?: string; format?: 'single' | 'thread' }
): Promise<ImprovementResult> {
  
  console.log(`[AUTO_IMPROVER] 🔧 Attempting to improve content (current score: ${validation.score}/100)`);
  
  const maxAttempts = 2;
  let attempts = 0;
  let bestContent = originalContent;
  let bestScore = validation.score;

  while (attempts < maxAttempts) {
    attempts++;
    
    try {
      const improvementPrompt = generateImprovementPrompt(originalContent, validation);
      
      const systemPrompt = `You are a content quality specialist. Your job is to fix quality issues while maintaining the core insight.

CRITICAL REQUIREMENTS:
• NEVER use personal pronouns (I, me, my, we, us, our)
• Use expert third-person voice ONLY
• Include 2+ specific numbers/percentages
• Cite institutions + years (Stanford 2022, Harvard 2023)
• Explain mechanisms (HOW/WHY it works)
• Max 270 characters per tweet
• Start with surprising statistic or claim

${context?.format === 'thread' ? `
OUTPUT FORMAT (thread):
Return JSON: {"tweets": ["tweet1", "tweet2", "tweet3"]}
Each tweet 150-250 chars.
` : `
OUTPUT FORMAT (single):
Return JSON: {"tweet": "..."}
Max 270 characters.
`}`;

      const response = await createBudgetedChatCompletion({
        model: getContentGenerationModel(),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: improvementPrompt }
        ],
        temperature: 0.7,
        max_tokens: 500
      }, {
        purpose: 'content_auto_improver - Improve low-quality content',
        priority: 'medium'
      });

      const rawContent = response.choices[0]?.message?.content?.trim();
      if (!rawContent) {
        console.log(`[AUTO_IMPROVER] ⚠️ No content returned on attempt ${attempts}`);
        continue;
      }

      // Parse JSON response
      let improvedContent: string | string[];
      try {
        const parsed = JSON.parse(rawContent);
        improvedContent = parsed.tweets || parsed.tweet || rawContent;
      } catch {
        // Not JSON, use raw content
        improvedContent = rawContent;
      }

      // Validate improved content
      const newValidation = validateContent(improvedContent);
      
      console.log(`[AUTO_IMPROVER] 📊 Attempt ${attempts}: ${validation.score} → ${newValidation.score}`);

      if (newValidation.score > bestScore) {
        bestContent = improvedContent;
        bestScore = newValidation.score;
      }

      // If we hit passing threshold, stop
      if (newValidation.passes) {
        console.log(`[AUTO_IMPROVER] ✅ Improved to passing score: ${newValidation.score}/100`);
        return {
          improved: true,
          content: improvedContent,
          originalScore: validation.score,
          newScore: newValidation.score,
          attempts
        };
      }

    } catch (error: any) {
      console.error(`[AUTO_IMPROVER] ❌ Attempt ${attempts} failed:`, error.message);
    }
  }

  // Return best attempt, even if not passing
  const improved = bestScore > validation.score;
  console.log(`[AUTO_IMPROVER] ${improved ? '📈' : '⚠️'} Best score: ${bestScore}/100 (${improved ? 'improved' : 'no improvement'})`);
  
  return {
    improved,
    content: bestContent,
    originalScore: validation.score,
    newScore: bestScore,
    attempts
  };
}

/**
 * Wrapper to validate and auto-improve if needed
 * Returns content that passes validation or best attempt
 */
export async function validateAndImprove(
  content: string | string[],
  context?: { topic?: string; format?: 'single' | 'thread' }
): Promise<{
  content: string | string[];
  passed: boolean;
  score: number;
  wasImproved: boolean;
}> {
  
  // Initial validation
  const validation = validateContent(content);
  
  if (validation.passes) {
    console.log(`[AUTO_IMPROVER] ✅ Content passes validation (${validation.score}/100)`);
    return {
      content,
      passed: true,
      score: validation.score,
      wasImproved: false
    };
  }

  console.log(`[AUTO_IMPROVER] ⚠️ Content fails validation (${validation.score}/100) - attempting auto-improvement`);
  
  // Try to improve
  const improvement = await improveContent(content, validation, context);
  
  // Re-validate improved content
  const finalValidation = validateContent(improvement.content);
  
  return {
    content: improvement.content,
    passed: finalValidation.passes,
    score: finalValidation.score,
    wasImproved: improvement.improved
  };
}

/**
 * Track successful patterns for learning
 */
export async function trackSuccessfulPattern(
  content: string | string[],
  generator: string,
  score: number
) {
  // This could store to database for future learning
  // For now, just log
  console.log(`[AUTO_IMPROVER] 📝 Tracking successful pattern: ${generator} scored ${score}/100`);
  
  // TODO: Store in database for pattern learning
  // await supabase.from('successful_patterns').insert({
  //   generator,
  //   content: Array.isArray(content) ? content[0] : content,
  //   quality_score: score,
  //   created_at: new Date()
  // });
}

