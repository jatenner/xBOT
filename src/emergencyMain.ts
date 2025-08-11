import express from 'express';
import { emergencyDb } from './lib/emergencyDatabaseManager';

async function startEmergencyBot(): Promise<void> {
    console.log('🚨 === EMERGENCY RAILWAY BOT STARTING ===');
    console.log('🔧 Running in Redis-bypass mode for Railway compatibility');
    
    // Initialize emergency database
    await emergencyDb.initialize();
    
    // Create health server for Railway
    const app = express();
    const port = process.env.PORT || 3000;
    
    // Health check endpoint
    app.get('/health', (req, res) => {
        const isHealthy = emergencyDb.isHealthy();
        res.status(isHealthy ? 200 : 503).json({
            status: isHealthy ? 'healthy' : 'degraded',
            mode: 'emergency_redis_bypass',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
        });
    });
    
    // Root endpoint
    app.get('/', (req, res) => {
        res.json({
            message: 'Enterprise Twitter Bot - Emergency Mode',
            status: 'operational',
            mode: 'redis_bypass',
            features: ['supabase_database', 'health_monitoring']
        });
    });
    
    // Start server
    app.listen(port, () => {
        console.log(`✅ Emergency health server running on port ${port}`);
        console.log('🎯 Railway health checks will now pass');
        console.log('🔧 Next: Update REDIS_URL to fix Redis connection');
    });
    
    // Heartbeat to show it's working
    setInterval(() => {
        const memory = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        console.log(`💓 Emergency bot heartbeat: ${memory}MB memory, ${Math.round(process.uptime())}s uptime`);
    }, 30000);
    
    console.log('🎉 === EMERGENCY BOT OPERATIONAL ===');
    console.log('⚠️ Note: Redis features disabled until REDIS_URL is updated');
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Emergency bot shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Emergency bot shutting down gracefully...');
    process.exit(0);
});

// Start the emergency bot
startEmergencyBot().catch(error => {
    console.error('💥 Emergency bot failed to start:', error);
    process.exit(1);
});