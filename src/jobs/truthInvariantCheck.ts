/**
 * 🔍 TRUTH INVARIANT CHECK
 * 
 * Lightweight check that runs every 5 minutes to detect truth gaps:
 * - Posted content with null tweet_id (phantom posts)
 * - Logs violations but does NOT crash the service
 */

import { getSupabaseClient } from '../db/index';

export async function runTruthInvariantCheck(): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    // Check for phantom posts: status='posted' but tweet_id IS NULL
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: phantomPosts, error } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, posted_at, status')
      .eq('status', 'posted')
      .is('tweet_id', null)
      .gte('posted_at', twentyFourHoursAgo)
      .order('posted_at', { ascending: false });
    
    if (error) {
      console.error('[INVARIANT_CHECK] Query error:', error.message);
      return;
    }
    
    if (phantomPosts && phantomPosts.length > 0) {
      // INVARIANT VIOLATION DETECTED
      console.error('═══════════════════════════════════════');
      console.error('[INVARIANT_FAIL] TRUTH GAP DETECTED');
      console.error(`[INVARIANT_FAIL] Found ${phantomPosts.length} phantom posts (status=posted but tweet_id=NULL)`);
      console.error('[INVARIANT_FAIL] Sample decision_ids:');
      
      phantomPosts.slice(0, 5).forEach(post => {
        console.error(`[INVARIANT_FAIL]   - ${post.decision_id} (${post.decision_type}, posted_at: ${post.posted_at})`);
      });
      
      if (phantomPosts.length > 5) {
        console.error(`[INVARIANT_FAIL]   ... and ${phantomPosts.length - 5} more`);
      }
      
      console.error('[INVARIANT_FAIL] Action required: Check postingQueue receipt writing');
      console.error('═══════════════════════════════════════');
    } else {
      console.log('[INVARIANT_CHECK] ✅ No truth gaps detected (last 24h)');
    }
    
  } catch (error: any) {
    console.error('[INVARIANT_CHECK] Unexpected error:', error.message);
    // DO NOT throw - this is a monitoring job, not critical path
  }
}

/**
 * Start the invariant check job (runs every 5 minutes)
 */
export function startTruthInvariantCheck(): NodeJS.Timeout {
  console.log('[INVARIANT_CHECK] Starting truth invariant checker (every 5 minutes)');
  
  // Run immediately on startup
  runTruthInvariantCheck().catch(err => {
    console.error('[INVARIANT_CHECK] Initial check failed:', err.message);
  });
  
  // Then every 5 minutes
  return setInterval(() => {
    runTruthInvariantCheck().catch(err => {
      console.error('[INVARIANT_CHECK] Check failed:', err.message);
    });
  }, 5 * 60 * 1000);
}

