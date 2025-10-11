/**
 * 📝 PLAN JOB - Autonomous Content Planning
 * 
 * Generates content decisions and queues them for posting
 * Respects AI_QUOTA_CIRCUIT_OPEN and MODE flags
 */

import { v4 as uuidv4 } from 'uuid';
import { getEnvFlags, isLLMAllowed } from '../config/envFlags';

function getConfig() {
  return getEnvFlags();
}

// Add missing imports for advanced functions
function hashContent(content: string): string {
  // Simple hash function for content
  return Buffer.from(content).toString('base64').slice(0, 16);
}

import { getSupabaseClient } from '../db/index';

interface ContentDecision {
  decision_id: string;
  decision_type: 'content';
  content: string;
  bandit_arm: string;
  timing_arm: string;
  quality_score: number;
  predicted_er: number;
  generation_source: 'real' | 'synthetic';
  status: 'queued' | 'skipped';
  scheduled_at: Date;
  topic_cluster?: string;
  angle?: string;
  content_hash?: string;
  skip_reason?: string;
  metadata?: any; // Advanced learning metadata
}

// Global metrics
let planMetrics = {
  calls_total: 0,
  calls_success: 0,
  calls_failed: 0,
  failure_reasons: {} as Record<string, number>
};

export function getPlanMetrics() {
  return { ...planMetrics };
}

/**
 * Main planning job
 */
export async function planContent(): Promise<void> {
  const flags = getConfig();
  
  console.log(`[PLAN_JOB] 📝 Starting content planning (MODE=${flags.MODE})...`);
  
  try {
    if (flags.MODE === 'shadow') {
      // Shadow mode: generate synthetic content
      await generateSyntheticContent();
    } else {
      // Live mode: generate real LLM content
      await generateRealContent();
    }
    
    console.log('[PLAN_JOB] ✅ Content planning completed');
  } catch (error: any) {
    console.error('[PLAN_JOB] ❌ Planning failed:', error.message);
    throw error;
  }
}

/**
 * Generate synthetic content (shadow mode only)
 */
async function generateSyntheticContent(): Promise<void> {
  console.log('[PLAN_JOB] 🎭 Generating synthetic content for shadow mode...');
  
  const mockContent: ContentDecision[] = [
    {
      decision_id: uuidv4(),
      decision_type: 'single',
      content: "Health tip: Stay hydrated! Your body needs water for optimal function.",
      bandit_arm: "educational",
      timing_arm: "morning",
      quality_score: 0.82,
      predicted_er: 0.034,
      generation_source: 'synthetic',
      status: 'queued',
      scheduled_at: new Date(Date.now() + 60 * 60 * 1000),
      topic_cluster: "hydration",
      angle: "basic_health",
      content_hash: hashContent("Health tip: Stay hydrated! Your body needs water for optimal function.")
    }
  ];
  
  // Store synthetic content
  await storeContentDecisions(mockContent);
  console.log(`[PLAN_JOB] 📊 Generated ${mockContent.length} synthetic content items`);
}

/**
 * Generate real LLM content (live mode)
 */
async function generateRealContent(): Promise<void> {
  const llmCheck = isLLMAllowed();
  
  if (!llmCheck.allowed) {
    console.log(`[PLAN_JOB] ⏭️ LLM blocked: ${llmCheck.reason}`);
    return;
  }
  
  console.log('[PLAN_JOB] 🧠 Generating real content using LLM...');
  
  const decisions: ContentDecision[] = [];
  const numToGenerate = 3;
  
  for (let i = 0; i < numToGenerate; i++) {
    try {
      planMetrics.calls_total++;
      
      // Generate content via OpenAI
      const generated = await generateContentWithLLM();
      
      // Run gate chain
      const gateResult = await runGateChain(generated);
      
      if (!gateResult.passed) {
        console.log(`[GATE_CHAIN] ⛔ Blocked (${gateResult.gate}) decision_id=${generated.decision_id}, reason=${gateResult.reason}, score=${gateResult.score}`);
        
        // In live mode, fail-closed: mark as skipped
        const skippedDecision: ContentDecision = {
          ...generated,
          status: 'skipped',
          skip_reason: `gate_${gateResult.gate}: ${gateResult.reason}`
        };
        
        await storeContentDecisions([skippedDecision]);
        continue;
      }
      
      // Passed gates: queue for posting
      decisions.push(generated);
      planMetrics.calls_success++;
      
      console.log(`[PLAN_JOB] ✅ Real LLM content generated (decision_id=${generated.decision_id}, status=queued, scheduled_at=${generated.scheduled_at.toISOString()})`);
      
    } catch (error: any) {
      planMetrics.calls_failed++;
      const errorType = categorizeError(error);
      planMetrics.failure_reasons[errorType] = (planMetrics.failure_reasons[errorType] || 0) + 1;
      
      console.error(`[PLAN_JOB] ❌ LLM generation failed: ${error.message}`);
      
      // In live mode: do NOT queue synthetic fallback
      console.log('[PLAN_JOB] OpenAI failed, not queueing real content');
    }
  }
  
  if (decisions.length > 0) {
    await storeContentDecisions(decisions);
    console.log(`[PLAN_JOB] 📊 Generated ${decisions.length} real content items`);
  }
}

