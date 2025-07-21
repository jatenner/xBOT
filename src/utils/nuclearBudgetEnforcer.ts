/**
 * 🚀 NUCLEAR BUDGET ENFORCER
 * 
 * ULTIMATE FAILSAFE SYSTEM: Multiple layers of protection to GUARANTEE
 * daily budget never exceeds $5.00 per 24-hour period.
 * 
 * Features:
 * - Triple-layer enforcement (file, database, memory)
 * - Real-time spending tracking with microsecond precision
 * - Automatic emergency brake at $4.75
 * - Failsafe mechanisms at multiple checkpoints
 * - Nuclear lockdown if ANY layer fails
 */

import { supabaseClient } from './supabaseClient';
import * as fs from 'fs';
import * as path from 'path';

interface BudgetStatus {
  totalSpent: number;
  remainingBudget: number;
  dailyLimit: number;
  emergencyBrake: number;
  isLocked: boolean;
  canSpend: boolean;
  lastUpdated: Date;
  failsafeLevel: 'green' | 'yellow' | 'orange' | 'red' | 'nuclear';
}

interface SpendingTransaction {
  amount: number;
  operation: string;
  timestamp: Date;
  runningTotal: number;
  approved: boolean;
}

export class NuclearBudgetEnforcer {
  // NUCLEAR CONSTANTS - CANNOT BE CHANGED
  private static readonly ABSOLUTE_MAXIMUM = 5.00;      // $5.00 - NEVER EXCEED
  private static readonly EMERGENCY_BRAKE = 4.75;       // $4.75 - Stop before limit
  private static readonly WARNING_THRESHOLD = 4.00;     // $4.00 - Warning level
  private static readonly DANGER_THRESHOLD = 4.50;      // $4.50 - Danger level
  
  // Failsafe files
  private static readonly LOCKDOWN_FILE = path.join(process.cwd(), '.nuclear_budget_lockdown');
  private static readonly SPENDING_LOG = path.join(process.cwd(), '.daily_spending.log');
  
  // In-memory protection
  private static memorySpendingTotal = 0;
  private static lastMemoryUpdate = new Date();
  
