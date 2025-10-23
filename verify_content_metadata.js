#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

// Use Supabase client directly
const { createClient } = require('@supabase/supabase-js');

async function verifyContentMetadata() {
  console.log('🔍 Verifying content_metadata table...');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Check if table exists by trying to query it
    const { data, error } = await supabase
      .from('content_metadata')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ content_metadata table does not exist or is not accessible:', error.message);
      return;
    }
    
    console.log('✅ content_metadata table exists and is accessible!');
    
    // Get table info
    const { count, error: countError } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Could not count rows:', countError.message);
    } else {
      console.log(`📊 Total content in content_metadata: ${count}`);
    }
    
    // Check for queued replies
    const { data: queuedReplies, error: replyError } = await supabase
      .from('content_metadata')
      .select('*')
      .eq('decision_type', 'reply')
      .is('posted_at', null)
      .limit(5);
    
    if (replyError) {
      console.error('❌ Could not query queued replies:', replyError.message);
    } else {
      console.log(`📊 Queued replies: ${queuedReplies.length}`);
      if (queuedReplies.length > 0) {
        console.log('📊 Recent queued replies:');
        queuedReplies.forEach((reply, i) => {
          console.log(`  ${i + 1}. ${reply.content?.substring(0, 60)}...`);
          console.log(`     Generator: ${reply.generator_used || 'N/A'}`);
          console.log(`     Target: ${reply.target_tweet_id || 'N/A'}`);
        });
      }
    }
    
    console.log('✅ content_metadata table verification completed!');
    console.log('🎉 Your reply system should now work properly!');
    
  } catch (error) {
    console.error('❌ Verification error:', error.message);
  }
}

verifyContentMetadata().catch(console.error);
