/**
 * 📋 CONTENT POLICY ENFORCEMENT
 * 
 * Enforces strict content policies before posting:
 * - No first-person language
 * - Evidence citations required
 * - No medical advice
 * - Educational framing only
 */

export interface PolicyCheck {
  name: string;
  passed: boolean;
  score?: number;
  details?: string;
}

export interface PolicyResult {
  approved: boolean;
  overall_score: number;
  checks: PolicyCheck[];
  violations: string[];
  recommendations: string[];
}

export class ContentPolicy {
  private static instance: ContentPolicy;

  // Configurable thresholds
  private readonly MIN_EVIDENCE_SCORE = Number(process.env.MIN_EVIDENCE_SCORE) || 0.8;
  private readonly MIN_EXPERT_SCORE = Number(process.env.MIN_EXPERT_SCORE) || 0.9;
  private readonly STRICT_MODE = process.env.STRICT_EXPERT_VOICE === 'true';

  public static getInstance(): ContentPolicy {
    if (!ContentPolicy.instance) {
      ContentPolicy.instance = new ContentPolicy();
    }
    return ContentPolicy.instance;
  }

  /**
   * 🚪 Main policy enforcement gate
   */
  async enforcePolicy(content: string | string[]): Promise<PolicyResult> {
    const text = Array.isArray(content) ? content.join(' ') : content;
    console.log(`📋 POLICY_CHECK: Evaluating ${text.length} characters...`);

    const checks: PolicyCheck[] = [];
    const violations: string[] = [];
    const recommendations: string[] = [];

    // Check 1: First-person language prohibition
    const firstPersonCheck = this.checkFirstPerson(text);
    checks.push(firstPersonCheck);
    if (!firstPersonCheck.passed) {
      violations.push('Contains first-person language');
      recommendations.push('Replace with third-person expert voice (Research shows, Studies indicate)');
    }

    // Check 2: Evidence requirements
    const evidenceCheck = this.checkEvidence(text);
    checks.push(evidenceCheck);
    if (!evidenceCheck.passed) {
      violations.push('Insufficient evidence citations');
      recommendations.push('Add evidence tags like [Harvard, 2023] or [Cochrane Review]');
    }

    // Check 3: Medical advice prohibition
    const medicalAdviceCheck = this.checkMedicalAdvice(text);
    checks.push(medicalAdviceCheck);
    if (!medicalAdviceCheck.passed) {
      violations.push('Contains medical advice language');
      recommendations.push('Use educational framing: "Research suggests" instead of "You should"');
    }

    // Check 4: Expert language requirement
    const expertLanguageCheck = this.checkExpertLanguage(text);
    checks.push(expertLanguageCheck);
    if (!expertLanguageCheck.passed) {
      violations.push('Insufficient expert terminology');
      recommendations.push('Include more scientific terms: research, clinical, evidence, studies');
    }

    // Check 5: Prohibited content patterns
    const prohibitedCheck = this.checkProhibitedPatterns(text);
    checks.push(prohibitedCheck);
    if (!prohibitedCheck.passed) {
      violations.push('Contains prohibited casual language');
      recommendations.push('Remove casual expressions and maintain professional tone');
    }

    // Calculate overall score
    const overallScore = checks.reduce((sum, check) => sum + (check.score || 0), 0) / checks.length;
    
    // Determine approval
    const criticalViolations = violations.filter(v => 
      v.includes('first-person') || 
      v.includes('medical advice') || 
      (this.STRICT_MODE && v.includes('evidence'))
    );
    
    const approved = criticalViolations.length === 0 && overallScore >= 0.7;

    console.log(`📊 POLICY_RESULT: ${approved ? '✅ APPROVED' : '❌ REJECTED'} (${(overallScore * 100).toFixed(1)}%)`);

    return {
      approved,
      overall_score: overallScore,
      checks,
      violations,
      recommendations
    };
  }

  /**
   * 👤 Check for first-person language
   */
  private checkFirstPerson(text: string): PolicyCheck {
    const firstPersonPatterns = [
      /\b(I|me|my|mine)\b/gi,
      /\b(we|us|our|ours)\b/gi,
      /\b(I've|I'm|I'll|we've|we're|we'll)\b/gi,
      /\b(tried|found|experienced|discovered|realized)\b/gi,
      /\b(in my experience|personally|from my perspective)\b/gi
    ];

    let violations = 0;
    const violationDetails: string[] = [];

    for (const pattern of firstPersonPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        violations += matches.length;
        violationDetails.push(...matches);
      }
    }

    const score = Math.max(0, 1 - (violations * 0.2));
    const passed = violations === 0;

