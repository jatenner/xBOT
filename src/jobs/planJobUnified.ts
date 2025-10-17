/**
 * 🚀 UNIFIED PLANNING JOB
 * 
 * Replaces planJobNew.ts with the unified content engine
 * ALL systems active, ALL the time
 */

import { v4 as uuidv4 } from 'uuid';
import { getConfig } from '../config/config';
import { checkLLMAllowed } from '../budget/guard';
import { getSupabaseClient } from '../db/index';
import { UnifiedContentEngine } from '../unified/UnifiedContentEngine';

// Metrics
let planMetrics = {
  calls_total: 0,
  calls_failed: 0,
  failure_reasons: {} as Record<string, number>,
  quality_rejections: 0,
  avg_quality_score: 0,
  avg_viral_probability: 0
};

export function getPlanMetrics() {
  return { ...planMetrics };
}

// ═══════════════════════════════════════════════════════════
// MAIN PLANNING FUNCTION
// ═══════════════════════════════════════════════════════════

export async function planContent(): Promise<void> {
  const flags = getConfig();
  
  console.log(`🚀 [UNIFIED_PLAN] Starting with all systems active (MODE=${flags.MODE})`);
  
  try {
    if (flags.MODE === 'shadow') {
      await generateSyntheticContent();
    } else {
      await generateRealContent();
    }
  } catch (error: any) {
    console.error('[UNIFIED_PLAN] ❌ Planning failed:', error.message);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════
// SYNTHETIC CONTENT (SHADOW MODE)
// ═══════════════════════════════════════════════════════════

async function generateSyntheticContent(): Promise<void> {
  console.log('[UNIFIED_PLAN] 🎭 Generating synthetic content for shadow mode...');
  
  const decisions = [];
  
  for (let i = 0; i < 2; i++) {
    const decision_id = uuidv4();
    const scheduledTime = new Date(Date.now() + (i * 30 + 30) * 60 * 1000);
    
    decisions.push({
      decision_id,
      decision_type: 'content',
      content: `Synthetic health insight #${i + 1}: Evidence-based approach to wellness.`,
      bandit_arm: `synthetic_${i}`,
      timing_arm: 'synthetic_timing',
      scheduled_at: scheduledTime.toISOString(),
      quality_score: 0.75 + (Math.random() * 0.15),
      predicted_er: 0.03,
      topic_cluster: 'health',
      generation_source: 'synthetic'
    });
  }
  
  await storeContentDecisions(decisions);
  console.log(`[UNIFIED_PLAN] 🎭 Generated ${decisions.length} synthetic decisions`);
}

// ═══════════════════════════════════════════════════════════
// REAL CONTENT (LIVE MODE)
// ═══════════════════════════════════════════════════════════

async function generateRealContent(): Promise<void> {
  // Check LLM budget
  const llmCheck = await checkLLMAllowed();
  if (!llmCheck.allowed) {
    console.log(`[UNIFIED_PLAN] ⏭️ LLM blocked: ${llmCheck.reason}`);
    return;
  }
  
  console.log('[UNIFIED_PLAN] 🚀 Generating content with UNIFIED ENGINE');
  
  const decisions = [];
  const numToGenerate = 2; // 2 posts per cycle (aggressive growth mode)
  
  const engine = UnifiedContentEngine.getInstance();
  
  for (let i = 0; i < numToGenerate; i++) {
    try {
      planMetrics.calls_total++;
      
      // ═══════════════════════════════════════════════════════════
      // GENERATE WITH ALL SYSTEMS ACTIVE
      // ═══════════════════════════════════════════════════════════
      const generated = await engine.generateContent({
        format: Math.random() < 0.3 ? 'thread' : 'single' // 30% threads, 70% singles
      });
      
      // Update metrics
      planMetrics.avg_quality_score = 
        (planMetrics.avg_quality_score * (planMetrics.calls_total - 1) + generated.metadata.quality_score) / planMetrics.calls_total;
      planMetrics.avg_viral_probability = 
        (planMetrics.avg_viral_probability * (planMetrics.calls_total - 1) + generated.metadata.viral_probability) / planMetrics.calls_total;
      
      // ═══════════════════════════════════════════════════════════
      // BUILD DECISION
      // ═══════════════════════════════════════════════════════════
      const decision_id = uuidv4();
      const scheduledTime = new Date(Date.now() + (i * 30 + 30) * 60 * 1000);
      
      const decision = {
        decision_id,
        decision_type: 'content' as const,
        content: generated.content,
        thread_parts: generated.threadParts,
        
        // Learning metadata
        bandit_arm: `unified_${generated.metadata.experiment_arm}`,
        timing_arm: 'unified_timing',
        scheduled_at: scheduledTime.toISOString(),
        
        // Quality and predictions
        quality_score: generated.metadata.quality_score,
        predicted_er: generated.metadata.viral_probability * 0.05, // Rough conversion
        predicted_likes: generated.metadata.predicted_likes,
        predicted_followers: generated.metadata.predicted_followers,
        
        // Metadata
        topic_cluster: 'health',
        generation_source: 'unified_engine',
        
        // Learning tracking
        experiment_arm: generated.metadata.experiment_arm,
        systems_used: generated.metadata.systems_active.join(','),
        viral_patterns_applied: generated.metadata.viral_patterns_applied.join(', '),
        learning_insights_used: generated.metadata.learning_insights_used.join(', ')
      };
      
      decisions.push(decision);
      
      console.log(`[UNIFIED_PLAN] ✅ Generated decision ${i + 1}/${numToGenerate}`);
      console.log(`   Content: "${generated.content.substring(0, 60)}..."`);
      console.log(`   Quality: ${(generated.metadata.quality_score * 100).toFixed(1)}/100`);
      console.log(`   Viral prob: ${(generated.metadata.viral_probability * 100).toFixed(1)}%`);
      console.log(`   Systems: ${generated.metadata.systems_active.length} active`);
      console.log(`   Experiment: ${generated.metadata.experiment_arm}`);
      
    } catch (error: any) {
      planMetrics.calls_failed++;
      
      const errorType = error.message.includes('Quality too low') 
        ? 'quality_rejection' 
        : error.message.includes('quota') 
        ? 'insufficient_quota'
        : 'unknown_error';
      
      planMetrics.failure_reasons[errorType] = (planMetrics.failure_reasons[errorType] || 0) + 1;
      
      if (errorType === 'quality_rejection') {
        planMetrics.quality_rejections++;
      }
      
      console.error(`[UNIFIED_PLAN] ❌ Generation ${i + 1} failed:`, error.message);
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // STORE DECISIONS
  // ═══════════════════════════════════════════════════════════
  if (decisions.length > 0) {
    await storeContentDecisions(decisions);
    
    console.log(`[UNIFIED_PLAN] 📊 Successfully generated ${decisions.length}/${numToGenerate} decisions`);
    console.log(`[UNIFIED_PLAN] 📈 Avg quality: ${(planMetrics.avg_quality_score * 100).toFixed(1)}/100`);
    console.log(`[UNIFIED_PLAN] 🔥 Avg viral prob: ${(planMetrics.avg_viral_probability * 100).toFixed(1)}%`);
    console.log(`[UNIFIED_PLAN] ❌ Quality rejections: ${planMetrics.quality_rejections}`);
  } else {
    console.log(`[UNIFIED_PLAN] ⚠️ No decisions generated this cycle`);
  }
}

// ═══════════════════════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════════════════════

async function storeContentDecisions(decisions: any[]): Promise<void> {
  const supabase = getSupabaseClient();
  
  for (const decision of decisions) {
    try {
      // Store in content_metadata
      const { error: metadataError } = await supabase
        .from('content_metadata')
        .insert({
          decision_id: decision.decision_id,
          content: decision.content,
          thread_parts: decision.thread_parts,
          topic_cluster: decision.topic_cluster,
          bandit_arm: decision.bandit_arm,
          timing_arm: decision.timing_arm,
          quality_score: decision.quality_score,
          predicted_er: decision.predicted_er,
          created_at: new Date().toISOString()
        });
      
      if (metadataError) {
        console.error('[UNIFIED_PLAN] ❌ Failed to store metadata:', metadataError.message);
        continue;
      }
      
      // Store in posting_queue
      const { error: queueError } = await supabase
        .from('posting_queue')
        .insert({
          decision_id: decision.decision_id,
          scheduled_at: decision.scheduled_at,
          status: 'pending',
          created_at: new Date().toISOString()
        });
      
      if (queueError) {
        console.error('[UNIFIED_PLAN] ❌ Failed to queue:', queueError.message);
      } else {
        console.log(`[UNIFIED_PLAN] ✅ Queued decision ${decision.decision_id}`);
      }
      
    } catch (error: any) {
      console.error('[UNIFIED_PLAN] ❌ Storage error:', error.message);
    }
  }
}

