/**
 * 🔥 DATA-DRIVEN VIRAL FORMULAS SYSTEM
 * 
 * Instead of hardcoded formulas, this system:
 * 1. Learns from actual successful posts (your data)
 * 2. Extracts patterns from viral replies (10K-100K views)
 * 3. Uses Visual Intelligence to analyze what works
 * 4. Integrates with existing learning systems
 * 5. Evolves formulas based on performance
 * 
 * MUCH BETTER than static formulas - learns what actually works for YOUR account
 */

import { getSupabaseClient } from '../db';
import { log } from '../lib/logger';

export interface LearnedViralFormula {
  id: string;
  name: string;
  structure: string;
  example: string;
  performance: {
    avgViews: number;
    avgLikes: number;
    avgEngagementRate: number;
    followerConversion: number; // Followers per 1000 views
    sampleSize: number;
    confidence: number; // 0-1
  };
  bestForGenerators: string[];
  extractedFrom: 'own_posts' | 'viral_replies' | 'competitor_analysis' | 'vi_analysis';
  lastUpdated: Date;
}

export class DataDrivenViralFormulas {
  private static instance: DataDrivenViralFormulas;
  private supabase = getSupabaseClient();
  private cache: LearnedViralFormula[] = [];
  private cacheExpiry: Date | null = null;
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  private constructor() {}

  public static getInstance(): DataDrivenViralFormulas {
    if (!DataDrivenViralFormulas.instance) {
      DataDrivenViralFormulas.instance = new DataDrivenViralFormulas();
    }
    return DataDrivenViralFormulas.instance;
  }

  /**
   * 🎯 Get viral formulas for a generator (learned from actual data)
   */
  async getViralFormulasForGenerator(generatorName: string): Promise<LearnedViralFormula[]> {
    // Check cache
    if (this.cache.length > 0 && this.cacheExpiry && new Date() < this.cacheExpiry) {
      return this.filterForGenerator(this.cache, generatorName);
    }

    console.log('[VIRAL_FORMULAS] 🔍 Learning viral formulas from actual performance data...');

    // Learn from multiple sources
    const formulas: LearnedViralFormula[] = [];

    // 1. Learn from YOUR successful posts
    formulas.push(...await this.learnFromOwnPosts());

    // 2. Learn from viral replies (10K-100K views)
    formulas.push(...await this.learnFromViralReplies());

    // 3. Learn from Visual Intelligence analysis
    formulas.push(...await this.learnFromVIAnalysis());

    // 4. Learn from competitor analysis
    formulas.push(...await this.learnFromCompetitors());

    // Sort by performance (best first)
    formulas.sort((a, b) => {
      const aScore = (a.performance.avgEngagementRate * 0.4) + (a.performance.followerConversion * 0.6);
      const bScore = (b.performance.avgEngagementRate * 0.4) + (b.performance.followerConversion * 0.6);
      return bScore - aScore;
    });

    // Cache results
    this.cache = formulas;
    this.cacheExpiry = new Date(Date.now() + this.CACHE_TTL_MS);

    console.log(`[VIRAL_FORMULAS] ✅ Learned ${formulas.length} viral formulas from data`);

    return this.filterForGenerator(formulas, generatorName);
  }

  /**
   * 📊 Learn from YOUR successful posts
   */
  private async learnFromOwnPosts(): Promise<LearnedViralFormula[]> {
    console.log('[VIRAL_FORMULAS] 📊 Learning from your successful posts...');

    try {
      // Get posts with high engagement (2%+ engagement rate OR 5K+ views)
      const { data: successfulPosts, error } = await this.supabase
        .from('content_metadata')
        .select(`
          decision_id,
          content,
          generator_used,
          actual_views,
          actual_likes,
          actual_engagement_rate,
          actual_followers_gained,
          hook_type,
          angle,
          tone,
          format_strategy
        `)
        .or('actual_engagement_rate.gte.0.02,actual_views.gte.5000')
        .not('content', 'is', null)
        .order('actual_views', { ascending: false })
        .limit(50); // Top 50 successful posts

      if (error || !successfulPosts || successfulPosts.length === 0) {
        console.log('[VIRAL_FORMULAS] ⚠️ No successful posts found yet');
        return [];
      }

      // Extract patterns using AI
      const formulas = await this.extractFormulasFromPosts(successfulPosts, 'own_posts');

      console.log(`[VIRAL_FORMULAS] ✅ Extracted ${formulas.length} formulas from your posts`);
      return formulas;

    } catch (error: any) {
      console.error('[VIRAL_FORMULAS] ❌ Error learning from own posts:', error.message);
      return [];
    }
  }

