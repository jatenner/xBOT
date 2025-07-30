#!/usr/bin/env node

/**
 * 🛡️ BULLETPROOF RAILWAY AUTO-RESUMING LOG MONITOR
 * 
 * Never manually click "Resume Log Stream" again!
 * - Auto-finds available ports (3001-3010)
 * - Detects log stream pauses and auto-resumes
 * - Bulletproof error handling and recovery
 * - Beautiful web interface with real-time updates
 */

const express = require('express');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const http = require('http');
const net = require('net');

class BulletproofRailwayLogMonitor {
  constructor() {
    this.app = express();
    this.server = null;
    this.wss = null;
    this.clients = new Set();
    this.railwayProcess = null;
    this.logBuffer = [];
    this.maxBufferSize = 1000;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.isRestarting = false;
    this.port = null;
    this.lastLogTime = Date.now();
    this.pauseDetectionTimer = null;
  }

  /**
   * 🔍 FIND AVAILABLE PORT
   */
  async findAvailablePort(startPort = 3001, endPort = 3010) {
    for (let port = startPort; port <= endPort; port++) {
      if (await this.isPortAvailable(port)) {
        return port;
      }
    }
    throw new Error(`No available ports found between ${startPort}-${endPort}`);
  }

  /**
   * ✅ CHECK IF PORT IS AVAILABLE
   */
  isPortAvailable(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.listen(port, () => {
        server.once('close', () => resolve(true));
        server.close();
      });
      server.on('error', () => resolve(false));
    });
  }

  /**
   * 🚂 START RAILWAY LOG STREAM
   */
  startLogStream() {
    if (this.railwayProcess) {
      console.log('🔄 Killing existing Railway process...');
      this.railwayProcess.kill();
    }

    console.log('🚂 Starting Railway logs stream...');
    
    this.railwayProcess = spawn('railway', ['logs'], {
      stdio: ['inherit', 'pipe', 'pipe']
    });

    this.railwayProcess.stdout.on('data', (data) => {
      const logLine = data.toString();
      this.handleLogData(logLine);
      this.lastLogTime = Date.now();
      this.reconnectAttempts = 0; // Reset on successful data
    });

    this.railwayProcess.stderr.on('data', (data) => {
      const errorLine = data.toString();
      console.error('🚫 Railway stderr:', errorLine);
      this.handleLogData(`[ERROR] ${errorLine}`);
      this.lastLogTime = Date.now();
    });

    this.railwayProcess.on('close', (code) => {
      console.log(`🛑 Railway process closed with code ${code}`);
      
      if (!this.isRestarting && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`🔄 Auto-restarting Railway logs (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        
        setTimeout(() => {
          this.startLogStream();
        }, 2000); // Wait 2 seconds before restart
      } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.log('❌ Max reconnection attempts reached. Manual restart required.');
        this.handleLogData('[SYSTEM] Max reconnection attempts reached. Railway log stream stopped.');
      }
    });

    this.railwayProcess.on('error', (error) => {
      console.error('❌ Railway process error:', error);
      this.handleLogData(`[SYSTEM ERROR] ${error.message}`);
    });

    // Start pause detection
    this.startPauseDetection();
  }

  /**
   * 🕵️ DETECT LOG STREAM PAUSES
   */
  startPauseDetection() {
    if (this.pauseDetectionTimer) {
      clearInterval(this.pauseDetectionTimer);
    }

    this.pauseDetectionTimer = setInterval(() => {
      const timeSinceLastLog = Date.now() - this.lastLogTime;
      const pauseThreshold = 60000; // 1 minute without logs = pause

      if (timeSinceLastLog > pauseThreshold && !this.isRestarting) {
        console.log('🔍 No logs for 1+ minutes - potential stream pause detected');
        this.handleLogData('[SYSTEM] Potential log stream pause detected - auto-resuming...');
        this.autoResume();
      }
    }, 30000); // Check every 30 seconds
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

    // Check for explicit pause indicators
    if (data.includes('paused') || data.includes('stream has been paused') || data.includes('Log stream has been paused')) {
      console.log('🔄 Log stream pause detected - auto-resuming...');
      this.autoResume();
    }
  }

  /**
   * ⚡ AUTO-RESUME STREAM
   */
  autoResume() {
    if (this.isRestarting) return;
    
    this.isRestarting = true;
    console.log('⚡ Auto-resuming Railway log stream...');
    this.handleLogData('[SYSTEM] Auto-resuming Railway log stream...');
    
    // Kill current process and restart
    if (this.railwayProcess) {
      this.railwayProcess.kill();
    }
    
    setTimeout(() => {
      this.isRestarting = false;
      this.startLogStream();
    }, 1000);
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
      console.log('🔌 Client connected to log stream');
      this.clients.add(ws);

      // Send recent logs to new client
      this.logBuffer.forEach(log => {
        ws.send(JSON.stringify(log));
      });

      ws.on('close', () => {
        console.log('🔌 Client disconnected from log stream');
        this.clients.delete(ws);
      });

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          if (data.action === 'resume') {
            console.log('🔄 Manual resume requested by client');
            this.autoResume();
          }
        } catch (error) {
          console.error('❌ Invalid WebSocket message:', error);
        }
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
    <title>🤖 xBOT Railway Logs - Never Pause Again!</title>
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
            background: #161b22;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            border-left: 4px solid #238636;
        }
        .status {
            display: inline-block;
            padding: 5px 12px;
            border-radius: 4px;
            font-weight: bold;
            margin-left: 10px;
        }
        .status.connected { background: #238636; color: white; }
        .status.disconnected { background: #da3633; color: white; }
        .controls {
            margin: 15px 0;
        }
        button {
            background: #238636;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-family: inherit;
            margin-right: 10px;
            font-size: 14px;
        }
        button:hover { background: #2ea043; }
        button.resume { background: #fd7e14; }
        button.resume:hover { background: #ff8c34; }
        .logs-container {
            background: #0d1117;
            border: 1px solid #30363d;
            border-radius: 8px;
            height: 70vh;
            overflow-y: auto;
            padding: 15px;
            font-size: 13px;
            line-height: 1.5;
        }
        .log-entry {
            margin-bottom: 3px;
            word-wrap: break-word;
            padding: 2px 0;
        }
        .timestamp {
            color: #7d8590;
            margin-right: 12px;
            font-size: 11px;
        }
        .log-content {
            color: #e6edf3;
        }
        .log-content.error {
            color: #f85149;
            font-weight: bold;
        }
        .log-content.system {
            color: #ffa657;
            font-weight: bold;
        }
        .auto-scroll {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: #238636;
            color: white;
            border: none;
            padding: 12px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 16px;
        }
        .stats {
            background: #161b22;
            padding: 15px;
            border-radius: 6px;
            margin-top: 15px;
            font-size: 12px;
            color: #7d8590;
            display: flex;
            gap: 20px;
        }
        .feature-badge {
            background: #238636;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            margin-left: 10px;
        }
        .port-info {
            background: #1f6feb;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            margin-left: 10px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🤖 xBOT Railway Logs - Bulletproof Auto-Resume</h1>
        <span>Connection Status:</span>
        <span id="status" class="status disconnected">Connecting...</span>
        <span class="feature-badge">AUTO-RESUME</span>
        <span class="port-info">Port: ${this.port}</span>
        
        <div class="controls">
            <button onclick="manualResume()" class="resume">🔄 Force Resume</button>
            <button onclick="clearLogs()">🗑️ Clear Logs</button>
            <button onclick="toggleAutoScroll()">📜 Toggle Auto-Scroll</button>
            <button onclick="testConnection()">🔍 Test Connection</button>
        </div>
        
        <div style="margin-top: 10px; font-size: 12px; color: #7d8590;">
            ✨ Features: Auto-pause detection • Smart reconnection • No manual clicking required
        </div>
    </div>

    <div class="logs-container" id="logs"></div>
    
    <button class="auto-scroll" id="scrollBtn" onclick="scrollToBottom()">↓</button>

    <div class="stats">
        <span>📊 Logs: <span id="logCount">0</span></span>
        <span>🔄 Reconnects: <span id="reconnectCount">0</span></span>
        <span>⏱️ Uptime: <span id="uptime">00:00:00</span></span>
        <span>🔌 Clients: <span id="clientCount">1</span></span>
        <span>⚡ Last Log: <span id="lastLog">Just now</span></span>
    </div>

    <script>
        let ws;
        let autoScroll = true;
        let logCount = 0;
        let reconnectCount = 0;
        let startTime = Date.now();
        let lastLogTime = Date.now();

        function connect() {
            ws = new WebSocket('ws://localhost:${this.port}');
            
            ws.onopen = function() {
                document.getElementById('status').textContent = 'Connected';
                document.getElementById('status').className = 'status connected';
                console.log('✅ Connected to Railway log stream');
            };

            ws.onmessage = function(event) {
                try {
                    const log = JSON.parse(event.data);
                    appendLog(log);
                    lastLogTime = Date.now();
                } catch (error) {
                    console.error('❌ Failed to parse log:', error);
                }
            };

            ws.onclose = function() {
                document.getElementById('status').textContent = 'Disconnected';
                document.getElementById('status').className = 'status disconnected';
                console.log('🔌 Disconnected from Railway log stream');
                
                // Auto-reconnect after 2 seconds
                setTimeout(() => {
                    reconnectCount++;
                    document.getElementById('reconnectCount').textContent = reconnectCount;
                    connect();
                }, 2000);
            };

            ws.onerror = function(error) {
                console.error('❌ WebSocket error:', error);
            };
        }

        function appendLog(log) {
            const logsContainer = document.getElementById('logs');
            const logElement = document.createElement('div');
            logElement.className = 'log-entry';
            
            let contentClass = 'log-content';
            if (log.message.includes('[ERROR]')) {
                contentClass += ' error';
            } else if (log.message.includes('[SYSTEM]')) {
                contentClass += ' system';
            }
            
            logElement.innerHTML = \`
                <span class="timestamp">\${log.timestamp}</span>
                <span class="\${contentClass}">\${escapeHtml(log.message)}</span>
            \`;
            
            logsContainer.appendChild(logElement);
            logCount++;
            document.getElementById('logCount').textContent = logCount;
            
            if (autoScroll) {
                scrollToBottom();
            }
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function scrollToBottom() {
            const logsContainer = document.getElementById('logs');
            logsContainer.scrollTop = logsContainer.scrollHeight;
        }

        function manualResume() {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ action: 'resume' }));
                console.log('🔄 Manual resume sent');
            }
        }

        function clearLogs() {
            document.getElementById('logs').innerHTML = '';
            logCount = 0;
            document.getElementById('logCount').textContent = logCount;
        }

        function toggleAutoScroll() {
            autoScroll = !autoScroll;
            console.log('📜 Auto-scroll:', autoScroll ? 'enabled' : 'disabled');
        }

        function testConnection() {
            if (ws && ws.readyState === WebSocket.OPEN) {
                console.log('✅ Connection is active');
                alert('✅ WebSocket connection is active!');
            } else {
                console.log('❌ Connection is not active');
                alert('❌ WebSocket connection is down. Reconnecting...');
                connect();
            }
        }

        function updateStats() {
            // Update uptime
            const elapsed = Date.now() - startTime;
            const hours = Math.floor(elapsed / 3600000);
            const minutes = Math.floor((elapsed % 3600000) / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            document.getElementById('uptime').textContent = 
                \`\${hours.toString().padStart(2, '0')}:\${minutes.toString().padStart(2, '0')}:\${seconds.toString().padStart(2, '0')}\`;

            // Update last log time
            const timeSinceLastLog = Date.now() - lastLogTime;
            if (timeSinceLastLog < 1000) {
                document.getElementById('lastLog').textContent = 'Just now';
            } else if (timeSinceLastLog < 60000) {
                document.getElementById('lastLog').textContent = \`\${Math.floor(timeSinceLastLog / 1000)}s ago\`;
            } else {
                document.getElementById('lastLog').textContent = \`\${Math.floor(timeSinceLastLog / 60000)}m ago\`;
            }
        }

        // Start connection and update timers
        connect();
        setInterval(updateStats, 1000);
    </script>
</body>
</html>
      `);
    });

    this.app.get('/api/status', (req, res) => {
      res.json({
        connected: this.railwayProcess !== null,
        reconnectAttempts: this.reconnectAttempts,
        clientCount: this.clients.size,
        bufferSize: this.logBuffer.length,
        port: this.port,
        lastLogTime: this.lastLogTime,
        isRestarting: this.isRestarting
      });
    });
  }

  /**
   * 🚀 START THE MONITOR
   */
  async start() {
    try {
      // Find available port
      this.port = await this.findAvailablePort();
      console.log(`🔍 Found available port: ${this.port}`);

      // Setup express app
      this.setupWebInterface();
      
      // Create HTTP server
      this.server = http.createServer(this.app);
      
      // Setup WebSocket server
      this.wss = new WebSocket.Server({ server: this.server });
      this.setupWebSocket();
      
      // Start Railway log stream
      this.startLogStream();

      // Start the server
      this.server.listen(this.port, () => {
        console.log('🚀 Bulletproof Railway log monitor started!');
        console.log(`📱 Open: http://localhost:${this.port}`);
        console.log('🔄 Auto-resume: ENABLED');
        console.log('🕵️ Pause detection: ACTIVE');
        console.log('⚡ Stream monitoring: OPERATIONAL');
        console.log('');
        console.log('✨ Features:');
        console.log('  🛡️ Bulletproof error handling');
        console.log('  🔍 Smart pause detection (60s timeout)');
        console.log('  🔄 Automatic stream resumption');
        console.log('  📱 Beautiful web interface');
        console.log('  🔌 Multi-client support');
        console.log('');
        console.log('❌ NEVER CLICK "RESUME LOG STREAM" AGAIN!');
      });

      // Auto-open browser
      setTimeout(() => {
        const open = process.platform === 'darwin' ? 'open' : 
                      process.platform === 'win32' ? 'start' : 'xdg-open';
        require('child_process').exec(`${open} http://localhost:${this.port}`);
      }, 1000);

    } catch (error) {
      console.error('❌ Failed to start bulletproof log monitor:', error);
      process.exit(1);
    }
  }

  /**
   * 🛑 STOP THE MONITOR
   */
  stop() {
    console.log('🛑 Stopping bulletproof Railway log monitor...');
    
    if (this.pauseDetectionTimer) {
      clearInterval(this.pauseDetectionTimer);
    }
    
    if (this.railwayProcess) {
      this.railwayProcess.kill();
    }
    
    this.clients.forEach(client => {
      client.close();
    });
    
    if (this.server) {
      this.server.close();
    }
  }
}

// Start the monitor
if (require.main === module) {
  const monitor = new BulletproofRailwayLogMonitor();
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    monitor.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    monitor.stop();
    process.exit(0);
  });
  
  monitor.start();
}

module.exports = BulletproofRailwayLogMonitor;
