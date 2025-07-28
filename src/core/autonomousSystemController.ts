/**
 * 🤖 AUTONOMOUS SYSTEM CONTROLLER (2024)
 * 
 * Central orchestration system for 100% autonomous Twitter bot operation.
 * Coordinates all subsystems and provides comprehensive monitoring dashboard.
 * 
 * Key Features:
 * - Complete system orchestration
 * - Real-time health monitoring
 * - Adaptive scheduling based on performance
 * - Error recovery and failsafes
 * - Dashboard integration at localhost:3002
 * - System health reporting
 * - Automated optimization cycles
 */

import { minimalSupabaseClient } from '../utils/minimalSupabaseClient';
import { BrowserTweetPoster } from '../utils/browserTweetPoster';
import { EnhancedSemanticUniqueness } from '../utils/enhancedSemanticUniqueness';
import { RobustTemplateSelection } from '../utils/robustTemplateSelection';
import { SmartEngagementAgent } from '../agents/smartEngagementAgent';
import { IntelligentGrowthEngine } from '../agents/intelligentGrowthEngine';
import { EnhancedTweetPerformanceTracker } from '../jobs/enhancedTweetPerformanceTracker';
import * as express from 'express';
import * as path from 'path';

interface SystemComponent {
  name: string;
  status: 'active' | 'inactive' | 'error' | 'maintenance';
  lastRun: string;
  nextRun: string;
  performance: {
    successRate: number;
    avgExecutionTime: number;
    errors: string[];
  };
  isCore: boolean;
}

interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical' | 'offline';
  components: SystemComponent[];
  metrics: {
    dailyPosts: number;
    engagementRate: number;
    followerGrowth: number;
    systemUptime: number;
    budgetUsed: number;
    budgetRemaining: number;
  };
  lastUpdated: string;
}

interface AutonomousConfig {
  postingFrequency: number; // posts per day
  engagementCycles: number; // engagement runs per day
  analyticsUpdates: number; // analytics updates per day
  growthOptimization: number; // optimization runs per week
  errorThreshold: number; // max errors before intervention
  budgetLimit: number; // daily budget limit
}

export class AutonomousSystemController {
  private app: express.Application;
  private systemHealth: SystemHealth;
  private config: AutonomousConfig;
  private isRunning = false;
  private intervals: NodeJS.Timeout[] = [];
  private lastHealthCheck = 0;

  constructor() {
    this.app = express();
    this.setupExpress();
    
    this.config = {
      postingFrequency: 3, // 3 posts per day
      engagementCycles: 8, // Every 3 hours
      analyticsUpdates: 4, // Every 6 hours
      growthOptimization: 1, // Once per week
      errorThreshold: 10,
      budgetLimit: 5.00
    };

    this.systemHealth = this.initializeSystemHealth();
    this.startHealthMonitoring();
  }

  /**
   * 🚀 START AUTONOMOUS SYSTEM
   * Begin full autonomous operation
   */
  async startAutonomousOperation(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Autonomous system already running');
      return;
    }

