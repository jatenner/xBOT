#!/usr/bin/env tsx
/**
 * 🧪 CREATE TEST THREAD
 * 
 * Creates a controlled test thread decision (2-4 parts) with strong health content
 * that passes all existing gates, scheduled_at=now for immediate posting.
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { v4 as uuidv4 } from 'uuid';

async function main() {
  const supabase = getSupabaseClient();
  const now = new Date();
  
  // Generate a 3-part thread with strong health content
  const threadParts = [
    "Research reveals that combining resistance training with zone 2 cardio (60-70% max heart rate) creates a powerful synergy for metabolic health. The key is sequencing: strength first, then cardio.",
    "Why this order matters: Resistance training depletes glycogen stores, forcing your body to burn fat during the subsequent cardio session. This dual-stimulus approach improves insulin sensitivity more than either alone.",
    "Practical protocol: 3-4 strength exercises (20-30 min), followed by 20-30 minutes of zone 2 cardio. Do this 3x per week. Track heart rate variability to ensure recovery between sessions."
  ];
  
  // Verify each part is <= 270 chars
  threadParts.forEach((part, i) => {
    if (part.length > 270) {
      throw new Error(`Thread part ${i + 1} exceeds 270 chars: ${part.length}`);
    }
  });
  
  const decisionId = uuidv4();
  
  console.log(`🧪 Creating test thread decision...`);
  console.log(`   Decision ID: ${decisionId}`);
  console.log(`   Parts: ${threadParts.length}`);
  console.log(`   Total chars: ${threadParts.reduce((sum, p) => sum + p.length, 0)}`);
  
  // Check if threads are enabled
  if (process.env.THREADS_ENABLED === 'false') {
    console.log(`⚠️  THREADS_ENABLED=false, creating single post instead...`);
    
    // Create single post from first thread part
    const { error: insertError } = await supabase
      .from('content_metadata')
      .insert({
        decision_id: decisionId,
        decision_type: 'single',
        content: threadParts[0],
        status: 'queued',
        scheduled_at: now.toISOString(),
        generation_source: 'real',
        raw_topic: 'health_optimization',
        angle: 'practical_application',
        tone: 'educational',
        generator_name: 'teacher',
        format_strategy: 'direct_value',
        quality_score: 0.85,
        predicted_er: 0.045,
        bandit_arm: 'educational',
        topic_cluster: 'health_optimization',
        pipeline_source: 'test_thread_creation',
        features: {
          test_decision: true,
          original_thread_parts: threadParts.length,
          created_at: now.toISOString(),
        }
      });
    
    if (insertError) {
      console.error(`❌ Failed to create test single: ${insertError.message}`);
      process.exit(1);
    }
    
    console.log(`✅ Test single created: decision_id=${decisionId}`);
    console.log(`   Content: ${threadParts[0].substring(0, 100)}...`);
    return;
  }
  
  // Create thread decision
  const { error: insertError } = await supabase
    .from('content_metadata')
    .insert({
      decision_id: decisionId,
      decision_type: 'thread',
      content: threadParts[0], // First part as main content
      thread_parts: threadParts,
      status: 'queued',
      scheduled_at: now.toISOString(),
      generation_source: 'real',
      raw_topic: 'health_optimization',
      angle: 'practical_application',
      tone: 'educational',
      generator_name: 'teacher',
      format_strategy: 'progressive_reveal',
      quality_score: 0.85,
      predicted_er: 0.045,
      bandit_arm: 'educational',
      topic_cluster: 'health_optimization',
      pipeline_source: 'test_thread_creation',
      features: {
        test_decision: true,
        thread_parts_count: threadParts.length,
        created_at: now.toISOString(),
      }
    });
  
  if (insertError) {
    console.error(`❌ Failed to create test thread: ${insertError.message}`);
    process.exit(1);
  }
  
  console.log(`✅ Test thread created: decision_id=${decisionId}`);
  console.log(`   Parts: ${threadParts.length}`);
  console.log(`   Scheduled: ${now.toISOString()}`);
  console.log(`   Status: queued`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
