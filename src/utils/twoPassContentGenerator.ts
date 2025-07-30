/**
 * 🧠 TWO-PASS CONTENT GENERATOR
 * 
 * Advanced content generation system that creates initial draft,
 * performs self-critique, and generates optimized final content.
 * This ensures every tweet meets high quality standards.
 */

import { OpenAI } from 'openai';
import { emergencyBudgetLockdown } from './emergencyBudgetLockdown';
import { contentFactChecker } from './contentFactChecker';
import { isNuclearBlockedContent } from '../config/nuclearContentValidation';

interface TwoPassRequest {
  topic?: string;
  tone?: string;
  contentType?: string;
  targetAudience?: string;
  viralPotential?: number;
  researchContext?: any;
  previousAttempts?: string[];
}

interface TwoPassResult {
  success: boolean;
  content?: string;
  draftContent?: string;
  critique?: string;
  improvements?: string[];
  qualityScore?: number;
  viralPotential?: number;
  confidenceLevel?: number;
  error?: string;
  metadata?: {
    draftTime: number;
    critiqueTime: number;
    finalTime: number;
    totalTime: number;
    iterations: number;
  };
}

export class TwoPassContentGenerator {
  private static openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  private static readonly MAX_ITERATIONS = 3;
  private static readonly MIN_QUALITY_SCORE = 75;
  private static readonly TARGET_VIRAL_POTENTIAL = 80;

