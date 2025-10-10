/**
 * 🎯 PRODUCTION-SAFE CONTENT INTEGRATION
 * Connects lightweight posting with high-quality content generators
 */

import { DiverseContentGenerator } from '../ai/diverseContentGenerator';
import { ComprehensiveAISystem } from '../ai/comprehensiveAISystem';
import { EnhancedContentOrchestrator } from '../ai/enhancedContentOrchestrator';

export class ProductionContentManager {
  private static instance: ProductionContentManager;
  private diverseGenerator = DiverseContentGenerator.getInstance();
  private aiSystem = ComprehensiveAISystem.getInstance();
  private orchestrator = EnhancedContentOrchestrator.getInstance();

  static getInstance(): ProductionContentManager {
    if (!ProductionContentManager.instance) {
      ProductionContentManager.instance = new ProductionContentManager();
    }
    return ProductionContentManager.instance;
  }

  /**
   * 🎨 GENERATE HIGH-QUALITY CONTENT (Never test content!)
   */
  async generateProductionContent(): Promise<{
    content: string;
    quality_score: number;
    content_type: string;
    is_test: boolean;
  }> {
    console.log('🎨 PRODUCTION_CONTENT: Generating high-quality diverse content...');
    
    // Step 1: Generate diverse content with human voice
    const diverseResult = await this.diverseGenerator.generateDiverseContent({
      format: Math.random() > 0.7 ? 'thread' : 'single',
      avoid_recent_patterns: true,
      target_engagement: 'high'
    });

    // Step 2: Enhance with comprehensive AI system
    const aiResult = await this.aiSystem.generateInfiniteVarietyContent();
    
    // Step 3: Final orchestration for maximum quality
    const finalResult = await this.orchestrator.generateEnhancedContent({
      format: diverseResult.content.length > 1 ? 'thread' : 'single',
      target_engagement: 'high',
      avoid_recent_patterns: true
    });

    // Use the best content from orchestrator
    const content = Array.isArray(finalResult.content) 
      ? finalResult.content.join('\n\n') 
      : finalResult.content;

    console.log(`✅ PRODUCTION_CONTENT: Generated ${finalResult.metadata.content_type} with ${finalResult.metadata.human_voice_score}% human voice`);
    console.log(`🎯 Quality: ${finalResult.metadata.diversity_score}% diversity, ${finalResult.metadata.predicted_performance.engagement_rate} predicted ER`);

    return {
      content,
      quality_score: finalResult.metadata.diversity_score,
      content_type: finalResult.metadata.content_type,
      is_test: false
    };
  }

  /**
   * 🚫 BLOCK TEST CONTENT IN PRODUCTION
   */
  isTestContent(content: string): boolean {
    const testPatterns = [
      'test',
      'testing',
      '🧪',
      'final test',
      'system working',
      'Thu Oct',
      'EDT 2025',
      new Date().toDateString().toLowerCase()
    ];

    const lowerContent = content.toLowerCase();
    return testPatterns.some(pattern => lowerContent.includes(pattern));
  }

  /**
   * 🛡️ PRODUCTION SAFETY CHECK
   */
  async validateProductionContent(content: string): Promise<{
    safe_to_post: boolean;
    reason?: string;
    quality_score: number;
  }> {
    // Block all test content
    if (this.isTestContent(content)) {
      return {
        safe_to_post: false,
        reason: 'Test content blocked in production',
        quality_score: 0
      };
    }

    // Check content length
    if (content.length < 50) {
      return {
        safe_to_post: false,
        reason: 'Content too short for production',
        quality_score: 0
      };
    }

    // Check for placeholder content
    if (content.includes('health fact #') || content.includes('Did you know that health')) {
      return {
        safe_to_post: false,
        reason: 'Placeholder content not allowed in production',
        quality_score: 0
      };
    }

    // Calculate quality score (simplified)
    let qualityScore = 50; // Base score
    
    // Bonus for length
    if (content.length > 100) qualityScore += 10;
    if (content.length > 200) qualityScore += 10;
    
    // Bonus for engagement elements
    if (content.includes('?')) qualityScore += 10; // Questions
    if (content.match(/\d+%/)) qualityScore += 5; // Statistics
    if (content.includes('study') || content.includes('research')) qualityScore += 10;
    
    // Penalty for low effort
    if (content.split(' ').length < 10) qualityScore -= 20;
    
    return {
      safe_to_post: qualityScore >= 60,
      reason: qualityScore < 60 ? `Quality score too low: ${qualityScore}/100` : undefined,
      quality_score: qualityScore
    };
  }
}