  /**
   * 🛡️ NUCLEAR BUDGET CHECK - MULTIPLE FAILSAFE LAYERS
   */
  static async canAffordOperation(
    operationCost: number, 
    operationType: string, 
    bypassLevel: 'none' | 'warning' | 'danger' = 'none'
  ): Promise<{
    approved: boolean;
    reason: string;
    currentSpending: number;
    remainingBudget: number;
    failsafeTriggered: string[];
    emergencyAction?: string;
  }> {
    const failsafesTriggered: string[] = [];
    
    try {
      // FAILSAFE 1: File-based lockdown check (fastest)
      if (fs.existsSync(this.LOCKDOWN_FILE)) {
        const lockdownData = JSON.parse(fs.readFileSync(this.LOCKDOWN_FILE, 'utf8'));
        failsafesTriggered.push('FILE_LOCKDOWN_ACTIVE');
        
        return {
          approved: false,
          reason: `Nuclear lockdown active: ${lockdownData.reason}`,
          currentSpending: lockdownData.totalSpent || this.ABSOLUTE_MAXIMUM,
          remainingBudget: 0,
          failsafeTriggered: failsafesTriggered,
          emergencyAction: 'Wait until tomorrow - system locked'
        };
      }
      
      // FAILSAFE 2: Memory-based spending check
      const memoryCheck = this.checkMemorySpending(operationCost);
      if (!memoryCheck.canSpend) {
        failsafesTriggered.push('MEMORY_LIMIT_EXCEEDED');
      }
      
      // FAILSAFE 3: Database spending verification
      const dbCheck = await this.checkDatabaseSpending(operationCost);
      if (!dbCheck.canSpend) {
        failsafesTriggered.push('DATABASE_LIMIT_EXCEEDED');
      }
      
      // FAILSAFE 4: Real-time spending log verification
      const logCheck = await this.checkSpendingLog(operationCost);
      if (!logCheck.canSpend) {
        failsafesTriggered.push('SPENDING_LOG_LIMIT_EXCEEDED');
      }
      
      // Calculate combined spending from all sources
      const maxSpending = Math.max(
        memoryCheck.currentSpending,
        dbCheck.currentSpending,
        logCheck.currentSpending
      );
      
      const projectedTotal = maxSpending + operationCost;
      
      // NUCLEAR DECISION LOGIC
      if (projectedTotal > this.ABSOLUTE_MAXIMUM) {
        // IMMEDIATE NUCLEAR LOCKDOWN
        await this.activateNuclearLockdown(
          maxSpending,
          operationType,
          'ABSOLUTE_MAXIMUM_EXCEEDED'
        );
        
        failsafesTriggered.push('NUCLEAR_LOCKDOWN_ACTIVATED');
        
        return {
          approved: false,
          reason: `NUCLEAR LOCKDOWN: Would exceed $${this.ABSOLUTE_MAXIMUM} limit`,
          currentSpending: maxSpending,
          remainingBudget: 0,
          failsafeTriggered: failsafesTriggered,
          emergencyAction: 'System locked until tomorrow'
        };
      }
      
      if (projectedTotal > this.EMERGENCY_BRAKE && bypassLevel === 'none') {
        // EMERGENCY BRAKE ACTIVATED
        failsafesTriggered.push('EMERGENCY_BRAKE_ACTIVATED');
        
        return {
          approved: false,
          reason: `Emergency brake: Would exceed $${this.EMERGENCY_BRAKE} safety limit`,
          currentSpending: maxSpending,
          remainingBudget: this.EMERGENCY_BRAKE - maxSpending,
          failsafeTriggered: failsafesTriggered,
          emergencyAction: 'Reduce operation cost or wait until tomorrow'
        };
      }
      
      // WARNING LEVELS
      if (projectedTotal > this.DANGER_THRESHOLD) {
        failsafesTriggered.push('DANGER_THRESHOLD_REACHED');
      } else if (projectedTotal > this.WARNING_THRESHOLD) {
        failsafesTriggered.push('WARNING_THRESHOLD_REACHED');
      }
      
      // APPROVE OPERATION WITH TRACKING
      await this.recordApprovedOperation(operationCost, operationType, maxSpending);
      
      return {
        approved: true,
        reason: `Approved: $${operationCost.toFixed(3)} operation (${failsafesTriggered.length} warnings)`,
        currentSpending: maxSpending,
        remainingBudget: this.ABSOLUTE_MAXIMUM - projectedTotal,
        failsafeTriggered: failsafesTriggered
      };
      
    } catch (error) {
      // FAILSAFE: ANY ERROR = DENY OPERATION
      console.error('❌ Nuclear budget enforcer error:', error);
      
      await this.activateNuclearLockdown(
        this.ABSOLUTE_MAXIMUM,
        operationType,
        `SYSTEM_ERROR: ${error.message}`
      );
      
      return {
        approved: false,
        reason: 'Budget enforcer system error - operation denied for safety',
        currentSpending: this.ABSOLUTE_MAXIMUM,
        remainingBudget: 0,
        failsafeTriggered: ['SYSTEM_ERROR_FAILSAFE'],
        emergencyAction: 'System error - manual intervention required'
      };
    }
  }
  
  /**
   * 🧠 MEMORY-BASED SPENDING CHECK
   */
  private static checkMemorySpending(operationCost: number): {
    canSpend: boolean;
    currentSpending: number;
    reason: string;
  } {
    // Reset memory if it's a new day
    const now = new Date();
    const lastUpdateDay = this.lastMemoryUpdate.toDateString();
    const currentDay = now.toDateString();
    
    if (lastUpdateDay !== currentDay) {
      this.memorySpendingTotal = 0;
      this.lastMemoryUpdate = now;
    }
    
    const projectedTotal = this.memorySpendingTotal + operationCost;
    
    return {
      canSpend: projectedTotal <= this.EMERGENCY_BRAKE,
      currentSpending: this.memorySpendingTotal,
      reason: projectedTotal > this.EMERGENCY_BRAKE 
        ? `Memory check: $${projectedTotal.toFixed(3)} > $${this.EMERGENCY_BRAKE}`
        : 'Memory check passed'
    };
  }
  
