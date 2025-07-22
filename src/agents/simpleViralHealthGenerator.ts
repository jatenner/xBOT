import { openaiClient } from '../utils/openaiClient';

interface ViralHealthContent {
  content: string;
  followGrowthPotential: number;
  contentType: string;
  engagementHooks: string[];
}

export class SimpleViralHealthGenerator {
  private healthContentTypes = [
    'supplement_tips',
    'food_hacks', 
    'fitness_secrets',
    'health_news',
    'biohacking',
    'weight_loss',
    'energy_boost',
    'sleep_optimization',
    'longevity_hacks',
    'mental_health',
    'gut_health',
    'skin_health',
    'immune_system',
    'metabolism_boost'
  ];

  private viralTopics = [
    // Supplements & Biohacking
    'magnesium for sleep quality',
    'creatine for brain function', 
    'vitamin D3 + K2 combo',
    'omega-3 for inflammation',
    'NAD+ boosters for aging',
    'collagen for joints',
    'probiotics for gut health',
    'ashwagandha for stress',
    
    // Food & Nutrition
    'intermittent fasting benefits',
    'keto vs mediterranean diet',
    'superfoods that actually work',
    'protein timing for muscle',
    'apple cider vinegar benefits',
    'bone broth for healing',
    'fermented foods for gut',
    'anti-inflammatory foods',
    
    // Fitness & Performance  
    'zone 2 cardio benefits',
    'strength training for longevity',
    'cold plunge benefits',
    'sauna for recovery',
    'breathwork techniques',
    'mobility routines',
    'HIIT vs steady cardio',
    'morning workout benefits',
    
    // Health News & Trends
    'latest longevity research',
    'breakthrough health studies',
    'FDA approvals this month',
    'health tech innovations',
    'celebrity health routines',
    'doctor recommendations',
    'health myths debunked',
    'trending health topics'
  ];

  async generateSimpleViralHealth(): Promise<ViralHealthContent> {
    try {
      // Select random content type and topic for variety
      const contentType = this.getRandomContentType();
      const topic = this.getRandomTopic();
      
      console.log(`🔥 Generating ${contentType} content about: ${topic}`);
      
      const content = await this.createViralHealthContent(contentType, topic);
      
      return {
        content,
        followGrowthPotential: this.calculateFollowPotential(content, contentType),
        contentType,
        engagementHooks: this.extractEngagementHooks(content)
      };
    } catch (error) {
      console.error('Viral health generator failed:', error);
      return this.getFallbackContent();
    }
  }

