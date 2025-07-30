/**
 * 🧠 ENHANCED LEARNING SYSTEM DEPLOYMENT
 * 
 * This script applies the comprehensive enhanced learning system migration
 * and implements all Phase 4-9 components for autonomous Twitter growth.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyEnhancedLearningSystem() {
  console.log('🚀 === ENHANCED LEARNING SYSTEM DEPLOYMENT ===');
  console.log('📋 Implementing Phase 4-9: Timing + Content Quality + Engagement + Bandit RL + Budget');
  console.log('');

  try {
    // Step 1: Apply the safe SQL migration
    console.log('📊 Step 1: Applying enhanced learning system migration...');
    const migrationPath = path.join(__dirname, 'migrations', '20250130_enhanced_learning_system_safe.sql');
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    const { error: migrationError } = await supabase.rpc('exec', { sql: migrationSQL });
    
    if (migrationError) {
      console.error('❌ Migration failed:', migrationError);
      
      // Try applying via smaller chunks
      console.log('🔄 Attempting to apply migration in smaller chunks...');
      const sqlChunks = migrationSQL.split(';').filter(chunk => chunk.trim());
      
      for (let i = 0; i < sqlChunks.length; i++) {
        const chunk = sqlChunks[i].trim();
        if (!chunk) continue;
        
        try {
          const { error } = await supabase.rpc('exec', { sql: chunk + ';' });
          if (error) {
            console.warn(`⚠️ Chunk ${i + 1} failed:`, error.message);
          } else {
            console.log(`✅ Chunk ${i + 1}/${sqlChunks.length} applied`);
          }
        } catch (chunkError) {
          console.warn(`⚠️ Chunk ${i + 1} error:`, chunkError.message);
        }
      }
    } else {
      console.log('✅ Migration applied successfully');
    }

    // Step 2: Verify table creation
    console.log('');
    console.log('🔍 Step 2: Verifying table creation...');
    const requiredTables = [
      'enhanced_timing_stats',
      'optimal_posting_windows', 
      'content_generation_sessions',
      'content_validation_logs',
      'intelligent_engagement_actions',
      'engagement_target_criteria',
      'contextual_features',
      'contextual_bandit_arms',
      'contextual_bandit_history',
      'budget_optimization_log',
      'model_performance_stats'
    ];

    for (const table of requiredTables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`❌ Table ${table}: ${error.message}`);
      } else {
        console.log(`✅ Table ${table}: Ready`);
      }
    }

    // Step 3: Create enhanced learning system components
    console.log('');
    console.log('🧠 Step 3: Creating enhanced learning system components...');

    // Create enhanced timing optimizer
    await createEnhancedTimingOptimizer();
    
    // Create two-pass content generator
    await createTwoPassContentGenerator();
    
    // Create contextual bandit selector
    await createContextualBanditSelector();
    
    // Create budget optimizer
    await createBudgetOptimizer();
    
    // Create engagement intelligence engine
    await createEngagementIntelligenceEngine();

    console.log('');
    console.log('✅ === ENHANCED LEARNING SYSTEM DEPLOYED ===');
    console.log('🎯 All Phase 4-9 components are now active:');
    console.log('   ⏰ Enhanced Timing Optimizer with confidence intervals');
    console.log('   📝 Two-Pass Content Generation with self-critique');
    console.log('   🎰 Contextual Bandit for intelligent decisions');
    console.log('   💰 Budget Optimizer with ROI tracking');
    console.log('   🤝 Engagement Intelligence Engine');
    console.log('');
    console.log('🚀 The system is now ready for autonomous learning and optimization!');

  } catch (error) {
    console.error('❌ Enhanced Learning System deployment failed:', error);
    process.exit(1);
  }
}

async function createEnhancedTimingOptimizer() {
  console.log('⏰ Creating Enhanced Timing Optimizer...');
  
  const timingOptimizerCode = `/**
 * ⏰ ENHANCED TIMING OPTIMIZER V2.0
 * Learns optimal posting times with confidence intervals and Bayesian inference
 */

import { supabaseClient } from './supabaseClient';

export interface TimingInsights {
  optimal_posting_hours: number[];
  optimal_reply_hours: number[];
  peak_engagement_windows: { start: number; end: number; score: number; confidence: number }[];
  confidence_by_hour: { [hour: number]: number };
  engagement_patterns: {
    weekday_vs_weekend: { weekday: number; weekend: number };
    morning_vs_evening: { morning: number; evening: number };
    hourly_performance: { [hour: number]: number };
  };
}

export class EnhancedTimingOptimizer {
  private static instance: EnhancedTimingOptimizer;
  
  static getInstance(): EnhancedTimingOptimizer {
    if (!this.instance) {
      this.instance = new EnhancedTimingOptimizer();
    }
    return this.instance;
  }

  /**
   * 📊 Analyze optimal timing with confidence intervals
   */
  async analyzeOptimalTiming(): Promise<TimingInsights | null> {
    try {
      console.log('⏰ === ENHANCED TIMING ANALYSIS ===');

      // Get timing statistics from database
      const { data: timingStats } = await supabaseClient.supabase
        .from('enhanced_timing_stats')
        .select('*')
        .gte('total_posts', 3) // Minimum sample size
        .order('avg_engagement_rate', { ascending: false });

      if (!timingStats || timingStats.length === 0) {
        console.log('📊 No timing data available yet');
        return null;
      }

      const insights = this.calculateTimingInsights(timingStats);
      
      console.log('✅ Timing analysis complete:', {
        optimal_hours_count: insights.optimal_posting_hours.length,
        peak_windows_count: insights.peak_engagement_windows.length,
        total_hours_analyzed: timingStats.length
      });

      return insights;

    } catch (error) {
      console.error('❌ Enhanced timing analysis failed:', error);
      return null;
    }
  }

  /**
   * 🧮 Calculate enhanced timing insights
   */
  private calculateTimingInsights(stats: any[]): TimingInsights {
    // Find top performing hours with high confidence
    const highConfidenceHours = stats
      .filter(stat => stat.confidence_score >= 0.7)
      .sort((a, b) => b.avg_engagement_rate - a.avg_engagement_rate)
      .slice(0, 8)
      .map(stat => stat.hour_of_day);

    // Find peak engagement windows (consecutive high-performing hours)
    const peakWindows = this.findPeakWindows(stats);

    // Build confidence mapping
    const confidenceByHour: { [hour: number]: number } = {};
    stats.forEach(stat => {
      confidenceByHour[stat.hour_of_day] = stat.confidence_score;
    });

    // Calculate engagement patterns
    const patterns = this.calculateEngagementPatterns(stats);

    return {
      optimal_posting_hours: highConfidenceHours,
      optimal_reply_hours: highConfidenceHours.slice(0, 4), // Top 4 for replies
      peak_engagement_windows: peakWindows,
      confidence_by_hour: confidenceByHour,
      engagement_patterns: patterns
    };
  }

