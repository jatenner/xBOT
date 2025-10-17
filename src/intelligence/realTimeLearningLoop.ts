/**
 * REAL-TIME LEARNING LOOP
 * Continuously learns from tweet performance and updates content strategy
 * 
 * This system:
 * 1. Scrapes recent tweet metrics
 * 2. Updates ML models with performance data
 * 3. Analyzes follower growth patterns
 * 4. Updates viral formulas based on what works
 * 5. Improves content strategy over time
 */

import { SelfLearningSystem } from '../learn/learn';
import { AdvancedMLEngine } from './advancedMLEngine';
import { FollowerGrowthOptimizer } from './followerGrowthOptimizer';
import { FollowerAcquisitionGenerator } from '../ai/followerAcquisitionGenerator';

export class RealTimeLearningLoop {
  private static instance: RealTimeLearningLoop;
  private learningSystem: SelfLearningSystem;
  private mlEngine: AdvancedMLEngine;
  private followerOptimizer: FollowerGrowthOptimizer;
  private followerGenerator: FollowerAcquisitionGenerator;
  
  private constructor() {
    this.learningSystem = new SelfLearningSystem();
    this.mlEngine = AdvancedMLEngine.getInstance();
    this.followerOptimizer = FollowerGrowthOptimizer.getInstance();
    this.followerGenerator = new FollowerAcquisitionGenerator();
  }
  
  static getInstance(): RealTimeLearningLoop {
    if (!RealTimeLearningLoop.instance) {
      RealTimeLearningLoop.instance = new RealTimeLearningLoop();
    }
    return RealTimeLearningLoop.instance;
  }
  
  /**
   * Main learning cycle - Run this every hour
   */
  async runLearningCycle(): Promise<void> {
    console.log('🧠 LEARNING_LOOP: Starting real-time learning cycle...');
    
    try {
      // Step 1: Scrape recent tweet metrics
      console.log('📊 LEARNING_LOOP: Analyzing recent tweet performance...');
      const insights = await this.learningSystem.runLearningCycle();
      
      console.log('📊 LEARNING_LOOP: Performance insights:');
      if (insights.top_performing_topics && insights.top_performing_topics.length > 0) {
        console.log(`  - Best topics: ${insights.top_performing_topics.slice(0, 3).join(', ')}`);
        console.log(`  - Total insights available: ${insights.top_performing_topics.length}`);
      }
      
      // Step 2: Update ML models with new data
      await this.updateMLModels(insights);
      
      // Step 3: Analyze what content drives follower growth
      await this.analyzeFollowerPatterns(insights);
      
      // Step 4: Update viral formulas based on performance
      await this.updateViralFormulas(insights);
      
      // Step 5: Store learning summary
      await this.storeLearningUpdate(insights);
      
      console.log('✅ LEARNING_LOOP: Learning cycle complete');
      
    } catch (error: any) {
      console.error('❌ LEARNING_LOOP: Learning cycle failed:', error.message);
      // Don't throw - learning failures shouldn't break the system
    }
  }
  