  private async createViralHealthContent(contentType: string, topic: string): Promise<string> {
    try {
      const prompt = this.buildContentPrompt(contentType, topic);
      const response = await openaiClient.generateCompletion(prompt);
      
      let content = response.trim();
      
      // Ensure no hashtags
      content = content.replace(/#\w+/g, '').trim();
      
      // Ensure proper length
      if (content.length > 280) {
        content = content.substring(0, 270) + '...';
      }
      
      return content;
    } catch (error) {
      console.error('AI generation failed, using fallback:', error);
      return this.getTopicFallback(contentType, topic);
    }
  }

  private buildContentPrompt(contentType: string, topic: string): string {
    const prompts = {
      supplement_tips: `Create a viral tweet about ${topic} supplements that will make people want to follow for more health tips.

Style: Authoritative but accessible, like a knowledgeable friend sharing insider info
Format: Hook + Benefit + Social proof + Call to action

EXAMPLES:
"Taking magnesium before bed changed my sleep quality overnight. 400mg glycinate form works better than oxide. 78% of people are deficient. Game changer for recovery. What's your bedtime routine?"

"Creatine isn't just for muscles. 5g daily improved my brain function by 15% in 2 weeks. Harvard study confirms cognitive benefits. Most people only think gym gains. What brain supplements do you use?"

Generate ONE supplement tip about ${topic}:`,

      food_hacks: `Create a viral food/nutrition hack about ${topic} that people will want to save and share.

Style: Practical, surprising, results-focused
Format: Simple hack + Specific benefit + Proof/study + Question

EXAMPLES:
"Drink green tea 30 minutes before meals. Blocks 25% of carb absorption and boosts fat burning. Japanese study on 150 people. Simple metabolism hack. What's your pre-meal ritual?"

"Add black pepper to turmeric. Increases absorption by 2000%. Without it, you're wasting your money. Ancient Ayurvedic wisdom backed by science. How do you take turmeric?"

Generate ONE food hack about ${topic}:`,

      health_news: `Create a viral tweet about recent ${topic} health news/research that will make people follow for more updates.

Style: Breaking news angle, credible source, practical implications
Format: "BREAKING:" + Study result + Institution + Practical meaning + Question

EXAMPLES:
"BREAKING: Stanford study shows 8 minutes of morning sunlight resets circadian rhythm better than melatonin. 94% of participants improved sleep quality within 1 week. Free and instant results. What time do you get sunlight?"

"JUST IN: Mayo Clinic finds cold showers increase metabolism 15% for 4 hours after. 2-minute cold blast = extra 200 calories burned. Better than pre-workout supplements. Ready to try it?"

Generate ONE health news update about ${topic}:`,

      fitness_secrets: `Create a viral fitness tip about ${topic} that reveals something most people don't know.

Style: Insider secret, contrarian angle, specific results
Format: Contrarian hook + Secret method + Results + Question

EXAMPLES:
"Most people lift weights wrong for longevity. Slow eccentrics (3-5 seconds down) build more muscle with less weight. 40% better results in 8 weeks. Your joints will thank you. How slow do you lower?"

"Zone 2 cardio beats HIIT for fat loss long-term. 180 minus your age heart rate for 45 minutes. Burns fat, builds mitochondria, increases lifespan. Boring but effective. What's your cardio preference?"

Generate ONE fitness secret about ${topic}:`,

      biohacking: `Create a viral biohacking tip about ${topic} that sounds cutting-edge but is accessible.

Style: Biohacker insider knowledge, specific protocols, measurable results
Format: Advanced technique + Protocol + Results + Accessibility

EXAMPLES:
"Breathwork hack: 4-7-8 breathing lowers cortisol 23% instantly. Inhale 4, hold 7, exhale 8. Navy SEALs use this for stress. Free, works anywhere, no apps needed. What's your stress relief method?"

"HRV training improved my recovery 40% in 30 days. 5-minute morning breathing while checking heart rate variability. $30 chest strap + free app. Better than expensive recovery devices. Track your HRV?"

Generate ONE biohacking tip about ${topic}:`
    };

    return prompts[contentType] || prompts.supplement_tips;
  }

  private getRandomContentType(): string {
    return this.healthContentTypes[Math.floor(Math.random() * this.healthContentTypes.length)];
  }

  private getRandomTopic(): string {
    return this.viralTopics[Math.floor(Math.random() * this.viralTopics.length)];
  }

  private getTopicFallback(contentType: string, topic: string): string {
    const fallbacks = {
      supplement_tips: [
        "Taking magnesium before bed changed my sleep quality overnight. 400mg glycinate form works better than oxide. 78% of people are deficient. Game changer for recovery. What's your bedtime routine?",
        "Creatine isn't just for muscles. 5g daily improved my brain function by 15% in 2 weeks. Harvard study confirms cognitive benefits. Most people only think gym gains. What brain supplements do you use?",
        "Vitamin D3 + K2 combo is game changing. D3 alone can cause calcium buildup. K2 directs it to bones, not arteries. 5000 IU D3 + 100mcg K2 daily. What's your vitamin D level?"
      ],
      food_hacks: [
        "Drink green tea 30 minutes before meals. Blocks 25% of carb absorption and boosts fat burning. Japanese study on 150 people. Simple metabolism hack. What's your pre-meal ritual?",
        "Add black pepper to turmeric. Increases absorption by 2000%. Without it, you're wasting your money. Ancient Ayurvedic wisdom backed by science. How do you take turmeric?",
        "Eat protein within 30 minutes of waking. Stabilizes blood sugar all day and reduces cravings 40%. Simple habit, massive results. What's your morning protein source?"
      ],
      health_news: [
        "BREAKING: Stanford study shows 8 minutes of morning sunlight resets circadian rhythm better than melatonin. 94% of participants improved sleep quality within 1 week. Free and instant results. What time do you get sunlight?",
        "JUST IN: Mayo Clinic finds cold showers increase metabolism 15% for 4 hours after. 2-minute cold blast = extra 200 calories burned. Better than pre-workout supplements. Ready to try it?",
        "NEW RESEARCH: Walking 7,000 steps daily reduces heart disease risk 30%. No need for 10,000. Quality over quantity matters more. Harvard study on 16,000 women. How many steps do you average?"
      ]
    };

    const typesFallbacks = fallbacks[contentType] || fallbacks.supplement_tips;
    return typesFallbacks[Math.floor(Math.random() * typesFallbacks.length)];
  }

  private getFallbackContent(): ViralHealthContent {
    const fallbackOptions = [
      {
        content: "Taking magnesium before bed changed my sleep quality overnight. 400mg glycinate form works better than oxide. 78% of people are deficient. Game changer for recovery. What's your bedtime routine?",
        contentType: "supplement_tips"
      },
      {
        content: "BREAKING: Stanford study shows 8 minutes of morning sunlight resets circadian rhythm better than melatonin. 94% of participants improved sleep quality within 1 week. Free and instant results. What time do you get sunlight?",
        contentType: "health_news"
      },
      {
        content: "Zone 2 cardio beats HIIT for fat loss long-term. 180 minus your age heart rate for 45 minutes. Burns fat, builds mitochondria, increases lifespan. Boring but effective. What's your cardio preference?",
        contentType: "fitness_secrets"
      },
      {
        content: "Drink green tea 30 minutes before meals. Blocks 25% of carb absorption and boosts fat burning. Japanese study on 150 people. Simple metabolism hack. What's your pre-meal ritual?",
        contentType: "food_hacks"
      }
    ];
    
    const selected = fallbackOptions[Math.floor(Math.random() * fallbackOptions.length)];
    
    return {
      content: selected.content,
      followGrowthPotential: 85,
      contentType: selected.contentType,
      engagementHooks: this.extractEngagementHooks(selected.content)
    };
  }

  private calculateFollowPotential(content: string, contentType: string): number {
    let score = 70; // Base score
    
    // Content type multipliers
    const typeMultipliers = {
      'health_news': 10,      // Breaking news gets high engagement
      'supplement_tips': 8,   // People love actionable supplement advice
      'biohacking': 8,        // Cutting-edge appeals to health enthusiasts  
      'food_hacks': 7,        // Easy to implement, shareable
      'fitness_secrets': 6,   // Good for fitness community
      'weight_loss': 9        // Always popular topic
    };
    
    score += typeMultipliers[contentType] || 5;
    
    // Engagement elements
    if (content.includes('BREAKING:') || content.includes('JUST IN:')) score += 8;
    if (content.includes('%') || /\d+/.test(content)) score += 6; // Numbers/stats
    if (content.includes('?')) score += 5; // Questions
    if (content.toLowerCase().includes('study') || content.toLowerCase().includes('research')) score += 4;
    if (content.length < 200) score += 3; // Concise content
    
    return Math.min(score, 95);
  }

  private extractEngagementHooks(content: string): string[] {
    const hooks = [];
    
    if (content.includes('BREAKING:')) hooks.push('breaking_news');
    if (content.includes('?')) hooks.push('question');
    if (content.includes('%')) hooks.push('statistics');
    if (content.toLowerCase().includes('study')) hooks.push('research_backing');
    if (content.toLowerCase().includes('game changer')) hooks.push('transformation_language');
    
    return hooks;
  }
} 