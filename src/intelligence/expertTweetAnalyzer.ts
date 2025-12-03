/**
 * 🎯 EXPERT TWEET ANALYZER
 * 
 * Analyzes successful tweets using GPT-4o as an expert social media manager
 * Provides strategic analysis in plain English, not just formatting data
 * 
 * Used by: expertAnalysisJob (scheduled every 6 hours)
 */

import { getSupabaseClient } from '../db/index';
import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { log } from '../lib/logger';

export interface ExpertTweetAnalysis {
  strategic_analysis: {
    why_it_works: string;
    core_value_proposition: string;
    target_audience: string;
    engagement_strategy: string;
    viral_elements: string[];
    follower_conversion_factors: string[];
  };
  content_intelligence: {
    hook_analysis: {
      type: string;
      effectiveness: number;
      why_effective: string;
      improvement_suggestions: string[];
    };
    structure_analysis: {
      pattern: string;
      why_it_works: string;
      when_to_use: string;
    };
    messaging_analysis: {
      core_message: string;
      clarity_score: number;
      value_delivery: string;
      emotional_appeal: string[];
    };
    angle_analysis: {
      angle_type: string;
      effectiveness: string;
      audience_appeal: string;
    };
    tone_analysis: {
      tone_type: string;
      appropriateness: string;
      audience_match: string;
    };
  };
  performance_insights: {
    engagement_drivers: string[];
    shareability_factors: string[];
    follower_conversion_reasons: string[];
    timing_effectiveness: string;
    audience_resonance: string;
  };
  actionable_recommendations: {
    content_strategy: string[];
    formatting_advice: string[];
    hook_improvements: string[];
    messaging_tips: string[];
    timing_recommendations: string[];
    audience_targeting: string[];
  };
  visual_analysis: {
    formatting_strategy: string;
    visual_hierarchy: string;
    readability_analysis: string;
    scanning_pattern: string;
  };
  // ✅ NEW: Visual data points (structured metrics)
  visual_data_points?: {
    emoji_positions: Array<{emoji: string; position: number; role: string}>;
    structural_emojis: number;
    decorative_emojis: number;
    structural_ratio: number;
    visual_complexity: number;
    line_break_positions: Array<{position: number; purpose: string}>;
    scanning_pattern: string[];
  };
  // ✅ NEW: Visual strategic insights (why visual elements work)
  visual_strategic_insights?: {
    emoji_strategy: string;
    visual_hierarchy: string;
    data_backed_reasoning: string;
  };
}

export class ExpertTweetAnalyzer {
  private supabase = getSupabaseClient();

  /**
   * Get tweets that need expert analysis
   */
  async getTweetsNeedingAnalysis(options: {
    minViews?: number;
    minEngagementRate?: number;
    limit?: number;
  } = {}): Promise<any[]> {
    const {
      minViews = 10000,
      minEngagementRate = 0.02,
      limit = 20
    } = options;

    log({ op: 'expert_analyzer_get_tweets', minViews, minEngagementRate, limit });

    // Get successful tweets from vi_viral_unknowns
    const { data: viralTweets, error: viralError } = await this.supabase
      .from('vi_viral_unknowns')
      .select('tweet_id, content, views, likes, retweets, replies, engagement_rate')
      .gte('views', minViews)
      .eq('analyzed', false)
      .limit(limit);

    if (viralError) {
      log({ op: 'expert_analyzer_error', error: viralError.message });
    }

    // Get successful tweets from vi_collected_tweets
    const { data: collectedTweets, error: collectedError } = await this.supabase
      .from('vi_collected_tweets')
      .select('tweet_id, content, views, likes, retweets, replies, engagement_rate')
      .or(`views.gte.${minViews},engagement_rate.gte.${minEngagementRate}`)
      .eq('analyzed', false)
      .limit(limit);

    if (collectedError) {
      log({ op: 'expert_analyzer_error', error: collectedError.message });
    }

    // Combine and deduplicate
    const allTweets = [
      ...(viralTweets || []).map(t => ({ ...t, source_table: 'vi_viral_unknowns' })),
      ...(collectedTweets || []).map(t => ({ ...t, source_table: 'vi_collected_tweets' }))
    ];

    // Remove duplicates (same tweet_id)
    const uniqueTweets = Array.from(
      new Map(allTweets.map(t => [t.tweet_id, t])).values()
    ).slice(0, limit);

    log({ op: 'expert_analyzer_tweets_found', count: uniqueTweets.length });

    return uniqueTweets;
  }

