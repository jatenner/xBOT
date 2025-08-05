/**
 * 📊 RAILWAY MEMORY MONITOR
 * Tracks memory usage to prevent resource exhaustion
 */

export class RailwayMemoryMonitor {
    
    static getMemoryUsage() {
        const usage = process.memoryUsage();
        const MB = 1024 * 1024;
        
        return {
            rss: Math.round(usage.rss / MB),
            heapUsed: Math.round(usage.heapUsed / MB),
            heapTotal: Math.round(usage.heapTotal / MB),
            external: Math.round(usage.external / MB),
            railwayLimit: 512, // Railway free tier limit
            usage_percent: Math.round((usage.rss / MB / 512) * 100)
        };
    }
    
    static isMemoryHigh() {
        const usage = this.getMemoryUsage();
        return usage.usage_percent > 85; // Trigger emergency mode at 85%
    }
    
    static logMemoryStatus() {
        const usage = this.getMemoryUsage();
        const status = usage.usage_percent > 85 ? '🚨 HIGH' : 
                     usage.usage_percent > 70 ? '⚠️ MODERATE' : '✅ OK';
        
        console.log(`📊 Memory: ${usage.rss}MB/${usage.railwayLimit}MB (${usage.usage_percent}%) - ${status}`);
        
        return usage;
    }
}

export const memoryMonitor = new RailwayMemoryMonitor();