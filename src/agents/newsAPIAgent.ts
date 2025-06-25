import axios from 'axios';
import { supabaseClient } from '../utils/supabaseClient';

interface NewsAPIResponse {
  status: string;
  totalResults: number;
  articles: NewsAPIArticle[];
}

interface NewsAPIArticle {
  source: {
    id: string | null;
    name: string;
  };
  author: string | null;
  title: string;
  description: string;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string;
}

interface ProcessedNewsArticle {
  title: string;
  description: string;
  url: string;
  imageUrl: string | null;
  source: string;
  author: string | null;
  publishedAt: string;
  content: string;
  credibilityScore: number;
  healthTechRelevance: number;
  category: 'breakthrough' | 'funding' | 'regulatory' | 'research' | 'product' | 'industry';
  apiSource: 'newsapi' | 'guardian' | 'fallback';
}

interface GuardianResponse {
  response: {
    status: string;
    results: GuardianArticle[];
  };
}

interface GuardianArticle {
  id: string;
  webTitle: string;
  webUrl: string;
  webPublicationDate: string;
  fields?: {
    bodyText?: string;
    thumbnail?: string;
  };
}

export class NewsAPIAgent {
  private readonly newsApiKey: string;
  private readonly guardianApiKey: string;
  
  private readonly healthTechKeywords = [
    'AI healthcare',
    'digital health',
    'medical AI',
    'health technology',
    'digital therapeutics',
    'telemedicine',
    'wearable health',
    'healthcare innovation',
    'medical device',
    'health tech startup',
    'FDA approval AI',
    'digital medicine',
    'health app',
    'medical breakthrough',
    'healthcare funding'
  ];

  private readonly credibleSources = {
    'Reuters': 95,
    'Associated Press': 94,
    'BBC News': 93,
    'CNN': 88,
    'TechCrunch': 85,
    'Wired': 84,
    'The New York Times': 92,
    'Wall Street Journal': 91,
    'Forbes': 83,
    'MIT Technology Review': 94,
    'Nature': 98,
    'Science Daily': 95,
    'STAT': 90,
    'Healthcare IT News': 88,
    'MobiHealthNews': 87,
    'VentureBeat': 82,
    'Fierce Healthcare': 86,
    'Modern Healthcare': 87,
    'The Guardian': 90,
    'Financial Times': 89
  };

  private recentlyUsedArticles: Set<string> = new Set();
  private maxRecentArticles = 100;
  
  // Rate limiting trackers for available APIs only
  private apiCallCounts = {
    newsapi: 0,
    guardian: 0
  };
  
  private lastResetTime = Date.now();
  private readonly dailyLimits = {
    newsapi: 90, // Keep safely below 100/day limit
    guardian: 450 // Keep safely below 500/day limit
  };

  constructor() {
    this.newsApiKey = process.env.NEWS_API_KEY || '';
    this.guardianApiKey = process.env.GUARDIAN_API_KEY || '';
    
    console.log('🔌 News APIs configured:', {
      newsapi: !!this.newsApiKey,
      guardian: !!this.guardianApiKey
    });
  }

