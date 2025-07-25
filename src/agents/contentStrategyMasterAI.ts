import { OpenAIService } from '../utils/openaiService';
import { SecureSupabaseClient } from '../utils/secureSupabaseClient';

interface ContentStrategy {
    shortTermTactics: ContentTactic[]; // Next 24 hours
    mediumTermStrategy: ContentPlan[]; // Next week  
    longTermPositioning: PositioningGoal[]; // Next month
    emergencyPivots: PivotOption[]; // If things go wrong
}

interface ContentTactic {
    type: 'viral_attempt' | 'value_delivery' | 'engagement_bait' | 'authority_build' | 'relationship_nurture';
    content: string;
    timing: string;
    expectedOutcome: string;
    success_metrics: string[];
}

interface ContentPlan {
    theme: string;
    approach: string;
    content_types: string[];
    posting_frequency: string;
    success_indicators: string[];
}

interface PositioningGoal {
    positioning: string;
    tactics: string[];
    timeline: string;
    milestones: string[];
}

interface PivotOption {
    trigger: string;
    new_direction: string;
    implementation: string[];
    expected_recovery: string;
}

interface TwitterOptimization {
    optimizedContent: string;
    twitterSpecificImprovements: string[];
    expectedPerformance: TwitterMetrics;
    whyItWillWork: string;
}

interface TwitterMetrics {
    engagementRate: number;
    viralPotential: number;
    followerGrowth: number;
    authorityBuilding: number;
}

export class ContentStrategyMasterAI {
    private openaiService: OpenAIService;
    private supabaseClient: SecureSupabaseClient;

    // Content strategy frameworks from top Twitter accounts
    readonly CONTENT_FRAMEWORKS = {
        viral_formulas: [
            "Controversial Opinion + Evidence + Personal Story",
            "Common Mistake + Why It's Wrong + Better Alternative",
            "Prediction + Reasoning + Call for Discussion",
            "Behind-the-Scenes + Industry Secret + Value Add",
            "Challenge Conventional Wisdom + Data + Personal Experience"
        ],
        engagement_patterns: [
            "Question + Personal Experience + Ask for Stories",
            "Poll + Controversial Options + Explain Your Choice",
            "List + Ask for Additions + Share Your Favorites",
            "Story + Lesson Learned + Ask for Similar Experiences",
            "Mistake + What You Learned + Ask Others to Share"
        ],
        authority_builders: [
            "Study Analysis + Plain English Explanation + Practical Application",
            "Industry Trend + Personal Prediction + Supporting Evidence",
            "Complex Topic + Simple Breakdown + Action Steps",
            "Myth Busting + Evidence + Better Alternative",
            "Expert Interview + Key Insights + Your Commentary"
        ],
        follower_magnets: [
            "Unique Framework + How to Use It + Examples",
            "Contrarian Take + Why Everyone's Wrong + Proof",
            "Personal Transformation + Exact Steps + Encouragement",
            "Industry Secrets + Why They Work + How to Apply",
            "Resource List + Personal Favorites + Hidden Gems"
        ]
    };

    readonly TWITTER_PSYCHOLOGY = {
        scroll_motivations: [
            "Seeking dopamine hit from new information",
            "Looking for validation of existing beliefs",
            "Procrastinating from important tasks",
            "Wanting to feel connected to others",
            "Searching for opportunities to engage/debate",
            "Trying to learn something useful quickly"
        ],
        engagement_triggers: [
            "Curiosity gaps that demand resolution",
            "Strong emotions (anger, excitement, surprise)",
            "Social proof (others are engaging heavily)",
            "Personal relevance to their situation",
            "Controversial statements they want to weigh in on",
            "Practical value they want to save/share"
        ],
        following_psychology: [
            "Promise of ongoing valuable content",
            "Unique perspective they can't get elsewhere",
            "Authority in area they care about",
            "Entertainment value and personality",
            "Community and belonging feeling",
            "Status and identity signaling"
        ]
    };

