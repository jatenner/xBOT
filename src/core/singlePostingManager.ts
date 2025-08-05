/**
 * 🎯 SINGLE POSTING MANAGER
 * Prevents duplicate tweets by having only ONE posting system active
 */

import { AutonomousPostingEngine } from '../core/autonomousPostingEngine';

export class SinglePostingManager {
  private static instance: SinglePostingManager;
  private isRunning = false;
  private postingEngine: AutonomousPostingEngine;
  private nextPostTime: Date | null = null;

  static getInstance(): SinglePostingManager {
    if (!this.instance) {
      this.instance = new SinglePostingManager();
    }
    return this.instance;
  }

  constructor() {
    this.postingEngine = AutonomousPostingEngine.getInstance();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Single Posting Manager already running');
      return;
    }

    console.log('🎯 === SINGLE POSTING MANAGER STARTING ===');
    console.log('✅ This is the ONLY posting system that will run');
    console.log('🚫 All other posting systems are disabled');
    
    this.isRunning = true;
    this.scheduleNextPost();
  }

  private scheduleNextPost(): void {
    const now = new Date();
    const nextPost = new Date(now.getTime() + (60 * 60 * 1000)); // 1 hour from now
    
    this.nextPostTime = nextPost;
    
    const timeUntilNext = nextPost.getTime() - now.getTime();
    
    console.log(`⏰ Next post scheduled for: ${nextPost.toLocaleString()}`);
    
    setTimeout(async () => {
      if (this.isRunning) {
        await this.executePost();
        this.scheduleNextPost(); // Schedule the next one
      }
    }, timeUntilNext);
  }

  private async executePost(): Promise<void> {
    try {
      console.log('🚀 === SINGLE POSTING EXECUTION ===');
      
      const decision = await this.postingEngine.makePostingDecision();
      
      if (decision.should_post) {
        console.log('✅ Posting decision: APPROVED');
        const result = await this.postingEngine.executePost();
        
        if (result.success) {
          console.log(`✅ Tweet posted successfully`);
        } else {
          console.log(`❌ Tweet posting failed: ${result.error}`);
        }
      } else {
        console.log(`❌ Posting decision: DENIED - ${decision.reason}`);
      }
      
    } catch (error) {
      console.error('❌ Single posting execution error:', error);
    }
  }

  stop(): void {
    console.log('🛑 Stopping Single Posting Manager...');
    this.isRunning = false;
    this.nextPostTime = null;
  }

  getStatus(): { isRunning: boolean; nextPostTime: Date | null } {
    return {
      isRunning: this.isRunning,
      nextPostTime: this.nextPostTime
    };
  }
}