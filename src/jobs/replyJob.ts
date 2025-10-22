/**
 * 💬 REPLY JOB - Autonomous Reply Generation
 * Generates replies using LLM and queues for posting
 */

import { v4 as uuidv4 } from 'uuid';
import { getConfig } from '../config/config';
import { getEnvConfig, isLLMAllowed } from '../config/envFlags';
import { getSupabaseClient } from '../db/index';
import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { strategicReplySystem } from '../growth/strategicReplySystem';
import { getPersonalityScheduler, type GeneratorType } from '../scheduling/personalityScheduler';

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
    const config = getConfig();
    const maxRepliesPerHour = config.REPLIES_PER_HOUR || 6;
    const canReply = repliesThisHour < maxRepliesPerHour;
    
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
  const maxRepliesPerHour = config.REPLIES_PER_HOUR || 6;
  console.log('[REPLY_JOB] 💬 Starting reply generation cycle...');
  
  // Check reply frequency limits
  const replyQuotaCheck = await checkReplyHourlyQuota();
  if (!replyQuotaCheck.canReply) {
    console.log(`[REPLY_JOB] ⏸️ Reply quota reached: ${replyQuotaCheck.repliesThisHour}/${maxRepliesPerHour} this hour. Next reply in ${Math.ceil(replyQuotaCheck.minutesUntilNext || 0)} minutes`);
    return;
  }
  
  console.log(`[REPLY_JOB] ✅ Reply quota available: ${replyQuotaCheck.repliesThisHour}/${maxRepliesPerHour} this hour`);
  
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
  
  console.log('[REPLY_JOB] 🎯 Starting reply generation (AI-driven targeting)...');
  
  // Log account pool status
  const { getAccountPoolHealth } = await import('./accountDiscoveryJob');
  const poolHealth = await getAccountPoolHealth();
  console.log(`[REPLY_JOB] 📊 Account Pool Status:`);
  console.log(`  • Total accounts: ${poolHealth.total_accounts}`);
  console.log(`  • High quality: ${poolHealth.high_quality}`);
  console.log(`  • Recent discoveries: ${poolHealth.recent_discoveries}`);
  console.log(`  • Health: ${poolHealth.status.toUpperCase()}`);
  
  if (poolHealth.status === 'critical') {
    console.warn('[REPLY_JOB] ⚠️ CRITICAL: Account pool too small (<20 accounts)');
    console.log('[REPLY_JOB] 💡 Waiting for account_discovery job to populate pool...');
    return;
  }
  
  // 🚀 QUERY OPPORTUNITIES FROM DATABASE POOL (populated by harvester)
  console.log('[REPLY_JOB] 🔍 Querying reply opportunities from database pool...');
  const supabase = getSupabaseClient();
  
  // Get fresh opportunities (<24h old, not yet replied to)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const { data: dbOpportunities, error: oppError } = await supabase
    .from('reply_opportunities')
    .select('*')
    .eq('status', 'pending')
    .gte('tweet_posted_at', twentyFourHoursAgo.toISOString())
    .order('opportunity_score', { ascending: false })
    .limit(10);
  
  if (oppError) {
    console.error('[REPLY_JOB] ❌ Failed to query opportunities:', oppError.message);
    return;
  }
  
  if (!dbOpportunities || dbOpportunities.length === 0) {
    console.log('[REPLY_JOB] ⚠️ No opportunities in pool, waiting for harvester...');
    return;
  }
  
  // Convert to the format expected by strategic reply system
  const opportunities = dbOpportunities.map(opp => ({
    target: {
      username: opp.target_username || 'unknown',
      followers: opp.target_followers || 50000,
      follower_overlap_score: 0.5,
      reply_window: 'early',
      rising_potential: 0.7,
      conversion_potential: opp.opportunity_score / 100,
      times_replied: 0,
      avg_engagement_on_replies: 0,
      avg_followers_gained: 0,
      actual_conversion_rate: 0,
      priority_score: opp.opportunity_score,
      handle: `@${opp.target_username}`,
      engagement_rate: 0.05
    },
    tweet_url: opp.target_tweet_url,
    tweet_posted_at: opp.tweet_posted_at,
    minutes_since_post: opp.posted_minutes_ago || 0,
    reply_strategy: 'Add value with research or insights',
    estimated_followers: Math.round((opp.opportunity_score / 100) * 10)
  }));
  
  console.log(`[REPLY_JOB] ✅ Found ${opportunities.length} reply opportunities from database pool`);
  
  // Take top 3-5 opportunities (AGGRESSIVE MODE - generate more replies)
  const replyCount = Math.min(5, opportunities.length);
  console.log(`[REPLY_JOB] 🚀 AGGRESSIVE MODE: Generating ${replyCount} strategic replies`);
  
  for (const opportunity of opportunities.slice(0, replyCount)) {
    const target = {
      account: {
        username: opportunity.target.username,
        category: 'health',
        followers: opportunity.target.followers,
        engagement_velocity: 'high' as const
      },
      tweet_url: opportunity.tweet_url || '',
      tweet_content: '',
      estimated_reach: opportunity.estimated_followers || 0,
      reply_angle: opportunity.reply_strategy
    };
    try {
      // Pick a reply-appropriate generator (intelligent matching)
      const replyGenerator = selectReplyGenerator(target.account.category, target.account.username);
      console.log(`[REPLY_JOB] 🎭 Using ${replyGenerator} for reply to @${target.account.username} (${target.account.category})`);
      
      // Generate strategic reply
      const strategicReply = await strategicReplySystem.generateStrategicReply(target);
      
      // Validate quality
      if (!strategicReply.provides_value || !strategicReply.not_spam) {
        console.log(`[REPLY_JOB] ⚠️ Reply quality too low (value: ${strategicReply.provides_value}, not_spam: ${strategicReply.not_spam})`);
        continue;
      }
      
      const decision_id = uuidv4();
      
      // Run gate chain
      const gateResult = await runGateChain(strategicReply.content, decision_id);
      
      if (!gateResult.passed) {
        console.log(`[GATE_CHAIN] ⛔ Blocked (${gateResult.gate}) decision_id=${decision_id}, reason=${gateResult.reason}`);
        continue;
      }
      
      const reply = {
        decision_id,
        content: strategicReply.content,
        target_username: target.account.username,
        target_tweet_id: target.tweet_url.split('/').pop() || 'unknown',
        target_tweet_content: target.tweet_content,
        generator_used: replyGenerator,
        estimated_reach: target.estimated_reach,
        scheduled_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 min from now
      };
      
      // Queue for posting
      await queueReply(reply);
      console.log(`[REPLY_JOB] ✅ Reply queued:`);
      console.log(`  • Target: @${target.account.username}`);
      console.log(`  • Followers: ${target.account.followers.toLocaleString()}`);
      console.log(`  • Estimated reach: ${target.estimated_reach.toLocaleString()}`);
      console.log(`  • Generator: ${replyGenerator}`);
      console.log(`  • Content preview: "${strategicReply.content.substring(0, 60)}..."`);
      
      // Mark opportunity as replied in database
      const supabaseForUpdate = getSupabaseClient();
      await supabaseForUpdate
        .from('reply_opportunities')
        .update({ 
          status: 'replied',
          replied_at: new Date().toISOString()
        })
        .eq('target_tweet_id', reply.target_tweet_id);
      
    } catch (error: any) {
      replyLLMMetrics.calls_failed++;
      const errorType = categorizeError(error);
      replyLLMMetrics.failure_reasons[errorType] = (replyLLMMetrics.failure_reasons[errorType] || 0) + 1;
      
      console.error(`[REPLY_JOB] ❌ Reply generation failed: ${error.message}`);
      
      if (errorType === 'insufficient_quota') {
        console.log('[REPLY_JOB] ⚠️ OpenAI quota exhausted - skipping remaining replies');
        break; // Exit loop if quota exhausted
      }
    }
  }
  
  // Final summary
  const supabase = getSupabaseClient();
  const { count } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .is('posted_at', null);
  
  console.log(`[REPLY_JOB] 📋 Reply Queue Status:`);
  console.log(`  • Queued for posting: ${count || 0} replies`);
  console.log(`  • Next posting cycle: ~15 minutes`);
}