    readonly CONTENT_OPTIMIZATION_RULES = {
        hooks: [
            "First 7 words determine if people read more",
            "Start with numbers, questions, or bold claims",
            "Create curiosity gap that demands resolution",
            "Promise specific value in opening line"
        ],
        structure: [
            "One idea per tweet for maximum impact",
            "Use line breaks for easy mobile reading",
            "End with question or call to action",
            "Include bookmark-worthy insights"
        ],
        twitter_specific: [
            "Optimize for quote tweets with bold statements",
            "Create reply-worthy content with questions",
            "Design for bookmarking with actionable tips",
            "Build thread potential for deeper engagement"
        ]
    };

    constructor() {
        this.openaiService = new OpenAIService();
        this.supabaseClient = new SecureSupabaseClient();
    }

    async developContentStrategy(): Promise<ContentStrategy> {
        console.log('📋 Developing comprehensive content strategy...');

        try {
            // Analyze current performance and audience
            const performanceData = await this.getPerformanceAnalysis();
            
            // Generate strategy components
            const [shortTerm, mediumTerm, longTerm, emergency] = await Promise.all([
                this.createShortTermTactics(performanceData),
                this.createMediumTermStrategy(performanceData),
                this.createLongTermPositioning(performanceData),
                this.createEmergencyPivots(performanceData)
            ]);

            return {
                shortTermTactics: shortTerm,
                mediumTermStrategy: mediumTerm,
                longTermPositioning: longTerm,
                emergencyPivots: emergency
            };

        } catch (error) {
            console.error('❌ Error developing content strategy:', error);
            return this.getDefaultStrategy();
        }
    }

    private async createShortTermTactics(performanceData: any): Promise<ContentTactic[]> {
        const prompt = `
        Create immediate content tactics for the next 24 hours:

        Performance Data: ${JSON.stringify(performanceData)}
        
        Content Frameworks: ${JSON.stringify(this.CONTENT_FRAMEWORKS)}
        Twitter Psychology: ${JSON.stringify(this.TWITTER_PSYCHOLOGY)}

        Generate 3-5 specific content pieces for today that:
        1. VIRAL_ATTEMPT: One high-risk, high-reward piece
        2. VALUE_DELIVERY: Guaranteed valuable content
        3. ENGAGEMENT_BAIT: Something that creates discussion
        4. AUTHORITY_BUILD: Content that builds credibility
        5. RELATIONSHIP_NURTURE: Content that connects with audience

        Each should include:
        - Exact content to post
        - Optimal timing
        - Expected outcome
        - Success metrics

        Focus on what will work TODAY based on current conditions.
        `;

        const response = await this.openaiService.generateCompletion([
            { role: 'system', content: 'You are a Twitter content strategist creating today\'s posting plan.' },
            { role: 'user', content: prompt }
        ]);

        try {
            const parsed = JSON.parse(response);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            return this.getDefaultShortTermTactics();
        }
    }

    private async createMediumTermStrategy(performanceData: any): Promise<ContentPlan[]> {
        const prompt = `
        Develop a week-long content strategy:

        Performance Analysis: ${JSON.stringify(performanceData)}
        
        Create a strategic content plan covering:
        1. THEME_DEVELOPMENT: What topics to focus on this week
        2. CONTENT_MIX: Balance of different content types
        3. POSTING_RHYTHM: Optimal frequency and timing
        4. GROWTH_TACTICS: Specific follower acquisition strategies
        5. ENGAGEMENT_BUILDING: Community building activities

        Consider:
        - What worked best in recent history
        - Current trending topics in health/wellness
        - Audience engagement patterns
        - Competitive landscape gaps

        Return detailed weekly strategy with specific plans.
        `;

        const response = await this.openaiService.generateCompletion([
            { role: 'system', content: 'You are creating a comprehensive weekly Twitter strategy.' },
            { role: 'user', content: prompt }
        ]);

        try {
            const parsed = JSON.parse(response);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            return this.getDefaultMediumTermStrategy();
        }
    }

