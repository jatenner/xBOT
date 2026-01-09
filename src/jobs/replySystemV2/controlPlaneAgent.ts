/**
 * 🎛️ CONTROL PLANE AGENT
 * 
 * Hourly + Daily agent that reads system summaries and adjusts control plane state
 */

import { getSupabaseClient } from '../../db/index';
import { logLLMUsage, extractTokenUsage } from '../../services/llmCostLogger';
import { createBudgetedChatCompletion } from '../../services/openaiBudgetedClient';

export interface ControlPlaneState {
  feed_weights: Record<string, number>; // Normalized 0-1, sum to 1.0
  acceptance_threshold: number; // 0-1
  exploration_rate: number; // 0-1
  shortlist_size: number; // Integer
  budget_caps: {
    hourly_max: number;
    daily_max: number;
    per_reply_max: number;
  };
  model_preferences: {
    default: string;
    fallback: string;
  };
}

/**
 * Hourly control plane adjustment
 */
export async function runHourlyControlPlane(): Promise<void> {
  console.log('[CONTROL_PLANE] 🎛️ Running hourly adjustment...');
  
  const supabase = getSupabaseClient();
  const now = new Date();
  const hourStart = new Date(now);
  hourStart.setMinutes(0, 0, 0);
  
  // Read hourly summary
  const { data: hourlySummary } = await supabase
    .from('reply_system_summary_hourly')
    .select('*')
    .eq('hour_start', hourStart.toISOString())
    .single();
  
  // Read cost summary
  const { data: costSummary } = await supabase
    .from('llm_cost_summary_hourly')
    .select('*')
    .gte('hour_start', hourStart.toISOString())
    .lt('hour_start', new Date(hourStart.getTime() + 3600000).toISOString());
  
  // Read recent errors
  const { data: errors } = await supabase
    .from('system_events')
    .select('*')
    .gte('created_at', hourStart.toISOString())
    .in('severity', ['error', 'warning'])
    .limit(50);
  
  // Get current state
  const { data: currentState } = await supabase
    .from('control_plane_state')
    .select('*')
    .is('expires_at', null)
    .order('effective_at', { ascending: false })
    .limit(1)
    .single();
  
  // Build input data for LLM
  const inputData = {
    hourly_summary: hourlySummary || null,
    cost_summary: costSummary || [],
    errors: errors?.length || 0,
    current_state: currentState || null,
    timestamp: now.toISOString()
  };
  
  // Call LLM to generate new state
  const newState = await generateControlPlaneState(inputData, 'hourly');
  
  // Validate safety rails
  const validatedState = applySafetyRails(newState, currentState);
  
  // Expire old state
  if (currentState) {
    await supabase
      .from('control_plane_state')
      .update({ expires_at: now.toISOString() })
      .eq('id', currentState.id);
  }
  
  // Insert new state
  const { data: insertedState } = await supabase
    .from('control_plane_state')
    .insert({
      effective_at: now.toISOString(),
      feed_weights: validatedState.feed_weights,
      acceptance_threshold: validatedState.acceptance_threshold,
      exploration_rate: validatedState.exploration_rate,
      shortlist_size: validatedState.shortlist_size,
      budget_caps: validatedState.budget_caps,
      model_preferences: validatedState.model_preferences,
      updated_by: 'control_plane_agent',
      update_reason: 'hourly_adjustment'
    })
    .select()
    .single();
  
  // Log decision
  await supabase.from('control_plane_decisions').insert({
    decision_type: 'hourly_adjustment',
    decision_time: now.toISOString(),
    input_data: inputData,
    output_state: validatedState,
    reasoning: `Hourly adjustment based on summary and costs`
  });
  
  // Log to system_events
  await supabase.from('system_events').insert({
    event_type: 'control_plane_hourly_adjustment',
    severity: 'info',
    message: `Control plane adjusted: threshold=${validatedState.acceptance_threshold}, exploration=${validatedState.exploration_rate}`,
    event_data: {
      old_state: currentState,
      new_state: validatedState
    },
    created_at: now.toISOString()
  });
  
  console.log(`[CONTROL_PLANE] ✅ Hourly adjustment complete: threshold=${validatedState.acceptance_threshold}`);
}

/**
 * Daily control plane adjustment
 */
export async function runDailyControlPlane(): Promise<void> {
  console.log('[CONTROL_PLANE] 🎛️ Running daily adjustment...');
  
  const supabase = getSupabaseClient();
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  
  // Read daily summary
  const { data: dailySummary } = await supabase
    .from('reply_system_summary_daily')
    .select('*')
    .eq('date_start', dayStart.toISOString().split('T')[0])
    .single();
  
  // Read strategy performance (if available)
  // TODO: Add strategy performance tracking
  
  // Get current state
  const { data: currentState } = await supabase
    .from('control_plane_state')
    .select('*')
    .is('expires_at', null)
    .order('effective_at', { ascending: false })
    .limit(1)
    .single();
  
  // Build input data
  const inputData = {
    daily_summary: dailySummary || null,
    current_state: currentState || null,
    timestamp: now.toISOString()
  };
  
  // Generate new state (focus on strategy weights and account pruning)
  const newState = await generateControlPlaneState(inputData, 'daily');
  
  // Validate safety rails
  const validatedState = applySafetyRails(newState, currentState);
  
  // Expire old state
  if (currentState) {
    await supabase
      .from('control_plane_state')
      .update({ expires_at: now.toISOString() })
      .eq('id', currentState.id);
  }
  
  // Insert new state
  await supabase
    .from('control_plane_state')
    .insert({
      effective_at: now.toISOString(),
      feed_weights: validatedState.feed_weights,
      acceptance_threshold: validatedState.acceptance_threshold,
      exploration_rate: validatedState.exploration_rate,
      shortlist_size: validatedState.shortlist_size,
      budget_caps: validatedState.budget_caps,
      model_preferences: validatedState.model_preferences,
      updated_by: 'control_plane_agent',
      update_reason: 'daily_adjustment'
    });
  
  // Log decision
  await supabase.from('control_plane_decisions').insert({
    decision_type: 'daily_adjustment',
    decision_time: now.toISOString(),
    input_data: inputData,
    output_state: validatedState,
    reasoning: `Daily adjustment based on performance`
  });
  
  console.log(`[CONTROL_PLANE] ✅ Daily adjustment complete`);
}

