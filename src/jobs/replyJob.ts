/**
 * 💬 REPLY JOB
 * Handles reply generation on timer intervals
 */

import { getConfig, getModeFlags } from '../config/config';

export async function generateReplies(): Promise<void> {
  const config = getConfig();
  const flags = getModeFlags(config);
  
  console.log('[REPLY_JOB] 💬 Starting reply generation cycle...');
  
  try {
    if (flags.useSyntheticGeneration) {
      // Shadow mode: generate mock replies
      await generateSyntheticReplies();
    } else {
      // Live mode: use real LLM and target discovery
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

async function generateRealReplies(): Promise<void> {
  console.log('[REPLY_JOB] 🧠 Discovering real targets and generating replies...');
  
  try {
    // 1. Check rate limits and daily caps
    const canGenerateReplies = await checkReplyRateLimits();
    if (!canGenerateReplies) {
      console.log('[REPLY_JOB] ⚠️ Reply rate limit reached, skipping');
      return;
    }
    
    // 2. Discover reply targets 
    const targets = await discoverReplyTargets();
    if (targets.length === 0) {
      console.log('[REPLY_JOB] ℹ️ No suitable targets found');
      return;
    }
    
    console.log(`[REPLY_JOB] 🎯 Found ${targets.length} potential targets`);
    
    // 3. Generate replies for each target
    let successCount = 0;
    for (const target of targets) {
      try {
        const reply = await generateReplyForTarget(target);
        const gateResult = await runReplyGateChain(reply, target);
        
        if (!gateResult.passed) {
          console.log(`[REPLY_JOB] ❌ Reply blocked by ${gateResult.gate}: ${gateResult.reason}`);
          await updateGateMetrics(gateResult.gate);
          continue;
        }
        
        // Store reply decision for posting
        await storeReplyDecisionForPosting(reply, target);
        successCount++;
        
        console.log(`[REPLY_JOB] ✅ Reply generated for @${target.username}: "${reply.content.substring(0, 50)}..."`);
        
      } catch (error) {
        console.warn(`[REPLY_JOB] ⚠️ Failed to generate reply for @${target.username}:`, error.message);
      }
    }
    
    console.log(`[REPLY_JOB] 📊 Generated ${successCount} valid replies`);
    
  } catch (error) {
    console.error('[REPLY_JOB] ❌ Real reply generation failed:', error.message);
    
    // Fallback to synthetic on error (fail-safe)
    console.log('[REPLY_JOB] 🔄 Falling back to synthetic replies');
    await generateSyntheticReplies();
  }
}

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
  const maxRepliesPerDay = parseInt(config.REPLY_MAX_PER_DAY || '0');
  
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
      .from('unified_ai_intelligence')
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

  console.log(`[REPLY_JOB] 🤖 Generating reply for @${target.username}...`);
  
  const response = await openaiService.generateCompletion({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a knowledgeable health enthusiast who provides genuine, evidence-based insights. Focus on being helpful and authentic, never making false claims.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 200,
    temperature: 0.7,
    response_format: { type: 'json_object' }
  }, 'reply_generation');

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
}

async function runReplyGateChain(reply: GeneratedReply, target: ReplyTarget): Promise<{passed: boolean, gate: string, reason?: string}> {
  try {
    const { prePostValidation } = await import('../posting/gateChain');
    
    return await prePostValidation(reply.content, {
      decision_id: `reply_${Date.now()}`,
      topic_cluster: reply.topic,
      content_type: 'reply',
      target_username: target.username
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
      .from('unified_ai_intelligence')
      .insert([{
        id: decisionId,
        content: reply.content,
        decision_type: 'reply',
        target_tweet_id: reply.target_tweet_id,
        target_username: reply.target_username,
        bandit_arm: reply.bandit_arm,
        predicted_er: reply.predicted_engagement,
        topic_cluster: reply.topic,
        status: 'ready_for_posting',
        created_at: new Date().toISOString()
      }]);

    if (error) {
      console.warn('[REPLY_JOB] ⚠️ Failed to store reply decision:', error.message);
    } else {
      console.log(`[REPLY_JOB] 📝 Reply decision stored: ${decisionId}`);
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
