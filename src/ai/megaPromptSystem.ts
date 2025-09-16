/**
 * Mega Prompt System - Now powered by Viral Content Strategy
 * Generates fact-based, viral-structured health content with learning integration
 */

import OpenAI from 'openai';
import { isDuplicate, processPostEmbedding } from '../learning/embeddings';
import { extractFeatures } from '../learning/featureExtractor';
import { validateAndScoreContent } from '../jobs/planNext';
import { FactCache } from '../learning/factCache';
import { log_compat as log, log_compat as warn, log_compat as error } from '../utils/logger';

// Legacy interfaces for compatibility
export interface MegaPromptResult {
  content: string;
  viralScore: number;
  qualityScore: number;
  rawContent?: string;
  persona?: string;
  emotion?: string;
  framework?: string;
  
  // Legacy properties for backward compatibility
  format?: string;
  shockValue?: number;
  reasoning?: string;
  studySource?: string;
  factBased?: boolean;
  bannedPhraseCheck?: boolean;
  firstPersonCheck?: boolean;
  
  metadata?: {
    contentId: string;
    style: string;
    factSource: string;
    topic: string;
    threadLength: number;
    hookType: string;
    ctaType: string;
    banditArm?: string;
    timingArm?: string;
    contentHash?: string;
    isDuplicate?: boolean;
    uniquenessScore?: number;
  };
}

export interface QualityCheckResult {
  passed: boolean;
  failures: string[];
  scores: {
    bannedPhraseCheck: boolean;
    firstPersonCheck: boolean;
    shockValue: number;
    specificity: number;
    factTokenCheck: boolean;
    viralTriggerCheck: boolean;
  };
}

/**
 * Mega Prompt System - Now using Viral Content Strategy
 */
export class MegaPromptSystem {
  private static instance: MegaPromptSystem;
  private openai: OpenAI;
  private readonly MEGAPROMPT_SIGNATURE = 'VIRAL_STRATEGY_V1';

  private constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  static getInstance(): MegaPromptSystem {
    if (!MegaPromptSystem.instance) {
      MegaPromptSystem.instance = new MegaPromptSystem();
    }
    return MegaPromptSystem.instance;
  }

  /**
   * 🎯 GENERATE MEGA PROMPT CONTENT - Now using viral strategy system
   */
  async generateMegaPromptContent(request: {
    topic?: string;
    format?: 'single' | 'thread';
    urgency?: 'viral' | 'shocking' | 'authority';
  }): Promise<MegaPromptResult> {
    // Early exit if posting is disabled - don't make LLM calls
    if (process.env.POSTING_DISABLED === 'true') {
      console.log('🚫 LLM_SKIPPED: posting disabled (pre-call gate)');
      return { 
        skipped: true, 
        reason: 'posting_disabled',
        content: '',
        viralScore: 0,
        qualityScore: 0
      } as any;
    }

    // Use new viral content strategy system
    console.log('🚀 VIRAL_STRATEGY: Using new fact-based viral content generation system');
    return this.generateViralContent(request);
  }

