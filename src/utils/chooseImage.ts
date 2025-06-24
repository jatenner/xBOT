/**
 * Smart Image Selector with Pexels + Unsplash Integration
 * Combines Pexels + Unsplash search and ranks by semantic relevance
 */

import { openaiClient } from './openaiClient.js';
import { supabase } from './supabaseClient.js';

interface ImageCandidate {
  url: string;
  description: string;
  relevanceScore: number;
  source: 'unsplash' | 'pexels';
  id: string;
}

interface MediaHistoryEntry {
  url: string;
  caption: string;
  used_at: string;
}

export class SmartImageSelector {
  private unsplashAccessKey: string;
  private pexelsApiKey: string;
  private recentlyUsedImages: Set<string> = new Set();
  private imageUsageHistory: Map<string, number> = new Map();
  private maxRecentImages = 100;

  constructor() {
    this.unsplashAccessKey = process.env.UNSPLASH_ACCESS_KEY || '';
    this.pexelsApiKey = process.env.PEXELS_API_KEY || '';
    
    console.log('🖼️ Image APIs configured:', {
      unsplash: !!this.unsplashAccessKey,
      pexels: !!this.pexelsApiKey
    });
  }

  async chooseImage(tweetText: string): Promise<string | null> {
    try {
      console.log('🔍 Selecting optimal image for tweet...');
      
      // Extract keywords from tweet for search
      const searchTerm = this.extractImageKeywords(tweetText);
      console.log(`🎯 Image search term: "${searchTerm}"`);
      
      const candidates: ImageCandidate[] = [];

      // Try Pexels first (if available)
      if (this.pexelsApiKey) {
        try {
          console.log('📸 Searching Pexels...');
          const pexelsResults = await this.searchPexels(searchTerm, 8);
          candidates.push(...pexelsResults);
          console.log(`✅ Pexels: ${pexelsResults.length} candidates`);
        } catch (error) {
          console.log('⚠️ Pexels search failed:', error instanceof Error ? error.message : 'Unknown error');
        }
      }

      // Try Unsplash (if available)
      if (this.unsplashAccessKey) {
        try {
          console.log('📸 Searching Unsplash...');
          const unsplashResults = await this.searchUnsplash(searchTerm, 8);
          candidates.push(...unsplashResults);
          console.log(`✅ Unsplash: ${unsplashResults.length} candidates`);
        } catch (error) {
          console.log('⚠️ Unsplash search failed:', error instanceof Error ? error.message : 'Unknown error');
        }
      }

      if (candidates.length === 0) {
        console.log('⚠️ No images found from APIs, using fallback');
        return this.getFallbackImage();
      }

      // Filter out recently used images
      const freshCandidates = candidates.filter(img => !this.recentlyUsedImages.has(img.id));
      
      if (freshCandidates.length === 0) {
        console.log('🔄 All images recently used, clearing cache and retrying');
        this.recentlyUsedImages.clear();
        return this.chooseImage(tweetText);
      }

      // Rank candidates by relevance and usage history
      const rankedCandidates = this.rankImageCandidates(freshCandidates, searchTerm);
      
      if (rankedCandidates.length > 0) {
        const selectedImage = rankedCandidates[0];
        this.trackImageUsage(selectedImage.id);
        
        console.log(`✨ Selected image: ${selectedImage.source} (score: ${selectedImage.relevanceScore.toFixed(2)})`);
        return selectedImage.url;
      }

      return this.getFallbackImage();
      
    } catch (error) {
      console.error('❌ Image selection failed:', error);
      return this.getFallbackImage();
    }
  }

  private extractImageKeywords(tweetText: string): string {
    // Health tech specific keywords mapping
    const healthTechTerms = {
      'ai': 'artificial intelligence healthcare',
      'artificial intelligence': 'AI medical technology',
      'machine learning': 'healthcare data analysis',
      'digital health': 'health technology digital',
      'telemedicine': 'remote healthcare consultation',
      'wearable': 'health monitoring device',
      'biotechnology': 'medical research laboratory',
      'pharmaceutical': 'drug development medicine',
      'clinical trial': 'medical research study',
      'genome': 'DNA genetic research',
      'vaccine': 'medical injection healthcare',
      'surgery': 'medical operation hospital',
      'diagnosis': 'medical examination doctor',
      'therapy': 'medical treatment healthcare',
      'hospital': 'healthcare facility medical',
      'doctor': 'medical professional healthcare',
      'patient': 'healthcare medical care',
      'treatment': 'medical therapy healthcare',
      'research': 'medical laboratory science',
      'innovation': 'technology medical breakthrough',
      'breakthrough': 'medical discovery research',
      'fda': 'medical approval healthcare',
      'startup': 'technology innovation medical',
      'funding': 'investment healthcare technology'
    };

    const text = tweetText.toLowerCase();
    
    // Find the most specific health tech term
    for (const [keyword, searchTerm] of Object.entries(healthTechTerms)) {
      if (text.includes(keyword)) {
        return searchTerm;
      }
    }

    // Fallback to general health tech terms
    if (text.includes('health') || text.includes('medical') || text.includes('medicine')) {
      return 'health technology medical';
    }

    return 'healthcare innovation technology';
  }

