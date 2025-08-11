/**
 * 🚀 CANDIDATE QUEUE MANAGEMENT
 * 
 * PURPOSE: Redis-based queue for prepared candidates
 * STRATEGY: Priority-based queue with deduplication checks
 */

import { redisManager } from '../lib/redisManager';
import { PreparedCandidate } from './prep';

export interface QueuedCandidate extends PreparedCandidate {
  queuedAt: Date;
  expiresAt: Date;
  queuePriority: number;
}

export interface QueueStats {
  totalCandidates: number;
  queueDepth: number;
  oldestCandidate?: Date;
  newestCandidate?: Date;
  avgPriority: number;
  topTopics: string[];
}

/**
 * Redis-based candidate queue manager
 */
export class CandidateQueue {
  private redisPrefix: string;
  private queueKey: string;
  private hashKey: string;
  private readonly TTL_HOURS = 24 * 7; // 7 days for dedup hashes
  private readonly QUEUE_TTL_HOURS = 48; // 48 hours for queued candidates

  constructor() {
    this.redisPrefix = process.env.REDIS_PREFIX || 'app:';
    this.queueKey = `${this.redisPrefix}queue:candidates`;
    this.hashKey = `${this.redisPrefix}content_hash:sha256`;
  }

  /**
   * Check if content hash already exists
   */
  async isDuplicate(hash: string): Promise<boolean> {
    try {
      const exists = await redisManager.exists(`${this.hashKey}:${hash}`);
      return exists;
    } catch (error: any) {
      console.error('Redis duplicate check failed:', error.message);
      return false; // Allow through on Redis failure
    }
  }

  /**
   * Store content hash for deduplication
   */
  async storeHash(hash: string, metadata: { tweetId?: string; source: string }): Promise<void> {
    try {
      const hashKeyFull = `${this.hashKey}:${hash}`;
      const data = {
        timestamp: new Date().toISOString(),
        source: metadata.source,
        tweetId: metadata.tweetId
      };
      
      await redisManager.set(hashKeyFull, JSON.stringify(data), this.TTL_HOURS * 3600);
    } catch (error: any) {
      console.error('Failed to store content hash:', error.message);
    }
  }

  /**
   * Calculate queue priority based on multiple factors
   */
  private calculateQueuePriority(candidate: PreparedCandidate): number {
    let priority = candidate.priority;

    // Boost for high recency score
    priority += candidate.recencyScore * 50;

    // Boost for trending topics
    if (candidate.topic.includes('fps') || candidate.topic.includes('battle_royale')) {
      priority += 20;
    }

    // Boost for media content
    if (candidate.mediaHint === 'clip') {
      priority += 30;
    } else if (candidate.mediaHint === 'image') {
      priority += 15;
    }

    // Boost for optimal timing (would be enhanced with real-time data)
    const hour = new Date().getHours();
    if (hour >= 18 && hour <= 22) { // Prime gaming hours
      priority += 25;
    }

    return Math.floor(priority);
  }

  /**
   * Add candidate to queue
   */
  async enqueue(candidate: PreparedCandidate): Promise<boolean> {
    try {
      // Skip if duplicate
      if (candidate.isDuplicate || await this.isDuplicate(candidate.hash)) {
        console.log(`⏭️  Skipping duplicate: ${candidate.hash}`);
        return false;
      }

      const queuedCandidate: QueuedCandidate = {
        ...candidate,
        queuedAt: new Date(),
        expiresAt: new Date(Date.now() + this.QUEUE_TTL_HOURS * 60 * 60 * 1000),
        queuePriority: this.calculateQueuePriority(candidate)
      };

      // Add to priority queue (sorted set)
      await redisManager.addToQueue('candidates', {
        type: 'content_candidate',
        data: queuedCandidate,
        priority: queuedCandidate.queuePriority
      });

      // Store hash for deduplication
      await this.storeHash(candidate.hash, {
        source: candidate.source,
        tweetId: undefined
      });

      console.log(`✅ Queued: "${candidate.text.substring(0, 50)}..." (priority: ${queuedCandidate.queuePriority})`);
      return true;
    } catch (error: any) {
      console.error('Failed to enqueue candidate:', error.message);
      return false;
    }
  }

  /**
   * Add multiple candidates to queue
   */
  async enqueueBatch(candidates: PreparedCandidate[]): Promise<{ success: number; skipped: number; errors: number }> {
    console.log(`🚀 Enqueueing ${candidates.length} candidates...`);
    
    let success = 0;
    let skipped = 0;
    let errors = 0;

    for (const candidate of candidates) {
      try {
        const result = await this.enqueue(candidate);
        if (result) {
          success++;
        } else {
          skipped++;
        }
      } catch (error) {
        errors++;
        console.error(`Error enqueueing candidate: ${error}`);
      }
    }

    console.log(`📊 Queue results: ${success} success, ${skipped} skipped, ${errors} errors`);
    return { success, skipped, errors };
  }

