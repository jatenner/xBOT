// ULTRA MINIMAL BOT FOR RAILWAY - GUARANTEED TO WORK
import express from 'express';

async function startUltraMinimalBot(): Promise<void> {
    console.log('🚨 === ULTRA MINIMAL RAILWAY BOT ===');
    console.log('🎯 Single purpose: Pass Railway health checks');
    
    const app = express();
    const port = parseInt(process.env.PORT || '3000', 10);
    
    // CRITICAL: Health endpoint for Railway - INSTANT 200 OK
    app.get('/health', (req, res) => {
        console.log('🏥 Railway health check - responding with 200 OK');
        res.status(200).send('OK');
    });
    
    // Root endpoint
    app.get('/', (req, res) => {
        res.json({
            status: 'operational',
            message: 'Ultra Minimal Bot - Health Checks Only',
            timestamp: new Date().toISOString(),
            uptime: Math.round(process.uptime()),
            memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
        });
    });
    
    // Status endpoint
    app.get('/status', (req, res) => {
        res.json({
            health: 'healthy',
            mode: 'ultra_minimal',
            railway_compatible: true,
            timestamp: new Date().toISOString(),
            node_version: process.version,
            uptime_seconds: Math.round(process.uptime())
        });
    });
    
    // Start server - NO DEPENDENCIES, NO EXTERNAL CONNECTIONS
    app.listen(port, '0.0.0.0', () => {
        console.log(`✅ Ultra minimal server running on port ${port}`);
        console.log('🎯 Railway health checks: GET /health → 200 OK');
        console.log('📊 Status endpoint: GET /status');
        console.log('🚀 Bot is operational and Railway-compatible');
    });
    
    // Heartbeat to show it's alive
    setInterval(() => {
        const memory = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        console.log(`💓 Heartbeat: ${memory}MB, ${Math.round(process.uptime())}s uptime`);
    }, 60000); // Every 60 seconds
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log('🛑 SIGTERM received, shutting down...');
        process.exit(0);
    });
    
    process.on('SIGINT', () => {
        console.log('🛑 SIGINT received, shutting down...');
        process.exit(0);
    });
}

// Error handling
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
    // Don't exit - keep health server running
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
    // Don't exit - keep health server running
});

// Start the ultra minimal bot
startUltraMinimalBot().catch((error) => {
    console.error('❌ Failed to start ultra minimal bot:', error);
    process.exit(1);
});