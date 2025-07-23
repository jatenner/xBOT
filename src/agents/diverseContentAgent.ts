import { openaiClient } from '../utils/openaiClient';
import { supabaseClient } from '../utils/supabaseClient';

interface ContentTemplate {
  type: string;
  structure: string;
  examples: string[];
}

interface UsedContent {
  type: string;
  topic: string;
  opening: string;
  timestamp: Date;
}

export class DiverseContentAgent {
  private recentContent: UsedContent[] = [];
  
  private contentTemplates: ContentTemplate[] = [
    {
      type: 'actionable_tip',
      structure: 'Direct actionable advice with specific steps',
      examples: [
        'Take 2g of magnesium glycinate 30 minutes before bed. Most people are deficient and it improves deep sleep by 40%.',
        'Eat your largest meal at 11 AM, not dinner. Your metabolism is 23% higher in the morning.',
        'Cold shower for 2 minutes = 300% dopamine increase for 4 hours. Better than coffee.'
      ]
    },
    {
      type: 'counterintuitive_fact',
      structure: 'Surprising truth that challenges common beliefs',
      examples: [
        'Drinking water during meals dilutes stomach acid and reduces nutrient absorption by 30%.',
        'Stretching before exercise increases injury risk by 27%. Dynamic warm-ups are superior.',
        'Eating fat with vegetables increases nutrient absorption 15x. Salad without dressing is wasteful.'
      ]
    },
    {
      type: 'research_insight',
      structure: 'Recent study findings with practical application',
      examples: [
        'New Harvard study: 5 minutes of morning sunlight regulates circadian rhythm better than melatonin.',
        'Japanese research: Walking after meals reduces blood sugar spikes by 45%. Even 2 minutes helps.',
        'Stanford findings: Breathing exercises work faster than meditation for stress reduction.'
      ]
    },
    {
      type: 'optimization_hack',
      structure: 'Biohacking technique with measurable benefits',
      examples: [
        'Breathe through your nose during exercise. Increases oxygen efficiency by 20% vs mouth breathing.',
        'Sleep in 67°F room. Core temperature drop triggers deeper sleep and growth hormone release.',
        'Fast for 16 hours but break it with protein + fat. Maintains muscle while burning fat.'
      ]
    },
    {
      type: 'mistake_correction',
      structure: 'Common health mistake and the right way',
      examples: [
        'Most people ice injuries immediately. Heat for first 48 hours actually speeds healing by increasing blood flow.',
        'Taking vitamins on empty stomach reduces absorption. Always take with healthy fats.',
        'Cardio before weights depletes glycogen. Lift first, then cardio for better fat burning.'
      ]
    },
    {
      type: 'timing_optimization',
      structure: 'When to do things for maximum benefit',
      examples: [
        'Exercise between 6-8 AM when cortisol peaks. Testosterone is highest and performance improves 15%.',
        'Eat carbs post-workout only. Insulin sensitivity is 40% higher for 2 hours after exercise.',
        'Take omega-3s at dinner. Absorption increases 300% when taken with evening meal.'
      ]
    },
    {
      type: 'mechanism_explanation',
      structure: 'How something works in your body',
      examples: [
        'Intermittent fasting works by depleting liver glycogen, forcing your body to burn stored fat for energy.',
        'Cold exposure activates brown fat, which burns 300% more calories than regular fat tissue.',
        'Protein synthesis peaks 3 hours post-workout. Miss this window and muscle growth drops 50%.'
      ]
    },
    {
      type: 'dosage_precision',
      structure: 'Exact amounts and timing for supplements/nutrients',
      examples: [
        'Vitamin D: 4000 IU with K2 in the morning. Without K2, calcium goes to arteries instead of bones.',
        'Creatine: 5g daily, timing irrelevant. Loading phases are marketing - just stay consistent.',
        'Caffeine: 1-2mg per pound bodyweight. More causes cortisol spikes and crashes energy.'
      ]
    }
  ];

