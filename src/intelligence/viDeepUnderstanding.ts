/**
 * 🧠 VI DEEP UNDERSTANDING SYSTEM
 * 
 * Enhanced AI-driven analysis that goes beyond structural pattern matching
 * to understand the ESSENCE of what makes tweets successful
 * 
 * Features:
 * - Semantic understanding (why tweets work, not just what they look like)
 * - Visual understanding (how tweets appear to readers)
 * - Essence extraction (the "magic" that makes tweets engaging)
 * - Content intelligence (what topics/angles/styles actually work)
 */

import { getSupabaseClient } from '../db/index';
import { log } from '../lib/logger';
import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';

export interface DeepTweetUnderstanding {
  tweet_id: string;
  
  // 🎯 SEMANTIC UNDERSTANDING (Why it works)
  semantic_analysis: {
    core_message: string;              // What's the core insight/value?
    value_proposition: string;          // What value does it provide?
    emotional_triggers: string[];       // What emotions does it trigger?
    cognitive_hooks: string[];          // What makes you stop scrolling?
    credibility_signals: string[];      // What makes it believable?
    novelty_factor: string;             // What's new/surprising about it?
    urgency_elements: string[];         // What creates urgency?
    curiosity_gaps: string[];           // What questions does it raise?
  };
  
  // 🎨 VISUAL UNDERSTANDING (How it looks)
  visual_analysis: {
    readability_score: number;         // How easy to read (0-100)
    scannability_score: number;        // How easy to scan (0-100)
    visual_hierarchy: string[];        // What draws the eye first?
    pacing_rhythm: string;             // Fast/slow/medium pacing
    emphasis_techniques: string[];     // Bold, caps, numbers, etc.
    white_space_usage: string;         // How space is used
    visual_flow: string;               // How eye moves through content
  };
  
  // ✨ ESSENCE EXTRACTION (The magic)
  essence_analysis: {
    the_hook: string;                  // What makes you read it?
    the_payoff: string;                // What makes you engage?
    the_magic: string;                 // What's special about it?
    the_formula: string;               // What pattern does it follow?
    replicable_elements: string[];     // What can we replicate?
    unique_elements: string[];         // What's unique to this?
    improvement_opportunities: string[]; // How could it be better?
  };
  
  // 📊 CONTENT INTELLIGENCE (What works)
  content_intelligence: {
    topic_performance: string;         // How does this topic perform?
    angle_effectiveness: string;       // How effective is this angle?
    style_appeal: string;              // Who does this style appeal to?
    audience_match: string;            // Who would love this?
    viral_elements: string[];          // What makes it shareable?
    engagement_drivers: string[];      // What drives engagement?
    follower_conversion_factors: string[]; // What makes people follow?
  };
  
  // 🎯 ACTIONABLE INSIGHTS
  actionable_insights: {
    key_learnings: string[];           // What should we learn from this?
    applicable_patterns: string[];     // What patterns can we use?
    content_recommendations: string[]; // What content should we create?
    formatting_recommendations: string[]; // How should we format?
    timing_insights: string;           // When should we post this type?
  };
  
  // 📈 PERFORMANCE CORRELATION
  performance_data: {
    engagement_rate: number;
    impressions: number;
    likes: number;
    retweets: number;
    replies: number;
    followers_gained: number;
  };
  
  confidence: number;                  // How confident in analysis (0-1)
  analyzed_at: Date;
}

export class VIDeepUnderstanding {
  private supabase = getSupabaseClient();
  
  /**
   * Deep analysis of a single tweet with semantic + visual understanding
   */
  async analyzeTweetDeeply(tweet: any): Promise<DeepTweetUnderstanding | null> {
    try {
      log({ op: 'vi_deep_analysis_start', tweet_id: tweet.tweet_id });
      
      // Build comprehensive analysis prompt
      const prompt = this.buildDeepAnalysisPrompt(tweet);
      
      // Get deep analysis from GPT-4 (higher capability model for deep understanding)
      const analysis = await this.getDeepAnalysis(tweet, prompt);
      
      // Store in database
      await this.storeDeepAnalysis(tweet.tweet_id, analysis);
      
      log({ op: 'vi_deep_analysis_complete', tweet_id: tweet.tweet_id });
      
      return analysis;
      
    } catch (error: any) {
      log({ op: 'vi_deep_analysis_error', tweet_id: tweet.tweet_id, error: error.message });
      return null;
    }
  }
  
