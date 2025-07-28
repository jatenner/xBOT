/**
 * 🤖 MASTER AUTONOMOUS CONTROLLER
 * The central brain that orchestrates all intelligent Twitter growth systems
 * Manages posting, engagement, analytics, and daily optimization for maximum follower growth
 * Fully autonomous operation with intelligent decision-making and learning
 */

import { PRODUCTION_CONFIG, validateEnvironment, getBudgetConfig, getGrowthTargets } from '../config/productionConfig';
import { EnhancedAutonomousPostingEngine } from './enhancedAutonomousPostingEngine';
import { IntelligentReplyEngine } from '../agents/intelligentReplyEngine';
import { AutonomousEngagementEngine } from '../agents/autonomousEngagementEngine';
import { EnhancedDailyOptimizationLoop } from '../intelligence/enhancedDailyOptimizationLoop';
import { IntelligentGrowthMaster } from '../intelligence/intelligentGrowthMaster';
import { EmergencyBudgetLockdown } from '../utils/emergencyBudgetLockdown';
import express from 'express';
import { createServer } from 'http';

export interface SystemHealth {
  overall: 'excellent' | 'good' | 'degraded' | 'critical';
  components: {
    [key: string]: {
      status: 'active' | 'warning' | 'error' | 'offline';
      lastCheck: Date;
      metrics?: any;
      errors?: string[];
    };
  };
  performance: {
    postsToday: number;
    engagementToday: number;
    followerGrowth24h: number;
    systemUptime: number;
    budgetUtilization: number;
  };
  nextActions: string[];
}

export interface OperationalMetrics {
  posting: {
    totalPosts: number;
    successRate: number;
    averageEngagement: number;
    lastPostTime: Date | null;
  };
  engagement: {
    totalActions: number;
    replyCount: number;
    likeCount: number;
    followCount: number;
    followbackRate: number;
  };
  growth: {
    dailyFollowerGrowth: number;
    weeklyGrowthTrend: number;
    engagementRate: number;
    viralTweetCount: number;
  };
  intelligence: {
    optimizationCycles: number;
    lastOptimization: Date | null;
    learningAccuracy: number;
    strategicInsights: number;
  };
}

export class MasterAutonomousController {
  private static instance: MasterAutonomousController;
  private isRunning = false;
  private startTime: Date | null = null;
  private systemHealth: SystemHealth;
  private operationalMetrics: OperationalMetrics;
  private intervals: NodeJS.Timeout[] = [];
  private app: express.Application;
  private server: any;

  // Core systems
  private postingEngine: EnhancedAutonomousPostingEngine;
  private replyEngine: IntelligentReplyEngine;
  private engagementEngine: AutonomousEngagementEngine;
  private optimizationLoop: EnhancedDailyOptimizationLoop;
  private growthMaster: IntelligentGrowthMaster;

  static getInstance(): MasterAutonomousController {
    if (!this.instance) {
      this.instance = new MasterAutonomousController();
    }
    return this.instance;
  }

  constructor() {
    this.initializeSystemHealth();
    this.initializeOperationalMetrics();
    this.setupExpressApp();
    this.initializeCoreComponents();
  }

  /**
   * 🚀 START AUTONOMOUS OPERATION
   * Initialize and start the complete autonomous Twitter growth system
   */
  async startAutonomousOperation(): Promise<void> {
    try {
      console.log('🚀 === MASTER AUTONOMOUS CONTROLLER STARTING ===');
      console.log(`📅 Start Time: ${new Date().toISOString()}`);
      console.log(`🎯 Growth Targets: ${JSON.stringify(getGrowthTargets())}`);

      // Validate environment and configuration
      await this.validateSystemRequirements();

      // Initialize all core systems
      await this.initializeAllSystems();

      // Start monitoring and operational cycles
      this.startSystemMonitoring();
      this.startOperationalCycles();
      this.startDashboard();

      this.isRunning = true;
      this.startTime = new Date();

      console.log('🎉 === AUTONOMOUS OPERATION ACTIVE ===');
      console.log('📊 Dashboard: http://localhost:3002');
      console.log('🤖 All systems online and learning...');

    } catch (error) {
      console.error('❌ Failed to start autonomous operation:', error);
      throw error;
    }
  }

