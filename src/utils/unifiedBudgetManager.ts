/**
 * 🏦 UNIFIED BUDGET MANAGER
 * 
 * Single source of truth for ALL budget decisions.
 * Replaces 6+ overlapping budget systems with one efficient manager.
 * 
 * Features:
 * - Sub-50ms budget checks
 * - File-based emergency lockdown
 * - Smart operation prioritization
 * - Real-time cost tracking
 */

import { supabaseClient } from './supabaseClient';
import * as fs from 'fs';
import * as path from 'path';

export interface BudgetStatus {
  dailySpent: number;
  dailyLimit: number;
  remainingBudget: number;
  isLocked: boolean;
  canAffordOperation: boolean;
  urgencyLevel: 'normal' | 'caution' | 'critical' | 'emergency';
  recommendedAction: string;
}

export interface OperationCost {
  type: 'content_generation' | 'decision_making' | 'quality_check' | 'image_selection' | 'learning';
  estimatedCost: number;
  priority: 'critical' | 'important' | 'optional';
  fallbackAvailable: boolean;
}

export class UnifiedBudgetManager {
  private static instance: UnifiedBudgetManager;
  private static readonly DAILY_LIMIT = 5.00;
  private static readonly EMERGENCY_LIMIT = 4.75;
  private static readonly LOCKDOWN_FILE = '.budget_lockdown';
  
  // Budget allocation (optimized for content over decisions) - $5.00 budget
  private static readonly ALLOCATION = {
    content_generation: 0.70,    // $3.50 - Core content creation
    decision_making: 0.10,       // $0.50 - Strategic decisions only
    quality_check: 0.10,         // $0.50 - Essential quality gates
    image_selection: 0.05,       // $0.25 - Minimal image AI
    learning: 0.05               // $0.25 - Critical learning only
  };

  private cachedStatus: BudgetStatus | null = null;
  private lastCacheUpdate = 0;
  private readonly CACHE_TTL = 30000; // 30 seconds

  static getInstance(): UnifiedBudgetManager {
    if (!UnifiedBudgetManager.instance) {
      UnifiedBudgetManager.instance = new UnifiedBudgetManager();
    }
    return UnifiedBudgetManager.instance;
  }

  /**
   * 🚀 FAST BUDGET CHECK - Sub-50ms performance
   */
  async canAfford(operation: OperationCost): Promise<{
    approved: boolean;
    reason: string;
    remainingBudget: number;
    alternativeAction?: string;
  }> {
    try {
      // 1. Emergency lockdown check (fastest - file system)
      const lockdownStatus = this.checkEmergencyLockdown();
      if (lockdownStatus.isLocked) {
        return {
          approved: false,
          reason: 'Emergency budget lockdown active',
          remainingBudget: 0,
          alternativeAction: operation.fallbackAvailable ? 'Use cached/fallback content' : 'Wait until tomorrow'
        };
      }

      // 2. Get current status (cached when possible)
      const status = await this.getBudgetStatus();
      
      // 3. Check urgency level
      if (status.urgencyLevel === 'emergency') {
        return {
          approved: operation.priority === 'critical',
          reason: `Emergency mode - only critical operations (${operation.priority})`,
          remainingBudget: status.remainingBudget,
          alternativeAction: 'Use rule-based decisions or cached content'
        };
      }

      // 4. Check if we can afford this specific operation
      const allocated = UnifiedBudgetManager.DAILY_LIMIT * UnifiedBudgetManager.ALLOCATION[operation.type];
      const categorySpent = await this.getCategorySpending(operation.type);
      
      if (categorySpent + operation.estimatedCost > allocated) {
        return {
          approved: false,
          reason: `${operation.type} budget exhausted: $${categorySpent.toFixed(4)}/$${allocated.toFixed(2)}`,
          remainingBudget: status.remainingBudget,
          alternativeAction: this.getAlternativeAction(operation.type)
        };
      }

      // 5. Check overall remaining budget
      if (status.remainingBudget < operation.estimatedCost) {
        return {
          approved: false,
          reason: `Insufficient daily budget: need $${operation.estimatedCost.toFixed(4)}, have $${status.remainingBudget.toFixed(4)}`,
          remainingBudget: status.remainingBudget,
          alternativeAction: this.getAlternativeAction(operation.type)
        };
      }

      return {
        approved: true,
        reason: `Approved ${operation.type} operation`,
        remainingBudget: status.remainingBudget - operation.estimatedCost
      };

    } catch (error) {
      console.error('❌ Budget check failed:', error);
      return {
        approved: operation.priority === 'critical' && operation.fallbackAvailable,
        reason: 'Budget system error - conservative denial',
        remainingBudget: 0,
        alternativeAction: 'Use fallback systems only'
      };
    }
  }