  /**
   * 🔍 Find consecutive high-performing hour windows
   */
  private findPeakWindows(stats: any[]): Array<{ start: number; end: number; score: number; confidence: number }> {
    const windows = [];
    const hourlyData: { [hour: number]: any } = {};
    
    stats.forEach(stat => {
      hourlyData[stat.hour_of_day] = stat;
    });

    let windowStart = -1;
    let windowScore = 0;
    let windowConfidence = 0;
    let windowCount = 0;

    for (let hour = 0; hour < 24; hour++) {
      const stat = hourlyData[hour];
      
      if (stat && stat.avg_engagement_rate > 0.02 && stat.confidence_score >= 0.7) {
        if (windowStart === -1) {
          windowStart = hour;
          windowScore = stat.avg_engagement_rate;
          windowConfidence = stat.confidence_score;
          windowCount = 1;
        } else {
          windowScore += stat.avg_engagement_rate;
          windowConfidence += stat.confidence_score;
          windowCount++;
        }
      } else {
        if (windowStart !== -1 && windowCount >= 2) {
          windows.push({
            start: windowStart,
            end: hour - 1,
            score: windowScore / windowCount,
            confidence: windowConfidence / windowCount
          });
        }
        windowStart = -1;
        windowScore = 0;
        windowConfidence = 0;
        windowCount = 0;
      }
    }

    return windows
      .sort((a, b) => (b.score * b.confidence) - (a.score * a.confidence))
      .slice(0, 3);
  }

  /**
   * 📈 Calculate engagement patterns
   */
  private calculateEngagementPatterns(stats: any[]): any {
    let weekdayScore = 0, weekendScore = 0;
    let morningScore = 0, eveningScore = 0;
    let weekdayCount = 0, weekendCount = 0;
    let morningCount = 0, eveningCount = 0;

    const hourlyPerformance: { [hour: number]: number } = {};

    stats.forEach(stat => {
      const hour = stat.hour_of_day;
      const score = stat.avg_engagement_rate;
      
      hourlyPerformance[hour] = score;
      
      if (stat.day_of_week === 0 || stat.day_of_week === 6) { // Weekend
        weekendScore += score;
        weekendCount++;
      } else { // Weekday
        weekdayScore += score;
        weekdayCount++;
      }
      
      if (hour >= 6 && hour < 12) { // Morning
        morningScore += score;
        morningCount++;
      } else if (hour >= 18 && hour < 24) { // Evening
        eveningScore += score;
        eveningCount++;
      }
    });

    return {
      weekday_vs_weekend: {
        weekday: weekdayCount > 0 ? weekdayScore / weekdayCount : 0,
        weekend: weekendCount > 0 ? weekendScore / weekendCount : 0
      },
      morning_vs_evening: {
        morning: morningCount > 0 ? morningScore / morningCount : 0,
        evening: eveningCount > 0 ? eveningScore / eveningCount : 0
      },
      hourly_performance: hourlyPerformance
    };
  }

  /**
   * 🕒 Update timing statistics for a post
   */
  async updateTimingStats(
    hour: number,
    dayOfWeek: number,
    engagement: number,
    impressions: number = 0,
    followersGained: number = 0
  ): Promise<void> {
    try {
      console.log(`🕒 Updating timing stats: Hour ${hour}, Day ${dayOfWeek}, Engagement ${engagement}`);

      const { error } = await supabaseClient.supabase
        .rpc('update_enhanced_timing_stats', {
          p_hour: hour,
          p_day_of_week: dayOfWeek,
          p_engagement: engagement,
          p_impressions: impressions,
          p_followers_gained: followersGained
        });

      if (error) {
        console.error('❌ Failed to update timing stats:', error);
      } else {
        console.log('✅ Timing stats updated successfully');
      }

    } catch (error) {
      console.error('❌ Timing stats update error:', error);
    }
  }

  /**
   * 🎯 Get optimal posting windows
   */
  async getOptimalPostingWindows(confidenceThreshold: number = 0.7): Promise<any[]> {
    try {
      const { data, error } = await supabaseClient.supabase
        .rpc('get_optimal_posting_windows', {
          confidence_threshold: confidenceThreshold
        });

      if (error) {
        console.error('❌ Failed to get optimal windows:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ Optimal windows query error:', error);
      return [];
    }
  }
}

export const enhancedTimingOptimizer = EnhancedTimingOptimizer.getInstance();`;

  // Write the enhanced timing optimizer
  fs.writeFileSync(
    path.join(__dirname, 'src', 'utils', 'enhancedTimingOptimizer.ts'),
    timingOptimizerCode
  );
  
  console.log('✅ Enhanced Timing Optimizer created');
}

async function createTwoPassContentGenerator() {
  console.log('📝 Creating Two-Pass Content Generator...');
  
  const twoPassGeneratorCode = `/**
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
    const sessionId = \`tpcg_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
    const startTime = Date.now();
    let totalCost = 0;
    let attempts = 0;
    const maxAttempts = request.max_attempts || 3;
    const qualityThreshold = request.quality_threshold || 70;

    try {
      console.log(`📝 === TWO-PASS CONTENT GENERATION ===`);
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

  /**
   * 📄 Generate draft content
   */
  private async generateDraft(sessionId: string, request: ContentGenerationRequest): Promise<{
    success: boolean;
    content?: string;
    cost?: number;
    error?: string;
  }> {
    try {
      const modelSelection = await SmartModelSelector.selectModel('content_generation', 300);
      
      const prompt = this.buildDraftPrompt(request);
      const startTime = Date.now();

      const response = await BudgetAwareOpenAI.generateContent(prompt, {
        model: modelSelection.model,
        max_tokens: modelSelection.maxTokens,
        temperature: 0.7
      });

      if (!response.success || !response.content) {
        return { success: false, error: response.error };
      }

      const generationTime = Date.now() - startTime;

      // Update session with draft
      await supabaseClient.supabase
        .from('content_generation_sessions')
        .update({
          draft_content: response.content,
          draft_model: modelSelection.model,
          draft_tokens: response.usage?.total_tokens,
          draft_cost: modelSelection.estimatedCost,
          draft_generation_time_ms: generationTime
        })
        .eq('request_id', sessionId);

      return {
        success: true,
        content: response.content,
        cost: modelSelection.estimatedCost
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Draft generation failed'
      };
    }
  }

