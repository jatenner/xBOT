/**
 * 🏥 SYSTEM HEALTH ENDPOINT
 * 
 * Comprehensive system status monitoring endpoint for the autonomous Twitter bot.
 * Provides real-time status of all critical components and performance metrics.
 */

import { autonomousPostingEngine } from '../core/autonomousPostingEngine';
import { enhancedSemanticUniqueness } from './enhancedSemanticUniqueness';
import { robustTemplateSelection } from './robustTemplateSelection';
import { emergencyBudgetLockdown } from './emergencyBudgetLockdown';
import { supabaseClient } from './supabaseClient';
import { browserTweetPoster } from './browserTweetPoster';

interface SystemHealthReport {
  status: 'healthy' | 'warning' | 'critical';
  timestamp: string;
  uptime_hours: number;
  last_successful_post: {
    tweet_id: string | null;
    posted_at: string | null;
    minutes_ago: number | null;
    was_confirmed: boolean;
  };
  posting_performance: {
    total_posts: number;
    successful_posts: number;
    confirmed_posts: number;
    last_24h_posts: number;
    avg_posting_interval_minutes: number;
    consecutive_failures: number;
    success_rate_24h: number;
  };
  content_generation: {
    template_system_status: 'operational' | 'degraded' | 'failed';
    semantic_uniqueness_status: 'operational' | 'degraded' | 'failed';
    last_template_used: string | null;
    uniqueness_threshold: number;
    last_similarity_score: number | null;
  };
  budget_system: {
    status: 'operational' | 'warning' | 'lockdown';
    daily_spent: number;
    daily_limit: number;
    remaining_budget: number;
    lockdown_active: boolean;
    lockdown_reason: string | null;
  };
  browser_automation: {
    status: 'operational' | 'degraded' | 'failed';
    last_session_check: string | null;
    session_valid: boolean | null;
  };
  database_connectivity: {
    status: 'connected' | 'degraded' | 'disconnected';
    last_successful_query: string | null;
    connection_latency_ms: number | null;
  };
  engagement_tracking: {
    status: 'operational' | 'degraded' | 'failed';
    last_analytics_update: string | null;
    total_tracked_tweets: number;
  };
  error_summary: {
    last_24h_errors: Array<{
      timestamp: string;
      component: string;
      error_type: string;
      message: string;
    }>;
    critical_errors: number;
    warning_count: number;
  };
  next_actions: {
    next_posting_decision: string | null;
    estimated_next_post: string | null;
    recommended_actions: string[];
  };
}

export class SystemHealthEndpoint {
  private static startTime = Date.now();

  /**
   * 🏥 GET COMPREHENSIVE SYSTEM HEALTH REPORT
   */
  static async getHealthReport(): Promise<SystemHealthReport> {
    console.log('🏥 Generating comprehensive system health report...');
    
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    
    try {
      // Gather all health data in parallel
      const [
        postingStats,
        lastPostData,
        budgetStatus,
        templateHealth,
        uniquenessHealth,
        browserHealth,
        databaseHealth,
        engagementHealth,
        errorSummary
      ] = await Promise.all([
        this.getPostingPerformance(),
        this.getLastPostInfo(),
        this.getBudgetSystemHealth(),
        this.getTemplateSystemHealth(),
        this.getUniquenessSystemHealth(),
        this.getBrowserSystemHealth(),
        this.getDatabaseHealth(),
        this.getEngagementTrackingHealth(),
        this.getErrorSummary()
      ]);

      // Calculate overall system status
      const overallStatus = this.calculateOverallStatus({
        budgetStatus: budgetStatus.status,
        templateStatus: templateHealth.status,
        uniquenessStatus: uniquenessHealth.status,
        browserStatus: browserHealth.status,
        databaseStatus: databaseHealth.status,
        consecutiveFailures: postingStats.consecutive_failures
      });

      // Generate next actions
      const nextActions = await this.generateNextActions(overallStatus, postingStats, budgetStatus);

      const healthReport: SystemHealthReport = {
        status: overallStatus,
        timestamp,
        uptime_hours: (Date.now() - this.startTime) / (1000 * 60 * 60),
        last_successful_post: lastPostData,
        posting_performance: postingStats,
        content_generation: {
          template_system_status: templateHealth.status,
          semantic_uniqueness_status: uniquenessHealth.status,
          last_template_used: templateHealth.last_template_used,
          uniqueness_threshold: uniquenessHealth.threshold,
          last_similarity_score: uniquenessHealth.last_similarity_score
        },
        budget_system: budgetStatus,
        browser_automation: browserHealth,
        database_connectivity: databaseHealth,
        engagement_tracking: engagementHealth,
        error_summary: errorSummary,
        next_actions: nextActions
      };

      const generationTime = Date.now() - startTime;
      console.log(`✅ Health report generated in ${generationTime}ms`);
      
      return healthReport;

    } catch (error) {
      console.error('❌ Failed to generate health report:', error);
      
      return {
        status: 'critical',
        timestamp,
        uptime_hours: (Date.now() - this.startTime) / (1000 * 60 * 60),
        last_successful_post: {
          tweet_id: null,
          posted_at: null,
          minutes_ago: null,
          was_confirmed: false
        },
        posting_performance: {
          total_posts: 0,
          successful_posts: 0,
          confirmed_posts: 0,
          last_24h_posts: 0,
          avg_posting_interval_minutes: 0,
          consecutive_failures: 999,
          success_rate_24h: 0
        },
        content_generation: {
          template_system_status: 'failed',
          semantic_uniqueness_status: 'failed',
          last_template_used: null,
          uniqueness_threshold: 0.75,
          last_similarity_score: null
        },
        budget_system: {
          status: 'lockdown',
          daily_spent: 0,
          daily_limit: 5,
          remaining_budget: 0,
          lockdown_active: true,
          lockdown_reason: 'Health check failed'
        },
        browser_automation: {
          status: 'failed',
          last_session_check: null,
          session_valid: false
        },
        database_connectivity: {
          status: 'disconnected',
          last_successful_query: null,
          connection_latency_ms: null
        },
        engagement_tracking: {
          status: 'failed',
          last_analytics_update: null,
          total_tracked_tweets: 0
        },
        error_summary: {
          last_24h_errors: [{
            timestamp: timestamp,
            component: 'health_endpoint',
            error_type: 'system_error',
            message: error.message
          }],
          critical_errors: 1,
          warning_count: 0
        },
        next_actions: {
          next_posting_decision: null,
          estimated_next_post: null,
          recommended_actions: ['System requires immediate attention', 'Check logs for detailed error information']
        }
      };
    }
  }

