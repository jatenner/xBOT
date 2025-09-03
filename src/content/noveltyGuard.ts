import { createClient } from '@supabase/supabase-js';

interface ContentFingerprint {
  post_id: string;
  content_hash: string;
  trigram_set: string[];
  embedding_vector?: number[];
  normalized_content: string;
  opening_words: string;
  created_at: Date;
}

interface NoveltyScore {
  is_novel: boolean;
  jaccard_similarity: number;
  levenshtein_similarity: number;
  embedding_similarity?: number;
  opening_collision: boolean;
  rejection_reason?: string;
}

export class NoveltyGuard {
  private static instance: NoveltyGuard;
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  private recentContent: ContentFingerprint[] = [];
  private recentOpenings: Set<string> = new Set();

  private constructor() {
    this.loadRecentContent();
  }

  public static getInstance(): NoveltyGuard {
    if (!NoveltyGuard.instance) {
      NoveltyGuard.instance = new NoveltyGuard();
    }
    return NoveltyGuard.instance;
  }

  /**
   * Check if content is novel enough to post
   */
  public async checkNovelty(content: string): Promise<NoveltyScore> {
    console.log('🔍 NOVELTY_CHECK: Analyzing content uniqueness...');
    
    const normalized = this.normalizeContent(content);
    const trigrams = this.generateTrigrams(normalized);
    const opening = this.extractOpening(content);
    
    // Check against recent content
    let maxJaccard = 0;
    let maxLevenshtein = 0;
    
    for (const existing of this.recentContent) {
      // Jaccard similarity (trigram overlap)
      const jaccard = this.calculateJaccard(trigrams, existing.trigram_set);
      maxJaccard = Math.max(maxJaccard, jaccard);
      
      // Levenshtein similarity
      const levenshtein = this.calculateLevenshtein(normalized, existing.normalized_content);
      maxLevenshtein = Math.max(maxLevenshtein, levenshtein);
    }
    
    // Check opening collision
    const openingCollision = this.recentOpenings.has(opening.toLowerCase());
    
    // Determine if novel
    const isNovel = maxJaccard < 0.30 && 
                   maxLevenshtein < 0.85 && 
                   !openingCollision;
    
    let rejectionReason = '';
    if (!isNovel) {
      if (maxJaccard >= 0.30) rejectionReason = 'High trigram overlap';
      else if (maxLevenshtein >= 0.85) rejectionReason = 'Too similar to existing content';
      else if (openingCollision) rejectionReason = 'Opening words recently used';
    }
    
    console.log(`📊 NOVELTY_SCORE: Jaccard=${maxJaccard.toFixed(3)}, Levenshtein=${maxLevenshtein.toFixed(3)}, Opening=${openingCollision ? 'COLLISION' : 'OK'}`);
    console.log(`${isNovel ? '✅' : '❌'} NOVELTY_RESULT: ${isNovel ? 'UNIQUE' : `REJECTED - ${rejectionReason}`}`);
    
    return {
      is_novel: isNovel,
      jaccard_similarity: maxJaccard,
      levenshtein_similarity: maxLevenshtein,
      opening_collision: openingCollision,
      rejection_reason: isNovel ? undefined : rejectionReason
    };
  }

  /**
   * Register new content after posting
   */
  public async registerContent(postId: string, content: string): Promise<void> {
    const normalized = this.normalizeContent(content);
    const trigrams = this.generateTrigrams(normalized);
    const opening = this.extractOpening(content);
    const contentHash = this.hashContent(normalized);
    
    const fingerprint: ContentFingerprint = {
      post_id: postId,
      content_hash: contentHash,
      trigram_set: trigrams,
      normalized_content: normalized,
      opening_words: opening,
      created_at: new Date()
    };
    
    // Add to memory
    this.recentContent.unshift(fingerprint);
    this.recentOpenings.add(opening.toLowerCase());
    
    // Keep only last 200 posts in memory
    if (this.recentContent.length > 200) {
      const removed = this.recentContent.pop();
      if (removed) {
        this.recentOpenings.delete(removed.opening_words.toLowerCase());
      }
    }
    
    // Store in database
    try {
      await this.supabase
        .from('content_fingerprints')
        .insert({
          post_id: postId,
          content_hash: contentHash,
          trigram_set: trigrams,
          normalized_content: normalized,
          opening_words: opening,
          created_at: new Date().toISOString()
        });
      
      console.log(`💾 FINGERPRINT_STORED: ${postId} with ${trigrams.length} trigrams`);
    } catch (error: any) {
      console.warn('⚠️ FINGERPRINT_STORAGE_FAILED:', error.message);
    }
  }

  /**
   * Normalize content for comparison
   */
  private normalizeContent(content: string): string {
    return content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\d+/g, 'NUM') // Replace numbers with NUM
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim();
  }

  /**
   * Generate trigrams from text
   */
  private generateTrigrams(text: string): string[] {
    const words = text.split(' ').filter(w => w.length > 2);
    const trigrams: string[] = [];
    
    for (let i = 0; i <= words.length - 3; i++) {
      trigrams.push(words.slice(i, i + 3).join(' '));
    }
    
    return trigrams;
  }

  /**
   * Extract opening words for collision detection
   */
  private extractOpening(content: string): string {
    const words = content.trim().split(' ').slice(0, 4); // First 4 words
    return words.join(' ');
  }

  /**
   * Calculate Jaccard similarity between trigram sets
   */
  private calculateJaccard(set1: string[], set2: string[]): number {
    const s1 = new Set(set1);
    const s2 = new Set(set2);
    
    const intersection = new Set([...s1].filter(x => s2.has(x)));
    const union = new Set([...s1, ...s2]);
    
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  /**
   * Calculate normalized Levenshtein similarity
   */
  private calculateLevenshtein(str1: string, str2: string): number {
    const matrix: number[][] = [];
    const len1 = str1.length;
    const len2 = str2.length;

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1.charAt(i - 1) === str2.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    
    return maxLen === 0 ? 0 : 1 - (distance / maxLen);
  }

  /**
   * Generate hash for content
   */
  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  /**
   * Load recent content from database
   */
  private async loadRecentContent(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('content_fingerprints')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      if (data) {
        this.recentContent = data.map(row => ({
          post_id: row.post_id,
          content_hash: row.content_hash,
          trigram_set: row.trigram_set || [],
          normalized_content: row.normalized_content || '',
          opening_words: row.opening_words || '',
          created_at: new Date(row.created_at)
        }));

        // Populate recent openings
        this.recentOpenings = new Set(
          this.recentContent.map(c => c.opening_words.toLowerCase())
        );

        console.log(`📚 LOADED_FINGERPRINTS: ${this.recentContent.length} recent posts for novelty checking`);
      }
    } catch (error: any) {
      console.warn('⚠️ FINGERPRINT_LOAD_FAILED:', error.message);
    }
  }

  /**
   * Get usage statistics
   */
  public getStats(): { total_fingerprints: number; unique_openings: number } {
    return {
      total_fingerprints: this.recentContent.length,
      unique_openings: this.recentOpenings.size
    };
  }
}
