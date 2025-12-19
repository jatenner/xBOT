/**
 * Check Truth Integrity Schema Prerequisites
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function checkSchema() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  
  const supabase = createClient(url, key);
  
  console.log('Checking Truth Integrity Schema Prerequisites...\n');
  
  // Check system_events table
  console.log('1. Checking system_events table...');
  const { data: systemEventsCheck, error: se1 } = await supabase
    .from('system_events')
    .select('*')
    .limit(1);
  
  if (se1) {
    console.log(`   ❌ system_events table missing or inaccessible: ${se1.message}`);
  } else {
    console.log('   ✅ system_events table exists');
    
    // Check if we can query by component and event_type
    const { data: testQuery, error: se2 } = await supabase
      .from('system_events')
      .select('component, event_type, timestamp')
      .eq('component', 'truth_integrity')
      .limit(1);
    
    if (se2) {
      console.log(`   ⚠️  Query test failed: ${se2.message}`);
    } else {
      console.log('   ✅ Can query by component and event_type');
    }
  }
  
  // Check content_metadata table
  console.log('\n2. Checking content_metadata table...');
  const { data: cmCheck, error: cm1 } = await supabase
    .from('content_metadata')
    .select('decision_id, status, tweet_id, thread_tweet_ids')
    .limit(1);
  
  if (cm1) {
    console.log(`   ❌ content_metadata table missing or inaccessible: ${cm1.message}`);
  } else {
    console.log('   ✅ content_metadata table exists');
    
    // Check for reconciled_at column
    const { data: reconCheck, error: cm2 } = await supabase
      .from('content_metadata')
      .select('reconciled_at')
      .limit(1);
    
    if (cm2) {
      console.log('   ⚠️  reconciled_at column missing (optional, will add if needed)');
    } else {
      console.log('   ✅ reconciled_at column exists');
    }
  }
  
  // Check if we can write to system_events
  console.log('\n3. Testing system_events write access...');
  const { error: writeTest } = await supabase
    .from('system_events')
    .insert({
      component: 'truth_integrity_test',
      event_type: 'schema_check',
      severity: 'info',
      message: 'Schema check test',
      metadata: { test: true },
      timestamp: new Date().toISOString()
    });
  
  if (writeTest) {
    console.log(`   ❌ Cannot write to system_events: ${writeTest.message}`);
  } else {
    console.log('   ✅ Can write to system_events');
    
    // Clean up test entry
    await supabase
      .from('system_events')
      .delete()
      .eq('component', 'truth_integrity_test');
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('Schema check complete.');
  console.log('='.repeat(70));
}

checkSchema()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });

