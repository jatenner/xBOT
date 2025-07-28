/**
 * 🎯 ANALYTICS SERVER
 * 
 * Real-time analytics server for the Twitter bot dashboard.
 * Integrates with Supabase for live data and provides WebSocket updates.
 */

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import * as path from 'path';
import { minimalSupabaseClient } from '../utils/minimalSupabaseClient';
import { optimizedStrategy } from '../strategy/tweetingStrategy';

interface DashboardMetrics {
  dailyPosts: number;
  totalEngagement: number;
  followersGrowth: number;
  replySuccess: number;
  strategyScore: number;
  apiUsed: number;
  dailyPostsChange: string;
  engagementRate: number;
  replyRate: number;
  quotaReset: string;
}

interface ChartData {
  engagement: {
    labels: string[];
    data: number[];
  };
  categories: {
    data: number[];
  };
  timePerformance: {
    data: number[];
  };
}

export class AnalyticsServer {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;
  private port: number;
  private isRunning = false;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(port: number = 3002) {
    this.port = port;
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '../dashboard')));
  }

  private setupRoutes(): void {
    // Serve the analytics dashboard
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'analyticsRealtime.html'));
    });

    // API endpoint for metrics
    this.app.get('/api/metrics', async (req, res) => {
      try {
        const metrics = await this.collectMetrics();
        const chartData = await this.generateChartData();
        
        res.json({
          success: true,
          metrics,
          chartData,
          strategy: optimizedStrategy,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('❌ Error collecting metrics:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to collect metrics'
        });
      }
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log('📊 Dashboard client connected:', socket.id);

      // Send initial data
      this.sendAnalyticsUpdate(socket);

      // Handle analytics requests
      socket.on('request_analytics', () => {
        this.sendAnalyticsUpdate(socket);
      });

      socket.on('disconnect', () => {
        console.log('📊 Dashboard client disconnected:', socket.id);
      });
    });
  }

  private async sendAnalyticsUpdate(socket?: any): Promise<void> {
    try {
      const metrics = await this.collectMetrics();
      const chartData = await this.generateChartData();
      
      const updateData = {
        metrics,
        chartData,
        timestamp: new Date().toISOString()
      };

      if (socket) {
        socket.emit('analytics_update', updateData);
      } else {
        this.io.emit('analytics_update', updateData);
      }

      // Send strategy update
      this.io.emit('strategy_update', {
        ...optimizedStrategy,
        confidence: {
          timeBlocks: 0.8,
          tones: 0.7,
          keywords: 0.9,
          nextAction: 0.6
        }
      });

    } catch (error) {
      console.error('❌ Error sending analytics update:', error);
    }
  }

  private async collectMetrics(): Promise<DashboardMetrics> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Get daily posts
      const { data: todayTweets } = await minimalSupabaseClient.supabase
        .from('tweets')
        .select('*')
        .gte('created_at', today)
        .order('created_at', { ascending: false });

      const { data: yesterdayTweets } = await minimalSupabaseClient.supabase
        .from('tweets')
        .select('*')
        .gte('created_at', yesterday)
        .lt('created_at', today);

      // Get engagement metrics
      const { data: engagementData } = await minimalSupabaseClient.supabase
        .from('tweets')
        .select('likes, retweets, replies, impressions')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      // Get reply success metrics
      const { data: replyData } = await minimalSupabaseClient.supabase
        .from('replies')
        .select('*')
        .gte('created_at', today)
        .order('created_at', { ascending: false });

      // Get API usage
      const { data: apiUsage } = await minimalSupabaseClient.supabase
        .from('api_usage_tracking')
        .select('*')
        .eq('date', today)
        .eq('api_type', 'twitter');

      // Calculate metrics
      const dailyPosts = todayTweets?.length || 0;
      const yesterdayPosts = yesterdayTweets?.length || 0;
      
      const totalEngagement = engagementData?.reduce((sum, tweet) => 
        sum + (tweet.likes || 0) + (tweet.retweets || 0) + (tweet.replies || 0), 0) || 0;
      
      const avgEngagement = engagementData?.length ? 
        totalEngagement / engagementData.length : 0;
      
      const engagementRate = Math.round(avgEngagement * 100) / 100;
      
      const replySuccess = replyData?.length || 0;
      const replyRate = Math.round((replySuccess / Math.max(1, dailyPosts)) * 100);
      
      const apiUsed = apiUsage?.[0]?.count || 0;
      
      // Calculate strategy score based on performance
      const strategyScore = Math.min(100, Math.round(
        (engagementRate * 30) + 
        (replyRate * 20) + 
        (dailyPosts * 5) + 
        (totalEngagement / 10)
      ));

      // Calculate time until quota reset (Twitter resets at midnight UTC)
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);
      const hoursUntilReset = Math.ceil((tomorrow.getTime() - now.getTime()) / (1000 * 60 * 60));

      return {
        dailyPosts,
        totalEngagement,
        followersGrowth: Math.max(0, dailyPosts * 2 + Math.floor(totalEngagement / 50)), // Estimated
        replySuccess,
        strategyScore,
        apiUsed,
        dailyPostsChange: `${dailyPosts >= yesterdayPosts ? '+' : ''}${dailyPosts - yesterdayPosts} from yesterday`,
        engagementRate,
        replyRate,
        quotaReset: `Resets in ${hoursUntilReset}h`
      };

    } catch (error) {
      console.error('❌ Error collecting metrics:', error);
      
      // Return default metrics on error
      return {
        dailyPosts: 0,
        totalEngagement: 0,
        followersGrowth: 0,
        replySuccess: 0,
        strategyScore: 0,
        apiUsed: 0,
        dailyPostsChange: '+0 from yesterday',
        engagementRate: 0,
        replyRate: 0,
        quotaReset: 'Unknown'
      };
    }
  }

  private async generateChartData(): Promise<ChartData> {
    try {
      // Engagement over time (last 7 days)
      const last7Days = [];
      const engagementData = [];
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        last7Days.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
        
        const { data: dayTweets } = await minimalSupabaseClient.supabase
          .from('tweets')
          .select('likes, retweets, replies')
          .gte('created_at', dateStr)
          .lt('created_at', new Date(date.getTime() + 24 * 60 * 60 * 1000).toISOString());
        
        const dayEngagement = dayTweets?.reduce((sum, tweet) => 
          sum + (tweet.likes || 0) + (tweet.retweets || 0) + (tweet.replies || 0), 0) || 0;
        
        engagementData.push(dayEngagement);
      }

      // Performance by category
      const { data: categoryData } = await minimalSupabaseClient.supabase
        .from('tweets')
        .select('content_category, likes, retweets, replies')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      const categoryPerformance = {
        'health_tech': 0,
        'ai_ml': 0,
        'wellness': 0,
        'medical': 0,
        'general': 0
      };

      categoryData?.forEach(tweet => {
        const category = tweet.content_category || 'general';
        const engagement = (tweet.likes || 0) + (tweet.retweets || 0) + (tweet.replies || 0);
        if (categoryPerformance[category] !== undefined) {
          categoryPerformance[category] += engagement;
        } else {
          categoryPerformance.general += engagement;
        }
      });

      // Time performance (6AM to 9PM in 3-hour blocks)
      const timeBlocks = ['6AM', '9AM', '12PM', '3PM', '6PM', '9PM'];
      const timePerformance = [];

      for (let i = 0; i < 6; i++) {
        const hour = 6 + (i * 3);
        
        const { data: hourTweets } = await minimalSupabaseClient.supabase
          .from('tweets')
          .select('likes, retweets, replies, created_at')
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
        
        const hourEngagement = hourTweets?.filter(tweet => {
          const tweetHour = new Date(tweet.created_at).getUTCHours();
          return tweetHour >= hour && tweetHour < hour + 3;
        }).reduce((sum, tweet) => 
          sum + (tweet.likes || 0) + (tweet.retweets || 0) + (tweet.replies || 0), 0) || 0;
        
        timePerformance.push(Math.round(hourEngagement / 30)); // Average per day
      }

      return {
        engagement: {
          labels: last7Days,
          data: engagementData
        },
        categories: {
          data: Object.values(categoryPerformance)
        },
        timePerformance: {
          data: timePerformance
        }
      };

    } catch (error) {
      console.error('❌ Error generating chart data:', error);
      
      // Return empty chart data on error
      return {
        engagement: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          data: [0, 0, 0, 0, 0, 0, 0]
        },
        categories: {
          data: [0, 0, 0, 0, 0]
        },
        timePerformance: {
          data: [0, 0, 0, 0, 0, 0]
        }
      };
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Analytics server already running');
      return;
    }

    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        this.isRunning = true;
        console.log(`📊 Analytics Server running on http://localhost:${this.port}`);
        console.log(`📊 Dashboard URL: http://localhost:${this.port}`);
        
        // Start periodic updates
        this.updateInterval = setInterval(() => {
          this.sendAnalyticsUpdate();
        }, 10000); // Update every 10 seconds
        
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    return new Promise((resolve) => {
      this.server.close(() => {
        this.isRunning = false;
        console.log('📊 Analytics server stopped');
        resolve();
      });
    });
  }

  public sendActivityLog(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    this.io.emit('activity_log', {
      message,
      type,
      timestamp: new Date().toISOString()
    });
  }
}

// Create singleton instance
export const analyticsServer = new AnalyticsServer();

// Export for manual testing
export default AnalyticsServer; 