  private async searchPexels(query: string, count: number): Promise<ImageCandidate[]> {
    if (!this.pexelsApiKey) return [];
    
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
      
      return (data.photos || []).map((photo: any) => ({
        url: photo.src.large,
        description: photo.alt || query,
        id: `pexels_${photo.id}`,
        relevanceScore: this.calculateRelevanceScore(photo.alt || '', query),
        source: 'pexels' as const
      }));
    } catch (error) {
      console.log(`📷 Pexels search failed for "${query}":`, error);
      return [];
    }
  }

  private async searchUnsplash(query: string, count: number): Promise<ImageCandidate[]> {
    if (!this.unsplashAccessKey) return [];
    
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
      
      return (data.results || []).map((photo: any) => ({
        url: photo.urls.regular,
        description: photo.alt_description || photo.description || query,
        id: `unsplash_${photo.id}`,
        relevanceScore: this.calculateRelevanceScore(
          (photo.alt_description || photo.description || '') + ' ' + (photo.tags?.map((t: any) => t.title).join(' ') || ''),
          query
        ),
        source: 'unsplash' as const
      }));
    } catch (error) {
      console.log(`📷 Unsplash search failed for "${query}":`, error);
      return [];
    }
  }

  private calculateRelevanceScore(description: string, query: string): number {
    if (!description) return 0.1;
    
    const queryTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
    const descLower = description.toLowerCase();
    
    let score = 0;
    let matches = 0;
    
    for (const term of queryTerms) {
      if (descLower.includes(term)) {
        matches++;
        // Exact word boundary match gets higher score
        if (descLower.includes(` ${term} `) || descLower.startsWith(`${term} `) || descLower.endsWith(` ${term}`)) {
          score += 1.0;
        } else {
          score += 0.5;
        }
      }
    }
    
    // Bonus for multiple matches
    if (matches > 1) {
      score += matches * 0.2;
    }
    
    // Normalize by query length
    return Math.min(score / queryTerms.length, 1.0);
  }

  private rankImageCandidates(candidates: ImageCandidate[], query: string): ImageCandidate[] {
    return candidates
      .map(candidate => {
        // Boost score for less frequently used images
        const usageCount = this.imageUsageHistory.get(candidate.id) || 0;
        const freshnessBias = Math.max(0, 1 - (usageCount * 0.2));
        
        // Slight preference for Pexels (often better quality)
        const sourceBias = candidate.source === 'pexels' ? 1.1 : 1.0;
        
        return {
          ...candidate,
          relevanceScore: candidate.relevanceScore * freshnessBias * sourceBias
        };
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  private trackImageUsage(imageId: string): void {
    // Track usage count
    const currentCount = this.imageUsageHistory.get(imageId) || 0;
    this.imageUsageHistory.set(imageId, currentCount + 1);
    
    // Track recent usage
    this.recentlyUsedImages.add(imageId);
    
    // Clean up old tracking data
    if (this.recentlyUsedImages.size > this.maxRecentImages) {
      const oldestImages = Array.from(this.recentlyUsedImages).slice(0, 20);
      oldestImages.forEach(id => this.recentlyUsedImages.delete(id));
    }
    
    console.log(`📊 Image usage tracked: ${imageId} (used ${this.imageUsageHistory.get(imageId)} times)`);
  }

  private getFallbackImage(): string {
    // High-quality health tech fallback images
    const fallbackImages = [
      'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?ixlib=rb-4.0.3&w=800', // Medical technology
      'https://images.unsplash.com/photo-1576671081837-49000212a370?ixlib=rb-4.0.3&w=800', // AI/Brain
      'https://images.unsplash.com/photo-1551601651-2a8555f1a136?ixlib=rb-4.0.3&w=800', // Research/Lab
      'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?ixlib=rb-4.0.3&w=800', // Healthcare tech
      'https://images.unsplash.com/photo-1582719471384-894fbb16e074?ixlib=rb-4.0.3&w=800', // Wearable tech
      'https://images.unsplash.com/photo-1504813184591-01572f98c85f?ixlib=rb-4.0.3&w=800', // Doctor with tablet
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?ixlib=rb-4.0.3&w=800', // Medical AI
      'https://images.unsplash.com/photo-1559757141-c15d5ac13c77?ixlib=rb-4.0.3&w=800' // Digital medicine
    ];
    
    // Select least recently used fallback
    const availableFallbacks = fallbackImages.filter(url => {
      const imageId = `fallback_${url.split('/').pop()?.split('?')[0]}`;
      return !this.recentlyUsedImages.has(imageId);
    });
    
    const selectedImage = availableFallbacks.length > 0 
      ? availableFallbacks[Math.floor(Math.random() * availableFallbacks.length)]
      : fallbackImages[Math.floor(Math.random() * fallbackImages.length)];
      
    const imageId = `fallback_${selectedImage.split('/').pop()?.split('?')[0]}`;
    this.trackImageUsage(imageId);
    
    console.log('🎨 Using fallback image');
    return selectedImage;
  }
}

// Export singleton instance
export const smartImageSelector = new SmartImageSelector(); 