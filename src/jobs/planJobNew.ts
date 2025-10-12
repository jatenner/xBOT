/**
 * 📝 PLAN JOB - Enhanced Content Planning
 * 
 * Generates high-quality, contrarian health content using enhanced generation system
 * Respects AI_QUOTA_CIRCUIT_OPEN and MODE flags
 */

import { v4 as uuidv4 } from 'uuid';
import { getEnvConfig, isLLMAllowed } from '../config/envFlags';
import { learningSystem } from '../learning/learningSystem';
import { masterContentGenerator } from '../ai/masterContentGenerator';

function getConfig() {
  return getEnvConfig();
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
  scheduled_at: string;
  quality_score: number;
  predicted_er: number;
  topic_cluster: string;
  generation_source: string;
  // Advanced learning metadata
  enhanced_generation?: boolean;
  uniqueness_indicators?: string[];
  contrarian_angle?: string;
  content_format?: 'single' | 'thread'; // Track format for learning
  thread_tweets?: string[]; // Store individual tweets for threads
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
  
  console.log(`[PLAN_JOB] 📝 Starting enhanced content planning (MODE=${flags.MODE})...`);
  
  try {
    if (flags.MODE === 'shadow') {
      // Shadow mode: generate synthetic content
      await generateSyntheticContent();
    } else {
      // Live mode: generate real content using enhanced system
      await generateRealContent();
    }
  } catch (error: any) {
    console.error('[PLAN_JOB] ❌ Content planning failed:', error.message);
    throw error;
  }
}

async function generateSyntheticContent(): Promise<void> {
  console.log('[PLAN_JOB] 🎭 Generating synthetic content for shadow mode...');
  
  const syntheticDecisions: ContentDecision[] = [];
  
  for (let i = 0; i < 3; i++) {
    const decision_id = uuidv4();
    const scheduledTime = new Date(Date.now() + (i * 30 + 30) * 60 * 1000);
    
    syntheticDecisions.push({
      decision_id,
      decision_type: 'content',
      content: `Synthetic health insight #${i + 1}: Evidence-based approach to wellness optimization.`,
      bandit_arm: `synthetic_health_${i}`,
      timing_arm: 'synthetic_timing',
      scheduled_at: scheduledTime.toISOString(),
      quality_score: 0.7 + (Math.random() * 0.2),
      predicted_er: 0.03 + (Math.random() * 0.02),
      topic_cluster: 'synthetic_health',
      generation_source: 'synthetic'
    });
  }
  
  await storeContentDecisions(syntheticDecisions);
  console.log(`[PLAN_JOB] 🎭 Generated ${syntheticDecisions.length} synthetic decisions`);
}

async function generateRealContent(): Promise<void> {
  const llmCheck = isLLMAllowed();
  if (!llmCheck.allowed) {
    console.log(`[PLAN_JOB] ⏭️ LLM blocked: ${llmCheck.reason}`);
    return;
  }
  
  console.log('[PLAN_JOB] 🧠 Generating real content using enhanced system...');
  
  const decisions: ContentDecision[] = [];
  const numToGenerate = 3;
  
  for (let i = 0; i < numToGenerate; i++) {
    try {
      const decision = await generateContentWithLLM();
      decisions.push(decision);
      
      console.log(`[PLAN_JOB] ✅ Enhanced content generated: "${decision.content.substring(0, 50)}..."`);
      
    } catch (error: any) {
      planMetrics.calls_failed++;
      console.error(`[PLAN_JOB] ❌ Enhanced generation failed: ${error.message}`);
    }
  }
  
  if (decisions.length > 0) {
    await storeContentDecisions(decisions);
    console.log(`[PLAN_JOB] 📊 Generated ${decisions.length} enhanced content items`);
  }
}

/**
 * Generate content using ENHANCED CONTENT GENERATION SYSTEM
 */
