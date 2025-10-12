/**
 * Embeddings Module
 * Handles OpenAI embeddings with cosine similarity and duplicate detection
 */

import { createHash } from 'crypto';
import { createBudgetedEmbedding } from '../services/openaiBudgetedClient';
import { admin as supabase } from '../lib/supabaseClients';
import { log_compat as log, log_compat as warn, log_compat as error } from '../utils/logger';

export interface EmbeddingResult {
  embedding: number[];
  hash: string;
  model: string;
  tokens: number;
}

export interface SimilarityResult {
  contentHash: string;
  similarity: number;
  text?: string;
  createdAt?: Date;
}

const EMBED_MODEL = process.env.EMBED_MODEL || 'text-embedding-3-small';
const SIMILARITY_THRESHOLD = parseFloat(process.env.DUP_COSINE_THRESHOLD || '0.80');
const DUP_WINDOW_DAYS = parseInt(process.env.DUP_WINDOW_DAYS || '7', 10);

// Cache for recent embeddings to avoid duplicate API calls
const embeddingCache = new Map<string, EmbeddingResult>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const cacheTimestamps = new Map<string, number>();

/**
 * Generate content hash for deduplication
 */
export function generateContentHash(text: string): string {
  // Normalize text: lowercase, remove extra whitespace, remove URLs
  const normalized = text
    .toLowerCase()
    .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  return createHash('sha256').update(normalized).digest('hex').substring(0, 16);
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimensions don't match: ${a.length} vs ${b.length}`);
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
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Clean expired cache entries
 */
function cleanCache(): void {
  const now = Date.now();
  for (const [hash, timestamp] of cacheTimestamps.entries()) {
    if (now - timestamp > CACHE_TTL) {
      embeddingCache.delete(hash);
      cacheTimestamps.delete(hash);
    }
  }
}

/**
 * Get embedding from cache or generate new one
 */
async function getEmbeddingCached(text: string, hash: string): Promise<EmbeddingResult> {
  cleanCache();
  
  // Check cache first
  const cached = embeddingCache.get(hash);
  if (cached) {
    log(`EMBEDDING_CACHE_HIT: hash=${hash}`);
    return cached;
  }
  
  // Generate new embedding
  log(`EMBEDDING_API_CALL: hash=${hash} model=${EMBED_MODEL}`);
  
  try {
    const response = await createBudgetedEmbedding(
      {
        model: EMBED_MODEL,
        input: text
      },
      {
        purpose: 'content_similarity'
      }
    );
    
    const result: EmbeddingResult = {
      embedding: response.data[0].embedding,
      hash,
      model: response.model,
      tokens: response.usage.total_tokens
    };
    
    // Cache the result
    embeddingCache.set(hash, result);
    cacheTimestamps.set(hash, Date.now());
    
    log(`EMBEDDING_SUCCESS: hash=${hash} tokens=${result.tokens} model=${result.model}`);
    return result;
    
  } catch (err: any) {
    error(`EMBEDDING_ERROR: hash=${hash}: ${err.message}`);
    throw err;
  }
}

/**
 * Generate embeddings for multiple texts efficiently
 */
export async function embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
  if (texts.length === 0) return [];
  
  log(`EMBEDDING_BATCH: Processing ${texts.length} texts`);
  
  // Generate hashes and check cache
  const results: EmbeddingResult[] = [];
  const uncachedTexts: string[] = [];
  const uncachedHashes: string[] = [];
  const uncachedIndices: number[] = [];
  
  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    const hash = generateContentHash(text);
    
    cleanCache();
    const cached = embeddingCache.get(hash);
    if (cached) {
      results[i] = cached;
    } else {
      uncachedTexts.push(text);
      uncachedHashes.push(hash);
      uncachedIndices.push(i);
    }
  }
  
  // Process uncached embeddings in batches
  if (uncachedTexts.length > 0) {
    log(`EMBEDDING_BATCH_API: ${uncachedTexts.length} new embeddings needed`);
    
    try {
      // OpenAI embeddings API supports up to 2048 inputs per request
      const BATCH_SIZE = 100; // Conservative batch size
      
      for (let batchStart = 0; batchStart < uncachedTexts.length; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, uncachedTexts.length);
        const batchTexts = uncachedTexts.slice(batchStart, batchEnd);
        const batchHashes = uncachedHashes.slice(batchStart, batchEnd);
        const batchIndices = uncachedIndices.slice(batchStart, batchEnd);
        
        const response = await createBudgetedEmbedding(
          {
            model: EMBED_MODEL,
            input: batchTexts
          },
          {
            purpose: 'content_similarity_batch'
          }
        );
        
        // Process batch results
        for (let i = 0; i < batchTexts.length; i++) {
          const embedding = response.data[i].embedding;
          const hash = batchHashes[i];
          const originalIndex = batchIndices[i];
          
          const result: EmbeddingResult = {
            embedding,
            hash,
            model: response.model,
            tokens: Math.ceil(response.usage.total_tokens / batchTexts.length) // Approximate per-text tokens
          };
          
          // Cache and store
          embeddingCache.set(hash, result);
          cacheTimestamps.set(hash, Date.now());
          results[originalIndex] = result;
        }
        
        log(`EMBEDDING_BATCH_SUCCESS: batch ${batchStart + 1}-${batchEnd} completed`);
      }
      
    } catch (err: any) {
      error(`EMBEDDING_BATCH_ERROR: ${err.message}`);
      throw err;
    }
  }
  
  log(`EMBEDDING_BATCH_COMPLETE: ${texts.length} embeddings processed`);
  return results;
}

