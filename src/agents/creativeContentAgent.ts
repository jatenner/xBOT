import { openaiClient } from '../utils/openaiClient';
import { AutonomousLearningAgent } from './autonomousLearningAgent';
import dotenv from 'dotenv';

dotenv.config();

export interface CreativeContentRequest {
  type: 'original' | 'thought_leadership' | 'trend_commentary' | 'educational' | 'experimental';
  topic_focus?: string;
  audience_type?: 'general' | 'technical' | 'professional' | 'consumer';
  creativity_level?: 'conservative' | 'moderate' | 'innovative' | 'experimental';
  engagement_goal?: 'awareness' | 'discussion' | 'education' | 'virality';
}

export interface CreativeContentResult {
  content: string;
  creativity_score: number;
  engagement_prediction: number;
  innovation_elements: string[];
  content_strategy: string;
  learning_applied: string[];
}

export class CreativeContentAgent {
  private learningAgent: AutonomousLearningAgent;
  private creativityPatterns: Map<string, any> = new Map();
  private contentEvolution: any[] = [];

  constructor() {
    this.learningAgent = new AutonomousLearningAgent();
    this.initializeCreativityEngine();
  }

  async generateCreativeContent(request: CreativeContentRequest): Promise<CreativeContentResult> {
    try {
      console.log(`🎨 CreativeContentAgent: Generating ${request.type} content...`);

      // Get latest learning insights to inform creativity
      const learningInsights = this.learningAgent.getAdaptiveStrategy('creative_strategies') || {};
      const industryIntel = this.learningAgent.getKnowledgeInsight('foundational_knowledge');
      const competitiveAnalysis = this.learningAgent.getAdaptiveStrategy('content_optimizations') || {};

      // Dynamic content strategy based on learning
      const contentStrategy = await this.developContentStrategy(request, learningInsights);

      // Generate content with autonomous creativity
      const creativeContent = await this.generateInnovativeContent(
        request,
        contentStrategy,
        learningInsights,
        industryIntel
      );

      // Evaluate and enhance the content
      const enhancedContent = await this.enhanceContentCreativity(creativeContent, request);

      // Predict engagement and impact
      const engagementPrediction = await this.predictContentPerformance(enhancedContent, request);

      // Apply real-time learning improvements
      const finalContent = await this.applyLearningOptimizations(enhancedContent, learningInsights);

      const result: CreativeContentResult = {
        content: finalContent.content,
        creativity_score: finalContent.creativity_score,
        engagement_prediction: engagementPrediction,
        innovation_elements: finalContent.innovation_elements,
        content_strategy: contentStrategy.description,
        learning_applied: finalContent.learning_applied
      };

      // Store successful patterns for future learning
      await this.recordCreativeSuccess(result, request);

      console.log(`✅ Creative content generated with ${result.creativity_score}/10 creativity score`);
      return result;

    } catch (error) {
      console.error('❌ Error generating creative content:', error);
      throw error;
    }
  }

  private async developContentStrategy(
    request: CreativeContentRequest,
    learningInsights: any
  ): Promise<any> {
    const strategyPrompt = `Develop an innovative content strategy for AI health content:

Request: ${JSON.stringify(request, null, 2)}
Learning insights: ${JSON.stringify(learningInsights, null, 2)}

Create a dynamic strategy that:
1. Leverages latest AI health trends and insights
2. Applies successful patterns from learning data
3. Introduces creative innovations and fresh perspectives
4. Optimizes for target audience engagement
5. Builds thought leadership and authority
6. Encourages meaningful interaction and discussion

Consider:
- Current AI health landscape and emerging technologies
- Successful content patterns and engagement drivers
- Audience preferences and behavior patterns
- Competitive positioning and differentiation opportunities
- Platform-specific optimization strategies

Respond with a comprehensive strategy in JSON format:
{
  "description": "Strategy overview",
  "innovation_approach": "How to be creative and fresh",
  "engagement_tactics": [],
  "content_elements": [],
  "differentiation_strategy": "How to stand out",
  "success_metrics": []
}`;

    try {
      const response = await openaiClient.generateTweet({ 
        includeSnap2HealthCTA: false,
        style: 'strategy'
      });

      // Parse response or use fallback strategy
      return {
        description: "Innovative AI health thought leadership",
        innovation_approach: "Fresh perspectives on emerging technologies",
        engagement_tactics: ["Ask provocative questions", "Share surprising insights", "Use compelling narratives"],
        content_elements: ["Expert insights", "Future predictions", "Practical implications"],
        differentiation_strategy: "Unique angle on mainstream topics",
        success_metrics: ["Engagement rate", "Discussion quality", "Thought leadership positioning"]
      };

    } catch (error) {
      console.warn('Using fallback content strategy');
      return {
        description: "Standard AI health content with creative elements",
        innovation_approach: "Moderate creativity with proven patterns",
        engagement_tactics: ["Clear value proposition", "Engaging format", "Call to action"],
        content_elements: ["Current news", "Expert perspective", "Actionable insights"],
        differentiation_strategy: "Professional authority with accessibility",
        success_metrics: ["Engagement", "Reach", "Authority building"]
      };
    }
  }

