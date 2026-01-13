/**
 * 🎓 POLICY UPDATER
 * 
 * Daily job that reads reward_24h outcomes and updates policy weights in control_plane_state.
 * Updates:
 * - template_weights (per template_id)
 * - prompt_version_weights (per template)
 * - acceptance_threshold adjustments (small deltas)
 * - exploration_rate (keep 5-15%)
 */

import { getSupabaseClient } from '../../db';

interface PolicyUpdate {
  template_weights?: Record<string, number>;
  prompt_version_weights?: Record<string, Record<string, number>>;
  acceptance_threshold_delta?: number;
  exploration_rate?: number;
}

interface OutcomeStats {
  template_id: string | null;
  prompt_version: string | null;
  count: number;
  avg_reward: number;
  total_reward: number;
}

/**
 * Run daily policy update
 */
export async function runPolicyUpdate(dryRun: boolean = false): Promise<{
  updated: boolean;
  before: any;
  after: any;
  stats: {
    outcomes_analyzed: number;
    templates_updated: number;
    threshold_delta: number;
  };
}> {
  const supabase = getSupabaseClient();
  console.log(`[POLICY_UPDATER] 🎓 Starting policy update (dry_run=${dryRun})...`);
  
  // Get last 7 days of outcomes with reward_24h
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  
  const { data: outcomes, error } = await supabase
    .from('reply_decisions')
    .select('template_id, prompt_version, reward_24h, candidate_features')
    .eq('decision', 'ALLOW')
    .not('reward_24h', 'is', null)
    .gte('engaged_at', sevenDaysAgo)
    .order('engaged_at', { ascending: false });
  
  if (error) {
    console.error(`[POLICY_UPDATER] ❌ Error fetching outcomes: ${error.message}`);
    throw error;
  }
  
  if (!outcomes || outcomes.length === 0) {
    console.log(`[POLICY_UPDATER] ⚠️ No outcomes found in last 7 days`);
    return {
      updated: false,
      before: null,
      after: null,
      stats: {
        outcomes_analyzed: 0,
        templates_updated: 0,
        threshold_delta: 0,
      },
    };
  }
  
  console.log(`[POLICY_UPDATER] 📊 Analyzing ${outcomes.length} outcomes...`);
  
  // Group by template_id and prompt_version
  const templateStats: Record<string, OutcomeStats> = {};
  const promptStats: Record<string, Record<string, OutcomeStats>> = {};
  
  for (const outcome of outcomes) {
    const templateId = outcome.template_id || 'unknown';
    const promptVersion = outcome.prompt_version || 'v1';
    const reward = outcome.reward_24h || 0;
    
    // Template stats
    if (!templateStats[templateId]) {
      templateStats[templateId] = {
        template_id: templateId,
        prompt_version: null,
        count: 0,
        avg_reward: 0,
        total_reward: 0,
      };
    }
    templateStats[templateId].count++;
    templateStats[templateId].total_reward += reward;
    templateStats[templateId].avg_reward = templateStats[templateId].total_reward / templateStats[templateId].count;
    
    // Prompt version stats (nested under template)
    if (!promptStats[templateId]) {
      promptStats[templateId] = {};
    }
    if (!promptStats[templateId][promptVersion]) {
      promptStats[templateId][promptVersion] = {
        template_id: templateId,
        prompt_version: promptVersion,
        count: 0,
        avg_reward: 0,
        total_reward: 0,
      };
    }
    promptStats[templateId][promptVersion].count++;
    promptStats[templateId][promptVersion].total_reward += reward;
    promptStats[templateId][promptVersion].avg_reward = promptStats[templateId][promptVersion].total_reward / promptStats[templateId][promptVersion].count;
  }
  
  // Compute template weights (normalized by average reward)
  const avgRewardAll = outcomes.reduce((sum, o) => sum + (o.reward_24h || 0), 0) / outcomes.length;
  const templateWeights: Record<string, number> = {};
  
  for (const [templateId, stats] of Object.entries(templateStats)) {
    // Weight = relative performance vs average (bounded 0.5x to 2x)
    const relativePerf = stats.avg_reward / Math.max(avgRewardAll, 0.1);
    templateWeights[templateId] = Math.max(0.5, Math.min(2.0, relativePerf));
  }
  
  // Normalize weights to sum to number of templates
  const totalWeight = Object.values(templateWeights).reduce((sum, w) => sum + w, 0);
  const numTemplates = Object.keys(templateWeights).length;
  if (totalWeight > 0 && numTemplates > 0) {
    const normalizationFactor = numTemplates / totalWeight;
    for (const key in templateWeights) {
      templateWeights[key] *= normalizationFactor;
    }
  }
  
  // Compute prompt_version_weights (per template)
  const promptVersionWeights: Record<string, Record<string, number>> = {};
  for (const [templateId, versions] of Object.entries(promptStats)) {
    const templateAvg = templateStats[templateId]?.avg_reward || avgRewardAll;
    promptVersionWeights[templateId] = {};
    
    for (const [version, stats] of Object.entries(versions)) {
      const relativePerf = stats.avg_reward / Math.max(templateAvg, 0.1);
      promptVersionWeights[templateId][version] = Math.max(0.5, Math.min(2.0, relativePerf));
    }
    
    // Normalize per template
    const totalVersionWeight = Object.values(promptVersionWeights[templateId]).reduce((sum, w) => sum + w, 0);
    const numVersions = Object.keys(promptVersionWeights[templateId]).length;
    if (totalVersionWeight > 0 && numVersions > 0) {
      const normalizationFactor = numVersions / totalVersionWeight;
      for (const key in promptVersionWeights[templateId]) {
        promptVersionWeights[templateId][key] *= normalizationFactor;
      }
    }
  }
  
  // Compute acceptance_threshold delta (small adjustment based on overall performance)
  // If avg reward is high, slightly increase threshold; if low, slightly decrease
  const thresholdDelta = avgRewardAll > 10 ? 0.01 : (avgRewardAll < 5 ? -0.01 : 0);
  
  // Get current control_plane_state
  const { data: currentState } = await supabase
    .from('control_plane_state')
    .select('*')
    .is('expires_at', null)
    .order('effective_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  const beforeState = currentState ? {
    acceptance_threshold: currentState.acceptance_threshold,
    exploration_rate: currentState.exploration_rate,
    template_weights: currentState.template_weights || {},
    prompt_version_weights: currentState.prompt_version_weights || {},
  } : null;
  
  // Compute new state
  const newAcceptanceThreshold = currentState 
    ? Math.max(0.3, Math.min(0.9, (currentState.acceptance_threshold || 0.6) + thresholdDelta))
    : 0.6;
  
  const newExplorationRate = Math.max(0.05, Math.min(0.15, currentState?.exploration_rate || 0.10));
  
  // Merge template weights (keep existing, update with new)
  const mergedTemplateWeights = { ...(currentState?.template_weights || {}), ...templateWeights };
  
  // Merge prompt version weights
  const mergedPromptVersionWeights: Record<string, Record<string, number>> = { ...(currentState?.prompt_version_weights || {}) };
  for (const [templateId, versions] of Object.entries(promptVersionWeights)) {
    if (!mergedPromptVersionWeights[templateId]) {
      mergedPromptVersionWeights[templateId] = {};
    }
    mergedPromptVersionWeights[templateId] = { ...mergedPromptVersionWeights[templateId], ...versions };
  }
  
  const afterState = {
    acceptance_threshold: newAcceptanceThreshold,
    exploration_rate: newExplorationRate,
    template_weights: mergedTemplateWeights,
    prompt_version_weights: mergedPromptVersionWeights,
  };
  
  console.log(`[POLICY_UPDATER] 📊 Computed updates:`);
  console.log(`  Template weights: ${JSON.stringify(templateWeights)}`);
  console.log(`  Acceptance threshold delta: ${thresholdDelta.toFixed(3)}`);
  console.log(`  New acceptance threshold: ${newAcceptanceThreshold.toFixed(3)}`);
  
  if (dryRun) {
    console.log(`[POLICY_UPDATER] 🔍 DRY RUN - would update policy`);
    return {
      updated: false,
      before: beforeState,
      after: afterState,
      stats: {
        outcomes_analyzed: outcomes.length,
        templates_updated: Object.keys(templateWeights).length,
        threshold_delta: thresholdDelta,
      },
    };
  }
  
  // Update control_plane_state
  const now = new Date();
  
  // Expire old state
  if (currentState) {
    await supabase
      .from('control_plane_state')
      .update({ expires_at: now.toISOString() })
      .eq('id', currentState.id);
  }
  
  // Insert new state
  const { error: insertError } = await supabase
    .from('control_plane_state')
    .insert({
      effective_at: now.toISOString(),
      feed_weights: currentState?.feed_weights || { curated_accounts: 0.5, keyword_search: 0.3, viral_watcher: 0.2 },
      acceptance_threshold: newAcceptanceThreshold,
      exploration_rate: newExplorationRate,
      shortlist_size: currentState?.shortlist_size || 25,
      budget_caps: currentState?.budget_caps || { hourly_max: 5.00, daily_max: 50.00, per_reply_max: 0.10 },
      model_preferences: currentState?.model_preferences || { default: 'gpt-4o-mini', fallback: 'gpt-4o-mini' },
      template_weights: mergedTemplateWeights,
      prompt_version_weights: mergedPromptVersionWeights,
      updated_by: 'policy_updater',
      update_reason: `Policy update from ${outcomes.length} outcomes (avg_reward=${avgRewardAll.toFixed(2)})`,
    });
  
  if (insertError) {
    console.error(`[POLICY_UPDATER] ❌ Failed to update policy: ${insertError.message}`);
    throw insertError;
  }
  
  // Log policy update event
  await supabase.from('system_events').insert({
    event_type: 'policy_update',
    metadata: {
      before: beforeState,
      after: afterState,
      outcomes_analyzed: outcomes.length,
      templates_updated: Object.keys(templateWeights).length,
      threshold_delta: thresholdDelta,
      avg_reward: avgRewardAll,
    },
    created_at: now.toISOString(),
  }).catch(err => {
    console.warn(`[POLICY_UPDATER] ⚠️ Failed to log event: ${err.message}`);
  });
  
  console.log(`[POLICY_UPDATER] ✅ Policy updated successfully`);
  
  return {
    updated: true,
    before: beforeState,
    after: afterState,
    stats: {
      outcomes_analyzed: outcomes.length,
      templates_updated: Object.keys(templateWeights).length,
      threshold_delta: thresholdDelta,
    },
  };
}