    return {
      name: 'first_person_prohibition',
      passed,
      score,
      details: passed ? undefined : `Found: ${violationDetails.join(', ')}`
    };
  }

  /**
   * 📚 Check for evidence citations
   */
  private checkEvidence(text: string): PolicyCheck {
    // Look for evidence tags like [Harvard, 2023], [Mayo Clinic], etc.
    const evidencePatterns = [
      /\[[^\]]*\d{4}[^\]]*\]/g, // Tags with years [Harvard, 2023]
      /\[[^\]]*(?:clinic|review|study|research|university|college|institute)[^\]]*\]/gi,
      /\[[^\]]*(?:BMJ|NEJM|Cochrane|Mayo|Harvard|Stanford|Johns Hopkins)[^\]]*\]/gi
    ];

    let evidenceCount = 0;
    for (const pattern of evidencePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        evidenceCount += matches.length;
      }
    }

    // Also look for indirect evidence language
    const indirectEvidence = [
      /\b(?:research|study|studies|evidence|clinical|data|findings|analysis)\b/gi,
      /\b(?:systematic review|meta-analysis|randomized|controlled|trial)\b/gi
    ];

    let indirectCount = 0;
    for (const pattern of indirectEvidence) {
      const matches = text.match(pattern);
      if (matches) {
        indirectCount += matches.length;
      }
    }

    const totalEvidence = evidenceCount + (indirectCount * 0.3);
    const score = Math.min(1, totalEvidence / 2);
    const passed = score >= this.MIN_EVIDENCE_SCORE;

    return {
      name: 'evidence_requirement',
      passed,
      score,
      details: `Direct citations: ${evidenceCount}, Indirect evidence: ${indirectCount}`
    };
  }

  /**
   * ⚕️ Check for medical advice prohibition
   */
  private checkMedicalAdvice(text: string): PolicyCheck {
    const medicalAdvicePatterns = [
      /\b(?:take|use|consume|try|should|must|recommended dose|dosage)\b/gi,
      /\b(?:cure|treat|heal|fix|prevent|avoid|stop)\b/gi,
      /\b(?:you should|you must|you need to|make sure to)\b/gi,
      /\b(?:prescribed|medication|drug|supplement|treatment)\b/gi
    ];

    let violations = 0;
    const violationDetails: string[] = [];

    for (const pattern of medicalAdvicePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        violations += matches.length;
        violationDetails.push(...matches);
      }
    }

    const score = Math.max(0, 1 - (violations * 0.3));
    const passed = violations === 0;

    return {
      name: 'medical_advice_prohibition',
      passed,
      score,
      details: passed ? undefined : `Medical advice terms: ${violationDetails.join(', ')}`
    };
  }

  /**
   * 🎓 Check for expert language
   */
  private checkExpertLanguage(text: string): PolicyCheck {
    const expertTerms = [
      /\b(?:research|study|studies|evidence|clinical|data|findings|analysis)\b/gi,
      /\b(?:systematic|randomized|controlled|peer-reviewed|published)\b/gi,
      /\b(?:correlation|causation|significance|statistical|methodology)\b/gi,
      /\b(?:indicates|suggests|demonstrates|reveals|shows|reports)\b/gi
    ];

    let expertCount = 0;
    for (const pattern of expertTerms) {
      const matches = text.match(pattern);
      if (matches) {
        expertCount += matches.length;
      }
    }

    const score = Math.min(1, expertCount / 5);
    const passed = score >= this.MIN_EXPERT_SCORE;

    return {
      name: 'expert_language_requirement',
      passed,
      score,
      details: `Expert terms found: ${expertCount}`
    };
  }

  /**
   * 🚫 Check for prohibited casual patterns
   */
  private checkProhibitedPatterns(text: string): PolicyCheck {
    const prohibitedPatterns = [
      /\b(?:amazing|crazy|wow|who knew|unbelievable|mind-blowing)\b/gi,
      /\b(?:hack|trick|secret|hidden|they don't want you to know)\b/gi,
      /\b(?:game-changer|life-changing|revolutionary|breakthrough)\b/gi,
      /\b(?:literally|honestly|basically|obviously|clearly)\b/gi
    ];

    let violations = 0;
    const violationDetails: string[] = [];

    for (const pattern of prohibitedPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        violations += matches.length;
        violationDetails.push(...matches);
      }
    }

    const score = Math.max(0, 1 - (violations * 0.2));
    const passed = violations === 0;

    return {
      name: 'prohibited_patterns',
      passed,
      score,
      details: passed ? undefined : `Casual language: ${violationDetails.join(', ')}`
    };
  }

  /**
   * 🔧 Generate policy-compliant alternatives
   */
  async generateAlternatives(violations: string[]): Promise<string[]> {
    const alternatives: string[] = [];

    for (const violation of violations) {
      if (violation.includes('first-person')) {
        alternatives.push('Replace with: "Research demonstrates", "Studies indicate", "Evidence shows"');
      }
      if (violation.includes('evidence')) {
        alternatives.push('Add citations: [Harvard, 2023], [Mayo Clinic], [Cochrane Review]');
      }
      if (violation.includes('medical advice')) {
        alternatives.push('Use educational framing: "Research suggests" instead of "You should"');
      }
      if (violation.includes('casual')) {
        alternatives.push('Replace with precise scientific language');
      }
    }

    return alternatives;
  }
}

export default ContentPolicy;
