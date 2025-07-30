/**
 * 🎯 PHASE MANAGER
 * 
 * Handles automatic phase advancement based on performance metrics
 * and provides monitoring for the 4-phase rollout strategy
 */

import { supabaseClient } from './supabaseClient';
import { getCurrentPhase } from '../config/featureFlags';

interface PhaseMetrics {
  totalPosts: number;
  avgEngagement: number;
  daysInPhase: number;
  dailySpending: number;
  followerGrowth: number;
  aiContentPerformance?: number;
  lastPhaseChange?: Date;
}

interface PhaseAdvancementCriteria {
  minPosts: number;
  minDays: number;
  minEngagement?: number;
  maxDailySpend?: number;
  minFollowerGrowth?: number;
  aiOutperformsTemplates?: boolean;
}

export class PhaseManager {
  private static instance: PhaseManager;
  
  private constructor() {}
  
  static getInstance(): PhaseManager {
    if (!PhaseManager.instance) {
      PhaseManager.instance = new PhaseManager();
    }
    return PhaseManager.instance;
  }
  
  /**
   * Get current phase metrics from database
   */
  async getCurrentMetrics(): Promise<PhaseMetrics> {
    try {
      const currentPhase = getCurrentPhase();
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      // Get posts from last 7 days
      const { data: recentPosts } = await supabaseClient
        .from('tweet_performance')
        .select('*')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false });
      
      // Get follower count history
      const { data: followerHistory } = await supabaseClient
        .from('follower_history')
        .select('*')
        .gte('date', sevenDaysAgo.toISOString())
        .order('date', { ascending: false })
        .limit(7);
      
      // Get budget spending
      const { data: budgetData } = await supabaseClient
        .from('daily_budget_tracking')
        .select('*')
        .gte('date', sevenDaysAgo.toISOString())
        .order('date', { ascending: false });
      
      // Calculate metrics
      const totalPosts = recentPosts?.length || 0;
      const totalLikes = recentPosts?.reduce((sum, post) => sum + (post.likes || 0), 0) || 0;
      const totalImpressions = recentPosts?.reduce((sum, post) => sum + (post.impressions || 1), 0) || 1;
      const avgEngagement = totalImpressions > 0 ? totalLikes / totalImpressions : 0;
      
      const followerStart = followerHistory?.[followerHistory.length - 1]?.follower_count || 0;
      const followerEnd = followerHistory?.[0]?.follower_count || 0;
      const followerGrowth = followerEnd - followerStart;
      
      const dailySpending = budgetData?.reduce((sum, day) => sum + (day.total_spent || 0), 0) || 0;
      
      // Calculate days in current phase (estimate)
      const daysInPhase = await this.calculateDaysInPhase();
      
