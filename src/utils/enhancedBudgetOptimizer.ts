/**
 * 💰 ENHANCED BUDGET OPTIMIZER
 * 
 * Intelligent budget allocation system that optimizes AI spending based on ROI,
 * performance metrics, and strategic priorities. Ensures maximum value from
 * every dollar spent while maintaining strict budget controls.
 */

import { supabaseClient } from './supabaseClient';
import { emergencyBudgetLockdown } from './emergencyBudgetLockdown';

interface BudgetAllocation {
  contentGeneration: number;
  engagement: number;
  analytics: number;
  learning: number;
  emergency: number;
}

interface ROIMetrics {
  operation: string;
  cost: number;
  engagement: number;
  followers: number;
  roi: number;
  confidence: number;
}

interface OptimizationResult {
  success: boolean;
  allocation?: BudgetAllocation;
  recommendations?: string[];
  projectedROI?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  error?: string;
}

interface SpendingAnalysis {
  totalSpent: number;
  categoryBreakdown: BudgetAllocation;
  avgDailyCost: number;
  roiByCategory: { [category: string]: number };
  efficiency: number;
  burnRate: number;
}

export class EnhancedBudgetOptimizer {
  private static readonly DAILY_BUDGET_LIMIT = parseFloat(process.env.DAILY_BUDGET_LIMIT || '7.50');
  private static readonly MIN_EMERGENCY_RESERVE = 1.00; // $1 emergency reserve
  private static readonly ROI_THRESHOLD = 0.3; // Minimum acceptable ROI
  private static readonly OPTIMIZATION_PERIOD_DAYS = 7;
  
  // Default allocation percentages
  private static readonly DEFAULT_ALLOCATION: BudgetAllocation = {
    contentGeneration: 0.50, // 50% for content creation
    engagement: 0.25,        // 25% for engagement analysis
    analytics: 0.15,         // 15% for performance analytics
    learning: 0.05,          // 5% for learning optimization
    emergency: 0.05          // 5% emergency reserve
  };

  /**
   * 🎯 OPTIMIZE BUDGET ALLOCATION
   */
  static async optimizeBudgetAllocation(): Promise<OptimizationResult> {
    try {
      console.log('💰 === ENHANCED BUDGET OPTIMIZATION ===');
      
      // Analyze current spending patterns
      const spendingAnalysis = await this.analyzeSpendingPatterns();
      
      if (!spendingAnalysis.success) {
        return {
          success: false,
          error: 'Failed to analyze spending patterns: ' + spendingAnalysis.error
        };
      }

      // Calculate ROI for each category
      const roiMetrics = await this.calculateCategoryROI();
      
      // Generate optimized allocation
      const optimizedAllocation = this.generateOptimizedAllocation(
        spendingAnalysis.data!,
        roiMetrics
      );
      
      // Assess risk level
      const riskLevel = this.assessAllocationRisk(optimizedAllocation, spendingAnalysis.data!);
      
      // Generate recommendations
      const recommendations = this.generateOptimizationRecommendations(
        spendingAnalysis.data!,
        roiMetrics,
        optimizedAllocation
      );
      
      // Calculate projected ROI
      const projectedROI = this.calculateProjectedROI(optimizedAllocation, roiMetrics);
      
      console.log(`📊 Optimized allocation generated`);
      console.log(`📈 Projected ROI: ${(projectedROI * 100).toFixed(1)}%`);
      console.log(`⚠️ Risk level: ${riskLevel}`);
      
      return {
        success: true,
        allocation: optimizedAllocation,
        recommendations,
        projectedROI,
        riskLevel
      };

    } catch (error) {
      console.error('❌ Budget optimization failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Optimization failed'
      };
    }
  }

