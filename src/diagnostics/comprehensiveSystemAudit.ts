/**
 * 🔍 COMPREHENSIVE SYSTEM AUDIT
 * Deep analysis of entire system to identify all issues and create fix plan
 */

import { getSupabaseClient } from '../db';
import { getHeartbeat } from '../jobs/jobHeartbeat';
import { DiagnosticEngine } from './diagnosticEngine';
import { getCircuitBreakerStatus } from '../jobs/postingQueue';
import { JobManager } from '../jobs/jobManager';
import { getConfig } from '../config/config';

export interface SystemComponent {
  name: string;
  type: 'job' | 'service' | 'database' | 'external_api' | 'config';
  status: 'healthy' | 'degraded' | 'failed' | 'unknown';
  healthScore: number;
  lastRun?: string | null;
  lastSuccess?: string | null;
  lastFailure?: string | null;
  consecutiveFailures: number;
  errorMessage?: string | null;
  expectedInterval?: number;
  actualInterval?: number;
  dependencies: string[];
  impact: 'critical' | 'high' | 'medium' | 'low';
  issues: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    rootCause?: string;
    fix?: string;
  }>;
}

export interface SystemAuditReport {
  timestamp: string;
  overallHealth: 'healthy' | 'degraded' | 'critical';
  components: SystemComponent[];
  criticalIssues: Array<{
    component: string;
    issue: string;
    rootCause: string;
    fix: string;
    priority: number;
  }>;
  dataFlowIssues: Array<{
    stage: string;
    issue: string;
    impact: string;
  }>;
  configurationIssues: Array<{
    setting: string;
    currentValue: any;
    expectedValue: any;
    impact: string;
  }>;
  recommendations: Array<{
    priority: number;
    action: string;
    expectedImpact: string;
    effort: 'low' | 'medium' | 'high';
  }>;
}

export class ComprehensiveSystemAudit {
  private static instance: ComprehensiveSystemAudit;
  
  private constructor() {}
  
  public static getInstance(): ComprehensiveSystemAudit {
    if (!ComprehensiveSystemAudit.instance) {
      ComprehensiveSystemAudit.instance = new ComprehensiveSystemAudit();
    }
    return ComprehensiveSystemAudit.instance;
  }

  /**
   * Run comprehensive audit of entire system
   */
  public async runAudit(): Promise<SystemAuditReport> {
    console.log('[SYSTEM_AUDIT] 🔍 Starting comprehensive system audit...');
    
    const supabase = getSupabaseClient();
    const engine = DiagnosticEngine.getInstance();
    const diagnostics = await engine.runDiagnostics();
    const config = getConfig();
    
    // Map all system components
    const components = await this.mapAllComponents(supabase, config);
    
    // Analyze data flow
    const dataFlowIssues = await this.analyzeDataFlow(supabase);
    
    // Analyze configuration
    const configurationIssues = await this.analyzeConfiguration(config);
    
    // Identify critical issues
    const criticalIssues = this.identifyCriticalIssues(components, dataFlowIssues, configurationIssues);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(components, criticalIssues);
    
    // Determine overall health
    const overallHealth = this.determineOverallHealth(components, criticalIssues);
    
    return {
      timestamp: new Date().toISOString(),
      overallHealth,
      components,
      criticalIssues,
      dataFlowIssues,
      configurationIssues,
      recommendations
    };
  }

