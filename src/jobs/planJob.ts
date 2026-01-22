/**
 * 📝 PLAN JOB - Autonomous Content Planning
 * Generates content using LLM and queues for posting
 */

import { v4 as uuidv4 } from 'uuid';
import { ENV } from '../config/env';
import { log } from '../lib/logger';
import { getConfig } from '../config/config';
import { getEnvConfig, isLLMAllowed } from '../config/envFlags';
import { getSupabaseClient } from '../db/index';
import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { dynamicPromptGenerator } from '../ai/content/dynamicPromptGenerator';
import { contentDiversityEngine } from '../ai/content/contentDiversityEngine';
import { formatContentForTwitter } from '../posting/aiVisualFormatter';
import { validateAndImprove } from '../generators/contentAutoImprover';

const MAX_GENERATION_RETRIES = Math.max(1, parseInt(process.env.PLAN_JOB_GENERATION_RETRIES || '3', 10) || 3);
const GENERATION_RETRY_BACKOFF_MS = Math.max(250, parseInt(process.env.PLAN_JOB_RETRY_BACKOFF_MS || '1500', 10) || 1500);

// Global metrics
let llmMetrics = {
  calls_total: 0,
  calls_failed: 0,
  success: 0,
  errors: 0,
  failure_reasons: {} as Record<string, number>
};

export function getLLMMetrics() {
  return { ...llmMetrics };
}

export async function planContent(): Promise<void> {
  const config = getConfig();
  log({ op: 'plan_job_start', mode: config.MODE });
  
  try {
    // Record plan job run for health monitoring
    try {
      const { AutonomousHealthMonitor } = await import('./autonomousHealthMonitor');
      const monitor = AutonomousHealthMonitor.getInstance();
      monitor.recordPlanRun();
    } catch (e) {
      // Non-critical, continue
    }
    
    if (config.MODE === 'shadow') {
      await generateSyntheticContent();
    } else {
      await generateRealContent();
    }
    
    // 🔍 TASK 1: Ensure post buffer (maintain at least 3 queued posts in next 60 minutes)
    try {
      const { ensurePostBuffer } = await import('./postBuffer');
      await ensurePostBuffer();
    } catch (bufferError: any) {
      console.warn(`[PLAN_JOB] ⚠️ Post buffer check failed (non-critical): ${bufferError.message}`);
    }
    
    log({ op: 'plan_job_complete', outcome: 'success' });
  } catch (error: any) {
    log({ op: 'plan_job_complete', outcome: 'error', error: error.message });
    throw error;
  }
}

async function generateSyntheticContent(): Promise<void> {
  log({ op: 'generate_synthetic', mode: 'shadow' });
  const decision_id = uuidv4();
  
  const supabase = getSupabaseClient();
  // 🔥 CRITICAL FIX: Insert into TABLE, not VIEW
  await supabase.from('content_generation_metadata_comprehensive').insert([{
    decision_id,
    decision_type: 'single',
    content: "Health tip: Stay hydrated! Your body needs water for optimal function.",
    generation_source: 'synthetic',
    status: 'queued',
    scheduled_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      quality_score: 0.82,
      predicted_er: 0.034,
    topic_cluster: 'hydration',
    bandit_arm: 'educational'
  }]);
  
  log({ op: 'generate_synthetic', outcome: 'success', decision_id });
}

