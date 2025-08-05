/**
 * 🏥 ENHANCED SYSTEM HEALTH MONITOR
 * Real CPU/RAM monitoring and health checks
 */

import { supabase } from '../supabaseClient.js';

export class EnhancedSystemHealthMonitor {
    
    constructor() {
        this.isRailway = process.env.RAILWAY_ENVIRONMENT_NAME !== undefined;
        this.memoryLimit = this.isRailway ? 512 : 8192; // MB
    }
    
    /**
     * Get current system resource usage
     */
    async getSystemResources() {
        try {
            const memoryUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();
            
            // Get system memory (Railway-safe)
            let totalMemory = this.memoryLimit;
            let freeMemory = this.memoryLimit - (memoryUsage.rss / 1024 / 1024);
            
            if (!this.isRailway) {
                try {
                    // Only on non-Railway environments
                    const os = require('os');
                    totalMemory = os.totalmem() / 1024 / 1024;
                    freeMemory = os.freemem() / 1024 / 1024;
                } catch (error) {
                    // Fallback to process memory
                }
            }
            
            return {
                memory: {
                    used: Math.round(memoryUsage.rss / 1024 / 1024),
                    total: Math.round(totalMemory),
                    free: Math.round(freeMemory),
                    usage_percent: Math.round((memoryUsage.rss / 1024 / 1024 / totalMemory) * 100)
                },
                cpu: {
                    user: cpuUsage.user,
                    system: cpuUsage.system
                },
                uptime: Math.round(process.uptime()),
                environment: this.isRailway ? 'railway' : 'local'
            };
            
        } catch (error) {
            console.error('Error getting system resources:', error);
            return {
                memory: { used: 0, total: 512, free: 512, usage_percent: 0 },
                cpu: { user: 0, system: 0 },
                uptime: 0,
                environment: 'unknown'
            };
        }
    }
    
    /**
     * Check database connectivity
     */
    async checkDatabaseHealth() {
        try {
            const { data, error } = await supabase
                .from('agent_actions')
                .select('id')
                .limit(1);
            
            return {
                status: error ? 'error' : 'healthy',
                error: error?.message,
                response_time: Date.now()
            };
            
        } catch (error) {
            return {
                status: 'error',
                error: error.message,
                response_time: null
            };
        }
    }
    
    /**
     * Check recent posting success rate
     */
    async checkPostingHealth() {
        try {
            const { data: recentPosts, error } = await supabase
                .from('tweets')
                .select('confirmed, method_used, created_at')
                .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
                .order('created_at', { ascending: false })
                .limit(10);
            
            if (error) throw error;
            
            if (!recentPosts || recentPosts.length === 0) {
                return {
                    status: 'warning',
                    message: 'No recent posts found',
                    success_rate: 0,
                    total_posts: 0
                };
            }
            
            const successfulPosts = recentPosts.filter(p => p.confirmed).length;
            const successRate = (successfulPosts / recentPosts.length) * 100;
            
            return {
                status: successRate >= 80 ? 'healthy' : successRate >= 50 ? 'warning' : 'error',
                success_rate: successRate,
                total_posts: recentPosts.length,
                successful_posts: successfulPosts
            };
            
        } catch (error) {
            return {
                status: 'error',
                error: error.message
            };
        }
    }
    
    /**
     * Update system health in database
     */
    async updateHealthStatus(component, status, details) {
        try {
            await supabase
                .from('system_status')
                .upsert({
                    component,
                    status,
                    checked_at: new Date().toISOString(),
                    error_info: details.error || null
                }, {
                    onConflict: 'component'
                });
                
        } catch (error) {
            console.error(`Error updating health status for ${component}:`, error);
        }
    }
    
    /**
     * Run comprehensive health check
     */
    async runHealthCheck() {
        console.log('🏥 Running comprehensive system health check...');
        
        const [resources, dbHealth, postingHealth] = await Promise.all([
            this.getSystemResources(),
            this.checkDatabaseHealth(),
            this.checkPostingHealth()
        ]);
        
        // Update health statuses
        await this.updateHealthStatus('system_resources', 
            resources.memory.usage_percent > 90 ? 'error' : 
            resources.memory.usage_percent > 75 ? 'warning' : 'healthy',
            { memory_usage: resources.memory.usage_percent }
        );
        
        await this.updateHealthStatus('database', dbHealth.status, dbHealth);
        await this.updateHealthStatus('posting_system', postingHealth.status, postingHealth);
        
        const overallHealth = {
            resources,
            database: dbHealth,
            posting: postingHealth,
            overall_status: this.calculateOverallStatus([
                resources.memory.usage_percent > 90 ? 'error' : 'healthy',
                dbHealth.status,
                postingHealth.status
            ])
        };
        
        console.log(`📊 System Health: ${overallHealth.overall_status}`);
        console.log(`💾 Memory: ${resources.memory.used}/${resources.memory.total}MB (${resources.memory.usage_percent}%)`);
        console.log(`📡 Database: ${dbHealth.status}`);
        console.log(`📝 Posting: ${postingHealth.status} (${postingHealth.success_rate || 0}% success)`);
        
        return overallHealth;
    }
    
    /**
     * Calculate overall system status
     */
    calculateOverallStatus(statuses) {
        if (statuses.includes('error')) return 'error';
        if (statuses.includes('warning')) return 'warning';
        return 'healthy';
    }
}

export const enhancedSystemHealth = new EnhancedSystemHealthMonitor();