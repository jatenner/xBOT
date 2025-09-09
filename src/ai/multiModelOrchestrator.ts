/**
 * 🧠 MULTI-MODEL AI ORCHESTRATOR
 * Uses multiple AI models for superior content generation
 */

import OpenAI from 'openai';

export class MultiModelOrchestrator {
  private openai: OpenAI;
  
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * 🎯 ENSEMBLE CONTENT GENERATION
   * Use multiple models and pick the best result
   */
  async generateEnsembleContent(prompt: string): Promise<{
    content: string;
    winningModel: string;
    confidence: number;
    allVariations: Array<{model: string, content: string, score: number}>;
  }> {
    console.log('🧠 ENSEMBLE: Generating content with multiple AI models...');

    // Generate content with different model configurations
    const models = [
      { name: 'gpt-4o-mini-creative', model: 'gpt-4o-mini', temperature: 0.95, top_p: 0.9 }, // COST_FIX
      { name: 'gpt-4o-mini-balanced', model: 'gpt-4o-mini', temperature: 0.8, top_p: 0.95 }, // COST_FIX
      { name: 'gpt-4o-mini-precise', model: 'gpt-4o-mini', temperature: 0.6, top_p: 0.8 }, // COST_FIX
      { name: 'gpt-4o-mini-turbo', model: 'gpt-4o-mini', temperature: 0.85, top_p: 0.9 } // COST_FIX
    ];

    const variations = await Promise.all(
      models.map(async (config) => {
        try {
          // EMERGENCY_COST_CHECK: Check daily budget before expensive API calls
        const openAIService = OpenAIService.getInstance();
        const budgetStatus = await openAIService.getCurrentBudgetStatus();
        if (budgetStatus.isOverBudget) {
          throw new Error('🚨 COST_LIMIT: Daily OpenAI budget exceeded - operation blocked');
        }
        
        const response = await this.openai.chat.completions.create({
            model: config.model,
            messages: [{ role: 'user', content: prompt }],
            temperature: config.temperature,
            top_p: config.top_p,
            max_tokens: 500
          });

          const content = response.choices[0]?.message?.content || '';
          const score = await this.scoreContent(content);

          return {
            model: config.name,
            content,
            score
          };
        } catch (error) {
          return {
            model: config.name,
            content: '',
            score: 0
          };
        }
      })
    );

    // Find the best variation
    const winner = variations.reduce((best, current) => 
      current.score > best.score ? current : best
    );

    console.log(`🏆 ENSEMBLE_WINNER: ${winner.model} (score: ${winner.score.toFixed(2)})`);

    return {
      content: winner.content,
      winningModel: winner.model,
      confidence: winner.score,
      allVariations: variations
    };
  }

  /**
   * 📊 Score content quality
   */
  private async scoreContent(content: string): Promise<number> {
    // Scoring criteria
    const hasNumbers = /\d+/.test(content) ? 10 : 0;
    const hasSpecifics = /(study|research|trial|protocol|method)/i.test(content) ? 15 : 0;
    const hasAuthority = /(harvard|stanford|mayo|johns hopkins|mit)/i.test(content) ? 20 : 0;
    const hasAction = /(try|start|avoid|use|take|do)/i.test(content) ? 10 : 0;
    const hasHook = content.length > 20 && /^[A-Z]/.test(content) ? 10 : 0;
    const lengthScore = content.length > 100 && content.length < 270 ? 15 : 0;
    const uniqueness = content.split(' ').length > 20 ? 10 : 0;
    const noHashtags = !/#/.test(content) ? 10 : 0;
    const noQuotes = !/"|'/.test(content) ? 10 : 0;

    return hasNumbers + hasSpecifics + hasAuthority + hasAction + hasHook + lengthScore + uniqueness + noHashtags + noQuotes;
  }
}