    private async createLongTermPositioning(performanceData: any): Promise<PositioningGoal[]> {
        const prompt = `
        Design long-term positioning strategy for the next month:

        Current Performance: ${JSON.stringify(performanceData)}

        Develop positioning goals for:
        1. AUTHORITY_BUILDING: How to become recognized expert
        2. NICHE_DOMINATION: Owning specific health/wellness topics
        3. COMMUNITY_LEADERSHIP: Building engaged follower base
        4. THOUGHT_LEADERSHIP: Being source of innovative ideas
        5. NETWORK_EXPANSION: Strategic relationship building

        Each goal should include:
        - Specific positioning target
        - Tactical approaches
        - Timeline for achievement
        - Milestone markers

        Think long-term strategic positioning in the health space.
        `;

        const response = await this.openaiService.generateCompletion([
            { role: 'system', content: 'You are designing long-term Twitter positioning strategy.' },
            { role: 'user', content: prompt }
        ]);

        try {
            const parsed = JSON.parse(response);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            return this.getDefaultLongTermPositioning();
        }
    }

    private async createEmergencyPivots(performanceData: any): Promise<PivotOption[]> {
        const prompt = `
        Create emergency pivot strategies for potential problems:

        Current Strategy Context: ${JSON.stringify(performanceData)}

        Develop pivot plans for:
        1. ENGAGEMENT_DROP: If engagement suddenly decreases
        2. FOLLOWER_DECLINE: If followers start decreasing
        3. ALGORITHM_CHANGE: If Twitter algorithm shifts
        4. CONTROVERSY_FALLOUT: If content creates negative backlash
        5. COMPETITIVE_PRESSURE: If competitors gain significant advantage

        Each pivot should include:
        - Trigger conditions
        - New strategic direction
        - Implementation steps
        - Expected recovery timeline

        Focus on rapid recovery and adaptation strategies.
        `;

        const response = await this.openaiService.generateCompletion([
            { role: 'system', content: 'You are creating emergency response strategies for Twitter setbacks.' },
            { role: 'user', content: prompt }
        ]);

        try {
            const parsed = JSON.parse(response);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            return this.getDefaultEmergencyPivots();
        }
    }

    async optimizeForTwitterSuccess(content: string): Promise<TwitterOptimization> {
        console.log('⚡ Optimizing content for Twitter success...');

        const prompt = `
        Optimize this content for maximum Twitter performance:

        Original Content: "${content}"

        Optimization Rules: ${JSON.stringify(this.CONTENT_OPTIMIZATION_RULES)}
        Twitter Psychology: ${JSON.stringify(this.TWITTER_PSYCHOLOGY)}

        Apply Twitter-specific optimization:
        1. HOOK_OPTIMIZATION: Perfect the first 7 words for mobile preview
        2. ENGAGEMENT_TRIGGERS: Add elements that create replies/shares
        3. ALGORITHM_OPTIMIZATION: Structure for maximum reach
        4. VIRAL_POTENTIAL: Elements that could make it shareable
        5. FOLLOWER_CONVERSION: Why someone would follow after seeing this

        Return:
        - Optimized version of the content
        - Specific improvements made
        - Expected performance metrics
        - Detailed explanation of why it will work

        Make it irresistible to Twitter users.
        `;

        const response = await this.openaiService.generateCompletion([
            { role: 'system', content: 'You are a Twitter optimization expert maximizing content performance.' },
            { role: 'user', content: prompt }
        ]);

        try {
            return JSON.parse(response);
        } catch {
            return {
                optimizedContent: content,
                twitterSpecificImprovements: ['Add engaging hook', 'Include call to action'],
                expectedPerformance: {
                    engagementRate: 5,
                    viralPotential: 20,
                    followerGrowth: 10,
                    authorityBuilding: 60
                },
                whyItWillWork: 'Content provides value to target audience'
            };
        }
    }

