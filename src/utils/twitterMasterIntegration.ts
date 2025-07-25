import { TwitterMasterSystem } from '../agents/twitterMasterSystem';
import { SecureSupabaseClient } from './secureSupabaseClient';
import { PostTweetAgent } from '../agents/postTweet';
import { StreamlinedPostAgent } from '../agents/streamlinedPostAgent';

/**
 * 🔗 TWITTER MASTER SYSTEM INTEGRATION
 * 
 * This adapter connects the new Twitter Master System with the existing bot infrastructure.
 * It provides a bridge between the old posting agents and the new AI decision system.
 */
export class TwitterMasterIntegration {
    private static instance: TwitterMasterIntegration;
    private masterSystem: TwitterMasterSystem;
    private supabaseClient: SecureSupabaseClient;
    private postTweetAgent: PostTweetAgent;
    private streamlinedAgent: StreamlinedPostAgent;
    private isEnabled: boolean = false;

    private constructor() {
        this.masterSystem = new TwitterMasterSystem();
        this.supabaseClient = new SecureSupabaseClient();
        this.postTweetAgent = new PostTweetAgent();
        this.streamlinedAgent = new StreamlinedPostAgent();
    }

    static getInstance(): TwitterMasterIntegration {
        if (!this.instance) {
            this.instance = new TwitterMasterIntegration();
        }
        return this.instance;
    }

    /**
     * 🚀 ENABLE TWITTER MASTER SYSTEM
     * 
     * This switches the bot from old posting logic to new AI-powered decisions
     */
    async enableMasterSystem(): Promise<boolean> {
        try {
            console.log('🧠 ENABLING TWITTER MASTER SYSTEM...');
            
            // Check if database supports the new system
            const databaseReady = await this.checkDatabaseSupport();
            if (!databaseReady) {
                console.error('❌ Database not ready for Twitter Master System');
                return false;
            }

            // Check system health
            const systemStatus = await this.masterSystem.getSystemStatus();
            if (systemStatus.status === 'critical') {
                console.error('❌ Twitter Master System in critical state');
                return false;
            }

            this.isEnabled = true;
            
            // Update system config
            await this.updateSystemConfig('twitter_master_enabled', 'true');
            
            console.log('✅ TWITTER MASTER SYSTEM ENABLED');
            console.log(`🎯 System Status: ${systemStatus.status}`);
            console.log(`📊 Readiness Score: ${systemStatus.readiness}%`);
            
            return true;

        } catch (error) {
            console.error('❌ Failed to enable Twitter Master System:', error);
            return false;
        }
    }

    /**
     * 🤖 INTELLIGENT POSTING DECISION
     * 
     * This replaces the old "just post content" logic with AI decision-making
     */
    async makeIntelligentPostingDecision(): Promise<{
        shouldPost: boolean;
        action: string;
        content?: string;
        reasoning: string;
        confidence: number;
    }> {
        if (!this.isEnabled) {
            return {
                shouldPost: true,
                action: 'fallback_post',
                reasoning: 'Twitter Master System not enabled - using fallback posting',
                confidence: 50
            };
        }

        try {
            console.log('🧠 CONSULTING TWITTER MASTER SYSTEM...');

            // Gather current situation
            const situation = await this.getCurrentSituation();
            
            // Get AI decision
            const decision = await this.masterSystem.makeIntelligentDecision(situation);
            
            // Log the decision
            await this.logMasterDecision(decision, situation);

            console.log(`🎯 MASTER DECISION: ${decision.type}`);
            console.log(`💡 REASONING: ${decision.reasoning}`);
            console.log(`📊 CONFIDENCE: ${decision.confidence}%`);

            return {
                shouldPost: decision.type === 'post_content',
                action: decision.type,
                content: decision.content,
                reasoning: decision.reasoning,
                confidence: decision.confidence
            };

        } catch (error) {
            console.error('❌ Twitter Master System decision failed:', error);
            return {
                shouldPost: true,
                action: 'error_fallback',
                reasoning: 'AI decision failed - using safe fallback',
                confidence: 30
            };
        }
    }

    /**
     * 📊 GET CURRENT TWITTER SITUATION
     */
    private async getCurrentSituation(): Promise<any> {
        const now = new Date();
        const estTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
        
        // Get recent performance
        const recentPerformance = await this.getRecentPerformance();
        
        // Get current follower count (from last tracking)
        const followerCount = await this.getCurrentFollowerCount();

        return {
            currentGoal: 'growth', // Primary goal is always growth
            timeContext: {
                currentTime: estTime.toTimeString().split(' ')[0],
                dayOfWeek: estTime.toLocaleDateString('en-US', { weekday: 'long' }),
                seasonality: this.getCurrentSeason()
            },
            accountState: {
                followerCount: followerCount,
                recentPerformance: recentPerformance,
                engagementTrend: this.calculateEngagementTrend(recentPerformance)
            },
            platformState: {
                trendingTopics: await this.getTrendingTopics(),
                algorithmBehavior: 'favoring engagement velocity',
                competitiveActivity: 'moderate'
            }
        };
    }

    /**
     * 📈 GET RECENT PERFORMANCE DATA
     */
    private async getRecentPerformance(): Promise<any[]> {
        try {
            const { data } = await this.supabaseClient.client
                .from('tweets')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(10);

            return data || [];
        } catch (error) {
            console.warn('⚠️ Could not get recent performance:', error);
            return [];
        }
    }