  /**
   * 🛑 STOP AUTONOMOUS OPERATION
   */
  async stopAutonomousOperation(): Promise<void> {
    try {
      console.log('🛑 Stopping autonomous operation...');

      // Clear all intervals
      this.intervals.forEach(interval => clearInterval(interval));
      this.intervals = [];

      // Close server
      if (this.server) {
        this.server.close();
      }

      this.isRunning = false;
      console.log('✅ Autonomous operation stopped');

    } catch (error) {
      console.error('❌ Error stopping autonomous operation:', error);
    }
  }

  /**
   * 🔧 VALIDATE SYSTEM REQUIREMENTS
   */
  private async validateSystemRequirements(): Promise<void> {
    console.log('🔧 Validating system requirements...');

    // Validate environment variables
    const envValidation = validateEnvironment();
    if (!envValidation.valid) {
      throw new Error(`Missing required environment variables: ${envValidation.missing.join(', ')}`);
    }

    if (envValidation.warnings.length > 0) {
      console.warn(`⚠️ Optional environment variables missing: ${envValidation.warnings.join(', ')}`);
    }

    // Check budget configuration
    const budgetConfig = getBudgetConfig();
    if (!budgetConfig.OPERATIONS_ALLOWED) {
      throw new Error('Operations not allowed - check budget configuration');
    }

    console.log('✅ System requirements validated');
  }

  /**
   * 🧠 INITIALIZE ALL SYSTEMS
   */
  private async initializeAllSystems(): Promise<void> {
    console.log('🧠 Initializing all intelligence systems...');

    try {
      // Initialize posting engine
      await this.postingEngine.initialize();
      this.updateComponentStatus('posting_engine', 'active');

      // Initialize growth master (this initializes other intelligence components)
      await this.growthMaster.initialize();
      this.updateComponentStatus('growth_master', 'active');

      // All engines are ready
      this.updateComponentStatus('reply_engine', 'active');
      this.updateComponentStatus('engagement_engine', 'active');
      this.updateComponentStatus('optimization_loop', 'active');

      console.log('✅ All systems initialized successfully');

    } catch (error) {
      console.error('❌ Error initializing systems:', error);
      throw error;
    }
  }

  /**
   * 🔄 START OPERATIONAL CYCLES
   * Start all autonomous operational cycles with intelligent scheduling
   */
  private startOperationalCycles(): Promise<void> {
    console.log('🔄 Starting operational cycles...');

    // Posting cycle - every 2 hours with intelligent decisions
    this.intervals.push(setInterval(async () => {
      try {
        await this.runPostingCycle();
      } catch (error) {
        console.error('❌ Posting cycle error:', error);
        this.updateComponentStatus('posting_engine', 'error', [error.message]);
      }
    }, 2 * 60 * 60 * 1000)); // 2 hours

    // Reply cycle - every 4 hours
    this.intervals.push(setInterval(async () => {
      try {
        await this.runReplyCycle();
      } catch (error) {
        console.error('❌ Reply cycle error:', error);
        this.updateComponentStatus('reply_engine', 'error', [error.message]);
      }
    }, 4 * 60 * 60 * 1000)); // 4 hours

    // Engagement cycle - every 3 hours
    this.intervals.push(setInterval(async () => {
      try {
        await this.runEngagementCycle();
      } catch (error) {
        console.error('❌ Engagement cycle error:', error);
        this.updateComponentStatus('engagement_engine', 'error', [error.message]);
      }
    }, 3 * 60 * 60 * 1000)); // 3 hours

    // Daily optimization check - every hour (will only run at 4 AM UTC)
    this.intervals.push(setInterval(async () => {
      try {
        if (this.optimizationLoop.shouldRunOptimization()) {
          await this.runDailyOptimization();
        }
      } catch (error) {
        console.error('❌ Optimization check error:', error);
        this.updateComponentStatus('optimization_loop', 'error', [error.message]);
      }
    }, 60 * 60 * 1000)); // 1 hour

    // System health monitoring - every 15 minutes
    this.intervals.push(setInterval(async () => {
      try {
        await this.updateSystemHealth();
      } catch (error) {
        console.error('❌ Health monitoring error:', error);
      }
    }, 15 * 60 * 1000)); // 15 minutes

    // Start immediate cycles (with delays to avoid overwhelming)
    setTimeout(() => this.runPostingCycle(), 30000); // 30 seconds
    setTimeout(() => this.runEngagementCycle(), 60000); // 1 minute
    setTimeout(() => this.runReplyCycle(), 90000); // 1.5 minutes

    console.log('✅ All operational cycles started');
    return Promise.resolve();
  }

