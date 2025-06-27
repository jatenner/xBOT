const fs = require('fs');

// Read the file
let content = fs.readFileSync('src/utils/xClient.ts', 'utf8');

// Add cached user ID property
content = content.replace(
  'private maxConsecutiveErrors = 3;',
  `private maxConsecutiveErrors = 3;
  private cachedUserId: string | null = null;`
);

// Replace checkRateLimit to use a different approach
const oldCheckRateLimit = `  async checkRateLimit(): Promise<{ remaining: number; resetTime: number }> {
    if (!this.client) {
      return {
        remaining: 0,
        resetTime: Date.now() + (15 * 60 * 1000),
      };
    }

    try {
      // Try to make a lightweight request to get rate limit headers
      // Using a simple request like getting own user info
      const me = await this.client.v2.me();
      
      // If successful, we have some capacity
      return {
        remaining: 100, // Conservative estimate when call succeeds
        resetTime: Date.now() + (15 * 60 * 1000),
      };
      
    } catch (error: any) {
      console.error('Error checking rate limit:', error);
      
      // Parse error headers for rate limit info if available
      if (error.headers) {
        const remaining = parseInt(error.headers['x-rate-limit-remaining'] || '0');
        const reset = parseInt(error.headers['x-rate-limit-reset'] || '0');
        
        return {
          remaining: remaining || 0,
          resetTime: reset ? reset * 1000 : Date.now() + (15 * 60 * 1000),
        };
      }
      
      // Conservative fallback
      return {
        remaining: 0,
        resetTime: Date.now() + (15 * 60 * 1000),
      };
    }
  }`;

const newCheckRateLimit = `  async checkRateLimit(): Promise<{ remaining: number; resetTime: number }> {
    if (!this.client) {
      return {
        remaining: 0,
        resetTime: Date.now() + (15 * 60 * 1000),
      };
    }

    // Use a more conservative approach that doesn't make API calls
    // Base remaining tweets on time-based throttling
    const now = Date.now();
    const timeSinceLastPost = now - this.lastPostTime;
    const minimumWaitTime = this.minPostInterval * (this.consecutiveErrors + 1);
    
    if (timeSinceLastPost < minimumWaitTime) {
      return {
        remaining: 0,
        resetTime: this.lastPostTime + minimumWaitTime,
      };
    }
    
    // Conservative estimate based on Twitter's rate limits
    const dailyLimit = 300; // Conservative daily tweet limit
    const hourlyLimit = 25;  // Conservative hourly limit
    
    return {
      remaining: Math.min(hourlyLimit, dailyLimit), // Conservative estimate
      resetTime: Date.now() + (15 * 60 * 1000),
    };
  }`;

// Replace the method
content = content.replace(oldCheckRateLimit, newCheckRateLimit);

// Replace getMyUserId to use cached value
const oldGetMyUserId = `  private async getMyUserId(): Promise<string> {
    try {
      const me = await this.client.v2.me();
      return me.data.id;
    } catch (error) {
      console.error('Error getting my user ID:', error);
      throw error;
    }
  }`;

const newGetMyUserId = `  private async getMyUserId(): Promise<string> {
    if (this.cachedUserId) {
      return this.cachedUserId;
    }
    
    try {
      const me = await this.client.v2.me();
      this.cachedUserId = me.data.id; // Cache for future use
      return me.data.id;
    } catch (error) {
      console.error('Error getting my user ID:', error);
      // Fallback to environment variable if available
      if (process.env.TWITTER_USER_ID) {
        this.cachedUserId = process.env.TWITTER_USER_ID;
        return this.cachedUserId;
      }
      throw error;
    }
  }`;

content = content.replace(oldGetMyUserId, newGetMyUserId);

// Write back to file
fs.writeFileSync('src/utils/xClient.ts', content);
console.log('✅ Optimized xClient to reduce API calls');
