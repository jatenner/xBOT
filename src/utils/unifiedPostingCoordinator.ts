import { supabaseClient } from './supabaseClient';
import { refreshDailyLimit } from './adaptivePostingFrequency';

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
  
  // DYNAMIC SETTINGS (updated by intelligent optimizer)
  private minimumSpacingMinutes = 90; // Starting point, updated by AI
  private dailyPostLimit = 8; // Starting point, updated by AI
  private optimalHours = [9, 11, 14, 16, 17, 19, 20]; // Starting point, updated by AI

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

    // 1. CHECK DYNAMIC DAILY LIMIT (AI-controlled)
    const dynamicLimit = await refreshDailyLimit();
    if (this.postsToday >= dynamicLimit && priority !== 'urgent') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);

      return {
        canPost: false,
        reason: `Daily limit reached (${this.postsToday}/${dynamicLimit}) - AI controlled`,
        nextAllowedTime: tomorrow,
        recommendedWaitMinutes: Math.ceil((tomorrow.getTime() - now.getTime()) / (1000 * 60))
      };
    }

    // 2. CHECK MINIMUM SPACING (CRITICAL FOR BURST PREVENTION)
    if (this.lastPostTime) {
      const minutesSinceLastPost = (now.getTime() - this.lastPostTime.getTime()) / (1000 * 60);
      
      if (minutesSinceLastPost < this.minimumSpacingMinutes && priority !== 'urgent') {
        const waitMinutes = this.minimumSpacingMinutes - minutesSinceLastPost;
        const nextTime = new Date(now.getTime() + waitMinutes * 60 * 1000);

        console.log(`🚨 SPACING BLOCK: ${Math.ceil(minutesSinceLastPost)} minutes since last post (need ${this.minimumSpacingMinutes})`);

        return {
          canPost: false,
          reason: `Minimum spacing required: ${Math.ceil(waitMinutes)} minutes remaining (prevents burst posting)`,
          nextAllowedTime: nextTime,
          recommendedWaitMinutes: Math.ceil(waitMinutes)
        };
      }
    }

    // 3. CHECK OPTIMAL TIMING
    const isOptimalHour = this.optimalHours.includes(currentHour);
    
    if (!isOptimalHour && priority === 'low') {
      const nextOptimalTime = this.getNextOptimalTime(currentHour);
      return {
        canPost: false,
        reason: `Low priority posts wait for optimal hours (${this.optimalHours.join(', ')})`,
        nextAllowedTime: nextOptimalTime,
        recommendedWaitMinutes: Math.ceil((nextOptimalTime.getTime() - now.getTime()) / (1000 * 60))
      };
    }

    // ✅ APPROVED TO POST
    return {
      canPost: true,
      reason: `Approved: Good timing and spacing (${this.postsToday}/${dynamicLimit} today)`,
      nextAllowedTime: new Date(now.getTime() + this.minimumSpacingMinutes * 60 * 1000),
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

    console.log(`📝 POST RECORDED: ${agentName} (${this.postsToday}/${await refreshDailyLimit()} today)`);
    console.log(`⏰ Next post eligible: ${new Date(now.getTime() + this.minimumSpacingMinutes * 60 * 1000).toLocaleString()}`);

    // Store in database for persistence
    await this.saveTodaysState();
  }

  /**
   * 📊 GET POSTING STATUS
   */
  async getStatus(): Promise<PostingStatus> {
    await this.loadTodaysState();
    const now = new Date();

    let nextOptimalTime: Date;
    if (this.lastPostTime) {
      const minNextTime = new Date(this.lastPostTime.getTime() + this.minimumSpacingMinutes * 60 * 1000);
      nextOptimalTime = this.getNextOptimalTime(minNextTime.getHours());
      if (nextOptimalTime.getTime() < minNextTime.getTime()) {
        nextOptimalTime = minNextTime;
      }
    } else {
      nextOptimalTime = this.getNextOptimalTime(now.getHours());
    }

    const currentDynamicLimit = await refreshDailyLimit();
    
    return {
      postsToday: this.postsToday,
      dailyLimit: currentDynamicLimit, // Use dynamic limit
      lastPostTime: this.lastPostTime,
      nextOptimalTime,
      minutesUntilNextPost: this.lastPostTime 
        ? Math.max(0, this.minimumSpacingMinutes - (now.getTime() - this.lastPostTime.getTime()) / (1000 * 60))
        : 0,
      isOptimalHour: this.optimalHours.includes(now.getHours()),
      remainingPosts: currentDynamicLimit - this.postsToday
    };
  }

  /**
   * ⏰ GET NEXT OPTIMAL TIME
   */
  private getNextOptimalTime(currentHour: number): Date {
    const now = new Date();
    
    // Find next hour today
    const nextHourToday = this.optimalHours.find(hour => hour > currentHour);
    
    if (nextHourToday) {
      const nextTime = new Date(now);
      nextTime.setHours(nextHourToday, 0, 0, 0);
      return nextTime;
    }
    
    // Use first hour tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(this.optimalHours[0], 0, 0, 0);
    return tomorrow;
  }

  /**
   * 📅 GET NEXT POSTING SLOT
   */
  getNextPostingSlot(): Date {
    const now = new Date();
    let nextSlot = new Date(now.getTime() + this.minimumSpacingMinutes * 60 * 1000);
    
    // Ensure it's during optimal hours
    const nextOptimalTime = this.getNextOptimalTime(nextSlot.getHours());
    
    if (nextOptimalTime.getTime() > nextSlot.getTime()) {
      nextSlot = nextOptimalTime;
    }
    
    return nextSlot;
  }

  /**
   * 🧠 UPDATE SETTINGS FROM INTELLIGENT OPTIMIZER
   */
  updateSettings(newSettings: {
    dailyPostLimit?: number;
    minimumSpacingMinutes?: number;
    optimalHours?: number[];
  }): void {
    if (newSettings.dailyPostLimit !== undefined) {
      console.log(`🔧 Updating daily post limit: ${this.dailyPostLimit} → ${newSettings.dailyPostLimit}`);
      this.dailyPostLimit = newSettings.dailyPostLimit;
    }
    
    if (newSettings.minimumSpacingMinutes !== undefined) {
      console.log(`🔧 Updating minimum spacing: ${this.minimumSpacingMinutes} → ${newSettings.minimumSpacingMinutes} minutes`);
      this.minimumSpacingMinutes = newSettings.minimumSpacingMinutes;
    }
    
    if (newSettings.optimalHours !== undefined) {
      console.log(`🔧 Updating optimal hours: [${this.optimalHours.join(', ')}] → [${newSettings.optimalHours.join(', ')}]`);
      this.optimalHours = newSettings.optimalHours;
      this.initializeDailySchedule(); // Rebuild schedule with new hours
    }
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

  /**
   * 📅 INITIALIZE DAILY SCHEDULE  
   */
  private initializeDailySchedule(): void {
    this.todaysSchedule = [];
    const today = new Date();
    
    this.optimalHours.forEach((hour, index) => {
      const slotTime = new Date(today);
      slotTime.setHours(hour, 0, 0, 0);
      
      this.todaysSchedule.push({
        time: slotTime,
        isOptimal: true,
        isUsed: false,
        priority: index < 3 ? 'high' : 'medium'
      });
    });
    
    console.log(`📅 Daily schedule initialized: ${this.todaysSchedule.length} optimal posting slots`);
  }

  /**
   * 💾 SAVE STATE TO DATABASE
   */
  private async saveTodaysState(): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      await supabaseClient.supabase
        ?.from('posting_coordination')
        .upsert({
          date: today,
          posts_today: this.postsToday,
          last_post_time: this.lastPostTime?.toISOString() || null,
          last_posting_agent: 'unified_coordinator',
          updated_at: new Date().toISOString()
        }, { onConflict: 'date' });
        
    } catch (error) {
      console.error('❌ Failed to save posting state:', error);
    }
  }

  /**
   * 📚 LOAD STATE FROM DATABASE
   */
  private async loadTodaysState(): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data } = await supabaseClient.supabase
        ?.from('posting_coordination')
        .select('*')
        .eq('date', today)
        .single() || { data: null };
        
      if (data) {
        this.postsToday = data.posts_today || 0;
        this.lastPostTime = data.last_post_time ? new Date(data.last_post_time) : null;
      } else {
        // First time today
        this.postsToday = 0;
        this.lastPostTime = null;
      }
      
    } catch (error) {
      console.error('❌ Failed to load posting state:', error);
      // Continue with defaults
      this.postsToday = 0;
      this.lastPostTime = null;
    }
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
  time: Date;
  isOptimal: boolean;
  isUsed: boolean;
  priority: 'low' | 'medium' | 'high';
}

// Export singleton instance
export const unifiedPostingCoordinator = UnifiedPostingCoordinator.getInstance(); 