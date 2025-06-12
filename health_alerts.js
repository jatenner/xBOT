#!/usr/bin/env node

const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class HealthAlerter {
  constructor() {
    this.alertsFile = 'health_alerts.json';
    this.lastCheckFile = 'last_health_check.json';
  }

  async checkHealth() {
    const timestamp = new Date().toISOString();
    const alerts = [];

    try {
      // Check if bot is running
      const { stdout } = await execAsync('ps aux | grep "tsx src/index.ts" | grep -v grep');
      
      if (!stdout.trim()) {
        alerts.push({
          level: 'CRITICAL',
          message: 'Bot process not running',
          timestamp,
          action: 'Restart with: npm run dev'
        });
      } else {
        const processInfo = stdout.trim().split(/\s+/);
        const cpu = parseFloat(processInfo[2]);
        const memory = parseFloat(processInfo[3]);

        // Check resource usage
        if (memory > 5.0) {
          alerts.push({
            level: 'WARNING',
            message: `High memory usage: ${memory}%`,
            timestamp,
            action: 'Monitor for memory leaks'
          });
        }

        if (cpu > 10.0) {
          alerts.push({
            level: 'WARNING',
            message: `High CPU usage: ${cpu}%`,
            timestamp,
            action: 'Check for processing bottlenecks'
          });
        }

        // Check for recent activity (simulated)
        const inactivityHours = this.getInactivityHours();
        if (inactivityHours > 2) {
          alerts.push({
            level: 'WARNING',
            message: `Bot inactive for ${inactivityHours} hours`,
            timestamp,
            action: 'Check logs and restart if needed'
          });
        }
      }

      // Rate limit health check
      const rateLimitStatus = await this.checkRateLimits();
      if (rateLimitStatus.issues.length > 0) {
        alerts.push(...rateLimitStatus.issues);
      }

      // Save alerts if any
      if (alerts.length > 0) {
        await this.saveAlerts(alerts);
        this.displayAlerts(alerts);
      } else {
        console.log('✅ All systems healthy - no alerts');
      }

      // Save last check time
      fs.writeFileSync(this.lastCheckFile, JSON.stringify({
        timestamp,
        alertCount: alerts.length,
        status: alerts.length === 0 ? 'HEALTHY' : 'ISSUES_DETECTED'
      }));

      return {
        healthy: alerts.length === 0,
        alerts,
        timestamp
      };

    } catch (error) {
      const criticalAlert = {
        level: 'CRITICAL',
        message: `Health check failed: ${error.message}`,
        timestamp,
        action: 'Investigate system issues'
      };
      
      await this.saveAlerts([criticalAlert]);
      this.displayAlerts([criticalAlert]);
      
      return {
        healthy: false,
        alerts: [criticalAlert],
        timestamp
      };
    }
  }

  getInactivityHours() {
    try {
      if (fs.existsSync(this.lastCheckFile)) {
        const lastCheck = JSON.parse(fs.readFileSync(this.lastCheckFile, 'utf8'));
        const hoursSince = (Date.now() - new Date(lastCheck.timestamp).getTime()) / (1000 * 60 * 60);
        return Math.max(0, hoursSince - 1);
      }
    } catch (error) {
      // First run
    }
    return 0;
  }

  async checkRateLimits() {
    const issues = [];
    return { issues };
  }

  displayAlerts(alerts) {
    console.log('🚨 === HEALTH ALERTS ===\n');
    
    alerts.forEach((alert, i) => {
      const emoji = alert.level === 'CRITICAL' ? '🚨' : '⚠️';
      console.log(`${emoji} ${alert.level}: ${alert.message}`);
      console.log(`   ⏰ Time: ${alert.timestamp}`);
      console.log(`   💡 Action: ${alert.action}\n`);
    });
  }

  async saveAlerts(alerts) {
    try {
      let allAlerts = [];
      if (fs.existsSync(this.alertsFile)) {
        const existing = fs.readFileSync(this.alertsFile, 'utf8');
        allAlerts = JSON.parse(existing);
      }

      allAlerts.push(...alerts);
      
      if (allAlerts.length > 100) {
        allAlerts = allAlerts.slice(-100);
      }

      fs.writeFileSync(this.alertsFile, JSON.stringify(allAlerts, null, 2));
      
    } catch (error) {
      console.error('Error saving alerts:', error.message);
    }
  }

  async getRecentAlerts() {
    try {
      if (fs.existsSync(this.alertsFile)) {
        const alerts = JSON.parse(fs.readFileSync(this.alertsFile, 'utf8'));
        return alerts.slice(-10);
      }
    } catch (error) {
      console.error('Error reading alerts:', error.message);
    }
    return [];
  }
}

const command = process.argv[2] || 'check';

async function main() {
  const alerter = new HealthAlerter();

  switch (command) {
    case 'check':
      await alerter.checkHealth();
      break;
      
    case 'history':
      const recentAlerts = await alerter.getRecentAlerts();
      if (recentAlerts.length > 0) {
        console.log('📋 === RECENT HEALTH ALERTS ===\n');
        recentAlerts.forEach((alert, i) => {
          const emoji = alert.level === 'CRITICAL' ? '🚨' : '⚠️';
          console.log(`${emoji} ${alert.level}: ${alert.message}`);
          console.log(`   ⏰ ${alert.timestamp}\n`);
        });
      } else {
        console.log('✅ No recent health alerts');
      }
      break;
      
    default:
      console.log('Usage: node health_alerts.js [check|history]');
      break;
  }
}

main(); 