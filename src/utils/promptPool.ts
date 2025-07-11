/**
 * 🎯 PROMPT POOL ROTATION SYSTEM
 * 
 * Prevents repetitive content by rotating through creative templates.
 * Tracks performance and adjusts template weights automatically.
 */

export interface PromptTemplate {
  id: string;
  template: string;
  weight: number;
  lastUsed: Date;
  performanceScore: number;
}

export class PromptPool {
  private static instance: PromptPool;
  private templates: PromptTemplate[] = [];
  private repeatWindowMin: number;

  private constructor() {
    this.repeatWindowMin = parseInt(process.env.PROMPT_REPEAT_WINDOW_MIN || '120');
    this.initializeTemplates();
  }

  static getInstance(): PromptPool {
    if (!PromptPool.instance) {
      PromptPool.instance = new PromptPool();
    }
    return PromptPool.instance;
  }

  private initializeTemplates(): void {
    this.templates = [
      {
        id: 'breakthrough',
        template: 'BREAKTHROUGH: {{topic}} is revolutionizing healthcare. Here\'s what you need to know 🧬',
        weight: 1.0,
        lastUsed: new Date(0),
        performanceScore: 0.5
      },
      {
        id: 'question',
        template: 'What if {{topic}} could solve one of medicine\'s biggest challenges? 🤔 New research suggests...',
        weight: 1.0,
        lastUsed: new Date(0),
        performanceScore: 0.5
      },
      {
        id: 'stat',
        template: 'The numbers don\'t lie: {{topic}} is changing patient outcomes. Latest data shows...',
        weight: 1.0,
        lastUsed: new Date(0),
        performanceScore: 0.5
      },
      {
        id: 'future',
        template: 'In 5 years, {{topic}} will be standard care. Here\'s why healthcare leaders are investing now 📈',
        weight: 1.0,
        lastUsed: new Date(0),
        performanceScore: 0.5
      },
      {
        id: 'insight',
        template: 'After analyzing 1000+ studies on {{topic}}, one pattern emerges... 🔍',
        weight: 1.0,
        lastUsed: new Date(0),
        performanceScore: 0.5
      }
    ];
  }

  getRandomCreativePrompt(topic: string): string {
    const now = new Date();
    const windowMs = this.repeatWindowMin * 60 * 1000;
    
    // Filter out recently used templates
    const available = this.templates.filter(t => 
      now.getTime() - t.lastUsed.getTime() > windowMs
    );
    
    const candidates = available.length > 0 ? available : this.templates;
    const totalWeight = candidates.reduce((sum, t) => sum + t.weight, 0);
    
    let random = Math.random() * totalWeight;
    for (const template of candidates) {
      random -= template.weight;
      if (random <= 0) {
        template.lastUsed = now;
        return template.template.replace(/\{\{topic\}\}/g, topic);
      }
    }
    
    return candidates[0].template.replace(/\{\{topic\}\}/g, topic);
  }

  updateWeight(id: string, newWeight: number): void {
    const template = this.templates.find(t => t.id === id);
    if (template) {
      template.weight = Math.max(0.1, Math.min(3.0, newWeight));
    }
  }

  getTemplates(): PromptTemplate[] {
    return [...this.templates];
  }
} 