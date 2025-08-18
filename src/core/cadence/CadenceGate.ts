/**
 * Cadence Gate - Manages posting intervals and prevents spam
 * Handles bootstrap mode and backoff logic
 */

interface CadenceConfig {
  minIntervalMs: number;
  bootstrapThreshold: number;
  bootstrapIntervalMs: number;
  backoffCheckMs: number;
}

interface CadenceState {
  lastPostAt: number | null;
  totalPosts: number;
}

interface CadenceResult {
  allowed: boolean;
  waitMs: number;
  reason: string;
  nextCheckMs: number;
}

export class CadenceGate {
  private state: CadenceState;
  private config: CadenceConfig;
  private lastLoggedAt = 0;
  private readonly logThrottleMs = 60000; // Log at most once per minute

  constructor(config?: Partial<CadenceConfig>) {
    this.config = {
      minIntervalMs: (parseInt(process.env.MIN_POST_INTERVAL_MINUTES || '120')) * 60 * 1000,
      bootstrapThreshold: 5,
      bootstrapIntervalMs: 10 * 60 * 1000, // 10 minutes for bootstrap
      backoffCheckMs: 60 * 1000, // Check every minute when not allowed
      ...config
    };

    this.state = {
      lastPostAt: null,
      totalPosts: 0
    };

    this.loadState();
  }

  /**
   * Check if posting is currently allowed
   */
  isAllowed(now = Date.now()): CadenceResult {
    const { lastPostAt, totalPosts } = this.state;

    // Bootstrap mode - more frequent posting for new accounts
    if (totalPosts < this.config.bootstrapThreshold) {
      if (!lastPostAt) {
        return {
          allowed: true,
          waitMs: 0,
          reason: 'bootstrap mode - first post',
          nextCheckMs: 0
        };
      }

      const sinceLastMs = now - lastPostAt;
      if (sinceLastMs >= this.config.bootstrapIntervalMs) {
        return {
          allowed: true,
          waitMs: 0,
          reason: `bootstrap mode - ${totalPosts}/${this.config.bootstrapThreshold} posts`,
          nextCheckMs: 0
        };
      }

      const waitMs = this.config.bootstrapIntervalMs - sinceLastMs;
      return {
        allowed: false,
        waitMs,
        reason: `bootstrap cooldown - ${Math.ceil(waitMs / 60000)}m remaining`,
        nextCheckMs: Math.min(waitMs, this.config.backoffCheckMs)
      };
    }

    // Normal mode - standard intervals
    if (!lastPostAt) {
      return {
        allowed: true,
        waitMs: 0,
        reason: 'no previous post',
        nextCheckMs: 0
      };
    }

    const sinceLastMs = now - lastPostAt;
    if (sinceLastMs >= this.config.minIntervalMs) {
      return {
        allowed: true,
        waitMs: 0,
        reason: 'interval met',
        nextCheckMs: 0
      };
    }

    const waitMs = this.config.minIntervalMs - sinceLastMs;
    return {
      allowed: false,
      waitMs,
      reason: `minimum interval - ${Math.ceil(waitMs / 60000)}m remaining`,
      nextCheckMs: Math.min(waitMs, this.config.backoffCheckMs)
    };
  }

  /**
   * Record a successful post
   */
  recordPost(timestamp = Date.now()): void {
    this.state.lastPostAt = timestamp;
    this.state.totalPosts++;
    this.saveState();
    
    console.info(`CADENCE: Post recorded (${this.state.totalPosts} total)`);
  }

  /**
   * Get next allowed posting time
   */
  nextAllowedAt(): Date {
    const result = this.isAllowed();
    return new Date(Date.now() + result.waitMs);
  }

  /**
   * Log cadence status with throttling to prevent spam
   */
  logStatus(result: CadenceResult, level: 'info' | 'warn' = 'info'): void {
    const now = Date.now();
    
    // Throttle logging to prevent spam
    if (now - this.lastLoggedAt < this.logThrottleMs) {
      return;
    }
    
    this.lastLoggedAt = now;
    
    const nextCheck = result.nextCheckMs > 0 ? `, next check in ${Math.ceil(result.nextCheckMs / 60000)}m` : '';
    const message = `CADENCE: ${result.reason}${nextCheck}`;
    
    if (level === 'warn') {
      console.warn(message);
    } else {
      console.info(message);
    }
  }

  /**
   * Load state from storage (simple file-based for now)
   */
  private loadState(): void {
    try {
      const fs = require('fs');
      const statePath = process.env.CADENCE_STATE_PATH || '/tmp/cadence-state.json';
      
      if (fs.existsSync(statePath)) {
        const data = fs.readFileSync(statePath, 'utf8');
        const loaded = JSON.parse(data);
        this.state = { ...this.state, ...loaded };
        console.info(`CADENCE: Loaded state (${this.state.totalPosts} posts)`);
      }
    } catch (error) {
      console.warn('CADENCE: Failed to load state:', (error as Error).message);
    }
  }

  /**
   * Save state to storage
   */
  private saveState(): void {
    try {
      const fs = require('fs');
      const statePath = process.env.CADENCE_STATE_PATH || '/tmp/cadence-state.json';
      fs.writeFileSync(statePath, JSON.stringify(this.state, null, 2));
    } catch (error) {
      console.warn('CADENCE: Failed to save state:', (error as Error).message);
    }
  }

  /**
   * Reset state (useful for testing)
   */
  reset(): void {
    this.state = { lastPostAt: null, totalPosts: 0 };
    this.saveState();
  }
}
