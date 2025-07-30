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
    
    let generatedContent: GeneratedContent | null = null;
    
    // Layer 1: Try AI generation
    try {
      const aiContent = await this.tryAIGeneration(request);
      if (aiContent) {
        console.log('✅ AI generation successful');
        generatedContent = aiContent;
      }
    } catch (error) {
      console.log('⚠️ AI generation failed, trying template fallback');
      console.log('AI generation failed:', error.message);
    }

    // Layer 2: Try template-based generation
    if (!generatedContent) {
      try {
        const templateContent = await this.tryTemplateGeneration(request);
        if (templateContent) {
          console.log('✅ Template generation successful');
          generatedContent = templateContent;
        }
      } catch (error) {
        console.log('⚠️ Template generation failed, using emergency fallback');
      }
    }

    // Layer 3: Emergency fallback (always works)
    if (!generatedContent) {
      console.log('🚨 Using emergency fallback content');
      generatedContent = this.generateEmergencyFallback(request);
    }

    // Layer 4: Safety validation (lightweight fact check)
    try {
      console.log('🔍 Running lightweight safety check...');
      const factCheckResult = await this.factChecker.checkContent({
        content: generatedContent.content,
        contentType: 'tweet',
        strictMode: false,
        allowSpeculation: true
      });
      
      if (!factCheckResult.shouldPost) {
        console.log(`⚠️ Content failed safety check: ${factCheckResult.reasoning}`);
        console.log(`Issues: ${factCheckResult.issues ? factCheckResult.issues.join(', ') : 'No specific issues listed'}`);
        
        // If safety check fails, use a safer fallback
        const safeFallbacks = [
          "Health tip: Stay hydrated, get enough sleep, and move your body daily.",
          "What's one small healthy habit you want to build this week?",
          "Reminder: Small consistent changes lead to big health improvements.",
          "Which health topic would you like to learn more about?",
          "Share one thing you're grateful for today - gratitude impacts health!"
        ];
        
        generatedContent = {
          content: safeFallbacks[Math.floor(Math.random() * safeFallbacks.length)],
          predicted_engagement: 10,
          format_used: 'Safe_Fallback',
          hook_type: 'question',
          confidence: 95,
          source: 'fallback'
        };
        
        console.log('🛡️ Using safety-validated fallback content');
      } else {
        console.log(`✅ Content passed safety check (${factCheckResult.confidence ? (factCheckResult.confidence * 100).toFixed(0) : 'N/A'}% confidence)`);
        if (factCheckResult.suggestions) {
          console.log('💡 Suggestions:', factCheckResult.suggestions);
        }
      }
    } catch (checkError) {
      console.log('⚠️ Safety check failed, allowing content:', checkError.message);
      // Continue with original content if safety check fails
    }

    return generatedContent;
  }

  /**
   * 🤖 TRY AI GENERATION (FEATURE FLAG CONTROLLED)
   */
  private async tryAIGeneration(request: ContentRequest): Promise<GeneratedContent | null> {
    try {
      // Import feature flags
      const { canUseEliteStrategist, getStrategistUsageRate, getCurrentPhase } = await import('../config/featureFlags');
      
      if (!canUseEliteStrategist()) {
        console.log('🎛️ Elite strategist disabled via feature flag');
        console.log('🔄 Skipping AI generation - using template fallback');
        return null;
      }
      
      // Check phase-based usage rate
      const usageRate = getStrategistUsageRate();
      const phase = getCurrentPhase();
      
      if (Math.random() > usageRate) {
        console.log(`🎲 Skipping AI generation (Phase: ${phase.phase}, Usage: ${Math.round(usageRate * 100)}%)`);
        return null;
      }
      
      console.log(`🎯 Elite strategist ENABLED - Phase: ${phase.phase} (${Math.round(usageRate * 100)}% AI usage)`);

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
        "What's one {topic} habit you wish you'd started 10 years ago?",
        "Plot twist: {conventional_wisdom} about {topic} is completely wrong.",
        "Quick question: What's your biggest {topic} challenge right now?",
        "Hot take: {surprising_claim} about {topic}.",
        "Rate your {topic}: A) Excellent B) Good C) Needs work D) What's that? 😅"
      ],
      fitness: [
        "Gym confession: {relatable_mistake} 😅",
        "What's the {fitness_topic} you love to hate but know it works?",
        "Fitness myth busted: {common_belief} is actually {reality}.",
        "The best workout is the one you'll actually do. What's yours?",
        "What's your weirdest {fitness_topic} habit that actually works?"
      ],
      nutrition: [
        "Food companies don't want you to know this {nutrition_topic} secret...",
        "That moment when you realize {common_food} isn't healthy 😳",
        "What's the strangest {nutrition_topic} combination that works?",
        "Nutrition labels are designed to confuse you. Here's what to look for:",
        "What's one {nutrition_topic} change that made a huge difference?"
      ],
      sleep: [
        "What's the strangest thing that helps you sleep better?",
        "Sleep hack that sounds fake but works: {sleep_tip}",
        "Rate your sleep: A) Dead to the world B) Tossing & turning C) What sleep?",
        "Why do we treat sleep like it's optional when it's life or death?",
        "What's your biggest sleep disruptor?"
      ],
      mental_health: [
        "Mental health check: What's one thing you need to hear today?",
        "What's a small self-care act that makes a big difference?",
        "Normalize talking about mental health like physical health.",
        "What's your go-to strategy when you're feeling overwhelmed?",
        "Mental health plot twist: Saying no is saying yes to yourself."
      ],
      default: [
        "What's one thing about {topic} nobody talks about but should?",
        "If {topic} advice came with warning labels, what would yours say?",
        "What's the biggest {topic} lie you were told growing up?",
        "Quick poll: What's your {topic} superpower?",
        "What would you tell your younger self about {topic}?"
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
    // Enhanced templates designed for higher engagement
    this.fallbackTemplates = [
      // Question hooks (drive comments)
      "What's the one health habit that completely changed your life? 👇",
      "Quick poll: What's your biggest health struggle? A) Sleep B) Nutrition C) Exercise D) Stress",
      "What's one health myth you believed for way too long?",
      "If you could only give one piece of health advice, what would it be?",
      "What's the weirdest health tip that actually works?",
      
      // Contrarian hooks (viral potential)
      "Unpopular opinion: Expensive supplements won't fix a poor lifestyle.",
      "Hot take: Your 'healthy' smoothie might have more sugar than soda 🤯",
      "Plot twist: The food pyramid was basically upside down this whole time.",
      "Controversial: Doing cardio for hours isn't the secret to fat loss.",
      
      // Curiosity gaps (drive clicks)
      "This kitchen spice might be the secret to better sleep...",
      "Scientists discovered something surprising about people who live past 100:",
      "The Japanese concept that could revolutionize your health mindset:",
      
      // Personal/relatable (build connection)
      "Me: I'll start eating healthy Monday. Also me: Orders pizza Sunday night 🍕",
      "That moment you realize you've been breathing wrong your entire life 😅",
      "Anyone else need a PhD to understand nutrition labels?",
      
      // Value-driven (save/share worthy)
      "3 signs your body is begging you to slow down:",
      "The 5-minute rule that changed my approach to daily movement:",
      "Why your sleep routine matters more than your morning routine:",
      
      // Safe fallbacks
      "Small consistent changes lead to big health improvements 🌱",
      "Health isn't just what you eat - it's how you live.",
      "Your body keeps the score. Treat it with respect."
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
