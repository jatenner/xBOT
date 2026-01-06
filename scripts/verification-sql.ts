/**
 * Run verification SQL queries
 * Run: tsx scripts/verification-sql.ts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  console.log('🔍 VERIFICATION SQL QUERIES\n');
  console.log('═══════════════════════════════════════════════════════\n');
  
  // Query 1: Thread-like reply violations last 24h
  console.log('1) Thread-like reply violations last 24h:');
  const { data: threadViolations, error: err1 } = await supabase.rpc('exec_sql', {
    query: `
      SELECT COUNT(*) AS thread_like_reply_violations
      FROM content_generation_metadata_comprehensive
      WHERE status='posted' AND decision_type='reply'
        AND (content ~ '\\m\\d+/\\d+\\M' OR content LIKE '1/%' OR content LIKE '%🧵%' OR content LIKE E'%\\n%')
        AND posted_at > NOW()-INTERVAL '24 hours';
    `
  });
  
  if (err1) {
    // Try direct query instead
    const { data, error } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'posted')
      .eq('decision_type', 'reply')
      .gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    
    if (error) {
      console.error(`   ❌ Error: ${error.message}`);
    } else {
      // Filter in memory for thread markers
      const { data: allReplies } = await supabase
        .from('content_generation_metadata_comprehensive')
        .select('content')
        .eq('status', 'posted')
        .eq('decision_type', 'reply')
        .gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      
      if (allReplies) {
        const violations = allReplies.filter(r => {
          const content = r.content || '';
          return /\b\d+\/\d+\b/.test(content) || 
                 content.startsWith('1/') || 
                 content.includes('🧵') ||
                 content.includes('\n');
        });
        console.log(`   ✅ Result: ${violations.length} violations`);
      }
    }
  } else {
    console.log(`   ✅ Result: ${JSON.stringify(threadViolations)}`);
  }
  
  console.log('\n');
  
  // Query 2: Reply-to-reply target violations
  console.log('2) Reply-to-reply target violations last 24h:');
  const { data: targetViolations, error: err2 } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'posted')
    .eq('decision_type', 'reply')
    .gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  
  if (err2) {
    console.error(`   ❌ Error: ${err2.message}`);
  } else {
    // Get all replies and filter
    const { data: allReplies } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('target_in_reply_to_tweet_id, target_conversation_id, target_tweet_id')
      .eq('status', 'posted')
      .eq('decision_type', 'reply')
      .gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    
    if (allReplies) {
      const violations = allReplies.filter(r => 
        r.target_in_reply_to_tweet_id !== null ||
        (r.target_conversation_id !== null && r.target_conversation_id !== r.target_tweet_id)
      );
      console.log(`   ✅ Result: ${violations.length} violations`);
    }
  }
  
  console.log('\n');
  
  // Query 3: Quotas last 60m
  console.log('3) Quotas last 60m:');
  const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { count: totalPosts, error: err3 } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'posted')
    .gte('posted_at', sixtyMinutesAgo);
  
  const { count: totalReplies, error: err4 } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'posted')
    .eq('decision_type', 'reply')
    .gte('posted_at', sixtyMinutesAgo);
  
  if (err3 || err4) {
    console.error(`   ❌ Error: ${err3?.message || err4?.message}`);
  } else {
    console.log(`   ✅ Total posts (60m): ${totalPosts || 0}`);
    console.log(`   ✅ Total replies (60m): ${totalReplies || 0}`);
  }
  
  console.log('\n');
  
  // Query 4: Stuck attempts
  console.log('4) Stuck posting_attempt status:');
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  
  const { count: stuckAttempts, error: err5 } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'posting_attempt')
    .lt('created_at', fiveMinutesAgo);
  
  if (err5) {
    console.error(`   ❌ Error: ${err5.message}`);
  } else {
    console.log(`   ✅ Result: ${stuckAttempts || 0} stuck attempts`);
  }
  
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════\n');
  
  process.exit(0);
}

main().catch(console.error);