/**
 * Generate content using ADVANCED FOLLOWER GROWTH ALGORITHMS
 */
async function generateContentWithLLM(): Promise<ContentDecision> {
  console.log('🚀 ADVANCED_GENERATION: Using FollowerGrowthService + ML optimization...');
  
  // 🎯 STEP 1: Use FollowerGrowthService for viral content optimization
  const { getFollowerGrowthService } = await import('../services/followerGrowthService');
  const followerGrowthService = getFollowerGrowthService();
  
  try {
    // Generate follower-optimized content using advanced algorithms
    const optimizedContent = await followerGrowthService.optimizeForFollowerGrowth();
    
    console.log(`✅ FOLLOWER_OPTIMIZED: Expected ${optimizedContent.expectedFollowers} followers, viral potential: ${optimizedContent.viralPotential}/10`);
    console.log(`🎯 STRATEGY: ${optimizedContent.strategy}`);
    
    // 🎯 STEP 2: Use EngagementOptimizer for viral prediction
    const { getEngagementOptimizer } = await import('../intelligence/engagementOptimizer');
    const engagementOptimizer = getEngagementOptimizer();
    
    const contentText = Array.isArray(optimizedContent.content) 
      ? optimizedContent.content[0] // Use first part for single posts
      : optimizedContent.content;
    
    const viralPrediction = await engagementOptimizer.predictViralPotential(contentText);
    
    console.log(`📊 VIRAL_PREDICTION: ${viralPrediction.predicted_followers} followers, ${viralPrediction.predicted_likes} likes`);
    console.log(`🔥 VIRAL_PROBABILITY: ${Math.round(viralPrediction.viral_probability * 100)}%`);
    
    const contentData = {
      text: contentText,
      topic: 'follower-optimized health content',
      angle: optimizedContent.strategy,
      format: optimizedContent.isThread ? 'thread' : 'single',
      // Advanced metadata for learning
      followerOptimized: true,
      expectedFollowers: optimizedContent.expectedFollowers,
      viralPotential: optimizedContent.viralPotential,
      viralPrediction: viralPrediction,
      strategy: optimizedContent.strategy
    };
    
    console.log('🧠 ADVANCED_CONTENT_GENERATED: Using ML-optimized follower magnet content');
    
  } catch (error: any) {
    console.error('❌ ADVANCED_GENERATION failed, falling back to basic LLM:', error.message);
    
    // Fallback to basic generation if advanced systems fail
    const { OpenAIService } = await import('../services/openAIService');
    const openaiService = OpenAIService.getInstance();
    const flags = getConfig();
    
    const prompt = `Generate a high-quality health-focused Twitter post optimized for MAXIMUM FOLLOWER GROWTH:
- Use viral hooks and psychological triggers
- Educational but highly engaging
- Under 280 characters
- Designed to make people want to follow for more content
- Include authority signals and social proof

Format your response as JSON:
{
  "text": "Your viral tweet text here",
  "topic": "specific health topic",
  "angle": "viral hook or perspective",
  "format": "single|thread"
}`;

    const response = await openaiService.chatCompletion([
      {
        role: 'system',
        content: 'You are a viral content expert who creates health content optimized for maximum follower growth. Focus on hooks that make people want to follow for more insights.'
      },
      {
        role: 'user',
        content: prompt
      }
    ], {
      model: flags.OPENAI_MODEL,
      maxTokens: 300,
      temperature: 0.8,
      response_format: { type: 'json_object' },
      requestType: 'follower_growth_content'
    });

    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) {
      throw new Error('Empty response from OpenAI');
    }

    const contentData = JSON.parse(rawContent);
  }
  
  if (!contentData.text || contentData.text.length > 280) {
    throw new Error('Invalid content: missing text or too long');
  }
  
  // 🎯 STEP 3: Select timing using UCB bandit learning
  const { getUCBTimingBandit } = await import('../schedule/ucbTiming');
  const ucbTiming = getUCBTimingBandit();
  const timingSelection = await ucbTiming.selectTimingWithUCB();
  
  // 🎯 STEP 4: Apply advanced ML predictions for metadata
  const decision_id = uuidv4();
  const scheduledTime = new Date(Date.now() + timingSelection.slot * 60 * 60 * 1000);
  
  console.log(`🎯 ADVANCED_TIMING: Selected slot ${timingSelection.slot} (${timingSelection.reason})`);
  console.log(`⏰ SCHEDULED_FOR: ${scheduledTime.toISOString()}`);
  
  return {
    decision_id,
    decision_type: 'content',
    content: contentData.text,
    scheduled_at: scheduledTime,
    status: 'queued',
    bandit_arm: `health_${contentData.topic}`,
    timing_arm: `slot_${timingSelection.slot}`,
    predicted_er: contentData.viralPrediction?.viral_probability || 0.05,
    quality_score: contentData.viralPotential || 0.8,
    topic_cluster: contentData.topic,
    generation_source: 'real', // Critical: Mark as real for posting queue
    metadata: {
      // Advanced learning metadata
      followerOptimized: contentData.followerOptimized || false,
      expectedFollowers: contentData.expectedFollowers || 5,
      viralPotential: contentData.viralPotential || 7,
      strategy: contentData.strategy || 'viral_health_content',
      viralPrediction: contentData.viralPrediction,
      timingReason: timingSelection.reason,
      generationMethod: 'advanced_ml_algorithms'
    }
  };
}