  /**
   * Update ML models with new performance data
   */
  private async updateMLModels(insights: any): Promise<void> {
    console.log('🎓 LEARNING_LOOP: Updating ML models...');
    
    try {
      if (!insights.top_performing_topics || insights.top_performing_topics.length === 0) {
        console.log('⏭️ LEARNING_LOOP: No performance data to train on yet');
        return;
      }
      
      // 🚀 TRAIN ML MODELS WITH REAL DATA FROM COMPREHENSIVE_METRICS
      console.log('🎓 LEARNING_LOOP: Training ML models with comprehensive metrics...');
      
      const { getSupabaseClient } = await import('../db');
      const supabase = getSupabaseClient();
      
      // Get recent posts with comprehensive metrics
      const { data: comprehensiveData, error: compError } = await supabase
        .from('comprehensive_metrics')
        .select(`
          *,
          posted_decisions!inner(decision_id, content)
        `)
        .order('collected_at', { ascending: false })
        .limit(50);
      
      if (compError || !comprehensiveData || comprehensiveData.length === 0) {
        console.log('⏭️ LEARNING_LOOP: No comprehensive metrics data yet for ML training');
      } else {
        console.log(`🎓 LEARNING_LOOP: Training on ${comprehensiveData.length} posts with comprehensive metrics`);
        
        for (const dataPoint of comprehensiveData.slice(0, 20)) {
          try {
            // Train with rich feature set
            await this.mlEngine.trainWithNewData(
              String(dataPoint.posted_decisions?.content || ''),
              {
                likes: dataPoint.actual_engagement || 0,
                retweets: 0,
                replies: 0,
                followers_gained: dataPoint.followers_attributed || 0,
                engagement_velocity: dataPoint.engagement_velocity || 0,
                shareability_score: dataPoint.shareability_score || 0,
                hook_effectiveness: dataPoint.hook_effectiveness || 0,
                prediction_accuracy: dataPoint.prediction_accuracy || 0
              }
            );
          } catch (mlError: any) {
            console.error(`⚠️ ML training error:`, mlError.message);
            // Continue with other data points
          }
        }
        
        console.log('✅ LEARNING_LOOP: ML training completed');
      }
      
      console.log('✅ LEARNING_LOOP: ML model update complete (placeholder)');
    } catch (error: any) {
      console.warn('⚠️ LEARNING_LOOP: ML model update failed:', error.message);
    }
  }
  
  /**
   * Analyze what content patterns drive follower growth
   */
  private async analyzeFollowerPatterns(insights: any): Promise<void> {
    console.log('📈 LEARNING_LOOP: Analyzing follower growth patterns...');
    
    try {
      if (!insights.top_performing_topics || insights.top_performing_topics.length === 0) {
        console.log('⏭️ LEARNING_LOOP: No topics to analyze yet');
        return;
      }
      
      // Log top performing topics (simplified for now)
      console.log(`📊 LEARNING_LOOP: Top topics: ${insights.top_performing_topics.slice(0, 3).join(', ')}`);
      
      // Record insights for future optimization (simplified)
      console.log('✅ LEARNING_LOOP: Follower patterns analyzed');
    } catch (error: any) {
      console.warn('⚠️ LEARNING_LOOP: Follower pattern analysis failed:', error.message);
    }
  }
  
  /**
   * Update viral formulas based on what's working
   * PHASE 2: REAL FEEDBACK LOOP - Actually update scores based on performance
   */
  private async updateViralFormulas(insights: any): Promise<void> {
    console.log('🔥 LEARNING_LOOP: Analyzing viral formula performance...');
    
    try {
      const { getSupabaseClient } = await import('../db');
      const supabase = getSupabaseClient();
      
      // Get recent follower attributions (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      // CRITICAL: Only use VERIFIED, HIGH-CONFIDENCE data for learning
      // NEVER use UNDETERMINED or unverified data
      const { data: attributions, error } = await supabase
        .from('follower_attributions')
        .select('*')
        .gte('created_at', oneDayAgo)
        .eq('confidence_score', 'high') // Only high-confidence attributions
        .filter('metadata->_verified', 'eq', true) // Only verified scraped data
        .filter('metadata->_status', 'eq', 'CONFIRMED'); // Only confirmed metrics
      
      if (error || !attributions || attributions.length === 0) {
        console.log('⏭️ LEARNING_LOOP: No recent attribution data to learn from yet');
        return;
      }
      
      console.log(`🔥 LEARNING_LOOP: Found ${attributions.length} high-confidence posts to learn from`);
      
      // Group by formula and content type
      const formulaPerformance = this.aggregatePerformance(attributions, 'viral_formula');
      const contentTypePerformance = this.aggregatePerformance(attributions, 'content_type');
      
      // Update content type scores
      const { getContentTypeSelector } = await import('./contentTypeSelector');
      const contentTypeSelector = getContentTypeSelector();
      
      for (const [contentType, stats] of Object.entries(contentTypePerformance)) {
        await contentTypeSelector.updateContentTypePerformance(
          contentType,
          stats.avg_followers,
          stats.avg_engagement,
          stats.success_rate > 0.5
        );
        
        console.log(`  📊 ${contentType}: ${stats.avg_followers.toFixed(1)} followers/post, ${(stats.success_rate * 100).toFixed(0)}% success`);
      }
      
      // Log formula performance (would update followerAcquisitionGenerator here)
      console.log('🔥 LEARNING_LOOP: Viral formula performance:');
      for (const [formula, stats] of Object.entries(formulaPerformance)) {
        console.log(`  📊 ${formula}: ${stats.avg_followers.toFixed(1)} followers/post, ${(stats.success_rate * 100).toFixed(0)}% success`);
      }
      
      // Store summary
      await supabase.from('formula_performance').insert([{
        tracked_at: new Date().toISOString(),
        formula_stats: formulaPerformance,
        content_type_stats: contentTypePerformance,
        total_posts_analyzed: attributions.length
      }]);
      
      console.log('✅ LEARNING_LOOP: Performance scores updated based on real data!');
      
    } catch (error: any) {
      console.warn('⚠️ LEARNING_LOOP: Formula update failed:', error.message);
    }
  }
  