  /**
   * 💰 RECORD SPENDING - Fast operation recording
   */
  async recordSpending(operation: OperationCost, actualCost: number): Promise<void> {
    try {
      // Record in database for tracking
      if (supabaseClient.supabase) {
        await supabaseClient.supabase
          .from('budget_transactions')
          .insert({
            date: new Date().toISOString().split('T')[0],
            operation_type: operation.type,
            cost_usd: actualCost,
            description: `${operation.priority.toUpperCase()}: ${operation.type}`,
            created_at: new Date().toISOString()
          });
      }

      // Clear cache to force refresh
      this.cachedStatus = null;

      // Check if we need emergency lockdown
      const newStatus = await this.getBudgetStatus();
      if (newStatus.dailySpent >= UnifiedBudgetManager.EMERGENCY_LIMIT) {
        await this.activateEmergencyLockdown(newStatus.dailySpent, 'Daily limit reached');
      }

      console.log(`💰 Recorded: $${actualCost.toFixed(4)} for ${operation.type} (${operation.priority})`);

    } catch (error) {
      console.error('❌ Failed to record spending:', error);
    }
  }

  /**
   * 📊 GET BUDGET STATUS - Cached for performance
   */
  async getBudgetStatus(): Promise<BudgetStatus> {
    const now = Date.now();
    
    // Return cached status if still valid
    if (this.cachedStatus && (now - this.lastCacheUpdate) < this.CACHE_TTL) {
      return this.cachedStatus;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      
      let dailySpent = 0;
      if (supabaseClient.supabase) {
        const { data } = await supabaseClient.supabase
          .from('budget_transactions')
          .select('cost_usd')
          .eq('date', today);
        
        dailySpent = data?.reduce((sum, tx) => sum + tx.cost_usd, 0) || 0;
      }

      const remainingBudget = Math.max(0, UnifiedBudgetManager.DAILY_LIMIT - dailySpent);
      const usagePercent = dailySpent / UnifiedBudgetManager.DAILY_LIMIT;

      const status: BudgetStatus = {
        dailySpent,
        dailyLimit: UnifiedBudgetManager.DAILY_LIMIT,
        remainingBudget,
        isLocked: dailySpent >= UnifiedBudgetManager.EMERGENCY_LIMIT,
        canAffordOperation: remainingBudget > 0.10, // Need at least $0.10 buffer
        urgencyLevel: this.calculateUrgencyLevel(usagePercent),
        recommendedAction: this.getRecommendedAction(usagePercent)
      };

      // Cache the status
      this.cachedStatus = status;
      this.lastCacheUpdate = now;

      return status;

    } catch (error) {
      console.error('❌ Budget status check failed:', error);
      
      // Return emergency status on error
      return {
        dailySpent: UnifiedBudgetManager.DAILY_LIMIT,
        dailyLimit: UnifiedBudgetManager.DAILY_LIMIT,
        remainingBudget: 0,
        isLocked: true,
        canAffordOperation: false,
        urgencyLevel: 'emergency',
        recommendedAction: 'System error - all operations suspended'
      };
    }
  }

  /**
   * 🚨 EMERGENCY LOCKDOWN SYSTEM
   */
  private checkEmergencyLockdown(): { isLocked: boolean; reason?: string } {
    try {
      if (fs.existsSync(UnifiedBudgetManager.LOCKDOWN_FILE)) {
        const lockdownData = JSON.parse(fs.readFileSync(UnifiedBudgetManager.LOCKDOWN_FILE, 'utf8'));
        return {
          isLocked: true,
          reason: lockdownData.reason || 'Emergency lockdown active'
        };
      }
      return { isLocked: false };
    } catch (error) {
      // If we can't read lockdown file, assume locked for safety
      return { isLocked: true, reason: 'Lockdown file read error' };
    }
  }

  private async activateEmergencyLockdown(totalSpent: number, reason: string): Promise<void> {
    const lockdownData = {
      active: true,
      totalSpent,
      reason,
      timestamp: new Date().toISOString()
    };

    try {
      fs.writeFileSync(UnifiedBudgetManager.LOCKDOWN_FILE, JSON.stringify(lockdownData, null, 2));
      console.error(`🚨 EMERGENCY LOCKDOWN: ${reason} - $${totalSpent.toFixed(2)} spent`);
    } catch (error) {
      console.error('❌ Failed to activate lockdown:', error);
    }
  }

