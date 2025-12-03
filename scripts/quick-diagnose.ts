/**
 * 🚨 QUICK DIAGNOSTIC - Direct Supabase Connection
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log('🔍 DIAGNOSING POSTING ISSUE...\n');
  
  try {
    // 1. Queued content
    const { data: queued, error: queuedErr } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, scheduled_at, created_at')
      .eq('status', 'queued')
      .in('decision_type', ['single', 'thread'])
      .order('scheduled_at', { ascending: true })
      .limit(10);
    
    console.log(`1️⃣ Queued content: ${queued?.length || 0}`);
    if (queued && queued.length > 0) {
      const ready = queued.filter(q => new Date(q.scheduled_at) <= new Date());
      console.log(`   Ready to post: ${ready.length}`);
      if (ready.length > 0) {
        console.log(`   ✅ Content is ready - should post soon!`);
      }
    }
    
    // 2. Recent posts
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recent, error: recentErr } = await supabase
      .from('content_metadata')
      .select('status, posted_at, created_at, decision_type')
      .in('decision_type', ['single', 'thread'])
      .gte('created_at', oneDayAgo)
      .order('created_at', { ascending: false })
      .limit(10);
    
    const posted = recent?.filter(p => p.status === 'posted') || [];
    const lastPost = posted[0];
    const hoursAgo = lastPost && lastPost.posted_at 
      ? (Date.now() - new Date(lastPost.posted_at).getTime()) / (1000 * 60 * 60)
      : Infinity;
    
    console.log(`\n2️⃣ Recent posts (24h):`);
    console.log(`   Posted: ${posted.length}`);
    console.log(`   Last post: ${hoursAgo === Infinity ? 'Never' : hoursAgo.toFixed(1) + 'h ago'}`);
    
    // 3. Stuck posts
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: stuck, error: stuckErr } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, created_at')
      .eq('status', 'posting')
      .lt('created_at', thirtyMinAgo);
    
    console.log(`\n3️⃣ Stuck posts: ${stuck?.length || 0}`);
    if (stuck && stuck.length > 0) {
      console.log('   ⚠️ RECOVERING STUCK POSTS...');
      const stuckIds = stuck.map(s => s.decision_id);
      const { error: recoverErr } = await supabase
        .from('content_metadata')
        .update({ status: 'queued' })
        .in('decision_id', stuckIds);
      
      if (recoverErr) {
        console.log(`   ❌ Recovery failed: ${recoverErr.message}`);
      } else {
        console.log(`   ✅ Recovered ${stuck.length} stuck posts!`);
      }
    }
    
    // 4. Plan job
    const { data: plan, error: planErr } = await supabase
      .from('job_heartbeats')
      .select('status, created_at')
      .eq('job_name', 'plan')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    const planHoursAgo = plan 
      ? (Date.now() - new Date(plan.created_at).getTime()) / (1000 * 60 * 60)
      : Infinity;
    
    console.log(`\n4️⃣ Plan job:`);
    console.log(`   Last run: ${planHoursAgo === Infinity ? 'Never' : planHoursAgo.toFixed(1) + 'h ago'}`);
    console.log(`   Status: ${plan?.status || 'none'}`);
    
    if (planHoursAgo > 3) {
      console.log('   ⚠️ Plan job hasn\'t run in >3 hours!');
    }
    
    // 5. Summary & Action
    console.log('\n📊 SUMMARY:');
    if (!queued?.length && planHoursAgo > 3) {
      console.log('🚨 ISSUE: No queued content + plan job not running');
      console.log('💡 ACTION NEEDED: Trigger plan job to generate content');
    } else if (queued?.length) {
      console.log('✅ Content is queued - posting should work');
      if (stuck && stuck.length > 0) {
        console.log('   (Just recovered stuck posts)');
      }
    } else if (planHoursAgo > 3) {
      console.log('⚠️ Plan job needs to run');
    } else {
      console.log('✅ System appears healthy');
    }
    
  } catch (error: any) {
    console.error('❌ Diagnostic failed:', error.message);
    process.exit(1);
  }
}

diagnose();


