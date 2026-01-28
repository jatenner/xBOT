/**
 * 🔗 EMBEDDING UTILITY WITH CACHING
 * Phase 6.3: Cached embeddings for topic-fit scoring
 * 
 * Features:
 * - Caching via Supabase embeddings_cache table
 * - Fallback to prior behavior if embeddings fail
 * - Cost tracking and auditability
 */

import { getSupabaseClient } from '../db/index';
import { getConfig } from '../config/config';
import { createBudgetedEmbedding } from '../services/openaiBudgetedClient';
import crypto from 'crypto';

/**
 * Get text embedding with caching
 * Returns cached embedding if available, otherwise generates new one
 */
export async function getTextEmbedding(
  text: string,
  options?: {
    tweetId?: string;
    useCache?: boolean;
  }
): Promise<number[]> {
  const config = getConfig();
  const useCache = options?.useCache !== false; // Default true
  const model = config.EMBED_MODEL || 'text-embedding-3-small';
  
  // Normalize text for hashing (lowercase, trim)
  const normalizedText = text.toLowerCase().trim();
  const textHash = crypto.createHash('sha256').update(normalizedText).digest('hex');
  
  // Try cache first if enabled
  if (useCache) {
    const cached = await getCachedEmbedding(textHash, model);
    if (cached) {
      return cached;
    }
  }
  
  // Generate new embedding
  try {
    const embedding = await generateEmbedding(text, model);
    
    // Cache it (non-blocking)
    if (useCache) {
      cacheEmbedding(textHash, options?.tweetId, embedding, model).catch(err => {
        console.warn('[EMBEDDINGS] Failed to cache embedding:', err.message);
      });
    }
    
    return embedding;
  } catch (error: any) {
    console.error('[EMBEDDINGS] Failed to generate embedding:', error.message);
    throw error; // Let caller handle fallback
  }
}

/**
 * Get cached embedding from database
 */
async function getCachedEmbedding(textHash: string, model: string): Promise<number[] | null> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('embeddings_cache')
      .select('embedding, last_accessed_at')
      .eq('text_hash', textHash)
      .eq('model', model)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    // Update access time (non-blocking)
    Promise.resolve(supabase
      .from('embeddings_cache')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('text_hash', textHash)
      .eq('model', model))
      .then(() => {})
      .catch(() => {}); // Ignore errors - fire and forget
    
    // Parse embedding from JSONB
    const embedding = Array.isArray(data.embedding) 
      ? data.embedding 
      : JSON.parse(String(data.embedding));
    
    return embedding as number[];
  } catch (error) {
    // Cache miss or error - return null to trigger generation
    return null;
  }
}

/**
 * Cache embedding in database
 */
async function cacheEmbedding(
  textHash: string,
  tweetId: string | undefined,
  embedding: number[],
  model: string
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('embeddings_cache')
      .upsert({
        text_hash: textHash,
        tweet_id: tweetId || null,
        embedding: embedding,
        model: model,
        last_accessed_at: new Date().toISOString(),
        access_count: 1,
      }, {
        onConflict: 'text_hash,model',
        ignoreDuplicates: false,
      });
    
    if (error) {
      console.warn('[EMBEDDINGS] Cache write failed:', error.message);
    }
  } catch (error: any) {
    // Non-critical - just log
    console.warn('[EMBEDDINGS] Cache write error:', error.message);
  }
}

/**
 * Generate embedding using OpenAI (via budgeted client)
 */
async function generateEmbedding(text: string, model: string): Promise<number[]> {
  const config = getConfig();
  
  if (!config.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }
  
  // Use budgeted client for cost tracking
  const response = await createBudgetedEmbedding(
    {
      model: model,
      input: text.substring(0, 8000), // Truncate to safe limit
      encoding_format: 'float',
    },
    {
      purpose: 'reply_targeting_topic_fit',
      priority: 'low',
    }
  );
  
  return response.data[0].embedding;
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Embedding dimension mismatch: ${a.length} vs ${b.length}`);
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;
  
  return dotProduct / magnitude;
}
