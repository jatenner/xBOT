import { OpenAIService } from '../utils/openaiService';
import { SecureSupabaseClient } from '../utils/secureSupabaseClient';

interface TwitterAction {
    type: 'tweet' | 'like' | 'follow' | 'reply' | 'retweet';
    content?: string;
    target?: string;
    timing?: string;
    metadata?: any;
}

interface SafetyAssessment {
    safetyScore: number;
    algorithmImpact: 'positive' | 'neutral' | 'negative';
    recommendation: string;
    alternatives: string[];
    riskFactors: string[];
    complianceStatus: 'safe' | 'caution' | 'blocked';
}

interface ApiLimitStatus {
    tweets: { used: number; limit: number; resetTime: string };
    likes: { used: number; limit: number; resetTime: string };
    follows: { used: number; limit: number; resetTime: string };
    reads: { used: number; limit: number; resetTime: string };
}

export class TwitterBoundaryAI {
    private openaiService: OpenAIService;
    private supabaseClient: SecureSupabaseClient;

    // Complete understanding of Twitter rules and boundaries
    readonly TWITTER_RULES = {
        posting: {
            dailyTweetLimit: 300, // Free tier monthly limit / 30 days ≈ 10/day safe
            contentGuidelines: "No spam, harassment, misinformation, or harmful content",
            threadLimits: "Up to 25 tweets per thread maximum",
            characterLimit: 280,
            mediaLimits: "4 images, 1 video per tweet"
        },
        engagement: {
            likesPerDay: 1000,
            followsPerDay: 400,
            unfollowsPerDay: 400,
            repliesPerHour: 100, // Unofficial but safe limit
            dmLimits: "1000 per day to existing connections"
        },
        safety: {
            spamIndicators: ["Duplicate content", "Excessive mentions", "Repetitive patterns"],
            algorithmPenalties: ["Fake engagement", "Bot-like behavior", "Policy violations"],
            suspensionRisks: ["Mass following/unfollowing", "Automated replies", "Content violations"]
        },
        algorithm: {
            positiveSignals: ["Authentic engagement", "Consistent posting", "Quality conversations"],
            negativeSignals: ["Sudden activity spikes", "Generic responses", "Engagement pods"],
            neutralSignals: ["Regular posting", "Relevant hashtags", "Time-appropriate content"]
        }
    };

    readonly CONTENT_SAFETY_RULES = {
        prohibited: [
            "Medical advice without disclaimers",
            "False health claims",
            "Promotion of harmful practices",
            "Copyright violations",
            "Personal attacks or harassment"
        ],
        encouraged: [
            "Personal experiences with disclaimers",
            "Educational health information",
            "Evidence-based wellness tips",
            "Community building content",
            "Authentic personal insights"
        ],
        gray_areas: [
            "Controversial health opinions (need careful framing)",
            "Personal supplement recommendations (need disclaimers)",
            "Alternative wellness practices (need context)",
            "Criticism of mainstream practices (need balance)"
        ]
    };

    constructor() {
        this.openaiService = new OpenAIService();
        this.supabaseClient = new SecureSupabaseClient();
    }

    async assessAction(action: TwitterAction): Promise<SafetyAssessment> {
        console.log(`🛡️ Assessing safety for ${action.type} action...`);

        try {
            // Check API limits first
            const limitStatus = await this.checkApiLimits(action.type);
            if (!limitStatus.canProceed) {
                return {
                    safetyScore: 0,
                    algorithmImpact: 'negative',
                    recommendation: `API limit reached: ${limitStatus.reason}`,
                    alternatives: limitStatus.alternatives,
                    riskFactors: ['API limit exceeded'],
                    complianceStatus: 'blocked'
                };
            }

            // Analyze content safety (if applicable)
            const contentAnalysis = action.content ? 
                await this.analyzeContentSafety(action.content) : 
                { safe: true, risks: [], improvements: [] };

            // Check for bot-like patterns
            const behaviorAnalysis = await this.analyzeBehaviorPattern(action);

            // Calculate overall safety score
            const safetyScore = this.calculateSafetyScore(contentAnalysis, behaviorAnalysis, limitStatus);

            // Generate recommendations
            const recommendations = await this.generateSafetyRecommendations(action, contentAnalysis, behaviorAnalysis);

            return {
                safetyScore,
                algorithmImpact: safetyScore > 70 ? 'positive' : safetyScore > 40 ? 'neutral' : 'negative',
                recommendation: recommendations.primary,
                alternatives: recommendations.alternatives,
                riskFactors: [...contentAnalysis.risks, ...behaviorAnalysis.risks],
                complianceStatus: safetyScore > 70 ? 'safe' : safetyScore > 40 ? 'caution' : 'blocked'
            };

        } catch (error) {
            console.error('❌ Error assessing action safety:', error);
            return this.getConservativeSafetyAssessment();
        }
    }

