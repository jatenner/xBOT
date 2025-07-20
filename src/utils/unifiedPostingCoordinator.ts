import { supabaseClient } from './supabaseClient';

/**
 * 🎯 UNIFIED POSTING COORDINATOR
 * 
 * SOLVES: Burst posting problem (11 tweets at once, then silence)
 * PROVIDES: Strategic posting throughout the day with proper spacing
 */
export class UnifiedPostingCoordinator {
  private static instance: UnifiedPostingCoordinator;
  private lastPostTime: Date | null = null;
  private postsToday: number = 0;
  private todaysSchedule: PostingSlot[] = [];
  
  // CRITICAL SETTINGS
  private readonly MINIMUM_SPACING_MINUTES = 90; // Minimum 90 minutes between posts
  private readonly DAILY_POST_LIMIT = 8; // Maximum 8 posts per day (quality over quantity)
  private readonly OPTIMAL_HOURS = [9, 11, 14, 16, 17, 19, 20]; // Peak engagement hours

  private constructor() {
    this.initializeDailySchedule();
  }

  static getInstance(): UnifiedPostingCoordinator {
    if (!UnifiedPostingCoordinator.instance) {
      UnifiedPostingCoordinator.instance = new UnifiedPostingCoordinator();
    }
    return UnifiedPostingCoordinator.instance;
  }

  /**
   * 🚨 MAIN POSTING GATE: ALL posts must go through this
   */
  async canPostNow(agentName: string, priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'): Promise<PostingDecision> {
    console.log(`🎯 POSTING GATE: ${agentName} requesting permission (priority: ${priority})`);

    // Load current state
    await this.loadTodaysState();

    const now = new Date();
    const currentHour = now.getHours();

    // 1. CHECK DAILY LIMIT
    if (this.postsToday >= this.DAILY_POST_LIMIT && priority !== 'urgent') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);

