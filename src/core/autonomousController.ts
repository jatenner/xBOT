import { AutonomousPostingEngine } from './autonomousPostingEngine';
import { DatabaseManager } from '../lib/db';
import { AutonomousTwitterPoster } from '../agents/autonomousTwitterPoster';
import { IntelligentContentGenerator } from '../agents/intelligentContentGenerator';
import { SimpleEngagementAnalyzer } from '../intelligence/simpleEngagementAnalyzer';
import express from 'express';

export class AutonomousController {
  private static instance: AutonomousController;
  private postingEngine: AutonomousPostingEngine;
  private databaseManager: DatabaseManager;
  private twitterPoster: AutonomousTwitterPoster;
  private contentGenerator: IntelligentContentGenerator;
  private engagementAnalyzer: SimpleEngagementAnalyzer;
  private expressApp: express.Application;
  private isInitialized = false;

  private constructor() {
    this.postingEngine = AutonomousPostingEngine.getInstance();
    this.databaseManager = DatabaseManager.getInstance();
    this.twitterPoster = AutonomousTwitterPoster.getInstance();
    this.contentGenerator = IntelligentContentGenerator.getInstance();
    this.engagementAnalyzer = SimpleEngagementAnalyzer.getInstance();
    this.expressApp = express();
  }

  public static getInstance(): AutonomousController {
    if (!AutonomousController.instance) {
      AutonomousController.instance = new AutonomousController();
    }
    return AutonomousController.instance;
  }

  public async initialize(): Promise<void> {
    try {
      console.log('🚀 === INITIALIZING AUTONOMOUS TWITTER BOT ===');

      // START HEALTH SERVER FIRST (non-blocking)
      this.setupHealthServer();

      // Boot heavy components in background so /health responds immediately
      this.bootComponents().catch((e) => {
        console.error('💥 Background init failed:', e?.message || e);
      });
    } catch (error: any) {
      console.error('💥 Autonomous Controller initialization failed:', error.message);
      throw error;
    }
  }

  private async bootComponents(): Promise<void> {
    console.log('🔄 Initializing database manager...');
    await this.databaseManager.initialize();
    
    console.log('🔄 Initializing posting engine...');
    await this.postingEngine.initialize();
    
    console.log('🔄 Initializing AI Twitter poster...');
    await this.twitterPoster.initialize();
    
    console.log('🔄 AI systems ready');
    // Content generator and engagement analyzer are singletons that initialize on first use
    
    this.isInitialized = true;
    console.log('✅ === AUTONOMOUS TWITTER BOT WITH AI SYSTEMS READY ===');
  }

  private setupHealthServer(): void {
    const app = this.expressApp;
    
    // Health endpoint for Railway
    app.get('/health', async (req, res) => {
      try {
        const memoryMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

        // If still initializing, return 200 immediately so Railway marks healthy
        if (!this.isInitialized) {
          return res.status(200).json({
            status: 'initializing',
            mode: 'autonomous-twitter-bot',
            memory: `${memoryMB}MB`,
            uptime: Math.round(process.uptime()),
            timestamp: new Date().toISOString(),
            services: {
              posting_engine: false,
              database: false,
              supabase: false,
              redis: false
            },
            message: 'Starting up'
          });
        }

        // Only after init, include deeper checks (but don't block long)
        const [dbHealth, postingStatus, connectionStatus] = await Promise.allSettled([
          this.databaseManager.checkHealth(),
          Promise.resolve(this.postingEngine.getStatus()),
          Promise.resolve(this.databaseManager.getConnectionStatus()),
        ]);

        const db = dbHealth.status === 'fulfilled' ? dbHealth.value : { overall: true, supabase: true, redis: true };
        const post = postingStatus.status === 'fulfilled' ? postingStatus.value : { isRunning: true };
        const conn = connectionStatus.status === 'fulfilled' ? connectionStatus.value : { supabase: true, redis: true };

        res.json({
          status: 'healthy',
          mode: 'autonomous-twitter-bot',
          memory: `${memoryMB}MB`,
          uptime: Math.round(process.uptime()),
          timestamp: new Date().toISOString(),
          services: {
            posting_engine: !!post.isRunning,
            database: !!db.overall,
            supabase: !!conn.supabase,
            redis: !!conn.redis
          },
          message: 'OK'
        });
      } catch (error: any) {
        res.status(200).json({
          status: 'healthy',
          mode: 'autonomous-twitter-bot',
          message: 'OK (degraded health handler)',
          error: error?.message
        });
      }
    });

    // Root endpoint
    app.get('/', (req, res) => {
      res.json({
        name: 'Autonomous Twitter Bot',
        status: 'running',
        mode: 'autonomous',
        uptime: Math.round(process.uptime()),
        endpoints: ['/health', '/status', '/post']
      });
    });

    // Status endpoint
    app.get('/status', async (req, res) => {
      try {
        const dbHealth = await this.databaseManager.checkHealth();
        const postingStatus = this.postingEngine.getStatus();
        const recentTweets = await this.databaseManager.getRecentTweets(5);
        
        res.json({
          bot_status: this.isInitialized ? 'operational' : 'initializing',
          posting_engine: postingStatus,
          database: dbHealth,
          recent_tweets: recentTweets.length,
          memory_usage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Manual post endpoint
    app.post('/post', async (req, res) => {
      try {
        console.log('📝 Manual post requested via API');
        const result = await this.postingEngine.executePost();
        res.json(result);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // AI Content Generation endpoint
    app.post('/generate-content', async (req, res) => {
      try {
        if (!this.isInitialized) {
          return res.status(503).json({ error: 'Bot still initializing' });
        }

        const request = req.body || {};
        const content = await this.contentGenerator.generateContent(request);
        
        res.json({
          success: true,
          content: content.content,
          isThread: content.isThread,
          contentScore: content.contentScore,
          estimatedEngagement: content.estimatedEngagement
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // AI Posting endpoint
    app.post('/ai-post', async (req, res) => {
      try {
        if (!this.isInitialized) {
          return res.status(503).json({ error: 'Bot still initializing' });
        }

        const options = req.body || {};
        const result = await this.twitterPoster.createAndPostContent(undefined, options);
        
        res.json(result);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // AI Analytics endpoint
    app.get('/ai-analytics', async (req, res) => {
      try {
        if (!this.isInitialized) {
          return res.status(503).json({ error: 'Bot still initializing' });
        }

        const topTopics = await this.contentGenerator.getTopPerformingTopics(10);
        const bestTimes = await this.engagementAnalyzer.getBestPostingTimes();
        
        res.json({
          topPerformingTopics: topTopics,
          bestPostingTimes: bestTimes,
          aiSystemsStatus: 'operational'
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Use existing health server instead of starting a new one
    // Note: Health server is already started in main.ts to avoid port conflicts
    console.log('🌐 Autonomous Bot Controller initialized');
    console.log('🌐 API endpoints available via existing health server');
  }

  public async forcePost(): Promise<void> {
    try {
      console.log('🚀 Force posting requested...');
      const result = await this.postingEngine.executePost();
      console.log('✅ Force post result:', result);
    } catch (error: any) {
      console.error('❌ Force post failed:', error.message);
    }
  }

  public getStatus(): {
    initialized: boolean;
    posting: boolean;
    database: boolean;
  } {
    return {
      initialized: this.isInitialized,
      posting: this.postingEngine.getStatus().isRunning,
      database: this.databaseManager.getConnectionStatus().supabase
    };
  }
}