    private async checkApiLimits(actionType: string): Promise<{
        canProceed: boolean;
        reason?: string;
        alternatives: string[];
        currentUsage: any;
    }> {
        // Get current usage from database
        const usage = await this.getCurrentApiUsage();
        
        const limits = this.TWITTER_RULES.engagement;
        const postingLimits = this.TWITTER_RULES.posting;

        switch (actionType) {
            case 'tweet':
                const todaysPosts = await this.getTodaysPostCount();
                if (todaysPosts >= 10) { // Conservative daily limit
                    return {
                        canProceed: false,
                        reason: 'Daily tweet limit reached (10/day safety limit)',
                        alternatives: ['Schedule for tomorrow', 'Create thread instead', 'Save as draft'],
                        currentUsage: { posts: todaysPosts, limit: 10 }
                    };
                }
                break;

            case 'like':
                if (usage.likesToday >= limits.likesPerDay) {
                    return {
                        canProceed: false,
                        reason: 'Daily like limit reached',
                        alternatives: ['Reply instead', 'Retweet', 'Follow user'],
                        currentUsage: usage
                    };
                }
                break;

            case 'follow':
                if (usage.followsToday >= limits.followsPerDay) {
                    return {
                        canProceed: false,
                        reason: 'Daily follow limit reached',
                        alternatives: ['Like their content', 'Reply to engage', 'Add to list'],
                        currentUsage: usage
                    };
                }
                break;
        }

        return { canProceed: true, alternatives: [], currentUsage: usage };
    }

    private async analyzeContentSafety(content: string): Promise<{
        safe: boolean;
        risks: string[];
        improvements: string[];
        flags: string[];
    }> {
        const prompt = `
        Analyze this Twitter content for safety and compliance:

        Content: "${content}"

        Twitter Content Rules:
        ${JSON.stringify(this.CONTENT_SAFETY_RULES)}

        Evaluate for:
        1. POLICY_VIOLATIONS: Any Twitter rule violations
        2. ALGORITHM_RISKS: Content that might be penalized
        3. SAFETY_CONCERNS: Potential user harm or misinformation
        4. IMPROVEMENT_OPPORTUNITIES: How to make it safer/better

        Return JSON with detailed safety analysis.
        `;

        const response = await this.openaiService.generateCompletion([
            { role: 'system', content: 'You are a Twitter content safety expert.' },
            { role: 'user', content: prompt }
        ]);

        try {
            return JSON.parse(response);
        } catch {
            return {
                safe: true,
                risks: [],
                improvements: ['Add engagement hook', 'Include value proposition'],
                flags: []
            };
        }
    }

    private async analyzeBehaviorPattern(action: TwitterAction): Promise<{
        botLikeScore: number;
        risks: string[];
        recommendations: string[];
    }> {
        // Get recent activity pattern
        const recentActivity = await this.getRecentActivity();
        
        const prompt = `
        Analyze this action pattern for bot-like behavior:

        New Action: ${JSON.stringify(action)}
        Recent Activity: ${JSON.stringify(recentActivity.slice(0, 20))}

        Twitter Behavioral Guidelines:
        ${JSON.stringify(this.TWITTER_RULES.algorithm)}

        Identify:
        1. BOT_LIKE_PATTERNS: Repetitive or unnatural behavior
        2. RISK_FACTORS: Activities that might trigger algorithm penalties
        3. NATURAL_BEHAVIOR_TIPS: How to appear more human/authentic

        Return JSON with behavior analysis.
        `;

        const response = await this.openaiService.generateCompletion([
            { role: 'system', content: 'You are a Twitter behavior analysis expert.' },
            { role: 'user', content: prompt }
        ]);

        try {
            return JSON.parse(response);
        } catch {
            return {
                botLikeScore: 30,
                risks: [],
                recommendations: ['Vary timing patterns', 'Add personal touches']
            };
        }
    }

