/**
 * PubMed Research Fetcher
 * Uses NCBI E-utils to fetch and cache latest health AI research
 */

import { supabase } from '../utils/supabaseClient.js';

interface PubMedArticle {
  id: string;
  title: string;
  url: string;
  source: string;
  published_date: string;
  authors?: string;
  abstract?: string;
}

export class PubMedFetcher {
  private readonly baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  private readonly searchQuery = 'AI AND healthcare AND (artificial intelligence OR machine learning)';
  private readonly maxResults = 40;
  private readonly cacheHours = 6;

  async fetchLatestResearch(): Promise<void> {
    try {
      console.log('🔬 Fetching latest PubMed research...');
      
      // Check if we need to update cache
      if (!(await this.shouldUpdateCache())) {
        console.log('🔬 PubMed cache is recent, skipping update');
        return;
      }

      // Step 1: Search for article IDs
      const articleIds = await this.searchArticles();
      
      if (articleIds.length === 0) {
        console.log('🔬 No articles found');
        return;
      }

      // Step 2: Get article summaries
      const articles = await this.getArticleSummaries(articleIds);
      
      // Step 3: Cache articles
      await this.cacheArticles(articles);
      
      console.log(`🔬 Cached ${articles.length} new PubMed articles`);

    } catch (error) {
      console.error('🔬 PubMed fetch error:', error);
    }
  }

  private async shouldUpdateCache(): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('news_cache')
        .select('cached_at')
        .eq('source', 'PubMed')
        .order('cached_at', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) {
        return true; // No cache exists
      }

      const lastUpdate = new Date(data[0].cached_at);
      const hoursAgo = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
      
      return hoursAgo >= this.cacheHours;

    } catch (error) {
      console.log('🔬 Error checking cache age:', error);
      return true; // Update on error
    }
  }

  private async searchArticles(): Promise<string[]> {
    try {
      const searchUrl = `${this.baseUrl}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(this.searchQuery)}&retmax=${this.maxResults}&sort=date&retmode=json`;
      
      const response = await fetch(searchUrl);
      
      if (!response.ok) {
        throw new Error(`PubMed search failed: ${response.status}`);
      }

      const data = await response.json();
      return data.esearchresult?.idlist || [];

    } catch (error) {
      console.error('🔬 PubMed search error:', error);
      return [];
    }
  }

  private async getArticleSummaries(articleIds: string[]): Promise<PubMedArticle[]> {
    if (articleIds.length === 0) return [];

    try {
      const summaryUrl = `${this.baseUrl}/esummary.fcgi?db=pubmed&id=${articleIds.join(',')}&retmode=json`;
      
      const response = await fetch(summaryUrl);
      
      if (!response.ok) {
        throw new Error(`PubMed summary failed: ${response.status}`);
      }

      const data = await response.json();
      const articles: PubMedArticle[] = [];

      for (const id of articleIds) {
        const articleData = data.result?.[id];
        
        if (articleData && articleData.title) {
          const article: PubMedArticle = {
            id: id,
            title: this.cleanTitle(articleData.title),
            url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
            source: 'PubMed',
            published_date: this.parseDate(articleData.pubdate),
            authors: this.extractAuthors(articleData.authors),
            abstract: articleData.abstract || undefined
          };
          
          articles.push(article);
        }
      }

      return articles;

    } catch (error) {
      console.error('🔬 PubMed summary error:', error);
      return [];
    }
  }

  private cleanTitle(title: string): string {
    // Remove HTML tags and clean up title
    return title
      .replace(/<[^>]*>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  private parseDate(pubdate: string): string {
    try {
      // PubMed dates come in various formats
      if (!pubdate) return new Date().toISOString();
      
      // Try to parse the date
      const date = new Date(pubdate);
      if (isNaN(date.getTime())) {
        // Fallback to current date if parsing fails
        return new Date().toISOString();
      }
      
      return date.toISOString();
    } catch (error) {
      return new Date().toISOString();
    }
  }

  private extractAuthors(authors: any[]): string {
    if (!Array.isArray(authors) || authors.length === 0) {
      return 'Unknown';
    }

    try {
      const authorNames = authors
        .slice(0, 3) // Take first 3 authors
        .map(author => author.name || 'Unknown')
        .filter(name => name !== 'Unknown');

      if (authorNames.length === 0) return 'Unknown';
      if (authorNames.length === 1) return authorNames[0];
      if (authorNames.length <= 3) return authorNames.join(', ');
      
      return `${authorNames.slice(0, 2).join(', ')} et al.`;
    } catch (error) {
      return 'Unknown';
    }
  }

  private async cacheArticles(articles: PubMedArticle[]): Promise<void> {
    if (articles.length === 0) return;

    try {
      // Convert articles to news_cache format
      const cacheEntries = articles.map(article => ({
        title: article.title,
        url: article.url,
        source: article.source,
        content: article.abstract || article.title,
        cached_at: new Date().toISOString(),
        metadata: {
          id: article.id,
          authors: article.authors,
          published_date: article.published_date
        }
      }));

      // Insert into cache
      const { error } = await supabase
        .from('news_cache')
        .insert(cacheEntries);

      if (error) {
        console.error('🔬 Error caching articles:', error);
      }

    } catch (error) {
      console.error('🔬 Cache insertion error:', error);
    }
  }

  async getRandomResearchInsight(): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('news_cache')
        .select('title, url')
        .eq('source', 'PubMed')
        .order('cached_at', { ascending: false })
        .limit(20);

      if (error || !data || data.length === 0) {
        return null;
      }

      const randomArticle = data[Math.floor(Math.random() * data.length)];
      return `Latest research: "${randomArticle.title}" ${randomArticle.url}`;

    } catch (error) {
      console.error('🔬 Error getting research insight:', error);
      return null;
    }
  }

  async getCachedResearchCount(): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('news_cache')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'PubMed');

      return count || 0;
    } catch (error) {
      return 0;
    }
  }
}

// Export singleton instance
export const pubmedFetcher = new PubMedFetcher(); 