/**
 * 📝 PLAN JOB - Enhanced Content Planning
 * 
 * Generates high-quality, contrarian health content using enhanced generation system
 * Respects AI_QUOTA_CIRCUIT_OPEN and MODE flags
 */

import { v4 as uuidv4 } from 'uuid';
import { getEnvConfig, isLLMAllowed } from '../config/envFlags';
import { learningSystem } from '../learning/learningSystem';
import { masterContentGenerator } from '../ai/masterContentGenerator'; // Using minimal version
import { threadMaster } from '../growth/threadMaster';
import { followerGrowthEngine } from '../growth/followerGrowthEngine';

function getConfig() {
  return getEnvConfig();
}

// Add missing imports for advanced functions
function hashContent(content: string): string {
  // Simple hash function for content
  return Buffer.from(content).toString('base64').slice(0, 16);
}

/**
 * Clean robotic patterns from AI-generated content
 * Strips numbered lists, bold formatting, and template phrases
 */
function cleanRoboticPatterns(content: string): string {
  let cleaned = content;
  
  // Remove numbered list formatting (1., 2., 3. etc at start of lines)
  cleaned = cleaned.replace(/^\d+\.\s+/gm, '');
  cleaned = cleaned.replace(/\n\d+\.\s+/g, '\n');
  
  // Remove bold markdown formatting
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
  
  // Remove thread indicators
  cleaned = cleaned.replace(/🧵/g, '');
  cleaned = cleaned.replace(/thread below/gi, '');
  cleaned = cleaned.replace(/\d+\/\d+\s+/g, ''); // Remove 1/5, 2/5 etc
  
  // Replace template phrases with more natural alternatives
  cleaned = cleaned.replace(/Here's everything for free:/gi, 'What you need to know:');
  cleaned = cleaned.replace(/Most people think X, but research shows Y/gi, 'Common belief vs. research:');
  
  // Remove multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  // Trim
  cleaned = cleaned.trim();
  
  console.log('[POST_PROCESS] 🧹 Cleaned robotic patterns from content');
  
  return cleaned;
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
  
  console.log('[PLAN_JOB] 🧠 Generating real content using multi-generator orchestrator...');
  
        // NOTE: AGGRESSIVE GROWTH MODE 🚀
        // Job runs every 2.5 hours and generates 2 posts per run
        // = ~16-20 posts/day generated
        // PLUS: 20-40 strategic replies to titans per day
        // PLUS: 1 viral thread attempt per day
        // Total activity: 40-60 engagements/day (MAXIMUM GROWTH)
        // Quality maintained via viral scoring + quality gates
        
        const decisions: ContentDecision[] = [];
        const numToGenerate = 2; // Generate 2 posts per cycle (AGGRESSIVE MODE)
  
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
 * Generate content using NEW MULTI-GENERATOR ORCHESTRATOR SYSTEM
 */
async function generateContentWithLLM(): Promise<ContentDecision> {
  console.log('🚀 ORCHESTRATOR: Using multi-personality content system...');
  
  try {
    // PHASE 2: Adaptive content selection based on performance
    let topicHint: string | undefined;
    let formatHint: 'single' | 'thread' | undefined;
    
    try {
      const { selectOptimalContent } = await import('../learning/adaptiveSelection');
      const adaptiveDecision = await selectOptimalContent();
      console.log(`[ADAPTIVE] 📊 ${adaptiveDecision.reasoning}`);
      console.log(`[ADAPTIVE] 🎯 Selected: ${adaptiveDecision.topic} (${adaptiveDecision.format}) via ${adaptiveDecision.generator}`);
      
      topicHint = adaptiveDecision.topic;
      formatHint = adaptiveDecision.format;
    } catch (adaptiveError: any) {
      console.warn('[ADAPTIVE] ⚠️ Adaptive selection failed, using defaults:', adaptiveError.message);
    }
    
    // USE NEW ORCHESTRATOR - All intelligence systems integrated
    const { getContentOrchestrator } = await import('../orchestrator/contentOrchestrator');
    const orchestrator = getContentOrchestrator();
    
    const orchestratedContent = await orchestrator.generateContent({
      topicHint,
      formatHint
    });
    
    console.log(`[ORCHESTRATOR] ✅ Generated ${orchestratedContent.format} content using ${orchestratedContent.metadata.generator_used}`);
    
    // Orchestrator already did all the work - just format for storage
    const decision_id = uuidv4();
    
    // Calculate optimal scheduling
    const delayMinutes = 30 + Math.random() * 60;
    const scheduledTime = new Date(Date.now() + delayMinutes * 60 * 1000);
    
    // Handle both single tweets and threads
    const contentText = Array.isArray(orchestratedContent.content) 
      ? orchestratedContent.content.join('\n\n') // Join thread tweets
      : orchestratedContent.content;
    
    // VALIDATE: Ensure content exists and is a string
    if (!contentText || typeof contentText !== 'string' || contentText.trim().length === 0) {
      console.error('[ORCHESTRATOR] ❌ Invalid content returned:', contentText);
      throw new Error('Orchestrator returned invalid content');
    }
    
    // Validate content quality
    const qualityScore = validateContentQuality(contentText);
    console.log(`[QUALITY] Content quality score: ${(qualityScore * 100).toFixed(1)}%`);
    
    if (qualityScore < 0.6) {
      console.warn('[QUALITY] ⚠️ Content quality below threshold');
      throw new Error('Quality too low');
    }
    
    // Prepare predictions for learning system
    const predictedMetrics = {
      engagement_rate: 0.05, // Baseline prediction
      viral_potential: 0.8,
      optimal_timing: scheduledTime.toISOString()
    };
    
    const contentMetadata = {
      topic: orchestratedContent.metadata.topic,
      format: orchestratedContent.format,
      generator: orchestratedContent.metadata.generator_used,
      has_research: orchestratedContent.metadata.has_research,
      narrative_type: orchestratedContent.metadata.narrative_type,
      chaos_applied: orchestratedContent.metadata.chaos_applied
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
      bandit_arm: `orchestrator_${orchestratedContent.metadata.generator_used}_${orchestratedContent.format}`,
      timing_arm: 'orchestrator_timing',
      scheduled_at: scheduledTime.toISOString(),
      quality_score: orchestratedContent.confidence,
      predicted_er: predictedMetrics.engagement_rate,
      topic_cluster: orchestratedContent.metadata.topic,
      generation_source: 'orchestrator',
      // Advanced metadata
      enhanced_generation: true,
      uniqueness_indicators: [orchestratedContent.metadata.generator_used],
      contrarian_angle: orchestratedContent.metadata.generator_used === 'contrarian' ? 'yes' : 'no',
      content_format: orchestratedContent.format,
      thread_tweets: Array.isArray(orchestratedContent.content) ? orchestratedContent.content : undefined,
      // CRITICAL FIX: Store thread data in features column for database storage
      features: {
        thread_tweets: Array.isArray(orchestratedContent.content) ? orchestratedContent.content : null
      }
    } as any;

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
    // Store ALL metadata in generation_metadata JSONB column for rotation tracking
    generation_metadata: {
      content_type_id: (decision as any).content_type_id,
      content_type_name: (decision as any).content_type_name,
      viral_formula: (decision as any).viral_formula,
      hook_used: (decision as any).hook_used,
      enhanced_generation: decision.enhanced_generation,
      uniqueness_indicators: decision.uniqueness_indicators,
      contrarian_angle: decision.contrarian_angle
    },
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

/**
 * Validate content quality to reject generic/boring content
 */
function validateContentQuality(content: string): number {
  // SAFETY: Ensure content is valid
  if (!content || typeof content !== 'string') {
    console.error('[QUALITY] ⚠️ Invalid content passed to validator:', typeof content);
    return 0.5; // Return low quality score for invalid content
  }
  
  let qualityScore = 1.0;
  
  // Penalize generic phrases heavily
  const genericPhrases = [
    'many busy professionals',
    'small adjustments can yield',
    'prioritize health',
    'boost energy and focus',
    'listen to your body',
    'consistency is key',
    'it\'s not just about',
    'our bodies thrive on'
  ];
  
  const lowerContent = content.toLowerCase();
  for (const phrase of genericPhrases) {
    if (lowerContent.includes(phrase.toLowerCase())) {
      qualityScore -= 0.25; // Heavy penalty for generic content
      console.log(`[QUALITY] ⚠️ Generic phrase detected: "${phrase}"`);
    }
  }
  
  // Reward specificity
  const hasNumbers = /\d+%|\d+ (people|studies|hours|minutes|days|weeks)/.test(content);
  const hasResearch = /\b(study|research|scientists|data|evidence|found)\b/i.test(content);
  const hasSpecificMechanism = /\b(because|due to|when|mechanism|process)\b/i.test(content);
  
  if (hasNumbers) {
    qualityScore += 0.15;
    console.log('[QUALITY] ✅ Contains specific numbers');
  }
  if (hasResearch) {
    qualityScore += 0.10;
    console.log('[QUALITY] ✅ Contains research references');
  }
  if (hasSpecificMechanism) {
    qualityScore += 0.05;
    console.log('[QUALITY] ✅ Contains mechanism explanation');
  }
  
  // Check for repetitive patterns (multiple similar sentences)
  const sentences = content.split(/[.!?]/).filter(s => s.trim().length > 0);
  if (sentences.length > 2) {
    const similarSentences = sentences.filter(s => 
      s.toLowerCase().includes('% of people') || 
      s.toLowerCase().includes('most think')
    );
    if (similarSentences.length > 1) {
      qualityScore -= 0.20;
      console.log('[QUALITY] ⚠️ Repetitive sentence patterns detected');
    }
  }
  
  return Math.max(0, Math.min(1, qualityScore));
}