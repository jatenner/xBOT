
// 🧠 POSTING PERFORMANCE LEARNING SYSTEM
export class PostingPerformanceLearner {
    
    static async recordPostPerformance(tweetId: string, content: string, metadata: any): Promise<void> {
        try {
            const { supabaseClient } = await import('./supabaseClient');
            
            await supabaseClient.supabase
                .from('learning_posts')
                .insert({
                    tweet_id: tweetId,
                    content: content,
                    posted_at: new Date().toISOString(),
                    format_used: metadata.format_used,
                    hook_type: metadata.hook_type,
                    predicted_engagement: metadata.predicted_engagement,
                    initial_quality_score: metadata.quality_score || 0
                });
                
            console.log(`📊 Recorded post performance: ${tweetId}`);
        } catch (error) {
            console.error('❌ Failed to record post performance:', error);
        }
    }
    
    static async updateEngagementMetrics(tweetId: string): Promise<void> {
        try {
            // This would fetch real engagement data from Twitter API
            // For now, simulate learning from posting patterns
            
            const { supabaseClient } = await import('./supabaseClient');
            
            await supabaseClient.supabase
                .from('learning_posts')
                .update({
                    last_checked: new Date().toISOString(),
                    learning_score: Math.random() * 100 // Simulated for now
                })
                .eq('tweet_id', tweetId);
                
        } catch (error) {
            console.error('❌ Failed to update engagement metrics:', error);
        }
    }
    
    static async getTopPerformingFormats(): Promise<any[]> {
        try {
            const { supabaseClient } = await import('./supabaseClient');
            
            const { data } = await supabaseClient.supabase
                .from('learning_posts')
                .select('format_used, hook_type, learning_score')
                .not('learning_score', 'is', null)
                .order('learning_score', { ascending: false })
                .limit(10);
                
            return data || [];
        } catch (error) {
            console.error('❌ Failed to get top performing formats:', error);
            return [];
        }
    }
}