async function generateRealContent(): Promise<void> {
  const llmCheck = isLLMAllowed();
  if (!llmCheck.allowed) {
    const reason = llmCheck.reason || 'unknown';
    console.error(`[PLAN_JOB] 🚨 LLM BLOCKED: ${reason}`);
    console.error(`[PLAN_JOB] 🚨 This prevents content generation. Check:`);
    console.error(`[PLAN_JOB]    - OPENAI_API_KEY is set`);
    console.error(`[PLAN_JOB]    - AI_QUOTA_CIRCUIT_OPEN is not 'true'`);
    console.error(`[PLAN_JOB]    - Budget limits not exceeded`);
    log({ op: 'generate_real', blocked: true, reason });
    
    // Check budget status for more details
    try {
      const { checkBudgetAllowed } = await import('../budget/hardGuard');
      const budgetCheck = await checkBudgetAllowed();
      if (!budgetCheck.allowed) {
        console.error(`[PLAN_JOB] 🚨 Budget check: ${budgetCheck.reason}`);
      }
    } catch (e) {
      // Non-critical
    }
    
    return;
  }
  
  const config = getConfig(); // Get config here for interval check
  
  // ═══════════════════════════════════════════════════════════
  // 🎯 BATCH GENERATION: Generate 2 posts per run (optimized for growth)
  // ═══════════════════════════════════════════════════════════
  // OPTIMIZED: Generate 2 posts per run for faster growth
  // - Rate limits enforce 2/hour max regardless of what's generated
  // - Plan job runs every 90min (if JOBS_PLAN_INTERVAL_MIN=90), so 2 posts per run = ~32 posts/day max
  // - Posting queue will enforce strict 2/hour limit
  // - With 90min interval: 2 posts every 1.5h = 1.33 posts/hour (within 2/hour limit)
  const intervalMinutes = config.JOBS_PLAN_INTERVAL_MIN || 120;
  const numToGenerate = intervalMinutes <= 90 ? 2 : 1; // Generate 2 if interval ≤90min, else 1
  
  log({ op: 'generate_real', num_to_generate: numToGenerate, target_rate: '2/hour' });
  
  const generatedPosts: any[] = [];
  const batchMetrics = {
    topics: new Set<string>(),
    tones: new Set<string>(),
    angles: new Set<string>(),
    generators: new Set<string>()
  };
    
  for (let slot = 0; slot < numToGenerate; slot++) {
    let attempt = 0;
    let success = false;

    while (attempt < MAX_GENERATION_RETRIES && !success) {
      attempt++;

      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📝 GENERATING POST ${slot + 1}/${numToGenerate} (attempt ${attempt}/${MAX_GENERATION_RETRIES})`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      try {
        const content = await generateContentWithLLM();

        if (!content) {
          console.log(`[PLAN_JOB] ⚠️ Attempt ${attempt} produced empty content for post ${slot + 1}`);
          if (attempt < MAX_GENERATION_RETRIES) {
            console.log(`[PLAN_JOB] 🔁 Retrying post ${slot + 1} after empty content result`);
            await sleep(GENERATION_RETRY_BACKOFF_MS * attempt);
            continue;
          }
          break;
        }

        const { validateContentSubstance } = await import('../validators/substanceValidator');
        const substanceCheck = validateContentSubstance(content.text);

        if (!substanceCheck.isValid) {
          console.log(`[SUBSTANCE] ⛔ Post ${slot + 1} REJECTED (attempt ${attempt}): ${substanceCheck.reason}`);
          console.log(`[SUBSTANCE]    Score: ${substanceCheck.score}/100 (need 70+)`);
          if (attempt < MAX_GENERATION_RETRIES) {
            console.log(`[SUBSTANCE] 🔁 Retrying post ${slot + 1} with new generation`);
            await sleep(GENERATION_RETRY_BACKOFF_MS * attempt);
            continue;
          }
          console.log(`[SUBSTANCE] ⛔ Exhausted retries for post ${slot + 1} due to substance failure`);
          break;
        }
        console.log(`[SUBSTANCE] ✅ Post ${slot + 1} passed substance check (score: ${substanceCheck.score}/100)`);

        const gateResult = await runGateChain(content.text, content.decision_id);
        if (!gateResult.passed) {
          console.log(`[GATE_CHAIN] ⛔ Post ${slot + 1} blocked (${gateResult.gate}): ${gateResult.reason}`);
          
          // 🛡️ v2: If gate chain returned rewritten content, use it
          if ((gateResult as any).rewrittenContent) {
            console.log(`[MEDICAL_SAFETY] 🔄 Using safety-rewritten content for post ${slot + 1}`);
            const rewritten = (gateResult as any).rewrittenContent;
            // Update content text (handle both single and thread formats)
            if (Array.isArray(content.text)) {
              // Thread: split rewritten content back into array if needed
              content.text = rewritten.split('\n\n--- THREAD BREAK ---\n\n').filter((t: string) => t.trim());
            } else {
              content.text = rewritten;
            }
            // Rewritten content passed safety - continue to next steps
          } else if (gateResult.gate === 'medical_safety' && (gateResult as any).safetyResult?.rewrittenContent) {
            // Fallback: check safetyResult for rewritten content
            console.log(`[MEDICAL_SAFETY] 🔄 Using safety-rewritten content from safetyResult for post ${slot + 1}`);
            const rewritten = (gateResult as any).safetyResult.rewrittenContent;
            if (Array.isArray(content.text)) {
              content.text = rewritten.split('\n\n--- THREAD BREAK ---\n\n').filter((t: string) => t.trim());
            } else {
              content.text = rewritten;
            }
            // Re-run gate chain with rewritten content
            const rewrittenGateResult = await runGateChain(content.text, content.decision_id);
            if (!rewrittenGateResult.passed) {
              console.log(`[GATE_CHAIN] ⛔ Rewritten content still blocked: ${rewrittenGateResult.reason}`);
              if (attempt < MAX_GENERATION_RETRIES) {
                await sleep(GENERATION_RETRY_BACKOFF_MS * attempt);
                continue;
              }
              break;
            }
            // Rewritten content passed - continue
          } else if (attempt < MAX_GENERATION_RETRIES) {
            console.log(`[GATE_CHAIN] 🔁 Retrying post ${slot + 1} after gate failure`);
            await sleep(GENERATION_RETRY_BACKOFF_MS * attempt);
            continue;
          } else {
            console.log(`[GATE_CHAIN] ⛔ Exhausted retries for post ${slot + 1} due to gate failure`);
            break;
          }
        }

        batchMetrics.topics.add(content.raw_topic);
        batchMetrics.tones.add(content.tone);
        batchMetrics.angles.add(content.angle);
        batchMetrics.generators.add(content.generator_used);

        generatedPosts.push(content);
        success = true;
        console.log(`[PLAN_JOB] ✅ Post ${slot + 1} generated successfully on attempt ${attempt}`);
      } catch (error: any) {
        llmMetrics.calls_failed++;
        const errorType = categorizeError(error);
        llmMetrics.failure_reasons[errorType] = (llmMetrics.failure_reasons[errorType] || 0) + 1;

        console.error(`[PLAN_JOB] ❌ Post ${slot + 1} generation failed (attempt ${attempt}): ${error.message}`);

        if (errorType === 'insufficient_quota') {
          console.log('[PLAN_JOB] OpenAI insufficient_quota → stopping generation');
          return;
        }

        const retryable = isRetryableGenerationError(errorType);
        if (retryable && attempt < MAX_GENERATION_RETRIES) {
          console.log(`[PLAN_JOB] 🔁 Retrying post ${slot + 1} after ${errorType} (attempt ${attempt}/${MAX_GENERATION_RETRIES})`);
          await sleep(GENERATION_RETRY_BACKOFF_MS * attempt);
          continue;
        }

        console.log(`[PLAN_JOB] ⛔ Abandoning post ${slot + 1} after ${attempt} attempt(s) due to ${errorType}`);
        break;
      }
    }

    if (!success) {
      console.log(`[PLAN_JOB] ⚠️ Post ${slot + 1} could not be generated after ${attempt} attempt(s)`);
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // 📅 SMART SCHEDULING: Space posts evenly for 2/hour
  // ═══════════════════════════════════════════════════════════
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 BATCH SUMMARY`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Generated: ${generatedPosts.length}/${numToGenerate} posts`);
  console.log(`\n🎨 DIVERSITY:`);
  console.log(`   ${batchMetrics.topics.size}/${generatedPosts.length} unique topics`);
  console.log(`   ${batchMetrics.tones.size}/${generatedPosts.length} unique tones`);
  console.log(`   ${batchMetrics.angles.size}/${generatedPosts.length} unique angles`);
  console.log(`   ${batchMetrics.generators.size}/${generatedPosts.length} unique generators`);
  
  if (generatedPosts.length === 0) {
    console.log(`\n⚠️ No posts generated this cycle`);
    return;
  }
  
  console.log(`\n📅 SMART SCHEDULING (MAX 2 tweets/hour):`);
  
  const now = Date.now();
  for (let i = 0; i < generatedPosts.length; i++) {
    const post = generatedPosts[i];
    
    // 🎯 STRICT SCHEDULE: Max 2 tweets per hour = 30 minutes minimum spacing
    // Post 1: +0min, Post 2: +30min (if generated)
    // If more than 2 generated, space them out further to stay under 2/hour
    const minSpacingMinutes = 30; // Minimum 30 minutes between posts
    const baseDelay = i * minSpacingMinutes;
    
    const scheduledAt = new Date(now + baseDelay * 60000);
    post.scheduled_at = scheduledAt.toISOString();
    
    const minutesUntil = baseDelay;
    
    console.log(`   Post ${i + 1}: ${scheduledAt.toLocaleTimeString()} (${minutesUntil}min from now)`);
    
    // 🎨 CRITICAL FIX: Apply visual formatting BEFORE queueing
    await formatAndQueueContent(post);
  }
  
  console.log(`\n💡 Generated ${generatedPosts.length} posts (max 2 will post per hour due to rate limits)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

/**
 * 🎭 SYSTEM B: Call dedicated generator with specialized prompt
 */
async function callDedicatedGenerator(generatorName: string, context: any) {
  const { topic, angle, tone, formatStrategy, dynamicTopic, growthIntelligence, viInsights } = context;
  
  // Map generator names (from generatorMatcher) to their module files and function names
  const generatorMap: Record<string, { module: string, fn: string }> = {
    'provocateur': { module: 'provocateurGenerator', fn: 'generateProvocateurContent' },
    'dataNerd': { module: 'dataNerdGenerator', fn: 'generateDataNerdContent' },
    'mythBuster': { module: 'mythBusterGenerator', fn: 'generateMythBusterContent' },
    'contrarian': { module: 'contrarianGenerator', fn: 'generateContrarianContent' },
    'storyteller': { module: 'storytellerGenerator', fn: 'generateStorytellerContent' },
    'coach': { module: 'coachGenerator', fn: 'generateCoachContent' },
    'philosopher': { module: 'philosopherGenerator', fn: 'generatePhilosopherContent' },
    'culturalBridge': { module: 'culturalBridgeGenerator', fn: 'generateCulturalBridgeContent' },
    'newsReporter': { module: 'newsReporterGenerator', fn: 'generateNewsReporterContent' },
    'explorer': { module: 'explorerGenerator', fn: 'generateExplorerContent' },
    'thoughtLeader': { module: 'thoughtLeaderGenerator', fn: 'generateThoughtLeaderContent' },
    'interestingContent': { module: 'interestingContentGenerator', fn: 'generateInterestingContent' },
    'dynamicContent': { module: 'dynamicContentGenerator', fn: 'generateDynamicContent' },
    // NEW GENERATORS (Nov 6, 2025 upgrade)
    'popCultureAnalyst': { module: 'popCultureAnalystGenerator', fn: 'generatePopCultureContent' },
    'teacher': { module: 'teacherGenerator', fn: 'generateTeacherContent' },
    'investigator': { module: 'investigatorGenerator', fn: 'generateInvestigatorContent' },
    'connector': { module: 'connectorGenerator', fn: 'generateConnectorContent' },
    'pragmatist': { module: 'pragmatistGenerator', fn: 'generatePragmatistContent' },
    'historian': { module: 'historianGenerator', fn: 'generateHistorianContent' },
    'translator': { module: 'translatorGenerator', fn: 'generateTranslatorContent' },
    'patternFinder': { module: 'patternFinderGenerator', fn: 'generatePatternFinderContent' },
    'experimenter': { module: 'experimenterGenerator', fn: 'generateExperimenterContent' },
  };
  
  // 🛡️ Safe fallback for unknown generators (e.g., "researcher" -> "dataNerd")
  let normalizedGeneratorName = generatorName;
  const generatorAliases: Record<string, string> = {
    'researcher': 'dataNerd', // Map "researcher" to "dataNerd" (closest match)
    'research': 'dataNerd'
  };
  
  if (generatorAliases[generatorName]) {
    normalizedGeneratorName = generatorAliases[generatorName];
    console.warn(`[GENERATOR_MATCH] ⚠️ Unknown generator "${generatorName}" mapped to "${normalizedGeneratorName}"`);
  }
  
  let config = generatorMap[normalizedGeneratorName];
  if (!config) {
    console.error(`[GENERATOR_MATCH] ❌ Unknown generator: ${normalizedGeneratorName} — falling back to thoughtLeader`);
    normalizedGeneratorName = 'thoughtLeader'; // Safe fallback
    config = generatorMap[normalizedGeneratorName];
    if (!config) {
      throw new Error(`Critical: Fallback generator "thoughtLeader" not found in generatorMap`);
    }
  }
  
  // Use normalized name for rest of function
  generatorName = normalizedGeneratorName;
  
  try {
    console.log(`[SYSTEM_B] 🎭 Calling ${config.module}.${config.fn}()...`);
    
    const generatorModule = await import(`../generators/${config.module}`);
    const generateFn = generatorModule[config.fn];
    
    if (typeof generateFn !== 'function') {
      console.error(`[SYSTEM_B] ❌ Function ${config.fn} not found in ${config.module}`);
      throw new Error(`Generator function ${config.fn} not found`);
    }
    
    // Call generator with correct parameters
    // Note: intelligence parameter is optional - generators work without it
    // We pass topic directly, generators will use their specialized prompts
    
    // ✅ THREADS ENABLED: 15% thread rate = ~3-4 threads per day out of 24 posts (1/hour)
    const selectedFormat = Math.random() < 0.40 ? 'thread' : 'single';
    console.log(`[SYSTEM_B] 📊 Format selected: ${selectedFormat} (target: 40% threads = ~2-3/day for 6-8 posts/day)`);
    
    const result = await generateFn({
      topic,
      angle, // ✅ Pass AI-generated angle
      tone, // ✅ Pass AI-generated tone
      formatStrategy, // ✅ Pass AI-generated format strategy
      format: selectedFormat, // ✅ FIXED: Dynamic format selection enables threads
      intelligence: growthIntelligence, // ✅ NEW: Pass growth intelligence to generators!
      viInsights: viInsights || null // ✅ NEW: Pass VI insights to generators!
    });
    
    // Transform generator response to expected format
    // Note: Character validation handled by generatorUtils.ts (single source of truth)
    return {
      text: result.content,
      format: selectedFormat, // ✅ FIX: Use OUR selected format, not what AI returned
      topic,
      angle,
      tone,
      visual_format: result.visualFormat,
      // Pass through meta-awareness attributes
      angle_type: context.angle_type,
      tone_is_singular: context.tone_is_singular,
      tone_cluster: context.tone_cluster,
      structural_type: context.structural_type
    };
  } catch (error: any) {
    console.error(`[SYSTEM_B] ❌ Error calling ${config.module}:`, error.message);
    throw error;
  }
}

async function generateContentWithLLM() {
  const flags = getConfig();
  const decision_id = uuidv4();
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎯 DIVERSITY SYSTEM: Multi-Dimensional Content Generation');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // ═══════════════════════════════════════════════════════════
  // 🚀 NEW DIVERSITY SYSTEM (Rolling 10-Post Blacklist)
  // ═══════════════════════════════════════════════════════════
  
  // Import all diversity modules
  const { getDiversityEnforcer } = await import('../intelligence/diversityEnforcer');
  const { getDynamicTopicGenerator } = await import('../intelligence/dynamicTopicGenerator');
  const { getAngleGenerator } = await import('../intelligence/angleGenerator');
  const { getToneGenerator } = await import('../intelligence/toneGenerator');
  const { getGeneratorMatcher } = await import('../intelligence/generatorMatcher');
  const { getFormatStrategyGenerator } = await import('../intelligence/formatStrategyGenerator');  // ✅ NEW
  
  const diversityEnforcer = getDiversityEnforcer();
  
  // STEP 0: Show current diversity status
  await diversityEnforcer.getDiversitySummary();
  
  // 🎯 v2 UPGRADE: STEP 0.5 - Select content slot (micro content calendar)
  const contentSlotModule = await import('../utils/contentSlotManager');
  const { 
    getContentSlotsForToday, 
    selectContentSlot, 
    getSlotConfig
  } = contentSlotModule;
  
  // Get recent content slots for diversity
  const supabase = getSupabaseClient();
  const { data: recentSlots } = await supabase
    .from('content_metadata')
    .select('content_slot')
    .not('content_slot', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);
  
  const recentSlotTypes = (recentSlots || [])
    .map(row => row.content_slot)
    .filter((slot): slot is string => slot !== null && typeof slot === 'string') as any;
  
  const availableSlots = getContentSlotsForToday();
  // 🎯 Phase 5A: selectContentSlot is now async (returns Promise) when policy is enabled
  const selectedSlot = await selectContentSlot(availableSlots, recentSlotTypes.length > 0 ? recentSlotTypes : undefined);
  const slotConfig = getSlotConfig(selectedSlot);
  
  console.log(`\n📅 CONTENT SLOT: ${selectedSlot}`);
  console.log(`   Description: ${slotConfig.description}`);
  console.log(`   Available today: ${availableSlots.join(', ')}`);
  
  // STEP 1: Generate TOPIC (avoiding last 10)
  // 🎯 TRENDING TOPIC INTEGRATION: 35% of posts use trending topics from harvester
  const useTrendingTopic = Math.random() < 0.35; // 35% chance
  
  let dynamicTopic;
  let topic: string;
  
  if (useTrendingTopic) {
    console.log('[PLAN_JOB] 🔥 Using trending topic from harvester data...');
    try {
      const { trendingTopicExtractor } = await import('../intelligence/trendingTopicExtractor');
      const trendingTopic = await trendingTopicExtractor.getTopTrendingTopic();
      
      if (trendingTopic) {
        console.log(`[PLAN_JOB] 📈 Trending topic: "${trendingTopic}"`);
        // Use trending topic but still generate dynamic topic structure
        const topicGenerator = getDynamicTopicGenerator();
        dynamicTopic = await topicGenerator.generateTopic({
          preferTrending: true,
          recentTopics: [] // Will be populated by generator
        });
        // Override topic with trending one
        topic = trendingTopic;
        dynamicTopic.topic = trendingTopic;
        dynamicTopic.viral_potential = Math.min(0.95, (dynamicTopic.viral_potential || 0.7) + 0.15); // Boost viral potential
      } else {
        console.log('[PLAN_JOB] ⚠️ No trending topics available, falling back to regular generation');
        const topicGenerator = getDynamicTopicGenerator();
        dynamicTopic = await topicGenerator.generateTopic();
        topic = dynamicTopic.topic;
      }
    } catch (error: any) {
      console.warn(`[PLAN_JOB] ⚠️ Trending topic extraction failed: ${error.message}, using regular generation`);
      const topicGenerator = getDynamicTopicGenerator();
      dynamicTopic = await topicGenerator.generateTopic();
      topic = dynamicTopic.topic;
    }
  } else {
    const topicGenerator = getDynamicTopicGenerator();
    dynamicTopic = await topicGenerator.generateTopic();
    topic = dynamicTopic.topic; // Extract just the topic string
  }
  
  console.log(`\n🎯 TOPIC: "${topic}"`);
  console.log(`   Cluster sampled: ${dynamicTopic.cluster_sampled || 'unknown'}`);
  console.log(`   Dimension: ${dynamicTopic.dimension}`);
  console.log(`   Viral potential: ${dynamicTopic.viral_potential}`);
  
  // STEP 2: Generate ANGLE (avoiding last 10, biased by content slot)
  const angleGenerator = getAngleGenerator();
  const angle = await angleGenerator.generateAngle(topic);
  
  // If slot has preferred angles, try to align (soft bias, not strict)
  const preferredAngles = slotConfig.preferredAngles || [];
  if (preferredAngles.length > 0 && Math.random() < 0.3) {
    // 30% chance to use slot-preferred angle as inspiration
    console.log(`[CONTENT_SLOT] 💡 Slot suggests angles: ${preferredAngles.join(', ')}`);
  }
  
  console.log(`\n📐 ANGLE: "${angle}"`);
  
  // STEP 3: Generate TONE (avoiding last 10, biased by content slot)
  const toneGenerator = getToneGenerator();
  const tone = await toneGenerator.generateTone();
  
  // If slot has preferred tones, try to align (soft bias)
  const preferredTones = slotConfig.preferredTones || [];
  if (preferredTones.length > 0 && Math.random() < 0.3) {
    console.log(`[CONTENT_SLOT] 💡 Slot suggests tones: ${preferredTones.join(', ')}`);
  }
  
  console.log(`\n🎤 TONE: "${tone}"`);
  
  // STEP 4: Match GENERATOR (weighted by slot preferences + weight maps)
  const generatorMatcher = getGeneratorMatcher();
  // 🎯 v2 UPGRADE: matchGenerator is now async (uses weight maps)
  let matchedGenerator = await generatorMatcher.matchGenerator(angle, tone);
  
  // 🎯 v2: If slot has preferred generators, bias selection (30% chance to override)
  const preferredGenerators = slotConfig.preferredGenerators || [];
  if (preferredGenerators.length > 0 && Math.random() < 0.3) {
    // 30% chance to use slot-preferred generator
    const slotGenerator = preferredGenerators[Math.floor(Math.random() * preferredGenerators.length)];
    console.log(`[CONTENT_SLOT] 🎯 Slot-biased generator selection: ${slotGenerator} (preferred: ${preferredGenerators.join(', ')})`);
    matchedGenerator = slotGenerator as any; // Type assertion needed
  }
  
  console.log(`\n🎭 GENERATOR: ${matchedGenerator}`);
  
  // ═══════════════════════════════════════════════════════════
  // ✨ STEP 5: Generate FORMAT STRATEGY (avoiding last 4)
  // ═══════════════════════════════════════════════════════════
  const formatStrategyGen = getFormatStrategyGenerator();
  let formatStrategy = await formatStrategyGen.generateStrategy(topic, angle, tone, matchedGenerator);
  
  // 🔬 THREAD VERIFICATION OVERRIDE: Deterministic force for Iteration 2 verification
  const forceThreadVerification = process.env.FORCE_THREAD_VERIFICATION === 'true';
  if (forceThreadVerification) {
    // Force thread format regardless of slot eligibility
    if (typeof formatStrategy === 'string') {
      formatStrategy = { format_type: 'thread', strategy: formatStrategy } as any;
    } else if (formatStrategy && typeof formatStrategy === 'object') {
      formatStrategy = { ...(formatStrategy as any), format_type: 'thread' } as any;
    } else {
      formatStrategy = { format_type: 'thread' } as any;
    }
    console.log(`[THREAD_VERIFY] 🔬 forcing thread for verification (slot=${selectedSlot})`);
  }
  
  // 🚀 THREAD BOOST: Feature flag to force thread generation for verification
  const threadBoostEnabled = process.env.ENABLE_THREAD_BOOST === 'true';
  const threadBoostRate = parseFloat(process.env.THREAD_BOOST_RATE || '0.5');
  const eligibleSlots = ['framework', 'deep_dive', 'research', 'educational'];
  const isEligibleSlot = eligibleSlots.includes(selectedSlot);
  
  if (!forceThreadVerification && threadBoostEnabled && isEligibleSlot) {
    const shouldBoost = Math.random() < threadBoostRate;
    if (shouldBoost) {
      // Force thread format
      if (typeof formatStrategy === 'string') {
        formatStrategy = { format_type: 'thread', strategy: formatStrategy } as any;
      } else if (formatStrategy && typeof formatStrategy === 'object') {
        formatStrategy = { ...(formatStrategy as any), format_type: 'thread' } as any;
      } else {
        formatStrategy = { format_type: 'thread' } as any;
      }
      console.log(`[THREAD_BOOST] ✅ enabled=true rate=${threadBoostRate} selected=true decisionType=thread slot=${selectedSlot}`);
    } else {
      console.log(`[THREAD_BOOST] ⏭️ enabled=true rate=${threadBoostRate} selected=false decisionType=single slot=${selectedSlot}`);
    }
  } else if (!forceThreadVerification && threadBoostEnabled && !isEligibleSlot) {
    console.log(`[THREAD_BOOST] ⏭️ enabled=true but slot=${selectedSlot} not eligible (eligible: ${eligibleSlots.join(', ')})`);
  }
  
  console.log(`\n🎨 FORMAT: "${formatStrategy}"`);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // ═══════════════════════════════════════════════════════════
  // 🎯 POST TYPE CONTRACT: Determine single vs thread
  // ═══════════════════════════════════════════════════════════
  const { shouldBeThread, extractContentSignals, logDistributionDecision } = await import('../scheduling/PostDistributionPolicy');
  
  const contentSignals = extractContentSignals({
    topic,
    angle,
    content: `${topic} ${angle}`,
    metadata: { formatStrategy, selectedSlot }
  });
  
  const distributionDecision = shouldBeThread(contentSignals);
  logDistributionDecision(distributionDecision.decision, distributionDecision.reason, distributionDecision.probability);
  
  // Override format strategy based on distribution decision
  let decidedPostType = distributionDecision.decision;
  
  // 🔥 FORCE THREAD VERIFICATION: Override decision type if flag set
  const forceThread = process.env.FORCE_NEXT_THREAD === 'true';
  if (forceThread) {
    console.log('[THREAD_FORCE] 🔬 FORCE_NEXT_THREAD=true detected - forcing thread generation');
    decidedPostType = 'thread';
    
    // Clear flag after using (one-time force)
    delete process.env.FORCE_NEXT_THREAD;
    console.log('[THREAD_FORCE] ✅ Flag cleared - next generation will be normal');
  }
  
  console.log(`[POST_PLAN] decided_type=${decidedPostType} reason=${forceThread ? 'FORCED' : distributionDecision.reason}`);
  
  // LEGACY: Keep old diversity tracking for compatibility
  contentDiversityEngine.trackTopic(topic);
  
  // ═══════════════════════════════════════════════════════════
  // 🎨 STEP 5.25: GET VI INSIGHTS FOR VISUAL OPTIMIZATION
  // ═══════════════════════════════════════════════════════════
  
  let viInsights = null;
  try {
    console.log('[VI_INSIGHTS] 🎨 Retrieving visual intelligence insights...');
    
    const { VIIntelligenceFeed } = await import('../intelligence/viIntelligenceFeed');
    const viFeed = new VIIntelligenceFeed();
    viInsights = await viFeed.getIntelligence({
      topic,
      angle,
      tone,
      structure: typeof formatStrategy === 'string' ? formatStrategy : (formatStrategy as any)?.format_type || formatStrategy,
      generator: matchedGenerator
    });
    
    if (viInsights) {
      console.log(`[VI_INSIGHTS] ✅ Insights retrieved: ${viInsights.primary_tier} tier, ${viInsights.confidence_level} confidence (based on ${viInsights.based_on_count} tweets)`);
    } else {
      console.log('[VI_INSIGHTS] ⚠️ No insights found (will use default formatting)');
    }
  } catch (error: any) {
    console.warn('[VI_INSIGHTS] ⚠️ VI insights unavailable:', error.message, '(continuing without VI)');
    viInsights = null;
  }
  
  // ═══════════════════════════════════════════════════════════
  // 🚀 STEP 5.45: GET REPLY INSIGHTS - Learn from successful replies!
  // ═══════════════════════════════════════════════════════════
  
  let replyInsights = null;
  try {
    console.log('[REPLY_INSIGHTS] 🚀 Retrieving successful reply patterns...');
    
    const { replyLearningSystem } = await import('../learning/replyLearningSystem');
    replyInsights = await replyLearningSystem.getSuccessfulPatterns();
    
    if (replyInsights && replyInsights.topPerformingReplies.length > 0) {
      console.log(`[REPLY_INSIGHTS] ✅ Found ${replyInsights.topPerformingReplies.length} high-performing reply examples`);
      console.log(`[REPLY_INSIGHTS] 📊 Best generators: ${replyInsights.bestGenerators.join(', ')}`);
      console.log(`[REPLY_INSIGHTS] 📊 Best topics: ${replyInsights.bestTopics.slice(0, 3).join(', ')}`);
    } else {
      console.log('[REPLY_INSIGHTS] ⚠️ No reply insights yet (will build as replies perform)');
    }
  } catch (error: any) {
    console.warn('[REPLY_INSIGHTS] ⚠️ Reply insights unavailable:', error.message);
    replyInsights = null;
  }
  
  // ═══════════════════════════════════════════════════════════
  // 🧠 STEP 5.5: BUILD GROWTH INTELLIGENCE - ACTIVATED!
  // ═══════════════════════════════════════════════════════════
  
  let growthIntelligence;
  try {
    console.log('[GROWTH_INTEL] 🚀 Activating learning loops...');
    
    const { buildGrowthIntelligencePackage } = await import('../learning/growthIntelligence');
    growthIntelligence = await buildGrowthIntelligencePackage(matchedGenerator);
    
    // 🔥 FIX: Convert VI insights into visualFormattingInsights
    if (viInsights && viInsights.recommended_format) {
      // 🔥 ENHANCED: Get deeper content patterns from database
      const enrichedInsights = await enrichVIInsightsWithContentPatterns(viInsights, topic, angle, tone);
      const viFormatString = convertVIInsightsToString(enrichedInsights);
      
      // ✅ NEW: Add expert insights if available
      let expertAdviceString = '';
      if (viInsights.expert_insights) {
        expertAdviceString = convertExpertInsightsToAdvice(viInsights.expert_insights, viInsights.strategic_recommendations, viInsights.content_strategy);
      }
      
      // Combine VI insights + expert advice
      const combinedInsights = expertAdviceString 
        ? `${viFormatString}\n\n${expertAdviceString}`
        : viFormatString;
      
      // Append to existing visualFormattingInsights or create new
      if (growthIntelligence.visualFormattingInsights) {
        growthIntelligence.visualFormattingInsights = `${growthIntelligence.visualFormattingInsights}\n\n${combinedInsights}`;
      } else {
        growthIntelligence.visualFormattingInsights = combinedInsights;
      }
      console.log('[VI_INSIGHTS] ✅ Converted VI insights into intelligence package' + (expertAdviceString ? ' (with expert advice)' : ''));
    }
    
    // 🚀 NEW: Add reply insights to intelligence package
    if (replyInsights && replyInsights.topPerformingReplies.length > 0) {
      const replyInsightsString = convertReplyInsightsToGuidance(replyInsights);
      
      if (growthIntelligence.visualFormattingInsights) {
        growthIntelligence.visualFormattingInsights = `${growthIntelligence.visualFormattingInsights}\n\n${replyInsightsString}`;
      } else {
        growthIntelligence.visualFormattingInsights = replyInsightsString;
      }
      
      // Also add as structured data for generators
      (growthIntelligence as any).replyPatterns = {
        bestGenerators: replyInsights.bestGenerators,
        bestTopics: replyInsights.bestTopics,
        avgEngagement: replyInsights.avgEngagement,
        examples: replyInsights.topPerformingReplies.slice(0, 3) // Top 3 examples
      };
      
      console.log('[REPLY_INSIGHTS] ✅ Added reply patterns to intelligence package');
    }
    
    console.log('[GROWTH_INTEL] ✅ Growth intelligence generated for ' + matchedGenerator);
  } catch (error: any) {
    console.warn('[GROWTH_INTEL] ⚠️ Intelligence unavailable:', error.message);
    growthIntelligence = undefined;
  }
  
  // STEP 6: Call dedicated generator (SYSTEM B - Specialized prompts!)
  console.log(`[CONTENT_GEN] 🎭 Calling dedicated ${matchedGenerator} generator...`);
  
  llmMetrics.calls_total++;
  
  // ═══════════════════════════════════════════════════════════
  // 🚀 PHASE 4 ROUTING: Conditionally use orchestratorRouter
  // ═══════════════════════════════════════════════════════════
  const { shouldUsePhase4Routing, routeContentGeneration } = await import('../ai/orchestratorRouter');
  const usePhase4Routing = shouldUsePhase4Routing();
  
  let generatedContent: any;
  
  if (usePhase4Routing) {
    // Phase 4: Use orchestratorRouter
    console.log('[PHASE4] 🚀 Using Phase 4 orchestratorRouter');
    
    const routerResponse = await routeContentGeneration({
      decision_type: decidedPostType, // Use distribution decision
      content_slot: selectedSlot,
      topic,
      angle,
      tone,
      formatStrategy: typeof formatStrategy === 'string' ? formatStrategy : JSON.stringify(formatStrategy),
      generator_name: matchedGenerator, // Pass pre-matched generator for identical behavior
      priority_score: null, // Regular posts don't have priority_score
      dynamicTopic,
      growthIntelligence,
      viInsights,
      angle_type: (dynamicTopic as any)?.angle_type,
      tone_is_singular: (dynamicTopic as any)?.tone_is_singular,
      tone_cluster: (dynamicTopic as any)?.tone_cluster,
      structural_type: (dynamicTopic as any)?.structural_type
    });
    
    // Convert router response to same format as callDedicatedGenerator
    generatedContent = {
      text: routerResponse.text,
      format: routerResponse.format,
      topic: routerResponse.topic,
      angle: routerResponse.angle,
      tone: routerResponse.tone,
      visual_format: routerResponse.visual_format,
      angle_type: routerResponse.angle_type,
      tone_is_singular: routerResponse.tone_is_singular,
      tone_cluster: routerResponse.tone_cluster,
      structural_type: routerResponse.structural_type
    };
  } else {
    // Legacy: Use existing callDedicatedGenerator
    generatedContent = await callDedicatedGenerator(matchedGenerator, {
      topic,
      angle,
      tone,
      formatStrategy,
      dynamicTopic,
      growthIntelligence, // ✅ Now passed to generator!
      viInsights // ✅ NEW: Pass VI insights to generator
    });
  }
  
  if (!generatedContent) {
    llmMetrics.errors++;
    throw new Error('Empty response from dedicated generator');
  }
  
  llmMetrics.success++;
  
  // ═══════════════════════════════════════════════════════════
  // 🚪 POST QUALITY GATE: Validate content matches contract
  // ═══════════════════════════════════════════════════════════
  const { checkPostQuality, shouldRegenerate } = await import('../gates/PostQualityGate');
  
  // Convert generated content to PostPlan format
  let postPlan: any;
  const isGeneratedThread = Array.isArray(generatedContent.text);
  
  if (decidedPostType === 'single') {
    postPlan = {
      post_type: 'single',
      text: isGeneratedThread ? generatedContent.text[0] : generatedContent.text
    };
  } else {
    postPlan = {
      post_type: 'thread',
      tweets: isGeneratedThread ? generatedContent.text : [generatedContent.text],
      thread_goal: `${topic}: ${angle}`
    };
  }
  
  // Validate with quality gate (up to 3 attempts)
  let qualityCheck = checkPostQuality(postPlan);
  let regenerationAttempt = 0;
  const MAX_QUALITY_ATTEMPTS = 3;
  
  while (!qualityCheck.passed && regenerationAttempt < MAX_QUALITY_ATTEMPTS) {
    regenerationAttempt++;
    console.log(`[POST_GATE] ❌ REJECTED: ${qualityCheck.reason} (attempt ${regenerationAttempt}/${MAX_QUALITY_ATTEMPTS})`);
    console.log(`[POST_GATE] Issues: ${qualityCheck.issues.join(', ')}`);
    
    if (!shouldRegenerate(qualityCheck)) {
      break; // Non-critical issues, accept anyway
    }
    
    // Regenerate with stricter constraints
    console.log(`[POST_GATE] 🔄 Regenerating with stricter constraints...`);
    
    const stricterPromptAddition = decidedPostType === 'single'
      ? `\n\nCRITICAL: This MUST be a SINGLE tweet. NO numbering (1/5, 2/5), NO thread emoji (🧵), NO words like "thread" or "part 1", NO phrases like "let's explore" or "more below". Just one complete, standalone tweet.`
      : `\n\nCRITICAL: This MUST be a THREAD with 2-6 tweets. Each tweet must be <= 280 chars. Include strong hook in first tweet and clear takeaway in last tweet.`;
    
    // Regenerate (simplified - reuse existing generator)
    if (usePhase4Routing) {
      const routerResponse = await routeContentGeneration({
        decision_type: decidedPostType,
        content_slot: selectedSlot,
        topic,
        angle,
        tone,
        formatStrategy: (typeof formatStrategy === 'string' ? formatStrategy : JSON.stringify(formatStrategy)) + stricterPromptAddition,
        generator_name: matchedGenerator,
        priority_score: null,
        dynamicTopic,
        growthIntelligence,
        viInsights,
        angle_type: (dynamicTopic as any)?.angle_type,
        tone_is_singular: (dynamicTopic as any)?.tone_is_singular,
        tone_cluster: (dynamicTopic as any)?.tone_cluster,
        structural_type: (dynamicTopic as any)?.structural_type
      });
      
      generatedContent = {
        text: routerResponse.text,
        format: routerResponse.format,
        topic: routerResponse.topic,
        angle: routerResponse.angle,
        tone: routerResponse.tone,
        visual_format: routerResponse.visual_format,
        angle_type: routerResponse.angle_type,
        tone_is_singular: routerResponse.tone_is_singular,
        tone_cluster: routerResponse.tone_cluster,
        structural_type: routerResponse.structural_type
      };
    } else {
      generatedContent = await callDedicatedGenerator(matchedGenerator, {
        topic,
        angle,
        tone,
        formatStrategy: (typeof formatStrategy === 'string' ? formatStrategy : formatStrategy) + stricterPromptAddition,
        dynamicTopic,
        growthIntelligence,
        viInsights
      });
    }
    
    // Rebuild postPlan
    const isRegeneratedThread = Array.isArray(generatedContent.text);
    if (decidedPostType === 'single') {
      postPlan = {
        post_type: 'single',
        text: isRegeneratedThread ? generatedContent.text[0] : generatedContent.text
      };
    } else {
      postPlan = {
        post_type: 'thread',
        tweets: isRegeneratedThread ? generatedContent.text : [generatedContent.text],
        thread_goal: `${topic}: ${angle}`
      };
    }
    
    qualityCheck = checkPostQuality(postPlan);
  }
  
  if (qualityCheck.passed) {
    console.log(`[POST_GATE] ✅ ACCEPTED: ${qualityCheck.reason}${regenerationAttempt > 0 ? ` (after ${regenerationAttempt} regeneration${regenerationAttempt > 1 ? 's' : ''})` : ''}`);
  } else {
    console.log(`[POST_GATE] ⚠️ ACCEPTED WITH WARNINGS after ${MAX_QUALITY_ATTEMPTS} attempts: ${qualityCheck.reason}`);
    console.log(`[POST_GATE] Warnings: ${qualityCheck.issues.join(', ')}`);
  }
  
  const contentData = generatedContent;
  
  // LEGACY FUNCTION (unused now, kept for reference)
  function buildContentPrompt(topic: string, angle: string, tone: string, generator: string, formatStrategy: string) {
    const system = `You are a health content creator.

Generator personality: ${generator}
Topic: ${topic}
Angle: ${angle}
Tone: ${tone}

🎨 FORMATTING STRATEGY:
${formatStrategy}

Apply this formatting strategy to structure your content visually and organizationally.

Create engaging health content that:
1. Explores the TOPIC from this specific ANGLE
2. Uses this exact TONE/voice
3. Applies the FORMATTING STRATEGY for visual engagement
4. Target 200-270 characters (Twitter's limit is 280, but leaving room is professional)
5. No first-person (I/me/my)
6. Avoid emojis (use 0-1 maximum, strategically placed per format strategy)
7. Balance expert knowledge with clear communication:
   - Use technical terms when they add value (shows expertise)
   - Briefly explain what they mean in simple terms or parentheses
   - Include specific data, dosages, or mechanisms (builds credibility)
   - Keep sentences clear and direct (no unnecessary complexity)

HUMAN-LIKE CONTENT RULES:
- Vary your openings - don't always start with "Research shows" or "Studies find"
- Use numbers and citations only when they strengthen your point
- Mix formal and casual language based on the topic
- For practical tips: be conversational and direct
- For research topics: cite studies naturally, not robotically
- For controversial topics: be provocative without being preachy
- Sound like a knowledgeable friend who happens to be an expert

Be specific, interesting, and match the tone precisely. Sound like an expert who communicates clearly to an intelligent audience. Let the formatting strategy guide your visual structure.`;

    const user = `Create content about "${topic}" from this angle: "${angle}" using this tone: "${tone}".

⚠️ CRITICAL: Return your response as valid JSON format (required for API).

🧵 THREAD vs SINGLE DECISION:
- ~93% of posts should be SINGLE tweets (quick, punchy, easy to consume)
- ~7% of posts should be THREADS (complex topics that benefit from depth)

Choose THREAD format when:
- Topic requires step-by-step explanation
- Multiple related points build on each other
- Story or case study format works best
- Data/research needs context and interpretation

Choose SINGLE format when:
- One clear, punchy point
- Quick tip or insight
- Data point stands alone
- Question to audience

REQUIRED FORMAT - return JSON:

FOR SINGLE TWEETS:
{
  "text": "Your tweet content here (ideal: 200-270 chars)",
  "format": "single"
}

FOR THREADS (4-5 tweets ideal):
{
  "text": [
    "Tweet 1: Strong hook that makes them want to read more (200-270 chars)",
    "Tweet 2: Build on tweet 1, add key insight (200-270 chars)",
    "Tweet 3: Continue the story/explanation (200-270 chars)",
    "Tweet 4: Conclusion or key takeaway (200-270 chars)"
  ],
  "format": "thread"
}

CONTENT REQUIREMENTS (all formats):
- Length: 200-270 characters per tweet (max 280, leave room)
- No first-person (I/me/my)
- 0-2 emojis maximum per tweet (preferably 0-1)
- NO hashtags ever
- Sound like an expert, not a textbook
- Be specific and interesting
- Match the TONE and ANGLE precisely

THREAD-SPECIFIC RULES:
- Each tweet should make sense on its own but connect to the next
- Natural flow between tweets (no "1/4", "2/4" numbering)
- First tweet is the HOOK - make it compelling
- Last tweet is the PAYOFF - strong conclusion or actionable takeaway
- 4-5 tweets is ideal (minimum 2, maximum 6)`;
  
  return { system, user };
  }

  // Validate and clean the response - handle both single tweets and threads
  const tweetText = contentData.text;
  if (!tweetText) {
    console.error('[PLAN_JOB] ❌ Generator response missing text field:', contentData);
    throw new Error('Invalid content: missing text field');
  }
  
  let isThread = Array.isArray(tweetText);
  
  // ✅ FIX: Use the format WE selected (line 288: 7% threads), not what AI returned
  // The AI cannot override our 7% thread rate decision
  const format = contentData.format; // This is now selectedFormat (fixed at line 304)
  
  // ⚠️ ENFORCE FORMAT: If AI returned wrong format, convert it
  if (format === 'single' && isThread) {
    console.warn(`[PLAN_JOB] ⚠️ AI returned array but we selected SINGLE, using first tweet only`);
    contentData.text = tweetText[0];
    isThread = false; // Update isThread after conversion
  } else if (format === 'thread' && !isThread) {
    console.warn(`[PLAN_JOB] ⚠️ AI returned string but we selected THREAD, converting to array`);
    contentData.text = [tweetText];
    isThread = true; // Update isThread after conversion
  }
  
  if (isThread) {
    // Validate thread format
    if (tweetText.length < 2 || tweetText.length > 8) {
      console.warn(`[PLAN_JOB] ⚠️ Thread has ${tweetText.length} tweets, using first 4`);
      contentData.text = tweetText.slice(0, 4);
    } else {
      contentData.text = tweetText;
    }
    
    // Validate each tweet length
    const threadTweets: string[] = [];
    const originalTweets = Array.isArray(contentData.text) ? contentData.text as string[] : [];
    for (let i = 0; i < originalTweets.length; i++) {
      let tweet = originalTweets[i];
      if (tweet.length > 280) {
        console.warn(`[PLAN_JOB] ⚠️ Thread tweet ${i + 1} has ${tweet.length} chars (limit 280) - attempting auto-shorten`);
        const shortened = await ensureTweetWithinLimit(tweet, {
          topic,
          angle,
          tone,
          generator: matchedGenerator,
          slot: `${i + 1}/${originalTweets.length}`
        });
        if (!shortened) {
          const error: any = new Error(`LENGTH_VIOLATION: thread tweet ${i + 1} has ${tweet.length} chars (limit 280)`);
          error.code = 'LENGTH_VIOLATION';
          error.meta = { format: 'thread', tweetIndex: i, length: tweet.length };
          throw error;
        }
        console.log(`[PLAN_JOB] ✂️ Thread tweet ${i + 1} trimmed to ${shortened.length} chars`);
        tweet = shortened;
      }
      threadTweets.push(tweet);
    }
    contentData.text = threadTweets;
    
    console.log(`[PLAN_JOB] 🧵 ✨ THREAD GENERATED: ${contentData.text.length} tweets`);
    console.log(`[PLAN_JOB] 🧵 Thread preview:`);
    contentData.text.forEach((tweet: string, i: number) => {
      console.log(`[PLAN_JOB] 🧵   Tweet ${i+1}/${contentData.text.length}: "${tweet.substring(0, 80)}..." (${tweet.length} chars)`);
    });
  } else {
    // Handle single tweet
    let singleTweet = tweetText;
    if (singleTweet.length > 280) {
      console.warn(`[PLAN_JOB] ⚠️ Single tweet has ${singleTweet.length} chars (limit 280) - attempting auto-shorten`);
      const shortened = await ensureTweetWithinLimit(singleTweet, {
        topic,
        angle,
        tone,
        generator: matchedGenerator
      });
      if (!shortened) {
        const error: any = new Error(`LENGTH_VIOLATION: single tweet has ${singleTweet.length} chars (limit 280)`);
        error.code = 'LENGTH_VIOLATION';
        error.meta = { format: 'single', length: singleTweet.length };
        throw error;
      }
      console.log(`[PLAN_JOB] ✂️ Single tweet trimmed to ${shortened.length} chars`);
      singleTweet = shortened;
    }
    contentData.text = singleTweet;
    console.log(`[PLAN_JOB] 📝 Generated single tweet (${contentData.text.length} chars)`);
  }

  // Select timing with same-day preference
  const scheduledAt = await selectOptimalSchedule();

  return {
    decision_id,
    text: contentData.text,
    topic: contentData.topic || topic, // Use AI-generated topic
    raw_topic: topic, // Store for diversity tracking
    angle: angle, // Store AI-generated angle
    tone: tone, // Store AI-generated tone
    generator_used: matchedGenerator, // Track which generator created this
    format_strategy: formatStrategy, // ✅ AI-generated format strategy
    visual_format: contentData.visual_format || null, // ✅ AI-generated visual formatting
    topic_cluster: dynamicTopic.dimension || 'health',
    style: tone, // Map tone to style for compatibility
    format: format,
    content_slot: selectedSlot, // 🎯 v2: Store content slot from micro calendar
    quality_score: calculateQuality(Array.isArray(contentData.text) ? contentData.text.join(' ') : contentData.text),
    predicted_er: 0.03,
    timing_slot: scheduledAt.getHours(),
    scheduled_at: scheduledAt.toISOString(),
    
    // 🧠 META-AWARENESS: Pass through AI's cluster choices for database storage
    topic_cluster_sampled: dynamicTopic.cluster_sampled || null,
    angle_type: contentData.angle_type || null,
    tone_is_singular: contentData.tone_is_singular !== false,
    tone_cluster: contentData.tone_cluster || null,
    structural_type: contentData.structural_type || null,
    vi_insights: viInsights // ✅ NEW: Store VI insights for visual enhancement
  };
}

/**
 * 🎨 NEW FUNCTION: Format content with visual formatter BEFORE queueing
 * This ensures database stores FINAL product, not intermediate content
 */
async function formatAndQueueContent(content: any): Promise<void> {
  console.log(`[PLAN_JOB] 🎨 Applying visual formatting to content...`);
  
  // ✅ NEW: Apply VI visual patterns BEFORE standard formatting
  if (content.vi_insights) {
    try {
      console.log('[PLAN_JOB] 🎨 Applying VI visual patterns...');
      const { enhanceContentWithVI } = await import('../generators/viContentEnhancer');
      content.text = await enhanceContentWithVI(content.text, content.vi_insights);
      console.log('[PLAN_JOB] ✅ VI visual patterns applied');
    } catch (error: any) {
      console.warn('[PLAN_JOB] ⚠️ VI visual enhancement failed:', error.message, '(continuing with standard formatting)');
    }
  }
  
  // Handle single tweet vs thread
  const isThread = Array.isArray(content.text);
  
  if (isThread) {
    // Format each tweet in thread
    const formattedTweets: string[] = [];
    let visualApproach: string | null = null;
    
    for (let i = 0; i < content.text.length; i++) {
      console.log(`[PLAN_JOB]   📝 Formatting thread tweet ${i + 1}/${content.text.length}...`);
      
      const formatResult = await formatContentForTwitter({
        content: content.text[i],
        generator: String(content.generator_used || 'unknown'),
        topic: String(content.raw_topic || 'health'),
        angle: String(content.angle || 'informative'),
        tone: String(content.tone || 'educational'),
        formatStrategy: String(content.format_strategy || 'thread')
      });
      
      let formatted = formatResult.formatted;
      
      // 🧵 ADD THREAD EMOJI TO FIRST TWEET ONLY
      if (i === 0) {
        visualApproach = formatResult.visualApproach;
        
        const hasThreadIndicator = formatted.includes('🧵') || 
                                   formatted.toLowerCase().includes('thread') ||
                                   formatted.includes('👇');
        
        if (!hasThreadIndicator) {
          // Add emoji at end
          if (formatted.match(/[.!?]$/)) {
            formatted = formatted + ' 🧵';
          } else {
            formatted = formatted + '. 🧵';
          }
          console.log(`[PLAN_JOB] ✅ Added thread emoji (🧵) to first tweet`);
        } else {
          console.log(`[PLAN_JOB] ℹ️ Thread indicator already present in first tweet`);
        }
      }
      
      formattedTweets.push(formatted);
    }
    
    // Update content with formatted tweets
    content.text = formattedTweets;
    content.visual_format = visualApproach || 'thread_formatted';
    
    console.log(`[PLAN_JOB] ✅ Thread formatted (${formattedTweets.length} tweets) with emoji indicator`);
    
  } else {
    // Format single tweet
    const formatResult = await formatContentForTwitter({
      content: content.text,
      generator: String(content.generator_used || 'unknown'),
      topic: String(content.raw_topic || 'health'),
      angle: String(content.angle || 'informative'),
      tone: String(content.tone || 'educational'),
      formatStrategy: String(content.format_strategy || 'single')
    });
    
    // Update content with formatted version
    content.text = formatResult.formatted;
    content.visual_format = formatResult.visualApproach;
    
    console.log(`[PLAN_JOB] ✅ Single tweet formatted: ${formatResult.visualApproach}`);
  }
  
  // Now queue the FORMATTED content
  await queueContent(content);
}

async function queueContent(content: any): Promise<void> {
  const supabase = getSupabaseClient();
  
  // Handle content storage for both single tweets and threads
  // NOTE: content.text is now ALREADY FORMATTED by formatAndQueueContent()
  const contentText = Array.isArray(content.text) 
    ? content.text.join('\n\n--- THREAD BREAK ---\n\n') // Store threads with separators
    : content.text;
  
  // ═══════════════════════════════════════════════════════════
  // 🧪 PHASE 4 EXPERIMENTS: Assign experiment metadata (only if experiments enabled)
  // ═══════════════════════════════════════════════════════════
  const enableExperiments = process.env.ENABLE_PHASE4_EXPERIMENTS === 'true';
  let experimentAssignment: { experiment_group: string | null; hook_variant: string | null } = {
    experiment_group: null,
    hook_variant: null
  };
  
  // Check if Phase 4 routing is enabled for experiments
  const { shouldUsePhase4Routing } = await import('../ai/orchestratorRouter');
  const phase4Enabled = shouldUsePhase4Routing();
  
  if (enableExperiments && phase4Enabled) {
    try {
      const { assignExperiment } = await import('../experiments/experimentAssigner');
      experimentAssignment = assignExperiment(content.content_slot || 'practical_tip');
    } catch (error: any) {
      console.warn(`[PHASE4][Experiment] Failed to assign experiment:`, error.message);
    }
  }

  // 🎤 PHASE 5: Voice Guide - Choose voice characteristics
  let voiceDecision: any = null;
  try {
    const { chooseVoiceForContent } = await import('../ai/voiceGuide');
    const selectedSlot = content.content_slot || null;
    const generatorName = content.generator_used || 'unknown';
    const decisionType = content.format === 'thread' ? 'thread' : 'single';
    
    // 🚀 THREAD_BOOST DEBUG: Log final decision type after all processing
    const threadBoostEnabled = process.env.ENABLE_THREAD_BOOST === 'true';
    const threadBoostRate = parseFloat(process.env.THREAD_BOOST_RATE || '0.5');
    const rng = Math.random();
    const eligibleSlots = ['framework', 'deep_dive', 'research', 'educational'];
    const isEligibleSlot = selectedSlot && eligibleSlots.includes(selectedSlot);
    const wasBoosted = threadBoostEnabled && isEligibleSlot && rng < threadBoostRate;
    
    console.log(`[THREAD_BOOST][DEBUG] enabled=${threadBoostEnabled} rate=${threadBoostRate} rng=${rng.toFixed(3)} selected=${wasBoosted} chosenDecisionType=${decisionType} slot=${selectedSlot}`);
    
    console.log(`[VOICE_GUIDE] planJob: slot=${selectedSlot} generator=${generatorName} decisionType=${decisionType}`);
    
    voiceDecision = chooseVoiceForContent({
      slot: selectedSlot,
      generatorName: generatorName,
      decisionType: decisionType,
      topic: content.raw_topic || (content as any).topic || null
    });
    
    console.log(`[VOICE_GUIDE] planJob decision: hook=${voiceDecision.hookType} tone=${voiceDecision.tone} structure=${voiceDecision.structure}`);
  } catch (error: any) {
    console.error(`[VOICE_GUIDE] ❌ Error in planJob: ${error.message}`);
    console.error(`[VOICE_GUIDE] Error stack: ${error.stack}`);
    // Continue without voice decision - will use defaults
  }

  // 🔧 Build insert payload with optional meta-awareness fields
  // (Supabase schema cache may not have refreshed yet)
  const insertPayload: any = {
    decision_id: content.decision_id,
    content: contentText,
    generation_source: 'real',
    content_slot: content.content_slot || null, // 🎯 v2: Store content slot
    status: 'queued',
    decision_type: content.format === 'thread' ? 'thread' : 'single',
    scheduled_at: content.scheduled_at,
    // 🛡️ Clamp quality_score to valid DECIMAL(5,4) range (0-9.9999)
    // If quality_score is 0-100 scale, convert to 0-1.0 scale
    quality_score: content.quality_score != null ? Math.min(9.9999, Math.max(0, content.quality_score > 1 ? content.quality_score / 100 : content.quality_score)) : null,
    // 🛡️ Clamp predicted_er to valid DECIMAL(5,4) range (0-9.9999)
    predicted_er: content.predicted_er != null ? Math.min(9.9999, Math.max(0, content.predicted_er)) : null,
    
    // Core diversity fields (always present)
    // 🔧 FIX: Ensure raw_topic is never NULL - use fallback chain
    raw_topic: content.raw_topic || (content as any).topic || 'health_general',
    angle: content.angle,
    tone: content.tone,
    generator_name: content.generator_used,
    format_strategy: content.format_strategy,
    visual_format: content.visual_format || null,
    
    // 🎤 PHASE 5: Voice Guide metadata (if available)
    hook_type: voiceDecision?.hookType || null, // Store hook type for v2 learning
    structure_type: voiceDecision?.structure || null, // Store structure type for v2 learning
    // Note: tone is already stored above, but voiceDecision.tone could override if needed
    
    // Legacy fields for compatibility
    bandit_arm: content.style || 'varied',
    timing_arm: `slot_${content.timing_slot}`,
    thread_parts: Array.isArray(content.text) ? content.text : null,
    
    // 🧪 Phase 4: Experiment metadata (only include if experiments enabled)
    // Note: These columns may not exist in schema if experiments migration not applied
    // We'll conditionally include them only if experiments are enabled
  };
  
  // Only add experiment fields if experiments are enabled (columns may not exist)
  if (enableExperiments && experimentAssignment.experiment_group) {
    insertPayload.experiment_group = experimentAssignment.experiment_group;
    insertPayload.hook_variant = experimentAssignment.hook_variant;
  }
  
  // 🎯 v2: Log content_slot being stored
  console.log(`[PLAN_JOB] 📅 Content slot: ${insertPayload.content_slot || 'NULL'} for decision ${content.decision_id}`);
  
  // 🧪 Phase 4: Log experiment assignment
  if (experimentAssignment.experiment_group) {
    console.log(`[PHASE4][Experiment] Assigned experiment_group=${experimentAssignment.experiment_group} hook_variant=${experimentAssignment.hook_variant} to decision_id=${content.decision_id}`);
  }
  
  // 🧵 THREAD TRACKING: Log when threads are queued
  if (insertPayload.decision_type === 'thread') {
    const decisionId = content.decision_id || insertPayload.decision_id || 'unknown';
    const threadPartsCount = insertPayload.thread_parts?.length || 0;
    console.log(`[QUEUE_CONTENT] 🧵 THREAD QUEUED: decision_id=${decisionId} parts=${threadPartsCount}`);
    console.log(`[QUEUE_CONTENT] 🧵   Scheduled: ${insertPayload.scheduled_at}`);
    console.log(`[QUEUE_CONTENT] 🧵   Parts: ${threadPartsCount} tweets`);
  }
  
  // ✅ REMOVED: metadata field doesn't exist in schema
  // Store meta-awareness in other fields instead
  
  // Clean up payload - remove undefined fields
  delete insertPayload.topic_cluster_sampled;
  delete insertPayload.angle_type;
  delete insertPayload.tone_is_singular;
  delete insertPayload.tone_cluster;
  delete insertPayload.metadata;
  
  log({ op: 'queue_content', decision_id: content.decision_id, decision_type: insertPayload.decision_type, thread_parts: insertPayload.thread_parts?.length });
  
  // 🔥 CRITICAL FIX: Insert into TABLE, not VIEW
  const { data, error} = await supabase.from('content_generation_metadata_comprehensive').insert([insertPayload]);
  
  if (error) {
    log({ op: 'queue_content', outcome: 'error', error: error.message, decision_id: content.decision_id });
    console.error(`[PLAN_JOB] ❌ Failed to queue content:`, error);
    throw new Error(`Database insert failed: ${error.message}`);
  }
  
  log({ op: 'queue_content', outcome: 'success', decision_id: content.decision_id });
  console.log(`[PLAN_JOB] 💾 Content queued in database: ${content.decision_id}`);
}

async function runGateChain(text: string, decision_id: string) {
  const flags = getConfig();
  
  // Quality gate
  const quality = calculateQuality(text);
  if (quality < flags.MIN_QUALITY_SCORE) {
    return { passed: false, gate: 'quality', reason: 'below_threshold' };
  }
  
  // 🛡️ v2 UPGRADE: Medical Safety Gate
  try {
    const { analyzeMedicalSafety } = await import('../utils/medicalSafetyGuard');
    
    // Quick check first (fast, no AI call)
    const { quickSafetyCheck } = await import('../utils/medicalSafetyGuard');
    const quickCheck = quickSafetyCheck(Array.isArray(text) ? text.join(' ') : text);
    
    if (quickCheck.hasObviousIssues) {
      console.log(`[MEDICAL_SAFETY] ⚠️ Quick check found issues: ${quickCheck.issues.join(', ')}`);
      // Continue to full AI check
    }
    
    // Full AI safety check
    const safetyResult = await analyzeMedicalSafety(
      Array.isArray(text) ? text.join(' ') : text,
      {
        maxRetries: 2, // Allow 2 rewrite attempts
        strictMode: false, // Normal mode (not overly strict)
        requireDisclaimers: true // Always add disclaimers
      }
    );
    
    if (!safetyResult.isSafe) {
      console.log(`[MEDICAL_SAFETY] ⛔ Content rejected: ${safetyResult.riskLevel} risk`);
      console.log(`[MEDICAL_SAFETY]    Issues: ${safetyResult.issues.join('; ')}`);
      
      return {
        passed: false,
        gate: 'medical_safety',
        reason: `risk_level_${safetyResult.riskLevel}`,
        safetyResult: safetyResult // Include result for potential retry with rewritten content
      } as any; // Type assertion needed for safetyResult field
    }
    
    // If content was rewritten and is safe, return it in the result
    if (safetyResult.rewrittenContent && safetyResult.rewrittenContent !== text) {
      console.log(`[MEDICAL_SAFETY] ✅ Content made safe (rewritten)`);
      // Store rewritten content in result for caller to use
      return {
        passed: true,
        rewrittenContent: safetyResult.rewrittenContent
      } as any;
    } else {
      console.log(`[MEDICAL_SAFETY] ✅ Content passed safety check`);
    }
    
  } catch (error: any) {
    console.warn(`[MEDICAL_SAFETY] ⚠️ Safety check failed: ${error.message}, allowing content (fail-open)`);
    // Fail-open: if safety check fails, allow content (don't block on technical errors)
  }
  
  // Uniqueness gate (simplified for now)
  const unique = await checkUniqueness(text);
  if (!unique) {
    return { passed: false, gate: 'uniqueness', reason: 'too_similar' };
  }
  
  return { passed: true };
}

async function analyzeTopicPerformance() {
  const supabase = getSupabaseClient();
  
  // Query outcomes to see what topics/content perform best
  const { data: recentOutcomes } = await supabase
    .from('outcomes')
    .select('decision_id, impressions, likes, retweets, replies, follows')
    .eq('simulated', false)
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(50);

  // Map to content_metadata to get topics
  const decisionIds = recentOutcomes?.map(o => o.decision_id) || [];
  
  if (decisionIds.length === 0) {
    // No data yet, use defaults
    return {
      topTopics: ['exercise', 'nutrition', 'sleep', 'mental_health'],
      lowTopics: [],
      avgEngagement: 0.03,
      sampleSize: 0
    };
  }

  const { data: contentData } = await supabase
    .from('content_metadata')
    .select('id, content, topic')
    .in('id', decisionIds);

  // Calculate performance by topic
  const topicPerformance: Record<string, { total_engagement: number, count: number }> = {};
  
  for (const outcome of recentOutcomes || []) {
    const content = contentData?.find(c => c.id === outcome.decision_id);
    if (!content?.topic) continue;
    
    // Type-safe access to outcome metrics
    const likes = Number(outcome.likes) || 0;
    const retweets = Number(outcome.retweets) || 0;
    const replies = Number(outcome.replies) || 0;
    const follows = Number(outcome.follows) || 0;
    
    const engagement = likes + retweets * 2 + replies * 3 + follows * 10;
    
    const topicKey = String(content.topic);
    if (!topicPerformance[topicKey]) {
      topicPerformance[topicKey] = { total_engagement: 0, count: 0 };
    }
    
    topicPerformance[topicKey].total_engagement += engagement;
    topicPerformance[topicKey].count += 1;
  }

  // Sort topics by average engagement
  const sortedTopics = Object.entries(topicPerformance)
    .map(([topic, data]) => ({
      topic,
      avgEngagement: data.total_engagement / data.count
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement);

  const topTopics = sortedTopics.slice(0, 3).map(t => t.topic);
  const lowTopics = sortedTopics.slice(-2).map(t => t.topic);

  console.log(`[PERFORMANCE_ANALYSIS] Analyzed ${recentOutcomes?.length || 0} recent outcomes`);
  console.log(`[PERFORMANCE_ANALYSIS] Top performers: ${topTopics.join(', ')}`);

  // AI-driven topic selection based on performance data
  let intelligentTopics;
  
  if (topTopics.length > 0) {
    // We have performance data - use AI-driven selection
    console.log(`[AI_TOPIC_SELECTION] Using performance data: ${topTopics.join(', ')}`);
    
    // Weight topics by performance but add exploration
    const explorationRate = 0.2; // 20% chance to explore new topics
    
    if (Math.random() < explorationRate) {
      // ✅ PURE AI EXPLORATION: No hardcoded lists!
      // Let AI generate completely random health topics from its unlimited knowledge
      console.log(`[AI_EXPLORATION] Asking AI to generate completely random health topic...`);
      
      // Use AI to generate the topic itself (not pick from a list!)
      intelligentTopics = ['AI_GENERATE_RANDOM_HEALTH_TOPIC', ...topTopics.slice(0, 2)];
      console.log(`[AI_EXPLORATION] AI will generate random topic (not limited to any list)`);
    } else {
      // Exploitation: focus on proven performers with some variety
      intelligentTopics = [...topTopics];
      console.log(`[AI_EXPLOITATION] Using proven performers: ${intelligentTopics.join(', ')}`);
    }
  } else {
    // No performance data yet - let AI generate random topics (NO HARDCODED LIST!)
    intelligentTopics = ['AI_GENERATE_RANDOM_HEALTH_TOPIC'];
    console.log(`[AI_BOOTSTRAP] No performance data - AI will generate completely random health topics`);
  }

  return {
    topTopics: intelligentTopics,
    lowTopics,
    avgEngagement: sortedTopics[0]?.avgEngagement || 0.03,
    sampleSize: recentOutcomes?.length || 0
  };
}

function buildSystemPrompt(performanceData: any): string {
  const hasData = performanceData.sampleSize > 0;
  const isHighPerformance = performanceData.avgEngagement > 0.05;
  
  return `You are an AI-driven health content strategist with unlimited creative freedom. Your decisions are guided by data, not restrictions.

${hasData ? `🧠 AI PERFORMANCE INTELLIGENCE:
- TOP PERFORMERS (double down on these): ${performanceData.topTopics.join(', ')}
- UNDERPERFORMERS (avoid unless exploring): ${performanceData.lowTopics.length > 0 ? performanceData.lowTopics.join(', ') : 'none identified'}
- Current engagement rate: ${performanceData.avgEngagement.toFixed(3)} (${isHighPerformance ? 'EXCELLENT' : 'ROOM FOR IMPROVEMENT'})
- Data confidence: ${performanceData.sampleSize} posts analyzed

🎯 AI STRATEGY DIRECTIVE:
${isHighPerformance ? 
  '- You are WINNING! Lean heavily into your top-performing topics while exploring adjacent areas' : 
  '- GROWTH MODE: Experiment aggressively with new angles, topics, and formats to find what resonates'}` : 
`🚀 AI BOOTSTRAP MODE:
- No performance data yet - you have COMPLETE CREATIVE FREEDOM
- Test diverse topics to build your intelligence database
- Focus on viral potential over safe content`}

🤖 AI CONTENT GENERATION RULES:
- UNLIMITED topic exploration - if data shows nutrition gets 10x engagement, CREATE MORE NUTRITION CONTENT
- UNLIMITED format variety - singles, threads, stories, data, myths, tips, questions
- UNLIMITED hook diversity - never repeat patterns, always surprise
- UNLIMITED creativity - break rules, challenge assumptions, be contrarian
- ZERO restrictions on health topics - cover everything from metabolism to mental health

🧬 VIRAL GROWTH ALGORITHM:
- Create content that makes people think "I NEED to follow this account"
- Share insights that 99% of health accounts don't know
- Bridge complex science to simple, actionable advice
- Use data-driven hooks that grab attention in first 5 words
- End with engagement triggers that drive comments/saves

🎭 VOICE INTELLIGENCE:
- Conversational expert (not academic robot)
- Confident but not arrogant
- Evidence-based but accessible
- Strategic emoji use (1-2 max, only if they add value)
- Vary sentence structure and length for rhythm

The AI has spoken. Create content that GROWS followers.`;
}

function buildDynamicPrompt(performanceData: any, style: string, dayOfWeek: string, month: string): string {
  const primaryTopic = performanceData.topTopics[0] || 'health';
  
  // AI-driven topic selection with performance weighting
  const availableTopics = performanceData.topTopics || ['health'];
  
  let selectedTopic;
  if (performanceData.sampleSize > 5) {
    // We have enough data to make intelligent decisions
    // Weight selection towards better-performing topics (80% of the time)
    if (Math.random() < 0.8) {
      // Favor top performers (exponential weighting)
      const weights = availableTopics.map((_, index) => Math.pow(2, availableTopics.length - index));
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
      const randomWeight = Math.random() * totalWeight;
      
      let cumulativeWeight = 0;
      for (let i = 0; i < availableTopics.length; i++) {
        cumulativeWeight += weights[i];
        if (randomWeight <= cumulativeWeight) {
          selectedTopic = availableTopics[i];
          break;
        }
      }
      console.log(`[AI_WEIGHTED_SELECTION] Selected high-performer: ${selectedTopic}`);
    } else {
      // 20% exploration - try other available topics
      selectedTopic = availableTopics[Math.floor(Math.random() * availableTopics.length)];
      console.log(`[AI_EXPLORATION_SELECTION] Exploring topic: ${selectedTopic}`);
    }
  } else {
    // Not enough data yet - balanced random selection
    selectedTopic = availableTopics[Math.floor(Math.random() * availableTopics.length)];
    console.log(`[AI_BOOTSTRAP_SELECTION] Bootstrap topic: ${selectedTopic}`);
  }
  
  const styleGuides: Record<string, string> = {
    research_insight: `Find a recent or surprising research finding about ${selectedTopic}. Make it feel cutting-edge and non-obvious. Focus on WHY it matters practically.`,
    
    practical_tip: `Share an actionable ${selectedTopic} tip that most people don't know but can implement today. Be specific about timing, dosage, or method.`,
    
    myth_buster: `Debunk a common health myth related to ${selectedTopic}. Start with what people believe, then flip it with evidence. Make it memorable.`,
    
    data_point: `Share a shocking statistic or data point about ${selectedTopic} that challenges assumptions. Connect it to a practical takeaway.`,
    
    story_based: `Tell a compelling mini-story or case study about ${selectedTopic}. Use ONLY real, documented stories from research, published case studies, or historical events. NO fictional characters or made-up stories. Every story must be research-backed and verifiable. Make it relatable and inspiring without being preachy.`,
    
    question_hook: `Start with a provocative question about ${selectedTopic}, then answer it in a surprising way. Make people reconsider what they thought they knew.`,
    
    comparison: `Compare two ${selectedTopic} approaches/methods showing why one is vastly superior. Use concrete numbers or examples.`,
    
    contrarian: `Take a contrarian stance on ${selectedTopic}. Challenge conventional wisdom with evidence. Be bold but not reckless.`,
    
    personal_experience: `Share a relatable scenario about ${selectedTopic} based on real research or documented experiences. Use "Imagine you're..." or "Picture this..." to draw readers in, but ground it in real science or documented cases. NO fictional characters or made-up stories.`,
    
    shocking_stat: `Lead with a jaw-dropping statistic about ${selectedTopic} that most people don't know. Explain why it matters and what to do about it.`,
    
    timeline_based: `Show the progression of ${selectedTopic} over time - "In 30 days...", "After 6 months...", "Within a year...". Make it aspirational.`,
    
    before_after: `Paint a vivid before/after picture related to ${selectedTopic}. Show the transformation that's possible with specific changes.`,
    
    expert_quote: `Reference what leading experts say about ${selectedTopic} that contradicts popular belief. Make it feel like insider knowledge.`,
    
    trend_analysis: `Analyze a current trend in ${selectedTopic}. Explain why it's happening now and whether it's worth following.`,
    
    common_mistake: `Expose a common mistake people make with ${selectedTopic}. Explain why it's wrong and what to do instead.`,
    
    life_hack: `Share a clever shortcut or optimization for ${selectedTopic} that saves time/effort while improving results.`,
    
    scientific_breakdown: `Break down the science behind ${selectedTopic} in simple terms. Make complex concepts accessible and actionable.`,
    
    real_world_example: `Use a concrete, real-world example to illustrate a point about ${selectedTopic}. Make it specific and relatable.`,
    
    challenge_assumption: `Challenge a widely-held assumption about ${selectedTopic}. Present evidence that flips conventional thinking.`,
    
    future_prediction: `Make a bold prediction about the future of ${selectedTopic} based on current research trends. Be thought-provoking.`
  };

  return `${styleGuides[style] || styleGuides.practical_tip}

Context: It's ${dayOfWeek}, ${month} 2024. Consider seasonality if relevant.

${performanceData.sampleSize > 10 ? `Data shows our audience engages most with ${performanceData.topTopics[0]} content, so prioritize that.` : ''}

Format as JSON (randomly choose between single tweet or thread for variety):

For single tweet:
{
  "text": "Your 280-char tweet (varied style, NO 'Did you know' pattern)",
  "topic": "${selectedTopic}",
  "angle": "specific hook/perspective used",
  "format": "single"
}

For thread (30% chance):
{
  "text": ["Tweet 1 text (hook + preview)", "Tweet 2 text (main insight)", "Tweet 3 text (actionable tip)", "Tweet 4 text (conclusion + engagement)"],
  "topic": "${selectedTopic}",
  "angle": "specific hook/perspective used",
  "format": "thread"
}`;
}

async function checkUniqueness(text: string | string[]): Promise<boolean> {
  const supabase = getSupabaseClient();
  
  // Handle both single tweets and threads
  const textToCheck = Array.isArray(text) ? text.join(' ') : text;
  
  // ✅ MEMORY OPTIMIZATION: Process recent posts in batches (prevents memory spikes)
  const { clearArrays } = await import('../utils/memoryOptimization');
  
  // Process in batches of 20 instead of loading all 100 at once
  const recentPosts: any[] = [];
  const batchSize = 20;
  let offset = 0;
  
  while (recentPosts.length < 100) { // Still get up to 100, but in batches
    const { data: batch } = await supabase
      .from('content_metadata')
      .select('content')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .range(offset, offset + batchSize - 1);
    
    if (!batch || batch.length === 0) {
      break; // No more posts
    }
    
    recentPosts.push(...batch);
    offset += batchSize;
    
    // If we got fewer than batchSize, we're done
    if (batch.length < batchSize) {
      break;
    }
    
    // Small delay for GC
    await new Promise(r => setTimeout(r, 10));
  }

  if (!recentPosts || recentPosts.length === 0) return true;

  // Simple word overlap check (TODO: add embedding-based similarity)
  const newWords = new Set(textToCheck.toLowerCase().split(/\s+/));
  
  for (const post of recentPosts) {
    const postContent = String(post.content || '');
    if (!postContent) continue;
    
    const existingWords = new Set(postContent.toLowerCase().split(/\s+/));
    const overlap = [...newWords].filter(w => existingWords.has(w)).length;
    const similarity = overlap / Math.max(newWords.size, existingWords.size);
    
    if (similarity > 0.7) {
      console.log(`[UNIQUENESS_CHECK] ❌ Too similar to existing post (${(similarity * 100).toFixed(0)}% overlap)`);
      return false;
    }
  }

  return true;
}

/**
 * 🕒 Select optimal schedule with same-day preference and grace window
 * 
 * Strategy:
 * 1. Check if cold start → schedule immediately
 * 2. Use UCB to find optimal slot
 * 3. Prefer same-day slots >= now + MIN_MINUTES_UNTIL_SLOT
 * 4. If no same-day slots, pick tomorrow's best slot
 */
async function selectOptimalSchedule(): Promise<Date> {
  const MIN_MINUTES_UNTIL_SLOT = parseInt(process.env.MIN_MINUTES_UNTIL_SLOT || '0', 10);
  const POST_NOW_ON_COLD_START = process.env.POST_NOW_ON_COLD_START !== 'false';
  const config = getConfig();
  
  // 🚀 AGGRESSIVE GROWTH MODE: Always schedule for immediate posting
  // Instead of waiting for optimal timing, we post every 30 minutes for 2 posts/hour
  const AGGRESSIVE_GROWTH_MODE = config.MODE === 'live';
  
  if (AGGRESSIVE_GROWTH_MODE) {
    console.log('[SCHEDULE] 🚀 AGGRESSIVE_GROWTH: Scheduling for immediate posting (2 posts/hour target)');
    
    // Schedule immediately (within 1-2 minutes for optimal engagement)
    const immediatePostTime = new Date(Date.now() + (1 + Math.random() * 1) * 60 * 1000);
    console.log(`[SCHEDULE] ⚡ Immediate post scheduled for: ${immediatePostTime.toISOString()}`);
    return immediatePostTime;
  }
  
  // Check for cold start (queue is empty) - fallback for non-aggressive mode
  if (POST_NOW_ON_COLD_START) {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    const { count, error } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued')
      .gte('scheduled_at', new Date().toISOString());
    
    if (!error && (count === 0 || count === null)) {
      console.log('[SCHEDULE] 🚀 Cold start detected - scheduling immediate post');
      return new Date(Date.now() + 30 * 1000); // 30 seconds from now
    }
  }
  
  // Use UCB timing to find optimal slot (only for non-aggressive mode)
  const { getUCBTimingBandit } = await import('../schedule/ucbTiming');
  const ucbTiming = getUCBTimingBandit();
  const timingSelection = await ucbTiming.selectTimingWithUCB();
  
  const now = new Date();
  const currentHour = now.getHours();
  
  // 🎯 ENHANCED PEAK HOUR OPTIMIZATION: Prioritize high-engagement windows
  // Peak hours: 6-9 AM (morning routine), 12-1 PM (lunch break), 6-8 PM (evening wind-down)
  // These windows get 30-50% higher early engagement = algorithm boost
  const isPeakHour = (hour: number): boolean => {
    return (hour >= 6 && hour <= 9) || (hour >= 12 && hour <= 13) || (hour >= 18 && hour <= 20);
  };
  
  // Calculate peak hour weight (higher weight = more likely to shift)
  const getPeakHourWeight = (hour: number): number => {
    if (hour >= 6 && hour <= 9) return 1.0;   // Morning: highest priority
    if (hour >= 12 && hour <= 13) return 0.9;  // Lunch: high priority
    if (hour >= 18 && hour <= 20) return 0.95; // Evening: very high priority
    return 0.5; // Off-peak: lower priority
  };
  
  // If selected slot is not peak hour, try to move to nearest peak hour
  if (!isPeakHour(timingSelection.slot)) {
    const peakHours = [
      { hour: 6, weight: 1.0 }, { hour: 7, weight: 1.0 }, { hour: 8, weight: 1.0 }, { hour: 9, weight: 0.9 },
      { hour: 12, weight: 0.9 }, { hour: 13, weight: 0.9 },
      { hour: 18, weight: 0.95 }, { hour: 19, weight: 0.95 }, { hour: 20, weight: 0.9 }
    ];
    
    // Find nearest peak hour (forward-looking)
    const futurePeakHours = peakHours.filter(p => p.hour > currentHour);
    const nearestPeakHour = futurePeakHours.length > 0 
      ? futurePeakHours[0] 
      : peakHours[0]; // Wrap to next day if needed
    
    // Use nearest peak hour if it's within 3 hours (more aggressive)
    const hoursUntilPeak = nearestPeakHour.hour > currentHour 
      ? nearestPeakHour.hour - currentHour 
      : (24 - currentHour) + nearestPeakHour.hour;
    
    if (hoursUntilPeak > 0 && hoursUntilPeak <= 3) {
      console.log(`[SCHEDULE] 🎯 Shifting to peak hour ${nearestPeakHour.hour} (weight: ${nearestPeakHour.weight}, was ${timingSelection.slot})`);
      timingSelection.slot = nearestPeakHour.hour;
    }
  }
  
  // Calculate target time for the selected slot
  let targetDate = new Date(now);
  targetDate.setHours(timingSelection.slot, 0, 0, 0);
  
  // 🎲 RANDOMIZED SCHEDULING: Add random minutes to prevent spam detection
  const randomMinutes = Math.floor(Math.random() * 60); // 0-59 minutes
  targetDate.setMinutes(randomMinutes);
  console.log(`[SCHEDULE] 🎲 Randomized timing: ${timingSelection.slot}:${randomMinutes.toString().padStart(2, '0')}`);
  
  // If selected slot is earlier than now + MIN_MINUTES, move to tomorrow
  const minTime = now.getTime() + MIN_MINUTES_UNTIL_SLOT * 60 * 1000;
  
  if (targetDate.getTime() < minTime) {
    // Try to find next same-day slot
    let foundSameDaySlot = false;
    
    for (let hour = currentHour + 1; hour < 24; hour++) {
      const testDate = new Date(now);
      testDate.setHours(hour, 0, 0, 0);
      
      if (testDate.getTime() >= minTime) {
        targetDate = testDate;
        // 🎲 RANDOMIZE same-day slots too
        const randomMinutes = Math.floor(Math.random() * 60);
        targetDate.setMinutes(randomMinutes);
        foundSameDaySlot = true;
        console.log(`[SCHEDULE] 📅 Using same-day slot: ${hour}:${randomMinutes.toString().padStart(2, '0')}`);
        break;
      }
    }
    
    if (!foundSameDaySlot) {
      // No same-day slots available, use tomorrow at selected slot
      targetDate.setDate(targetDate.getDate() + 1);
      // 🎲 RANDOMIZE tomorrow slots too
      const randomMinutes = Math.floor(Math.random() * 60);
      targetDate.setMinutes(randomMinutes);
      console.log(`[SCHEDULE] 📅 No same-day slots, using tomorrow at ${timingSelection.slot}:${randomMinutes.toString().padStart(2, '0')}`);
    }
  } else {
    console.log(`[SCHEDULE] 📅 Using selected slot today at ${timingSelection.slot}:${targetDate.getMinutes().toString().padStart(2, '0')}`);
  }
  
  return targetDate;
}

function calculateQuality(text: string): number {
  let score = 0.5;
  if (text.length >= 100 && text.length <= 250) score += 0.2;
  if (/\b(study|research|evidence)\b/i.test(text)) score += 0.15;
  if (!/\b(amazing|incredible)\b/i.test(text)) score += 0.15;
  
  // Penalize "Did you know" pattern
  if (/^did you know/i.test(text)) score -= 0.3;
  
  return Math.min(1.0, Math.max(0, score));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Convert VI insights to comprehensive content intelligence string
 * 🔥 ENHANCED: Now extracts DEEP content patterns, not just formatting!
 */
function convertVIInsightsToString(viInsights: any): string {
  const rec = viInsights.recommended_format || {};
  
  let insights = `🎨 CONTENT INTELLIGENCE (From ${viInsights.based_on_count || 0} Successful Scraped Tweets):\n\n`;
  
  // ═══════════════════════════════════════════════════════════
  // 📊 CONTENT PATTERNS (What Makes Content Work)
  // ═══════════════════════════════════════════════════════════
  
  insights += `📊 CONTENT PATTERNS THAT WORK:\n\n`;
  
  // Hook effectiveness
  if (rec.hook_pattern || rec.optimal_hook) {
    const hookType = rec.optimal_hook || rec.hook_pattern;
    insights += `HOOK STRATEGY: ${hookType}\n`;
    insights += `  → Successful tweets use ${hookType} hooks to grab attention\n`;
    insights += `  → This pattern creates curiosity and stops scrolling\n`;
  }
  
  // Structure patterns
  if (rec.structure_patterns && Array.isArray(rec.structure_patterns) && rec.structure_patterns.length > 0) {
    insights += `\nCONTENT STRUCTURE: ${rec.structure_patterns[0].pattern || 'N/A'}\n`;
    if (rec.structure_patterns[0].description) {
      insights += `  → ${rec.structure_patterns[0].description}\n`;
    }
    insights += `  → This structure works because: ${rec.structure_patterns[0].avgER ? `high engagement (${(rec.structure_patterns[0].avgER * 100).toFixed(1)}% ER)` : 'proven pattern'}\n`;
  }
  
  // Angle effectiveness
  if (viInsights.angle) {
    insights += `\nANGLE APPROACH: ${viInsights.angle}\n`;
    insights += `  → Successful tweets use ${viInsights.angle} approach\n`;
    insights += `  → This angle resonates because it ${getAngleExplanation(viInsights.angle)}\n`;
  }
  
  // Tone effectiveness
  if (viInsights.tone) {
    insights += `\nTONE STYLE: ${viInsights.tone}\n`;
    insights += `  → ${viInsights.tone} tone connects with audience\n`;
    insights += `  → This tone works because: ${getToneExplanation(viInsights.tone)}\n`;
  }
  
  // Hook effectiveness score
  if (rec.hook_effectiveness !== undefined) {
    const hookScore = rec.hook_effectiveness;
    insights += `\nHOOK EFFECTIVENESS: ${hookScore}/100\n`;
    if (hookScore >= 80) {
      insights += `  → EXCELLENT hooks - creates strong curiosity gap\n`;
    } else if (hookScore >= 60) {
      insights += `  → GOOD hooks - stops scrolling effectively\n`;
    } else {
      insights += `  → MODERATE hooks - could be improved\n`;
    }
  }
  
  // Controversy level
  if (rec.controversy_level !== undefined) {
    const controversy = rec.controversy_level;
    insights += `\nCONTROVERSY LEVEL: ${controversy}/100\n`;
    if (controversy >= 70) {
      insights += `  → HIGH controversy - challenges mainstream beliefs\n`;
      insights += `  → This drives engagement through debate and discussion\n`;
    } else if (controversy >= 40) {
      insights += `  → MODERATE controversy - questions assumptions\n`;
      insights += `  → This creates interest without alienating audience\n`;
    } else {
      insights += `  → LOW controversy - safe, educational approach\n`;
      insights += `  → This builds trust and authority\n`;
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // 🎨 VISUAL FORMATTING (How It Looks)
  // ═══════════════════════════════════════════════════════════
  
  insights += `\n\n🎨 VISUAL FORMATTING:\n\n`;
  
  if (rec.char_count) {
    const median = rec.char_count.median || rec.char_count.optimal;
    const range = rec.char_count.range || [];
    insights += `CHARACTER COUNT: Optimal ${median} chars${range.length === 2 ? ` (range: ${range[0]}-${range[1]})` : ''}\n`;
    insights += `  → This length maximizes engagement - not too short, not too long\n`;
  }
  
  if (rec.line_breaks) {
    const median = rec.line_breaks.median || rec.line_breaks.optimal;
    const mode = rec.line_breaks.mode;
    insights += `LINE BREAKS: ${median} breaks${mode ? ` (mode: ${mode})` : ''}\n`;
    insights += `  → Strategic spacing improves readability and scanning\n`;
  }
  
  if (rec.emoji_count) {
    const median = rec.emoji_count.median || rec.emoji_count.optimal;
    const range = rec.emoji_count.range || [];
    insights += `EMOJI COUNT: ${median} emojis${range.length === 2 ? ` (range: ${range[0]}-${range[1]})` : ''}\n`;
    insights += `  → Minimal emojis maintain professional tone while adding visual interest\n`;
  }
  
  // ═══════════════════════════════════════════════════════════
  // 💡 CONTENT ELEMENTS (What Makes It Engaging)
  // ═══════════════════════════════════════════════════════════
  
  if (rec.style_elements && Array.isArray(rec.style_elements) && rec.style_elements.length > 0) {
    insights += `\n\n💡 ENGAGING ELEMENTS:\n\n`;
    rec.style_elements.slice(0, 3).forEach((element: any, i: number) => {
      insights += `${i + 1}. ${element.element || 'N/A'}\n`;
      if (element.examples && element.examples.length > 0) {
        insights += `   Example: "${(element.examples[0] || '').substring(0, 60)}..."\n`;
      }
      insights += `   → Works because: ${element.avgER ? `high engagement (${(element.avgER * 100).toFixed(1)}% ER)` : 'proven pattern'}\n`;
    });
  }
  
  // ═══════════════════════════════════════════════════════════
  // 📚 EXAMPLE TWEETS (Learn From Success)
  // ═══════════════════════════════════════════════════════════
  
  if (viInsights.examples && viInsights.examples.length > 0) {
    insights += `\n\n📚 EXAMPLE TWEETS (Learn From Success):\n\n`;
    viInsights.examples.slice(0, 3).forEach((ex: any, i: number) => {
      const preview = ex.content ? ex.content.substring(0, 150) : 'N/A';
      const context = ex.context || ex.tier || '';
      insights += `${i + 1}. "${preview}${preview.length >= 150 ? '...' : ''}"\n`;
      if (context) {
        insights += `   ${context}\n`;
      }
      insights += `   → Why it works: Strong hook, clear value, engaging structure\n\n`;
    });
  }
  
  // ═══════════════════════════════════════════════════════════
  // 🎯 KEY INSIGHTS
  // ═══════════════════════════════════════════════════════════
  
  insights += `\n💡 KEY INSIGHTS:\n`;
  insights += `- These patterns are from ${viInsights.based_on_count || 0} successful tweets\n`;
  insights += `- Apply these patterns intelligently - understand WHY they work\n`;
  insights += `- Don't copy blindly - adapt these insights to your content\n`;
  insights += `- Focus on CONTENT patterns (hooks, structure, angle) not just formatting\n`;
  insights += `- Use these insights to create engaging, valuable content\n`;
  
  return insights;
}

/**
 * Helper: Explain why an angle works
 */
function getAngleExplanation(angle: string): string {
  const explanations: Record<string, string> = {
    'provocative': 'challenges assumptions and creates curiosity',
    'research_based': 'builds credibility with evidence',
    'personal_story': 'creates relatability and connection',
    'controversial': 'drives debate and discussion',
    'practical': 'provides immediate value and actionability',
    'educational': 'teaches something new and valuable',
    'myth_busting': 'corrects misconceptions and surprises',
    'comparative': 'shows contrast and helps decision-making',
    'data_driven': 'uses numbers and statistics for credibility'
  };
  return explanations[angle] || 'resonates with the audience';
}

/**
 * Helper: Explain why a tone works
 */
function getToneExplanation(tone: string): string {
  const explanations: Record<string, string> = {
    'authoritative': 'builds trust and expertise',
    'conversational': 'feels approachable and relatable',
    'provocative': 'challenges thinking and drives engagement',
    'educational': 'teaches without being condescending',
    'inspirational': 'motivates and uplifts',
    'skeptical': 'questions assumptions and encourages critical thinking',
    'urgent': 'creates importance and action',
    'casual': 'feels friendly and accessible',
    'professional': 'maintains credibility and authority'
  };
  return explanations[tone] || 'connects with the audience';
}

/**
 * 🔥 ENHANCED: Enrich VI insights with deeper content patterns from database
 */
async function enrichVIInsightsWithContentPatterns(viInsights: any, topic: string, angle?: string, tone?: string): Promise<any> {
  try {
    const supabase = getSupabaseClient();
    
    // Query vi_content_classification for content patterns
    let query = supabase
      .from('vi_content_classification')
      .select('hook_effectiveness, controversy_level, structure, angle, tone, generator_match')
      .not('hook_effectiveness', 'is', null);
    
    // Filter by angle/tone if available
    if (angle) {
      query = query.eq('angle', angle);
    }
    if (tone) {
      query = query.eq('tone', tone);
    }
    
    const { data: classifications } = await query.limit(50);
    
    if (classifications && classifications.length > 0) {
      // Calculate averages
      const avgHookEffectiveness = classifications.reduce((sum: number, c: any) => sum + (c.hook_effectiveness || 0), 0) / classifications.length;
      const avgControversyLevel = classifications.reduce((sum: number, c: any) => sum + (c.controversy_level || 0), 0) / classifications.length;
      
      // Find most common structure
      const structureCounts = new Map<string, number>();
      classifications.forEach((c: any) => {
        if (c.structure) {
          structureCounts.set(c.structure, (structureCounts.get(c.structure) || 0) + 1);
        }
      });
      const mostCommonStructure = Array.from(structureCounts.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0];
      
      // Enhance viInsights with content patterns
      return {
        ...viInsights,
        angle: angle || classifications[0]?.angle,
        tone: tone || classifications[0]?.tone,
        recommended_format: {
          ...viInsights.recommended_format,
          hook_effectiveness: Math.round(avgHookEffectiveness),
          controversy_level: Math.round(avgControversyLevel),
          structure_patterns: mostCommonStructure ? [{
            pattern: mostCommonStructure,
            description: getStructureDescription(mostCommonStructure),
            avgER: 0.03 // Default, could be calculated from actual data
          }] : []
        }
      };
    }
  } catch (error: any) {
    console.warn('[VI_INSIGHTS] ⚠️ Could not enrich with content patterns:', error.message);
  }
  
  // Return original if enrichment fails
  return viInsights;
}

/**
 * Helper: Describe content structure
 */
function getStructureDescription(structure: string): string {
  const descriptions: Record<string, string> = {
    'question_hook': 'Opens with a question that creates curiosity',
    'stat_hook': 'Starts with a surprising statistic or number',
    'story': 'Uses narrative or personal story format',
    'myth_truth': 'Debunks a common misconception',
    'list': 'Presents information in list format',
    'comparison': 'Compares two or more options',
    'quote': 'Uses a quote or reference',
    'statement': 'Makes a bold or interesting statement',
    'thread': 'Multi-tweet thread format'
  };
  return descriptions[structure] || 'Effective content structure';
}

function categorizeError(error: any): string {
  const msg = error.message?.toLowerCase() || '';
  if (error?.code === 'LENGTH_VIOLATION' || msg.includes('length_violation')) return 'length_violation';
  if (error.status === 429 || msg.includes('rate_limit')) return 'rate_limit';
  if (msg.includes('quota')) return 'insufficient_quota';
  if (msg.includes('budget')) return 'budget_exceeded';
  return 'unknown';
}

function isRetryableGenerationError(type: string): boolean {
  return type === 'length_violation' || type === 'rate_limit' || type === 'unknown';
}

interface LengthContext {
  topic?: string;
  angle?: string;
  tone?: string;
  generator?: string;
  slot?: string;
}

async function ensureTweetWithinLimit(text: string, context: LengthContext): Promise<string | null> {
  try {
    const target = text.trim();
    if (target.length <= 280) {
      return target;
    }

    const { content, passed } = await validateAndImprove(target, { topic: context.topic, format: 'single' });
    if (!passed) {
      console.warn(`[PLAN_JOB] ⚠️ Auto-shorten failed quality validation for ${context.slot || 'single tweet'}`);
      return null;
    }

    const finalText = Array.isArray(content) ? String(content[0]) : String(content);
    if (finalText.length > 280) {
      console.warn(`[PLAN_JOB] ⚠️ Auto-shorten still too long (${finalText.length} chars) for ${context.slot || 'single tweet'}`);
      return null;
    }

    return finalText;
  } catch (error: any) {
    console.error(`[PLAN_JOB] ❌ Auto-shorten failed: ${error.message}`);
    return null;
  }
}

/**
 * ✅ NEW: Convert expert insights to generator advice string
 */
function convertExpertInsightsToAdvice(expertInsights: any, strategicRecommendations?: string[], contentStrategy?: string): string {
  if (!expertInsights) {
    return '';
  }

  let advice = `\n🎯 EXPERT SOCIAL MEDIA MANAGER ADVICE (From Analyzing ${expertInsights.based_on_count || 0} Successful Tweets):\n\n`;

  // Strategic Insights
  if (expertInsights.strategic_insights || contentStrategy) {
    advice += `📊 STRATEGIC INSIGHTS:\n`;
    advice += `${expertInsights.strategic_insights || contentStrategy || 'No strategic insights available'}\n\n`;
  }

  // Content Strategy
  if (expertInsights.content_strategy && expertInsights.content_strategy.length > 0) {
    advice += `💡 CONTENT STRATEGY:\n`;
    expertInsights.content_strategy.forEach((strategy: string, i: number) => {
      advice += `${i + 1}. ${strategy}\n`;
    });
    advice += `\n`;
  } else if (strategicRecommendations && strategicRecommendations.length > 0) {
    advice += `💡 CONTENT STRATEGY:\n`;
    strategicRecommendations.forEach((strategy: string, i: number) => {
      advice += `${i + 1}. ${strategy}\n`;
    });
    advice += `\n`;
  }

  // Hook Advice
  if (expertInsights.hook_advice) {
    advice += `🎣 HOOK ADVICE:\n`;
    advice += `${expertInsights.hook_advice}\n\n`;
  }

  // Messaging Tips
  if (expertInsights.messaging_tips && expertInsights.messaging_tips.length > 0) {
    advice += `✍️ MESSAGING TIPS:\n`;
    expertInsights.messaging_tips.forEach((tip: string, i: number) => {
      advice += `${i + 1}. ${tip}\n`;
    });
    advice += `\n`;
  }

  // Formatting Advice
  if (expertInsights.formatting_advice && expertInsights.formatting_advice.length > 0) {
    advice += `🎨 FORMATTING ADVICE:\n`;
    expertInsights.formatting_advice.forEach((adviceItem: string, i: number) => {
      advice += `${i + 1}. ${adviceItem}\n`;
    });
    advice += `\n`;
  }

  // ✅ NEW: Visual Data Patterns (from high-depth analysis)
  if (expertInsights.visual_data_patterns || expertInsights.pattern_correlations || expertInsights.specific_guidance) {
    advice += `📊 VISUAL DATA PATTERNS (From ${expertInsights.based_on_count || 0} Successful Tweets):\n\n`;
    
    // Emoji Placement
    if (expertInsights.visual_data_patterns?.emoji_placement?.hook_emoji) {
      const hookEmoji = expertInsights.visual_data_patterns.emoji_placement.hook_emoji;
      const successRate = expertInsights.pattern_correlations?.hook_emoji_at_0?.success_rate || 0;
      advice += `🎯 EMOJI PLACEMENT:\n`;
      advice += `- Hook emoji at position 0-10: ${hookEmoji.total_count || 0} out of ${expertInsights.based_on_count || 0} tweets\n`;
      if (successRate > 0) {
        advice += `- Success rate: ${(successRate * 100).toFixed(0)}%\n`;
      }
      advice += `\n`;
    }
    
    // Structural Ratio
    if (expertInsights.visual_data_patterns?.structural_ratios && expertInsights.visual_data_patterns.structural_ratios.length > 0) {
      const avgRatio = expertInsights.visual_data_patterns.structural_ratios[0];
      const successRate = expertInsights.pattern_correlations?.structural_ratio_0_7_0_9?.success_rate || 0;
      advice += `📊 STRUCTURAL RATIO:\n`;
      advice += `- Optimal range: 0.7-0.9 (${Math.round(avgRatio * 100)}% structural, ${Math.round((1 - avgRatio) * 100)}% decorative)\n`;
      if (successRate > 0) {
        advice += `- Success rate: ${(successRate * 100).toFixed(0)}%\n`;
      }
      advice += `\n`;
    }
    
    // Visual Complexity
    if (expertInsights.visual_data_patterns?.visual_complexity && expertInsights.visual_data_patterns.visual_complexity.length > 0) {
      const avgComplexity = expertInsights.visual_data_patterns.visual_complexity[0];
      const successRate = expertInsights.pattern_correlations?.visual_complexity_60_70?.success_rate || 0;
      advice += `🎨 VISUAL COMPLEXITY:\n`;
      advice += `- Optimal range: 60-70 (average: ${Math.round(avgComplexity)})\n`;
      if (successRate > 0) {
        advice += `- Success rate: ${(successRate * 100).toFixed(0)}%\n`;
      }
      advice += `\n`;
    }
    
    // Specific Guidance
    if (expertInsights.specific_guidance) {
      advice += `🎯 SPECIFIC GUIDANCE:\n`;
      if (expertInsights.specific_guidance.emoji_placement) {
        advice += `- ${expertInsights.specific_guidance.emoji_placement}\n`;
      }
      if (expertInsights.specific_guidance.structural_ratio) {
        advice += `- ${expertInsights.specific_guidance.structural_ratio}\n`;
      }
      if (expertInsights.specific_guidance.visual_complexity) {
        advice += `- ${expertInsights.specific_guidance.visual_complexity}\n`;
      }
      advice += `\n`;
    }
  }

  // Timing Recommendations
  if (expertInsights.timing_recommendations && expertInsights.timing_recommendations.length > 0) {
    advice += `⏰ TIMING RECOMMENDATIONS:\n`;
    expertInsights.timing_recommendations.forEach((rec: string, i: number) => {
      advice += `${i + 1}. ${rec}\n`;
    });
    advice += `\n`;
  }

  // Audience Targeting
  if (expertInsights.audience_targeting && expertInsights.audience_targeting.length > 0) {
    advice += `🎯 AUDIENCE TARGETING:\n`;
    expertInsights.audience_targeting.forEach((target: string, i: number) => {
      advice += `${i + 1}. ${target}\n`;
    });
    advice += `\n`;
  }

  advice += `💡 USE THIS ADVICE: This is expert-level strategic guidance from analyzing successful tweets. Apply these insights intelligently to create engaging, valuable content.\n`;

  return advice;
}

/**
 * 🚀 NEW: Convert reply insights to content guidance
 * Successful reply patterns should inform post content too
 */
function convertReplyInsightsToGuidance(replyInsights: {
  bestGenerators: string[];
  bestTopics: string[];
  bestHours: number[];
  avgEngagement: number;
  topPerformingReplies: Array<{
    content: string;
    views: number;
    likes: number;
    follows: number;
  }>;
  recommendations: string[];
}): string {
  let guidance = `\n🚀 REPLY PERFORMANCE INSIGHTS (From Your Most Successful Replies):\n\n`;
  
  // What's working in replies
  guidance += `📊 WHAT'S WORKING:\n`;
  guidance += `- Best performing generators: ${replyInsights.bestGenerators.slice(0, 3).join(', ')}\n`;
  guidance += `- Topics that resonate: ${replyInsights.bestTopics.slice(0, 3).join(', ')}\n`;
  guidance += `- Average engagement rate: ${(replyInsights.avgEngagement * 100).toFixed(2)}%\n\n`;
  
  // Top performing examples
  if (replyInsights.topPerformingReplies.length > 0) {
    guidance += `🔥 TOP PERFORMING REPLY EXAMPLES:\n`;
    replyInsights.topPerformingReplies.slice(0, 3).forEach((reply, i) => {
      guidance += `\n${i + 1}. "${reply.content.substring(0, 150)}${reply.content.length > 150 ? '...' : ''}"\n`;
      guidance += `   Views: ${reply.views.toLocaleString()} | Likes: ${reply.likes} | Follows: ${reply.follows}\n`;
    });
    guidance += `\n`;
  }
  
  // Key takeaway
  guidance += `💡 KEY INSIGHT: Your replies are getting 10-100x more views than posts. `;
  guidance += `Apply the same patterns that work in replies (concise, specific, valuable) to your posts.\n`;
  guidance += `\n📝 APPLY THESE PATTERNS:\n`;
  guidance += `- Be specific and data-driven like your top replies\n`;
  guidance += `- Match the topics that get engagement\n`;
  guidance += `- Use the same conversational tone that works in replies\n`;
  
  return guidance;
}