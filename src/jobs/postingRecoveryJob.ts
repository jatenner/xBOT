/**
 * 🔧 POSTING RECOVERY JOB - Self-healing truth-gap recovery
 * 
 * Reconciles post_receipts (source of truth) with content_metadata
 * - Finds receipts not reflected in content_metadata
 * - Backfills content_metadata so tweets are discoverable to scrapers/dashboard
 * - Idempotent: safe to run repeatedly
 * - Runs every 10 minutes
 */

import { getSupabaseClient } from '../db/index';

interface RecoveryResult {
  found: number;
  reconciled: number;
  failed: number;
  errors: string[];
}

export async function runPostingRecoveryJob(): Promise<RecoveryResult> {
  const result: RecoveryResult = {
    found: 0,
    reconciled: 0,
    failed: 0,
    errors: []
  };
  
  try {
    const supabase = getSupabaseClient();
    
    // Step 1: Find recent receipts that might need reconciliation
    // Look back 2 hours to catch any stragglers
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    
    const { data: receipts, error: receiptError } = await supabase
      .from('post_receipts')
      .select('decision_id, root_tweet_id, tweet_ids, post_type, posted_at, metadata')
      .gte('posted_at', twoHoursAgo)
      .order('posted_at', { ascending: false });
    
    if (receiptError) {
      console.error('[RECOVERY] Failed to fetch receipts:', receiptError.message);
      result.errors.push(`Receipt fetch: ${receiptError.message}`);
      return result;
    }
    
    if (!receipts || receipts.length === 0) {
      console.log('[RECOVERY] No recent receipts to check');
      return result;
    }
    
    console.log(`[RECOVERY] Checking ${receipts.length} receipts for reconciliation`);
    
    // Step 2: For each receipt, check if content_metadata is correctly updated
    for (const receipt of receipts) {
      result.found++;
      
      try {
        // Check current state in content_metadata
        const { data: metadata, error: metaError } = await supabase
          .from('content_metadata')
          .select('decision_id, status, tweet_id, posted_at')
          .eq('decision_id', receipt.decision_id)
          .single();
        
        if (metaError && metaError.code !== 'PGRST116') {
          // Error other than "not found"
          console.error(`[RECOVERY] Error checking metadata for ${receipt.decision_id}:`, metaError.message);
          result.failed++;
          result.errors.push(`${receipt.decision_id}: ${metaError.message}`);
          continue;
        }
        
        // Determine if reconciliation is needed
        const needsReconciliation = !metadata || 
                                    metadata.status !== 'posted' || 
                                    metadata.tweet_id !== receipt.root_tweet_id;
        
        if (!needsReconciliation) {
          // Already reconciled correctly
          continue;
        }
        
        // Step 3: Reconcile by updating content_metadata
        console.log(`[RECOVERY] Reconciling ${receipt.decision_id} (tweet_id: ${receipt.root_tweet_id})`);
        
        const updatePayload: any = {
          status: 'posted',
          tweet_id: receipt.root_tweet_id,
          posted_at: receipt.posted_at
        };
        
        // For threads, also update thread_tweet_ids
        if (receipt.post_type === 'thread' && receipt.tweet_ids) {
          try {
            const tweetIdsArray = typeof receipt.tweet_ids === 'string' 
              ? JSON.parse(receipt.tweet_ids) 
              : receipt.tweet_ids;
            updatePayload.thread_tweet_ids = tweetIdsArray;
          } catch (parseError) {
            console.warn(`[RECOVERY] Could not parse tweet_ids for ${receipt.decision_id}`);
          }
        }
        
        const { error: updateError } = await supabase
          .from('content_generation_metadata_comprehensive')
          .update(updatePayload)
          .eq('decision_id', receipt.decision_id);
        
        if (updateError) {
          console.error(`[RECOVERY] Failed to update ${receipt.decision_id}:`, updateError.message);
          result.failed++;
          result.errors.push(`${receipt.decision_id}: Update failed - ${updateError.message}`);
        } else {
          console.log(`[RECOVERY] ✅ Reconciled ${receipt.decision_id}`);
          result.reconciled++;
        }
        
      } catch (itemError: any) {
        console.error(`[RECOVERY] Error processing ${receipt.decision_id}:`, itemError.message);
        result.failed++;
        result.errors.push(`${receipt.decision_id}: ${itemError.message}`);
      }
    }
    
    // Step 4: Log summary
    if (result.reconciled > 0 || result.failed > 0) {
      console.log('═══════════════════════════════════════');
      console.log(`[RECOVERY] Summary: found=${result.found} reconciled=${result.reconciled} failed=${result.failed}`);
      if (result.errors.length > 0) {
        console.error('[RECOVERY] Errors encountered:');
        result.errors.slice(0, 5).forEach(err => console.error(`[RECOVERY]   - ${err}`));
        if (result.errors.length > 5) {
          console.error(`[RECOVERY]   ... and ${result.errors.length - 5} more`);
        }
      }
      console.log('═══════════════════════════════════════');
    }
    
    return result;
    
  } catch (error: any) {
    console.error('[RECOVERY] Fatal error in recovery job:', error.message);
    result.errors.push(`Fatal: ${error.message}`);
    return result;
  }
}

/**
 * Start the posting recovery job (runs every 10 minutes)
 */
export function startPostingRecoveryJob(): NodeJS.Timeout {
  console.log('[RECOVERY] Starting posting recovery job (every 10 minutes)');
  
  // Run first check after 2 minutes (give system time to stabilize)
  setTimeout(() => {
    runPostingRecoveryJob().catch(err => {
      console.error('[RECOVERY] Initial recovery failed:', err.message);
    });
  }, 2 * 60 * 1000);
  
  // Then every 10 minutes
  return setInterval(() => {
    runPostingRecoveryJob().catch(err => {
      console.error('[RECOVERY] Recovery job failed:', err.message);
    });
  }, 10 * 60 * 1000);
}