  /**
   * 🎯 GENERATE CONTENT WITH TWO-PASS SYSTEM
   */
  static async generateContent(request: TwoPassRequest = {}): Promise<TwoPassResult> {
    const startTime = Date.now();
    let draftTime = 0;
    let critiqueTime = 0;
    let finalTime = 0;
    let iterations = 0;

    try {
      console.log('🧠 === TWO-PASS CONTENT GENERATION ===');
      console.log(`🎯 Target: ${request.topic || 'health/wellness'} content`);
      
      // PASS 1: Generate Initial Draft
      console.log('📝 PASS 1: Generating initial draft...');
      const draftStart = Date.now();
      
      const draftResult = await this.generateInitialDraft(request);
      draftTime = Date.now() - draftStart;
      
      if (!draftResult.success || !draftResult.content) {
        return {
          success: false,
          error: `Draft generation failed: ${draftResult.error}`,
          metadata: { draftTime, critiqueTime: 0, finalTime: 0, totalTime: Date.now() - startTime, iterations: 0 }
        };
      }

      console.log(`📄 Draft: "${draftResult.content.substring(0, 80)}..."`);

      // PASS 2: Critique and Improve
      console.log('🔍 PASS 2: Analyzing and critiquing draft...');
      const critiqueStart = Date.now();
      
      const critiqueResult = await this.critiqueDraft(draftResult.content, request);
      critiqueTime = Date.now() - critiqueStart;
      
      if (!critiqueResult.success) {
        // Use draft if critique fails but draft is good enough
        const basicScore = this.calculateBasicQuality(draftResult.content);
        if (basicScore >= this.MIN_QUALITY_SCORE) {
          console.log('⚠️ Critique failed but draft quality acceptable');
          return {
            success: true,
            content: draftResult.content,
            draftContent: draftResult.content,
            qualityScore: basicScore,
            viralPotential: 65,
            confidenceLevel: 0.7,
            metadata: { draftTime, critiqueTime, finalTime: 0, totalTime: Date.now() - startTime, iterations: 1 }
          };
        }
        
        return {
          success: false,
          error: `Critique failed: ${critiqueResult.error}`,
          draftContent: draftResult.content,
          metadata: { draftTime, critiqueTime, finalTime: 0, totalTime: Date.now() - startTime, iterations: 1 }
        };
      }

      console.log(`🎯 Critique Score: ${critiqueResult.qualityScore}/100`);
      console.log(`🔥 Viral Potential: ${critiqueResult.viralPotential}/100`);

      // PASS 3: Generate Final Optimized Content
      if (critiqueResult.qualityScore >= this.MIN_QUALITY_SCORE && 
          critiqueResult.viralPotential >= this.TARGET_VIRAL_POTENTIAL - 15) {
        // Draft is already excellent
        console.log('✨ Draft already meets quality standards');
        return {
          success: true,
          content: draftResult.content,
          draftContent: draftResult.content,
          critique: critiqueResult.critique,
          qualityScore: critiqueResult.qualityScore,
          viralPotential: critiqueResult.viralPotential,
          confidenceLevel: 0.95,
          metadata: { draftTime, critiqueTime, finalTime: 0, totalTime: Date.now() - startTime, iterations: 2 }
        };
      }

      console.log('🔧 PASS 3: Generating optimized final content...');
      const finalStart = Date.now();
      
      const finalResult = await this.generateOptimizedContent(
        draftResult.content,
        critiqueResult.critique,
        critiqueResult.improvements,
        request
      );
      finalTime = Date.now() - finalStart;
      iterations = 3;

      if (!finalResult.success || !finalResult.content) {
        // Fallback to draft if final generation fails
        console.log('⚠️ Final generation failed, using original draft');
        return {
          success: true,
          content: draftResult.content,
          draftContent: draftResult.content,
          critique: critiqueResult.critique,
          qualityScore: critiqueResult.qualityScore,
          viralPotential: critiqueResult.viralPotential,
          confidenceLevel: 0.6,
          error: `Final generation failed: ${finalResult.error}`,
          metadata: { draftTime, critiqueTime, finalTime, totalTime: Date.now() - startTime, iterations }
        };
      }

      // Final validation
      if (isNuclearBlockedContent(finalResult.content)) {
        console.log('🚫 Final content blocked by nuclear validation, using draft');
        return {
          success: true,
          content: draftResult.content,
          draftContent: draftResult.content,
          critique: critiqueResult.critique,
          qualityScore: critiqueResult.qualityScore,
          viralPotential: critiqueResult.viralPotential,
          confidenceLevel: 0.7,
          metadata: { draftTime, critiqueTime, finalTime, totalTime: Date.now() - startTime, iterations }
        };
      }

      const finalQualityScore = this.calculateFinalQuality(finalResult.content, critiqueResult.improvements);
      const totalTime = Date.now() - startTime;

      console.log(`✅ Two-pass generation completed in ${totalTime}ms`);
      console.log(`📊 Final Quality: ${finalQualityScore}/100`);

      return {
        success: true,
        content: finalResult.content,
        draftContent: draftResult.content,
        critique: critiqueResult.critique,
        improvements: critiqueResult.improvements,
        qualityScore: finalQualityScore,
        viralPotential: Math.min(95, critiqueResult.viralPotential + 10),
        confidenceLevel: 0.9,
        metadata: { draftTime, critiqueTime, finalTime, totalTime, iterations }
      };

    } catch (error) {
      console.error('❌ Two-pass content generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { draftTime, critiqueTime, finalTime, totalTime: Date.now() - startTime, iterations }
      };
    }
  }

  /**
   * 📝 GENERATE INITIAL DRAFT
   */
  private static async generateInitialDraft(request: TwoPassRequest): Promise<{
    success: boolean;
    content?: string;
    error?: string;
  }> {
    try {
      await emergencyBudgetLockdown.enforceBeforeAICall('two-pass-draft');

      const prompt = this.buildDraftPrompt(request);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 250,
        temperature: 0.8,
        presence_penalty: 0.6,
        frequency_penalty: 0.3
      });

      const content = response.choices[0]?.message?.content?.trim();
      
      if (!content) {
        return { success: false, error: 'No content generated' };
      }

      if (content.length < 30 || content.length > 280) {
        return { success: false, error: `Invalid length: ${content.length} characters` };
      }