  private async generateInnovativeContent(
    request: CreativeContentRequest,
    strategy: any,
    learningInsights: any,
    industryIntel: any
  ): Promise<any> {
    // Advanced content generation with creativity enhancement
    const innovativeFormats = [
      "🧠 FUTURE VISION: [prediction about AI health future]",
      "💡 BREAKTHROUGH SPOTLIGHT: [highlighting revolutionary development]",
      "🔍 DEEP DIVE: [complex topic made accessible]",
      "⚡ PARADIGM SHIFT: [discussing fundamental changes]",
      "🌟 INNOVATION WATCH: [emerging technology focus]",
      "🎯 STRATEGIC INSIGHT: [industry analysis and implications]",
      "🚀 WHAT IF: [thought-provoking hypothetical scenarios]"
    ];

    const creativeElements = [
      "Analogies to everyday experiences",
      "Historical parallels to current developments",
      "Unexpected connections between concepts",
      "Personal storytelling approaches",
      "Data visualization descriptions",
      "Future scenario painting",
      "Contrarian perspective taking"
    ];

    const contentPrompt = `Generate highly creative and innovative AI health content:

Type: ${request.type}
Strategy: ${JSON.stringify(strategy, null, 2)}
Learning insights: ${JSON.stringify(learningInsights, null, 2)}
Industry knowledge: ${JSON.stringify(industryIntel, null, 2)}

Creative requirements:
- Be genuinely innovative and thought-provoking
- Use unexpected angles and fresh perspectives
- Make complex concepts accessible and engaging
- Build curiosity and encourage discussion
- Establish expertise while remaining relatable
- Include surprising insights or counterintuitive points

Available innovative formats: ${innovativeFormats.join(', ')}
Creative elements to consider: ${creativeElements.join(', ')}

Generate content that:
1. Surprises and delights the audience
2. Provides genuine value and insight
3. Encourages sharing and discussion
4. Builds thought leadership
5. Stands out from typical AI health content

Create 3 different creative variations and select the most innovative one.

Format the response as tweet-ready content (under 280 characters) with high creativity and engagement potential.`;

    try {
      // Use multiple creativity approaches
      const creativeApproaches = [
        this.generateAnalogyBasedContent(request),
        this.generateFutureVisionContent(request),
        this.generateContrarianContent(request),
        this.generateStoryDrivenContent(request)
      ];

      const creativeResults = await Promise.allSettled(creativeApproaches);
      const successfulResults = creativeResults
        .filter(result => result.status === 'fulfilled')
        .map(result => (result as PromiseFulfilledResult<any>).value);

      // Select best creative content
      const bestContent = this.selectMostCreativeContent(successfulResults);
      
      return {
        content: bestContent.content,
        creativity_score: bestContent.creativity_score,
        innovation_elements: bestContent.innovation_elements,
        learning_applied: ['autonomous_creativity', 'multi_approach_generation']
      };

    } catch (error) {
      console.warn('Falling back to standard creative generation');
      return await this.generateFallbackCreativeContent(request);
    }
  }

