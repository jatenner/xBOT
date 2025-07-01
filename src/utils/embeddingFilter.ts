/**
 * Embedding Filter - Prevents Repetitive Content
 * Uses pgvector similarity to detect and prevent duplicate-style content
 */

import { openaiClient } from './openaiClient';
import { supabase } from './supabaseClient';

export interface SimilarityResult {
  isUnique: boolean;
  maxSimilarity: number;
  similarTweetId?: string;
  similarContent?: string;
}

export class EmbeddingFilter {
  private readonly similarityThreshold = 0.8;
  private readonly maxTweetsToCheck = 300;

  async checkContentUniqueness(content: string): Promise<SimilarityResult> {
    try {
      // Generate embedding for the new content
      const contentEmbedding = await openaiClient.embed(content);
      
      // Get recent tweet embeddings for comparison
      const recentTweets = await this.getRecentTweetEmbeddings();
      
      if (recentTweets.length === 0) {
        return {
          isUnique: true,
          maxSimilarity: 0
        };
      }

      // Calculate similarities
      let maxSimilarity = 0;
      let mostSimilarTweet: any = null;

      for (const tweet of recentTweets) {
        if (tweet.embedding && Array.isArray(tweet.embedding)) {
          const similarity = this.cosineSimilarity(contentEmbedding, tweet.embedding);
          
          if (similarity > maxSimilarity) {
            maxSimilarity = similarity;
            mostSimilarTweet = tweet;
          }
        }
      }

      const isUnique = maxSimilarity < this.similarityThreshold;
      
      console.log(`🧠 Content similarity check: ${(maxSimilarity * 100).toFixed(1)}% max similarity (threshold: ${(this.similarityThreshold * 100)}%)`);
      
      if (!isUnique) {
        console.log(`⚠️ Content too similar to previous tweet: "${mostSimilarTweet?.content?.substring(0, 100)}..."`);
      }

      return {
        isUnique,
        maxSimilarity,
        similarTweetId: mostSimilarTweet?.id,
        similarContent: mostSimilarTweet?.content
      };

    } catch (error) {
      console.error('🧠 Embedding filter error:', error);
      // Return as unique on error to avoid blocking
      return {
        isUnique: true,
        maxSimilarity: 0
      };
    }
  }

  private async getRecentTweetEmbeddings(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('tweets')
        .select('id, content, embedding')
        .not('embedding', 'is', null)
        .order('created_at', { ascending: false })
        .limit(this.maxTweetsToCheck);

      if (error) {
        console.error('🧠 Error fetching recent embeddings:', error);
        return [];
      }

      return data || [];

    } catch (error) {
      console.error('🧠 Database error in embedding filter:', error);
      return [];
    }
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

  async storeContentEmbedding(tweetId: string, content: string): Promise<void> {
    try {
      const embedding = await openaiClient.embed(content);
      
      const { error } = await supabase
        .from('tweets')
        .update({ embedding })
        .eq('id', tweetId);

      if (error) {
        console.error('🧠 Error storing embedding:', error);
      } else {
        console.log('🧠 Stored content embedding for uniqueness tracking');
      }

    } catch (error) {
      console.error('🧠 Embedding storage error:', error);
    }
  }

  async generateUniqueContent(
    originalContent: string, 
    regenerateCallback: () => Promise<string>,
    maxAttempts: number = 3
  ): Promise<string> {
    let content = originalContent;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const uniquenessCheck = await this.checkContentUniqueness(content);
      
      if (uniquenessCheck.isUnique) {
        console.log(`✅ Content is unique (${attempts + 1}/${maxAttempts} attempts)`);
        return content;
      }

      attempts++;
      console.log(`🔄 Content too similar, regenerating (attempt ${attempts}/${maxAttempts})`);
      
      if (attempts < maxAttempts) {
        try {
          content = await regenerateCallback();
        } catch (error) {
          console.error('🔄 Content regeneration failed:', error);
          break;
        }
      }
    }

    // Get final similarity for logging
    const finalCheck = await this.checkContentUniqueness(content);
    console.log(`⚠️ Using content after ${attempts} attempts (similarity: ${(finalCheck.maxSimilarity * 100).toFixed(1)}%)`);
    return content;
  }

  async getContentSimilarityStats(): Promise<{
    totalTweetsWithEmbeddings: number;
    averageSimilarity: number;
    highSimilarityCount: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('tweets')
        .select('embedding')
        .not('embedding', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error || !data) {
        return {
          totalTweetsWithEmbeddings: 0,
          averageSimilarity: 0,
          highSimilarityCount: 0
        };
      }

      let totalSimilarity = 0;
      let comparisons = 0;
      let highSimilarityCount = 0;

      // Compare each tweet with the previous ones
      for (let i = 0; i < data.length - 1; i++) {
        for (let j = i + 1; j < Math.min(i + 10, data.length); j++) {
          if (data[i].embedding && data[j].embedding) {
            const similarity = this.cosineSimilarity(data[i].embedding, data[j].embedding);
            totalSimilarity += similarity;
            comparisons++;
            
            if (similarity > this.similarityThreshold) {
              highSimilarityCount++;
            }
          }
        }
      }

      return {
        totalTweetsWithEmbeddings: data.length,
        averageSimilarity: comparisons > 0 ? totalSimilarity / comparisons : 0,
        highSimilarityCount
      };

    } catch (error) {
      console.error('🧠 Error getting similarity stats:', error);
      return {
        totalTweetsWithEmbeddings: 0,
        averageSimilarity: 0,
        highSimilarityCount: 0
      };
    }
  }
}

// Export singleton instance
export const embeddingFilter = new EmbeddingFilter(); 