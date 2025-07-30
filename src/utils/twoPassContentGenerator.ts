/**
 * 📝 TWO-PASS CONTENT GENERATOR
 * Generates content with draft → self-critique → final approval workflow
 */

import { BudgetAwareOpenAI } from './budgetAwareOpenAI';
import { supabaseClient } from './supabaseClient';
import { SmartModelSelector } from './smartModelSelector';

export interface ContentGenerationRequest {
  format_type: string;
  hook_type: string;
  content_category: string;
  target_length?: 'short' | 'medium' | 'long';
  quality_threshold?: number; // 0-100
  max_attempts?: number;
}

export interface ContentGenerationResult {
  success: boolean;
  final_content?: string;
  session_id?: string;
  quality_scores?: {
    grammar: number;
    completeness: number;
    virality_potential: number;
  };
  generation_stats?: {
    attempts: number;
    total_cost: number;
    total_time_ms: number;
  };
  error?: string;
}

export class TwoPassContentGenerator {
  private static instance: TwoPassContentGenerator;
  
  static getInstance(): TwoPassContentGenerator {
    if (!this.instance) {
      this.instance = new TwoPassContentGenerator();
    }
    return this.instance;
  }

  /**
   * 🎯 Generate content with two-pass workflow
   */
  async generateContent(request: ContentGenerationRequest): Promise<ContentGenerationResult> {
    const sessionId = `tpcg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    let totalCost = 0;
    let attempts = 0;
    const maxAttempts = request.max_attempts || 3;
    const qualityThreshold = request.quality_threshold || 55;

    try {
      console.log('📝 === TWO-PASS CONTENT GENERATION ===');
      console.log(`🆔 Session: ${sessionId}`);
      console.log(`🎯 Target: ${request.format_type}/${request.hook_type}/${request.content_category}`);

      // Create session record
      await this.createSession(sessionId, request);

      while (attempts < maxAttempts) {
        attempts++;
        console.log(`\n🔄 Attempt ${attempts}/${maxAttempts}`);

        // PASS 1: Generate draft content
        const draftResult = await this.generateDraft(sessionId, request);
        if (!draftResult.success) {
          console.log(`❌ Draft generation failed: ${draftResult.error}`);
          continue;
        }

        totalCost += draftResult.cost || 0;
        console.log(`📄 Draft generated (${draftResult.content?.length} chars)`);

        // PASS 2: Self-critique
        const critiqueResult = await this.generateCritique(sessionId, draftResult.content!);
        if (!critiqueResult.success) {
          console.log(`❌ Critique failed: ${critiqueResult.error}`);
          continue;
        }

        totalCost += critiqueResult.cost || 0;
        console.log(`📊 Critique score: ${critiqueResult.score}/100`);

        // Check if content meets quality threshold
        if (critiqueResult.score >= qualityThreshold) {
          // PASS 3: Final content (apply critique suggestions)
          const finalResult = await this.generateFinalContent(
            sessionId, 
            draftResult.content!, 
            critiqueResult.feedback!
          );

          if (finalResult.success) {
            totalCost += finalResult.cost || 0;
            
            // Mark session as approved
            await this.markSessionApproved(sessionId, finalResult.content!);

            const totalTime = Date.now() - startTime;
            console.log(`✅ Content generation successful in ${totalTime}ms`);

            return {
              success: true,
              final_content: finalResult.content,
              session_id: sessionId,
              quality_scores: {
                grammar: critiqueResult.grammar_score || 0,
                completeness: critiqueResult.completeness_score || 0,
                virality_potential: critiqueResult.virality_potential || 0
              },
              generation_stats: {
                attempts,
                total_cost: totalCost,
                total_time_ms: totalTime
              }
            };
          }
        } else {
          console.log(`⚠️ Quality threshold not met (${critiqueResult.score} < ${qualityThreshold})`);
          await this.recordRejection(sessionId, `Quality score ${critiqueResult.score} below threshold ${qualityThreshold}`);
        }
      }

      // All attempts failed
      const totalTime = Date.now() - startTime;
      await this.markSessionRejected(sessionId, `Failed to meet quality threshold after ${maxAttempts} attempts`);

      return {
        success: false,
        session_id: sessionId,
        generation_stats: {
          attempts,
          total_cost: totalCost,
          total_time_ms: totalTime
        },
        error: `Failed to generate acceptable content after ${maxAttempts} attempts`
      };

    } catch (error) {
      console.error('❌ Two-pass content generation failed:', error);
      await this.markSessionRejected(sessionId, error instanceof Error ? error.message : 'Unknown error');

      return {
        success: false,
        session_id: sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Helper methods implementation would go here...
  private async createSession(sessionId: string, request: ContentGenerationRequest): Promise<void> {
    // Implementation
  }

  private async generateDraft(sessionId: string, request: ContentGenerationRequest): Promise<any> {
    // Implementation
  }

  private async generateCritique(sessionId: string, content: string): Promise<any> {
    // Implementation
  }

  private async generateFinalContent(sessionId: string, draft: string, feedback: any): Promise<any> {
    // Implementation
  }

  private async markSessionApproved(sessionId: string, content: string): Promise<void> {
    // Implementation
  }

  private async markSessionRejected(sessionId: string, reason: string): Promise<void> {
    // Implementation
  }

  private async recordRejection(sessionId: string, reason: string): Promise<void> {
    // Implementation
  }
}

export const twoPassContentGenerator = TwoPassContentGenerator.getInstance();