  /**
   * 🔥 Learn from viral replies (10K-100K views)
   */
  private async learnFromViralReplies(): Promise<LearnedViralFormula[]> {
    console.log('[VIRAL_FORMULAS] 🔥 Learning from viral replies (10K-100K views)...');

    try {
      // Get viral replies from reply_metrics table
      const { data: viralReplies, error } = await this.supabase
        .from('reply_metrics')
        .select(`
          reply_id,
          content,
          views,
          likes,
          engagement_rate,
          followers_gained,
          strategy,
          hook_type
        `)
        .gte('views', 10000) // 10K+ views = viral
        .not('content', 'is', null)
        .order('views', { ascending: false })
        .limit(30); // Top 30 viral replies

      if (error || !viralReplies || viralReplies.length === 0) {
        console.log('[VIRAL_FORMULAS] ⚠️ No viral replies found');
        return [];
      }

      // Extract patterns from viral replies
      const formulas = await this.extractFormulasFromReplies(viralReplies, 'viral_replies');

      console.log(`[VIRAL_FORMULAS] ✅ Extracted ${formulas.length} formulas from viral replies`);
      return formulas;

    } catch (error: any) {
      console.error('[VIRAL_FORMULAS] ❌ Error learning from viral replies:', error.message);
      return [];
    }
  }

  /**
   * 🧠 Learn from Visual Intelligence analysis
   */
  private async learnFromVIAnalysis(): Promise<LearnedViralFormula[]> {
    console.log('[VIRAL_FORMULAS] 🧠 Learning from Visual Intelligence analysis...');

    try {
      // Get high-performing tweets analyzed by VI
      const { data: viTweets, error } = await this.supabase
        .from('vi_tweets')
        .select(`
          tweet_id,
          content,
          engagement_rate,
          hook_type,
          visual_formatting,
          generator_match
        `)
        .gte('engagement_rate', 0.02) // 2%+ engagement
        .not('content', 'is', null)
        .order('engagement_rate', { ascending: false })
        .limit(30);

      if (error || !viTweets || viTweets.length === 0) {
        console.log('[VIRAL_FORMULAS] ⚠️ No VI analysis data found');
        return [];
      }

      // Extract patterns from VI analysis
      const formulas = await this.extractFormulasFromVI(viTweets, 'vi_analysis');

      console.log(`[VIRAL_FORMULAS] ✅ Extracted ${formulas.length} formulas from VI analysis`);
      return formulas;

    } catch (error: any) {
      console.error('[VIRAL_FORMULAS] ❌ Error learning from VI:', error.message);
      return [];
    }
  }

  /**
   * 🔍 Learn from competitor analysis
   */
  private async learnFromCompetitors(): Promise<LearnedViralFormula[]> {
    console.log('[VIRAL_FORMULAS] 🔍 Learning from competitor analysis...');

    try {
      // Get high-performing competitor posts
      const { data: competitorPosts, error } = await this.supabase
        .from('peer_posts')
        .select(`
          tweet_id,
          text,
          engagement_rate,
          normalized_engagement,
          hook_type,
          topic
        `)
        .gte('engagement_rate', 0.02) // 2%+ engagement
        .not('text', 'is', null)
        .order('normalized_engagement', { ascending: false })
        .limit(30);

      if (error || !competitorPosts || competitorPosts.length === 0) {
        console.log('[VIRAL_FORMULAS] ⚠️ No competitor data found');
        return [];
      }

      // Extract patterns from competitors
      const formulas = await this.extractFormulasFromCompetitors(competitorPosts, 'competitor_analysis');

      console.log(`[VIRAL_FORMULAS] ✅ Extracted ${formulas.length} formulas from competitors`);
      return formulas;

    } catch (error: any) {
      console.error('[VIRAL_FORMULAS] ❌ Error learning from competitors:', error.message);
      return [];
    }
  }