    /**
     * 👥 GET CURRENT FOLLOWER COUNT
     */
    private async getCurrentFollowerCount(): Promise<number> {
        try {
            const { data } = await this.supabaseClient.client
                .from('follower_growth_analytics')
                .select('follower_count')
                .order('date', { ascending: false })
                .limit(1)
                .single();

            return data?.follower_count || 1250; // Default estimate
        } catch (error) {
            console.warn('⚠️ Could not get follower count:', error);
            return 1250; // Default estimate
        }
    }

    /**
     * 📊 CALCULATE ENGAGEMENT TREND
     */
    private calculateEngagementTrend(recentPerformance: any[]): string {
        if (recentPerformance.length < 3) return 'insufficient_data';
        
        const recent = recentPerformance.slice(0, 3);
        const older = recentPerformance.slice(3, 6);
        
        const recentAvg = recent.reduce((sum, tweet) => sum + (tweet.engagement_score || 0), 0) / recent.length;
        const olderAvg = older.reduce((sum, tweet) => sum + (tweet.engagement_score || 0), 0) / older.length;
        
        if (recentAvg > olderAvg * 1.2) return 'improving';
        if (recentAvg < olderAvg * 0.8) return 'declining';
        return 'stable';
    }

    /**
     * 🔥 GET TRENDING TOPICS
     */
    private async getTrendingTopics(): Promise<string[]> {
        // This would ideally get real trending topics
        // For now, return health-related trending topics
        return [
            'winter wellness',
            'health resolutions',
            'productivity tips',
            'mental health awareness',
            'nutrition trends'
        ];
    }

    /**
     * 🗓️ GET CURRENT SEASON
     */
    private getCurrentSeason(): string {
        const month = new Date().getMonth();
        if (month >= 2 && month <= 4) return 'Spring';
        if (month >= 5 && month <= 7) return 'Summer';
        if (month >= 8 && month <= 10) return 'Fall';
        return 'Winter';
    }

    /**
     * 📝 LOG MASTER DECISION
     */
    private async logMasterDecision(decision: any, situation: any): Promise<void> {
        try {
            await this.supabaseClient.client
                .from('twitter_master_decisions')
                .insert({
                    situation_context: situation,
                    decision_type: decision.type,
                    decision_content: decision.content,
                    reasoning: decision.reasoning,
                    confidence_score: decision.confidence,
                    expected_impact: decision.expectedImpact,
                    execution_plan: decision.executionPlan,
                    success_metrics: decision.successMetrics
                });
        } catch (error) {
            console.warn('⚠️ Could not log master decision:', error);
        }
    }

    /**
     * 🔧 CHECK DATABASE SUPPORT
     */
    private async checkDatabaseSupport(): Promise<boolean> {
        try {
            // Check if essential Twitter Master tables exist
            const tables = [
                'twitter_master_decisions',
                'twitter_master_config',
                'system_health_status'
            ];

            for (const table of tables) {
                const { error } = await this.supabaseClient.client
                    .from(table)
                    .select('id')
                    .limit(1);

                if (error && error.message.includes('does not exist')) {
                    console.warn(`⚠️ Missing table: ${table}`);
                    console.log('📝 Please run migration: migrations/20250124_twitter_master_system_tables.sql');
                    return false;
                }
            }

            console.log('✅ Database supports Twitter Master System');
            return true;

        } catch (error) {
            console.error('❌ Database support check failed:', error);
            return false;
        }
    }

    /**
     * ⚙️ UPDATE SYSTEM CONFIG
     */
    private async updateSystemConfig(key: string, value: string): Promise<void> {
        try {
            await this.supabaseClient.client
                .from('twitter_master_config')
                .upsert({
                    config_key: key,
                    config_value: value,
                    updated_at: new Date().toISOString()
                });
        } catch (error) {
            console.warn('⚠️ Could not update system config:', error);
        }
    }

    /**
     * 🎯 ENHANCED POSTING WITH AI
     * 
     * This replaces the old posting methods with AI-enhanced decisions
     */
    async enhancedPost(): Promise<boolean> {
        const decision = await this.makeIntelligentPostingDecision();
        
        if (!decision.shouldPost) {
            console.log(`🤔 AI Decision: ${decision.action} - ${decision.reasoning}`);
            return false;
        }

        try {
            // Use AI-optimized content if provided, otherwise use existing generation
            if (decision.content) {
                console.log('🧠 Using AI-optimized content...');
                return await this.postTweetAgent.postTweet(decision.content);
            } else {
                console.log('🧠 AI approves posting - using content generation...');
                return await this.streamlinedAgent.generateAndPost();
            }

        } catch (error) {
            console.error('❌ Enhanced posting failed:', error);
            return false;
        }
    }

    /**
     * 📊 GET INTEGRATION STATUS
     */
    async getIntegrationStatus(): Promise<{
        enabled: boolean;
        systemHealth: any;
        databaseSupport: boolean;
        recommendations: string[];
    }> {
        const systemHealth = await this.masterSystem.getSystemStatus();
        const databaseSupport = await this.checkDatabaseSupport();

        const recommendations = [];
        
        if (!this.isEnabled) {
            recommendations.push('Enable Twitter Master System for AI-powered decisions');
        }
        
        if (!databaseSupport) {
            recommendations.push('Run database migration for Twitter Master System tables');
        }
        
        if (systemHealth.readiness < 80) {
            recommendations.push('Review system health components');
        }

        return {
            enabled: this.isEnabled,
            systemHealth: systemHealth,
            databaseSupport: databaseSupport,
            recommendations: recommendations
        };
    }
}

// Export singleton instance
export const twitterMasterIntegration = TwitterMasterIntegration.getInstance(); 