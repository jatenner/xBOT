// src/analytics/contentLearning.ts - Thompson Sampling Bandit for Content Optimization
import { safeLog } from '../utils/redact';
import { getConfig } from '../config/safeConfig';

export interface ContentEvent {
  event: 'generated' | 'posted' | 'replied' | 'skipped' | 'failed';
  post_id: string;
  kind: 'single' | 'thread' | 'reply';
  meta: {
    topic: string;
    format: string;
    model_used: string;
    cost_usd: number;
    confidence: number;
    time_slot: string;
    bandit_arm: string;
    exploration: boolean;
    quality_gates: {
      regret_check_passed: boolean;
      fact_check_score: number;
      helpfulness_score: number;
    };
  };
}

export interface LearningMetrics {
  post_id: string;
  likes: number;
  reposts: number;
  comments: number;
  bookmarks: number;
  impressions: number;
  engagement_rate: number;
  reach_efficiency: number;
}

export interface BanditArm {
  arm_key: string;
  successes: number;
  attempts: number;
  alpha: number;  // Beta distribution parameter
  beta: number;   // Beta distribution parameter
  last_updated: Date;
  meta: {
    topic: string;
    format: string;
    time_slot: string;
  };
}

export class ContentLearningSystem {
  private static instance: ContentLearningSystem;
  private db: any; // Database client
  
  private constructor() {
    // Initialize with database connection
    this.initializeDatabase();
  }
  
  static getInstance(): ContentLearningSystem {
    if (!ContentLearningSystem.instance) {
      ContentLearningSystem.instance = new ContentLearningSystem();
    }
    return ContentLearningSystem.instance;
  }
  
  private async initializeDatabase() {
    try {
      const { createSSLClient } = await import('../db/sslClient');
      const config = getConfig();
      this.db = await createSSLClient(config.DATABASE_URL);
      safeLog.info('📊 CONTENT_LEARNING: Database initialized');
    } catch (error) {
      safeLog.error(`❌ CONTENT_LEARNING: Database init failed - ${error}`);
    }
  }
  
  /**
   * Log content generation/posting event
   */
  async logContentEvent(event: ContentEvent): Promise<void> {
    try {
      const query = `
        INSERT INTO content_events (event, post_id, kind, meta)
        VALUES ($1, $2, $3, $4)
      `;
      
      await this.db.client.query(query, [
        event.event,
        event.post_id,
        event.kind,
        JSON.stringify(event.meta)
      ]);
      
      // Also log API cost
      await this.logApiUsage(event.meta.model_used, event.meta.cost_usd, 'content_generation', {
        event: event.event,
        topic: event.meta.topic,
        format: event.meta.format
      });
      
      safeLog.info(`📝 CONTENT_EVENT: ${event.event} logged for ${event.kind} (${event.meta.topic})`);
      
    } catch (error) {
      safeLog.error(`❌ CONTENT_EVENT_LOG_FAILED: ${error}`);
    }
  }
  
  /**
   * Log API usage with cost tracking
   */
  async logApiUsage(model: string, costUsd: number, tag: string, payload: any): Promise<void> {
    try {
      const query = `
        INSERT INTO api_usage (model, cost_usd, tag, payload)
        VALUES ($1, $2, $3, $4)
      `;
      
      await this.db.client.query(query, [
        model,
        costUsd,
        tag,
        JSON.stringify(payload)
      ]);
      
      // Update daily budget tracking
      await this.updateDailyBudget(costUsd);
      
    } catch (error) {
      safeLog.error(`❌ API_USAGE_LOG_FAILED: ${error}`);
    }
  }
  
  /**
   * Update daily budget tracking
   */
  async updateDailyBudget(costUsd: number): Promise<void> {
    try {
      const query = `
        INSERT INTO budget_tracking (date, spent_usd)
        VALUES (CURRENT_DATE, $1)
        ON CONFLICT (date) 
        DO UPDATE SET 
          spent_usd = budget_tracking.spent_usd + $1,
          updated_at = NOW()
      `;
      
      await this.db.client.query(query, [costUsd]);
      
    } catch (error) {
      safeLog.error(`❌ BUDGET_UPDATE_FAILED: ${error}`);
    }
  }
  
  /**
   * Check daily budget remaining
   */
  async getDailyBudgetRemaining(): Promise<number> {
    try {
      const query = `
        SELECT 
          COALESCE(limit_usd - spent_usd, 5.0) as remaining
        FROM budget_tracking 
        WHERE date = CURRENT_DATE
      `;
      
      const result = await this.db.client.query(query);
      const remaining = result.rows[0]?.remaining || 5.0;
      
      return Math.max(0, remaining);
      
    } catch (error) {
      safeLog.error(`❌ BUDGET_CHECK_FAILED: ${error}`);
      return 5.0; // Default budget
    }
  }
  
