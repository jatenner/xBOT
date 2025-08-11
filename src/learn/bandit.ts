/**
 * 🎯 THOMPSON SAMPLING BANDIT ALGORITHM
 * 
 * PURPOSE: Multi-armed bandit for content optimization
 * STRATEGY: Thompson sampling over topic, hour, and tag dimensions
 */

import { redisManager } from '../lib/redisManager';

export interface BanditArm {
  id: string;
  alpha: number; // Success count + 1 (prior)
  beta: number;  // Failure count + 1 (prior)
  samples: number; // Total samples
  lastUpdated: Date;
}

export interface BanditSample {
  armId: string;
  sample: number; // Beta distribution sample
  confidence: number; // Sample confidence
}

export interface BanditUpdate {
  armId: string;
  reward: number; // 0 or 1
  context?: Record<string, any>;
}

/**
 * Thompson Sampling Multi-Armed Bandit
 */
export class ThompsonSampling {
  private redisPrefix: string;
  private banditPrefix: string;

  constructor() {
    this.redisPrefix = process.env.REDIS_PREFIX || 'app:';
    this.banditPrefix = `${this.redisPrefix}bandit`;
  }

  /**
   * Generate Redis key for bandit arm
   */
  private getArmKey(armId: string): string {
    return `${this.banditPrefix}:${armId}`;
  }

  /**
   * Initialize bandit arm with prior
   */
  async initializeArm(armId: string, alpha: number = 1, beta: number = 1): Promise<BanditArm> {
    const arm: BanditArm = {
      id: armId,
      alpha,
      beta,
      samples: 0,
      lastUpdated: new Date()
    };

    try {
      const key = this.getArmKey(armId);
      await redisManager.set(key, JSON.stringify(arm));
      console.log(`🎯 Initialized bandit arm: ${armId} (α=${alpha}, β=${beta})`);
      return arm;
    } catch (error: any) {
      console.error(`Failed to initialize bandit arm ${armId}:`, error.message);
      return arm;
    }
  }

  /**
   * Get bandit arm state
   */
  async getArm(armId: string): Promise<BanditArm | null> {
    try {
      const key = this.getArmKey(armId);
      const data = await redisManager.get(key);
      
      if (!data) {
        return null;
      }

      return JSON.parse(data);
    } catch (error: any) {
      console.error(`Failed to get bandit arm ${armId}:`, error.message);
      return null;
    }
  }

  /**
   * Get or initialize bandit arm
   */
  async getOrInitializeArm(armId: string): Promise<BanditArm> {
    let arm = await this.getArm(armId);
    
    if (!arm) {
      arm = await this.initializeArm(armId);
    }

    return arm;
  }

  /**
   * Sample from Beta distribution (Thompson Sampling)
   */
  private sampleBeta(alpha: number, beta: number): number {
    // Simple beta distribution sampling using two gamma distributions
    // For production, consider using a proper statistical library
    
    if (alpha <= 0 || beta <= 0) {
      return 0.5; // Default if invalid parameters
    }

    // Approximate beta sampling using uniform random
    // This is a simplified implementation - in production use proper beta sampling
    const samples = 1000;
    let sum = 0;
    
    for (let i = 0; i < samples; i++) {
      const u1 = Math.random();
      const u2 = Math.random();
      
      // Simple beta approximation
      const x = Math.pow(u1, 1/alpha) * Math.pow(u2, 1/beta);
      sum += x;
    }
    
    return Math.min(Math.max(sum / samples, 0.001), 0.999);
  }

  /**
   * Sample from bandit arm
   */
  async sample(armId: string): Promise<BanditSample> {
    const arm = await this.getOrInitializeArm(armId);
    const sample = this.sampleBeta(arm.alpha, arm.beta);
    
    // Calculate confidence based on total samples
    const confidence = Math.min(arm.samples / 100, 1.0);

    return {
      armId,
      sample,
      confidence
    };
  }

