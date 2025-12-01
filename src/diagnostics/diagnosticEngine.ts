/**
 * 🤖 INTELLIGENT DIAGNOSTIC ENGINE
 * Analyzes system state and generates insights about what's working and what needs attention
 */

import { getSupabaseClient } from '../db';
import { JobManager } from '../jobs/jobManager';
import { getHeartbeat } from '../jobs/jobHeartbeat';
import { DataAuthenticityGuard } from '../intelligence/dataAuthenticityGuard';
import { getSystemStatus } from '../api/status';

export interface DiagnosticMessage {
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
  explanation?: string;
  action?: string;
  severity: 'low' | 'medium' | 'high';
  stage: 'content_generation' | 'posting' | 'metrics' | 'learning' | 'system';
  autoFix: boolean;
  status: 'resolved' | 'investigating' | 'action_required';
  timestamp: string;
}

export interface StageStatus {
  status: 'active' | 'warning' | 'error';
  lastRun: string | null;
  nextRun: string | null;
  healthScore: number;
  issues: DiagnosticMessage[];
}

export interface SystemDiagnostics {
  overallStatus: 'healthy' | 'warning' | 'critical';
  messages: DiagnosticMessage[];
  stages: {
    contentGeneration: StageStatus;
    posting: StageStatus;
    metrics: StageStatus;
    learning: StageStatus;
  };
  timestamp: string;
}

export class DiagnosticEngine {
  private static instance: DiagnosticEngine;
  
  private constructor() {}
  
  public static getInstance(): DiagnosticEngine {
    if (!DiagnosticEngine.instance) {
      DiagnosticEngine.instance = new DiagnosticEngine();
    }
    return DiagnosticEngine.instance;
  }

