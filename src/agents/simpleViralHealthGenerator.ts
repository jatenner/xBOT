import { openaiClient } from '../utils/openaiClient';
import { emergencyBudgetLockdown } from '../utils/emergencyBudgetLockdown';

export interface SimpleHealthContent {
  content: string;
  topic: string;
  actionable: boolean;
  followGrowthPotential: number;
  simplicity: number;
}

export class SimpleViralHealthGenerator {
  
  // Simple health topics that everyone can relate to
  private healthTopics = [
    'sleep optimization',
    'hydration benefits', 
    'simple stretches',
    'walking benefits',
    'breathing techniques',
    'nutrition tips',
    'energy boosters',
    'stress reduction',
    'posture improvement',
    'brain health',
    'immune system',
    'recovery methods',
    'metabolism tips',
    'anti-aging',
    'longevity hacks'
  ];

  // Simple action verbs for health content
  private actionVerbs = [
    'eat more', 'try', 'add', 'drink', 'do', 'take', 'practice', 
    'avoid', 'include', 'start', 'stop', 'increase', 'reduce'
  ];

  // Common foods/items people can easily access
  private accessibleItems = [
    'bananas', 'water', 'green tea', 'almonds', 'blueberries', 'spinach',
    'salmon', 'avocados', 'sweet potatoes', 'turmeric', 'ginger', 'garlic',
    'dark chocolate', 'olive oil', 'walnuts', 'broccoli'
  ];

  async generateSimpleViralHealth(): Promise<SimpleHealthContent> {
    try {
      await emergencyBudgetLockdown.enforceBeforeAICall('simple-viral-health');
      
      console.log('🍌 === SIMPLE VIRAL HEALTH GENERATOR ===');
      console.log('🎯 Creating actionable health tips that drive followers');

      const topic = this.getRandomTopic();
      const content = await this.createSimpleHealthTip(topic);
      
      return {
        content,
        topic,
        actionable: true,
        followGrowthPotential: this.calculateFollowPotential(content),
        simplicity: this.calculateSimplicity(content)
      };
    } catch (error) {
      console.error('Simple health generator failed:', error);
      return this.getFallbackContent();
    }
  }

  private async createSimpleHealthTip(topic: string): Promise<string> {
    const client = openaiClient.getClient();
    if (!client) {
      throw new Error('OpenAI client not available');
    }

    const prompt = `Create a simple, viral health tip that will make people want to follow for more tips.

Style: Simple, actionable, like talking to a friend
Topic: ${topic}

EXAMPLES OF PERFECT STYLE:
"Eat more bananas. New research shows eating 2 bananas a day helps reduce inflammation in the body by producing more potassium. Simple but effective."

"Try stretching more. Here are 3 stretches for longevity: 1) Touch your toes 2) Shoulder rolls 3) Neck turns. Do them daily."

"Drink green tea instead of coffee. Studies show it boosts metabolism by 4% and reduces stress hormones. Easy switch with big benefits."

REQUIREMENTS:
- Start with simple action (eat more X, try X, drink X)
- Include ONE specific benefit with a number if possible
- Make it something ANYONE can do
- Keep it conversational and friendly
- NO hashtags, NO promotional language
- Under 200 characters
- End with something that encourages engagement

Create a simple health tip about ${topic}:`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You create simple, viral health tips that get follows.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 100,
      temperature: 0.7
    });

    return response.choices[0]?.message?.content?.trim() || this.createFallbackTip(topic);
  }

  private createFallbackTip(topic: string): string {
    const templates = [
      `Eat more {item}. Research shows it can {benefit} by {number}%. Simple change, big impact.`,
      `Try {action} for {topic}. Studies found {number}% improvement in {metric}. Anyone can do this.`,
      `Drink more {liquid}. New study: {number} glasses daily {benefit}. Easy upgrade to your routine.`,
      `Do this {frequency}: {simple_action}. Reduces {problem} by {number}%. Takes 2 minutes.`,
      `Add {item} to your diet. Contains {nutrient} that {benefit}. Available at any grocery store.`
    ];

    const template = templates[Math.floor(Math.random() * templates.length)];
    const item = this.accessibleItems[Math.floor(Math.random() * this.accessibleItems.length)];
    const number = Math.floor(Math.random() * 40) + 10; // 10-50%
    
    return template
      .replace('{item}', item)
      .replace('{number}', number.toString())
      .replace('{topic}', topic)
      .replace('{action}', this.actionVerbs[Math.floor(Math.random() * this.actionVerbs.length)])
      .replace('{benefit}', 'boost your health')
      .replace('{metric}', 'energy levels')
      .replace('{liquid}', 'water')
      .replace('{frequency}', 'daily')
      .replace('{simple_action}', 'deep breathing')
      .replace('{problem}', 'stress')
      .replace('{nutrient}', 'antioxidants');
  }

  private getRandomTopic(): string {
    return this.healthTopics[Math.floor(Math.random() * this.healthTopics.length)];
  }

  private calculateFollowPotential(content: string): number {
    let score = 50; // Base score

    // Actionable language boosts follow potential
    if (content.includes('eat ') || content.includes('try ') || content.includes('drink ')) score += 20;
    
    // Specific numbers build credibility
    if (/\d+%|\d+x|\d+ \w+/.test(content)) score += 15;
    
    // Simple language is more followable
    if (content.split(' ').length <= 25) score += 15;
    
    // Questions drive engagement
    if (content.includes('?')) score += 10;

    return Math.min(100, score);
  }

  private calculateSimplicity(content: string): number {
    let score = 100;
    
    // Deduct for complex words
    const complexWords = ['sophisticated', 'optimization', 'bioavailability', 'inflammation'];
    complexWords.forEach(word => {
      if (content.toLowerCase().includes(word)) score -= 10;
    });
    
    // Deduct for long sentences
    if (content.length > 200) score -= 20;
    
    // Deduct for medical jargon
    if (content.includes('studies show') || content.includes('research indicates')) score -= 15;
    
    return Math.max(0, score);
  }

  private getFallbackContent(): SimpleHealthContent {
    const fallbacks = [
      "Eat 2 bananas daily. Studies show it reduces inflammation by 23% through potassium. Simple, cheap, effective. Who's trying this?",
      "Drink green tea instead of coffee. Boosts metabolism 4% and reduces stress hormones. Easy switch with big benefits. What's your go-to drink?",
      "Try these 3 stretches daily: touch toes, shoulder rolls, neck turns. Improves flexibility and reduces aging. 2 minutes total. Too easy not to try?",
      "Walk 7,000 steps daily. Harvard study: reduces heart disease risk 30%. No gym needed. Track with your phone. Starting today?",
      "Eat blueberries for breakfast. Contains antioxidants that boost brain function 15%. Nature's brain food. What's your favorite berry?"
    ];

    const content = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    
    return {
      content,
      topic: 'general health',
      actionable: true,
      followGrowthPotential: 85,
      simplicity: 90
    };
  }
} 