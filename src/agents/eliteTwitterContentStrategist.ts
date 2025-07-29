/**
 * 🎯 ELITE TWITTER CONTENT STRATEGIST
 * ==================================
 * Creates viral, high-performing tweets in health/wellness/science space
 * Uses proven formats, data-driven insights, and creative intuition
 */

import { BudgetAwareOpenAI } from '../utils/budgetAwareOpenAI';
import { secureSupabaseClient } from '../utils/secureSupabaseClient';

interface ContentFormat {
    name: string;
    structure: string;
    examples: string[];
    engagement_multiplier: number;
    best_for: string[];
}

interface ViralTweet {
    content: string;
    engagement_rate: number;
    likes: number;
    retweets: number;
    format_used: string;
    hook_type: string;
}

interface ContentRequest {
    topic?: string;
    format_preference?: 'short' | 'thread' | 'auto';
    tone?: 'authoritative' | 'conversational' | 'provocative';
    target_engagement?: number;
}

interface GeneratedContent {
    content: string | string[];
    format_used: string;
    hook_type: string;
    predicted_engagement: number;
    reasoning: string;
    content_type: 'tweet' | 'thread';
}

export class EliteTwitterContentStrategist {
    private static instance: EliteTwitterContentStrategist;
    private budgetAwareOpenAI: BudgetAwareOpenAI;
    private viralFormats: ContentFormat[];
    private recentPerformance: ViralTweet[] = [];

    private constructor() {
        this.budgetAwareOpenAI = new BudgetAwareOpenAI(process.env.OPENAI_API_KEY!);
        this.initializeViralFormats();
    }

    public static getInstance(): EliteTwitterContentStrategist {
        if (!EliteTwitterContentStrategist.instance) {
            EliteTwitterContentStrategist.instance = new EliteTwitterContentStrategist();
        }
        return EliteTwitterContentStrategist.instance;
    }

    private initializeViralFormats(): void {
        this.viralFormats = [
            {
                name: "Hook-Value-CTA",
                structure: "Attention-grabbing statement → Valuable insight/data → Call to action",
                examples: [
                    "You've been lied to about sleep. Here's what 20 years of research actually shows: [insight]. Try this tonight.",
                    "The $50B supplement industry doesn't want you to know this. [revelation]. Do this instead."
                ],
                engagement_multiplier: 1.8,
                best_for: ["health_myths", "research_reveals", "contrarian_takes"]
            },
            {
                name: "Research_Bomb",
                structure: "Shocking statistic → Brief explanation → Practical application",
                examples: [
                    "94% of people are deficient in this nutrient. Yet 99% of doctors never test for it. Here's why:",
                    "New study: 8 minutes of this daily activity = 30% lower disease risk. The mechanism:"
                ],
                engagement_multiplier: 2.1,
                best_for: ["new_research", "health_stats", "science_updates"]
            },
            {
                name: "Story_Revelation",
                structure: "Personal story/case study → Surprising discovery → Universal principle",
                examples: [
                    "My patient reversed diabetes in 90 days. Zero medication. Here's the protocol:",
                    "I tested 47 'superfoods.' Only 3 actually moved biomarkers. The winners:"
                ],
                engagement_multiplier: 1.9,
                best_for: ["case_studies", "personal_insights", "method_reveals"]
            },
            {
                name: "Contrarian_Truth",
                structure: "Popular belief challenge → Evidence against → Better alternative",
                examples: [
                    "Everyone says 'eat breakfast.' But intermittent fasting research shows the opposite.",
                    "Cardio for fat loss? New meta-analysis suggests resistance training wins."
                ],
                engagement_multiplier: 2.3,
                best_for: ["myth_busting", "controversial_takes", "paradigm_shifts"]
            },
            {
                name: "List_Authority",
                structure: "Numbered list + expert credibility → Actionable items",
                examples: [
                    "5 things I learned after reading 200+ longevity studies: [thread]",
                    "7 lab markers your doctor should check (but probably doesn't):"
                ],
                engagement_multiplier: 1.6,
                best_for: ["actionable_tips", "comprehensive_guides", "expert_summaries"]
            },
            {
                name: "Question_Hook",
                structure: "Provocative question → Unexpected answer → Supporting evidence",
                examples: [
                    "What if everything you know about cholesterol is wrong? New research suggests:",
                    "Why do Japanese people live 5 years longer? It's not what you think."
                ],
                engagement_multiplier: 1.7,
                best_for: ["curiosity_gaps", "cultural_insights", "paradigm_questions"]
            }
        ];
    }