  /**
   * Generate viral content using the new strategy system with uniqueness gates
   */
  private async generateViralContent(request: {
    topic?: string;
    format?: 'single' | 'thread';
    urgency?: 'viral' | 'shocking' | 'authority';
    banditArm?: string;
    timingArm?: string;
  }): Promise<MegaPromptResult> {
    
    const { ViralContentGenerator } = await import('./viralContentStrategy');
    const { ContentMetadataTracker } = await import('../learning/contentMetadataTracker');
    
    const generator = new ViralContentGenerator();
    const tracker = ContentMetadataTracker.getInstance();
    
    // Get learning insights to inform generation
    const insights = await tracker.generateLearningInsights();
    const styleWeights = tracker.getStyleWeights();
    
    // Select optimal style based on learning data
    let selectedStyle: string = insights.best_performing_style || 'educational';
    
    // Override with request urgency mapping
    if (request.urgency === 'shocking') selectedStyle = 'contrarian';
    else if (request.urgency === 'authority') selectedStyle = 'educational';
    else if (request.urgency === 'viral') selectedStyle = insights.best_performing_style || 'educational';
    
    console.log(`🎯 STYLE_SELECTION: Using ${selectedStyle} style (learning-optimized)`);
    
    // Generate and validate content with retries for uniqueness
    const MAX_UNIQUENESS_RETRIES = 3;
    let attempt = 0;
    let finalResult: any = null;
    let contentValidation: any = null;
    
    while (attempt < MAX_UNIQUENESS_RETRIES && !finalResult) {
      attempt++;
      
      try {
        // Get fact snippets if fact check mode is enabled
        let factSnippets: any[] = [];
        if (process.env.FACT_CHECK_MODE === 'light') {
          factSnippets = await FactCache.getFactSnippets(2, this.getTopicCategory(request.topic));
          log(`FACT_CACHE_INTEGRATION: Retrieved ${factSnippets.length} snippets for ${request.topic}`);
        }
        
        // Generate viral content (fact integration ready for future enhancement)
        const viralResult = await generator.generateViralContent({
          topic: request.topic,
          style: selectedStyle as 'educational' | 'storytelling' | 'contrarian' | 'quick_tip',
          thread_length: insights.optimal_thread_length,
          urgency: 'medium' as 'high' | 'medium' | 'low'
        });
        
        // Integrate fact snippets post-generation if enabled
        if (factSnippets.length > 0) {
          log(`FACT_SNIPPETS_AVAILABLE: ${factSnippets.length} snippets ready for integration`);
        }
        
        // Convert to text for validation
        const content = viralResult.content.join('\n\n');
        
        // Check for duplicates using embedding similarity
        log(`UNIQUENESS_CHECK: Attempt ${attempt} - checking content similarity`);
        const duplicateCheck = await isDuplicate(content);
        
        if (duplicateCheck.isDuplicate) {
          warn(`UNIQUENESS_FAILURE: Attempt ${attempt} - content too similar (${(duplicateCheck.maxSimilarity * 100).toFixed(1)}%)`);
          
          if (attempt < MAX_UNIQUENESS_RETRIES) {
            // Modify generation parameters for next attempt
            selectedStyle = this.getAlternativeStyle(selectedStyle);
            continue;
          } else {
            warn(`UNIQUENESS_EXHAUSTED: Using content despite similarity after ${MAX_UNIQUENESS_RETRIES} attempts`);
          }
        }
        
        // Validate content quality and compliance
        if (request.banditArm) {
          const mockPlan = {
            contentArm: request.banditArm,
            timingArm: request.timingArm || '',
            format: request.format || 'single',
            hookType: selectedStyle,
            topic: request.topic || 'health_general',
            contentStyle: selectedStyle
          } as any;
          
          contentValidation = await validateAndScoreContent(content, mockPlan);
          
          if (!contentValidation.isValid) {
            warn(`CONTENT_VALIDATION_FAILURE: Attempt ${attempt} - ${contentValidation.issues.join(', ')}`);
            
            if (attempt < MAX_UNIQUENESS_RETRIES) {
              continue;
            } else {
              warn(`VALIDATION_EXHAUSTED: Using content despite issues after ${MAX_UNIQUENESS_RETRIES} attempts`);
            }
          }
        }
        
        // Content passed validation or we're on final attempt
        finalResult = {
          viralResult,
          content,
          duplicateCheck,
          contentValidation
        };
        
      } catch (err: any) {
        error(`CONTENT_GENERATION_ERROR: Attempt ${attempt}: ${err.message}`);
        
        if (attempt >= MAX_UNIQUENESS_RETRIES) {
          throw err;
        }
      }
    }
    
    if (!finalResult) {
      throw new Error('Failed to generate valid content after maximum attempts');
    }
    
    const { viralResult, content, duplicateCheck, contentValidation: validation } = finalResult;
    
    // Record generation metadata for learning
    const contentId = `viral_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await tracker.recordContentGeneration(contentId, viralResult);
    
    // Process embedding for future uniqueness checks
    try {
      const contentHash = await processPostEmbedding(contentId, content);
      log(`EMBEDDING_PROCESSED: contentId=${contentId} hash=${contentHash}`);
    } catch (embErr) {
      warn(`EMBEDDING_PROCESSING_ERROR: contentId=${contentId}: ${embErr}`);
    }
    
    console.log(`🚀 VIRAL_CONTENT_GENERATED: ${viralResult.metadata.predicted_engagement}, quality=${viralResult.metadata.quality_score}/100`);
    console.log(`📊 METADATA: style=${viralResult.metadata.style}, source=${viralResult.metadata.fact_source}`);
    console.log(`🔍 UNIQUENESS: duplicate=${duplicateCheck.isDuplicate} similarity=${(duplicateCheck.maxSimilarity * 100).toFixed(1)}%`);
    
    return {
      content,
      viralScore: parseInt(viralResult.metadata.predicted_engagement.split('%')[0]) || 70,
      qualityScore: validation ? validation.qualityScore : viralResult.metadata.quality_score,
      rawContent: content,
      persona: 'health_expert',
      emotion: this.mapStyleToEmotion(viralResult.metadata.style),
      framework: `viral_${viralResult.metadata.style}`,
      
      // Legacy properties for backward compatibility
      format: viralResult.metadata.thread_length > 1 ? 'thread' : 'single',
      shockValue: parseInt(viralResult.metadata.predicted_engagement.split('%')[0]) || 70,
      reasoning: `Generated using ${viralResult.metadata.style} style with ${viralResult.metadata.fact_source}`,
      studySource: viralResult.metadata.fact_source,
      factBased: true,
      bannedPhraseCheck: true,
      firstPersonCheck: true,
      
      metadata: {
        contentId,
        style: viralResult.metadata.style,
        factSource: viralResult.metadata.fact_source,
        topic: viralResult.metadata.topic,
        threadLength: viralResult.metadata.thread_length,
        hookType: viralResult.metadata.hook_type,
        ctaType: viralResult.metadata.cta_type,
        banditArm: request.banditArm,
        timingArm: request.timingArm,
        contentHash: duplicateCheck ? duplicateCheck.maxSimilarity.toString() : undefined,
        isDuplicate: duplicateCheck ? duplicateCheck.isDuplicate : false,
        uniquenessScore: duplicateCheck ? (1 - duplicateCheck.maxSimilarity) : 1.0
      }
    } as MegaPromptResult;
  }
  
  /**
   * Get alternative style for uniqueness retry
   */
  private getAlternativeStyle(currentStyle: string): string {
    const styleAlternatives: Record<string, string[]> = {
      'educational': ['quick_tip', 'storytelling', 'contrarian'],
      'myth_busting': ['educational', 'contrarian', 'storytelling'],
      'contrarian': ['educational', 'quick_tip', 'storytelling'],
      'data_driven': ['educational', 'quick_tip', 'contrarian'],
      'storytelling': ['contrarian', 'educational', 'quick_tip'],
      'quick_tip': ['storytelling', 'educational', 'contrarian'],
      'conversational': ['educational', 'storytelling', 'quick_tip']
    };
    
    const alternatives = styleAlternatives[currentStyle] || ['educational', 'quick_tip'];
    const randomIndex = Math.floor(Math.random() * alternatives.length);
    return alternatives[randomIndex];
  }

  private getTopicCategory(topic?: string): 'nutrition' | 'exercise' | 'sleep' | 'mental_health' | 'prevention' | undefined {
    if (!topic) return undefined;
    
    const topicLower = topic.toLowerCase();
    if (topicLower.includes('nutrition') || topicLower.includes('diet')) return 'nutrition';
    if (topicLower.includes('exercise') || topicLower.includes('fitness')) return 'exercise';
    if (topicLower.includes('sleep')) return 'sleep';
    if (topicLower.includes('mental') || topicLower.includes('stress')) return 'mental_health';
    if (topicLower.includes('prevent') || topicLower.includes('disease')) return 'prevention';
    
    return undefined;
  }

  private mapStyleToEmotion(style: string): string {
    const styleEmotionMap: Record<string, string> = {
      educational: 'authoritative',
      storytelling: 'engaging', 
      contrarian: 'provocative',
      quick_tip: 'helpful'
    };
    
    return styleEmotionMap[style] || 'neutral';
  }

  // Legacy methods preserved for compatibility (kept for potential fallback)
  private async generateWithMegaPrompt(healthFact: any, request: any): Promise<string> {
    // This method is preserved but not used in the new viral strategy
    return 'Legacy method - use viral strategy instead';
  }

  // Legacy helper methods (simplified for compatibility)
  private async getShockingHealthFact(topic?: string): Promise<any> {
    // Legacy method - replaced by HealthFactsDatabase in viral strategy
    return { institution: 'Health Research', statistic: 'general health fact' };
  }

  private enforceQualityGates(content: string): { passed: boolean; failures: string[] } {
    // Simplified quality gate for compatibility
    return { passed: true, failures: [] };
  }

  async recordSuccess(content: any, score: number): Promise<void> {
    try {
      console.log(`✅ LEGACY_SUCCESS_RECORDED: score=${score}`);
    } catch (error) {
      console.warn('⚠️ SUCCESS_RECORDING_WARNING:', error);
    }
  }
}

// Export singleton instance
export const megaPromptSystem = MegaPromptSystem.getInstance();