/**
 * 🐕 WATCHDOG JOB
 * Monitors posting pipeline health and auto-recovers from stuck states
 * Feature-flagged: ENABLE_WATCHDOG_JOB=true
 */

import { getSupabaseClient } from '../db/index';
import { log } from '../lib/logger';
import { runAllowResumer } from './replySystemV2/allowResumer';

const WATCHDOG_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const STUCK_THRESHOLD_MS = 90 * 60 * 1000; // 90 minutes

async function runWatchdog(): Promise<void> {
  // 🔄 NEW: Run allow resumer first (handles stuck ALLOW decisions)
  try {
    await runAllowResumer();
  } catch (resumerError: any) {
    console.error('[WATCHDOG] ❌ Allow resumer failed:', resumerError.message);
  }
  if (process.env.ENABLE_WATCHDOG_JOB !== 'true') {
    return; // Feature disabled
  }

  try {
    const supabase = getSupabaseClient();
    
    // Check last posted time
    const { data: lastPost, error: lastPostError } = await supabase
      .from('content_metadata')
      .select('posted_at')
      .eq('status', 'posted')
      .not('posted_at', 'is', null)
      .order('posted_at', { ascending: false })
      .limit(1)
      .single();

    if (lastPostError && lastPostError.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('[WATCHDOG] ❌ Failed to check last post:', lastPostError.message);
      return;
    }

    const lastPostedAt = lastPost?.posted_at ? new Date(lastPost.posted_at) : null;
    const now = new Date();
    const timeSinceLastPost = lastPostedAt ? now.getTime() - lastPostedAt.getTime() : Infinity;

    // Check queue depth
    const { data: queuedItems, error: queueError } = await supabase
      .from('content_metadata')
      .select('decision_id, scheduled_at, created_at')
      .eq('status', 'queued')
      .order('scheduled_at', { ascending: true })
      .limit(10);

    if (queueError) {
      console.error('[WATCHDOG] ❌ Failed to check queue:', queueError.message);
      return;
    }

    const queueDepth = queuedItems?.length || 0;

    // Log heartbeat
    console.log(`[WATCHDOG] 💓 Heartbeat: last_post=${lastPostedAt?.toISOString() || 'never'}, queue_depth=${queueDepth}, time_since=${Math.round(timeSinceLastPost / 60000)}min`);

    // Check if stuck
    if (timeSinceLastPost > STUCK_THRESHOLD_MS && queueDepth > 0) {
      console.log(`[WATCHDOG] 🚨 STUCK DETECTED: Last post ${Math.round(timeSinceLastPost / 60000)}min ago, ${queueDepth} items queued`);
      
      // Reset Playwright session
      try {
        const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
        const pool = UnifiedBrowserPool.getInstance();
        console.log('[WATCHDOG] 🔧 Resetting browser pool...');
        await pool.resetPool();
        console.log('[WATCHDOG] ✅ Browser pool reset complete');
      } catch (resetError: any) {
        console.error('[WATCHDOG] ❌ Browser pool reset failed:', resetError.message);
      }

      // Re-attempt next queued item
      if (queuedItems && queuedItems.length > 0) {
        const nextItem = queuedItems[0];
        console.log(`[WATCHDOG] 🔄 Re-attempting queued item: ${nextItem.decision_id}`);
        
        // Reset status to trigger retry
        await supabase
          .from('content_metadata')
          .update({ 
            status: 'queued',
            updated_at: new Date().toISOString()
          })
          .eq('decision_id', nextItem.decision_id);
        
        console.log(`[WATCHDOG] ✅ Queued item reset for retry`);
      }

      log({ 
        op: 'watchdog_recovery', 
        time_since_last_post_min: Math.round(timeSinceLastPost / 60000),
        queue_depth: queueDepth,
        action: 'reset_browser_and_requeue'
      });
    }
  } catch (error: any) {
    console.error('[WATCHDOG] ❌ Error:', error.message);
    log({ op: 'watchdog_error', error: error.message });
  }
}

export async function startWatchdog(): Promise<void> {
  if (process.env.ENABLE_WATCHDOG_JOB !== 'true') {
    console.log('[WATCHDOG] ⏭️ Watchdog disabled (ENABLE_WATCHDOG_JOB != true)');
    return;
  }

  console.log('[WATCHDOG] 🐕 Starting watchdog job (15min interval)');
  
  // Run immediately, then every 15 minutes
  await runWatchdog();
  setInterval(runWatchdog, WATCHDOG_INTERVAL_MS);
}

