/**
 * 🎨 ENHANCED DIVERSE CONTENT AGENT
 * 
 * Advanced content generation with:
 * - Enhanced semantic uniqueness (30-day, 0.88 threshold)
 * - Real-time trending topics integration
 * - A/B testing template system
 * - Engagement-driven learning
 * - Comprehensive error handling
 */

import { EnhancedSemanticUniqueness } from '../utils/enhancedSemanticUniqueness';
import { trendingTopicsEngine } from '../utils/trendingTopicsEngine';
import { promptTemplateManager } from '../utils/promptTemplateManager';
import { enhancedOpenAIClient } from '../utils/enhancedOpenAIClient';
import { supabaseClient } from '../utils/supabaseClient';

interface ContentGenerationResult {
  success: boolean;
  content: string;
  type: string;
  metadata: {
    template_id?: string;
    trending_topic?: string;
    similarity_score?: number;
    attempts_made: number;
    generation_time_ms: number;
    quality_score: number;
    core_idea_fingerprint?: string;
    core_idea_category?: string;
    novelty_reasons?: string[];
  };
  uniqueness_analysis?: any;
  error?: string;
}

interface ContentTemplate {
  id: string;
  name: string;
  template: string;
  type: string;
  tone: string;
  placeholders: string[];
}

export class EnhancedDiverseContentAgent {
  private static readonly MAX_GENERATION_ATTEMPTS = 30;
  private static readonly TARGET_QUALITY_SCORE = 8;
  private static readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour

  /**
   * 🎯 MAIN CONTENT GENERATION METHOD
   */
  static async generateDiverseContent(): Promise<ContentGenerationResult> {
    const startTime = Date.now();
    console.log('🎨 Starting enhanced diverse content generation...');

    try {
      // Get trending context for enhanced relevance
      const trendingContext = await trendingTopicsEngine.getTrendingContext();
      console.log(`🔥 Trending focus: ${trendingContext.primaryTrend.keyword}`);

      // Select optimal template using A/B testing
      const selectedTemplate = await this.selectOptimalTemplate(trendingContext);
      if (!selectedTemplate) {
        return this.createErrorResult('Failed to select template', startTime);
      }

      console.log(`📋 Using template: ${selectedTemplate.name} (${selectedTemplate.type})`);

      // Generate content with uniqueness validation
      const contentResult = await this.generateUniqueContent(
        selectedTemplate,
        trendingContext
      );

      if (!contentResult.success) {
        return this.createErrorResult(contentResult.error || 'Content generation failed', startTime);
      }

      // Store usage and performance data
      await this.recordContentGeneration(selectedTemplate.id, contentResult.content, trendingContext);

      return {
        success: true,
        content: contentResult.content,
        type: selectedTemplate.type,
        metadata: {
          template_id: selectedTemplate.id,
          trending_topic: trendingContext.primaryTrend.keyword,
          similarity_score: contentResult.similarity_score,
          attempts_made: contentResult.attempts_made,
          generation_time_ms: Date.now() - startTime,
          quality_score: this.calculateQualityScore(contentResult.content, trendingContext),
          core_idea_fingerprint: contentResult.uniqueness_analysis?.ideaFingerprint,
          core_idea_category: contentResult.uniqueness_analysis?.coreIdeaAnalysis?.idea_category,
          novelty_reasons: contentResult.uniqueness_analysis?.coreIdeaAnalysis?.novelty_reasons
        },
        uniqueness_analysis: contentResult.uniqueness_analysis
      };

    } catch (error) {
      console.error('❌ Enhanced content generation failed:', error);
      return this.createErrorResult(
        error instanceof Error ? error.message : 'Unknown error',
        startTime
      );
    }
  }

  /**
   * 📋 SELECT OPTIMAL TEMPLATE
   */
  private static async selectOptimalTemplate(trendingContext: any): Promise<ContentTemplate | null> {
    try {
      // Determine content type based on trending context and time
      const contentType = this.determineOptimalContentType(trendingContext);
      
      // Get best template using A/B testing framework
      const template = await promptTemplateManager.selectTemplateForTest(contentType, 'friendly');
      
      if (!template) {
        console.warn('⚠️ No template found, using fallback');
        return this.getFallbackTemplate(contentType);
      }

      return {
        id: template.id,
        name: template.name,
        template: template.template,
        type: template.type,
        tone: template.tone,
        placeholders: this.extractPlaceholders(template.template)
      };

    } catch (error) {
      console.error('❌ Template selection failed:', error);
      return this.getFallbackTemplate('health_tip');
    }
  }

