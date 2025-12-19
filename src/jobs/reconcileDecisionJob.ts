/**
 * Reconcile Decision Job
 * 
 * Self-healing job that reconciles tweets posted to X but not saved in DB
 * Uses tweet_id_backup to recover missing tweet_ids
 */

import { getSupabaseClient } from '../db/index';
import { getTweetIdFromBackup } from '../utils/tweetIdBackup';
import { markDecisionPosted } from './postingQueue';

interface ReconciliationResult {
  decision_id: string;
  success: boolean;
  tweet_id: string | null;
  error?: string;
}

/**
 * Reconcile a single decision using backup file
 * Only reconciles if status='posted_pending_db' OR backup exists but DB missing tweet_id
 */
export async function reconcileDecision(decisionId: string): Promise<ReconciliationResult> {
  console.log(`[RECONCILE_DECISION] 🔄 Reconciling decision ${decisionId}...`);
  
  try {
    // Query DB to check current status first
    const supabase = getSupabaseClient();
    const { data, error: queryError } = await supabase
      .from('content_metadata')
      .select('decision_id, status, tweet_id')
      .eq('decision_id', decisionId)
      .single();
    
    if (queryError) {
      return {
        decision_id: decisionId,
        success: false,
        tweet_id: null,
        error: `DB query failed: ${queryError.message}`
      };
    }
    
    // Only reconcile if:
    // 1. status='posted_pending_db' OR
    // 2. status='posted' but tweet_id is missing AND backup exists
    const needsReconciliation = 
      data?.status === 'posted_pending_db' ||
      (data?.status === 'posted' && !data?.tweet_id);
    
    if (!needsReconciliation) {
      // Already reconciled or not eligible
      if (data?.tweet_id && data?.status === 'posted') {
        console.log(`[RECONCILE_DECISION] ⏭️ Decision ${decisionId} already reconciled (tweet_id=${data.tweet_id})`);
        return {
          decision_id: decisionId,
          success: true,
          tweet_id: data.tweet_id
        };
      }
      return {
        decision_id: decisionId,
        success: false,
        tweet_id: null,
        error: 'Decision does not need reconciliation'
      };
    }
    
    // Get tweet_id from backup
    const tweetId = getTweetIdFromBackup(decisionId);
    
    if (!tweetId) {
      return {
        decision_id: decisionId,
        success: false,
        tweet_id: null,
        error: 'No tweet_id found in backup file'
      };
    }
    
    // Attempt to save using markDecisionPosted
    const tweetUrl = `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}/status/${tweetId}`;
    await markDecisionPosted(decisionId, tweetId, tweetUrl);
    
    console.log(`[RECONCILE_DECISION] ✅ Successfully reconciled decision ${decisionId} with tweet_id ${tweetId}`);
    
    return {
      decision_id: decisionId,
      success: true,
      tweet_id: tweetId
    };
  } catch (error: any) {
    console.error(`[RECONCILE_DECISION] ❌ Failed to reconcile decision ${decisionId}: ${error.message}`);
    return {
      decision_id: decisionId,
      success: false,
      tweet_id: null,
      error: error.message
    };
  }
}

/**
 * Reconcile all decisions that have backup entries but missing DB saves
 */
export async function reconcileAllDecisions(): Promise<ReconciliationResult[]> {
  console.log(`[RECONCILE_DECISION] 🔄 Starting bulk reconciliation...`);
  
  const { readFileSync, existsSync } = await import('fs');
  const { join } = await import('path');
  
  const BACKUP_FILE = join(process.cwd(), 'logs', 'tweet_id_backup.jsonl');
  
  if (!existsSync(BACKUP_FILE)) {
    console.log(`[RECONCILE_DECISION] ⚠️ No backup file found, skipping reconciliation`);
    return [];
  }
  
  // Read backup file
  const fileContent = readFileSync(BACKUP_FILE, 'utf-8');
  const lines = fileContent.trim().split('\n').filter(line => line.trim());
  
  // Extract decision_ids that are not verified
  const unverifiedDecisions = new Set<string>();
  
  for (const line of lines) {
    try {
      const backup = JSON.parse(line);
      if (!backup.verified && backup.decision_id) {
        unverifiedDecisions.add(backup.decision_id);
      }
    } catch {
      continue;
    }
  }
  
  console.log(`[RECONCILE_DECISION] Found ${unverifiedDecisions.size} unverified decisions`);
  
  // Reconcile each decision
  const results: ReconciliationResult[] = [];
  for (const decisionId of unverifiedDecisions) {
    const result = await reconcileDecision(decisionId);
    results.push(result);
    
    // Small delay to avoid overwhelming DB
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  const successCount = results.filter(r => r.success).length;
  console.log(`[RECONCILE_DECISION] ✅ Reconciliation complete: ${successCount}/${results.length} succeeded`);
  
  return results;
}

