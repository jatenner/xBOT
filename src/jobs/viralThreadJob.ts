/**
 * 🔥 VIRAL THREAD JOB
 * 
 * Weekly attempts at creating viral threads
 * Goal: 1-2 threads per week optimized for maximum shares/reach
 */

import { v4 as uuidv4 } from 'uuid';
import { getConfig } from '../config/config';
import { isLLMAllowed } from '../config/envFlags';
import { getSupabaseClient } from '../db/index';
import generateViralThread from '../generators/viralThreadGenerator';

export async function runViralThreadJob(): Promise<void> {
  const config = getConfig();
  console.log('[VIRAL_THREAD_JOB] 🔥 Starting viral thread generation...');

  const llmCheck = isLLMAllowed();
  if (!llmCheck.allowed) {
    console.log(`[VIRAL_THREAD_JOB] ⏭️ LLM blocked: ${llmCheck.reason}`);
    return;
  }

  try {
    // Generate viral thread
    const viralThread = await generateViralThread({
      // Let it pick randomly for variety
    });

    if (viralThread.viral_score < 65) {
      console.log(`[VIRAL_THREAD_JOB] ⚠️ Viral score too low (${viralThread.viral_score}), skipping`);
      return;
    }

    const decision_id = uuidv4();
    const supabase = getSupabaseClient();

    // Schedule for posting (immediate - viral threads should go out fast)
    const scheduledTime = new Date(Date.now() + 5 * 60 * 1000); // 5 min from now

    // Store in content_metadata
    const { error } = await supabase
      .from('content_metadata')
      .insert({
        decision_id,
        decision_type: 'content',
        content: viralThread.content.join('\n\n'), // Join for storage
        bandit_arm: `viral_thread_${viralThread.hook_type}`,
        timing_arm: 'viral_immediate',
        scheduled_at: scheduledTime.toISOString(),
        quality_score: viralThread.viral_score / 100,
        predicted_er: 0.1, // Viral threads should get 10%+ engagement
        topic_cluster: 'viral_attempt',
        generation_source: 'viral_generator',
        status: 'queued',
        features: {
          thread_tweets: viralThread.content,
          viral_thread: true,
          hook_type: viralThread.hook_type,
          viral_score: viralThread.viral_score,
          is_daily_thread: true
        }
      });

    if (error) {
      console.error('[VIRAL_THREAD_JOB] ❌ Failed to store viral thread:', error.message);
      return;
    }

    // Track attempt
    await supabase
      .from('viral_thread_attempts')
      .insert({
        post_id: decision_id,
        hook_type: viralThread.hook_type,
        target_emotion: viralThread.metadata.has_controversy ? 'anger' : 'curiosity',
        viral_score: viralThread.viral_score,
        thread_length: viralThread.content.length
      });

    console.log(`[VIRAL_THREAD_JOB] ✅ Viral thread queued: score=${viralThread.viral_score}, hook=${viralThread.hook_type}`);
    console.log(`[VIRAL_THREAD_JOB] 🎯 Preview: "${viralThread.content[0].substring(0, 80)}..."`);

  } catch (error: any) {
    console.error('[VIRAL_THREAD_JOB] ❌ Viral thread generation failed:', error.message);
  }
}

export default runViralThreadJob;

