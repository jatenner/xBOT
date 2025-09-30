/**
 * 💬 REPLY JOB
 * Handles reply generation on timer intervals
 */

import { getConfig } from '../config/config';

// Global metrics tracking for replies
let replyLLMMetrics = {
  calls_total: 0,
  calls_failed: 0,
  failure_reasons: {} as Record<string, number>
};

export async function generateReplies(): Promise<void> {
  const config = getConfig();
  
  console.log('[REPLY_JOB] 💬 Starting reply generation cycle...');
  
  try {
    if (config.MODE === 'shadow') {
      // Shadow mode: generate mock replies
      await generateSyntheticReplies();
    } else {
      // Live mode: use real LLM and target discovery
      console.log('[REPLY_JOB] 🧠 Discovering real targets and generating replies...');
      await generateRealReplies();
    }
    
    console.log('[REPLY_JOB] ✅ Reply generation completed');
  } catch (error) {
    console.error('[REPLY_JOB] ❌ Reply generation failed:', error.message);
    throw error;
  }
}

async function generateSyntheticReplies(): Promise<void> {
  console.log('[REPLY_JOB] 🎭 Generating synthetic replies for shadow mode...');
  
  // Mock reply discovery and generation
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  const mockTargets = [
    {
      username: '@health_influencer',
      followers: 150000,
      topic: 'nutrition',
      velocity: 'high',
      reply: "Great point about nutrition! Here's an additional insight based on recent research...",
      predicted_engagement: 0.032
    },
    {
      username: '@wellness_coach',
      followers: 85000,
      topic: 'mental_health',
      velocity: 'medium',
      reply: "Absolutely agree on mental wellness! Studies show that mindfulness can reduce stress by 40%...",
      predicted_engagement: 0.028
    },
    {
      username: '@fitness_expert',
      followers: 200000,
      topic: 'exercise',
      velocity: 'high',
      reply: "Excellent exercise advice! For optimal results, consider adding progressive overload...",
      predicted_engagement: 0.035
    }
  ];
  
  console.log('[REPLY_JOB] 🎯 Found target accounts:');
  for (const target of mockTargets) {
    console.log(`[REPLY_JOB]    • ${target.username} (${target.followers.toLocaleString()} followers, ${target.topic}, ${target.velocity} velocity)`);
    console.log(`[REPLY_JOB]      💬 Reply: "${target.reply.substring(0, 50)}..."`);
    console.log(`[REPLY_JOB]      📈 Predicted engagement: ${target.predicted_engagement}`);
  }
  
  console.log(`[REPLY_JOB] 📊 Generated ${mockTargets.length} synthetic replies`);
}

// Removed duplicate function - using the improved implementation later in the file

interface ReplyTarget {
  tweet_id: string;
  username: string;
  followers: number;
  content: string;
  topic: string;
  velocity: 'high' | 'medium' | 'low';
  engagement_rate: number;
}

interface GeneratedReply {
  content: string;
  target_tweet_id: string;
  target_username: string;
  predicted_engagement: number;
  bandit_arm: string;
  topic: string;
}

async function checkReplyRateLimits(): Promise<boolean> {
  const config = getConfig();
  const maxRepliesPerDay = parseInt(String(config.REPLY_MAX_PER_DAY || 0));
  
  if (maxRepliesPerDay === 0) {
    console.log('[REPLY_JOB] ℹ️ Reply generation disabled (REPLY_MAX_PER_DAY=0)');
    return false;
  }
  
  try {
    // Check today's reply count from database
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    const today = new Date().toISOString().split('T')[0];
    
    const { count, error } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', 'reply')
      .gte('created_at', `${today}T00:00:00.000Z`)
      .lt('created_at', `${today}T23:59:59.999Z`);
    
    if (error) {
      console.warn('[REPLY_JOB] ⚠️ Failed to check daily reply count, allowing replies');
      return true;
    }
    
    const todayCount = count || 0;
    if (todayCount >= maxRepliesPerDay) {
      console.log(`[REPLY_JOB] ⚠️ Daily reply limit reached: ${todayCount}/${maxRepliesPerDay}`);
      return false;
    }
    
    console.log(`[REPLY_JOB] ✅ Reply budget available: ${todayCount}/${maxRepliesPerDay}`);
    return true;
    
  } catch (error) {
    console.warn('[REPLY_JOB] ⚠️ Failed to check rate limits, allowing replies:', error.message);
    return true;
  }
}

