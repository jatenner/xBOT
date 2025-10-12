/**
 * 📝 PLAN JOB - Enhanced Content Planning
 * 
 * Generates high-quality, contrarian health content using enhanced generation system
 * Respects AI_QUOTA_CIRCUIT_OPEN and MODE flags
 */

import { v4 as uuidv4 } from 'uuid';
import { getEnvConfig, isLLMAllowed } from '../config/envFlags';

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
  console.log('🚀 ENHANCED_GENERATION: Using contrarian content system...');
  
  try {
    // Use the enhanced content generator
    const { generateEnhancedContent } = await import('../ai/enhancedContentGenerator');
    
    const enhancedContent = await generateEnhancedContent({
      style: 'contrarian',
      format: 'single'
    });
    
    console.log(`✅ ENHANCED_CONTENT: Topic: ${enhancedContent.topic}, Quality: ${enhancedContent.quality_score.toFixed(3)}`);
    console.log(`🎯 ANGLE: ${enhancedContent.angle}`);
    console.log(`🔍 UNIQUENESS: ${enhancedContent.uniqueness_indicators.join(', ')}`);
    
    // Generate decision ID and timing
    const decision_id = uuidv4();
    
    // Calculate optimal scheduling (30-90 minutes from now)
    const delayMinutes = 30 + Math.random() * 60;
    const scheduledTime = new Date(Date.now() + delayMinutes * 60 * 1000);
    
    const decision: ContentDecision = {
      decision_id,
      decision_type: 'content',
      content: enhancedContent.content,
      bandit_arm: `enhanced_${enhancedContent.topic.replace(/\s+/g, '_')}`,
      timing_arm: 'enhanced_timing',
      scheduled_at: scheduledTime.toISOString(),
      quality_score: Math.min(1.0, Math.max(0.0, enhancedContent.quality_score)),
      predicted_er: Math.min(1.0, Math.max(0.0, 0.035 + (enhancedContent.quality_score * 0.02))),
      topic_cluster: enhancedContent.topic,
      generation_source: 'enhanced',
      // Advanced metadata
      enhanced_generation: true,
      uniqueness_indicators: enhancedContent.uniqueness_indicators,
      contrarian_angle: enhancedContent.angle
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
    // Remove the 'angle' field since it doesn't exist in the database
    features: {
      enhanced_generation: decision.enhanced_generation,
      uniqueness_indicators: decision.uniqueness_indicators,
      contrarian_angle: decision.contrarian_angle // Store angle in features instead
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