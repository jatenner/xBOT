/**
 * 🎯 GROWTH CONTROLLER - Policy Enforcement
 * 
 * Provides functions to get active growth plans and enforce policy.
 * Used by postingQueue and reply orchestrator when GROWTH_CONTROLLER_ENABLED=true.
 */

import 'dotenv/config';
import { getSupabaseClient } from '../db/index';

export interface GrowthPlan {
  plan_id: string;
  window_start: string;
  window_end: string;
  target_posts: number;
  target_replies: number;
  feed_weights: {
    curated_accounts: number;
    keyword_search: number;
    viral_watcher: number;
    discovered_accounts: number;
  };
  strategy_weights: {
    topics: Array<{ topic: string; weight: number }>;
    formats: Array<{ format: string; weight: number }>;
    generators: Array<{ generator: string; weight: number }>;
    reply_styles?: Array<{ style: string; weight: number }>;
  };
  exploration_rate: number;
  reason_summary: string;
  resistance_backoff_applied: boolean;
  backoff_reason?: string;
}

export interface GrowthExecution {
  plan_id: string;
  posts_done: number;
  replies_done: number;
  last_updated: string;
}

/**
 * Get active growth plan for current hour
 */
export async function getActiveGrowthPlan(): Promise<GrowthPlan | null> {
  const enabled = process.env.GROWTH_CONTROLLER_ENABLED === 'true';
  if (!enabled) {
    return null; // Controller disabled, use defaults
  }
  
  const supabase = getSupabaseClient();
  const now = new Date();
  
  // Find plan for current hour window
  const { data: plan, error } = await supabase
    .from('growth_plans')
    .select('*')
    .lte('window_start', now.toISOString())
    .gte('window_end', now.toISOString())
    .order('window_start', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (error) {
    console.error(`[GROWTH_CONTROLLER] ❌ Error fetching active plan: ${error.message}`);
    return null; // Fail-closed: if we can't get plan, don't enforce
  }
  
  if (!plan) {
    console.warn(`[GROWTH_CONTROLLER] ⚠️ No active plan found for current hour, using defaults`);
    return null;
  }
  
  return plan as GrowthPlan;
}

/**
 * Get execution counters for a plan
 */
export async function getGrowthExecution(planId: string): Promise<GrowthExecution | null> {
  const supabase = getSupabaseClient();
  
  const { data: execution, error } = await supabase
    .from('growth_execution')
    .select('*')
    .eq('plan_id', planId)
    .maybeSingle();
  
  if (error) {
    console.error(`[GROWTH_CONTROLLER] ❌ Error fetching execution: ${error.message}`);
    return null;
  }
  
  if (!execution) {
    // Initialize execution record
    const { data: newExecution, error: insertError } = await supabase
      .from('growth_execution')
      .insert({
        plan_id: planId,
        posts_done: 0,
        replies_done: 0,
      })
      .select()
      .single();
    
    if (insertError) {
      console.error(`[GROWTH_CONTROLLER] ❌ Error initializing execution: ${insertError.message}`);
      return null;
    }
    
    return newExecution as GrowthExecution;
  }
  
  return execution as GrowthExecution;
}

/**
 * Check if we can post (enforce plan limit)
 */
export async function canPost(decisionType: 'single' | 'thread' | 'reply'): Promise<{
  allowed: boolean;
  reason: string;
  plan?: GrowthPlan;
  execution?: GrowthExecution;
}> {
  const plan = await getActiveGrowthPlan();
  
  if (!plan) {
    // No plan = controller disabled or no plan found, allow (use defaults)
    return { allowed: true, reason: 'No active plan, using defaults' };
  }
  
  const execution = await getGrowthExecution(plan.plan_id);
  if (!execution) {
    return { allowed: false, reason: 'Failed to get execution counters', plan };
  }
  
  // Check limits based on decision type
  if (decisionType === 'reply') {
    if (execution.replies_done >= plan.target_replies) {
      return {
        allowed: false,
        reason: `Reply limit reached: ${execution.replies_done}/${plan.target_replies}`,
        plan,
        execution,
      };
    }
  } else {
    // single or thread
    if (execution.posts_done >= plan.target_posts) {
      return {
        allowed: false,
        reason: `Post limit reached: ${execution.posts_done}/${plan.target_posts}`,
        plan,
        execution,
      };
    }
  }
  
  return { allowed: true, reason: 'Within plan limits', plan, execution };
}

/**
 * Record a post/reply (idempotent increment)
 */
export async function recordPost(planId: string, decisionType: 'single' | 'thread' | 'reply'): Promise<void> {
  const supabase = getSupabaseClient();
  
  const postsDelta = decisionType === 'reply' ? 0 : 1;
  const repliesDelta = decisionType === 'reply' ? 1 : 0;
  
  // Use idempotent increment function
  const { error } = await supabase.rpc('increment_growth_execution', {
    p_plan_id: planId,
    p_posts_delta: postsDelta,
    p_replies_delta: repliesDelta,
  });
  
  if (error) {
    console.error(`[GROWTH_CONTROLLER] ❌ Error recording post: ${error.message}`);
    // Don't throw - logging is best effort
  } else {
    console.log(`[GROWTH_CONTROLLER] ✅ Recorded ${decisionType}: plan_id=${planId}`);
  }
}

/**
 * Get feed weights from active plan (or defaults)
 */
export async function getFeedWeights(): Promise<{
  curated_accounts: number;
  keyword_search: number;
  viral_watcher: number;
  discovered_accounts: number;
}> {
  const plan = await getActiveGrowthPlan();
  
  if (plan && plan.feed_weights) {
    return plan.feed_weights;
  }
  
  // Defaults (fallback)
  return {
    curated_accounts: 0.35,
    keyword_search: 0.30,
    viral_watcher: 0.20,
    discovered_accounts: 0.15,
  };
}

/**
 * Get strategy weights from active plan (or defaults)
 */
export async function getStrategyWeights(): Promise<{
  topics: Array<{ topic: string; weight: number }>;
  formats: Array<{ format: string; weight: number }>;
  generators: Array<{ generator: string; weight: number }>;
}> {
  const plan = await getActiveGrowthPlan();
  
  if (plan && plan.strategy_weights) {
    return {
      topics: plan.strategy_weights.topics || [],
      formats: plan.strategy_weights.formats || [],
      generators: plan.strategy_weights.generators || [],
    };
  }
  
  // Defaults (empty = no preference)
  return {
    topics: [],
    formats: [],
    generators: [],
  };
}
