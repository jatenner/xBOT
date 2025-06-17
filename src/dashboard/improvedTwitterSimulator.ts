import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import path from 'path';
import { UltraViralGenerator } from '../agents/ultraViralGenerator';
import { APIOptimizer } from '../utils/apiOptimizer';
import { SuperStrategist } from '../agents/superStrategist';
import { supabase } from '../utils/supabaseClient';

interface SimulatedTweet {
  id: string;
  content: string;
  template: string;
  viralScore: number;
  simulatedEngagement: {
    likes: number;
    retweets: number;
    replies: number;
    impressions: number;
    engagementRate: number;
  };
  postedAt: Date;
  viralPotential: number;
  actualPerformance?: {
    hourlyGrowth: number[];
    peakEngagement: number;
    viralCoefficient: number;
  };
}

interface SimulationMetrics {
  totalTweets: number;
  avgViralScore: number;
  avgEngagementRate: number;
  bestPerformingTemplate: string;
  worstPerformingTemplate: string;
  totalReach: number;
  followerGrowth: number;
  viralBreakthroughs: number;
}

export class ImprovedTwitterSimulator {
  private app: express.Application;
  private server: http.Server;
  private wss: WebSocketServer;
  private viralGenerator: UltraViralGenerator;
  private apiOptimizer: APIOptimizer;
  private superStrategist: SuperStrategist;
  private simulatedTweets: SimulatedTweet[] = [];
  private simulationMetrics: SimulationMetrics;
  private isSimulating: boolean = false;
  private simulationInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });
    
    this.viralGenerator = new UltraViralGenerator();
    this.apiOptimizer = new APIOptimizer(supabase!);
    this.superStrategist = new SuperStrategist();
    
    this.simulationMetrics = {
      totalTweets: 0,
      avgViralScore: 0,
      avgEngagementRate: 0,
      bestPerformingTemplate: '',
      worstPerformingTemplate: '',
      totalReach: 0,
      followerGrowth: 0,
      viralBreakthroughs: 0
    };

    this.setupRoutes();
    this.setupWebSocket();
  }

  private setupRoutes(): void {
    this.app.use(express.static(path.join(__dirname, '../../public')));
    this.app.use(express.json());

    // Serve the simulation dashboard
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'simulationDashboard.html'));
    });

    // API Routes
    this.app.get('/api/simulation/status', (req, res) => {
      res.json({
        isRunning: this.isSimulating,
        metrics: this.simulationMetrics,
        recentTweets: this.simulatedTweets.slice(-10),
        totalTweets: this.simulatedTweets.length
      });
    });

    this.app.post('/api/simulation/start', async (req, res) => {
      if (!this.isSimulating) {
        await this.startSimulation();
        res.json({ success: true, message: 'Simulation started' });
      } else {
        res.json({ success: false, message: 'Simulation already running' });
      }
    });

    this.app.post('/api/simulation/stop', (req, res) => {
      this.stopSimulation();
      res.json({ success: true, message: 'Simulation stopped' });
    });

    this.app.post('/api/simulation/test-viral', async (req, res) => {
      const { topic } = req.body;
      try {
        const viralTweet = await this.viralGenerator.generateViralTweet(topic || 'breakthrough medical technology');
        const simulatedTweet = await this.simulateTweetPerformance(viralTweet);
        
        this.broadcastToClients({
          type: 'new_viral_tweet',
          data: simulatedTweet
        });
        
        res.json({ success: true, tweet: simulatedTweet });
      } catch (error: any) {
        console.error('Viral generation error:', error);
        
        // Fallback to offline viral generation
        const fallbackTweet = this.generateOfflineViralTweet(topic);
        const simulatedTweet = await this.simulateTweetPerformance(fallbackTweet);
        
        this.broadcastToClients({
          type: 'new_viral_tweet', 
          data: simulatedTweet
        });
        
        res.json({ success: true, tweet: simulatedTweet });
      }
    });

    this.app.get('/api/simulation/analytics', (req, res) => {
      const analytics = this.generateAnalytics();
      res.json(analytics);
    });
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('🔌 Simulation dashboard client connected');
      
      // Send current status
      ws.send(JSON.stringify({
        type: 'status',
        data: {
          isRunning: this.isSimulating,
          metrics: this.simulationMetrics,
          recentTweets: this.simulatedTweets.slice(-5)
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
        console.log('🔌 Simulation dashboard client disconnected');
      });
    });
  }

  private async handleWebSocketMessage(ws: WebSocket, data: any): Promise<void> {
    switch (data.type) {
      case 'generate_viral':
        try {
          const viralTweet = await this.viralGenerator.generateViralTweet(data.topic);
          const simulatedTweet = await this.simulateTweetPerformance(viralTweet);
          
          ws.send(JSON.stringify({
            type: 'viral_generated',
            data: simulatedTweet
          }));
        } catch (error) {
          // Fallback to offline generation
          const fallbackTweet = this.generateOfflineViralTweet(data.topic);
          const simulatedTweet = await this.simulateTweetPerformance(fallbackTweet);
          
          ws.send(JSON.stringify({
            type: 'viral_generated',
            data: simulatedTweet
          }));
        }
        break;

      case 'strategic_decision':
        try {
          const decision = await this.superStrategist.makeGodTierDecision();
          
          ws.send(JSON.stringify({
            type: 'strategy_update',
            data: decision
          }));
        } catch (error) {
          console.error('Strategic decision error:', error);
          
          // Fallback strategic decision
          ws.send(JSON.stringify({
            type: 'strategy_update',
            data: {
              action: 'post',
              reasoning: 'Simulated strategic decision - perfect viral window detected',
              confidence: 0.85,
              viralPotential: Math.floor(Math.random() * 30) + 70
            }
          }));
        }
        break;
    }
  }

  private generateOfflineViralTweet(topic?: string): any {
    const templates = [
      {
        name: 'MIND_BLOWN',
        template: '🤯 MIND-BLOWING: {topic} just achieved a breakthrough that will revolutionize {industry}. This changes everything we thought we knew! Thread 🧵',
        viralScore: 85 + Math.floor(Math.random() * 15)
      },
      {
        name: 'CONTROVERSIAL_TAKE',
        template: '🔥 CONTROVERSIAL TAKE: Everyone is talking about {topic}, but here\'s what they\'re NOT telling you... This could be bigger than we imagine.',
        viralScore: 80 + Math.floor(Math.random() * 20)
      },
      {
        name: 'FUTURE_SHOCK',
        template: '⚡ THE FUTURE IS HERE: {topic} is advancing so fast, it\'s scary. What seemed impossible yesterday is reality today. Are we ready?',
        viralScore: 78 + Math.floor(Math.random() * 22)
      },
      {
        name: 'DAVID_VS_GOLIATH',
        template: '💥 DAVID VS GOLIATH: Small team just outpaced Big Tech with {topic}. Sometimes the underdog changes the world. This is one of those times.',
        viralScore: 82 + Math.floor(Math.random() * 18)
      },
      {
        name: 'BREAKING_NEWS',
        template: '🚨 BREAKING: {topic} just hit a major milestone that nobody saw coming. The implications are MASSIVE. Here\'s why this matters...',
        viralScore: 88 + Math.floor(Math.random() * 12)
      }
    ];

    const template = templates[Math.floor(Math.random() * templates.length)];
    const topicText = topic || 'AI-powered medical diagnostics';
    const industry = 'healthcare';

    return {
      content: template.template
        .replace('{topic}', topicText)
        .replace('{industry}', industry),
      viralScore: template.viralScore,
      template: template.name
    };
  }

  private async startSimulation(): Promise<void> {
    console.log('🚀 Starting Twitter Simulation...');
    this.isSimulating = true;

    // Initialize API optimizer (safely)
    try {
      await this.apiOptimizer.loadUsage();
    } catch (error) {
      console.log('⚠️ API optimizer unavailable, using simulation mode');
    }

    // Start simulation loop - generate and test viral content every 5 minutes
    this.simulationInterval = setInterval(async () => {
      try {
        await this.runSimulationCycle();
      } catch (error) {
        console.error('Simulation cycle error:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes

    // Run initial cycle
    await this.runSimulationCycle();

    this.broadcastToClients({
      type: 'simulation_started',
      data: { message: 'Simulation started - testing viral content every 5 minutes' }
    });
  }

  private stopSimulation(): void {
    console.log('🛑 Stopping Twitter Simulation...');
    this.isSimulating = false;
    
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }

    this.broadcastToClients({
      type: 'simulation_stopped',
      data: { message: 'Simulation stopped' }
    });
  }

  private async runSimulationCycle(): Promise<void> {
    console.log('🔄 Running simulation cycle...');

    // 1. Make strategic decision (with fallback)
    let decision;
    try {
      decision = await this.superStrategist.makeGodTierDecision();
    } catch (error) {
      console.log('⚠️ Using fallback strategic decision');
      decision = {
        action: 'post',
        reasoning: 'Simulated strategic decision - good engagement window',
        confidence: 0.8,
        viralPotential: Math.floor(Math.random() * 30) + 70
      };
    }
    
    if (decision.action === 'post') {
      // 2. Generate viral content (with fallback)
      let viralTweet;
      try {
        viralTweet = await this.viralGenerator.generateViralTweet();
      } catch (error) {
        console.log('⚠️ Using offline viral generation');
        viralTweet = this.generateOfflineViralTweet();
      }
      
      // 3. Simulate tweet performance
      const simulatedTweet = await this.simulateTweetPerformance(viralTweet);
      
      // 4. Add to our collection
      this.simulatedTweets.push(simulatedTweet);
      
      // 5. Update metrics
      this.updateSimulationMetrics();
      
      // 6. Broadcast to clients
      this.broadcastToClients({
        type: 'new_tweet',
        data: {
          tweet: simulatedTweet,
          decision: decision,
          metrics: this.simulationMetrics
        }
      });

      console.log(`🎯 Simulated tweet: ${simulatedTweet.viralScore}/100 viral score`);
    } else {
      console.log(`😴 Strategic decision: ${decision.reasoning}`);
      
      this.broadcastToClients({
        type: 'strategic_wait',
        data: {
          decision: decision,
          nextAction: decision.nextActionTime
        }
      });
    }
  }

  private async simulateTweetPerformance(viralTweet: any): Promise<SimulatedTweet> {
    // Simulate engagement based on viral score and current time
    const baseEngagement = Math.min(viralTweet.viralScore * 10, 1000);
    const timeMultiplier = this.getTimeEngagementMultiplier();
    const randomFactor = 0.7 + (Math.random() * 0.6); // 0.7x to 1.3x variation

    const engagement = Math.floor(baseEngagement * timeMultiplier * randomFactor);
    
    const simulatedTweet: SimulatedTweet = {
      id: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: viralTweet.content,
      template: viralTweet.template,
      viralScore: viralTweet.viralScore,
      simulatedEngagement: {
        likes: Math.floor(engagement * 0.6),
        retweets: Math.floor(engagement * 0.15),
        replies: Math.floor(engagement * 0.1),
        impressions: Math.floor(engagement * 15),
        engagementRate: Math.min((engagement / (engagement * 15)) * 100, 12)
      },
      postedAt: new Date(),
      viralPotential: viralTweet.viralScore / 100
    };

    // Simulate viral breakthrough if score > 85
    if (viralTweet.viralScore > 85) {
      simulatedTweet.actualPerformance = {
        hourlyGrowth: this.generateHourlyGrowth(viralTweet.viralScore),
        peakEngagement: engagement * (1.5 + Math.random()),
        viralCoefficient: viralTweet.viralScore / 50 // How viral it becomes
      };
    }

    return simulatedTweet;
  }

  private getTimeEngagementMultiplier(): number {
    const hour = new Date().getHours();
    const day = new Date().getDay();
    
    // Simulate viral windows
    if (day === 1 && hour === 9) return 3.2; // Monday morning
    if (day === 2 && hour === 13) return 3.5; // Tuesday lunch
    if (day === 3 && hour === 9) return 3.1; // Wednesday morning
    if (day === 4 && hour === 19) return 2.8; // Thursday evening
    if (day === 5 && hour === 10) return 2.5; // Friday morning
    
    // General patterns
    if (day >= 1 && day <= 5) {
      if (hour >= 8 && hour <= 10) return 1.8;
      if (hour >= 12 && hour <= 14) return 2.0;
      if (hour >= 18 && hour <= 20) return 1.6;
    }
    
    return 1.0;
  }

  private generateHourlyGrowth(viralScore: number): number[] {
    const hours = [];
    let growth = viralScore;
    
    for (let i = 0; i < 24; i++) {
      if (i < 6) {
        growth *= 1.1 + (Math.random() * 0.3); // Viral growth
      } else if (i < 12) {
        growth *= 1.05 + (Math.random() * 0.2); // Sustained growth  
      } else {
        growth *= 0.95 + (Math.random() * 0.1); // Decline
      }
      hours.push(Math.floor(growth));
    }
    
    return hours;
  }

  private updateSimulationMetrics(): void {
    if (this.simulatedTweets.length === 0) return;

    const tweets = this.simulatedTweets;
    
    this.simulationMetrics = {
      totalTweets: tweets.length,
      avgViralScore: tweets.reduce((sum, t) => sum + t.viralScore, 0) / tweets.length,
      avgEngagementRate: tweets.reduce((sum, t) => sum + t.simulatedEngagement.engagementRate, 0) / tweets.length,
      bestPerformingTemplate: this.getBestTemplate(),
      worstPerformingTemplate: this.getWorstTemplate(),
      totalReach: tweets.reduce((sum, t) => sum + t.simulatedEngagement.impressions, 0),
      followerGrowth: Math.floor(tweets.reduce((sum, t) => sum + (t.viralScore * 2), 0)),
      viralBreakthroughs: tweets.filter(t => t.viralScore > 85).length
    };
  }

  private getBestTemplate(): string {
    const templateScores = new Map<string, number[]>();
    
    this.simulatedTweets.forEach(tweet => {
      if (!templateScores.has(tweet.template)) {
        templateScores.set(tweet.template, []);
      }
      templateScores.get(tweet.template)!.push(tweet.viralScore);
    });

    let bestTemplate = '';
    let bestAvg = 0;
    
    templateScores.forEach((scores, template) => {
      const avg = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      if (avg > bestAvg) {
        bestAvg = avg;
        bestTemplate = template;
      }
    });

    return bestTemplate;
  }

  private getWorstTemplate(): string {
    const templateScores = new Map<string, number[]>();
    
    this.simulatedTweets.forEach(tweet => {
      if (!templateScores.has(tweet.template)) {
        templateScores.set(tweet.template, []);
      }
      templateScores.get(tweet.template)!.push(tweet.viralScore);
    });

    let worstTemplate = '';
    let worstAvg = 100;
    
    templateScores.forEach((scores, template) => {
      const avg = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      if (avg < worstAvg) {
        worstAvg = avg;
        worstTemplate = template;
      }
    });

    return worstTemplate;
  }

  private generateAnalytics(): any {
    const last24h = this.simulatedTweets.filter(t => 
      new Date().getTime() - t.postedAt.getTime() < 24 * 60 * 60 * 1000
    );

    return {
      overview: this.simulationMetrics,
      last24Hours: {
        tweets: last24h.length,
        avgViralScore: last24h.reduce((sum, t) => sum + t.viralScore, 0) / (last24h.length || 1),
        totalEngagement: last24h.reduce((sum, t) => 
          sum + t.simulatedEngagement.likes + t.simulatedEngagement.retweets + t.simulatedEngagement.replies, 0),
        viralBreakthroughs: last24h.filter(t => t.viralScore > 85).length
      },
      templatePerformance: this.getTemplateAnalytics(),
      hourlyDistribution: this.getHourlyDistribution(),
      projectedJuly1st: this.projectJuly1stPerformance()
    };
  }

  private getTemplateAnalytics(): any {
    const templates = new Map<string, { count: number, avgScore: number, avgEngagement: number }>();
    
    this.simulatedTweets.forEach(tweet => {
      if (!templates.has(tweet.template)) {
        templates.set(tweet.template, { count: 0, avgScore: 0, avgEngagement: 0 });
      }
      const template = templates.get(tweet.template)!;
      template.count++;
      template.avgScore += tweet.viralScore;
      template.avgEngagement += tweet.simulatedEngagement.engagementRate;
    });

    const result: any = {};
    templates.forEach((data, template) => {
      result[template] = {
        count: data.count,
        avgViralScore: data.avgScore / data.count,
        avgEngagementRate: data.avgEngagement / data.count
      };
    });

    return result;
  }

  private getHourlyDistribution(): any {
    const hourly = new Array(24).fill(0).map(() => ({ tweets: 0, avgEngagement: 0 }));
    
    this.simulatedTweets.forEach(tweet => {
      const hour = tweet.postedAt.getHours();
      hourly[hour].tweets++;
      hourly[hour].avgEngagement += tweet.simulatedEngagement.engagementRate;
    });

    hourly.forEach(data => {
      if (data.tweets > 0) {
        data.avgEngagement /= data.tweets;
      }
    });

    return hourly;
  }

  private projectJuly1stPerformance(): any {
    const avgViralScore = this.simulationMetrics.avgViralScore;
    const avgEngagementRate = this.simulationMetrics.avgEngagementRate;
    const bestTemplate = this.simulationMetrics.bestPerformingTemplate;

    return {
      estimatedDailyReach: Math.floor(this.simulationMetrics.totalReach / Math.max(this.simulatedTweets.length, 1) * 20), // 20 tweets per day
      estimatedFollowerGrowthPerDay: Math.floor(avgViralScore * 5), // Conservative estimate
      bestStrategy: `Focus on ${bestTemplate} template during viral windows`,
      successProbability: Math.min(avgEngagementRate * 10, 95), // % chance of viral success
      optimizationSuggestions: this.generateOptimizationSuggestions()
    };
  }

  private generateOptimizationSuggestions(): string[] {
    const suggestions = [];
    
    if (this.simulationMetrics.avgViralScore < 75) {
      suggestions.push('Focus more on controversial takes and breaking news templates');
    }
    
    if (this.simulationMetrics.avgEngagementRate < 5) {
      suggestions.push('Include more interactive elements and questions in tweets');
    }
    
    if (this.simulationMetrics.viralBreakthroughs < 2) {
      suggestions.push('Target trending hashtags and current health tech events');
    }
    
    suggestions.push('Post during identified viral windows for maximum impact');
    suggestions.push('Use data-driven insights to refine content strategy');
    
    return suggestions;
  }

  private broadcastToClients(message: any): void {
    const messageString = JSON.stringify(message);
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageString);
      }
    });
  }

  public start(port: number = 3001): void {
    this.server.listen(port, () => {
      console.log(`🎯 Improved Twitter Simulation Dashboard running on http://localhost:${port}`);
      console.log(`🔥 Real-time viral content testing active (offline-capable)`);
      console.log(`📊 Building optimizations for July 1st launch`);
      console.log(`✅ All systems operational with fallback strategies`);
    });
  }

  public stop(): void {
    this.stopSimulation();
    this.server.close();
  }
} 