/**
 * 🔍 EXPLORATION WRAPPER
 * Wraps content generation to apply exploration mode dynamically
 * ENFORCES topic diversity to prevent repetition
 */

import { ContentOrchestrator, type OrchestratedContent } from './contentOrchestrator';
import { getCurrentMode, getModeStatus } from '../exploration/explorationModeManager';
import { getVarietyRecommendation } from '../exploration/coldStartOptimizer';
import { getSupabaseClient } from '../db/index';

/**
 * Get recent topics from last 10 posts to avoid repetition
 */
async function getRecentTopics(): Promise<string[]> {
  try {
    const supabase = getSupabaseClient();
    
    const { data } = await supabase
      .from('content_metadata')
      .select('content, topic_cluster')
      .eq('status', 'posted')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (!data) return [];
    
    // Extract topics/keywords from recent posts
    const topics: string[] = [];
    for (const post of data) {
      if (post.topic_cluster) {
        topics.push(String(post.topic_cluster).toLowerCase());
      }
      // Also extract key words from content
      const content = String(post.content || '').toLowerCase();
      if (content.includes('sleep')) topics.push('sleep');
      if (content.includes('vitamin')) topics.push('vitamins');
      if (content.includes('exercise') || content.includes('workout')) topics.push('exercise');
      if (content.includes('diet') || content.includes('nutrition')) topics.push('nutrition');
      if (content.includes('mental') || content.includes('stress')) topics.push('mental health');
      if (content.includes('meditation') || content.includes('mindfulness')) topics.push('meditation');
    }
    
    return [...new Set(topics)]; // Remove duplicates
  } catch (error: any) {
    console.warn('[EXPLORATION_WRAPPER] ⚠️ Failed to fetch recent topics:', error.message);
    return [];
  }
}

/**
 * Force a DIFFERENT topic than recent posts
 */
function selectDiverseTopic(recentTopics: string[]): string {
  const allTopics = [
    'gut microbiome', 'longevity science', 'metabolic health', 'hormone optimization',
    'biohacking protocols', 'circadian biology', 'exercise physiology', 'nutritional biochemistry',
    'cognitive enhancement', 'stress physiology', 'immune system', 'inflammation science',
    'autophagy', 'mitochondrial health', 'epigenetics', 'neuroscience',
    'cold exposure', 'heat therapy', 'fasting biology', 'supplement science',
    'medical controversies', 'health myths debunked', 'emerging research',
    'preventive medicine', 'functional medicine', 'integrative health'
  ];
  
  // Filter out recently used topics
  const availableTopics = allTopics.filter(topic => {
    return !recentTopics.some(recent => 
      topic.includes(recent) || recent.includes(topic.split(' ')[0])
    );
  });
  
  if (availableTopics.length === 0) {
    console.log('[EXPLORATION_WRAPPER] ⚠️ All topics recently used, using full list');
    return allTopics[Math.floor(Math.random() * allTopics.length)];
  }
  
  // Return a random available topic
  return availableTopics[Math.floor(Math.random() * availableTopics.length)];
}

export async function generateWithExplorationMode(params?: {
  topicHint?: string;
  formatHint?: 'single' | 'thread';
}): Promise<OrchestratedContent> {
  
  const mode = await getCurrentMode();
  const status = await getModeStatus();
  
  console.log(`[EXPLORATION_WRAPPER] 🔍 Mode: ${mode}`);
  console.log(`[EXPLORATION_WRAPPER] 👥 Current followers: ${status.currentFollowers}`);
  console.log(`[EXPLORATION_WRAPPER] 📊 Avg engagement: ${status.avgEngagement.toFixed(2)}`);
  console.log(`[EXPLORATION_WRAPPER] 💡 Reason: ${status.reason}`);
  
  // 🚨 ANTI-REPETITION: Get recent topics to avoid
  const recentTopics = await getRecentTopics();
  console.log(`[EXPLORATION_WRAPPER] 🚫 Recent topics to avoid: ${recentTopics.slice(0, 5).join(', ')}`);
  
  if (mode === 'exploration') {
    // Get variety recommendation
    const recommendation = await getVarietyRecommendation();
    console.log(`[EXPLORATION_WRAPPER] 🎲 Forcing variety: ${recommendation.recommendedType} @ controversy ${recommendation.controversyLevel}`);
    console.log(`[EXPLORATION_WRAPPER] 📝 Reason: ${recommendation.reason}`);
    
    // 🚨 FORCE A DIFFERENT TOPIC - Override any topic hint
    const diverseTopic = selectDiverseTopic(recentTopics);
    params = {
      ...params,
      topicHint: diverseTopic // Force diverse topic
    };
    
    console.log(`[EXPLORATION_WRAPPER] 🎯 FORCING DIVERSE TOPIC: "${diverseTopic}"`);
  } else {
    // Even in exploitation mode, avoid exact repetition
    if (recentTopics.length > 0) {
      const diverseTopic = selectDiverseTopic(recentTopics);
      console.log(`[EXPLORATION_WRAPPER] 🔄 Suggesting diverse topic: "${diverseTopic}"`);
      params = {
        ...params,
        topicHint: params?.topicHint || diverseTopic
      };
    }
  }
  
  // Generate content using normal orchestrator
  const orchestrator = ContentOrchestrator.getInstance();
  const content = await orchestrator.generateContent(params);
  
  // Log what was generated
  console.log(`[EXPLORATION_WRAPPER] ✅ Generated ${content.format} using: ${content.metadata.generator_used}`);
  console.log(`[EXPLORATION_WRAPPER] 🎯 Topic: ${params?.topicHint || 'default'}`);
  console.log(`[EXPLORATION_WRAPPER] 🎯 Viral score: ${content.metadata.viral_score || 'N/A'}`);
  console.log(`[EXPLORATION_WRAPPER] ⭐ Quality score: ${content.metadata.quality_score || 'N/A'}`);
  
  return content;
}

