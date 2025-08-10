import { AutonomousPostingEngine } from './autonomousPostingEngine';
import { DatabaseManager } from '../lib/db';
import express from 'express';

export class AutonomousController {
  private static instance: AutonomousController;
  private postingEngine: AutonomousPostingEngine;
  private databaseManager: DatabaseManager;
  private expressApp: express.Application;
  private isInitialized = false;

  private constructor() {
    this.postingEngine = AutonomousPostingEngine.getInstance();
    this.databaseManager = DatabaseManager.getInstance();
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
      
      // Initialize components
      await this.databaseManager.initialize();
      await this.postingEngine.initialize();
      
      // Setup health server
      this.setupHealthServer();
      
      this.isInitialized = true;
      console.log('✅ === AUTONOMOUS TWITTER BOT READY ===');
      
    } catch (error: any) {
      console.error('💥 Autonomous Controller initialization failed:', error.message);
      throw error;
    }
  }

  private setupHealthServer(): void {
    const app = this.expressApp;
    
    // Health endpoint for Railway
    app.get('/health', async (req, res) => {
      try {
        const memory = process.memoryUsage();
        const memoryMB = Math.round(memory.heapUsed / 1024 / 1024);
        
        const dbHealth = await this.databaseManager.checkHealth();
        const postingStatus = this.postingEngine.getStatus();
        const connectionStatus = this.databaseManager.getConnectionStatus();
        
        const response = {
          status: 'healthy',
          mode: 'autonomous-twitter-bot',
          memory: `${memoryMB}MB`,
          uptime: Math.round(process.uptime()),
          timestamp: new Date().toISOString(),
          services: {
            posting_engine: postingStatus.isRunning,
            database: dbHealth.overall,
            supabase: connectionStatus.supabase,
            redis: connectionStatus.redis
          },
          message: 'Autonomous Twitter Bot operational'
        };
        
        console.log(`✅ Health check: ${memoryMB}MB memory, DB: ${dbHealth.overall ? 'OK' : 'FAIL'}`);
        
        res.json(response);
      } catch (error: any) {
        console.error('❌ Health check failed:', error.message);
        res.status(500).json({
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date().toISOString()
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

    // Start server
    const port = parseInt(process.env.PORT || '3000', 10);
    app.listen(port, '0.0.0.0', () => {
      console.log(`🌐 Autonomous Bot Server running on 0.0.0.0:${port}`);
      console.log(`🌐 Health endpoint: http://0.0.0.0:${port}/health`);
    });
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