  /**
   * 🧠 GENERATE UNIQUE CONTENT
   */
  private static async generateUniqueContent(
    template: ContentTemplate,
    trendingContext: any
  ): Promise<{
    success: boolean;
    content: string;
    similarity_score: number;
    attempts_made: number;
    uniqueness_analysis?: any;
    error?: string;
  }> {
    let attempts = 0;
    let bestContent = '';
    let bestSimilarityScore = 1.0;

    while (attempts < this.MAX_GENERATION_ATTEMPTS) {
      attempts++;
      console.log(`🔄 Generation attempt ${attempts}/${this.MAX_GENERATION_ATTEMPTS}`);

      try {
        // Build dynamic prompt with trending context
        const prompt = this.buildEnhancedPrompt(template, trendingContext, attempts);
        
        // Generate content using enhanced AI client
        const aiResponse = await enhancedOpenAIClient.generateContent(prompt, {
          model: 'gpt-4o-mini',
          max_tokens: 150,
          temperature: 0.7 + (attempts * 0.02), // Increase creativity with attempts
          operation_type: 'diverse_content_generation',
          include_trending: true,
          fallback_to_cache: attempts > 20 // Use cache for later attempts
        });

        if (!aiResponse.success || !aiResponse.content) {
          console.warn(`⚠️ AI generation failed on attempt ${attempts}: ${aiResponse.error}`);
          continue;
        }

        const candidateContent = this.processAndCleanContent(aiResponse.content);
        
        // Validate content quality
        if (!this.isContentValid(candidateContent)) {
          console.warn(`⚠️ Content validation failed on attempt ${attempts}`);
          continue;
        }

        // Check semantic uniqueness (including core idea analysis)
        const uniquenessResult = await enhancedSemanticUniqueness.checkUniqueness(
          candidateContent,
          attempts
        );

        if (!uniquenessResult.success) {
          console.warn(`⚠️ Uniqueness check failed on attempt ${attempts}: ${uniquenessResult.error}`);
          continue;
        }

        // Track best content seen
        if (uniquenessResult.analysis.maxSimilarity < bestSimilarityScore) {
          bestContent = candidateContent;
          bestSimilarityScore = uniquenessResult.analysis.maxSimilarity;
        }

        // Content is unique enough (both text and core idea)
        if (uniquenessResult.isUnique) {
          console.log(`✅ Unique content generated on attempt ${attempts}`);
          console.log(`📊 Text similarity: ${uniquenessResult.analysis.maxSimilarity.toFixed(3)}`);
          if (uniquenessResult.analysis.coreIdeaAnalysis) {
            console.log(`🧠 Core idea: ${uniquenessResult.analysis.coreIdeaAnalysis.main_claim} (${uniquenessResult.analysis.coreIdeaAnalysis.idea_category})`);
          }
          
          return {
            success: true,
            content: candidateContent,
            similarity_score: uniquenessResult.analysis.maxSimilarity,
            attempts_made: attempts,
            uniqueness_analysis: uniquenessResult.analysis
          };
        }

        // Log why content was rejected
        if (uniquenessResult.analysis.coreIdeaAnalysis) {
          console.log(`🧠 Core idea rejected: ${uniquenessResult.analysis.coreIdeaAnalysis.novelty_reasons?.join(', ') || 'Too similar to existing idea'}`);
        }
        console.log(`🔄 Content similarity too high (${uniquenessResult.analysis.maxSimilarity.toFixed(3)} > 0.88), trying again...`);

      } catch (error) {
        console.error(`❌ Attempt ${attempts} failed:`, error);
      }
    }

    // Max attempts reached - use best content found or fallback
    if (bestContent && bestSimilarityScore < 0.95) {
      console.warn(`⚠️ Max attempts reached, using best content found (similarity: ${bestSimilarityScore.toFixed(3)})`);
      return {
        success: true,
        content: bestContent,
        similarity_score: bestSimilarityScore,
        attempts_made: attempts
      };
    }

    console.error('❌ Failed to generate unique content after maximum attempts');
    return {
      success: false,
      content: '',
      similarity_score: 1.0,
      attempts_made: attempts,
      error: 'Failed to generate unique content after maximum attempts'
    };
  }

  /**
   * 📝 BUILD ENHANCED PROMPT
   */
  private static buildEnhancedPrompt(
    template: ContentTemplate,
    trendingContext: any,
    attemptNumber: number
  ): string {
    // Base prompt with template
    let prompt = `Create a compelling health tweet using this structure: "${template.template}"

${trendingContext.contextualPrompt}

TRENDING HASHTAGS: ${trendingContext.hashtags.join(', ')}

CRITICAL REQUIREMENTS:
- Must be completely unique and never repeat previous content
- Incorporate trending topic "${trendingContext.primaryTrend.keyword}" naturally
- Use ${template.tone} tone throughout
- Include specific data, numbers, or actionable insights
- Keep under 280 characters
- Be engaging and shareable
- Avoid generic health advice`;

    // Add attempt-specific variations
    if (attemptNumber > 5) {
      prompt += `\n\nATTEMPT ${attemptNumber}: Be more creative and unique. Try a completely different angle or approach.`;
    }

    if (attemptNumber > 15) {
      prompt += `\n\nHIGH CREATIVITY MODE: Use unexpected connections, contrarian views, or surprising insights.`;
    }

    if (attemptNumber > 25) {
      prompt += `\n\nMAXIMUM UNIQUENESS: Create completely novel content that no one has seen before.`;
    }

    // Add template-specific guidance
    const templateGuidance = this.getTemplateSpecificGuidance(template.type);
    if (templateGuidance) {
      prompt += `\n\n${templateGuidance}`;
    }

    return prompt;
  }

