/**
 * 🔄 MAIN SCHEDULING LOOP
 * 
 * PURPOSE: Central coordinator for content posting decisions
 * STRATEGY: Queue-based with rate limiting and safety checks
 */

import { CandidateQueue } from '../candidates/queue';
import { CombinedScorer } from '../learn/score';
import { ContentSafetyGuard } from '../safety/guard';
import { redisManager } from '../lib/redisManager';

export interface SchedulingConfig {
  postIntervalMin: number;
  quietHours: number[];
  postFraction: number;      // 0-1 for gradual rollout
  maxCandidatesPerRun: number;
  recentTopicsWindow: number; // hours
}

export interface PostingDecision {
  shouldPost: boolean;
  candidate?: any;
  reason: string;
  score?: number;
  safetyResult?: any;
  rateLimitStatus?: any;
  timestamp: Date;
}

export interface SchedulingStats {
  lastRun: Date;
  totalRuns: number;
  postsToday: number;
  postsThisHour: number;
  queueDepth: number;
  avgScore: number;
  safetyPassRate: number;
}

/**
 * Main scheduling coordinator
 */
export class SchedulingLoop {
  private candidateQueue: CandidateQueue;
  private scorer: CombinedScorer;
  private safetyGuard: ContentSafetyGuard;
  private config: SchedulingConfig;
  private redisPrefix: string;

  constructor(config: Partial<SchedulingConfig> = {}) {
    this.candidateQueue = new CandidateQueue();
    this.scorer = new CombinedScorer();
    this.safetyGuard = new ContentSafetyGuard();
    this.redisPrefix = process.env.REDIS_PREFIX || 'app:';
    
    this.config = {
      postIntervalMin: 60,
      quietHours: [2, 3, 4, 5],
      postFraction: parseFloat(process.env.POST_FRACTION || '0'),
      maxCandidatesPerRun: 20,
      recentTopicsWindow: 24,
      ...config
    };
  }

  /**
   * Check if we're in quiet hours
   */
  private isQuietHour(): boolean {
    const hour = new Date().getHours();
    return this.config.quietHours.includes(hour);
  }

  /**
   * Get rate limit key for current hour
   */
  private getRateLimitKey(): string {
    const hour = new Date().toISOString().substring(0, 13); // YYYY-MM-DDTHH
    return `${this.redisPrefix}rate_limit:posting:${hour}`;
  }

  /**
   * Check rate limits
   */
  async checkRateLimits(): Promise<{
    allowed: boolean;
    postsThisHour: number;
    postsToday: number;
    remaining: number;
    reason?: string;
  }> {
    try {
      // Check hourly limit (12 posts per hour)
      const hourKey = this.getRateLimitKey();
      const postsThisHour = await redisManager.get(hourKey);
      const hourlyCount = parseInt(postsThisHour || '0');
      const hourlyLimit = 12;

      if (hourlyCount >= hourlyLimit) {
        return {
          allowed: false,
          postsThisHour: hourlyCount,
          postsToday: 0, // TODO: implement daily tracking
          remaining: 0,
          reason: `Hourly limit reached: ${hourlyCount}/${hourlyLimit}`
        };
      }

      // Check if minimum interval has passed
      const lastPostKey = `${this.redisPrefix}state:last_post_time`;
      const lastPostTime = await redisManager.get(lastPostKey);
      
      if (lastPostTime) {
        const minutesSinceLastPost = (Date.now() - parseInt(lastPostTime)) / (1000 * 60);
        if (minutesSinceLastPost < this.config.postIntervalMin) {
          return {
            allowed: false,
            postsThisHour: hourlyCount,
            postsToday: 0,
            remaining: Math.ceil(this.config.postIntervalMin - minutesSinceLastPost),
            reason: `Interval not met: ${minutesSinceLastPost.toFixed(1)}min < ${this.config.postIntervalMin}min`
          };
        }
      }

      return {
        allowed: true,
        postsThisHour: hourlyCount,
        postsToday: 0,
        remaining: hourlyLimit - hourlyCount
      };
    } catch (error: any) {
      console.error('Rate limit check failed:', error.message);
      return {
        allowed: false,
        postsThisHour: 0,
        postsToday: 0,
        remaining: 0,
        reason: 'Rate limit check error'
      };
    }
  }

  /**
   * Get recent topics for diversity
   */
  async getRecentTopics(): Promise<string[]> {
    try {
      const hoursAgo = this.config.recentTopicsWindow;
      const recentKey = `${this.redisPrefix}state:recent_topics:${hoursAgo}h`;
      const topicsData = await redisManager.get(recentKey);
      
      if (topicsData) {
        return JSON.parse(topicsData);
      }
      
      return [];
    } catch (error: any) {
      console.error('Failed to get recent topics:', error.message);
      return [];
    }
  }

