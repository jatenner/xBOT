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
import { ReplyDiagnosticLogger } from '../utils/replyDiagnostics';

// ============================================================
// RATE LIMIT CONFIGURATION (from .env)
// ============================================================
const REPLY_CONFIG = {
  // Minutes between replies (prevents spam)
  MIN_MINUTES_BETWEEN: parseInt(process.env.REPLY_MINUTES_BETWEEN || '15', 10),
  
  // Max replies per hour
  MAX_REPLIES_PER_HOUR: parseInt(process.env.REPLIES_PER_HOUR || '4', 10),
  
  // Max replies per day
  MAX_REPLIES_PER_DAY: parseInt(process.env.REPLY_MAX_PER_DAY || '50', 10),
  
  // How many to generate per cycle (batch size)
  BATCH_SIZE: parseInt(process.env.REPLY_BATCH_SIZE || '1', 10),
  
  // Stagger delays (prevents bursts)
  STAGGER_BASE_MIN: parseInt(process.env.REPLY_STAGGER_BASE_MIN || '5', 10),
  STAGGER_INCREMENT_MIN: parseInt(process.env.REPLY_STAGGER_INCREMENT_MIN || '10', 10),
};

console.log('[REPLY_CONFIG] 📋 Rate limits loaded:');
console.log(`  • Min between: ${REPLY_CONFIG.MIN_MINUTES_BETWEEN} minutes`);
console.log(`  • Max per hour: ${REPLY_CONFIG.MAX_REPLIES_PER_HOUR}`);
console.log(`  • Max per day: ${REPLY_CONFIG.MAX_REPLIES_PER_DAY}`);
console.log(`  • Batch size: ${REPLY_CONFIG.BATCH_SIZE}`);
console.log(`  • Stagger: ${REPLY_CONFIG.STAGGER_BASE_MIN}min base + ${REPLY_CONFIG.STAGGER_INCREMENT_MIN}min/reply`);

// Global metrics
let replyLLMMetrics = {
  calls_total: 0,
  calls_failed: 0,
  failure_reasons: {} as Record<string, number>
};

export function getReplyLLMMetrics() {
  return { ...replyLLMMetrics };
}

/**
 * Check hourly reply quota
 */