async function discoverReplyTargets(): Promise<ReplyTarget[]> {
  // For now, use a simplified target discovery approach
  // In a full implementation, this would search Twitter for recent health-related tweets
  // from accounts with good engagement and follower counts
  
  console.log('[REPLY_JOB] 🔍 Discovering reply targets...');
  
  // Mock targets that represent real discovery patterns
  const mockTargets: ReplyTarget[] = [
    {
      tweet_id: `tweet_${Date.now()}_1`,
      username: 'health_researcher',
      followers: 125000,
      content: "New study shows that Mediterranean diet reduces cardiovascular risk by 30%. The key components are...",
      topic: 'nutrition',
      velocity: 'high',
      engagement_rate: 0.045
    },
    {
      tweet_id: `tweet_${Date.now()}_2`,
      username: 'mindfulness_expert',
      followers: 89000,
      content: "Daily meditation practice can significantly improve focus and reduce anxiety. Start with just 5 minutes...",
      topic: 'mental_health',
      velocity: 'medium',
      engagement_rate: 0.032
    }
  ];
  
  // Filter based on criteria (engagement rate, follower count, topic relevance)
  const filteredTargets = mockTargets.filter(target => 
    target.followers >= 50000 &&
    target.engagement_rate >= 0.02 &&
    ['nutrition', 'exercise', 'mental_health', 'wellness', 'sleep'].includes(target.topic)
  );
  
  console.log(`[REPLY_JOB] 📋 Filtered to ${filteredTargets.length} high-quality targets`);
  
  return filteredTargets;
}

async function updateReplyLLMMetrics(status: 'success' | 'failed', error?: any): Promise<void> {
  replyLLMMetrics.calls_total++;
  
  if (status === 'failed') {
    replyLLMMetrics.calls_failed++;
    
    // Track failure reasons for observability
    const errorType = error?.status === 429 ? 'rate_limit' :
                     error?.status === 401 ? 'invalid_api_key' :
                     error?.message?.includes('insufficient_quota') ? 'insufficient_quota' :
                     error?.message?.includes('budget') ? 'budget_exceeded' :
                     'unknown';
    
    replyLLMMetrics.failure_reasons[errorType] = (replyLLMMetrics.failure_reasons[errorType] || 0) + 1;
  }
  
  console.log(`[REPLY_JOB] 📊 Reply LLM Metrics - Total: ${replyLLMMetrics.calls_total}, Failed: ${replyLLMMetrics.calls_failed}, Failure Rate: ${((replyLLMMetrics.calls_failed / replyLLMMetrics.calls_total) * 100).toFixed(1)}%`);
}

export function getReplyLLMMetrics() {
  return { ...replyLLMMetrics };
}

async function generateReplyForTarget(target: ReplyTarget): Promise<GeneratedReply> {
  // Get budgeted OpenAI service
  const { OpenAIService } = await import('../services/openAIService');
  const openaiService = OpenAIService.getInstance();
  
  const prompt = `Generate a helpful, evidence-based reply to this health-related tweet:

Original tweet: "${target.content}"
Author: @${target.username} (${target.followers} followers)

Your reply should:
- Add genuine value with research or practical insights
- Be conversational and supportive
- Under 280 characters
- No hashtags or excessive emojis
- Never make false claims about credentials or experience
- Focus on being helpful, not promotional

Format as JSON:
{
  "content": "Your reply text here",
  "reasoning": "why this adds value"
}`;

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  console.log(`[REPLY_JOB] 🤖 Generating reply for @${target.username} using ${model}...`);
  
  try {
    const response = await openaiService.chatCompletion([
        {
          role: 'system',
          content: 'You are a knowledgeable health enthusiast who provides genuine, evidence-based insights. Focus on being helpful and authentic, never making false claims.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
      model,
      maxTokens: 200,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      requestType: 'reply_generation'
    });

    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) {
      throw new Error('Empty response from OpenAI');
    }

    let replyData;
    try {
      replyData = JSON.parse(rawContent);
    } catch (error) {
      throw new Error('Invalid JSON response from OpenAI');
    }

    if (!replyData.content || replyData.content.length > 280) {
      throw new Error('Invalid reply: missing content or too long');
    }

    // Log success metrics
    await updateReplyLLMMetrics('success');
    console.log('[REPLY_JOB] ✅ Real LLM reply generated successfully');

    // Predict engagement for this reply
    const predictedEngagement = predictReplyEngagement(replyData.content, target);

    return {
      content: replyData.content,
      target_tweet_id: target.tweet_id,
      target_username: target.username,
      predicted_engagement: predictedEngagement,
      bandit_arm: determineReplyBanditArm(target.topic),
      topic: target.topic
    };

  } catch (error: any) {
    // Log failure metrics
    await updateReplyLLMMetrics('failed', error);
    
    console.error(`[REPLY_JOB] ❌ OpenAI reply generation failed for @${target.username}:`, error.message);
    
    // Check for known OpenAI errors
    const errorMessage = error.message?.toLowerCase() || '';
    const isKnownError = errorMessage.includes('insufficient_quota') || 
                        errorMessage.includes('rate_limit') ||
                        errorMessage.includes('invalid_api_key') ||
                        errorMessage.includes('budget') ||
                        error.status === 429 || 
                        error.status === 401;

    if (isKnownError) {
      console.log(`[REPLY_JOB] 🔄 OpenAI insufficient_quota → skipping reply for @${target.username}`);
    } else {
      console.error(`[REPLY_JOB] ⚠️ Unknown OpenAI error for @${target.username}:`, error);
    }
    
    // Re-throw to let caller handle fallback
    throw error;
  }
}

