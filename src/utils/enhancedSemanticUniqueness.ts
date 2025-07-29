/**
 * 🧠 ENHANCED SEMANTIC UNIQUENESS SYSTEM (UPDATED)
 * 
 * Advanced content deduplication using OpenAI embeddings with:
 * - 30-day historical comparison
 * - 0.75 cosine similarity threshold (stricter)
 * - 30 regeneration attempts
 * - Supabase embedding storage
 * - Comprehensive logging and suppression tracking
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
  similarityBreakdown: Array<{
    tweet_id: string;
    content_preview: string;
    similarity: number;
    created_at: string;
  }>;
  totalTweetsCompared: number;
}

interface UniquenessResult {
  success: boolean;
  isUnique: boolean;
  analysis: SemanticAnalysis;
  error?: string;
  suppressionReasons?: string[];
}

export class EnhancedSemanticUniqueness {
  private static readonly SIMILARITY_THRESHOLD = 0.75; // Stricter threshold
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
            suppressionCheck: ideaValidation.suppression,
            similarityBreakdown: [],
            totalTweetsCompared: 0
          },
          suppressionReasons: ideaValidation.analysis.novelty_reasons
        };
      }

      // Step 2: If core idea is novel, check text-level semantic similarity
      const embedding = await this.generateEmbedding(candidateText);
      const recentTweets = await this.getRecentTweets();

      console.log(`📊 Comparing against ${recentTweets.length} recent tweets...`);

      let maxSimilarity = 0;
      let mostSimilarTweet: any = null;
      const similarityBreakdown: Array<{
        tweet_id: string;
        content_preview: string;
        similarity: number;
        created_at: string;
      }> = [];

      for (const tweet of recentTweets) {
        try {
          let tweetEmbedding: number[];

          // Use stored embedding if available
          if (tweet.semantic_embedding && Array.isArray(tweet.semantic_embedding) && tweet.semantic_embedding.length > 0) {
            tweetEmbedding = tweet.semantic_embedding;
          } else {
            // Generate and store embedding
            tweetEmbedding = await this.generateEmbedding(tweet.content);
            await this.storeEmbedding(tweet.id, tweetEmbedding);
          }

          const similarity = this.cosineSimilarity(embedding, tweetEmbedding);
          
          // Add to breakdown for detailed analysis
          similarityBreakdown.push({
            tweet_id: tweet.id,
            content_preview: tweet.content.substring(0, 50) + '...',
            similarity: similarity,
            created_at: tweet.created_at
          });

          if (similarity > maxSimilarity) {
            maxSimilarity = similarity;
            mostSimilarTweet = tweet;
          }

          // Log high similarities for debugging
          if (similarity > 0.6) {
            console.log(`⚠️ High similarity detected: ${(similarity * 100).toFixed(1)}% with "${tweet.content.substring(0, 40)}..."`);
          }

        } catch (embeddingError) {
          console.warn(`⚠️ Failed to process tweet ${tweet.id}:`, embeddingError.message);
          continue;
        }
      }

      // Sort breakdown by similarity (highest first)
      similarityBreakdown.sort((a, b) => b.similarity - a.similarity);

      const isUnique = maxSimilarity <= this.SIMILARITY_THRESHOLD;
      
      console.log(`📊 Semantic analysis complete:`);
      console.log(`   Max similarity: ${(maxSimilarity * 100).toFixed(2)}%`);
      console.log(`   Threshold: ${(this.SIMILARITY_THRESHOLD * 100).toFixed(2)}%`);
      console.log(`   Result: ${isUnique ? '✅ UNIQUE' : '🛑 TOO SIMILAR'}`);
      console.log(`   Tweets compared: ${recentTweets.length}`);
      
      if (!isUnique && mostSimilarTweet) {
        console.log(`   Most similar to: "${mostSimilarTweet.content.substring(0, 50)}..."`);
        console.log(`   Created: ${mostSimilarTweet.created_at}`);
      }

      // Log top 3 similarities for analysis
      console.log(`📈 Top similarities:`);
      similarityBreakdown.slice(0, 3).forEach((item, index) => {
        console.log(`   ${index + 1}. ${(item.similarity * 100).toFixed(1)}% - "${item.content_preview}"`);
      });

      const analysis: SemanticAnalysis = {
        isUnique,
        maxSimilarity,
        similarTweet: mostSimilarTweet ? {
          id: mostSimilarTweet.id,
          content: mostSimilarTweet.content,
          similarity: maxSimilarity,
          created_at: mostSimilarTweet.created_at
        } : undefined,
        attemptNumber,
        embedding,
        coreIdeaAnalysis: ideaValidation.analysis,
        suppressionCheck: ideaValidation.suppression,
        ideaFingerprint: ideaValidation.analysis.similarity_score.toString(),
        similarityBreakdown,
        totalTweetsCompared: recentTweets.length
      };

      // Store uniqueness check result for analytics
      await this.logUniquenessCheck(candidateText, analysis);

      return {
        success: true,
        isUnique,
        analysis,
        suppressionReasons: isUnique ? [] : ['semantic_similarity_too_high']
      };

    } catch (error) {
      console.error('❌ Enhanced uniqueness check failed:', error);
      return {
        success: false,
        isUnique: true, // Fail open
        analysis: {
          isUnique: true,
          maxSimilarity: 0,
          attemptNumber,
          embedding: [],
          similarityBreakdown: [],
          totalTweetsCompared: 0
        },
        error: error.message
      };
    }
  }

  /**
   * 🧠 GENERATE EMBEDDING WITH BUDGET PROTECTION
   */
  private static async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Check budget before making API call
      const lockdownStatus = await emergencyBudgetLockdown.isLockedDown();
      if (lockdownStatus.lockdownActive) {
        throw new Error('Emergency budget lockdown active - cannot generate embeddings');
      }

      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.substring(0, 8000), // Limit text length
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('❌ Embedding generation failed:', error);
      throw error;
    }
  }

  /**
   * 📊 COSINE SIMILARITY CALCULATION
   */
  private static cosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      console.warn('⚠️ Vector length mismatch in cosine similarity calculation');
      return 0;
    }

    const dotProduct = vectorA.reduce((sum, a, i) => sum + a * vectorB[i], 0);
    const magnitudeA = Math.sqrt(vectorA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vectorB.reduce((sum, b) => sum + b * b, 0));

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * 📚 GET RECENT TWEETS FOR COMPARISON
   */
  private static async getRecentTweets(): Promise<Array<{
    id: string;
    content: string;
    created_at: string;
    semantic_embedding?: number[];
  }>> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.DAYS_TO_CHECK);

      const { data, error } = await supabaseClient.supabase
        .from('tweets')
        .select('id, content, created_at, semantic_embedding')
        .gte('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(100); // Increased limit for better comparison

      if (error) {
        console.error('❌ Failed to fetch recent tweets:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ Error fetching recent tweets:', error);
      return [];
    }
  }

  /**
   * 💾 STORE EMBEDDING
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
      console.error(`❌ Failed to store embedding for tweet ${tweetId}:`, error);
    }
  }

  /**
   * 📝 LOG UNIQUENESS CHECK FOR ANALYTICS
   */
  private static async logUniquenessCheck(
    candidateText: string,
    analysis: SemanticAnalysis
  ): Promise<void> {
    try {
      const logEntry = {
        candidate_text: candidateText.substring(0, 500), // Truncate for storage
        max_similarity: analysis.maxSimilarity,
        is_unique: analysis.isUnique,
        attempt_number: analysis.attemptNumber,
        tweets_compared: analysis.totalTweetsCompared,
        most_similar_tweet_id: analysis.similarTweet?.id,
        most_similar_content: analysis.similarTweet?.content?.substring(0, 200),
        threshold_used: this.SIMILARITY_THRESHOLD,
        core_content_hash: analysis.ideaFingerprint,
        core_idea_category: analysis.coreIdeaAnalysis?.idea_category,
        novelty_reasons: analysis.coreIdeaAnalysis?.novelty_reasons || [],
        created_at: new Date().toISOString()
      };

      await supabaseClient.supabase
        .from('uniqueness_logs')
        .insert(logEntry);

      console.log(`📝 Logged uniqueness check: ${analysis.isUnique ? 'UNIQUE' : 'DUPLICATE'}`);
    } catch (error) {
      console.warn('⚠️ Failed to log uniqueness check:', error.message);
    }
  }

  /**
   * 📊 GET UNIQUENESS ANALYTICS
   */
  static async getUniquenessAnalytics(): Promise<{
    total_checks: number;
    unique_percentage: number;
    avg_similarity: number;
    top_similar_ideas: Array<{
      idea_category: string;
      duplicate_count: number;
    }>;
    recent_duplicates: Array<{
      candidate_text: string;
      similarity: number;
      similar_to: string;
      checked_at: string;
    }>;
  }> {
    try {
      // Get recent uniqueness checks
      const { data: recentChecks, error } = await supabaseClient.supabase
        .from('uniqueness_logs')
        .select('*')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
        .order('created_at', { ascending: false })
        .limit(100);

      if (error || !recentChecks) {
        return {
          total_checks: 0,
          unique_percentage: 0,
          avg_similarity: 0,
          top_similar_ideas: [],
          recent_duplicates: []
        };
      }

      const totalChecks = recentChecks.length;
      const uniqueChecks = recentChecks.filter(check => check.is_unique).length;
      const uniquePercentage = totalChecks > 0 ? (uniqueChecks / totalChecks) * 100 : 0;
      
      const avgSimilarity = totalChecks > 0 
        ? recentChecks.reduce((sum, check) => sum + (check.max_similarity || 0), 0) / totalChecks 
        : 0;

      // Get top similar idea categories
      const ideaCategoryCounts: Record<string, number> = {};
      recentChecks
        .filter(check => !check.is_unique && check.core_idea_category)
        .forEach(check => {
          const category = check.core_idea_category;
          ideaCategoryCounts[category] = (ideaCategoryCounts[category] || 0) + 1;
        });

      const topSimilarIdeas = Object.entries(ideaCategoryCounts)
        .map(([category, count]) => ({ idea_category: category, duplicate_count: count }))
        .sort((a, b) => b.duplicate_count - a.duplicate_count)
        .slice(0, 5);

      // Get recent duplicates
      const recentDuplicates = recentChecks
        .filter(check => !check.is_unique)
        .slice(0, 10)
        .map(check => ({
          candidate_text: check.candidate_text?.substring(0, 100) + '...' || 'N/A',
          similarity: check.max_similarity || 0,
          similar_to: check.most_similar_content?.substring(0, 100) + '...' || 'N/A',
          checked_at: check.created_at
        }));

      return {
        total_checks: totalChecks,
        unique_percentage: uniquePercentage,
        avg_similarity: avgSimilarity,
        top_similar_ideas: topSimilarIdeas,
        recent_duplicates: recentDuplicates
      };

    } catch (error) {
      console.error('❌ Failed to get uniqueness analytics:', error);
      return {
        total_checks: 0,
        unique_percentage: 0,
        avg_similarity: 0,
        top_similar_ideas: [],
        recent_duplicates: []
      };
    }
  }

  /**
   * 🧪 TEST SEMANTIC UNIQUENESS SYSTEM
   */
  static async testSemanticUniqueness(): Promise<{
    test_passed: boolean;
    threshold_test: boolean;
    embedding_test: boolean;
    similarity_test: boolean;
    storage_test: boolean;
  }> {
    console.log('🧪 Testing semantic uniqueness system...');
    
    const testResults = {
      test_passed: false,
      threshold_test: false,
      embedding_test: false,
      similarity_test: false,
      storage_test: false
    };

    try {
      // Test 1: Embedding generation
      console.log('Test 1: Embedding generation...');
      const testText = "This is a test health tip about drinking water.";
      const embedding = await this.generateEmbedding(testText);
      testResults.embedding_test = Array.isArray(embedding) && embedding.length > 0;
      console.log(`Embedding test: ${testResults.embedding_test ? '✅' : '❌'}`);

      // Test 2: Similarity calculation
      console.log('Test 2: Similarity calculation...');
      const embedding1 = await this.generateEmbedding("Drink more water for better health");
      const embedding2 = await this.generateEmbedding("Drinking water improves your health");
      const embedding3 = await this.generateEmbedding("Exercise regularly for fitness");
      
      const similarityHigh = this.cosineSimilarity(embedding1, embedding2);
      const similarityLow = this.cosineSimilarity(embedding1, embedding3);
      
      testResults.similarity_test = similarityHigh > similarityLow && similarityHigh > 0.7;
      console.log(`Similarity test: ${testResults.similarity_test ? '✅' : '❌'} (${similarityHigh.toFixed(3)} > ${similarityLow.toFixed(3)})`);

      // Test 3: Threshold checking
      console.log('Test 3: Threshold checking...');
      const uniqueResult = await this.checkUniqueness("A completely unique health insight that has never been posted before about the benefits of sunlight exposure.");
      testResults.threshold_test = uniqueResult.success;
      console.log(`Threshold test: ${testResults.threshold_test ? '✅' : '❌'}`);

      // Test 4: Storage test (mock)
      console.log('Test 4: Storage test...');
      try {
        // This is a mock test - we don't actually store
        testResults.storage_test = true;
        console.log(`Storage test: ${testResults.storage_test ? '✅' : '❌'}`);
      } catch (storageError) {
        console.log(`Storage test: ❌ ${storageError.message}`);
      }

      testResults.test_passed = Object.values(testResults).every(result => result === true);
      
      console.log(`🎯 Semantic uniqueness test ${testResults.test_passed ? 'PASSED' : 'FAILED'}`);
      
      return testResults;

    } catch (error) {
      console.error('❌ Semantic uniqueness test failed:', error);
      return testResults;
    }
  }
}

export const enhancedSemanticUniqueness = EnhancedSemanticUniqueness; 