  /**
   * 🤖 Extract formulas from posts using AI
   */
  private async extractFormulasFromPosts(
    posts: any[],
    source: 'own_posts'
  ): Promise<LearnedViralFormula[]> {
    const { createBudgetedChatCompletion } = await import('../services/openaiBudgetedClient');

    const prompt = `Analyze these successful Twitter posts and extract reusable viral formulas.

SUCCESSFUL POSTS:
${JSON.stringify(posts.slice(0, 20).map(p => ({
  content: p.content?.substring(0, 200),
  generator: p.generator_used,
  views: p.actual_views,
  likes: p.actual_likes,
  engagement_rate: p.actual_engagement_rate,
  followers_gained: p.actual_followers_gained,
  hook_type: p.hook_type,
  angle: p.angle
})), null, 2)}

TASK: Extract 5-10 reusable viral formulas that explain why these posts succeeded.

For each formula, provide:
1. Name (descriptive)
2. Structure (template with placeholders like [Institution], [stat], etc.)
3. Example (actual example from the data)
4. Performance metrics (avg views, likes, engagement rate, follower conversion)
5. Best for generators (which generators this works for)

Return JSON:
{
  "formulas": [
    {
      "name": "Formula name",
      "structure": "Template structure with [placeholders]",
      "example": "Actual example from data",
      "avgViews": 5000,
      "avgLikes": 50,
      "avgEngagementRate": 0.025,
      "followerConversion": 0.01,
      "sampleSize": 5,
      "bestForGenerators": ["generator1", "generator2"]
    }
  ]
}`;

    try {
      const response = await createBudgetedChatCompletion({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      }, { purpose: 'viral_formula_extraction' });

      const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
      const formulas = parsed.formulas || [];

      return formulas.map((f: any, i: number) => ({
        id: `own_${source}_${i}`,
        name: f.name,
        structure: f.structure,
        example: f.example,
        performance: {
          avgViews: f.avgViews || 0,
          avgLikes: f.avgLikes || 0,
          avgEngagementRate: f.avgEngagementRate || 0,
          followerConversion: f.followerConversion || 0,
          sampleSize: f.sampleSize || 1,
          confidence: Math.min(0.95, (f.sampleSize || 1) / 10)
        },
        bestForGenerators: f.bestForGenerators || [],
        extractedFrom: source,
        lastUpdated: new Date()
      }));

    } catch (error: any) {
      console.error('[VIRAL_FORMULAS] ❌ AI extraction failed:', error.message);
      return [];
    }
  }

  /**
   * 🤖 Extract formulas from viral replies
   */
  private async extractFormulasFromReplies(
    replies: any[],
    source: 'viral_replies'
  ): Promise<LearnedViralFormula[]> {
    const { createBudgetedChatCompletion } = await import('../services/openaiBudgetedClient');

    const prompt = `Analyze these viral replies (10K-100K views) and extract reusable viral formulas.

VIRAL REPLIES:
${JSON.stringify(replies.slice(0, 20).map(r => ({
  content: r.content?.substring(0, 200),
  views: r.views,
  likes: r.likes,
  engagement_rate: r.engagement_rate,
  followers_gained: r.followers_gained,
  strategy: r.strategy,
  hook_type: r.hook_type
})), null, 2)}

TASK: Extract 5-10 reusable viral formulas that explain why these replies went viral.

These replies get 10K-100K views - extract the patterns that make them work.

Return JSON:
{
  "formulas": [
    {
      "name": "Formula name",
      "structure": "Template structure",
      "example": "Actual example",
      "avgViews": 50000,
      "avgLikes": 200,
      "avgEngagementRate": 0.04,
      "followerConversion": 0.02,
      "sampleSize": 10,
      "bestForGenerators": ["all"]
    }
  ]
}`;

    try {
      const response = await createBudgetedChatCompletion({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      }, { purpose: 'viral_formula_extraction' });

      const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
      const formulas = parsed.formulas || [];

      return formulas.map((f: any, i: number) => ({
        id: `viral_reply_${i}`,
        name: f.name,
        structure: f.structure,
        example: f.example,
        performance: {
          avgViews: f.avgViews || 0,
          avgLikes: f.avgLikes || 0,
          avgEngagementRate: f.avgEngagementRate || 0,
          followerConversion: f.followerConversion || 0,
          sampleSize: f.sampleSize || 1,
          confidence: Math.min(0.95, (f.sampleSize || 1) / 10)
        },
        bestForGenerators: f.bestForGenerators || ['all'],
        extractedFrom: source,
        lastUpdated: new Date()
      }));

    } catch (error: any) {
      console.error('[VIRAL_FORMULAS] ❌ AI extraction failed:', error.message);
      return [];
    }
  }