/**
 * Generate control plane state using LLM
 */
async function generateControlPlaneState(
  inputData: any,
  adjustmentType: 'hourly' | 'daily'
): Promise<ControlPlaneState> {
  const prompt = `You are a Twitter engagement system control plane agent. Analyze the system performance and output optimal control parameters.

Input Data:
${JSON.stringify(inputData, null, 2)}

Return a JSON object with these exact fields:
{
  "feed_weights": {
    "curated_accounts": <0-1>,
    "keyword_search": <0-1>,
    "viral_watcher": <0-1>
  }, // Must sum to 1.0
  "acceptance_threshold": <0-1>, // Threshold for accepting candidates (0.4-0.8 range)
  "exploration_rate": <0-1>, // Probability of exploring borderline candidates (0.05-0.20 range)
  "shortlist_size": <integer>, // Max candidates in queue (15-50 range)
  "budget_caps": {
    "hourly_max": <number>, // USD per hour
    "daily_max": <number>, // USD per day
    "per_reply_max": <number> // USD per reply
  },
  "model_preferences": {
    "default": "<gpt-4o-mini|gpt-4o>",
    "fallback": "<gpt-4o-mini>"
  }
}

Guidelines:
- If queue is empty: lower acceptance_threshold, increase exploration_rate
- If costs are high: use gpt-4o-mini, reduce shortlist_size
- If performance is good: maintain or slightly increase threshold
- Feed weights: favor feeds with higher candidate throughput
- Never set acceptance_threshold < 0.3 or > 0.9
- Never set exploration_rate > 0.25

Return ONLY valid JSON, no markdown.`;

  const startTime = Date.now();
  
  try {
    const response = await createBudgetedChatCompletion(
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a control plane agent. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2, // Low temperature for consistent decisions
        max_tokens: 500,
        response_format: { type: 'json_object' }
      },
      {
        purpose: 'control_plane',
        requestId: `control_plane_${adjustmentType}_${Date.now()}`,
        priority: 'high'
      }
    );
    
    const latency_ms = Date.now() - startTime;
    const usage = extractTokenUsage(response);
    
    // Log LLM usage
    await logLLMUsage({
      model: 'gpt-4o-mini',
      purpose: 'control_plane',
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      latency_ms,
      trace_ids: {},
      request_metadata: { adjustment_type: adjustmentType }
    });
    
    // Parse response
    const content = response.choices[0]?.message?.content || '{}';
    const state = JSON.parse(content);
    
    // Normalize feed weights
    const totalWeight = Object.values(state.feed_weights || {}).reduce((sum: number, w: any) => sum + w, 0);
    if (totalWeight > 0) {
      Object.keys(state.feed_weights).forEach(key => {
        state.feed_weights[key] = state.feed_weights[key] / totalWeight;
      });
    }
    
    return state as ControlPlaneState;
    
  } catch (error: any) {
    console.error(`[CONTROL_PLANE] ❌ Error generating state: ${error.message}`);
    
    // Return safe defaults
    return {
      feed_weights: { curated_accounts: 0.5, keyword_search: 0.3, viral_watcher: 0.2 },
      acceptance_threshold: 0.60,
      exploration_rate: 0.10,
      shortlist_size: 25,
      budget_caps: { hourly_max: 5.00, daily_max: 50.00, per_reply_max: 0.10 },
      model_preferences: { default: 'gpt-4o-mini', fallback: 'gpt-4o-mini' }
    };
  }
}

/**
 * Apply safety rails to prevent unsafe state changes
 */
function applySafetyRails(
  newState: ControlPlaneState,
  currentState: any
): ControlPlaneState {
  // Never relax absolute filters (these are enforced in candidateScorer)
  // acceptance_threshold can be adjusted, but hard filters remain
  
  // Clamp acceptance_threshold
  newState.acceptance_threshold = Math.max(0.3, Math.min(0.9, newState.acceptance_threshold));
  
  // Clamp exploration_rate
  newState.exploration_rate = Math.max(0.05, Math.min(0.25, newState.exploration_rate));
  
  // Clamp shortlist_size
  newState.shortlist_size = Math.max(10, Math.min(50, newState.shortlist_size));
  
  // Ensure feed weights sum to 1.0
  const totalWeight = Object.values(newState.feed_weights).reduce((sum, w) => sum + w, 0);
  if (Math.abs(totalWeight - 1.0) > 0.01) {
    Object.keys(newState.feed_weights).forEach(key => {
      newState.feed_weights[key] = newState.feed_weights[key] / totalWeight;
    });
  }
  
  // Budget caps: never exceed current caps (only reduce)
  if (currentState?.budget_caps) {
    newState.budget_caps.hourly_max = Math.min(
      newState.budget_caps.hourly_max,
      currentState.budget_caps.hourly_max || 5.00
    );
    newState.budget_caps.daily_max = Math.min(
      newState.budget_caps.daily_max,
      currentState.budget_caps.daily_max || 50.00
    );
  }
  
  return newState;
}