  /**
   * Log post performance metrics
   */
  async logLearningMetrics(metrics: LearningMetrics): Promise<void> {
    try {
      const engagementRate = metrics.impressions > 0 
        ? (metrics.likes + metrics.reposts + metrics.comments) / metrics.impressions 
        : 0;
      
      const reachEfficiency = metrics.impressions > 0 
        ? (metrics.likes + metrics.reposts * 2 + metrics.comments * 1.5) / metrics.impressions 
        : 0;
      
      const query = `
        INSERT INTO learn_metrics (
          post_id, likes, reposts, comments, bookmarks, impressions, 
          ctr, engagement_rate, reach_efficiency
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (post_id) DO UPDATE SET
          likes = $2, reposts = $3, comments = $4, bookmarks = $5, 
          impressions = $6, ctr = $7, engagement_rate = $8, 
          reach_efficiency = $9, ts = NOW()
      `;
      
      await this.db.client.query(query, [
        metrics.post_id,
        metrics.likes,
        metrics.reposts,
        metrics.comments,
        metrics.bookmarks,
        metrics.impressions,
        metrics.engagement_rate,
        engagementRate,
        reachEfficiency
      ]);
      
      // Update bandit arms based on performance
      await this.updateBanditArmsFromMetrics(metrics.post_id, engagementRate);
      
      safeLog.info(`📊 METRICS_LOGGED: ${metrics.post_id} (engagement: ${engagementRate.toFixed(3)})`);
      
    } catch (error) {
      safeLog.error(`❌ METRICS_LOG_FAILED: ${error}`);
    }
  }
  
  /**
   * Update bandit arms based on performance
   */
  async updateBanditArmsFromMetrics(postId: string, engagementRate: number): Promise<void> {
    try {
      // Get the bandit arm for this post
      const contentQuery = `
        SELECT meta->>'bandit_arm' as arm_key
        FROM content_events 
        WHERE post_id = $1 AND event = 'posted'
        LIMIT 1
      `;
      
      const contentResult = await this.db.client.query(contentQuery, [postId]);
      const armKey = contentResult.rows[0]?.arm_key;
      
      if (!armKey) {
        safeLog.warn(`⚠️ BANDIT_UPDATE: No arm key found for post ${postId}`);
        return;
      }
      
      // Define success threshold (adjust based on your metrics)
      const successThreshold = 0.02; // 2% engagement rate
      const isSuccess = engagementRate >= successThreshold;
      
      // Update bandit arm
      const updateQuery = `
        SELECT update_bandit_arm($1, $2, NULL)
      `;
      
      await this.db.client.query(updateQuery, [armKey, isSuccess]);
      
      safeLog.info(`🎯 BANDIT_UPDATE: ${armKey} success=${isSuccess} (rate: ${engagementRate.toFixed(3)})`);
      
    } catch (error) {
      safeLog.error(`❌ BANDIT_UPDATE_FAILED: ${error}`);
    }
  }
  
  /**
   * Thompson Sampling arm selection
   */
  async selectBanditArm(availableArms: string[]): Promise<string> {
    try {
      if (availableArms.length === 0) {
        throw new Error('No available arms provided');
      }
      
      if (availableArms.length === 1) {
        return availableArms[0];
      }
      
      // Get current arm statistics
      const query = `
        SELECT arm_key, alpha, beta, successes, attempts
        FROM bandit_arms 
        WHERE arm_key = ANY($1)
      `;
      
      const result = await this.db.client.query(query, [availableArms]);
      const armStats = new Map(result.rows.map(row => [row.arm_key, row]));
      
      // Thompson Sampling: sample from Beta distribution for each arm
      let bestArm = availableArms[0];
      let bestSample = 0;
      
      for (const armKey of availableArms) {
        const stats = armStats.get(armKey);
        let alpha = 1, beta = 1; // Default priors
        
        if (stats) {
          alpha = parseFloat(stats.alpha);
          beta = parseFloat(stats.beta);
        }
        
        // Sample from Beta(alpha, beta) distribution
        // Using simple approximation: if we had proper Beta sampling
        const sample = this.sampleBeta(alpha, beta);
        
        if (sample > bestSample) {
          bestSample = sample;
          bestArm = armKey;
        }
      }
      
      // Log decision
      await this.logDecision('bandit_arm_selection', `Selected ${bestArm}`, bestSample, {
        available_arms: availableArms,
        selected_arm: bestArm,
        sample_value: bestSample
      });
      
      return bestArm;
      
    } catch (error) {
      safeLog.error(`❌ BANDIT_SELECTION_FAILED: ${error}`);
      // Fallback to random selection
      return availableArms[Math.floor(Math.random() * availableArms.length)];
    }
  }
  
