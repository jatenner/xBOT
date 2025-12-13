/**
 * 🛡️ MEDICAL SAFETY GUARD
 * 
 * Analyzes candidate content for risky health claims and ensures safe, evidence-based communication
 * 
 * Safety Checks:
 * - Risky claims (cures, guarantees, absolute statements)
 * - Dangerous dosage instructions
 * - Unsubstantiated medical advice
 * - Promises of specific outcomes
 * 
 * Actions:
 * - If risky: Ask AI to rewrite with safer language + disclaimers
 * - Retry up to N times
 * - If still unsafe: discard and log to system_events
 * 
 * Phase 2.2: Content Enhancements
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { getSupabaseClient } from '../db';
import { log } from '../lib/logger';

export interface SafetyCheckResult {
  isSafe: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  issues: string[];
  suggestions: string[];
  rewrittenContent?: string;
}

export interface MedicalSafetyConfig {
  maxRetries?: number;
  strictMode?: boolean; // If true, reject more content
  requireDisclaimers?: boolean; // If true, always add disclaimers
}

/**
 * Analyze content for medical safety issues
 */
export async function analyzeMedicalSafety(
  content: string,
  config?: MedicalSafetyConfig
): Promise<SafetyCheckResult> {
  const {
    maxRetries = 3,
    strictMode = false,
    requireDisclaimers = true
  } = config || {};

  try {
    // Step 1: Initial safety check
    const initialCheck = await performSafetyCheck(content, strictMode);
    
    if (initialCheck.isSafe && initialCheck.riskLevel === 'low') {
      // Content is safe, optionally add disclaimer if required
      if (requireDisclaimers && !hasDisclaimer(content)) {
        const withDisclaimer = addDisclaimer(content);
        return {
          ...initialCheck,
          rewrittenContent: Array.isArray(withDisclaimer) ? withDisclaimer.join('\n\n--- THREAD BREAK ---\n\n') : withDisclaimer
        };
      }
      return initialCheck;
    }

    // Step 2: Content has issues - attempt to rewrite
    if (initialCheck.riskLevel === 'critical') {
      // Critical issues - reject immediately
      await logSafetyIssue(content, initialCheck, 'critical_rejection');
      return initialCheck;
    }

    // Step 3: Attempt to rewrite (up to maxRetries)
    let rewritten = content;
    let attempts = 0;
    let lastResult = initialCheck;

    while (attempts < maxRetries && !lastResult.isSafe) {
      attempts++;
      console.log(`[MEDICAL_SAFETY] 🔄 Rewrite attempt ${attempts}/${maxRetries}...`);

      rewritten = await rewriteForSafety(rewritten, lastResult.issues, lastResult.suggestions);
      lastResult = await performSafetyCheck(rewritten, strictMode);

      if (lastResult.isSafe) {
        console.log(`[MEDICAL_SAFETY] ✅ Content made safe after ${attempts} rewrite(s)`);
        
        // Ensure disclaimer is present
        if (requireDisclaimers && !hasDisclaimer(rewritten)) {
          const withDisclaimer = addDisclaimer(rewritten);
          rewritten = Array.isArray(withDisclaimer) ? withDisclaimer.join('\n\n--- THREAD BREAK ---\n\n') : withDisclaimer;
        }

        return {
          ...lastResult,
          rewrittenContent: rewritten
        };
      }
    }

    // Step 4: Failed to make safe after retries
    console.warn(`[MEDICAL_SAFETY] ⚠️ Content still unsafe after ${attempts} rewrite attempts`);
    await logSafetyIssue(content, lastResult, 'rewrite_failed');

    // If risk is medium or high (not critical), we might still allow with warnings
    if (lastResult.riskLevel === 'medium' && !strictMode) {
      // Medium risk in non-strict mode: allow but log
      if (requireDisclaimers && !hasDisclaimer(rewritten)) {
        const withDisclaimer = addDisclaimer(rewritten);
        rewritten = Array.isArray(withDisclaimer) ? withDisclaimer.join('\n\n--- THREAD BREAK ---\n\n') : withDisclaimer;
      }
      return {
        ...lastResult,
        rewrittenContent: rewritten,
        isSafe: true // Override: allow medium risk in non-strict mode
      };
    }

    // High or critical risk: reject
    return lastResult;

  } catch (error: any) {
    console.error(`[MEDICAL_SAFETY] ❌ Safety check failed: ${error.message}`);
    
    // On error, be conservative: reject if we can't verify safety
    return {
      isSafe: false,
      riskLevel: 'high',
      issues: ['Safety check failed - unable to verify content safety'],
      suggestions: ['Review content manually']
    };
  }
}

