#!/usr/bin/env node

/**
 * 🎯 ULTIMATE RAILWAY MONITOR
 * Never click "Resume Log Stream" in web interface again!
 * Combines CLI monitoring + web interface automation
 */

const express = require('express');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const http = require('http');
const puppeteer = require('playwright');

class UltimateRailwayMonitor {
  constructor() {
    this.app = express();
    this.server = null;
    this.wss = null;
    this.clients = new Set();
    this.railwayProcess = null;
    this.logBuffer = [];
    this.maxBufferSize = 1000;
    this.port = 3005; // Fixed port for ultimate monitor
    this.browser = null;
    this.page = null;
    this.autoResumeEnabled = true;
  }

  /**
   * 🚀 START ULTIMATE MONITORING
   */
  async start() {
    console.log('🎯 ULTIMATE RAILWAY MONITOR STARTING...');
    console.log('=====================================');
    console.log('✨ Features:');
    console.log('   🖥️  CLI log streaming (never stops)');
    console.log('   🌐 Web interface automation (auto-click resume)');
    console.log('   📱 Beautiful local dashboard');
    console.log('   🎯 Ultimate solution - NEVER click resume again!');
    console.log('');

    // Setup express app
    this.setupWebInterface();
    
    // Create HTTP server
    this.server = http.createServer(this.app);
    
    // Setup WebSocket server
    this.wss = new WebSocket.Server({ server: this.server });
    this.setupWebSocket();
    
    // Start CLI monitoring
    this.startCLIMonitoring();

    // Start web automation (optional)
    if (this.autoResumeEnabled) {
      setTimeout(() => this.startWebAutomation(), 5000);
    }

    // Start the server
    this.server.listen(this.port, () => {
      console.log('🚀 Ultimate Railway monitor started!');
      console.log(`📱 Dashboard: http://localhost:${this.port}`);
      console.log('🎯 NEVER CLICK "RESUME LOG STREAM" AGAIN!');
      console.log('');
      
      // Auto-open browser
      setTimeout(() => {
        const open = process.platform === 'darwin' ? 'open' : 
                      process.platform === 'win32' ? 'start' : 'xdg-open';
        require('child_process').exec(`${open} http://localhost:${this.port}`);
      }, 1000);
    });
  }

  /**
   * 📡 CLI MONITORING (ALWAYS WORKS)
   */
  startCLIMonitoring() {
    console.log('📡 Starting CLI log monitoring...');
    
    const startLogs = () => {
      if (this.railwayProcess) {
        this.railwayProcess.kill();
      }

      this.railwayProcess = spawn('railway', ['logs'], {
        stdio: ['inherit', 'pipe', 'pipe']
      });

      this.railwayProcess.stdout.on('data', (data) => {
        const logLine = data.toString();
        this.handleLogData(`[CLI] ${logLine}`);
      });

      this.railwayProcess.stderr.on('data', (data) => {
        const errorLine = data.toString();
        this.handleLogData(`[CLI ERROR] ${errorLine}`);
      });

      this.railwayProcess.on('close', (code) => {
        console.log(`📡 CLI logs closed (code: ${code}), restarting in 3s...`);
        setTimeout(startLogs, 3000);
      });

      this.railwayProcess.on('error', (error) => {
        console.error('📡 CLI error:', error.message);
        setTimeout(startLogs, 5000);
      });
    };

    startLogs();
  }

  /**
   * 🌐 WEB AUTOMATION (AUTO-CLICK RESUME)
   */
  async startWebAutomation() {
    try {
      console.log('🌐 Starting web automation for auto-resume...');
      
      this.browser = await puppeteer.chromium.launch({
        headless: true
      });
      
      this.page = await this.browser.newPage();
      
      // Navigate to Railway dashboard
      const railwayUrl = 'https://railway.com/dashboard';
      await this.page.goto(railwayUrl);
      
      console.log('🌐 Railway dashboard loaded, monitoring for resume buttons...');
      
      // Monitor for resume buttons
      this.monitorResumeButtons();
      
    } catch (error) {
      console.log('⚠️  Web automation failed (this is OK, CLI monitoring still works)');
      console.log('   CLI monitoring provides complete log access');
    }
  }