  /**
   * Map all system components
   */
  private async mapAllComponents(supabase: any, config: any): Promise<SystemComponent[]> {
    const components: SystemComponent[] = [];
    
    // Job components
    const jobNames = [
      { name: 'plan', interval: config.JOBS_PLAN_INTERVAL_MIN, impact: 'critical' as const },
      { name: 'posting', interval: 5, impact: 'critical' as const },
      { name: 'analytics', interval: 360, impact: 'high' as const },
      { name: 'metrics_scraper', interval: 10, impact: 'high' as const },
      { name: 'learn', interval: config.JOBS_LEARN_INTERVAL_MIN || 60, impact: 'medium' as const },
      { name: 'reply_posting', interval: config.JOBS_REPLY_INTERVAL_MIN || 30, impact: 'high' as const },
      { name: 'account_discovery', interval: 1440, impact: 'medium' as const },
      { name: 'self_healing', interval: 15, impact: 'medium' as const }
    ];
    
    for (const job of jobNames) {
      const heartbeat = await getHeartbeat(job.name);
      const component = await this.analyzeComponent(job.name, 'job', heartbeat, job.interval, job.impact, supabase);
      components.push(component);
    }
    
    // Service components
    const circuitBreaker = getCircuitBreakerStatus();
    if (circuitBreaker.state === 'open') {
      components.push({
        name: 'Posting Circuit Breaker',
        type: 'service',
        status: 'failed',
        healthScore: 0,
        consecutiveFailures: circuitBreaker.failures,
        dependencies: ['posting'],
        impact: 'critical',
        issues: [{
          severity: 'critical',
          description: `Circuit breaker is OPEN - blocking all posting operations`,
          rootCause: `Posting failed ${circuitBreaker.failures} times consecutively`,
          fix: `Check posting errors, fix root cause, wait ${Math.ceil((circuitBreaker.timeUntilReset || 0) / 1000)}s for auto-reset or manually reset`
        }]
      });
    }
    
    return components;
  }

  /**
   * Analyze individual component
   */
  private async analyzeComponent(
    name: string,
    type: SystemComponent['type'],
    heartbeat: any,
    expectedInterval: number,
    impact: SystemComponent['impact'],
    supabase: any
  ): Promise<SystemComponent> {
    const now = Date.now();
    const lastSuccess = heartbeat?.last_success ? new Date(heartbeat.last_success).getTime() : null;
    const lastFailure = heartbeat?.last_failure ? new Date(heartbeat.last_failure).getTime() : null;
    const lastRun = heartbeat?.updated_at ? new Date(heartbeat.updated_at).getTime() : null;
    
    const issues: SystemComponent['issues'] = [];
    let status: SystemComponent['status'] = 'healthy';
    let healthScore = 100;
    
    // Check if job exists
    if (!heartbeat) {
      status = 'unknown';
      healthScore = 0;
      issues.push({
        severity: 'high',
        description: 'Job has never run - no heartbeat found',
        rootCause: 'Job may not be registered or scheduled',
        fix: 'Check JobManager registration and scheduling'
      });
      return {
        name,
        type,
        status,
        healthScore,
        consecutiveFailures: 0,
        dependencies: [],
        impact,
        issues,
        expectedInterval
      };
    }
    
    // Check consecutive failures
    const consecutiveFailures = heartbeat.consecutive_failures || 0;
    if (consecutiveFailures > 0) {
      if (consecutiveFailures > 3) {
        status = 'failed';
        healthScore = 0;
      } else {
        status = 'degraded';
        healthScore = Math.max(0, 100 - (consecutiveFailures * 25));
      }
      
      issues.push({
        severity: consecutiveFailures > 3 ? 'critical' : 'high',
        description: `${consecutiveFailures} consecutive failures`,
        rootCause: heartbeat.last_error || 'Unknown error',
        fix: 'Review error logs, check dependencies, verify configuration'
      });
    }
    
    // Check if job is stale (hasn't run in expected interval * 2)
    if (lastSuccess) {
      const minutesSinceSuccess = (now - lastSuccess) / (1000 * 60);
      const staleThreshold = expectedInterval * 2;
      
      if (minutesSinceSuccess > staleThreshold) {
        status = 'degraded';
        healthScore = Math.max(0, healthScore - 30);
        issues.push({
          severity: 'high',
          description: `Job hasn't succeeded in ${Math.round(minutesSinceSuccess)} minutes (expected every ${expectedInterval} min)`,
          rootCause: 'Job may be stuck, failing silently, or not scheduled correctly',
          fix: 'Check job scheduling, verify job is running, check for silent failures'
        });
      }
      
      // Check actual interval vs expected
      if (lastRun && lastSuccess !== lastRun) {
        const actualInterval = minutesSinceSuccess;
        if (actualInterval > expectedInterval * 1.5) {
          issues.push({
            severity: 'medium',
            description: `Job running slower than expected (${Math.round(actualInterval)} min vs ${expectedInterval} min)`,
            rootCause: 'Job may be taking too long or being delayed',
            fix: 'Optimize job performance, check for bottlenecks'
          });
        }
      }
    } else {
      // Never succeeded
      status = 'failed';
      healthScore = 0;
      issues.push({
        severity: 'critical',
        description: 'Job has never succeeded',
        rootCause: heartbeat.last_error || 'Job failing from start',
        fix: 'Check initial configuration, verify dependencies, review error logs'
      });
    }
    
    // Job-specific checks
    if (name === 'posting') {
      const postingIssues = await this.analyzePostingJob(supabase);
      issues.push(...postingIssues);
      if (postingIssues.some(i => i.severity === 'critical')) {
        status = 'failed';
        healthScore = Math.min(healthScore, 30);
      }
    }
    
    if (name === 'plan') {
      const planIssues = await this.analyzePlanJob(supabase);
      issues.push(...planIssues);
      if (planIssues.some(i => i.severity === 'critical')) {
        status = 'failed';
        healthScore = Math.min(healthScore, 30);
      }
    }
    
    return {
      name,
      type,
      status,
      healthScore: Math.max(0, Math.min(100, healthScore)),
      lastRun: heartbeat?.updated_at || null,
      lastSuccess: heartbeat?.last_success || null,
      lastFailure: heartbeat?.last_failure || null,
      consecutiveFailures,
      errorMessage: heartbeat?.last_error || null,
      expectedInterval,
      dependencies: this.getDependencies(name),
      impact,
      issues
    };
  }

