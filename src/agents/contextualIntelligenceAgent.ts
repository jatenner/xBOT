import { TimingOptimizationAgent } from './timingOptimizationAgent';
import { openaiClient } from '../utils/openaiClient';

interface ContextualGuidance {
  contentType: string;
  tone: string;
  topics: string[];
  hashtags: string[];
  urgency: 'low' | 'medium' | 'high';
  imageRecommendation: string;
  reasoningContext: string;
}

interface TimeContext {
  hour: number;
  dayOfWeek: number;
  isWeekend: boolean;
  isPeakHour: boolean;
  audienceMood: string;
  engagementExpectation: string;
}

export class ContextualIntelligenceAgent {
  private timingAgent: TimingOptimizationAgent;

  constructor() {
    this.timingAgent = new TimingOptimizationAgent();
  }

  async getContextualGuidance(): Promise<ContextualGuidance> {
    console.log('🧠 === CONTEXTUAL INTELLIGENCE ACTIVATED ===');
    console.log('📊 Analyzing current context for optimal tweet content...');

    try {
      // 1. Get current time context
      const timeContext = this.getCurrentTimeContext();
      
      // 2. Get timing optimization insights
      const timingAdvice = await this.timingAgent.shouldPostNow();
      
      // 3. Determine optimal content strategy
      const contentStrategy = await this.determineContentStrategy(timeContext, timingAdvice);
      
      // 4. Generate contextual guidance
      const guidance = await this.generateContextualGuidance(timeContext, contentStrategy);

      console.log(`🎯 Context Generated: ${guidance.contentType} content for ${timeContext.audienceMood} audience`);
      console.log(`📈 Expected performance: ${timeContext.engagementExpectation}`);

      return guidance;

    } catch (error) {
      console.error('❌ Contextual analysis failed:', error);
      return this.getDefaultGuidance();
    }
  }

  private getCurrentTimeContext(): TimeContext {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    // Peak hours based on our timing optimization
    const isPeakHour = [9, 10, 11, 15, 16, 19, 20].includes(hour);

    // Determine audience mood based on time
    let audienceMood: string;
    if (hour >= 6 && hour <= 9) {
      audienceMood = 'motivated_morning';
    } else if (hour >= 10 && hour <= 14) {
      audienceMood = 'focused_midday';
    } else if (hour >= 15 && hour <= 18) {
      audienceMood = 'engaged_afternoon';
    } else if (hour >= 19 && hour <= 22) {
      audienceMood = 'relaxed_evening';
    } else {
      audienceMood = 'quiet_late';
    }

    // Engagement expectations
    let engagementExpectation: string;
    if (isPeakHour && !isWeekend) {
      engagementExpectation = 'high';
    } else if (isPeakHour && isWeekend) {
      engagementExpectation = 'moderate-high';
    } else if (!isPeakHour && !isWeekend) {
      engagementExpectation = 'moderate';
    } else {
      engagementExpectation = 'low-moderate';
    }

    return {
      hour,
      dayOfWeek,
      isWeekend,
      isPeakHour,
      audienceMood,
      engagementExpectation
    };
  }

  private async determineContentStrategy(timeContext: TimeContext, timingAdvice: any): Promise<any> {
    console.log('🎯 Determining optimal content strategy...');

    // Morning content strategy (6-10 AM)
    if (timeContext.hour >= 6 && timeContext.hour <= 10) {
      return {
        focus: 'inspirational_breakthrough',
        reasoning: 'Morning audience seeks motivation and positive health news',
        contentTypes: ['breakthrough_research', 'prevention_tips', 'future_health_tech'],
        tone: 'optimistic',
        urgency: 'medium'
      };
    }

    // Midday content strategy (11 AM - 2 PM)
    if (timeContext.hour >= 11 && timeContext.hour <= 14) {
      return {
        focus: 'educational_insights',
        reasoning: 'Midday audience has time to digest detailed information',
        contentTypes: ['research_deep_dive', 'data_analysis', 'expert_opinions'],
        tone: 'informative',
        urgency: 'low'
      };
    }

    // Afternoon content strategy (3-6 PM)
    if (timeContext.hour >= 15 && timeContext.hour <= 18) {
      return {
        focus: 'engaging_discussions',
        reasoning: 'Peak engagement time - audience most active and interactive',
        contentTypes: ['controversial_takes', 'trending_topics', 'viral_insights'],
        tone: 'engaging',
        urgency: 'high'
      };
    }

    // Evening content strategy (7-10 PM)
    if (timeContext.hour >= 19 && timeContext.hour <= 22) {
      return {
        focus: 'thought_provoking',
        reasoning: 'Evening audience seeks interesting content to share and discuss',
        contentTypes: ['future_predictions', 'human_stories', 'tech_implications'],
        tone: 'thoughtful',
        urgency: 'medium'
      };
    }

    // Late night/early morning
    return {
      focus: 'evergreen_content',
      reasoning: 'Limited audience - focus on timeless, shareable content',
      contentTypes: ['health_facts', 'inspirational_quotes', 'simple_tips'],
      tone: 'gentle',
      urgency: 'low'
    };
  }

