/**
 * 📝 PLAN JOB
 * Handles content planning on timer intervals
 */

import { getConfig, getModeFlags } from '../config/config';

export async function planContent(): Promise<void> {
  const config = getConfig();
  const flags = getModeFlags(config);
  
  console.log('[PLAN_JOB] 📝 Starting content planning cycle...');
  
  try {
    if (flags.useSyntheticGeneration) {
      // Shadow mode: generate mock content
      await generateSyntheticContent();
    } else {
      // Live mode: use real LLM
      await generateRealContent();
    }
    
    console.log('[PLAN_JOB] ✅ Content planning completed');
  } catch (error) {
    console.error('[PLAN_JOB] ❌ Planning failed:', error.message);
    throw error;
  }
}

async function generateSyntheticContent(): Promise<void> {
  console.log('[PLAN_JOB] 🎭 Generating synthetic content for shadow mode...');
  
  // Mock content generation with realistic timing
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const mockContent = [
    {
      content: "Health tip: Stay hydrated! Your body needs water for optimal function.",
      quality: 0.82,
      predicted_er: 0.034,
      format: "educational",
      timestamp: new Date().toISOString()
    },
    {
      content: "Did you know? Regular sleep schedules can improve your immune system significantly.",
      quality: 0.91,
      predicted_er: 0.041,
      format: "fact_sharing",
      timestamp: new Date().toISOString()
    },
    {
      content: "Mental health matters: Take 5 minutes today for mindful breathing exercises.",
      quality: 0.88,
      predicted_er: 0.037,
      format: "wellness_tip",
      timestamp: new Date().toISOString()
    }
  ];
  
  for (const content of mockContent) {
    console.log(`[PLAN_JOB] ✨ Generated: "${content.content.substring(0, 50)}..."`);
    console.log(`[PLAN_JOB]    Quality: ${content.quality}, Predicted ER: ${content.predicted_er}`);
  }
  
  console.log(`[PLAN_JOB] 📊 Generated ${mockContent.length} synthetic content items`);
}

async function generateRealContent(): Promise<void> {
  console.log('[PLAN_JOB] 🧠 Generating real content using LLM...');
  
  // TODO: Implement real LLM content generation
  // This would use the OpenAI budgeted client
  console.log('[PLAN_JOB] 🚧 Real LLM generation not yet implemented');
  
  // For now, use synthetic content even in live mode
  await generateSyntheticContent();
}
