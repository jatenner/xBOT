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
    // 🚀 URGENT FIX: Post immediately if this is the first post, otherwise every 30 minutes
    const isFirstPost = this.nextPostTime === null;
    const delayMinutes = isFirstPost ? 0.5 : 30; // 30 seconds for first post, then 30 minutes
    const nextPost = new Date(now.getTime() + (delayMinutes * 60 * 1000));
    
    this.nextPostTime = nextPost;
    
    const timeUntilNext = nextPost.getTime() - now.getTime();
    
    if (isFirstPost) {
      console.log(`🚀 IMMEDIATE FIRST POST: Posting in 30 seconds...`);
    } else {
      console.log(`⏰ Next post scheduled for: ${nextPost.toLocaleString()} (${delayMinutes} minutes)`);
    }
    
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
      console.log('🧠 Making intelligent posting decision...');
      
      const decision = await this.postingEngine.makePostingDecision();
      
      console.log(`📋 Decision: ${decision.should_post ? 'POST' : 'WAIT'} (${(decision.confidence * 100).toFixed(1)}% confidence)`);
      console.log(`📝 Strategy: ${decision.strategy.toUpperCase()}`);
      
      if (decision.should_post) {
        console.log('✅ Posting decision: APPROVED');
        console.log('🚀 === AUTONOMOUS POSTING EXECUTION ===');
        
        const result = await this.postingEngine.executePost();
        
        if (result.success) {
          console.log(`✅ Tweet posted successfully! ID: ${result.tweet_id || 'generated'}`);
          console.log(`📊 Method: ${result.method_used || 'autonomous'}`);
        } else {
          console.log(`❌ Tweet posting failed: ${result.error}`);
          console.log('🔄 Will retry in next cycle...');
        }
      } else {
        console.log(`❌ Posting decision: DENIED - ${decision.reason}`);
        if (decision.wait_minutes) {
          console.log(`⏰ Suggested wait: ${decision.wait_minutes} minutes`);
        }
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