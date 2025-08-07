#!/usr/bin/env node

/**
 * 🚨 EMERGENCY SIMPLE START
 * Bypasses all complex operations - just runs the bot
 */

console.log('🚨 EMERGENCY SIMPLE START');
console.log('📅 Start Time:', new Date().toISOString());

// Set emergency environment
process.env.NODE_ENV = 'production';
process.env.EMERGENCY_MODE = 'true';
process.env.SKIP_PLAYWRIGHT = 'true';
process.env.SKIP_MIGRATIONS = 'true';

console.log('🤖 Starting bot in EMERGENCY mode (no Playwright, no migrations)...');

// --- Minimal always-on HTTP health server for Railway ---
try {
  const http = require('http');
  const port = Number(process.env.PORT || 3000);

  const healthServer = http.createServer((req, res) => {
    const url = req.url || '/';
    if (url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          mode: 'emergency',
          uptime_seconds: Math.round(process.uptime()),
          timestamp: new Date().toISOString(),
        })
      );
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('xBOT is running (emergency mode)');
  });

  healthServer.listen(port, '0.0.0.0', () => {
    console.log(`🩺 Health server listening on 0.0.0.0:${port} (path: /health)`);
  });
} catch (e) {
  console.error('⚠️ Failed to start health server:', e);
}

// Keep process resilient
process.on('unhandledRejection', (reason) => {
  console.error('UnhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('UncaughtException:', err);
});

try {
  // Just start the main app directly
  // Delay to allow health server to come up first
  setImmediate(() => {
    try {
      require('./dist/main.js');
    } catch (inner) {
      console.error('❌ Failed starting dist/main.js on first attempt:', inner);
    }
  });
} catch (error) {
  console.error('❌ Emergency start failed:', error);
  console.log('🆘 Trying absolute minimal startup...');
  
  // Last resort - try to start with absolute minimal setup
  try {
    const path = require('path');
    const mainPath = path.join(__dirname, 'dist', 'main.js');
    require(mainPath);
  } catch (finalError) {
    console.error('💀 All startup methods failed:', finalError);
    process.exit(1);
  }
}