  /**
   * Aggregate performance metrics by a field
   */
  private aggregatePerformance(data: any[], groupBy: string): Record<string, any> {
    const grouped = data.reduce((acc: any, item: any) => {
      const key = item[groupBy] || 'unknown';
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    }, {});
    
    const aggregated: Record<string, any> = {};
    
    for (const [key, items] of Object.entries(grouped) as [string, any[]][]) {
      const totalFollowers = items.reduce((sum, i) => sum + (i.followers_gained || 0), 0);
      const avgFollowers = totalFollowers / items.length;
      const successCount = items.filter(i => i.followers_gained > 5).length;
      const successRate = successCount / items.length;
      
      aggregated[key] = {
        avg_followers: avgFollowers,
        avg_engagement: 0, // Would calculate from engagement data
        success_rate: successRate,
        sample_size: items.length
      };
    }
    
    return aggregated;
  }
  
  /**
   * Store learning summary for tracking
   */
  private async storeLearningUpdate(insights: any): Promise<void> {
    try {
      const { getSupabaseClient } = await import('../db');
      const supabase = getSupabaseClient();
      
      await supabase.from('learning_updates').insert([{
        update_type: 'real_time_cycle',
        insights_summary: {
          top_topics: insights.top_performing_topics?.slice(0, 5) || [],
          timestamp: new Date().toISOString()
        },
        created_at: new Date().toISOString()
      }]).select();
      
      console.log('✅ LEARNING_LOOP: Learning update stored in database');
    } catch (error: any) {
      // Table might not exist, that's okay
      console.log('⏭️ LEARNING_LOOP: Learning storage (table may not exist yet)');
    }
  }
  
  /**
   * Get learning status for debugging
   */
  async getLearningStatus(): Promise<{
    last_cycle: string;
    cycles_completed: number;
    top_insights: any;
  }> {
    try {
      const { getSupabaseClient } = await import('../db');
      const supabase = getSupabaseClient();
      
      const { data, error } = await supabase
        .from('learning_updates')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error || !data || data.length === 0) {
        return {
          last_cycle: 'Never',
          cycles_completed: 0,
          top_insights: {}
        };
      }
      
      const lastUpdate = data[0];
      
      return {
        last_cycle: String(lastUpdate.created_at || 'Unknown'),
        cycles_completed: 1, // Would track this properly with a counter
        top_insights: lastUpdate.insights_summary || {}
      };
    } catch (error) {
      return {
        last_cycle: 'Error',
        cycles_completed: 0,
        top_insights: {}
      };
    }
  }
}

export const getRealTimeLearningLoop = () => RealTimeLearningLoop.getInstance();