  /**
   * Analyze a single tweet with expert analysis
   */
  async analyzeTweet(tweet: any): Promise<void> {
    log({ op: 'expert_analyzer_start', tweet_id: tweet.tweet_id });

    try {
      // Check if already analyzed
      const { data: existing } = await this.supabase
        .from('expert_tweet_analysis')
        .select('id')
        .eq('tweet_id', tweet.tweet_id)
        .eq('source_table', tweet.source_table)
        .maybeSingle();

      if (existing) {
        log({ op: 'expert_analyzer_skip', tweet_id: tweet.tweet_id, reason: 'already_analyzed' });
        return;
      }

      // ✅ NEW: Get visual analysis from VI Visual Analysis
      let visualAnalysis = null;
      try {
        const { VIVisualAnalysis } = await import('./viVisualAnalysis');
        const visualAnalyzer = new VIVisualAnalysis();
        visualAnalysis = await visualAnalyzer.analyzeVisualAppearance(tweet);
        
        if (visualAnalysis) {
          log({ op: 'expert_analyzer_visual_data', tweet_id: tweet.tweet_id, has_visual: true });
        } else {
          log({ op: 'expert_analyzer_visual_data', tweet_id: tweet.tweet_id, has_visual: false });
        }
      } catch (error: any) {
        log({ op: 'expert_analyzer_visual_error', tweet_id: tweet.tweet_id, error: error.message });
        // Continue without visual analysis - not critical
      }

      // Build expert prompt (with visual data if available)
      const prompt = this.buildExpertPrompt(tweet, visualAnalysis);

      // Get expert analysis from GPT-4o
      const analysis = await this.getExpertAnalysis(tweet, prompt, visualAnalysis);

      // Store in database
      await this.storeExpertAnalysis(tweet, analysis, visualAnalysis);

      // Mark tweet as analyzed
      await this.markTweetAsAnalyzed(tweet.tweet_id, tweet.source_table);

      log({ op: 'expert_analyzer_complete', tweet_id: tweet.tweet_id });
    } catch (error: any) {
      log({ op: 'expert_analyzer_error', tweet_id: tweet.tweet_id, error: error.message });
      throw error;
    }
  }