async function checkReplyHourlyQuota(): Promise<{
  canReply: boolean;
  repliesThisHour: number;
  minutesUntilNext?: number;
}> {
  const supabase = getSupabaseClient();
  const now = new Date();
  const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
  
  try {
    // 🚨 CRITICAL FIX: Count replies in content_metadata (the actual table we use!)
    const { count, error } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', 'reply')
      .eq('status', 'posted')
      .gte('posted_at', hourStart.toISOString())
      .lt('posted_at', new Date(hourStart.getTime() + 60 * 60 * 1000).toISOString());
    
    if (error) {
      console.error('[REPLY_QUOTA] ❌ Database error:', error);
      return { canReply: true, repliesThisHour: 0 }; // Allow on error
    }
    
    const repliesThisHour = count || 0;
    const canReply = repliesThisHour < REPLY_CONFIG.MAX_REPLIES_PER_HOUR;
    
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

/**
 * Check daily reply quota
 */
async function checkReplyDailyQuota(): Promise<{
  canReply: boolean;
  repliesToday: number;
  resetTime?: Date;
}> {
  const supabase = getSupabaseClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today
  
  try {
    // 🚨 CRITICAL FIX: Count replies in content_metadata (the actual table!)
    const { count, error } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', 'reply')
      .eq('status', 'posted')
      .gte('posted_at', today.toISOString());
    
    if (error) {
      console.error('[DAILY_QUOTA] ❌ Database error:', error);
      return { canReply: true, repliesToday: 0 }; // Allow on error
    }
    
    const repliesToday = count || 0;
    const canReply = repliesToday < REPLY_CONFIG.MAX_REPLIES_PER_DAY;
    
    // Calculate reset time (midnight tonight)
    const resetTime = new Date(today);
    resetTime.setDate(resetTime.getDate() + 1);
    
    return { canReply, repliesToday, resetTime };
    
  } catch (error) {
    console.error('[DAILY_QUOTA] ❌ Check failed:', error);
    return { canReply: true, repliesToday: 0 };
  }
}

/**
 * Check if enough time has passed since last reply
 */
async function checkTimeBetweenReplies(): Promise<{
  canReply: boolean;
  minutesSinceLast: number;
  minutesUntilNext?: number;
  lastReplyTime?: Date;
}> {
  const supabase = getSupabaseClient();
  
  try {
    // Get most recent reply
    // 🚨 CRITICAL FIX: Check content_metadata for last reply
    const { data, error } = await supabase
      .from('content_metadata')
      .select('posted_at')
      .eq('decision_type', 'reply')
      .eq('status', 'posted')
      .order('posted_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error || !data) {
      // No previous replies or error - allow
      return { canReply: true, minutesSinceLast: 999 };
    }
    
    const lastReplyTime = new Date(String(data.posted_at));
    const now = new Date();
    const minutesSinceLast = (now.getTime() - lastReplyTime.getTime()) / (1000 * 60);
    
    const canReply = minutesSinceLast >= REPLY_CONFIG.MIN_MINUTES_BETWEEN;
    const minutesUntilNext = canReply ? 0 : REPLY_CONFIG.MIN_MINUTES_BETWEEN - minutesSinceLast;
    
    return {
      canReply,
      minutesSinceLast: Math.floor(minutesSinceLast),
      minutesUntilNext: Math.ceil(minutesUntilNext),
      lastReplyTime
    };
    
  } catch (error) {
    console.error('[TIME_BETWEEN] ❌ Check failed:', error);
    return { canReply: true, minutesSinceLast: 999 };
  }
}

export async function generateReplies(): Promise<void> {
  ReplyDiagnosticLogger.logCycleStart();
  
  // ===========================================================
  // STEP 1: CHECK ALL RATE LIMITS
  // ===========================================================
  
  // Check 1: Hourly quota
  const hourlyCheck = await checkReplyHourlyQuota();
  if (!hourlyCheck.canReply) {
    const nextAvailable = new Date(Date.now() + (hourlyCheck.minutesUntilNext || 0) * 60 * 1000);
    ReplyDiagnosticLogger.logBlocked('Hourly quota exceeded', nextAvailable);
    ReplyDiagnosticLogger.logCycleEnd(false, ['Hourly quota exceeded']);
    return;
  }
  
  // Check 2: Daily quota
  const dailyCheck = await checkReplyDailyQuota();
  if (!dailyCheck.canReply) {
    ReplyDiagnosticLogger.logBlocked('Daily quota exceeded', dailyCheck.resetTime);
    ReplyDiagnosticLogger.logCycleEnd(false, ['Daily quota exceeded']);
    return;
  }
  
  // Check 3: Time between replies
  const timeCheck = await checkTimeBetweenReplies();
  if (!timeCheck.canReply) {
    const nextAvailable = new Date(Date.now() + (timeCheck.minutesUntilNext || 0) * 60 * 1000);
    ReplyDiagnosticLogger.logBlocked('Too soon since last reply', nextAvailable);
    ReplyDiagnosticLogger.logCycleEnd(false, ['Too soon since last reply']);
    return;
  }
  
  // Log quota status
  ReplyDiagnosticLogger.logQuotaStatus({
    quota_hourly: {
      used: hourlyCheck.repliesThisHour,
      limit: REPLY_CONFIG.MAX_REPLIES_PER_HOUR,
      available: REPLY_CONFIG.MAX_REPLIES_PER_HOUR - hourlyCheck.repliesThisHour
    },
    quota_daily: {
      used: dailyCheck.repliesToday,
      limit: REPLY_CONFIG.MAX_REPLIES_PER_DAY,
      available: REPLY_CONFIG.MAX_REPLIES_PER_DAY - dailyCheck.repliesToday
    },
    time_since_last: {
      minutes: timeCheck.minutesSinceLast,
      required: REPLY_CONFIG.MIN_MINUTES_BETWEEN,
      can_post: timeCheck.canReply
    }
  });
  
  // ===========================================================
  // STEP 2: PROCEED WITH GENERATION
  // ===========================================================
  
  console.log('[REPLY_JOB] 🎯 All rate limits passed - proceeding with generation');
  
  const config = getConfig();
  
  try {
    if (config.MODE === 'shadow') {
      await generateSyntheticReplies();
    } else {
      await generateRealReplies();
    }
    console.log('[REPLY_JOB] ✅ Reply generation completed');
    ReplyDiagnosticLogger.logCycleEnd(true);
  } catch (error: any) {
    console.error('[REPLY_JOB] ❌ Reply generation failed:', error.message);
    ReplyDiagnosticLogger.logCycleEnd(false, [error.message]);
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
  
  // 🚀 SMART OPPORTUNITY SELECTION (tier-based, not replied to, not expired)
  console.log('[REPLY_JOB] 🔍 Selecting best reply opportunities (tier-based prioritization)...');
  const supabaseClient = getSupabaseClient();
  
  // Query ALL active opportunities (not replied to, not expired)
  const { data: allOpportunities, error: oppError } = await supabaseClient
    .from('reply_opportunities')
    .select('*')
    .eq('replied_to', false)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(100); // Get pool of 100 to filter from
  
  if (oppError) {
    console.error('[REPLY_JOB] ❌ Failed to query opportunities:', oppError.message);
    return;
  }
  
  if (!allOpportunities || allOpportunities.length === 0) {
    console.log('[REPLY_JOB] ⚠️ No opportunities in pool, waiting for harvester...');
    return;
  }
  
  // Log tier breakdown
  const golden = allOpportunities.filter(o => o.tier === 'golden').length;
  const good = allOpportunities.filter(o => o.tier === 'good').length;
  const acceptable = allOpportunities.filter(o => o.tier === 'acceptable').length;
  
  console.log(`[REPLY_JOB] 📊 Opportunity pool: ${allOpportunities.length} total`);
  console.log(`[REPLY_JOB]   🏆 GOLDEN: ${golden} (0.3%+ eng, <90min, <8 replies)`);
  console.log(`[REPLY_JOB]   ✅ GOOD: ${good} (0.15%+ eng, <240min, <15 replies)`);
  console.log(`[REPLY_JOB]   📊 ACCEPTABLE: ${acceptable} (0.08%+ eng, <720min, <25 replies)`);
  
  // SMART SELECTION: Prioritize by tier → ABSOLUTE likes → comments → engagement rate
  const sortedOpportunities = [...allOpportunities].sort((a, b) => {
    // Tier priority: golden > good > acceptable > null
    const tierOrder: Record<string, number> = { golden: 3, good: 2, acceptable: 1 };
    const aTier = tierOrder[String(a.tier || '')] || 0;
    const bTier = tierOrder[String(b.tier || '')] || 0;
    if (aTier !== bTier) return bTier - aTier; // Higher tier first
    
    // Within same tier, prioritize by ABSOLUTE engagement (10K likes beats 300 likes!)
    const aLikes = Number(a.like_count) || 0;
    const bLikes = Number(b.like_count) || 0;
    if (aLikes !== bLikes) return bLikes - aLikes; // More likes first
    
    // Then by comments
    const aComments = Number(a.reply_count) || 0;
    const bComments = Number(b.reply_count) || 0;
    if (aComments !== bComments) return bComments - aComments;
    
    // Finally, by engagement rate (for ties)
    return (Number(b.engagement_rate) || 0) - (Number(a.engagement_rate) || 0);
  });
  
  // 🚨 CRITICAL FIX: Check for TWEET IDs we've already replied to (not just usernames!)
  // This prevents multiple replies to the same tweet
  const { data: alreadyRepliedTweets } = await supabaseClient
    .from('content_metadata')
    .select('target_tweet_id')
    .eq('decision_type', 'reply')
    .in('status', ['posted', 'queued', 'ready']); // Check all stages
  
  const repliedTweetIds = new Set(
    (alreadyRepliedTweets || [])
      .map(r => r.target_tweet_id)
      .filter(id => id) // Filter out nulls
  );
  
  console.log(`[REPLY_JOB] 🔒 Already replied to ${repliedTweetIds.size} unique tweets`);
  
  // Filter out tweets we've already replied to
  const dbOpportunities = sortedOpportunities
    .filter(opp => {
      // Must have valid tweet ID
      if (!opp.target_tweet_id) {
        console.log(`[REPLY_JOB] ⚠️ Skipping opportunity with NULL tweet_id from @${opp.target_username}`);
        return false;
      }
      // Must not have replied already
      if (repliedTweetIds.has(opp.target_tweet_id)) {
        console.log(`[REPLY_JOB] ⏭️ Already replied to tweet ${opp.target_tweet_id} from @${opp.target_username}`);
        return false;
      }
      return true;
    })
    .slice(0, 10); // Top 10 opportunities
  
  if (dbOpportunities.length === 0) {
    console.log('[REPLY_JOB] ⚠️ No new opportunities (all recently replied)');
    return;
  }
  
  const selectedGolden = dbOpportunities.filter(o => o.tier === 'golden').length;
  const selectedGood = dbOpportunities.filter(o => o.tier === 'good').length;
  const selectedAcceptable = dbOpportunities.filter(o => o.tier === 'acceptable').length;
  
  console.log(`[REPLY_JOB] 🎯 Selected ${dbOpportunities.length} best opportunities:`);
  console.log(`[REPLY_JOB]   🏆 ${selectedGolden} golden, ✅ ${selectedGood} good, 📊 ${selectedAcceptable} acceptable`);
  console.log(`[REPLY_JOB]   Filtered out ${recentlyRepliedAccounts.size} recently replied accounts`);
  
  // Convert to the format expected by strategic reply system
  const opportunities = dbOpportunities.map((opp: any) => ({
    target: {
      username: String(opp.target_username || 'unknown'),
      followers: Number(opp.target_followers) || 50000,
      follower_overlap_score: 0.5,
      reply_window: 'early' as const,
      rising_potential: 0.7,
      conversion_potential: Number(opp.opportunity_score || 0) / 100,
      times_replied: 0,
      avg_engagement_on_replies: 0,
      avg_followers_gained: 0,
      actual_conversion_rate: 0,
      priority_score: Number(opp.opportunity_score || 0),
      handle: `@${String(opp.target_username || 'unknown')}`,
      engagement_rate: 0.05
    },
    tweet_url: String(opp.target_tweet_url || ''),
    tweet_content: String(opp.target_tweet_content || ''), // ✅ FIX: Use actual tweet content from DB!
    tweet_posted_at: opp.tweet_posted_at,
    minutes_since_post: Number(opp.posted_minutes_ago) || 0,
    reply_strategy: 'Add value with research or insights',
    estimated_followers: Math.round((Number(opp.opportunity_score || 0) / 100) * 10)
  }));
  
  console.log(`[REPLY_JOB] ✅ Found ${opportunities.length} reply opportunities from database pool`);
  
  // Batch size from config (prevents bursts)
  const replyCount = Math.min(REPLY_CONFIG.BATCH_SIZE, opportunities.length);
  console.log(`[REPLY_JOB] 🎯 Generating ${replyCount} replies (batch size: ${REPLY_CONFIG.BATCH_SIZE})`);
  
  if (replyCount === 0) {
    console.log('[REPLY_JOB] ⚠️ No opportunities available to generate replies for');
    return;
  }
  
  for (let i = 0; i < opportunities.slice(0, replyCount).length; i++) {
    const opportunity = opportunities[i];
    const target = {
      account: {
        username: opportunity.target.username,
        category: 'health',
        followers: opportunity.target.followers,
        engagement_velocity: 'high' as const
      },
      tweet_url: opportunity.tweet_url || '',
      tweet_content: opportunity.tweet_content || '', // ✅ FIX: Pass actual tweet content to AI!
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
      
      // Extract tweet ID from URL
      const tweetUrlStr = String(target.tweet_url || '');
      const tweetIdFromUrl = tweetUrlStr.split('/').pop() || 'unknown';
      
      const reply = {
        decision_id,
        content: strategicReply.content,
        target_username: target.account.username,
        target_tweet_id: tweetIdFromUrl,
        target_tweet_content: target.tweet_content,
        generator_used: replyGenerator,
        estimated_reach: target.estimated_reach,
        scheduled_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 min from now
      };
      
      // Calculate stagger delay (5 min base + 10 min per reply)
      // Reply 0: 5min, Reply 1: 15min, Reply 2: 25min, etc.
      const staggerDelay = REPLY_CONFIG.STAGGER_BASE_MIN + (i * REPLY_CONFIG.STAGGER_INCREMENT_MIN);
      
      // Queue for posting with stagger
      await queueReply(reply, staggerDelay);
      
      console.log(`[REPLY_JOB] ✅ Reply queued (#${i+1}/${replyCount}):`);
      console.log(`  • Target: @${target.account.username}`);
      console.log(`  • Followers: ${target.account.followers.toLocaleString()}`);
      console.log(`  • Estimated reach: ${target.estimated_reach.toLocaleString()}`);
      console.log(`  • Generator: ${replyGenerator}`);
      console.log(`  • Scheduled in: ${staggerDelay} minutes`);
      console.log(`  • Content preview: "${strategicReply.content.substring(0, 60)}..."`);
      
      // Mark opportunity as replied in database
      await supabaseClient
        .from('reply_opportunities')
        .update({ 
          replied_to: true,
          reply_decision_id: decision_id,
          status: 'replied'
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

/**
 * Queue a reply for posting
 * @param reply Reply data
 * @param delayMinutes Optional delay before posting (for staggering)
 */
async function queueReply(reply: any, delayMinutes: number = 5): Promise<void> {
  const supabase = getSupabaseClient();
  
  // Calculate scheduled time with stagger delay
  const scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000);
  
  const { data, error } = await supabase.from('content_metadata').insert([{
    decision_id: reply.decision_id,
    decision_type: 'reply',
    content: reply.content,
    generation_source: 'strategic_multi_generator',
    status: 'queued',
    scheduled_at: scheduledAt.toISOString(), // Use calculated time
    quality_score: reply.quality_score || 0.85,
    predicted_er: reply.predicted_er || 0.028,
    topic_cluster: reply.topic || 'health',
    target_tweet_id: reply.target_tweet_id,
    target_username: reply.target_username,
    generator_name: reply.generator_used || 'unknown',
    bandit_arm: `strategic_reply_${reply.generator_used || 'unknown'}`,
    created_at: new Date().toISOString()
  }]);
  
  if (error) {
    console.error('[REPLY_JOB] ❌ Failed to queue reply:', error.message);
    throw error;
  }
  
  console.log(`[REPLY_JOB] 💾 Reply queued: ${reply.decision_id}`);
  console.log(`[REPLY_JOB] ⏰ Scheduled for: ${scheduledAt.toLocaleString()} (in ${delayMinutes} min)`);
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