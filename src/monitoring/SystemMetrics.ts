/**
 * System Metrics Collection & Telemetry
 * Tracks post success rate, quality scores, lock events, and performance data
 */

interface MetricEvent {
  timestamp: number;
  type: string;
  value: number;
  tags?: Record<string, string>;
}

interface SystemStats {
  posts: {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
    lastPostTime?: number;
    averageQualityScore: number;
    formatBreakdown: Record<string, number>;
  };
  locks: {
    acquisitions: number;
    contentions: number;
    staleDetections: number;
    averageHoldTime: number;
  };
  browser: {
    launches: number;
    crashes: number;
    contextRecreations: number;
    averageSessionTime: number;
  };
  quality: {
    passedFirstTime: number;
    requiredRevision: number;
    averageScore: number;
    scoreDistribution: Record<string, number>;
  };
  errors: {
    playwright: number;
    database: number;
    content: number;
    network: number;
  };
}

export class SystemMetrics {
  private metrics: MetricEvent[] = [];
  private maxRetention = 10000; // Keep last 10k events
  private stats: SystemStats;

  constructor() {
    this.stats = this.initializeStats();
  }

  private initializeStats(): SystemStats {
    return {
      posts: {
        total: 0,
        successful: 0,
        failed: 0,
        successRate: 0,
        averageQualityScore: 0,
        formatBreakdown: {}
      },
      locks: {
        acquisitions: 0,
        contentions: 0,
        staleDetections: 0,
        averageHoldTime: 0
      },
      browser: {
        launches: 0,
        crashes: 0,
        contextRecreations: 0,
        averageSessionTime: 0
      },
      quality: {
        passedFirstTime: 0,
        requiredRevision: 0,
        averageScore: 0,
        scoreDistribution: {}
      },
      errors: {
        playwright: 0,
        database: 0,
        content: 0,
        network: 0
      }
    };
  }

  /**
   * Record a metric event
   */
  record(type: string, value: number, tags?: Record<string, string>) {
    const event: MetricEvent = {
      timestamp: Date.now(),
      type,
      value,
      tags
    };

    this.metrics.push(event);
    
    // Trim old metrics
    if (this.metrics.length > this.maxRetention) {
      this.metrics = this.metrics.slice(-this.maxRetention);
    }

    // Update running stats
    this.updateStats(event);
  }

  /**
   * Update running statistics
   */
  private updateStats(event: MetricEvent) {
    switch (event.type) {
      case 'post.success':
        this.stats.posts.successful++;
        this.stats.posts.total++;
        this.stats.posts.lastPostTime = event.timestamp;
        if (event.tags?.format) {
          this.stats.posts.formatBreakdown[event.tags.format] = 
            (this.stats.posts.formatBreakdown[event.tags.format] || 0) + 1;
        }
        break;
      
      case 'post.failure':
        this.stats.posts.failed++;
        this.stats.posts.total++;
        break;
      
      case 'quality.score':
        this.updateQualityStats(event.value, event.tags?.revised === 'true');
        break;
      
      case 'lock.acquired':
        this.stats.locks.acquisitions++;
        break;
      
      case 'lock.contention':
        this.stats.locks.contentions++;
        break;
      
      case 'lock.stale':
        this.stats.locks.staleDetections++;
        break;
      
      case 'browser.launch':
        this.stats.browser.launches++;
        break;
      
      case 'browser.crash':
        this.stats.browser.crashes++;
        break;
      
      case 'browser.context.recreate':
        this.stats.browser.contextRecreations++;
        break;
      
      case 'error.playwright':
        this.stats.errors.playwright++;
        break;
      
      case 'error.database':
        this.stats.errors.database++;
        break;
      
      case 'error.content':
        this.stats.errors.content++;
        break;
      
      case 'error.network':
        this.stats.errors.network++;
        break;
    }

    // Recalculate derived metrics
    this.calculateDerivedMetrics();
  }

  private updateQualityStats(score: number, wasRevised: boolean) {
    const bucket = this.getScoreBucket(score);
    this.stats.quality.scoreDistribution[bucket] = 
      (this.stats.quality.scoreDistribution[bucket] || 0) + 1;

    if (wasRevised) {
      this.stats.quality.requiredRevision++;
    } else {
      this.stats.quality.passedFirstTime++;
    }

    // Update average
    const totalQualityEvents = this.stats.quality.passedFirstTime + this.stats.quality.requiredRevision;
    this.stats.quality.averageScore = 
      ((this.stats.quality.averageScore * (totalQualityEvents - 1)) + score) / totalQualityEvents;
  }

  private getScoreBucket(score: number): string {
    if (score >= 90) return '90-100';
    if (score >= 80) return '80-89';
    if (score >= 70) return '70-79';
    if (score >= 60) return '60-69';
    return '0-59';
  }

