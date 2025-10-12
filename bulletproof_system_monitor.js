#!/usr/bin/env node

/**
 * BULLETPROOF SYSTEM MONITOR
 * Direct API monitoring bypassing Railway CLI issues
 */

const https = require('https');
const fs = require('fs');

const SYSTEM_URL = 'https://xbot-production-844b.up.railway.app';
const MONITOR_INTERVAL = 10000; // 10 seconds
const LOG_FILE = 'system_monitor.log';

class BulletproofMonitor {
  constructor() {
    this.stats = {
      checks: 0,
      successes: 0,
      failures: 0,
      lastSuccess: null,
      lastFailure: null,
      uptime: 0,
      posts: 0,
      errors: 0
    };
    
    console.log('🚀 BULLETPROOF SYSTEM MONITOR STARTING');
    console.log('=====================================');
    console.log('✨ Features:');
    console.log('   🔄 Direct API monitoring (bypasses Railway CLI)');
    console.log('   📊 Real-time system health');
    console.log('   🩺 Posting queue monitoring');
    console.log('   🧬 Hook evolution tracking');
    console.log('   📈 Learning system metrics');
    console.log('');
  }

  async makeRequest(endpoint) {
    return new Promise((resolve, reject) => {
      const url = `${SYSTEM_URL}${endpoint}`;
      const req = https.get(url, { timeout: 10000 }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve({ raw: data });
          }
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  async checkSystemHealth() {
    try {
      this.stats.checks++;
      const timestamp = new Date().toISOString();
      
      // Get system status
      const status = await this.makeRequest('/status');
      const learning = await this.makeRequest('/learning/status');
      
      if (status.ok) {
        this.stats.successes++;
        this.stats.lastSuccess = timestamp;
        this.stats.uptime = status.uptime_seconds || 0;
        
        // Extract key metrics
        const mode = status.mode || 'unknown';
        const posting = status.postingEnabled ? '✅' : '❌';
        const timers = status.timers || {};
        const jobStats = status.jobStats || {};
        
        // Learning system metrics
        const learningHealth = learning.health_metrics?.overall_health || 'unknown';
        const postsTracked = learning.system_status?.total_posts_tracked || 0;
        
        console.log(`\n⏰ ${new Date().toLocaleTimeString()} | Check #${this.stats.checks}`);
        console.log(`🟢 SYSTEM HEALTHY | Mode: ${mode} | Posting: ${posting}`);
        console.log(`⏱️  Uptime: ${Math.floor(this.stats.uptime / 60)}m ${Math.floor(this.stats.uptime % 60)}s`);
        console.log(`🔄 Timers: Plan=${timers.plan ? '✅' : '❌'} Reply=${timers.reply ? '✅' : '❌'} Post=${timers.posting ? '✅' : '❌'} Learn=${timers.learn ? '✅' : '❌'}`);
        console.log(`📊 Jobs: Plans=${jobStats.planRuns || 0} Posts=${jobStats.postingRuns || 0} Replies=${jobStats.replyRuns || 0}`);
        console.log(`🧠 Learning: Health=${learningHealth} | Posts Tracked=${postsTracked}`);
        
        // Check for recent activity
        if (status.lastPostAttemptAt) {
          const lastPost = new Date(status.lastPostAttemptAt);
          const timeSincePost = Date.now() - lastPost.getTime();
          console.log(`📮 Last Post Attempt: ${Math.floor(timeSincePost / 60000)}m ago`);
        }
        
        // Log to file
        const logEntry = `${timestamp} | HEALTHY | Mode:${mode} Uptime:${Math.floor(this.stats.uptime/60)}m Posts:${postsTracked}\n`;
        fs.appendFileSync(LOG_FILE, logEntry);
        
      } else {
        throw new Error('System returned not ok');
      }
      
    } catch (error) {
      this.stats.failures++;
      this.stats.lastFailure = new Date().toISOString();
      
      console.log(`\n⏰ ${new Date().toLocaleTimeString()} | Check #${this.stats.checks}`);
      console.log(`🔴 SYSTEM ERROR: ${error.message}`);
      console.log(`❌ Failure Rate: ${Math.round((this.stats.failures / this.stats.checks) * 100)}%`);
      
      const logEntry = `${new Date().toISOString()} | ERROR | ${error.message}\n`;
      fs.appendFileSync(LOG_FILE, logEntry);
    }
  }

  printSummary() {
    const successRate = Math.round((this.stats.successes / this.stats.checks) * 100);
    console.log('\n📊 MONITOR SUMMARY:');
    console.log(`   Total Checks: ${this.stats.checks}`);
    console.log(`   Success Rate: ${successRate}%`);
    console.log(`   Last Success: ${this.stats.lastSuccess || 'Never'}`);
    console.log(`   System Uptime: ${Math.floor(this.stats.uptime / 60)}m`);
  }

  start() {
    console.log('🔄 Starting continuous monitoring...\n');
    
    // Initial check
    this.checkSystemHealth();
    
    // Set up interval
    const interval = setInterval(() => {
      this.checkSystemHealth();
    }, MONITOR_INTERVAL);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n\n🛑 Stopping monitor...');
      clearInterval(interval);
      this.printSummary();
      process.exit(0);
    });
  }
}

// Start the monitor
const monitor = new BulletproofMonitor();
monitor.start();
