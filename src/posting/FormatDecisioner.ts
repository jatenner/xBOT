/**
 * Format Policy Engine
 * Decides between single vs thread vs reply based on performance data,
 * diversity constraints, and cooldown periods
 */

interface FormatPerformance {
  format: 'single' | 'thread' | 'reply';
  attempts: number;
  successes: number;
  avgQualityScore: number;
  avgEngagement: number;
  lastUsed: number;
}

interface FormatPolicy {
  minInterval: number; // Minutes between same format
  maxConsecutive: number; // Max consecutive posts of same format
  diversityWeight: number; // 0-1, how much to prioritize variety
  performanceWeight: number; // 0-1, how much to prioritize performance
}

export interface FormatDecision {
  format: 'single' | 'thread' | 'reply';
  confidence: number; // 0-1
  reasoning: string;
  alternatives: Array<{ format: string; score: number; blocked?: string }>;
}

export class FormatDecisioner {
  private performance: Map<string, FormatPerformance> = new Map();
  private recentFormats: Array<{ format: string; timestamp: number }> = [];
  private maxHistorySize = 50;

  private policy: FormatPolicy = {
    minInterval: parseInt(process.env.FORMAT_MIN_INTERVAL_MINUTES || '120', 10), // 2 hours
    maxConsecutive: parseInt(process.env.FORMAT_MAX_CONSECUTIVE || '2', 10),
    diversityWeight: parseFloat(process.env.FORMAT_DIVERSITY_WEIGHT || '0.4'),
    performanceWeight: parseFloat(process.env.FORMAT_PERFORMANCE_WEIGHT || '0.6')
  };

  constructor() {
    // Initialize default performance data
    this.initializeDefaults();
  }

  private initializeDefaults() {
    const defaults: FormatPerformance[] = [
      {
        format: 'single',
        attempts: 10,
        successes: 8,
        avgQualityScore: 82,
        avgEngagement: 45,
        lastUsed: 0
      },
      {
        format: 'thread',
        attempts: 5,
        successes: 4,
        avgQualityScore: 85,
        avgEngagement: 120,
        lastUsed: 0
      },
      {
        format: 'reply',
        attempts: 15,
        successes: 12,
        avgQualityScore: 78,
        avgEngagement: 25,
        lastUsed: 0
      }
    ];

    defaults.forEach(perf => {
      this.performance.set(perf.format, perf);
    });
  }

  /**
   * Decide the best format for the next post
   */
  async decidePostFormat(options?: {
    topic?: string;
    urgency?: 'low' | 'normal' | 'high';
    targetEngagement?: 'viral' | 'educational' | 'conversational';
  }): Promise<FormatDecision> {
    const now = Date.now();
    const availableFormats = this.getAvailableFormats(now);
    const scores = this.calculateFormatScores(availableFormats, options);

    // Sort by score
    const sortedOptions = Object.entries(scores)
      .map(([format, score]) => ({ format, score }))
      .sort((a, b) => b.score - a.score);

    const bestOption = sortedOptions[0];
    const alternatives: Array<{ format: string; score: number; blocked?: string }> = 
      sortedOptions.slice(1).map(opt => ({ ...opt, blocked: undefined }));

    // Add blocked formats to alternatives
    const allFormats = ['single', 'thread', 'reply'] as const;
    allFormats.forEach(format => {
      if (!availableFormats.includes(format)) {
        const blockReason = this.getBlockReason(format, now);
        alternatives.push({ format, score: 0, blocked: blockReason });
      }
    });

    const decision: FormatDecision = {
      format: bestOption.format as 'single' | 'thread' | 'reply',
      confidence: this.calculateConfidence(bestOption.score, sortedOptions),
      reasoning: this.generateReasoning(bestOption, options),
      alternatives
    };

    // Record the decision
    this.recordDecision(decision.format, now);

    return decision;
  }

  /**
   * Get formats that are not currently blocked by cooldowns
   */
  private getAvailableFormats(now: number): string[] {
    const allFormats = ['single', 'thread', 'reply'];
    return allFormats.filter(format => this.isFormatAvailable(format, now));
  }

  /**
   * Check if a format is available (not blocked by cooldowns)
   */
  private isFormatAvailable(format: string, now: number): boolean {
    const perf = this.performance.get(format);
    if (!perf) return true;

    // Check minimum interval
    const timeSinceLastUse = now - perf.lastUsed;
    if (timeSinceLastUse < this.policy.minInterval * 60 * 1000) {
      return false;
    }

    // Check consecutive limit
    const recentConsecutive = this.getConsecutiveCount(format);
    if (recentConsecutive >= this.policy.maxConsecutive) {
      return false;
    }

    return true;
  }

