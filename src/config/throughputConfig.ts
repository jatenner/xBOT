/**
 * 🎯 THROUGHPUT & PACING CONFIGURATION
 * Controlled reply rates to avoid bot detection
 */

export const THROUGHPUT_CONFIG = {
  // Reply rate targets
  REPLIES_PER_HOUR_TARGET: 4,
  MAX_REPLIES_PER_RUN: 1,
  DAILY_REPLY_CAP: 40,
  
  // Pacing (minutes)
  MIN_GAP_BETWEEN_REPLIES_MIN: 12,
  MAX_GAP_BETWEEN_REPLIES_MIN: 20,
  JITTER_MIN: 2,
  JITTER_MAX: 7,
  
  // Active hours (24-hour format, local time)
  ACTIVE_HOURS_START: 8, // 8 AM
  ACTIVE_HOURS_END: 23,  // 11 PM
  
  // Visibility thresholds
  MIN_LIKES_FOR_REPLY: 500,
  MIN_ENGAGEMENT_RATE: 0.01,
  MAX_REPLY_DEPTH: 1, // Only reply to tweets with max 1 level of replies
  
  // Account quality thresholds
  MIN_ACCOUNT_FOLLOWERS: 5000,
  MAX_ACCOUNT_FOLLOWERS: 2000000,
} as const;

/**
 * Check if current time is within active hours
 */
export function isWithinActiveHours(): boolean {
  const now = new Date();
  const hour = now.getHours();
  
  return hour >= THROUGHPUT_CONFIG.ACTIVE_HOURS_START && 
         hour < THROUGHPUT_CONFIG.ACTIVE_HOURS_END;
}

/**
 * Calculate next reply time with jitter
 */
export function calculateNextReplyTime(lastReplyAt: Date | null): Date {
  const now = Date.now();
  
  if (!lastReplyAt) {
    // No previous reply, can reply now (but add small jitter)
    const jitter = Math.random() * 
      (THROUGHPUT_CONFIG.JITTER_MAX - THROUGHPUT_CONFIG.JITTER_MIN) + 
      THROUGHPUT_CONFIG.JITTER_MIN;
    return new Date(now + jitter * 60 * 1000);
  }
  
  // Calculate minimum gap with randomization
  const minGap = THROUGHPUT_CONFIG.MIN_GAP_BETWEEN_REPLIES_MIN;
  const maxGap = THROUGHPUT_CONFIG.MAX_GAP_BETWEEN_REPLIES_MIN;
  const gapMinutes = Math.random() * (maxGap - minGap) + minGap;
  
  // Add jitter
  const jitter = Math.random() * 
    (THROUGHPUT_CONFIG.JITTER_MAX - THROUGHPUT_CONFIG.JITTER_MIN) + 
    THROUGHPUT_CONFIG.JITTER_MIN;
  
  const nextTime = lastReplyAt.getTime() + (gapMinutes + jitter) * 60 * 1000;
  
  // If next time is in the past, use now + jitter
  return new Date(Math.max(nextTime, now + jitter * 60 * 1000));
}

/**
 * Check if we've hit daily reply cap
 */
export async function checkDailyReplyCap(): Promise<{ canReply: boolean; used: number; limit: number }> {
  try {
    const { getSupabaseClient } = await import('../db');
    const supabase = getSupabaseClient();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { count } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', 'reply')
      .eq('status', 'posted')
      .not('tweet_id', 'is', null)
      .gte('posted_at', today.toISOString());
    
    const used = count || 0;
    const canReply = used < THROUGHPUT_CONFIG.DAILY_REPLY_CAP;
    
    return {
      canReply,
      used,
      limit: THROUGHPUT_CONFIG.DAILY_REPLY_CAP,
    };
  } catch (error: any) {
    console.error('[THROUGHPUT] Error checking daily cap:', error.message);
    return { canReply: true, used: 0, limit: THROUGHPUT_CONFIG.DAILY_REPLY_CAP };
  }
}