/**
 * Run gate chain (quality, uniqueness, rotation)
 */
async function runGateChain(decision: ContentDecision): Promise<{
  passed: boolean;
  gate?: string;
  reason?: string;
  score?: number;
}> {
  const flags = getConfig();
  
  // Quality gate
  if (decision.quality_score < flags.MIN_QUALITY_SCORE) {
    return {
      passed: false,
      gate: 'quality',
      reason: 'below_threshold',
      score: decision.quality_score
    };
  }
  
  // Uniqueness gate (check embedding similarity)
  const uniquenessCheck = await checkUniqueness(decision.content);
  if (!uniquenessCheck.passed) {
    return {
      passed: false,
      gate: 'uniqueness',
      reason: uniquenessCheck.reason,
      score: uniquenessCheck.similarity
    };
  }
  
  // Rotation gate (topic/angle distribution)
  const rotationCheck = await checkRotation(decision.topic_cluster, decision.angle);
  if (!rotationCheck.passed) {
    return {
      passed: false,
      gate: 'rotation',
      reason: rotationCheck.reason,
      score: rotationCheck.percentage
    };
  }
  
  return { passed: true };
}

/**
 * Check uniqueness using embeddings
 */
async function checkUniqueness(content: string): Promise<{
  passed: boolean;
  reason?: string;
  similarity?: number;
}> {
  const flags = getConfig();
  const threshold = flags.DUP_COSINE_THRESHOLD || flags.SIMILARITY_THRESHOLD;
  
  try {
    const supabase = getSupabaseClient();
    
    // Get embedding for new content
    const { createEmbedding } = await import('../ai/embeddingService');
    const embedding = await createEmbedding(content);
    
    // Check against recent content (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const { data, error } = await supabase
      .from('content_metadata')
      .select('decision_id, content, embedding')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .not('embedding', 'is', null)
      .limit(100);
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      return { passed: true };
    }
    
    // Calculate cosine similarities
    let maxSimilarity = 0;
    for (const row of data) {
      if (row.embedding) {
        const similarity = cosineSimilarity(embedding, row.embedding);
        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
        }
      }
    }
    
    if (maxSimilarity >= threshold) {
      return {
        passed: false,
        reason: 'too_similar_to_recent',
        similarity: maxSimilarity
      };
    }
    
    return { passed: true, similarity: maxSimilarity };
    
  } catch (error: any) {
    console.warn(`[GATE_CHAIN] ⚠️ Uniqueness check failed: ${error.message}`);
    // Fail-closed in live mode
    return { passed: false, reason: 'check_error' };
  }
}

