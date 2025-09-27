/**
 * 🚪 GATE CHAIN
 * Pre-posting validation gates for quality, uniqueness, and rotation
 */

import { getConfig, getModeFlags } from '../config/config';
import { getSupabaseClient } from '../db/index';
import { generateRealEmbedding, calculateCosineSimilarity, storeEmbedding } from '../llm/embeddingService';

export interface GateResult {
  passed: boolean;
  reason?: string;
  gate: string;
}

export interface ContentMetadata {
  decision_id: string;
  topic_cluster?: string;
  content_type?: string;
  quality_score?: number;
}

/**
 * Run all pre-posting validation gates
 */
export async function prePostValidation(content: string, metadata: ContentMetadata): Promise<GateResult> {
  console.log(`[GATE_CHAIN] 🚪 Running validation gates for decision ${metadata.decision_id}`);

  try {
    // Gate 1: Quality Score
    const qualityGate = await validateQualityScore(content, metadata);
    if (!qualityGate.passed) {
      return qualityGate;
    }

    // Gate 2: Uniqueness Check
    const uniquenessGate = await checkUniquenessGate(content, metadata);
    if (!uniquenessGate.passed) {
      return uniquenessGate;
    }

    // Gate 3: Rotation Policy
    const rotationGate = await enforceRotationPolicy(metadata);
    if (!rotationGate.passed) {
      return rotationGate;
    }

    console.log(`[GATE_CHAIN] ✅ All gates passed for decision ${metadata.decision_id}`);
    return { passed: true, gate: 'all' };

  } catch (error) {
    console.error('[GATE_CHAIN] ❌ Gate validation failed:', error.message);
    return {
      passed: false,
      reason: `Gate validation error: ${error.message}`,
      gate: 'error'
    };
  }
}

/**
 * Gate 1: Quality Score Validation
 */
export async function validateQualityScore(content: string, metadata: ContentMetadata): Promise<GateResult> {
  const config = getConfig();
  const minQualityScore = Number(config.MIN_QUALITY_SCORE) || 0.75;

  // First check content safety rules
  const contentSafetyResult = validateContentSafety(content, config);
  if (!contentSafetyResult.passed) {
    return contentSafetyResult;
  }

  const qualityScore = metadata.quality_score || 0;

  if (qualityScore < minQualityScore) {
    console.log(`[GATE_CHAIN] ❌ Quality gate failed: ${qualityScore.toFixed(3)} < ${minQualityScore}`);
    
    // Update metrics
    const { updateMockMetrics } = await import('../api/metrics');
    updateMockMetrics({ qualityBlocksCount: 1 });

    return {
      passed: false,
      reason: `Quality score ${qualityScore.toFixed(3)} below minimum ${minQualityScore}`,
      gate: 'quality'
    };
  }

  console.log(`[GATE_CHAIN] ✅ Quality gate passed: ${qualityScore.toFixed(3)} >= ${minQualityScore}`);
  return { passed: true, gate: 'quality' };
}

/**
 * Content Safety Validation
 */
function validateContentSafety(content: string, config: any): GateResult {
  // Check for hashtags (should be disabled per requirements)
  if (config.FORCE_NO_HASHTAGS === 'true' && content.includes('#')) {
    return {
      passed: false,
      reason: 'Hashtags are disabled by FORCE_NO_HASHTAGS flag',
      gate: 'safety'
    };
  }

  // Check emoji count
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
  const emojiMatches = content.match(emojiRegex);
  const emojiCount = emojiMatches ? emojiMatches.length : 0;
  const maxEmojis = parseInt(config.EMOJI_MAX || '3');

  if (emojiCount > maxEmojis) {
    return {
      passed: false,
      reason: `Too many emojis: ${emojiCount} > ${maxEmojis}`,
      gate: 'safety'
    };
  }

  // Check for length
  if (content.length > 280) {
    return {
      passed: false,
      reason: `Content too long: ${content.length} characters > 280`,
      gate: 'safety'
    };
  }

  return { passed: true, gate: 'safety' };
}

/**
 * Gate 2: Uniqueness Check via Embeddings
 */
export async function checkUniquenessGate(content: string, metadata: ContentMetadata): Promise<GateResult> {
  const config = getConfig();
  const flags = getModeFlags(config);
  const similarityThreshold = 0.85; // Block if similarity >= 85%

  try {
    console.log('[GATE_CHAIN] 🔍 Checking content uniqueness...');

    // Generate embedding for current content
    const currentEmbedding = await generateRealEmbedding(content);
    
    // Store embedding for future comparisons
    if (metadata.decision_id) {
      await storeEmbedding(metadata.decision_id, currentEmbedding, metadata.topic_cluster);
    }

    // Find similar content in last 30 days
    const similarContent = await findSimilarContent(currentEmbedding, similarityThreshold);

    if (similarContent.length > 0) {
      const maxSimilarity = Math.max(...similarContent.map(s => s.similarity));
      
      console.log(`[GATE_CHAIN] ❌ Uniqueness gate failed: ${(maxSimilarity * 100).toFixed(1)}% similarity`);
      
      // Update metrics
      const { updateMockMetrics } = await import('../api/metrics');
      updateMockMetrics({ uniqueBlocksCount: 1 });

      return {
        passed: false,
        reason: `Content too similar to existing post (${(maxSimilarity * 100).toFixed(1)}% similarity)`,
        gate: 'uniqueness'
      };
    }

    console.log('[GATE_CHAIN] ✅ Uniqueness gate passed: content is unique');
    return { passed: true, gate: 'uniqueness' };

  } catch (error) {
    console.error('[GATE_CHAIN] ❌ Uniqueness check failed:', error.message);
    
    // In case of error, allow posting (fail open)
    console.log('[GATE_CHAIN] ⚠️ Uniqueness gate: failing open due to error');
    return { passed: true, gate: 'uniqueness' };
  }
}

