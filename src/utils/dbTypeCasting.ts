/**
 * Quick fix for TypeScript database type issues
 * This file provides utility functions to properly cast database results
 */

export function castToHookDNA(data: any[]): any[] {
  return data?.map(item => ({
    hook_id: item.hook_id || '',
    hook_text: item.hook_text || '',
    hook_category: item.hook_category || 'contrarian',
    engagement_gene: Number(item.engagement_gene) || 0.5,
    viral_gene: Number(item.viral_gene) || 0.5,
    follower_gene: Number(item.follower_gene) || 0.5,
    authority_gene: Number(item.authority_gene) || 0.5,
    word_count: Number(item.word_count) || 0,
    has_statistics: Boolean(item.has_statistics),
    has_controversy: Boolean(item.has_controversy),
    has_question: Boolean(item.has_question),
    has_emotional_trigger: Boolean(item.has_emotional_trigger),
    generation: Number(item.generation) || 0,
    parent_hooks: Array.isArray(item.parent_hooks) ? item.parent_hooks : [],
    mutation_rate: Number(item.mutation_rate) || 0.1,
    times_used: Number(item.times_used) || 0,
    avg_engagement_rate: Number(item.avg_engagement_rate) || 0,
    avg_viral_coefficient: Number(item.avg_viral_coefficient) || 0,
    avg_followers_gained: Number(item.avg_followers_gained) || 0,
    success_rate: Number(item.success_rate) || 0.5,
    best_topics: Array.isArray(item.best_topics) ? item.best_topics : [],
    best_audiences: Array.isArray(item.best_audiences) ? item.best_audiences : [],
    optimal_timing: item.optimal_timing || {},
    created_at: item.created_at || new Date().toISOString(),
    last_used: item.last_used,
    last_evolved: item.last_evolved
  })) || [];
}

export function castToViralPattern(data: any[]): any[] {
  return data?.map(item => ({
    pattern_id: item.pattern_id || '',
    name: item.name || '',
    description: item.description || '',
    hook_template: item.hook_template || '',
    content_flow: Array.isArray(item.content_flow) ? item.content_flow : [],
    evidence_requirements: Array.isArray(item.evidence_requirements) ? item.evidence_requirements : [],
    engagement_triggers: Array.isArray(item.engagement_triggers) ? item.engagement_triggers : [],
    viral_success_rate: Number(item.viral_success_rate) || 0,
    avg_follower_conversion: Number(item.avg_follower_conversion) || 0,
    avg_engagement_multiplier: Number(item.avg_engagement_multiplier) || 1,
    avg_viral_coefficient: Number(item.avg_viral_coefficient) || 0,
    sample_size: Number(item.sample_size) || 0,
    confidence_score: Number(item.confidence_score) || 0.5,
    last_updated: item.last_updated || new Date().toISOString(),
    discovery_method: item.discovery_method || 'manual',
    best_topics: Array.isArray(item.best_topics) ? item.best_topics : [],
    optimal_timing: item.optimal_timing || {},
    target_audiences: Array.isArray(item.target_audiences) ? item.target_audiences : [],
    avoid_conditions: Array.isArray(item.avoid_conditions) ? item.avoid_conditions : []
  })) || [];
}

export function castToEnhancedPerformanceData(data: any[]): any[] {
  return data?.map(item => ({
    post_id: item.post_id || '',
    timestamp: item.timestamp || new Date().toISOString(),
    engagement_rate: Number(item.engagement_rate) || 0,
    likes: Number(item.likes) || 0,
    retweets: Number(item.retweets) || 0,
    replies: Number(item.replies) || 0,
    saves: Number(item.saves) || 0,
    follower_growth: Number(item.follower_growth) || 0,
    time_to_peak_engagement: Number(item.time_to_peak_engagement),
    engagement_decay_rate: Number(item.engagement_decay_rate),
    audience_retention: Number(item.audience_retention),
    viral_coefficient: Number(item.viral_coefficient),
    reply_sentiment: item.reply_sentiment || 'neutral',
    topic_saturation_effect: Number(item.topic_saturation_effect)
  })) || [];
}
