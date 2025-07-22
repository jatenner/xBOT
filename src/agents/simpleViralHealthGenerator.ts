import { openaiClient } from '../utils/openaiClient';

interface SimpleHealthContent {
  content: string;
  followGrowthPotential: number;
  simplicity: number;
}

export class SimpleViralHealthGenerator {
  private healthTopics: string[] = [
    'bananas',
    'stretching',
    'green tea',
    'walking',
    'water',
    'sleep',
    'breathing',
    'posture',
    'vegetables',
    'protein'
  ];

  async generateSimpleViralHealth(): Promise<SimpleHealthContent> {
    try {
      // Generate content using simple approach
      const topic = this.getRandomTopic();
      console.log(`🍌 Generating simple health tip about: ${topic}`);
      
      const content = await this.createSimpleHealthTip(topic);
      
      return {
        content,
        followGrowthPotential: this.calculateFollowPotential(content),
        simplicity: this.calculateSimplicity(content)
      };
    } catch (error) {
      console.error('Simple health generator failed:', error);
      return this.getFallbackContent();
    }
  }

  private async createSimpleHealthTip(topic: string): Promise<string> {
    try {
      const prompt = `Create a simple, viral health tip that will make people want to follow for more tips.

Style: Simple, actionable, like talking to a friend
Topic: ${topic}

EXAMPLES OF PERFECT STYLE:
"Eat 2 bananas daily. New research shows it reduces inflammation by 23% through potassium. Simple, cheap, effective. Who's trying this?"

"Try these 3 stretches: touch toes, shoulder rolls, neck turns. Harvard study shows 15% flexibility improvement. 2 minutes total. Too easy?"

"Drink green tea instead of coffee. Boosts metabolism 4% and reduces stress hormones. Easy switch with big benefits. What's your go-to?"

RULES:
- No hashtags ever
- Start with simple action
- Add specific benefit with number/percentage 
- Keep under 250 characters
- End with engagement question
- Sound human and conversational
- Focus on ${topic}

Generate ONE simple health tip:`;

      // Use our simplified openaiClient
      const response = await openaiClient.generateCompletion(prompt);
      
      let tip = response.trim();
      
      // Ensure no hashtags
      tip = tip.replace(/#\w+/g, '').trim();
      
      // Ensure it's concise
      if (tip.length > 250) {
        tip = tip.substring(0, 240) + '...';
      }
      
      return tip;
    } catch (error) {
      console.error('AI generation failed, using fallback:', error);
      return this.getTopicFallback(topic);
    }
  }

  private getRandomTopic(): string {
    return this.healthTopics[Math.floor(Math.random() * this.healthTopics.length)];
  }

  private getTopicFallback(topic: string): string {
    const fallbacks: { [key: string]: string } = {
      bananas: "Eat 2 bananas daily. Reduces inflammation by 23% through potassium. Simple, cheap, effective. Who's trying this?",
      stretching: "Try these 3 stretches: touch toes, shoulder rolls, neck turns. Harvard study shows 15% flexibility improvement. 2 minutes total. Too easy?",
      "green tea": "Drink green tea instead of coffee. Boosts metabolism 4% and reduces stress hormones. Easy switch with big benefits. What's your go-to?",
      walking: "Walk 7,000 steps daily. Reduces heart disease risk 30% according to new study. No gym needed. Track with your phone. Starting today?",
      water: "Drink water first thing when you wake up. Boosts metabolism 24% for 90 minutes. Zero calories, huge benefits. Game changer?",
      sleep: "Sleep 7-8 hours nightly. Improves memory consolidation by 40%. Your brain literally cleans itself during sleep. Prioritizing it tonight?",
      breathing: "Try 4-7-8 breathing: inhale 4, hold 7, exhale 8. Reduces cortisol 23% instantly. Works anywhere, anytime. Feeling stressed?",
      posture: "Check your posture right now. Roll shoulders back, chin tucked. Improves confidence 25% and reduces back pain. How's yours?",
      vegetables: "Eat 5 different colored vegetables daily. Each color provides unique antioxidants. Your immune system will thank you. What's your favorite?",
      protein: "Eat protein within 30 minutes of waking. Stabilizes blood sugar all day and curbs cravings. Easy win for better health. What's your go-to?"
    };
    
    return fallbacks[topic] || fallbacks.bananas;
  }

  private getFallbackContent(): SimpleHealthContent {
    const fallbacks = [
      "Eat 2 bananas daily. Reduces inflammation by 23% through potassium. Simple, cheap, effective. Who's trying this?",
      "Try these 3 stretches: touch toes, shoulder rolls, neck turns. Harvard study shows 15% flexibility improvement. 2 minutes total. Too easy?",
      "Drink green tea instead of coffee. Boosts metabolism 4% and reduces stress hormones. Easy switch with big benefits. What's your go-to?",
      "Walk 7,000 steps daily. Reduces heart disease risk 30% according to new study. No gym needed. Track with your phone. Starting today?"
    ];
    
    const content = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    
    return {
      content,
      followGrowthPotential: 85,
      simplicity: 95
    };
  }

  private calculateFollowPotential(content: string): number {
    let score = 70; // Base score
    
    // Actionable content gets higher score
    if (content.toLowerCase().includes('try') || content.toLowerCase().includes('eat') || content.toLowerCase().includes('drink')) {
      score += 10;
    }
    
    // Specific numbers/percentages increase credibility
    if (/\d+%/.test(content)) {
      score += 10;
    }
    
    // Questions engage audience
    if (content.includes('?')) {
      score += 5;
    }
    
    return Math.min(score, 95);
  }

  private calculateSimplicity(content: string): number {
    let score = 80; // Base score
    
    // Shorter content is simpler
    if (content.length < 150) {
      score += 10;
    }
    
    // Common words are simpler
    const complexWords = ['inflammation', 'metabolism', 'antioxidants', 'consolidation'];
    const hasComplexWords = complexWords.some(word => content.toLowerCase().includes(word));
    if (!hasComplexWords) {
      score += 5;
    }
    
    // No hashtags keeps it simple
    if (!content.includes('#')) {
      score += 5;
    }
    
    return Math.min(score, 100);
  }
} 