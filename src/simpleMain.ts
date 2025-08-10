#!/usr/bin/env node

/**
 * 🚨 ULTRA-SIMPLE MAIN - RAILWAY MEMORY CRISIS EMERGENCY
 * 
 * COMPLETELY ISOLATED from all heavy dependencies
 * Target: <200MB memory usage, basic posting only
 * NO imports of any complex systems
 */

import * as dotenv from 'dotenv';
dotenv.config();

// Set strict memory limits
process.env.NODE_OPTIONS = '--max-old-space-size=400';

console.log('🚨 ULTRA-SIMPLE RAILWAY EMERGENCY MODE');
console.log('🎯 Target: <200MB memory, basic posting only');
console.log('⚡ Zero heavy dependencies');

class UltraSimpleBot {
  private postCount = 0;
  
  async start() {
    console.log('🚀 Starting ultra-simple bot...');
    
    // Check memory
    const memory = process.memoryUsage();
    console.log(`📊 Startup memory: ${Math.round(memory.heapUsed / 1024 / 1024)}MB`);
    
    // Simple health check endpoint (Railway needs this)
    this.startHealthServer();
    
    // Simple posting schedule (every 60 minutes)
    setInterval(() => {
      this.simplePost();
    }, 60 * 60 * 1000);
    
    // Initial post after 30 seconds
    setTimeout(() => this.simplePost(), 30000);
    
    console.log('✅ Ultra-simple bot started successfully');
  }
  
  private startHealthServer() {
    try {
      console.log('🌐 Starting MINIMAL health server...');
      const http = require('http');
      
      const server = http.createServer((req: any, res: any) => {
        console.log(`📞 Health check: ${req.method} ${req.url}`);
        
        if (req.url === '/health' || req.url === '/') {
          const memory = process.memoryUsage();
          const memoryMB = Math.round(memory.heapUsed / 1024 / 1024);
          
          const response = JSON.stringify({
            status: 'healthy',
            mode: 'ultra-simple',
            memory: `${memoryMB}MB`,
            posts: this.postCount,
            uptime: Math.round(process.uptime()),
            timestamp: new Date().toISOString()
          });
          
          res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(response);
          
          console.log(`✅ Health check responded: ${memoryMB}MB memory`);
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        }
      });
      
      const port = process.env.PORT || 3000;
      server.listen(port, '0.0.0.0', () => {
        console.log(`🌐 MINIMAL health server running on 0.0.0.0:${port}`);
        console.log(`🌐 Health endpoint: http://localhost:${port}/health`);
      });
      
    } catch (error: any) {
      console.error('❌ MINIMAL health server failed:', error.message);
      // Try to create an even simpler server
      try {
        const http = require('http');
        const server = http.createServer((req: any, res: any) => {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('OK');
        });
        server.listen(process.env.PORT || 3000, () => {
          console.log('🌐 EMERGENCY server started (text only)');
        });
      } catch (emergencyError: any) {
        console.error('💥 Even emergency server failed:', emergencyError.message);
      }
    }
  }
  
  private async simplePost() {
    try {
      console.log('📝 Attempting simple post...');
      
      // Check memory before posting
      const memory = process.memoryUsage();
      const memoryMB = Math.round(memory.heapUsed / 1024 / 1024);
      console.log(`📊 Memory before post: ${memoryMB}MB`);
      
      if (memoryMB > 300) {
        console.warn('⚠️ Memory too high, skipping post');
        if (global.gc) {
          global.gc();
          console.log('🧹 Forced garbage collection');
        }
        return;
      }
      
      // Generate simple content
      const topics = ['hydration', 'sleep', 'exercise', 'nutrition', 'stress management'];
      const topic = topics[Math.floor(Math.random() * topics.length)];
      const content = `${topic.charAt(0).toUpperCase() + topic.slice(1)} is crucial for optimal health. Small daily improvements lead to significant long-term benefits. What's your experience with ${topic}?`;
      
      console.log(`📝 Generated content: ${content.substring(0, 50)}...`);
      
      // For now, just log the post (no browser to avoid memory issues)
      console.log('✅ Simulated post successful');
      this.postCount++;
      
      // Log to database if possible (ultra-simple)
      await this.simpleDBLog(content);
      
    } catch (error: any) {
      console.error('❌ Simple post failed:', error.message);
    }
  }
  
  private async simpleDBLog(content: string) {
    try {
      // Ultra-simple database logging
      const { createClient } = await import('@supabase/supabase-js');
      
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      await supabase.from('simple_posts').insert({
        content,
        posted_at: new Date().toISOString(),
        mode: 'ultra_simple'
      });
      
      console.log('📊 Logged to database');
    } catch (error: any) {
      console.error('⚠️ DB log failed:', error.message);
    }
  }
}

async function main() {
  try {
    const bot = new UltraSimpleBot();
    await bot.start();
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('🛑 SIGTERM received, shutting down...');
      process.exit(0);
    });
    
    process.on('SIGINT', () => {
      console.log('🛑 SIGINT received, shutting down...');
      process.exit(0);
    });
    
  } catch (error: any) {
    console.error('💥 Startup failed:', error.message);
    process.exit(1);
  }
}

main();