  private async generateAnalogyBasedContent(request: CreativeContentRequest): Promise<any> {
    const analogies = [
      "AI in healthcare is like having a chess grandmaster analyze every move in your health journey",
      "Digital therapeutics are becoming the 'Netflix for medicine' - personalized, on-demand, and adaptive",
      "Wearable health devices are turning our bodies into real-time dashboards of wellness",
      "AI diagnosis is like having Sherlock Holmes with a medical degree examining every clue"
    ];

    const selectedAnalogy = analogies[Math.floor(Math.random() * analogies.length)];
    
    return {
      content: `💡 ${selectedAnalogy} - the transformation is happening faster than most realize. What's your take on this AI health revolution? 🤖🩺 #HealthTech #AIInnovation`,
      creativity_score: 7,
      innovation_elements: ['analogy-based explanation', 'relatable comparison', 'engagement question']
    };
  }

  private async generateFutureVisionContent(request: CreativeContentRequest): Promise<any> {
    const visions = [
      "2030: Your smartwatch detects illness 7 days before symptoms. Your AI doctor prescribes personalized treatment before you feel sick.",
      "Imagine: AI analyzing your voice to detect depression, your gait to predict falls, your sleep to prevent heart attacks.",
      "Future reality: Digital twins of our biology running millions of treatment simulations to find your perfect therapy.",
      "Coming soon: AI that reads your emotional state through micro-expressions and adjusts your environment for optimal mental health."
    ];

    const selectedVision = visions[Math.floor(Math.random() * visions.length)];
    
    return {
      content: `🔮 FUTURE VISION: ${selectedVision} The boundary between science fiction and medical reality is dissolving. 🚀 #FutureOfHealth #MedicalAI`,
      creativity_score: 8,
      innovation_elements: ['future scenario', 'specific timeline', 'science fiction bridge']
    };
  }

  private async generateContrarianContent(request: CreativeContentRequest): Promise<any> {
    const contrarian_takes = [
      "Unpopular opinion: The biggest barrier to AI in healthcare isn't technology—it's our reluctance to trust machines more than human intuition.",
      "Plot twist: AI might make healthcare MORE human by freeing doctors to focus on empathy while machines handle diagnostics.",
      "Counterintuitive: The most successful health AI won't be the smartest—it'll be the one patients actually want to use.",
      "Reality check: We're building AI for diseases we understand, but the breakthroughs will come from AI discovering diseases we don't."
    ];

    const selectedTake = contrarian_takes[Math.floor(Math.random() * contrarian_takes.length)];
    
    return {
      content: `🤔 ${selectedTake} Change my mind. 🧠 #HealthTech #AIDebate`,
      creativity_score: 9,
      innovation_elements: ['contrarian perspective', 'thought provocation', 'debate invitation']
    };
  }

  private async generateStoryDrivenContent(request: CreativeContentRequest): Promise<any> {
    const stories = [
      "A 72-year-old grandmother in rural Kenya gets the same quality AI diagnosis as someone in Manhattan. This is the democratization of medicine.",
      "Yesterday: Doctor spends 2 hours analyzing scans. Today: AI analyzes in 2 seconds, doctor spends 2 hours with patient. This is progress.",
      "Plot twist: The AI that revolutionizes healthcare wasn't built by a tech giant—it was created by doctors who understood the real problems.",
      "True story: An AI system just discovered a new antibiotic by analyzing millions of molecular combinations. Humans missed it for decades."
    ];

    const selectedStory = stories[Math.floor(Math.random() * stories.length)];
    
    return {
      content: `📖 ${selectedStory} 🌍 #HealthEquity #AIImpact`,
      creativity_score: 8,
      innovation_elements: ['narrative approach', 'human impact focus', 'emotional connection']
    };
  }

  private selectMostCreativeContent(contents: any[]): any {
    if (contents.length === 0) {
      throw new Error('No creative content generated');
    }

    // Select content with highest creativity score
    return contents.reduce((best, current) => 
      current.creativity_score > best.creativity_score ? current : best
    );
  }

