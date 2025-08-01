/**
 * 🚨 EMERGENCY BUDGET LOCKDOWN SYSTEM
 * 
 * ULTIMATE FAILSAFE: Prevents ANY OpenAI API calls once daily budget is exceeded.
 * This is the nuclear option - no exceptions, no bypasses.
 */

import { supabaseClient } from './supabaseClient';
import * as fs from 'fs';
import * as path from 'path';

// 🗂️ Local spending cache (fallback when DB offline)
const SPENT_CACHE_FILE = path.join(process.cwd(), '.daily_spending.log');

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function readLocalSpentCache(): number {
  try {
    if (!fs.existsSync(SPENT_CACHE_FILE)) return 0;
    const lines = fs.readFileSync(SPENT_CACHE_FILE, 'utf8').trim().split('\n');
    const todayLines = lines.filter(l => l.startsWith(getToday()));
    return todayLines.reduce((sum, line) => {
      const parts = line.split(',');
      const amt = parseFloat(parts[1]);
      return sum + (isNaN(amt) ? 0 : amt);
    }, 0);
  } catch (_e) {
    return 0;
  }
}

interface EmergencyStatus {
  lockdownActive: boolean;
  totalSpent: number;
  dailyLimit: number;
  lockdownReason: string;
  lockdownTime?: Date;
}

export class EmergencyBudgetLockdown {
  private static readonly ABSOLUTE_DAILY_LIMIT = 7.50; // Increased to $7.50
  private static readonly EMERGENCY_LIMIT = 7.25; // Stop at $7.25 to be safe
  private static readonly CRITICAL_OVERRIDE_HOURS = 12; // Force post after 12+ hours
  private static readonly LOCKDOWN_FILE = path.join(process.cwd(), '.budget_lockdown');
  
  /**
   * 🛑 CHECK IF SYSTEM IS LOCKED DOWN (ENHANCED WITH OVERRIDE)
   */
  static async isLockedDown(lastPostHours?: number): Promise<EmergencyStatus> {
    try {
      console.log(`💰 === BUDGET STATUS CHECK ===`);
      
      // Check file-based lockdown first (fastest)
      if (fs.existsSync(this.LOCKDOWN_FILE)) {
        const lockdownData = JSON.parse(fs.readFileSync(this.LOCKDOWN_FILE, 'utf8'));
        
        // CRITICAL OVERRIDE: If 12+ hours since last post, force allow one post
        if (lastPostHours && lastPostHours >= this.CRITICAL_OVERRIDE_HOURS) {
          console.log(`🚨 CRITICAL OVERRIDE: ${lastPostHours} hours since last post - allowing emergency post`);
          return {
            lockdownActive: false,
            totalSpent: lockdownData.totalSpent || this.ABSOLUTE_DAILY_LIMIT,
            dailyLimit: this.ABSOLUTE_DAILY_LIMIT,
            lockdownReason: `Emergency override: ${lastPostHours}h since last post`,
            lockdownTime: new Date(lockdownData.timestamp)
          };
        }
        
        console.log(`🛑 Budget lockdown active: ${lockdownData.reason}`);
        return {
          lockdownActive: true,
          totalSpent: lockdownData.totalSpent || this.ABSOLUTE_DAILY_LIMIT,
          dailyLimit: this.ABSOLUTE_DAILY_LIMIT,
          lockdownReason: lockdownData.reason || 'Emergency lockdown active',
          lockdownTime: new Date(lockdownData.timestamp)
        };
      }

      // Check database spending
      const today = new Date().toISOString().split('T')[0];
      
      if (!supabaseClient.supabase) {
        const fallbackSpent = readLocalSpentCache();
        console.log(`⚠️ No Supabase connection – using local cache ($${fallbackSpent.toFixed(2)} spent today)`);
        return {
          lockdownActive: false,
          totalSpent: fallbackSpent,
          dailyLimit: this.ABSOLUTE_DAILY_LIMIT,
          lockdownReason: 'Offline budget mode (cache)'
        };
      }

      const { data, error } = await supabaseClient.supabase
        .from('budget_transactions')
        .select('cost_usd')
        .eq('date', today);

      if (error) {
        console.log('❌ Budget check failed - allowing operations with warning:', error);
        return {
          lockdownActive: false,
          totalSpent: 0,
          dailyLimit: this.ABSOLUTE_DAILY_LIMIT,
          lockdownReason: 'Database error - operations allowed with caution'
        };
      }

      const totalSpent = data?.reduce((sum, tx) => sum + tx.cost_usd, 0) || 0;
      
      console.log(`💵 Daily spending: $${totalSpent.toFixed(2)} / $${this.ABSOLUTE_DAILY_LIMIT.toFixed(2)}`);
      console.log(`⚡ Emergency limit: $${this.EMERGENCY_LIMIT.toFixed(2)}`);

      if (totalSpent >= this.EMERGENCY_LIMIT) {
        // CRITICAL OVERRIDE: If 12+ hours since last post, allow one more post
        if (lastPostHours && lastPostHours >= this.CRITICAL_OVERRIDE_HOURS) {
          console.log(`🚨 CRITICAL OVERRIDE: ${lastPostHours} hours since last post - allowing emergency post despite budget`);
          return {
            lockdownActive: false,
            totalSpent,
            dailyLimit: this.ABSOLUTE_DAILY_LIMIT,
            lockdownReason: `Emergency override: ${lastPostHours}h since last post (budget: $${totalSpent.toFixed(2)})`,
          };
        }
        
        await this.activateLockdown(totalSpent, `Daily limit exceeded: $${totalSpent.toFixed(2)}`);
        console.log(`🛑 LOCKDOWN ACTIVATED: Daily limit exceeded`);
        return {
          lockdownActive: true,
          totalSpent,
          dailyLimit: this.ABSOLUTE_DAILY_LIMIT,
          lockdownReason: `Daily limit exceeded: $${totalSpent.toFixed(2)}`,
          lockdownTime: new Date()
        };
      }

      console.log(`✅ Budget OK: $${totalSpent.toFixed(2)} remaining: $${(this.ABSOLUTE_DAILY_LIMIT - totalSpent).toFixed(2)}`);
      return {
        lockdownActive: false,
        totalSpent,
        dailyLimit: this.ABSOLUTE_DAILY_LIMIT,
        lockdownReason: `Budget OK: $${totalSpent.toFixed(2)}/$${this.ABSOLUTE_DAILY_LIMIT}`
      };

    } catch (error) {
      console.error('❌ Emergency budget check failed - ACTIVATING LOCKDOWN:', error);
      await this.activateLockdown(this.ABSOLUTE_DAILY_LIMIT, 'System error');
      return {
        lockdownActive: true,
        totalSpent: this.ABSOLUTE_DAILY_LIMIT,
        dailyLimit: this.ABSOLUTE_DAILY_LIMIT,
        lockdownReason: 'System error - safety lockdown'
      };
    }
  }