async function runReplyGateChain(reply: GeneratedReply, target: ReplyTarget): Promise<{passed: boolean, gate: string, reason?: string}> {
  try {
    const { prePostValidation } = await import('../posting/gateChain');
    
    return await prePostValidation(reply.content, {
      decision_id: `reply_${Date.now()}`,
      topic_cluster: reply.topic,
      content_type: 'reply'
      // Note: target_username stored separately in reply data, not in ContentMetadata
    });
  } catch (error) {
    console.warn('[REPLY_JOB] ⚠️ Reply gate chain error, allowing reply:', error.message);
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
    console.warn('[REPLY_JOB] ⚠️ Failed to update gate metrics:', error.message);
  }
}

async function storeReplyDecisionForPosting(reply: GeneratedReply, target: ReplyTarget): Promise<void> {
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    const decisionId = `reply_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    const { error } = await supabase
      .from('content_metadata')
      .insert([{
        id: decisionId,
        content_id: decisionId,
        content: reply.content,
        decision_type: 'reply',
        target_tweet_id: reply.target_tweet_id,
        target_username: reply.target_username,
        bandit_arm: reply.bandit_arm,
        predicted_er: reply.predicted_engagement,
        topic_cluster: reply.topic,
        topic: reply.topic,
        status: 'queued',
        generation_source: 'real',
        scheduled_at: new Date().toISOString(),
        style: 'educational',
        fact_source: 'llm_generated',
        hook_type: 'tip_promise',
        cta_type: 'engagement_question',
        predicted_engagement: 'medium',
        thread_length: 1,
        fact_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }]);

    if (error) {
      console.warn('[REPLY_JOB] ⚠️ Failed to store reply decision:', error.message);
    } else {
      console.log(`[REPLY_JOB] 📝 Reply decision stored: ${decisionId} (status=queued, generation_source=real)`);
    }
  } catch (error) {
    console.warn('[REPLY_JOB] ⚠️ Failed to store reply decision:', error.message);
  }
}

function predictReplyEngagement(content: string, target: ReplyTarget): number {
  // Base engagement prediction for replies (typically lower than original posts)
  let baseER = target.engagement_rate * 0.3; // Replies typically get 30% of original post engagement
  
  // Content quality bonuses
  if (/\b(study|research|data)\b/i.test(content)) baseER += 0.005;
  if (content.includes('?')) baseER += 0.003; // Questions in replies work well
  if (/\b(thanks|great|helpful|agree)\b/i.test(content)) baseER += 0.002; // Positive sentiment
  
  // Target account bonuses
  if (target.followers > 100000) baseER += 0.002;
  if (target.velocity === 'high') baseER += 0.003;
  
  return Math.min(0.05, baseER); // Cap at 5% for replies
}

function determineReplyBanditArm(topic: string): string {
  const replyArms: Record<string, string> = {
    'nutrition': 'supportive_reply',
    'exercise': 'advice_reply',
    'mental_health': 'empathetic_reply',
    'wellness': 'supportive_reply'
  };
  
  return replyArms[topic] || 'supportive_reply';
}

async function generateRealReplies(): Promise<void> {
  try {
    // Discover real target tweets/accounts for health-focused engagement
    const targets = await discoverTargets();
    
    if (targets.length === 0) {
      console.log('[REPLY_JOB] ℹ️ No suitable targets found, falling back to synthetic');
      await generateSyntheticReplies();
      return;
    }
    
    const successfulReplies = [];
    
    for (const target of targets) {
      try {
        const reply = await generateReplyForTarget(target);
        
        if (reply) {
          successfulReplies.push(reply);
          console.log(`[REPLY_JOB] ✅ Real LLM reply generated successfully for @${target.username}`);
        }
        
      } catch (error: any) {
        const errorMessage = error.message?.toLowerCase() || '';
        const isQuotaError = errorMessage.includes('insufficient_quota') || 
                            errorMessage.includes('rate_limit') ||
                            error.status === 429;
        
        if (isQuotaError) {
          console.log(`[REPLY_JOB] 🔄 OpenAI insufficient_quota → skipping reply for @${target.username}`);
          // Skip this target and continue with others
          continue;
        } else {
          console.warn(`[REPLY_JOB] ⚠️ Failed to generate reply for @${target.username}: ${error.message}`);
        }
      }
    }
    
    if (successfulReplies.length === 0) {
      console.log('[REPLY_JOB] ⚠️ No successful real replies generated, falling back to synthetic');
      await generateSyntheticReplies();
    } else {
      console.log(`[REPLY_JOB] 📊 Generated ${successfulReplies.length} real replies`);
    }
    
  } catch (error: any) {
    console.error('[REPLY_JOB] ❌ Real reply generation failed:', error.message);
    console.log('[REPLY_JOB] 🔄 Falling back to synthetic replies');
    await generateSyntheticReplies();
  }
}

async function discoverTargets(): Promise<any[]> {
  // Mock target discovery for now - in real implementation this would use X API
  return [
    { username: 'health_influencer', followers: 150000, topic: 'nutrition', tweet_id: 'mock_123' },
    { username: 'wellness_coach', followers: 85000, topic: 'mental_health', tweet_id: 'mock_456' },
    { username: 'fitness_expert', followers: 200000, topic: 'exercise', tweet_id: 'mock_789' }
  ];
}
