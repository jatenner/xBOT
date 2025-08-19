/**
 * Intelligent Logging System
 * Manages log volume and prevents spam while maintaining observability
 */

interface LogEntry {
  message: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  timestamp: number;
  count: number;
}

interface LogThrottleConfig {
  windowMs: number;
  maxLogs: number;
  burstAllowed: number;
}

class IntelligentLogger {
  private logCache = new Map<string, LogEntry>();
  private logCounts = new Map<string, number>();
  private lastCleanup = Date.now();
  private readonly cleanupInterval = 60000; // 1 minute
  
  private config: LogThrottleConfig = {
    windowMs: parseInt(process.env.LOG_THROTTLE_WINDOW_MS || '300000', 10), // 5 minutes - more aggressive
    maxLogs: parseInt(process.env.LOG_THROTTLE_MAX_LOGS || '5', 10), // Reduced from 10 to 5
    burstAllowed: parseInt(process.env.LOG_THROTTLE_BURST || '2', 10) // Reduced from 3 to 2
  };

  /**
   * Log with intelligent throttling
   */
  log(level: 'info' | 'warn' | 'error' | 'debug', message: string, ...args: any[]) {
    // Always allow errors to go through (but still track them)
    if (level === 'error') {
      console.error(message, ...args);
      this.trackMessage(message, level);
      return;
    }

    // Clean up old entries periodically
    this.maybeCleanup();

    const key = this.getMessageKey(message);
    const now = Date.now();
    const existing = this.logCache.get(key);

    if (existing) {
      // Check if we should throttle
      const timeSinceFirst = now - existing.timestamp;
      const currentCount = this.logCounts.get(key) || 0;

      if (timeSinceFirst < this.config.windowMs) {
        if (currentCount < this.config.burstAllowed) {
          // Allow burst
          this.logOutput(level, message, args);
          this.logCounts.set(key, currentCount + 1);
        } else if (currentCount >= this.config.maxLogs) {
          // Throttled - update count but don't log
          existing.count++;
          return;
        } else {
          // Log with throttle info
          this.logOutput(level, `${message} (repeated ${existing.count}x)`, args);
          this.logCounts.set(key, currentCount + 1);
          existing.count++;
        }
      } else {
        // Outside window, reset
        existing.timestamp = now;
        existing.count = 1;
        this.logCounts.set(key, 1);
        this.logOutput(level, message, args);
      }
    } else {
      // First time seeing this message
      this.logCache.set(key, {
        message,
        level,
        timestamp: now,
        count: 1
      });
      this.logCounts.set(key, 1);
      this.logOutput(level, message, args);
    }
  }

  /**
   * Track message frequency without necessarily logging
   */
  private trackMessage(message: string, level: 'info' | 'warn' | 'error' | 'debug') {
    const key = this.getMessageKey(message);
    const existing = this.logCache.get(key);
    
    if (existing) {
      existing.count++;
    } else {
      this.logCache.set(key, {
        message,
        level,
        timestamp: Date.now(),
        count: 1
      });
    }
  }

  /**
   * Generate a key for message deduplication
   */
  private getMessageKey(message: string): string {
    // Remove dynamic parts like IDs, timestamps, numbers for better grouping
    return message
      .replace(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi, '<UUID>')
      .replace(/\b\d{13,}\b/g, '<TIMESTAMP>')
      .replace(/\b\d+ms\b/g, '<DURATION>')
      .replace(/\b\d+(\.\d+)?[%]/g, '<PERCENTAGE>')
      .replace(/\bid=\w+/g, 'id=<ID>')
      .replace(/\btweetId=\w+/g, 'tweetId=<ID>')
      .substring(0, 100); // Limit key length
  }

  /**
   * Actually output the log
   */
  private logOutput(level: 'info' | 'warn' | 'error' | 'debug', message: string, args: any[]) {
    switch (level) {
      case 'info':
        console.log(message, ...args);
        break;
      case 'warn':
        console.warn(message, ...args);
        break;
      case 'error':
        console.error(message, ...args);
        break;
      case 'debug':
        if (process.env.LOG_LEVEL === 'debug') {
          console.debug(message, ...args);
        }
        break;
    }
  }

  /**
   * Clean up old log entries
   */
  private maybeCleanup() {
    const now = Date.now();
    if (now - this.lastCleanup < this.cleanupInterval) {
      return;
    }

    const cutoff = now - this.config.windowMs * 2; // Keep data for 2 windows
    
    for (const [key, entry] of this.logCache.entries()) {
      if (entry.timestamp < cutoff) {
        this.logCache.delete(key);
        this.logCounts.delete(key);
      }
    }

    this.lastCleanup = now;
  }

  /**
   * Get logging statistics
   */
  getStats() {
    const now = Date.now();
    const recent = Array.from(this.logCache.values())
      .filter(entry => now - entry.timestamp < this.config.windowMs);

    const byLevel = recent.reduce((acc, entry) => {
      acc[entry.level] = (acc[entry.level] || 0) + entry.count;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalCachedMessages: this.logCache.size,
      recentMessages: recent.length,
      recentByLevel: byLevel,
      throttledCount: recent.filter(e => e.count > this.config.maxLogs).length
    };
  }

  /**
   * Force log a message (bypass throttling)
   */
  force(level: 'info' | 'warn' | 'error' | 'debug', message: string, ...args: any[]) {
    this.logOutput(level, `[FORCE] ${message}`, args);
  }
}

// Global instance
export const logger = new IntelligentLogger();

// Convenience methods
export const logInfo = (message: string, ...args: any[]) => logger.log('info', message, ...args);
export const logWarn = (message: string, ...args: any[]) => logger.log('warn', message, ...args);
export const logError = (message: string, ...args: any[]) => logger.log('error', message, ...args);
export const logDebug = (message: string, ...args: any[]) => logger.log('debug', message, ...args);
export const forceLog = (level: 'info' | 'warn' | 'error' | 'debug', message: string, ...args: any[]) => 
  logger.force(level, message, ...args);