  private async generateContextualGuidance(timeContext: TimeContext, strategy: any): Promise<ContextualGuidance> {
    console.log('🧠 Generating contextual content guidance...');

    // Time-specific topic recommendations
    const topics = this.getTimeSpecificTopics(timeContext, strategy);
    
    // Time-appropriate hashtags
    const hashtags = this.getTimeSpecificHashtags(timeContext, strategy);
    
    // Content type based on context
    const contentType = this.selectContentType(timeContext, strategy);
    
    // Tone adjustment for time of day
    const tone = this.adjustToneForTime(timeContext, strategy);
    
    // Image recommendations
    const imageRecommendation = this.getImageRecommendation(timeContext, strategy);

    return {
      contentType,
      tone,
      topics,
      hashtags,
      urgency: strategy.urgency,
      imageRecommendation,
      reasoningContext: `${strategy.reasoning} (${timeContext.audienceMood} audience, ${timeContext.engagementExpectation} engagement expected)`
    };
  }

  private getTimeSpecificTopics(timeContext: TimeContext, strategy: any): string[] {
    const baseTopics = {
      morning: [
        'morning health routines',
        'preventive medicine breakthroughs',
        'AI-powered early detection',
        'healthy start technologies',
        'wellness innovation'
      ],
      midday: [
        'clinical research findings',
        'healthcare data analysis',
        'medical technology developments',
        'policy implications',
        'industry trends'
      ],
      afternoon: [
        'trending health technologies',
        'controversial medical topics',
        'patient experience innovations',
        'healthcare accessibility',
        'future of medicine'
      ],
      evening: [
        'healthcare storytelling',
        'medical technology philosophy',
        'patient empowerment',
        'health equity discussions',
        'innovation implications'
      ],
      late: [
        'timeless health wisdom',
        'basic health principles',
        'simple wellness tips',
        'health technology basics',
        'inspirational recovery stories'
      ]
    };

    let timeKey: keyof typeof baseTopics;
    if (timeContext.hour >= 6 && timeContext.hour <= 10) timeKey = 'morning';
    else if (timeContext.hour >= 11 && timeContext.hour <= 14) timeKey = 'midday';
    else if (timeContext.hour >= 15 && timeContext.hour <= 18) timeKey = 'afternoon';
    else if (timeContext.hour >= 19 && timeContext.hour <= 22) timeKey = 'evening';
    else timeKey = 'late';

    return baseTopics[timeKey];
  }

  private getTimeSpecificHashtags(timeContext: TimeContext, strategy: any): string[] {
    // HUMAN VOICE: No hashtags - return empty array
    return [];
  }

  private selectContentType(timeContext: TimeContext, strategy: any): string {
    if (timeContext.isPeakHour && timeContext.engagementExpectation === 'high') {
      return 'high_engagement_breakthrough';
    } else if (timeContext.audienceMood === 'motivated_morning') {
      return 'inspirational_innovation';
    } else if (timeContext.audienceMood === 'focused_midday') {
      return 'educational_research';
    } else if (timeContext.audienceMood === 'engaged_afternoon') {
      return 'trending_discussion';
    } else if (timeContext.audienceMood === 'relaxed_evening') {
      return 'thoughtful_insight';
    } else {
      return 'evergreen_wisdom';
    }
  }

  private adjustToneForTime(timeContext: TimeContext, strategy: any): string {
    const baseTone = strategy.tone;
    
    if (timeContext.isWeekend) {
      return `relaxed_${baseTone}`;
    } else if (timeContext.isPeakHour) {
      return `professional_${baseTone}`;
    } else if (timeContext.audienceMood === 'quiet_late') {
      return `gentle_${baseTone}`;
    } else {
      return baseTone;
    }
  }