  /**
   * Get reason why a format is blocked
   */
  private getBlockReason(format: string, now: number): string {
    const perf = this.performance.get(format);
    if (!perf) return 'No performance data';

    const timeSinceLastUse = now - perf.lastUsed;
    const minutesLeft = Math.ceil((this.policy.minInterval * 60 * 1000 - timeSinceLastUse) / (60 * 1000));
    
    if (timeSinceLastUse < this.policy.minInterval * 60 * 1000) {
      return `Cooldown: ${minutesLeft}m remaining`;
    }

    const consecutive = this.getConsecutiveCount(format);
    if (consecutive >= this.policy.maxConsecutive) {
      return `Too many consecutive (${consecutive}/${this.policy.maxConsecutive})`;
    }

    return 'Available';
  }

  /**
   * Count consecutive recent uses of a format
   */
  private getConsecutiveCount(format: string): number {
    let count = 0;
    for (let i = this.recentFormats.length - 1; i >= 0; i--) {
      if (this.recentFormats[i].format === format) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  /**
   * Calculate scores for available formats
   */
  private calculateFormatScores(
    availableFormats: string[], 
    options?: { 
      topic?: string; 
      urgency?: 'low' | 'normal' | 'high';
      targetEngagement?: 'viral' | 'educational' | 'conversational';
    }
  ): Record<string, number> {
    const scores: Record<string, number> = {};

    availableFormats.forEach(format => {
      const perf = this.performance.get(format);
      if (!perf) return;

      // Base performance score (0-100)
      const successRate = perf.successes / perf.attempts;
      const qualityScore = perf.avgQualityScore;
      const engagementScore = Math.min(100, perf.avgEngagement / 2); // Normalize engagement

      const performanceScore = (successRate * 40) + (qualityScore * 0.4) + (engagementScore * 0.2);

      // Diversity bonus (favor less recently used formats)
      const diversityScore = this.calculateDiversityScore(format);

      // Context modifiers based on options
      const contextScore = this.calculateContextScore(format, options);

      // Weighted final score
      const finalScore = 
        (performanceScore * this.policy.performanceWeight) +
        (diversityScore * this.policy.diversityWeight) +
        (contextScore * 0.2);

      scores[format] = finalScore;
    });

    return scores;
  }

  /**
   * Calculate diversity score (higher for less recently used)
   */
  private calculateDiversityScore(format: string): number {
    const recent = this.recentFormats.slice(-10); // Last 10 posts
    const formatCount = recent.filter(f => f.format === format).length;
    const maxCount = Math.max(1, recent.length / 3); // Expect roughly 1/3 of each format
    
    // Penalize overused formats
    if (formatCount > maxCount) {
      return Math.max(0, 100 - (formatCount - maxCount) * 30);
    }
    
    // Bonus for underused formats
    return 100 + (maxCount - formatCount) * 20;
  }

  /**
   * Calculate context-based score modifiers
   */
  private calculateContextScore(
    format: string, 
    options?: { 
      topic?: string; 
      urgency?: 'low' | 'normal' | 'high';
      targetEngagement?: 'viral' | 'educational' | 'conversational';
    }
  ): number {
    let score = 50; // Base score

    if (!options) return score;

    // Urgency modifiers
    if (options.urgency === 'high') {
      // Prefer singles for urgent content (faster to create/post)
      if (format === 'single') score += 20;
      if (format === 'thread') score -= 10;
    }

    // Target engagement modifiers
    if (options.targetEngagement === 'viral') {
      // Threads tend to get more engagement
      if (format === 'thread') score += 15;
      if (format === 'reply') score -= 20; // Replies rarely go viral
    } else if (options.targetEngagement === 'conversational') {
      // Replies are best for conversation
      if (format === 'reply') score += 25;
      if (format === 'thread') score += 5;
    } else if (options.targetEngagement === 'educational') {
      // Threads are best for educational content
      if (format === 'thread') score += 20;
      if (format === 'single') score += 5;
    }

    // Topic-based modifiers
    if (options.topic) {
      const topic = options.topic.toLowerCase();
      
      // Complex topics favor threads
      if (topic.includes('guide') || topic.includes('framework') || topic.includes('system')) {
        if (format === 'thread') score += 15;
      }
      
      // Quick tips favor singles
      if (topic.includes('tip') || topic.includes('hack') || topic.includes('quick')) {
        if (format === 'single') score += 15;
      }
      
      // Questions/discussions favor replies
      if (topic.includes('question') || topic.includes('discussion') || topic.includes('debate')) {
        if (format === 'reply') score += 10;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate confidence in the decision
   */
  private calculateConfidence(bestScore: number, allOptions: Array<{ format: string; score: number }>): number {
    if (allOptions.length === 1) return 1.0;

    const secondBest = allOptions[1]?.score || 0;
    const gap = bestScore - secondBest;
    
    // Higher gap = higher confidence
    const confidence = Math.min(1.0, gap / 50);
    return Math.max(0.1, confidence);
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(
    choice: { format: string; score: number }, 
    options?: { 
      topic?: string; 
      urgency?: 'low' | 'normal' | 'high';
      targetEngagement?: 'viral' | 'educational' | 'conversational';
    }
  ): string {
    const perf = this.performance.get(choice.format);
    const parts: string[] = [];

    // Performance reason
    if (perf) {
      const successRate = ((perf.successes / perf.attempts) * 100).toFixed(0);
      parts.push(`${choice.format} has ${successRate}% success rate (${perf.avgQualityScore} avg quality)`);
    }

    // Diversity reason
    const consecutive = this.getConsecutiveCount(choice.format);
    const recent = this.recentFormats.slice(-5).filter(f => f.format === choice.format).length;
    if (recent === 0) {
      parts.push('good diversity (not used recently)');
    } else if (consecutive > 0) {
      parts.push(`building on recent ${choice.format} momentum`);
    }

    // Context reason
    if (options?.targetEngagement === 'viral' && choice.format === 'thread') {
      parts.push('threads perform best for viral content');
    } else if (options?.urgency === 'high' && choice.format === 'single') {
      parts.push('singles are fastest for urgent content');
    } else if (options?.targetEngagement === 'conversational' && choice.format === 'reply') {
      parts.push('replies drive conversation');
    }

    return parts.join('; ');
  }

  /**
   * Record a decision for future analysis
   */
  private recordDecision(format: string, timestamp: number) {
    this.recentFormats.push({ format, timestamp });
    
    // Update last used time
    const perf = this.performance.get(format);
    if (perf) {
      perf.lastUsed = timestamp;
    }

    // Trim history
    if (this.recentFormats.length > this.maxHistorySize) {
      this.recentFormats = this.recentFormats.slice(-this.maxHistorySize);
    }
  }

  /**
   * Update performance data based on actual results
   */
  updatePerformance(
    format: 'single' | 'thread' | 'reply',
    success: boolean,
    qualityScore: number,
    engagement?: number
  ) {
    const perf = this.performance.get(format);
    if (!perf) {
      // Create new performance record
      this.performance.set(format, {
        format,
        attempts: 1,
        successes: success ? 1 : 0,
        avgQualityScore: qualityScore,
        avgEngagement: engagement || 0,
        lastUsed: Date.now()
      });
      return;
    }

    // Update existing record with exponential moving average
    const alpha = 0.2; // Learning rate
    
    perf.attempts++;
    if (success) perf.successes++;
    
    perf.avgQualityScore = perf.avgQualityScore * (1 - alpha) + qualityScore * alpha;
    
    if (engagement !== undefined) {
      perf.avgEngagement = perf.avgEngagement * (1 - alpha) + engagement * alpha;
    }
  }

  /**
   * Get current performance stats
   */
  getPerformanceStats(): Array<FormatPerformance & { consecutiveUses: number; nextAvailable: string }> {
    const now = Date.now();
    
    return Array.from(this.performance.values()).map(perf => ({
      ...perf,
      consecutiveUses: this.getConsecutiveCount(perf.format),
      nextAvailable: this.isFormatAvailable(perf.format, now) 
        ? 'now' 
        : this.getBlockReason(perf.format, now)
    }));
  }

  /**
   * Override policy settings
   */
  updatePolicy(updates: Partial<FormatPolicy>) {
    this.policy = { ...this.policy, ...updates };
  }

  /**
   * Reset performance data (for testing or fresh start)
   */
  resetPerformance() {
    this.performance.clear();
    this.recentFormats = [];
    this.initializeDefaults();
  }
}

export const formatDecisioner = new FormatDecisioner();