  /**
   * Analyze posting job specifically
   */
  private async analyzePostingJob(supabase: any): Promise<SystemComponent['issues']> {
    const issues: SystemComponent['issues'] = [];
    
    // Check posting attempts success rate
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: attempts } = await supabase
      .from('posting_attempts')
      .select('status, error_message')
      .gte('created_at', oneDayAgo);
    
    if (attempts && attempts.length > 0) {
      const successCount = attempts.filter((a: any) => a.status === 'success').length;
      const successRate = successCount / attempts.length;
      
      if (successRate < 0.7) {
        const failures = attempts.filter((a: any) => a.status === 'failed');
        const commonErrors = this.findCommonErrors(failures);
        
        issues.push({
          severity: 'critical',
          description: `Posting success rate is ${Math.round(successRate * 100)}% (${successCount}/${attempts.length} successful)`,
          rootCause: commonErrors.length > 0 ? commonErrors[0] : 'Multiple posting failures',
          fix: 'Review error patterns, check browser session, verify Twitter authentication, check rate limits'
        });
      } else if (successRate < 0.9) {
        issues.push({
          severity: 'high',
          description: `Posting success rate is ${Math.round(successRate * 100)}% - below target`,
          rootCause: 'Some posting attempts failing',
          fix: 'Monitor error patterns, improve error handling'
        });
      }
    }
    
