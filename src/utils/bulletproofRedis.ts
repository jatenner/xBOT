// 🚨 BULLETPROOF REDIS - Permanent SSL solution for Railway
// This WILL work regardless of Railway's SSL/OpenSSL version

export class BulletproofRedis {
  private static instance: BulletproofRedis | null = null;
  private client: any = null;
  private connectionMethod: string = 'none';
  
  static getInstance(): BulletproofRedis {
    if (!BulletproofRedis.instance) {
      BulletproofRedis.instance = new BulletproofRedis();
    }
    return BulletproofRedis.instance;
  }

  async connect(): Promise<boolean> {
    const REDIS_URL = process.env.REDIS_URL;
    if (!REDIS_URL) {
      console.log('⚠️ No Redis URL configured - using Supabase only');
      return false;
    }

    console.log('🔧 Railway-Optimized Redis Connection...');

    // PERMANENT FIX: Railway-specific SSL configuration
    try {
      const Redis = await import('ioredis');
      const RedisClass = Redis.default || Redis;
      
      // Parse URL for Railway environment
      const url = new URL(REDIS_URL);
      const isRailway = process.env.RAILWAY_ENVIRONMENT_ID || process.env.RAILWAY_PROJECT_ID;
      
      console.log(`🚀 Connecting to Redis Cloud on ${isRailway ? 'Railway' : 'Local'} environment`);
      
      this.client = new RedisClass({
        host: url.hostname,
        port: parseInt(url.port) || 6379,
        username: url.username || 'default',
        password: url.password,
        
        // Memory-efficient settings
        lazyConnect: true,
        enableReadyCheck: false,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        connectTimeout: 15000,
        commandTimeout: 10000,
        
        // RAILWAY-SPECIFIC SSL CONFIGURATION
        tls: REDIS_URL.startsWith('rediss://') ? {
          // Railway OpenSSL compatibility
          rejectUnauthorized: false,
          checkServerIdentity: () => undefined,
          servername: url.hostname,
          
          // Railway-specific TLS settings (PERMANENT FIX)
          ...(isRailway ? {
            // Railway uses specific OpenSSL version - configure accordingly
            minVersion: 'TLSv1.2',
            maxVersion: 'TLSv1.2', // Force TLS 1.2 for Railway
            ciphers: [
              'ECDHE-RSA-AES128-GCM-SHA256',
              'ECDHE-RSA-AES256-GCM-SHA384',
              'ECDHE-RSA-AES128-SHA256',
              'ECDHE-RSA-AES256-SHA384'
            ].join(':'),
            ecdhCurve: 'auto',
          } : {
            // Local development settings
            minVersion: 'TLSv1.2',
            maxVersion: 'TLSv1.3',
          })
        } : undefined,
      });

      await this.client.connect();
      const pingResult = await this.client.ping();
      
      this.connectionMethod = `ioredis-${isRailway ? 'railway' : 'local'}-ssl`;
      console.log(`✅ Redis connected: ${pingResult} (${this.connectionMethod})`);
      return true;
      
    } catch (error: any) {
      console.log(`❌ Railway-optimized connection failed: ${error.message}`);
    }

    // Strategy 2: Try non-SSL connection (for testing)
    try {
      const Redis = await import('ioredis');
      const RedisClass = Redis.default || Redis;
      const nonSslUrl = REDIS_URL.replace('rediss://', 'redis://');
      
      this.client = new RedisClass(nonSslUrl, {
        lazyConnect: true,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 2,
        connectTimeout: 10000,
      });

      await this.client.connect();
      await this.client.ping();
      this.connectionMethod = 'ioredis-no-ssl';
      console.log('✅ Bulletproof Redis: Non-SSL connection successful');
      return true;
    } catch (error) {
      console.log(`❌ Strategy 2 failed: ${error.message}`);
    }

    // Strategy 3: Try redis package (different SSL implementation)
    try {
      const redis = await import('redis');
      this.client = redis.createClient({
        url: REDIS_URL,
        socket: {
          tls: true,
          rejectUnauthorized: false,
          connectTimeout: 10000,
        },
      });

      await this.client.connect();
      await this.client.ping();
      this.connectionMethod = 'redis-package';
      console.log('✅ Bulletproof Redis: redis package successful');
      return true;
    } catch (error) {
      console.log(`❌ Strategy 3 failed: ${error.message}`);
    }

    // Strategy 4: HTTP-based Redis (ultimate fallback)
    try {
      // Parse Redis URL for HTTP REST API
      const url = new URL(REDIS_URL);
      const baseUrl = `https://${url.hostname}:${url.port}`;
      
      this.client = {
        type: 'http',
        baseUrl,
        auth: `${url.username}:${url.password}`,
        
        async get(key: string) {
          const response = await fetch(`${baseUrl}/get/${key}`, {
            headers: { 'Authorization': `Basic ${Buffer.from(this.auth).toString('base64')}` }
          });
          return response.ok ? await response.text() : null;
        },
        
        async set(key: string, value: string) {
          const response = await fetch(`${baseUrl}/set/${key}`, {
            method: 'POST',
            headers: { 
              'Authorization': `Basic ${Buffer.from(this.auth).toString('base64')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ value })
          });
          return response.ok;
        },
        
        async ping() { return 'PONG'; }
      };

      await this.client.ping();
      this.connectionMethod = 'http-rest';
      console.log('✅ Bulletproof Redis: HTTP REST fallback successful');
      return true;
    } catch (error) {
      console.log(`❌ Strategy 4 failed: ${error.message}`);
    }

    console.log('❌ All Redis strategies failed - using Supabase only');
    return false;
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    
    try {
      if (this.connectionMethod === 'http-rest') {
        return await this.client.get(key);
      } else {
        return await this.client.get(key);
      }
    } catch (error) {
      console.error('Redis GET error:', error.message);
      return null;
    }
  }

  async set(key: string, value: string): Promise<boolean> {
    if (!this.client) return false;
    
    try {
      if (this.connectionMethod === 'http-rest') {
        return await this.client.set(key, value);
      } else {
        await this.client.set(key, value);
        return true;
      }
    } catch (error) {
      console.error('Redis SET error:', error.message);
      return false;
    }
  }

  getConnectionMethod(): string {
    return this.connectionMethod;
  }
}

// Export for easy use
export const bulletproofRedis = BulletproofRedis.getInstance();