  /**
   * Update bandit arm with reward
   */
  async update(armId: string, reward: number, context?: Record<string, any>): Promise<BanditArm> {
    const arm = await this.getOrInitializeArm(armId);
    
    // Update alpha (successes) and beta (failures)
    if (reward > 0) {
      arm.alpha += reward;
    } else {
      arm.beta += 1;
    }
    
    arm.samples += 1;
    arm.lastUpdated = new Date();

    try {
      const key = this.getArmKey(armId);
      await redisManager.set(key, JSON.stringify(arm));
      
      console.log(`🎯 Updated bandit arm: ${armId} (α=${arm.alpha}, β=${arm.beta}, samples=${arm.samples})`);
      
      // Log context if provided
      if (context) {
        console.log(`   Context: ${JSON.stringify(context)}`);
      }

      return arm;
    } catch (error: any) {
      console.error(`Failed to update bandit arm ${armId}:`, error.message);
      return arm;
    }
  }

  /**
   * Sample from multiple arms and return best
   */
  async sampleBest(armIds: string[]): Promise<{ armId: string; sample: BanditSample; allSamples: BanditSample[] }> {
    const samples: BanditSample[] = [];
    
    for (const armId of armIds) {
      const sample = await this.sample(armId);
      samples.push(sample);
    }

    // Find best sample
    const bestSample = samples.reduce((best, current) => 
      current.sample > best.sample ? current : best
    );

    return {
      armId: bestSample.armId,
      sample: bestSample,
      allSamples: samples
    };
  }

  /**
   * Get performance statistics for arms
   */
  async getArmStats(armIds: string[]): Promise<Record<string, { 
    successRate: number; 
    confidence: number; 
    samples: number;
    arm: BanditArm 
  }>> {
    const stats: Record<string, any> = {};

    for (const armId of armIds) {
      const arm = await this.getOrInitializeArm(armId);
      const successRate = arm.alpha / (arm.alpha + arm.beta);
      const confidence = Math.min(arm.samples / 50, 1.0); // Confidence builds with samples

      stats[armId] = {
        successRate,
        confidence,
        samples: arm.samples,
        arm
      };
    }

    return stats;
  }

  /**
   * Reset bandit arm to initial state
   */
  async resetArm(armId: string, alpha: number = 1, beta: number = 1): Promise<void> {
    try {
      const key = this.getArmKey(armId);
      await redisManager.del(key);
      await this.initializeArm(armId, alpha, beta);
      console.log(`🔄 Reset bandit arm: ${armId}`);
    } catch (error: any) {
      console.error(`Failed to reset bandit arm ${armId}:`, error.message);
    }
  }

  /**
   * List all bandit arms
   */
  async listArms(): Promise<string[]> {
    try {
      const pattern = `${this.banditPrefix}:*`;
      const keys = await redisManager.keys(pattern);
      return keys.map(key => key.replace(`${this.banditPrefix}:`, ''));
    } catch (error: any) {
      console.error('Failed to list bandit arms:', error.message);
      return [];
    }
  }

  /**
   * Get system health and performance
   */
  async getSystemHealth(): Promise<{
    totalArms: number;
    activeArms: number;
    totalSamples: number;
    avgSuccessRate: number;
    topPerformers: Array<{ armId: string; successRate: number; samples: number }>;
  }> {
    try {
      const armIds = await this.listArms();
      const stats = await this.getArmStats(armIds);
      
      let totalSamples = 0;
      let totalSuccessRate = 0;
      let activeArms = 0;

      const performers: Array<{ armId: string; successRate: number; samples: number }> = [];

      for (const [armId, stat] of Object.entries(stats)) {
        totalSamples += stat.samples;
        totalSuccessRate += stat.successRate;
        
        if (stat.samples > 0) {
          activeArms++;
        }

        performers.push({
          armId,
          successRate: stat.successRate,
          samples: stat.samples
        });
      }

      // Sort by success rate
      performers.sort((a, b) => b.successRate - a.successRate);

      return {
        totalArms: armIds.length,
        activeArms,
        totalSamples,
        avgSuccessRate: armIds.length > 0 ? totalSuccessRate / armIds.length : 0,
        topPerformers: performers.slice(0, 10)
      };
    } catch (error: any) {
      console.error('Failed to get bandit system health:', error.message);
      return {
        totalArms: 0,
        activeArms: 0,
        totalSamples: 0,
        avgSuccessRate: 0,
        topPerformers: []
      };
    }
  }
}