/**
 * Store embedding in database
 */
export async function storeEmbedding(
  postId: string,
  hash: string,
  embedding: number[]
): Promise<void> {
  try {
    // Try to store in content_metadata first (if it has embedding column)
    const { error: metadataError } = await supabase
      .from('content_metadata')
      .update({
        embedding,
        content_hash: hash
      })
      .eq('content_id', postId);
    
    if (metadataError) {
      // Fallback to content_embeddings table
      const { error: embeddingError } = await supabase
        .from('content_embeddings')
        .upsert({
          post_id: postId,
          content_hash: hash,
          embedding
        }, {
          onConflict: 'content_hash'
        });
      
      if (embeddingError) {
        warn(`EMBEDDING_STORE_ERROR: postId=${postId} hash=${hash}: ${embeddingError.message}`);
      } else {
        log(`EMBEDDING_STORED: postId=${postId} hash=${hash} (fallback table)`);
      }
    } else {
      log(`EMBEDDING_STORED: postId=${postId} hash=${hash} (metadata table)`);
    }
    
  } catch (err: any) {
    error(`EMBEDDING_STORE_EXCEPTION: postId=${postId} hash=${hash}: ${err.message}`);
  }
}

/**
 * Find similar content within the duplicate window
 */
export async function findSimilarContent(
  text: string,
  windowDays: number = DUP_WINDOW_DAYS,
  threshold: number = SIMILARITY_THRESHOLD
): Promise<SimilarityResult[]> {
  const hash = generateContentHash(text);
  const targetEmbedding = await getEmbeddingCached(text, hash);
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - windowDays);
  
  log(`SIMILARITY_SEARCH: hash=${hash} window=${windowDays}d threshold=${threshold}`);
  
  try {
    // Try content_metadata first
    const { data: metadataResults, error: metadataError } = await supabase
      .from('content_metadata')
      .select('content_hash, embedding, created_at')
      .not('embedding', 'is', null)
      .gte('created_at', cutoffDate.toISOString())
      .neq('content_hash', hash);
    
    let results: SimilarityResult[] = [];
    
    if (!metadataError && metadataResults) {
      results = metadataResults
        .map(row => ({
          contentHash: row.content_hash,
          similarity: cosine(targetEmbedding.embedding, row.embedding),
          createdAt: new Date(row.created_at)
        }))
        .filter(result => result.similarity >= threshold);
    }
    
    // If no results from metadata, try content_embeddings
    if (results.length === 0) {
      const { data: embeddingResults, error: embeddingError } = await supabase
        .from('content_embeddings')
        .select('content_hash, embedding, created_at')
        .gte('created_at', cutoffDate.toISOString())
        .neq('content_hash', hash);
      
      if (!embeddingError && embeddingResults) {
        results = embeddingResults
          .map(row => ({
            contentHash: row.content_hash,
            similarity: cosine(targetEmbedding.embedding, row.embedding),
            createdAt: new Date(row.created_at)
          }))
          .filter(result => result.similarity >= threshold);
      }
    }
    
    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);
    
    log(`SIMILARITY_SEARCH_COMPLETE: found ${results.length} similar items`);
    return results;
    
  } catch (err: any) {
    error(`SIMILARITY_SEARCH_ERROR: hash=${hash}: ${err.message}`);
    return [];
  }
}