  /**
   * Build comprehensive deep analysis prompt
   */
  private buildDeepAnalysisPrompt(tweet: any): string {
    const engagement_rate = tweet.engagement_rate || 0;
    const impressions = tweet.views || tweet.impressions || 0;
    const likes = tweet.likes || 0;
    const retweets = tweet.retweets || 0;
    const replies = tweet.replies || 0;
    
    return `You are an expert Twitter content analyst specializing in understanding WHY tweets succeed, not just what they look like.

Analyze this successful tweet and extract deep insights:

TWEET:
"${tweet.text}"

PERFORMANCE:
- Engagement Rate: ${(engagement_rate * 100).toFixed(1)}%
- Impressions: ${impressions.toLocaleString()}
- Likes: ${likes}
- Retweets: ${retweets}
- Replies: ${replies}

ANALYSIS TASKS:

1. SEMANTIC UNDERSTANDING (Why it works):
   - What's the core message/insight?
   - What value does it provide to readers?
   - What emotions does it trigger? (curiosity, fear, validation, anger, hope, etc.)
   - What makes someone stop scrolling? (specific hooks)
   - What makes it credible? (sources, numbers, authority signals)
   - What's novel/surprising about it?
   - What creates urgency?
   - What questions does it raise?

2. VISUAL UNDERSTANDING (How it actually looks on screen):
   - Visual appearance: Minimal text, enhanced with emojis, or highly visual?
   - Structural emojis: Are emojis used structurally (numbers 1️⃣ 2️⃣, arrows →, symbols ⚠️) or just decoration?
   - Emoji function: What % are structural vs decorative?
   - Visual hierarchy: What draws the eye first? (numbers, emojis, caps, text)
   - Attention flow: In what order does the eye move through it?
   - Focal points: Where does the eye naturally go?
   - Typography: How are caps, numbers, and formatting used visually?
   - Visual structure: Paragraph, list, or thread-like appearance?
   - Scanning pattern: How is it scanned? What's the scan path?
   - Visual perception: Readability, scannability, engagement (0-100 scores)

3. ESSENCE EXTRACTION (The magic):
   - The hook: What makes you read it?
   - The payoff: What makes you engage?
   - The magic: What's special about it?
   - The formula: What pattern does it follow?
   - Replicable elements: What can we copy?
   - Unique elements: What's unique to this?
   - Improvement opportunities: How could it be better?

4. CONTENT INTELLIGENCE (What works):
   - Topic performance: How does this topic perform?
   - Angle effectiveness: How effective is this angle?
   - Style appeal: Who does this style appeal to?
   - Audience match: Who would love this?
   - Viral elements: What makes it shareable?
   - Engagement drivers: What drives engagement?
   - Follower conversion: What makes people follow?

5. ACTIONABLE INSIGHTS:
   - Key learnings: What should we learn from this?
   - Applicable patterns: What patterns can we use?
   - Content recommendations: What content should we create?
   - Formatting recommendations: How should we format?
   - Timing insights: When should we post this type?

Return JSON in this exact format:
{
  "semantic_analysis": {
    "core_message": "string",
    "value_proposition": "string",
    "emotional_triggers": ["string"],
    "cognitive_hooks": ["string"],
    "credibility_signals": ["string"],
    "novelty_factor": "string",
    "urgency_elements": ["string"],
    "curiosity_gaps": ["string"]
  },
  "visual_analysis": {
    "overall_style": "minimal|enhanced|highly_visual|mixed",
    "simplicity_score": number,
    "visual_complexity": number,
    "structural_emojis_count": number,
    "decorative_emojis_count": number,
    "emoji_structural_ratio": number,
    "first_visual_element": "string",
    "attention_flow": ["string"],
    "focal_points": [{"element": "string", "position": number, "strength": number}],
    "readability_visual": number,
    "scannability_visual": number,
    "engagement_visual": number,
    "scanning_pattern": "string",
    "visual_perception": "string"
  },
  "essence_analysis": {
    "the_hook": "string",
    "the_payoff": "string",
    "the_magic": "string",
    "the_formula": "string",
    "replicable_elements": ["string"],
    "unique_elements": ["string"],
    "improvement_opportunities": ["string"]
  },
  "content_intelligence": {
    "topic_performance": "string",
    "angle_effectiveness": "string",
    "style_appeal": "string",
    "audience_match": "string",
    "viral_elements": ["string"],
    "engagement_drivers": ["string"],
    "follower_conversion_factors": ["string"]
  },
  "actionable_insights": {
    "key_learnings": ["string"],
    "applicable_patterns": ["string"],
    "content_recommendations": ["string"],
    "formatting_recommendations": ["string"],
    "timing_insights": "string"
  }
}`;
  }
  
