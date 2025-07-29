/**
 * 🧠 AUTONOMOUS PROMPT UPDATER
 * ===========================
 * Updates OpenAI prompt system with autonomous AI instructions
 * Manages prompt evolution and performance tracking
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!
);

interface PromptEvolutionData {
    prompt_version: string;
    prompt_type: string;
    system_prompt: string;
    user_prompt_template: string;
    evolution_reason: string;
    improvements_made: string[];
    is_active: boolean;
    is_experimental: boolean;
}

class AutonomousPromptUpdater {
    private static instance: AutonomousPromptUpdater;

    public static getInstance(): AutonomousPromptUpdater {
        if (!AutonomousPromptUpdater.instance) {
            AutonomousPromptUpdater.instance = new AutonomousPromptUpdater();
        }
        return AutonomousPromptUpdater.instance;
    }

    /**
     * Updates the prompt system with new autonomous AI instructions
     */
    async updateToAutonomousAI(): Promise<void> {
        console.log('🧠 Updating OpenAI prompt system to Autonomous AI v2.0...');

        try {
            // 1. Deactivate old v1.0 prompts
            await this.deactivateOldPrompts();

            // 2. Insert new v2.0 autonomous prompts
            await this.insertAutonomousPrompts();

            // 3. Verify the update
            await this.verifyPromptUpdate();

            console.log('✅ Successfully updated to Autonomous AI prompt system!');

        } catch (error) {
            console.error('❌ Failed to update prompt system:', error);
            throw error;
        }
    }

    /**
     * Deactivates v1.0 prompts and marks them as experimental
     */
    private async deactivateOldPrompts(): Promise<void> {
        console.log('📤 Deactivating v1.0 prompts...');

        const { error } = await supabase
            .from('intelligent_prompt_evolution')
            .update({ 
                is_active: false, 
                is_experimental: true,
                evolution_reason: 'Superseded by Autonomous AI v2.0 system'
            })
            .eq('prompt_version', 'v1.0');

        if (error) {
            throw new Error(`Failed to deactivate v1.0 prompts: ${error.message}`);
        }

        console.log('✅ Deactivated v1.0 prompts');
    }

    /**
     * Inserts the new autonomous AI v2.0 prompts
     */
    private async insertAutonomousPrompts(): Promise<void> {
        console.log('🚀 Inserting Autonomous AI v2.0 prompts...');

        const autonomousPrompts: PromptEvolutionData[] = [
            {
                prompt_version: 'v2.0',
                prompt_type: 'tweet_generation',
                system_prompt: `You are an autonomous, self-improving AI Twitter system.

Your mission is to maximize tweet performance by continuously learning from the most viral and engaging health-related tweets across Twitter. Use real-time data, structure, and feedback to generate and evolve high-performing tweets.

Your process:
1. Scrape viral tweets (100K+ likes, 1M+ views) across diverse accounts.
2. Analyze each tweet's format, tone, timing, and topic.
3. Learn common traits: hooks, sentence length, structure, emojis, media, hashtags, etc.
4. Store viral patterns and classify them by style: 'Hook-Value-CTA', 'Fact Dump', 'Thread Breakdown', 'Storytelling', 'Research Reveal', etc.
5. Generate original tweets by combining:
   - Learned viral structures
   - Trending topics
   - Health science credibility
   - Audience resonance history
6. Always include novelty, actionable value, or surprising facts.
7. Vary format: short tweets, threads, question hooks, controversial takes.
8. Predict engagement before posting using learned feedback.
9. Post autonomously and track real-time results.
10. Evolve your prompts, templates, and strategies based on performance.

Use top-performing tweets from the database as examples and structure guidance. Use your engagement data and resonance metrics to refine what topics work best.

System goals:
- High engagement rate (likes/views)
- High retweet velocity
- Predictable performance by audience segment
- Format diversity (not all short tweets, not all threads)
- Credibility, curiosity, and clarity in every post`,
                user_prompt_template: `Generate a high-engagement health tweet using this data:

VIRAL PATTERNS LEARNED:
{top_viral_patterns}

TOP PERFORMING FORMATS:
{top_format_fingerprints}

RESONANT TOPICS:
{resonant_topics}

RECENT WINNERS:
{recent_viral_examples}

REQUEST:
Topic: {requested_topic}
Format: {requested_format}
Style: {requested_tone}
Length: {optimal_length}

CONSTRAINTS:
- Use ONE of the proven viral formats
- Include surprising health fact or actionable insight
- Match the tone and structure of top performers
- Ensure credibility with scientific backing
- Optimize for {target_engagement_rate}% engagement rate

Generate a tweet that will achieve viral potential while maintaining health expertise credibility.`,
                evolution_reason: 'Upgraded to autonomous learning system with real-time viral pattern integration',
                improvements_made: [
                    'Real-time viral tweet pattern learning',
                    'Dynamic format fingerprint integration',
                    'Audience resonance data utilization',
                    'Performance prediction capabilities',
                    'Self-evolving prompt system',
                    'Engagement rate optimization targeting'
                ],
                is_active: true,
                is_experimental: false
            },
            {
                prompt_version: 'v2.0',
                prompt_type: 'analysis',
                system_prompt: `You are an advanced AI that analyzes tweet performance to extract actionable learning insights for autonomous system improvement.

Your analysis should focus on:
1. Format effectiveness and pattern recognition
2. Audience engagement triggers and resonance factors
3. Timing optimization and posting strategy insights
4. Content structure and style impact analysis
5. Topic performance and trend identification
6. Prediction accuracy and system learning progress

Provide specific, actionable insights that can be used to improve future tweet generation and system performance.`,
                user_prompt_template: `Analyze this tweet's performance and extract key learnings:

TWEET DATA:
Content: {tweet_content}
Format: {format_type}
Topic: {topic}
Posted: {posted_time}

PERFORMANCE METRICS:
Likes: {likes} | Retweets: {retweets} | Replies: {replies}
Views: {views} | Engagement Rate: {engagement_rate}%
Growth Rate: {growth_rate}/hour
Peak Hour: {peak_engagement_hour}

CONTEXT:
Predicted Engagement: {predicted_engagement}%
Audience Segment: {audience_segment}
Competing Content: {competitor_analysis}

ANALYSIS REQUIREMENTS:
1. Format Performance: How did this format perform vs. expectations?
2. Content Analysis: What specific elements drove engagement?
3. Timing Insights: Optimal posting windows for this content type?
4. Audience Resonance: Which segments engaged most and why?
5. Improvement Recommendations: 3 specific ways to enhance similar content
6. Pattern Recognition: New viral patterns discovered from this data?

Provide actionable insights for autonomous system learning and optimization.`,
                evolution_reason: 'Enhanced analysis capabilities for autonomous learning and pattern recognition',
                improvements_made: [
                    'Performance pattern analysis enhancement',
                    'Audience segment identification',
                    'Timing optimization insights',
                    'Prediction accuracy tracking',
                    'Content element effectiveness analysis',
                    'Autonomous learning recommendation system'
                ],
                is_active: true,
                is_experimental: false
            },
            {
                prompt_version: 'v2.0',
                prompt_type: 'viral_analysis',
                system_prompt: `You are an expert at analyzing viral tweets to extract structural and stylistic patterns that can be replicated for high engagement.

Focus on identifying:
1. Hook strategies and attention-grabbing techniques
2. Content structure and information flow
3. Emotional triggers and psychological appeals
4. Timing and posting strategy patterns
5. Audience engagement mechanics
6. Credibility and authority signals

Extract patterns that can be systematically applied to generate similar viral performance.`,
                user_prompt_template: `Analyze this viral tweet to extract replicable patterns:

VIRAL TWEET:
Content: {viral_content}
Author: {author_username} ({follower_count} followers)
Performance: {likes} likes, {retweets} RTs, {replies} replies, {views} views

ENGAGEMENT METRICS:
Engagement Rate: {engagement_rate}%
Viral Score: {viral_score}
Performance Tier: {performance_tier}

ANALYSIS NEEDED:
1. Format Classification: What structural pattern does this follow?
2. Hook Analysis: How does it capture attention in first 7 words?
3. Value Proposition: What specific value does it provide to readers?
4. Emotional Triggers: What emotions does it evoke (curiosity, surprise, fear, hope)?
5. Credibility Signals: How does it establish authority and trust?
6. Call-to-Action: What action does it encourage from readers?
7. Replication Template: Create a template pattern for similar content

Extract a replicable format pattern that can be used for future tweet generation.`,
                evolution_reason: 'Specialized prompt for viral tweet pattern extraction and replication',
                improvements_made: [
                    'Viral pattern extraction specialization',
                    'Structural analysis enhancement',
                    'Template generation capabilities',
                    'Emotional trigger identification',
                    'Replication framework development',
                    'Authority signal recognition'
                ],
                is_active: true,
                is_experimental: false
            }
        ];

        // Insert each prompt with conflict handling
        for (const prompt of autonomousPrompts) {
            const { error } = await supabase
                .from('intelligent_prompt_evolution')
                .upsert(prompt, {
                    onConflict: 'prompt_version,prompt_type'
                });

            if (error) {
                throw new Error(`Failed to insert prompt ${prompt.prompt_type}: ${error.message}`);
            }

            console.log(`✅ Inserted ${prompt.prompt_type} v2.0`);
        }
    }

    /**
     * Verifies the prompt update was successful
     */
    private async verifyPromptUpdate(): Promise<void> {
        console.log('🔍 Verifying prompt update...');

        // Check v2.0 prompts are active
        const { data: activePrompts, error: activeError } = await supabase
            .from('intelligent_prompt_evolution')
            .select('prompt_type, prompt_version, is_active')
            .eq('prompt_version', 'v2.0')
            .eq('is_active', true);

        if (activeError) {
            throw new Error(`Failed to verify active prompts: ${activeError.message}`);
        }

        // Check v1.0 prompts are inactive
        const { data: inactivePrompts, error: inactiveError } = await supabase
            .from('intelligent_prompt_evolution')
            .select('prompt_type, prompt_version, is_active')
            .eq('prompt_version', 'v1.0')
            .eq('is_active', false);

        if (inactiveError) {
            throw new Error(`Failed to verify inactive prompts: ${inactiveError.message}`);
        }

        console.log(`✅ Active v2.0 prompts: ${activePrompts?.length || 0}`);
        console.log(`✅ Inactive v1.0 prompts: ${inactivePrompts?.length || 0}`);

        if ((activePrompts?.length || 0) < 3) {
            throw new Error('Not all v2.0 prompts are active');
        }
    }

    /**
     * Gets the current active prompt for a specific type
     */
    async getActivePrompt(promptType: string): Promise<any> {
        const { data, error } = await supabase
            .from('intelligent_prompt_evolution')
            .select('*')
            .eq('prompt_type', promptType)
            .eq('is_active', true)
            .order('prompt_version', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            throw new Error(`Failed to get active prompt: ${error.message}`);
        }

        return data;
    }

    /**
     * Records prompt usage and performance
     */
    async recordPromptUsage(promptId: string, qualityScore: number, engagementAchieved: number): Promise<void> {
        const { error } = await supabase
            .from('intelligent_prompt_evolution')
            .update({
                usage_count: supabase.sql`usage_count + 1`,
                avg_quality_score: supabase.sql`(avg_quality_score * usage_count + ${qualityScore}) / (usage_count + 1)`,
                avg_engagement_achieved: supabase.sql`(avg_engagement_achieved * usage_count + ${engagementAchieved}) / (usage_count + 1)`,
                success_rate: supabase.sql`CASE WHEN ${qualityScore} > 0.7 THEN (success_rate * usage_count + 1) / (usage_count + 1) ELSE (success_rate * usage_count) / (usage_count + 1) END`
            })
            .eq('id', promptId);

        if (error) {
            console.error('Failed to record prompt usage:', error);
        }
    }
}

export default AutonomousPromptUpdater;