/**
 * Check if content is a duplicate
 */
export async function isDuplicate(
  text: string,
  windowDays: number = DUP_WINDOW_DAYS,
  threshold: number = SIMILARITY_THRESHOLD
): Promise<{
  isDuplicate: boolean;
  maxSimilarity: number;
  similarCount: number;
}> {
  const similarContent = await findSimilarContent(text, windowDays, threshold);
  
  const maxSimilarity = similarContent.length > 0 
    ? Math.max(...similarContent.map(s => s.similarity))
    : 0;
  
  const isDup = maxSimilarity >= threshold;
  
  log(`DUPLICATE_CHECK: isDuplicate=${isDup} maxSimilarity=${maxSimilarity.toFixed(3)} count=${similarContent.length}`);
  
  return {
    isDuplicate: isDup,
    maxSimilarity,
    similarCount: similarContent.length
  };
}

/**
 * Generate and store embedding for a post
 */
export async function processPostEmbedding(postId: string, text: string): Promise<string> {
  const hash = generateContentHash(text);
  
  try {
    const embeddingResult = await getEmbeddingCached(text, hash);
    await storeEmbedding(postId, hash, embeddingResult.embedding);
    
    log(`POST_EMBEDDING_PROCESSED: postId=${postId} hash=${hash} tokens=${embeddingResult.tokens}`);
    return hash;
    
  } catch (err: any) {
    error(`POST_EMBEDDING_ERROR: postId=${postId}: ${err.message}`);
    throw err;
  }
}

/**
 * Batch process embeddings for existing posts
 */
export async function backfillEmbeddings(limit: number = 100): Promise<{
  processed: number;
  errors: number;
}> {
  log(`EMBEDDING_BACKFILL: Starting backfill for up to ${limit} posts`);
  
  try {
    // Find posts without embeddings
    const { data: posts, error } = await supabase
      .from('unified_posts')
      .select('post_id, content')
      .is('embedding', null)
      .order('posted_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      throw error;
    }
    
    if (!posts || posts.length === 0) {
      log(`EMBEDDING_BACKFILL: No posts need embeddings`);
      return { processed: 0, errors: 0 };
    }
    
    log(`EMBEDDING_BACKFILL: Processing ${posts.length} posts`);
    
    const texts = posts.map(p => p.content);
    const embeddings = await embedBatch(texts);
    
    let processed = 0;
    let errors = 0;
    
    // Store embeddings
    for (let i = 0; i < posts.length; i++) {
      try {
        await storeEmbedding(posts[i].post_id, embeddings[i].hash, embeddings[i].embedding);
        processed++;
      } catch (err) {
        errors++;
        warn(`EMBEDDING_BACKFILL_ITEM_ERROR: postId=${posts[i].post_id} - ${err?.message || 'Unknown error'}`);
      }
    }
    
    log(`EMBEDDING_BACKFILL_COMPLETE: processed=${processed} errors=${errors}`);
    return { processed, errors };
    
  } catch (err: any) {
    error(`EMBEDDING_BACKFILL_ERROR: ${err.message}`);
    throw err;
  }
}
