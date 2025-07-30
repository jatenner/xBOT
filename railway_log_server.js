#!/usr/bin/env node

/**
 * 🚀 RAILWAY LOG SERVER
 * 
 * Local server that fetches Railway logs and serves them via WebSocket
 * Eliminates the need to manually click "Resume Log Stream"
 */

const express = require('express');
const { WebSocketServer } = require('ws');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;

// Serve static files
app.use(express.static('.'));

// Serve the auto-refresh HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'auto_railway_logs.html'));
});

// Start HTTP server
const server = app.listen(PORT, () => {
  console.log(`🚀 Railway Log Server running at http://localhost:${PORT}`);
  console.log(`📡 WebSocket server will stream real Railway logs`);
  console.log(`✨ No more manual "Resume Log Stream" clicking!`);
});

// WebSocket server for real-time log streaming
const wss = new WebSocketServer({ server });

let railwayProcess = null;
let connectedClients = new Set();

function startRailwayLogStream() {
  console.log('📡 Starting Railway log stream...');
  
  railwayProcess = spawn('railway', ['logs'], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  railwayProcess.stdout.on('data', (data) => {
    const logLine = data.toString().trim();
    if (logLine) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        message: logLine,
        type: determineLogType(logLine)
      };
      
      // Broadcast to all connected clients
      broadcastToClients(logEntry);
    }
  });

  railwayProcess.stderr.on('data', (data) => {
    const errorLine = data.toString().trim();
    if (errorLine && !errorLine.includes('WARNING')) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        message: errorLine,
        type: 'error'
      };
      
      broadcastToClients(logEntry);
    }
  });

  railwayProcess.on('close', (code) => {
    console.log(`📡 Railway log stream ended with code ${code}`);
    
    // Restart after 5 seconds
    setTimeout(() => {
      if (connectedClients.size > 0) {
        console.log('🔄 Restarting Railway log stream...');
        startRailwayLogStream();
      }
    }, 5000);
  });

  railwayProcess.on('error', (error) => {
    console.error('❌ Railway log stream error:', error);
    
    // Broadcast error to clients
    const logEntry = {
      timestamp: new Date().toISOString(),
      message: `Railway CLI error: ${error.message}`,
      type: 'error'
    };
    
    broadcastToClients(logEntry);
  });
}

function determineLogType(logLine) {
  const line = logLine.toLowerCase();
  
  if (line.includes('error') || line.includes('failed') || line.includes('❌')) {
    return 'error';
  }
  
  if (line.includes('warning') || line.includes('warn') || line.includes('⚠️')) {
    return 'warning';
  }
  
  if (line.includes('success') || line.includes('complete') || line.includes('✅') || 
      line.includes('🚀') || line.includes('🎯') || line.includes('📈')) {
    return 'success';
  }
  
  return 'info';
}

function broadcastToClients(logEntry) {
  const message = JSON.stringify(logEntry);
  
  connectedClients.forEach(client => {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  });
}

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('📱 Client connected to log stream');
  connectedClients.add(ws);
  
  // Send welcome message
  const welcomeEntry = {
    timestamp: new Date().toISOString(),
    message: '🚀 Connected to Railway log stream - real-time updates enabled!',
    type: 'success'
  };
  
  ws.send(JSON.stringify(welcomeEntry));
  
  // Start Railway log stream if this is the first client
  if (connectedClients.size === 1 && !railwayProcess) {
    startRailwayLogStream();
  }
  
  ws.on('close', () => {
    console.log('📱 Client disconnected from log stream');
    connectedClients.delete(ws);
    
    // Stop Railway log stream if no clients are connected
    if (connectedClients.size === 0 && railwayProcess) {
      console.log('🛑 Stopping Railway log stream (no clients)');
      railwayProcess.kill();
      railwayProcess = null;
    }
  });
  
  ws.on('error', (error) => {
    console.error('📱 WebSocket error:', error);
    connectedClients.delete(ws);
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Railway log server...');
  
  if (railwayProcess) {
    railwayProcess.kill();
  }
  
  server.close(() => {
    console.log('✅ Server shut down gracefully');
    process.exit(0);
  });
});

console.log('');
console.log('🎯 === RAILWAY LOG SERVER INSTRUCTIONS ===');
console.log('');
console.log('1. 🌐 Open http://localhost:3001 in your browser');
console.log('2. 📡 Real-time Railway logs will stream automatically');
console.log('3. ✨ No more manual "Resume Log Stream" clicking!');
console.log('4. 🔄 Logs auto-refresh every 10 seconds');
console.log('5. 💾 Export logs with one click');
console.log('');
console.log('Press Ctrl+C to stop the server');
console.log(''); 