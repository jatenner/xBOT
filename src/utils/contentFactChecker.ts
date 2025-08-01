/**
 * 🔍 CONTENT FACT-CHECKER GATE
 * 
 * Validates medical and health claims before posting to ensure accuracy and safety
 */

import { BudgetAwareOpenAI } from './budgetAwareOpenAI';
import { emergencyBudgetLockdown } from './emergencyBudgetLockdown';

export interface FactCheckResult {
  isValid: boolean;
  confidence: number;
  issues: string[];
  corrections: string[];
  riskLevel: 'low' | 'medium' | 'high';
  shouldPost: boolean;
  reasoning: string;
  checkedContent: string;
}

export interface FactCheckRequest {
  content: string;
  contentType: 'tweet' | 'thread' | 'reply';
  strictMode?: boolean;
  allowSpeculation?: boolean;
}

export class ContentFactChecker {
  private static instance: ContentFactChecker;
  private budgetAwareOpenAI: BudgetAwareOpenAI;
  private checksPerformed = 0;

  // High-risk keywords that trigger strict checking (reduced for health content)
  private readonly HIGH_RISK_KEYWORDS = [
    'cure cancer', 'proven to cure', 'guaranteed cure', 'miracle cure',
    'doctors hate this', 'big pharma doesn\'t want',
    'toxic chemicals', 'poisonous ingredients', 'deadly side effects',
    'stop taking medication', 'replace your doctor', 'medical advice'
  ];

  // Medical disclaimers that should be avoided
  private readonly AVOID_PHRASES = [
    'medical advice', 'diagnose', 'treat', 'cure', 'prevent disease',
    'replace medical treatment', 'stop taking medication', 'ignore doctor'
  ];

  private constructor() {
    this.budgetAwareOpenAI = new BudgetAwareOpenAI(process.env.OPENAI_API_KEY || '');
  }

  static getInstance(): ContentFactChecker {
    if (!ContentFactChecker.instance) {
      ContentFactChecker.instance = new ContentFactChecker();
    }
    return ContentFactChecker.instance;
  }

  /**
   * 🔍 Main fact-checking entry point
   */
  async checkContent(request: FactCheckRequest): Promise<FactCheckResult> {
    try {
      const contentString = typeof request.content === 'string' ? request.content : String(request.content);
      console.log(`🔍 Fact-checking content: "${contentString.substring(0, 60)}..."`);

      // Check budget constraints
      const lockdownStatus = await emergencyBudgetLockdown.isLockedDown();
      if (lockdownStatus.lockdownActive) {
        console.log('⚠️ Budget lockdown active, using basic fact check');
        return this.performBasicFactCheck(request);
      }

      // Step 1: Quick safety scan
      const safetyCheck = this.performSafetyCheck(contentString);
      if (!safetyCheck.isSafe) {
        return {
          isValid: false,
          confidence: 0.9,
          issues: safetyCheck.issues,
          corrections: [],
          riskLevel: 'high',
          shouldPost: false,
          reasoning: 'Failed safety check: ' + safetyCheck.issues.join(', '),
          checkedContent: contentString
        };
      }

      // Step 2: AI-powered fact check
      const aiCheck = await this.performAIFactCheck(request);
      
      // Step 3: Combine results and make final decision
      const finalResult = this.combineResults(safetyCheck, aiCheck, request);
      
      this.checksPerformed++;
      console.log(`✅ Fact check complete: ${finalResult.shouldPost ? 'APPROVED' : 'REJECTED'} (${finalResult.confidence})`);
      
      return finalResult;

    } catch (error) {
      console.error('❌ Fact checking failed:', error);
      return this.createFailsafeResult(request, `Error: ${error.message}`);
    }
  }