  /**
   * Get next candidate from queue (highest priority)
   */
  async dequeue(): Promise<QueuedCandidate | null> {
    try {
      const items = await redisManager.getFromQueue('candidates', 1);
      
      if (items.length === 0) {
        return null;
      }

      const item = items[0];
      const candidate = item.data as QueuedCandidate;

      // Check if expired
      if (new Date() > new Date(candidate.expiresAt)) {
        console.log(`⏰ Candidate expired: ${candidate.hash}`);
        await redisManager.removeFromQueue('candidates', item.id);
        return this.dequeue(); // Try next item
      }

      // Remove from queue (consumed)
      await redisManager.removeFromQueue('candidates', item.id);
      
      console.log(`📤 Dequeued: "${candidate.text.substring(0, 50)}..." (priority: ${candidate.queuePriority})`);
      return candidate;
    } catch (error: any) {
      console.error('Failed to dequeue candidate:', error.message);
      return null;
    }
  }

  /**
   * Peek at top candidates without removing them
   */
  async peek(count: number = 5): Promise<QueuedCandidate[]> {
    try {
      const items = await redisManager.getFromQueue('candidates', count);
      return items.map(item => item.data as QueuedCandidate);
    } catch (error: any) {
      console.error('Failed to peek queue:', error.message);
      return [];
    }
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    try {
      const queueDepth = await redisManager.getQueueDepth('candidates');
      const candidates = await this.peek(50); // Sample for stats
      
      if (candidates.length === 0) {
        return {
          totalCandidates: 0,
          queueDepth,
          avgPriority: 0,
          topTopics: []
        };
      }

      const topics: Record<string, number> = {};
      let totalPriority = 0;
      let oldest: Date | undefined;
      let newest: Date | undefined;

      for (const candidate of candidates) {
        topics[candidate.topic] = (topics[candidate.topic] || 0) + 1;
        totalPriority += candidate.queuePriority;
        
        const queuedAt = new Date(candidate.queuedAt);
        if (!oldest || queuedAt < oldest) oldest = queuedAt;
        if (!newest || queuedAt > newest) newest = queuedAt;
      }

      const topTopics = Object.entries(topics)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([topic]) => topic);

      return {
        totalCandidates: candidates.length,
        queueDepth,
        oldestCandidate: oldest,
        newestCandidate: newest,
        avgPriority: totalPriority / candidates.length,
        topTopics
      };
    } catch (error: any) {
      console.error('Failed to get queue stats:', error.message);
      return {
        totalCandidates: 0,
        queueDepth: 0,
        avgPriority: 0,
        topTopics: []
      };
    }
  }

  /**
   * Clear expired candidates from queue
   */
  async cleanupExpired(): Promise<number> {
    try {
      let cleaned = 0;
      const candidates = await this.peek(100); // Check more for cleanup
      
      for (const candidate of candidates) {
        if (new Date() > new Date(candidate.expiresAt)) {
          // Find and remove the expired item
          const items = await redisManager.getFromQueue('candidates', 100);
          const expiredItem = items.find(item => 
            (item.data as QueuedCandidate).hash === candidate.hash
          );
          
          if (expiredItem) {
            await redisManager.removeFromQueue('candidates', expiredItem.id);
            cleaned++;
          }
        }
      }

      if (cleaned > 0) {
        console.log(`🧹 Cleaned ${cleaned} expired candidates`);
      }

      return cleaned;
    } catch (error: any) {
      console.error('Failed to cleanup expired candidates:', error.message);
      return 0;
    }
  }

  /**
   * Clear all candidates from queue
   */
  async clear(): Promise<void> {
    try {
      // Get all items and remove them
      const allItems = await redisManager.getFromQueue('candidates', 1000);
      
      for (const item of allItems) {
        await redisManager.removeFromQueue('candidates', item.id);
      }
      
      console.log(`🗑️  Cleared ${allItems.length} candidates from queue`);
    } catch (error: any) {
      console.error('Failed to clear queue:', error.message);
    }
  }

  /**
   * Get queue health status
   */
  async getHealth(): Promise<{ status: 'healthy' | 'warning' | 'critical'; message: string; details: any }> {
    try {
      const stats = await this.getStats();
      
      if (stats.queueDepth === 0) {
        return {
          status: 'warning',
          message: 'Queue is empty',
          details: stats
        };
      }

      if (stats.queueDepth > 500) {
        return {
          status: 'warning',
          message: 'Queue depth is high',
          details: stats
        };
      }

      // Check if oldest candidate is too old (> 24 hours)
      if (stats.oldestCandidate && 
          (new Date().getTime() - stats.oldestCandidate.getTime()) > 24 * 60 * 60 * 1000) {
        return {
          status: 'warning',
          message: 'Queue has stale candidates',
          details: stats
        };
      }

      return {
        status: 'healthy',
        message: 'Queue operating normally',
        details: stats
      };
    } catch (error: any) {
      return {
        status: 'critical',
        message: `Queue health check failed: ${error.message}`,
        details: null
      };
    }
  }
}