/**
 * Perform initial safety check using AI
 */
async function performSafetyCheck(
  content: string,
  strictMode: boolean
): Promise<SafetyCheckResult> {
  const systemPrompt = `You are a medical content safety reviewer for a health & wellness Twitter account.

Your job is to identify potentially dangerous or misleading health claims in content.

RISKY PATTERNS TO FLAG:
1. **Absolute claims**: "cures", "guarantees", "always works", "100% effective"
2. **Dangerous dosages**: Specific high-dose recommendations without context
3. **Medical advice**: "You should", "You must", "Do this to treat X"
4. **Unsubstantiated claims**: Strong health claims without evidence indicators
5. **Promises**: "This will make you", "You'll get X result"
6. **Contradicts medical consensus**: Claims that contradict established medical knowledge

SAFE PATTERNS:
- "Research suggests", "Studies show", "May help", "Could support"
- General information without prescriptive advice
- Evidence-based statements with qualifiers
- Educational content that doesn't promise outcomes

RISK LEVELS:
- **low**: Content is safe, evidence-based, appropriately qualified
- **medium**: Some concerning language but not dangerous
- **high**: Contains risky claims that could mislead or harm
- **critical**: Contains dangerous medical advice or absolute guarantees

${strictMode ? 'STRICT MODE: Be more conservative, flag more content as risky.' : 'NORMAL MODE: Only flag clearly risky content.'}

Return your analysis as JSON:
{
  "isSafe": boolean,
  "riskLevel": "low" | "medium" | "high" | "critical",
  "issues": ["list of specific issues found"],
  "suggestions": ["how to make content safer"]
}`;

  const userPrompt = `Analyze this health content for safety:

"${content}"

Return JSON analysis only.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3, // Lower temperature for more consistent safety checks
      response_format: { type: 'json_object' }
    }, {
      purpose: 'medical_safety_check'
    });

    const result = JSON.parse(response.choices[0]?.message?.content || '{}');
    
    return {
      isSafe: result.isSafe === true || result.riskLevel === 'low',
      riskLevel: result.riskLevel || 'medium',
      issues: Array.isArray(result.issues) ? result.issues : [],
      suggestions: Array.isArray(result.suggestions) ? result.suggestions : []
    };

  } catch (error: any) {
    console.error(`[MEDICAL_SAFETY] ❌ Safety check API error: ${error.message}`);
    throw error;
  }
}

/**
 * Rewrite content to address safety issues
 */
async function rewriteForSafety(
  content: string,
  issues: string[],
  suggestions: string[]
): Promise<string> {
  const systemPrompt = `You are a medical content editor specializing in safe, evidence-based health communication.

Your task is to rewrite health content to:
1. Remove risky claims (cures, guarantees, absolute statements)
2. Add appropriate qualifiers ("may", "research suggests", "could")
3. Include evidence indicators ("studies show", "research indicates")
4. Remove prescriptive medical advice
5. Add disclaimers when appropriate ("Not medical advice", "Consult healthcare provider")
6. Maintain the core message and value of the content

Keep the content engaging and informative, but make it safe and evidence-based.`;

  const userPrompt = `Rewrite this health content to address safety concerns:

ORIGINAL CONTENT:
"${content}"

ISSUES IDENTIFIED:
${issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

SUGGESTIONS:
${suggestions.map((suggestion, i) => `${i + 1}. ${suggestion}`).join('\n')}

Rewrite the content to be safe while maintaining its core message. Return ONLY the rewritten content, no explanations.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.5
    }, {
      purpose: 'medical_safety_rewrite'
    });

    return response.choices[0]?.message?.content?.trim() || content;

  } catch (error: any) {
    console.error(`[MEDICAL_SAFETY] ❌ Rewrite API error: ${error.message}`);
    return content; // Return original if rewrite fails
  }
}

/**
 * Check if content already has a disclaimer
 */
function hasDisclaimer(content: string): boolean {
  const disclaimerPatterns = [
    /not medical advice/i,
    /consult.*healthcare/i,
    /talk to.*doctor/i,
    /not a substitute/i,
    /disclaimer/i
  ];

  return disclaimerPatterns.some(pattern => pattern.test(content));
}

/**
 * Add a standard disclaimer to content
 */
function addDisclaimer(content: string | string[]): string | string[] {
  // Add disclaimer at the end (if it fits in character limit)
  const disclaimer = '\n\n(Not medical advice. Consult healthcare provider.)';
  
  // For threads, add to last tweet
  if (Array.isArray(content)) {
    const lastTweet = content[content.length - 1];
    if (lastTweet.length + disclaimer.length <= 280) {
      return [
        ...content.slice(0, -1),
        lastTweet + disclaimer
      ];
    }
    return content; // Can't fit disclaimer
  }

  // For single tweets
  if (content.length + disclaimer.length <= 280) {
    return content + disclaimer;
  }

  // Can't fit disclaimer - return original
  return content;
}

/**
 * Log safety issues to system_events
 */
async function logSafetyIssue(
  content: string,
  result: SafetyCheckResult,
  reason: string
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase.from('system_events').insert({
      event_type: 'medical_safety_check',
      severity: result.riskLevel === 'critical' ? 'error' : 'warning',
      event_data: {
        reason,
        risk_level: result.riskLevel,
        issues: result.issues,
        suggestions: result.suggestions,
        content_preview: content.substring(0, 200) // First 200 chars only
      },
      created_at: new Date().toISOString()
    });

    log({
      op: 'medical_safety_issue',
      risk_level: result.riskLevel,
      reason,
      issues_count: result.issues.length
    });

  } catch (error: any) {
    console.warn(`[MEDICAL_SAFETY] ⚠️ Failed to log safety issue: ${error.message}`);
    // Non-critical - continue
  }
}

/**
 * Quick check for obvious safety issues (fast, no AI call)
 */
export function quickSafetyCheck(content: string): {
  hasObviousIssues: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check for absolute claims
  const absolutePatterns = [
    /\bcures?\b/i,
    /\bguarantees?\b/i,
    /\balways works\b/i,
    /\b100% (effective|works|guaranteed)\b/i,
    /\bnever\b.*\b(problem|issue|disease)\b/i
  ];

  for (const pattern of absolutePatterns) {
    if (pattern.test(content)) {
      issues.push('Contains absolute claim');
      break;
    }
  }

  // Check for dangerous dosage patterns
  const dosagePatterns = [
    /\b(take|use|dose).*\b\d+\s*(mg|g|grams?|milligrams?)\b/i,
    /\b\d+\s*(mg|g|grams?|milligrams?).*\b(daily|per day|every day)\b/i
  ];

  for (const pattern of dosagePatterns) {
    if (pattern.test(content)) {
      issues.push('Contains specific dosage instructions');
      break;
    }
  }

  // Check for prescriptive medical advice
  const prescriptivePatterns = [
    /\byou (should|must|need to|have to)\b.*\b(treat|cure|fix|heal)\b/i,
    /\b(this|it) (will|can) (cure|treat|fix|heal)\b/i
  ];

  for (const pattern of prescriptivePatterns) {
    if (pattern.test(content)) {
      issues.push('Contains prescriptive medical advice');
      break;
    }
  }

  return {
    hasObviousIssues: issues.length > 0,
    issues
  };
}

