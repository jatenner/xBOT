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
        const systemPrompt = `You are an elite Twitter growth strategist who creates professional health content that mimics top accounts like @hubermanlab and @foundmyfitness.

MISSION: Create professional, authoritative content that builds credibility and follower trust.

PROFESSIONAL STANDARDS:
- Write like a respected health expert, not a social media influencer
- Use ONE strategic emoji maximum (🧠 for cognitive, 🔬 for research, 💡 for insights)
- NO hashtags (they look amateurish)
- NO "Tweet 1:", "Tweet 2:" labels (amateur formatting)
- NO excessive punctuation or clickbait language
- Complete sentences with proper punctuation

TOP ACCOUNT STYLE PATTERNS:
1. CONTRARIAN + EVIDENCE: "Most people believe X. But research shows Y. Here's why: [evidence]"
2. AUTHORITY OPENER: "Stanford researchers discovered..." / "New study reveals..."
3. QUESTION + ANSWER: "Why does X happen? Scientists found Y. What this means: Z"
4. STATISTIC + CONTEXT: "X% of people experience Y. The reason: Z. For you: W"

PROFESSIONAL FORMATTING:
- Strategic line breaks for readability
- Proper spacing and punctuation
- No corporate "Tweet Thread:" headers
- No amateur numbering systems
- One cohesive, well-written piece

CONTENT STRUCTURE:
Single Professional Tweet:
"New research shows X. Stanford scientists found Y in a study of 1,200 participants.

The mechanism: Z happens when W.

Try this: [specific action]. 

What's been your experience?"

FORBIDDEN ELEMENTS:
❌ "Tweet 1:", "Tweet 2:", "Thread:" labels
❌ Multiple emojis (🚨 💡 🔥 ⚡)
❌ Hashtags (#HealthTips #Biohacking)
❌ Excessive punctuation (!!! ???)
❌ Corporate formatting
❌ Clickbait language

REQUIRED ELEMENTS:
✅ Professional tone like top health accounts
✅ Maximum 1 contextual emoji
✅ Proper sentence structure
✅ Research-backed claims
✅ Specific, actionable advice
✅ Natural conversation style

Generate content that looks like it came from a respected health expert's account.`;

        const userPrompt = `Create professional health content about "${topic}" that looks like it came from @hubermanlab or @foundmyfitness.

CRITICAL FORMATTING RULES:
❌ NO "Tweet 1:", "Tweet 2:", "Thread:" labels
❌ NO multiple emojis (maximum 1 if relevant)
❌ NO hashtags
❌ NO corporate/amateur formatting

✅ Professional, complete sentences
✅ Research-backed claims with specific data
✅ Strategic line breaks for readability
✅ One cohesive, well-written piece

CONTENT REQUIREMENTS:
- Include specific studies, numbers, or research findings
- Provide actionable advice people can implement
- Complete information, no cliffhangers
- Professional tone like top health experts

EXAMPLE QUALITY:
"New research from Stanford shows magnesium glycinate (400mg, 2 hours before bed) increased deep sleep by 37% over 8 weeks.

Unlike melatonin, it doesn't cause dependence. The mechanism: magnesium activates GABA receptors, promoting relaxation.

Best forms: glycinate or threonate. Avoid oxide (poor absorption).

Have you noticed sleep improvements with magnesium?"

Write ONE professional tweet that provides complete value immediately.`;

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

        // 🎯 APPLY PROFESSIONAL FORMATTING
        const rawContent = response.response.choices[0].message.content.trim();
        let formattedContent = rawContent;
        
        try {
            const { ProfessionalTweetFormatter } = await import('../utils/professionalTweetFormatter');
            formattedContent = ProfessionalTweetFormatter.formatTweet(rawContent);
            
            // Quality check the formatted content
            const qualityScore = ProfessionalTweetFormatter.analyzeQuality(formattedContent);
            console.log(`📊 Tweet quality: ${qualityScore.overall}/100 (completeness: ${qualityScore.completeness}, engagement: ${qualityScore.engagement})`);
            
            if (qualityScore.issues.length > 0) {
                console.log(`⚠️ Quality issues: ${qualityScore.issues.join(', ')}`);
            }
        } catch (error) {
            console.warn('⚠️ Professional formatting failed, using raw content:', error);
        }

        return {
            content: formattedContent,
            predicted_engagement: 25, // Default prediction
            reasoning: `Generated using ${format.name} format with professional formatting`,
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