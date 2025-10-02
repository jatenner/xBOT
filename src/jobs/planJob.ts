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
  
  const prompt = `Generate a high-quality health-focused Twitter post that is:
- Educational and evidence-based
- Engaging and shareable 
- Under 280 characters
- No hashtags or excessive emojis
- Genuine health advice that adds real value

Format your response as JSON:
{
  "text": "Your tweet text here",
  "topic": "specific health topic",
  "angle": "perspective or hook"
}`;

  llmMetrics.calls_total++;
  
  console.log(`[OPENAI] using budgeted client purpose=content_generation model=${flags.OPENAI_MODEL}`);
  
  const response = await createBudgetedChatCompletion({
    model: flags.OPENAI_MODEL,
    messages: [
      { role: 'system', content: 'You are a health content expert who creates evidence-based, engaging social media content.' },
      { role: 'user', content: prompt }
    ],
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.8'),
    top_p: parseFloat(process.env.OPENAI_TOP_P || '1.0'),
    max_tokens: 300,
    response_format: { type: 'json_object' }
  }, {
    purpose: 'content_generation',
    requestId: decision_id
  });

  const rawContent = response.choices[0]?.message?.content;
  if (!rawContent) throw new Error('Empty response from OpenAI');

  const contentData = JSON.parse(rawContent);
  if (!contentData.text || contentData.text.length > 280) {
    throw new Error('Invalid content: missing text or too long');
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
    bandit_arm: 'educational',
    timing_arm: `slot_${content.timing_slot}`
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

async function checkUniqueness(text: string): Promise<boolean> {
  // Simplified uniqueness check
  return true; // TODO: Implement embedding-based check
}

function calculateQuality(text: string): number {
  let score = 0.5;
  if (text.length >= 100 && text.length <= 250) score += 0.2;
  if (/\b(study|research|evidence)\b/i.test(text)) score += 0.15;
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