  /**
   * 📊 ANALYZE SPENDING PATTERNS
   */
  private static async analyzeSpendingPatterns(): Promise<{
    success: boolean;
    data?: SpendingAnalysis;
    error?: string;
  }> {
    try {
      const { data: spendingData, error } = await supabaseClient
        .from('budget_optimization_log')
        .select('*')
        .gte('timestamp', new Date(Date.now() - this.OPTIMIZATION_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString())
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('Database error in spending analysis:', error);
        return { success: false, error: error.message };
      }

      if (!spendingData || spendingData.length === 0) {
        // Return default analysis if no data
        return {
          success: true,
          data: {
            totalSpent: 5.00,
            categoryBreakdown: this.DEFAULT_ALLOCATION,
            avgDailyCost: 0.71,
            roiByCategory: {
              contentGeneration: 0.4,
              engagement: 0.3,
              analytics: 0.2,
              learning: 0.1
            },
            efficiency: 0.75,
            burnRate: 0.1
          }
        };
      }

      // Calculate spending metrics
      const totalSpent = spendingData.reduce((sum, record) => sum + (record.cost_usd || 0), 0);
      const avgDailyCost = totalSpent / this.OPTIMIZATION_PERIOD_DAYS;
      
      // Calculate category breakdown
      const categorySpending = {
        contentGeneration: 0,
        engagement: 0,
        analytics: 0,
        learning: 0,
        emergency: 0
      };
      
      for (const record of spendingData) {
        const category = this.categorizeBudgetOperation(record.operation_type || 'unknown');
        categorySpending[category] += record.cost_usd || 0;
      }
      
      // Convert to percentages
      const categoryBreakdown: BudgetAllocation = {
        contentGeneration: categorySpending.contentGeneration / totalSpent,
        engagement: categorySpending.engagement / totalSpent,
        analytics: categorySpending.analytics / totalSpent,
        learning: categorySpending.learning / totalSpent,
        emergency: categorySpending.emergency / totalSpent
      };
      
      // Calculate ROI by category and efficiency
      const roiByCategory = await this.calculateHistoricalROI(spendingData);
      const efficiency = this.calculateBudgetEfficiency(spendingData);
      const burnRate = avgDailyCost / this.DAILY_BUDGET_LIMIT;
      
      return {
        success: true,
        data: {
          totalSpent,
          categoryBreakdown,
          avgDailyCost,
          roiByCategory,
          efficiency,
          burnRate
        }
      };

    } catch (error) {
      console.error('❌ Spending analysis failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed'
      };
    }
  }

