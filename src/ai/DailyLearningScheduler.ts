/**
 * 📅 DAILY LEARNING SCHEDULER
 * ===========================
 * Automatically runs the daily learning cycle to continuously improve the bot
 */

import { growthMasterOrchestrator } from './GrowthMasterOrchestrator';
import { supabaseClient } from '../utils/supabaseClient';

export class DailyLearningScheduler {
  private static instance: DailyLearningScheduler;
  private isRunning = false;
  private lastRunDate: string | null = null;

  static getInstance(): DailyLearningScheduler {
    if (!DailyLearningScheduler.instance) {
      DailyLearningScheduler.instance = new DailyLearningScheduler();
    }
    return DailyLearningScheduler.instance;
  }

  /**
   * 🚀 START DAILY LEARNING SCHEDULER
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('📅 Daily learning scheduler already running');
      return;
    }

    this.isRunning = true;
    console.log('📅 === DAILY LEARNING SCHEDULER STARTED ===');

    // Run initial check
    await this.checkAndRunLearning();

    // Set up interval to check every hour
    setInterval(async () => {
      await this.checkAndRunLearning();
    }, 60 * 60 * 1000); // Every hour

    console.log('✅ Daily learning scheduler active - checking every hour');
  }

  /**
   * 🔍 CHECK AND RUN LEARNING IF NEEDED
   */
  private async checkAndRunLearning(): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Check if we've already run today
      if (this.lastRunDate === today) {
        return;
      }

      // Check if it's a good time to run (early morning when bot is less active)
      const hour = new Date().getHours();
      if (hour < 6 || hour > 8) {
        // Only run between 6-8 AM to avoid interfering with active posting
        return;
      }

      console.log('📚 === RUNNING DAILY LEARNING CYCLE ===');
      
      // Run the learning cycle
      const report = await growthMasterOrchestrator.runDailyLearningCycle();
      
      // Log the results
      console.log('✅ Daily learning cycle completed:');
      console.log(`📊 Followers gained yesterday: ${report.followersGained}`);
      console.log(`📝 Tweets posted: ${report.tweetsPosted}`);
      console.log(`📈 Avg followers per tweet: ${report.avgFollowersPerTweet.toFixed(2)}`);
      console.log(`🎯 Learning insights: ${report.learningInsights.length}`);
      console.log(`🚀 Strategy optimizations: ${report.strategyOptimizations.recommendations.length}`);
      console.log(`🧪 Active A/B tests: ${report.activeTests}`);

      if (report.recommendations.length > 0) {
        console.log('💡 Top recommendations:');
        report.recommendations.slice(0, 3).forEach((rec, i) => {
          console.log(`   ${i + 1}. ${rec}`);
        });
      }

      // Mark as completed for today
      this.lastRunDate = today;

      // Store scheduler status
      await supabaseClient.supabaseClient.from('system_status').upsert({
        component: 'daily_learning_scheduler',
        status: 'completed',
        last_run: new Date().toISOString(),
        details: {
          date: today,
          followersGained: report.followersGained,
          tweetsPosted: report.tweetsPosted,
          insightsGenerated: report.learningInsights.length,
          optimizations: report.strategyOptimizations.recommendations.length
        }
      }, { onConflict: 'component' });

    } catch (error) {
      console.error('❌ Daily learning cycle error:', error);
      
      // Log error but don't crash
      await supabaseClient.supabaseClient.from('system_alerts').insert({
        alert_type: 'daily_learning_error',
        severity: 'medium',
        message: `Daily learning cycle failed: ${error.message}`,
        details: { error: error.stack },
        created_at: new Date().toISOString()
      });
    }
  }

  /**
   * 🔄 FORCE RUN LEARNING CYCLE
   * For manual triggers or testing
   */
  async forceRunLearning(): Promise<any> {
    console.log('🔄 Force running daily learning cycle...');
    
    try {
      const report = await growthMasterOrchestrator.runDailyLearningCycle();
      this.lastRunDate = new Date().toISOString().split('T')[0];
      
      console.log('✅ Force learning cycle completed');
      return report;
      
    } catch (error) {
      console.error('❌ Force learning cycle error:', error);
      throw error;
    }
  }

  /**
   * 📊 GET SCHEDULER STATUS
   */
  getStatus(): {
    isRunning: boolean;
    lastRunDate: string | null;
    nextCheckIn: string;
  } {
    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    
    return {
      isRunning: this.isRunning,
      lastRunDate: this.lastRunDate,
      nextCheckIn: nextHour.toISOString()
    };
  }
}

// Export singleton instance
export const dailyLearningScheduler = DailyLearningScheduler.getInstance();