  /**
   * Run complete diagnostic analysis
   */
  public async runDiagnostics(): Promise<SystemDiagnostics> {
    console.log('[DIAGNOSTICS] 🔍 Running system diagnostics...');
    
    const [contentGen, posting, metrics, learning, systemMessages] = await Promise.all([
      this.analyzeContentGeneration(),
      this.analyzePosting(),
      this.analyzeMetrics(),
      this.analyzeLearning(),
      this.generateSystemMessages()
    ]);

    const overallStatus = this.determineOverallStatus([
      contentGen.status,
      posting.status,
      metrics.status,
      learning.status
    ]);

    return {
      overallStatus,
      messages: systemMessages,
      stages: {
        contentGeneration: contentGen,
        posting: posting,
        metrics: metrics,
        learning: learning
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Analyze content generation stage
   */
  private async analyzeContentGeneration(): Promise<StageStatus> {
    const supabase = getSupabaseClient();
    const heartbeat = await getHeartbeat('plan');
    const jobManager = JobManager.getInstance();
    const stats = jobManager.getStats();

    const issues: DiagnosticMessage[] = [];
    let status: 'active' | 'warning' | 'error' = 'active';
    let healthScore = 100;

    // Check if job has run recently (should run every 2 hours)
    if (heartbeat?.last_success) {
      const lastRun = new Date(heartbeat.last_success);
      const hoursSinceRun = (Date.now() - lastRun.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceRun > 3) {
        status = 'warning';
        healthScore -= 30;
        issues.push({
          type: 'warning',
          message: `Content generation hasn't run in ${Math.round(hoursSinceRun)} hours`,
          explanation: 'The plan job should run every 2 hours. It might have failed silently or gotten stuck.',
          action: 'Checking job status and triggering emergency run if needed.',
          severity: 'medium',
          stage: 'content_generation',
          autoFix: true,
          status: 'investigating',
          timestamp: new Date().toISOString()
        });
      } else if (hoursSinceRun > 2.5) {
        status = 'warning';
        healthScore -= 10;
        issues.push({
          type: 'info',
          message: 'Content generation is due to run soon',
          explanation: 'The plan job typically runs every 2 hours and will run again shortly.',
          severity: 'low',
          stage: 'content_generation',
          autoFix: false,
          status: 'resolved',
          timestamp: new Date().toISOString()
        });
      }
    } else {
      // Job has never run
      status = 'error';
      healthScore = 0;
      issues.push({
        type: 'error',
        message: 'Content generation job has never run successfully',
        explanation: 'This is critical - without content generation, no posts can be created.',
        action: 'Immediately triggering plan job to generate content.',
        severity: 'high',
        stage: 'content_generation',
        autoFix: true,
        status: 'action_required',
        timestamp: new Date().toISOString()
      });
    }

    // Check for consecutive failures
    if (heartbeat?.consecutive_failures && heartbeat.consecutive_failures > 0) {
      status = heartbeat.consecutive_failures > 3 ? 'error' : 'warning';
      healthScore -= heartbeat.consecutive_failures * 15;
      issues.push({
        type: heartbeat.consecutive_failures > 3 ? 'error' : 'warning',
        message: `Content generation has failed ${heartbeat.consecutive_failures} time(s) in a row`,
        explanation: heartbeat.last_error || 'Unknown error occurred during content generation',
        action: 'Reviewing error logs and attempting automatic recovery.',
        severity: heartbeat.consecutive_failures > 3 ? 'high' : 'medium',
        stage: 'content_generation',
        autoFix: true,
        status: 'investigating',
        timestamp: new Date().toISOString()
      });
    }

    // Check queue status
    const { data: queueData } = await supabase
      .from('content_metadata')
      .select('decision_id')
      .eq('status', 'queued')
      .limit(1);

    if (!queueData || queueData.length === 0) {
      if (stats.planRuns === 0) {
        issues.push({
          type: 'warning',
          message: 'No content in queue',
          explanation: 'The content queue is empty. If content generation has run, posts may have already been posted.',
          severity: 'low',
          stage: 'content_generation',
          autoFix: false,
          status: 'resolved',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Calculate next run time (assume 2 hour interval)
    const nextRun = heartbeat?.last_success
      ? new Date(new Date(heartbeat.last_success).getTime() + 2 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 2 * 60 * 1000).toISOString(); // 2 minutes from now if never run

    return {
      status,
      lastRun: heartbeat?.last_success || null,
      nextRun,
      healthScore: Math.max(0, Math.min(100, healthScore)),
      issues
    };
  }

  /**
   * Analyze posting stage
   */
  private async analyzePosting(): Promise<StageStatus> {
    const supabase = getSupabaseClient();
    const heartbeat = await getHeartbeat('posting');
    const jobManager = JobManager.getInstance();
    const stats = jobManager.getStats();

    const issues: DiagnosticMessage[] = [];
    let status: 'active' | 'warning' | 'error' = 'active';
    let healthScore = 100;

    // Check if posting job has run recently (should run every 5 minutes)
    if (heartbeat?.last_success) {
      const lastRun = new Date(heartbeat.last_success);
      const minutesSinceRun = (Date.now() - lastRun.getTime()) / (1000 * 60);
      
      if (minutesSinceRun > 15) {
        status = 'warning';
        healthScore -= 30;
        issues.push({
          type: 'warning',
          message: `Posting job hasn't run in ${Math.round(minutesSinceRun)} minutes`,
          explanation: 'The posting job should run every 5 minutes. It might be stuck or failing.',
          action: 'Checking job status and browser connection.',
          severity: 'medium',
          stage: 'posting',
          autoFix: true,
          status: 'investigating',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Check for failures
    if (heartbeat?.consecutive_failures && heartbeat.consecutive_failures > 0) {
      status = heartbeat.consecutive_failures > 2 ? 'error' : 'warning';
      healthScore -= heartbeat.consecutive_failures * 20;
      issues.push({
        type: heartbeat.consecutive_failures > 2 ? 'error' : 'warning',
        message: `Posting has failed ${heartbeat.consecutive_failures} time(s) in a row`,
        explanation: heartbeat.last_error || 'Posting job encountered an error',
        action: 'Reviewing error logs and checking browser session.',
        severity: heartbeat.consecutive_failures > 2 ? 'high' : 'medium',
        stage: 'posting',
        autoFix: true,
        status: 'investigating',
        timestamp: new Date().toISOString()
      });
    }

    // Check posting success rate from posting_attempts
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: attempts } = await supabase
      .from('posting_attempts')
      .select('status')
      .gte('created_at', oneDayAgo);

    if (attempts && attempts.length > 0) {
      // 🔥 FIX: Only count final statuses ('success' or 'failed'), not 'attempting'
      // Every post logs: 'attempting' → 'success' OR 'failed'
      // Counting 'attempting' inflates the denominator incorrectly
      const finalAttempts = attempts.filter(a => a.status !== 'attempting');
      const successCount = finalAttempts.filter(a => a.status === 'success').length;
      const successRate = finalAttempts.length > 0 ? successCount / finalAttempts.length : 0;
      
      if (successRate < 0.9) {
        status = successRate < 0.7 ? 'error' : 'warning';
        healthScore -= (1 - successRate) * 50;
        issues.push({
          type: successRate < 0.7 ? 'error' : 'warning',
          message: `Posting success rate is ${Math.round(successRate * 100)}%`,
          explanation: `Out of ${attempts.length} recent posting attempts, ${attempts.length - successCount} failed.`,
          action: 'Investigating common failure patterns and improving error handling.',
          severity: successRate < 0.7 ? 'high' : 'medium',
          stage: 'posting',
          autoFix: true,
          status: 'investigating',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Check queue - should have some queued posts
    const { data: queuedPosts } = await supabase
      .from('content_metadata')
      .select('decision_id')
      .eq('status', 'queued')
      .limit(1);

    if (!queuedPosts || queuedPosts.length === 0) {
      // This is okay if we just posted, but warn if it's been a while
      issues.push({
        type: 'info',
        message: 'No posts waiting in queue',
        explanation: 'Either all posts have been posted, or content generation needs to create more.',
        severity: 'low',
        stage: 'posting',
        autoFix: false,
        status: 'resolved',
        timestamp: new Date().toISOString()
      });
    }

    const nextRun = heartbeat?.last_success
      ? new Date(new Date(heartbeat.last_success).getTime() + 5 * 60 * 1000).toISOString()
      : new Date(Date.now() + 1 * 60 * 1000).toISOString();

    return {
      status,
      lastRun: heartbeat?.last_success || null,
      nextRun,
      healthScore: Math.max(0, Math.min(100, healthScore)),
      issues
    };
  }

  /**
   * Analyze metrics collection stage
   */
  private async analyzeMetrics(): Promise<StageStatus> {
    const supabase = getSupabaseClient();
    const heartbeat = await getHeartbeat('metrics_scraper') || await getHeartbeat('analytics');
    
    const issues: DiagnosticMessage[] = [];
    let status: 'active' | 'warning' | 'error' = 'active';
    let healthScore = 100;

    // Check if metrics job has run recently (should run every 10 minutes)
    if (heartbeat?.last_success) {
      const lastRun = new Date(heartbeat.last_success);
      const minutesSinceRun = (Date.now() - lastRun.getTime()) / (1000 * 60);
      
      if (minutesSinceRun > 20) {
        status = 'warning';
        healthScore -= 25;
        issues.push({
          type: 'warning',
          message: `Metrics scraper hasn't run in ${Math.round(minutesSinceRun)} minutes`,
          explanation: 'The metrics scraper should run every 10 minutes to collect engagement data.',
          action: 'Checking scraper status and browser connection.',
          severity: 'medium',
          stage: 'metrics',
          autoFix: true,
          status: 'investigating',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Check data quality - posts with metrics
    const { data: postsWithMetrics } = await supabase
      .from('content_metadata')
      .select('decision_id, actual_impressions, actual_likes')
      .eq('status', 'posted')
      .not('tweet_id', 'is', null)
      .limit(100);

    if (postsWithMetrics) {
      const postsWithValidMetrics = postsWithMetrics.filter(
        p => p.actual_impressions !== null && p.actual_impressions > 0
      );
      const metricsCoverage = postsWithValidMetrics.length / postsWithMetrics.length;
      
      if (metricsCoverage < 0.8) {
        status = metricsCoverage < 0.6 ? 'error' : 'warning';
        healthScore -= (1 - metricsCoverage) * 40;
        issues.push({
          type: metricsCoverage < 0.6 ? 'error' : 'warning',
          message: `Only ${Math.round(metricsCoverage * 100)}% of posts have metrics`,
          explanation: `${postsWithMetrics.length - postsWithValidMetrics.length} posts are missing engagement data.`,
          action: 'Re-scraping missing metrics for recent posts.',
          severity: metricsCoverage < 0.6 ? 'high' : 'medium',
          stage: 'metrics',
          autoFix: true,
          status: 'investigating',
          timestamp: new Date().toISOString()
        });
      }
    }

    const nextRun = heartbeat?.last_success
      ? new Date(new Date(heartbeat.last_success).getTime() + 10 * 60 * 1000).toISOString()
      : new Date(Date.now() + 10 * 60 * 1000).toISOString();

    return {
      status,
      lastRun: heartbeat?.last_success || null,
      nextRun,
      healthScore: Math.max(0, Math.min(100, healthScore)),
      issues
    };
  }

  /**
   * Analyze learning stage
   */
  private async analyzeLearning(): Promise<StageStatus> {
    const heartbeat = await getHeartbeat('learn');
    
    const issues: DiagnosticMessage[] = [];
    let status: 'active' | 'warning' | 'error' = 'active';
    let healthScore = 100;

    // Check if learning job has run recently (should run every hour)
    if (heartbeat?.last_success) {
      const lastRun = new Date(heartbeat.last_success);
      const hoursSinceRun = (Date.now() - lastRun.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceRun > 2) {
        status = 'warning';
        healthScore -= 20;
        issues.push({
          type: 'warning',
          message: `Learning job hasn't run in ${Math.round(hoursSinceRun)} hours`,
          explanation: 'The learning job should run every hour to optimize content based on performance.',
          action: 'Scheduling next learning cycle.',
          severity: 'medium',
          stage: 'learning',
          autoFix: true,
          status: 'resolved',
          timestamp: new Date().toISOString()
        });
      }
    }

    const nextRun = heartbeat?.last_success
      ? new Date(new Date(heartbeat.last_success).getTime() + 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 60 * 60 * 1000).toISOString();

    return {
      status,
      lastRun: heartbeat?.last_success || null,
      nextRun,
      healthScore: Math.max(0, Math.min(100, healthScore)),
      issues
    };
  }

  /**
   * Generate system-wide messages
   */
  private async generateSystemMessages(): Promise<DiagnosticMessage[]> {
    const messages: DiagnosticMessage[] = [];
    const systemStatus = await getSystemStatus();

    // Overall system health
    if (systemStatus.status === 'healthy') {
      messages.push({
        type: 'success',
        message: 'All systems are operating normally',
        explanation: 'Your xBOT system is running smoothly. All critical jobs are active and functioning as expected.',
        severity: 'low',
        stage: 'system',
        autoFix: false,
        status: 'resolved',
        timestamp: new Date().toISOString()
      });
    } else if (systemStatus.status === 'degraded') {
      messages.push({
        type: 'warning',
        message: 'System is operating with some issues',
        explanation: 'Some components are experiencing problems, but the system is still functional.',
        severity: 'medium',
        stage: 'system',
        autoFix: true,
        status: 'investigating',
        timestamp: new Date().toISOString()
      });
    } else {
      messages.push({
        type: 'error',
        message: 'System health is critical',
        explanation: 'Critical components are failing. Immediate attention may be required.',
        action: 'Reviewing all system components and attempting automatic recovery.',
        severity: 'high',
        stage: 'system',
        autoFix: true,
        status: 'action_required',
        timestamp: new Date().toISOString()
      });
    }

    // Database health
    if (!systemStatus.database.connected) {
      messages.push({
        type: 'error',
        message: 'Database connection failed',
        explanation: 'Cannot connect to the database. This will prevent all operations.',
        action: 'Checking database connection and retrying.',
        severity: 'high',
        stage: 'system',
        autoFix: true,
        status: 'action_required',
        timestamp: new Date().toISOString()
      });
    }

    // Memory usage
    if (systemStatus.memory.used_mb > 400) {
      messages.push({
        type: 'warning',
        message: `High memory usage: ${systemStatus.memory.used_mb}MB`,
        explanation: 'Memory usage is elevated. This may slow down operations.',
        severity: 'medium',
        stage: 'system',
        autoFix: false,
        status: 'investigating',
        timestamp: new Date().toISOString()
      });
    }

    return messages;
  }

  /**
   * Determine overall system status
   */
  private determineOverallStatus(stageStatuses: ('active' | 'warning' | 'error')[]): 'healthy' | 'warning' | 'critical' {
    if (stageStatuses.includes('error')) {
      return 'critical';
    }
    if (stageStatuses.includes('warning')) {
      return 'warning';
    }
    return 'healthy';
  }
}

