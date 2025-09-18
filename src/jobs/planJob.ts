/**
 * 📝 PLAN JOB
 * Handles content planning on timer intervals
 */

import { getConfig, getModeFlags } from '../config/config';

export async function planContent(): Promise<void> {
  const config = getConfig();
  const flags = getModeFlags(config);
  
  console.log('[PLAN_JOB] 📝 Starting content planning cycle...');
  
  try {
    // 1. Select optimal timing using UCB bandit
    const { getUCBTimingBandit } = await import('../schedule/ucbTiming');
    const ucbTiming = getUCBTimingBandit();
    const timingSelection = await ucbTiming.selectTimingWithUCB();
    
    console.log(`[PLAN_JOB] ⏰ UCB selected timing: slot ${timingSelection.slot} (confidence: ${(timingSelection.confidence * 100).toFixed(1)}%)`);
    console.log(`[PLAN_JOB] 🔍 Neighboring slots for exploration: [${timingSelection.neighbors.join(', ')}]`);
    
    // 2. Generate content based on mode
    if (flags.useSyntheticGeneration) {
      // Shadow mode: generate mock content
      await generateSyntheticContent();
    } else {
      // Live mode: use real LLM
      await generateRealContent();
    }
    
    console.log('[PLAN_JOB] ✅ Content planning completed');
  } catch (error) {
    console.error('[PLAN_JOB] ❌ Planning failed:', error.message);
    throw error;
  }
}

async function generateSyntheticContent(): Promise<void> {
  console.log('[PLAN_JOB] 🎭 Generating synthetic content for shadow mode...');
  
  // Mock content generation with realistic timing
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const mockContent = [
    {
      content: "Health tip: Stay hydrated! Your body needs water for optimal function.",
      quality: 0.82,
      predicted_er: 0.034,
      format: "educational",
      timestamp: new Date().toISOString()
    },
    {
      content: "Did you know? Regular sleep schedules can improve your immune system significantly.",
      quality: 0.91,
      predicted_er: 0.041,
      format: "fact_sharing",
      timestamp: new Date().toISOString()
    },
    {
      content: "Mental health matters: Take 5 minutes today for mindful breathing exercises.",
      quality: 0.88,
      predicted_er: 0.037,
      format: "wellness_tip",
      timestamp: new Date().toISOString()
    }
  ];
  
  for (const content of mockContent) {
    console.log(`[PLAN_JOB] ✨ Generated: "${content.content.substring(0, 50)}..."`);
    console.log(`[PLAN_JOB]    Quality: ${content.quality}, Predicted ER: ${content.predicted_er}`);
  }
  
  console.log(`[PLAN_JOB] 📊 Generated ${mockContent.length} synthetic content items`);
}

