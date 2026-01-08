/**
 * 🎫 POSTING PERMIT SYSTEM
 * 
 * Prevents ghost posts by requiring a permit BEFORE any posting can occur.
 * 
 * Flow:
 * 1. Create permit with status=PENDING
 * 2. Validate permit → status=APPROVED
 * 3. Posting function checks for APPROVED permit
 * 4. After posting → status=USED
 * 
 * If no permit exists or not APPROVED → hard block
 */

import { getSupabaseClient } from '../db/index';
import { v4 as uuidv4 } from 'uuid';

export interface PostingPermit {
  permit_id: string;
  decision_id: string;
  decision_type: 'single' | 'thread' | 'reply';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'USED' | 'EXPIRED';
  railway_service_name?: string;
  git_sha?: string;
  run_id?: string;
  pipeline_source?: string;
  content_preview?: string;
  target_tweet_id?: string;
  created_at: string;
  expires_at: string;
}

/**
 * Create a posting permit (must be done BEFORE posting)
 */
export async function createPostingPermit(params: {
  decision_id: string;
  decision_type: 'single' | 'thread' | 'reply';
  pipeline_source: string;
  content_preview?: string;
  target_tweet_id?: string;
  run_id?: string;
}): Promise<{ permit_id: string; success: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  
  const permit_id = `permit_${Date.now()}_${uuidv4().substring(0, 8)}`;
  
  // Get origin info
  const railway_service_name = process.env.RAILWAY_SERVICE_NAME || 'xBOT';
  const git_sha = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown';
  
  try {
    const { error } = await supabase
      .from('post_attempts')
      .insert({
        permit_id,
        decision_id: params.decision_id,
        decision_type: params.decision_type,
        status: 'PENDING',
        railway_service_name,
        git_sha,
        run_id: params.run_id || `run_${Date.now()}`,
        pipeline_source: params.pipeline_source,
        content_preview: params.content_preview?.substring(0, 200) || null,
        target_tweet_id: params.target_tweet_id || null,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min expiry
      });
    
    if (error) {
      console.error(`[POSTING_PERMIT] ❌ Failed to create permit: ${error.message}`);
      return { permit_id, success: false, error: error.message };
    }
    
    console.log(`[POSTING_PERMIT] ✅ Created permit: ${permit_id} for decision_id=${params.decision_id}`);
    
    // Auto-approve if validation passes
    const approvalResult = await approvePostingPermit(permit_id);
    
    return {
      permit_id,
      success: approvalResult.success,
      error: approvalResult.error,
    };
    
  } catch (error: any) {
    console.error(`[POSTING_PERMIT] ❌ Exception creating permit: ${error.message}`);
    return { permit_id, success: false, error: error.message };
  }
}

/**
 * Approve a posting permit (validates decision exists, etc.)
 */
export async function approvePostingPermit(permit_id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  
  try {
    // Get permit
    const { data: permit, error: fetchError } = await supabase
      .from('post_attempts')
      .select('*')
      .eq('permit_id', permit_id)
      .single();
    
    if (fetchError || !permit) {
      return { success: false, error: 'Permit not found' };
    }
    
    if (permit.status !== 'PENDING') {
      return { success: false, error: `Permit already ${permit.status}` };
    }
    
    if (new Date(permit.expires_at) < new Date()) {
      // Auto-expire
      await supabase
        .from('post_attempts')
        .update({ status: 'EXPIRED' })
        .eq('permit_id', permit_id);
      return { success: false, error: 'Permit expired' };
    }
    
    // Validate decision exists
    const { data: decision } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('decision_id, status')
      .eq('decision_id', permit.decision_id)
      .single();
    
    if (!decision) {
      await supabase
        .from('post_attempts')
        .update({ status: 'REJECTED', error_message: 'Decision not found' })
        .eq('permit_id', permit_id);
      return { success: false, error: 'Decision not found' };
    }
    
    // Approve
    const { error: updateError } = await supabase
      .from('post_attempts')
      .update({
        status: 'APPROVED',
        approved_at: new Date().toISOString(),
      })
      .eq('permit_id', permit_id);
    
    if (updateError) {
      return { success: false, error: updateError.message };
    }
    
    console.log(`[POSTING_PERMIT] ✅ Approved permit: ${permit_id}`);
    return { success: true };
    
  } catch (error: any) {
    console.error(`[POSTING_PERMIT] ❌ Exception approving permit: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Verify permit exists and is APPROVED (called BEFORE posting)
 */
export async function verifyPostingPermit(permit_id: string): Promise<{ valid: boolean; permit?: PostingPermit; error?: string }> {
  const supabase = getSupabaseClient();
  
  try {
    const { data: permit, error } = await supabase
      .from('post_attempts')
      .select('*')
      .eq('permit_id', permit_id)
      .single();
    
    if (error || !permit) {
      return { valid: false, error: 'Permit not found' };
    }
    
    if (permit.status !== 'APPROVED') {
      return { valid: false, error: `Permit status is ${permit.status}, not APPROVED` };
    }
    
    if (new Date(permit.expires_at) < new Date()) {
      // Auto-expire
      await supabase
        .from('post_attempts')
        .update({ status: 'EXPIRED' })
        .eq('permit_id', permit_id);
      return { valid: false, error: 'Permit expired' };
    }
    
    return { valid: true, permit: permit as PostingPermit };
    
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}

/**
 * Mark permit as USED after successful posting
 */
export async function markPermitUsed(permit_id: string, actual_tweet_id: string): Promise<void> {
  const supabase = getSupabaseClient();
  
  await supabase
    .from('post_attempts')
    .update({
      status: 'USED',
      used_at: new Date().toISOString(),
      actual_tweet_id,
      posting_success: true,
    })
    .eq('permit_id', permit_id);
  
  console.log(`[POSTING_PERMIT] ✅ Marked permit ${permit_id} as USED (tweet_id=${actual_tweet_id})`);
}

/**
 * Mark permit as FAILED after failed posting
 */
export async function markPermitFailed(permit_id: string, error_message: string): Promise<void> {
  const supabase = getSupabaseClient();
  
  await supabase
    .from('post_attempts')
    .update({
      status: 'REJECTED',
      posting_success: false,
      error_message: error_message.substring(0, 500),
    })
    .eq('permit_id', permit_id);
  
  console.log(`[POSTING_PERMIT] ❌ Marked permit ${permit_id} as FAILED: ${error_message.substring(0, 100)}`);
}

