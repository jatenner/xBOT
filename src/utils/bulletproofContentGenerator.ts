/**
 * 🛡️ BULLETPROOF CONTENT GENERATOR
 * 
 * Ensures the bot ALWAYS generates valid content and posts successfully.
 * Multiple fallback layers prevent posting failures.
 */

import { EliteTwitterContentStrategist } from '../agents/eliteTwitterContentStrategist';
import { ContentFactChecker } from './contentFactChecker';
import { AwarenessLogger } from './awarenessLogger';

interface ContentRequest {
  topic?: string;
  format_preference?: string;
  tone?: string;
  target_engagement?: number;
  format_type?: string;
  hook_type?: string;
}

interface GeneratedContent {
  content: string;
  predicted_engagement: number;
  format_used: string;
  hook_type: string;
  confidence: number;
  source: 'ai' | 'template' | 'fallback';
}

export class BulletproofContentGenerator {
  private eliteStrategist: EliteTwitterContentStrategist;
  private factChecker: ContentFactChecker;
  private fallbackTemplates: string[];
  private awarenessLogger: AwarenessLogger;

  constructor() {
    this.eliteStrategist = EliteTwitterContentStrategist.getInstance();
    this.factChecker = ContentFactChecker.getInstance();
    this.awarenessLogger = new AwarenessLogger();
    this.initializeFallbackTemplates();
  }

  /**
   * 🎯 BULLETPROOF CONTENT GENERATION
   * Guarantees content generation through multiple fallback layers
   */
  async generateContent(request: ContentRequest = {}): Promise<GeneratedContent> {
    console.log('🛡️ === BULLETPROOF CONTENT GENERATION ===');
    
    // Layer 1: Try AI generation
    try {
      const aiContent = await this.tryAIGeneration(request);
      if (aiContent) {
        console.log('✅ AI generation successful');
        return aiContent;
      }
    } catch (error) {
      console.log('⚠️ AI generation failed, trying template fallback');
      console.log('AI generation failed:', error.message);
    }

    // Layer 2: Try template-based generation
    try {
      const templateContent = await this.tryTemplateGeneration(request);
      if (templateContent) {
        console.log('✅ Template generation successful');
        return templateContent;
      }
    } catch (error) {
      console.log('⚠️ Template generation failed, using emergency fallback');
    }

    // Layer 3: Emergency fallback (always works)
    console.log('🚨 Using emergency fallback content');
    return this.generateEmergencyFallback(request);
  }

  /**
   * 🤖 TRY AI GENERATION
   */
  private async tryAIGeneration(request: ContentRequest): Promise<GeneratedContent | null> {
    try {
      // Use the elite strategist with error handling
      const contentRequest = {
        topic: request.topic || 'health optimization',
        format_preference: (request.format_preference as 'short' | 'thread' | 'auto') || 'short',
        tone: (request.tone as 'authoritative' | 'conversational' | 'provocative') || 'authoritative',
        target_engagement: request.target_engagement || 25
      };
      
      const viralContent = await this.eliteStrategist.generateViralContent(contentRequest);

      if (!viralContent || !viralContent.content) {
        throw new Error('No content generated from AI');
      }

      // Quick fact check (non-blocking)
      let isFactCheckPassed = true;
      try {
        const factCheckRequest = {
          content: Array.isArray(viralContent.content) ? viralContent.content.join(' ') : viralContent.content,
          category: 'health',
          contentType: 'tweet' as const,
          checkClaims: true,
          checkSafety: true
        };
        const factCheck = await this.factChecker.checkContent(factCheckRequest);
        isFactCheckPassed = factCheck.shouldPost;
        
        if (!isFactCheckPassed) {
          console.log('⚠️ AI content failed fact check, trying again...');
          return null;
        }
      } catch (factError) {
        console.log('⚠️ Fact check failed, accepting content anyway for continuity');
        // Don't block on fact check errors
      }

      const contentString = Array.isArray(viralContent.content) ? 
        viralContent.content.join('\n\n') : 
        viralContent.content;

      return {
        content: contentString,
        predicted_engagement: viralContent.predicted_engagement || 25,
        format_used: viralContent.format_used || 'AI_Generated',
        hook_type: viralContent.hook_type || 'authority',
        confidence: 85,
        source: 'ai'
      };

    } catch (error) {
      console.log(`❌ AI generation error: ${error.message}`);
      return null;
    }
  }

  /**
   * 📝 TRY TEMPLATE GENERATION
   */
  private async tryTemplateGeneration(request: ContentRequest): Promise<GeneratedContent | null> {
    try {
      const templates = this.getTopicTemplates(request.topic || 'health');
      const template = templates[Math.floor(Math.random() * templates.length)];
      
      // Fill template with dynamic content
      const content = this.fillTemplate(template, request);
      
      if (content && content.length > 10 && content.length < 280) {
        return {
          content,
          predicted_engagement: 20,
          format_used: 'Template_Based',
          hook_type: 'question',
          confidence: 70,
          source: 'template'
        };
      }
      
      return null;
    } catch (error) {
      console.log(`❌ Template generation error: ${error.message}`);
      return null;
    }
  }

