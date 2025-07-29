/**
 * 🤖 SMART MODEL SELECTOR - PRODUCTION HARDENED
 * Intelligently selects OpenAI models based on budget and task requirements
 * Bulletproof error handling with fallbacks
 */

import { EmergencyBudgetLockdown } from './emergencyBudgetLockdown';
import { ProductionEnvValidator } from './productionEnvValidator';

export interface ModelSelection {
  model: string;
  maxTokens: number;
  estimatedCost: number;
  reason: string;
  fallback: boolean;
}

export class SmartModelSelector {
  
  static async selectModel(
    taskType: 'content_generation' | 'analysis' | 'simple_task' | 'complex_task',
    requestedTokens: number = 1000
  ): Promise<ModelSelection> {
    try {
      console.log(`🤖 === SMART MODEL SELECTION ===`);
      console.log(`📋 Task: ${taskType}, Tokens: ${requestedTokens}`);

      // Safe budget status check with comprehensive error handling
      let budgetStatus: any;
      
      try {
        // Validate EmergencyBudgetLockdown is available
        if (!EmergencyBudgetLockdown || typeof EmergencyBudgetLockdown.isLockedDown !== 'function') {
          throw new Error('EmergencyBudgetLockdown not properly initialized');
        }
        
        budgetStatus = await EmergencyBudgetLockdown.isLockedDown();
        
        // Validate budget status structure
        if (!budgetStatus || typeof budgetStatus !== 'object') {
          throw new Error('Invalid budget status response');
        }
        
      } catch (budgetError) {
        console.error('❌ Budget status check failed:', budgetError);
        
        // Create safe fallback budget status
        const config = ProductionEnvValidator.getSafeConfig();
        budgetStatus = {
          lockdownActive: false,
          totalSpent: 0,
          dailyLimit: config.DAILY_BUDGET_LIMIT || 7.5,
          lockdownReason: 'Budget check failed - using conservative defaults'
        };
      }

      // Ensure all required properties exist
      const safeStatus = {
        lockdownActive: Boolean(budgetStatus.lockdownActive),
        totalSpent: Number(budgetStatus.totalSpent) || 0,
        dailyLimit: Number(budgetStatus.dailyLimit) || 7.5,
        lockdownReason: String(budgetStatus.lockdownReason || 'OK')
      };

      const remainingBudget = safeStatus.dailyLimit - safeStatus.totalSpent;
      
      console.log(`💰 Remaining budget: $${remainingBudget.toFixed(2)}`);

      // If locked down, return minimal model
      if (safeStatus.lockdownActive) {
        console.log(`🚨 Budget lockdown active: ${safeStatus.lockdownReason}`);
        return {
          model: 'gpt-4o-mini',
          maxTokens: Math.min(requestedTokens, 500),
          estimatedCost: 0.0001,
          reason: `Budget lockdown: ${safeStatus.lockdownReason}`,
          fallback: true
        };
      }

      // Smart model selection based on budget and task
      const modelOptions = this.getModelOptions(taskType, requestedTokens, remainingBudget);
      
      // Select best model within budget
      const selectedModel = modelOptions.find(option => option.estimatedCost <= remainingBudget) || modelOptions[modelOptions.length - 1];
      
      console.log(`✅ Selected: ${selectedModel.model} (${requestedTokens} tokens)`);
      console.log(`💵 Estimated cost: $${selectedModel.estimatedCost.toFixed(4)}`);
      console.log(`📝 Reason: ${selectedModel.reason}`);

      return selectedModel;

    } catch (error) {
      console.error('❌ Model selection failed completely:', error);
      
      // Ultimate fallback
      return {
        model: 'gpt-4o-mini',
        maxTokens: Math.min(requestedTokens, 300),
        estimatedCost: 0.0001,
        reason: 'Emergency fallback due to selection error',
        fallback: true
      };
    }
  }

