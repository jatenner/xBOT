/**
 * 🎯 ELITE TWITTER CONTENT STRATEGIST
 * ==================================
 * Creates viral, high-performing tweets in health/wellness/science space
 * Uses proven formats, data-driven insights, and creative intuition
 */

import { BudgetAwareOpenAI } from '../utils/budgetAwareOpenAI';
import { secureSupabaseClient } from '../utils/secureSupabaseClient';
import { styleMixer, StyleLabel } from '../utils/styleMixer';

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
            const optimizedContent = await this.optimizeForVirality(content.content, selectedFormat);
            
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
        const systemPrompt = `You are an elite Twitter growth strategist focused on building massive audience through viral health content.

MISSION: Create content that gets 1000+ likes, 100+ retweets, and 50+ new followers per post.

AUDIENCE BUILDING STRATEGY:
- Target health-conscious professionals aged 25-45
- Focus on counterintuitive insights that challenge common beliefs  
- Provide immediate, actionable value
- Use data and research to build authority
- Create content people WANT to share and follow for more

VIRAL CONTENT REQUIREMENTS:
1. HOOK: Start with something shocking, contrarian, or surprising
2. VALUE: Provide specific, actionable insights people can use today
3. AUTHORITY: Include data, studies, or research when possible
4. ENGAGEMENT: End with a question or call to action
5. SHAREABILITY: Make it worth saving/sharing

AUDIENCE GROWTH FOCUS:
- Every tweet should make someone think "I need to follow this account"
- Challenge popular health myths with evidence
- Share personal stories with universal lessons
- Provide insights others don't share
- Build trust through consistent value delivery

CONTEXT:
- Format: ${format.name}
- Structure: ${format.structure} 
- Topic: ${topic}
- Target: Health-conscious, educated audience seeking actionable insights

CRITICAL REQUIREMENTS:
1. NEVER create incomplete hook-only content like "Here's how to..." without the actual information
2. ALWAYS provide complete, actionable value in your response
3. If you use a hook, immediately follow with the actual content/tips/insights
4. Every tweet must be self-contained and valuable on its own
5. No cliffhangers, no "here's how..." without the how
6. Include specific, actionable advice that people can use immediately

CONTENT STRUCTURE OPTIONS:
A) COMPLETE SINGLE TWEET: Hook + Value + CTA (under 280 chars)
   Example: "Sleep researchers found that 15-20°C room temperature increases deep sleep by 23%. Your bedroom is probably too warm. Try this: set thermostat to 18°C, use breathable sheets, keep feet uncovered. Track your sleep quality for a week. What temperature works best for you?"

B) VALUE THREAD: Hook + 3-5 specific, actionable tips
   Example: 
   Tweet 1: "5 evidence-based ways to increase energy without caffeine (from 200+ studies):"
   Tweet 2: "1/ Cold exposure: 2-3 min cold shower increases norepinephrine by 200%, lasting 3+ hours"
   Tweet 3: "2/ Protein timing: 25g within 1 hour of waking prevents afternoon crashes"
   [Continue with specific tips...]

FORBIDDEN CONTENT:
❌ "Here's how to optimize X in 5 minutes:" (without the how)
❌ "The secret to Y that doctors don't want you to know:" (without the secret)
❌ "I discovered the key to Z:" (without revealing the key)
❌ Any hook without immediate value delivery

REQUIRED ELEMENTS:
✅ Specific data/numbers when possible
✅ Actionable steps people can implement today
✅ Complete information in the tweet/thread
✅ Clear value proposition from the first tweet
✅ Engaging but not clickbait-y tone

Generate content that immediately provides value, not just promises it.`;

        const userPrompt = `Create viral ${format.name} content about "${topic}". 

CRITICAL: Provide COMPLETE, actionable information. Do NOT create incomplete hooks like "Here's how to..." without the actual how.

Requirements:
- Include specific tips, numbers, or insights people can use immediately
- If single tweet: Hook + complete value + call to action (under 280 chars)  
- If thread: Hook + 3-5 numbered actionable tips with specific details
- No cliffhangers or incomplete content
- Make it immediately valuable to anyone reading

Example quality: "New study: Taking magnesium glycinate 400mg 2 hours before bed increased deep sleep by 37% in 8 weeks. Unlike melatonin, it doesn't cause dependence. Best brands: Natural Calm, Doctor's Best. Have you tried magnesium for sleep?"

Deliver complete value, not just promise it.`;

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

        return {
            content: response.response.choices[0].message.content.trim(),
            predicted_engagement: 25, // Default prediction
            reasoning: `Generated using ${format.name} format`,
            hook_type: 'authority',
            content_type: 'tweet'
        };
    }

    /**
     * 🎯 Optimize content for virality and apply style variation
     */
    private async optimizeForVirality(content: string, format: ContentFormat): Promise<any> {
        try {
            console.log('🔥 Optimizing content for virality...');

            // Step 1: Apply style variation
            const currentHour = new Date().getHours();
            const styleResult = await styleMixer.mixStyle(content, {
                maxLength: 270, // Leave room for potential edits
                timeOfDay: currentHour,
                topic: format.name
            });

            let optimizedContent = styleResult.styledContent;
            console.log(`🎨 Style applied: ${styleResult.styleUsed} (${styleResult.shouldUseStyle ? 'styled' : 'original'})`);

            // Step 2: Apply viral optimization prompts
            if (Math.random() < 0.3) { // 30% chance for additional optimization
                optimizedContent = await this.applyViralOptimization(optimizedContent, format);
            }

            // Step 3: Record format performance
            await this.updateFormatPerformance(format.name, optimizedContent, styleResult.styleUsed);

            // Step 4: Analyze the optimized content and create result structure
            const lines = optimizedContent.split('\n').filter(line => line.trim());
            const isThread = lines.length > 3 || optimizedContent.includes('🧵') || optimizedContent.includes('/1');
            
            let hook_type = "unknown";
            const firstLine = lines[0]?.toLowerCase() || "";
            
            if (firstLine.includes("you've been lied")) hook_type = "deception_reveal";
            else if (firstLine.includes("new study") || firstLine.includes("%")) hook_type = "research_stat";
            else if (firstLine.includes("what if") || firstLine.includes("why")) hook_type = "question_hook";
            else if (firstLine.includes("everyone says") || firstLine.includes("popular belief")) hook_type = "contrarian";
            else if (styleResult.styleUsed.includes('Data-driven')) hook_type = "authority";
            else if (styleResult.styleUsed.includes('Contrarian')) hook_type = "contrarian";
            else hook_type = "authority";

            // Predict engagement based on format and style
            let predicted_engagement = (format.engagement_multiplier || 1.5) * 15; // Base 15%
            
            // Ensure predicted_engagement is never NaN or undefined
            if (isNaN(predicted_engagement) || !isFinite(predicted_engagement)) {
                predicted_engagement = 15; // Safe fallback
            }
            
            // Boost based on hook quality and style
            if (hook_type === "research_stat") predicted_engagement *= 1.3;
            if (hook_type === "contrarian") predicted_engagement *= 1.4;
            if (hook_type === "deception_reveal") predicted_engagement *= 1.5;
            if (styleResult.shouldUseStyle) predicted_engagement *= 1.1; // Style bonus
            
            // Thread vs single tweet adjustment
            if (isThread) predicted_engagement *= 1.2;

            return {
                content: isThread ? lines : optimizedContent,
                hook_type,
                predicted_engagement: Math.min(predicted_engagement, 45), // Cap at 45%
                reasoning: `Selected ${format.name} format with ${hook_type} hook${styleResult.shouldUseStyle ? ` and ${styleResult.styleUsed} style` : ''} for ${isThread ? 'thread' : 'single tweet'} delivery`,
                content_type: isThread ? 'thread' : 'tweet',
                style_applied: styleResult.styleUsed,
                style_reasoning: styleResult.reasoning
            };

        } catch (error) {
            console.error('❌ Virality optimization failed:', error);
            // Return basic structure on error
            return {
                content: content,
                hook_type: "unknown",
                predicted_engagement: 5,
                reasoning: `Fallback due to error: ${error.message}`,
                content_type: 'tweet'
            };
        }
    }

    /**
     * 🚀 Apply additional viral optimization techniques
     */
    private async applyViralOptimization(content: string, format: ContentFormat): Promise<string> {
        try {
            const viralPrompt = `
VIRAL OPTIMIZATION: Make this tweet more engaging and shareable.

CURRENT: "${content}"
FORMAT: ${format.name}

Apply ONE of these viral techniques:
1. Add a hook that creates curiosity gap
2. Include a specific number or statistic
3. Add a surprising twist or contrarian angle
4. Create urgency or scarcity
5. Ask an engaging question

Keep under 280 characters. Make it impossible to scroll past.

OPTIMIZED:`;

            const messages = [
                { role: 'user' as const, content: viralPrompt }
            ];

            const response = await this.budgetAwareOpenAI.createChatCompletion(messages, {
                priority: 'important',
                operationType: 'viral_optimization',
                model: 'gpt-4o-mini',
                maxTokens: 100,
                temperature: 0.7,
                forTweetGeneration: true
            });

            if (response?.success && response?.response?.choices?.[0]?.message?.content) {
                const optimized = response.response.choices[0].message.content.trim();
                console.log(`🚀 Viral optimization: "${optimized}"`);
                return optimized;
            }

            return content;
        } catch (error) {
            console.error('❌ Viral optimization failed:', error);
            return content;
        }
    }

    /**
     * 📊 Update format performance in database
     */
    private async updateFormatPerformance(formatName: string, content: string, styleUsed: StyleLabel): Promise<void> {
        try {
            if (!secureSupabaseClient.supabase) return;

            // Use database function to update performance
            const { error } = await secureSupabaseClient.supabase
                .rpc('update_format_performance', {
                    p_topic: this.extractTopicFromFormat(formatName),
                    p_format: formatName,
                    p_engagement: 0.05 // Default engagement, will be updated with real data
                });

            if (error) {
                console.error('❌ Failed to update format performance:', error);
            } else {
                console.log(`📊 Updated performance for ${formatName}`);
            }
        } catch (error) {
            console.error('❌ Performance update error:', error);
        }
    }

    /**
     * 🔄 Extract topic from format name
     */
    private extractTopicFromFormat(formatName: string): string {
        const topicMap: { [key: string]: string } = {
            'Hook-Value-CTA': 'general_health',
            'Research_Bomb': 'research',
            'Story_Revelation': 'personal_stories',
            'Contrarian_Truth': 'myth_busting',
            'Quick_Insight': 'tips',
            'Thread_Breakdown': 'education'
        };

        return topicMap[formatName] || 'general_health';
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