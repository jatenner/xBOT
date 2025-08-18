import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import os from 'os';

const TTL = parseInt(process.env.POST_LOCK_TTL_MS || '480000', 10); // 8 minutes
const HEARTBEAT_MS = 30_000; // 30 seconds
const KEY_PREFIX = process.env.REDIS_PREFIX || 'prod:';
const KEY = `${KEY_PREFIX}xbot:lock:posting`;

interface LockInfo {
  owner: string;
  reason: string;
  corrId: string;
  acquiredAt: number;
  heartbeatAt: number;
}

interface LockStatus {
  locked: boolean;
  owner?: string;
  reason?: string;
  corrId?: string;
  acquiredAt?: string;
  heartbeatAt?: string;
  expiresInMs?: number;
  stale?: boolean;
}

export class PostLock {
  private hbTimer: NodeJS.Timeout | null = null;
  private corrId: string | null = null;
  private readonly owner: string;

  constructor(private redis: Redis) {
    this.owner = `${os.hostname()}-${process.pid}`;
  }

  /**
   * Attempt to acquire the posting lock
   */
  async acquire(reason: string): Promise<boolean> {
    this.corrId = this.corrId || randomUUID();
    
    const lockInfo: LockInfo = {
      owner: this.owner,
      reason,
      corrId: this.corrId,
      acquiredAt: Date.now(),
      heartbeatAt: Date.now()
    };

    try {
      const result = await this.redis.set(KEY, JSON.stringify(lockInfo), 'PX', TTL, 'NX');
      return result === 'OK';
    } catch (error) {
      console.error('POST_LOCK: Failed to acquire lock:', error);
      return false;
    }
  }

  /**
   * Extend the lock TTL and update heartbeat
   */
  async extend(): Promise<boolean> {
    if (!this.corrId) return false;

    try {
      const value = await this.redis.get(KEY);
      if (!value) return false;

      const currentLock: LockInfo = JSON.parse(value);
      
      // Verify we own this lock
      if (currentLock.owner !== this.owner || currentLock.corrId !== this.corrId) {
        return false;
      }

      // Update heartbeat and reset TTL
      currentLock.heartbeatAt = Date.now();
      await this.redis.set(KEY, JSON.stringify(currentLock), 'PX', TTL);
      return true;
    } catch (error) {
      console.error('POST_LOCK: Failed to extend lock:', error);
      return false;
    }
  }

  /**
   * Release the lock if we own it
   */
  async release(): Promise<void> {
    try {
      if (this.corrId) {
        const value = await this.redis.get(KEY);
        if (value) {
          const currentLock: LockInfo = JSON.parse(value);
          if (currentLock.owner === this.owner && currentLock.corrId === this.corrId) {
            await this.redis.del(KEY);
          }
        }
      }
    } catch (error) {
      console.error('POST_LOCK: Failed to release lock:', error);
    } finally {
      // Always clean up local state
      if (this.hbTimer) {
        clearInterval(this.hbTimer);
        this.hbTimer = null;
      }
      this.corrId = null;
    }
  }

  /**
   * Check if the lock is stale (missing or expired beyond grace period)
   */
  async isStale(): Promise<boolean> {
    try {
      const value = await this.redis.get(KEY);
      if (!value) return true;

      const lockInfo: LockInfo = JSON.parse(value);
      const now = Date.now();
      const lockAge = now - lockInfo.acquiredAt;
      
      // Consider stale if older than TTL + 30s grace period
      return lockAge > (TTL + 30_000);
    } catch (error) {
      console.error('POST_LOCK: Failed to check staleness:', error);
      return true; // Assume stale on error
    }
  }

  /**
   * Get current lock status
   */
  async status(): Promise<LockStatus> {
    try {
      const value = await this.redis.get(KEY);
      if (!value) {
        return { locked: false };
      }

      const lockInfo: LockInfo = JSON.parse(value);
      const now = Date.now();
      const remainingTtl = await this.redis.pttl(KEY);
      
      return {
        locked: true,
        owner: lockInfo.owner,
        reason: lockInfo.reason,
        corrId: lockInfo.corrId,
        acquiredAt: new Date(lockInfo.acquiredAt).toISOString(),
        heartbeatAt: new Date(lockInfo.heartbeatAt).toISOString(),
        expiresInMs: remainingTtl > 0 ? remainingTtl : 0,
        stale: await this.isStale()
      };
    } catch (error) {
      console.error('POST_LOCK: Failed to get status:', error);
      return { locked: false };
    }
  }

  /**
   * Run a function with the posting lock acquired
   */
  async run<T>(
    reason: string,
    fn: (corrId: string) => Promise<T>,
    onLocked?: () => void
  ): Promise<T | null> {
    // Check if already locked by another owner
    const currentStatus = await this.status();
    if (currentStatus.locked && currentStatus.owner !== this.owner && !currentStatus.stale) {
      onLocked?.();
      return null;
    }

    // If stale and owned by us, try to steal it
    if (currentStatus.locked && currentStatus.stale && currentStatus.owner === this.owner) {
      console.log(`POST_LOCK: Stealing stale lock from previous instance (${currentStatus.corrId})`);
      await this.redis.del(KEY);
    }

    // Try to acquire the lock
    if (!(await this.acquire(reason))) {
      onLocked?.();
      return null;
    }

    // Start heartbeat
    this.hbTimer = setInterval(() => {
      this.extend().catch((error) => {
        console.error('POST_LOCK: Heartbeat failed:', error);
      });
    }, HEARTBEAT_MS);

    try {
      console.log(`POST_LOCK: Lock acquired for "${reason}" (${this.corrId})`);
      return await fn(this.corrId!);
    } finally {
      console.log(`POST_LOCK: Releasing lock (${this.corrId})`);
      await this.release();
    }
  }

  /**
   * Force unlock (admin only - for stuck locks)
   */
  async forceUnlock(): Promise<boolean> {
    try {
      const deleted = await this.redis.del(KEY);
      return deleted > 0;
    } catch (error) {
      console.error('POST_LOCK: Failed to force unlock:', error);
      return false;
    }
  }
}
