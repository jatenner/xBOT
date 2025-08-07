/**
 * 📅 DAILY LEARNING SCHEDULER (SIMPLIFIED)
 * ========================================
 * Simplified version for build success - will be enhanced later
 */

import { growthMasterOrchestrator } from './GrowthMasterOrchestrator';

export class DailyLearningScheduler {
  private static instance: DailyLearningScheduler;
  private isRunning = false;
  private learningInterval: NodeJS.Timeout | null = null;

  static getInstance(): DailyLearningScheduler {
    if (!this.instance) {
      this.instance = new DailyLearningScheduler();
    }
    return this.instance;
  }

  /**
   * 🚀 START LEARNING SCHEDULER (SIMPLIFIED)
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('📅 Learning scheduler already running');
      return;
    }

    this.isRunning = true;
    console.log('📅 Starting daily learning scheduler...');

    // Run learning cycle every 24 hours
    this.learningInterval = setInterval(async () => {
      try {
        await growthMasterOrchestrator.runDailyLearningCycle();
      } catch (error) {
        console.log('⚠️ Scheduled learning cycle error:', error);
      }
    }, 24 * 60 * 60 * 1000);

    // Run initial learning cycle
    try {
      await growthMasterOrchestrator.runDailyLearningCycle();
    } catch (error) {
      console.log('⚠️ Initial learning cycle error:', error);
    }

    console.log('✅ Daily learning scheduler started successfully');
  }

  /**
   * 🛑 STOP LEARNING SCHEDULER
   */
  stop(): void {
    if (this.learningInterval) {
      clearInterval(this.learningInterval);
      this.learningInterval = null;
    }
    this.isRunning = false;
    console.log('📅 Learning scheduler stopped');
  }
}

export const dailyLearningScheduler = DailyLearningScheduler.getInstance();