    /**
     * 🎯 GENERATE ELITE VIRAL CONTENT
     */
    async generateViralContent(request: ContentRequest = {}): Promise<GeneratedContent> {
        console.log('🎯 Elite Twitter Content Strategist - Generating viral content...');

        try {
            // 1. Analyze recent performance and viral patterns
            const performanceData = await this.analyzeRecentPerformance();
            
            // 2. Select optimal format based on data + creative intuition
            const selectedFormat = this.selectOptimalFormat(request, performanceData);
            
            // 3. Generate topic and angle if not provided
            const topic = request.topic || await this.generateTrendingTopic();
            
            // 4. Create the content using elite strategy
            const content = await this.generateEliteContent(selectedFormat, topic, request);
            
            // 5. Validate and optimize for virality
            const optimizedContent = this.optimizeForVirality(content, selectedFormat);
            
            return {
                content: optimizedContent.content,
                format_used: selectedFormat.name,
                hook_type: optimizedContent.hook_type,
                predicted_engagement: optimizedContent.predicted_engagement,
                reasoning: optimizedContent.reasoning,
                content_type: optimizedContent.content_type
            };

        } catch (error) {
            console.error('❌ Elite content generation failed:', error);
            return this.generateFallbackContent();
        }
    }

    private async analyzeRecentPerformance(): Promise<any> {
        try {
            const { data: recentTweets } = await secureSupabaseClient.supabase
                .from('engagement_feedback_tracking')
                .select('*')
                .order('posted_at', { ascending: false })
                .limit(20);

            const performanceAnalysis = {
                avgEngagementRate: 0,
                topPerformingFormats: [],
                bestTimes: [],
                successfulHooks: []
            };

            if (recentTweets && recentTweets.length > 0) {
                const totalEngagement = recentTweets.reduce((sum, tweet) => 
                    sum + (tweet.engagement_rate || 0), 0);
                performanceAnalysis.avgEngagementRate = totalEngagement / recentTweets.length;
            }

            return performanceAnalysis;
        } catch (error) {
            console.warn('Could not analyze recent performance, using defaults');
            return { avgEngagementRate: 0.15, topPerformingFormats: [], bestTimes: [] };
        }
    }

    private selectOptimalFormat(request: ContentRequest, performanceData: any): ContentFormat {
        // Data-driven format selection with creative intuition
        const hour = new Date().getHours();
        
        // Time-based optimization
        if (hour < 10) {
            // Morning: Quick, actionable insights
            return this.viralFormats.find(f => f.name === "Research_Bomb") || this.viralFormats[0];
        } else if (hour < 15) {
            // Afternoon: Deep dives and stories
            return this.viralFormats.find(f => f.name === "Story_Revelation") || this.viralFormats[1];
        } else {
            // Evening: Contrarian takes and discussions
            return this.viralFormats.find(f => f.name === "Contrarian_Truth") || this.viralFormats[2];
        }
    }

    private async generateTrendingTopic(): Promise<string> {
        const healthTopics = [
            "intermittent fasting myths",
            "longevity research breakthroughs", 
            "sleep optimization protocols",
            "micronutrient deficiencies",
            "exercise vs medication studies",
            "gut health misconceptions",
            "stress management techniques",
            "biohacking fundamentals",
            "nutrition science updates",
            "mental performance enhancement"
        ];
        
        return healthTopics[Math.floor(Math.random() * healthTopics.length)];
    }

