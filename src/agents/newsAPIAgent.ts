interface GuardianArticle {
  id: string;
  webTitle: string;
  webUrl: string;
  fields?: {
    bodyText?: string;
    standfirst?: string;
    thumbnail?: string;
  };
  tags?: Array<{
    id: string;
    webTitle: string;
  }>;
  webPublicationDate: string;
}

interface GuardianResponse {
  response: {
    status: string;
    results: GuardianArticle[];
    total: number;
  };
}

export class NewsAPIAgent {
  private static instance: NewsAPIAgent;
  private readonly GUARDIAN_API_URL = 'https://content.guardianapis.com/search';
  private readonly API_KEY = process.env.GUARDIAN_API_KEY;

  private constructor() {
    if (!this.API_KEY) {
      console.log('⚠️ Guardian API key not set - news features will be limited');
    }
  }

  public static getInstance(): NewsAPIAgent {
    if (!NewsAPIAgent.instance) {
      NewsAPIAgent.instance = new NewsAPIAgent();
    }
    return NewsAPIAgent.instance;
  }

  async getBreakingNews(): Promise<any[]> {
    if (!this.API_KEY) {
      console.log('📰 Guardian API key missing - returning empty results');
      return [];
    }

    try {
      console.log('📰 Fetching breaking news from Guardian API...');
      
      const url = new URL(this.GUARDIAN_API_URL);
      url.searchParams.append('api-key', this.API_KEY);
      url.searchParams.append('section', 'world|politics|business');
      url.searchParams.append('show-fields', 'bodyText,standfirst,thumbnail');
      url.searchParams.append('show-tags', 'keyword');
      url.searchParams.append('page-size', '10');
      url.searchParams.append('order-by', 'newest');

      const response = await fetch(url.toString());
      const data: GuardianResponse = await response.json();

      if (data.response.status === 'ok') {
        console.log(`✅ Retrieved ${data.response.results.length} breaking news articles`);
        return this.formatArticles(data.response.results);
      }

      return [];
    } catch (error) {
      console.error('❌ Error fetching breaking news:', error);
      return [];
    }
  }

  async getHealthTechNews(): Promise<any[]> {
    if (!this.API_KEY) {
      console.log('📰 Guardian API key missing - returning empty results');
      return [];
    }

    try {
      console.log('📰 Fetching health & tech news from Guardian API...');
      
      const url = new URL(this.GUARDIAN_API_URL);
      url.searchParams.append('api-key', this.API_KEY);
      url.searchParams.append('q', 'health OR technology OR AI OR "artificial intelligence" OR medical OR nutrition OR fitness');
      url.searchParams.append('section', 'technology|society|science');
      url.searchParams.append('show-fields', 'bodyText,standfirst,thumbnail');
      url.searchParams.append('show-tags', 'keyword');
      url.searchParams.append('page-size', '15');
      url.searchParams.append('order-by', 'newest');

      const response = await fetch(url.toString());
      const data: GuardianResponse = await response.json();

      if (data.response.status === 'ok') {
        console.log(`✅ Retrieved ${data.response.results.length} health/tech articles`);
        return this.formatArticles(data.response.results);
      }

      return [];
    } catch (error) {
      console.error('❌ Error fetching health/tech news:', error);
      return [];
    }
  }

  async searchNews(query: string): Promise<any[]> {
    if (!this.API_KEY) {
      console.log('📰 Guardian API key missing - returning empty results');
      return [];
    }

    try {
      console.log(`📰 Searching Guardian for: "${query}"`);
      
      const url = new URL(this.GUARDIAN_API_URL);
      url.searchParams.append('api-key', this.API_KEY);
      url.searchParams.append('q', query);
      url.searchParams.append('show-fields', 'bodyText,standfirst,thumbnail');
      url.searchParams.append('show-tags', 'keyword');
      url.searchParams.append('page-size', '8');
      url.searchParams.append('order-by', 'relevance');

      const response = await fetch(url.toString());
      const data: GuardianResponse = await response.json();

      if (data.response.status === 'ok') {
        console.log(`✅ Found ${data.response.results.length} articles for "${query}"`);
        return this.formatArticles(data.response.results);
      }

      return [];
    } catch (error) {
      console.error(`❌ Error searching news for "${query}":`, error);
      return [];
    }
  }

  private formatArticles(articles: GuardianArticle[]): any[] {
    return articles.map(article => ({
      id: article.id,
      title: article.webTitle,
      url: article.webUrl,
      content: article.fields?.standfirst || article.fields?.bodyText?.substring(0, 200) || '',
      thumbnail: article.fields?.thumbnail || null,
      published: article.webPublicationDate,
      source: 'The Guardian',
      tags: article.tags?.map(tag => tag.webTitle) || [],
      category: this.categorizeArticle(article.webTitle, article.fields?.standfirst || '')
    }));
  }

  private categorizeArticle(title: string, standfirst: string): string {
    const text = `${title} ${standfirst}`.toLowerCase();
    
    if (text.match(/health|medical|nutrition|fitness|diet|wellness|mental|sleep/)) {
      return 'health';
    }
    if (text.match(/ai|artificial intelligence|technology|tech|digital|software|app/)) {
      return 'technology';
    }
    if (text.match(/science|research|study|discovery|breakthrough/)) {
      return 'science';
    }
    if (text.match(/business|market|economy|financial|investment/)) {
      return 'business';
    }
    
    return 'general';
  }
} 