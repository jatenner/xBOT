/**
 * Smart Image Selection with Semantic Similarity
 * Combines Unsplash + Pexels search and ranks by semantic relevance
 */

import { openaiClient } from './openaiClient.js';
import { supabase } from './supabaseClient.js';

interface ImageCandidate {
  url: string;
  caption: string;
  source: 'unsplash' | 'pexels';
  similarity?: number;
}

interface MediaHistoryEntry {
  url: string;
  caption: string;
  used_at: string;
}

export class SmartImageSelector {
  private unsplashAccessKey: string;
  private pexelsApiKey: string;
  private captionEmbeddingCache = new Map<string, number[]>();

  constructor() {
    this.unsplashAccessKey = process.env.UNSPLASH_ACCESS_KEY || '';
    this.pexelsApiKey = process.env.PEXELS_API_KEY || '';
  }

  async chooseImage(tweetText: string): Promise<string | null> {
    try {
      // Extract keywords from tweet for search
      const searchTerms = this.extractSearchTerms(tweetText);
      
      // Get candidates from both sources
      const candidates = await this.getCandidates(searchTerms);
      
      if (candidates.length === 0) {
        console.log('📷 No image candidates found');
        return null;
      }

      // Get tweet text embedding
      const tweetEmbedding = await openaiClient.embed(tweetText);
      
      // Rank candidates by semantic similarity
      const rankedCandidates = await this.rankBySimilarity(candidates, tweetEmbedding);
      
      // Filter out recently used images
      const availableCandidates = await this.filterUsedImages(rankedCandidates);
      
      if (availableCandidates.length === 0) {
        console.log('📷 All candidates recently used, selecting from top ranked');
        return rankedCandidates[0]?.url || null;
      }

      // Select best available candidate
      const selectedImage = availableCandidates[0];
      
      // Record usage
      await this.recordImageUsage(selectedImage);
      
      console.log(`📷 Selected ${selectedImage.source} image (similarity: ${selectedImage.similarity?.toFixed(3)})`);
      return selectedImage.url;

    } catch (error) {
      console.error('📷 Image selection error:', error);
      return null;
    }
  }

  private extractSearchTerms(tweetText: string): string[] {
    // Extract health tech related keywords
    const healthTechTerms = [
      'AI', 'artificial intelligence', 'machine learning', 'healthcare', 'medical',
      'diagnosis', 'treatment', 'hospital', 'doctor', 'patient', 'research',
      'technology', 'digital health', 'telemedicine', 'biotech', 'pharma',
      'surgery', 'therapy', 'medicine', 'health', 'clinic', 'laboratory'
    ];

    const text = tweetText.toLowerCase();
    const foundTerms = healthTechTerms.filter(term => 
      text.includes(term.toLowerCase())
    );

    // Default fallback terms
    if (foundTerms.length === 0) {
      return ['medical technology', 'healthcare innovation', 'digital health'];
    }

    return foundTerms.slice(0, 3); // Top 3 most relevant terms
  }

  private async getCandidates(searchTerms: string[]): Promise<ImageCandidate[]> {
    const candidates: ImageCandidate[] = [];
    
    // Get from Unsplash (10 results)
    if (this.unsplashAccessKey) {
      for (const term of searchTerms.slice(0, 2)) {
        const unsplashResults = await this.searchUnsplash(term, 5);
        candidates.push(...unsplashResults);
      }
    }

    // Get from Pexels (10 results)
    if (this.pexelsApiKey) {
      for (const term of searchTerms.slice(0, 2)) {
        const pexelsResults = await this.searchPexels(term, 5);
        candidates.push(...pexelsResults);
      }
    }

    return candidates;
  }

  private async searchUnsplash(query: string, count: number): Promise<ImageCandidate[]> {
    try {
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
        {
          headers: {
            'Authorization': `Client-ID ${this.unsplashAccessKey}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Unsplash API error: ${response.status}`);
      }

      const data = await response.json();
      
      return data.results.map((photo: any) => ({
        url: photo.urls.regular,
        caption: photo.alt_description || photo.description || query,
        source: 'unsplash' as const
      }));

    } catch (error) {
      console.log(`📷 Unsplash search failed for "${query}":`, error);
      return [];
    }
  }

  private async searchPexels(query: string, count: number): Promise<ImageCandidate[]> {
    try {
      const response = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
        {
          headers: {
            'Authorization': this.pexelsApiKey
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Pexels API error: ${response.status}`);
      }

      const data = await response.json();
      
      return data.photos.map((photo: any) => ({
        url: photo.src.large,
        caption: photo.alt || query,
        source: 'pexels' as const
      }));

    } catch (error) {
      console.log(`📷 Pexels search failed for "${query}":`, error);
      return [];
    }
  }

  private async rankBySimilarity(candidates: ImageCandidate[], tweetEmbedding: number[]): Promise<ImageCandidate[]> {
    const rankedCandidates: ImageCandidate[] = [];

    for (const candidate of candidates) {
      try {
        // Get or compute caption embedding
        let captionEmbedding = this.captionEmbeddingCache.get(candidate.caption);
        
        if (!captionEmbedding) {
          captionEmbedding = await openaiClient.embed(candidate.caption);
          this.captionEmbeddingCache.set(candidate.caption, captionEmbedding);
        }

        // Calculate cosine similarity
        const similarity = this.cosineSimilarity(tweetEmbedding, captionEmbedding);
        
        rankedCandidates.push({
          ...candidate,
          similarity
        });

      } catch (error) {
        console.log(`📷 Embedding error for candidate:`, error);
        // Include with default similarity
        rankedCandidates.push({
          ...candidate,
          similarity: 0.5
        });
      }
    }

    // Sort by similarity (highest first)
    return rankedCandidates.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private async filterUsedImages(candidates: ImageCandidate[]): Promise<ImageCandidate[]> {
    try {
      // Get recently used images (last 50)
      const { data: recentMedia, error } = await supabase
        .from('media_history')
        .select('url')
        .order('used_at', { ascending: false })
        .limit(50);

      if (error) {
        console.log('📷 Error fetching media history:', error);
        return candidates; // Return all if we can't check
      }

      const usedUrls = new Set(recentMedia?.map(m => m.url) || []);
      
      return candidates.filter(candidate => !usedUrls.has(candidate.url));

    } catch (error) {
      console.log('📷 Error filtering used images:', error);
      return candidates;
    }
  }

  private async recordImageUsage(image: ImageCandidate): Promise<void> {
    try {
      await supabase
        .from('media_history')
        .insert({
          url: image.url,
          caption: image.caption,
          source: image.source,
          used_at: new Date().toISOString()
        });

      console.log(`📷 Recorded usage of ${image.source} image`);

    } catch (error) {
      console.log('📷 Error recording image usage:', error);
    }
  }
}

// Export singleton instance
export const smartImageSelector = new SmartImageSelector(); 