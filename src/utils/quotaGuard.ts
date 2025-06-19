import { supabaseClient } from './supabaseClient';

interface QuotaStatus {
  writes: number;
  reads: number;
  date: string;
  canWrite?: boolean;
}

interface BackoffState {
  lastBackoff: Date | null;
  backoffLevel: number; // 0 = no backoff, 1 = 15min, 2 = 30min, 3 = 1hr
}

let backoffState: BackoffState = {
  lastBackoff: null,
  backoffLevel: 0
};

const WRITE_LIMIT = 450;
const READ_LIMIT = 90;
// Monthly limits for X API Free Tier
const MONTHLY_TWEET_LIMIT = 1500;
const MONTHLY_READ_LIMIT = 10000;
const BACKOFF_DURATIONS = [0, 15 * 60 * 1000, 30 * 60 * 1000, 60 * 60 * 1000]; // ms

export async function getQuotaStatus(): Promise<QuotaStatus> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabaseClient.supabase
      ?.from('api_usage')
      .select('*')
      .eq('date', today)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return {
      writes: data?.writes || 0,
      reads: data?.reads || 0,
      date: today
    };
  } catch (error) {
    console.error('Error getting quota status:', error);
    return { writes: 0, reads: 0, date: new Date().toISOString().split('T')[0] };
  }
}

export async function getMonthlyQuotaStatus(): Promise<{ tweets: number; reads: number; month: string }> {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const { data, error } = await supabaseClient.supabase
      ?.from('monthly_api_usage')
      .select('*')
      .eq('month', currentMonth)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return {
      tweets: data?.tweets || 0,
      reads: data?.reads || 0,
      month: currentMonth
    };
  } catch (error) {
    console.error('Error getting monthly quota status:', error);
    return { tweets: 0, reads: 0, month: new Date().toISOString().slice(0, 7) };
  }
}

export async function canMakeWrite(): Promise<boolean> {
  // Check backoff first
  if (isInBackoff()) {
    console.log(`⏳ In backoff period (level ${backoffState.backoffLevel})`);
    return false;
  }

  const status = await getQuotaStatus();
  const monthlyStatus = await getMonthlyQuotaStatus();
  
  // Check both daily and monthly limits
  return status.writes < WRITE_LIMIT && monthlyStatus.tweets < MONTHLY_TWEET_LIMIT;
}

export async function canMakeRead(): Promise<boolean> {
  // Check backoff first
  if (isInBackoff()) {
    return false;
  }

  const status = await getQuotaStatus();
  const monthlyStatus = await getMonthlyQuotaStatus();
  
  // Check both daily and monthly limits
  return status.reads < READ_LIMIT && monthlyStatus.reads < MONTHLY_READ_LIMIT;
}

export async function safeWrite<T>(operation: () => Promise<T>): Promise<T | null> {
  if (!(await canMakeWrite())) {
    console.log('🚫 Write quota exceeded or in backoff, skipping operation');
    return null;
  }

  try {
    const result = await operation();
    await incrementWrite();
    resetBackoff(); // Reset on success
    return result;
  } catch (error: any) {
    if (error.code === 429) {
      handleRateLimit();
      throw new Error('Rate limited - entering backoff');
    }
    throw error;
  }
}

export async function safeRead<T>(operation: () => Promise<T>): Promise<T | null> {
  if (!(await canMakeRead())) {
    console.log('🚫 Read quota exceeded or in backoff, skipping operation');
    return null;
  }

  try {
    const result = await operation();
    await incrementRead();
    resetBackoff(); // Reset on success
    return result;
  } catch (error: any) {
    if (error.code === 429) {
      handleRateLimit();
      throw new Error('Rate limited - entering backoff');
    }
    throw error;
  }
}

async function incrementWrite(): Promise<void> {
  try {
    await supabaseClient.supabase?.rpc('incr_write');
  } catch (error) {
    console.error('Error incrementing write count:', error);
  }
}

async function incrementRead(): Promise<void> {
  try {
    await supabaseClient.supabase?.rpc('incr_read');
  } catch (error) {
    console.error('Error incrementing read count:', error);
  }
}

function isInBackoff(): boolean {
  if (!backoffState.lastBackoff || backoffState.backoffLevel === 0) {
    return false;
  }

  const backoffDuration = BACKOFF_DURATIONS[backoffState.backoffLevel];
  const timeSinceBackoff = Date.now() - backoffState.lastBackoff.getTime();
  
  return timeSinceBackoff < backoffDuration;
}

