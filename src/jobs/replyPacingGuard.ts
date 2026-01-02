/**
 * ⏰ REPLY PACING GUARD - Enforces 4 replies/hour with human-like spacing
 */

import { 
  THROUGHPUT_CONFIG, 
  isWithinActiveHours, 
  calculateNextReplyTime,
  checkDailyReplyCap 
} from '../config/throughputConfig';
import { getSupabaseClient } from '../db';

export interface PacingCheckResult {
  canReply: boolean;
  reason: string;
  nextAllowedInMin?: number;
  stats?: {
    hourCount: number;
    dayCount: number;
    lastReplyAt: Date | null;
  };
}

/**
 * Comprehensive pacing check - enforces all throughput rules
 */
export async function checkReplyPacing(): Promise<PacingCheckResult> {
  // Check 1: Active hours
  if (!isWithinActiveHours()) {
    const now = new Date();
    const hour = now.getHours();
    console.log(`[REPLY_JOB] 🚫 Outside active hours now=${hour}:00 window=${THROUGHPUT_CONFIG.ACTIVE_HOURS_START}-${THROUGHPUT_CONFIG.ACTIVE_HOURS_END}`);
    
    return {
      canReply: false,
      reason: `outside_active_hours`,
    };
  }
  
  try {
    const supabase = getSupabaseClient();
    
    // Check 2: Daily cap
    const dailyCap = await checkDailyReplyCap();
    if (!dailyCap.canReply) {
      console.log(`[REPLY_JOB] ⏸️ rate_limit day_count=${dailyCap.used} limit_day=${dailyCap.limit}`);
      return {
        canReply: false,
        reason: 'daily_cap_reached',
        stats: {
          hourCount: 0,
          dayCount: dailyCap.used,
          lastReplyAt: null,
        },
      };
    }
    
    // Check 3: Hourly rate (4 per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { count: hourCount } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', 'reply')
      .eq('status', 'posted')
      .not('tweet_id', 'is', null)
      .gte('posted_at', oneHourAgo);
    
    const repliesThisHour = hourCount || 0;
    
    if (repliesThisHour >= THROUGHPUT_CONFIG.REPLIES_PER_HOUR_TARGET) {
      console.log(`[REPLY_JOB] ⏸️ rate_limit hour_count=${repliesThisHour} limit_hour=${THROUGHPUT_CONFIG.REPLIES_PER_HOUR_TARGET}`);
      return {
        canReply: false,
        reason: 'hourly_rate_exceeded',
        stats: {
          hourCount: repliesThisHour,
          dayCount: dailyCap.used,
          lastReplyAt: null,
        },
      };
    }
    
    // Check 4: Gap pacing (12-20 min + jitter)
    const { data: lastReply } = await supabase
      .from('content_metadata')
      .select('posted_at')
      .eq('decision_type', 'reply')
      .eq('status', 'posted')
      .not('tweet_id', 'is', null)
      .order('posted_at', { ascending: false })
      .limit(1)
      .single();
    
    if (lastReply && lastReply.posted_at) {
      const lastReplyAt = new Date(lastReply.posted_at);
      const nextAllowed = calculateNextReplyTime(lastReplyAt);
      const now = new Date();
      
      if (now < nextAllowed) {
        const minutesUntil = (nextAllowed.getTime() - now.getTime()) / (60 * 1000);
        console.log(`[REPLY_JOB] ⏸️ gap_not_met last=${lastReplyAt.toISOString()} next_allowed_in_min=${minutesUntil.toFixed(1)}`);
        
        return {
          canReply: false,
          reason: 'gap_not_met',
          nextAllowedInMin: minutesUntil,
          stats: {
            hourCount: repliesThisHour,
            dayCount: dailyCap.used,
            lastReplyAt,
          },
        };
      }
    }
    
    // All checks passed
    console.log(`[REPLY_JOB] ✅ Pacing check passed: hour=${repliesThisHour}/${THROUGHPUT_CONFIG.REPLIES_PER_HOUR_TARGET} day=${dailyCap.used}/${dailyCap.limit}`);
    
    return {
      canReply: true,
      reason: 'ok',
      stats: {
        hourCount: repliesThisHour,
        dayCount: dailyCap.used,
        lastReplyAt: lastReply?.posted_at ? new Date(lastReply.posted_at) : null,
      },
    };
  } catch (error: any) {
    console.error(`[REPLY_JOB] ❌ Pacing check failed:`, error.message);
    // Fail open to avoid blocking replies on errors
    return {
      canReply: true,
      reason: 'check_failed_fail_open',
    };
  }
}

/**
 * Calculate next run hint for scheduler
 */
export function calculateNextRunHint(pacingResult: PacingCheckResult): number {
  if (pacingResult.canReply) {
    // Can reply now, check again in 15 min
    return 15;
  }
  
  if (pacingResult.nextAllowedInMin) {
    // Gap not met, check when gap is satisfied
    return Math.ceil(pacingResult.nextAllowedInMin) + 1;
  }
  
  if (pacingResult.reason === 'outside_active_hours') {
    // Check again in 30 min
    return 30;
  }
  
  if (pacingResult.reason === 'hourly_rate_exceeded') {
    // Check again in 15 min (hour will roll over)
    return 15;
  }
  
  // Default: check in 20 min
  return 20;
}

