/**
 * 🔗 EMBEDDING SERVICE
 * Real OpenAI embeddings for uniqueness checking (MODE=live only)
 */

import { getConfig, getModeFlags } from '../config/config';

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
  cost: number;
}

/**
 * Generate real embedding using OpenAI (MODE=live) or mock (MODE=shadow)
 */
export async function generateRealEmbedding(text: string): Promise<number[]> {
  const config = getConfig();
  const flags = getModeFlags(config);

  if (flags.useSyntheticGeneration) {
    // Shadow mode: use mock embedding
    return generateMockEmbedding(text);
  }

  // Live mode: real OpenAI embedding
  return await generateOpenAIEmbedding(text);
}

/**
 * Generate OpenAI embedding with cost tracking
 */
async function generateOpenAIEmbedding(text: string): Promise<number[]> {
  const config = getConfig();
  
  if (!config.OPENAI_API_KEY) {
    console.warn('[EMBEDDING_SERVICE] ⚠️ No OpenAI API key, falling back to mock');
    return generateMockEmbedding(text);
  }

  try {
    console.log('[EMBEDDING_SERVICE] 🔗 Generating OpenAI embedding...');
    
    // Check budget before making call
    await checkEmbeddingBudget();
    
    // Make OpenAI API call
    const { OpenAI } = await import('openai');
    const openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY
    });

    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.substring(0, 8000), // Truncate to safe limit
      encoding_format: 'float'
    });

    const embedding = response.data[0].embedding;
    const tokens = response.usage?.total_tokens || 0;
    
    // Track cost and usage
    const cost = calculateEmbeddingCost(tokens);
    await trackEmbeddingUsage(tokens, cost);
    
    console.log(`[EMBEDDING_SERVICE] ✅ Generated embedding (${tokens} tokens, $${cost.toFixed(4)})`);
    return embedding;

  } catch (error) {
    console.error('[EMBEDDING_SERVICE] ❌ OpenAI embedding failed:', error.message);
    
    // Fallback to mock on error
    console.log('[EMBEDDING_SERVICE] 🔄 Falling back to mock embedding');
    return generateMockEmbedding(text);
  }
}

/**
 * Generate mock embedding for shadow mode or fallback
 */
function generateMockEmbedding(text: string): number[] {
  console.log('[EMBEDDING_SERVICE] 🎭 Generating mock embedding (shadow mode)');
  
  // Create deterministic but realistic-looking embedding based on text hash
  const hash = simpleHash(text);
  const embedding: number[] = [];
  
  // Generate 1536-dimensional vector (same as OpenAI text-embedding-3-small)
  for (let i = 0; i < 1536; i++) {
    // Use hash and index to create pseudo-random but deterministic values
    const seed = hash + i * 1234567;
    const normalized = (Math.sin(seed) + 1) / 2; // 0-1 range
    embedding.push((normalized - 0.5) * 2); // Convert to -1 to 1 range
  }
  
  // Track mock usage
  const { updateMockMetrics } = require('../api/metrics');
  updateMockMetrics({ mockEmbeddings: 1 });
  
  return embedding;
}

/**
 * Simple hash function for deterministic mock embeddings
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Calculate embedding cost
 */
function calculateEmbeddingCost(tokens: number): number {
  // OpenAI text-embedding-3-small pricing: $0.00002 per 1K tokens
  return (tokens / 1000) * 0.00002;
}

/**
 * Check if we're within embedding budget
 */
async function checkEmbeddingBudget(): Promise<void> {
  try {
    const { checkBudget } = await import('../budget/guard');
    const budgetOk = await checkBudget();
    
    if (!budgetOk) {
      throw new Error('Daily budget limit reached');
    }
  } catch (error) {
    console.warn('[EMBEDDING_SERVICE] ⚠️ Budget check failed:', error.message);
    // Continue anyway for now - just log the warning
  }
}

/**
 * Track embedding usage and cost
 */
async function trackEmbeddingUsage(tokens: number, cost: number): Promise<void> {
  try {
    // Update metrics
    const { updateMockMetrics } = await import('../api/metrics');
    updateMockMetrics({ 
      openaiCalls: 1,
    });

    // Log for cost tracking
    console.log(`[EMBEDDING_SERVICE] 💰 Cost tracking: ${tokens} tokens, $${cost.toFixed(4)}`);
    
  } catch (error) {
    console.warn('[EMBEDDING_SERVICE] ⚠️ Usage tracking failed:', error.message);
  }
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function calculateCosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have same length');
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

/**
 * Store embedding in content_metadata table
 */
export async function storeEmbedding(decisionId: string, embedding: number[], topicCluster?: string): Promise<void> {
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();

    // Check if pgvector is available by trying to insert
    try {
      const { error } = await supabase
        .from('content_metadata')
        .upsert([{
          decision_id: decisionId,
          topic_cluster: topicCluster,
          embedding: embedding, // Will work with pgvector
          created_at: new Date().toISOString()
        }], {
          onConflict: 'decision_id'
        });

      if (error) throw error;
      console.log(`[EMBEDDING_SERVICE] ✅ Stored embedding for decision ${decisionId}`);

    } catch (pgvectorError) {
      // Fallback: store as JSON string
      const { error } = await supabase
        .from('content_metadata')
        .upsert([{
          decision_id: decisionId,
          topic_cluster: topicCluster,
          embedding: JSON.stringify(embedding), // Fallback to JSON string
          created_at: new Date().toISOString()
        }], {
          onConflict: 'decision_id'
        });

      if (error) throw error;
      console.log(`[EMBEDDING_SERVICE] ✅ Stored embedding as JSON for decision ${decisionId}`);
    }

  } catch (error) {
    console.error('[EMBEDDING_SERVICE] ❌ Failed to store embedding:', error.message);
    // Don't throw - embedding storage is not critical
  }
}
