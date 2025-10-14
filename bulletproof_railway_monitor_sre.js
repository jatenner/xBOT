#!/usr/bin/env node

/**
 * 🚀 BULLETPROOF RAILWAY MONITOR - SRE COMPLIANT VERSION
 * =====================================================
 * Reduced polling, exponential backoff, single-instance protection
 * Complies with Railway rate limits and implements proper SRE practices
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class SRECompliantRailwayMonitor {
  constructor() {
    this.logProcess = null;
    this.reconnectCount = 0;
    this.maxReconnects = 20; // Reduced from 999
    this.baseReconnectDelay = 30000; // 30 seconds base (increased from 5s)
    this.maxReconnectDelay = 300000; // 5 minutes max
    this.lastLogTime = Date.now();
    this.healthCheckInterval = 60000; // 60 seconds (increased from 30s)
    this.logBuffer = [];
    this.maxBufferSize = 1000;
    this.startTime = Date.now();
    this.lockFile = path.join(__dirname, '.railway_monitor.lock');
    
    // Rate limiting protection
    this.rateLimitBackoffMs = 60000; // 1 minute backoff for rate limits
    this.consecutiveRateLimits = 0;
    this.maxConsecutiveRateLimits = 5;
    
    // Stats
    this.stats = {
      totalLogs: 0,
      errors: 0,
      posts: 0,
      reconnects: 0,
      rateLimits: 0,
      uptime: 0
    };
    
    this.setupSignalHandlers();
    this.checkSingleInstance();
    this.startHealthMonitor();
  }

  checkSingleInstance() {
    if (fs.existsSync(this.lockFile)) {
      const lockData = fs.readFileSync(this.lockFile, 'utf8');
      const { pid, startTime } = JSON.parse(lockData);
      
      // Check if process is still running
      try {
        process.kill(pid, 0); // Test if process exists
        console.error(`❌ Another monitor is running (PID: ${pid}, started: ${startTime})`);
        console.error('   Stop it first or remove .railway_monitor.lock');
        process.exit(1);
      } catch (e) {
        // Process doesn't exist, remove stale lock
        fs.unlinkSync(this.lockFile);
      }
    }
    
    // Create lock file
    fs.writeFileSync(this.lockFile, JSON.stringify({
      pid: process.pid,
      startTime: new Date().toISOString()
    }));
  }

  setupSignalHandlers() {
    const cleanup = () => {
      console.log('\n🛑 Stopping SRE Compliant Railway Monitor...');
      this.cleanup();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }

  startHealthMonitor() {
    setInterval(() => {
      this.stats.uptime = Math.floor((Date.now() - this.startTime) / 1000);
      
      // Check if logs are stale (no logs for 5 minutes - increased threshold)
      const timeSinceLastLog = Date.now() - this.lastLogTime;
      if (timeSinceLastLog > 300000) { // 5 minutes
        console.log('⚠️ No logs received for 5 minutes - triggering reconnect');
        this.reconnect();
      }
      
      // Display stats every 60 seconds
      this.displayStats();
    }, this.healthCheckInterval);
  }

  displayStats() {
    const uptime = this.formatUptime(this.stats.uptime);
    console.log(`📊 SRE Monitor Stats: ${uptime} | Logs: ${this.stats.totalLogs} | Posts: ${this.stats.posts} | Errors: ${this.stats.errors} | Reconnects: ${this.stats.reconnects} | Rate Limits: ${this.stats.rateLimits}`);
  }

  formatUptime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  async start() {
    console.log('🚀 SRE COMPLIANT RAILWAY MONITOR - STARTING');
    console.log('===========================================');
    console.log('✨ SRE Features:');
    console.log('   🛡️ Rate limit compliant (30s+ intervals)');
    console.log('   📈 Exponential backoff with jitter');
    console.log('   🔒 Single instance protection');
    console.log('   📊 Enhanced monitoring stats');
    console.log('   ⏳ Reduced API call frequency');
    console.log('');
    
    this.connect();
  }

  connect() {
    if (this.logProcess) {
      this.logProcess.kill();
    }

    console.log(`📡 Connecting to Railway logs... (attempt ${this.reconnectCount + 1})`);
    
    // Use backoff wrapper for Railway CLI calls
    this.logProcess = spawn('node', ['scripts/with_backoff.mjs', 'railway', 'logs'], {
      stdio: 'pipe',
      shell: false,
      cwd: __dirname
    });

    this.logProcess.stdout.on('data', (data) => {
      this.handleLogData(data.toString());
    });

    this.logProcess.stderr.on('data', (data) => {
      const error = data.toString().trim();
      if (error && !error.includes('Warning')) {
        this.handleError(error);
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
  }

  handleError(error) {
    // Enhanced rate limit detection
    if (error.includes('429') || 
        error.includes('Too Many Requests') || 
        error.includes('being ratelimited') ||
        error.includes('rate-limited') ||
        error.includes('[backoff] Rate limited')) {
      
      this.stats.rateLimits++;
      this.consecutiveRateLimits++;
      
      console.log(`⚠️ Rate limit detected (consecutive: ${this.consecutiveRateLimits})`);
      
      // If too many consecutive rate limits, enter extended backoff
      if (this.consecutiveRateLimits >= this.maxConsecutiveRateLimits) {
        console.log('🛑 Too many consecutive rate limits - entering extended backoff (10 minutes)');
        this.rateLimitBackoffMs = 600000; // 10 minutes
      }
      
    } else {
      console.error(`❌ Railway CLI Error: ${error}`);
      this.stats.errors++;
      // Reset consecutive rate limit counter on non-rate-limit errors
      this.consecutiveRateLimits = 0;
    }
  }

  handleLogData(data) {
    const lines = data.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      this.lastLogTime = Date.now();
      this.stats.totalLogs++;
      
      // Reset consecutive rate limits on successful data
      this.consecutiveRateLimits = 0;
      
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
      if (line.includes('Tweet posted successfully') || line.includes('ULTIMATE_POSTER: ✅')) {
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
      console.error('💥 Max reconnections reached. Exiting to prevent API abuse.');
      this.cleanup();
      process.exit(1);
    }

    this.reconnectCount++;
    this.stats.reconnects++;
    
    // Exponential backoff with jitter
    let delay = this.baseReconnectDelay * Math.pow(2, Math.min(this.reconnectCount - 1, 5));
    delay = Math.min(delay, this.maxReconnectDelay);
    
    // Add jitter (±15%)
    const jitter = delay * 0.15 * (Math.random() - 0.5);
    delay = Math.round(delay + jitter);
    
    // Apply rate limit backoff if needed
    if (this.consecutiveRateLimits > 0) {
      delay = Math.max(delay, this.rateLimitBackoffMs);
    }
    
    console.log(`🔄 Reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.reconnectCount})...`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
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
    
    // Remove lock file
    if (fs.existsSync(this.lockFile)) {
      fs.unlinkSync(this.lockFile);
    }
    
    // Save final stats
    const logFile = path.join(__dirname, 'railway_monitor_stats.json');
    fs.writeFileSync(logFile, JSON.stringify({
      ...this.stats,
      endTime: new Date().toISOString(),
      finalUptime: this.formatUptime(this.stats.uptime),
      rateLimitCompliance: {
        consecutiveRateLimits: this.consecutiveRateLimits,
        finalBackoffMs: this.rateLimitBackoffMs,
        maxReconnects: this.maxReconnects
      }
    }, null, 2));
    
    console.log('📊 Final stats saved to railway_monitor_stats.json');
  }
}

// Start the SRE compliant monitor
const monitor = new SRECompliantRailwayMonitor();
monitor.start().catch(console.error);
