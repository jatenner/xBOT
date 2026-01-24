/**
 * ⚛️ DETERMINISTIC FAILURE RECORDER
 * 
 * Ensures that ANY execution attempt (post or reply) ALWAYS produces:
 * - exactly one outcomes attempt row
 * - exactly one outcomes result row (success/failure)
 * - exactly one POST_SUCCESS/POST_FAILED or REPLY_SUCCESS/REPLY_FAILED system_event
 * 
 * Even when Playwright times out, throws, or we hit rate limits.
 */

import { getSupabaseClient } from '../db/index';

export interface FailureContext {
  decision_id: string;
  decision_type: 'single' | 'thread' | 'reply';
  pipeline_source?: string;
  proof_tag?: string;
  error_name: string;
  error_message: string;
  step?: string;
  http_status?: number;
  last_url?: string;
  is_timeout?: boolean;
  is_rate_limit?: boolean;
}

/**
 * Record a deterministic failure: outcomes attempt + result + system_event
 */
export async function recordDeterministicFailure(context: FailureContext): Promise<void> {
  const supabase = getSupabaseClient();
  const appVersion = process.env.APP_VERSION || process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown';
  const now = new Date().toISOString();
  
  // Determine event type based on decision_type
  const eventType = context.decision_type === 'reply' ? 'REPLY_FAILED' : 'POST_FAILED';
  
  // Determine error code
  let errorCode = 'UNKNOWN';
  if (context.is_rate_limit || context.http_status === 429) {
    errorCode = 'RATE_LIMITED_429';
  } else if (context.is_timeout) {
    errorCode = 'PLAYWRIGHT_TIMEOUT';
  } else if (context.error_message?.toLowerCase().includes('auth') || context.error_message?.toLowerCase().includes('login')) {
    errorCode = 'AUTH_REQUIRED';
  } else {
    // Extract error code from error_name or error_message
    const errorNameUpper = context.error_name?.toUpperCase() || '';
    if (errorNameUpper.includes('TIMEOUT')) {
      errorCode = 'PLAYWRIGHT_TIMEOUT';
    } else if (errorNameUpper.includes('429') || errorNameUpper.includes('RATE_LIMIT')) {
      errorCode = 'RATE_LIMITED_429';
    } else if (errorNameUpper.includes('AUTH') || errorNameUpper.includes('LOGIN')) {
      errorCode = 'AUTH_REQUIRED';
    } else {
      errorCode = context.error_name?.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 50) || 'UNKNOWN';
    }
  }
  
  try {
    // 1. Write outcomes attempt row (if posting_attempts table exists)
    try {
      await supabase.from('posting_attempts').insert({
        decision_id: context.decision_id,
        decision_type: context.decision_type,
        status: 'failed',
        error_message: context.error_message,
        created_at: now,
      });
    } catch (attemptError: any) {
      // Non-critical - table might not exist or already has row
      console.warn(`[FAILURE_RECORDER] ⚠️ Failed to write posting_attempts: ${attemptError.message}`);
    }
    
    // 2. Write outcomes result row
    try {
      await supabase.from('outcomes').upsert({
        decision_id: context.decision_id,
        tweet_id: null, // No tweet_id on failure
        impressions: null,
        likes: null,
        retweets: null,
        replies: null,
        bookmarks: null,
        er_calculated: null,
        simulated: false,
        collected_at: now,
        // Store error details in a JSONB field if available, or use error_message
        data_source: 'executor_failure',
        updated_at: now,
      }, {
        onConflict: 'decision_id'
      });
    } catch (outcomeError: any) {
      // Critical - log but don't throw
      console.error(`[FAILURE_RECORDER] ❌ Failed to write outcomes: ${outcomeError.message}`);
    }
    
    // 3. Write POST_FAILED/REPLY_FAILED system_event
    const eventData: any = {
      decision_id: context.decision_id,
      error_code: errorCode,
      error_name: context.error_name,
      error_message: context.error_message,
      step: context.step || 'unknown',
      app_version: appVersion,
      failed_at: now,
    };
    
    // Add optional fields
    if (context.proof_tag) {
      eventData.proof_tag = context.proof_tag;
    }
    if (context.pipeline_source) {
      eventData.pipeline_source = context.pipeline_source;
    }
    if (context.http_status) {
      eventData.http_status = context.http_status;
    }
    if (context.last_url) {
      eventData.last_url = context.last_url;
    }
    if (context.is_timeout) {
      eventData.is_timeout = true;
    }
    if (context.is_rate_limit) {
      eventData.is_rate_limit = true;
      eventData.cooldown_backoff_note = 'Rate limit detected - executor will back off';
    }
    
    // Add reply-specific fields
    if (context.decision_type === 'reply') {
      // Try to get target_tweet_id from content_metadata
      try {
        const { data: decisionMeta } = await supabase
          .from('content_metadata')
          .select('target_tweet_id')
          .eq('decision_id', context.decision_id)
          .maybeSingle();
        
        if (decisionMeta?.target_tweet_id) {
          eventData.target_tweet_id = decisionMeta.target_tweet_id;
        }
      } catch (metaError: any) {
        console.warn(`[FAILURE_RECORDER] ⚠️ Failed to fetch target_tweet_id: ${metaError.message}`);
      }
    }
    
    await supabase.from('system_events').insert({
      event_type: eventType,
      severity: 'error',
      message: `${eventType}: decision_id=${context.decision_id} error_code=${errorCode}`,
      event_data: eventData,
      created_at: now,
    });
    
    console.log(`[FAILURE_RECORDER] ✅ Recorded ${eventType} for decision_id=${context.decision_id} error_code=${errorCode}`);
  } catch (error: any) {
    // CRITICAL: Even if recording fails, log it
    console.error(`[FAILURE_RECORDER] 🚨 CRITICAL: Failed to record failure: ${error.message}`);
    console.error(`[FAILURE_RECORDER]   decision_id=${context.decision_id}`);
    console.error(`[FAILURE_RECORDER]   error=${context.error_message}`);
    // Don't throw - we've done our best to record
  }
}

/**
 * Detect if error is a 429 rate limit
 */
export function is429Error(error: any): boolean {
  if (!error) return false;
  
  // Check HTTP status
  if (error.status === 429 || error.statusCode === 429) return true;
  
  // Check error message
  const message = String(error.message || error.toString() || '').toLowerCase();
  return (
    message.includes('429') ||
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('rate-limited') ||
    message.includes('being ratelimited') ||
    message.includes('code 88') || // X rate limit code
    message.includes('http-429')
  );
}

/**
 * Extract HTTP status from error if available
 */
export function extractHttpStatus(error: any): number | undefined {
  if (!error) return undefined;
  if (error.status) return error.status;
  if (error.statusCode) return error.statusCode;
  if (error.response?.status) return error.response.status;
  if (error.response?.statusCode) return error.response.statusCode;
  return undefined;
}