  /**
   * 🛡️ Quick safety check for obvious issues
   */
  private performSafetyCheck(content: string): { isSafe: boolean; issues: string[] } {
    const issues: string[] = [];
    const contentLower = content.toLowerCase();

    // Check for high-risk keywords
    const foundRiskyKeywords = this.HIGH_RISK_KEYWORDS.filter(keyword => 
      contentLower.includes(keyword)
    );
    
    if (foundRiskyKeywords.length > 0) {
      issues.push(`High-risk keywords: ${foundRiskyKeywords.join(', ')}`);
    }

    // Check for medical disclaimer violations
    const foundAvoidPhrases = this.AVOID_PHRASES.filter(phrase =>
      contentLower.includes(phrase)
    );
    
    if (foundAvoidPhrases.length > 0) {
      issues.push(`Medical disclaimer issues: ${foundAvoidPhrases.join(', ')}`);
    }

    // Check for absolute claims without nuance
    const absoluteClaims = [
      /\b(always|never|all|every|everyone)\s+(should|must|will|can't)/gi,
      /\b(completely|totally|absolutely)\s+(safe|effective|harmless)/gi,
      /\b(no\s+side\s+effects|zero\s+risk|100%\s+safe)/gi
    ];

    absoluteClaims.forEach(pattern => {
      if (pattern.test(content)) {
        issues.push('Contains absolute claims without appropriate nuance');
      }
    });

    return {
      isSafe: issues.length === 0,
      issues
    };
  }

  /**
   * 🤖 AI-powered fact checking
   */
  private async performAIFactCheck(request: FactCheckRequest): Promise<any> {
    try {
      const systemPrompt = `You are a medical fact-checker reviewing health content for accuracy and safety.

GUIDELINES:
- Flag medical misinformation or dangerous advice
- Allow general wellness information with appropriate caveats
- Approve research-backed claims with reasonable confidence
- Reject absolute claims about health outcomes
- Ensure content doesn't replace medical advice
- Consider context: social media health education vs medical advice

Return: "APPROVE" or "REJECT: reason"
If APPROVE, also provide confidence score (0-100) and any suggested improvements.`;

      const userPrompt = `CONTENT TO CHECK: "${request.content}"

TYPE: ${request.contentType}
STRICT MODE: ${request.strictMode ? 'YES' : 'NO'}

Check for:
1. Medical accuracy
2. Safety concerns  
3. Misleading claims
4. Missing disclaimers
5. Inappropriate certainty

ASSESSMENT:`;

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userPrompt }
      ];

      const response = await this.budgetAwareOpenAI.createChatCompletion(messages, {
        priority: 'important',
        operationType: 'fact_checking',
        model: 'gpt-4o-mini',
        maxTokens: 200,
        temperature: 0.1, // Low temperature for consistency
        forTweetGeneration: false
      });

      if (!response?.success || !response?.response?.choices?.[0]?.message?.content) {
        throw new Error('No fact check response generated');
      }

      const result = response.response.choices[0].message.content.trim();
      return this.parseAIResponse(result);

    } catch (error) {
      console.error('❌ AI fact check failed:', error);
      return {
        isValid: false,
        confidence: 0.3,
        reasoning: `AI check failed: ${error.message}`,
        corrections: []
      };
    }
  }

  /**
   * 📝 Parse AI response into structured result
   */
  private parseAIResponse(response: string): any {
    const isApproved = response.toUpperCase().includes('APPROVE');
    
    // Extract confidence score if present
    const confidenceMatch = response.match(/confidence[:\s]+(\d+)/i);
    const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) / 100 : (isApproved ? 0.8 : 0.3);
    
    // Extract reasoning
    const reasoningMatch = response.match(/(?:REJECT[:]\s*(.+)|reason[:]\s*(.+))/i);
    const reasoning = reasoningMatch ? (reasoningMatch[1] || reasoningMatch[2]) : 
                     (isApproved ? 'Content appears factually sound' : 'Content flagged by AI review');

    // Extract corrections/improvements if present
    const corrections: string[] = [];
    if (response.includes('suggest') || response.includes('improve')) {
      const lines = response.split('\n');
      lines.forEach(line => {
        if (line.includes('suggest') || line.includes('improve') || line.includes('add')) {
          corrections.push(line.trim());
        }
      });
    }

    return {
      isValid: isApproved,
      confidence,
      reasoning: reasoning.trim(),
      corrections
    };
  }

  /**
   * 🎯 Combine safety and AI results
   */
  private combineResults(
    safetyCheck: any, 
    aiCheck: any, 
    request: FactCheckRequest
  ): FactCheckResult {
    // If safety check failed, that overrides everything
    if (!safetyCheck.isSafe) {
      return {
        isValid: false,
        confidence: 0.9,
        issues: safetyCheck.issues,
        corrections: [],
        riskLevel: 'high',
        shouldPost: false,
        reasoning: 'Failed safety check',
        checkedContent: request.content
      };
    }

    // Combine AI results with safety assessment
    const combinedConfidence = Math.min(aiCheck.confidence * 0.9, 0.95); // Slight reduction for AI uncertainty
    const shouldPost = aiCheck.isValid && combinedConfidence > 0.15;
    
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (combinedConfidence < 0.4) riskLevel = 'high';
    else if (combinedConfidence < 0.7) riskLevel = 'medium';

    // In strict mode, require higher confidence (but be reasonable for health content)
    const strictThreshold = request.strictMode ? 0.4 : 0.2;
    const finalShouldPost = shouldPost && combinedConfidence >= strictThreshold;

    return {
      isValid: aiCheck.isValid,
      confidence: combinedConfidence,
      issues: safetyCheck.issues,
      corrections: aiCheck.corrections || [],
      riskLevel,
      shouldPost: finalShouldPost,
      reasoning: `${aiCheck.reasoning} (confidence: ${(combinedConfidence * 100).toFixed(0)}%)`,
      checkedContent: request.content
    };
  }

  /**
   * 🔧 Basic fact check when AI is unavailable
   */
  private performBasicFactCheck(request: FactCheckRequest): FactCheckResult {
    const safetyCheck = this.performSafetyCheck(request.content);
    
    return {
      isValid: safetyCheck.isSafe,
      confidence: safetyCheck.isSafe ? 0.7 : 0.2,
      issues: safetyCheck.issues,
      corrections: [],
      riskLevel: safetyCheck.isSafe ? 'low' : 'high',
      shouldPost: safetyCheck.isSafe,
      reasoning: 'Basic safety check only (AI unavailable)',
      checkedContent: request.content
    };
  }

  /**
   * ⚠️ Create failsafe result on errors
   */
  private createFailsafeResult(request: FactCheckRequest, reason: string): FactCheckResult {
    return {
      isValid: false,
      confidence: 0.1,
      issues: [`Fact check error: ${reason}`],
      corrections: [],
      riskLevel: 'high',
      shouldPost: false,
      reasoning: `Failsafe: ${reason}`,
      checkedContent: request.content
    };
  }

  /**
   * 📊 Get fact checker statistics
   */
  getStats(): {
    checksPerformed: number;
  } {
    return {
      checksPerformed: this.checksPerformed
    };
  }

  /**
   * 🔄 Quick content validation (lightweight check)
   */
  async quickValidate(content: string): Promise<{ valid: boolean; reason?: string }> {
    const safetyCheck = this.performSafetyCheck(content);
    
    if (!safetyCheck.isSafe) {
      return {
        valid: false,
        reason: safetyCheck.issues[0]
      };
    }

    return { valid: true };
  }
}

export const contentFactChecker = ContentFactChecker.getInstance();