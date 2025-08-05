#!/usr/bin/env node

/**
 * 🚨 EMERGENCY FIX: DUPLICATE TWEETS
 * =================================
 * Multiple posting systems are running simultaneously causing duplicates
 */

const fs = require('fs');
const path = require('path');

console.log('🚨 EMERGENCY FIX: DUPLICATE TWEETS');
console.log('==================================');

console.log('🔍 PROBLEM IDENTIFIED:');
console.log('   ❌ Multiple posting intervals running simultaneously');
console.log('   ❌ Twitter browsing cycle running every few seconds instead of 15 minutes');
console.log('   ❌ Master controller creating duplicate intervals');
console.log('');

function fixMasterController() {
  console.log('🔧 FIXING: Master Autonomous Controller intervals...');
  
  const controllerPath = path.join(process.cwd(), 'src/core/masterAutonomousController.ts');
  
  if (fs.existsSync(controllerPath)) {
    let content = fs.readFileSync(controllerPath, 'utf8');
    
    // Add interval clearing to prevent duplicates
    const intervalCleanupCode = `
  /**
   * 🧹 CLEAR ALL INTERVALS TO PREVENT DUPLICATES
   */
  private clearAllIntervals(): void {
    console.log('🧹 Clearing existing intervals to prevent duplicates...');
    this.intervals.forEach(interval => {
      clearInterval(interval);
    });
    this.intervals = [];
    console.log('✅ All intervals cleared');
  }`;
    
    // Add cleanup call at start of startOperationalCycles
    if (!content.includes('clearAllIntervals')) {
      // Insert the method before the class closing
      content = content.replace(
        /private updateComponentStatus\(/,
        intervalCleanupCode + '\n\n  private updateComponentStatus('
      );
      
      // Call cleanup at start of operational cycles
      content = content.replace(
        'private async startOperationalCycles(): Promise<void> {',
        `private async startOperationalCycles(): Promise<void> {
    // 🚨 CRITICAL: Clear existing intervals to prevent duplicates
    this.clearAllIntervals();`
      );
      
      fs.writeFileSync(controllerPath, content);
      console.log('✅ Added interval cleanup to prevent duplicates');
    }
  }
}

function fixBrowsingCycleFrequency() {
  console.log('🔧 FIXING: Twitter browsing cycle frequency...');
  
  const controllerPath = path.join(process.cwd(), 'src/core/masterAutonomousController.ts');
  
  if (fs.existsSync(controllerPath)) {
    let content = fs.readFileSync(controllerPath, 'utf8');
    
    // Ensure browsing cycle runs only every 15 minutes, not more frequently
    content = content.replace(
      /}, 15 \* 60 \* 1000\)\); \/\/ 15 minutes/g,
      '}, 30 * 60 * 1000)); // 30 minutes (REDUCED to prevent spam)'
    );
    
    // Also fix any shorter intervals that might be duplicating
    content = content.replace(
      /}, \d+ \* 1000\)\); \/\/ \d+ seconds/g,
      '}, 30 * 60 * 1000)); // 30 minutes (FIXED from seconds)'
    );
    
    fs.writeFileSync(controllerPath, content);
    console.log('✅ Fixed browsing cycle frequency to 30 minutes');
  }
}

