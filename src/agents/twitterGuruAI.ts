import { OpenAIService } from '../utils/openaiService';
import { SecureSupabaseClient } from '../utils/secureSupabaseClient';
import { TwitterPlatformMasterAI } from './twitterPlatformMasterAI';
import { TwitterBoundaryAI } from './twitterBoundaryAI';

interface TwitterContext {
    currentGoal: 'growth' | 'engagement' | 'authority' | 'viral' | 'relationship';
    timeOfDay: string;
    dayOfWeek: string;
    recentPerformance: any[];
    competitorActivity: any[];
    audienceState: string;
    opportunityWindow: any;
    contentHistory: any[];
}

interface TwitterDecision {
    action: 'post_content' | 'engage_strategically' | 'build_relationships' | 'wait_for_timing' | 'pivot_strategy';
    content?: string;
    reasoning: string;
    confidence: number;
    expectedImpact: {
        engagement: number;
        followers: number;
        authority: number;
        viral_potential: number;
    };
    timing: string;
    followUp: string[];
}

interface TwitterAnalysis {
    // Account state analysis
    currentFollowerMomentum: string;
    engagementHealth: string;
    accountPositioning: string;
    
    // Platform state analysis  
    algorithmBehavior: string;
    competitorActivity: string;
    trendingOpportunities: string[];
    
    // Audience state analysis
    followerBehavior: string;
    engagementTiming: string;
    contentGaps: string[];
}

export class TwitterGuruAI {
    private openaiService: OpenAIService;
    private supabaseClient: SecureSupabaseClient;
    private platformMaster: TwitterPlatformMasterAI;
    private boundaryAI: TwitterBoundaryAI;

    // Twitter expert knowledge base
    readonly GURU_STRATEGIES = {
        growth: {
            followerMagnets: [
                "Controversial but defensible opinions that spark debate",
                "Ultra-valuable thread content that people bookmark",
                "Behind-the-scenes insights people can't get elsewhere",
                "Contrarian takes on trending topics with evidence",
                "Personal transformation stories with lessons"
            ],
            timingSecrets: [
                "Post controversial content when your audience is most reactive",
                "Share valuable content when people are looking to learn",
                "Join trending conversations within first 2 hours for visibility",
                "Post personal stories during emotional connection times"
            ],
            conversionTactics: [
                "Bio optimization for immediate value promise",
                "Pinned tweet that hooks and converts",
                "Consistent value delivery that builds expectation",
                "Strategic engagement with bigger accounts"
            ]
        },
        engagement: {
            psychologyTriggers: [
                "Ask questions that demand personal responses",
                "Share relatable struggles that create connection",
                "Challenge common assumptions people hold",
                "Provide actionable tips people want to save",
                "Tell stories that evoke emotional responses"
            ],
            algorithmHacks: [
                "First 30 minutes determine reach - optimize for immediate engagement",
                "Replies count more than likes - create reply-worthy content",
                "Threads keep people on platform - algorithm rewards this",
                "Consistent posting times build algorithm trust"
            ]
        },
        authority: {
            credibilityBuilders: [
                "Share unique insights from personal experience",
                "Reference credible sources and studies",
                "Admit mistakes and lessons learned",
                "Engage thoughtfully with other experts",
                "Provide evidence for controversial claims"
            ],
            thoughtLeadership: [
                "Predict trends before they happen",
                "Explain complex topics simply",
                "Take nuanced positions on polarizing issues",
                "Share behind-the-scenes industry knowledge"
            ]
        }
    };

    readonly DECISION_FRAMEWORKS = {
        contentDecision: [
            "What does my audience need right now?",
            "What opportunity exists that others are missing?", 
            "How can I add unique value to existing conversations?",
            "What would make someone immediately want to follow me?",
            "How does this build toward my long-term positioning?"
        ],
        timingDecision: [
            "When is my audience most active and receptive?",
            "What's the current conversation climate?",
            "Is there a trending topic I can add value to?",
            "What time would maximize algorithmic amplification?",
            "Should I lead the conversation or join an existing one?"
        ],
        engagementDecision: [
            "Which conversations deserve my limited daily engagement?",
            "How can I add value while showcasing expertise?",
            "Which relationships would benefit my growth most?",
            "What engagement pattern builds authentic connections?",
            "How can I be memorable in crowded conversations?"
        ]
    };

    constructor() {
        this.openaiService = new OpenAIService();
        this.supabaseClient = new SecureSupabaseClient();
        this.platformMaster = new TwitterPlatformMasterAI();
        this.boundaryAI = new TwitterBoundaryAI();
    }