  async generateDiverseContent(): Promise<{ content: string; type: string; success: boolean; error?: string }> {
    try {
      // Clean old content (remove entries older than 24 hours)
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      this.recentContent = this.recentContent.filter(item => item.timestamp > cutoff);

      // Get recent topics and openings to avoid
      const recentTopics = this.recentContent.map(item => item.topic.toLowerCase());
      const recentOpenings = this.recentContent.map(item => item.opening.toLowerCase());

      // Select a template type we haven't used recently
      const availableTemplates = this.contentTemplates.filter(template => 
        !this.recentContent.some(recent => recent.type === template.type)
      );

      const selectedTemplate = availableTemplates.length > 0 
        ? availableTemplates[Math.floor(Math.random() * availableTemplates.length)]
        : this.contentTemplates[Math.floor(Math.random() * this.contentTemplates.length)];

      // Generate content using the selected template
      const prompt = this.buildPrompt(selectedTemplate, recentTopics, recentOpenings);
      
      const content = await openaiClient.generateCompletion(prompt, {
        maxTokens: 120,
        temperature: 0.8,
        model: 'gpt-4o-mini'
      });

      if (!content || content.length < 50) {
        throw new Error('Generated content too short');
      }

      // Ensure content is under 280 characters
      const finalContent = content.length <= 280 ? content : content.substring(0, 277) + '...';

      // Extract topic and opening for tracking
      const topic = this.extractTopic(finalContent);
      const opening = finalContent.split(' ').slice(0, 3).join(' ');

      // Store to prevent repetition
      this.recentContent.push({
        type: selectedTemplate.type,
        topic,
        opening,
        timestamp: new Date()
      });

      // Log to database for tracking
      await this.logContentGeneration(finalContent, selectedTemplate.type);

      return {
        content: finalContent,
        type: selectedTemplate.type,
        success: true
      };

    } catch (error) {
      console.error('❌ Diverse content generation failed:', error);
      return {
        content: '',
        type: 'error',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private buildPrompt(template: ContentTemplate, recentTopics: string[], recentOpenings: string[]): string {
    const avoidTopics = recentTopics.length > 0 ? `\nAVOID these recent topics: ${recentTopics.join(', ')}` : '';
    const avoidOpenings = recentOpenings.length > 0 ? `\nDON'T start with: ${recentOpenings.join(', ')}` : '';

    return `Generate a ${template.type} health tweet following this structure: ${template.structure}

REQUIREMENTS:
- Under 280 characters
- Specific, actionable information
- Include numbers/percentages when possible
- Avoid generic phrases like "This will change everything"
- Be direct and valuable
- Target health enthusiasts and biohackers

EXAMPLES of this type:
${template.examples.slice(0, 2).join('\n')}

${avoidTopics}${avoidOpenings}

Generate ONE unique ${template.type} tweet:`;
  }

  private extractTopic(content: string): string {
    // Extract main topic from content
    const healthKeywords = [
      'sleep', 'metabolism', 'exercise', 'nutrition', 'supplements', 'fasting',
      'protein', 'vitamins', 'omega', 'magnesium', 'vitamin d', 'creatine',
      'cardio', 'strength', 'recovery', 'stress', 'cortisol', 'insulin',
      'blood sugar', 'fat burning', 'muscle', 'longevity', 'biohacking'
    ];

    const lowerContent = content.toLowerCase();
    for (const keyword of healthKeywords) {
      if (lowerContent.includes(keyword)) {
        return keyword;
      }
    }

    return 'general health';
  }

  private async logContentGeneration(content: string, type: string): Promise<void> {
    try {
      if (!supabaseClient.supabase) return;

      await supabaseClient.supabase
        .from('content_generation_log')
        .insert({
          content_type: type,
          content_preview: content.substring(0, 100),
          generated_at: new Date().toISOString()
        });

    } catch (error) {
      // Fail silently - logging shouldn't break content generation
      console.warn('⚠️ Content logging failed:', error);
    }
  }

  async getContentVariety(): Promise<{ 
    recentTypes: string[]; 
    recentTopics: string[]; 
    varietyScore: number;
  }> {
    const recentTypes = [...new Set(this.recentContent.map(item => item.type))];
    const recentTopics = [...new Set(this.recentContent.map(item => item.topic))];
    
    // Calculate variety score (higher = more diverse)
    const typeVariety = recentTypes.length / Math.max(this.recentContent.length, 1);
    const topicVariety = recentTopics.length / Math.max(this.recentContent.length, 1);
    const varietyScore = (typeVariety + topicVariety) / 2;

    return {
      recentTypes,
      recentTopics,
      varietyScore
    };
  }
} 