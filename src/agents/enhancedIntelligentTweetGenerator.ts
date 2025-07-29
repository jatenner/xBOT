/**
 * 🧠 ENHANCED INTELLIGENT TWEET GENERATOR v2.0
 * ===============================================
 * Updates tweet generation to pull from learning database:
 * - Top 5 format patterns from content_format_fingerprints
 * - Top 3 viral examples from viral_tweets_learned
 * - Resonant topics from topic_resonance_tracking
 */

import { createClient } from '@supabase/supabase-js';
import { BudgetAwareOpenAI } from '../utils/budgetAwareOpenAI';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface LearningData {
    topFormats: Array<{
        format_name: string;
        format_pattern: string;
        success_rate: number;
        avg_engagement: number;
        usage_count: number;
        optimal_length_min?: number;
        optimal_length_max?: number;
    }>;
    viralExamples: Array<{
        content: string;
        format_type: string;
        engagement_rate: number;
        viral_score: number;
        likes: number;
        retweets: number;
        author_username: string;
        primary_topic: string;
    }>;
    resonantTopics: Array<{
        topic: string;
        avg_engagement_rate: number;
        total_tweets: number;
        consistency_score: number;
        trend_direction: string;
        best_posting_hours?: number[];
    }>;
    activePrompt?: {
        system_prompt: string;
        user_prompt_template: string;
        prompt_version: string;
    };
}

interface GenerationRequest {
    topic?: string;
    format?: string;
    tone?: string;
    length?: 'short' | 'medium' | 'long' | 'thread';
    target_engagement_rate?: number;
    experimental?: boolean;
}

interface GenerationResult {
    content: string;
    predicted_engagement: number;
    confidence_score: number;
    format_used: string;
    learning_context: {
        formats_referenced: string[];
        examples_used: string[];
        topics_considered: string[];
    };
    generation_session_id: string;
}

export class EnhancedIntelligentTweetGenerator {
    private static instance: EnhancedIntelligentTweetGenerator;
    private budgetAwareOpenAI: BudgetAwareOpenAI;
    private learningData: LearningData | null = null;
    private lastDataFetch: number = 0;
    private CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

    private constructor() {
        this.budgetAwareOpenAI = new BudgetAwareOpenAI(process.env.OPENAI_API_KEY!);
    }

    public static getInstance(): EnhancedIntelligentTweetGenerator {
        if (!EnhancedIntelligentTweetGenerator.instance) {
            EnhancedIntelligentTweetGenerator.instance = new EnhancedIntelligentTweetGenerator();
        }
        return EnhancedIntelligentTweetGenerator.instance;
    }

    /**
     * Generate an intelligent tweet using learning data
     */
    async generateIntelligentTweet(request: GenerationRequest = {}): Promise<GenerationResult> {
        console.log('🧠 Generating intelligent tweet with learning data...');

        try {
            // 1. Load fresh learning data
            await this.loadLearningData();

            // 2. Select optimal format and topic
            const selectedFormat = this.selectOptimalFormat(request);
            const selectedTopic = this.selectOptimalTopic(request);
            const targetLength = this.calculateOptimalLength(selectedFormat, request.length);

            // 3. Build dynamic prompt with learning context
            const dynamicPrompt = this.buildLearningPrompt(request, selectedFormat, selectedTopic, targetLength);

            // 4. Generate content using v2.0 prompts
            const generatedContent = await this.generateWithLearningPrompt(dynamicPrompt, request);

            // 5. Validate and score the content
            const validatedContent = this.validateAndEnhanceContent(generatedContent, selectedFormat, targetLength);
            const confidenceScore = this.calculateConfidenceScore(validatedContent, selectedFormat);
            const predictedEngagement = this.predictEngagementRate(validatedContent, selectedFormat, selectedTopic);

            // 6. Create generation session record
            const sessionId = await this.recordGenerationSession({
                request,
                selectedFormat,
                selectedTopic,
                generatedContent: validatedContent,
                confidenceScore,
                predictedEngagement
            });

            const result: GenerationResult = {
                content: validatedContent,
                predicted_engagement: predictedEngagement,
                confidence_score: confidenceScore,
                format_used: selectedFormat.format_name,
                learning_context: {
                    formats_referenced: this.learningData!.topFormats.map(f => f.format_name),
                    examples_used: this.learningData!.viralExamples.slice(0, 3).map(e => e.content.slice(0, 50) + '...'),
                    topics_considered: this.learningData!.resonantTopics.slice(0, 5).map(t => t.topic)
                },
                generation_session_id: sessionId
            };

            console.log(`✅ Generated tweet: ${validatedContent.slice(0, 100)}...`);
            console.log(`📊 Predicted engagement: ${predictedEngagement}% | Confidence: ${confidenceScore}`);

            return result;

        } catch (error) {
            console.error('❌ Failed to generate intelligent tweet:', error);
            throw error;
        }
    }

