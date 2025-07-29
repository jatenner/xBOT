#!/usr/bin/env node

/**
 * 🚀 AUTONOMOUS PROMPT UPDATE SCRIPT
 * ==================================
 * Executes the update to Autonomous AI v2.0 prompts
 */

const path = require('path');
const fs = require('fs');

// Load environment variables from .env file
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
} else {
    console.error('❌ .env file not found!');
    process.exit(1);
}

// Verify required environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing required environment variables:');
    console.error('   SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Found' : '❌ Missing');
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Found' : '❌ Missing');
    process.exit(1);
}

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateToAutonomousAI() {
    console.log('🧠 Updating OpenAI prompt system to Autonomous AI v2.0...');
    console.log(`📡 Connected to: ${process.env.SUPABASE_URL.slice(0, 30)}...`);

    try {
        // 1. Deactivate old v1.0 prompts
        console.log('📤 Deactivating v1.0 prompts...');
        
        const { error: deactivateError } = await supabase
            .from('intelligent_prompt_evolution')
            .update({ 
                is_active: false, 
                is_experimental: true,
                evolution_reason: 'Superseded by Autonomous AI v2.0 system'
            })
            .eq('prompt_version', 'v1.0');

        if (deactivateError) {
            throw new Error(`Failed to deactivate v1.0 prompts: ${deactivateError.message}`);
        }
        console.log('✅ Deactivated v1.0 prompts');

        // 2. Insert new v2.0 autonomous prompts
        console.log('🚀 Inserting Autonomous AI v2.0 prompts...');

        const autonomousPrompts = [
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

        // 3. Verify the update
        console.log('🔍 Verifying prompt update...');

        const { data: activePrompts, error: activeError } = await supabase
            .from('intelligent_prompt_evolution')
            .select('prompt_type, prompt_version, is_active')
            .eq('prompt_version', 'v2.0')
            .eq('is_active', true);

        if (activeError) {
            throw new Error(`Failed to verify active prompts: ${activeError.message}`);
        }

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

        console.log('\n🎉 AUTONOMOUS AI PROMPT SYSTEM ACTIVATED!');
        console.log('✅ Your bot now uses advanced autonomous learning prompts');
        console.log('✅ All v2.0 prompts are active and ready');
        console.log('✅ Old v1.0 prompts deactivated');
        console.log('🚀 Ready for viral tweet generation!');

    } catch (error) {
        console.error('❌ Failed to update prompt system:', error);
        throw error;
    }
}

async function updatePrompts() {
    console.log('🧠 Starting Autonomous AI Prompt Update...\n');
    
    try {
        await updateToAutonomousAI();
        console.log('\n🎯 PROMPT UPDATE COMPLETE!');
        console.log('Next: Updating tweet generation logic...');
        
    } catch (error) {
        console.error('❌ Update failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    updatePrompts();
}

module.exports = { updatePrompts };