  /**
   * Simple Beta distribution sampling (approximation)
   */
  private sampleBeta(alpha: number, beta: number): number {
    // Simple approximation using two gamma samples
    // In production, use a proper statistical library
    const gammaA = this.sampleGamma(alpha);
    const gammaB = this.sampleGamma(beta);
    return gammaA / (gammaA + gammaB);
  }
  
  /**
   * Simple Gamma distribution sampling (approximation)
   */
  private sampleGamma(shape: number): number {
    // Very simple approximation for small shape parameters
    // In production, use a proper statistical library
    if (shape < 1) {
      return Math.pow(Math.random(), 1 / shape);
    }
    
    // For shape >= 1, use a simple method
    let sum = 0;
    for (let i = 0; i < Math.floor(shape); i++) {
      sum += -Math.log(Math.random());
    }
    
    const fractional = shape - Math.floor(shape);
    if (fractional > 0) {
      sum += Math.pow(Math.random(), 1 / fractional);
    }
    
    return sum;
  }
  
  /**
   * Log AI decision for analysis
   */
  async logDecision(action: string, reason: string, score: number, params: any): Promise<void> {
    try {
      const query = `
        INSERT INTO decision_log (action, reason, score, params)
        VALUES ($1, $2, $3, $4)
      `;
      
      await this.db.client.query(query, [
        action,
        reason,
        score,
        JSON.stringify(params)
      ]);
      
    } catch (error) {
      safeLog.error(`❌ DECISION_LOG_FAILED: ${error}`);
    }
  }
  
  /**
   * Get top performing content for learning
   */
  async getTopPerformingContent(days: number = 7, limit: number = 20): Promise<any[]> {
    try {
      const query = `
        SELECT 
          ce.post_id,
          ce.meta->>'topic' as topic,
          ce.kind,
          lm.engagement_rate,
          lm.likes + lm.reposts + lm.comments as total_engagement,
          lm.impressions,
          ce.ts as posted_at
        FROM content_events ce
        JOIN learn_metrics lm ON ce.post_id = lm.post_id
        WHERE ce.event = 'posted' 
          AND lm.engagement_rate IS NOT NULL
          AND ce.ts >= NOW() - INTERVAL '${days} days'
        ORDER BY lm.engagement_rate DESC
        LIMIT $1
      `;
      
      const result = await this.db.client.query(query, [limit]);
      return result.rows;
      
    } catch (error) {
      safeLog.error(`❌ TOP_CONTENT_QUERY_FAILED: ${error}`);
      return [];
    }
  }
  
  /**
   * Generate content strategy recommendations
   */
  async generateContentStrategy(): Promise<any> {
    try {
      const topContent = await this.getTopPerformingContent(7, 10);
      
      // Analyze patterns
      const topicPerformance = new Map();
      const formatPerformance = new Map();
      
      for (const content of topContent) {
        const topic = content.topic;
        const format = content.kind;
        const engagement = parseFloat(content.engagement_rate);
        
        if (!topicPerformance.has(topic)) {
          topicPerformance.set(topic, []);
        }
        topicPerformance.get(topic).push(engagement);
        
        if (!formatPerformance.has(format)) {
          formatPerformance.set(format, []);
        }
        formatPerformance.get(format).push(engagement);
      }
      
      // Calculate averages
      const topicAvgs = new Map();
      for (const [topic, engagements] of topicPerformance) {
        const avg = engagements.reduce((a, b) => a + b, 0) / engagements.length;
        topicAvgs.set(topic, avg);
      }
      
      const formatAvgs = new Map();
      for (const [format, engagements] of formatPerformance) {
        const avg = engagements.reduce((a, b) => a + b, 0) / engagements.length;
        formatAvgs.set(format, avg);
      }
      
      return {
        top_topics: Array.from(topicAvgs.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5),
        top_formats: Array.from(formatAvgs.entries())
          .sort((a, b) => b[1] - a[1]),
        total_posts_analyzed: topContent.length,
        analysis_period_days: 7
      };
      
    } catch (error) {
      safeLog.error(`❌ STRATEGY_GENERATION_FAILED: ${error}`);
      return null;
    }
  }
}

// Export singleton instance
export const contentLearning = ContentLearningSystem.getInstance();