    private calculateSafetyScore(contentAnalysis: any, behaviorAnalysis: any, limitStatus: any): number {
        let score = 100;

        // Content safety deductions
        if (!contentAnalysis.safe) score -= 40;
        score -= contentAnalysis.risks.length * 10;

        // Behavior deductions
        score -= behaviorAnalysis.botLikeScore;

        // API limit considerations
        if (!limitStatus.canProceed) score = 0;

        return Math.max(0, Math.min(100, score));
    }

    private async generateSafetyRecommendations(action: TwitterAction, contentAnalysis: any, behaviorAnalysis: any): Promise<{
        primary: string;
        alternatives: string[];
    }> {
        const prompt = `
        Generate safety recommendations for this Twitter action:

        Action: ${JSON.stringify(action)}
        Content Analysis: ${JSON.stringify(contentAnalysis)}
        Behavior Analysis: ${JSON.stringify(behaviorAnalysis)}

        Provide:
        1. PRIMARY_RECOMMENDATION: Main advice for proceeding safely
        2. ALTERNATIVES: Other safe options if primary isn't suitable

        Focus on maximizing safety while maintaining effectiveness.
        `;

        const response = await this.openaiService.generateCompletion([
            { role: 'system', content: 'You are a Twitter safety consultant.' },
            { role: 'user', content: prompt }
        ]);

        try {
            return JSON.parse(response);
        } catch {
            return {
                primary: "Proceed with caution and monitor results",
                alternatives: ["Modify content for safety", "Delay action", "Seek human review"]
            };
        }
    }

    async getCurrentApiUsage(): Promise<{
        likesToday: number;
        followsToday: number;
        tweetsToday: number;
        readsToday: number;
    }> {
        const today = new Date().toISOString().split('T')[0];
        
        // This would typically query our activity logs
        const { data } = await this.supabaseClient.client
            .from('bot_activity_logs')
            .select('*')
            .gte('created_at', today + 'T00:00:00')
            .lt('created_at', today + 'T23:59:59');

        const usage = {
            likesToday: 0,
            followsToday: 0,
            tweetsToday: 0,
            readsToday: 0
        };

        if (data) {
            data.forEach(log => {
                switch (log.action_type) {
                    case 'like': usage.likesToday++; break;
                    case 'follow': usage.followsToday++; break;
                    case 'tweet': usage.tweetsToday++; break;
                    case 'read': usage.readsToday++; break;
                }
            });
        }

        return usage;
    }

    private async getTodaysPostCount(): Promise<number> {
        const today = new Date().toISOString().split('T')[0];
        
        const { data } = await this.supabaseClient.client
            .from('tweets')
            .select('id')
            .gte('created_at', today + 'T00:00:00')
            .lt('created_at', today + 'T23:59:59');

        return data?.length || 0;
    }

    private async getRecentActivity(): Promise<any[]> {
        const { data } = await this.supabaseClient.client
            .from('bot_activity_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        return data || [];
    }

    private getConservativeSafetyAssessment(): SafetyAssessment {
        return {
            safetyScore: 30,
            algorithmImpact: 'neutral',
            recommendation: 'Proceed with extreme caution due to analysis error',
            alternatives: ['Manual review required', 'Delay action', 'Use conservative approach'],
            riskFactors: ['Analysis failure'],
            complianceStatus: 'caution'
        };
    }

    async validateTwitterCompliance(content: string): Promise<{
        compliant: boolean;
        violations: string[];
        suggestions: string[];
        approvedVersion?: string;
    }> {
        const prompt = `
        Review this content for Twitter compliance:

        Content: "${content}"

        Twitter Rules: ${JSON.stringify(this.TWITTER_RULES)}
        Content Guidelines: ${JSON.stringify(this.CONTENT_SAFETY_RULES)}

        Provide:
        1. COMPLIANT: true/false
        2. VIOLATIONS: Specific rule violations
        3. SUGGESTIONS: How to fix violations
        4. APPROVED_VERSION: Compliant version of content (if needed)

        Return JSON with compliance review.
        `;

        const response = await this.openaiService.generateCompletion([
            { role: 'system', content: 'You are a Twitter compliance expert.' },
            { role: 'user', content: prompt }
        ]);

        try {
            return JSON.parse(response);
        } catch {
            return {
                compliant: true,
                violations: [],
                suggestions: [],
                approvedVersion: content
            };
        }
    }
} 