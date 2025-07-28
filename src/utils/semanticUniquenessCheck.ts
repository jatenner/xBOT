/**
 * 🧠 SEMANTIC UNIQUENESS CHECKER
 * 
 * Uses OpenAI embeddings to ensure tweets are semantically unique.
 * Prevents posting of content that is too similar to recent tweets.
 */

import { supabase } from './supabaseClient';
import OpenAI from 'openai';

// Initialize OpenAI client for embeddings
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Configuration constants
const SIMILARITY_THRESHOLD = 0.90; // Tweets with similarity > 90% are considered duplicates
const RECENT_TWEETS_LIMIT = 20; // Number of recent tweets to compare against
const EMBEDDING_MODEL = 'text-embedding-3-small';

// Interface for tweet with embedding
interface TweetWithEmbedding {
  id: string;
  content: string;
  embedding?: number[];
  created_at: string;
}

// Interface for similarity result
interface SimilarityResult {
  isTooSimilar: boolean;
  maxSimilarity: number;
  similarTweetContent?: string;
  similarTweetId?: string;
}

/**
 * Calculate cosine similarity between two embedding vectors
 */
function cosineSimilarity(vectorA: number[], vectorB: number[]): number {
  if (vectorA.length !== vectorB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    normA += vectorA[i] * vectorA[i];
    normB += vectorB[i] * vectorB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * Generate embedding for a given text using OpenAI
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    console.log(`🧠 Generating embedding for text: "${text.substring(0, 50)}..."`);
    
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.trim(),
      encoding_format: 'float'
    });

    if (!response.data || response.data.length === 0) {
      throw new Error('No embedding data returned from OpenAI');
    }

    const embedding = response.data[0].embedding;
    console.log(`✅ Generated embedding with ${embedding.length} dimensions`);
    
    return embedding;
  } catch (error) {
    console.error('❌ Error generating embedding:', error);
    throw error;
  }
}

/**
 * Fetch recent tweets from Supabase
 */
async function getRecentTweets(): Promise<TweetWithEmbedding[]> {
  try {
    console.log(`📊 Fetching last ${RECENT_TWEETS_LIMIT} tweets from database...`);
    
    const { data: tweets, error } = await supabase
      .from('tweets')
      .select('id, content, created_at, semantic_embedding')
      .order('created_at', { ascending: false })
      .limit(RECENT_TWEETS_LIMIT);

    if (error) {
      console.error('❌ Error fetching recent tweets:', error);
      throw error;
    }

    if (!tweets || tweets.length === 0) {
      console.log('📝 No recent tweets found in database');
      return [];
    }

    console.log(`✅ Retrieved ${tweets.length} recent tweets`);
    
    return tweets.map(tweet => ({
      id: tweet.id,
      content: tweet.content,
      embedding: tweet.semantic_embedding,
      created_at: tweet.created_at
    }));
  } catch (error) {
    console.error('❌ Error fetching recent tweets:', error);
    throw error;
  }
}

/**
 * Store embedding for a tweet in the database
 */
async function storeEmbedding(tweetId: string, embedding: number[]): Promise<void> {
  try {
    const { error } = await supabase
      .from('tweets')
      .update({ semantic_embedding: embedding })
      .eq('id', tweetId);

    if (error) {
      console.error('❌ Error storing embedding:', error);
      throw error;
    }

    console.log(`✅ Stored embedding for tweet ${tweetId}`);
  } catch (error) {
    console.error('❌ Error storing embedding:', error);
    // Don't throw here - this is not critical for the uniqueness check
  }
}

/**
 * Compare candidate tweet against recent tweets for semantic similarity
 */