async function generateRealContent(): Promise<void> {
  console.log('[PLAN_JOB] 🧠 Generating real content using LLM...');
  
  try {
    // Get real decision ID and timing info
    const decisionId = `decision_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    // 1. Get UCB timing selection for context
    const { getUCBTimingBandit } = await import('../schedule/ucbTiming');
    const ucbTiming = getUCBTimingBandit();
    const timingSelection = await ucbTiming.selectTimingWithUCB();
    
    // 2. Generate content using OpenAI
    const content = await generateContentWithOpenAI(decisionId, timingSelection);
    
    // 3. Run through gate chain
    const gateResult = await runGateChain(content, decisionId);
    
    if (!gateResult.passed) {
      console.log(`[PLAN_JOB] ❌ Content blocked by ${gateResult.gate}: ${gateResult.reason}`);
      await updateGateMetrics(gateResult.gate);
      return;
    }
    
    // 4. Store decision for posting and analytics tracking
    await storeDecisionForPosting(decisionId, content, timingSelection);
    
    console.log(`[PLAN_JOB] ✅ Real content generated and queued: "${content.text.substring(0, 50)}..."`);
    
  } catch (error) {
    console.error('[PLAN_JOB] ❌ Real content generation failed:', error.message);
    
    // Fallback to synthetic on error (fail-safe)
    console.log('[PLAN_JOB] 🔄 Falling back to synthetic content');
    await generateSyntheticContent();
  }
}

interface GeneratedContent {
  text: string;
  topic: string;
  format: string;
  quality_score: number;
  predicted_er: number;
  bandit_arm: string;
}

async function generateContentWithOpenAI(decisionId: string, timingSelection: any): Promise<GeneratedContent> {
  // Get budgeted OpenAI service
  const { OpenAIService } = await import('../services/openAIService');
  const openaiService = OpenAIService.getInstance();
  
  // Health-focused content prompt
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
  "format": "educational|tip|fact|question",
  "reasoning": "why this content is valuable"
}`;

  console.log('[PLAN_JOB] 🤖 Calling OpenAI for content generation...');
  
  const response = await openaiService.chatCompletion([
      {
        role: 'system',
        content: 'You are a health content expert who creates evidence-based, engaging social media content. Focus on providing genuine value without making false claims.'
      },
      {
        role: 'user',
        content: prompt
      }
    ], {
    model: 'gpt-4o-mini',
    maxTokens: 300,
    temperature: 0.8,
    response_format: { type: 'json_object' },
    requestType: 'content_generation'
  });

  const rawContent = response.choices[0]?.message?.content;
  if (!rawContent) {
    throw new Error('Empty response from OpenAI');
  }

  // Parse and validate response
  let contentData;
  try {
    contentData = JSON.parse(rawContent);
  } catch (error) {
    throw new Error('Invalid JSON response from OpenAI');
  }

  if (!contentData.text || contentData.text.length > 280) {
    throw new Error('Invalid content: missing text or too long');
  }

  // Calculate quality score based on content characteristics
  const qualityScore = calculateContentQuality(contentData.text);
  
  // Predict engagement rate (simplified model)
  const predictedER = predictEngagementRate(contentData.text, contentData.topic);

  return {
    text: contentData.text,
    topic: contentData.topic || 'health',
    format: contentData.format || 'educational',
    quality_score: qualityScore,
    predicted_er: predictedER,
    bandit_arm: determineBanditArm(contentData.topic, contentData.format)
  };
}

async function runGateChain(content: GeneratedContent, decisionId: string): Promise<{passed: boolean, gate: string, reason?: string}> {
  try {
    const { prePostValidation } = await import('../posting/gateChain');
    
    return await prePostValidation(content.text, {
      decision_id: decisionId,
      topic_cluster: content.topic,
      content_type: content.format,
      quality_score: content.quality_score
    });
  } catch (error) {
    console.warn('[PLAN_JOB] ⚠️ Gate chain error, allowing content:', error.message);
    return { passed: true, gate: 'error' };
  }
}

async function updateGateMetrics(gate: string): Promise<void> {
  try {
    const { updateMockMetrics } = await import('../api/metrics');
    
    switch (gate) {
      case 'quality':
        updateMockMetrics({ qualityBlocksCount: 1 });
        break;
      case 'rotation':
        updateMockMetrics({ rotationBlocksCount: 1 });
        break;
      case 'uniqueness':
        updateMockMetrics({ uniqueBlocksCount: 1 });
        break;
    }
  } catch (error) {
    console.warn('[PLAN_JOB] ⚠️ Failed to update gate metrics:', error.message);
  }
}

async function storeDecisionForPosting(decisionId: string, content: GeneratedContent, timingSelection: any): Promise<void> {
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    // Store decision in unified_ai_intelligence table for tracking
    const { error } = await supabase
      .from('unified_ai_intelligence')
      .insert([{
        id: decisionId,
        content: content.text,
        decision_type: 'content',
        bandit_arm: content.bandit_arm,
        timing_arm: timingSelection.slot.toString(),
        predicted_er: content.predicted_er,
        quality_score: content.quality_score,
        topic_cluster: content.topic,
        status: 'ready_for_posting',
        created_at: new Date().toISOString()
      }]);

    if (error) {
      console.warn('[PLAN_JOB] ⚠️ Failed to store decision:', error.message);
    } else {
      console.log(`[PLAN_JOB] 📝 Decision stored for posting: ${decisionId}`);
    }
  } catch (error) {
    console.warn('[PLAN_JOB] ⚠️ Failed to store decision:', error.message);
  }
}

function calculateContentQuality(text: string): number {
  let score = 0.5; // Base score
  
  // Length check (optimal range)
  if (text.length >= 100 && text.length <= 250) score += 0.2;
  
  // Educational indicators
  if (/\b(study|research|evidence|studies|data)\b/i.test(text)) score += 0.15;
  
  // Actionable content
  if (/\b(try|start|consider|avoid|include)\b/i.test(text)) score += 0.1;
  
  // Avoid overly promotional language
  if (!/\b(amazing|incredible|unbelievable|secret)\b/i.test(text)) score += 0.1;
  
  // No excessive punctuation/caps
  if (!/[!]{2,}|[A-Z]{3,}/.test(text)) score += 0.05;
  
  return Math.min(1.0, score);
}

function predictEngagementRate(text: string, topic: string): number {
  // Simplified engagement prediction model
  let baseER = 0.02; // 2% base engagement rate
  
  // Topic bonuses
  const topicBonus: Record<string, number> = {
    'nutrition': 0.005,
    'exercise': 0.008,
    'mental_health': 0.006,
    'sleep': 0.004,
    'wellness': 0.003
  };
  
  baseER += topicBonus[topic] || 0;
  
  // Content characteristic bonuses
  if (text.includes('?')) baseER += 0.002; // Questions increase engagement
  if (/\b(tip|hack|secret)\b/i.test(text)) baseER += 0.003;
  if (text.length < 200) baseER += 0.001; // Shorter posts often perform better
  
  return Math.min(0.08, baseER); // Cap at 8% to be realistic
}

function determineBanditArm(topic: string, format: string): string {
  // Map to standard bandit arms
  const topicArms: Record<string, string> = {
    'nutrition': 'educational',
    'exercise': 'wellness_tip',  
    'mental_health': 'fact_sharing',
    'sleep': 'wellness_tip',
    'wellness': 'educational'
  };
  
  return topicArms[topic] || 'educational';
}