  /**
   * 🤖 Extract formulas from VI analysis
   */
  private async extractFormulasFromVI(
    tweets: any[],
    source: 'vi_analysis'
  ): Promise<LearnedViralFormula[]> {
    // Use VI's visual formatting patterns
    const formulas: LearnedViralFormula[] = [];

    // Group by visual formatting patterns
    const formatGroups = new Map<string, any[]>();
    tweets.forEach(t => {
      const format = t.visual_formatting?.format_type || 'standard';
      if (!formatGroups.has(format)) {
        formatGroups.set(format, []);
      }
      formatGroups.get(format)!.push(t);
    });

    // Create formulas from high-performing formats
    formatGroups.forEach((group, format) => {
      if (group.length >= 3) {
        const avgER = group.reduce((sum, t) => sum + (t.engagement_rate || 0), 0) / group.length;
        if (avgER >= 0.02) {
          formulas.push({
            id: `vi_${format}_${Date.now()}`,
            name: `${format.toUpperCase()} Format Pattern`,
            structure: `Use ${format} visual formatting: [content]`,
            example: group[0].content?.substring(0, 200) || '',
            performance: {
              avgViews: 0,
              avgLikes: 0,
              avgEngagementRate: avgER,
              followerConversion: 0,
              sampleSize: group.length,
              confidence: Math.min(0.9, group.length / 10)
            },
            bestForGenerators: group.map(t => t.generator_match).filter(Boolean),
            extractedFrom: source,
            lastUpdated: new Date()
          });
        }
      }
    });

    return formulas;
  }

  /**
   * 🤖 Extract formulas from competitors
   */
  private async extractFormulasFromCompetitors(
    posts: any[],
    source: 'competitor_analysis'
  ): Promise<LearnedViralFormula[]> {
    // Similar to extractFormulasFromPosts but for competitor data
    return this.extractFormulasFromPosts(posts, 'competitor_analysis');
  }

  /**
   * 🎯 Filter formulas for specific generator
   */
  private filterForGenerator(
    formulas: LearnedViralFormula[],
    generatorName: string
  ): LearnedViralFormula[] {
    return formulas.filter(f => 
      f.bestForGenerators.includes('all') || 
      f.bestForGenerators.includes(generatorName)
    );
  }

  /**
   * 📊 Get top performing formulas
   */
  async getTopFormulas(limit: number = 10): Promise<LearnedViralFormula[]> {
    const allFormulas = await this.getViralFormulasForGenerator('all');
    return allFormulas
      .sort((a, b) => {
        const aScore = (a.performance.avgEngagementRate * 0.4) + (a.performance.followerConversion * 0.6);
        const bScore = (b.performance.avgEngagementRate * 0.4) + (b.performance.followerConversion * 0.6);
        return bScore - aScore;
      })
      .slice(0, limit);
  }

  /**
   * 🔄 Force refresh (clear cache)
   */
  clearCache(): void {
    this.cache = [];
    this.cacheExpiry = null;
  }
}

export const dataDrivenViralFormulas = DataDrivenViralFormulas.getInstance();