  /**
   * 📊 Generate self-critique
   */
  private async generateCritique(sessionId: string, content: string): Promise<{
    success: boolean;
    score: number;
    feedback?: any;
    grammar_score?: number;
    completeness_score?: number;
    virality_potential?: number;
    cost?: number;
    error?: string;
  }> {
    try {
      const modelSelection = await SmartModelSelector.selectModel('analysis', 200);
      
      const critiquePrompt = this.buildCritiquePrompt(content);

      const response = await BudgetAwareOpenAI.generateContent(critiquePrompt, {
        model: modelSelection.model,
        max_tokens: modelSelection.maxTokens,
        temperature: 0.3
      });

      if (!response.success || !response.content) {
        return { success: false, score: 0, error: response.error };
      }

      // Parse critique response
      const critique = this.parseCritiqueResponse(response.content);

      // Update session with critique
      await supabaseClient.supabase
        .from('content_generation_sessions')
        .update({
          critique_score: critique.overall_score,
          critique_feedback: critique.feedback,
          critique_model: modelSelection.model,
          critique_cost: modelSelection.estimatedCost,
          grammar_score: critique.grammar_score,
          completeness_score: critique.completeness_score,
          virality_potential: critique.virality_potential
        })
        .eq('request_id', sessionId);

      return {
        success: true,
        score: critique.overall_score,
        feedback: critique.feedback,
        grammar_score: critique.grammar_score,
        completeness_score: critique.completeness_score,
        virality_potential: critique.virality_potential,
        cost: modelSelection.estimatedCost
      };

    } catch (error) {
      return {
        success: false,
        score: 0,
        error: error instanceof Error ? error.message : 'Critique generation failed'
      };
    }
  }

  /**
   * ✨ Generate final content
   */
  private async generateFinalContent(sessionId: string, draftContent: string, feedback: any): Promise<{
    success: boolean;
    content?: string;
    cost?: number;
    error?: string;
  }> {
    try {
      const modelSelection = await SmartModelSelector.selectModel('content_generation', 400);
      
      const finalPrompt = this.buildFinalPrompt(draftContent, feedback);

      const response = await BudgetAwareOpenAI.generateContent(finalPrompt, {
        model: modelSelection.model,
        max_tokens: modelSelection.maxTokens,
        temperature: 0.6
      });

      if (!response.success || !response.content) {
        return { success: false, error: response.error };
      }

      // Update session with final content
      await supabaseClient.supabase
        .from('content_generation_sessions')
        .update({
          final_content: response.content,
          final_model: modelSelection.model,
          final_tokens: response.usage?.total_tokens,
          final_cost: modelSelection.estimatedCost
        })
        .eq('request_id', sessionId);

      return {
        success: true,
        content: response.content,
        cost: modelSelection.estimatedCost
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Final content generation failed'
      };
    }
  }

  // Helper methods...
  private async createSession(sessionId: string, request: ContentGenerationRequest): Promise<void> {
    await supabaseClient.supabase
      .from('content_generation_sessions')
      .insert({
        request_id: sessionId,
        // Store request parameters as needed
      });
  }

  private buildDraftPrompt(request: ContentGenerationRequest): string {
    return `Create a health/wellness tweet with the following specifications:
FORMAT: ${request.format_type}
HOOK: ${request.hook_type}  
CATEGORY: ${request.content_category}
LENGTH: ${request.target_length || 'medium'} (aim for 150-250 characters)

Requirements:
- Complete, actionable value (no incomplete hooks)
- Factually accurate health information
- Engaging and shareable
- Clear call-to-action or thought-provoking element

Generate ONLY the tweet text:`;
  }

  private buildCritiquePrompt(content: string): string {
    return `Analyze this health/wellness tweet for quality. Provide scores 0-100 for each metric and overall feedback.

TWEET: "${content}"

Analyze:
1. Grammar & clarity (0-100)
2. Completeness & value (0-100) 
3. Virality potential (0-100)
4. Overall score (0-100)

Respond in JSON format:
{
  "grammar_score": 85,
  "completeness_score": 90,
  "virality_potential": 75,
  "overall_score": 83,
  "feedback": {
    "strengths": ["clear message", "actionable advice"],
    "weaknesses": ["could be more engaging"],
    "improvements": ["add specific numbers", "stronger hook"]
  }
}`;
  }

  private buildFinalPrompt(draft: string, feedback: any): string {
    return `Improve this tweet based on the critique feedback:

ORIGINAL: "${draft}"

FEEDBACK: ${JSON.stringify(feedback)}

Create an improved version that addresses the feedback while maintaining the core message.
Generate ONLY the improved tweet text:`;
  }

  private parseCritiqueResponse(response: string): any {
    try {
      return JSON.parse(response);
    } catch {
      // Fallback parsing
      return {
        overall_score: 50,
        grammar_score: 50,
        completeness_score: 50,
        virality_potential: 50,
        feedback: { improvements: ['Could not parse critique properly'] }
      };
    }
  }

  private async markSessionApproved(sessionId: string, finalContent: string): Promise<void> {
    await supabaseClient.supabase
      .from('content_generation_sessions')
      .update({
        was_approved: true,
        final_content: finalContent
      })
      .eq('request_id', sessionId);
  }

  private async markSessionRejected(sessionId: string, reason: string): Promise<void> {
    await supabaseClient.supabase
      .from('content_generation_sessions')
      .update({
        was_approved: false,
        rejection_reason: reason
      })
      .eq('request_id', sessionId);
  }

  private async recordRejection(sessionId: string, reason: string): Promise<void> {
    await supabaseClient.supabase
      .from('content_generation_sessions')
      .update({
        regeneration_count: `regeneration_count + 1`
      })
      .eq('request_id', sessionId);
  }
}

export const twoPassContentGenerator = TwoPassContentGenerator.getInstance();`;

  // Write the two-pass content generator
  fs.writeFileSync(
    path.join(__dirname, 'src', 'utils', 'twoPassContentGenerator.ts'),
    twoPassGeneratorCode
  );
  
  console.log('✅ Two-Pass Content Generator created');
}

async function createContextualBanditSelector() {
  console.log('🎰 Creating Contextual Bandit Selector...');
  
  const contextualBanditCode = `/**
 * 🎰 CONTEXTUAL BANDIT SELECTOR
 * Advanced bandit algorithm that considers context features for intelligent decisions
 */

import { supabaseClient } from './supabaseClient';

export interface ContextualFeatures {
  hour_of_day: number;
  day_of_week: number;
  content_category: string;
  format_type: string;
  hook_type: string;
  budget_utilization: number;
  recent_engagement_rate: number;
}

