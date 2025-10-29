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
import { humanContentOrchestrator } from '../orchestrator/humanContentOrchestrator';

// Metrics
let planMetrics = {
  calls_total: 0,
  calls_successful: 0, // Track successful generations separately
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
      decision_type: 'single', // Fixed: must be 'single', 'thread', or 'reply'
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
// HELPER: INFER TOPIC CLUSTER FROM TOPIC
// ═══════════════════════════════════════════════════════════
/**
 * Maps specific topics to broader topic clusters.
 * This ensures we track diversity across clusters, not just individual topics.
 */
function inferTopicCluster(topic: string): string {
  const topicLower = topic.toLowerCase();
  
  // LONGEVITY cluster
  if (/nad\+|senolytic|caloric restriction|telomere|autophagy|aging|longevity|lifespan/i.test(topicLower)) {
    return 'longevity';
  }
  
  // BIOHACKING cluster
  if (/cold exposure|glucose monitor|nootropic|red light|hrv|biohack|optimization|performance enhancement/i.test(topicLower)) {
    return 'biohacking';
  }
  
  // MENTAL_HEALTH cluster
  if (/psychedelic|neurofeedback|vagus nerve|neuroplasticity|anxiety|depression|stress|mental|mood|cognitive/i.test(topicLower)) {
    return 'mental_health';
  }
  
  // PERFORMANCE cluster
  if (/anaerobic|aerobic|lactate|muscle|vo2|zone 2|cardio|training|exercise|workout|athletic/i.test(topicLower)) {
    return 'performance';
  }
  
  // GUT_HEALTH cluster
  if (/microbiome|prebiotic|fermented|gut|sibo|digestion|intestin|probiotic/i.test(topicLower)) {
    return 'gut_health';
  }
  
  // METABOLIC cluster
  if (/insulin|metabolic|mitochondria|ampk|ketone|glucose|blood sugar|diabetes|energy/i.test(topicLower)) {
    return 'metabolic';
  }
  
  // SLEEP cluster
  if (/sleep|circadian|melatonin|rem|deep sleep|insomnia/i.test(topicLower)) {
    return 'sleep';
  }
  
  // BREATHWORK cluster (separate from mental_health)
  if (/breath|breathing|hrv|respiratory|diaphragm/i.test(topicLower)) {
    return 'breathwork';
  }
  
  // Default: health (catch-all)
  return 'health';
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
  
  // ═══════════════════════════════════════════════════════════
  // LOAD RECENT CONTENT TO AVOID DUPLICATES & ENSURE VARIETY
  // ═══════════════════════════════════════════════════════════
  const supabase = getSupabaseClient();
  const { data: recentContent } = await supabase
    .from('content_metadata')
    .select('content, decision_id, generator_name, hook_type')
    .order('created_at', { ascending: false })
    .limit(20); // Check last 20 pieces of content
  
  // Extract FULL content for duplicate checking (word-level comparison)
  const recentTexts = recentContent?.map(c => String(c.content || '').toLowerCase()) || [];
  
  // Extract KEYWORDS ONLY for topic avoidance (what AI needs to avoid)
  const recentKeywords = recentContent?.map(c => {
    const content = String(c.content || '').toLowerCase();
    // Extract health/wellness keywords from content
    const keywords = content.match(/\b(microbiome|gut|circadian|rhythm|nad\+|fasting|sleep|exercise|protein|ketone|glucose|inflammation|longevity|mitochondria|autophagy|hormone|thyroid|testosterone|estrogen|cortisol|insulin|serotonin|dopamine|meditation|breathwork|cold|heat|sauna|supplement|vitamin|mineral|fiber|probiotic|prebiotic|polyphenol|antioxidant|metabolic|cardiovascular|cognitive|brain|mental|anxiety|depression|stress|recovery|muscle|strength|endurance|vo2|hrv|zone 2|hiit|carb|fat|omega|keto|carnivore|vegan|plant-based|paleo|16:8|intermittent|omad)\b/g);
    return keywords?.join(' ') || '';
  }).filter(Boolean) || [];
  
  const recentGenerators = (recentContent?.map(c => String(c.generator_name || '')).filter(Boolean) as string[]) || [];
  console.log(`[UNIFIED_PLAN] 📚 Loaded ${recentTexts.length} recent posts for duplicate checking`);
  console.log(`[UNIFIED_PLAN] 🎨 Recent generators: ${recentGenerators.slice(0, 5).join(', ')}`);
  console.log(`[UNIFIED_PLAN] 🔑 Keywords to avoid (next 20 posts): ${[...new Set(recentKeywords.join(' ').split(' '))].slice(0, 10).join(', ')}...`);
  
  // ═══════════════════════════════════════════════════════════
  // 🎣 HOOK VARIETY ENFORCER - Track recent hook types
  // ═══════════════════════════════════════════════════════════
  const extractHookType = (content: string): string => {
    const text = content.toLowerCase();
    if (/\d+%/.test(text) || /\d+\s*(people|studies|research)/.test(text)) return 'data-led';
    if (/myth|wrong|everyone thinks|contrary|actually/.test(text)) return 'myth-busting';
    if (/how to|protocol|steps|here's/.test(text)) return 'protocol-led';
    if (/discovered|found|learned|realized/.test(text)) return 'story-led';
    if (/because|why|mechanism|works by|through/.test(text)) return 'mechanism-led';
    if (/vs|versus|compared|better than/.test(text)) return 'comparison';
    if (/unpopular|controversial|most don't/.test(text)) return 'contrarian';
    return 'unknown';
  };
  
  const recentHookTypes = recentContent?.map(c => {
    const savedHook = String(c.hook_type || '');
    if (savedHook && savedHook !== 'unknown') return savedHook;
    return extractHookType(String(c.content || ''));
  }).filter(Boolean) || [];
  
  const last3Hooks = recentHookTypes.slice(0, 3);
  console.log(`[UNIFIED_PLAN] 🎣 Recent hooks: ${last3Hooks.join(', ')}`);
  
  // Enforce hook variety: avoid repeating last 3 hook types
  const allHookTypes = ['data-led', 'myth-busting', 'protocol-led', 'story-led', 'mechanism-led', 'comparison', 'contrarian'];
  const availableHooks = allHookTypes.filter(h => !last3Hooks.includes(h));
  const preferredHook = availableHooks.length > 0 
    ? availableHooks[Math.floor(Math.random() * availableHooks.length)]
    : allHookTypes[Math.floor(Math.random() * allHookTypes.length)];
  
  console.log(`[UNIFIED_PLAN] 🎯 Preferred hook for this post: ${preferredHook}`);
  
  // ═══════════════════════════════════════════════════════════
  // 📅 SERIES SCAFFOLDS - Day-based recurring series
  // ═══════════════════════════════════════════════════════════
  const dayOfWeek = new Date().getDay(); // 0=Sunday, 1=Monday, etc.
  const series = [
    { name: 'Mechanism Explained', focus: 'Explain HOW something works at cellular/hormonal level', dayEmoji: '🔬' }, // Sunday
    { name: 'Protocol Lab', focus: 'Exact step-by-step protocol with dose/time/frequency', dayEmoji: '⚗️' }, // Monday
    { name: 'Myth Surgery', focus: 'Bust common health belief with research', dayEmoji: '🔪' }, // Tuesday
    { name: 'Data Deep Dive', focus: 'Present surprising statistics with source', dayEmoji: '📊' }, // Wednesday
    { name: 'Optimization Edge', focus: 'Go from good to elite performance', dayEmoji: '⚡' }, // Thursday
    { name: 'Failure Mode Friday', focus: 'Explain when protocols fail and exceptions', dayEmoji: '⚠️' }, // Friday
    { name: 'Comparative Analysis', focus: 'Compare 2 approaches or interventions', dayEmoji: '⚖️' } // Saturday
  ];
  
  const todaySeries = series[dayOfWeek % series.length];
  console.log(`[UNIFIED_PLAN] 📅 Today's series: ${todaySeries.dayEmoji} ${todaySeries.name}`);
  console.log(`[UNIFIED_PLAN] 🎯 Focus: ${todaySeries.focus}`);
  
  // ═══════════════════════════════════════════════════════════
  // 🎯 ADAPTIVE SELECTION: Use learning to select optimal topic & cluster
  // ═══════════════════════════════════════════════════════════
  let adaptiveTopicCluster = 'health'; // Fallback
  let adaptiveTopicHint: string | undefined;
  let adaptiveGenerator: string | undefined;
  
  try {
    const { selectOptimalContentEnhanced } = await import('../learning/enhancedAdaptiveSelection');
    const adaptiveDecision = await selectOptimalContentEnhanced();
    console.log(`[ADAPTIVE] 📊 ${adaptiveDecision.reasoning}`);
    console.log(`[ADAPTIVE] 🎯 Selected: ${adaptiveDecision.topic} (${adaptiveDecision.format}) via ${adaptiveDecision.generator}`);
    console.log(`[ADAPTIVE] 🔍 Intelligence source: ${adaptiveDecision.intelligence_source || 'internal'}`);
    
    // Extract topic cluster from topic (e.g., "NAD+ supplementation" → "longevity")
    adaptiveTopicCluster = inferTopicCluster(adaptiveDecision.topic);
    adaptiveTopicHint = adaptiveDecision.topic;
    adaptiveGenerator = adaptiveDecision.generator;
    
    console.log(`[ADAPTIVE] 🏷️ Topic cluster: ${adaptiveTopicCluster}`);
  } catch (adaptiveError: any) {
    console.warn('[ADAPTIVE] ⚠️ Adaptive selection failed, using defaults:', adaptiveError.message);
  }
  
  const decisions = [];
  const numToGenerate = 1; // 1 post per cycle (runs every 30min = 2 posts/hour)
  
  for (let i = 0; i < numToGenerate; i++) {
    try {
      planMetrics.calls_total++;
      
      // ═══════════════════════════════════════════════════════════
      // GENERATE WITH HUMAN-LIKE CONTENT (truly varied and natural)
      // ═══════════════════════════════════════════════════════════
      console.log(`[UNIFIED_PLAN] 🎭 Generating human-like content...`);
      console.log(`[UNIFIED_PLAN] 🎯 Topic hint: ${adaptiveTopicHint || 'none (AI will choose)'}`);
      console.log(`[UNIFIED_PLAN] 🏷️ Topic cluster: ${adaptiveTopicCluster}`);
      
      // Use human content orchestrator instead of rigid templates
      const generated = await humanContentOrchestrator.generateHumanContent({
        topic: adaptiveTopicHint,
        forceFormat: Math.random() < 0.3 ? 'thread' : 'single' // 30% threads, 70% singles
      });
      
      // ═══════════════════════════════════════════════════════════
      // DUPLICATE CHECK: Ensure content is unique
      // ═══════════════════════════════════════════════════════════
      const contentToCheck = Array.isArray(generated.content) 
        ? generated.content.join(' ').toLowerCase()
        : generated.content.toLowerCase();
        
      const isDuplicate = recentTexts.some(recentText => {
        // Check for high similarity (more than 70% of words match)
        const recentWords = new Set(recentText.split(/\s+/));
        const newWords = contentToCheck.split(/\s+/);
        const matchingWords = newWords.filter(w => recentWords.has(w)).length;
        const similarity = matchingWords / newWords.length;
        
        if (similarity > 0.7) {
          console.log(`[UNIFIED_PLAN] ⚠️ Duplicate detected! Similarity: ${(similarity * 100).toFixed(1)}%`);
          return true;
        }
        return false;
      });
      
      if (isDuplicate) {
        console.log(`[UNIFIED_PLAN] 🚫 Skipping duplicate content, will retry next cycle`);
        planMetrics.calls_failed++;
        planMetrics.failure_reasons['duplicate'] = (planMetrics.failure_reasons['duplicate'] || 0) + 1;
        continue; // Skip this iteration
      }
      
      console.log(`[UNIFIED_PLAN] ✅ Content is unique (not a duplicate)`);
      
      // Update metrics - use calls_successful (not calls_total which includes failures)
      planMetrics.calls_successful++;
      planMetrics.avg_quality_score = 
        (planMetrics.avg_quality_score * (planMetrics.calls_successful - 1) + (generated.metadata?.variety_score || 75)) / planMetrics.calls_successful;
      planMetrics.avg_viral_probability = 
        (planMetrics.avg_viral_probability * (planMetrics.calls_successful - 1) + 70) / planMetrics.calls_successful;
      
      // ═══════════════════════════════════════════════════════════
      // BUILD DECISION
      // ═══════════════════════════════════════════════════════════
      const decision_id = uuidv4();
      // PHASE 2 FIX: Schedule sooner (10-20 min instead of 30-60 min)
      // First post: +10 min, Second post: +20 min
      const scheduledTime = new Date(Date.now() + (i * 10 + 10) * 60 * 1000);
      
      const decisionType: 'single' | 'thread' = generated.format;
      
      // Extract actual hook type from generated content
      const contentForHookCheck = Array.isArray(generated.content) 
        ? generated.content.join(' ')
        : generated.content;
      const actualHookType = extractHookType(contentForHookCheck);
      
      const decision = {
        decision_id,
        decision_type: decisionType,
        content: generated.content,
        thread_parts: Array.isArray(generated.content) ? generated.content : null,
        
        // Learning metadata
        bandit_arm: 'human_content',
        timing_arm: 'unified_timing',
        scheduled_at: scheduledTime.toISOString(),
        
        // Quality and predictions
        quality_score: generated.metadata?.variety_score || 75,
        predicted_er: 0.05, // Default engagement rate
        predicted_likes: 15, // Default prediction
        predicted_followers: 2, // Default prediction
        
        // Metadata
        topic_cluster: adaptiveTopicHint || adaptiveTopicCluster || 'health',
        generation_source: 'real',
        hook_type: actualHookType,
        
        // 📝 VERIFICATION LOG
        metadata: {
          ai_generated_topic: adaptiveTopicHint,
          topic_cluster_broad: adaptiveTopicCluster,
          human_like: generated.metadata?.human_like || true,
          approach: generated.metadata?.approach || 'dynamic',
          chaos_injected: generated.metadata?.chaos_injected || false
        },
        
        // Learning tracking
        experiment_arm: 'human_content',
        generator_name: 'human_content_orchestrator',
        generator_confidence: generated.confidence || 0.85,
        systems_used: 'human_content_orchestrator',
        viral_patterns_applied: generated.style,
        learning_insights_used: 'human_like_generation'
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
        generator_confidence: decision.generator_confidence || null,
        experiment_arm: decision.experiment_arm || null,
        style: decision.style || null
      };
      
      console.log(`[UNIFIED_PLAN] 🔍 Insert data prepared for ${decision.decision_id}`);
      console.log(`[UNIFIED_PLAN] 🏷️ TOPIC TRACKING: Storing topic_cluster="${metadataRecord.topic_cluster}"`);
      
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
        
        // Extract and store patterns for creativity analysis
        try {
          const { extractPatterns } = await import('../ai/patternExtractor');
          const { patternStorage } = await import('../ai/patternStorage');
          
          const content = decision.content || decision.thread_parts?.[0] || '';
          if (content) {
            const patterns = extractPatterns(content);
            await patternStorage.storePatterns(decision.decision_id, content, patterns);
            console.log(`[UNIFIED_PLAN] 📊 Patterns extracted and stored for ${decision.decision_id}`);
          }
        } catch (patternError: any) {
          // Non-critical - pattern storage is optional
          console.warn(`[UNIFIED_PLAN] ⚠️ Pattern extraction failed: ${patternError.message}`);
        }
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

