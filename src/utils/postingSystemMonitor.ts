
// 📊 POSTING SYSTEM MONITOR
export class PostingSystemMonitor {
    
    static async getSystemStatus(): Promise<{
        status: 'healthy' | 'warning' | 'error';
        metrics: any;
        issues: string[];
        recommendations: string[];
    }> {
        const issues: string[] = [];
        const recommendations: string[] = [];
        
        try {
            // Check last post time
            const lastPostTime = await this.getLastPostTime();
            const hoursSinceLastPost = lastPostTime ? 
                (Date.now() - lastPostTime.getTime()) / (1000 * 60 * 60) : 0;
                
            // Check budget status
            const { emergencyBudgetLockdown } = await import('./emergencyBudgetLockdown');
            const budgetStatus = await emergencyBudgetLockdown.isLockedDown();
            
            // Calculate metrics
            const dailyPosts = await this.getDailyPostCount();
            const successRate = await this.getRecentSuccessRate();
            
            // Assess health
            if (budgetStatus.lockdownActive) {
                issues.push('Budget lockdown active');
                recommendations.push('Wait for daily budget reset');
            }
            
            if (hoursSinceLastPost > 12) {
                issues.push(`${hoursSinceLastPost.toFixed(1)} hours since last post`);
                recommendations.push('Check posting engine status');
            }
            
            if (dailyPosts < 2) {
                issues.push('Low daily post frequency');
                recommendations.push('Verify posting schedule is active');
            }
            
            const status = issues.length === 0 ? 'healthy' : 
                          issues.length <= 2 ? 'warning' : 'error';
            
            return {
                status,
                metrics: {
                    hoursSinceLastPost,
                    dailyPosts,
                    successRate,
                    budgetSpent: budgetStatus.totalSpent,
                    budgetRemaining: budgetStatus.dailyLimit - budgetStatus.totalSpent
                },
                issues,
                recommendations
            };
            
        } catch (error) {
            return {
                status: 'error',
                metrics: {},
                issues: [`Monitor error: ${error.message}`],
                recommendations: ['Check system logs']
            };
        }
    }
    
    private static async getLastPostTime(): Promise<Date | null> {
        try {
            const { supabaseClient } = await import('./supabaseClient');
            
            const { data } = await supabaseClient.supabase
                .from('learning_posts')
                .select('posted_at')
                .order('posted_at', { ascending: false })
                .limit(1);
                
            return data?.[0] ? new Date(data[0].posted_at) : null;
        } catch {
            return null;
        }
    }
    
    private static async getDailyPostCount(): Promise<number> {
        try {
            const { supabaseClient } = await import('./supabaseClient');
            const today = new Date().toISOString().split('T')[0];
            
            const { count } = await supabaseClient.supabase
                .from('learning_posts')
                .select('*', { count: 'exact' })
                .gte('posted_at', `${today}T00:00:00.000Z`);
                
            return count || 0;
        } catch {
            return 0;
        }
    }
    
    private static async getRecentSuccessRate(): Promise<number> {
        // This would calculate based on successful vs failed posting attempts
        return 85; // Simulated for now
    }
}