      return {
        totalPosts,
        avgEngagement,
        daysInPhase,
        dailySpending: dailySpending / 7, // Average daily spending
        followerGrowth,
        lastPhaseChange: await this.getLastPhaseChangeDate()
      };
      
    } catch (error) {
      console.error('❌ Error calculating phase metrics:', error);
      return {
        totalPosts: 0,
        avgEngagement: 0,
        daysInPhase: 0,
        dailySpending: 0,
        followerGrowth: 0
      };
    }
  }
  
  /**
   * Check if current phase should be advanced
   */
  async shouldAdvancePhase(): Promise<{ shouldAdvance: boolean; reason: string; nextPhase?: string }> {
    const currentPhase = getCurrentPhase();
    const metrics = await this.getCurrentMetrics();
    
    const criteria = this.getAdvancementCriteria(currentPhase.phase);
    
    switch (currentPhase.phase) {
      case 'data_collection':
        if (metrics.totalPosts >= criteria.minPosts && metrics.daysInPhase >= criteria.minDays) {
          return {
            shouldAdvance: true,
            reason: `✅ Data collection complete: ${metrics.totalPosts} posts over ${metrics.daysInPhase} days`,
            nextPhase: 'ai_trial'
          };
        }
        break;
        
      case 'ai_trial':
        if (metrics.totalPosts >= criteria.minPosts && 
            metrics.daysInPhase >= criteria.minDays &&
            metrics.avgEngagement >= (criteria.minEngagement || 0.02)) {
          return {
            shouldAdvance: true,
            reason: `✅ AI trial successful: ${(metrics.avgEngagement * 100).toFixed(1)}% engagement over ${metrics.daysInPhase} days`,
            nextPhase: 'learning_loop'
          };
        }
        break;
        
      case 'learning_loop':
        if (metrics.totalPosts >= criteria.minPosts && 
            metrics.daysInPhase >= criteria.minDays &&
            metrics.avgEngagement >= (criteria.minEngagement || 0.05)) {
          return {
            shouldAdvance: true,
            reason: `✅ Learning optimization proven: ${(metrics.avgEngagement * 100).toFixed(1)}% engagement, ${metrics.followerGrowth} followers gained`,
            nextPhase: 'growth_mode'
          };
        }
        break;
        
      case 'growth_mode':
        return {
          shouldAdvance: false,
          reason: '🎯 Already in final growth mode - monitoring performance'
        };
    }
    
    // Calculate remaining requirements
    const remainingPosts = Math.max(0, criteria.minPosts - metrics.totalPosts);
    const remainingDays = Math.max(0, criteria.minDays - metrics.daysInPhase);
    const currentEngagementPct = (metrics.avgEngagement * 100).toFixed(1);
    const requiredEngagementPct = ((criteria.minEngagement || 0) * 100).toFixed(1);
    
    let reason = `📊 Phase ${currentPhase.phase} progress:\n`;
    reason += `   Posts: ${metrics.totalPosts}/${criteria.minPosts} (need ${remainingPosts} more)\n`;
    reason += `   Days: ${metrics.daysInPhase}/${criteria.minDays} (need ${remainingDays} more)\n`;
    reason += `   Engagement: ${currentEngagementPct}%`;
    if (criteria.minEngagement) {
      reason += `/${requiredEngagementPct}%`;
    }
    
    return {
      shouldAdvance: false,
      reason: reason.trim()
    };
  }
  
  /**
   * Log phase advancement recommendation
   */
  async logPhaseAdvancementCheck(): Promise<void> {
    const advancement = await this.shouldAdvancePhase();
    const currentPhase = getCurrentPhase();
    
    if (advancement.shouldAdvance) {
      console.log(`🎯 PHASE ADVANCEMENT RECOMMENDED:`);
      console.log(`   Current: ${currentPhase.phase}`);
      console.log(`   Next: ${advancement.nextPhase}`);
      console.log(`   Reason: ${advancement.reason}`);
      console.log(`   📝 Update BOT_PHASE environment variable to advance`);
    } else {
      console.log(`📊 Phase Status (${currentPhase.phase}):`);
      console.log(`   ${advancement.reason}`);
    }
  }
  
  /**
   * Get phase performance summary for dashboard
   */
  async getPhasePerformanceSummary(): Promise<any> {
    const currentPhase = getCurrentPhase();
    const metrics = await this.getCurrentMetrics();
    const advancement = await this.shouldAdvancePhase();
    
    return {
      currentPhase: currentPhase.phase,
      description: currentPhase.description,
      aiUsage: currentPhase.aiUsage,
      metrics: {
        totalPosts: metrics.totalPosts,
        engagementRate: `${(metrics.avgEngagement * 100).toFixed(1)}%`,
        dailySpending: `$${metrics.dailySpending.toFixed(2)}`,
        followerGrowth: metrics.followerGrowth,
        daysInPhase: metrics.daysInPhase
      },
      advancement: {
        canAdvance: advancement.shouldAdvance,
        nextPhase: advancement.nextPhase,
        reason: advancement.reason
      },
      recommendation: advancement.shouldAdvance ? 
        `Ready to advance to ${advancement.nextPhase}! Update BOT_PHASE environment variable.` :
        'Continue current phase - monitoring progress.'
    };
  }
  
  private getAdvancementCriteria(phase: string): PhaseAdvancementCriteria {
    switch (phase) {
      case 'data_collection':
        return {
          minPosts: 30,
          minDays: 3,
          maxDailySpend: 1.0
        };
        
      case 'ai_trial':
        return {
          minPosts: 60,
          minDays: 4,
          minEngagement: 0.02, // 2% engagement rate
          maxDailySpend: 2.0
        };
        
      case 'learning_loop':
        return {
          minPosts: 100,
          minDays: 7,
          minEngagement: 0.05, // 5% engagement rate
          maxDailySpend: 3.0,
          minFollowerGrowth: 20
        };
        
      case 'growth_mode':
        return {
          minPosts: 200,
          minDays: 14,
          minEngagement: 0.08, // 8% engagement rate
          maxDailySpend: 5.0,
          minFollowerGrowth: 50
        };
        
      default:
        return {
          minPosts: 30,
          minDays: 3
        };
    }
  }
  
  private async calculateDaysInPhase(): Promise<number> {
    // This would ideally track actual phase change dates
    // For now, estimate based on deployment or manual tracking
    try {
      const { data: phaseHistory } = await supabaseClient
        .from('phase_history')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(1);
        
      if (phaseHistory && phaseHistory.length > 0) {
        const lastChange = new Date(phaseHistory[0].changed_at);
        const now = new Date();
        return Math.floor((now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24));
      }
    } catch (error) {
      // Table might not exist yet
    }
    
    // Fallback: estimate based on bot deployment age
    return 1; // Default to 1 day if no history available
  }
  
  private async getLastPhaseChangeDate(): Promise<Date | undefined> {
    try {
      const { data: phaseHistory } = await supabaseClient
        .from('phase_history')
        .select('changed_at')
        .order('changed_at', { ascending: false })
        .limit(1);
        
      return phaseHistory?.[0]?.changed_at ? new Date(phaseHistory[0].changed_at) : undefined;
    } catch (error) {
      return undefined;
    }
  }
}

// Export singleton
export const phaseManager = PhaseManager.getInstance();

// Export convenience functions
export const getCurrentPhaseMetrics = () => phaseManager.getCurrentMetrics();
export const checkPhaseAdvancement = () => phaseManager.shouldAdvancePhase();
export const logPhaseStatus = () => phaseManager.logPhaseAdvancementCheck();
export const getPhasePerformance = () => phaseManager.getPhasePerformanceSummary();