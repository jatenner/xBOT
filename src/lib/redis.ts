// src/lib/redis.ts - Singleton Redis client with health logs and retry logic
import { createClient, RedisClientType } from 'redis';

class RedisManager {
  private static instance: RedisManager;
  private client: RedisClientType | null = null;
  private connectionAttempts = 0;
  private maxRetries = 3;
  private isConnecting = false;

  private constructor() {}

  static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager();
    }
    return RedisManager.instance;
  }

  async getClient(): Promise<RedisClientType> {
    if (this.client && this.client.isReady) {
      return this.client;
    }

    if (this.isConnecting) {
      // Wait for ongoing connection attempt
      while (this.isConnecting) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (this.client && this.client.isReady) {
        return this.client;
      }
    }

    return this.connect();
  }

  private async connect(): Promise<RedisClientType> {
    this.isConnecting = true;
    
    try {
      const redisUrl = process.env.REDIS_URL;
      if (!redisUrl) {
        throw new Error('REDIS_URL environment variable is required');
      }

      const options: any = {
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries: number) => {
            if (retries > this.maxRetries) {
              console.error('🔴 REDIS_ERROR: Max reconnection attempts reached');
              return false;
            }
            const delay = Math.min(retries * 100, 3000);
            console.log(`🔄 REDIS_RETRY: Attempt ${retries + 1}/${this.maxRetries} in ${delay}ms`);
            return delay;
          }
        }
      };

      // Enable TLS if specified
      if (process.env.REDIS_TLS === 'true') {
        options.socket.tls = true;
        console.log('🔒 REDIS_SSL: TLS enabled for Redis connection');
      }

      this.client = createClient(options);

      // Event handlers
      this.client.on('error', (err) => {
        console.error('🔴 REDIS_ERROR:', err.message);
      });

      this.client.on('connect', () => {
        this.connectionAttempts++;
        console.log(`🔌 REDIS_CONNECT: Attempting connection (${this.connectionAttempts})`);
      });

      this.client.on('ready', () => {
        console.log('✅ REDIS_READY: Connected successfully');
      });

      this.client.on('reconnecting', () => {
        console.log('🔄 REDIS_RECONNECTING: Attempting to reconnect...');
      });

      this.client.on('end', () => {
        console.log('🔌 REDIS_END: Connection closed');
      });

      await this.client.connect();
      
      // Health check ping
      await this.client.ping();
      console.log('✅ REDIS_HEALTH: Ping successful');

      return this.client;

    } catch (error) {
      console.error('❌ REDIS_CONNECT_FAILED:', error instanceof Error ? error.message : error);
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
        console.log('✅ REDIS_DISCONNECT: Graceful shutdown');
      } catch (error) {
        console.error('⚠️ REDIS_DISCONNECT_ERROR:', error instanceof Error ? error.message : error);
      }
      this.client = null;
    }
  }

  // Budget operations with Lua scripts for atomicity
  async ensureBudget(dailyLimitUsd: number, costUsd: number): Promise<boolean> {
    const client = await this.getClient();
    const today = new Date().toISOString().split('T')[0];
    const key = `budget:${today}`;
    
    // Lua script for atomic budget check and reserve
    const luaScript = `
      local key = KEYS[1]
      local limit = tonumber(ARGV[1])
      local cost = tonumber(ARGV[2])
      local current = redis.call('GET', key)
      
      if current == false then
        current = 0
      else
        current = tonumber(current)
      end
      
      if current + cost <= limit then
        redis.call('SETEX', key, 86400, current + cost)
        return {1, current + cost}
      else
        return {0, current}
      end
    `;

    try {
      const result = await client.eval(luaScript, {
        keys: [key],
        arguments: [dailyLimitUsd.toString(), costUsd.toString()]
      }) as [number, number];

      const [allowed, newTotal] = result;
      if (allowed === 1) {
        console.log(`✅ BUDGET_RESERVED: $${costUsd.toFixed(4)} (Total: $${newTotal.toFixed(4)}/$${dailyLimitUsd.toFixed(4)})`);
        return true;
      } else {
        console.log(`❌ BUDGET_EXCEEDED: Would exceed daily limit ($${newTotal.toFixed(4)}/$${dailyLimitUsd.toFixed(4)})`);
        return false;
      }
    } catch (error) {
      console.error('❌ BUDGET_CHECK_FAILED:', error instanceof Error ? error.message : error);
      return false;
    }
  }

  async getCurrentBudgetUsage(): Promise<number> {
    try {
      const client = await this.getClient();
      const today = new Date().toISOString().split('T')[0];
      const usage = await client.get(`budget:${today}`);
      return usage ? parseFloat(usage) : 0;
    } catch (error) {
      console.error('❌ BUDGET_USAGE_CHECK_FAILED:', error instanceof Error ? error.message : error);
      return 0;
    }
  }
}

// Export singleton instance
const redisManager = RedisManager.getInstance();

export default redisManager;
export { RedisManager };

// Legacy exports for compatibility
export const getRedis = () => redisManager.getClient();
export const getRedisSafeClient = () => redisManager.getClient();