  /**
   * Store topic for diversity tracking
   */
  async storeRecentTopic(topic: string): Promise<void> {
    try {
      const hoursAgo = this.config.recentTopicsWindow;
      const recentKey = `${this.redisPrefix}state:recent_topics:${hoursAgo}h`;
      const topics = await this.getRecentTopics();
      
      topics.unshift(topic);
      
      // Keep only last 20 topics
      const limitedTopics = topics.slice(0, 20);
      
      await redisManager.set(recentKey, JSON.stringify(limitedTopics), hoursAgo * 3600);
    } catch (error: any) {
      console.error('Failed to store recent topic:', error.message);
    }
  }

  /**
   * Main scheduling decision logic
   */
  async makePostingDecision(): Promise<PostingDecision> {
    const timestamp = new Date();
    
    try {
      console.log('🔄 Making posting decision...');

      // Check quiet hours
      if (this.isQuietHour()) {
        return {
          shouldPost: false,
          reason: `Quiet hour: ${timestamp.getHours()}:00`,
          timestamp
        };
      }

      // Check rate limits
      const rateLimitStatus = await this.checkRateLimits();
      if (!rateLimitStatus.allowed) {
        return {
          shouldPost: false,
          reason: rateLimitStatus.reason || 'Rate limit exceeded',
          rateLimitStatus,
          timestamp
        };
      }

      // Get candidates from queue
      const candidates = await this.candidateQueue.peek(this.config.maxCandidatesPerRun);
      if (candidates.length === 0) {
        return {
          shouldPost: false,
          reason: 'No candidates in queue',
          timestamp
        };
      }

      console.log(`📊 Evaluating ${candidates.length} candidates...`);

      // Get recent topics for diversity
      const recentTopics = await this.getRecentTopics();

      // Score candidates
      const scoringResult = await this.scorer.scoreCandidates(candidates, recentTopics);
      
      if (!scoringResult.topCandidate) {
        return {
          shouldPost: false,
          reason: 'No candidates after scoring',
          timestamp
        };
      }

      const topCandidate = scoringResult.topCandidate;
      console.log(`🎯 Top candidate: "${topCandidate.candidate.text.substring(0, 50)}..." (score: ${topCandidate.totalScore.toFixed(3)})`);

      // Safety check
      const safetyResult = this.safetyGuard.validate({
        text: topCandidate.candidate.text,
        tags: topCandidate.candidate.tags,
        topic: topCandidate.candidate.topic
      });

      if (!safetyResult.ok) {
        console.log(`🛡️  Safety check failed: ${safetyResult.reasons.join(', ')}`);
        
        // Remove unsafe candidate from queue
        await this.candidateQueue.dequeue();
        
        return {
          shouldPost: false,
          reason: `Safety check failed: ${safetyResult.reasons[0]}`,
          safetyResult,
          candidate: topCandidate,
          timestamp
        };
      }

      // Check post fraction for gradual rollout
      if (Math.random() > this.config.postFraction) {
        return {
          shouldPost: false,
          reason: `Post fraction limit: ${this.config.postFraction}`,
          candidate: topCandidate,
          score: topCandidate.totalScore,
          timestamp
        };
      }

      // All checks passed!
      return {
        shouldPost: true,
        candidate: topCandidate,
        reason: 'All checks passed',
        score: topCandidate.totalScore,
        safetyResult,
        rateLimitStatus,
        timestamp
      };

    } catch (error: any) {
      console.error('Posting decision error:', error.message);
      return {
        shouldPost: false,
        reason: `Decision error: ${error.message}`,
        timestamp
      };
    }
  }