      return { success: true, content };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Draft generation failed'
      };
    }
  }

  /**
   * 🔍 CRITIQUE DRAFT CONTENT
   */
  private static async critiqueDraft(content: string, request: TwoPassRequest): Promise<{
    success: boolean;
    critique?: string;
    qualityScore?: number;
    viralPotential?: number;
    improvements?: string[];
    error?: string;
  }> {
    try {
      await emergencyBudgetLockdown.enforceBeforeAICall('two-pass-critique');

      const critiquePrompt = `
Analyze this health/wellness tweet draft and provide detailed critique:

TWEET: "${content}"

Provide analysis in this exact format:
QUALITY_SCORE: [0-100]
VIRAL_POTENTIAL: [0-100]
CRITIQUE: [detailed analysis]
IMPROVEMENTS: [specific suggestions]

Evaluate:
1. Hook strength (grabs attention in first 10 words)
2. Value delivery (actionable insights/information)
3. Engagement triggers (questions, controversy, relatability)
4. Authority markers (studies, data, expert insights)
5. Completeness (no incomplete hooks like "Here's how to...")
6. Viral elements (shareability, emotional response)
7. Call-to-action effectiveness
8. Health accuracy and safety

Be critical but constructive. Focus on what would make this genuinely valuable for health-conscious followers.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: critiquePrompt }],
        max_tokens: 400,
        temperature: 0.3
      });

      const result = response.choices[0]?.message?.content?.trim();
      
      if (!result) {
        return { success: false, error: 'No critique generated' };
      }

      // Parse structured response
      const qualityMatch = result.match(/QUALITY_SCORE:\s*(\d+)/);
      const viralMatch = result.match(/VIRAL_POTENTIAL:\s*(\d+)/);
      const critiqueMatch = result.match(/CRITIQUE:\s*([\s\S]*?)(?=IMPROVEMENTS:|$)/);
      const improvementsMatch = result.match(/IMPROVEMENTS:\s*([\s\S]*)/);

      const qualityScore = qualityMatch ? parseInt(qualityMatch[1]) : 50;
      const viralPotential = viralMatch ? parseInt(viralMatch[1]) : 50;
      const critique = critiqueMatch ? critiqueMatch[1].trim() : result;
      const improvements = improvementsMatch ? 
        improvementsMatch[1].split(/\n/).filter(line => line.trim()).map(line => line.replace(/^[\d\-\*\.\s]+/, '').trim()) : 
        [];

      return {
        success: true,
        critique,
        qualityScore,
        viralPotential,
        improvements
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Critique failed'
      };
    }
  }

  /**
   * 🔧 GENERATE OPTIMIZED CONTENT
   */
  private static async generateOptimizedContent(
    originalContent: string,
    critique: string,
    improvements: string[],
    request: TwoPassRequest
  ): Promise<{
    success: boolean;
    content?: string;
    error?: string;
  }> {
    try {
      await emergencyBudgetLockdown.enforceBeforeAICall('two-pass-optimize');

      const optimizationPrompt = `
Optimize this health/wellness tweet based on the critique and improvements:

ORIGINAL TWEET: "${originalContent}"

CRITIQUE: ${critique}

IMPROVEMENTS NEEDED:
${improvements.map((imp, i) => `${i + 1}. ${imp}`).join('\n')}

CREATE AN IMPROVED VERSION that:
✅ Addresses all the improvement points
✅ Maintains the core value/message
✅ Has a strong hook in first 10 words
✅ Provides complete, actionable value
✅ Includes authority markers (studies/data)
✅ Ends with engaging question or CTA
✅ Is 50-280 characters
✅ Feels natural and authentic

Generate ONLY the improved tweet text, no quotes or extra formatting:`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: optimizationPrompt }],
        max_tokens: 200,
        temperature: 0.7,
        presence_penalty: 0.8,
        frequency_penalty: 0.6
      });

      const content = response.choices[0]?.message?.content?.trim();
      
      if (!content) {
        return { success: false, error: 'No optimized content generated' };
      }

      if (content.length < 30 || content.length > 280) {
        return { success: false, error: `Invalid optimized length: ${content.length} characters` };
      }

      return { success: true, content };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Optimization failed'
      };
    }
  }

  /**
   * 📊 BUILD DRAFT PROMPT
   */
  private static buildDraftPrompt(request: TwoPassRequest): string {
    const topic = request.topic || 'health optimization';
    const tone = request.tone || 'authoritative yet approachable';
    const contentType = request.contentType || 'actionable insight';
    
    return `Create a ${tone} health/wellness tweet about ${topic}.

STYLE: ${contentType}
AUDIENCE: Health-conscious individuals seeking practical insights
GOAL: Provide genuine value that builds authority and encourages engagement

REQUIREMENTS:
• Start with attention-grabbing hook (first 10 words crucial)
• Include specific, actionable information
• Reference credible sources/studies when possible
• End with engaging question or call-to-action
• 50-280 characters total
• No incomplete hooks (avoid "Here's how to..." without the actual how)
• Provide complete value in the tweet itself

EXAMPLES OF STRONG HEALTH TWEETS:
"New study: 15 minutes of morning sunlight increases vitamin D absorption by 200% and improves sleep quality. Most people skip this free health hack. When do you get your sunlight?"

"Cold showers for 2 minutes trigger a 250% increase in norepinephrine - the focus neurotransmitter. Navy SEALs use this for mental clarity. Ready to try it?"

Generate ONE high-quality tweet following this format. Be specific, valuable, and complete:`;
  }

  /**
   * 📊 CALCULATE BASIC QUALITY
   */
  private static calculateBasicQuality(content: string): number {
    let score = 0;
    
    // Length check (50-280 chars)
    if (content.length >= 50 && content.length <= 280) score += 20;
    
    // Has question or CTA
    if (/[?!]/.test(content)) score += 15;
    
    // Has numbers/data
    if (/\d+/.test(content)) score += 15;
    
    // No incomplete hooks
    if (!/here's (how|\d+ ways) to/i.test(content)) score += 20;
    
    // Complete sentences
    if (content.split('.').length >= 2) score += 10;
    
    // Authority markers
    if (/(study|research|data|\d+%)/i.test(content)) score += 10;
    
    // Engagement words
    if (/(new|secret|proven|simple|powerful)/i.test(content)) score += 10;
    
    return Math.min(100, score);
  }

  /**
   * 📊 CALCULATE FINAL QUALITY
   */
  private static calculateFinalQuality(content: string, improvements: string[]): number {
    const baseScore = this.calculateBasicQuality(content);
    const improvementBonus = Math.min(20, improvements.length * 3);
    return Math.min(100, baseScore + improvementBonus);
  }

  /**
   * 🧪 TEST TWO-PASS SYSTEM
   */
  static async testSystem(): Promise<{
    success: boolean;
    testResults: any[];
    summary: string;
  }> {
    const testCases = [
      { topic: 'gut health', tone: 'scientific', contentType: 'fact' },
      { topic: 'sleep optimization', tone: 'practical', contentType: 'tip' },
      { topic: 'nutrition myths', tone: 'controversial', contentType: 'myth_bust' }
    ];

    const results = [];
    
    for (const testCase of testCases) {
      const result = await this.generateContent(testCase);
      results.push({
        input: testCase,
        output: result,
        passed: result.success && (result.qualityScore || 0) >= 70
      });
    }

    const passedTests = results.filter(r => r.passed).length;
    const summary = `Two-Pass System Test: ${passedTests}/${results.length} tests passed`;

    return {
      success: passedTests >= 2,
      testResults: results,
      summary
    };
  }
}

export const twoPassContentGenerator = TwoPassContentGenerator;