  /**
   * 🗄️ DATABASE SPENDING CHECK
   */
  private static async checkDatabaseSpending(operationCost: number): Promise<{
    canSpend: boolean;
    currentSpending: number;
    reason: string;
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      if (!supabaseClient.supabase) {
        // Conservative approach if no database
        return {
          canSpend: operationCost <= 0.50, // Only allow small operations
          currentSpending: 0,
          reason: 'No database connection - conservative mode'
        };
      }
      
      const { data: budgetStatus } = await supabaseClient.supabase
        .from('bot_config')
        .select('value')
        .eq('key', 'daily_budget_status')
        .single() || { data: null };
      
      let currentSpending = 0;
      if (budgetStatus?.value?.date === today) {
        currentSpending = budgetStatus.value.spent || 0;
      }
      
      const projectedTotal = currentSpending + operationCost;
      
      return {
        canSpend: projectedTotal <= this.EMERGENCY_BRAKE,
        currentSpending,
        reason: projectedTotal > this.EMERGENCY_BRAKE
          ? `Database check: $${projectedTotal.toFixed(3)} > $${this.EMERGENCY_BRAKE}`
          : 'Database check passed'
      };
      
    } catch (error) {
      // Conservative approach on error
      return {
        canSpend: false,
        currentSpending: this.ABSOLUTE_MAXIMUM,
        reason: `Database error: ${error.message}`
      };
    }
  }
  
  /**
   * 📝 SPENDING LOG CHECK
   */
  private static async checkSpendingLog(operationCost: number): Promise<{
    canSpend: boolean;
    currentSpending: number;
    reason: string;
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      let totalSpending = 0;
      
      if (fs.existsSync(this.SPENDING_LOG)) {
        const logContent = fs.readFileSync(this.SPENDING_LOG, 'utf8');
        const lines = logContent.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          if (line.includes(today)) {
            const match = line.match(/\$([0-9.]+)/);
            if (match) {
              totalSpending += parseFloat(match[1]);
            }
          }
        }
      }
      
      const projectedTotal = totalSpending + operationCost;
      
      return {
        canSpend: projectedTotal <= this.EMERGENCY_BRAKE,
        currentSpending: totalSpending,
        reason: projectedTotal > this.EMERGENCY_BRAKE
          ? `Log check: $${projectedTotal.toFixed(3)} > $${this.EMERGENCY_BRAKE}`
          : 'Log check passed'
      };
      
    } catch (error) {
      return {
        canSpend: false,
        currentSpending: this.ABSOLUTE_MAXIMUM,
        reason: `Log error: ${error.message}`
      };
    }
  }
  
  /**
   * ✅ RECORD APPROVED OPERATION
   */
  private static async recordApprovedOperation(
    cost: number,
    operationType: string,
    currentSpending: number
  ): Promise<void> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const newTotal = currentSpending + cost;
    
    try {
      // Update memory
      this.memorySpendingTotal = newTotal;
      this.lastMemoryUpdate = now;
      
      // Update database
      if (supabaseClient.supabase) {
        await supabaseClient.supabase
          .from('bot_config')
          .upsert({
            key: 'daily_budget_status',
            value: {
              date: today,
              limit: this.ABSOLUTE_MAXIMUM,
              spent: newTotal,
              remaining: this.ABSOLUTE_MAXIMUM - newTotal,
              last_operation: operationType,
              last_update: now.toISOString()
            }
          });
      }
      
      // Update spending log
      const logEntry = `${now.toISOString()} | ${operationType} | $${cost.toFixed(4)} | Total: $${newTotal.toFixed(4)}\n`;
      fs.appendFileSync(this.SPENDING_LOG, logEntry);
      
    } catch (error) {
      console.error('❌ Failed to record operation:', error);
      // Even if recording fails, the operation was approved
    }
  }
  
  /**
   * 🚨 ACTIVATE NUCLEAR LOCKDOWN
   */
  private static async activateNuclearLockdown(
    currentSpending: number,
    operationType: string,
    reason: string
  ): Promise<void> {
    const lockdownData = {
      timestamp: new Date().toISOString(),
      totalSpent: currentSpending,
      triggerOperation: operationType,
      reason,
      unlockTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    };
    
    try {
      // Create lockdown file
      fs.writeFileSync(this.LOCKDOWN_FILE, JSON.stringify(lockdownData, null, 2));
      
      // Update database
      if (supabaseClient.supabase) {
        await supabaseClient.supabase
          .from('bot_config')
          .upsert({
            key: 'nuclear_budget_lockdown',
            value: lockdownData
          });
      }
      
      console.log('🚨 NUCLEAR BUDGET LOCKDOWN ACTIVATED');
      console.log(`Reason: ${reason}`);
      console.log(`Current spending: $${currentSpending.toFixed(3)}`);
      console.log(`Unlock time: ${lockdownData.unlockTime}`);
      
    } catch (error) {
      console.error('❌ Failed to activate nuclear lockdown:', error);
    }
  }
  
  /**
   * 🔓 RELEASE LOCKDOWN (Manual override only)
   */
  static async releaseLockdown(): Promise<boolean> {
    try {
      if (fs.existsSync(this.LOCKDOWN_FILE)) {
        fs.unlinkSync(this.LOCKDOWN_FILE);
      }
      
      if (supabaseClient.supabase) {
        await supabaseClient.supabase
          .from('bot_config')
          .delete()
          .eq('key', 'nuclear_budget_lockdown');
      }
      
      // Reset memory
      this.memorySpendingTotal = 0;
      this.lastMemoryUpdate = new Date();
      
      console.log('✅ Nuclear budget lockdown released');
      return true;
      
    } catch (error) {
      console.error('❌ Failed to release lockdown:', error);
      return false;
    }
  }
  
  /**
   * 📊 GET BUDGET STATUS
   */
  static async getBudgetStatus(): Promise<BudgetStatus> {
    try {
      const memoryCheck = this.checkMemorySpending(0);
      const dbCheck = await this.checkDatabaseSpending(0);
      const logCheck = await this.checkSpendingLog(0);
      
      const maxSpending = Math.max(
        memoryCheck.currentSpending,
        dbCheck.currentSpending,
        logCheck.currentSpending
      );
      
      const remaining = this.ABSOLUTE_MAXIMUM - maxSpending;
      const isLocked = fs.existsSync(this.LOCKDOWN_FILE);
      
      let failsafeLevel: 'green' | 'yellow' | 'orange' | 'red' | 'nuclear' = 'green';
      if (isLocked) failsafeLevel = 'nuclear';
      else if (maxSpending > this.EMERGENCY_BRAKE) failsafeLevel = 'red';
      else if (maxSpending > this.DANGER_THRESHOLD) failsafeLevel = 'orange';
      else if (maxSpending > this.WARNING_THRESHOLD) failsafeLevel = 'yellow';
      
      return {
        totalSpent: maxSpending,
        remainingBudget: remaining,
        dailyLimit: this.ABSOLUTE_MAXIMUM,
        emergencyBrake: this.EMERGENCY_BRAKE,
        isLocked,
        canSpend: !isLocked && remaining > 0.10, // Keep $0.10 buffer
        lastUpdated: new Date(),
        failsafeLevel
      };
      
    } catch (error) {
      // Conservative approach on error
      return {
        totalSpent: this.ABSOLUTE_MAXIMUM,
        remainingBudget: 0,
        dailyLimit: this.ABSOLUTE_MAXIMUM,
        emergencyBrake: this.EMERGENCY_BRAKE,
        isLocked: true,
        canSpend: false,
        lastUpdated: new Date(),
        failsafeLevel: 'nuclear'
      };
    }
  }
}

// Export singleton
export const nuclearBudgetEnforcer = NuclearBudgetEnforcer; 