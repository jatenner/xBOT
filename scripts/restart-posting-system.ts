/**
 * 🚀 RESTART POSTING SYSTEM
 * Manually triggers posting queue and plan job to get system running
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

import { processPostingQueue } from '../src/jobs/postingQueue';
import { planContent } from '../src/jobs/planJob';
import { getSupabaseClient } from '../src/db/index';

async function restartPostingSystem() {
  console.log('🚀 RESTARTING POSTING SYSTEM\n');
  console.log('='.repeat(60));
  
  const supabase = getSupabaseClient();
  
  // 1. Check current status
  console.log('\n1️⃣ CURRENT STATUS:');
  const { data: queued } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, scheduled_at')
    .eq('status', 'queued')
    .in('decision_type', ['single', 'thread'])
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(5);
  
  console.log(`   Queued posts ready: ${queued?.length || 0}`);
  if (queued && queued.length > 0) {
    queued.forEach((p, i) => {
      const scheduled = new Date(p.scheduled_at);
      const mins = Math.round((Date.now() - scheduled.getTime()) / 60000);
      console.log(`   ${i+1}. ${p.decision_type} ${p.decision_id.substring(0,8)}... (${mins}min overdue)`);
    });
  }
  
  // 2. Trigger posting queue
  console.log('\n2️⃣ TRIGGERING POSTING QUEUE:');
  try {
    await processPostingQueue();
    console.log('   ✅ Posting queue executed successfully');
  } catch (error: any) {
    console.error('   ❌ Posting queue failed:', error.message);
    console.error('   Stack:', error.stack?.substring(0, 500));
  }
  
  // 3. Check if we need more content
  console.log('\n3️⃣ CHECKING CONTENT GENERATION:');
  const { data: allQueued } = await supabase
    .from('content_metadata')
    .select('decision_id')
    .eq('status', 'queued')
    .in('decision_type', ['single', 'thread']);
  
  if ((allQueued?.length || 0) < 2) {
    console.log('   ⚠️ Low queue depth - triggering plan job...');
    try {
      await planContent();
      console.log('   ✅ Plan job executed successfully');
    } catch (error: any) {
      console.error('   ❌ Plan job failed:', error.message);
    }
  } else {
    console.log(`   ✅ Queue has ${allQueued?.length || 0} posts - no need to generate`);
  }
  
  // 4. Final status
  console.log('\n4️⃣ FINAL STATUS:');
  const { data: finalQueued } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, posted_at')
    .in('decision_type', ['single', 'thread'])
    .order('created_at', { ascending: false })
    .limit(5);
  
  const posted = finalQueued?.filter(p => p.status === 'posted') || [];
  const stillQueued = finalQueued?.filter(p => p.status === 'queued') || [];
  
  console.log(`   Posted: ${posted.length}`);
  console.log(`   Still queued: ${stillQueued.length}`);
  
  if (posted.length > 0) {
    const last = new Date(posted[0].posted_at || posted[0].created_at);
    const mins = Math.round((Date.now() - last.getTime()) / 60000);
    console.log(`   Last post: ${mins}min ago`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ System restart complete');
}

restartPostingSystem().catch(console.error);