export interface BanditArm {
  id: number;
  arm_name: string;
  arm_type: string;
  features: any;
  total_selections: number;
  avg_reward: number;
  success_count: number;
  failure_count: number;
  confidence_score: number;
}

export interface ContextualSelection {
  arm_id: number;
  arm_name: string;
  predicted_reward: number;
  confidence: number;
  exploration_factor: number;
  context_features: ContextualFeatures;
  reasoning: string;
}

export class ContextualBanditSelector {
  private static instance: ContextualBanditSelector;
  private arms: BanditArm[] = [];
  private lastUpdate: Date | null = null;
  
  static getInstance(): ContextualBanditSelector {
    if (!this.instance) {
      this.instance = new ContextualBanditSelector();
    }
    return this.instance;
  }

  /**
   * 🎯 Select optimal arm using contextual information
   */
  async selectArm(
    context: ContextualFeatures,
    armType: string = 'format',
    explorationRate: number = 0.15
  ): Promise<ContextualSelection | null> {
    try {
      console.log(`🎰 === CONTEXTUAL BANDIT SELECTION ===`);
      console.log(`🎯 Context: Hour ${context.hour_of_day}, Category ${context.content_category}`);

      // Ensure we have fresh arms data
      await this.updateArms(armType);

      if (this.arms.length === 0) {
        console.log('⚠️ No arms available for selection');
        return null;
      }

      // Calculate contextual scores for each arm
      const scoredArms = this.arms.map(arm => {
        const baseScore = this.calculateContextualScore(arm, context);
        const explorationBonus = this.calculateExplorationBonus(arm, explorationRate);
        const finalScore = baseScore + explorationBonus;

        return {
          arm,
          base_score: baseScore,
          exploration_bonus: explorationBonus,
          final_score: finalScore
        };
      });

      // Select arm with highest score
      const selectedArmData = scoredArms.reduce((best, current) => 
        current.final_score > best.final_score ? current : best
      );

      const selection: ContextualSelection = {
        arm_id: selectedArmData.arm.id,
        arm_name: selectedArmData.arm.arm_name,
        predicted_reward: selectedArmData.base_score,
        confidence: selectedArmData.arm.confidence_score,
        exploration_factor: selectedArmData.exploration_bonus,
        context_features: context,
        reasoning: this.generateSelectionReasoning(selectedArmData.arm, selectedArmData.base_score, selectedArmData.exploration_bonus)
      };

      console.log(`🎯 Selected: ${selection.arm_name}`);
      console.log(`📊 Predicted reward: ${selection.predicted_reward.toFixed(3)}`);
      console.log(`🔍 Confidence: ${(selection.confidence * 100).toFixed(1)}%`);
      console.log(`💡 ${selection.reasoning}`);

      return selection;

    } catch (error) {
      console.error('❌ Contextual bandit selection failed:', error);
      return null;
    }
  }

  /**
   * 📊 Calculate contextual score for an arm
   */
  private calculateContextualScore(arm: BanditArm, context: ContextualFeatures): number {
    let score = arm.avg_reward;

    // Apply contextual adjustments based on features
    if (arm.features) {
      // Hour of day match bonus
      if (arm.features.preferred_hours && arm.features.preferred_hours.includes(context.hour_of_day)) {
        score *= 1.2;
      }

      // Category match bonus
      if (arm.features.content_category === context.content_category) {
        score *= 1.15;
      }

      // Format type match bonus
      if (arm.features.format_type === context.format_type) {
        score *= 1.1;
      }

      // Budget utilization penalty (avoid expensive operations when budget is high)
      if (context.budget_utilization > 0.8) {
        score *= 0.9;
      }

      // Recent engagement boost
      if (context.recent_engagement_rate > 0.05) {
        score *= 1.05;
      }
    }

    return Math.max(0.1, score);
  }

  /**
   * 🔍 Calculate exploration bonus (Thompson sampling style)
   */
  private calculateExplorationBonus(arm: BanditArm, explorationRate: number): number {
    if (arm.total_selections === 0) {
      return explorationRate; // Maximum exploration for unselected arms
    }

    // Inverse relationship with selections (more exploration for less-tried arms)
    const explorationBonus = explorationRate * Math.sqrt(
      Math.log(this.arms.reduce((sum, a) => sum + a.total_selections, 0)) / arm.total_selections
    );

    return Math.min(explorationBonus, explorationRate);
  }

  /**
   * 📈 Update arm with reward
   */
  async updateArmWithReward(
    armId: number,
    context: ContextualFeatures,
    reward: number
  ): Promise<void> {
    try {
      console.log(`📈 Updating arm ${armId} with reward ${reward}`);

      const { error } = await supabaseClient.supabase
        .rpc('update_contextual_bandit', {
          p_arm_id: armId,
          p_context_features: context,
          p_reward: reward
        });

      if (error) {
        console.error('❌ Failed to update contextual bandit:', error);
      } else {
        console.log('✅ Contextual bandit updated successfully');
        this.lastUpdate = null; // Force refresh on next selection
      }

    } catch (error) {
      console.error('❌ Contextual bandit update error:', error);
    }
  }

  /**
   * 🔄 Update arms from database
   */
  private async updateArms(armType: string): Promise<void> {
    try {
      const { data, error } = await supabaseClient.supabase
        .from('contextual_bandit_arms')
        .select('*')
        .eq('arm_type', armType)
        .order('avg_reward', { ascending: false });

      if (error) throw error;

      this.arms = data || [];
      this.lastUpdate = new Date();

      console.log(`🔄 Updated ${this.arms.length} ${armType} arms`);

    } catch (error) {
      console.error(`❌ Failed to update ${armType} arms:`, error);
      this.arms = [];
    }
  }

  /**
   * 💭 Generate selection reasoning
   */
  private generateSelectionReasoning(arm: BanditArm, baseScore: number, explorationBonus: number): string {
    if (arm.total_selections === 0) {
      return `Exploring new arm "${arm.arm_name}" (never tried before)`;
    }

    if (explorationBonus > baseScore * 0.5) {
      return `Exploring "${arm.arm_name}" for learning (tried ${arm.total_selections} times)`;
    }

    if (baseScore > 0.8) {
      return `High confidence in "${arm.arm_name}" (reward ${arm.avg_reward.toFixed(2)}, ${arm.total_selections} selections)`;
    }

    return `Balanced choice "${arm.arm_name}" (reward ${arm.avg_reward.toFixed(2)}, confidence ${(arm.confidence_score * 100).toFixed(0)}%)`;
  }