  /**
   * 🧹 PROCESS AND CLEAN CONTENT
   */
  private static processAndCleanContent(rawContent: string): string {
    return rawContent
      .trim()
      .replace(/^"|"$/g, '') // Remove surrounding quotes
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .substring(0, 275) // Ensure Twitter limit
      .trim();
  }

  /**
   * ✅ VALIDATE CONTENT QUALITY
   */
  private static isContentValid(content: string): boolean {
    // Length check
    if (content.length < 50 || content.length > 280) {
      return false;
    }

    // Basic quality checks
    if (content.toLowerCase().includes('as an ai') || 
        content.toLowerCase().includes('i cannot') ||
        content.toLowerCase().includes('sorry')) {
      return false;
    }

    // Must contain actionable content
    const actionWords = ['did you know', 'try', 'can', 'will', 'should', 'boost', 'improve', 'reduce', 'increase'];
    const hasActionableContent = actionWords.some(word => 
      content.toLowerCase().includes(word)
    );

    return hasActionableContent;
  }

  /**
   * 🎯 DETERMINE OPTIMAL CONTENT TYPE
   */
  private static determineOptimalContentType(trendingContext: any): string {
    const hour = new Date().getHours();
    const category = trendingContext.primaryTrend.category;

    // Time-based content type selection
    if (hour < 10) {
      return 'health_tip'; // Morning motivation
    } else if (hour < 16) {
      return 'data_driven'; // Afternoon insights
    } else {
      return 'discovery'; // Evening discoveries
    }
  }

  /**
   * 📊 CALCULATE QUALITY SCORE
   */
  private static calculateQualityScore(content: string, trendingContext: any): number {
    let score = 5; // Base score

    // Length optimization (240-270 chars is optimal)
    if (content.length >= 240 && content.length <= 270) score += 1;
    
    // Trending topic integration
    if (content.toLowerCase().includes(trendingContext.primaryTrend.keyword.toLowerCase())) {
      score += 2;
    }

    // Question engagement (questions drive replies)
    if (content.includes('?')) score += 1;

    // Data/numbers (increases credibility)
    if (/\d+/.test(content)) score += 1;

    // Hashtag usage (increases discoverability)
    if (content.includes('#')) score += 0.5;

    return Math.min(score, 10);
  }

  /**
   * 📊 RECORD CONTENT GENERATION
   */
  private static async recordContentGeneration(
    templateId: string,
    content: string,
    trendingContext: any
  ): Promise<void> {
    try {
      await supabaseClient.supabase
        .from('content_generation_log')
        .insert({
          template_id: templateId,
          content_preview: content.substring(0, 100),
          trending_topic: trendingContext.primaryTrend.keyword,
          content_type: 'diverse_content',
          generated_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('❌ Failed to record content generation:', error);
    }
  }

  /**
   * 🔧 HELPER METHODS
   */
  private static extractPlaceholders(template: string): string[] {
    const matches = template.match(/\{[^}]+\}/g);
    return matches ? matches.map(match => match.slice(1, -1)) : [];
  }

  private static getTemplateSpecificGuidance(type: string): string {
    const guidance = {
      health_tip: "Focus on actionable, specific health advice with measurable benefits.",
      myth_buster: "Debunk common health misconceptions with scientific evidence.",
      discovery: "Share surprising health insights or recent research findings.",
      data_driven: "Lead with compelling statistics or research-backed claims.",
      viral_hook: "Create curiosity gaps and compelling hooks that demand engagement."
    };

    return guidance[type as keyof typeof guidance] || '';
  }

  private static getFallbackTemplate(contentType: string): ContentTemplate {
    return {
      id: 'fallback_template',
      name: 'Fallback Health Tip',
      template: 'Health insight: {insight}. The science: {explanation}. Try this: {action}',
      type: contentType,
      tone: 'friendly',
      placeholders: ['insight', 'explanation', 'action']
    };
  }

  private static createErrorResult(error: string, startTime: number): ContentGenerationResult {
    return {
      success: false,
      content: '',
      type: 'error',
      metadata: {
        attempts_made: 0,
        generation_time_ms: Date.now() - startTime,
        quality_score: 0
      },
      error
    };
  }

  /**
   * 📈 PERFORMANCE ANALYTICS
   */
  static async getGenerationAnalytics(): Promise<{
    total_generations: number;
    success_rate: number;
    average_attempts: number;
    top_templates: { template_id: string; usage_count: number }[];
    trending_topic_usage: { topic: string; usage_count: number }[];
  }> {
    try {
      const { data, error } = await supabaseClient.supabase
        .rpc('get_content_generation_analytics');

      if (error) throw error;

      return data || {
        total_generations: 0,
        success_rate: 0,
        average_attempts: 0,
        top_templates: [],
        trending_topic_usage: []
      };
    } catch (error) {
      console.error('❌ Failed to get generation analytics:', error);
      return {
        total_generations: 0,
        success_rate: 0,
        average_attempts: 0,
        top_templates: [],
        trending_topic_usage: []
      };
    }
  }
}

export const enhancedDiverseContentAgent = EnhancedDiverseContentAgent; 