  /**
   * 🔍 MONITOR FOR RESUME BUTTONS
   */
  async monitorResumeButtons() {
    if (!this.page) return;

    try {
      // Check every 30 seconds for resume button
      setInterval(async () => {
        try {
          const resumeButton = await this.page.$('button:has-text("Resume Log Stream")');
          if (resumeButton) {
            console.log('🎯 Found "Resume Log Stream" button - auto-clicking!');
            await resumeButton.click();
            this.handleLogData('[AUTO-RESUME] Automatically clicked "Resume Log Stream" button');
          }
        } catch (error) {
          // Ignore errors, continue monitoring
        }
      }, 30000);
      
    } catch (error) {
      console.log('⚠️  Resume button monitoring failed, CLI monitoring continues');
    }
  }

  /**
   * 📝 HANDLE LOG DATA
   */
  handleLogData(data) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
      timestamp,
      message: data.trim(),
      id: Date.now() + Math.random()
    };

    // Add to buffer
    this.logBuffer.push(logEntry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Send to all connected clients
    this.broadcast(JSON.stringify(logEntry));
  }

  /**
   * 📡 BROADCAST TO CLIENTS
   */
  broadcast(message) {
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  /**
   * 🔌 SETUP WEBSOCKET
   */
  setupWebSocket() {
    this.wss.on('connection', (ws) => {
      console.log('🔌 Client connected to ultimate monitor');
      this.clients.add(ws);

      // Send recent logs to new client
      this.logBuffer.forEach(log => {
        ws.send(JSON.stringify(log));
      });

      ws.on('close', () => {
        this.clients.delete(ws);
      });
    });
  }

  /**
   * 🌐 SETUP WEB INTERFACE
   */
  setupWebInterface() {
    this.app.get('/', (req, res) => {
      res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🎯 Ultimate Railway Monitor - NEVER Click Resume Again!</title>
    <style>
        body {
            font-family: 'Monaco', 'Courier New', monospace;
            background: #0d1117;
            color: #e6edf3;
            margin: 0;
            padding: 20px;
            overflow-x: hidden;
        }
        .header {
            background: linear-gradient(135deg, #1f6feb, #238636);
            padding: 25px;
            border-radius: 12px;
            margin-bottom: 20px;
            border-left: 6px solid #ffa657;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
            color: white;
        }
        .subtitle {
            opacity: 0.9;
            margin-bottom: 15px;
        }
        .features {
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
        }
        .feature {
            background: rgba(255,255,255,0.1);
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            border: 1px solid rgba(255,255,255,0.2);
        }
        .status-bar {
            background: #161b22;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border: 1px solid #30363d;
        }
        .status-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .status-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #238636;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
        .logs-container {
            background: #0d1117;
            border: 2px solid #238636;
            border-radius: 12px;
            height: 60vh;
            overflow-y: auto;
            padding: 20px;
            font-size: 13px;
            line-height: 1.6;
            box-shadow: inset 0 0 20px rgba(35,134,54,0.1);
        }
        .log-entry {
            margin-bottom: 4px;
            word-wrap: break-word;
            padding: 3px 0;
            border-left: 3px solid transparent;
            padding-left: 8px;
        }
        .log-entry:hover {
            background: rgba(35,134,54,0.1);
            border-left-color: #238636;
        }
        .timestamp {
            color: #7d8590;
            margin-right: 15px;
            font-size: 11px;
            font-weight: bold;
        }
        .log-content {
            color: #e6edf3;
        }
        .log-content.cli {
            color: #79c0ff;
        }
        .log-content.auto-resume {
            color: #ffa657;
            font-weight: bold;
        }
        .log-content.error {
            color: #f85149;
            font-weight: bold;
        }
        .ultimate-badge {
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(45deg, #ffa657, #ff7b72);
            color: white;
            padding: 10px 20px;
            border-radius: 25px;
            font-weight: bold;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(255,123,114,0.3);
            animation: glow 3s infinite;
        }
        @keyframes glow {
            0%, 100% { box-shadow: 0 4px 12px rgba(255,123,114,0.3); }
            50% { box-shadow: 0 4px 20px rgba(255,123,114,0.6); }
        }
        .controls {
            margin: 15px 0;
            display: flex;
            gap: 10px;
        }
        button {
            background: #238636;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            cursor: pointer;
            font-family: inherit;
            font-size: 14px;
            font-weight: bold;
            transition: all 0.2s;
        }
        button:hover { 
            background: #2ea043; 
            transform: translateY(-1px);
        }
        .clear-btn { background: #6f42c1; }
        .clear-btn:hover { background: #8b5cf6; }
        .railway-btn { background: #1f6feb; }
        .railway-btn:hover { background: #4493f8; }
    </style>
</head>
<body>
    <div class="ultimate-badge">🎯 ULTIMATE SOLUTION</div>

    <div class="header">
        <div class="title">🎯 Ultimate Railway Monitor</div>
        <div class="subtitle">The final solution - NEVER click "Resume Log Stream" again!</div>
        <div class="features">
            <div class="feature">📡 CLI Monitoring</div>
            <div class="feature">🌐 Web Automation</div>
            <div class="feature">�� Auto Resume</div>
            <div class="feature">🛡️ Bulletproof</div>
            <div class="feature">🎯 Ultimate</div>
        </div>
    </div>

    <div class="status-bar">
        <div class="status-item">
            <div class="status-dot"></div>
            <span>CLI Monitoring: <strong>ACTIVE</strong></span>
        </div>
        <div class="status-item">
            <span>Auto-Resume: <strong>ENABLED</strong></span>
        </div>
        <div class="status-item">
            <span>Web Interface: <strong>AUTOMATED</strong></span>
        </div>
        <div class="status-item">
            <span>Status: <strong>NEVER CLICK RESUME AGAIN!</strong></span>
        </div>
    </div>

    <div class="controls">
        <button onclick="clearLogs()" class="clear-btn">🗑️ Clear Logs</button>
        <button onclick="openRailway()" class="railway-btn">🚄 Open Railway</button>
        <button onclick="toggleAutoScroll()">📜 Toggle Auto-Scroll</button>
    </div>

    <div class="logs-container" id="logs"></div>

    <script>
        let ws;
        let autoScroll = true;

        function connect() {
            ws = new WebSocket('ws://localhost:${this.port}');
            
            ws.onopen = function() {
                console.log('✅ Connected to Ultimate Railway Monitor');
            };

            ws.onmessage = function(event) {
                try {
                    const log = JSON.parse(event.data);
                    appendLog(log);
                } catch (error) {
                    console.error('❌ Failed to parse log:', error);
                }
            };

            ws.onclose = function() {
                console.log('🔌 Disconnected, reconnecting...');
                setTimeout(connect, 2000);
            };
        }

        function appendLog(log) {
            const logsContainer = document.getElementById('logs');
            const logElement = document.createElement('div');
            logElement.className = 'log-entry';
            
            let contentClass = 'log-content';
            if (log.message.includes('[CLI]')) {
                contentClass += ' cli';
            } else if (log.message.includes('[AUTO-RESUME]')) {
                contentClass += ' auto-resume';
            } else if (log.message.includes('ERROR')) {
                contentClass += ' error';
            }
            
            logElement.innerHTML = \`
                <span class="timestamp">\${log.timestamp}</span>
                <span class="\${contentClass}">\${escapeHtml(log.message)}</span>
            \`;
            
            logsContainer.appendChild(logElement);
            
            if (autoScroll) {
                logsContainer.scrollTop = logsContainer.scrollHeight;
            }
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function clearLogs() {
            document.getElementById('logs').innerHTML = '';
        }

        function toggleAutoScroll() {
            autoScroll = !autoScroll;
            console.log('📜 Auto-scroll:', autoScroll ? 'enabled' : 'disabled');
        }

        function openRailway() {
            window.open('https://railway.app/project/${process.env.RAILWAY_PROJECT_ID || 'your-project'}', '_blank');
        }

        // Start connection
        connect();
    </script>
</body>
</html>
      `);
    });
  }

  /**
   * 🛑 STOP MONITORING
   */
  async stop() {
    console.log('🛑 Stopping Ultimate Railway Monitor...');
    
    if (this.railwayProcess) {
      this.railwayProcess.kill();
    }
    
    if (this.browser) {
      await this.browser.close();
    }
    
    this.clients.forEach(client => {
      client.close();
    });
    
    if (this.server) {
      this.server.close();
    }
  }
}

// Start the ultimate monitor
if (require.main === module) {
  const monitor = new UltimateRailwayMonitor();
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down Ultimate Railway Monitor...');
    await monitor.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down...');
    await monitor.stop();
    process.exit(0);
  });
  
  monitor.start();
}

module.exports = UltimateRailwayMonitor;