      return {
        canPost: false,
        reason: `Daily limit reached (${this.postsToday}/${this.DAILY_POST_LIMIT})`,
        nextAllowedTime: tomorrow,
        recommendedWaitMinutes: Math.ceil((tomorrow.getTime() - now.getTime()) / (1000 * 60))
      };
    }

    // 2. CHECK MINIMUM SPACING (CRITICAL FOR BURST PREVENTION)
    if (this.lastPostTime) {
      const minutesSinceLastPost = (now.getTime() - this.lastPostTime.getTime()) / (1000 * 60);
      
      if (minutesSinceLastPost < this.MINIMUM_SPACING_MINUTES && priority !== 'urgent') {
        const waitMinutes = this.MINIMUM_SPACING_MINUTES - minutesSinceLastPost;
        const nextTime = new Date(now.getTime() + waitMinutes * 60 * 1000);

        console.log(`🚨 SPACING BLOCK: ${Math.ceil(minutesSinceLastPost)} minutes since last post (need ${this.MINIMUM_SPACING_MINUTES})`);

        return {
          canPost: false,
          reason: `Minimum spacing required: ${Math.ceil(waitMinutes)} minutes remaining (prevents burst posting)`,
          nextAllowedTime: nextTime,
          recommendedWaitMinutes: Math.ceil(waitMinutes)
        };
      }
    }

    // 3. CHECK OPTIMAL TIMING
    const isOptimalHour = this.OPTIMAL_HOURS.includes(currentHour);
    
    if (!isOptimalHour && priority === 'low') {
      const nextOptimalTime = this.getNextOptimalTime(currentHour);
      return {
        canPost: false,
        reason: `Low priority posts wait for optimal hours (${this.OPTIMAL_HOURS.join(', ')})`,
        nextAllowedTime: nextOptimalTime,
        recommendedWaitMinutes: Math.ceil((nextOptimalTime.getTime() - now.getTime()) / (1000 * 60))
      };
    }

    // 4. CHECK SCHEDULE CONFLICTS
    const hasScheduleConflict = this.todaysSchedule.some(slot => {
      const slotTime = new Date(slot.scheduledTime);
      const timeDiff = Math.abs(slotTime.getTime() - now.getTime()) / (1000 * 60);
      return timeDiff < 30; // 30-minute buffer around scheduled posts
    });

    if (hasScheduleConflict && priority !== 'urgent') {
      const nextSlot = this.getNextAvailableSlot();
      return {
        canPost: false,
        reason: 'Schedule conflict with planned posts',
        nextAllowedTime: nextSlot,
        recommendedWaitMinutes: Math.ceil((nextSlot.getTime() - now.getTime()) / (1000 * 60))
      };
    }

    // 5. ALL CHECKS PASSED - APPROVE POSTING
    console.log(`✅ POSTING APPROVED: ${agentName} (${priority} priority)`);
    
    return {
      canPost: true,
      reason: `Approved: Good timing and spacing (${this.postsToday}/${this.DAILY_POST_LIMIT} today)`,
      nextAllowedTime: new Date(now.getTime() + this.MINIMUM_SPACING_MINUTES * 60 * 1000),
      recommendedWaitMinutes: 0
    };
  }

  /**
   * 📝 RECORD SUCCESSFUL POST
   */
  async recordPost(agentName: string, tweetId: string, content: string): Promise<void> {
    const now = new Date();
    this.lastPostTime = now;
    this.postsToday += 1;

    console.log(`📝 POST RECORDED: ${agentName} (${this.postsToday}/${this.DAILY_POST_LIMIT} today)`);
    console.log(`⏰ Next post eligible: ${new Date(now.getTime() + this.MINIMUM_SPACING_MINUTES * 60 * 1000).toLocaleString()}`);

    // Store in database for persistence
    try {
      await supabaseClient.supabase
        ?.from('posting_coordination')
        .upsert({
          date: now.toISOString().split('T')[0],
          posts_today: this.postsToday,
          last_post_time: now.toISOString(),
          last_posting_agent: agentName,
          last_tweet_id: tweetId
        }, { onConflict: 'date' });
    } catch (error) {
      console.warn('⚠️ Failed to record post coordination:', error);
    }
  }

  /**
   * 📊 GET POSTING STATUS
   */
  async getStatus(): Promise<PostingStatus> {
    await this.loadTodaysState();
    const now = new Date();

    let nextOptimalTime: Date;
    if (this.lastPostTime) {
      const minNextTime = new Date(this.lastPostTime.getTime() + this.MINIMUM_SPACING_MINUTES * 60 * 1000);
      nextOptimalTime = this.getNextOptimalTime(minNextTime.getHours());
      if (nextOptimalTime.getTime() < minNextTime.getTime()) {
        nextOptimalTime = minNextTime;
      }
    } else {
      nextOptimalTime = this.getNextOptimalTime(now.getHours());
    }

    return {
      postsToday: this.postsToday,
      dailyLimit: this.DAILY_POST_LIMIT,
      lastPostTime: this.lastPostTime,
      nextOptimalTime,
      minutesUntilNextPost: this.lastPostTime 
        ? Math.max(0, this.MINIMUM_SPACING_MINUTES - (now.getTime() - this.lastPostTime.getTime()) / (1000 * 60))
        : 0,
      isOptimalHour: this.OPTIMAL_HOURS.includes(now.getHours()),
      remainingPosts: this.DAILY_POST_LIMIT - this.postsToday
    };
  }

  /**
   * 🕐 GET NEXT OPTIMAL TIME
   */
  private getNextOptimalTime(currentHour: number): Date {
    const now = new Date();
    
    // Find next optimal hour today
    const nextHourToday = this.OPTIMAL_HOURS.find(hour => hour > currentHour);
    
    if (nextHourToday) {
      const nextTime = new Date(now);
      nextTime.setHours(nextHourToday, 0, 0, 0);
      return nextTime;
    }
    
    // No more optimal hours today, use first optimal hour tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(this.OPTIMAL_HOURS[0], 0, 0, 0);
    return tomorrow;
  }

  /**
   * 📅 GET NEXT AVAILABLE SLOT
   */
  private getNextAvailableSlot(): Date {
    const now = new Date();
    let nextSlot = new Date(now.getTime() + this.MINIMUM_SPACING_MINUTES * 60 * 1000);
    
    // Check against existing schedule
    while (this.todaysSchedule.some(slot => {
      const slotTime = new Date(slot.scheduledTime);
      const timeDiff = Math.abs(slotTime.getTime() - nextSlot.getTime()) / (1000 * 60);
      return timeDiff < 30;
    })) {
      nextSlot = new Date(nextSlot.getTime() + 30 * 60 * 1000); // Move 30 minutes forward
    }
    
    return nextSlot;
  }

  /**
   * 🔄 LOAD TODAY'S STATE
   */
  private async loadTodaysState(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const { data } = await supabaseClient.supabase
        ?.from('posting_coordination')
        .select('*')
        .eq('date', today)
        .single() || { data: null };

      if (data) {
        this.postsToday = data.posts_today || 0;
        this.lastPostTime = data.last_post_time ? new Date(data.last_post_time) : null;
      } else {
        // Reset for new day
        this.postsToday = 0;
        this.lastPostTime = null;
      }
    } catch (error) {
      console.warn('⚠️ Failed to load posting state:', error);
    }
  }

  /**
   * 📅 INITIALIZE DAILY SCHEDULE
   */
  private initializeDailySchedule(): void {
    const today = new Date();
    this.todaysSchedule = [];

    // Create scheduled slots for optimal hours
    this.OPTIMAL_HOURS.forEach((hour, index) => {
      const slotTime = new Date(today);
      slotTime.setHours(hour, Math.random() * 30, 0, 0); // Random minutes within the hour
      
      this.todaysSchedule.push({
        scheduledTime: slotTime.toISOString(),
        priority: index < 3 ? 'high' : 'medium', // First 3 slots are high priority
        contentType: 'scheduled',
        agentName: 'auto-scheduler'
      });
    });

    console.log(`📅 Daily schedule initialized: ${this.todaysSchedule.length} optimal posting slots`);
  }

  /**
   * 🎯 FORCE RESET (Emergency use only)
   */
  async forceReset(): Promise<void> {
    console.log('🚨 FORCE RESET: Posting coordinator state');
    this.lastPostTime = null;
    this.postsToday = 0;
    this.initializeDailySchedule();
    
    const today = new Date().toISOString().split('T')[0];
    await supabaseClient.supabase
      ?.from('posting_coordination')
      .delete()
      .eq('date', today);
      
    console.log('✅ Posting coordinator reset complete');
  }
}

// Types
interface PostingDecision {
  canPost: boolean;
  reason: string;
  nextAllowedTime: Date;
  recommendedWaitMinutes: number;
}

interface PostingStatus {
  postsToday: number;
  dailyLimit: number;
  lastPostTime: Date | null;
  nextOptimalTime: Date;
  minutesUntilNextPost: number;
  isOptimalHour: boolean;
  remainingPosts: number;
}

interface PostingSlot {
  scheduledTime: string;
  priority: 'low' | 'medium' | 'high';
  contentType: string;
  agentName: string;
}

// Export singleton instance
export const unifiedPostingCoordinator = UnifiedPostingCoordinator.getInstance(); 