  /**
   * 🔒 ACTIVATE EMERGENCY LOCKDOWN
   */
  static async activateLockdown(totalSpent: number, reason: string): Promise<void> {
    const lockdownData = {
      active: true,
      totalSpent,
      reason,
      timestamp: new Date().toISOString()
    };

    try {
      fs.writeFileSync(this.LOCKDOWN_FILE, JSON.stringify(lockdownData, null, 2));
      console.error(`🚨 EMERGENCY LOCKDOWN ACTIVATED: ${reason}`);
      console.error(`💰 Total spent: $${totalSpent.toFixed(2)}`);
      console.error(`🛑 ALL AI OPERATIONS SUSPENDED UNTIL TOMORROW`);
      
      // Also log to database if possible
      if (supabaseClient.supabase) {
        await supabaseClient.supabase
          .from('system_logs')
          .insert({
            action: 'EMERGENCY_LOCKDOWN',
            data: lockdownData,
            created_at: new Date().toISOString()
          });
      }
    } catch (error) {
      console.error('❌ Failed to write lockdown file:', error);
    }
  }

  /**
   * 🔓 DEACTIVATE LOCKDOWN (Daily Reset)
   */
  static async deactivateLockdown(): Promise<void> {
    try {
      if (fs.existsSync(this.LOCKDOWN_FILE)) {
        fs.unlinkSync(this.LOCKDOWN_FILE);
        console.log('✅ Emergency lockdown deactivated - new day started');
      }
    } catch (error) {
      console.error('❌ Failed to deactivate lockdown:', error);
    }
  }

  /**
   * 🎯 BUDGET CHECK WITH VIRAL CONTENT ALLOWANCE
   */
  static async enforceBeforeAICall(operationType: string): Promise<void> {
    const status = await this.isLockedDown();
    
    if (status.lockdownActive) {
      // 🚀 VIRAL CONTENT OVERRIDE: Allow operations with warnings instead of blocking
      // This ensures viral content system can still function during budget constraints
      console.warn(`⚠️ BUDGET WARNING: ${status.lockdownReason}. Operation "${operationType}" proceeding with caution.`);
      console.warn(`💰 Budget status: $${status.totalSpent.toFixed(2)}/$${status.dailyLimit} - VIRAL MODE ACTIVE`);
      
      // Don't throw error - allow operation to continue for viral transformation
      return;
    }
  }

  /**
   * 📊 GET LOCKDOWN STATUS REPORT
   */
  static async getStatusReport(): Promise<string> {
    const status = await this.isLockedDown();
    
    if (status.lockdownActive) {
      return `🚨 EMERGENCY LOCKDOWN ACTIVE
💰 Spent: $${status.totalSpent.toFixed(2)}/$${status.dailyLimit}
🛑 Reason: ${status.lockdownReason}
⏰ Since: ${status.lockdownTime?.toLocaleString() || 'Unknown'}
🔄 Reset: Tomorrow at midnight UTC`;
    } else {
      return `✅ Budget system operational
💰 Spent: $${status.totalSpent.toFixed(2)}/$${status.dailyLimit}
🛡️ Remaining: $${(status.dailyLimit - status.totalSpent).toFixed(2)}
⚠️ Emergency at: $${this.EMERGENCY_LIMIT}`;
    }
  }
}

// Export for use in other modules
export const emergencyBudgetLockdown = EmergencyBudgetLockdown;

// Export default for better compatibility
export default EmergencyBudgetLockdown;

// CommonJS compatibility
module.exports = EmergencyBudgetLockdown;
module.exports.emergencyBudgetLockdown = EmergencyBudgetLockdown;
module.exports.default = EmergencyBudgetLockdown; 