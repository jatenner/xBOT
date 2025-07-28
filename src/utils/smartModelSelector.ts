/**
 * 🤖 SMART MODEL SELECTOR
 * Automatically chooses the most cost-effective OpenAI model based on budget status
 */

import { EmergencyBudgetLockdown } from './emergencyBudgetLockdown';

export interface ModelSelection {
  model: string;
  maxTokens: number;
  reason: string;
  estimatedCost: number;
}

export class SmartModelSelector {
  private static readonly MODELS = {
    'gpt-4o': {
      costPer1kTokens: 0.0025,
      quality: 'premium',
      use: 'high-quality content generation'
    },
    'gpt-4o-mini': {
      costPer1kTokens: 0.00015,
      quality: 'good',
      use: 'standard content generation, analysis'
    },
    'gpt-3.5-turbo': {
      costPer1kTokens: 0.0005,
      quality: 'basic',
      use: 'simple tasks, fallback operations'
    }
  };

  /**
   * 🎯 SELECT OPTIMAL MODEL BASED ON BUDGET AND TASK
   */
  static async selectModel(
    taskType: 'content_generation' | 'analysis' | 'simple_task',
    requestedTokens: number = 1000
  ): Promise<ModelSelection> {
    try {
      console.log(`🤖 === SMART MODEL SELECTION ===`);
      console.log(`📋 Task: ${taskType}, Tokens: ${requestedTokens}`);

      // Get current budget status
      let budgetStatus: any;
      
      try {
        budgetStatus = await EmergencyBudgetLockdown.isLockedDown();
      } catch (error) {
        console.error('❌ Model selection failed, using fallback:', error);
        budgetStatus = {
          lockdownActive: false,
          totalSpent: 0,
          dailyLimit: 7.5,
          lockdownReason: 'Budget check failed - using fallback'
        };
      }
      
      if (!budgetStatus || typeof budgetStatus !== 'object') {
        budgetStatus = {
          lockdownActive: false,
          totalSpent: 0,
          dailyLimit: 7.5,
          lockdownReason: 'Invalid budget status - using fallback'
        };
      }
      
      const remainingBudget = (budgetStatus.dailyLimit || 7.5) - (budgetStatus.totalSpent || 0);
      
      console.log(`💰 Remaining budget: $${remainingBudget.toFixed(2)}`);

      // Calculate estimated costs for each model
      const costs = Object.entries(this.MODELS).map(([model, config]) => {
        const estimatedCost = (requestedTokens / 1000) * config.costPer1kTokens;
        return { model, config, estimatedCost };
      });

      // Selection logic based on budget and task importance
      let selectedModel: string;
      let reason: string;
      let maxTokens: number;

      if (remainingBudget >= 2.0) {
        // High budget - use premium models
        if (taskType === 'content_generation') {
          selectedModel = 'gpt-4o';
          maxTokens = Math.min(requestedTokens, 2000);
          reason = 'High budget: Using premium model for content generation';
        } else {
          selectedModel = 'gpt-4o-mini';
          maxTokens = Math.min(requestedTokens, 1500);
          reason = 'High budget: Using efficient model for analysis';
        }
      } else if (remainingBudget >= 1.0) {
        // Medium budget - use efficient models
        selectedModel = 'gpt-4o-mini';
        maxTokens = Math.min(requestedTokens, 1000);
        reason = 'Medium budget: Using cost-efficient model';
      } else if (remainingBudget >= 0.5) {
        // Low budget - use fallback models
        selectedModel = 'gpt-3.5-turbo';
        maxTokens = Math.min(requestedTokens, 800);
        reason = 'Low budget: Using fallback model to preserve operations';
      } else {
        // Critical budget - minimal operations only
        selectedModel = 'gpt-3.5-turbo';
        maxTokens = Math.min(requestedTokens, 500);
        reason = 'Critical budget: Minimal operations with cheapest model';
      }

      const selectedConfig = this.MODELS[selectedModel];
      const estimatedCost = (maxTokens / 1000) * selectedConfig.costPer1kTokens;

      console.log(`✅ Selected: ${selectedModel} (${maxTokens} tokens)`);
      console.log(`💵 Estimated cost: $${estimatedCost.toFixed(4)}`);
      console.log(`📝 Reason: ${reason}`);

      return {
        model: selectedModel,
        maxTokens,
        reason,
        estimatedCost
      };

    } catch (error) {
      console.error('❌ Model selection failed, using fallback:', error);
      return {
        model: 'gpt-3.5-turbo',
        maxTokens: 500,
        reason: 'Error fallback: Using cheapest model',
        estimatedCost: 0.00025
      };
    }
  }

  /**
   * 🔄 GET FALLBACK MODEL (CHEAPEST OPTION)
   */
  static getFallbackModel(): ModelSelection {
    return {
      model: 'gpt-3.5-turbo',
      maxTokens: 500,
      reason: 'Emergency fallback: Cheapest model available',
      estimatedCost: 0.00025
    };
  }

  /**
   * 📊 GET MODEL PRICING INFO
   */
  static getModelInfo(model: string) {
    return this.MODELS[model] || this.MODELS['gpt-3.5-turbo'];
  }
} 