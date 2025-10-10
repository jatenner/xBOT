/**
 * 💬 REPLY JOB - Autonomous Reply Generation
 * Generates replies using LLM and queues for posting
 */

import { v4 as uuidv4 } from 'uuid';
import { getConfig } from '../config/config';
import { getEnvConfig, isLLMAllowed } from '../config/envFlags';
import { getSupabaseClient } from '../db/index';
import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';

// Global metrics
let replyLLMMetrics = {
  calls_total: 0,
  calls_failed: 0,
  failure_reasons: {} as Record<string, number>
};

export function getReplyLLMMetrics() {
  return { ...replyLLMMetrics };
}

// 🚀 AGGRESSIVE GROWTH: Reply frequency control (3 replies per hour)
async function checkReplyHourlyQuota(): Promise<{
  canReply: boolean;
  repliesThisHour: number;
  minutesUntilNext?: number;
}> {
  const supabase = getSupabaseClient();
  const now = new Date();
  const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
  
  try {
    // Count replies posted in the current hour
    const { count, error } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', 'reply')
      .gte('created_at', hourStart.toISOString())
      .lt('created_at', new Date(hourStart.getTime() + 60 * 60 * 1000).toISOString());
    
    if (error) {
      console.error('[REPLY_QUOTA] ❌ Database error:', error);
      return { canReply: true, repliesThisHour: 0 }; // Allow on error
    }
    
    const repliesThisHour = count || 0;
    const canReply = repliesThisHour < 3; // 3 replies per hour limit
    
    let minutesUntilNext;
    if (!canReply) {
      const nextHour = new Date(hourStart.getTime() + 60 * 60 * 1000);
      minutesUntilNext = (nextHour.getTime() - now.getTime()) / (1000 * 60);
    }
    
    return { canReply, repliesThisHour, minutesUntilNext };
    
  } catch (error) {
    console.error('[REPLY_QUOTA] ❌ Quota check failed:', error);
    return { canReply: true, repliesThisHour: 0 }; // Allow on error
  }
}

export async function generateReplies(): Promise<void> {
  const config = getConfig();
  console.log('[REPLY_JOB] 💬 Starting reply generation cycle...');
  
  // 🚀 AGGRESSIVE GROWTH: Check reply frequency limits (3 replies per hour)
  const replyQuotaCheck = await checkReplyHourlyQuota();
  if (!replyQuotaCheck.canReply) {
    console.log(`[REPLY_JOB] ⏸️ Reply quota reached: ${replyQuotaCheck.repliesThisHour}/3 this hour. Next reply in ${Math.ceil(replyQuotaCheck.minutesUntilNext || 0)} minutes`);
    return;
  }
  
  console.log(`[REPLY_JOB] ✅ Reply quota available: ${replyQuotaCheck.repliesThisHour}/3 this hour`);
  
  try {
    if (config.MODE === 'shadow') {
      await generateSyntheticReplies();
    } else {
      await generateRealReplies();
    }
    console.log('[REPLY_JOB] ✅ Reply generation completed');
  } catch (error: any) {
    console.error('[REPLY_JOB] ❌ Reply generation failed:', error.message);
    throw error;
  }
}

async function generateSyntheticReplies(): Promise<void> {
  console.log('[REPLY_JOB] 🎭 Generating synthetic replies for shadow mode...');
  const decision_id = uuidv4();
  
  const supabase = getSupabaseClient();
  await supabase.from('content_metadata').insert([{
    decision_id,
    decision_type: 'reply',
    content: "Great point about nutrition! Here's an additional insight based on recent research...",
    generation_source: 'synthetic',
    status: 'queued',
    scheduled_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    quality_score: 0.85,
    predicted_er: 0.028,
    topic_cluster: 'nutrition',
    target_tweet_id: 'mock_tweet_123',
    target_username: 'health_influencer',
    bandit_arm: 'supportive_reply'
  }]);
  
  console.log(`[REPLY_JOB] 🎭 Synthetic reply queued decision_id=${decision_id}`);
}