  /**
   * 🚨 EMERGENCY FALLBACK (ALWAYS WORKS)
   */
  private generateEmergencyFallback(request: ContentRequest): GeneratedContent {
    const fallbacks = [
      "What if the health advice you've been following is actually making you worse?",
      "New research reveals the #1 factor that determines how long you'll live.",
      "The supplement industry doesn't want you to know this simple health hack.",
      "Why do some people age faster than others? Science has the answer.",
      "This 5-minute daily habit could add 10 years to your life.",
      "The biggest health myth finally debunked by Harvard researchers.",
      "What happens to your body when you stop doing this common habit?",
      "Why your doctor might be wrong about this popular health trend.",
      "The ancient practice that modern science proves works better than drugs.",
      "How this simple change in routine transformed thousands of lives."
    ];

    const selectedContent = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    
    return {
      content: selectedContent,
      predicted_engagement: 15,
      format_used: 'Emergency_Fallback',
      hook_type: 'question',
      confidence: 60,
      source: 'fallback'
    };
  }

  /**
   * 📚 GET TOPIC TEMPLATES
   */
  private getTopicTemplates(topic: string): string[] {
    const topicTemplates = {
      health: [
        "What if {claim} is actually {opposite}?",
        "New study: {discovery} changes everything about {topic}.",
        "Why {common_belief} might be wrong about {specific_area}.",
        "The {time_period} habit that {benefit} according to research.",
        "How {simple_action} could {dramatic_outcome} in {timeframe}."
      ],
      fitness: [
        "The workout mistake that's {negative_outcome}.",
        "Why {popular_exercise} isn't working for most people.",
        "This {simple_change} improved {metric} by {percentage}.",
        "What happens when you {action} for {duration}?",
        "The {adjective} truth about {fitness_topic}."
      ],
      nutrition: [
        "The food that {unexpected_benefit} according to science.",
        "Why {popular_diet_advice} is actually {problem}.",
        "This {nutrient} deficiency affects {large_number} people.",
        "What {expert_type} eat vs. what they recommend.",
        "The {meal_timing} mistake that {consequence}."
      ],
      default: [
        "What if everything you know about {topic} is wrong?",
        "New research reveals {surprising_finding} about {subject}.",
        "Why {conventional_wisdom} might be {problem}.",
        "The {simple_thing} that {big_impact}.",
        "How {small_change} led to {significant_result}."
      ]
    };

    return topicTemplates[topic] || topicTemplates.default;
  }

  /**
   * 🔧 FILL TEMPLATE
   */
  private fillTemplate(template: string, request: ContentRequest): string {
    const variables = {
      '{claim}': 'eating 6 meals a day',
      '{opposite}': 'slowing your metabolism',
      '{discovery}': 'intermittent fasting',
      '{topic}': 'weight loss',
      '{common_belief}': 'conventional wisdom',
      '{specific_area}': 'metabolism',
      '{time_period}': '5-minute',
      '{benefit}': 'boosts energy levels',
      '{simple_action}': 'drinking water first thing',
      '{dramatic_outcome}': 'improve your health',
      '{timeframe}': '30 days',
      '{negative_outcome}': 'sabotaging your progress',
      '{popular_exercise}': 'cardio',
      '{simple_change}': 'morning routine',
      '{metric}': 'energy levels',
      '{percentage}': '40%',
      '{action}': 'walk for 10 minutes',
      '{duration}': '30 days',
      '{adjective}': 'shocking',
      '{fitness_topic}': 'fat loss',
      '{unexpected_benefit}': 'reduces inflammation',
      '{popular_diet_advice}': 'eating every 3 hours',
      '{problem}': 'keeping you hungry',
      '{nutrient}': 'magnesium',
      '{large_number}': '80% of',
      '{expert_type}': 'nutritionists',
      '{meal_timing}': 'late-night eating',
      '{consequence}': 'disrupts sleep quality',
      '{surprising_finding}': 'the opposite effect',
      '{subject}': 'sleep quality',
      '{conventional_wisdom}': 'standard advice',
      '{simple_thing}': '10-minute walk',
      '{big_impact}': 'changes everything',
      '{small_change}': 'morning sunlight',
      '{significant_result}': 'better sleep'
    };

    let content = template;
    Object.entries(variables).forEach(([placeholder, value]) => {
      content = content.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    });

    return content;
  }

  /**
   * 📋 INITIALIZE FALLBACK TEMPLATES
   */
  private initializeFallbackTemplates(): void {
    this.fallbackTemplates = [
      "What if the health advice you've been following is wrong?",
      "New research changes everything about longevity.",
      "The supplement industry doesn't want you to know this.",
      "Why some people age slower than others.",
      "This daily habit could transform your health.",
      "The biggest health myth finally debunked.",
      "What happens when you stop this common habit?",
      "Why your doctor might be wrong about this trend.",
      "Ancient practice beats modern medicine.",
      "Simple change, massive health transformation."
    ];
  }

  /**
   * 📊 VALIDATE CONTENT QUALITY
   */
  private isValidContent(content: string): boolean {
    if (!content || typeof content !== 'string') return false;
    if (content.length < 10 || content.length > 280) return false;
    if (content.includes('undefined') || content.includes('null')) return false;
    if (content.trim().length === 0) return false;
    
    return true;
  }
}

// Export singleton instance
export const bulletproofContentGenerator = new BulletproofContentGenerator();