  /**
   * Execute posting (shadow mode or live)
   */
  async executePosting(decision: PostingDecision): Promise<{
    success: boolean;
    tweetId?: string;
    error?: string;
  }> {
    if (!decision.shouldPost || !decision.candidate) {
      return { success: false, error: 'No candidate to post' };
    }

    const livePosting = process.env.LIVE_POSTS === 'true';
    
    try {
      if (livePosting) {
        console.log('🔴 LIVE POSTING MODE');
        
        // TODO: Integration with existing Twitter poster
        // const { AutonomousTwitterPoster } = await import('../agents/autonomousTwitterPoster');
        // const poster = AutonomousTwitterPoster.getInstance();
        // const result = await poster.postTweet(decision.candidate.candidate.text);
        
        // For now, simulate successful posting
        const mockTweetId = `mock_${Date.now()}`;
        console.log(`✅ Posted tweet: ${decision.candidate.candidate.text}`);
        
        // Update rate limits
        await this.updateRateLimits();
        
        // Store recent topic
        await this.storeRecentTopic(decision.candidate.candidate.topic);
        
        // Remove from queue
        await this.candidateQueue.dequeue();
        
        // Store in audit log
        await this.logPostingDecision(decision, mockTweetId);
        
        return { success: true, tweetId: mockTweetId };
        
      } else {
        console.log('👻 SHADOW MODE - Would post:');
        console.log(`   Text: "${decision.candidate.candidate.text}"`);
        console.log(`   Topic: ${decision.candidate.candidate.topic}`);
        console.log(`   Score: ${decision.score?.toFixed(3)}`);
        console.log(`   Tags: ${decision.candidate.candidate.tags.join(', ')}`);
        
        // Still remove from queue in shadow mode to prevent repeats
        await this.candidateQueue.dequeue();
        
        // Log shadow decision
        await this.logPostingDecision(decision, 'shadow_mode');
        
        return { success: true, tweetId: 'shadow_mode' };
      }
    } catch (error: any) {
      console.error('Posting execution failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update rate limit counters
   */
  private async updateRateLimits(): Promise<void> {
    try {
      const hourKey = this.getRateLimitKey();
      await redisManager.incr(hourKey);
      await redisManager.expire(hourKey, 3600); // 1 hour TTL
      
      const lastPostKey = `${this.redisPrefix}state:last_post_time`;
      await redisManager.set(lastPostKey, Date.now().toString());
    } catch (error: any) {
      console.error('Failed to update rate limits:', error.message);
    }
  }

  /**
   * Log posting decision for analysis
   */
  private async logPostingDecision(decision: PostingDecision, tweetId?: string): Promise<void> {
    try {
      const logEntry = {
        timestamp: decision.timestamp,
        shouldPost: decision.shouldPost,
        reason: decision.reason,
        tweetId,
        candidate: decision.candidate ? {
          text: decision.candidate.candidate.text,
          topic: decision.candidate.candidate.topic,
          score: decision.score,
          source: decision.candidate.candidate.source
        } : null,
        safetyResult: decision.safetyResult,
        rateLimitStatus: decision.rateLimitStatus
      };

      // Store in audit queue for later processing
      await redisManager.addToQueue('audit_log', {
        type: 'posting_decision',
        data: logEntry,
        priority: 50
      });

      console.log(`📝 Logged posting decision: ${decision.shouldPost ? 'POST' : 'SKIP'} - ${decision.reason}`);
    } catch (error: any) {
      console.error('Failed to log posting decision:', error.message);
    }
  }

  /**
   * Run one scheduling cycle
   */
  async runCycle(): Promise<PostingDecision> {
    console.log('🔄 Starting scheduling cycle...');
    
    const decision = await this.makePostingDecision();
    
    if (decision.shouldPost) {
      const result = await this.executePosting(decision);
      console.log(`🚀 Posting result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      
      if (result.error) {
        console.error(`❌ Posting error: ${result.error}`);
      }
    } else {
      console.log(`⏭️  Skipping post: ${decision.reason}`);
    }
    
    return decision;
  }

  /**
   * Run continuous scheduling loop
   */
  async runContinuous(intervalMinutes: number = 5): Promise<void> {
    console.log(`🔄 Starting continuous scheduling loop (${intervalMinutes}min intervals)...`);
    
    setInterval(async () => {
      try {
        await this.runCycle();
      } catch (error: any) {
        console.error('Scheduling cycle error:', error.message);
      }
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Get scheduling statistics
   */
  async getStats(): Promise<SchedulingStats> {
    try {
      const queueStats = await this.candidateQueue.getStats();
      const rateLimitStatus = await this.checkRateLimits();
      
      return {
        lastRun: new Date(), // Would track in production
        totalRuns: 0, // Would track in production
        postsToday: rateLimitStatus.postsToday,
        postsThisHour: rateLimitStatus.postsThisHour,
        queueDepth: queueStats.queueDepth,
        avgScore: 0, // Would calculate from recent decisions
        safetyPassRate: 0.95 // Would calculate from recent decisions
      };
    } catch (error: any) {
      console.error('Failed to get scheduling stats:', error.message);
      return {
        lastRun: new Date(),
        totalRuns: 0,
        postsToday: 0,
        postsThisHour: 0,
        queueDepth: 0,
        avgScore: 0,
        safetyPassRate: 0
      };
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SchedulingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log(`🔄 Updated scheduling config: ${JSON.stringify(newConfig)}`);
  }

  /**
   * Get current configuration
   */
  getConfig(): SchedulingConfig {
    return { ...this.config };
  }
}