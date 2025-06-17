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

export async function canMakeWrite(): Promise<boolean> {
  // Check backoff first
  if (isInBackoff()) {
    console.log(`⏳ In backoff period (level ${backoffState.backoffLevel})`);
    return false;
  }

  const status = await getQuotaStatus();
  return status.writes < WRITE_LIMIT;
}

export async function canMakeRead(): Promise<boolean> {
  // Check backoff first
  if (isInBackoff()) {
    return false;
  }

  const status = await getQuotaStatus();
  return status.reads < READ_LIMIT;
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