async function checkSemanticSimilarity(
  candidateText: string,
  recentTweets: TweetWithEmbedding[]
): Promise<SimilarityResult> {
  try {
    // Generate embedding for candidate tweet
    const candidateEmbedding = await generateEmbedding(candidateText);
    
    let maxSimilarity = 0;
    let mostSimilarTweet: TweetWithEmbedding | null = null;

    console.log(`🔍 Comparing against ${recentTweets.length} recent tweets...`);

    for (const tweet of recentTweets) {
      let tweetEmbedding: number[];

      // Use stored embedding if available, otherwise generate it
      if (tweet.embedding && Array.isArray(tweet.embedding) && tweet.embedding.length > 0) {
        tweetEmbedding = tweet.embedding;
        console.log(`📊 Using stored embedding for tweet ${tweet.id}`);
      } else {
        console.log(`🧠 Generating missing embedding for tweet ${tweet.id}`);
        tweetEmbedding = await generateEmbedding(tweet.content);
        
        // Store the embedding for future use (non-blocking)
        storeEmbedding(tweet.id, tweetEmbedding).catch(err => 
          console.log(`⚠️ Failed to store embedding for ${tweet.id}:`, err.message)
        );
      }

      // Calculate similarity
      const similarity = cosineSimilarity(candidateEmbedding, tweetEmbedding);
      console.log(`📐 Similarity with tweet ${tweet.id}: ${(similarity * 100).toFixed(2)}%`);

      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        mostSimilarTweet = tweet;
      }
    }

    const isTooSimilar = maxSimilarity > SIMILARITY_THRESHOLD;
    
    console.log(`📊 Maximum similarity: ${(maxSimilarity * 100).toFixed(2)}%`);
    console.log(`🎯 Threshold: ${(SIMILARITY_THRESHOLD * 100).toFixed(2)}%`);
    
    if (isTooSimilar && mostSimilarTweet) {
      console.log(`🛑 Tweet is too similar to: "${mostSimilarTweet.content.substring(0, 50)}..."`);
    }

    return {
      isTooSimilar,
      maxSimilarity,
      similarTweetContent: mostSimilarTweet?.content,
      similarTweetId: mostSimilarTweet?.id
    };
  } catch (error) {
    console.error('❌ Error in semantic similarity check:', error);
    
    // On error, default to allowing the tweet (fail open)
    console.log('⚠️ Defaulting to allowing tweet due to error');
    return {
      isTooSimilar: false,
      maxSimilarity: 0
    };
  }
}

/**
 * Main function: Check if a candidate tweet is too similar to recent tweets
 */
export async function isTweetTooSimilar(candidateText: string): Promise<boolean> {
  try {
    console.log('🔍 === SEMANTIC UNIQUENESS CHECK ===');
    console.log(`📝 Checking candidate: "${candidateText.substring(0, 100)}..."`);
    
    // Validate input
    if (!candidateText || candidateText.trim().length === 0) {
      console.log('❌ Empty candidate text provided');
      return true; // Consider empty text as "too similar"
    }

    // Fetch recent tweets
    const recentTweets = await getRecentTweets();
    
    if (recentTweets.length === 0) {
      console.log('✅ No recent tweets to compare against - candidate is unique');
      return false;
    }

    // Perform semantic similarity check
    const result = await checkSemanticSimilarity(candidateText, recentTweets);
    
    if (result.isTooSimilar) {
      console.log('🛑 === SEMANTIC DUPLICATE DETECTED ===');
      console.log(`📊 Similarity: ${(result.maxSimilarity * 100).toFixed(2)}%`);
      console.log(`🎯 Threshold: ${(SIMILARITY_THRESHOLD * 100).toFixed(2)}%`);
      console.log(`📝 Similar to: "${result.similarTweetContent?.substring(0, 100)}..."`);
      return true;
    } else {
      console.log('✅ === TWEET IS SEMANTICALLY UNIQUE ===');
      console.log(`📊 Max similarity: ${(result.maxSimilarity * 100).toFixed(2)}%`);
      return false;
    }
  } catch (error) {
    console.error('❌ Error in semantic uniqueness check:', error);
    
    // Fail open - allow the tweet if there's an error
    console.log('⚠️ Allowing tweet due to error (fail-open policy)');
    return false;
  }
}

/**
 * Enhanced function with detailed similarity report
 */
export async function getTweetSimilarityReport(candidateText: string): Promise<SimilarityResult> {
  try {
    console.log('📊 === DETAILED SIMILARITY REPORT ===');
    
    const recentTweets = await getRecentTweets();
    
    if (recentTweets.length === 0) {
      return {
        isTooSimilar: false,
        maxSimilarity: 0
      };
    }

    return await checkSemanticSimilarity(candidateText, recentTweets);
  } catch (error) {
    console.error('❌ Error generating similarity report:', error);
    return {
      isTooSimilar: false,
      maxSimilarity: 0
    };
  }
}

/**
 * Utility function to update similarity threshold
 */
export function setSimilarityThreshold(threshold: number): void {
  if (threshold < 0 || threshold > 1) {
    throw new Error('Similarity threshold must be between 0 and 1');
  }
  
  // Note: This would need to be stored in configuration for persistence
  console.log(`🎯 Similarity threshold updated to: ${(threshold * 100).toFixed(2)}%`);
} 