/**
 * Select generator appropriate for replies - INTELLIGENT MATCHING
 * Matches generator to tweet category for maximum value addition
 */
function selectReplyGenerator(category: string, target_account: string): GeneratorType {
  // Get best performing generator for this account (if we have data)
  const { replyLearningSystem } = require('../growth/replyLearningSystem');
  const bestForAccount = replyLearningSystem.getBestGeneratorForAccount(target_account);
  
  if (bestForAccount && Math.random() < 0.7) {
    // 70% exploit best performer
    console.log(`[GENERATOR_SELECT] 🎯 Using best performer for @${target_account}: ${bestForAccount}`);
    return bestForAccount;
  }
  
  // 30% explore - match generator to category
  const categoryMapping: Record<string, GeneratorType[]> = {
    neuroscience: ['data_nerd', 'news_reporter', 'thought_leader'],
    longevity: ['data_nerd', 'coach', 'thought_leader'],
    nutrition: ['myth_buster', 'coach', 'data_nerd'],
    science: ['data_nerd', 'news_reporter'],
    medical: ['data_nerd', 'news_reporter'],
    functional_medicine: ['coach', 'thought_leader', 'myth_buster'],
    biohacking: ['data_nerd', 'coach', 'news_reporter'],
    fitness: ['coach', 'myth_buster'],
    wellness: ['coach', 'thought_leader'],
    brain_health: ['data_nerd', 'news_reporter'],
    movement: ['coach', 'myth_buster'],
    optimization: ['data_nerd', 'coach']
  };
  
  const generators = categoryMapping[category] || ['data_nerd', 'coach', 'thought_leader'];
  const selected = generators[Math.floor(Math.random() * generators.length)];
  
  console.log(`[GENERATOR_SELECT] 🎲 Exploring with ${selected} for category: ${category}`);
  return selected;
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
  
  const { data, error } = await supabase.from('content_metadata').insert([{
    decision_id: reply.decision_id,
    decision_type: 'reply',
    content: reply.content,
    generation_source: 'strategic_multi_generator',
    status: 'queued',
    scheduled_at: reply.scheduled_at,
    quality_score: reply.quality_score || 0.85,
    predicted_er: reply.predicted_er || 0.028,
    topic_cluster: reply.topic || 'health',
    target_tweet_id: reply.target_tweet_id,
    target_username: reply.target_username,
    target_tweet_content: reply.target_tweet_content || '',
    generator_used: reply.generator_used || 'unknown',
    // ❌ REMOVED: estimated_reach - column doesn't exist
    bandit_arm: `strategic_reply_${reply.generator_used || 'unknown'}`,
    created_at: new Date().toISOString()
  }]);
  
  if (error) {
    console.error('[REPLY_JOB] ❌ Failed to queue reply:', error.message);
    throw error;
  }
  
  console.log(`[REPLY_JOB] 💾 Reply queued in database: ${reply.decision_id}`);
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