/**
 * Check rotation policy (topic/angle distribution)
 */
async function checkRotation(topic: string | undefined, angle: string | undefined): Promise<{
  passed: boolean;
  reason?: string;
  percentage?: number;
}> {
  if (!topic) return { passed: true };
  
  try {
    const supabase = getSupabaseClient();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    // Count recent posts
    const { count: totalCount } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString());
    
    // Count posts with this topic
    const { count: topicCount } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('topic_cluster', topic)
      .gte('created_at', sevenDaysAgo.toISOString());
    
    const topicPercentage = totalCount ? (topicCount || 0) / totalCount : 0;
    
    if (topicPercentage > 0.35) {
      return {
        passed: false,
        reason: 'topic_overused',
        percentage: topicPercentage
      };
    }
    
    // Check angle if provided
    if (angle) {
      const { count: angleCount } = await supabase
        .from('content_metadata')
        .select('*', { count: 'exact', head: true })
        .eq('angle', angle)
        .gte('created_at', sevenDaysAgo.toISOString());
      
      const anglePercentage = totalCount ? (angleCount || 0) / totalCount : 0;
      
      if (anglePercentage > 0.40) {
        return {
          passed: false,
          reason: 'angle_overused',
          percentage: anglePercentage
        };
      }
    }
    
    return { passed: true };
    
  } catch (error: any) {
    console.warn(`[GATE_CHAIN] ⚠️ Rotation check failed: ${error.message}`);
    return { passed: true }; // Fail-open for rotation
  }
}

/**
 * Store content decisions to database
 */
async function storeContentDecisions(decisions: ContentDecision[]): Promise<void> {
  const supabase = getSupabaseClient();
  
  const rows = decisions.map(d => ({
    decision_id: d.decision_id,
    decision_type: d.decision_type,
    content: d.content,
    bandit_arm: d.bandit_arm,
    timing_arm: d.timing_arm,
    quality_score: d.quality_score,
    predicted_er: d.predicted_er,
    generation_source: d.generation_source,
    status: d.status,
    scheduled_at: d.scheduled_at.toISOString(),
    topic_cluster: d.topic_cluster,
    angle: d.angle,
    content_hash: d.content_hash,
    skip_reason: d.skip_reason,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));
  
  const { error } = await supabase
    .from('content_metadata')
    .insert(rows);
  
  if (error) {
    console.error('[PLAN_JOB] ❌ Failed to store decisions:', error.message);
    throw error;
  }
}

// Helper functions
function hashContent(content: string): string {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(content).digest('hex');
}

function calculateQualityScore(text: string): number {
  let score = 0.5;
  if (text.length >= 100 && text.length <= 250) score += 0.2;
  if (/\b(study|research|evidence)\b/i.test(text)) score += 0.15;
  if (/\b(try|start|consider)\b/i.test(text)) score += 0.1;
  if (!/\b(amazing|incredible)\b/i.test(text)) score += 0.1;
  if (!/[!]{2,}|[A-Z]{3,}/.test(text)) score += 0.05;
  return Math.min(1.0, score);
}

function predictEngagementRate(text: string, topic: string): number {
  let baseER = 0.02;
  const topicBonus: Record<string, number> = {
    'nutrition': 0.005,
    'exercise': 0.008,
    'mental_health': 0.006,
    'sleep': 0.004,
    'wellness': 0.003
  };
  baseER += topicBonus[topic] || 0;
  if (text.includes('?')) baseER += 0.002;
  if (text.length < 200) baseER += 0.001;
  return Math.min(0.08, baseER);
}

function determineBanditArm(topic: string): string {
  const mapping: Record<string, string> = {
    'nutrition': 'educational',
    'exercise': 'wellness_tip',
    'mental_health': 'fact_sharing',
    'sleep': 'wellness_tip',
    'wellness': 'educational'
  };
  return mapping[topic] || 'educational';
}

function categorizeError(error: any): string {
  const msg = error.message?.toLowerCase() || '';
  if (error.status === 429 || msg.includes('rate_limit')) return 'rate_limit';
  if (error.status === 401 || msg.includes('api_key')) return 'invalid_api_key';
  if (msg.includes('quota')) return 'insufficient_quota';
  if (msg.includes('budget')) return 'budget_exceeded';
  return 'unknown';
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