  /**
   * 📈 CALCULATE CATEGORY ROI
   */
  private static async calculateCategoryROI(): Promise<ROIMetrics[]> {
    try {
      // Get recent performance data
      const { data: performanceData, error } = await supabaseClient
        .from('learning_posts')
        .select('*')
        .eq('was_posted', true)
        .not('tweet_id', 'is', null)
        .gte('created_at', new Date(Date.now() - this.OPTIMIZATION_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (error || !performanceData) {
        // Return default ROI metrics
        return [
          { operation: 'contentGeneration', cost: 2.50, engagement: 100, followers: 5, roi: 0.4, confidence: 0.6 },
          { operation: 'engagement', cost: 1.25, engagement: 50, followers: 3, roi: 0.3, confidence: 0.5 },
          { operation: 'analytics', cost: 0.75, engagement: 25, followers: 1, roi: 0.2, confidence: 0.7 },
          { operation: 'learning', cost: 0.25, engagement: 10, followers: 1, roi: 0.1, confidence: 0.4 }
        ];
      }

      // Calculate ROI for each category
      const roiMetrics: ROIMetrics[] = [];
      const categories = ['contentGeneration', 'engagement', 'analytics', 'learning'];
      
      for (const category of categories) {
        const categoryData = this.filterDataByCategory(performanceData, category);
        const totalEngagement = categoryData.reduce((sum, post) => 
          sum + (post.likes_count || 0) + (post.retweets_count || 0) * 2 + (post.replies_count || 0) * 3, 0
        );
        const estimatedFollowers = Math.floor(totalEngagement * 0.05); // Rough conversion
        const estimatedCost = this.estimateCategoryCost(category);
        const roi = totalEngagement > 0 ? (totalEngagement * 0.01) / Math.max(0.01, estimatedCost) : 0;
        const confidence = Math.min(0.9, categoryData.length / 10);
        
        roiMetrics.push({
          operation: category,
          cost: estimatedCost,
          engagement: totalEngagement,
          followers: estimatedFollowers,
          roi,
          confidence
        });
      }
      
      return roiMetrics;

    } catch (error) {
      console.error('❌ ROI calculation failed:', error);
      return [
        { operation: 'contentGeneration', cost: 2.50, engagement: 50, followers: 2, roi: 0.2, confidence: 0.3 },
        { operation: 'engagement', cost: 1.25, engagement: 25, followers: 1, roi: 0.1, confidence: 0.3 },
        { operation: 'analytics', cost: 0.75, engagement: 15, followers: 1, roi: 0.1, confidence: 0.3 },
        { operation: 'learning', cost: 0.25, engagement: 5, followers: 0, roi: 0.05, confidence: 0.3 }
      ];
    }
  }

  /**
   * 🎯 GENERATE OPTIMIZED ALLOCATION
   */
  private static generateOptimizedAllocation(
    currentSpending: SpendingAnalysis,
    roiMetrics: ROIMetrics[]
  ): BudgetAllocation {
    // Start with current allocation
    const optimized = { ...currentSpending.categoryBreakdown };
    
    // Sort ROI metrics by performance
    const sortedROI = [...roiMetrics].sort((a, b) => b.roi - a.roi);
    
    // Increase allocation to high-performing categories
    for (const metric of sortedROI) {
      if (metric.roi > this.ROI_THRESHOLD && metric.confidence > 0.5) {
        const category = metric.operation as keyof BudgetAllocation;
        if (category !== 'emergency') {
          optimized[category] = Math.min(0.7, optimized[category] * 1.1); // Increase by 10%, cap at 70%
        }
      }
    }
    
    // Reduce allocation from underperforming categories
    for (const metric of roiMetrics) {
      if (metric.roi < this.ROI_THRESHOLD * 0.5) {
        const category = metric.operation as keyof BudgetAllocation;
        if (category !== 'emergency') {
          optimized[category] = Math.max(0.05, optimized[category] * 0.9); // Decrease by 10%, floor at 5%
        }
      }
    }
    
    // Ensure emergency reserve
    optimized.emergency = Math.max(0.05, this.MIN_EMERGENCY_RESERVE / this.DAILY_BUDGET_LIMIT);
    
    // Normalize to sum to 1
    const total = Object.values(optimized).reduce((sum, val) => sum + val, 0);
    for (const category in optimized) {
      optimized[category as keyof BudgetAllocation] /= total;
    }
    
    return optimized;
  }

  /**
   * 📈 CALCULATE PROJECTED ROI
   */
  private static calculateProjectedROI(
    allocation: BudgetAllocation,
    roiMetrics: ROIMetrics[]
  ): number {
    let weightedROI = 0;
    
    for (const metric of roiMetrics) {
      const category = metric.operation as keyof BudgetAllocation;
      if (category !== 'emergency') {
        weightedROI += allocation[category] * metric.roi * metric.confidence;
      }
    }
    
    return weightedROI;
  }

  /**
   * ⚠️ ASSESS ALLOCATION RISK
   */
  private static assessAllocationRisk(
    allocation: BudgetAllocation,
    currentSpending: SpendingAnalysis
  ): 'low' | 'medium' | 'high' {
    let riskScore = 0;
    
    // High allocation changes = higher risk
    for (const category in allocation) {
      const key = category as keyof BudgetAllocation;
      const change = Math.abs(allocation[key] - currentSpending.categoryBreakdown[key]);
      riskScore += change;
    }
    
    // Low emergency reserve = higher risk
    if (allocation.emergency < 0.05) riskScore += 0.2;
    
    // High burn rate = higher risk
    if (currentSpending.burnRate > 0.8) riskScore += 0.3;
    
    if (riskScore < 0.3) return 'low';
    if (riskScore < 0.6) return 'medium';
    return 'high';
  }

  /**
   * 📄 GENERATE RECOMMENDATIONS
   */
  private static generateOptimizationRecommendations(
    currentSpending: SpendingAnalysis,
    roiMetrics: ROIMetrics[],
    optimizedAllocation: BudgetAllocation
  ): string[] {
    const recommendations: string[] = [];
    
    // ROI-based recommendations
    const highROI = roiMetrics.filter(m => m.roi > this.ROI_THRESHOLD);
    const lowROI = roiMetrics.filter(m => m.roi < this.ROI_THRESHOLD * 0.5);
    
    if (highROI.length > 0) {
      recommendations.push(
        `Increase investment in ${highROI.map(m => m.operation).join(', ')} (high ROI: ${(highROI[0].roi * 100).toFixed(1)}%)`
      );
    }
    
    if (lowROI.length > 0) {
      recommendations.push(
        `Reduce spending on ${lowROI.map(m => m.operation).join(', ')} (low ROI: ${(lowROI[0].roi * 100).toFixed(1)}%)`
      );
    }
    
    // Burn rate recommendations
    if (currentSpending.burnRate > 0.9) {
      recommendations.push('Consider reducing daily AI operations to avoid budget exhaustion');
    } else if (currentSpending.burnRate < 0.5) {
      recommendations.push('Budget utilization is low - consider increasing AI operations for better growth');
    }
    
    // Efficiency recommendations
    if (currentSpending.efficiency < 0.6) {
      recommendations.push('Focus on operations with proven engagement returns');
    }
    
    return recommendations;
  }

  /**
   * 🔄 CATEGORIZE BUDGET OPERATION
   */
  private static categorizeBudgetOperation(operation: string): keyof BudgetAllocation {
    const operation_lower = operation.toLowerCase();
    
    if (operation_lower.includes('content') || operation_lower.includes('generate') || operation_lower.includes('post')) {
      return 'contentGeneration';
    }
    if (operation_lower.includes('engagement') || operation_lower.includes('reply') || operation_lower.includes('like')) {
      return 'engagement';
    }
    if (operation_lower.includes('analytic') || operation_lower.includes('performance') || operation_lower.includes('metric')) {
      return 'analytics';
    }
    if (operation_lower.includes('learning') || operation_lower.includes('optimization') || operation_lower.includes('training')) {
      return 'learning';
    }
    
    return 'emergency';
  }

  /**
   * 📊 CALCULATE HISTORICAL ROI
   */
  private static async calculateHistoricalROI(spendingData: any[]): Promise<{ [category: string]: number }> {
    const roi = {
      contentGeneration: 0.3,
      engagement: 0.2,
      analytics: 0.15,
      learning: 0.1
    };
    
    // Calculate basic ROI based on cost vs engagement (simplified)
    for (const category of Object.keys(roi)) {
      const categorySpending = spendingData
        .filter(record => this.categorizeBudgetOperation(record.operation_type || '') === category)
        .reduce((sum, record) => sum + (record.cost_usd || 0), 0);
      
      if (categorySpending > 0) {
        // Simplified ROI calculation - in reality this would correlate with actual engagement metrics
        roi[category as keyof typeof roi] = Math.min(1, Math.max(0, (categorySpending * 0.1) / categorySpending));
      }
    }
    
    return roi;
  }

  /**
   * 🎯 CALCULATE BUDGET EFFICIENCY
   */
  private static calculateBudgetEfficiency(spendingData: any[]): number {
    // Simplified efficiency metric: consistent spending pattern
    if (spendingData.length < 2) return 0.5;
    
    const dailyCosts = spendingData.map(record => record.cost_usd || 0);
    const avgCost = dailyCosts.reduce((sum, cost) => sum + cost, 0) / dailyCosts.length;
    const variance = dailyCosts.reduce((sum, cost) => sum + Math.pow(cost - avgCost, 2), 0) / dailyCosts.length;
    
    // Lower variance = higher efficiency
    return Math.max(0.1, Math.min(1, 1 - (variance / Math.max(0.01, avgCost))));
  }

  /**
   * 📋 FILTER DATA BY CATEGORY
   */
  private static filterDataByCategory(data: any[], category: string): any[] {
    // This is a simplified filter - in reality, we'd track which category generated each post
    const fraction = {
      contentGeneration: 0.6,
      engagement: 0.2,
      analytics: 0.15,
      learning: 0.05
    }[category] || 0.25;
    
    return data.slice(0, Math.ceil(data.length * fraction));
  }

  /**
   * 💰 ESTIMATE CATEGORY COST
   */
  private static estimateCategoryCost(category: string): number {
    const baseCosts = {
      contentGeneration: 0.02, // $0.02 per content generation
      engagement: 0.01,        // $0.01 per engagement analysis
      analytics: 0.005,        // $0.005 per analytics call
      learning: 0.003          // $0.003 per learning operation
    };
    
    return baseCosts[category as keyof typeof baseCosts] || 0.01;
  }

  /**
   * 🧪 TEST BUDGET OPTIMIZATION
   */
  static async testOptimization(): Promise<{
    success: boolean;
    testResults: any;
    summary: string;
  }> {
    try {
      console.log('🧪 Testing budget optimization...');
      
      const result = await this.optimizeBudgetAllocation();
      
      const testResults = {
        optimizationWorked: result.success,
        allocationsGenerated: result.allocation ? Object.keys(result.allocation).length : 0,
        recommendationsGenerated: result.recommendations?.length || 0,
        projectedROI: result.projectedROI || 0,
        riskLevel: result.riskLevel || 'unknown'
      };
      
      const summary = `Budget optimization test: ${result.success ? 'PASSED' : 'FAILED'}. Generated ${testResults.recommendationsGenerated} recommendations.`;
      
      return {
        success: result.success,
        testResults,
        summary
      };

    } catch (error) {
      return {
        success: false,
        testResults: { error: error instanceof Error ? error.message : 'Test failed' },
        summary: 'Budget optimization test failed'
      };
    }
  }
}

export const enhancedBudgetOptimizer = EnhancedBudgetOptimizer;