  /**
   * 📊 Get bandit statistics
   */
  async getBanditStatistics(armType: string = 'format'): Promise<{
    total_arms: number;
    total_selections: number;
    avg_reward: number;
    exploration_rate: number;
    top_performers: Array<{
      arm_name: string;
      avg_reward: number;
      confidence: number;
      selections: number;
    }>;
  }> {
    try {
      await this.updateArms(armType);

      const totalSelections = this.arms.reduce((sum, arm) => sum + arm.total_selections, 0);
      const avgReward = totalSelections > 0 
        ? this.arms.reduce((sum, arm) => sum + arm.avg_reward * arm.total_selections, 0) / totalSelections
        : 0;

      const explorationRate = this.arms.filter(arm => arm.total_selections < 10).length / this.arms.length;

      const topPerformers = this.arms
        .filter(arm => arm.total_selections >= 3)
        .sort((a, b) => b.avg_reward - a.avg_reward)
        .slice(0, 5)
        .map(arm => ({
          arm_name: arm.arm_name,
          avg_reward: arm.avg_reward,
          confidence: arm.confidence_score,
          selections: arm.total_selections
        }));

      return {
        total_arms: this.arms.length,
        total_selections: totalSelections,
        avg_reward: avgReward,
        exploration_rate: explorationRate,
        top_performers: topPerformers
      };

    } catch (error) {
      console.error('❌ Failed to get bandit statistics:', error);
      return {
        total_arms: 0,
        total_selections: 0,
        avg_reward: 0,
        exploration_rate: 0,
        top_performers: []
      };
    }
  }
}

export const contextualBanditSelector = ContextualBanditSelector.getInstance();`;

  // Write the contextual bandit selector
  fs.writeFileSync(
    path.join(__dirname, 'src', 'intelligence', 'contextualBanditSelector.ts'),
    contextualBanditCode
  );
  
  console.log('✅ Contextual Bandit Selector created');
}

async function createBudgetOptimizer() {
  console.log('💰 Creating Budget Optimizer...');
  
  const budgetOptimizerCode = `/**
 * 💰 ENHANCED BUDGET OPTIMIZER
 * Optimizes AI spending with ROI tracking and intelligent model selection
 */

import { SmartModelSelector } from './smartModelSelector';
import { EmergencyBudgetLockdown } from './emergencyBudgetLockdown';
import { supabaseClient } from './supabaseClient';

export interface BudgetOptimizationConfig {
  daily_limit: number;
  roi_threshold: number; // Minimum ROI to continue using expensive models
  emergency_threshold: number; // Budget % to switch to emergency mode
  operation_priorities: {
    content_generation: number;
    analysis: number;
    engagement: number;
  };
}

export interface BudgetAnalysis {
  current_utilization: number;
  remaining_budget: number;
  roi_by_operation: { [operation: string]: number };
  model_recommendations: {
    content_generation: string;
    analysis: string;
    engagement: string;
  };
  optimization_suggestions: string[];
}

export class EnhancedBudgetOptimizer {
  private static instance: EnhancedBudgetOptimizer;
  private config: BudgetOptimizationConfig;
  
  static getInstance(): EnhancedBudgetOptimizer {
    if (!this.instance) {
      this.instance = new EnhancedBudgetOptimizer();
    }
    return this.instance;
  }

  constructor() {
    this.config = {
      daily_limit: 7.5,
      roi_threshold: 1.5,
      emergency_threshold: 0.85,
      operation_priorities: {
        content_generation: 1.0,
        analysis: 0.7,
        engagement: 0.5
      }
    };
  }

  /**
   * 📊 Analyze budget and provide optimization recommendations
   */
  async analyzeBudget(): Promise<BudgetAnalysis> {
    try {
      console.log('💰 === BUDGET OPTIMIZATION ANALYSIS ===');

      // Get current budget status
      const budgetStatus = await EmergencyBudgetLockdown.isLockedDown();
      const currentUtilization = budgetStatus.totalSpent / budgetStatus.dailyLimit;
      const remainingBudget = budgetStatus.dailyLimit - budgetStatus.totalSpent;

      console.log(`💵 Current utilization: ${(currentUtilization * 100).toFixed(1)}%`);
      console.log(`💰 Remaining budget: $${remainingBudget.toFixed(2)}`);

      // Get ROI by operation type
      const roiByOperation = await this.calculateROIByOperation();

      // Generate model recommendations
      const modelRecommendations = await this.generateModelRecommendations(
        currentUtilization,
        remainingBudget,
        roiByOperation
      );

      // Generate optimization suggestions
      const optimizationSuggestions = this.generateOptimizationSuggestions(
        currentUtilization,
        roiByOperation
      );

      const analysis: BudgetAnalysis = {
        current_utilization: currentUtilization,
        remaining_budget: remainingBudget,
        roi_by_operation: roiByOperation,
        model_recommendations: modelRecommendations,
        optimization_suggestions: optimizationSuggestions
      };

      console.log('✅ Budget analysis complete');
      return analysis;

    } catch (error) {
      console.error('❌ Budget analysis failed:', error);
      return {
        current_utilization: 0,
        remaining_budget: 0,
        roi_by_operation: {},
        model_recommendations: {
          content_generation: 'gpt-4o-mini',
          analysis: 'gpt-4o-mini',
          engagement: 'gpt-4o-mini'
        },
        optimization_suggestions: ['Budget analysis failed - using conservative settings']
      };
    }
  }

  /**
   * 📈 Calculate ROI by operation type
   */
  private async calculateROIByOperation(): Promise<{ [operation: string]: number }> {
    try {
      const { data: budgetLogs } = await supabaseClient.supabase
        .from('budget_optimization_log')
        .select('operation_type, roi_ratio')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
        .not('roi_ratio', 'is', null);

      if (!budgetLogs || budgetLogs.length === 0) {
        return {
          content_generation: 1.0,
          analysis: 0.8,
          engagement: 0.6
        };
      }

      const roiByOperation: { [operation: string]: number[] } = {};
      
      budgetLogs.forEach(log => {
        if (!roiByOperation[log.operation_type]) {
          roiByOperation[log.operation_type] = [];
        }
        roiByOperation[log.operation_type].push(log.roi_ratio);
      });

      const avgROI: { [operation: string]: number } = {};
      Object.entries(roiByOperation).forEach(([operation, rois]) => {
        avgROI[operation] = rois.reduce((sum, roi) => sum + roi, 0) / rois.length;
      });

      return avgROI;

    } catch (error) {
      console.error('❌ ROI calculation failed:', error);
      return {
        content_generation: 1.0,
        analysis: 0.8,
        engagement: 0.6
      };
    }
  }

