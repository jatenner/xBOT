/**
 * 📝 PLAN JOB - Autonomous Content Planning
 * Generates content using LLM and queues for posting
 */

import { v4 as uuidv4 } from 'uuid';
import { getConfig } from '../config/config';
import { getEnvConfig, isLLMAllowed } from '../config/envFlags';
import { getSupabaseClient } from '../db/index';
import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';

// Global metrics
let llmMetrics = {
  calls_total: 0,
  calls_failed: 0,
  failure_reasons: {} as Record<string, number>
};

export function getLLMMetrics() {
  return { ...llmMetrics };
}

export async function planContent(): Promise<void> {
  const config = getConfig();
  console.log('[PLAN_JOB] 📝 Starting content planning cycle...');
  
  try {
    if (config.MODE === 'shadow') {
      await generateSyntheticContent();
    } else {
      await generateRealContent();
    }
    console.log('[PLAN_JOB] ✅ Content planning completed');
  } catch (error: any) {
    console.error('[PLAN_JOB] ❌ Planning failed:', error.message);
    throw error;
  }
}

async function generateSyntheticContent(): Promise<void> {
  console.log('[PLAN_JOB] 🎭 Generating synthetic content for shadow mode...');
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
  
  console.log(`[PLAN_JOB] 🎭 Synthetic content queued decision_id=${decision_id}`);
}

async function generateRealContent(): Promise<void> {
  const llmCheck = isLLMAllowed();
  if (!llmCheck.allowed) {
    console.log(`[PLAN_JOB] ⏭️ LLM blocked: ${llmCheck.reason}`);
    return;
  }
  
  console.log('[PLAN_JOB] 🧠 Generating real content using LLM...');
    
    for (let i = 0; i < 3; i++) {
      try {
      const content = await generateContentWithLLM();
      const gateResult = await runGateChain(content.text, content.decision_id);
        
        if (!gateResult.passed) {
        console.log(`[GATE_CHAIN] ⛔ Blocked (${gateResult.gate}) decision_id=${content.decision_id}, reason=${gateResult.reason}`);
          continue;
        }
        
      // Queue for posting
      await queueContent(content);
      console.log(`[PLAN_JOB] ✅ Real LLM content queued decision_id=${content.decision_id} scheduled_at=${content.scheduled_at}`);
      
    } catch (error: any) {
      llmMetrics.calls_failed++;
      const errorType = categorizeError(error);
      llmMetrics.failure_reasons[errorType] = (llmMetrics.failure_reasons[errorType] || 0) + 1;
      
      console.error(`[PLAN_JOB] ❌ LLM generation failed: ${error.message}`);
      
      // In live mode: do NOT queue synthetic
      if (errorType === 'insufficient_quota') {
        console.log('[PLAN_JOB] OpenAI insufficient_quota → not queueing');
      }
    }
  }
}

async function generateContentWithLLM() {
  const flags = getConfig();
  const decision_id = uuidv4();
  
  // 1. Analyze what content performs best
  const performanceData = await analyzeTopicPerformance();
  
  // 2. Get current date/context for freshness
  const currentDate = new Date();
  const dayOfWeek = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
  const month = currentDate.toLocaleDateString('en-US', { month: 'long' });
  
  // 3. Select varied writing style with rotation to prevent repetition
  const styles = [
    'research_insight', 'practical_tip', 'myth_buster', 'data_point',
    'story_based', 'question_hook', 'comparison', 'contrarian',
    'personal_experience', 'shocking_stat', 'timeline_based', 'before_after',
    'expert_quote', 'trend_analysis', 'common_mistake', 'life_hack',
    'scientific_breakdown', 'real_world_example', 'challenge_assumption', 'future_prediction'
  ];
  
  // Rotate style based on minute to ensure variety within the hour
  const minuteOfHour = new Date().getMinutes();
  const styleIndex = minuteOfHour % styles.length;
  const selectedStyle = styles[styleIndex];
  
  console.log(`[STYLE_ROTATION] Minute ${minuteOfHour} -> Style: ${selectedStyle}`);
  
  // 4. Build AI-driven prompt with performance context
  const prompt = buildDynamicPrompt(performanceData, selectedStyle, dayOfWeek, month);

  llmMetrics.calls_total++;
  
  console.log(`[OPENAI] using budgeted client purpose=content_generation model=${flags.OPENAI_MODEL} style=${selectedStyle}`);
  console.log(`[CONTENT_STRATEGY] Top topics: ${performanceData.topTopics.join(', ')} | Avoiding: ${performanceData.lowTopics.join(', ')}`);
  
  const response = await createBudgetedChatCompletion({
    model: flags.OPENAI_MODEL,
    messages: [
      { role: 'system', content: buildSystemPrompt(performanceData) },
      { role: 'user', content: prompt }
    ],
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.9'),
    top_p: parseFloat(process.env.OPENAI_TOP_P || '0.95'),
    max_tokens: 350,
    response_format: { type: 'json_object' }
  }, {
    purpose: 'content_generation',
    requestId: decision_id
  });

  const rawContent = response.choices[0]?.message?.content;
  if (!rawContent) throw new Error('Empty response from OpenAI');

  let contentData;
  try {
    contentData = JSON.parse(rawContent);
  } catch (e) {
    console.error('[PLAN_JOB] ❌ Failed to parse LLM response:', rawContent);
    throw new Error('Invalid JSON from LLM');
  }

  // Validate and clean the response - handle both single tweets and threads
  const tweetText = contentData.text || contentData.tweet || contentData.content;
  if (!tweetText) {
    console.error('[PLAN_JOB] ❌ LLM response missing text field:', contentData);
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
    contentData.text = contentData.text.map((tweet: string, i: number) => {
      if (tweet.length > 280) {
        console.warn(`[PLAN_JOB] ⚠️ Thread tweet ${i+1} too long (${tweet.length} chars), truncating...`);
        return tweet.substring(0, 277) + '...';
      }
      return tweet;
    });
    
    console.log(`[PLAN_JOB] 🧵 Generated ${contentData.text.length}-tweet thread`);
  } else {
    // Handle single tweet
    if (tweetText.length > 280) {
      console.warn(`[PLAN_JOB] ⚠️ Tweet too long (${tweetText.length} chars), truncating...`);
      contentData.text = tweetText.substring(0, 277) + '...';
    } else {
      contentData.text = tweetText;
    }
    console.log(`[PLAN_JOB] 📝 Generated single tweet (${contentData.text.length} chars)`);
  }

  // Select timing with same-day preference
  const scheduledAt = await selectOptimalSchedule();

  return {
    decision_id,
    text: contentData.text,
    topic: contentData.topic || 'health',
    angle: contentData.angle,
    style: selectedStyle,
    format: format,
    quality_score: calculateQuality(Array.isArray(contentData.text) ? contentData.text.join(' ') : contentData.text),
    predicted_er: 0.03,
    timing_slot: scheduledAt.getHours(),
    scheduled_at: scheduledAt.toISOString()
  };
}

