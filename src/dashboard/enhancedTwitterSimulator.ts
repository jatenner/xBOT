import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import path from 'path';
import { UltraViralGenerator } from '../agents/ultraViralGenerator';
import { APIOptimizer } from '../utils/apiOptimizer';
import { SuperStrategist } from '../agents/superStrategist';
import { supabase } from '../utils/supabaseClient';
import { PostTweetAgent } from '../agents/postTweet';

interface SimulatedUser {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  followers: number;
  verified: boolean;
  bio: string;
}

interface SimulatedTweet {
  id: string;
  content: string;
  author: SimulatedUser;
  timestamp: Date;
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  engagementRate: number;
  viralScore: number;
  template: string;
  hashtags: string[];
  mentions: string[];
  media?: {
    type: 'image' | 'video' | 'gif';
    url: string;
    alt?: string;
  }[];
  replies_to?: string;
  quoted_tweet?: SimulatedTweet;
  isViral: boolean;
  performanceMetrics: {
    hourlyViews: number[];
    peakEngagement: number;
    viralCoefficient: number;
    reachMultiplier: number;
  };
}

interface TrendingTopic {
  hashtag: string;
  volume: number;
  category: string;
  trend_direction: 'up' | 'down' | 'stable';
  related_tweets: number;
}

interface SimulationState {
  isRunning: boolean;
  currentFollowers: number;
  totalTweets: number;
  totalImpressions: number;
  totalEngagement: number;
  viralBreakthroughs: number;
  averageViralScore: number;
  bestPerformingTweet: SimulatedTweet | null;
  currentStreakDays: number;
  projectedGrowthRate: number;
}

export class EnhancedTwitterSimulator {
  private app: express.Application;
  private server: http.Server;
  private wss: WebSocketServer;
  private viralGenerator: UltraViralGenerator;
  private apiOptimizer: APIOptimizer;
  private superStrategist: SuperStrategist;
  private postTweetAgent: PostTweetAgent;
  
  private simulatedTweets: SimulatedTweet[] = [];
  private trendingTopics: TrendingTopic[] = [];
  private simulationState: SimulationState;
  private simulatedUsers: SimulatedUser[] = [];
  