  private getImageRecommendation(timeContext: TimeContext, strategy: any): string {
    if (timeContext.isPeakHour) {
      return 'high-impact visual - include compelling medical/tech imagery';
    } else if (timeContext.isWeekend) {
      return 'friendly, approachable imagery - less clinical, more lifestyle';
    } else if (timeContext.audienceMood === 'motivated_morning') {
      return 'bright, optimistic imagery - sunrise, fresh starts, innovation';
    } else if (timeContext.audienceMood === 'relaxed_evening') {
      return 'warm, thoughtful imagery - softer lighting, human connection';
    } else {
      return 'professional, clean imagery - charts, tech, medical equipment';
    }
  }

  private getDefaultGuidance(): ContextualGuidance {
    return {
      contentType: 'general_health_tech',
      tone: 'professional',
      topics: ['AI healthcare', 'digital medicine', 'health innovation'],
      hashtags: [], // HUMAN VOICE: No hashtags
      urgency: 'medium',
      imageRecommendation: 'professional healthcare technology imagery',
      reasoningContext: 'Default guidance due to analysis failure'
    };
  }

  // Enhanced method to provide content-specific recommendations
  async getEnhancedContentRecommendations(): Promise<{
    contentGuidance: ContextualGuidance;
    specificSuggestions: string[];
    avoidanceTopics: string[];
    engagementTactics: string[];
  }> {
    const guidance = await this.getContextualGuidance();
    const timeContext = this.getCurrentTimeContext();

    const specificSuggestions = this.generateSpecificSuggestions(timeContext, guidance);
    const avoidanceTopics = this.getAvoidanceTopics(timeContext);
    const engagementTactics = this.getEngagementTactics(timeContext, guidance);

    return {
      contentGuidance: guidance,
      specificSuggestions,
      avoidanceTopics,
      engagementTactics
    };
  }

  private generateSpecificSuggestions(timeContext: TimeContext, guidance: ContextualGuidance): string[] {
    const suggestions = [];

    if (timeContext.isPeakHour) {
      suggestions.push('Use specific statistics and breakthrough findings');
      suggestions.push('Include compelling calls-to-action');
      suggestions.push('Leverage trending healthcare topics');
    }

    if (timeContext.isWeekend) {
      suggestions.push('Focus on evergreen, shareable content');
      suggestions.push('Use warmer, more personal tone');
      suggestions.push('Avoid heavy technical jargon');
    }

    if (timeContext.audienceMood === 'motivated_morning') {
      suggestions.push('Lead with positive, actionable insights');
      suggestions.push('Highlight prevention and early detection');
      suggestions.push('Use forward-looking language');
    }

    if (timeContext.audienceMood === 'engaged_afternoon') {
      suggestions.push('Ask thought-provoking questions');
      suggestions.push('Share controversial but well-supported viewpoints');
      suggestions.push('Encourage discussion and debate');
    }

    return suggestions;
  }

  private getAvoidanceTopics(timeContext: TimeContext): string[] {
    const avoid = [];

    if (timeContext.audienceMood === 'motivated_morning') {
      avoid.push('negative health outcomes');
      avoid.push('healthcare system failures');
      avoid.push('pessimistic predictions');
    }

    if (timeContext.isWeekend) {
      avoid.push('complex technical details');
      avoid.push('urgent breaking news tone');
      avoid.push('work-related health stress');
    }

    if (timeContext.audienceMood === 'relaxed_evening') {
      avoid.push('anxiety-inducing health topics');
      avoid.push('urgent calls to action');
      avoid.push('highly technical content');
    }

    return avoid;
  }

  private getEngagementTactics(timeContext: TimeContext, guidance: ContextualGuidance): string[] {
    const tactics = [];

    if (timeContext.isPeakHour) {
      tactics.push('Use engagement maximizer mode');
      tactics.push('Include compelling visuals');
      tactics.push('Post multiple related tweets in thread format');
    }

    if (guidance.urgency === 'high') {
      tactics.push('Use immediate value propositions');
      tactics.push('Include time-sensitive language');
      tactics.push('Leverage FOMO (fear of missing out)');
    }

    if (timeContext.audienceMood === 'engaged_afternoon') {
      tactics.push('Ask direct questions to audience');
      tactics.push('Create polls and interactive content');
      tactics.push('Respond quickly to comments');
    }

    return tactics;
  }
} 