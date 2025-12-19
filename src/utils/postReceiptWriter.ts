/**
 * Post Receipt Writer
 * 
 * Writes immutable receipts immediately after successful post to X.
 * This is the FIRST line of defense against truth gaps.
 * 
 * Receipt is written BEFORE attempting content_metadata persistence,
 * ensuring we have durable proof-of-posting even if DB save fails.
 */

import { getSupabaseClient } from '../db/index';

export interface PostReceipt {
  decision_id: string | null;
  tweet_ids: string[];
  root_tweet_id: string;
  post_type: 'single' | 'thread' | 'reply';
  posted_at: string; // ISO timestamp
  metadata?: {
    target_tweet_id?: string;
    target_username?: string;
    content_preview?: string;
    [key: string]: any;
  };
}

/**
 * Write immutable receipt immediately after successful post to X
 * 
 * CRITICAL: This must succeed or posting should fail-closed.
 * Receipt proves tweet was posted even if content_metadata save fails later.
 */
export async function writePostReceipt(receipt: PostReceipt): Promise<{
  success: boolean;
  receipt_id?: string;
  error?: string;
}> {
  try {
    const supabase = getSupabaseClient();
    
    // Validate required fields
    if (!receipt.root_tweet_id || receipt.tweet_ids.length === 0) {
      throw new Error('Invalid receipt: missing tweet IDs');
    }
    
    if (!['single', 'thread', 'reply'].includes(receipt.post_type)) {
      throw new Error(`Invalid post_type: ${receipt.post_type}`);
    }
    
    console.log(`[RECEIPT] 📝 Writing receipt for ${receipt.post_type} (${receipt.tweet_ids.length} tweet${receipt.tweet_ids.length > 1 ? 's' : ''})`);
    console.log(`[RECEIPT]    decision_id=${receipt.decision_id || 'ORPHAN'}`);
    console.log(`[RECEIPT]    tweet_ids=${receipt.tweet_ids.join(', ')}`);
    
    // Write receipt (INSERT only, never UPDATE)
    // Extract parent_tweet_id from metadata for dedicated column (replies only)
    const parentTweetId = receipt.post_type === 'reply' 
      ? (receipt.metadata?.parent_tweet_id || receipt.metadata?.target_tweet_id)
      : null;
    
    const { data, error } = await supabase
      .from('post_receipts')
      .insert({
        decision_id: receipt.decision_id,
        tweet_ids: receipt.tweet_ids,
        root_tweet_id: receipt.root_tweet_id,
        post_type: receipt.post_type,
        posted_at: receipt.posted_at,
        parent_tweet_id: parentTweetId, // Dedicated column for replies
        metadata: receipt.metadata || {},
        receipt_created_at: new Date().toISOString()
      })
      .select('receipt_id')
      .single();
    
    if (error) {
      console.error(`[RECEIPT] ❌ CRITICAL: Failed to write receipt: ${error.message}`);
      console.error(`[RECEIPT] ❌ Tweet ${receipt.root_tweet_id} is on X but has NO DURABLE PROOF`);
      return { success: false, error: error.message };
    }
    
    console.log(`[RECEIPT] ✅ Receipt written: ${data.receipt_id}`);
    console.log(`[RECEIPT] ✅ Proof-of-posting DURABLE (can reconcile even if next step fails)`);
    
    return { success: true, receipt_id: data.receipt_id };
    
  } catch (err: any) {
    console.error(`[RECEIPT] ❌ CRITICAL: Exception writing receipt: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Write orphan receipt for manually salvaging tweet IDs
 * Used when tweet is on X but missing from all systems
 */
export async function writeOrphanReceipt(
  tweetId: string,
  tweetIds: string[],
  postType: 'single' | 'thread' | 'reply',
  postedAt: string,
  metadata?: any
): Promise<{ success: boolean; receipt_id?: string; error?: string }> {
  console.log(`[RECEIPT] 🆘 Writing ORPHAN receipt for tweet ${tweetId}`);
  console.log(`[RECEIPT]    This tweet exists on X but was missing from all systems`);
  
  return writePostReceipt({
    decision_id: null, // Orphan - no decision_id
    tweet_ids: tweetIds,
    root_tweet_id: tweetId,
    post_type: postType,
    posted_at: postedAt,
    metadata: {
      ...metadata,
      orphan: true,
      salvaged_at: new Date().toISOString()
    }
  });
}

/**
 * Mark receipt as reconciled after successful content_metadata persistence
 */
export async function markReceiptReconciled(
  receiptId: string,
  decisionId: string
): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('post_receipts')
      .update({
        reconciled_at: new Date().toISOString(),
        decision_id: decisionId // Update if it was orphan
      })
      .eq('receipt_id', receiptId);
    
    if (error) {
      console.error(`[RECEIPT] ⚠️ Failed to mark receipt reconciled: ${error.message}`);
      return false;
    }
    
    console.log(`[RECEIPT] ✅ Receipt ${receiptId} marked reconciled`);
    return true;
    
  } catch (err: any) {
    console.error(`[RECEIPT] ⚠️ Exception marking receipt reconciled: ${err.message}`);
    return false;
  }
}