  private isSimulating: boolean = false;
  private simulationInterval: NodeJS.Timeout | null = null;
  private trendingInterval: NodeJS.Timeout | null = null;
  private connectedClients: Set<WebSocket> = new Set();

  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });
    
    this.viralGenerator = new UltraViralGenerator();
    this.apiOptimizer = new APIOptimizer(supabase!);
    this.superStrategist = new SuperStrategist();
    this.postTweetAgent = new PostTweetAgent();
    
    this.simulationState = {
      isRunning: false,
      currentFollowers: 127, // Starting followers
      totalTweets: 0,
      totalImpressions: 0,
      totalEngagement: 0,
      viralBreakthroughs: 0,
      averageViralScore: 0,
      bestPerformingTweet: null,
      currentStreakDays: 0,
      projectedGrowthRate: 0
    };

    this.initializeSimulatedUsers();
    this.initializeTrendingTopics();
    this.setupRoutes();
    this.setupWebSocket();
  }

  private initializeSimulatedUsers(): void {
    this.simulatedUsers = [
      {
        id: 'bot_account',
        username: 'Snap2HealthBot',
        displayName: '🩺 Snap2Health',
        avatar: '/images/bot-avatar.png',
        followers: 127,
        verified: false,
        bio: '🚀 Revolutionizing healthcare through AI & technology. Daily insights on medical breakthroughs, health tech innovations, and digital health trends.'
      },
      {
        id: 'health_expert_1',
        username: 'DrTechMD',
        displayName: 'Dr. Sarah Chen, MD',
        avatar: '/images/expert1.png',
        followers: 45200,
        verified: true,
        bio: 'Emergency Medicine | Digital Health Innovation | AI in Healthcare'
      },
      {
        id: 'researcher_1',
        username: 'BioAIResearch',
        displayName: 'AI Research Lab',
        avatar: '/images/lab.png',
        followers: 28900,
        verified: true,
        bio: 'Advancing biomedical AI research. MIT affiliated. Publishing breakthrough studies.'
      },
      {
        id: 'industry_leader',
        username: 'HealthTechCEO',
        displayName: 'Michael Johnson',
        avatar: '/images/ceo.png',
        followers: 89500,
        verified: true,
        bio: 'CEO @HealthTechInc | Building the future of personalized medicine'
      }
    ];
  }

  private initializeTrendingTopics(): void {
    this.trendingTopics = [
      { hashtag: '#AIHealthcare', volume: 15420, category: 'health_tech', trend_direction: 'up', related_tweets: 1240 },
      { hashtag: '#DigitalHealth', volume: 12800, category: 'health_tech', trend_direction: 'up', related_tweets: 980 },
      { hashtag: '#MedicalAI', volume: 9650, category: 'ai', trend_direction: 'stable', related_tweets: 756 },
      { hashtag: '#Telemedicine', volume: 8900, category: 'healthcare', trend_direction: 'up', related_tweets: 623 },
      { hashtag: '#HealthTech', volume: 21500, category: 'health_tech', trend_direction: 'up', related_tweets: 1580 },
      { hashtag: '#MedicalBreakthrough', volume: 6780, category: 'research', trend_direction: 'up', related_tweets: 445 },
      { hashtag: '#PersonalizedMedicine', volume: 5420, category: 'healthcare', trend_direction: 'stable', related_tweets: 312 },
      { hashtag: '#HealthcareInnovation', volume: 11200, category: 'innovation', trend_direction: 'up', related_tweets: 890 }
    ];
  }

  private setupRoutes(): void {
    this.app.use(express.static(path.join(__dirname, '../../public')));
    this.app.use(express.json());

    // Serve the enhanced simulation dashboard
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'enhancedSimulationDashboard.html'));
    });

    // Twitter-like API endpoints
    this.app.get('/api/twitter/timeline', (req, res) => {
      const recentTweets = this.simulatedTweets
        .slice(-50)
        .reverse()
        .map(tweet => this.formatTweetForAPI(tweet));
      res.json(recentTweets);
    });

    this.app.get('/api/twitter/trending', (req, res) => {
      res.json(this.trendingTopics);
    });

    this.app.get('/api/twitter/profile', (req, res) => {
      const botProfile = this.simulatedUsers.find(u => u.id === 'bot_account');
      if (botProfile) {
        botProfile.followers = this.simulationState.currentFollowers;
      }
      res.json(botProfile);
    });

    this.app.get('/api/twitter/analytics', (req, res) => {
      res.json(this.generateTwitterAnalytics());
    });

    // Simulation control endpoints
    this.app.post('/api/simulation/start', async (req, res) => {
      if (!this.isSimulating) {
        await this.startEnhancedSimulation();
        res.json({ success: true, message: 'Enhanced simulation started' });
      } else {
        res.json({ success: false, message: 'Simulation already running' });
      }
    });

    this.app.post('/api/simulation/stop', (req, res) => {
      this.stopSimulation();
      res.json({ success: true, message: 'Simulation stopped' });
    });

    this.app.post('/api/simulation/tweet', async (req, res) => {
      const { content, topic } = req.body;
      try {
        let tweetResult;
        if (content) {
          // Simulate posting custom content
          tweetResult = await this.simulateCustomTweet(content);
        } else {
          // Generate viral content
          const viralTweet = await this.viralGenerator.generateViralTweet(topic || 'health technology breakthrough');
          tweetResult = await this.simulateGeneratedTweet(viralTweet);
        }
        
        this.broadcastToClients({
          type: 'new_tweet',
          data: tweetResult
        });
        
        res.json({ success: true, tweet: tweetResult });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/simulation/status', (req, res) => {
      res.json({
        simulation: this.simulationState,
        timeline: this.simulatedTweets.slice(-10).reverse(),
        trending: this.trendingTopics.slice(0, 8),
        profile: this.simulatedUsers.find(u => u.id === 'bot_account')
      });
    });
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('🔌 Enhanced simulation client connected');
      this.connectedClients.add(ws);
      
      // Send current state
      ws.send(JSON.stringify({
        type: 'initial_state',
        data: {
          simulation: this.simulationState,
          timeline: this.simulatedTweets.slice(-20).reverse(),
          trending: this.trendingTopics,
          profile: this.simulatedUsers.find(u => u.id === 'bot_account')
        }
      }));

      ws.on('message', async (message: string) => {
        try {
          const data = JSON.parse(message);
          await this.handleWebSocketMessage(ws, data);
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });

      ws.on('close', () => {
        console.log('🔌 Enhanced simulation client disconnected');
        this.connectedClients.delete(ws);
      });
    });
  }

  private async handleWebSocketMessage(ws: WebSocket, data: any): Promise<void> {
    switch (data.type) {
      case 'test_viral_content':
        const viralTweet = await this.viralGenerator.generateViralTweet(data.topic);
        const simulatedResult = await this.simulateGeneratedTweet(viralTweet);
        ws.send(JSON.stringify({
          type: 'viral_test_result',
          data: simulatedResult
        }));
        break;

      case 'strategic_decision':
        const decision = await this.superStrategist.makeGodTierDecision();
        ws.send(JSON.stringify({
          type: 'strategy_update',
          data: decision
        }));
        break;

      case 'request_analytics':
        const analytics = this.generateTwitterAnalytics();
        ws.send(JSON.stringify({
          type: 'analytics_update',
          data: analytics
        }));
        break;
    }
  }

  private async startEnhancedSimulation(): Promise<void> {
    console.log('🚀 Starting Enhanced Twitter Simulation...');
    this.isSimulating = true;
    this.simulationState.isRunning = true;

    // Initialize systems
    await this.apiOptimizer.loadUsage();

    // Start main simulation loop (every 3 minutes for more realistic flow)
    this.simulationInterval = setInterval(async () => {
      try {
        await this.runEnhancedSimulationCycle();
      } catch (error) {
        console.error('Enhanced simulation cycle error:', error);
      }
    }, 3 * 60 * 1000);

    // Start trending topics update (every 10 minutes)
    this.trendingInterval = setInterval(() => {
      this.updateTrendingTopics();
    }, 10 * 60 * 1000);

    // Run initial cycle
    await this.runEnhancedSimulationCycle();

    this.broadcastToClients({
      type: 'simulation_started',
      data: {
        message: '🚀 Enhanced Twitter simulation started!',
        state: this.simulationState
      }
    });
  }

  private stopSimulation(): void {
    console.log('🛑 Stopping Enhanced Twitter Simulation...');
    this.isSimulating = false;
    this.simulationState.isRunning = false;
    
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }

    if (this.trendingInterval) {
      clearInterval(this.trendingInterval);
      this.trendingInterval = null;
    }

    this.broadcastToClients({
      type: 'simulation_stopped',
      data: { 
        message: '🛑 Simulation stopped',
        state: this.simulationState
      }
    });
  }

  private async runEnhancedSimulationCycle(): Promise<void> {
    console.log('🔄 Running enhanced simulation cycle...');

    // 1. Strategic decision making
    const decision = await this.superStrategist.makeGodTierDecision();
    
    if (decision.action === 'post') {
      // 2. Generate and post viral content
      const viralTweet = await this.viralGenerator.generateViralTweet();
      const simulatedTweet = await this.simulateGeneratedTweet(viralTweet);
      
      // 3. Update simulation state
      this.updateSimulationState(simulatedTweet);
      
      // 4. Simulate community engagement
      await this.simulateCommunityResponse(simulatedTweet);
      
      console.log(`🎯 Posted tweet: ${simulatedTweet.viralScore}/100 viral score, ${simulatedTweet.engagementRate.toFixed(2)}% engagement`);
    } else {
      console.log(`😴 Strategic decision: ${decision.reasoning}`);
    }

    // 5. Broadcast updates
    this.broadcastStateUpdate();
  }

  private async simulateGeneratedTweet(viralTweet: any): Promise<SimulatedTweet> {
    const botUser = this.simulatedUsers.find(u => u.id === 'bot_account')!;
    
    // Calculate realistic engagement based on viral score and timing
    const baseEngagement = this.calculateBaseEngagement(viralTweet.viralScore);
    const timeMultiplier = this.getTimeEngagementMultiplier();
    const followerMultiplier = Math.min(this.simulationState.currentFollowers / 100, 5);
    
    const totalEngagement = Math.floor(baseEngagement * timeMultiplier * followerMultiplier);
    
    const simulatedTweet: SimulatedTweet = {
      id: `tweet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: viralTweet.content,
      author: { ...botUser, followers: this.simulationState.currentFollowers },
      timestamp: new Date(),
      likes: Math.floor(totalEngagement * 0.65),
      retweets: Math.floor(totalEngagement * 0.20),
      replies: Math.floor(totalEngagement * 0.15),
      impressions: Math.floor(totalEngagement * 20),
      engagementRate: Math.min((totalEngagement / (totalEngagement * 20)) * 100, 15),
      viralScore: viralTweet.viralScore,
      template: viralTweet.template || 'MIND_BLOWN',
      hashtags: this.extractHashtags(viralTweet.content),
      mentions: this.extractMentions(viralTweet.content),
      replies_to: undefined,
      quoted_tweet: undefined,
      isViral: viralTweet.viralScore > 85,
      performanceMetrics: {
        hourlyViews: this.generateHourlyViews(viralTweet.viralScore),
        peakEngagement: totalEngagement * (1.5 + Math.random()),
        viralCoefficient: viralTweet.viralScore / 50,
        reachMultiplier: timeMultiplier
      }
    };

    this.simulatedTweets.push(simulatedTweet);
    return simulatedTweet;
  }

  private async simulateCustomTweet(content: string): Promise<SimulatedTweet> {
    // Simulate viral scoring for custom content
    const viralScore = Math.floor(Math.random() * 40) + 60; // 60-100 range
    
    return this.simulateGeneratedTweet({
      content,
      viralScore,
      template: 'CUSTOM'
    });
  }

  private calculateBaseEngagement(viralScore: number): number {
    return Math.floor(viralScore * 8 + Math.random() * 200);
  }

  private getTimeEngagementMultiplier(): number {
    const hour = new Date().getHours();
    const day = new Date().getDay();
    
    // Viral windows from SuperStrategist
    if (day === 1 && hour === 9) return 3.2;
    if (day === 2 && hour === 13) return 3.5;
    if (day === 3 && hour === 9) return 3.1;
    if (day === 4 && hour === 19) return 2.8;
    if (day === 5 && hour === 10) return 2.5;
    
    // General high-engagement times
    if (day >= 1 && day <= 5) {
      if (hour >= 8 && hour <= 10) return 1.8;
      if (hour >= 12 && hour <= 14) return 2.0;
      if (hour >= 18 && hour <= 20) return 1.6;
    }
    
    return 1.0;
  }

  private generateHourlyViews(viralScore: number): number[] {
    const hours = [];
    let views = viralScore * 50;
    
    for (let i = 0; i < 24; i++) {
      if (i < 6) {
        views *= 1.2 + (Math.random() * 0.4); // Viral growth
      } else if (i < 12) {
        views *= 1.1 + (Math.random() * 0.3); // Sustained growth  
      } else {
        views *= 0.9 + (Math.random() * 0.2); // Natural decline
      }
      hours.push(Math.floor(views));
    }
    
    return hours;
  }

  private extractHashtags(content: string): string[] {
    const hashtags = content.match(/#\w+/g) || [];
    return hashtags.map(tag => tag.toLowerCase());
  }

  private extractMentions(content: string): string[] {
    const mentions = content.match(/@\w+/g) || [];
    return mentions.map(mention => mention.toLowerCase());
  }

  private updateSimulationState(tweet: SimulatedTweet): void {
    this.simulationState.totalTweets++;
    this.simulationState.totalImpressions += tweet.impressions;
    this.simulationState.totalEngagement += (tweet.likes + tweet.retweets + tweet.replies);
    
    if (tweet.viralScore > 85) {
      this.simulationState.viralBreakthroughs++;
      this.simulationState.currentStreakDays++;
    }
    
    // Calculate average viral score
    const allScores = this.simulatedTweets.map(t => t.viralScore);
    this.simulationState.averageViralScore = allScores.reduce((a, b) => a + b, 0) / allScores.length;
    
    // Update best performing tweet
    if (!this.simulationState.bestPerformingTweet || 
        tweet.viralScore > this.simulationState.bestPerformingTweet.viralScore) {
      this.simulationState.bestPerformingTweet = tweet;
    }
    
    // Simulate follower growth based on viral performance
    const followerGrowth = Math.floor(tweet.viralScore / 10 + Math.random() * 5);
    this.simulationState.currentFollowers += followerGrowth;
    
    // Update bot user follower count
    const botUser = this.simulatedUsers.find(u => u.id === 'bot_account');
    if (botUser) {
      botUser.followers = this.simulationState.currentFollowers;
    }
    
    // Calculate projected growth rate
    this.simulationState.projectedGrowthRate = this.calculateGrowthProjection();
  }

  private calculateGrowthProjection(): number {
    if (this.simulatedTweets.length < 5) return 0;
    
    const recentTweets = this.simulatedTweets.slice(-10);
    const avgViralScore = recentTweets.reduce((sum, t) => sum + t.viralScore, 0) / recentTweets.length;
    const avgEngagement = recentTweets.reduce((sum, t) => sum + t.engagementRate, 0) / recentTweets.length;
    
    // Project daily growth based on performance
    return Math.floor((avgViralScore * avgEngagement / 100) * 2);
  }

  private async simulateCommunityResponse(tweet: SimulatedTweet): Promise<void> {
    // Simulate replies from other users
    if (tweet.viralScore > 75) {
      const replyCount = Math.floor(Math.random() * 3) + 1;
      
      for (let i = 0; i < replyCount; i++) {
        setTimeout(() => {
          const randomUser = this.simulatedUsers[Math.floor(Math.random() * this.simulatedUsers.length)];
          const reply = this.generateReply(tweet, randomUser);
          
          this.broadcastToClients({
            type: 'community_reply',
            data: reply
          });
        }, Math.random() * 30000); // Random delay up to 30 seconds
      }
    }
  }

  private generateReply(originalTweet: SimulatedTweet, user: SimulatedUser): SimulatedTweet {
    const replyContents = [
      "This is groundbreaking! Thanks for sharing 🙌",
      "Incredible research. The future of healthcare is here!",
      "Amazing work! When will this be widely available?",
      "This could revolutionize patient care. Excited to see more!",
      "Fascinating study. Would love to see more data on this.",
      "Game-changing technology! 🚀",
      "This gives me so much hope for the future of medicine.",
      "Brilliant insights as always! Keep up the great work."
    ];
    
    const replyContent = replyContents[Math.floor(Math.random() * replyContents.length)];
    
    return {
      id: `reply_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: `@${originalTweet.author.username} ${replyContent}`,
      author: user,
      timestamp: new Date(),
      likes: Math.floor(Math.random() * 20) + 1,
      retweets: Math.floor(Math.random() * 5),
      replies: 0,
      impressions: Math.floor(Math.random() * 500) + 100,
      engagementRate: Math.random() * 8 + 2,
      viralScore: Math.floor(Math.random() * 30) + 40,
      template: 'REPLY',
      hashtags: [],
      mentions: [`@${originalTweet.author.username}`],
      replies_to: originalTweet.id,
      isViral: false,
      performanceMetrics: {
        hourlyViews: [],
        peakEngagement: 0,
        viralCoefficient: 0,
        reachMultiplier: 1
      }
    };
  }

  private updateTrendingTopics(): void {
    // Simulate trending topic updates
    this.trendingTopics.forEach(topic => {
      const change = (Math.random() - 0.5) * 0.2; // ±20% change
      topic.volume = Math.floor(topic.volume * (1 + change));
      topic.related_tweets = Math.floor(topic.related_tweets * (1 + change));
      
      // Update trend direction
      if (change > 0.05) topic.trend_direction = 'up';
      else if (change < -0.05) topic.trend_direction = 'down';
      else topic.trend_direction = 'stable';
    });

    // Occasionally add new trending topics
    if (Math.random() < 0.3) {
      const newTopics = [
        '#VirtualReality', '#BioTech', '#HealthcareAI', '#MedicalRobotics',
        '#PrecisionMedicine', '#DigitalTherapeutics', '#HealthData', '#MedicalDevice'
      ];
      
      const newTopic = newTopics[Math.floor(Math.random() * newTopics.length)];
      if (!this.trendingTopics.find(t => t.hashtag === newTopic)) {
        this.trendingTopics.push({
          hashtag: newTopic,
          volume: Math.floor(Math.random() * 5000) + 1000,
          category: 'health_tech',
          trend_direction: 'up',
          related_tweets: Math.floor(Math.random() * 300) + 50
        });
      }
    }

    // Keep only top 10 trending
    this.trendingTopics.sort((a, b) => b.volume - a.volume);
    this.trendingTopics = this.trendingTopics.slice(0, 10);

    this.broadcastToClients({
      type: 'trending_update',
      data: this.trendingTopics
    });
  }

  private formatTweetForAPI(tweet: SimulatedTweet): any {
    return {
      id: tweet.id,
      text: tweet.content,
      author: tweet.author,
      created_at: tweet.timestamp.toISOString(),
      public_metrics: {
        like_count: tweet.likes,
        retweet_count: tweet.retweets,
        reply_count: tweet.replies,
        impression_count: tweet.impressions
      },
      entities: {
        hashtags: tweet.hashtags.map(tag => ({ tag: tag.replace('#', '') })),
        mentions: tweet.mentions.map(mention => ({ username: mention.replace('@', '') }))
      },
      viral_metrics: {
        viral_score: tweet.viralScore,
        engagement_rate: tweet.engagementRate,
        is_viral: tweet.isViral,
        template: tweet.template
      },
      performance: tweet.performanceMetrics
    };
  }

  private generateTwitterAnalytics(): any {
    const last24h = this.simulatedTweets.filter(t => 
      new Date().getTime() - t.timestamp.getTime() < 24 * 60 * 60 * 1000
    );

    const last7d = this.simulatedTweets.filter(t => 
      new Date().getTime() - t.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000
    );

    return {
      overview: {
        total_tweets: this.simulationState.totalTweets,
        total_followers: this.simulationState.currentFollowers,
        total_impressions: this.simulationState.totalImpressions,
        total_engagement: this.simulationState.totalEngagement,
        avg_viral_score: Math.round(this.simulationState.averageViralScore),
        viral_breakthroughs: this.simulationState.viralBreakthroughs,
        current_streak: this.simulationState.currentStreakDays
      },
      performance_24h: {
        tweets: last24h.length,
        avg_viral_score: last24h.reduce((sum, t) => sum + t.viralScore, 0) / (last24h.length || 1),
        total_engagement: last24h.reduce((sum, t) => sum + t.likes + t.retweets + t.replies, 0),
        total_impressions: last24h.reduce((sum, t) => sum + t.impressions, 0),
        viral_hits: last24h.filter(t => t.viralScore > 85).length
      },
      performance_7d: {
        tweets: last7d.length,
        avg_viral_score: last7d.reduce((sum, t) => sum + t.viralScore, 0) / (last7d.length || 1),
        total_engagement: last7d.reduce((sum, t) => sum + t.likes + t.retweets + t.replies, 0),
        follower_growth: this.calculateFollowerGrowth7d(),
        best_performing: this.getBestPerforming7d()
      },
      projections: {
        daily_reach_estimate: Math.floor(this.simulationState.averageViralScore * 200),
        monthly_follower_growth: Math.floor(this.simulationState.projectedGrowthRate * 30),
        viral_probability: Math.min(Math.round((this.simulationState.viralBreakthroughs / Math.max(this.simulationState.totalTweets, 1)) * 100), 95),
        july_1st_readiness: this.calculateJuly1stReadiness()
      },
      template_performance: this.getTemplatePerformance(),
      trending_alignment: this.getTrendingAlignment()
    };
  }

  private calculateFollowerGrowth7d(): number {
    // Simulate 7-day follower growth
    return Math.floor(this.simulationState.projectedGrowthRate * 7);
  }

  private getBestPerforming7d(): SimulatedTweet | null {
    const last7d = this.simulatedTweets.filter(t => 
      new Date().getTime() - t.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000
    );
    
    return last7d.reduce((best, current) => 
      (!best || current.viralScore > best.viralScore) ? current : best, null as SimulatedTweet | null);
  }

  private calculateJuly1stReadiness(): number {
    const factors = {
      avgViralScore: Math.min(this.simulationState.averageViralScore / 85, 1) * 25,
      viralBreakthroughRate: Math.min((this.simulationState.viralBreakthroughs / Math.max(this.simulationState.totalTweets, 1)) * 4, 1) * 25,
      followerGrowthRate: Math.min(this.simulationState.projectedGrowthRate / 20, 1) * 25,
      consistencyScore: Math.min(this.simulationState.currentStreakDays / 7, 1) * 25
    };
    
    return Math.round(Object.values(factors).reduce((sum, score) => sum + score, 0));
  }

  private getTemplatePerformance(): any {
    const templates = new Map<string, { count: number, avgScore: number, avgEngagement: number }>();
    
    this.simulatedTweets.forEach(tweet => {
      if (!templates.has(tweet.template)) {
        templates.set(tweet.template, { count: 0, avgScore: 0, avgEngagement: 0 });
      }
      const template = templates.get(tweet.template)!;
      template.count++;
      template.avgScore += tweet.viralScore;
      template.avgEngagement += tweet.engagementRate;
    });

    const result: any = {};
    templates.forEach((data, template) => {
      result[template] = {
        count: data.count,
        avg_viral_score: Math.round(data.avgScore / data.count),
        avg_engagement_rate: Math.round((data.avgEngagement / data.count) * 10) / 10,
        success_rate: Math.round((data.avgScore / data.count / 85) * 100)
      };
    });

    return result;
  }

  private getTrendingAlignment(): any {
    const alignedTweets = this.simulatedTweets.filter(tweet => 
      tweet.hashtags.some(hashtag => 
        this.trendingTopics.some(trend => trend.hashtag.toLowerCase() === hashtag)
      )
    );

    return {
      total_aligned: alignedTweets.length,
      alignment_rate: Math.round((alignedTweets.length / Math.max(this.simulatedTweets.length, 1)) * 100),
      trending_hashtags_used: Array.from(new Set(
        alignedTweets.flatMap(tweet => tweet.hashtags)
          .filter(hashtag => this.trendingTopics.some(trend => trend.hashtag.toLowerCase() === hashtag))
      )),
      viral_trending_tweets: alignedTweets.filter(tweet => tweet.viralScore > 85).length
    };
  }

  private broadcastToClients(message: any): void {
    const messageString = JSON.stringify(message);
    this.connectedClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageString);
      }
    });
  }

  private broadcastStateUpdate(): void {
    this.broadcastToClients({
      type: 'state_update',
      data: {
        simulation: this.simulationState,
        recent_tweets: this.simulatedTweets.slice(-5).reverse(),
        trending: this.trendingTopics.slice(0, 8),
        analytics: this.generateTwitterAnalytics()
      }
    });
  }

  public start(port: number = 3001): void {
    this.server.listen(port, () => {
      console.log(`🎯 Enhanced Twitter Simulation Dashboard running on http://localhost:${port}`);
      console.log(`🔥 Real-time transparent Twitter simulation active`);
      console.log(`📊 Complete ecosystem simulation with community engagement`);
      console.log(`🚀 Perfect for optimizing viral strategy before July 1st`);
    });
  }

  public stop(): void {
    this.stopSimulation();
    this.server.close();
    console.log('🛑 Enhanced Twitter Simulator stopped');
  }
} 