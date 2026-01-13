/**
 * 🎨 REPLY TEMPLATE SELECTOR
 * 
 * Selects reply template based on topic, score, and exploration
 */

import { getSupabaseClient } from '../../db';

export interface TemplateSelection {
  template_id: string;
  prompt_version: string;
  template_name: string;
  selection_reason: string;
}

export interface TemplateContext {
  topic_relevance_score: number;
  candidate_score: number;
  topic?: string;
  content_preview?: string;
}

// Cache for control plane state (5 minute TTL)
let cachedPolicy: { state: any; expiresAt: number } | null = null;
const POLICY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get current policy from control_plane_state (cached)
 */
async function getCurrentPolicy(): Promise<any> {
  const now = Date.now();
  
  // Return cached if valid
  if (cachedPolicy && cachedPolicy.expiresAt > now) {
    return cachedPolicy.state;
  }
  
  const supabase = getSupabaseClient();
  const { data: currentState } = await supabase
    .from('control_plane_state')
    .select('*')
    .is('expires_at', null)
    .order('effective_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  // Cache for 5 minutes
  cachedPolicy = {
    state: currentState,
    expiresAt: now + POLICY_CACHE_TTL,
  };
  
  return currentState;
}

/**
 * Select reply template based on context
 */
export async function selectReplyTemplate(
  context: TemplateContext
): Promise<TemplateSelection> {
  const supabase = getSupabaseClient();
  
  // Get current policy
  const policy = await getCurrentPolicy();
  const templateWeights = policy?.template_weights || {};
  const promptVersionWeights = policy?.prompt_version_weights || {};
  const explorationRate = policy?.exploration_rate || 0.10;
  const policyVersion = policy?.id || 'none';
  
  // Get available templates
  const { data: templates, error } = await supabase
    .from('reply_templates')
    .select('*')
    .order('priority_weight', { ascending: false });
  
  if (error) {
    const errorMsg = `TEMPLATE_SELECTION_FAILED_DB_ERROR: ${error.message}`;
    console.error(`[TEMPLATE_SELECTOR] ❌ Database error: ${error.message}`);
    throw new Error(errorMsg);
  }
  
  if (!templates || templates.length === 0) {
    const errorMsg = 'TEMPLATE_SELECTION_FAILED_NO_TEMPLATES';
    console.error(`[TEMPLATE_SELECTOR] ❌ No templates found in reply_templates table`);
    throw new Error(errorMsg);
  }
  
  // Calculate selection weights (combine policy weights with context-based boosts)
  const weightedTemplates = templates.map(template => {
    // Start with policy weight if available, else use priority_weight
    let weight = templateWeights[template.id] || template.priority_weight || 1.0;
    
    // Apply context-based boosts (smaller than before, policy is primary)
    if (context.topic_relevance_score >= 0.8) {
      if (template.id === 'explanation' || template.id === 'clarification') {
        weight *= 1.1; // Smaller boost
      }
    } else if (context.topic_relevance_score >= 0.6) {
      if (template.id === 'actionable' || template.id === 'question') {
        weight *= 1.05; // Smaller boost
      }
    }
    
    if (context.candidate_score >= 70) {
      if (template.id === 'explanation' || template.id === 'clarification') {
        weight *= 1.05; // Smaller boost
      }
    } else if (context.candidate_score >= 50) {
      if (template.id === 'actionable' || template.id === 'question') {
        weight *= 1.05; // Smaller boost
      }
    }
    
    return { ...template, calculated_weight: weight };
  });
  
  // Check exploration rate from policy
  const shouldExplore = Math.random() < explorationRate;
  
  let selectedTemplate;
  let selectedPromptVersion = 'v1';
  
  if (shouldExplore && templates.length > 1) {
    // Exploration: randomly select from top 3 templates
    const topTemplates = weightedTemplates
      .sort((a, b) => b.calculated_weight - a.calculated_weight)
      .slice(0, 3);
    const randomIndex = Math.floor(Math.random() * topTemplates.length);
    selectedTemplate = topTemplates[randomIndex];
    
    // Select prompt version from policy if available
    const templateVersions = promptVersionWeights[selectedTemplate.id];
    if (templateVersions && Object.keys(templateVersions).length > 0) {
      const versions = Object.entries(templateVersions);
      const totalWeight = versions.reduce((sum, [, w]) => sum + (w as number), 0);
      let random = Math.random() * totalWeight;
      for (const [version, weight] of versions) {
        random -= weight as number;
        if (random <= 0) {
          selectedPromptVersion = version;
          break;
        }
      }
    }
    
    console.log(`[TEMPLATE_SELECTOR] 🎲 Exploration mode: selected ${selectedTemplate.id} (policy_version=${policyVersion}, prompt=${selectedPromptVersion})`);
  } else {
    // Exploitation: select highest weighted template
    selectedTemplate = weightedTemplates.reduce((best, current) =>
      current.calculated_weight > best.calculated_weight ? current : best
    );
    
    // Select prompt version from policy if available
    const templateVersions = promptVersionWeights[selectedTemplate.id];
    if (templateVersions && Object.keys(templateVersions).length > 0) {
      // Select highest weighted version
      const versions = Object.entries(templateVersions);
      const bestVersion = versions.reduce((best, current) =>
        (current[1] as number) > (best[1] as number) ? current : best
      );
      selectedPromptVersion = bestVersion[0];
    }
    
    console.log(`[TEMPLATE_SELECTOR] 🎯 Exploitation mode: selected ${selectedTemplate.id} (weight=${selectedTemplate.calculated_weight.toFixed(2)}, policy_version=${policyVersion}, prompt=${selectedPromptVersion})`);
  }
  
  // Log policy usage for proof
  const policyUsed = policy ? {
    policy_id: policy.id,
    policy_effective_at: policy.effective_at,
    template_weights_used: templateWeights,
    exploration_rate_used: explorationRate,
  } : null;
  
  console.log(`[TEMPLATE_SELECTOR] 📋 Policy used: ${JSON.stringify(policyUsed)}`);
  
  return {
    template_id: selectedTemplate.id,
    prompt_version: selectedPromptVersion,
    template_name: selectedTemplate.name,
    selection_reason: shouldExplore ? `exploration_policy_v${policyVersion}` : `weighted_selection_policy_v${policyVersion}`,
  };
}

/**
 * Get template prompt structure
 */
export async function getTemplatePrompt(templateId: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  
  const { data: template } = await supabase
    .from('reply_templates')
    .select('prompt_template')
    .eq('id', templateId)
    .single();
  
  return template?.prompt_template || null;
}
