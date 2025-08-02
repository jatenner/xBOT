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
  private static recentHashes = new Map<string, number>(); // Hash -> timestamp (for temporal checking)
  private static maxCacheSize = 50;
  private static CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL for in-memory cache
  
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
      
      // IMMEDIATE in-memory check with TTL (prevents concurrent duplicates)
      const now = Date.now();
      const cachedTime = DuplicatePostPrevention.recentHashes.get(contentHash);
      
      if (cachedTime) {
        const ageMinutes = (now - cachedTime) / (1000 * 60);
        if (ageMinutes < 5) { // Only block if within 5 minutes
          console.log(`🚫 IMMEDIATE DUPLICATE detected in memory cache (${ageMinutes.toFixed(1)}m ago)`);
          return {
            isDuplicate: true,
            contentHash,
            reason: `Content already processed ${ageMinutes.toFixed(1)} minutes ago`,
            confidence: 1.0
          };
        } else {
          // Remove expired entry
          DuplicatePostPrevention.recentHashes.delete(contentHash);
          console.log(`🔄 Expired cache entry removed (${ageMinutes.toFixed(1)}m old)`);
        }
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
      
      // Add to in-memory cache with timestamp
      const now = Date.now();
      DuplicatePostPrevention.recentHashes.set(contentHash, now);
      
      // Clean up expired entries and trim cache if too large
      const expiredEntries = Array.from(DuplicatePostPrevention.recentHashes.entries())
        .filter(([hash, timestamp]) => (now - timestamp) > DuplicatePostPrevention.CACHE_TTL_MS);
      
      expiredEntries.forEach(([hash]) => DuplicatePostPrevention.recentHashes.delete(hash));
      
      // Trim cache if still too large (keep most recent)
      if (DuplicatePostPrevention.recentHashes.size > DuplicatePostPrevention.maxCacheSize) {
        const sortedEntries = Array.from(DuplicatePostPrevention.recentHashes.entries())
          .sort((a, b) => b[1] - a[1]); // Sort by timestamp, newest first
        
        DuplicatePostPrevention.recentHashes.clear();
        // Keep the 25 most recent entries
        sortedEntries.slice(0, 25).forEach(([hash, timestamp]) => 
          DuplicatePostPrevention.recentHashes.set(hash, timestamp)
        );
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