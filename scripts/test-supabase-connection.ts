#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';

console.log('🔍 TESTING SUPABASE CONNECTION FROM RAILWAY\n');

async function test() {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    console.log('Environment check:');
    console.log('  SUPABASE_URL:', url ? 'SET (' + url.length + ' chars)' : 'MISSING');
    console.log('  SUPABASE_SERVICE_ROLE_KEY:', key ? 'SET (' + key.length + ' chars)' : 'MISSING');
    console.log('');
    
    if (!url || !key) {
      console.log('❌ CRITICAL: Supabase credentials missing in Railway environment!');
      console.log('This is why all saves are failing!\n');
      process.exit(1);
    }
    
    const supabase = createClient(url, key);
    
    // Test 1: Simple read
    console.log('Test 1: Reading from content_metadata...');
    const { data: testRead, error: readError } = await supabase
      .from('content_metadata')
      .select('decision_id')
      .limit(1);
    
    if (readError) {
      console.log('❌ READ FAILED:', readError.message);
    } else {
      console.log('✅ READ SUCCESS\n');
    }
    
    // Test 2: Write to post_receipts
    console.log('Test 2: Writing to post_receipts...');
    const testReceipt = {
      decision_id: null,  // Orphan test
      tweet_ids: ['test_' + Date.now()],
      root_tweet_id: 'test_' + Date.now(),
      post_type: 'single',
      posted_at: new Date().toISOString(),
      parent_tweet_id: null,
      metadata: { test: true },
      receipt_created_at: new Date().toISOString()
    };
    
    const { data: writeData, error: writeError } = await supabase
      .from('post_receipts')
      .insert(testReceipt)
      .select('receipt_id')
      .single();
    
    if (writeError) {
      console.log('❌ WRITE FAILED:', writeError.message);
      console.log('Error code:', writeError.code);
      console.log('Error details:', JSON.stringify(writeError, null, 2));
    } else {
      console.log('✅ WRITE SUCCESS, receipt_id:', writeData.receipt_id);
      // Clean up
      await supabase.from('post_receipts').delete().eq('receipt_id', writeData.receipt_id);
      console.log('✅ Cleanup complete\n');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🎯 CONCLUSION:\n');
    if (!writeError && !readError) {
      console.log('   ✅ Supabase connection working from Railway');
      console.log('   ✅ Can read and write successfully');
      console.log('   ⚠️  Issue must be in runtime posting code path\n');
    } else {
      console.log('   ❌ Supabase connection has issues');
      console.log('   ❌ This explains why saves are failing\n');
    }
    
  } catch (err: any) {
    console.error('❌ TEST EXCEPTION:', err.message);
    console.error(err.stack);
  }
}

test();

