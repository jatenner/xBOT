/**
 * 🎯 JUDGE INTERROGATION SYSTEM
 * 
 * 3-Stage interrogation protocol for content quality:
 * Stage 1: Extract specific claims from content
 * Stage 2: Challenge each claim - "Defend this, what's your source?"
 * Stage 3: Evaluate defenses (strong/weak/missing)
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';

export interface InterrogationResult {
  passed: boolean;
  score: number;
  feedback: string[];
  claims: ClaimDefense[];
  defensibilityScore: number;
}

export interface ClaimDefense {
  claim: string;
  defense: string;
  confidence: 'high' | 'medium' | 'low';
  source?: string;
  caveats?: string;
  strong: boolean;
}

export class JudgeInterrogation {
  private static instance: JudgeInterrogation;

  static getInstance(): JudgeInterrogation {
    if (!this.instance) {
      this.instance = new JudgeInterrogation();
    }
    return this.instance;
  }

  /**
   * Main interrogation flow
   */
  async interrogateContent(content: {
    text: string;
    topic: string;
    generator: string;
  }): Promise<InterrogationResult> {
    
    console.log(`[JUDGE_INTERROGATION] 🔍 Interrogating content from ${content.generator}`);
    
    // Stage 1: Extract claims
    const claims = await this.extractClaims(content.text);
    
    if (claims.length === 0) {
      // No specific claims to verify - generic content
      return {
        passed: true,
        score: 75,
        feedback: ['No specific factual claims to verify - general content'],
        claims: [],
        defensibilityScore: 75
      };
    }
    
    console.log(`[JUDGE_INTERROGATION] 📊 Found ${claims.length} claims to challenge`);
    
    // Stage 2: Challenge each claim
    const defenses = await this.challengeClaims(claims, content);
    
    // Stage 3: Evaluate defenses
    const evaluation = this.evaluateDefenses(defenses);
    
    console.log(`[JUDGE_INTERROGATION] ${evaluation.passed ? '✅ PASSED' : '❌ FAILED'} - Score: ${evaluation.score}`);
    
    return evaluation;
  }

  /**
   * Stage 1: Extract specific factual claims from content
   */
  private async extractClaims(text: string): Promise<string[]> {
    try {
      const response = await createBudgetedChatCompletion({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: `Extract all specific factual claims from this health content:

"${text}"

Focus on extracting:
- Specific statistics or percentages
- Research references or study claims
- Biological mechanisms described
- Specific protocols with numbers (dosages, timing, etc.)
- Causal claims ("X causes Y", "X improves Y")

DO NOT extract:
- General statements without specifics
- Obvious facts
- Opinions or recommendations

Return JSON array:
{ "claims": ["claim 1", "claim 2", ...] }

If no specific claims exist, return empty array: { "claims": [] }`
        }],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      }, { purpose: 'claim_extraction' });
      
      const parsed = JSON.parse(response.choices[0].message.content || '{"claims":[]}');
      return parsed.claims || [];
      
    } catch (error: any) {
      console.error(`[JUDGE_INTERROGATION] Claim extraction failed: ${error.message}`);
      return []; // Fail open - no claims means no interrogation needed
    }
  }

  /**
   * Stage 2: Challenge each claim
   */
  private async challengeClaims(
    claims: string[], 
    content: { text: string; topic: string; generator: string }
  ): Promise<ClaimDefense[]> {
    
    const defenses: ClaimDefense[] = [];
    
    // Challenge all claims at once for efficiency
    for (const claim of claims) {
      const defense = await this.challengeSingleClaim(claim, content);
      defenses.push(defense);
    }
    
    return defenses;
  }

  /**
   * Challenge a single claim
   */
  private async challengeSingleClaim(
    claim: string, 
    content: { text: string; topic: string; generator: string }
  ): Promise<ClaimDefense> {
    
    try {
      const response = await createBudgetedChatCompletion({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: `You made this claim in health content:

"${claim}"

DEFEND IT:
1. What's your source? (Specific study, meta-analysis, established mechanism?)
2. How confident are you? (high/medium/low)
3. Any caveats or limitations to this claim?
4. Can you defend this if challenged by a doctor or researcher?

Be intellectually honest. If you don't have a strong source, say so.
If confidence is low, acknowledge it.

Return JSON:
{
  "source": "Specific study/source OR 'I don't have a specific citation'",
  "confidence": "high|medium|low",
  "defense": "Brief explanation of why this claim holds up",
  "caveats": "Any limitations, exceptions, or uncertainties"
}`
        }],
        temperature: 0.5,
        response_format: { type: 'json_object' }
      }, { purpose: 'claim_defense' });
      
      const defense = JSON.parse(response.choices[0].message.content || '{}');
      
      // Evaluate strength
      const hasSource = defense.source && 
                       defense.source.length > 20 && 
                       !defense.source.toLowerCase().includes("don't have");
      
      const isHighConfidence = defense.confidence === 'high';
      
      const strong = hasSource && isHighConfidence && defense.defense && defense.defense.length > 30;
      
      return {
        claim,
        defense: defense.defense || 'No defense provided',
        confidence: defense.confidence || 'low',
        source: defense.source,
        caveats: defense.caveats,
        strong
      };
      
    } catch (error: any) {
      console.error(`[JUDGE_INTERROGATION] Challenge failed for claim: ${error.message}`);
      
      // Failed to get defense = weak claim
      return {
        claim,
        defense: 'Failed to defend',
        confidence: 'low',
        strong: false
      };
    }
  }

  /**
   * Stage 3: Evaluate all defenses
   */
  private evaluateDefenses(defenses: ClaimDefense[]): InterrogationResult {
    
    const totalClaims = defenses.length;
    if (totalClaims === 0) {
      return {
        passed: true,
        score: 80,
        feedback: ['No specific claims to verify'],
        claims: [],
        defensibilityScore: 80
      };
    }
    
    const strongDefenses = defenses.filter(d => d.strong).length;
    const weakDefenses = defenses.filter(d => !d.strong).length;
    const lowConfidence = defenses.filter(d => d.confidence === 'low').length;
    
    // Scoring
    let score = 100;
    const feedback: string[] = [];
    
    // Penalize weak defenses
    if (weakDefenses > 0) {
      const penalty = Math.min(weakDefenses * 15, 50); // Max 50 point penalty
      score -= penalty;
      feedback.push(`${weakDefenses}/${totalClaims} claims poorly defended`);
    }
    
    // Penalize low confidence
    if (lowConfidence > 0) {
      const penalty = Math.min(lowConfidence * 10, 30); // Max 30 point penalty
      score -= penalty;
      feedback.push(`${lowConfidence}/${totalClaims} low-confidence claims`);
    }
    
    // Reward strong defenses
    if (strongDefenses === totalClaims) {
      feedback.push(`All ${totalClaims} claims well-defended`);
    } else if (strongDefenses > 0) {
      feedback.push(`${strongDefenses}/${totalClaims} claims strongly defended`);
    }
    
    // Add specific weak claim feedback
    const veryWeak = defenses.filter(d => !d.source || d.confidence === 'low');
    if (veryWeak.length > 0 && veryWeak.length <= 3) {
      veryWeak.forEach(d => {
        feedback.push(`Weak: "${d.claim.substring(0, 60)}..."`);
      });
    }
    
    const passed = score >= 70; // 70% threshold
    const defensibilityScore = score;
    
    return {
      passed,
      score: Math.max(0, Math.min(100, score)),
      feedback,
      claims: defenses,
      defensibilityScore
    };
  }

  /**
   * Get summary of interrogation for logging
   */
  getSummary(result: InterrogationResult): string {
    const { passed, score, claims, feedback } = result;
    
    return `
🎯 INTERROGATION SUMMARY:
   Score: ${score}/100 ${passed ? '✅ PASSED' : '❌ FAILED'}
   Claims checked: ${claims.length}
   Strong defenses: ${claims.filter(c => c.strong).length}
   Weak defenses: ${claims.filter(c => !c.strong).length}
   Feedback: ${feedback.join('; ')}
`.trim();
  }
}

/**
 * Export singleton
 */
export const judgeInterrogation = JudgeInterrogation.getInstance();