function handleRateLimit(): void {
  backoffState.lastBackoff = new Date();
  backoffState.backoffLevel = Math.min(backoffState.backoffLevel + 1, BACKOFF_DURATIONS.length - 1);
  
  const duration = BACKOFF_DURATIONS[backoffState.backoffLevel] / (60 * 1000); // minutes
  console.log(`🚨 Rate limited! Entering backoff level ${backoffState.backoffLevel} for ${duration} minutes`);
  console.log(`💡 Ghost Killer Mode: Using this time for strategic intelligence gathering...`);
}

function resetBackoff(): void {
  if (backoffState.backoffLevel > 0) {
    console.log('✅ API calls successful, resetting backoff');
    backoffState.backoffLevel = 0;
    backoffState.lastBackoff = null;
  }
}

// Export additional functions needed by dashboard
export async function recordWrite(): Promise<void> {
  await incrementWrite();
}

export async function recordRead(): Promise<void> {
  await incrementRead();
}

export function shouldBackOff(): boolean {
  return isInBackoff();
}

export async function canWrite(): Promise<boolean> {
  return await canMakeWrite();
}

export async function canRead(): Promise<boolean> {
  return await canMakeRead();
}

// Enhanced quota checking with hourly pacing
export async function checkWriteQuotaWithPacing(): Promise<{ canWrite: boolean; reason?: string; nextAvailableTime?: Date }> {
  try {
    const currentQuota = await getQuotaStatus();
    
    if (!currentQuota.canWrite) {
      return {
        canWrite: false,
        reason: 'Daily or monthly write limit reached'
      };
    }

    // Calculate hourly pacing
    const now = new Date();
    const currentHour = now.getHours();
    const hoursRemaining = 24 - currentHour;
    const writesRemaining = Math.max(0, 450 - currentQuota.writes); // Assuming 450 daily limit
    
    if (writesRemaining <= 0) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      return {
        canWrite: false,
        reason: 'Daily write limit reached',
        nextAvailableTime: tomorrow
      };
    }

    // Calculate max writes allowed this hour
    const maxThisHour = Math.max(1, Math.ceil(writesRemaining / hoursRemaining));
    
    // For now, allow writes (implementation can be enhanced with actual hourly tracking)
    return { canWrite: true };

  } catch (error) {
    console.error('Error checking write quota with pacing:', error);
    return { canWrite: true }; // Default to allowing on error
  }
}

// Smart engagement strategy during rate limits
export async function getEngagementStrategy(): Promise<{ 
  canPost: boolean; 
  canEngage: boolean; 
  strategy: string; 
  nextAction: string;
  monthlyStatus: string;
}> {
  const dailyStatus = await getQuotaStatus();
  const monthlyStatus = await getMonthlyQuotaStatus();
  const isInBackoffMode = isInBackoff();
  
  const monthlyTweetProgress = (monthlyStatus.tweets / MONTHLY_TWEET_LIMIT) * 100;
  const monthlyReadProgress = (monthlyStatus.reads / MONTHLY_READ_LIMIT) * 100;
  
  if (monthlyStatus.tweets >= MONTHLY_TWEET_LIMIT) {
    return {
      canPost: false,
      canEngage: monthlyStatus.reads < MONTHLY_READ_LIMIT,
      strategy: 'MONTHLY_CAP_REACHED',
      nextAction: 'Focus on engagement activities (likes, follows) until next month',
      monthlyStatus: `Monthly limit reached: ${monthlyStatus.tweets}/${MONTHLY_TWEET_LIMIT} tweets`
    };
  }
  
  if (isInBackoffMode) {
    return {
      canPost: false,
      canEngage: false,
      strategy: 'RATE_LIMIT_BACKOFF',
      nextAction: `Wait ${Math.ceil(BACKOFF_DURATIONS[backoffState.backoffLevel] / (60 * 1000))} minutes then resume`,
      monthlyStatus: `Monthly usage: ${monthlyTweetProgress.toFixed(1)}% tweets, ${monthlyReadProgress.toFixed(1)}% reads`
    };
  }
  
  if (monthlyTweetProgress > 80) {
    return {
      canPost: true,
      canEngage: true,
      strategy: 'CONSERVATIVE_MODE',
      nextAction: 'Reduce posting frequency, focus on high-impact content only',
      monthlyStatus: `Monthly usage: ${monthlyTweetProgress.toFixed(1)}% tweets (entering conservation mode)`
    };
  }
  
  return {
    canPost: true,
    canEngage: true,
    strategy: 'AGGRESSIVE_MODE',
    nextAction: 'Full Ghost Killer engagement active',
    monthlyStatus: `Monthly usage: ${monthlyTweetProgress.toFixed(1)}% tweets, ${monthlyReadProgress.toFixed(1)}% reads`
  };
} 