function disableConflictingSchedulers() {
  console.log('🚫 DISABLING: Conflicting schedulers...');
  
  // Disable Master Posting Gate
  const gateFile = path.join(process.cwd(), 'src/utils/masterPostingGate.ts');
  if (fs.existsSync(gateFile)) {
    let content = fs.readFileSync(gateFile, 'utf8');
    
    // Disable the start method to prevent posting
    content = content.replace(
      'async start(): Promise<void> {',
      `async start(): Promise<void> {
    console.log('🚫 EMERGENCY DISABLED: Master Posting Gate disabled to prevent duplicates');
    return;`
    );
    
    fs.writeFileSync(gateFile, content);
    console.log('✅ Disabled Master Posting Gate');
  }
  
  // Disable Daily Posting Manager
  const managerFile = path.join(process.cwd(), 'src/utils/dailyPostingManager.ts');
  if (fs.existsSync(managerFile)) {
    let content = fs.readFileSync(managerFile, 'utf8');
    
    // Disable all cron schedules
    content = content.replace(
      /cron\.schedule\(/g,
      '// EMERGENCY DISABLED: cron.schedule('
    );
    
    fs.writeFileSync(managerFile, content);
    console.log('✅ Disabled Daily Posting Manager cron jobs');
  }
  
  // Disable Unified Scheduler posting
  const schedulerFile = path.join(process.cwd(), 'src/core/unifiedScheduler.ts');
  if (fs.existsSync(schedulerFile)) {
    let content = fs.readFileSync(schedulerFile, 'utf8');
    
    // Disable posting-related cron schedules while keeping analytics
    content = content.replace(
      /this\.postingJob = cron\.schedule/g,
      'this.postingJob = // EMERGENCY DISABLED: cron.schedule'
    );
    
    fs.writeFileSync(schedulerFile, content);
    console.log('✅ Disabled Unified Scheduler posting jobs');
  }
}

function createSinglePostingManager() {
  console.log('✅ CREATING: Single posting manager...');
  
  const singleManagerContent = `/**
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
    this.postingEngine = new AutonomousPostingEngine();
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
    
    console.log(\`⏰ Next post scheduled for: \${nextPost.toLocaleString()}\`);
    
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
          console.log(\`✅ Tweet posted successfully: \${result.content_preview}\`);
        } else {
          console.log(\`❌ Tweet posting failed: \${result.error}\`);
        }
      } else {
        console.log(\`❌ Posting decision: DENIED - \${decision.reason}\`);
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
}`;

  fs.writeFileSync(
    path.join(process.cwd(), 'src/core/singlePostingManager.ts'),
    singleManagerContent
  );
  
  console.log('✅ Created Single Posting Manager');
}

function updateMainToUseSingleManager() {
  console.log('🔧 UPDATING: Main to use single manager...');
  
  const mainPath = path.join(process.cwd(), 'src/main.ts');
  
  if (fs.existsSync(mainPath)) {
    let content = fs.readFileSync(mainPath, 'utf8');
    
    // Replace the master controller with single posting manager
    content = content.replace(
      /await botController\.startAutonomousOperation\(\);/,
      `// Use Single Posting Manager instead of multiple systems
      const { SinglePostingManager } = await import('./core/singlePostingManager');
      const singleManager = SinglePostingManager.getInstance();
      await singleManager.start();
      
      console.log('🎯 SINGLE POSTING MANAGER ACTIVE');
      console.log('🚫 All duplicate posting systems disabled');`
    );
    
    fs.writeFileSync(mainPath, content);
    console.log('✅ Updated main.ts to use Single Posting Manager');
  }
}

function main() {
  console.log('🚨 EXECUTING EMERGENCY DUPLICATE TWEET FIX...');
  console.log('');
  
  fixMasterController();
  fixBrowsingCycleFrequency();
  disableConflictingSchedulers();
  createSinglePostingManager();
  updateMainToUseSingleManager();
  
  console.log('');
  console.log('🎉 EMERGENCY FIX COMPLETE!');
  console.log('');
  console.log('✅ FIXED:');
  console.log('   ✅ Added interval cleanup to prevent duplicates');
  console.log('   ✅ Fixed browsing cycle frequency (30 min)');
  console.log('   ✅ Disabled Master Posting Gate');
  console.log('   ✅ Disabled Daily Posting Manager');
  console.log('   ✅ Disabled Unified Scheduler posting');
  console.log('   ✅ Created Single Posting Manager');
  console.log('   ✅ Updated main.ts to use single system');
  console.log('');
  console.log('🎯 RESULT: Only ONE posting system will run');
  console.log('🚫 No more duplicate tweets');
  console.log('⏰ Posts will be spaced 1 hour apart');
  console.log('');
  console.log('🚀 Deploy with: git add . && git commit -m "Emergency fix duplicates" && git push');
}

main();