  /**
   * 📝 RUN POSTING CYCLE
   */
  private async runPostingCycle(): Promise<void> {
    console.log('📝 === AUTONOMOUS POSTING CYCLE ===');
    
    try {
      const result = await this.postingEngine.executeIntelligentPost();
      
      if (result.success) {
        console.log(`✅ Posted: "${result.content?.substring(0, 50)}..."`);
        this.operationalMetrics.posting.totalPosts++;
        this.operationalMetrics.posting.lastPostTime = new Date();
        
        // Update success rate
        const successCount = this.operationalMetrics.posting.totalPosts;
        this.operationalMetrics.posting.successRate = successCount / (successCount + 1);
      } else {
        console.log(`ℹ️ Posting skipped: ${result.error}`);
      }

      this.updateComponentStatus('posting_engine', 'active', [], {
        lastResult: result.success ? 'success' : 'skipped',
        reason: result.error || 'Posted successfully'
      });

    } catch (error) {
      console.error('❌ Posting cycle failed:', error);
      this.updateComponentStatus('posting_engine', 'error', [error.message]);
    }
  }

  /**
   * 💬 RUN REPLY CYCLE
   */
  private async runReplyCycle(): Promise<void> {
    console.log('💬 === INTELLIGENT REPLY CYCLE ===');
    
    try {
      await this.replyEngine.runReplyCycle();
      this.operationalMetrics.engagement.replyCount++;
      this.updateComponentStatus('reply_engine', 'active');
    } catch (error) {
      console.error('❌ Reply cycle failed:', error);
      this.updateComponentStatus('reply_engine', 'error', [error.message]);
    }
  }

  /**
   * 🤝 RUN ENGAGEMENT CYCLE
   */
  private async runEngagementCycle(): Promise<void> {
    console.log('🤝 === AUTONOMOUS ENGAGEMENT CYCLE ===');
    
    try {
      await this.engagementEngine.runEngagementCycle();
      
      const analytics = await this.engagementEngine.getEngagementAnalytics();
      this.operationalMetrics.engagement.totalActions = analytics.totalLikes + analytics.totalFollows;
      this.operationalMetrics.engagement.likeCount = analytics.totalLikes;
      this.operationalMetrics.engagement.followCount = analytics.totalFollows;
      this.operationalMetrics.engagement.followbackRate = analytics.followbackRate;
      
      this.updateComponentStatus('engagement_engine', 'active', [], {
        dailyActions: analytics.totalLikes + analytics.totalFollows,
        successRate: analytics.successRate,
        roi: analytics.engagementROI
      });
    } catch (error) {
      console.error('❌ Engagement cycle failed:', error);
      this.updateComponentStatus('engagement_engine', 'error', [error.message]);
    }
  }

  /**
   * 🧠 RUN DAILY OPTIMIZATION
   */
  private async runDailyOptimization(): Promise<void> {
    console.log('🧠 === DAILY OPTIMIZATION CYCLE ===');
    
    try {
      const report = await this.optimizationLoop.runDailyOptimization();
      
      this.operationalMetrics.intelligence.optimizationCycles++;
      this.operationalMetrics.intelligence.lastOptimization = new Date();
      this.operationalMetrics.intelligence.strategicInsights = report.insights.improvementAreas.length;
      
      this.updateComponentStatus('optimization_loop', 'active', [], {
        lastReport: report.date,
        expectedImpact: report.expectedImpact,
        recommendations: report.recommendations.length
      });

      console.log('🎉 Daily optimization complete - system intelligence enhanced!');
    } catch (error) {
      console.error('❌ Daily optimization failed:', error);
      this.updateComponentStatus('optimization_loop', 'error', [error.message]);
    }
  }