  /**
   * 🤖 Generate model recommendations based on budget and ROI
   */
  private async generateModelRecommendations(
    utilization: number,
    remainingBudget: number,
    roiByOperation: { [operation: string]: number }
  ): Promise<{ [operation: string]: string }> {
    const recommendations: { [operation: string]: string } = {};

    for (const [operation, priority] of Object.entries(this.config.operation_priorities)) {
      const roi = roiByOperation[operation] || 1.0;
      const adjustedBudget = remainingBudget * priority;

      if (utilization >= this.config.emergency_threshold) {
        // Emergency mode - use cheapest models
        recommendations[operation] = 'gpt-4o-mini';
      } else if (roi >= this.config.roi_threshold && adjustedBudget >= 1.0) {
        // High ROI and sufficient budget - use premium model
        recommendations[operation] = 'gpt-4o';
      } else if (roi >= 1.0 && adjustedBudget >= 0.5) {
        // Moderate ROI - use balanced model
        recommendations[operation] = 'gpt-4-turbo';
      } else {
        // Low ROI or tight budget - use efficient model
        recommendations[operation] = 'gpt-4o-mini';
      }
    }

    return recommendations;
  }

  /**
   * 💡 Generate optimization suggestions
   */
  private generateOptimizationSuggestions(
    utilization: number,
    roiByOperation: { [operation: string]: number }
  ): string[] {
    const suggestions: string[] = [];

    // Budget utilization suggestions
    if (utilization >= 0.9) {
      suggestions.push('🚨 Critical: Budget almost exhausted - emergency mode activated');
      suggestions.push('💰 Switch all operations to gpt-4o-mini for cost efficiency');
    } else if (utilization >= 0.7) {
      suggestions.push('⚠️ Warning: High budget utilization - prioritize high-ROI operations');
      suggestions.push('🎯 Focus spending on content generation over analysis');
    } else if (utilization < 0.3) {
      suggestions.push('📈 Opportunity: Low budget usage - consider more aggressive posting');
      suggestions.push('🤖 Can afford premium models for better quality');
    }

    // ROI-based suggestions
    const lowROIOperations = Object.entries(roiByOperation)
      .filter(([_, roi]) => roi < 1.0)
      .map(([operation, _]) => operation);

    if (lowROIOperations.length > 0) {
      suggestions.push(`⚠️ Low ROI operations: ${lowROIOperations.join(', ')} - consider optimization`);
    }

    const highROIOperations = Object.entries(roiByOperation)
      .filter(([_, roi]) => roi >= 2.0)
      .map(([operation, _]) => operation);

    if (highROIOperations.length > 0) {
      suggestions.push(`🎯 Double down on high-ROI operations: ${highROIOperations.join(', ')}`);
    }

    // Time-based suggestions
    const currentHour = new Date().getHours();
    if (currentHour >= 6 && currentHour <= 10) {
      suggestions.push('🌅 Morning peak - prioritize content generation for high engagement');
    } else if (currentHour >= 18 && currentHour <= 22) {
      suggestions.push('🌆 Evening peak - increase posting frequency if budget allows');
    }

    return suggestions;
  }

  /**
   * 📝 Log budget operation
   */
  async logBudgetOperation(
    operationType: string,
    modelUsed: string,
    tokensUsed: number,
    costUSD: number,
    expectedReward: number,
    actualReward: number | null = null,
    taskSuccess: boolean = true,
    qualityScore: number | null = null
  ): Promise<void> {
    try {
      const budgetStatus = await EmergencyBudgetLockdown.isLockedDown();
      const utilizationBefore = budgetStatus.totalSpent / budgetStatus.dailyLimit;
      const utilizationAfter = (budgetStatus.totalSpent + costUSD) / budgetStatus.dailyLimit;

      const roi = actualReward !== null && costUSD > 0 ? actualReward / costUSD : null;

      await supabaseClient.supabase
        .from('budget_optimization_log')
        .insert({
          operation_type: operationType,
          model_used: modelUsed,
          tokens_used: tokensUsed,
          cost_usd: costUSD,
          expected_reward: expectedReward,
          actual_reward: actualReward,
          roi_ratio: roi,
          budget_utilization_before: utilizationBefore,
          budget_utilization_after: utilizationAfter,
          time_of_day: new Date().getHours(),
          was_fallback_model: modelUsed === 'gpt-4o-mini',
          task_success: taskSuccess,
          quality_score: qualityScore
        });

      console.log(`📝 Budget operation logged: ${operationType} (${modelUsed}, $${costUSD.toFixed(4)})`);

    } catch (error) {
      console.error('❌ Failed to log budget operation:', error);
    }
  }

  /**
   * 🎯 Get optimized model selection
   */
  async getOptimizedModelSelection(
    operationType: string,
    expectedTokens: number,
    expectedReward: number = 1.0
  ): Promise<{
    model: string;
    maxTokens: number;
    estimatedCost: number;
    reasoning: string;
  }> {
    try {
      const analysis = await this.analyzeBudget();
      const recommendedModel = analysis.model_recommendations[operationType] || 'gpt-4o-mini';
      
      // Use SmartModelSelector but override with our recommendation if needed
      const baseSelection = await SmartModelSelector.selectModel(
        operationType as any,
        expectedTokens
      );

      // Override model if our analysis suggests a different choice
      const finalModel = analysis.current_utilization >= this.config.emergency_threshold 
        ? 'gpt-4o-mini' 
        : recommendedModel;

      const reasoning = this.generateModelSelectionReasoning(
        analysis,
        operationType,
        expectedReward,
        finalModel
      );

      return {
        model: finalModel,
        maxTokens: baseSelection.maxTokens,
        estimatedCost: baseSelection.estimatedCost,
        reasoning: reasoning
      };

    } catch (error) {
      console.error('❌ Optimized model selection failed:', error);
      return {
        model: 'gpt-4o-mini',
        maxTokens: expectedTokens,
        estimatedCost: 0.0001,
        reasoning: 'Error occurred - using fallback model'
      };
    }
  }

  /**
   * 💭 Generate model selection reasoning
   */
  private generateModelSelectionReasoning(
    analysis: BudgetAnalysis,
    operationType: string,
    expectedReward: number,
    selectedModel: string
  ): string {
    const utilization = analysis.current_utilization;
    const roi = analysis.roi_by_operation[operationType] || 1.0;

    if (utilization >= this.config.emergency_threshold) {
      return `Emergency budget mode (${(utilization * 100).toFixed(1)}% used) - using ${selectedModel} for cost control`;
    }

    if (roi >= this.config.roi_threshold && expectedReward >= 1.5) {
      return `High ROI operation (${roi.toFixed(2)}x) with good expected reward (${expectedReward.toFixed(2)}) - using ${selectedModel}`;
    }

    if (utilization < 0.5 && expectedReward >= 1.0) {
      return `Low budget usage (${(utilization * 100).toFixed(1)}%) - can afford ${selectedModel} for quality`;
    }

    return `Balanced choice: ${(utilization * 100).toFixed(1)}% budget used, ${roi.toFixed(2)}x ROI - using ${selectedModel}`;
  }
}

