#!/usr/bin/env node

/**
 * 🚨 STANDALONE HEALTH SERVER - RAILWAY EMERGENCY
 * 
 * This is a MINIMAL health server that Railway MUST use.
 * No TypeScript, no complex dependencies, just basic Node.js.
 */

console.log('🚨 === STANDALONE HEALTH SERVER STARTING ===');
console.log('🌐 Creating emergency health server...');

const http = require('http');

// Force immediate startup log
console.log('📦 Node.js version:', process.version);
console.log('📦 Memory at startup:', Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB');

// Create immediate health server
const server = http.createServer((req, res) => {
  const url = req.url;
  console.log(`📞 Health check: ${req.method} ${url}`);
  
  if (url === '/health' || url === '/' || url === '/ping') {
    const memory = process.memoryUsage();
    const memoryMB = Math.round(memory.heapUsed / 1024 / 1024);
    
    const response = JSON.stringify({
      status: 'healthy',
      mode: 'standalone-emergency',
      memory: `${memoryMB}MB`,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      message: 'Railway emergency health server OK'
    });
    
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });
    res.end(response);
    
    console.log(`✅ Health check OK: ${memoryMB}MB memory`);
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('xBOT Emergency Mode - Railway Health OK');
  }
});

const port = process.env.PORT || 3000;

console.log(`🌐 BINDING to port ${port}...`);
console.log(`🌐 Expected Railway health URL: http://0.0.0.0:${port}/health`);

server.listen(port, '0.0.0.0', () => {
  console.log(`🌐 STANDALONE health server READY on 0.0.0.0:${port}`);
  console.log(`🌐 Railway health endpoint: http://0.0.0.0:${port}/health`);
  console.log('✅ === STANDALONE HEALTH SERVER RUNNING ===');
  
  // Immediate self-test
  console.log('🧪 Performing immediate self-test...');
  const selfTest = http.get(`http://localhost:${port}/health`, (res) => {
    console.log(`🧪 Self-test response: ${res.statusCode}`);
  });
  selfTest.on('error', (err) => {
    console.log(`🧪 Self-test error: ${err.message}`);
  });
});

server.on('error', (error) => {
  console.error('❌ STANDALONE health server error:', error.message);
  process.exit(1);
});

// Keep server alive
setInterval(() => {
  const memory = process.memoryUsage();
  const memoryMB = Math.round(memory.heapUsed / 1024 / 1024);
  console.log(`💓 Health server heartbeat: ${memoryMB}MB memory, ${Math.round(process.uptime())}s uptime`);
}, 60000); // Every minute

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down health server...');
  server.close(() => {
    console.log('🛑 Health server stopped');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down health server...');
  server.close(() => {
    console.log('🛑 Health server stopped');
    process.exit(0);
  });
});