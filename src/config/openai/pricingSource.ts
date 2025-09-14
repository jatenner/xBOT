/**
 * Dynamic OpenAI Pricing Source with Environment Override
 * Allows price updates without code deploys
 */

import { OPENAI_PRICING, ModelPricing } from './pricing';

export interface PricingSource {
  getModelPricing(model: string): ModelPricing;
  updatePricing(model: string, pricing: ModelPricing): void;
  getAllPricing(): Record<string, ModelPricing>;
}

class DynamicPricingSource implements PricingSource {
  private overrides: Record<string, ModelPricing> = {};
  
  constructor() {
    this.loadEnvironmentOverrides();
  }
  
  private loadEnvironmentOverrides(): void {
    // Support JSON override via environment
    const priceOverride = process.env.OPENAI_PRICING_OVERRIDE;
    if (priceOverride) {
      try {
        const parsed = JSON.parse(priceOverride);
        this.overrides = { ...this.overrides, ...parsed };
        console.log(`💰 PRICING_OVERRIDE: Loaded ${Object.keys(parsed).length} model price overrides`);
      } catch (error) {
        console.error('❌ PRICING_OVERRIDE: Invalid JSON in OPENAI_PRICING_OVERRIDE');
      }
    }
    
    // Support individual model overrides
    Object.keys(process.env).forEach(key => {
      const match = key.match(/^OPENAI_PRICE_(.+)_INPUT$/);
      if (match) {
        const model = match[1].toLowerCase().replace(/_/g, '-');
        const outputKey = `OPENAI_PRICE_${match[1]}_OUTPUT`;
        
        const inputPrice = parseFloat(process.env[key] || '0');
        const outputPrice = parseFloat(process.env[outputKey] || '0');
        
        if (inputPrice > 0 && outputPrice > 0) {
          this.overrides[model] = { input: inputPrice, output: outputPrice };
          console.log(`💰 PRICING_OVERRIDE: ${model} = $${inputPrice}/$${outputPrice} per 1K tokens`);
        }
      }
    });
  }
  
  getModelPricing(model: string): ModelPricing {
    // Check environment overrides first
    if (this.overrides[model]) {
      return this.overrides[model];
    }
    
    // Fall back to static pricing
    const baseModel = model.split('-').slice(0, 2).join('-');
    return OPENAI_PRICING[model] || 
           OPENAI_PRICING[baseModel] || 
           OPENAI_PRICING['gpt-4o-mini']; // Safe fallback
  }
  
  updatePricing(model: string, pricing: ModelPricing): void {
    this.overrides[model] = pricing;
    console.log(`💰 PRICING_UPDATE: ${model} = $${pricing.input}/$${pricing.output} per 1K tokens`);
  }
  
  getAllPricing(): Record<string, ModelPricing> {
    return { ...OPENAI_PRICING, ...this.overrides };
  }
}

// Singleton instance
export const pricingSource = new DynamicPricingSource();

// Convenience functions
export function getModelPricing(model: string): ModelPricing {
  return pricingSource.getModelPricing(model);
}

export function updateModelPricing(model: string, pricing: ModelPricing): void {
  pricingSource.updatePricing(model, pricing);
}

/**
 * Environment variable examples:
 * 
 * JSON Override:
 * OPENAI_PRICING_OVERRIDE='{"gpt-4o":{"input":0.0020,"output":0.0080}}'
 * 
 * Individual Model Override:
 * OPENAI_PRICE_GPT_4O_INPUT=0.0020
 * OPENAI_PRICE_GPT_4O_OUTPUT=0.0080
 */