    /**
     * Load learning data from database with caching
     */
    private async loadLearningData(): Promise<void> {
        const now = Date.now();
        if (this.learningData && (now - this.lastDataFetch) < this.CACHE_DURATION) {
            return; // Use cached data
        }

        console.log('📚 Loading learning data from database...');

        try {
            // Load top performing formats
            const { data: topFormats, error: formatsError } = await supabase
                .from('content_format_fingerprints')
                .select(`
                    format_name, format_pattern, success_rate, avg_engagement, 
                    usage_count, optimal_length_min, optimal_length_max
                `)
                .eq('confidence_score', 0.0) // Filter out test data if needed
                .order('success_rate', { ascending: false })
                .order('avg_engagement', { ascending: false })
                .limit(5);

            if (formatsError) throw formatsError;

            // Load viral examples
            const { data: viralExamples, error: viralError } = await supabase
                .from('viral_tweets_learned')
                .select(`
                    content, format_type, engagement_rate, viral_score,
                    likes, retweets, author_username, primary_topic
                `)
                .order('viral_score', { ascending: false })
                .order('engagement_rate', { ascending: false })
                .limit(10);

            if (viralError) throw viralError;

            // Load resonant topics
            const { data: resonantTopics, error: topicsError } = await supabase
                .from('topic_resonance_tracking')
                .select(`
                    topic, avg_engagement_rate, total_tweets, consistency_score,
                    trend_direction, best_posting_hours
                `)
                .order('avg_engagement_rate', { ascending: false })
                .order('consistency_score', { ascending: false })
                .limit(8);

            if (topicsError) throw topicsError;

            // Load active v2.0 prompt
            const { data: activePrompt, error: promptError } = await supabase
                .from('intelligent_prompt_evolution')
                .select('system_prompt, user_prompt_template, prompt_version')
                .eq('prompt_type', 'tweet_generation')
                .eq('is_active', true)
                .order('prompt_version', { ascending: false })
                .limit(1)
                .single();

            if (promptError) throw promptError;

            this.learningData = {
                topFormats: topFormats || [],
                viralExamples: viralExamples || [],
                resonantTopics: resonantTopics || [],
                activePrompt: activePrompt || undefined
            };

            this.lastDataFetch = now;

            console.log(`✅ Loaded learning data: ${this.learningData.topFormats.length} formats, ${this.learningData.viralExamples.length} examples, ${this.learningData.resonantTopics.length} topics`);

        } catch (error) {
            console.error('❌ Failed to load learning data:', error);
            throw new Error(`Learning data load failed: ${error}`);
        }
    }

    /**
     * Select optimal format based on request and performance data
     */
    private selectOptimalFormat(request: GenerationRequest): any {
        if (!this.learningData?.topFormats.length) {
            // Fallback if no learning data
            return {
                format_name: 'Hook_Value_CTA',
                format_pattern: 'Did you know {surprising_fact}? Here\'s what this means for you: {explanation}',
                success_rate: 0.8,
                avg_engagement: 0.05
            };
        }

        // If specific format requested, try to find it
        if (request.format) {
            const requestedFormat = this.learningData.topFormats.find(f => 
                f.format_name.toLowerCase().includes(request.format!.toLowerCase())
            );
            if (requestedFormat) return requestedFormat;
        }

        // Weight formats by success rate and engagement
        const weightedFormats = this.learningData.topFormats.map(format => ({
            ...format,
            weight: (format.success_rate * 0.6) + (format.avg_engagement * 0.4) + (Math.min(format.usage_count / 10, 1) * 0.1)
        }));

        // Select format with some randomness to avoid repetition
        const topFormats = weightedFormats.slice(0, 3);
        const randomIndex = Math.floor(Math.random() * topFormats.length);
        
        return topFormats[randomIndex];
    }

