/**
 * 🧠 ENHANCED SEMANTIC UNIQUENESS SYSTEM
 * 
 * Advanced content deduplication using OpenAI embeddings with:
 * - 30-day historical comparison
 * - 0.88 cosine similarity threshold
 * - 30 regeneration attempts
 * - Supabase embedding storage
 * - Comprehensive logging
 */

import { OpenAI } from 'openai';
import { supabaseClient } from './supabaseClient';
import { emergencyBudgetLockdown } from './emergencyBudgetLockdown';

interface SemanticAnalysis {
  isUnique: boolean;
  maxSimilarity: number;
  similarTweet?: {
    id: string;
    content: string;
    similarity: number;
    created_at: string;
  };
  attemptNumber: number;
  embedding: number[];
  coreIdeaAnalysis?: any;
  suppressionCheck?: any;
  ideaFingerprint?: string;
}

interface UniquenessResult {
  success: boolean;
  isUnique: boolean;
  analysis: SemanticAnalysis;
  error?: string;
}

export class EnhancedSemanticUniqueness {
  private static readonly SIMILARITY_THRESHOLD = 0.88;
  private static readonly MAX_ATTEMPTS = 30;
  private static readonly DAYS_TO_CHECK = 30;
  private static openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  /**
   * 🎯 MAIN UNIQUENESS CHECK (Enhanced with Core Idea Detection)
   */
  static async checkUniqueness(
    candidateText: string,
    attemptNumber: number = 1
  ): Promise<UniquenessResult> {
    try {
      console.log(`🔍 Enhanced uniqueness check attempt ${attemptNumber}/${this.MAX_ATTEMPTS}: "${candidateText.substring(0, 60)}..."`);

      // Step 1: Check core idea uniqueness first
      const { coreIdeaTracker } = await import('./coreIdeaTracker');
      const ideaValidation = await coreIdeaTracker.analyzeAndValidateIdea(candidateText, attemptNumber);
      
      if (!ideaValidation.should_proceed) {
        console.log(`🧠 Core idea check failed: ${ideaValidation.analysis.novelty_reasons.join(', ')}`);
        return {
          success: true,
          isUnique: false,
          analysis: {
            isUnique: false,
            maxSimilarity: ideaValidation.analysis.similarity_score,
            similarTweet: ideaValidation.analysis.closest_idea ? {
              id: ideaValidation.analysis.closest_idea.fingerprint,
              content: ideaValidation.analysis.closest_idea.main_claim,
              similarity: ideaValidation.analysis.similarity_score,
              created_at: ideaValidation.analysis.closest_idea.last_used
            } : undefined,
            attemptNumber,
            embedding: [],
            coreIdeaAnalysis: ideaValidation.analysis,
            suppressionCheck: ideaValidation.suppression
          }
        };
      }

      // Step 2: If core idea is novel, check text-level semantic similarity
      const embedding = await this.generateEmbedding(candidateText);
      if (!embedding) {
        return {
          success: false,
          isUnique: true, // Assume unique if embedding fails
          analysis: {
            isUnique: true,
            maxSimilarity: 0,
            attemptNumber,
            embedding: [],
            coreIdeaAnalysis: ideaValidation.analysis
          },
          error: 'Failed to generate embedding'
        };
      }

      // Get historical tweets for comparison
      const historicalTweets = await this.getHistoricalTweets();
      
      let maxSimilarity = 0;
      let mostSimilarTweet: any = null;

      // Compare against each historical tweet
      for (const tweet of historicalTweets) {
        if (tweet.semantic_embedding && Array.isArray(tweet.semantic_embedding)) {
          const similarity = this.calculateCosineSimilarity(embedding, tweet.semantic_embedding);
          
          if (similarity > maxSimilarity) {
            maxSimilarity = similarity;
            mostSimilarTweet = {
              id: tweet.id,
              content: tweet.content,
              similarity,
              created_at: tweet.created_at
            };
          }
        }
      }

      const isUnique = maxSimilarity < this.SIMILARITY_THRESHOLD;

      const analysis: SemanticAnalysis = {
        isUnique,
        maxSimilarity,
        similarTweet: mostSimilarTweet,
        attemptNumber,
        embedding,
        coreIdeaAnalysis: ideaValidation.analysis,
        ideaFingerprint: ideaValidation.fingerprint
      };

      // Log the analysis
      await this.logUniquenessAttempt(candidateText, analysis);

      // Store embedding if content is unique
      if (isUnique) {
        console.log(`✅ Content is unique - Core idea: NOVEL, Text similarity: ${maxSimilarity.toFixed(3)}`);
      } else {
        console.log(`🚫 Content too similar (${maxSimilarity.toFixed(3)} > ${this.SIMILARITY_THRESHOLD})`);
        if (mostSimilarTweet) {
          console.log(`📝 Similar to: "${mostSimilarTweet.content.substring(0, 60)}..." (${mostSimilarTweet.created_at})`);
        }
      }

      return {
        success: true,
        isUnique,
        analysis
      };

    } catch (error) {
      console.error('❌ Enhanced uniqueness check failed:', error);
      return {
        success: false,
        isUnique: true, // Assume unique on error to avoid blocking
        analysis: {
          isUnique: true,
          maxSimilarity: 0,
          attemptNumber,
          embedding: []
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 🧮 GENERATE OPENAI EMBEDDING
   */
  private static async generateEmbedding(text: string): Promise<number[] | null> {
    try {
      // Budget check
      await emergencyBudgetLockdown.enforceBeforeAICall('embedding-generation');

      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.replace(/\n/g, ' ').trim(),
      });

      return response.data[0]?.embedding || null;
    } catch (error) {
      console.error('❌ Failed to generate embedding:', error);
      return null;
    }
  }

  /**
   * 📊 GET HISTORICAL TWEETS (30 DAYS)
   */
  private static async getHistoricalTweets(): Promise<any[]> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - this.DAYS_TO_CHECK);

      const { data, error } = await supabaseClient.supabase
        .from('tweets')
        .select('id, content, semantic_embedding, created_at')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .not('semantic_embedding', 'is', null)
        .order('created_at', { ascending: false })
        .limit(500); // Reasonable limit for performance

      if (error) {
        console.error('❌ Failed to fetch historical tweets:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ Database query failed:', error);
      return [];
    }
  }