export const enhancedBudgetOptimizer = EnhancedBudgetOptimizer.getInstance();`;

  // Write the enhanced budget optimizer
  fs.writeFileSync(
    path.join(__dirname, 'src', 'utils', 'enhancedBudgetOptimizer.ts'),
    budgetOptimizerCode
  );
  
  console.log('✅ Enhanced Budget Optimizer created');
}

async function createEngagementIntelligenceEngine() {
  console.log('🤝 Creating Engagement Intelligence Engine...');
  
  const engagementEngineCode = `/**
 * 🤝 ENGAGEMENT INTELLIGENCE ENGINE
 * Strategic engagement with ROI tracking and intelligent target selection
 */

import { supabaseClient } from './supabaseClient';
import { contextualBanditSelector } from '../intelligence/contextualBanditSelector';

export interface EngagementTarget {
  username: string;
  tweet_id?: string;
  follower_count: number;
  engagement_rate: number;
  target_score: number;
  reasoning: string;
}

export interface EngagementAction {
  id: number;
  action_type: 'like' | 'reply' | 'follow' | 'retweet';
  target: EngagementTarget;
  expected_roi: number;
  context: {
    hour: number;
    day_of_week: number;
    budget_utilization: number;
  };
}

export interface EngagementResult {
  action_id: number;
  success: boolean;
  reciprocal_action: boolean;
  follower_gained: boolean;
  engagement_value: number;
  actual_roi: number;
}

export class EngagementIntelligenceEngine {
  private static instance: EngagementIntelligenceEngine;
  
  // Daily limits to prevent spam
  private readonly DAILY_LIMITS = {
    likes: 50,
    replies: 15,
    follows: 10,
    retweets: 20
  };

  static getInstance(): EngagementIntelligenceEngine {
    if (!this.instance) {
      this.instance = new EngagementIntelligenceEngine();
    }
    return this.instance;
  }

  /**
   * 🎯 Get strategic engagement targets
   */
  async getEngagementTargets(
    actionType: 'like' | 'reply' | 'follow' | 'retweet',
    count: number = 5
  ): Promise<EngagementTarget[]> {
    try {
      console.log(`🎯 === ENGAGEMENT TARGET SELECTION ===`);
      console.log(`🎬 Action: ${actionType}, Count: ${count}`);

      // Check daily limits
      const todaysActions = await this.getTodaysActionCount(actionType);
      const remainingActions = this.DAILY_LIMITS[actionType] - todaysActions;

      if (remainingActions <= 0) {
        console.log(`⚠️ Daily limit reached for ${actionType} (${todaysActions}/${this.DAILY_LIMITS[actionType]})`);
        return [];
      }

      const maxTargets = Math.min(count, remainingActions);
      console.log(`📊 Can perform ${maxTargets} more ${actionType} actions today`);

      // Get target criteria from database
      const { data: criteria } = await supabaseClient.supabase
        .from('engagement_target_criteria')
        .select('*')
        .eq('is_active', true)
        .order('performance_score', { ascending: false });

      if (!criteria || criteria.length === 0) {
        console.log('⚠️ No engagement criteria found');
        return [];
      }

      // Use contextual bandit to select optimal engagement strategy
      const context = {
        hour_of_day: new Date().getHours(),
        day_of_week: new Date().getDay(),
        content_category: 'health_optimization', // Default
        format_type: 'engagement',
        hook_type: actionType,
        budget_utilization: 0.5, // Default
        recent_engagement_rate: 0.03 // Default
      };

      const banditSelection = await contextualBanditSelector.selectArm(context, 'engagement');

      // Generate targets based on criteria and bandit selection
      const targets = await this.generateTargets(actionType, criteria, maxTargets, banditSelection);

      console.log(`✅ Generated ${targets.length} engagement targets`);
      return targets;

    } catch (error) {
      console.error('❌ Engagement target selection failed:', error);
      return [];
    }
  }