  /**
   * Build expert analysis prompt
   */
  private buildExpertPrompt(tweet: any, visualAnalysis?: any): string {
    const engagement_rate = tweet.engagement_rate || 0;
    const impressions = tweet.views || 0;
    const likes = tweet.likes || 0;
    const retweets = tweet.retweets || 0;
    const replies = tweet.replies || 0;

    // ✅ NEW: Build visual data section if available
    let visualDataSection = '';
    if (visualAnalysis && visualAnalysis.visual_appearance && visualAnalysis.visual_elements) {
      const va = visualAnalysis.visual_appearance;
      const ve = visualAnalysis.visual_elements;
      
      visualDataSection = `

VISUAL DATA POINTS (from Visual Analysis Agent):
- Emoji positions: ${JSON.stringify(ve.emojis_used || [])}
- Structural emojis: ${va.emoji_function?.structural_count || 0}
- Decorative emojis: ${va.emoji_function?.decorative_count || 0}
- Structural ratio: ${va.emoji_function?.structural_ratio || 0}
- Visual complexity: ${va.visual_complexity || 0}
- Line break positions: ${JSON.stringify(ve.line_breaks_visual || [])}
- Scanning pattern: ${JSON.stringify(va.scanning_pattern?.scan_path || [])}

YOUR TASK: Connect visual data points to strategic insights.
Explain WHY these visual elements work (not just WHAT they are).
Provide data-backed reasoning for visual recommendations.`;
    }

    return `You are an expert social media manager with 10+ years of experience growing Twitter accounts from 0 to 1M+ followers.

Your specialty: Understanding WHY content works, not just what it looks like.

ANALYZE THIS SUCCESSFUL TWEET:

TWEET:
"${tweet.content}"

PERFORMANCE DATA:
- Engagement Rate: ${(engagement_rate * 100).toFixed(1)}%
- Impressions: ${impressions.toLocaleString()}
- Likes: ${likes}
- Retweets: ${retweets}
- Replies: ${replies}
- Views: ${impressions.toLocaleString()}${visualDataSection}

YOUR TASK: Provide expert-level strategic analysis as if you're advising a content creator.

ANALYSIS FRAMEWORK:

1. STRATEGIC ANALYSIS (Why It Works):
   - Why does this tweet succeed? (Plain English explanation)
   - What's the core value proposition?
   - Who is the target audience?
   - What's the engagement strategy?
   - What makes it shareable?
   - What makes people follow?

2. CONTENT INTELLIGENCE (What Makes It Good):
   - Hook Analysis:
     * What type of hook is this?
     * How effective is it? (0-100)
     * Why is effective? (Plain English)
     * How could hooks be improved?
   
   - Structure Analysis:
     * What structure pattern does it use?
     * Why does this structure work?
     * When should this structure be used?
   
   - Messaging Analysis:
     * What's the core message?
     * How clear is it? (0-100)
     * How does it deliver value?
     * What emotions does it trigger?
   
   - Angle Analysis:
     * What angle does it take?
     * Why does this angle work?
     * Who responds to this angle?
   
   - Tone Analysis:
     * What tone does it use?
     * Why does this tone fit?
     * Who connects with this tone?

3. PERFORMANCE INSIGHTS (Data-Driven):
   - What drives engagement?
   - What makes it shareable?
   - Why do people follow?
   - When should this type be posted?
   - Who resonates with this?

4. ACTIONABLE RECOMMENDATIONS (For Content Creators):
   - Content Strategy: How to create similar content
   - Formatting Advice: How to format for success
   - Hook Improvements: How to improve hooks
   - Messaging Tips: How to improve messaging
   - Timing Recommendations: When to post this type
   - Audience Targeting: How to target audience

5. VISUAL & FORMATTING (How It Looks):
   - How does formatting help?
   - What draws attention first?
   - How readable is it?
   - How is it scanned?

CRITICAL: Write as an expert social media manager giving advice to a content creator.
- Use plain English, not technical jargon
- Explain WHY things work, not just WHAT works
- Provide actionable recommendations
- Think strategically, not just analytically
- Consider audience psychology and Twitter algorithm

Return JSON in this exact format:
{
  "strategic_analysis": {
    "why_it_works": "string",
    "core_value_proposition": "string",
    "target_audience": "string",
    "engagement_strategy": "string",
    "viral_elements": ["string"],
    "follower_conversion_factors": ["string"]
  },
  "content_intelligence": {
    "hook_analysis": {
      "type": "string",
      "effectiveness": number,
      "why_effective": "string",
      "improvement_suggestions": ["string"]
    },
    "structure_analysis": {
      "pattern": "string",
      "why_it_works": "string",
      "when_to_use": "string"
    },
    "messaging_analysis": {
      "core_message": "string",
      "clarity_score": number,
      "value_delivery": "string",
      "emotional_appeal": ["string"]
    },
    "angle_analysis": {
      "angle_type": "string",
      "effectiveness": "string",
      "audience_appeal": "string"
    },
    "tone_analysis": {
      "tone_type": "string",
      "appropriateness": "string",
      "audience_match": "string"
    }
  },
  "performance_insights": {
    "engagement_drivers": ["string"],
    "shareability_factors": ["string"],
    "follower_conversion_reasons": ["string"],
    "timing_effectiveness": "string",
    "audience_resonance": "string"
  },
  "actionable_recommendations": {
    "content_strategy": ["string"],
    "formatting_advice": ["string"],
    "hook_improvements": ["string"],
    "messaging_tips": ["string"],
    "timing_recommendations": ["string"],
    "audience_targeting": ["string"]
  },
  "visual_analysis": {
    "formatting_strategy": "string",
    "visual_hierarchy": "string",
    "readability_analysis": "string",
    "scanning_pattern": "string"
  },
  "visual_data_points": {
    "emoji_positions": [{"emoji": "string", "position": number, "role": "string"}],
    "structural_emojis": number,
    "decorative_emojis": number,
    "structural_ratio": number,
    "visual_complexity": number,
    "line_break_positions": [{"position": number, "purpose": "string"}],
    "scanning_pattern": ["string"]
  },
  "visual_strategic_insights": {
    "emoji_strategy": "string",
    "visual_hierarchy": "string",
    "data_backed_reasoning": "string"
  }
}`;
  }