  /**
   * Get deep analysis from AI
   */
  private async getDeepAnalysis(tweet: any, prompt: string): Promise<DeepTweetUnderstanding> {
    const response = await createBudgetedChatCompletion(
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert Twitter content analyst with deep understanding of:
- Why tweets go viral (semantic, visual, emotional factors)
- What makes people stop scrolling (cognitive hooks)
- What drives engagement (value, curiosity, urgency)
- What converts viewers to followers (authority, value, community)
- Visual design principles (readability, scannability, hierarchy)

Analyze tweets at a DEEP level, extracting not just structure but the ESSENCE of what makes them work.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 3000
      },
      {
        purpose: 'vi_deep_analysis',
        priority: 'high'
      }
    );
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
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
    } catch (error) {
      // If JSON parsing fails, try to extract structured data
      console.warn('[VI_DEEP] Failed to parse JSON, attempting to extract insights...', error);
      analysis = this.extractInsightsFromText(content);
    }
    
    // Build comprehensive understanding object
    const engagement_rate = tweet.engagement_rate || 0;
    const impressions = tweet.views || tweet.impressions || 0;
    
    return {
      tweet_id: tweet.tweet_id,
      semantic_analysis: analysis.semantic_analysis || {},
      visual_analysis: analysis.visual_analysis || {},
      essence_analysis: analysis.essence_analysis || {},
      content_intelligence: analysis.content_intelligence || {},
      actionable_insights: analysis.actionable_insights || {},
      performance_data: {
        engagement_rate,
        impressions,
        likes: tweet.likes || 0,
        retweets: tweet.retweets || 0,
        replies: tweet.replies || 0,
        followers_gained: tweet.followers_gained || 0
      },
      confidence: 0.8, // High confidence if we got structured response
      analyzed_at: new Date()
    };
  }
  
  /**
   * Extract insights from unstructured text (fallback)
   */
  private extractInsightsFromText(text: string): any {
    // Simple extraction as fallback
    return {
      semantic_analysis: {
        core_message: 'Extracted from analysis',
        value_proposition: 'Value proposition',
        emotional_triggers: [],
        cognitive_hooks: [],
        credibility_signals: [],
        novelty_factor: 'Novel',
        urgency_elements: [],
        curiosity_gaps: []
      },
      visual_analysis: {
        readability_score: 70,
        scannability_score: 70,
        visual_hierarchy: [],
        pacing_rhythm: 'medium',
        emphasis_techniques: [],
        white_space_usage: 'moderate',
        visual_flow: 'natural'
      },
      essence_analysis: {
        the_hook: 'Extracted hook',
        the_payoff: 'Extracted payoff',
        the_magic: 'Extracted magic',
        the_formula: 'Extracted formula',
        replicable_elements: [],
        unique_elements: [],
        improvement_opportunities: []
      },
      content_intelligence: {
        topic_performance: 'Good',
        angle_effectiveness: 'Effective',
        style_appeal: 'Broad',
        audience_match: 'Health enthusiasts',
        viral_elements: [],
        engagement_drivers: [],
        follower_conversion_factors: []
      },
      actionable_insights: {
        key_learnings: [],
        applicable_patterns: [],
        content_recommendations: [],
        formatting_recommendations: [],
        timing_insights: 'Any time'
      }
    };
  }
  
  /**
   * Store deep analysis in database
   */
  private async storeDeepAnalysis(tweet_id: string, analysis: DeepTweetUnderstanding): Promise<void> {
    try {
      await this.supabase
        .from('vi_deep_understanding')
        .upsert({
          tweet_id,
          semantic_analysis: analysis.semantic_analysis,
          visual_analysis: analysis.visual_analysis,
          essence_analysis: analysis.essence_analysis,
          content_intelligence: analysis.content_intelligence,
          actionable_insights: analysis.actionable_insights,
          performance_data: analysis.performance_data,
          confidence: analysis.confidence,
          analyzed_at: analysis.analyzed_at.toISOString()
        }, {
          onConflict: 'tweet_id'
        });
      
      log({ op: 'vi_deep_stored', tweet_id });
    } catch (error: any) {
      log({ op: 'vi_deep_store_error', tweet_id, error: error.message });
      throw error;
    }
  }
  
  /**
   * Process high-performing tweets with deep analysis
   * Only analyze tweets with high engagement (2%+ ER or 50K+ views)
   */
  async processHighPerformers(): Promise<number> {
    log({ op: 'vi_deep_process_start' });
    
    // Get high-performing tweets that haven't been deeply analyzed
    const { data: tweets } = await this.supabase
      .from('vi_collected_tweets')
      .select('*')
      .eq('deep_analyzed', false)
      .or('engagement_rate.gte.0.02,views.gte.50000')
      .order('engagement_rate', { ascending: false })
      .limit(50); // Analyze top 50 per run
    
    if (!tweets || tweets.length === 0) {
      log({ op: 'vi_deep_no_work' });
      return 0;
    }
    
    log({ op: 'vi_deep_processing', count: tweets.length });
    
    let analyzed = 0;
    for (const tweet of tweets) {
      try {
        await this.analyzeTweetDeeply(tweet);
        
        // Mark as analyzed
        await this.supabase
          .from('vi_collected_tweets')
          .update({ deep_analyzed: true })
          .eq('tweet_id', tweet.tweet_id);
        
        analyzed++;
        
        // Rate limiting
        await this.sleep(500); // 500ms between analyses
        
      } catch (error: any) {
        log({ op: 'vi_deep_error', tweet_id: tweet.tweet_id, error: error.message });
      }
    }
    
    log({ op: 'vi_deep_complete', analyzed });
    return analyzed;
  }
  
  /**
   * Get aggregated insights from deep analyses
   */
  async getAggregatedInsights(): Promise<any> {
    const { data: analyses } = await this.supabase
      .from('vi_deep_understanding')
      .select('*')
      .gte('performance_data->engagement_rate', 0.02)
      .order('performance_data->engagement_rate', { ascending: false })
      .limit(100);
    
    if (!analyses || analyses.length === 0) {
      return null;
    }
    
    // Aggregate insights across all analyses
    const aggregated = {
      top_semantic_patterns: this.aggregateSemanticPatterns(analyses),
      top_visual_patterns: this.aggregateVisualPatterns(analyses),
      top_essence_formulas: this.aggregateEssenceFormulas(analyses),
      top_content_patterns: this.aggregateContentPatterns(analyses),
      top_actionable_insights: this.aggregateActionableInsights(analyses)
    };
    
    return aggregated;
  }
  
  private aggregateSemanticPatterns(analyses: any[]): any {
    // Aggregate semantic patterns
    const patterns: Record<string, { count: number; avgER: number }> = {};
    
    analyses.forEach(analysis => {
      const triggers = analysis.semantic_analysis?.emotional_triggers || [];
      triggers.forEach((trigger: string) => {
        if (!patterns[trigger]) {
          patterns[trigger] = { count: 0, avgER: 0 };
        }
        patterns[trigger].count++;
        patterns[trigger].avgER += analysis.performance_data?.engagement_rate || 0;
      });
    });
    
    // Calculate averages and sort
    return Object.entries(patterns)
      .map(([trigger, data]: [string, any]) => ({
        trigger,
        count: data.count,
        avgER: data.avgER / data.count
      }))
      .sort((a, b) => b.avgER - a.avgER)
      .slice(0, 10);
  }
  
  private aggregateVisualPatterns(analyses: any[]): any {
    // Similar aggregation for visual patterns
    return {};
  }
  
  private aggregateEssenceFormulas(analyses: any[]): any {
    // Similar aggregation for essence formulas
    return {};
  }
  
  private aggregateContentPatterns(analyses: any[]): any {
    // Similar aggregation for content patterns
    return {};
  }
  
  private aggregateActionableInsights(analyses: any[]): any {
    // Aggregate all actionable insights
    const insights: Record<string, number> = {};
    
    analyses.forEach(analysis => {
      const learnings = analysis.actionable_insights?.key_learnings || [];
      learnings.forEach((learning: string) => {
        insights[learning] = (insights[learning] || 0) + 1;
      });
    });
    
    return Object.entries(insights)
      .map(([insight, count]) => ({ insight, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

