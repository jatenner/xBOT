/**
 * 🎯 NEWS CURATOR SERVICE
 * 
 * Analyzes scraped news using AI:
 * - Extracts topics
 * - Identifies key claims
 * - Verifies credibility
 * - Filters for quality
 * - Creates curated news feed
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { getSupabaseClient } from '../db';

export interface CuratedNews {
  id: string;
  original_tweet_id: string;
  topic: string;
  headline: string;
  key_claim: string;
  source_credibility: 'high' | 'medium' | 'low';
  study_url?: string;
  viral_score: number;
  freshness_score: number;
  trending: boolean;
  used_in_post?: string;
  created_at: string;
}

export class NewsCuratorService {
  private static instance: NewsCuratorService;
  
  private constructor() {}
  
  static getInstance(): NewsCuratorService {
    if (!NewsCuratorService.instance) {
      NewsCuratorService.instance = new NewsCuratorService();
    }
    return NewsCuratorService.instance;
  }

  /**
   * Analyze and curate scraped news
   */
  async analyzeAndCurateNews(): Promise<void> {
    console.log('[NEWS_CURATOR] 🎯 Analyzing scraped news with AI...');
    
    try {
      const supabase = getSupabaseClient();
      
      // Get unanalyzed scraped news (recent, high viral score)
      const { data: scrapedNews } = await supabase
        .from('health_news_scraped')
        .select('*')
        .gte('freshness_score', 60) // Only fresh content
        .gte('viral_score', 100) // Only decent engagement
        .is('analyzed', null) // Not yet analyzed
        .order('viral_score', { ascending: false })
        .limit(20); // Analyze top 20
      
      if (!scrapedNews || scrapedNews.length === 0) {
        console.log('[NEWS_CURATOR] ℹ️ No new news to curate');
        return;
      }
      
      console.log(`[NEWS_CURATOR] 📊 Analyzing ${scrapedNews.length} news items...`);
      
      // Analyze each news item with AI
      for (const news of scrapedNews) {
        try {
          const curatedNews = await this.analyzeNewsWithAI(news);
          
          if (curatedNews) {
            // Store curated news
            await supabase
              .from('health_news_curated')
              .insert([curatedNews as any]);
            
            // Mark as analyzed
            await supabase
              .from('health_news_scraped')
              .update({ analyzed: true })
              .eq('tweet_id', news.tweet_id);
            
            console.log(`[NEWS_CURATOR] ✅ Curated: ${curatedNews.topic} - ${curatedNews.headline}`);
          }
          
        } catch (error: any) {
          console.error(`[NEWS_CURATOR] ❌ Failed to analyze tweet ${news.tweet_id}:`, error.message);
        }
      }
      
      console.log('[NEWS_CURATOR] ✅ News curation completed');
      
    } catch (error: any) {
      console.error('[NEWS_CURATOR] ❌ Curation failed:', error.message);
      throw error;
    }
  }

  /**
   * Analyze news with AI
   */
  private async analyzeNewsWithAI(news: any): Promise<CuratedNews | null> {
    try {
      const prompt = `Analyze this health-related tweet and extract key information:

TWEET:
"${news.tweet_text}"

SOURCE: @${news.author_username} (${news.source_type})
ENGAGEMENT: ${news.likes_count} likes, ${news.retweets_count} retweets
POSTED: ${news.posted_at}

Extract:
1. Main topic (one word: "sleep", "nutrition", "exercise", etc.)
2. Catchy headline (10-15 words, newsworthy)
3. Key claim (the main finding or statement)
4. Source credibility (high/medium/low based on account type and engagement)

Format your response as JSON with fields: topic, headline, key_claim, source_credibility`;

      const response = await createBudgetedChatCompletion({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a health news analyst. Extract structured information from tweets.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 300,
        response_format: { type: 'json_object' }
      }, { purpose: 'news_curation' });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      // Validate analysis
      if (!analysis.topic || !analysis.headline || !analysis.key_claim) {
        console.warn('[NEWS_CURATOR] ⚠️ Incomplete AI analysis, skipping');
        return null;
      }
      
      // Create curated news entry
      const curated: CuratedNews = {
        id: `curated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        original_tweet_id: news.tweet_id,
        topic: String(analysis.topic).toLowerCase(),
        headline: String(analysis.headline),
        key_claim: String(analysis.key_claim),
        source_credibility: this.determineCredibility(news, analysis),
        study_url: news.study_urls?.[0],
        viral_score: news.viral_score,
        freshness_score: news.freshness_score,
        trending: false, // Will be updated by trending service
        created_at: new Date().toISOString()
      };
      
      return curated;
      
    } catch (error: any) {
      console.error('[NEWS_CURATOR] ❌ AI analysis failed:', error.message);
      return null;
    }
  }

  /**
   * Determine source credibility based on tweet patterns and engagement
   */
  private determineCredibility(news: any, analysis: any): 'high' | 'medium' | 'low' {
    const tweetText = String(news.tweet_text || '').toLowerCase();
    const viralScore = news.viral_score;
    const hasStudyUrl = news.study_urls?.length > 0;
    
    // HIGH CREDIBILITY indicators
    const highCredibilityPatterns = [
      'according to', 'sources say', 'officials confirm', 
      'published in', 'peer reviewed', 'clinical trial',
      'breaking news', 'just announced', 'reports'
    ];
    
    const hasHighPattern = highCredibilityPatterns.some(p => tweetText.includes(p));
    
    // News outlet patterns (discovered dynamically)
    if (news.source_type === 'news_outlet') {
      if (hasHighPattern && viralScore > 1000) return 'high';
      if (viralScore > 500) return 'medium';
      return 'low';
    }
    
    // Research patterns (has study URL or citations)
    if (hasStudyUrl && viralScore > 5000) return 'high';
    if (hasStudyUrl && viralScore > 1000) return 'medium';
    
    // High engagement generally indicates quality
    if (viralScore > 10000) return 'high';
    if (viralScore > 3000) return 'medium';
    
    return 'low';
  }

  /**
   * Get curated news for content generation
   */
  async getCuratedNews(params: {
    topic?: string;
    minCredibility?: 'high' | 'medium' | 'low';
    minFreshnessScore?: number;
    unused?: boolean;
    limit?: number;
  }): Promise<CuratedNews[]> {
    const supabase = getSupabaseClient();
    
    let query = supabase
      .from('health_news_curated')
      .select('*');
    
    // Apply filters
    if (params.topic) {
      query = query.eq('topic', params.topic);
    }
    
    if (params.minCredibility) {
      const credibilityOrder = ['low', 'medium', 'high'];
      const minIndex = credibilityOrder.indexOf(params.minCredibility);
      const allowedCredibility = credibilityOrder.slice(minIndex);
      query = query.in('source_credibility', allowedCredibility);
    }
    
    if (params.minFreshnessScore) {
      query = query.gte('freshness_score', params.minFreshnessScore);
    }
    
    if (params.unused) {
      query = query.is('used_in_post', null);
    }
    
    query = query
      .order('viral_score', { ascending: false })
      .limit(params.limit || 10);
    
    const { data } = await query;
    
    return (data || []) as unknown as CuratedNews[];
  }

  /**
   * Mark news as used
   */
  async markNewsAsUsed(newsId: string, postId: string): Promise<void> {
    const supabase = getSupabaseClient();
    
    await supabase
      .from('health_news_curated')
      .update({ used_in_post: postId })
      .eq('id', newsId);
  }
}

export const newsCuratorService = NewsCuratorService.getInstance();

