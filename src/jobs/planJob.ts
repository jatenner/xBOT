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
    if (config.MODE === 'shadow') {
      await generateSyntheticContent();
    } else {
      await generateRealContent();
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
  await supabase.from('content_metadata').insert([{
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
    log({ op: 'generate_real', blocked: true, reason: llmCheck.reason });
    return;
  }
  
  // ═══════════════════════════════════════════════════════════
  // 🎯 BATCH GENERATION: Always generate EXACTLY 2 posts
  // ═══════════════════════════════════════════════════════════
  // CRITICAL: Regardless of interval, generate 2 posts to ensure rate limit
  // If job runs every 2 hours → 2 posts / 2 hours = 1 post/hour
  // If job runs every hour → 2 posts / hour = 2 posts/hour ✅
  const numToGenerate = 2; // FIXED: Always 2 posts per run
  
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
          if (attempt < MAX_GENERATION_RETRIES) {
            console.log(`[GATE_CHAIN] 🔁 Retrying post ${slot + 1} after gate failure`);
            await sleep(GENERATION_RETRY_BACKOFF_MS * attempt);
            continue;
          }
          console.log(`[GATE_CHAIN] ⛔ Exhausted retries for post ${slot + 1} due to gate failure`);
          break;
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
  
  console.log(`\n📅 SMART SCHEDULING (EXACTLY 2 posts/hour):`);
  
  const now = Date.now();
  for (let i = 0; i < generatedPosts.length; i++) {
    const post = generatedPosts[i];
    
    // ⚡ STRICT SCHEDULE: EXACTLY 30 minutes apart, no variation
    // Post 1: +0min, Post 2: +30min, Post 3: +60min, Post 4: +90min
    const baseDelay = i * 30; // Exactly 30-minute intervals
    
    const scheduledAt = new Date(now + baseDelay * 60000);
    post.scheduled_at = scheduledAt.toISOString();
    
    const minutesUntil = baseDelay;
    
    console.log(`   Post ${i + 1}: ${scheduledAt.toLocaleTimeString()} (EXACTLY +${minutesUntil}min)`);
    
    // 🎨 CRITICAL FIX: Apply visual formatting BEFORE queueing
    await formatAndQueueContent(post);
  }
  
  console.log(`\n💡 Generated ${generatedPosts.length} posts spaced 30min apart = ${generatedPosts.length} posts/hour`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

/**
 * 🎭 SYSTEM B: Call dedicated generator with specialized prompt
 */
async function callDedicatedGenerator(generatorName: string, context: any) {
  const { topic, angle, tone, formatStrategy, dynamicTopic, growthIntelligence } = context;
  
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
  
  const config = generatorMap[generatorName];
  if (!config) {
    console.error(`[SYSTEM_B] ❌ Generator not mapped: ${generatorName}`);
    throw new Error(`Unknown generator: ${generatorName}`);
  }
  
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
    
    // ✅ THREADS ENABLED: 14% thread rate = 2 threads per day out of 14 posts
    const selectedFormat = Math.random() < 0.14 ? 'thread' : 'single';
    console.log(`[SYSTEM_B] 📊 Format selected: ${selectedFormat} (target: 14% threads = ~2/day)`);
    
    const result = await generateFn({
      topic,
      angle, // ✅ Pass AI-generated angle
      tone, // ✅ Pass AI-generated tone
      formatStrategy, // ✅ Pass AI-generated format strategy
      format: selectedFormat, // ✅ FIXED: Dynamic format selection enables threads
      intelligence: growthIntelligence // ✅ NEW: Pass growth intelligence to generators!
    });
    
    // Transform generator response to expected format
    // Note: Character validation handled by generatorUtils.ts (single source of truth)
    return {
      text: result.content,
      format: result.format,
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
  
  // STEP 1: Generate TOPIC (avoiding last 10)
  const topicGenerator = getDynamicTopicGenerator();
  const dynamicTopic = await topicGenerator.generateTopic();
  const topic = dynamicTopic.topic; // Extract just the topic string
  
  console.log(`\n🎯 TOPIC: "${topic}"`);
  console.log(`   Cluster sampled: ${dynamicTopic.cluster_sampled || 'unknown'}`);
  console.log(`   Dimension: ${dynamicTopic.dimension}`);
  console.log(`   Viral potential: ${dynamicTopic.viral_potential}`);
  
  // STEP 2: Generate ANGLE (avoiding last 10)
  const angleGenerator = getAngleGenerator();
  const angle = await angleGenerator.generateAngle(topic);
  
  console.log(`\n📐 ANGLE: "${angle}"`);
  
  // STEP 3: Generate TONE (avoiding last 10)
  const toneGenerator = getToneGenerator();
  const tone = await toneGenerator.generateTone();
  
  console.log(`\n🎤 TONE: "${tone}"`);
  
  // STEP 4: Match GENERATOR (pure random - 11 generators, 9% each)
  const generatorMatcher = getGeneratorMatcher();
  const matchedGenerator = generatorMatcher.matchGenerator(angle, tone);
  
  console.log(`\n🎭 GENERATOR: ${matchedGenerator}`);
  
  // ═══════════════════════════════════════════════════════════
  // ✨ STEP 5: Generate FORMAT STRATEGY (avoiding last 4)
  // ═══════════════════════════════════════════════════════════
  const formatStrategyGen = getFormatStrategyGenerator();
  const formatStrategy = await formatStrategyGen.generateStrategy(topic, angle, tone, matchedGenerator);
  
  console.log(`\n🎨 FORMAT: "${formatStrategy}"`);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // LEGACY: Keep old diversity tracking for compatibility
  contentDiversityEngine.trackTopic(topic);
  
  // ═══════════════════════════════════════════════════════════
  // 🧠 STEP 5.5: BUILD GROWTH INTELLIGENCE - ACTIVATED!
  // ═══════════════════════════════════════════════════════════
  
  let growthIntelligence;
  try {
    console.log('[GROWTH_INTEL] 🚀 Activating learning loops...');
    
    const { buildGrowthIntelligencePackage } = await import('../learning/growthIntelligence');
    growthIntelligence = await buildGrowthIntelligencePackage(matchedGenerator);
    console.log('[GROWTH_INTEL] ✅ Growth intelligence generated for ' + matchedGenerator);
  } catch (error: any) {
    console.warn('[GROWTH_INTEL] ⚠️ Intelligence unavailable:', error.message);
    growthIntelligence = undefined;
  }
  
  // STEP 6: Call dedicated generator (SYSTEM B - Specialized prompts!)
  console.log(`[CONTENT_GEN] 🎭 Calling dedicated ${matchedGenerator} generator...`);
  
  llmMetrics.calls_total++;
  
  const generatedContent = await callDedicatedGenerator(matchedGenerator, {
    topic,
    angle,
    tone,
    formatStrategy,
    dynamicTopic,
    growthIntelligence // ✅ Now passed to generator!
  });
  
  if (!generatedContent) {
    llmMetrics.errors++;
    throw new Error('Empty response from dedicated generator');
  }
  
  llmMetrics.success++;
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
  
  const isThread = Array.isArray(tweetText);
  const format = contentData.format || (isThread ? 'thread' : 'single');
  
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
    (contentData.text as string[]).forEach((tweet: string, i: number) => {
      if (tweet.length > 280) {
        console.warn(`[PLAN_JOB] ❌ LENGTH_VIOLATION: Thread tweet ${i + 1} has ${tweet.length} chars (limit 280)`);
        const error: any = new Error(`LENGTH_VIOLATION: thread tweet ${i + 1} has ${tweet.length} chars (limit 280)`);
        error.code = 'LENGTH_VIOLATION';
        error.meta = { format: 'thread', tweetIndex: i, length: tweet.length };
        throw error;
      }
      threadTweets.push(tweet);
    });
    contentData.text = threadTweets;
    
    console.log(`[PLAN_JOB] 🧵 ✨ THREAD GENERATED: ${contentData.text.length} tweets`);
    console.log(`[PLAN_JOB] 🧵 Thread preview:`);
    contentData.text.forEach((tweet: string, i: number) => {
      console.log(`[PLAN_JOB] 🧵   Tweet ${i+1}/${contentData.text.length}: "${tweet.substring(0, 80)}..." (${tweet.length} chars)`);
    });
  } else {
    // Handle single tweet
    if (tweetText.length > 280) {
      console.warn(`[PLAN_JOB] ❌ LENGTH_VIOLATION: Single tweet has ${tweetText.length} chars (limit 280)`);
      const error: any = new Error(`LENGTH_VIOLATION: single tweet has ${tweetText.length} chars (limit 280)`);
      error.code = 'LENGTH_VIOLATION';
      error.meta = { format: 'single', length: tweetText.length };
      throw error;
    }
    contentData.text = tweetText;
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
    quality_score: calculateQuality(Array.isArray(contentData.text) ? contentData.text.join(' ') : contentData.text),
    predicted_er: 0.03,
    timing_slot: scheduledAt.getHours(),
    scheduled_at: scheduledAt.toISOString(),
    
    // 🧠 META-AWARENESS: Pass through AI's cluster choices for database storage
    topic_cluster_sampled: dynamicTopic.cluster_sampled || null,
    angle_type: contentData.angle_type || null,
    tone_is_singular: contentData.tone_is_singular !== false,
    tone_cluster: contentData.tone_cluster || null,
    structural_type: contentData.structural_type || null
  };
}

/**
 * 🎨 NEW FUNCTION: Format content with visual formatter BEFORE queueing
 * This ensures database stores FINAL product, not intermediate content
 */
async function formatAndQueueContent(content: any): Promise<void> {
  console.log(`[PLAN_JOB] 🎨 Applying visual formatting to content...`);
  
  const { formatContentForTwitter } = await import('../posting/aiVisualFormatter');
  
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
      
      formattedTweets.push(formatResult.formatted);
      
      if (i === 0) {
        visualApproach = formatResult.visualApproach;
      }
    }
    
    // Update content with formatted tweets
    content.text = formattedTweets;
    content.visual_format = visualApproach || 'thread_formatted';
    
    console.log(`[PLAN_JOB] ✅ Thread formatted (${formattedTweets.length} tweets)`);
    
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
  
  // 🔧 Build insert payload with optional meta-awareness fields
  // (Supabase schema cache may not have refreshed yet)
  const insertPayload: any = {
    decision_id: content.decision_id,
    content: contentText,
    generation_source: 'real',
    status: 'queued',
    decision_type: content.format === 'thread' ? 'thread' : 'single',
    scheduled_at: content.scheduled_at,
    quality_score: content.quality_score,
    predicted_er: content.predicted_er,
    
    // Core diversity fields (always present)
    raw_topic: content.raw_topic,
    angle: content.angle,
    tone: content.tone,
    generator_name: content.generator_used,
    format_strategy: content.format_strategy,
    visual_format: content.visual_format || null,
    
    // Legacy fields for compatibility
    bandit_arm: content.style || 'varied',
    timing_arm: `slot_${content.timing_slot}`,
    thread_parts: Array.isArray(content.text) ? content.text : null
  };
  
  // 🧵 THREAD TRACKING: Log when threads are queued
  if (insertPayload.decision_type === 'thread') {
    console.log(`[QUEUE_CONTENT] 🧵 THREAD QUEUED: ${insertPayload.id}`);
    console.log(`[QUEUE_CONTENT] 🧵   Scheduled: ${insertPayload.scheduled_at}`);
    console.log(`[QUEUE_CONTENT] 🧵   Parts: ${insertPayload.thread_parts?.length} tweets`);
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
  
  const { data, error} = await supabase.from('content_metadata').insert([insertPayload]);
  
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
    
    story_based: `Tell a compelling mini-story or case study about ${selectedTopic}. Make it relatable and inspiring without being preachy.`,
    
    question_hook: `Start with a provocative question about ${selectedTopic}, then answer it in a surprising way. Make people reconsider what they thought they knew.`,
    
    comparison: `Compare two ${selectedTopic} approaches/methods showing why one is vastly superior. Use concrete numbers or examples.`,
    
    contrarian: `Take a contrarian stance on ${selectedTopic}. Challenge conventional wisdom with evidence. Be bold but not reckless.`,
    
    personal_experience: `Share a relatable personal scenario about ${selectedTopic}. Use "Imagine you're..." or "Picture this..." to draw readers in.`,
    
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
  
  // Get recent posts from last 7 days
  const { data: recentPosts } = await supabase
    .from('content_metadata')
    .select('content')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .limit(100);

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
  
  // 🚀 AGGRESSIVE GROWTH MODE: Always schedule for immediate posting
  // Instead of waiting for optimal timing, we post every 30 minutes for 2 posts/hour
  const AGGRESSIVE_GROWTH_MODE = process.env.MODE === 'live';
  
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