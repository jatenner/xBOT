/**
 * 🛡️ DUPLICATE POST PREVENTION
 * Hash-based system to prevent posting the same content multiple times
 */

import { createHash } from 'crypto';
import { supabaseClient } from './supabaseClient';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  contentHash: string;
  similarContent?: string;
  confidence?: number;
  reason?: string;
}

export class DuplicatePostPrevention {
  private static instance: DuplicatePostPrevention;
  private static recentHashes = new Set<string>(); // In-memory cache for last 50 posts
  private static maxCacheSize = 50;
  
  private constructor() {}
  
  public static getInstance(): DuplicatePostPrevention {
    if (!DuplicatePostPrevention.instance) {
      DuplicatePostPrevention.instance = new DuplicatePostPrevention();
    }
    return DuplicatePostPrevention.instance;
  }

  /**
   * 🔍 Check if content is a duplicate
   */
  async checkForDuplicate(content: string | string[]): Promise<DuplicateCheckResult> {
    try {
      // Normalize content for checking
      const normalizedContent = this.normalizeContent(content);
      const contentHash = this.generateContentHash(normalizedContent);
      
      console.log(`🔍 Checking duplicate for hash: ${contentHash.substring(0, 16)}...`);
      
      // IMMEDIATE in-memory check (prevents concurrent duplicates)
      if (DuplicatePostPrevention.recentHashes.has(contentHash)) {
        console.log('🚫 IMMEDIATE DUPLICATE detected in memory cache');
        return {
          isDuplicate: true,
          contentHash,
          reason: 'Content already processed in current session',
          confidence: 1.0
        };
      }
      
      // Check exact hash match first (fastest)
      const exactMatch = await this.checkExactHash(contentHash);
      if (exactMatch.isDuplicate) {
        return exactMatch;
      }
      
      // Check semantic similarity (recent posts only)
      const semanticMatch = await this.checkSemanticSimilarity(normalizedContent);
      if (semanticMatch.isDuplicate) {
        return semanticMatch;
      }
      
      return {
        isDuplicate: false,
        contentHash,
        reason: 'Content is unique'
      };
      
    } catch (error) {
      console.warn('⚠️ Duplicate check failed:', error.message);
      // Fail open - don't block posting on duplicate check errors
      return {
        isDuplicate: false,
        contentHash: this.generateContentHash(this.normalizeContent(content)),
        reason: 'Duplicate check failed, allowing post'
      };
    }
  }

  /**
   * 📝 Record successful post to prevent future duplicates
   */
  async recordPostedContent(content: string | string[], tweetId?: string): Promise<void> {
    try {
      const normalizedContent = this.normalizeContent(content);
      const contentHash = this.generateContentHash(normalizedContent);
      
      // Add to in-memory cache immediately
      DuplicatePostPrevention.recentHashes.add(contentHash);
      
      // Trim cache if too large (keep most recent)
      if (DuplicatePostPrevention.recentHashes.size > DuplicatePostPrevention.maxCacheSize) {
        const hashesArray = Array.from(DuplicatePostPrevention.recentHashes);
        DuplicatePostPrevention.recentHashes.clear();
        // Keep the last 25 hashes
        hashesArray.slice(-25).forEach(hash => DuplicatePostPrevention.recentHashes.add(hash));
      }
      
      const { error } = await supabaseClient.supabase
        .from('post_history')
        .insert({
          content_hash: contentHash,
          original_content: Array.isArray(content) ? content.join('\n\n') : content,
          tweet_id: tweetId,
          posted_at: new Date().toISOString()
        });
        
      // Ignore duplicate key errors (unique constraint violations)
      if (error && !error.message.includes('duplicate key')) {
        throw error;
      }
        
      console.log(`✅ Recorded post history: ${contentHash.substring(0, 16)}... (cached in memory)`);
      
    } catch (error) {
      console.warn('⚠️ Failed to record post history:', error.message);
      // Don't throw - this shouldn't block posting
    }
  }

  /**
   * 🧹 Normalize content for comparison
   */
  private normalizeContent(content: string | string[]): string {
    let text = Array.isArray(content) ? content.join(' ') : content;
    
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')     // Normalize whitespace
      .trim();
  }

  /**
   * 🔐 Generate content hash
   */
  private generateContentHash(normalizedContent: string): string {
    return createHash('sha256')
      .update(normalizedContent)
      .digest('hex')
      .substring(0, 64); // First 64 chars
  }

  /**
   * ⚡ Check exact hash match (fastest)
   */
  private async checkExactHash(contentHash: string): Promise<DuplicateCheckResult> {
    const { data, error } = await supabaseClient.supabase
      .from('post_history')
      .select('original_content, posted_at')
      .eq('content_hash', contentHash)
      .gte('posted_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
      .limit(1);

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    if (data && data.length > 0) {
      return {
        isDuplicate: true,
        contentHash,
        similarContent: data[0].original_content,
        confidence: 1.0,
        reason: `Exact duplicate posted on ${new Date(data[0].posted_at).toLocaleDateString()}`
      };
    }

    return { isDuplicate: false, contentHash };
  }

  /**
   * 🧠 Check semantic similarity (more expensive)
   */
  private async checkSemanticSimilarity(normalizedContent: string): Promise<DuplicateCheckResult> {
    // Get recent posts for similarity comparison
    const { data, error } = await supabaseClient.supabase
      .from('post_history')
      .select('original_content, content_hash, posted_at')
      .gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
      .order('posted_at', { ascending: false })
      .limit(20);

    if (error || !data || data.length === 0) {
      return { isDuplicate: false, contentHash: '' };
    }

    // Simple similarity check using normalized content
    for (const post of data) {
      const postNormalized = this.normalizeContent(post.original_content);
      const similarity = this.calculateStringSimilarity(normalizedContent, postNormalized);
      
      if (similarity > 0.85) { // 85% similarity threshold
        return {
          isDuplicate: true,
          contentHash: post.content_hash,
          similarContent: post.original_content,
          confidence: similarity,
          reason: `${Math.round(similarity * 100)}% similar to post from ${new Date(post.posted_at).toLocaleString()}`
        };
      }
    }

    return { isDuplicate: false, contentHash: '' };
  }

  /**
   * 📊 Calculate string similarity (Jaccard similarity)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.split(' ').filter(w => w.length > 2));
    const words2 = new Set(str2.split(' ').filter(w => w.length > 2));
    
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  /**
   * 🧹 Clean old post history (run periodically)
   */
  async cleanOldHistory(): Promise<void> {
    try {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const { error } = await supabaseClient.supabase
        .from('post_history')
        .delete()
        .lt('posted_at', oneWeekAgo);

      if (error) {
        console.warn('⚠️ Failed to clean old post history:', error.message);
      } else {
        console.log('🧹 Cleaned old post history (>7 days)');
      }
    } catch (error) {
      console.warn('⚠️ Error cleaning post history:', error.message);
    }
  }
}

export const duplicatePostPrevention = DuplicatePostPrevention.getInstance();