    /**
     * Select optimal topic based on resonance data
     */
    private selectOptimalTopic(request: GenerationRequest): any {
        if (request.topic) {
            return { topic: request.topic, avg_engagement_rate: 0.05 };
        }

        if (!this.learningData?.resonantTopics.length) {
            return { topic: 'health optimization', avg_engagement_rate: 0.05 };
        }

        // Prefer rising topics or consistently high performers
        const priorityTopics = this.learningData.resonantTopics.filter(t => 
            t.trend_direction === 'rising' || t.avg_engagement_rate > 0.06
        );

        const selectedTopics = priorityTopics.length > 0 ? priorityTopics : this.learningData.resonantTopics;
        return selectedTopics[Math.floor(Math.random() * Math.min(3, selectedTopics.length))];
    }

    /**
     * Calculate optimal length based on format performance
     */
    private calculateOptimalLength(format: any, requestedLength?: string): { min: number, max: number, target: string } {
        if (format.optimal_length_min && format.optimal_length_max) {
            return {
                min: format.optimal_length_min,
                max: format.optimal_length_max,
                target: requestedLength || 'optimal'
            };
        }

        // Default lengths based on request
        const lengthMap = {
            'short': { min: 80, max: 150, target: 'short' },
            'medium': { min: 150, max: 250, target: 'medium' },
            'long': { min: 250, max: 280, target: 'long' },
            'thread': { min: 100, max: 280, target: 'thread' }
        };

        return lengthMap[requestedLength as keyof typeof lengthMap] || lengthMap.medium;
    }

    /**
     * Build dynamic prompt with learning context
     */
    private buildLearningPrompt(request: GenerationRequest, format: any, topic: any, length: any): string {
        const viralPatterns = this.learningData!.viralExamples.slice(0, 3).map(ex => 
            `Format: ${ex.format_type} | Engagement: ${ex.engagement_rate}% | "${ex.content}"`
        ).join('\n');

        const topFormats = this.learningData!.topFormats.slice(0, 5).map(f => 
            `${f.format_name} (${Math.round(f.success_rate * 100)}% success): ${f.format_pattern}`
        ).join('\n');

        const resonantTopics = this.learningData!.resonantTopics.slice(0, 5).map(t => 
            `${t.topic} (${Math.round(t.avg_engagement_rate * 100)}% avg engagement, trend: ${t.trend_direction})`
        ).join('\n');

        const recentWinners = this.learningData!.viralExamples.slice(0, 2).map(ex => 
            `"${ex.content}" (${ex.likes} likes, ${ex.retweets} RTs)`
        ).join('\n');

        if (!this.learningData?.activePrompt) {
            throw new Error('No active prompt found in database');
        }

        // Use the v2.0 prompt template with learning data
        return this.learningData.activePrompt.user_prompt_template
            .replace('{top_viral_patterns}', viralPatterns)
            .replace('{top_format_fingerprints}', topFormats)
            .replace('{resonant_topics}', resonantTopics)
            .replace('{recent_viral_examples}', recentWinners)
            .replace('{requested_topic}', topic.topic)
            .replace('{requested_format}', format.format_name)
            .replace('{requested_tone}', request.tone || 'educational yet engaging')
            .replace('{optimal_length}', `${length.min}-${length.max} characters`)
            .replace('{target_engagement_rate}', (request.target_engagement_rate || 5).toString());
    }

    /**
     * Generate content using the learning-enhanced prompt
     */
    private async generateWithLearningPrompt(prompt: string, request: GenerationRequest): Promise<string> {
        if (!this.learningData?.activePrompt) {
            throw new Error('No active system prompt available');
        }

        const messages = [
            {
                role: 'system' as const,
                content: this.learningData.activePrompt.system_prompt
            },
            {
                role: 'user' as const, 
                content: prompt
            }
        ];

        const response = await this.budgetAwareOpenAI.createChatCompletion(messages, {
            priority: 'important',
            operationType: 'intelligent_tweet_generation',
            model: 'gpt-4o-mini',
            maxTokens: 300,
            temperature: request.experimental ? 0.9 : 0.7,
            forTweetGeneration: true
        });

        if (!response?.success || !response?.response?.choices?.[0]?.message?.content) {
            throw new Error('No content generated from OpenAI');
        }

        return response.response.choices[0].message.content.trim();
    }