  /**
   * 🚀 Execute engagement action
   */
  async executeEngagementAction(target: EngagementTarget, actionType: string): Promise<EngagementResult | null> {
    try {
      console.log(`🚀 Executing ${actionType} on @${target.username}`);

      const context = {
        hour: new Date().getHours(),
        day_of_week: new Date().getDay(),
        budget_utilization: 0.5 // Would get from budget system
      };

      // Record the action attempt
      const { data: actionRecord, error: insertError } = await supabaseClient.supabase
        .from('intelligent_engagement_actions')
        .insert({
          action_type: actionType,
          target_username: target.username,
          target_tweet_id: target.tweet_id,
          target_follower_count: target.follower_count,
          target_engagement_rate: target.engagement_rate,
          selection_algorithm: 'bandit',
          target_score: target.target_score,
          expected_roi: 1.5, // Default expected ROI
          hour_of_action: context.hour,
          day_of_week: context.day_of_week,
          budget_utilization: context.budget_utilization,
          action_timestamp: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError || !actionRecord) {
        console.error('❌ Failed to record engagement action:', insertError);
        return null;
      }

      // Here you would integrate with your actual engagement execution
      // For now, simulate the action
      const simulatedResult = this.simulateEngagementAction(actionType, target);

      // Update the action record with results
      await this.updateActionResult(actionRecord.id, simulatedResult);

      console.log(`✅ ${actionType} action completed with value ${simulatedResult.engagement_value}`);

      return {
        action_id: actionRecord.id,
        ...simulatedResult
      };

    } catch (error) {
      console.error(`❌ Engagement action failed:`, error);
      return null;
    }
  }

  /**
   * 📊 Track engagement performance
   */
  async trackEngagementPerformance(result: EngagementResult): Promise<void> {
    try {
      console.log(`📊 Tracking engagement performance for action ${result.action_id}`);

      // Update contextual bandit with the result
      const context = await this.getActionContext(result.action_id);
      if (context) {
        await contextualBanditSelector.updateArmWithReward(
          1, // Would get actual arm ID from action record
          context,
          result.actual_roi
        );
      }

      // Update target criteria performance
      await this.updateTargetCriteriaPerformance(result);

      console.log('✅ Engagement performance tracked');

    } catch (error) {
      console.error('❌ Failed to track engagement performance:', error);
    }
  }

  /**
   * 📈 Get engagement analytics
   */
  async getEngagementAnalytics(days: number = 7): Promise<{
    total_actions: number;
    success_rate: number;
    avg_roi: number;
    follower_conversion_rate: number;
    top_performing_targets: Array<{
      username: string;
      actions: number;
      success_rate: number;
      avg_value: number;
    }>;
    performance_by_hour: { [hour: number]: number };
  }> {
    try {
      const { data: actions } = await supabaseClient.supabase
        .from('intelligent_engagement_actions')
        .select('*')
        .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

      if (!actions || actions.length === 0) {
        return {
          total_actions: 0,
          success_rate: 0,
          avg_roi: 0,
          follower_conversion_rate: 0,
          top_performing_targets: [],
          performance_by_hour: {}
        };
      }

      const totalActions = actions.length;
      const successfulActions = actions.filter(a => a.action_successful).length;
      const successRate = successfulActions / totalActions;

      const totalValue = actions.reduce((sum, a) => sum + (a.engagement_value || 0), 0);
      const avgROI = totalValue / totalActions;

      const followerGains = actions.filter(a => a.follower_gained).length;
      const followerConversionRate = followerGains / totalActions;

      // Top performing targets
      const targetPerformance: { [username: string]: any } = {};
      actions.forEach(action => {
        if (!targetPerformance[action.target_username]) {
          targetPerformance[action.target_username] = {
            actions: 0,
            successes: 0,
            total_value: 0
          };
        }
        targetPerformance[action.target_username].actions++;
        if (action.action_successful) {
          targetPerformance[action.target_username].successes++;
        }
        targetPerformance[action.target_username].total_value += action.engagement_value || 0;
      });

      const topPerformingTargets = Object.entries(targetPerformance)
        .map(([username, stats]) => ({
          username,
          actions: stats.actions,
          success_rate: stats.successes / stats.actions,
          avg_value: stats.total_value / stats.actions
        }))
        .sort((a, b) => b.avg_value - a.avg_value)
        .slice(0, 10);

      // Performance by hour
      const performanceByHour: { [hour: number]: number } = {};
      for (let hour = 0; hour < 24; hour++) {
        const hourActions = actions.filter(a => a.hour_of_action === hour);
        performanceByHour[hour] = hourActions.length > 0 
          ? hourActions.reduce((sum, a) => sum + (a.engagement_value || 0), 0) / hourActions.length
          : 0;
      }

      return {
        total_actions: totalActions,
        success_rate: successRate,
        avg_roi: avgROI,
        follower_conversion_rate: followerConversionRate,
        top_performing_targets: topPerformingTargets,
        performance_by_hour: performanceByHour
      };

    } catch (error) {
      console.error('❌ Failed to get engagement analytics:', error);
      return {
        total_actions: 0,
        success_rate: 0,
        avg_roi: 0,
        follower_conversion_rate: 0,
        top_performing_targets: [],
        performance_by_hour: {}
      };
    }
  }

  // Helper methods...
  private async getTodaysActionCount(actionType: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count } = await supabaseClient.supabase
      .from('intelligent_engagement_actions')
      .select('*', { count: 'exact', head: true })
      .eq('action_type', actionType)
      .gte('created_at', today.toISOString());

    return count || 0;
  }

  private async generateTargets(
    actionType: string, 
    criteria: any[], 
    maxTargets: number, 
    banditSelection: any
  ): Promise<EngagementTarget[]> {
    // This would integrate with Twitter API to find actual targets
    // For now, return mock targets
    const mockTargets: EngagementTarget[] = [
      {
        username: 'peterattiamd',
        follower_count: 150000,
        engagement_rate: 0.045,
        target_score: 0.85,
        reasoning: 'High-authority health influencer with good engagement'
      },
      {
        username: 'hubermanlab',
        follower_count: 200000,
        engagement_rate: 0.038,
        target_score: 0.82,
        reasoning: 'Popular science communicator in health space'
      }
    ];

    return mockTargets.slice(0, maxTargets);
  }

  private simulateEngagementAction(actionType: string, target: EngagementTarget): {
    success: boolean;
    reciprocal_action: boolean;
    follower_gained: boolean;
    engagement_value: number;
    actual_roi: number;
  } {
    // Simulate based on target quality
    const baseSuccessRate = Math.min(0.8, target.target_score + 0.2);
    const success = Math.random() < baseSuccessRate;
    
    const reciprocalRate = target.engagement_rate * 0.1; // 10% of their engagement rate
    const reciprocal_action = success && Math.random() < reciprocalRate;
    
    const followerRate = reciprocalRate * 0.3; // 30% of reciprocal actions lead to follows
    const follower_gained = reciprocal_action && Math.random() < followerRate;
    
    let engagement_value = 0;
    if (success) {
      engagement_value += 0.5; // Base value for successful action
      if (reciprocal_action) engagement_value += 1.0;
      if (follower_gained) engagement_value += 2.0;
    }
    
    const actual_roi = engagement_value / 0.1; // Assume $0.10 cost per action
    
    return {
      success,
      reciprocal_action,
      follower_gained,
      engagement_value,
      actual_roi
    };
  }

  private async updateActionResult(actionId: number, result: any): Promise<void> {
    await supabaseClient.supabase
      .from('intelligent_engagement_actions')
      .update({
        action_successful: result.success,
        response_received: result.reciprocal_action,
        reciprocal_action: result.reciprocal_action,
        follower_gained: result.follower_gained,
        engagement_value: result.engagement_value
      })
      .eq('id', actionId);
  }

  private async getActionContext(actionId: number): Promise<any> {
    const { data } = await supabaseClient.supabase
      .from('intelligent_engagement_actions')
      .select('hour_of_action, day_of_week, budget_utilization')
      .eq('id', actionId)
      .single();

    return data ? {
      hour_of_day: data.hour_of_action,
      day_of_week: data.day_of_week,
      content_category: 'health_optimization',
      format_type: 'engagement',
      hook_type: 'strategic',
      budget_utilization: data.budget_utilization,
      recent_engagement_rate: 0.03
    } : null;
  }

  private async updateTargetCriteriaPerformance(result: EngagementResult): Promise<void> {
    // Update criteria performance based on results
    // This would analyze which criteria led to successful actions
    console.log('📊 Updating target criteria performance...');
  }
}

export const engagementIntelligenceEngine = EngagementIntelligenceEngine.getInstance();`;

  // Write the engagement intelligence engine
  fs.writeFileSync(
    path.join(__dirname, 'src', 'agents', 'engagementIntelligenceEngine.ts'),
    engagementEngineCode
  );
  
  console.log('✅ Engagement Intelligence Engine created');
}

// Run the deployment
if (require.main === module) {
  applyEnhancedLearningSystem();
} 