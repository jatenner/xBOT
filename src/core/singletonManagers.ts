/**
 * 🏗️ SINGLETON MANAGERS - Permanent Fix for Resource Exhaustion
 * 
 * PROBLEM: Every poster creates new Redis + Browser connections
 * SOLUTION: ONE Redis, ONE Browser for entire app
 * 
 * This fixes:
 * - Redis "max clients reached"
 * - Browser "spawn EAGAIN" errors
 * - Memory leaks
 * - Resource exhaustion
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import Redis from 'ioredis';

/**
 * 🔴 SINGLETON REDIS - One connection for entire app
 */
export class SingletonRedis {
  private static client: Redis | null = null;
  private static connecting: boolean = false;

  static async getClient(): Promise<Redis> {
    if (this.client && this.client.status === 'ready') {
      return this.client;
    }

    if (this.connecting) {
      // Wait for connection to complete
      while (this.connecting) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (this.client) return this.client;
    }

    return this.connect();
  }

  private static async connect(): Promise<Redis> {
    this.connecting = true;

    try {
      const redisUrl = process.env.REDIS_URL;
      if (!redisUrl) {
        throw new Error('REDIS_URL not configured');
      }

      console.log('🔌 SINGLETON_REDIS: Creating ONE Redis connection for entire app...');

      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        connectTimeout: 10000,
        lazyConnect: false,
        keepAlive: 30000,
        enableReadyCheck: true,
        enableOfflineQueue: false
      });

      this.client.on('error', (error) => {
        console.error('🔴 REDIS_ERROR:', error.message);
      });

      this.client.on('ready', () => {
        console.log('✅ SINGLETON_REDIS: Ready (shared across all systems)');
      });

      // Test connection
      await this.client.ping();

      return this.client;

    } catch (error: any) {
      console.error('❌ SINGLETON_REDIS: Connection failed:', error.message);
      throw error;
    } finally {
      this.connecting = false;
    }
  }

  static async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }
}

/**
 * 🌐 SINGLETON BROWSER - One browser for entire app
 */
export class SingletonBrowser {
  private static browser: Browser | null = null;
  private static authenticatedContext: BrowserContext | null = null;
  private static launching: boolean = false;
  private static initialized: boolean = false;

  static async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('🌐 SINGLETON_BROWSER: Initializing ONE browser for entire app...');

    await this.launchBrowser();
    await this.createAuthenticatedContext();

    this.initialized = true;
    console.log('✅ SINGLETON_BROWSER: Initialized and authenticated');
  }

  private static async launchBrowser(): Promise<void> {
    if (this.browser) return;

    if (this.launching) {
      while (this.launching) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    this.launching = true;

    try {
      console.log('🚀 SINGLETON_BROWSER: Launching browser...');

      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process', // CRITICAL: Only one process (Railway limit)
          '--no-zygote',
          '--disable-software-rasterizer'
        ]
      });

      this.browser.on('disconnected', () => {
        console.warn('⚠️ SINGLETON_BROWSER: Disconnected, will relaunch on next use');
        this.browser = null;
        this.authenticatedContext = null;
        this.initialized = false;
      });

      console.log('✅ SINGLETON_BROWSER: Browser launched');

    } finally {
      this.launching = false;
    }
  }

  private static async createAuthenticatedContext(): Promise<void> {
    if (!this.browser) {
      await this.launchBrowser();
    }

    console.log('🔐 SINGLETON_BROWSER: Creating authenticated context...');

    const contextOptions: any = {
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    // Load Twitter session from TWITTER_SESSION_B64
    if (process.env.TWITTER_SESSION_B64) {
      try {
        const sessionData = Buffer.from(process.env.TWITTER_SESSION_B64, 'base64').toString('utf-8');
        const sessionJson = JSON.parse(sessionData);
        contextOptions.storageState = sessionJson;
        console.log(`🔐 SINGLETON_BROWSER: Loaded session (${sessionJson.cookies?.length || 0} cookies)`);
      } catch (error: any) {
        console.warn('⚠️ SINGLETON_BROWSER: Failed to load session:', error.message);
      }
    }

    this.authenticatedContext = await this.browser!.newContext(contextOptions);
    console.log('✅ SINGLETON_BROWSER: Authenticated context ready');
  }

  /**
   * Get a new page from the authenticated context
   * All systems use this - guaranteed to be authenticated
   */
  static async getPage(): Promise<Page> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.authenticatedContext) {
      await this.createAuthenticatedContext();
    }

    const page = await this.authenticatedContext!.newPage();
    return page;
  }

  /**
   * Cleanup - call on app shutdown
   */
  static async cleanup(): Promise<void> {
    if (this.authenticatedContext) {
      await this.authenticatedContext.close();
      this.authenticatedContext = null;
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    this.initialized = false;
    console.log('🧹 SINGLETON_BROWSER: Cleaned up');
  }
}

/**
 * 🎯 Initialize all singletons on app startup
 */
export async function initializeSingletons(): Promise<void> {
  console.log('🏗️ SINGLETONS: Initializing core managers...');

  try {
    // Initialize browser first (takes longest)
    await SingletonBrowser.initialize();
    
    // Initialize Redis
    await SingletonRedis.getClient();
    
    console.log('✅ SINGLETONS: All managers initialized');
  } catch (error: any) {
    console.error('❌ SINGLETONS: Initialization failed:', error.message);
    console.log('⚠️ SINGLETONS: App will continue but some features may not work');
  }
}

/**
 * 🧹 Cleanup on shutdown
 */
export async function cleanupSingletons(): Promise<void> {
  console.log('🧹 SINGLETONS: Cleaning up...');
  
  await Promise.all([
    SingletonBrowser.cleanup(),
    SingletonRedis.disconnect()
  ]);
  
  console.log('✅ SINGLETONS: Cleanup complete');
}