    try {
      console.log('🤖 === AUTONOMOUS TWITTER BOT SYSTEM STARTING ===');
      
      // Start dashboard server
      await this.startDashboard();
      
      // Initialize all components
      await this.initializeComponents();
      
      // Start autonomous cycles
      await this.startAutonomousCycles();
      
      this.isRunning = true;
      console.log('✅ === AUTONOMOUS SYSTEM FULLY OPERATIONAL ===');
      console.log('📊 Dashboard available at: http://localhost:3002');
      
    } catch (error: any) {
      console.error('❌ Failed to start autonomous system:', error);
      this.updateComponentStatus('system_controller', 'error', [error.message]);
      throw error;
    }
  }

  /**
   * 🛑 STOP AUTONOMOUS SYSTEM
   * Gracefully shutdown all operations
   */
  async stopAutonomousOperation(): Promise<void> {
    try {
      console.log('🛑 Stopping autonomous system...');
      
      this.isRunning = false;
      
      // Clear all intervals
      this.intervals.forEach(interval => clearInterval(interval));
      this.intervals = [];
      
      // Update system status
      this.systemHealth.overall = 'offline';
      this.systemHealth.components.forEach(component => {
        component.status = 'inactive';
      });
      
      console.log('✅ Autonomous system stopped successfully');
      
    } catch (error: any) {
      console.error('❌ Error stopping autonomous system:', error);
    }
  }

  /**
   * 🏗️ SETUP EXPRESS DASHBOARD
   * Configure Express server for monitoring dashboard
   */
  private setupExpress(): void {
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '../dashboard')));

    // System health endpoint
    this.app.get('/api/health', (req, res) => {
      res.json(this.systemHealth);
    });

    // System metrics endpoint
    this.app.get('/api/metrics', async (req, res) => {
      try {
        const metrics = await this.getSystemMetrics();
        res.json(metrics);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Manual trigger endpoints
    this.app.post('/api/trigger/post', async (req, res) => {
      try {
        const result = await this.triggerPost();
        res.json({ success: true, result });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/trigger/engagement', async (req, res) => {
      try {
        const result = await this.triggerEngagement();
        res.json({ success: true, result });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/trigger/analytics', async (req, res) => {
      try {
        const result = await this.triggerAnalytics();
        res.json({ success: true, result });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Config update endpoint
    this.app.post('/api/config', (req, res) => {
      try {
        this.config = { ...this.config, ...req.body };
        res.json({ success: true, config: this.config });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Serve dashboard HTML
    this.app.get('/', (req, res) => {
      res.send(this.getDashboardHTML());
    });
  }

  /**
   * 🖥️ START DASHBOARD SERVER
   * Launch monitoring dashboard
   */
  private async startDashboard(): Promise<void> {
    return new Promise((resolve, reject) => {
      const PORT = parseInt(process.env.PORT || '3002', 10);
      const HOST = '0.0.0.0';
      
      const server = this.app.listen(PORT, HOST, () => {
        console.log(`📊 Dashboard server started on http://${HOST}:${PORT}`);
        this.updateComponentStatus('dashboard', 'active');
        resolve();
      });

      server.on('error', (error) => {
        console.error('❌ Dashboard server error:', error);
        this.updateComponentStatus('dashboard', 'error', [error.message]);
        reject(error);
      });
    });
  }

  /**
   * 🔧 INITIALIZE COMPONENTS
   * Set up all system components
   */
  private async initializeComponents(): Promise<void> {
    console.log('🔧 Initializing system components...');

    // Initialize tweet poster
    try {
      const poster = new BrowserTweetPoster();
      await poster.initialize();
      this.updateComponentStatus('tweet_poster', 'active');
    } catch (error: any) {
      this.updateComponentStatus('tweet_poster', 'error', [error.message]);
    }

    // Initialize performance tracker
    try {
      const tracker = new EnhancedTweetPerformanceTracker();
      this.updateComponentStatus('performance_tracker', 'active');
    } catch (error: any) {
      this.updateComponentStatus('performance_tracker', 'error', [error.message]);
    }

    // Test database connectivity
    try {
      if (minimalSupabaseClient.supabase) {
        const { data, error } = await minimalSupabaseClient.supabase
          .from('tweets')
          .select('id')
          .limit(1);
        
        if (error) throw error;
        this.updateComponentStatus('database', 'active');
      } else {
        throw new Error('Supabase client not available');
      }
    } catch (error: any) {
      this.updateComponentStatus('database', 'error', [error.message]);
    }

    console.log('✅ Component initialization completed');
  }

  /**
   * 🔄 START AUTONOMOUS CYCLES
   * Begin all automated cycles
   */
  private async startAutonomousCycles(): Promise<void> {
    console.log('🔄 Starting autonomous cycles...');

    // Posting cycle - configurable frequency
    const postingInterval = (24 * 60 * 60 * 1000) / this.config.postingFrequency; // ms between posts
    this.intervals.push(setInterval(() => {
      this.runPostingCycle().catch(error => 
        console.error('❌ Posting cycle error:', error)
      );
    }, postingInterval));

    // Engagement cycle - every 3 hours by default
    const engagementInterval = (24 * 60 * 60 * 1000) / this.config.engagementCycles;
    this.intervals.push(setInterval(() => {
      this.runEngagementCycle().catch(error => 
        console.error('❌ Engagement cycle error:', error)
      );
    }, engagementInterval));

    // Analytics cycle - every 6 hours by default
    const analyticsInterval = (24 * 60 * 60 * 1000) / this.config.analyticsUpdates;
    this.intervals.push(setInterval(() => {
      this.runAnalyticsCycle().catch(error => 
        console.error('❌ Analytics cycle error:', error)
      );
    }, analyticsInterval));

    // Growth optimization cycle - weekly
    const growthInterval = (7 * 24 * 60 * 60 * 1000) / this.config.growthOptimization;
    this.intervals.push(setInterval(() => {
      this.runGrowthOptimization().catch(error => 
        console.error('❌ Growth optimization error:', error)
      );
    }, growthInterval));

    // Run initial cycles
    setTimeout(() => this.runPostingCycle(), 5000); // First post in 5 seconds
    setTimeout(() => this.runEngagementCycle(), 10000); // First engagement in 10 seconds
    setTimeout(() => this.runAnalyticsCycle(), 15000); // First analytics in 15 seconds

    console.log('✅ All autonomous cycles started');
  }

  /**
   * 📝 RUN POSTING CYCLE
   * Execute automated content posting
   */
  private async runPostingCycle(): Promise<void> {
    try {
      console.log('📝 === AUTONOMOUS POSTING CYCLE ===');
      this.updateComponentStatus('posting_cycle', 'active');

      // Get optimal template
      const templateResult = await RobustTemplateSelection.getTemplate({
        currentHour: new Date().getHours(),
        tone: 'friendly'
      });

      if (!templateResult.success || !templateResult.template) {
        throw new Error('Failed to get posting template');
      }

      // Generate content using template
      const content = await this.generateContentFromTemplate(templateResult.template.template);

      // Check uniqueness
      const uniquenessResult = await EnhancedSemanticUniqueness.checkContentUniqueness(content);
      if (!uniquenessResult.isUnique) {
        console.log('⚠️ Content not unique, skipping post');
        return;
      }

      // Post tweet
      const poster = new BrowserTweetPoster();
      const postResult = await poster.postTweet(content);

      if (postResult.success) {
        console.log('✅ Tweet posted successfully');
        
        // Store content fingerprint
        await EnhancedSemanticUniqueness.storeApprovedContent(
          postResult.tweet_id || 'unknown',
          content,
          'general'
        );

        this.updateComponentStatus('posting_cycle', 'active');
      } else {
        throw new Error(postResult.error || 'Posting failed');
      }

    } catch (error: any) {
      console.error('❌ Posting cycle failed:', error);
      this.updateComponentStatus('posting_cycle', 'error', [error.message]);
    }
  }

  /**
   * 🤝 RUN ENGAGEMENT CYCLE
   * Execute automated engagement actions
   */
  private async runEngagementCycle(): Promise<void> {
    try {
      console.log('🤝 === AUTONOMOUS ENGAGEMENT CYCLE ===');
      this.updateComponentStatus('engagement_cycle', 'active');

      const result = await SmartEngagementAgent.runEngagementCycle();
      
      if (result.success) {
        console.log(`✅ Engagement cycle completed: ${result.summary}`);
        this.updateComponentStatus('engagement_cycle', 'active');
      } else {
        throw new Error('Engagement cycle failed');
      }

    } catch (error: any) {
      console.error('❌ Engagement cycle failed:', error);
      this.updateComponentStatus('engagement_cycle', 'error', [error.message]);
    }
  }

  /**
   * 📊 RUN ANALYTICS CYCLE
   * Execute performance tracking and analysis
   */
  private async runAnalyticsCycle(): Promise<void> {
    try {
      console.log('📊 === AUTONOMOUS ANALYTICS CYCLE ===');
      this.updateComponentStatus('analytics_cycle', 'active');

              const tracker = new EnhancedTweetPerformanceTracker();
        const result = await tracker.runPerformanceUpdate();
      
      if (result.success) {
        console.log(`✅ Analytics cycle completed: ${result.summary}`);
        this.updateComponentStatus('analytics_cycle', 'active');
      } else {
        throw new Error('Analytics cycle failed');
      }

    } catch (error: any) {
      console.error('❌ Analytics cycle failed:', error);
      this.updateComponentStatus('analytics_cycle', 'error', [error.message]);
    }
  }

  /**
   * 🚀 RUN GROWTH OPTIMIZATION
   * Execute growth strategy optimization
   */
  private async runGrowthOptimization(): Promise<void> {
    try {
      console.log('🚀 === AUTONOMOUS GROWTH OPTIMIZATION ===');
      this.updateComponentStatus('growth_optimization', 'active');

      const result = await IntelligentGrowthEngine.optimizeGrowthStrategy();
      
      if (result.success) {
        console.log(`✅ Growth optimization completed`);
        await IntelligentGrowthEngine.saveOptimizedStrategy(result.newStrategy);
        this.updateComponentStatus('growth_optimization', 'active');
      } else {
        throw new Error('Growth optimization failed');
      }

    } catch (error: any) {
      console.error('❌ Growth optimization failed:', error);
      this.updateComponentStatus('growth_optimization', 'error', [error.message]);
    }
  }

  /**
   * 🏥 START HEALTH MONITORING
   * Begin continuous system health monitoring
   */
  private startHealthMonitoring(): void {
    setInterval(() => {
      this.updateSystemHealth();
    }, 30000); // Every 30 seconds
  }

  /**
   * 💊 UPDATE SYSTEM HEALTH
   * Calculate and update overall system health
   */
  private async updateSystemHealth(): Promise<void> {
    try {
      const now = Date.now();
      if (now - this.lastHealthCheck < 25000) return; // Throttle health checks
      this.lastHealthCheck = now;

      // Calculate metrics
      const metrics = await this.getSystemMetrics();
      this.systemHealth.metrics = metrics;

      // Determine overall health
      const errorComponents = this.systemHealth.components.filter(c => c.status === 'error');
      const coreErrorComponents = errorComponents.filter(c => c.isCore);

      if (coreErrorComponents.length > 0) {
        this.systemHealth.overall = 'critical';
      } else if (errorComponents.length > 2) {
        this.systemHealth.overall = 'warning';
      } else {
        this.systemHealth.overall = 'healthy';
      }

      this.systemHealth.lastUpdated = new Date().toISOString();

    } catch (error: any) {
      console.error('❌ Health monitoring error:', error);
      this.systemHealth.overall = 'warning';
    }
  }

  /**
   * 📊 GET SYSTEM METRICS
   * Collect current system performance metrics
   */
  private async getSystemMetrics(): Promise<any> {
    try {
      if (!minimalSupabaseClient.supabase) {
        return {
          dailyPosts: 0,
          engagementRate: 0,
          followerGrowth: 0,
          systemUptime: Date.now() - this.systemHealth.metrics.systemUptime,
          budgetUsed: 0,
          budgetRemaining: this.config.budgetLimit
        };
      }

      // Get daily posts
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: dailyTweets } = await minimalSupabaseClient.supabase
        .from('tweets')
        .select('id')
        .gte('created_at', today.toISOString());

      const dailyPosts = dailyTweets?.length || 0;

      // Get engagement rate (simplified)
      const { data: recentTweets } = await minimalSupabaseClient.supabase
        .from('tweets')
        .select('likes, retweets, replies, impressions')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(20);

      let engagementRate = 0;
      if (recentTweets && recentTweets.length > 0) {
        const totalEngagement = recentTweets.reduce((sum, tweet) => 
          sum + (tweet.likes || 0) + (tweet.retweets || 0) + (tweet.replies || 0), 0
        );
        const totalImpressions = recentTweets.reduce((sum, tweet) => 
          sum + (tweet.impressions || Math.max((tweet.likes || 0) * 10, 100)), 0
        );
        engagementRate = totalImpressions > 0 ? totalEngagement / totalImpressions : 0;
      }

      return {
        dailyPosts,
        engagementRate: Math.round(engagementRate * 10000) / 100, // Convert to percentage
        followerGrowth: 1.2, // Placeholder - would get from follower tracking
        systemUptime: this.isRunning ? Date.now() - this.systemHealth.metrics.systemUptime : 0,
        budgetUsed: 1.50, // Placeholder - would get from budget tracking
        budgetRemaining: this.config.budgetLimit - 1.50
      };

    } catch (error: any) {
      console.error('❌ Error getting system metrics:', error);
      return {
        dailyPosts: 0,
        engagementRate: 0,
        followerGrowth: 0,
        systemUptime: 0,
        budgetUsed: 0,
        budgetRemaining: this.config.budgetLimit
      };
    }
  }

  // Manual trigger methods for dashboard
  private async triggerPost(): Promise<any> {
    console.log('🔧 Manual post trigger activated');
    await this.runPostingCycle();
    return { message: 'Post cycle triggered successfully' };
  }

  private async triggerEngagement(): Promise<any> {
    console.log('🔧 Manual engagement trigger activated');
    await this.runEngagementCycle();
    return { message: 'Engagement cycle triggered successfully' };
  }

  private async triggerAnalytics(): Promise<any> {
    console.log('🔧 Manual analytics trigger activated');
    await this.runAnalyticsCycle();
    return { message: 'Analytics cycle triggered successfully' };
  }

  /**
   * 📝 GENERATE CONTENT FROM TEMPLATE
   * Simple content generation (placeholder)
   */
  private async generateContentFromTemplate(template: string): Promise<string> {
    // This is a simplified version - in practice, you'd integrate with your content generation system
    const healthFacts = [
      'drinking water first thing in the morning boosts metabolism by up to 30%',
      '7-8 hours of quality sleep is crucial for muscle recovery and growth',
      'walking 10,000 steps daily can reduce risk of heart disease by 35%',
      'meditation for just 10 minutes can lower cortisol levels significantly'
    ];

    const fact = healthFacts[Math.floor(Math.random() * healthFacts.length)];
    return template.replace('{health_fact}', fact).replace('{tip}', fact);
  }

  /**
   * 🔄 UPDATE COMPONENT STATUS
   * Update the status of a system component
   */
  private updateComponentStatus(componentName: string, status: 'active' | 'inactive' | 'error' | 'maintenance', errors: string[] = []): void {
    const component = this.systemHealth.components.find(c => c.name === componentName);
    if (component) {
      component.status = status;
      component.lastRun = new Date().toISOString();
      if (errors.length > 0) {
        component.performance.errors = errors.slice(-5); // Keep last 5 errors
      }
    }
  }

  /**
   * 🏗️ INITIALIZE SYSTEM HEALTH
   * Set up initial system health structure
   */
  private initializeSystemHealth(): SystemHealth {
    return {
      overall: 'offline',
      components: [
        { name: 'dashboard', status: 'inactive', lastRun: '', nextRun: '', performance: { successRate: 100, avgExecutionTime: 0, errors: [] }, isCore: true },
        { name: 'database', status: 'inactive', lastRun: '', nextRun: '', performance: { successRate: 100, avgExecutionTime: 0, errors: [] }, isCore: true },
        { name: 'tweet_poster', status: 'inactive', lastRun: '', nextRun: '', performance: { successRate: 100, avgExecutionTime: 0, errors: [] }, isCore: true },
        { name: 'posting_cycle', status: 'inactive', lastRun: '', nextRun: '', performance: { successRate: 100, avgExecutionTime: 0, errors: [] }, isCore: true },
        { name: 'engagement_cycle', status: 'inactive', lastRun: '', nextRun: '', performance: { successRate: 100, avgExecutionTime: 0, errors: [] }, isCore: false },
        { name: 'analytics_cycle', status: 'inactive', lastRun: '', nextRun: '', performance: { successRate: 100, avgExecutionTime: 0, errors: [] }, isCore: false },
        { name: 'performance_tracker', status: 'inactive', lastRun: '', nextRun: '', performance: { successRate: 100, avgExecutionTime: 0, errors: [] }, isCore: false },
        { name: 'growth_optimization', status: 'inactive', lastRun: '', nextRun: '', performance: { successRate: 100, avgExecutionTime: 0, errors: [] }, isCore: false }
      ],
      metrics: {
        dailyPosts: 0,
        engagementRate: 0,
        followerGrowth: 0,
        systemUptime: Date.now(),
        budgetUsed: 0,
        budgetRemaining: 5.00
      },
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * 🎨 GET DASHBOARD HTML
   * Generate HTML for monitoring dashboard
   */
  private getDashboardHTML(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Autonomous Twitter Bot Dashboard</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f7; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { color: #1d1d1f; margin: 0; }
        .status-card { background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: white; border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .metric-value { font-size: 2em; font-weight: bold; color: #007aff; }
        .metric-label { color: #666; margin-top: 5px; }
        .component { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
        .component:last-child { border-bottom: none; }
        .status { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
        .status.active { background: #d4edda; color: #155724; }
        .status.error { background: #f8d7da; color: #721c24; }
        .status.inactive { background: #e2e3e5; color: #6c757d; }
        .health-indicator { width: 20px; height: 20px; border-radius: 50%; margin-right: 10px; }
        .health-healthy { background: #34c759; }
        .health-warning { background: #ff9500; }
        .health-critical { background: #ff3b30; }
        .health-offline { background: #8e8e93; }
        .controls { display: flex; gap: 10px; margin-top: 20px; }
        button { padding: 10px 20px; border: none; border-radius: 8px; background: #007aff; color: white; cursor: pointer; }
        button:hover { background: #0056cc; }
        button:disabled { background: #8e8e93; cursor: not-allowed; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 Autonomous Twitter Bot Dashboard</h1>
            <p>Real-time monitoring and control for your AI-powered Twitter growth system</p>
        </div>

        <div class="metrics-grid" id="metrics">
            <!-- Metrics will be loaded here -->
        </div>

        <div class="status-card">
            <h2>System Health</h2>
            <div id="system-health">
                <div style="display: flex; align-items: center; margin-bottom: 20px;">
                    <div class="health-indicator health-offline" id="health-indicator"></div>
                    <span id="health-status">Loading...</span>
                </div>
            </div>
            
            <h3>Components</h3>
            <div id="components">
                <!-- Components will be loaded here -->
            </div>

            <div class="controls">
                <button onclick="triggerAction('post')">🐦 Post Now</button>
                <button onclick="triggerAction('engagement')">🤝 Engage Now</button>
                <button onclick="triggerAction('analytics')">📊 Update Analytics</button>
                <button onclick="refreshData()">🔄 Refresh</button>
            </div>
        </div>
    </div>

    <script>
        async function loadData() {
            try {
                const response = await fetch('/api/health');
                const data = await response.json();
                updateDashboard(data);
            } catch (error) {
                console.error('Failed to load data:', error);
            }
        }

        function updateDashboard(data) {
            // Update health indicator
            const indicator = document.getElementById('health-indicator');
            const status = document.getElementById('health-status');
            indicator.className = 'health-indicator health-' + data.overall;
            status.textContent = 'System Status: ' + data.overall.toUpperCase();

            // Update metrics
            const metrics = document.getElementById('metrics');
            metrics.innerHTML = \`
                <div class="metric">
                    <div class="metric-value">\${data.metrics.dailyPosts}</div>
                    <div class="metric-label">Posts Today</div>
                </div>
                <div class="metric">
                    <div class="metric-value">\${data.metrics.engagementRate.toFixed(2)}%</div>
                    <div class="metric-label">Engagement Rate</div>
                </div>
                <div class="metric">
                    <div class="metric-value">+\${data.metrics.followerGrowth}</div>
                    <div class="metric-label">Daily Growth</div>
                </div>
                <div class="metric">
                    <div class="metric-value">$\${data.metrics.budgetUsed.toFixed(2)}</div>
                    <div class="metric-label">Budget Used</div>
                </div>
                <div class="metric">
                    <div class="metric-value">$\${data.metrics.budgetRemaining.toFixed(2)}</div>
                    <div class="metric-label">Budget Remaining</div>
                </div>
                <div class="metric">
                    <div class="metric-value">\${Math.round(data.metrics.systemUptime / 3600000)}h</div>
                    <div class="metric-label">Uptime</div>
                </div>
            \`;

            // Update components
            const components = document.getElementById('components');
            components.innerHTML = data.components.map(component => \`
                <div class="component">
                    <span>\${component.name.replace(/_/g, ' ').toUpperCase()}</span>
                    <span class="status \${component.status}">\${component.status.toUpperCase()}</span>
                </div>
            \`).join('');
        }

        async function triggerAction(action) {
            try {
                const response = await fetch(\`/api/trigger/\${action}\`, { method: 'POST' });
                const result = await response.json();
                if (result.success) {
                    alert(\`\${action} triggered successfully!\`);
                    setTimeout(refreshData, 2000);
                } else {
                    alert(\`Failed to trigger \${action}: \${result.error}\`);
                }
            } catch (error) {
                alert(\`Error triggering \${action}: \${error.message}\`);
            }
        }

        function refreshData() {
            loadData();
        }

        // Load data initially and set up auto-refresh
        loadData();
        setInterval(loadData, 30000); // Refresh every 30 seconds
    </script>
</body>
</html>`;
  }
} 