  /**
   * 🔄 DAILY RESET - Called at midnight UTC
   */
  async resetDailyBudget(): Promise<void> {
    try {
      // Remove lockdown file
      if (fs.existsSync(UnifiedBudgetManager.LOCKDOWN_FILE)) {
        fs.unlinkSync(UnifiedBudgetManager.LOCKDOWN_FILE);
      }

      // Clear cache
      this.cachedStatus = null;

      console.log(`🌅 Daily budget reset - $${UnifiedBudgetManager.DAILY_LIMIT} available`);
    } catch (error) {
      console.error('❌ Daily reset failed:', error);
    }
  }

  /**
   * 📈 HELPER METHODS
   */
  private async getCategorySpending(type: string): Promise<number> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      if (!supabaseClient.supabase) return 0;

      const { data } = await supabaseClient.supabase
        .from('budget_transactions')
        .select('cost_usd')
        .eq('date', today)
        .eq('operation_type', type);

      return data?.reduce((sum, tx) => sum + tx.cost_usd, 0) || 0;
    } catch (error) {
      return 0;
    }
  }

  private calculateUrgencyLevel(usagePercent: number): 'normal' | 'caution' | 'critical' | 'emergency' {
    if (usagePercent >= 0.93) return 'emergency';  // $2.80+
    if (usagePercent >= 0.80) return 'critical';   // $2.40+
    if (usagePercent >= 0.60) return 'caution';    // $1.80+
    return 'normal';
  }

  private getRecommendedAction(usagePercent: number): string {
    if (usagePercent >= 0.93) return '🚨 EMERGENCY: All operations suspended';
    if (usagePercent >= 0.80) return '⚠️ CRITICAL: Only essential content generation';
    if (usagePercent >= 0.60) return '💡 CAUTION: Prioritize content over decisions';
    return '✅ NORMAL: All operations allowed';
  }

  private getAlternativeAction(operationType: string): string {
    const alternatives = {
      content_generation: 'Use cached content templates or evergreen recycling',
      decision_making: 'Use rule-based decisions and heuristics',
      quality_check: 'Use basic text validation and length checks',
      image_selection: 'Use cached image recommendations or skip images',
      learning: 'Defer learning updates to tomorrow'
    };
    
    return alternatives[operationType] || 'Use fallback systems';
  }

  /**
   * 📊 QUICK STATUS CHECK - Ultra-fast for frequent calls
   */
  canAffordQuick(estimatedCost: number): boolean {
    const lockdown = this.checkEmergencyLockdown();
    if (lockdown.isLocked) return false;
    
    if (this.cachedStatus) {
      return this.cachedStatus.remainingBudget >= estimatedCost;
    }
    
    // Conservative estimate when no cache
    return estimatedCost <= 0.50; // Allow small operations
  }

  /**
   * 📈 GET BUDGET REPORT
   */
  async getBudgetReport(): Promise<string> {
    const status = await this.getBudgetStatus();
    
    return `
🏦 === UNIFIED BUDGET MANAGER ===
💰 Daily Spent: $${status.dailySpent.toFixed(4)}
💵 Remaining: $${status.remainingBudget.toFixed(4)}
📊 Usage: ${((status.dailySpent / status.dailyLimit) * 100).toFixed(1)}%
🚨 Status: ${status.urgencyLevel.toUpperCase()}
💡 Action: ${status.recommendedAction}

📈 ALLOCATIONS:
- Content Gen: $${(UnifiedBudgetManager.DAILY_LIMIT * UnifiedBudgetManager.ALLOCATION.content_generation).toFixed(2)}
- Decisions: $${(UnifiedBudgetManager.DAILY_LIMIT * UnifiedBudgetManager.ALLOCATION.decision_making).toFixed(2)}
- Quality: $${(UnifiedBudgetManager.DAILY_LIMIT * UnifiedBudgetManager.ALLOCATION.quality_check).toFixed(2)}
- Images: $${(UnifiedBudgetManager.DAILY_LIMIT * UnifiedBudgetManager.ALLOCATION.image_selection).toFixed(2)}
- Learning: $${(UnifiedBudgetManager.DAILY_LIMIT * UnifiedBudgetManager.ALLOCATION.learning).toFixed(2)}
`;
  }
}

// Export singleton instance
export const unifiedBudget = UnifiedBudgetManager.getInstance(); 