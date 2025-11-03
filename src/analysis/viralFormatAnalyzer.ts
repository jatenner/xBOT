/**
 * VIRAL FORMAT ANALYZER
 * 
 * Uses OpenAI to analyze HOW successful tweets are formatted (not WHAT they say)
 * This is the KEY piece that lets us LEARN from viral tweets without copying them
 * 
 * Focus: Structure, hooks, visual patterns - NOT content
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { getSupabaseClient } from '../db';

export interface FormatAnalysis {
  hookType: 'question' | 'data' | 'controversy' | 'story' | 'statement' | 'news';
  visualStructure: string[]; // ['line_breaks', 'bullets', 'caps_emphasis', 'emoji_free', etc]
  emojiStrategy: 'none' | 'strategic_one' | 'multiple';
  lengthCategory: 'ultra_short' | 'short' | 'medium' | 'long';
  whyItWorks: string; // AI explanation of what makes this format effective
  patternStrength: number; // 1-10 confidence in the pattern
  keyTakeaways: string[]; // Actionable insights for our formatter
}

export class ViralFormatAnalyzer {
  private static instance: ViralFormatAnalyzer;
  
  public static getInstance(): ViralFormatAnalyzer {
    if (!this.instance) {
      this.instance = new ViralFormatAnalyzer();
    }
    return this.instance;
  }
  
  /**
   * Analyze a single tweet's format using OpenAI
   */
  async analyzeTweetFormat(tweet: {
    text: string;
    likes: number;
    views: number;
    retweets: number;
    replies: number;
  }): Promise<FormatAnalysis> {
    
    const engagementRate = (tweet.likes + tweet.retweets + tweet.replies) / (tweet.views || 1);
    const isViral = engagementRate >= 0.03 || tweet.views >= 100000;
    
    console.log(`[FORMAT_ANALYZER] 🔍 Analyzing ${isViral ? 'VIRAL' : 'high-performing'} tweet...`);
    console.log(`  Views: ${tweet.views.toLocaleString()}, Engagement: ${(engagementRate * 100).toFixed(1)}%`);
    
    try {
      const response = await createBudgetedChatCompletion({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'system',
          content: `You're a Twitter format analyst. Your job: analyze HOW tweets are structured, not WHAT they say.

Focus on:
1. HOOK TYPE - How does it grab attention in first 10 characters?
   - question: Starts with What/Why/How or "?"
   - data: Starts with numbers/stats
   - controversy: Challenges common belief
   - story: Narrative/experience
   - statement: Bold claim
   - news: BREAKING/NEW/JUST IN

2. VISUAL STRUCTURE - How is it formatted?
   - line_breaks: Uses \\n for spacing
   - bullets: Uses • or ● 
   - numbered_list: 1) 2) 3) format
   - caps_emphasis: KEY TERMS in caps
   - emoji_free: No emojis (professional)
   - clean_short: Under 150 chars, punchy
   - etc.

3. WHY IT WORKS - Explain the psychology
   - Why does this format stop scrollers?
   - What makes it engaging?
   - How does structure serve the message?

Return JSON:
{
  "hookType": "question",
  "visualStructure": ["line_breaks", "emoji_free"],
  "emojiStrategy": "none",
  "lengthCategory": "short",
  "whyItWorks": "Opens with intriguing question that creates curiosity gap. Clean formatting builds authority. Short length ensures mobile readability.",
  "patternStrength": 8,
  "keyTakeaways": [
    "Question hooks drive 40% more engagement",
    "No emojis = more credibility for science content"
  ]
}

Be specific and actionable. These insights train our AI formatter.`
        }, {
          role: 'user',
          content: `Analyze the FORMAT (not content) of this ${isViral ? 'VIRAL' : 'high-performing'} tweet:

"${tweet.text}"

Performance:
- ${tweet.likes.toLocaleString()} likes
- ${tweet.retweets.toLocaleString()} retweets  
- ${tweet.views.toLocaleString()} views
- ${(engagementRate * 100).toFixed(2)}% engagement rate

What formatting choices made this work?`
        }],
        response_format: { type: 'json_object' },
        temperature: 0.3, // More analytical, less creative
        max_tokens: 500
      }, { purpose: 'viral_format_analysis' });
      
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }
      
      const analysis = JSON.parse(content) as FormatAnalysis;
      
      console.log(`[FORMAT_ANALYZER] ✅ Analysis complete`);
      console.log(`  Hook: ${analysis.hookType}`);
      console.log(`  Structure: ${analysis.visualStructure.join(', ')}`);
      console.log(`  Strength: ${analysis.patternStrength}/10`);
      
      return analysis;
      
    } catch (error: any) {
      console.error(`[FORMAT_ANALYZER] ❌ Analysis failed: ${error.message}`);
      
      // Fallback to basic analysis
      return this.basicFormatAnalysis(tweet.text);
    }
  }
  
  /**
   * Batch analyze multiple tweets (with rate limiting)
   */
  async batchAnalyze(tweets: any[]): Promise<Map<string, FormatAnalysis>> {
    console.log(`[FORMAT_ANALYZER] 📊 Batch analyzing ${tweets.length} tweets...`);
    
    const results = new Map<string, FormatAnalysis>();
    let analyzed = 0;
    let failed = 0;
    
    for (const tweet of tweets) {
      try {
        const analysis = await this.analyzeTweetFormat({
          text: tweet.text,
          likes: tweet.likes || 0,
          views: tweet.views || 0,
          retweets: tweet.reposts || tweet.retweets || 0,
          replies: tweet.replies || 0
        });
        
        results.set(tweet.tweet_id, analysis);
        analyzed++;
        
        // Rate limiting: 500ms between requests
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error: any) {
        console.error(`[FORMAT_ANALYZER] ⚠️ Failed to analyze tweet ${tweet.tweet_id}: ${error.message}`);
        failed++;
      }
      
      // Progress logging
      if ((analyzed + failed) % 5 === 0) {
        console.log(`[FORMAT_ANALYZER] Progress: ${analyzed}/${tweets.length} analyzed, ${failed} failed`);
      }
    }
    
    console.log(`[FORMAT_ANALYZER] ✅ Batch complete: ${analyzed} analyzed, ${failed} failed`);
    
    return results;
  }
  
  /**
   * Fallback: Basic format analysis without OpenAI
   */
  private basicFormatAnalysis(text: string): FormatAnalysis {
    const visualStructure: string[] = [];
    
    // Detect patterns
    if (text.includes('\n')) visualStructure.push('line_breaks');
    if (text.includes('•') || text.includes('●')) visualStructure.push('bullets');
    if (/\d+\)/.test(text)) visualStructure.push('numbered_list');
    if (/[A-Z]{3,}/.test(text)) visualStructure.push('caps_emphasis');
    
    const emojiCount = (text.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}]/gu) || []).length;
    const emojiStrategy = emojiCount === 0 ? 'none' : emojiCount === 1 ? 'strategic_one' : 'multiple';
    
    const length = text.length;
    const lengthCategory = length < 100 ? 'ultra_short' : 
                          length < 180 ? 'short' : 
                          length < 250 ? 'medium' : 'long';
    
    // Detect hook
    let hookType: FormatAnalysis['hookType'] = 'statement';
    if (/^(what|why|how|when|where)/i.test(text) || text.startsWith('?')) hookType = 'question';
    else if (/^\d+/.test(text)) hookType = 'data';
    else if (/^(breaking|new|just in)/i.test(text)) hookType = 'news';
    
    return {
      hookType,
      visualStructure: visualStructure.length > 0 ? visualStructure : ['plain_text'],
      emojiStrategy,
      lengthCategory,
      whyItWorks: 'Basic pattern detection (OpenAI analysis failed)',
      patternStrength: 5,
      keyTakeaways: []
    };
  }
  
  /**
   * Get aggregated insights from analyzed tweets
   */
  async getPatternInsights(options: {
    minViews?: number;
    minStrength?: number;
    category?: string;
    limit?: number;
  } = {}): Promise<any[]> {
    const {
      minViews = 50000,
      minStrength = 7,
      category = 'health',
      limit = 10
    } = options;
    
    const supabase = getSupabaseClient();
    
    const { data } = await supabase
      .from('viral_tweet_library')
      .select('hook_type, formatting_patterns, why_it_works, pattern_strength, engagement_rate')
      .gte('views', minViews)
      .gte('pattern_strength', minStrength)
      .eq('topic_category', category)
      .order('engagement_rate', { ascending: false })
      .limit(limit);
    
    return data || [];
  }
  
  /**
   * Get format examples for AI prompt
   */
  async getFormattingExamples(count: number = 3): Promise<string> {
    const insights = await this.getPatternInsights({ limit: count });
    
    if (insights.length === 0) {
      return 'No viral examples analyzed yet. Run peer scraper first.';
    }
    
    return insights.map((insight, i) => `
EXAMPLE ${i + 1}:
Hook: ${insight.hook_type}
Structure: ${insight.formatting_patterns?.join(', ') || 'plain'}
Why it worked: ${insight.why_it_works}
Engagement: ${(insight.engagement_rate * 100).toFixed(1)}%
    `.trim()).join('\n\n');
  }
}

/**
 * Helper: Get singleton instance
 */
export const getFormatAnalyzer = () => ViralFormatAnalyzer.getInstance();