    private async generateEliteContent(format: ContentFormat, topic: string, request: ContentRequest): Promise<any> {
        const systemPrompt = `You are an elite Twitter content strategist creating viral health/wellness content.

CONTEXT:
- Format: ${format.name}
- Structure: ${format.structure} 
- Topic: ${topic}
- Target: Health-conscious, educated audience seeking actionable insights

REQUIREMENTS:
1. Create content that will genuinely go viral (25%+ engagement rate)
2. Use a STRONG hook that stops scrolling immediately
3. Provide genuine value - insights, data, or surprising revelations
4. Be specific and credible - no vague health advice
5. Choose between single tweet or thread based on what performs better
6. Use proven psychological triggers: curiosity gaps, authority, social proof
7. Make it shareable - people should want to save/share this

EXAMPLES OF VIRAL HOOKS:
- "You've been lied to about [topic]..."
- "New study: [shocking statistic]..."
- "I analyzed 1000+ [studies/cases]. Here's what I found:"
- "Why [popular belief] is completely wrong..."
- "The $X billion industry doesn't want you to know..."

FORMAT GUIDELINES:
- Single Tweet: 1 powerful insight, 240 chars max, complete thought
- Thread: Hook tweet + 3-7 follow-ups with numbered insights
- Use line breaks for readability
- Bold claims backed by logic/data
- End with engagement driver (question, call to save, etc.)

Generate content that would make someone stop scrolling, read carefully, and immediately share.`;

        const userPrompt = `Create viral ${format.name} content about "${topic}". 

Make it:
- Immediately attention-grabbing
- Genuinely valuable/surprising  
- Shareable and memorable
- Appropriate for health/wellness audience
- Optimized for maximum engagement

Choose single tweet vs thread based on what would perform better for this specific insight.`;

        const response = await this.budgetAwareOpenAI.createChatCompletion([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ], {
            priority: 'important',
            operationType: 'elite_content_generation',
            model: 'gpt-4o-mini',
            maxTokens: 400,
            temperature: 0.8,
            forTweetGeneration: true
        });

        if (!response?.success || !response?.response?.choices?.[0]?.message?.content) {
            throw new Error('No content generated from OpenAI');
        }

        return response.response.choices[0].message.content.trim();
    }

    private optimizeForVirality(rawContent: string, format: ContentFormat): any {
        // Parse and optimize the generated content
        const lines = rawContent.split('\n').filter(line => line.trim());
        const isThread = lines.length > 3 || rawContent.includes('🧵') || rawContent.includes('/1');
        
        let hook_type = "unknown";
        const firstLine = lines[0]?.toLowerCase() || "";
        
        if (firstLine.includes("you've been lied")) hook_type = "deception_reveal";
        else if (firstLine.includes("new study") || firstLine.includes("%")) hook_type = "research_stat";
        else if (firstLine.includes("what if") || firstLine.includes("why")) hook_type = "question_hook";
        else if (firstLine.includes("everyone says") || firstLine.includes("popular belief")) hook_type = "contrarian";
        else hook_type = "authority";

        // Predict engagement based on format and hook quality
        let predicted_engagement = format.engagement_multiplier * 15; // Base 15%
        
        // Boost based on hook quality
        if (hook_type === "research_stat") predicted_engagement *= 1.3;
        if (hook_type === "contrarian") predicted_engagement *= 1.4;
        if (hook_type === "deception_reveal") predicted_engagement *= 1.5;
        
        // Thread vs single tweet adjustment
        if (isThread) predicted_engagement *= 1.2;
        
        return {
            content: isThread ? lines : rawContent,
            hook_type,
            predicted_engagement: Math.min(predicted_engagement, 45), // Cap at 45%
            reasoning: `Selected ${format.name} format with ${hook_type} hook for ${isThread ? 'thread' : 'single tweet'} delivery`,
            content_type: isThread ? 'thread' : 'tweet'
        };
    }

    private generateFallbackContent(): GeneratedContent {
        const fallbacks = [
            "The supplement industry spent $50B convincing you that pills > food.\n\nBut 15 years of research shows:\nWhole foods beat isolated nutrients 9/10 times.\n\nYour body evolved to recognize food, not factories.",
            "New longevity study tracked 100,000 people for 20 years.\n\nResult: The #1 predictor of lifespan isn't genetics.\n\nIt's this daily habit 90% of people ignore.",
            "I analyzed 500+ nutrition studies.\n\nThe most shocking finding:\n3 'health foods' are worse than candy.\n\nHere's what to avoid: 🧵"
        ];
        
        const selected = fallbacks[Math.floor(Math.random() * fallbacks.length)];
        
        return {
            content: selected,
            format_used: "Research_Bomb",
            hook_type: "research_stat", 
            predicted_engagement: 22,
            reasoning: "Fallback content with proven engagement patterns",
            content_type: selected.includes('🧵') ? 'thread' : 'tweet'
        };
    }

    /**
     * 📊 STORE PERFORMANCE DATA FOR LEARNING
     */
    async recordPerformance(content: string, engagement: any): Promise<void> {
        try {
            await secureSupabaseClient.supabase.from('elite_content_performance').insert({
                content,
                likes: engagement.likes || 0,
                retweets: engagement.retweets || 0,
                replies: engagement.replies || 0,
                engagement_rate: engagement.engagement_rate || 0,
                format_detected: engagement.format_used || 'unknown',
                hook_type: engagement.hook_type || 'unknown',
                created_at: new Date().toISOString()
            });
        } catch (error) {
            console.warn('Could not record performance data:', error);
        }
    }
}