  /**
   * Smart dual-source news fetching with automatic failover
   * Uses Guardian API as primary (more reliable) and NewsAPI as backup
   */
  async fetchHealthTechNews(maxArticles: number = 20): Promise<ProcessedNewsArticle[]> {
    console.log('📰 Starting dual-source news aggregation...');
    
    this.resetDailyCountsIfNeeded();
    const allArticles: ProcessedNewsArticle[] = [];
    const articlesPerSource = Math.ceil(maxArticles / 2);

    // Try Guardian API first (most reliable, 500/day limit)
    if (this.canMakeRequest('guardian')) {
      try {
        console.log('📡 Fetching from Guardian API (primary)...');
        const guardianArticles = await this.fetchFromGuardian(articlesPerSource);
        allArticles.push(...guardianArticles);
        console.log(`✅ Guardian: ${guardianArticles.length} articles fetched`);
      } catch (error) {
        console.log('⚠️ Guardian API failed:', error instanceof Error ? error.message : 'Unknown error');
      }
    } else {
      console.log('⏰ Guardian API rate limit reached');
    }

    // Use NewsAPI if we need more articles or Guardian failed
    if (allArticles.length < maxArticles && this.canMakeRequest('newsapi')) {
      try {
        console.log('📡 Fetching from NewsAPI (backup)...');
        const remaining = maxArticles - allArticles.length;
        const newsApiArticles = await this.fetchFromNewsAPI(remaining);
        allArticles.push(...newsApiArticles);
        console.log(`✅ NewsAPI: ${newsApiArticles.length} articles fetched`);
      } catch (error) {
        console.log('⚠️ NewsAPI failed:', error instanceof Error ? error.message : 'Unknown error');
      }
    } else if (allArticles.length >= maxArticles) {
      console.log('✅ Sufficient articles from Guardian, skipping NewsAPI');
    } else {
      console.log('⏰ NewsAPI rate limit reached');
    }

    if (allArticles.length === 0) {
      console.log('⚠️ All APIs failed, using fallback content');
      return this.getFallbackNews();
    }

    // Process and optimize articles
    const processedArticles = this.removeDuplicates(allArticles);
    const rankedArticles = this.rankByRelevance(processedArticles);
    const finalArticles = rankedArticles.slice(0, maxArticles);

    // Store in database for analytics
    try {
      await this.storeArticlesInDatabase(finalArticles);
    } catch (error) {
      console.log('⚠️ Database storage failed:', error);
    }

    console.log(`🎯 Returning ${finalArticles.length} high-quality articles`);
    return finalArticles;
  }

