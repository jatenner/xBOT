import { SupabaseClient } from '@supabase/supabase-js';

interface APIUsageTracker {
  daily_reads: number;
  daily_writes: number;
  monthly_reads: number;
  monthly_writes: number;
  last_reset: string;
  last_monthly_reset: string;
}

export class APIOptimizer {
  private supabase: SupabaseClient;
  private usage: APIUsageTracker;
  
  // FREE TIER LIMITS (Conservative estimates)
  private readonly LIMITS = {
    DAILY_READS: 1500,    // Conservative limit for reads
    DAILY_WRITES: 20,     // Conservative limit for tweets/actions
    MONTHLY_READS: 40000, // Conservative monthly limit
    MONTHLY_WRITES: 500   // Conservative monthly limit
  };

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.usage = {
      daily_reads: 0,
      daily_writes: 0,
      monthly_reads: 0,
      monthly_writes: 0,
      last_reset: new Date().toISOString().split('T')[0],
      last_monthly_reset: new Date().toISOString().slice(0, 7) + '-01'
    };
  }

  async loadUsage(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('api_usage_tracker')
        .select('*')
        .single();

      if (data && !error) {
        this.usage = data;
        this.checkResets();
      } else {
        await this.saveUsage();
      }
    } catch (error) {
      console.log('🔧 Initializing API usage tracker...');
      await this.saveUsage();
    }
  }

  private checkResets(): void {
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = new Date().toISOString().slice(0, 7) + '-01';

    // Daily reset
    if (this.usage.last_reset !== today) {
      this.usage.daily_reads = 0;
      this.usage.daily_writes = 0;
      this.usage.last_reset = today;
    }

    // Monthly reset
    if (this.usage.last_monthly_reset !== thisMonth) {
      this.usage.monthly_reads = 0;
      this.usage.monthly_writes = 0;
      this.usage.last_monthly_reset = thisMonth;
    }
  }

  async saveUsage(): Promise<void> {
    try {
      await this.supabase
        .from('api_usage_tracker')
        .upsert(this.usage);
    } catch (error) {
      console.log('⚠️ Could not save API usage:', error);
    }
  }

  canRead(): boolean {
    return this.usage.daily_reads < this.LIMITS.DAILY_READS && 
           this.usage.monthly_reads < this.LIMITS.MONTHLY_READS;
  }

  canWrite(): boolean {
    return this.usage.daily_writes < this.LIMITS.DAILY_WRITES && 
           this.usage.monthly_writes < this.LIMITS.MONTHLY_WRITES;
  }

  async trackRead(): Promise<void> {
    this.usage.daily_reads++;
    this.usage.monthly_reads++;
    await this.saveUsage();
  }

  async trackWrite(): Promise<void> {
    this.usage.daily_writes++;
    this.usage.monthly_writes++;
    await this.saveUsage();
  }

  getStatus(): {
    canPost: boolean;
    canRead: boolean;
    dailyWritesLeft: number;
    dailyReadsLeft: number;
    monthlyWritesLeft: number;
    monthlyReadsLeft: number;
  } {
    return {
      canPost: this.canWrite(),
      canRead: this.canRead(),
      dailyWritesLeft: Math.max(0, this.LIMITS.DAILY_WRITES - this.usage.daily_writes),
      dailyReadsLeft: Math.max(0, this.LIMITS.DAILY_READS - this.usage.daily_reads),
      monthlyWritesLeft: Math.max(0, this.LIMITS.MONTHLY_WRITES - this.usage.monthly_writes),
      monthlyReadsLeft: Math.max(0, this.LIMITS.MONTHLY_READS - this.usage.monthly_reads)
    };
  }

  // Smart scheduling - when to post next
  getOptimalPostingSchedule(): {
    nextPostTime: Date;
    postsRemainingToday: number;
    strategy: string;
  } {
    const status = this.getStatus();
    const now = new Date();
    const hoursLeftToday = 24 - now.getHours();
    
    if (!status.canPost) {
      // Can't post today, schedule for tomorrow
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0); // 9 AM tomorrow
      
      return {
        nextPostTime: tomorrow,
        postsRemainingToday: 0,
        strategy: 'MONTHLY_CAP_REACHED'
      };
    }

    // Calculate optimal posting interval
    const optimalInterval = Math.max(60, (hoursLeftToday * 60) / status.dailyWritesLeft);
    const nextPost = new Date(now.getTime() + (optimalInterval * 60 * 1000));

    return {
      nextPostTime: nextPost,
      postsRemainingToday: status.dailyWritesLeft,
      strategy: 'OPTIMIZED_SPACING'
    };
  }
} 