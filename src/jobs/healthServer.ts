/**
 * 🏥 HEALTH SERVER
 * Minimal HTTP server for Railway healthchecks
 * Must not block job scheduling
 */

import { createServer, Server } from 'http';

let healthServer: Server | null = null;

export function startHealthServer(): void {
  if (healthServer) {
    console.log('[HEALTH] Server already running');
    return;
  }

  const port = process.env.PORT || 3000;
  const host = '0.0.0.0';

  healthServer = createServer((req, res) => {
    // Only respond to healthcheck endpoints
    if (req.url === '/' || req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    }
  });

  healthServer.listen(port, host, () => {
    console.log(`[HEALTH] ✅ Listening on ${host}:${port}`);
  });

  healthServer.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`[HEALTH] ❌ Port ${port} already in use`);
    } else {
      console.error(`[HEALTH] ❌ Server error: ${error.message}`);
    }
  });
}

export function stopHealthServer(): void {
  if (healthServer) {
    healthServer.close(() => {
      console.log('[HEALTH] Server stopped');
    });
    healthServer = null;
  }
}

