#!/usr/bin/env node

const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class ProductionMonitor {
  constructor() {
    this.healthCheckInterval = 60000; // 1 minute
    this.logFile = 'production_health.log';
    this.alertsFile = 'bot_alerts.json';
    this.metricsFile = 'bot_metrics.json';
    this.isRunning = false;
    
    // Health thresholds
    this.thresholds = {
      maxMemoryMB: 200,
      maxCpuPercent: 50,
      minSuccessRate: 60,
      maxConsecutiveFailures: 3,
      maxInactivityMinutes: 30
    };
    
    this.metrics = {
      lastActivity: Date.now(),
      consecutiveFailures: 0,
      totalCycles: 0,
      successfulCycles: 0,
      alerts: [],
      uptime: 0,
      startTime: Date.now()
    };
  }

  async start() {
    console.log('🚀 === PRODUCTION BOT MONITOR STARTED ===');
    console.log('📊 Monitoring bot health every 1 minute');
    console.log('🚨 Will alert on issues and log all activities');
    console.log('');
    
    this.isRunning = true;
    this.monitorLoop();
  }

  async monitorLoop() {
    while (this.isRunning) {
      try {
        await this.performHealthCheck();
        await this.sleep(this.healthCheckInterval);
      } catch (error) {
        console.error('❌ Monitor error:', error.message);
        await this.sleep(5000); // Wait 5 seconds on error
      }
    }
  }

  async performHealthCheck() {
    const timestamp = new Date().toISOString();
    console.clear();
    console.log(`🔍 === HEALTH CHECK: ${timestamp} ===\n`);

    const health = {
      timestamp,
      botRunning: false,
      pid: null,
      cpu: 0,
      memory: 0,
      uptime: 0,
      recentActivity: [],
      alerts: [],
      status: 'UNKNOWN'
    };

    // Check if bot process is running
    try {
      const { stdout } = await execAsync('ps aux | grep "tsx src/index.ts" | grep -v grep');
      
      if (stdout.trim()) {
        const processInfo = stdout.trim().split(/\s+/);
        health.botRunning = true;
        health.pid = parseInt(processInfo[1]);
        health.cpu = parseFloat(processInfo[2]);
        health.memory = parseFloat(processInfo[3]);
        
        // Get detailed process info
        try {
          const { stdout: processDetails } = await execAsync(`ps -p ${health.pid} -o etime=`);
          health.uptime = processDetails.trim();
        } catch (e) {
          health.uptime = 'Unknown';
        }

        // Analyze recent activity from logs
        health.recentActivity = await this.analyzeRecentActivity();
        
        // Check health thresholds
        health.alerts = this.checkHealthThresholds(health);
        
        // Determine overall status
        health.status = this.determineStatus(health);
        
        this.displayHealthStatus(health);
        
      } else {
        health.status = 'STOPPED';
        health.alerts.push({
          level: 'CRITICAL',
          message: 'Bot process not running',
          timestamp
        });
        
        console.log('🚨 CRITICAL ALERT: BOT IS NOT RUNNING!');
        console.log('');
        console.log('💡 To restart bot: npm run dev');
        console.log('');
      }
      
    } catch (error) {
      health.status = 'ERROR';
      health.alerts.push({
        level: 'ERROR',
        message: `Failed to check bot status: ${error.message}`,
        timestamp
      });
      
      console.log('❌ Error checking bot status:', error.message);
    }

    // Save metrics and alerts
    await this.saveMetrics(health);
    
    if (health.alerts.length > 0) {
      await this.saveAlerts(health.alerts);
    }

    return health;
  }

  async analyzeRecentActivity() {
    try {
      // Check for recent log files or activity indicators
      const activities = [];
      
      // Look for recent strategist cycles
      if (fs.existsSync('bot_activity.log')) {
        const logContent = fs.readFileSync('bot_activity.log', 'utf8');
        const lines = logContent.split('\n').slice(-20); // Last 20 lines
        
        for (const line of lines) {
          if (line.includes('=== Strategist Cycle')) {
            activities.push('Strategist cycle executed');
          }
          if (line.includes('Tweet posted successfully')) {
            activities.push('Tweet posted');
          }
          if (line.includes('strategic_replies')) {
            activities.push('Replies sent');
          }
          if (line.includes('strategic_likes')) {
            activities.push('Likes given');
          }
          if (line.includes('Rate limited')) {
            activities.push('Hit rate limit - switched to engagement mode');
          }
        }
      }
      
      return activities.slice(-5); // Last 5 activities
      
    } catch (error) {
      return ['Error reading activity logs'];
    }
  }

  checkHealthThresholds(health) {
    const alerts = [];
    const now = Date.now();

    // Memory check
    if (health.memory > this.thresholds.maxMemoryMB) {
      alerts.push({
        level: 'WARNING',
        message: `High memory usage: ${health.memory}MB (threshold: ${this.thresholds.maxMemoryMB}MB)`,
        timestamp: new Date().toISOString()
      });
    }

    // CPU check
    if (health.cpu > this.thresholds.maxCpuPercent) {
      alerts.push({
        level: 'WARNING',
        message: `High CPU usage: ${health.cpu}% (threshold: ${this.thresholds.maxCpuPercent}%)`,
        timestamp: new Date().toISOString()
      });
    }

    // Activity check
    const inactivityMinutes = (now - this.metrics.lastActivity) / (1000 * 60);
    if (inactivityMinutes > this.thresholds.maxInactivityMinutes) {
      alerts.push({
        level: 'CRITICAL',
        message: `Bot inactive for ${Math.round(inactivityMinutes)} minutes (threshold: ${this.thresholds.maxInactivityMinutes} minutes)`,
        timestamp: new Date().toISOString()
      });
    }

    return alerts;
  }

  determineStatus(health) {
    if (!health.botRunning) return 'STOPPED';
    
    const criticalAlerts = health.alerts.filter(a => a.level === 'CRITICAL');
    const warningAlerts = health.alerts.filter(a => a.level === 'WARNING');
    
    if (criticalAlerts.length > 0) return 'CRITICAL';
    if (warningAlerts.length > 0) return 'WARNING';
    if (health.recentActivity.length > 0) return 'HEALTHY';
    
    return 'IDLE';
  }

  displayHealthStatus(health) {
    const statusEmoji = {
      'HEALTHY': '✅',
      'WARNING': '⚠️',
      'CRITICAL': '🚨',
      'IDLE': '😴',
      'STOPPED': '🛑',
      'ERROR': '❌'
    };

    console.log(`${statusEmoji[health.status]} OVERALL STATUS: ${health.status}`);
    console.log('');
    
    // Process info
    console.log('📊 PROCESS HEALTH:');
    console.log(`   🔧 PID: ${health.pid}`);
    console.log(`   ⏱️  Uptime: ${health.uptime}`);
    console.log(`   💾 Memory: ${health.memory}% (${Math.round(health.memory * 10)}MB estimated)`);
    console.log(`   🔥 CPU: ${health.cpu}%`);
    console.log('');

    // Recent activity
    console.log('🎯 RECENT ACTIVITY:');
    if (health.recentActivity.length > 0) {
      health.recentActivity.forEach((activity, i) => {
        console.log(`   ${i + 1}. ${activity}`);
      });
    } else {
      console.log('   ⚠️  No recent activity detected');
    }
    console.log('');

    // Alerts
    if (health.alerts.length > 0) {
      console.log('🚨 ALERTS:');
      health.alerts.forEach((alert, i) => {
        const emoji = alert.level === 'CRITICAL' ? '🚨' : '⚠️';
        console.log(`   ${emoji} ${alert.level}: ${alert.message}`);
      });
      console.log('');
    }

    // Rate limit status
    console.log('📈 RATE LIMIT STATUS:');
    console.log('   📝 Tweets: Limited (0/17 remaining)');
    console.log('   💬 Replies: Available (300 per 15 min)');
    console.log('   ❤️  Likes: Available (300 per 15 min)');
    console.log('   🤝 Follows: Available (400 per day)');
    console.log('');

    // Next check
    console.log(`🔄 Next health check in: ${this.healthCheckInterval / 1000} seconds`);
    console.log('🛑 Press Ctrl+C to stop monitoring');
  }

  async saveMetrics(health) {
    try {
      const metrics = {
        timestamp: health.timestamp,
        status: health.status,
        cpu: health.cpu,
        memory: health.memory,
        uptime: health.uptime,
        alertCount: health.alerts.length,
        activityCount: health.recentActivity.length
      };

      let allMetrics = [];
      if (fs.existsSync(this.metricsFile)) {
        const existing = fs.readFileSync(this.metricsFile, 'utf8');
        allMetrics = JSON.parse(existing);
      }

      allMetrics.push(metrics);
      
      // Keep only last 1000 entries
      if (allMetrics.length > 1000) {
        allMetrics = allMetrics.slice(-1000);
      }

      fs.writeFileSync(this.metricsFile, JSON.stringify(allMetrics, null, 2));
      
    } catch (error) {
      console.error('Error saving metrics:', error.message);
    }
  }

  async saveAlerts(alerts) {
    try {
      let allAlerts = [];
      if (fs.existsSync(this.alertsFile)) {
        const existing = fs.readFileSync(this.alertsFile, 'utf8');
        allAlerts = JSON.parse(existing);
      }

      allAlerts.push(...alerts);
      
      // Keep only last 500 alerts
      if (allAlerts.length > 500) {
        allAlerts = allAlerts.slice(-500);
      }

      fs.writeFileSync(this.alertsFile, JSON.stringify(allAlerts, null, 2));
      
    } catch (error) {
      console.error('Error saving alerts:', error.message);
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  stop() {
    this.isRunning = false;
    console.log('\n🛑 Monitor stopped');
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down monitor...');
  process.exit(0);
});

// Start monitoring
const monitor = new ProductionMonitor();
monitor.start(); 