    async createFollowerMagnet(magnetType: 'controversy' | 'utility' | 'insight' | 'entertainment' = 'utility'): Promise<{
        content: string;
        deploymentStrategy: string;
        followUpSequence: string[];
        expectedResults: string;
    }> {
        const prompt = `
        Create a powerful follower magnet of type: ${magnetType}

        Follower Magnet Frameworks: ${JSON.stringify(this.CONTENT_FRAMEWORKS.follower_magnets)}
        Following Psychology: ${JSON.stringify(this.TWITTER_PSYCHOLOGY.following_psychology)}

        Create content that:
        1. Immediately demonstrates value/uniqueness
        2. Makes people want to see more from this account
        3. Positions us as worth following in health/wellness
        4. Has high shareability potential

        Different magnet types:
        - CONTROVERSY: Bold, defensible opinion that sparks debate
        - UTILITY: Extremely practical tips/frameworks people save
        - INSIGHT: Unique perspective or insider knowledge
        - ENTERTAINMENT: Engaging story or humorous content

        Return complete follower magnet strategy with deployment plan.
        `;

        const response = await this.openaiService.generateCompletion([
            { role: 'system', content: 'You are creating a follower acquisition masterpiece.' },
            { role: 'user', content: prompt }
        ]);

        try {
            return JSON.parse(response);
        } catch {
            return {
                content: 'Most people get this wrong about health. Here\'s what actually works...',
                deploymentStrategy: 'Post during peak engagement hours with strong hook',
                followUpSequence: ['Engage with early comments', 'Share supporting evidence', 'Create follow-up thread'],
                expectedResults: 'Increased followers and engagement'
            };
        }
    }

    private async getPerformanceAnalysis(): Promise<any> {
        const { data: tweets } = await this.supabaseClient.client
            .from('tweets')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        const { data: engagement } = await this.supabaseClient.client
            .from('engagement_history')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(100);

        return {
            recentTweets: tweets || [],
            engagementData: engagement || [],
            totalTweets: tweets?.length || 0,
            avgEngagement: this.calculateAverageEngagement(engagement || [])
        };
    }

    private calculateAverageEngagement(engagement: any[]): number {
        if (engagement.length === 0) return 0;
        const total = engagement.reduce((sum, e) => sum + (e.engagement_count || 0), 0);
        return total / engagement.length;
    }

    private getDefaultStrategy(): ContentStrategy {
        return {
            shortTermTactics: this.getDefaultShortTermTactics(),
            mediumTermStrategy: this.getDefaultMediumTermStrategy(),
            longTermPositioning: this.getDefaultLongTermPositioning(),
            emergencyPivots: this.getDefaultEmergencyPivots()
        };
    }

    private getDefaultShortTermTactics(): ContentTactic[] {
        return [{
            type: 'value_delivery',
            content: 'Quick health tip that most people miss...',
            timing: '14:00 EST',
            expectedOutcome: 'High engagement and saves',
            success_metrics: ['10+ likes', '3+ comments', '2+ saves']
        }];
    }

    private getDefaultMediumTermStrategy(): ContentPlan[] {
        return [{
            theme: 'Practical health insights',
            approach: 'Value-first content with personal experiences',
            content_types: ['tips', 'personal stories', 'myth-busting'],
            posting_frequency: '1-2 times daily',
            success_indicators: ['Steady follower growth', 'Increased engagement rate']
        }];
    }

    private getDefaultLongTermPositioning(): PositioningGoal[] {
        return [{
            positioning: 'Trusted health and wellness authority',
            tactics: ['Consistent valuable content', 'Evidence-based information', 'Personal experiences'],
            timeline: '30 days',
            milestones: ['100 new followers', 'Increased engagement rate', 'Authority recognition']
        }];
    }

    private getDefaultEmergencyPivots(): PivotOption[] {
        return [{
            trigger: 'Engagement drops below 50% of normal',
            new_direction: 'Increase personal storytelling and controversy',
            implementation: ['Share more personal experiences', 'Take stronger positions', 'Ask more questions'],
            expected_recovery: '1-2 weeks'
        }];
    }
} 