  /**
   * 📊 START SYSTEM MONITORING
   */
  private startSystemMonitoring(): void {
    console.log('📊 Starting system monitoring...');
    
    // Immediate health check
    this.updateSystemHealth();
    
    console.log('✅ System monitoring active');
  }

  /**
   * 🌐 START DASHBOARD
   */
  private startDashboard(): void {
    const PORT = 3002;
    
    this.server = this.app.listen(PORT, () => {
      console.log(`🌐 Dashboard server running on http://localhost:${PORT}`);
    });
  }

  /**
   * 🏗️ SETUP EXPRESS APP
   */
  private setupExpressApp(): void {
    this.app = express();
    this.app.use(express.json());
    this.app.use(express.static('public'));

    // Dashboard endpoint
    this.app.get('/', (req, res) => {
      res.send(this.generateDashboardHTML());
    });

    // API endpoints
    this.app.get('/api/health', (req, res) => {
      res.json(this.systemHealth);
    });

    this.app.get('/api/metrics', (req, res) => {
      res.json(this.operationalMetrics);
    });

    this.app.get('/api/status', (req, res) => {
      res.json({
        isRunning: this.isRunning,
        startTime: this.startTime?.toISOString(),
        uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
        systemHealth: this.systemHealth.overall,
        budgetStatus: getBudgetConfig()
      });
    });

    // Control endpoints
    this.app.post('/api/force-post', async (req, res) => {
      try {
        const result = await this.postingEngine.executeIntelligentPost();
        res.json({ success: true, result });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/force-optimization', async (req, res) => {
      try {
        const report = await this.optimizationLoop.runDailyOptimization();
        res.json({ success: true, report });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
  }

  /**
   * 🔧 HELPER METHODS
   */
  private initializeCoreComponents(): void {
    this.postingEngine = EnhancedAutonomousPostingEngine.getInstance();
    this.replyEngine = IntelligentReplyEngine.getInstance();
    this.engagementEngine = AutonomousEngagementEngine.getInstance();
    this.optimizationLoop = EnhancedDailyOptimizationLoop.getInstance();
    this.growthMaster = IntelligentGrowthMaster.getInstance();
  }

  private initializeSystemHealth(): void {
    this.systemHealth = {
      overall: 'good',
      components: {
        posting_engine: { status: 'offline', lastCheck: new Date() },
        reply_engine: { status: 'offline', lastCheck: new Date() },
        engagement_engine: { status: 'offline', lastCheck: new Date() },
        optimization_loop: { status: 'offline', lastCheck: new Date() },
        growth_master: { status: 'offline', lastCheck: new Date() }
      },
      performance: {
        postsToday: 0,
        engagementToday: 0,
        followerGrowth24h: 0,
        systemUptime: 0,
        budgetUtilization: 0
      },
      nextActions: []
    };
  }

  private initializeOperationalMetrics(): void {
    this.operationalMetrics = {
      posting: {
        totalPosts: 0,
        successRate: 0,
        averageEngagement: 0,
        lastPostTime: null
      },
      engagement: {
        totalActions: 0,
        replyCount: 0,
        likeCount: 0,
        followCount: 0,
        followbackRate: 0
      },
      growth: {
        dailyFollowerGrowth: 0,
        weeklyGrowthTrend: 0,
        engagementRate: 0,
        viralTweetCount: 0
      },
      intelligence: {
        optimizationCycles: 0,
        lastOptimization: null,
        learningAccuracy: 0,
        strategicInsights: 0
      }
    };
  }

  private updateComponentStatus(component: string, status: 'active' | 'warning' | 'error' | 'offline', errors: string[] = [], metrics?: any): void {
    this.systemHealth.components[component] = {
      status,
      lastCheck: new Date(),
      metrics,
      errors: errors.length > 0 ? errors : undefined
    };

    // Update overall health
    this.updateOverallHealth();
  }

  private updateOverallHealth(): void {
    const statuses = Object.values(this.systemHealth.components).map(c => c.status);
    
    if (statuses.includes('error')) {
      this.systemHealth.overall = 'critical';
    } else if (statuses.includes('warning')) {
      this.systemHealth.overall = 'degraded';
    } else if (statuses.every(s => s === 'active')) {
      this.systemHealth.overall = 'excellent';
    } else {
      this.systemHealth.overall = 'good';
    }
  }

  private async updateSystemHealth(): Promise<void> {
    try {
      // Update performance metrics
      if (this.startTime) {
        this.systemHealth.performance.systemUptime = Date.now() - this.startTime.getTime();
      }

      // Check budget utilization
      const budgetStatus = await EmergencyBudgetLockdown.isLockedDown();
      this.systemHealth.performance.budgetUtilization = 
        budgetStatus.totalSpent / budgetStatus.dailyLimit;

      // Update growth metrics (simplified)
      this.systemHealth.performance.postsToday = this.operationalMetrics.posting.totalPosts;
      this.systemHealth.performance.engagementToday = this.operationalMetrics.engagement.totalActions;

      // Generate next actions
      this.systemHealth.nextActions = this.generateNextActions();

    } catch (error) {
      console.error('❌ Error updating system health:', error);
    }
  }

  private generateNextActions(): string[] {
    const actions = [];
    const now = new Date();
    
    // Check for posting
    if (!this.operationalMetrics.posting.lastPostTime || 
        (now.getTime() - this.operationalMetrics.posting.lastPostTime.getTime()) > 4 * 60 * 60 * 1000) {
      actions.push('Schedule next intelligent post');
    }

    // Check for optimization
    if (this.optimizationLoop.shouldRunOptimization()) {
      actions.push('Run daily optimization cycle');
    }

    // Check for engagement
    if (this.operationalMetrics.engagement.totalActions < getGrowthTargets().dailyFollowerGrowth) {
      actions.push('Increase strategic engagement activity');
    }

    return actions.length > 0 ? actions : ['All systems operating optimally'];
  }

  private generateDashboardHTML(): string {
    const uptime = this.startTime ? Math.floor((Date.now() - this.startTime.getTime()) / 1000) : 0;
    const uptimeStr = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`;

    return `
<!DOCTYPE html>
<html>
<head>
    <title>🤖 Autonomous Twitter Growth Master</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            min-height: 100vh;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 30px; }
        .status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .card { 
            background: rgba(255,255,255,0.1); 
            backdrop-filter: blur(10px); 
            border-radius: 15px; 
            padding: 20px; 
            border: 1px solid rgba(255,255,255,0.2); 
        }
        .metric { text-align: center; margin: 10px 0; }
        .metric-value { font-size: 2em; font-weight: bold; }
        .metric-label { opacity: 0.8; }
        .status-${this.systemHealth.overall} { border-left: 4px solid ${this.systemHealth.overall === 'excellent' ? '#4CAF50' : this.systemHealth.overall === 'good' ? '#8BC34A' : this.systemHealth.overall === 'degraded' ? '#FF9800' : '#F44336'}; }
        .component { margin: 10px 0; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px; }
        .component-active { border-left: 3px solid #4CAF50; }
        .component-error { border-left: 3px solid #F44336; }
        .actions { list-style: none; padding: 0; }
        .actions li { padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .refresh-btn { 
            background: rgba(255,255,255,0.2); 
            border: none; 
            color: white; 
            padding: 10px 20px; 
            border-radius: 25px; 
            cursor: pointer; 
            backdrop-filter: blur(10px);
        }
        .refresh-btn:hover { background: rgba(255,255,255,0.3); }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 Autonomous Twitter Growth Master</h1>
            <p>Intelligent, Self-Optimizing Twitter Bot for Maximum Follower Growth</p>
            <button class="refresh-btn" onclick="location.reload()">🔄 Refresh Dashboard</button>
        </div>
        
        <div class="status-grid">
            <div class="card status-${this.systemHealth.overall}">
                <h3>🏥 System Health</h3>
                <div class="metric">
                    <div class="metric-value">${this.systemHealth.overall.toUpperCase()}</div>
                    <div class="metric-label">Overall Status</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${uptimeStr}</div>
                    <div class="metric-label">Uptime</div>
                </div>
            </div>
            
            <div class="card">
                <h3>📝 Posting Engine</h3>
                <div class="metric">
                    <div class="metric-value">${this.operationalMetrics.posting.totalPosts}</div>
                    <div class="metric-label">Posts Today</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${(this.operationalMetrics.posting.successRate * 100).toFixed(0)}%</div>
                    <div class="metric-label">Success Rate</div>
                </div>
            </div>
            
            <div class="card">
                <h3>🤝 Engagement</h3>
                <div class="metric">
                    <div class="metric-value">${this.operationalMetrics.engagement.totalActions}</div>
                    <div class="metric-label">Actions Today</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${(this.operationalMetrics.engagement.followbackRate * 100).toFixed(0)}%</div>
                    <div class="metric-label">Followback Rate</div>
                </div>
            </div>
            
            <div class="card">
                <h3>📊 Growth</h3>
                <div class="metric">
                    <div class="metric-value">+${this.operationalMetrics.growth.dailyFollowerGrowth}</div>
                    <div class="metric-label">Followers Today</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${(this.operationalMetrics.growth.engagementRate * 100).toFixed(1)}%</div>
                    <div class="metric-label">Engagement Rate</div>
                </div>
            </div>
            
            <div class="card">
                <h3>💰 Budget</h3>
                <div class="metric">
                    <div class="metric-value">${(this.systemHealth.performance.budgetUtilization * 100).toFixed(0)}%</div>
                    <div class="metric-label">Budget Used</div>
                </div>
                <div class="metric">
                    <div class="metric-value">$${getBudgetConfig().ABSOLUTE_DAILY_LIMIT.toFixed(2)}</div>
                    <div class="metric-label">Daily Limit</div>
                </div>
            </div>
            
            <div class="card">
                <h3>🧠 Intelligence</h3>
                <div class="metric">
                    <div class="metric-value">${this.operationalMetrics.intelligence.optimizationCycles}</div>
                    <div class="metric-label">Optimization Cycles</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${this.operationalMetrics.intelligence.strategicInsights}</div>
                    <div class="metric-label">Strategic Insights</div>
                </div>
            </div>
        </div>
        
        <div class="status-grid">
            <div class="card">
                <h3>🔧 System Components</h3>
                ${Object.entries(this.systemHealth.components).map(([name, component]) => 
                  `<div class="component component-${component.status}">
                    <strong>${name.replace(/_/g, ' ').toUpperCase()}</strong>: ${component.status}
                    <br><small>Last Check: ${component.lastCheck.toLocaleTimeString()}</small>
                  </div>`
                ).join('')}
            </div>
            
            <div class="card">
                <h3>🎯 Next Actions</h3>
                <ul class="actions">
                  ${this.systemHealth.nextActions.map(action => `<li>• ${action}</li>`).join('')}
                </ul>
            </div>
        </div>
        
        <div class="card" style="text-align: center; margin-top: 20px;">
            <p><strong>🤖 Fully Autonomous Twitter Growth System</strong></p>
            <p>Target: ${getGrowthTargets().dailyFollowerGrowth}+ followers/day • ${(getGrowthTargets().engagementRate * 100)}%+ engagement rate • ${(getGrowthTargets().viralHitRate * 100)}%+ viral hit rate</p>
            <p><small>Last Updated: ${new Date().toLocaleString()}</small></p>
        </div>
    </div>
    
    <script>
        // Auto-refresh every 30 seconds
        setInterval(() => {
            location.reload();
        }, 30000);
    </script>
</body>
</html>`;
  }

  /**
   * 📊 PUBLIC INTERFACE METHODS
   */
  getSystemStatus(): any {
    return {
      isRunning: this.isRunning,
      startTime: this.startTime?.toISOString(),
      systemHealth: this.systemHealth,
      operationalMetrics: this.operationalMetrics,
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0
    };
  }

  async forcePost(): Promise<any> {
    return await this.postingEngine.executeIntelligentPost();
  }

  async forceOptimization(): Promise<any> {
    return await this.optimizationLoop.runDailyOptimization();
  }

  async getGrowthAnalytics(): Promise<any> {
    return await this.growthMaster.getCurrentGrowthMetrics();
  }
} 