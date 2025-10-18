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
  
  console.log(`[UNIFIED_PLAN] 💾 Storing ${decisions.length} decisions to database...`);
  
  for (const decision of decisions) {
    try {
      console.log(`[UNIFIED_PLAN] 📝 Storing decision ${decision.decision_id}...`);
      console.log(`   Content preview: "${decision.content.substring(0, 50)}..."`);
      console.log(`   Generation source: ${decision.generation_source}`);
      console.log(`   Scheduled for: ${decision.scheduled_at}`);
      
      // Prepare complete data with all required fields
      const metadataRecord = {
        decision_id: decision.decision_id,
        decision_type: decision.decision_type || 'single', // REQUIRED
        content: decision.content,
        thread_parts: decision.thread_parts || null,
        topic_cluster: decision.topic_cluster || null,
        bandit_arm: decision.bandit_arm || null,
        timing_arm: decision.timing_arm || null,
        quality_score: decision.quality_score || null,
        predicted_er: decision.predicted_er || null,
        generation_source: decision.generation_source, // REQUIRED
        status: 'queued', // REQUIRED (has default but explicit is better)
        scheduled_at: decision.scheduled_at || new Date().toISOString(), // REQUIRED
        created_at: new Date().toISOString(),
        // Optional metadata
        generator_name: decision.generator_name || null,
        experiment_arm: decision.experiment_arm || null,
        style: decision.style || null
      };
      
      console.log(`[UNIFIED_PLAN] 🔍 Insert data prepared for ${decision.decision_id}`);
      
      // Store in content_metadata
      const { data: insertedData, error: metadataError } = await supabase
        .from('content_metadata')
        .insert(metadataRecord)
        .select();
      
      if (metadataError) {
        console.error('[UNIFIED_PLAN] ❌ FAILED to store metadata:');
        console.error(`   Error: ${metadataError.message}`);
        console.error(`   Code: ${metadataError.code}`);
        console.error(`   Details: ${JSON.stringify(metadataError.details)}`);
        console.error(`   Hint: ${metadataError.hint}`);
        console.error(`   Decision ID: ${decision.decision_id}`);
        continue;
      }
      
      if (insertedData && insertedData.length > 0) {
        console.log(`[UNIFIED_PLAN] ✅ Successfully stored decision ${decision.decision_id} (DB id: ${insertedData[0].id})`);
      } else {
        console.warn(`[UNIFIED_PLAN] ⚠️ Insert succeeded but no data returned for ${decision.decision_id}`);
      }
      
    } catch (error: any) {
      console.error('[UNIFIED_PLAN] ❌ EXCEPTION during storage:');
      console.error(`   Message: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
      console.error(`   Decision ID: ${decision.decision_id}`);
    }
  }
  
  console.log(`[UNIFIED_PLAN] 💾 Storage complete. Checking database...`);
  
  // Verify what was actually stored
  try {
    const { data: recentRows, error: countError } = await supabase
      .from('content_metadata')
      .select('id, decision_id, content, status, scheduled_at, created_at')
      .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (countError) {
      console.error('[UNIFIED_PLAN] ❌ Failed to verify storage:', countError.message);
    } else if (recentRows && recentRows.length > 0) {
      console.log(`[UNIFIED_PLAN] ✅ Verified ${recentRows.length} rows in database (last 5 min):`);
      recentRows.forEach(row => {
        const contentPreview = String(row.content || '').substring(0, 40);
        console.log(`   - ${row.decision_id}: "${contentPreview}..." [${row.status}]`);
      });
    } else {
      console.warn(`[UNIFIED_PLAN] ⚠️ No rows found in database from last 5 minutes!`);
    }
  } catch (verifyError: any) {
    console.error('[UNIFIED_PLAN] ❌ Verification error:', verifyError.message);
  }
}

