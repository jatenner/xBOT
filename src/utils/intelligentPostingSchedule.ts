
// 🕐 INTELLIGENT POSTING SCHEDULE OPTIMIZER
export class IntelligentPostingSchedule {
    
    private static readonly OPTIMAL_HOURS = [7, 9, 12, 15, 18, 20]; // Best posting times
    private static readonly MIN_INTERVAL_HOURS = 3;
    private static readonly MAX_DAILY_POSTS = 8;
    
    static shouldPostNow(): { shouldPost: boolean; reason: string; nextOptimalTime?: Date } {
        const now = new Date();
        const currentHour = now.getHours();
        
        // Check if current hour is optimal
        const isOptimalHour = this.OPTIMAL_HOURS.includes(currentHour);
        
        if (!isOptimalHour) {
            const nextOptimalHour = this.getNextOptimalHour(currentHour);
            const nextOptimalTime = new Date();
            nextOptimalTime.setHours(nextOptimalHour, 0, 0, 0);
            if (nextOptimalTime <= now) {
                nextOptimalTime.setDate(nextOptimalTime.getDate() + 1);
            }
            
            return {
                shouldPost: false,
                reason: `Waiting for optimal hour (${nextOptimalHour}:00)`,
                nextOptimalTime
            };
        }
        
        return {
            shouldPost: true,
            reason: `Optimal posting hour (${currentHour}:00)`
        };
    }
    
    private static getNextOptimalHour(currentHour: number): number {
        const nextHour = this.OPTIMAL_HOURS.find(hour => hour > currentHour);
        return nextHour || this.OPTIMAL_HOURS[0]; // Next day if none found
    }
    
    static calculateOptimalInterval(lastPostTime?: Date): number {
        if (!lastPostTime) return 0; // Post immediately if no previous posts
        
        const hoursSinceLastPost = (Date.now() - lastPostTime.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceLastPost >= 8) return 0; // Immediate post for catch-up
        if (hoursSinceLastPost >= 4) return 30; // Wait 30 minutes
        
        return (this.MIN_INTERVAL_HOURS - hoursSinceLastPost) * 60; // Minutes to wait
    }
}