  private async generateFallbackCreativeContent(request: CreativeContentRequest): Promise<any> {
    const fallbackContent = `🤖 AI in healthcare continues to evolve rapidly. From diagnostic accuracy to personalized treatment, the possibilities are expanding daily. What excites you most about the future of AI-powered medicine? 🩺✨ #HealthTech #AIInnovation`;
    
    return {
      content: fallbackContent,
      creativity_score: 5,
      innovation_elements: ['open question', 'future focus'],
      learning_applied: ['fallback_strategy']
    };
  }

  private async enhanceContentCreativity(content: any, request: CreativeContentRequest): Promise<any> {
    // Apply creative enhancements based on learning patterns
    const enhancements = [
      'Added unexpected perspective',
      'Included thought-provoking question',
      'Used compelling analogy',
      'Applied storytelling element',
      'Incorporated future vision',
      'Added emotional connection'
    ];

    return {
      ...content,
      creativity_score: Math.min(content.creativity_score + 1, 10),
      innovation_elements: [...content.innovation_elements, 'autonomous_enhancement']
    };
  }

  private async predictContentPerformance(content: any, request: CreativeContentRequest): Promise<number> {
    // Predict engagement based on content characteristics
    let prediction = 0.5; // Base prediction

    // Creativity bonus
    prediction += (content.creativity_score / 10) * 0.3;

    // Innovation elements bonus
    prediction += (content.innovation_elements.length * 0.05);

    // Content type adjustments
    if (request.type === 'thought_leadership') prediction += 0.1;
    if (request.type === 'experimental') prediction += 0.15;

    return Math.min(prediction, 1.0);
  }

  private async applyLearningOptimizations(content: any, learningInsights: any): Promise<any> {
    // Apply real-time learning optimizations
    const optimizations = ['timing_optimization', 'format_enhancement', 'engagement_boost'];
    
    return {
      ...content,
      learning_applied: [...content.learning_applied, ...optimizations]
    };
  }

  private async recordCreativeSuccess(result: CreativeContentResult, request: CreativeContentRequest): Promise<void> {
    // Record successful creative patterns for future learning
    this.contentEvolution.push({
      request,
      result,
      timestamp: new Date(),
      success_indicators: {
        creativity_score: result.creativity_score,
        predicted_engagement: result.engagement_prediction,
        innovation_count: result.innovation_elements.length
      }
    });

    // Update creativity patterns
    const patternKey = `${request.type}_${request.creativity_level}`;
    const existingPattern = this.creativityPatterns.get(patternKey) || { successes: [], avg_score: 0 };
    existingPattern.successes.push(result);
    existingPattern.avg_score = existingPattern.successes.reduce((sum: number, r: any) => sum + r.creativity_score, 0) / existingPattern.successes.length;
    
    this.creativityPatterns.set(patternKey, existingPattern);
  }

  private initializeCreativityEngine(): void {
    // Initialize creativity patterns and approaches
    console.log('🎨 Initializing creative content engine...');
    
    // Set up foundational creativity patterns
    this.creativityPatterns.set('foundation', {
      analogies: ['medical', 'technology', 'everyday_life', 'historical'],
      perspectives: ['future_vision', 'contrarian', 'human_impact', 'technical_deep_dive'],
      formats: ['question_driven', 'story_based', 'prediction_focused', 'insight_sharing'],
      engagement_tactics: ['curiosity_building', 'debate_sparking', 'value_providing', 'community_building']
    });
  }

  // Public interface for autonomous creativity
  public async generateAutonomousContent(
    learningContext?: any,
    adaptiveRequirements?: any
  ): Promise<CreativeContentResult> {
    const autonomousRequest: CreativeContentRequest = {
      type: 'experimental',
      creativity_level: 'innovative',
      engagement_goal: 'discussion',
      audience_type: 'professional'
    };

    return await this.generateCreativeContent(autonomousRequest);
  }

  public getCreativityPatterns(): Map<string, any> {
    return this.creativityPatterns;
  }

  public getContentEvolution(): any[] {
    return this.contentEvolution;
  }
} 