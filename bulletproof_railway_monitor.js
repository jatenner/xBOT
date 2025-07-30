#!/usr/bin/env node

/**
 * 🚀 BULLETPROOF RAILWAY MONITOR
 * ==============================
 * Automated log monitoring that NEVER requires manual "Resume Log Stream" clicks
 * Uses Railway CLI with smart reconnection and health monitoring
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class BulletproofRailwayMonitor {
  constructor() {
    this.logProcess = null;
    this.reconnectCount = 0;
    this.maxReconnects = 999; // Unlimited
    this.reconnectDelay = 5000; // 5 seconds
    this.lastLogTime = Date.now();
    this.healthCheckInterval = 30000; // 30 seconds
    this.logBuffer = [];
    this.maxBufferSize = 1000;
    this.startTime = Date.now();
    
    // Stats
    this.stats = {
      totalLogs: 0,
      errors: 0,
      posts: 0,
      reconnects: 0,
      uptime: 0
    };
    
    this.setupSignalHandlers();
    this.startHealthMonitor();
  }

  setupSignalHandlers() {
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping Bulletproof Railway Monitor...');
      this.cleanup();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Terminating Bulletproof Railway Monitor...');
      this.cleanup();
      process.exit(0);
    });
  }

  startHealthMonitor() {
    setInterval(() => {
      this.stats.uptime = Math.floor((Date.now() - this.startTime) / 1000);
      
      // Check if logs are stale (no logs for 2 minutes)
      const timeSinceLastLog = Date.now() - this.lastLogTime;
      if (timeSinceLastLog > 120000) {
        console.log('⚠️ No logs received for 2 minutes - triggering reconnect');
        this.reconnect();
      }
      
      // Display stats every 30 seconds
      this.displayStats();
    }, this.healthCheckInterval);
  }

  displayStats() {
    const uptime = this.formatUptime(this.stats.uptime);
    console.log(`📊 Monitor Stats: ${uptime} | Logs: ${this.stats.totalLogs} | Posts: ${this.stats.posts} | Errors: ${this.stats.errors} | Reconnects: ${this.stats.reconnects}`);
  }

  formatUptime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  async start() {
    console.log('🚀 BULLETPROOF RAILWAY MONITOR - STARTING');
    console.log('=======================================');
    console.log('✨ Features:');
    console.log('   🔄 Auto-reconnection (never stops)');
    console.log('   📊 Real-time statistics');
    console.log('   🩺 Health monitoring');
    console.log('   🚫 NO manual "Resume Log Stream" needed');
    console.log('');
    
    this.connect();
  }

  connect() {
    if (this.logProcess) {
      this.logProcess.kill();
    }

    console.log(`📡 Connecting to Railway logs... (attempt ${this.reconnectCount + 1})`);
    
    this.logProcess = spawn('railway', ['logs', '--follow'], {
      stdio: 'pipe',
      shell: true
    });

    this.logProcess.stdout.on('data', (data) => {
      this.handleLogData(data.toString());
    });

    this.logProcess.stderr.on('data', (data) => {
      const error = data.toString().trim();
      if (error && !error.includes('Warning')) {
        console.error(`❌ Railway CLI Error: ${error}`);
        this.stats.errors++;
      }
    });

    this.logProcess.on('close', (code) => {
      console.log(`⚠️ Railway logs disconnected (code: ${code})`);
      this.scheduleReconnect();
    });

    this.logProcess.on('error', (error) => {
      console.error(`❌ Process Error: ${error.message}`);
      this.scheduleReconnect();
    });

    // Reset reconnect delay on successful connection
    if (this.reconnectCount === 0) {
      this.reconnectDelay = 5000;
    }
  }

  handleLogData(data) {
    const lines = data.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      this.lastLogTime = Date.now();
      this.stats.totalLogs++;
      
      // Add to buffer
      this.logBuffer.push({
        timestamp: new Date().toISOString(),
        content: line
      });
      
      // Keep buffer size manageable
      if (this.logBuffer.length > this.maxBufferSize) {
        this.logBuffer.shift();
      }
      
      // Track important events
      if (line.includes('Tweet posted successfully')) {
        this.stats.posts++;
      }
      if (line.includes('❌') || line.includes('ERROR') || line.includes('failed')) {
        this.stats.errors++;
      }
      
      // Display the log with timestamp
      const timestamp = new Date().toLocaleTimeString();
      console.log(`${timestamp} │ ${line}`);
    }
  }

  scheduleReconnect() {
    if (this.reconnectCount >= this.maxReconnects) {
      console.error('💥 Max reconnections reached. Exiting.');
      process.exit(1);
    }

    this.reconnectCount++;
    this.stats.reconnects++;
    
    console.log(`🔄 Reconnecting in ${this.reconnectDelay / 1000}s (attempt ${this.reconnectCount})...`);
    
    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);
    
    // Exponential backoff (max 30 seconds)
    this.reconnectDelay = Math.min(this.reconnectDelay * 1.2, 30000);
  }

  reconnect() {
    console.log('🔄 Force reconnecting...');
    if (this.logProcess) {
      this.logProcess.kill();
    }
    this.connect();
  }

  cleanup() {
    if (this.logProcess) {
      this.logProcess.kill();
    }
    
    // Save final stats
    const logFile = path.join(__dirname, 'railway_monitor_stats.json');
    fs.writeFileSync(logFile, JSON.stringify({
      ...this.stats,
      endTime: new Date().toISOString(),
      finalUptime: this.formatUptime(this.stats.uptime)
    }, null, 2));
    
    console.log('📊 Final stats saved to railway_monitor_stats.json');
  }
}

// Start the monitor
const monitor = new BulletproofRailwayMonitor();
monitor.start().catch(console.error);