async function generateRealReplies(): Promise<void> {
  const llmCheck = isLLMAllowed();
  if (!llmCheck.allowed) {
    console.log(`[REPLY_JOB] ⏭️ LLM blocked: ${llmCheck.reason}`);
    return;
  }
  
  console.log('[REPLY_JOB] 🧠 Generating real replies using LLM...');
  
  // Discover targets (mock for now)
  const targets = await discoverTargets();
  
  for (const target of targets.slice(0, 2)) {
    try {
      const reply = await generateReplyWithLLM(target);
      const gateResult = await runGateChain(reply.content, reply.decision_id);
      
      if (!gateResult.passed) {
        console.log(`[GATE_CHAIN] ⛔ Blocked (${gateResult.gate}) decision_id=${reply.decision_id}, reason=${gateResult.reason}`);
        continue;
      }
      
      // Queue for posting
      await queueReply(reply);
      console.log(`[REPLY_JOB] ✅ Real LLM reply queued decision_id=${reply.decision_id} scheduled_at=${reply.scheduled_at}`);
      
    } catch (error: any) {
      replyLLMMetrics.calls_failed++;
      const errorType = categorizeError(error);
      replyLLMMetrics.failure_reasons[errorType] = (replyLLMMetrics.failure_reasons[errorType] || 0) + 1;
      
      console.error(`[REPLY_JOB] ❌ LLM generation failed: ${error.message}`);
      
      if (errorType === 'insufficient_quota') {
        console.log('[REPLY_JOB] OpenAI insufficient_quota → not queueing');
      }
    }
  }
}

async function generateReplyWithLLM(target: any) {
  const flags = getConfig();
  const decision_id = uuidv4();
  
  const prompt = `Generate a helpful, evidence-based reply to this health-related tweet:

Original tweet: "${target.content}"
Author: @${target.username}

Your reply should:
- Add genuine value with research or practical insights
- Be conversational and supportive
- Under 280 characters
- No hashtags or excessive emojis
- Never make false claims

Format as JSON:
{
  "content": "Your reply text here"
}`;

  replyLLMMetrics.calls_total++;
  
  console.log(`[OPENAI] using budgeted client purpose=reply_generation model=${flags.OPENAI_MODEL}`);
  
  const response = await createBudgetedChatCompletion({
    model: flags.OPENAI_MODEL,
    messages: [
      { role: 'system', content: 'You are a knowledgeable health enthusiast who provides genuine, evidence-based insights. Always respond with valid JSON format.' },
      { role: 'user', content: prompt }
    ],
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
    top_p: parseFloat(process.env.OPENAI_TOP_P || '1.0'),
    max_tokens: 200,
    response_format: { type: 'json_object' }
  }, {
    purpose: 'reply_generation',
    requestId: decision_id
  });

  const rawContent = response.choices[0]?.message?.content;
  if (!rawContent) throw new Error('Empty response from OpenAI');

  const replyData = JSON.parse(rawContent);
  if (!replyData.content || replyData.content.length > 280) {
    throw new Error('Invalid reply: missing content or too long');
  }

  const scheduledAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min from now

  return {
    decision_id,
    content: replyData.content,
    target_tweet_id: target.tweet_id,
    target_username: target.username,
    topic: target.topic,
    quality_score: calculateQuality(replyData.content),
    predicted_er: 0.025,
    scheduled_at: scheduledAt.toISOString()
  };
}

async function queueReply(reply: any): Promise<void> {
  const supabase = getSupabaseClient();
  
  await supabase.from('content_metadata').insert([{
    decision_id: reply.decision_id,
    decision_type: 'reply',
    content: reply.content,
    generation_source: 'real',
    status: 'queued',
    scheduled_at: reply.scheduled_at,
    quality_score: reply.quality_score,
    predicted_er: reply.predicted_er,
    topic_cluster: reply.topic,
    target_tweet_id: reply.target_tweet_id,
    target_username: reply.target_username,
    bandit_arm: 'supportive_reply',
    created_at: new Date().toISOString()
  }]);
}

async function discoverTargets() {
  // Mock target discovery
  return [
    {
      tweet_id: `tweet_${Date.now()}_1`,
      username: 'health_researcher',
      content: "New study shows Mediterranean diet reduces cardiovascular risk by 30%.",
      topic: 'nutrition'
    }
  ];
}

async function runGateChain(text: string, decision_id: string) {
  const flags = getConfig();
  const quality = calculateQuality(text);
  if (quality < flags.MIN_QUALITY_SCORE) {
    return { passed: false, gate: 'quality', reason: 'below_threshold' };
  }
  return { passed: true };
}

function calculateQuality(text: string): number {
  let score = 0.5;
  if (text.length >= 50 && text.length <= 250) score += 0.2;
  if (/\b(study|research)\b/i.test(text)) score += 0.15;
  if (!/\b(amazing|incredible)\b/i.test(text)) score += 0.15;
  return Math.min(1.0, score);
}

function categorizeError(error: any): string {
  const msg = error.message?.toLowerCase() || '';
  if (error.status === 429 || msg.includes('rate_limit')) return 'rate_limit';
  if (msg.includes('quota')) return 'insufficient_quota';
  if (msg.includes('budget')) return 'budget_exceeded';
  return 'unknown';
}