    // Check queued content
    const { data: queued } = await supabase
      .from('content_metadata')
      .select('decision_id, created_at')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1);
    
    if (queued && queued.length > 0) {
      const oldestQueued = new Date(queued[0].created_at);
      const hoursQueued = (Date.now() - oldestQueued.getTime()) / (1000 * 60 * 60);
      
      if (hoursQueued > 2) {
        issues.push({
          severity: 'high',
          description: `Content has been queued for ${Math.round(hoursQueued)} hours without posting`,
          rootCause: 'Posting job may not be processing queue, or rate limits blocking',
          fix: 'Check posting job status, verify rate limits, check circuit breaker'
        });
      }
    }
    
    return issues;
  }

  /**
   * Analyze plan job specifically
   */
  private async analyzePlanJob(supabase: any): Promise<SystemComponent['issues']> {
    const issues: SystemComponent['issues'] = [];
    
    // Check if content is being generated
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentContent } = await supabase
      .from('content_metadata')
      .select('decision_id, created_at, generation_source')
      .gte('created_at', oneDayAgo)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (!recentContent || recentContent.length === 0) {
      issues.push({
        severity: 'critical',
        description: 'No content generated in last 24 hours',
        rootCause: 'Plan job may be failing or not generating content',
        fix: 'Check plan job errors, verify OpenAI API access, check budget limits'
      });
    } else {
      // Check generation source
      const syntheticCount = recentContent.filter((c: any) => c.generation_source === 'synthetic').length;
      if (syntheticCount === recentContent.length) {
        issues.push({
          severity: 'high',
          description: 'Only synthetic content being generated (no AI-generated content)',
          rootCause: 'AI generation may be blocked (budget, API key, circuit breaker)',
          fix: 'Check OpenAI API status, verify API key, check budget limits, check AI circuit breaker'
        });
      }
    }
    
    return issues;
  }

  /**
   * Find common errors in failure list
   */
  private findCommonErrors(failures: any[]): string[] {
    const errorCounts: Record<string, number> = {};
    
    failures.forEach((f: any) => {
      const error = f.error_message || 'Unknown error';
      const key = error.substring(0, 100); // First 100 chars
      errorCounts[key] = (errorCounts[key] || 0) + 1;
    });
    
    return Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([error]) => error);
  }

  /**
   * Get component dependencies
   */
  private getDependencies(componentName: string): string[] {
    const dependencyMap: Record<string, string[]> = {
      'posting': ['plan', 'browser_session', 'twitter_auth'],
      'plan': ['openai_api', 'database'],
      'analytics': ['browser_session', 'twitter_auth', 'database'],
      'metrics_scraper': ['browser_session', 'twitter_auth', 'database'],
      'learn': ['database', 'outcomes_data'],
      'reply_posting': ['account_discovery', 'posting', 'database']
    };
    
    return dependencyMap[componentName] || [];
  }

  /**
   * Analyze data flow through system
   */
  private async analyzeDataFlow(supabase: any): Promise<SystemAuditReport['dataFlowIssues']> {
    const issues: SystemAuditReport['dataFlowIssues'] = [];
    
    // Check content generation → queue flow
    const { data: queued } = await supabase
      .from('content_metadata')
      .select('decision_id, created_at, status')
      .eq('status', 'queued')
      .limit(1);
    
    const { data: posted } = await supabase
      .from('content_metadata')
      .select('decision_id, posted_at, status')
      .eq('status', 'posted')
      .order('posted_at', { ascending: false })
      .limit(1);
    
    if (!queued || queued.length === 0) {
      if (!posted || posted.length === 0) {
        issues.push({
          stage: 'Content Generation → Queue',
          issue: 'No content in queue and no recent posts',
          impact: 'System is not generating or posting content'
        });
      } else {
        const lastPost = new Date(posted[0].posted_at);
        const hoursSincePost = (Date.now() - lastPost.getTime()) / (1000 * 60 * 60);
        
        if (hoursSincePost > 2) {
          issues.push({
            stage: 'Content Generation → Queue',
            issue: `Queue empty and no posts in ${Math.round(hoursSincePost)} hours`,
            impact: 'Content generation may have stopped'
          });
        }
      }
    }
    
    // Check posting → metrics flow
    const { data: postsWithoutMetrics } = await supabase
      .from('content_metadata')
      .select('decision_id, posted_at, actual_impressions')
      .eq('status', 'posted')
      .not('tweet_id', 'is', null)
      .is('actual_impressions', null)
      .order('posted_at', { ascending: false })
      .limit(10);
    
    if (postsWithoutMetrics && postsWithoutMetrics.length > 5) {
      issues.push({
        stage: 'Posting → Metrics',
        issue: `${postsWithoutMetrics.length} posts missing metrics`,
        impact: 'Metrics scraper may not be working or posts are too new'
      });
    }
    
    return issues;
  }

  /**
   * Analyze configuration
   */
  private async analyzeConfiguration(config: any): Promise<SystemAuditReport['configurationIssues']> {
    const issues: SystemAuditReport['configurationIssues'] = [];
    
    // Check critical config values
    if (!process.env.OPENAI_API_KEY) {
      issues.push({
        setting: 'OPENAI_API_KEY',
        currentValue: 'missing',
        expectedValue: 'set',
        impact: 'Content generation will fail'
      });
    }
    
    if (process.env.POSTING_DISABLED === 'true') {
      issues.push({
        setting: 'POSTING_DISABLED',
        currentValue: 'true',
        expectedValue: 'false',
        impact: 'Posting is disabled'
      });
    }
    
    if (process.env.AI_QUOTA_CIRCUIT_OPEN === 'true') {
      issues.push({
        setting: 'AI_QUOTA_CIRCUIT_OPEN',
        currentValue: 'true',
        expectedValue: 'false',
        impact: 'AI calls are blocked'
      });
    }
    
    return issues;
  }

  /**
   * Identify critical issues
   */
  private identifyCriticalIssues(
    components: SystemComponent[],
    dataFlowIssues: SystemAuditReport['dataFlowIssues'],
    configIssues: SystemAuditReport['configurationIssues']
  ): SystemAuditReport['criticalIssues'] {
    const critical: SystemAuditReport['criticalIssues'] = [];
    
    // Component issues
    components.forEach(component => {
      component.issues.forEach(issue => {
        if (issue.severity === 'critical') {
          critical.push({
            component: component.name,
            issue: issue.description,
            rootCause: issue.rootCause || 'Unknown',
            fix: issue.fix || 'Investigate and fix',
            priority: component.impact === 'critical' ? 1 : component.impact === 'high' ? 2 : 3
          });
        }
      });
    });
    
    // Data flow issues
    dataFlowIssues.forEach(flowIssue => {
      critical.push({
        component: flowIssue.stage,
        issue: flowIssue.issue,
        rootCause: 'Data flow interruption',
        fix: 'Check upstream component and restore flow',
        priority: 2
      });
    });
    
    // Config issues
    configIssues.forEach(configIssue => {
      critical.push({
        component: 'Configuration',
        issue: `${configIssue.setting} is ${configIssue.currentValue}`,
        rootCause: 'Configuration mismatch',
        fix: `Set ${configIssue.setting} to ${configIssue.expectedValue}`,
        priority: 1
      });
    });
    
    // Sort by priority
    return critical.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    components: SystemComponent[],
    criticalIssues: SystemAuditReport['criticalIssues']
  ): SystemAuditReport['recommendations'] {
    const recommendations: SystemAuditReport['recommendations'] = [];
    
    // Immediate fixes for critical issues
    criticalIssues.slice(0, 5).forEach((issue, index) => {
      recommendations.push({
        priority: index + 1,
        action: `Fix: ${issue.component} - ${issue.issue}`,
        expectedImpact: 'Restore component functionality',
        effort: 'medium'
      });
    });
    
    // Component health improvements
    components.filter(c => c.healthScore < 70).forEach(component => {
      recommendations.push({
        priority: component.impact === 'critical' ? 1 : 2,
        action: `Improve ${component.name} health (currently ${component.healthScore}%)`,
        expectedImpact: `Increase ${component.name} reliability`,
        effort: 'medium'
      });
    });
    
    return recommendations;
  }

  /**
   * Determine overall health
   */
  private determineOverallHealth(
    components: SystemComponent[],
    criticalIssues: SystemAuditReport['criticalIssues']
  ): 'healthy' | 'degraded' | 'critical' {
    const criticalComponents = components.filter(c => c.impact === 'critical');
    const failedCritical = criticalComponents.filter(c => c.status === 'failed');
    const degradedCritical = criticalComponents.filter(c => c.status === 'degraded');
    
    if (failedCritical.length > 0 || criticalIssues.length > 3) {
      return 'critical';
    }
    
    if (degradedCritical.length > 0 || criticalIssues.length > 0) {
      return 'degraded';
    }
    
    return 'healthy';
  }
}