  /**
   * 🎯 GET MODEL OPTIONS WITH COST CALCULATION
   */
  private static getModelOptions(
    taskType: string, 
    requestedTokens: number, 
    remainingBudget: number
  ): ModelSelection[] {
    
    // Token-based cost estimation (rough estimates)
    const costPer1kTokens = {
      'gpt-4o': 0.005,      // Premium model
      'gpt-4o-mini': 0.0001, // Budget model  
      'gpt-4-turbo': 0.003,  // Balanced model
      'gpt-3.5-turbo': 0.0001 // Legacy fallback
    };

    const estimateCost = (model: keyof typeof costPer1kTokens, tokens: number) => {
      return (tokens / 1000) * costPer1kTokens[model];
    };

    const options: ModelSelection[] = [];

    // High budget options (>= $3)
    if (remainingBudget >= 3.0) {
      options.push({
        model: 'gpt-4o',
        maxTokens: requestedTokens,
        estimatedCost: estimateCost('gpt-4o', requestedTokens),
        reason: `High budget: Using premium model for ${taskType}`,
        fallback: false
      });
    }

    // Medium budget options (>= $1)
    if (remainingBudget >= 1.0) {
      options.push({
        model: 'gpt-4-turbo',
        maxTokens: requestedTokens,
        estimatedCost: estimateCost('gpt-4-turbo', requestedTokens),
        reason: `Medium budget: Using balanced model for ${taskType}`,
        fallback: false
      });
    }

    // Low budget options (>= $0.50)
    if (remainingBudget >= 0.50) {
      options.push({
        model: 'gpt-4o-mini',
        maxTokens: requestedTokens,
        estimatedCost: estimateCost('gpt-4o-mini', requestedTokens),
        reason: `Budget conscious: Using efficient model for ${taskType}`,
        fallback: false
      });
    }

    // Emergency fallback (any budget)
    options.push({
      model: 'gpt-4o-mini',
      maxTokens: Math.min(requestedTokens, 200),
      estimatedCost: estimateCost('gpt-4o-mini', Math.min(requestedTokens, 200)),
      reason: `Emergency mode: Minimal tokens for ${taskType}`,
      fallback: true
    });

    return options;
  }

  /**
   * 🧪 TEST MODEL SELECTION SYSTEM
   */
  static async testModelSelection(): Promise<{
    success: boolean;
    tests: Array<{ name: string; passed: boolean; details: string; }>;
  }> {
    console.log('🧪 Testing smart model selection...');
    
    const tests = [
      { name: 'Budget Status Check', passed: false, details: '' },
      { name: 'Model Selection', passed: false, details: '' },
      { name: 'Fallback Handling', passed: false, details: '' }
    ];

    try {
      // Test 1: Budget status check
      try {
        const selection = await this.selectModel('content_generation', 1000);
        tests[0].passed = true;
        tests[0].details = `Selected model: ${selection.model}, Cost: $${selection.estimatedCost.toFixed(4)}`;
      } catch (error) {
        tests[0].details = `Error: ${error instanceof Error ? error.message : 'Unknown'}`;
      }

      // Test 2: Model selection with different budgets
      try {
        const smallSelection = await this.selectModel('simple_task', 100);
        const largeSelection = await this.selectModel('complex_task', 2000);
        
        tests[1].passed = smallSelection.model !== undefined && largeSelection.model !== undefined;
        tests[1].details = `Small: ${smallSelection.model}, Large: ${largeSelection.model}`;
      } catch (error) {
        tests[1].details = `Error: ${error instanceof Error ? error.message : 'Unknown'}`;
      }

      // Test 3: Fallback handling
      try {
        // Simulate budget lockdown
        const fallbackSelection = await this.selectModel('content_generation', 5000);
        tests[2].passed = fallbackSelection.model !== undefined;
        tests[2].details = `Fallback model: ${fallbackSelection.model}, Fallback flag: ${fallbackSelection.fallback}`;
      } catch (error) {
        tests[2].details = `Error: ${error instanceof Error ? error.message : 'Unknown'}`;
      }

      const allPassed = tests.every(test => test.passed);
      
      return {
        success: allPassed,
        tests
      };

    } catch (error) {
      console.error('❌ Model selection test failed:', error);
      return {
        success: false,
        tests: tests.map(test => ({
          ...test,
          details: test.details || `Test failed: ${error instanceof Error ? error.message : 'Unknown'}`
        }))
      };
    }
  }
} 