/**
 * 🎯 HOOK OPTIMIZATION SERVICE
 * 
 * Generates and tests multiple hook variations to find the best performer
 * Integrates with content generation - enhances before full generation
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { HookAnalysisService } from './hookAnalysisService';

export interface HookVariation {
  hook: string;
  hookType: string;
  predictedScore: number;
}

export class HookOptimizationService {
  private static instance: HookOptimizationService;
  
  private constructor() {}
  
  static getInstance(): HookOptimizationService {
    if (!HookOptimizationService.instance) {
      HookOptimizationService.instance = new HookOptimizationService();
    }
    return HookOptimizationService.instance;
  }

  /**
   * Generate 3 hook variations using AI
   */
  async generateHookVariations(params: {
    topic: string;
    generator: string;
  }): Promise<HookVariation[]> {
    const prompt = `Generate 3 different hook variations (EXACTLY 7 words each) for a ${params.generator} post about "${params.topic}".

Each hook should use a DIFFERENT pattern:

1. NUMBER-FIRST: Start with percentage or specific number
   Example: "67% of people do cold showers wrong"

2. QUESTION: Start with Why/What/How/When
   Example: "Why do cold showers feel harder overtime"

3. CONTRARIAN: Challenge common belief or say opposite
   Example: "Cold showers don't work. Here's what does"

Requirements:
- EXACTLY 7 words each
- Must be complete thought
- Hook-worthy (creates curiosity)
- No generic phrases
- Make it SPECIFIC to the topic

Return JSON: { "hooks": ["hook1", "hook2", "hook3"] }`;

    try {
      const response = await createBudgetedChatCompletion({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a viral content expert specializing in attention-grabbing hooks. You always return exactly 7-word hooks.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.9, // High creativity
        max_tokens: 200,
        response_format: { type: 'json_object' }
      }, { purpose: 'hook_generation' });
      
      const parsed = JSON.parse(response.choices[0].message.content || '{}');
      const hooks = parsed.hooks || [];
      
      // Classify and score each hook
      const hookAnalysis = HookAnalysisService.getInstance();
      const variations: HookVariation[] = [];
      
      for (const hook of hooks) {
        const hookType = hookAnalysis.classifyHookType(hook);
        const predictedScore = await this.predictHookPerformance(hook, hookType, params);
        
        variations.push({
          hook,
          hookType,
          predictedScore
        });
      }
      
      return variations;
      
    } catch (error: any) {
      console.error('[HOOK_OPTIMIZER] ❌ Failed to generate hooks:', error.message);
      
      // Fallback: return generic hooks
      const hookAnalysis = HookAnalysisService.getInstance();
      return [
        {
          hook: `${params.topic} is more important than`,
          hookType: 'statement',
          predictedScore: 30
        }
      ];
    }
  }

  /**
   * Predict how well a hook will perform
   */
  private async predictHookPerformance(
    hook: string,
    hookType: string,
    params: { topic: string; generator: string }
  ): Promise<number> {
    try {
      const hookAnalysis = HookAnalysisService.getInstance();
      
      // Get historical performance for this hook type
      const typePerformance = await hookAnalysis.getHookTypePerformance();
      const thisTypePerf = typePerformance[hookType];
      
      if (!thisTypePerf || thisTypePerf.count === 0) {
        return 50; // Default score
      }
      
      // Score based on:
      // 1. Hook type historical performance
      // 2. Topic/generator combination
      let score = 0;
      
      // Hook type performance (60% weight)
      const followerScore = Math.min(100, thisTypePerf.avgFollowers * 20); // 1 follower = 20 points
      const engagementScore = Math.min(100, thisTypePerf.avgEngagement); // Direct engagement score
      score += (followerScore * 0.4) + (engagementScore * 0.2);
      
      // Specificity bonus (20% weight)
      const hasNumber = /\d+/.test(hook);
      const hasPercent = /%/.test(hook);
      const specificityBonus = (hasNumber ? 10 : 0) + (hasPercent ? 10 : 0);
      score += specificityBonus;
      
      // Contrarian bonus (20% weight)
      const contrarian = /wrong|lie|myth|don't|stop|avoid|never/i.test(hook);
      if (contrarian) score += 20;
      
      return Math.round(Math.min(100, score));
      
    } catch (error) {
      return 50; // Default on error
    }
  }

  /**
   * Select best hook from variations
   */
  selectBestHook(variations: HookVariation[]): HookVariation {
    if (variations.length === 0) {
      return {
        hook: '',
        hookType: 'statement',
        predictedScore: 0
      };
    }
    
    // Sort by predicted score
    const sorted = variations.sort((a, b) => b.predictedScore - a.predictedScore);
    
    console.log('[HOOK_OPTIMIZER] 🎯 Hook test results:');
    sorted.forEach((v, i) => {
      console.log(`  ${i + 1}. "${v.hook}" (${v.hookType}) → ${v.predictedScore}/100`);
    });
    
    return sorted[0];
  }

  /**
   * Generate and select best hook (convenience method)
   */
  async optimizeHook(params: {
    topic: string;
    generator: string;
  }): Promise<HookVariation> {
    const variations = await this.generateHookVariations(params);
    const best = this.selectBestHook(variations);
    
    console.log(`[HOOK_OPTIMIZER] ✅ Selected: "${best.hook}" (predicted: ${best.predictedScore}/100)`);
    
    return best;
  }
}

export const hookOptimizationService = HookOptimizationService.getInstance();