  /**
   * 📊 GET POSTING PERFORMANCE METRICS
   */
  private static async getPostingPerformance(): Promise<{
    total_posts: number;
    successful_posts: number;
    confirmed_posts: number;
    last_24h_posts: number;
    avg_posting_interval_minutes: number;
    consecutive_failures: number;
    success_rate_24h: number;
  }> {
    try {
      const stats = await autonomousPostingEngine.getPostingStats();
      const successRate = stats.last_24h_posts > 0 
        ? (stats.confirmed_posts / stats.last_24h_posts) * 100 
        : 0;

      return {
        ...stats,
        success_rate_24h: successRate
      };
    } catch (error) {
      console.warn('⚠️ Failed to get posting performance:', error.message);
      return {
        total_posts: 0,
        successful_posts: 0,
        confirmed_posts: 0,
        last_24h_posts: 0,
        avg_posting_interval_minutes: 0,
        consecutive_failures: 999,
        success_rate_24h: 0
      };
    }
  }

  /**
   * 📝 GET LAST POST INFORMATION
   */
  private static async getLastPostInfo(): Promise<{
    tweet_id: string | null;
    posted_at: string | null;
    minutes_ago: number | null;
    was_confirmed: boolean;
  }> {
    try {
      const { data, error } = await supabaseClient.supabase
        .from('tweets')
        .select('id, created_at, was_posted, confirmed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return {
          tweet_id: null,
          posted_at: null,
          minutes_ago: null,
          was_confirmed: false
        };
      }

      const minutesAgo = Math.floor((Date.now() - new Date(data.created_at).getTime()) / (1000 * 60));

      return {
        tweet_id: data.id,
        posted_at: data.created_at,
        minutes_ago: minutesAgo,
        was_confirmed: data.confirmed || false
      };
    } catch (error) {
      console.warn('⚠️ Failed to get last post info:', error.message);
      return {
        tweet_id: null,
        posted_at: null,
        minutes_ago: null,
        was_confirmed: false
      };
    }
  }

  /**
   * 💰 GET BUDGET SYSTEM HEALTH
   */
  private static async getBudgetSystemHealth(): Promise<{
    status: 'operational' | 'warning' | 'lockdown';
    daily_spent: number;
    daily_limit: number;
    remaining_budget: number;
    lockdown_active: boolean;
    lockdown_reason: string | null;
  }> {
    try {
      const lockdownStatus = await emergencyBudgetLockdown.isLockedDown();
      
      const remaining = lockdownStatus.dailyLimit - lockdownStatus.totalSpent;
      let status: 'operational' | 'warning' | 'lockdown' = 'operational';
      
      if (lockdownStatus.lockdownActive) {
        status = 'lockdown';
      } else if (remaining < 1.0) {
        status = 'warning';
      }

      return {
        status,
        daily_spent: lockdownStatus.totalSpent,
        daily_limit: lockdownStatus.dailyLimit,
        remaining_budget: remaining,
        lockdown_active: lockdownStatus.lockdownActive,
        lockdown_reason: lockdownStatus.lockdownActive ? lockdownStatus.lockdownReason : null
      };
    } catch (error) {
      console.warn('⚠️ Failed to get budget health:', error.message);
      return {
        status: 'lockdown',
        daily_spent: 5.0,
        daily_limit: 5.0,
        remaining_budget: 0,
        lockdown_active: true,
        lockdown_reason: 'Budget check failed'
      };
    }
  }

  /**
   * 📋 GET TEMPLATE SYSTEM HEALTH
   */
  private static async getTemplateSystemHealth(): Promise<{
    status: 'operational' | 'degraded' | 'failed';
    last_template_used: string | null;
  }> {
    try {
      const testResult = await robustTemplateSelection.testTemplateSelection();
      const analytics = await robustTemplateSelection.getSelectionAnalytics();
      
      const status = testResult.test_passed ? 'operational' : 'degraded';
      
      return {
        status,
        last_template_used: analytics.total_templates > 0 ? 'Available' : null
      };
    } catch (error) {
      console.warn('⚠️ Failed to get template health:', error.message);
      return {
        status: 'failed',
        last_template_used: null
      };
    }
  }

  /**
   * 🧠 GET SEMANTIC UNIQUENESS SYSTEM HEALTH
   */
  private static async getUniquenessSystemHealth(): Promise<{
    status: 'operational' | 'degraded' | 'failed';
    threshold: number;
    last_similarity_score: number | null;
  }> {
    try {
      const testResult = await enhancedSemanticUniqueness.testSemanticUniqueness();
      const analytics = await enhancedSemanticUniqueness.getUniquenessAnalytics();
      
      const status = testResult.test_passed ? 'operational' : 'degraded';
      const lastScore = analytics.recent_duplicates.length > 0 
        ? analytics.recent_duplicates[0].similarity 
        : null;
      
      return {
        status,
        threshold: 0.75,
        last_similarity_score: lastScore
      };
    } catch (error) {
      console.warn('⚠️ Failed to get uniqueness health:', error.message);
      return {
        status: 'failed',
        threshold: 0.75,
        last_similarity_score: null
      };
    }
  }

  /**
   * 🌐 GET BROWSER AUTOMATION HEALTH
   */
  private static async getBrowserSystemHealth(): Promise<{
    status: 'operational' | 'degraded' | 'failed';
    last_session_check: string | null;
    session_valid: boolean | null;
  }> {
    try {
      // Quick session validation (non-intrusive)
      const fs = require('fs');
      const path = require('path');
      const sessionPath = path.join(process.cwd(), 'twitter-auth.json');
      
      if (fs.existsSync(sessionPath)) {
        const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
        const hasValidCookies = sessionData.cookies && Array.isArray(sessionData.cookies) && sessionData.cookies.length > 0;
        
        return {
          status: hasValidCookies ? 'operational' : 'degraded',
          last_session_check: new Date().toISOString(),
          session_valid: hasValidCookies
        };
      } else {
        return {
          status: 'failed',
          last_session_check: new Date().toISOString(),
          session_valid: false
        };
      }
    } catch (error) {
      console.warn('⚠️ Failed to get browser health:', error.message);
      return {
        status: 'failed',
        last_session_check: null,
        session_valid: false
      };
    }
  }

  /**
   * 🗃️ GET DATABASE CONNECTIVITY HEALTH
   */
  private static async getDatabaseHealth(): Promise<{
    status: 'connected' | 'degraded' | 'disconnected';
    last_successful_query: string | null;
    connection_latency_ms: number | null;
  }> {
    try {
      const startTime = Date.now();
      
      const { data, error } = await supabaseClient.supabase
        .from('tweets')
        .select('id')
        .limit(1);

      const latency = Date.now() - startTime;

      if (error) {
        return {
          status: 'disconnected',
          last_successful_query: null,
          connection_latency_ms: null
        };
      }

      const status = latency > 2000 ? 'degraded' : 'connected';

      return {
        status,
        last_successful_query: new Date().toISOString(),
        connection_latency_ms: latency
      };
    } catch (error) {
      console.warn('⚠️ Failed to get database health:', error.message);
      return {
        status: 'disconnected',
        last_successful_query: null,
        connection_latency_ms: null
      };
    }
  }

  /**
   * 📊 GET ENGAGEMENT TRACKING HEALTH
   */
  private static async getEngagementTrackingHealth(): Promise<{
    status: 'operational' | 'degraded' | 'failed';
    last_analytics_update: string | null;
    total_tracked_tweets: number;
  }> {
    try {
      const { data, error } = await supabaseClient.supabase
        .from('tweet_performance_analysis')
        .select('analyzed_at')
        .order('analyzed_at', { ascending: false })
        .limit(1);

      if (error) {
        return {
          status: 'failed',
          last_analytics_update: null,
          total_tracked_tweets: 0
        };
      }

      const { data: countData } = await supabaseClient.supabase
        .from('tweet_performance_analysis')
        .select('id', { count: 'exact' });

      return {
        status: 'operational',
        last_analytics_update: data?.[0]?.analyzed_at || null,
        total_tracked_tweets: countData?.length || 0
      };
    } catch (error) {
      console.warn('⚠️ Failed to get engagement health:', error.message);
      return {
        status: 'failed',
        last_analytics_update: null,
        total_tracked_tweets: 0
      };
    }
  }

  /**
   * ⚠️ GET ERROR SUMMARY
   */
  private static async getErrorSummary(): Promise<{
    last_24h_errors: Array<{
      timestamp: string;
      component: string;
      error_type: string;
      message: string;
    }>;
    critical_errors: number;
    warning_count: number;
  }> {
    // This would typically fetch from a logging system
    // For now, return a placeholder structure
    return {
      last_24h_errors: [],
      critical_errors: 0,
      warning_count: 0
    };
  }

  /**
   * 🔮 GENERATE NEXT ACTIONS
   */
  private static async generateNextActions(
    overallStatus: 'healthy' | 'warning' | 'critical',
    postingStats: any,
    budgetStatus: any
  ): Promise<{
    next_posting_decision: string | null;
    estimated_next_post: string | null;
    recommended_actions: string[];
  }> {
    const actions: string[] = [];
    
    // Budget-related actions
    if (budgetStatus.lockdown_active) {
      actions.push('Budget lockdown active - no posting until tomorrow');
    } else if (budgetStatus.status === 'warning') {
      actions.push('Budget warning - monitor spending closely');
    }

    // Posting-related actions
    if (postingStats.consecutive_failures > 2) {
      actions.push('Multiple consecutive failures - investigate posting system');
    }
    
    if (postingStats.last_24h_posts === 0) {
      actions.push('No posts in last 24h - check system status');
    }

    // Overall health actions
    if (overallStatus === 'critical') {
      actions.push('System critical - immediate attention required');
    } else if (overallStatus === 'warning') {
      actions.push('System degraded - monitor closely');
    } else {
      actions.push('System healthy - continue normal operation');
    }

    try {
      const decision = await autonomousPostingEngine.makePostingDecision();
      const nextPostTime = decision.should_post 
        ? 'Now' 
        : decision.wait_minutes 
          ? `${decision.wait_minutes} minutes`
          : 'Unknown';

      return {
        next_posting_decision: decision.reason,
        estimated_next_post: nextPostTime,
        recommended_actions: actions
      };
    } catch (error) {
      return {
        next_posting_decision: 'Decision system unavailable',
        estimated_next_post: 'Unknown',
        recommended_actions: [...actions, 'Fix posting decision system']
      };
    }
  }

  /**
   * 🎯 CALCULATE OVERALL SYSTEM STATUS
   */
  private static calculateOverallStatus(components: {
    budgetStatus: string;
    templateStatus: string;
    uniquenessStatus: string;
    browserStatus: string;
    databaseStatus: string;
    consecutiveFailures: number;
  }): 'healthy' | 'warning' | 'critical' {
    const {
      budgetStatus,
      templateStatus,
      uniquenessStatus,
      browserStatus,
      databaseStatus,
      consecutiveFailures
    } = components;

    // Critical conditions
    if (budgetStatus === 'lockdown' || 
        databaseStatus === 'disconnected' ||
        consecutiveFailures > 5) {
      return 'critical';
    }

    // Warning conditions
    if (budgetStatus === 'warning' ||
        templateStatus === 'failed' ||
        uniquenessStatus === 'failed' ||
        browserStatus === 'failed' ||
        databaseStatus === 'degraded' ||
        consecutiveFailures > 2) {
      return 'warning';
    }

    // Default to healthy
    return 'healthy';
  }

  /**
   * 🌐 EXPRESS ENDPOINT HANDLER
   */
  static async handleHealthRequest(req: any, res: any): Promise<void> {
    try {
      const healthReport = await this.getHealthReport();
      
      // Set appropriate HTTP status based on system health
      let httpStatus = 200;
      if (healthReport.status === 'warning') {
        httpStatus = 503; // Service Unavailable
      } else if (healthReport.status === 'critical') {
        httpStatus = 500; // Internal Server Error
      }

      res.status(httpStatus).json({
        success: true,
        health: healthReport,
        generated_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Health endpoint error:', error);
      res.status(500).json({
        success: false,
        error: 'Health check failed',
        message: error.message,
        generated_at: new Date().toISOString()
      });
    }
  }
}

export const systemHealthEndpoint = SystemHealthEndpoint; 