    async makeTwitterDecision(context: TwitterContext): Promise<TwitterDecision> {
        console.log('🧠 Twitter Guru analyzing situation and making strategic decision...');

        try {
            // Step 1: Analyze complete context
            const analysis = await this.analyzeContext(context);
            
            // Step 2: Generate decision options
            const options = await this.generateDecisionOptions(context, analysis);
            
            // Step 3: Select optimal decision using guru expertise
            const decision = await this.selectOptimalDecision(options, context, analysis);
            
            // Step 4: Validate decision with boundary AI
            const safetyCheck = await this.validateDecisionSafety(decision);
            
            if (safetyCheck.complianceStatus === 'blocked') {
                return await this.generateSafeAlternative(decision, safetyCheck);
            }

            console.log(`🎯 Twitter Guru Decision: ${decision.action} (${decision.confidence}% confidence)`);
            return decision;

        } catch (error) {
            console.error('❌ Error in Twitter Guru decision making:', error);
            return this.getConservativeDecision(context);
        }
    }

    private async analyzeContext(context: TwitterContext): Promise<TwitterAnalysis> {
        console.log('📊 Analyzing complete Twitter context...');

        // Get platform environment analysis
        const platformData = await this.platformMaster.analyzeTwitterEnvironment();
        
        // Analyze our account performance
        const accountAnalysis = await this.analyzeAccountState(context);
        
        // Assess opportunities and threats
        const opportunityAnalysis = await this.identifyOpportunities(context, platformData);

        return {
            // Account state
            currentFollowerMomentum: accountAnalysis.momentum,
            engagementHealth: accountAnalysis.engagement,
            accountPositioning: accountAnalysis.positioning,
            
            // Platform state
            algorithmBehavior: platformData.currentAlgorithmBehavior,
            competitorActivity: this.analyzeCompetitorState(context.competitorActivity),
            trendingOpportunities: opportunityAnalysis.trending,
            
            // Audience state
            followerBehavior: accountAnalysis.audienceBehavior,
            engagementTiming: opportunityAnalysis.timing,
            contentGaps: opportunityAnalysis.gaps
        };
    }

    private async analyzeAccountState(context: TwitterContext): Promise<any> {
        const prompt = `
        As a Twitter growth expert, analyze this account's current state:

        Recent Performance: ${JSON.stringify(context.recentPerformance)}
        Content History: ${JSON.stringify(context.contentHistory.slice(0, 10))}
        Current Goal: ${context.currentGoal}

        Guru Decision Frameworks:
        ${JSON.stringify(this.DECISION_FRAMEWORKS)}

        Provide deep analysis of:
        1. FOLLOWER_MOMENTUM: Is growth accelerating, stable, or declining?
        2. ENGAGEMENT_HEALTH: Quality and patterns of audience interaction
        3. ACCOUNT_POSITIONING: How we're perceived in the health/wellness space
        4. AUDIENCE_BEHAVIOR: When and how our followers engage
        5. STRATEGIC_OPPORTUNITIES: Immediate growth opportunities

        Think like a Twitter expert with 10+ years of experience.
        `;

        const response = await this.openaiService.generateCompletion([
            { role: 'system', content: 'You are a legendary Twitter growth strategist.' },
            { role: 'user', content: prompt }
        ]);

        try {
            return JSON.parse(response);
        } catch {
            return this.getDefaultAccountAnalysis();
        }
    }

    private async generateDecisionOptions(context: TwitterContext, analysis: TwitterAnalysis): Promise<TwitterDecision[]> {
        const prompt = `
        You are a Twitter guru with millions of followers. Generate strategic options:

        Context: ${JSON.stringify(context)}
        Analysis: ${JSON.stringify(analysis)}
        
        Guru Strategies: ${JSON.stringify(this.GURU_STRATEGIES)}

        Based on expert Twitter knowledge, generate 3-5 strategic options for what to do right now:

        Each option should include:
        1. ACTION: Specific action to take
        2. CONTENT: Exact content if applicable
        3. REASONING: Why this would work based on Twitter psychology
        4. EXPECTED_IMPACT: Predicted results
        5. CONFIDENCE: How sure you are this will work
        6. TIMING: When to execute
        7. FOLLOW_UP: Next steps after this action

        Think like someone who truly understands Twitter at a deep level.
        `;

        const response = await this.openaiService.generateCompletion([
            { role: 'system', content: 'You are the world\'s leading Twitter growth expert who has grown multiple accounts to millions of followers.' },
            { role: 'user', content: prompt }
        ]);

        try {
            const parsed = JSON.parse(response);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            return this.getDefaultDecisionOptions(context);
        }
    }

