/**
 * 🔍 EXPLORATION WRAPPER
 * Wraps content generation to apply exploration mode dynamically
 * ENFORCES topic diversity to prevent repetition
 * 
 * NOW USING: Intelligent multi-pass AI system for better content
 */

import { ContentOrchestrator, type OrchestratedContent } from './contentOrchestrator';
import { getIntelligentOrchestrator, type IntelligentOrchestratedContent } from './intelligentOrchestrator';
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
 * Generate a DIVERSE topic using AI (UNLIMITED topics, not hardcoded)
 */
async function generateDiverseTopic(recentTopics: string[]): Promise<string> {
  try {
    // Use the DynamicTopicGenerator to create unlimited unique topics
    const { DynamicTopicGenerator } = await import('../intelligence/dynamicTopicGenerator');
    const topicGenerator = DynamicTopicGenerator.getInstance();
    
    console.log('[EXPLORATION_WRAPPER] 🤖 Generating AI-driven diverse topic...');
    
    const dynamicTopic = await topicGenerator.generateTopic({
      recentTopics,
      preferTrending: false // Prefer unique, not trending
    });
    
    console.log(`[EXPLORATION_WRAPPER] ✅ AI generated topic: "${dynamicTopic.topic}"`);
    console.log(`[EXPLORATION_WRAPPER] 🎯 Angle: ${dynamicTopic.angle}`);
    console.log(`[EXPLORATION_WRAPPER] 🔥 Viral potential: ${dynamicTopic.viral_potential}`);
    
    return dynamicTopic.topic;
    
  } catch (error: any) {
    console.error('[EXPLORATION_WRAPPER] ⚠️ AI topic generation failed:', error.message);
    // Fallback: return a generic prompt that forces OpenAI to be creative
    return 'Generate a completely unique health topic that has NOT been discussed recently';
  }
}

export async function generateWithExplorationMode(params?: {
  topicHint?: string;
  formatHint?: 'single' | 'thread';
}): Promise<OrchestratedContent | IntelligentOrchestratedContent> {
  
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
    
    // 🚨 FORCE A DIFFERENT TOPIC - AI GENERATED (UNLIMITED)
    const diverseTopic = await generateDiverseTopic(recentTopics);
    params = {
      ...params,
      topicHint: diverseTopic // Force AI-generated diverse topic
    };
    
    console.log(`[EXPLORATION_WRAPPER] 🎯 FORCING AI-GENERATED DIVERSE TOPIC: "${diverseTopic}"`);
  } else {
    // Even in exploitation mode, avoid exact repetition with AI topics
    if (recentTopics.length > 0) {
      const diverseTopic = await generateDiverseTopic(recentTopics);
      console.log(`[EXPLORATION_WRAPPER] 🔄 Suggesting AI-generated diverse topic: "${diverseTopic}"`);
      params = {
        ...params,
        topicHint: params?.topicHint || diverseTopic
      };
    }
  }
  
  // 🚀 USE INTELLIGENT ORCHESTRATOR (Multi-pass AI system)
  console.log('[EXPLORATION_WRAPPER] 🧠 Using Intelligent Multi-Pass AI Engine...');
  
  try {
    const intelligentOrchestrator = getIntelligentOrchestrator();
    const content = await intelligentOrchestrator.generateIntelligentContent(params);
    
    // Log what was generated
    console.log(`[EXPLORATION_WRAPPER] ✅ Generated ${content.format} using: ${content.metadata.generator_used}`);
    console.log(`[EXPLORATION_WRAPPER] 🎯 Topic: ${content.metadata.topic}`);
    console.log(`[EXPLORATION_WRAPPER] 🎯 Angle: ${content.metadata.angle}`);
    console.log(`[EXPLORATION_WRAPPER] 🎯 Viral score: ${content.metadata.viralScore}`);
    console.log(`[EXPLORATION_WRAPPER] ⭐ Quality score: ${content.metadata.qualityScore}/10`);
    console.log(`[EXPLORATION_WRAPPER] 🔄 AI iterations: ${content.metadata.aiIterations}`);
    
    return content;
  } catch (error: any) {
    console.error('[EXPLORATION_WRAPPER] ❌ Intelligent engine failed:', error.message);
    console.log('[EXPLORATION_WRAPPER] 🔄 Falling back to traditional orchestrator...');
    
    // Fallback to old orchestrator if intelligent fails
    const orchestrator = ContentOrchestrator.getInstance();
    const content = await orchestrator.generateContent(params);
    
    console.log(`[EXPLORATION_WRAPPER] ✅ Generated ${content.format} using fallback`);
    
    return content;
  }
}