    /**
     * Validate and enhance the generated content
     */
    private validateAndEnhanceContent(content: string, format: any, length: any): string {
        let validated = content;

        // Remove any quotes or formatting artifacts
        validated = validated.replace(/^["']|["']$/g, '').trim();

        // Ensure length constraints
        if (validated.length > length.max) {
            validated = validated.slice(0, length.max - 3) + '...';
        }

        // Ensure minimum engagement elements
        if (!validated.includes('?') && !validated.includes('!') && format.format_name.includes('Hook')) {
            // Add engagement punctuation if missing
            validated = validated.replace(/\.$/, '!');
        }

        return validated;
    }

    /**
     * Calculate confidence score based on format adherence and quality
     */
    private calculateConfidenceScore(content: string, format: any): number {
        let score = 0.5; // Base score

        // Length appropriateness
        if (content.length >= 100 && content.length <= 280) {
            score += 0.2;
        }

        // Format pattern adherence
        if (format.format_pattern) {
            const patternElements = format.format_pattern.match(/\{[^}]+\}/g) || [];
            const hasValueProp = content.includes(':') || content.includes('—') || content.includes('because');
            if (hasValueProp && patternElements.length > 0) {
                score += 0.2;
            }
        }

        // Engagement elements
        if (content.includes('?') || content.includes('!')) score += 0.1;
        if (/\d+/.test(content)) score += 0.05; // Contains numbers
        if (content.toLowerCase().includes('you')) score += 0.05; // Direct address

        return Math.min(1.0, score);
    }

    /**
     * Predict engagement rate based on learning data
     */
    private predictEngagementRate(content: string, format: any, topic: any): number {
        let predicted = format.avg_engagement || 0.03; // Base from format performance

        // Adjust based on topic performance
        predicted = (predicted + (topic.avg_engagement_rate || 0.03)) / 2;

        // Content quality adjustments
        if (content.length >= 150 && content.length <= 220) predicted *= 1.1; // Optimal length
        if (content.includes('?')) predicted *= 1.05; // Questions engage better
        if (/\d+/.test(content)) predicted *= 1.05; // Numbers add credibility
        if (content.split(' ').length > 15) predicted *= 0.95; // Too verbose

        return Math.round(predicted * 10000) / 100; // Return as percentage
    }

    /**
     * Record the generation session for learning
     */
    private async recordGenerationSession(sessionData: any): Promise<string> {
        try {
            const { data, error } = await supabase
                .from('tweet_generation_sessions')
                .insert({
                    session_type: sessionData.request.experimental ? 'experimental' : 'standard',
                    requested_topic: sessionData.selectedTopic.topic,
                    requested_format: sessionData.selectedFormat.format_name,
                    requested_tone: sessionData.request.tone || 'educational',
                    model_used: 'gpt-4o-mini',
                    temperature: sessionData.request.experimental ? 0.9 : 0.7,
                    successful_patterns_used: [sessionData.selectedFormat.format_name],
                    viral_examples_referenced: this.learningData!.viralExamples.slice(0, 3).map(ex => ex.content),
                    selected_content: sessionData.generatedContent,
                    content_quality_score: sessionData.confidenceScore,
                    predicted_engagement: sessionData.predictedEngagement,
                    prompt_version: this.learningData!.activePrompt?.prompt_version || 'v2.0'
                })
                .select('id')
                .single();

            if (error) throw error;
            
            return data.id;

        } catch (error) {
            console.error('❌ Failed to record generation session:', error);
            return 'unknown';
        }
    }

    /**
     * Get system status and learning metrics
     */
    async getSystemStatus(): Promise<any> {
        await this.loadLearningData();

        return {
            learning_data_status: {
                formats_available: this.learningData?.topFormats.length || 0,
                viral_examples: this.learningData?.viralExamples.length || 0,
                resonant_topics: this.learningData?.resonantTopics.length || 0,
                active_prompt_version: this.learningData?.activePrompt?.prompt_version || 'unknown'
            },
            cache_status: {
                last_refresh: new Date(this.lastDataFetch).toISOString(),
                cache_valid: (Date.now() - this.lastDataFetch) < this.CACHE_DURATION
            }
        };
    }
}

export default EnhancedIntelligentTweetGenerator;