    private async selectOptimalDecision(options: TwitterDecision[], context: TwitterContext, analysis: TwitterAnalysis): Promise<TwitterDecision> {
        const prompt = `
        As the ultimate Twitter strategist, select the best option:

        Options: ${JSON.stringify(options)}
        Context: ${JSON.stringify(context)}
        Analysis: ${JSON.stringify(analysis)}

        Selection Criteria:
        1. ALIGNMENT: How well does it serve the current goal?
        2. TIMING: Is this the optimal moment for this action?
        3. IMPACT_POTENTIAL: Expected results vs effort
        4. RISK_ASSESSMENT: Chance of negative consequences
        5. STRATEGIC_FIT: How it builds long-term positioning

        Choose the option that a Twitter expert would pick and explain why.
        Return the selected option with enhanced reasoning.
        `;

        const response = await this.openaiService.generateCompletion([
            { role: 'system', content: 'You are making a critical Twitter strategy decision with expert judgment.' },
            { role: 'user', content: prompt }
        ]);

        try {
            return JSON.parse(response);
        } catch {
            return options[0] || this.getConservativeDecision(context);
        }
    }

    private async validateDecisionSafety(decision: TwitterDecision): Promise<any> {
        if (decision.content) {
            return await this.boundaryAI.assessAction({
                type: 'tweet',
                content: decision.content,
                timing: decision.timing
            });
        }
        
        return { complianceStatus: 'safe', safetyScore: 100 };
    }

    private async generateSafeAlternative(originalDecision: TwitterDecision, safetyIssues: any): Promise<TwitterDecision> {
        const prompt = `
        Original decision was blocked for safety. Create a safe alternative:

        Original Decision: ${JSON.stringify(originalDecision)}
        Safety Issues: ${JSON.stringify(safetyIssues)}

        Create an alternative that:
        1. Achieves the same strategic goal
        2. Avoids the safety issues
        3. Maintains effectiveness
        4. Follows Twitter best practices

        Return a revised decision that's both safe and effective.
        `;

        const response = await this.openaiService.generateCompletion([
            { role: 'system', content: 'You are a Twitter safety expert creating compliant alternatives.' },
            { role: 'user', content: prompt }
        ]);

        try {
            return JSON.parse(response);
        } catch {
            return this.getConservativeDecision({} as TwitterContext);
        }
    }

    async getTwitterExpertRecommendation(situation: string): Promise<{
        recommendation: string;
        reasoning: string;
        tactics: string[];
        pitfalls: string[];
    }> {
        const prompt = `
        You are a Twitter expert who has grown accounts from 0 to millions of followers.

        Situation: ${situation}

        Expert Knowledge Base:
        ${JSON.stringify(this.GURU_STRATEGIES)}

        Provide expert recommendation:
        1. RECOMMENDATION: What a Twitter guru would do
        2. REASONING: The psychology and strategy behind it
        3. TACTICS: Specific actionable steps
        4. PITFALLS: What to avoid based on experience

        Give advice that only someone with deep Twitter expertise would know.
        `;

        const response = await this.openaiService.generateCompletion([
            { role: 'system', content: 'You are the world\'s most successful Twitter growth expert.' },
            { role: 'user', content: prompt }
        ]);

        try {
            return JSON.parse(response);
        } catch {
            return {
                recommendation: "Focus on providing genuine value to your specific audience",
                reasoning: "Authentic value creation builds sustainable growth",
                tactics: ["Identify audience pain points", "Create helpful content", "Engage authentically"],
                pitfalls: ["Don't chase trends without adding value", "Avoid generic content"]
            };
        }
    }

    private analyzeCompetitorState(competitorActivity: any[]): string {
        if (!competitorActivity || competitorActivity.length === 0) {
            return "Limited competitor data - opportunity for differentiation";
        }
        
        return "Analyzing competitor patterns for strategic opportunities";
    }

    private async identifyOpportunities(context: TwitterContext, platformData: any): Promise<any> {
        return {
            trending: platformData.platformTrends?.map((t: any) => t.opportunity) || [],
            timing: "Prime engagement window based on audience patterns",
            gaps: ["Underserved content angles", "Timing opportunities", "Engagement gaps"]
        };
    }

    private getDefaultAccountAnalysis(): any {
        return {
            momentum: "Steady growth with optimization opportunities",
            engagement: "Moderate engagement with room for improvement",
            positioning: "Building authority in health/wellness space",
            audienceBehavior: "Active during business hours and evenings"
        };
    }

    private getDefaultDecisionOptions(context: TwitterContext): TwitterDecision[] {
        return [{
            action: 'post_content',
            content: 'Create valuable health content for your audience',
            reasoning: 'Consistent value delivery builds audience trust',
            confidence: 70,
            expectedImpact: {
                engagement: 60,
                followers: 40,
                authority: 70,
                viral_potential: 30
            },
            timing: 'Next optimal window',
            followUp: ['Monitor engagement', 'Respond to comments']
        }];
    }

    private getConservativeDecision(context: TwitterContext): TwitterDecision {
        return {
            action: 'wait_for_timing',
            reasoning: 'Conservative approach due to analysis limitations',
            confidence: 50,
            expectedImpact: {
                engagement: 40,
                followers: 20,
                authority: 60,
                viral_potential: 10
            },
            timing: 'Wait for optimal conditions',
            followUp: ['Re-analyze in 1 hour', 'Monitor platform changes']
        };
    }
} 