async function generateContentWithLLM(): Promise<ContentDecision> {
  console.log('🚀 MASTER_GENERATOR: Using follower-optimized content system...');
  
  try {
    const masterContent = await masterContentGenerator.generateMasterContent({
      primary_goal: 'followers',
      secondary_goal: 'viral',
      target_audience: 'health_seekers',
      format_preference: 'auto', // Let system choose optimal format
      viral_target: 'high',
      use_evolved_hooks: true,
      apply_viral_formulas: true,
      optimize_for_followers: true
    });

    console.log(`✅ MASTER_CONTENT: Generated ${masterContent.format} content`);
    console.log(`🎯 PREDICTIONS: Followers: ${masterContent.expected_outcomes.followers_gained_prediction}, Engagement: ${(masterContent.expected_outcomes.engagement_rate_prediction * 100).toFixed(1)}%, Viral: ${masterContent.expected_outcomes.viral_coefficient_prediction.toFixed(3)}`);
    console.log(`🧬 HOOK: "${masterContent.hook_used.hook_text}" (Gen ${masterContent.hook_used.evolution_generation})`);
    console.log(`🔥 FORMULA: ${masterContent.viral_formula_applied.formula_name} (${(masterContent.viral_formula_applied.success_rate * 100).toFixed(1)}% success rate)`);
    
    // Generate decision ID and timing
    const decision_id = uuidv4();
    
    // Calculate optimal scheduling (30-90 minutes from now)
    const delayMinutes = 30 + Math.random() * 60;
    const scheduledTime = new Date(Date.now() + delayMinutes * 60 * 1000);
    
    // Handle both single tweets and threads
    const contentText = Array.isArray(masterContent.content) 
      ? masterContent.content.join('\n\n') // Join thread tweets with double newlines
      : masterContent.content;
    
    // Prepare predictions for learning system
    const predictedMetrics = {
      engagement_rate: masterContent.expected_outcomes.engagement_rate_prediction,
      viral_potential: masterContent.expected_outcomes.viral_coefficient_prediction,
      optimal_timing: scheduledTime.toISOString()
    };
    
    const contentMetadata = {
      topic: 'health_optimization',
      format: masterContent.format,
      hook_type: masterContent.hook_used.hook_category,
      evidence_type: 'statistical_evidence',
      has_statistics: masterContent.content_characteristics.has_statistics,
      has_controversy: masterContent.content_characteristics.has_controversy,
      // Master content specific metadata
      generation_method: masterContent.generation_method,
      hook_evolution_generation: masterContent.hook_used.evolution_generation,
      viral_formula_used: masterContent.viral_formula_applied.formula_name,
      follower_magnet_score: masterContent.follower_magnet_score,
      confidence_score: masterContent.confidence_score
    };
    
    // Process with learning system
    await learningSystem.processNewPost(
      decision_id,
      contentText,
      predictedMetrics,
      contentMetadata
    );
    
    const decision: ContentDecision = {
      decision_id,
      decision_type: 'content',
      content: contentText,
      bandit_arm: `master_${masterContent.generation_method}_${masterContent.format}`,
      timing_arm: 'master_timing',
      scheduled_at: scheduledTime.toISOString(),
      quality_score: masterContent.confidence_score,
      predicted_er: predictedMetrics.engagement_rate,
      topic_cluster: 'health_optimization',
      generation_source: 'master',
      // Advanced metadata
      enhanced_generation: true,
      uniqueness_indicators: masterContent.content_characteristics.credibility_signals,
      contrarian_angle: masterContent.hook_used.hook_text,
      content_format: masterContent.format,
      thread_tweets: Array.isArray(masterContent.content) ? masterContent.content : undefined
    };

    planMetrics.calls_success++;
    return decision;
    
  } catch (error: any) {
    console.error(`[ENHANCED_GENERATION] ❌ Enhanced generation failed: ${error.message}`);
    
    // Fallback to basic generation
    console.log('[ENHANCED_GENERATION] 🔄 Falling back to basic generation...');
    
    const decision_id = uuidv4();
    
    const fallbackContent = {
      text: `New research challenges common health assumptions. Here's what the data actually shows about optimizing your daily habits for better outcomes.`,
      topic: 'health optimization',
      angle: 'evidence-based approach'
    };
    
    const decision: ContentDecision = {
      decision_id,
      decision_type: 'content',
      content: fallbackContent.text,
      bandit_arm: 'fallback_health',
      timing_arm: 'fallback_timing',
      scheduled_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      quality_score: 0.5,
      predicted_er: 0.025,
      topic_cluster: fallbackContent.topic,
      generation_source: 'fallback'
    };
    
    return decision;
  }
}

/**
 * Store content decisions in database
 */
async function storeContentDecisions(decisions: ContentDecision[]): Promise<void> {
  if (decisions.length === 0) return;
  
  const supabase = getSupabaseClient();
  
  const dbRows = decisions.map(decision => ({
    id: decision.decision_id, // Use 'id' instead of 'decision_id'
    content_id: decision.decision_id, // Also set content_id for compatibility
    decision_type: decision.decision_type,
    content: decision.content,
    bandit_arm: decision.bandit_arm,
    timing_arm: decision.timing_arm,
    scheduled_at: decision.scheduled_at,
    status: 'queued',
    quality_score: Math.round(decision.quality_score * 100), // Convert to integer (0-100)
    predicted_er: decision.predicted_er,
    topic_cluster: decision.topic_cluster,
    topic: decision.topic_cluster, // Also set topic for compatibility
    generation_source: decision.generation_source,
    style: 'contrarian', // Set required style field
    fact_source: 'enhanced_llm', // Set required fact_source field
    hook_type: 'myth_buster', // Set required hook_type field
    cta_type: 'follow_for_more', // Set required cta_type field
    predicted_engagement: 'high', // Set required predicted_engagement field
    // Store thread and format metadata in features JSONB column
    features: {
      enhanced_generation: decision.enhanced_generation,
      uniqueness_indicators: decision.uniqueness_indicators,
      contrarian_angle: decision.contrarian_angle,
      content_format: decision.content_format, // 'single' or 'thread'
      thread_tweets: decision.thread_tweets, // Individual tweets for threads
      is_thread: decision.content_format === 'thread'
    }
  }));
  
  const { error } = await supabase
    .from('content_metadata')
    .insert(dbRows);
  
  if (error) {
    console.error('[PLAN_JOB] ❌ Failed to store decisions:', error.message);
    throw new Error(`Database storage failed: ${error.message}`);
  }
  
  console.log(`[PLAN_JOB] ✅ Stored ${decisions.length} decisions in database`);
}