  private async fetchFromGuardian(limit: number): Promise<ProcessedNewsArticle[]> {
    if (!this.guardianApiKey) {
      console.log('❌ Guardian API key not configured');
      return [];
    }

    try {
      this.incrementApiCall('guardian');
      
      // Guardian API search for health tech content
      const response = await axios.get(`https://content.guardianapis.com/search`, {
        params: {
          'api-key': this.guardianApiKey,
          'q': 'healthcare OR "health technology" OR "medical AI" OR "digital health" OR telemedicine',
          'section': 'technology|science|business',
          'page-size': limit,
          'show-fields': 'bodyText,thumbnail',
          'order-by': 'newest'
        },
        timeout: 10000
      });

      if (response.data.response?.status === 'ok') {
        const articles = response.data.response.results || [];
        console.log(`📰 Guardian returned ${articles.length} articles`);
        
        return articles.map((article: GuardianArticle) => ({
          title: article.webTitle,
          description: article.fields?.bodyText?.substring(0, 200) + '...' || article.webTitle,
          url: article.webUrl,
          imageUrl: article.fields?.thumbnail || null,
          source: 'The Guardian',
          author: null,
          publishedAt: article.webPublicationDate,
          content: article.fields?.bodyText || '',
          credibilityScore: this.credibleSources['The Guardian'] || 85,
          healthTechRelevance: this.calculateHealthTechRelevance(article.webTitle, article.fields?.bodyText || ''),
          category: this.categorizeArticle(article.webTitle, article.fields?.bodyText || ''),
          apiSource: 'guardian' as const
        }));
      }
      
      return [];
    } catch (error) {
      console.log('❌ Guardian API error:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  private async fetchFromNewsAPI(limit: number): Promise<ProcessedNewsArticle[]> {
    if (!this.newsApiKey) {
      console.log('❌ NewsAPI key not configured');
      return [];
    }

    try {
      this.incrementApiCall('newsapi');
      
      const response = await axios.get(`https://newsapi.org/v2/everything`, {
        params: {
          apiKey: this.newsApiKey,
          q: 'healthcare technology OR medical AI OR digital health OR telemedicine',
          language: 'en',
          sortBy: 'publishedAt',
          pageSize: limit,
          domains: 'techcrunch.com,wired.com,reuters.com,bbc.com,cnn.com'
        },
        timeout: 10000
      });

      if (response.data.status === 'ok') {
        const articles = response.data.articles || [];
        console.log(`📰 NewsAPI returned ${articles.length} articles`);
        
        return articles.map((article: NewsAPIArticle) => this.processNewsAPIArticle(article));
      }
      
      return [];
    } catch (error: any) {
      // Handle specific error types
      if (error.response?.status === 429) {
        // Rate limited - don't count this as a successful call
        this.apiCallCounts.newsapi = Math.max(0, this.apiCallCounts.newsapi - 1);
        console.log('❌ NewsAPI error: Request failed with status code 429');
        return [];
      }
      
      console.log('❌ NewsAPI error:', error.response?.status 
        ? `Request failed with status code ${error.response.status}`
        : error.message || 'Unknown error');
      return [];
    }
  }

  private processNewsAPIArticle(article: NewsAPIArticle): ProcessedNewsArticle {
    const sourceName = article.source.name;
    const credibilityScore = this.credibleSources[sourceName] || 70;
    
    return {
      title: article.title,
      description: article.description || '',
      url: article.url,
      imageUrl: article.urlToImage,
      source: sourceName,
      author: article.author,
      publishedAt: article.publishedAt,
      content: article.content || '',
      credibilityScore,
      healthTechRelevance: this.calculateHealthTechRelevance(article.title, article.description || ''),
      category: this.categorizeArticle(article.title, article.description || ''),
      apiSource: 'newsapi'
    };
  }

  private calculateHealthTechRelevance(title: string, description: string): number {
    const text = (title + ' ' + description).toLowerCase();
    let score = 0;
    
    for (const keyword of this.healthTechKeywords) {
      if (text.includes(keyword.toLowerCase())) {
        score += 10;
      }
    }
    
    // Boost for AI/ML terms
    if (text.includes('artificial intelligence') || text.includes(' ai ')) score += 15;
    if (text.includes('machine learning') || text.includes(' ml ')) score += 15;
    
    return Math.min(score, 100);
  }

  private categorizeArticle(title: string, description: string): ProcessedNewsArticle['category'] {
    const text = (title + ' ' + description).toLowerCase();
    
    if (text.includes('breakthrough') || text.includes('discovery')) return 'breakthrough';
    if (text.includes('funding') || text.includes('investment') || text.includes('round')) return 'funding';
    if (text.includes('fda') || text.includes('approval') || text.includes('regulation')) return 'regulatory';
    if (text.includes('research') || text.includes('study') || text.includes('trial')) return 'research';
    if (text.includes('product') || text.includes('launch') || text.includes('release')) return 'product';
    
    return 'industry';
  }

  private removeDuplicates(articles: ProcessedNewsArticle[]): ProcessedNewsArticle[] {
    const seen = new Set<string>();
    return articles.filter(article => {
      const key = article.title.toLowerCase().substring(0, 50);
      if (seen.has(key) || this.recentlyUsedArticles.has(article.url)) {
        return false;
      }
      seen.add(key);
      this.recentlyUsedArticles.add(article.url);
      
      // Cleanup old entries
      if (this.recentlyUsedArticles.size > this.maxRecentArticles) {
        const oldEntries = Array.from(this.recentlyUsedArticles).slice(0, 20);
        oldEntries.forEach(entry => this.recentlyUsedArticles.delete(entry));
      }
      
      return true;
    });
  }

  private rankByRelevance(articles: ProcessedNewsArticle[]): ProcessedNewsArticle[] {
    return articles.sort((a, b) => {
      const scoreA = (a.healthTechRelevance * 0.6) + (a.credibilityScore * 0.4);
      const scoreB = (b.healthTechRelevance * 0.6) + (b.credibilityScore * 0.4);
      return scoreB - scoreA;
    });
  }

  private async storeArticlesInDatabase(articles: ProcessedNewsArticle[]): Promise<void> {
         for (const article of articles) {
       try {
         if (supabaseClient.supabase) {
           const { error } = await supabaseClient.supabase
             .from('news_articles')
             .upsert({
               title: article.title,
               url: article.url,
               source: article.source,
               api_source: article.apiSource,
               credibility_score: article.credibilityScore,
               health_tech_relevance: article.healthTechRelevance,
               category: article.category,
               created_at: new Date().toISOString()
             });
           
           if (error) {
             console.log('⚠️ Database error for article:', article.title, error.message);
           }
         }
       } catch (error) {
         // Continue on individual failures
         console.log('⚠️ Failed to store article:', article.title);
       }
     }
  }

  private getFallbackNews(): ProcessedNewsArticle[] {
    return [
      {
        title: 'AI-Powered Healthcare Diagnostics Show 95% Accuracy in Clinical Trials',
        description: 'Revolutionary artificial intelligence system demonstrates unprecedented accuracy in medical diagnosis, potentially transforming patient care worldwide.',
        url: 'https://example.com/ai-healthcare-breakthrough',
        imageUrl: null,
        source: 'Health Tech Today',
        author: 'Research Team',
        publishedAt: new Date().toISOString(),
        content: 'Artificial intelligence continues to revolutionize healthcare with breakthrough diagnostic capabilities.',
        credibilityScore: 85,
        healthTechRelevance: 95,
        category: 'breakthrough',
        apiSource: 'fallback'
      },
      {
        title: 'Digital Health Startups Secure $2.3B in Funding This Quarter',
        description: 'Investment in digital health technology reaches new highs as venture capital firms bet big on healthcare innovation.',
        url: 'https://example.com/digital-health-funding',
        imageUrl: null,
        source: 'MedTech Investor',
        author: 'Financial Analyst',
        publishedAt: new Date().toISOString(),
        content: 'Digital health continues to attract significant investment as the sector matures.',
        credibilityScore: 80,
        healthTechRelevance: 90,
        category: 'funding',
        apiSource: 'fallback'
      }
    ];
  }

  private canMakeRequest(apiName: keyof typeof this.apiCallCounts): boolean {
    return this.apiCallCounts[apiName] < this.dailyLimits[apiName];
  }

  private incrementApiCall(apiName: keyof typeof this.apiCallCounts): void {
    this.apiCallCounts[apiName]++;
    console.log(`📊 ${apiName}: ${this.apiCallCounts[apiName]}/${this.dailyLimits[apiName]} calls today`);
  }

  private resetDailyCountsIfNeeded(): void {
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;
    
    if (now - this.lastResetTime > dayInMs) {
      console.log('🔄 Resetting daily API counters');
      this.apiCallCounts = {
        newsapi: 0,
        guardian: 0
      };
      this.lastResetTime = now;
    }
  }

  // Legacy methods for compatibility
  async fetchBreakingNews(): Promise<ProcessedNewsArticle[]> {
    return this.fetchHealthTechNews(10);
  }

  async getTrendingTopics(): Promise<string[]> {
    const articles = await this.fetchHealthTechNews(20);
    const topics = new Map<string, number>();
    
    articles.forEach(article => {
      this.healthTechKeywords.forEach(keyword => {
        const text = (article.title + ' ' + article.description).toLowerCase();
        if (text.includes(keyword.toLowerCase())) {
          topics.set(keyword, (topics.get(keyword) || 0) + 1);
        }
      });
    });
    
    return Array.from(topics.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic]) => topic);
  }

  async getLatestNews(limit: number = 10): Promise<ProcessedNewsArticle[]> {
    return this.fetchHealthTechNews(limit);
  }
} 