  private calculateDerivedMetrics() {
    // Success rate
    if (this.stats.posts.total > 0) {
      this.stats.posts.successRate = this.stats.posts.successful / this.stats.posts.total;
    }

    // Average quality score for posts
    const qualityEvents = this.metrics.filter(m => m.type === 'quality.score');
    if (qualityEvents.length > 0) {
      this.stats.posts.averageQualityScore = 
        qualityEvents.reduce((sum, e) => sum + e.value, 0) / qualityEvents.length;
    }

    // Average lock hold time
    const lockHoldEvents = this.metrics.filter(m => m.type === 'lock.hold_time');
    if (lockHoldEvents.length > 0) {
      this.stats.locks.averageHoldTime = 
        lockHoldEvents.reduce((sum, e) => sum + e.value, 0) / lockHoldEvents.length;
    }
  }

  /**
   * Get current system statistics
   */
  getStats(): SystemStats {
    return { ...this.stats };
  }

  /**
   * Get recent metrics (last N events)
   */
  getRecentMetrics(count: number = 100): MetricEvent[] {
    return this.metrics.slice(-count);
  }

  /**
   * Get metrics for a specific time window
   */
  getMetricsInWindow(startTime: number, endTime: number): MetricEvent[] {
    return this.metrics.filter(m => m.timestamp >= startTime && m.timestamp <= endTime);
  }

  /**
   * Get metrics by type
   */
  getMetricsByType(type: string, limit?: number): MetricEvent[] {
    const filtered = this.metrics.filter(m => m.type === type);
    return limit ? filtered.slice(-limit) : filtered;
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheus(): string {
    const lines: string[] = [];
    
    // Posts
    lines.push(`# HELP xbot_posts_total Total number of posts attempted`);
    lines.push(`# TYPE xbot_posts_total counter`);
    lines.push(`xbot_posts_total ${this.stats.posts.total}`);
    
    lines.push(`# HELP xbot_posts_successful Number of successful posts`);
    lines.push(`# TYPE xbot_posts_successful counter`);
    lines.push(`xbot_posts_successful ${this.stats.posts.successful}`);
    
    lines.push(`# HELP xbot_posts_success_rate Ratio of successful posts`);
    lines.push(`# TYPE xbot_posts_success_rate gauge`);
    lines.push(`xbot_posts_success_rate ${this.stats.posts.successRate}`);
    
    lines.push(`# HELP xbot_quality_average_score Average quality score of posts`);
    lines.push(`# TYPE xbot_quality_average_score gauge`);
    lines.push(`xbot_quality_average_score ${this.stats.posts.averageQualityScore}`);

    // Locks
    lines.push(`# HELP xbot_lock_acquisitions Total lock acquisitions`);
    lines.push(`# TYPE xbot_lock_acquisitions counter`);
    lines.push(`xbot_lock_acquisitions ${this.stats.locks.acquisitions}`);
    
    lines.push(`# HELP xbot_lock_contentions Lock contention events`);
    lines.push(`# TYPE xbot_lock_contentions counter`);
    lines.push(`xbot_lock_contentions ${this.stats.locks.contentions}`);

    // Browser
    lines.push(`# HELP xbot_browser_crashes Browser crash events`);
    lines.push(`# TYPE xbot_browser_crashes counter`);
    lines.push(`xbot_browser_crashes ${this.stats.browser.crashes}`);
    
    lines.push(`# HELP xbot_browser_context_recreations Context recreation events`);
    lines.push(`# TYPE xbot_browser_context_recreations counter`);
    lines.push(`xbot_browser_context_recreations ${this.stats.browser.contextRecreations}`);

    // Errors
    lines.push(`# HELP xbot_errors_total Total errors by type`);
    lines.push(`# TYPE xbot_errors_total counter`);
    Object.entries(this.stats.errors).forEach(([type, count]) => {
      lines.push(`xbot_errors_total{type="${type}"} ${count}`);
    });

    return lines.join('\n') + '\n';
  }

  /**
   * Clear old metrics beyond retention limit
   */
  cleanup() {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
  }

  /**
   * Get health status based on metrics
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check success rate
    if (this.stats.posts.successRate < 0.8 && this.stats.posts.total > 5) {
      issues.push(`Low post success rate: ${(this.stats.posts.successRate * 100).toFixed(1)}%`);
      recommendations.push('Check browser stability and network connectivity');
    }
    
    // Check browser crashes
    if (this.stats.browser.crashes > this.stats.browser.launches * 0.1) {
      issues.push('High browser crash rate');
      recommendations.push('Review Playwright configuration and system resources');
    }
    
    // Check lock contentions
    if (this.stats.locks.contentions > this.stats.locks.acquisitions * 0.1) {
      issues.push('High lock contention rate');
      recommendations.push('Review posting cadence and lock timeout settings');
    }
    
    // Check quality scores
    if (this.stats.posts.averageQualityScore < 75 && this.stats.posts.total > 5) {
      issues.push(`Low average quality score: ${this.stats.posts.averageQualityScore.toFixed(1)}`);
      recommendations.push('Review content generation templates and quality gate thresholds');
    }

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (issues.length > 0) {
      status = issues.length > 2 ? 'unhealthy' : 'degraded';
    }

    return { status, issues, recommendations };
  }
}

// Singleton instance
export const systemMetrics = new SystemMetrics();