  /**
   * Get expert analysis from GPT-4o
   */
  private async getExpertAnalysis(tweet: any, prompt: string, visualAnalysis?: any): Promise<ExpertTweetAnalysis> {
    log({ op: 'expert_analyzer_gpt_start', tweet_id: tweet.tweet_id });

    const response = await createBudgetedChatCompletion(
      {
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert social media manager specializing in Twitter growth. You understand:
- Why tweets go viral (semantic, visual, emotional factors)
- What makes people stop scrolling (cognitive hooks)
- What drives engagement (value, curiosity, urgency)
- What converts viewers to followers (authority, value, community)
- Audience psychology and Twitter algorithm behavior

Provide strategic, actionable advice in plain English. Think like a consultant advising a content creator.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      },
      {
        purpose: 'expert_tweet_analysis',
        priority: 'medium'
      }
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from GPT-4o');
    }

    // Parse JSON response
    let analysis: any;
    try {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[1]);
      } else {
        analysis = JSON.parse(content);
      }
    } catch (error: any) {
      log({ op: 'expert_analyzer_parse_error', tweet_id: tweet.tweet_id, error: error.message });
      throw new Error(`Failed to parse expert analysis: ${error.message}`);
    }

    // ✅ NEW: Extract visual data points from visualAnalysis if available
    if (visualAnalysis && visualAnalysis.visual_appearance && visualAnalysis.visual_elements) {
      const va = visualAnalysis.visual_appearance;
      const ve = visualAnalysis.visual_elements;
      
      // Extract emoji positions
      const emojiPositions = (ve.emojis_used || []).map((e: any) => ({
        emoji: e.emoji || e,
        position: e.position || 0,
        role: e.role || (e.position <= 10 ? 'hook_enhancement' : 'structural')
      }));
      
      // Extract line break positions
      const lineBreakPositions = (ve.line_breaks_visual || []).map((pos: number, idx: number) => ({
        position: pos,
        purpose: idx === 0 ? 'visual_break_after_hook' : idx === 1 ? 'visual_break_before_data' : 'visual_break'
      }));
      
      analysis.visual_data_points = {
        emoji_positions: emojiPositions,
        structural_emojis: va.emoji_function?.structural_count || 0,
        decorative_emojis: va.emoji_function?.decorative_count || 0,
        structural_ratio: va.emoji_function?.structural_ratio || 0,
        visual_complexity: va.visual_complexity || 0,
        line_break_positions: lineBreakPositions,
        scanning_pattern: va.scanning_pattern?.scan_path || []
      };
      
      // If GPT didn't provide visual_strategic_insights, extract from visual_analysis
      if (!analysis.visual_strategic_insights && analysis.visual_analysis) {
        analysis.visual_strategic_insights = {
          emoji_strategy: analysis.visual_analysis.formatting_strategy || '',
          visual_hierarchy: analysis.visual_analysis.visual_hierarchy || '',
          data_backed_reasoning: `Visual complexity ${va.visual_complexity || 0}, structural ratio ${va.emoji_function?.structural_ratio || 0}`
        };
      }
    }

    log({ op: 'expert_analyzer_gpt_complete', tweet_id: tweet.tweet_id });

    return analysis as ExpertTweetAnalysis;
  }

  /**
   * Store expert analysis in database
   */
  private async storeExpertAnalysis(tweet: any, analysis: ExpertTweetAnalysis, visualAnalysis?: any): Promise<void> {
    const engagement_rate = tweet.engagement_rate || 0;
    const impressions = tweet.views || 0;
    const likes = tweet.likes || 0;
    const retweets = tweet.retweets || 0;
    const replies = tweet.replies || 0;

    const { error } = await this.supabase
      .from('expert_tweet_analysis')
      .insert({
        tweet_id: tweet.tweet_id,
        source_table: tweet.source_table,
        strategic_analysis: analysis.strategic_analysis,
        content_intelligence: analysis.content_intelligence,
        performance_insights: analysis.performance_insights,
        actionable_recommendations: analysis.actionable_recommendations,
        visual_analysis: analysis.visual_analysis,
        // ✅ NEW: Store visual data points and strategic insights
        visual_data_points: analysis.visual_data_points || null,
        visual_strategic_insights: analysis.visual_strategic_insights || null,
        confidence: 0.8,
        engagement_rate,
        impressions,
        likes,
        retweets,
        replies
      });

    if (error) {
      log({ op: 'expert_analyzer_store_error', tweet_id: tweet.tweet_id, error: error.message });
      throw new Error(`Failed to store expert analysis: ${error.message}`);
    }

    log({ op: 'expert_analyzer_stored', tweet_id: tweet.tweet_id, has_visual_data: !!analysis.visual_data_points });
  }

  /**
   * Mark tweet as analyzed
   */
  private async markTweetAsAnalyzed(tweetId: string, sourceTable: string): Promise<void> {
    const tableName = sourceTable === 'vi_viral_unknowns' ? 'vi_viral_unknowns' : 'vi_collected_tweets';
    
    const { error } = await this.supabase
      .from(tableName)
      .update({ analyzed: true })
      .eq('tweet_id', tweetId);

    if (error) {
      log({ op: 'expert_analyzer_mark_error', tweet_id: tweetId, error: error.message });
      // Don't throw - this is not critical
    }
  }
}