async function queueContent(content: any): Promise<void> {
  const supabase = getSupabaseClient();
  
  // Handle content storage for both single tweets and threads
  const contentText = Array.isArray(content.text) 
    ? content.text.join('\n\n--- THREAD BREAK ---\n\n') // Store threads with separators
    : content.text;
  
  const { data, error } = await supabase.from('content_metadata').insert([{
    id: content.decision_id,
    content_id: content.decision_id,
    content: contentText,
    generation_source: 'real',
    status: 'queued',
    decision_type: content.format || 'single', // Store format type
    scheduled_at: content.scheduled_at,
    quality_score: Math.round(content.quality_score * 100),
    predicted_er: content.predicted_er,
    topic: content.topic || 'health',
    bandit_arm: content.style || 'varied', // Store the style as bandit_arm
    timing_arm: `slot_${content.timing_slot}`
    // Note: angle field removed - not in schema
  }]);
  
  if (error) {
    console.error(`[PLAN_JOB] ❌ Failed to queue content:`, error);
    throw new Error(`Database insert failed: ${error.message}`);
  }
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
      // Exploration: try topics that haven't been tested much
      const allHealthTopics = [
        'exercise', 'nutrition', 'mental_health', 'sleep', 'hydration', 
        'stress_management', 'supplements', 'heart_health', 'brain_health',
        'immune_system', 'gut_health', 'metabolism', 'longevity', 'recovery',
        'weight_loss', 'muscle_building', 'flexibility', 'energy_optimization',
        'hormone_health', 'skin_health', 'eye_health', 'bone_health'
      ];
      
      // Find topics not in recent performance data
      const unexploredTopics = allHealthTopics.filter(topic => !topTopics.includes(topic));
      const randomUnexplored = unexploredTopics[Math.floor(Math.random() * unexploredTopics.length)];
      
      intelligentTopics = [randomUnexplored, ...topTopics.slice(0, 2)];
      console.log(`[AI_EXPLORATION] Exploring new topic: ${randomUnexplored}`);
    } else {
      // Exploitation: focus on proven performers with some variety
      intelligentTopics = [...topTopics];
      console.log(`[AI_EXPLOITATION] Using proven performers: ${intelligentTopics.join(', ')}`);
    }
  } else {
    // No performance data yet - start with diverse foundation topics
    intelligentTopics = [
      'nutrition', 'exercise', 'mental_health', 'sleep', 'stress_management'
    ];
    console.log(`[AI_BOOTSTRAP] Starting with foundation topics: ${intelligentTopics.join(', ')}`);
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

async function checkUniqueness(text: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  
  // Get recent posts from last 7 days
  const { data: recentPosts } = await supabase
    .from('content_metadata')
    .select('content')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .limit(100);

  if (!recentPosts || recentPosts.length === 0) return true;

  // Simple word overlap check (TODO: add embedding-based similarity)
  const newWords = new Set(text.toLowerCase().split(/\s+/));
  
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
  
  // Check for cold start (queue is empty)
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
  
  // Use UCB timing to find optimal slot
  const { getUCBTimingBandit } = await import('../schedule/ucbTiming');
  const ucbTiming = getUCBTimingBandit();
  const timingSelection = await ucbTiming.selectTimingWithUCB();
  
  const now = new Date();
  const currentHour = now.getHours();
  
  // Calculate target time for the selected slot
  let targetDate = new Date(now);
  targetDate.setHours(timingSelection.slot, 0, 0, 0);
  
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
        foundSameDaySlot = true;
        console.log(`[SCHEDULE] 📅 Using same-day slot: ${hour}:00`);
        break;
      }
    }
    
    if (!foundSameDaySlot) {
      // No same-day slots available, use tomorrow at selected slot
      targetDate.setDate(targetDate.getDate() + 1);
      console.log(`[SCHEDULE] 📅 No same-day slots, using tomorrow at ${timingSelection.slot}:00`);
    }
  } else {
    console.log(`[SCHEDULE] 📅 Using selected slot today at ${timingSelection.slot}:00`);
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

function categorizeError(error: any): string {
  const msg = error.message?.toLowerCase() || '';
  if (error.status === 429 || msg.includes('rate_limit')) return 'rate_limit';
  if (msg.includes('quota')) return 'insufficient_quota';
  if (msg.includes('budget')) return 'budget_exceeded';
  return 'unknown';
}