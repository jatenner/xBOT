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

/**
 * Select reply template based on context
 */
export async function selectReplyTemplate(
  context: TemplateContext
): Promise<TemplateSelection> {
  const supabase = getSupabaseClient();
  
  // Get available templates
  const { data: templates, error } = await supabase
    .from('reply_templates')
    .select('*')
    .order('priority_weight', { ascending: false });
  
  if (error || !templates || templates.length === 0) {
    console.warn(`[TEMPLATE_SELECTOR] ⚠️ No templates found, using default`);
    return {
      template_id: 'explanation',
      prompt_version: 'v1',
      template_name: 'Explanation',
      selection_reason: 'default_fallback',
    };
  }
  
  // Calculate selection weights
  const weightedTemplates = templates.map(template => {
    let weight = template.priority_weight || 1.0;
    
    // Boost templates based on topic relevance
    if (context.topic_relevance_score >= 0.8) {
      // High relevance: prefer explanation/clarification
      if (template.id === 'explanation' || template.id === 'clarification') {
        weight *= 1.2;
      }
    } else if (context.topic_relevance_score >= 0.6) {
      // Medium relevance: prefer actionable/question
      if (template.id === 'actionable' || template.id === 'question') {
        weight *= 1.15;
      }
    }
    
    // Boost based on candidate score (higher score = more confident templates)
    if (context.candidate_score >= 70) {
      // High score: prefer explanation/clarification (more authoritative)
      if (template.id === 'explanation' || template.id === 'clarification') {
        weight *= 1.1;
      }
    } else if (context.candidate_score >= 50) {
      // Medium score: prefer actionable/question (more engaging)
      if (template.id === 'actionable' || template.id === 'question') {
        weight *= 1.1;
      }
    }
    
    return { ...template, calculated_weight: weight };
  });
  
  // Check exploration rate (try different template occasionally)
  const explorationRate = templates[0]?.exploration_rate || 0.1;
  const shouldExplore = Math.random() < explorationRate;
  
  let selectedTemplate;
  if (shouldExplore && templates.length > 1) {
    // Exploration: randomly select from top 3 templates
    const topTemplates = weightedTemplates
      .sort((a, b) => b.calculated_weight - a.calculated_weight)
      .slice(0, 3);
    const randomIndex = Math.floor(Math.random() * topTemplates.length);
    selectedTemplate = topTemplates[randomIndex];
    console.log(`[TEMPLATE_SELECTOR] 🎲 Exploration mode: selected ${selectedTemplate.id} (random from top 3)`);
  } else {
    // Exploitation: select highest weighted template
    selectedTemplate = weightedTemplates.reduce((best, current) =>
      current.calculated_weight > best.calculated_weight ? current : best
    );
    console.log(`[TEMPLATE_SELECTOR] 🎯 Exploitation mode: selected ${selectedTemplate.id} (weight=${selectedTemplate.calculated_weight.toFixed(2)})`);
  }
  
  return {
    template_id: selectedTemplate.id,
    prompt_version: 'v1', // TODO: Track prompt versions
    template_name: selectedTemplate.name,
    selection_reason: shouldExplore ? 'exploration' : 'weighted_selection',
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