/**
 * Gaming-specific bandit manager
 */
export class GamingBanditManager {
  private bandit: ThompsonSampling;

  constructor() {
    this.bandit = new ThompsonSampling();
  }

  /**
   * Get topic arm ID
   */
  private getTopicArmId(topic: string): string {
    return `topic:${topic.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  }

  /**
   * Get hour arm ID
   */
  private getHourArmId(hour: number): string {
    return `hour:${hour.toString().padStart(2, '0')}`;
  }

  /**
   * Get tag arm ID
   */
  private getTagArmId(tag: string): string {
    return `tag:${tag.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  }

  /**
   * Sample best topic
   */
  async sampleBestTopic(topics: string[]): Promise<{ topic: string; sample: BanditSample }> {
    const armIds = topics.map(topic => this.getTopicArmId(topic));
    const result = await this.bandit.sampleBest(armIds);
    
    const topic = topics[armIds.indexOf(result.armId)];
    return { topic, sample: result.sample };
  }

  /**
   * Sample best hour
   */
  async sampleBestHour(): Promise<{ hour: number; sample: BanditSample }> {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const armIds = hours.map(hour => this.getHourArmId(hour));
    const result = await this.bandit.sampleBest(armIds);
    
    const hour = parseInt(result.armId.split(':')[1]);
    return { hour, sample: result.sample };
  }

  /**
   * Sample best tag
   */
  async sampleBestTag(tags: string[]): Promise<{ tag: string; sample: BanditSample }> {
    const armIds = tags.map(tag => this.getTagArmId(tag));
    const result = await this.bandit.sampleBest(armIds);
    
    const tag = tags[armIds.indexOf(result.armId)];
    return { tag, sample: result.sample };
  }

  /**
   * Update topic performance
   */
  async updateTopic(topic: string, reward: number, context?: Record<string, any>): Promise<void> {
    const armId = this.getTopicArmId(topic);
    await this.bandit.update(armId, reward, context);
  }

  /**
   * Update hour performance
   */
  async updateHour(hour: number, reward: number, context?: Record<string, any>): Promise<void> {
    const armId = this.getHourArmId(hour);
    await this.bandit.update(armId, reward, context);
  }

  /**
   * Update tag performance
   */
  async updateTag(tag: string, reward: number, context?: Record<string, any>): Promise<void> {
    const armId = this.getTagArmId(tag);
    await this.bandit.update(armId, reward, context);
  }

  /**
   * Get comprehensive performance stats
   */
  async getPerformanceReport(): Promise<{
    system: any;
    topTopics: Array<{ topic: string; successRate: number; samples: number }>;
    topHours: Array<{ hour: number; successRate: number; samples: number }>;
    topTags: Array<{ tag: string; successRate: number; samples: number }>;
  }> {
    const systemHealth = await this.bandit.getSystemHealth();
    
    // Get top performing topics
    const allArms = await this.bandit.listArms();
    const topicArms = allArms.filter(arm => arm.startsWith('topic:'));
    const hourArms = allArms.filter(arm => arm.startsWith('hour:'));
    const tagArms = allArms.filter(arm => arm.startsWith('tag:'));

    const topicStats = await this.bandit.getArmStats(topicArms);
    const hourStats = await this.bandit.getArmStats(hourArms);
    const tagStats = await this.bandit.getArmStats(tagArms);

    const topTopics = Object.entries(topicStats)
      .map(([armId, stats]) => ({
        topic: armId.replace('topic:', '').replace(/_/g, ' '),
        successRate: stats.successRate,
        samples: stats.samples
      }))
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 10);

    const topHours = Object.entries(hourStats)
      .map(([armId, stats]) => ({
        hour: parseInt(armId.replace('hour:', '')),
        successRate: stats.successRate,
        samples: stats.samples
      }))
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 24);

    const topTags = Object.entries(tagStats)
      .map(([armId, stats]) => ({
        tag: armId.replace('tag:', '').replace(/_/g, ''),
        successRate: stats.successRate,
        samples: stats.samples
      }))
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 10);

    return {
      system: systemHealth,
      topTopics,
      topHours,
      topTags
    };
  }
}