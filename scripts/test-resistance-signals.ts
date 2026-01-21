#!/usr/bin/env tsx
/**
 * 🧪 TEST RESISTANCE SIGNALS
 * 
 * Simulates platform resistance signals (CONSENT_WALL, POST_FAIL) for testing backoff logic.
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🧪 SIMULATING PLATFORM RESISTANCE SIGNALS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const signalType = process.argv[2] || 'CONSENT_WALL'; // CONSENT_WALL, POST_FAILED, or CHALLENGE
  const count = parseInt(process.argv[3] || '6', 10); // Number of events to create
  
  console.log(`📊 Signal type: ${signalType}`);
  console.log(`📊 Count: ${count} events\n`);
  
  // Insert mock events spread over last hour
  const now = new Date();
  const events = [];
  
  for (let i = 0; i < count; i++) {
    const eventTime = new Date(now.getTime() - i * 10 * 60 * 1000); // 10 minutes apart
    
    let message = '';
    let eventData: any = { test: true, simulated: true };
    
    if (signalType === 'CONSENT_WALL') {
      message = `Test: Consent wall blocked feed fetch (simulated)`;
      eventData = { ...eventData, attempts: 3, selector: 'none' };
    } else if (signalType === 'POST_FAILED') {
      message = `Test: Post failed (simulated)`;
      eventData = { ...eventData, pipeline_error_reason: 'TEST_SIMULATION' };
    } else if (signalType === 'CHALLENGE') {
      message = `Test: Platform challenge detected (simulated)`;
      eventData = { ...eventData, challenge_type: 'test' };
    }
    
    events.push({
      event_type: signalType,
      severity: signalType === 'POST_FAILED' ? 'error' : 'warning',
      message,
      event_data: eventData,
      created_at: eventTime.toISOString(),
    });
  }
  
  console.log(`📝 Inserting ${events.length} mock events...`);
  
  const { error } = await supabase.from('system_events').insert(events);
  
  if (error) {
    console.error(`\n❌ Failed to insert events: ${error.message}`);
    process.exit(1);
  }
  
  console.log(`✅ Inserted ${events.length} mock ${signalType} events`);
  console.log(`\n💡 Next steps:`);
  console.log(`   1. Run: pnpm run runner:shadow-controller-once`);
  console.log(`   2. Check plan: SELECT resistance_backoff_applied, backoff_reason FROM growth_plans ORDER BY window_start DESC LIMIT 1;`);
  console.log(`   3. Expected: resistance_backoff_applied = true`);
  console.log(`\n🧹 To cleanup test events:`);
  console.log(`   DELETE FROM system_events WHERE event_data->>'simulated' = 'true';`);
  
  process.exit(0);
}

main().catch(console.error);
