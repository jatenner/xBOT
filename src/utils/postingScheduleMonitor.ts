import { unifiedPostingCoordinator } from './unifiedPostingCoordinator';

/**
 * 📅 POSTING SCHEDULE MONITOR
 * 
 * Shows when posts will be allowed and prevents burst posting
 */
export class PostingScheduleMonitor {
  
  /**
   * 📊 GET TODAY'S POSTING SCHEDULE
   */
  static async getTodaysSchedule(): Promise<ScheduleInfo> {
    const status = await unifiedPostingCoordinator.getStatus();
    const now = new Date();
    
    // Calculate upcoming posting windows
    const upcomingWindows: PostingWindow[] = [];
    const optimalHours = [9, 11, 14, 16, 17, 19, 20];
    
    // Find remaining optimal hours today
    const remainingHoursToday = optimalHours.filter(hour => hour > now.getHours());
    
    // Add today's remaining windows
    remainingHoursToday.forEach(hour => {
      const windowTime = new Date(now);
      windowTime.setHours(hour, 0, 0, 0);
      
      upcomingWindows.push({
        time: windowTime,
        type: 'optimal',
        available: status.remainingPosts > 0
      });
    });
    
    // Add tomorrow's windows if needed
    if (upcomingWindows.length < 3) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      optimalHours.slice(0, 3).forEach(hour => {
        const windowTime = new Date(tomorrow);
        windowTime.setHours(hour, 0, 0, 0);
        
        upcomingWindows.push({
          time: windowTime,
          type: 'optimal',
          available: true // New day, fresh limit
        });
      });
    }
    
    return {
      currentStatus: status,
      upcomingWindows: upcomingWindows.slice(0, 5), // Next 5 windows
      nextPostAllowed: status.lastPostTime 
        ? new Date(status.lastPostTime.getTime() + 90 * 60 * 1000)
        : now,
      burstPrevention: {
        active: true,
        minimumSpacing: 90,
        dailyLimit: 8,
        optimalHours
      }
    };
  }

  /**
   * 📈 SHOW POSTING FORECAST
   */
  static async showForecast(): Promise<void> {
    const schedule = await this.getTodaysSchedule();
    const now = new Date();
    
    console.log('📅 === POSTING SCHEDULE FORECAST ===');
    console.log('');
    console.log('📊 CURRENT STATUS:');
    console.log(`   Posts today: ${schedule.currentStatus.postsToday}/${schedule.currentStatus.dailyLimit}`);
    console.log(`   Remaining: ${schedule.currentStatus.remainingPosts} posts`);
    console.log(`   Last post: ${schedule.currentStatus.lastPostTime?.toLocaleString() || 'None today'}`);
    console.log(`   Next allowed: ${schedule.nextPostAllowed.toLocaleString()}`);
    console.log('');
    
    console.log('🕐 UPCOMING POSTING WINDOWS:');
    schedule.upcomingWindows.forEach((window, index) => {
      const hoursFromNow = (window.time.getTime() - now.getTime()) / (1000 * 60 * 60);
      const status = window.available ? '✅ Available' : '❌ Limit reached';
      
      console.log(`   ${index + 1}. ${window.time.toLocaleString()} (${hoursFromNow.toFixed(1)}h) - ${status}`);
    });
    console.log('');
    
    console.log('🛡️ BURST PREVENTION SETTINGS:');
    console.log(`   Minimum spacing: ${schedule.burstPrevention.minimumSpacing} minutes`);
    console.log(`   Daily limit: ${schedule.burstPrevention.dailyLimit} posts`);
    console.log(`   Optimal hours: ${schedule.burstPrevention.optimalHours.join(', ')}`);
    console.log('');
    
    // Show if posting is currently possible
    const canPostNow = schedule.nextPostAllowed.getTime() <= now.getTime() && 
                       schedule.currentStatus.remainingPosts > 0;
    
    console.log('🎯 CURRENT POSTING STATUS:');
    if (canPostNow) {
      console.log('✅ POSTING ALLOWED: You can post now');
    } else if (schedule.currentStatus.remainingPosts <= 0) {
      console.log('❌ DAILY LIMIT REACHED: Wait until tomorrow');
    } else {
      const waitMinutes = Math.ceil((schedule.nextPostAllowed.getTime() - now.getTime()) / (1000 * 60));
      console.log(`⏰ WAIT REQUIRED: ${waitMinutes} minutes until next post allowed`);
    }
  }

  /**
   * 🚨 CHECK IF SYSTEM WOULD ALLOW BURST POSTING
   */
  static async checkBurstProtection(): Promise<BurstProtectionReport> {
    console.log('🚨 TESTING BURST PROTECTION...');
    
    const testResults: TestResult[] = [];
    
    // Simulate 5 rapid posting attempts
    for (let i = 1; i <= 5; i++) {
      const result = await unifiedPostingCoordinator.canPostNow(`TestAgent${i}`, 'medium');
      testResults.push({
        attempt: i,
        allowed: result.canPost,
        reason: result.reason,
        waitTime: result.recommendedWaitMinutes
      });
    }
    
    const allowedCount = testResults.filter(r => r.allowed).length;
    const blockedCount = testResults.filter(r => !r.allowed).length;
    
    const isProtected = blockedCount >= allowedCount; // Should block more than allow
    
    return {
      isProtected,
      testResults,
      summary: {
        allowed: allowedCount,
        blocked: blockedCount,
        effectiveness: isProtected ? 'WORKING' : 'NEEDS_IMPROVEMENT'
      }
    };
  }
}

// Types
interface ScheduleInfo {
  currentStatus: {
    postsToday: number;
    dailyLimit: number;
    lastPostTime: Date | null;
    remainingPosts: number;
  };
  upcomingWindows: PostingWindow[];
  nextPostAllowed: Date;
  burstPrevention: {
    active: boolean;
    minimumSpacing: number;
    dailyLimit: number;
    optimalHours: number[];
  };
}

interface PostingWindow {
  time: Date;
  type: 'optimal' | 'regular';
  available: boolean;
}

interface BurstProtectionReport {
  isProtected: boolean;
  testResults: TestResult[];
  summary: {
    allowed: number;
    blocked: number;
    effectiveness: 'WORKING' | 'NEEDS_IMPROVEMENT';
  };
}

interface TestResult {
  attempt: number;
  allowed: boolean;
  reason: string;
  waitTime: number;
}

export const postingScheduleMonitor = PostingScheduleMonitor; 