  /**
   * 🧮 CALCULATE COSINE SIMILARITY
   */
  private static calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * 📝 LOG UNIQUENESS ATTEMPT
   */
  private static async logUniquenessAttempt(
    candidateText: string,
    analysis: SemanticAnalysis
  ): Promise<void> {
    try {
      await supabaseClient.supabase
        .from('uniqueness_logs')
        .insert({
          candidate_text: candidateText,
          is_unique: analysis.isUnique,
          max_similarity: analysis.maxSimilarity,
          attempt_number: analysis.attemptNumber,
          similar_tweet_id: analysis.similarTweet?.id,
          threshold_used: this.SIMILARITY_THRESHOLD,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('❌ Failed to log uniqueness attempt:', error);
    }
  }

  /**
   * 💾 STORE EMBEDDING AND CORE IDEA FOR FUTURE COMPARISON
   */
  static async storeEmbedding(
    tweetId: string, 
    embedding: number[], 
    analysis?: SemanticAnalysis
  ): Promise<void> {
    try {
      // Store text embedding
      await supabaseClient.supabase
        .from('tweets')
        .update({ semantic_embedding: embedding })
        .eq('id', tweetId);

      // Store core idea if available
      if (analysis?.coreIdeaAnalysis && analysis?.ideaFingerprint) {
        const { coreIdeaTracker } = await import('./coreIdeaTracker');
        await coreIdeaTracker.storeApprovedIdea(
          analysis.ideaFingerprint,
          analysis.coreIdeaAnalysis,
          embedding,
          tweetId,
          1 - analysis.maxSimilarity // Convert similarity to novelty score
        );
      }

      console.log(`💾 Stored embedding and core idea for tweet ${tweetId}`);
    } catch (error) {
      console.error('❌ Failed to store embedding and idea:', error);
    }
  }

  /**
   * 📊 GET UNIQUENESS STATISTICS
   */
  static async getUniquenessStats(): Promise<{
    totalAttempts: number;
    uniqueContent: number;
    duplicateContent: number;
    averageSimilarity: number;
    successRate: number;
  }> {
    try {
      const { data, error } = await supabaseClient.supabase
        .from('uniqueness_logs')
        .select('is_unique, max_similarity')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (error || !data) {
        return {
          totalAttempts: 0,
          uniqueContent: 0,
          duplicateContent: 0,
          averageSimilarity: 0,
          successRate: 0
        };
      }

      const totalAttempts = data.length;
      const uniqueContent = data.filter(log => log.is_unique).length;
      const duplicateContent = totalAttempts - uniqueContent;
      const averageSimilarity = data.reduce((sum, log) => sum + log.max_similarity, 0) / totalAttempts;
      const successRate = totalAttempts > 0 ? (uniqueContent / totalAttempts) * 100 : 0;

      return {
        totalAttempts,
        uniqueContent,
        duplicateContent,
        averageSimilarity,
        successRate
      };
    } catch (error) {
      console.error('❌ Failed to get uniqueness stats:', error);
      return {
        totalAttempts: 0,
        uniqueContent: 0,
        duplicateContent: 0,
        averageSimilarity: 0,
        successRate: 0
      };
    }
  }
}

export const enhancedSemanticUniqueness = EnhancedSemanticUniqueness; 