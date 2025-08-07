import { BudgetAwareOpenAI } from './budgetAwareOpenAI';

/**
 * AIService: single gateway for all AI generation.
 * Route every model call through here to enforce budgets and consistent prompts.
 */
export class AIService {
  private static instance: AIService;
  private client: BudgetAwareOpenAI;

  private constructor() {
    const apiKey = process.env.OPENAI_API_KEY || '';
    this.client = new BudgetAwareOpenAI(apiKey);
  }

  static getInstance(): AIService {
    if (!AIService.instance) AIService.instance = new AIService();
    return AIService.instance;
  }

  async generateText(prompt: string, opts?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    priority?: 'low' | 'medium' | 'high';
    operationType?: string;
  }): Promise<string> {
    const response = await this.client.generateContent(
      prompt,
      (opts?.priority as any) || 'medium',
      opts?.operationType || 'content_generation',
      {
        model: (opts?.model as any) || 'gpt-4o-mini',
        temperature: opts?.temperature ?? 0.7,
        maxTokens: opts?.maxTokens ?? 220,
        forTweetGeneration: true,
      }
    );

    // The wrapper may return object or string; normalize to string
    if (typeof (response as any) === 'string') return response as any;
    const content = (response as any)?.content ?? '';
    return String(content);
  }
}

export const aiService = AIService.getInstance();

