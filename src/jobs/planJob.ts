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
  
  // 3. Select varied writing style (not just "Did you know")
  const styles = [
    'research_insight',
    'practical_tip',
    'myth_buster',
    'data_point',
    'story_based',
    'question_hook',
    'comparison',
    'contrarian'
  ];
  const selectedStyle = styles[Math.floor(Math.random() * styles.length)];
  
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

  // Validate and clean the response
  const tweetText = contentData.text || contentData.tweet || contentData.content;
  if (!tweetText) {
    console.error('[PLAN_JOB] ❌ LLM response missing text field:', contentData);
    throw new Error('Invalid content: missing text field');
  }
  
  if (tweetText.length > 280) {
    console.warn(`[PLAN_JOB] ⚠️ Tweet too long (${tweetText.length} chars), truncating...`);
    contentData.text = tweetText.substring(0, 277) + '...';
  } else {
    contentData.text = tweetText;
  }

  // Select timing
  const { getUCBTimingBandit } = await import('../schedule/ucbTiming');
  const ucbTiming = getUCBTimingBandit();
  const timingSelection = await ucbTiming.selectTimingWithUCB();
  const scheduledAt = new Date(Date.now() + timingSelection.slot * 60 * 60 * 1000);

  return {
    decision_id,
    text: contentData.text,
    topic: contentData.topic || 'health',
    angle: contentData.angle,
    style: selectedStyle,
    quality_score: calculateQuality(contentData.text),
    predicted_er: 0.03,
    timing_slot: timingSelection.slot,
    scheduled_at: scheduledAt.toISOString()
  };
}

async function queueContent(content: any): Promise<void> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase.from('content_metadata').insert([{
    id: content.decision_id,
    content_id: content.decision_id,
    content: content.text,
    generation_source: 'real',
    status: 'queued',
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

  return {
    topTopics: topTopics.length > 0 ? topTopics : ['exercise', 'nutrition', 'mental_health'],
    lowTopics,
    avgEngagement: sortedTopics[0]?.avgEngagement || 0.03,
    sampleSize: recentOutcomes?.length || 0
  };
}

function buildSystemPrompt(performanceData: any): string {
  return `You are an AI health content strategist with deep expertise in evidence-based medicine, behavioral psychology, and viral social media growth.

PERFORMANCE DATA (Learn from this):
- Your best-performing topics: ${performanceData.topTopics.join(', ')}
- Topics to deprioritize: ${performanceData.lowTopics.length > 0 ? performanceData.lowTopics.join(', ') : 'none yet'}
- Current avg engagement: ${performanceData.avgEngagement.toFixed(2)}
- Sample size: ${performanceData.sampleSize} posts

YOUR MISSION:
Create content that drives follower growth by being:
1. Genuinely valuable (people should save/share it)
2. Counterintuitive or surprising (breaks common assumptions)
3. Actionable (clear next steps)
4. Evidence-based (cites research when relevant)

DIVERSITY REQUIREMENTS:
- Vary your opening hooks constantly
- Mix data, stories, myths, tips, questions
- Avoid formulaic patterns like "Did you know"
- Be conversational, not academic
- Use strategic emojis sparingly (1-2 max)

GROWTH FOCUS:
- Content that makes people go "wow, I need to follow this account"
- Share non-obvious insights most health accounts miss
- Bridge science to practical everyday life`;
}

function buildDynamicPrompt(performanceData: any, style: string, dayOfWeek: string, month: string): string {
  const styleGuides: Record<string, string> = {
    research_insight: `Find a recent or surprising research finding about ${performanceData.topTopics[0] || 'health'}. Make it feel cutting-edge and non-obvious. Focus on WHY it matters practically.`,
    
    practical_tip: `Share an actionable ${performanceData.topTopics[0] || 'health'} tip that most people don't know but can implement today. Be specific about timing, dosage, or method.`,
    
    myth_buster: `Debunk a common health myth related to ${performanceData.topTopics[0] || 'nutrition'}. Start with what people believe, then flip it with evidence. Make it memorable.`,
    
    data_point: `Share a shocking statistic or data point about ${performanceData.topTopics[0] || 'wellness'} that challenges assumptions. Connect it to a practical takeaway.`,
    
    story_based: `Tell a compelling mini-story or case study about ${performanceData.topTopics[0] || 'health transformation'}. Make it relatable and inspiring without being preachy.`,
    
    question_hook: `Start with a provocative question about ${performanceData.topTopics[0] || 'health'}, then answer it in a surprising way. Make people reconsider what they thought they knew.`,
    
    comparison: `Compare two ${performanceData.topTopics[0] || 'health'} approaches/foods/habits showing why one is vastly superior. Use concrete numbers or examples.`,
    
    contrarian: `Take a contrarian stance on ${performanceData.topTopics[0] || 'wellness'}. Challenge conventional wisdom with evidence. Be bold but not reckless.`
  };

  return `${styleGuides[style] || styleGuides.practical_tip}

Context: It's ${dayOfWeek}, ${month} 2024. Consider seasonality if relevant.

${performanceData.sampleSize > 10 ? `Data shows our audience engages most with ${performanceData.topTopics[0]} content, so prioritize that.` : ''}

Format as JSON:
{
  "text": "Your 280-char tweet (varied style, NO 'Did you know' pattern)",
  "topic": "${performanceData.topTopics[0] || 'health'}",
  "angle": "specific hook/perspective used"
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