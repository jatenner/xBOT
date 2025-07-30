#!/usr/bin/env node

/**
 * 🔄 AUTO-RESUMING RAILWAY LOGS MONITOR
 * 
 * Automatically resumes Railway log streams when they pause
 * Runs a local web interface that stays connected
 */

const express = require('express');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const http = require('http');

class AutoRailwayLogMonitor {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });
    this.clients = new Set();
    this.railwayProcess = null;
    this.logBuffer = [];
    this.maxBufferSize = 1000;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.isRestarting = false;
  }

  startLogStream() {
    if (this.railwayProcess) {
      console.log('🔄 Stopping existing Railway process...');
      this.railwayProcess.kill();
    }

    console.log('🚂 Starting Railway logs stream...');
    
    this.railwayProcess = spawn('railway', ['logs', '--follow'], {
      stdio: ['inherit', 'pipe', 'pipe']
    });

    this.railwayProcess.stdout.on('data', (data) => {
      const logLine = data.toString();
      this.handleLogData(logLine);
      this.reconnectAttempts = 0; // Reset on successful data
    });

    this.railwayProcess.stderr.on('data', (data) => {
      const errorLine = data.toString();
      console.error('🚫 Railway stderr:', errorLine);
      this.handleLogData(`[ERROR] ${errorLine}`);
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
  }

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

    // Check for pause indicators and auto-resume
    if (data.includes('paused') || data.includes('stream has been paused')) {
      console.log('🔄 Detected log stream pause - auto-resuming...');
      this.autoResume();
    }
  }

  autoResume() {
    if (this.isRestarting) return;
    
    this.isRestarting = true;
    console.log('⚡ Auto-resuming Railway log stream...');
    
    // Kill current process and restart
    if (this.railwayProcess) {
      this.railwayProcess.kill();
    }
    
    setTimeout(() => {
      this.isRestarting = false;
      this.startLogStream();
    }, 1000);
  }

  broadcast(message) {
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

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

  setupWebInterface() {
    this.app.get('/', (req, res) => {
      res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🤖 xBOT Railway Logs - Auto Resuming</title>
    <style>
        body {
            font-family: 'Monaco', 'Courier New', monospace;
            background: #1a1a1a;
            color: #00ff00;
            margin: 0;
            padding: 20px;
            overflow-x: hidden;
        }
        .header {
            background: #2d2d2d;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            border-left: 4px solid #00ff00;
        }
        .status {
            display: inline-block;
            padding: 5px 10px;
            border-radius: 4px;
            font-weight: bold;
            margin-left: 10px;
        }
        .status.connected { background: #00aa00; color: white; }
        .status.disconnected { background: #aa0000; color: white; }
        .controls {
            margin: 10px 0;
        }
        button {
            background: #00aa00;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-family: inherit;
            margin-right: 10px;
        }
        button:hover { background: #00cc00; }
        button.resume { background: #ff6600; }
        button.resume:hover { background: #ff8800; }
        .logs-container {
            background: #0d1117;
            border: 1px solid #30363d;
            border-radius: 8px;
            height: 70vh;
            overflow-y: auto;
            padding: 15px;
            font-size: 13px;
            line-height: 1.4;
        }
        .log-entry {
            margin-bottom: 2px;
            word-wrap: break-word;
        }
        .timestamp {
            color: #6e7681;
            margin-right: 10px;
        }
        .log-content {
            color: #e6edf3;
        }
        .log-content.error {
            color: #f85149;
        }
        .log-content.system {
            color: #ffa500;
            font-weight: bold;
        }
        .auto-scroll {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #238636;
            color: white;
            border: none;
            padding: 10px;
            border-radius: 50%;
            cursor: pointer;
        }
        .stats {
            background: #161b22;
            padding: 10px;
            border-radius: 4px;
            margin-top: 10px;
            font-size: 12px;
            color: #8b949e;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🤖 xBOT Railway Logs - Auto Resuming Monitor</h1>
        <span>Connection Status:</span>
        <span id="status" class="status disconnected">Connecting...</span>
        <div class="controls">
            <button onclick="manualResume()" class="resume">🔄 Force Resume</button>
            <button onclick="clearLogs()">🗑️ Clear Logs</button>
            <button onclick="toggleAutoScroll()">📜 Toggle Auto-Scroll</button>
        </div>
    </div>

    <div class="logs-container" id="logs"></div>
    
    <button class="auto-scroll" id="scrollBtn" onclick="scrollToBottom()">↓</button>

    <div class="stats">
        <span>📊 Logs: <span id="logCount">0</span></span>
        <span>🔄 Reconnects: <span id="reconnectCount">0</span></span>
        <span>⏱️ Uptime: <span id="uptime">00:00:00</span></span>
    </div>

    <script>
        let ws;
        let autoScroll = true;
        let logCount = 0;
        let reconnectCount = 0;
        let startTime = Date.now();

        function connect() {
            ws = new WebSocket('ws://localhost:3001');
            
            ws.onopen = function() {
                document.getElementById('status').textContent = 'Connected';
                document.getElementById('status').className = 'status connected';
                console.log('✅ Connected to Railway log stream');
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
                console.log('�� Manual resume sent');
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

        function updateUptime() {
            const elapsed = Date.now() - startTime;
            const hours = Math.floor(elapsed / 3600000);
            const minutes = Math.floor((elapsed % 3600000) / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            document.getElementById('uptime').textContent = 
                \`\${hours.toString().padStart(2, '0')}:\${minutes.toString().padStart(2, '0')}:\${seconds.toString().padStart(2, '0')}\`;
        }

        // Start connection and uptime counter
        connect();
        setInterval(updateUptime, 1000);
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
        bufferSize: this.logBuffer.length
      });
    });
  }

  start(port = 3001) {
    this.setupWebInterface();
    this.setupWebSocket();
    this.startLogStream();

    this.server.listen(port, () => {
      console.log('🚀 Auto-resuming Railway log monitor started!');
      console.log(`📱 Open: http://localhost:${port}`);
      console.log('🔄 Auto-resume: ENABLED');
      console.log('⚡ Stream monitoring: ACTIVE');
    });
  }

  stop() {
    console.log('🛑 Stopping auto-resuming Railway log monitor...');
    
    if (this.railwayProcess) {
      this.railwayProcess.kill();
    }
    
    this.clients.forEach(client => {
      client.close();
    });
    
    this.server.close();
  }
}

// Start the monitor
if (require.main === module) {
  const monitor = new AutoRailwayLogMonitor();
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\\n🛑 Received SIGINT, shutting down gracefully...');
    monitor.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\\n🛑 Received SIGTERM, shutting down gracefully...');
    monitor.stop();
    process.exit(0);
  });
  
  monitor.start();
}

module.exports = AutoRailwayLogMonitor;