/**
 * Gate 3: Rotation Policy Enforcement
 */
export async function enforceRotationPolicy(metadata: ContentMetadata): Promise<GateResult> {
  const topicCluster = metadata.topic_cluster;
  
  if (!topicCluster) {
    // If no topic classification, allow posting
    return { passed: true, gate: 'rotation' };
  }

  try {
    console.log(`[GATE_CHAIN] 🔄 Checking rotation policy for topic: ${topicCluster}`);

    // Check topic distribution in last 7 days
    const topicStats = await getTopicDistribution();
    const totalPosts = Object.values(topicStats).reduce((sum, count) => sum + count, 0);
    
    if (totalPosts === 0) {
      // No recent posts, allow any topic
      return { passed: true, gate: 'rotation' };
    }

    const topicCount = topicStats[topicCluster] || 0;
    const topicPercentage = (topicCount / totalPosts) * 100;
    const maxTopicPercentage = 35; // No topic > 35% of posts in 7 days

    if (topicPercentage >= maxTopicPercentage) {
      console.log(`[GATE_CHAIN] ❌ Rotation gate failed: ${topicCluster} is ${topicPercentage.toFixed(1)}% of recent posts`);
      
      // Update metrics
      const { updateMockMetrics } = await import('../api/metrics');
      updateMockMetrics({ rotationBlocksCount: 1 });

      return {
        passed: false,
        reason: `Topic '${topicCluster}' already ${topicPercentage.toFixed(1)}% of recent posts (max ${maxTopicPercentage}%)`,
        gate: 'rotation'
      };
    }

    console.log(`[GATE_CHAIN] ✅ Rotation gate passed: ${topicCluster} is ${topicPercentage.toFixed(1)}% of recent posts`);
    return { passed: true, gate: 'rotation' };

  } catch (error) {
    console.error('[GATE_CHAIN] ❌ Rotation policy check failed:', error.message);
    
    // Fail open on error
    return { passed: true, gate: 'rotation' };
  }
}

/**
 * Find similar content using embeddings
 */
async function findSimilarContent(embedding: number[], threshold: number): Promise<Array<{similarity: number, decision_id: string}>> {
  try {
    const supabase = getSupabaseClient();

    // Query recent content with embeddings (last 30 days)
    const { data: recentContent, error } = await supabase
      .from('content_metadata')
      .select('decision_id, embedding')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .limit(100);

    if (error || !recentContent) {
      console.log('[GATE_CHAIN] ⚠️ No recent content found for comparison');
      return [];
    }

    // Define interface for proper typing
    interface ContentRow {
      decision_id: unknown;
      embedding: unknown;
    }
    
    const contentRows = recentContent as ContentRow[];
    const similarContent: Array<{similarity: number, decision_id: string}> = [];

    for (const content of contentRows) {
      try {
        const decisionId = String(content.decision_id ?? '');
        let storedEmbedding: number[];
        
        if (Array.isArray(content.embedding)) {
          // pgvector format
          storedEmbedding = content.embedding;
        } else if (typeof content.embedding === 'string') {
          // JSON string fallback
          storedEmbedding = JSON.parse(content.embedding);
        } else {
          continue; // Skip invalid embeddings
        }

        const similarity = calculateCosineSimilarity(embedding, storedEmbedding);
        
        if (similarity >= threshold) {
          similarContent.push({
            similarity,
            decision_id: decisionId
          });
        }
      } catch (parseError) {
        console.warn(`[GATE_CHAIN] ⚠️ Failed to parse embedding for ${content.decision_id}`);
        continue;
      }
    }

    return similarContent.sort((a, b) => b.similarity - a.similarity); // Sort by similarity desc

  } catch (error) {
    console.error('[GATE_CHAIN] ❌ Similar content search failed:', error.message);
    return [];
  }
}

/**
 * Get topic distribution for last 7 days
 */
async function getTopicDistribution(): Promise<Record<string, number>> {
  try {
    const supabase = getSupabaseClient();

    // Query content_metadata for topic distribution
    const { data: topics, error } = await supabase
      .from('content_metadata')
      .select('topic_cluster')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .not('topic_cluster', 'is', null);

    if (error || !topics) {
      console.log('[GATE_CHAIN] ⚠️ No topic data found');
      return {};
    }

    // Define interface for topic rows
    interface TopicRow {
      topic_cluster: unknown;
    }
    
    const topicRows = topics as TopicRow[];
    
    // Count topics
    const distribution: Record<string, number> = {};
    for (const topic of topicRows) {
      const cluster = String(topic.topic_cluster ?? 'unknown');
      distribution[cluster] = (distribution[cluster] || 0) + 1;
    }

    return distribution;

  } catch (error) {
    console.error('[GATE_CHAIN] ❌ Topic distribution query failed:', error.message);
    return {};
  }
}
