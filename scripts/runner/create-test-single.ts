#!/usr/bin/env tsx
/**
 * 🧪 CREATE TEST SINGLE POST
 * 
 * Creates a controlled test single post decision with strong health content
 * that passes all existing gates, scheduled_at=now for immediate posting.
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { v4 as uuidv4 } from 'uuid';

async function main() {
  const supabase = getSupabaseClient();
  const now = new Date();
  const decisionId = uuidv4();
  
  const content = 'Research shows that combining resistance training with zone 2 cardio (60-70% max heart rate) creates a powerful synergy for metabolic health. The key is sequencing: strength first, then cardio.';
  
  console.log(`🧪 Creating test single post decision...`);
  console.log(`   Decision ID: ${decisionId}`);
  console.log(`   Content length: ${content.length} chars`);
  console.log(`   Scheduled: ${now.toISOString()}`);
  
  const { error: insertError } = await supabase
    .from('content_metadata')
    .insert({
      decision_id: decisionId,
      decision_type: 'single',
      content: content,
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
      pipeline_source: 'manual_test',
      features: {
        test_decision: true,
        created_at: now.toISOString(),
        retry_count: 0,
      }
    });
  
  if (insertError) {
    console.error(`❌ Failed to create test single: ${insertError.message}`);
    process.exit(1);
  }
  
  console.log(`✅ Test single created: decision_id=${decisionId}`);
  console.log(`   Status: queued`);
  console.log(`   Scheduled: ${now.toISOString()}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
