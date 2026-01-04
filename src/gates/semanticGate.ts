/**
 * SEMANTIC GATE
 * 
 * Blocks replies that are semantically unrelated to the target tweet.
 * Uses cosine similarity on word vectors as a lightweight check.
 */

import { getSupabaseClient } from '../db';

export interface SemanticGateResult {
  pass: boolean;
  similarity: number;
  reason: string;
  target_preview?: string;
  reply_preview?: string;
}

/**
 * Compute cosine similarity between two texts using simple word overlap
 * (Lightweight alternative to embeddings)
 */
export function computeSemanticSimilarity(targetText: string, replyText: string): number {
  // Extract meaningful words (filter stopwords, min length 3)
  const stopwords = new Set(['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with', 'to', 'for', 'of', 'as', 'by', 'from', 'this', 'that', 'are', 'was', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'can', 'it', 'its', 'they', 'them', 'their', 'we', 'our', 'you', 'your']);
  
  const extractWords = (text: string): string[] => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !stopwords.has(w));
  };
  
  const targetWords = extractWords(targetText);
  const replyWords = extractWords(replyText);
  
  if (targetWords.length === 0 || replyWords.length === 0) {
    return 0;
  }
  
  // Count word frequency
  const targetFreq = new Map<string, number>();
  const replyFreq = new Map<string, number>();
  
  targetWords.forEach(w => targetFreq.set(w, (targetFreq.get(w) || 0) + 1));
  replyWords.forEach(w => replyFreq.set(w, (replyFreq.get(w) || 0) + 1));
  
  // Compute dot product and magnitudes
  let dotProduct = 0;
  let targetMag = 0;
  let replyMag = 0;
  
  const allWords = new Set([...targetWords, ...replyWords]);
  
  for (const word of allWords) {
    const targetCount = targetFreq.get(word) || 0;
    const replyCount = replyFreq.get(word) || 0;
    
    dotProduct += targetCount * replyCount;
    targetMag += targetCount * targetCount;
    replyMag += replyCount * replyCount;
  }
  
  if (targetMag === 0 || replyMag === 0) {
    return 0;
  }
  
  return dotProduct / (Math.sqrt(targetMag) * Math.sqrt(replyMag));
}

/**
 * Extract topic/domain keywords from text
 */
function extractTopicKeywords(text: string): Set<string> {
  const healthKeywords = ['health', 'medical', 'diet', 'nutrition', 'exercise', 'sleep', 'wellness', 'fitness', 'mental', 'physical', 'therapy', 'treatment', 'disease', 'symptom', 'doctor', 'patient', 'study', 'research', 'brain', 'heart', 'immune', 'gut', 'hormone', 'vitamin', 'supplement', 'protein', 'carb', 'fat', 'weight', 'muscle', 'cardio', 'stress', 'anxiety', 'depression', 'mindfulness', 'meditation', 'yoga'];
  
  const techKeywords = ['app', 'software', 'ai', 'code', 'tech', 'data', 'algorithm', 'api', 'platform', 'system', 'digital', 'computer', 'programming', 'developer', 'engineer', 'product', 'feature', 'update', 'release', 'beta', 'launch', 'build', 'design', 'interface', 'user', 'mobile', 'web', 'cloud', 'server', 'database'];
  
  const words = text.toLowerCase().split(/\s+/);
  const topics = new Set<string>();
  
  for (const word of words) {
    if (healthKeywords.some(k => word.includes(k))) topics.add('health');
    if (techKeywords.some(k => word.includes(k))) topics.add('tech');
  }
  
  return topics;
}

/**
 * Check if reply is semantically related to target tweet
 */
export async function checkSemanticGate(
  targetText: string,
  replyText: string,
  minSimilarity: number = parseFloat(process.env.SEMANTIC_GATE_MIN_SIMILARITY || '0.25')
): Promise<SemanticGateResult> {
  
  // Compute similarity
  const similarity = computeSemanticSimilarity(targetText, replyText);
  
  // Extract topics
  const targetTopics = extractTopicKeywords(targetText);
  const replyTopics = extractTopicKeywords(replyText);
  
  // Topic overlap check
  const topicOverlap = Array.from(targetTopics).some(t => replyTopics.has(t));
  
  console.log(`[SEMANTIC_GATE] similarity=${(similarity * 100).toFixed(1)}% min=${(minSimilarity * 100).toFixed(0)}% target_topics=[${Array.from(targetTopics).join(',')}] reply_topics=[${Array.from(replyTopics).join(',')}] topic_overlap=${topicOverlap}`);
  
  // Pass if either:
  // 1. High word similarity (>= minSimilarity)
  // 2. Topic overlap exists (same domain)
  if (similarity >= minSimilarity || topicOverlap) {
    return {
      pass: true,
      similarity,
      reason: similarity >= minSimilarity ? 'high_word_similarity' : 'topic_overlap',
      target_preview: targetText.substring(0, 60),
      reply_preview: replyText.substring(0, 60)
    };
  }
  
  // Fail - unrelated
  console.log(`[SEMANTIC_GATE] ⛔ UNRELATED REPLY BLOCKED`);
  console.log(`[SEMANTIC_GATE]   Target: "${targetText.substring(0, 80)}..."`);
  console.log(`[SEMANTIC_GATE]   Reply:  "${replyText.substring(0, 80)}..."`);
  
  return {
    pass: false,
    similarity,
    reason: 'low_similarity_no_topic_overlap',
    target_preview: targetText.substring(0, 60),
    reply_preview: replyText.substring(0, 60)
  };
}

