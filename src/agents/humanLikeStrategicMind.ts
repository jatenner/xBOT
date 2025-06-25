import { strategicOpportunityScheduler } from './strategicOpportunityScheduler';
import { NewsAPIAgent } from './newsAPIAgent';
import { RealTimeTrendsAgent } from './realTimeTrendsAgent';
import { RealTimeEngagementTracker } from './realTimeEngagementTracker';
import { intelligenceCache } from '../utils/intelligenceCache';
import { openaiClient } from '../utils/openaiClient';

interface StrategicInsight {
  type: 'pattern_recognition' | 'trend_connection' | 'news_synthesis' | 'timing_optimization' | 'competitive_advantage';
  insight: string;
  confidence: number;
  actionable: boolean;
  urgency: number;
  contentAngles: string[];
  postingStrategy: {
    when: 'immediate' | 'within_hour' | 'within_day' | 'wait_for_moment';
    postCount: number;
    contentType: 'breaking_reaction' | 'trend_analysis' | 'thought_leadership' | 'viral_take' | 'educational';
  };
}

interface StrategicContext {
  currentTrends: any[];
  breakingNews: any[];
  engagementPatterns: any;
  competitorActivity: any;
  worldEvents: any[];
  timeOfDay: string;
  dayOfWeek: string;
  marketSentiment: string;
}

export class HumanLikeStrategicMind {
  private newsAgent: NewsAPIAgent;
  private trendsAgent: RealTimeTrendsAgent;
  private engagementTracker: RealTimeEngagementTracker;
  
  private strategicMemory: Map<string, any> = new Map();
  private recentInsights: StrategicInsight[] = [];
  private lastAnalysisTime: Date | null = null;

  constructor() {
    this.newsAgent = new NewsAPIAgent();
    this.trendsAgent = new RealTimeTrendsAgent();
    this.engagementTracker = new RealTimeEngagementTracker();
  }

  /**
   * 🧠 HUMAN-LIKE STRATEGIC THINKING: Analyze the world like a savvy Twitter user
   */
  async analyzeWorldLikeHuman(): Promise<{
    insights: StrategicInsight[],
    postingRecommendations: any[],
    strategicNarrative: string
  }> {
    console.log('🧠 THINKING LIKE A STRATEGIC HUMAN...');
    console.log('   👀 Scanning the world for opportunities...');
    
    // 1. Gather comprehensive context (like you browsing Twitter/news)
    const context = await this.gatherStrategicContext();
    
    // 2. Generate human-like strategic insights
    const insights = await this.generateStrategicInsights(context);
    
    // 3. Create posting recommendations
    const recommendations = await this.createPostingRecommendations(insights, context);
    
    // 4. Generate strategic narrative (your internal monologue)
    const narrative = await this.generateStrategicNarrative(insights, context);
    
    console.log('🧠 STRATEGIC ANALYSIS COMPLETE:');
    console.log(`   💡 ${insights.length} strategic insights identified`);
    console.log(`   📝 ${recommendations.length} posting opportunities`);
    console.log(`   🎯 Strategic narrative: ${narrative.substring(0, 100)}...`);
    
    return {
      insights,
      postingRecommendations: recommendations,
      strategicNarrative: narrative
    };
  }

  /**
   * 🌍 GATHER STRATEGIC CONTEXT: Like browsing Twitter, news, and the internet
   */
  private async gatherStrategicContext(): Promise<StrategicContext> {
    console.log('🌍 Gathering strategic context from multiple sources...');
    
    const [trends, news, engagement] = await Promise.all([
      this.trendsAgent.getTrendingHealthTopics(),
      this.newsAgent.fetchHealthTechNews(15),
      this.engagementTracker.generateEngagementReport()
    ]);

    const now = new Date();
    const timeOfDay = this.getTimeOfDay(now.getHours());
    const dayOfWeek = this.getDayOfWeek(now.getDay());
    
    return {
      currentTrends: trends,
      breakingNews: news.filter(n => this.isRecent(n.publishedAt, 6)), // Last 6 hours
      engagementPatterns: engagement,
      competitorActivity: await this.analyzeCompetitorActivity(),
      worldEvents: await this.getWorldEvents(),
      timeOfDay,
      dayOfWeek,
      marketSentiment: await this.analyzeMarketSentiment()
    };
  }

  /**
   * 💡 GENERATE STRATEGIC INSIGHTS: Connect dots like a human strategist
   */
  private async generateStrategicInsights(context: StrategicContext): Promise<StrategicInsight[]> {
    const insights: StrategicInsight[] = [];
    
    // 🔍 PATTERN RECOGNITION: "I notice Apple Watch keeps coming up..."
    const patterns = await this.recognizePatterns(context);
    insights.push(...patterns);
    
    // 🔗 TREND CONNECTIONS: "This AI story + that regulation = opportunity"
    const connections = await this.connectTrends(context);
    insights.push(...connections);
    
    // 📰 NEWS SYNTHESIS: "Multiple stories pointing to same theme"
    const synthesis = await this.synthesizeNews(context);
    insights.push(...synthesis);
    
    // ⏰ TIMING OPTIMIZATION: "Perfect time to post about this"
    const timing = await this.optimizeTiming(context);
    insights.push(...timing);
    
    // 🎯 COMPETITIVE ADVANTAGE: "Competitors missing this angle"
    const competitive = await this.findCompetitiveAdvantages(context);
    insights.push(...competitive);
    
    return insights.sort((a, b) => (b.confidence * b.urgency) - (a.confidence * a.urgency));
  }

  /**
   * 🔍 PATTERN RECOGNITION: Like noticing "Apple Watch keeps trending"
   */
  private async recognizePatterns(context: StrategicContext): Promise<StrategicInsight[]> {
    const insights: StrategicInsight[] = [];
    
    // Analyze recurring themes in trends and news
    const themes = new Map<string, number>();
    
    // Count theme occurrences
    [...context.currentTrends, ...context.breakingNews].forEach(item => {
      const text = (item.name || item.title || '').toLowerCase();
      
      // Health tech themes
      if (text.includes('apple watch') || text.includes('wearable')) themes.set('wearables', (themes.get('wearables') || 0) + 1);
      if (text.includes('ai') || text.includes('artificial intelligence')) themes.set('ai_health', (themes.get('ai_health') || 0) + 1);
      if (text.includes('mental health') || text.includes('therapy')) themes.set('mental_health', (themes.get('mental_health') || 0) + 1);
      if (text.includes('fda') || text.includes('approval')) themes.set('regulation', (themes.get('regulation') || 0) + 1);
      if (text.includes('telemedicine') || text.includes('remote')) themes.set('telehealth', (themes.get('telehealth') || 0) + 1);
    });
    
    // Generate insights for strong patterns
    themes.forEach((count, theme) => {
      if (count >= 2) {
        insights.push({
          type: 'pattern_recognition',
          insight: `${theme.replace('_', ' ')} is having a moment - ${count} related stories/trends detected`,
          confidence: Math.min(0.9, count * 0.3),
          actionable: true,
          urgency: count >= 3 ? 0.8 : 0.6,
          contentAngles: this.generateContentAngles(theme),
          postingStrategy: {
            when: count >= 3 ? 'immediate' : 'within_hour',
            postCount: count >= 3 ? 3 : 2,
            contentType: 'trend_analysis'
          }
        });
      }
    });
    
    return insights;
  }

  /**
   * 🔗 CONNECT TRENDS: Like thinking "This + That = Opportunity"
   */
  private async connectTrends(context: StrategicContext): Promise<StrategicInsight[]> {
    const insights: StrategicInsight[] = [];
    
    // Use AI to find connections between trends and news
    const connectionPrompt = `
    Analyze these trends and news stories like a strategic Twitter user:
    
    TRENDS: ${context.currentTrends.map(t => t.name).join(', ')}
    NEWS: ${context.breakingNews.map(n => n.title).slice(0, 5).join('; ')}
    
    Find 2-3 strategic connections where combining topics could create viral content.
    Think like: "AI regulation news + Apple Watch trend = perfect timing for digital health privacy post"
    
    Return JSON format:
    {
      "connections": [
        {
          "connection": "description",
          "topics": ["topic1", "topic2"], 
          "angle": "content angle",
          "urgency": 0.7
        }
      ]
    }
    `;
    
    try {
      const response = await openaiClient.generateCompletion(connectionPrompt, {
        maxTokens: 300,
        temperature: 0.7
      });
      
      const connections = this.extractJsonFromResponse(response);
      
      connections.connections?.forEach((conn: any) => {
        insights.push({
          type: 'trend_connection',
          insight: `Strategic connection: ${conn.connection}`,
          confidence: 0.75,
          actionable: true,
          urgency: conn.urgency || 0.6,
          contentAngles: [conn.angle],
          postingStrategy: {
            when: conn.urgency > 0.7 ? 'immediate' : 'within_hour',
            postCount: 2,
            contentType: 'thought_leadership'
          }
        });
      });
    } catch (error) {
      console.warn('⚠️ Trend connection analysis failed:', error);
    }
    
    return insights;
  }

  /**
   * 📰 SYNTHESIZE NEWS: Like seeing multiple stories pointing to same theme
   */
  private async synthesizeNews(context: StrategicContext): Promise<StrategicInsight[]> {
    const insights: StrategicInsight[] = [];
    
    if (context.breakingNews.length >= 2) {
      const synthesisPrompt = `
      Analyze these health tech news stories like a strategic content creator:
      
      ${context.breakingNews.slice(0, 5).map(n => `• ${n.title}`).join('\n')}
      
      Find the bigger narrative or theme connecting these stories.
      What's the strategic takeaway a health tech expert should share?
      
      Return JSON:
      {
        "narrative": "the bigger story",
        "strategic_angle": "expert perspective to share", 
        "urgency": 0.8
      }
      `;
      
      try {
        const response = await openaiClient.generateCompletion(synthesisPrompt, {
          maxTokens: 200,
          temperature: 0.6
        });
        
        const synthesis = this.extractJsonFromResponse(response);
        
        insights.push({
          type: 'news_synthesis',
          insight: `News synthesis: ${synthesis.narrative}`,
          confidence: 0.8,
          actionable: true,
          urgency: synthesis.urgency || 0.7,
          contentAngles: [synthesis.strategic_angle],
          postingStrategy: {
            when: 'within_hour',
            postCount: 2,
            contentType: 'thought_leadership'
          }
        });
      } catch (error) {
        console.warn('⚠️ News synthesis failed:', error);
      }
    }
    
    return insights;
  }

  /**
   * ⏰ OPTIMIZE TIMING: Like knowing "perfect time to post about this"
   */
  private async optimizeTiming(context: StrategicContext): Promise<StrategicInsight[]> {
    const insights: StrategicInsight[] = [];
    
    const now = new Date();
    const hour = now.getHours();
    
    // Peak engagement times
    if (hour >= 13 && hour <= 15) { // 1-3 PM peak
      insights.push({
        type: 'timing_optimization',
        insight: 'Peak engagement window - perfect for viral content',
        confidence: 0.9,
        actionable: true,
        urgency: 0.8,
        contentAngles: ['viral take', 'controversial opinion', 'hot take'],
        postingStrategy: {
          when: 'immediate',
          postCount: 2,
          contentType: 'viral_take'
        }
      });
    }
    
    // Evening engagement
    if (hour >= 19 && hour <= 21) { // 7-9 PM
      insights.push({
        type: 'timing_optimization',
        insight: 'Evening engagement window - great for educational content',
        confidence: 0.8,
        actionable: true,
        urgency: 0.7,
        contentAngles: ['educational thread', 'deep dive', 'expert analysis'],
        postingStrategy: {
          when: 'immediate',
          postCount: 1,
          contentType: 'educational'
        }
      });
    }
    
    return insights;
  }

  /**
   * 🎯 FIND COMPETITIVE ADVANTAGES: Like noticing "competitors missing this"
   */
  private async findCompetitiveAdvantages(context: StrategicContext): Promise<StrategicInsight[]> {
    const insights: StrategicInsight[] = [];
    
    // Simulate competitor gap analysis
    const competitorGaps = [
      'AI regulation implications',
      'Wearable privacy concerns', 
      'Mental health app effectiveness',
      'Telemedicine accessibility'
    ];
    
    competitorGaps.forEach(gap => {
      insights.push({
        type: 'competitive_advantage',
        insight: `Competitor gap identified: ${gap} - opportunity for thought leadership`,
        confidence: 0.7,
        actionable: true,
        urgency: 0.6,
        contentAngles: [`expert take on ${gap}`, `contrarian view on ${gap}`],
        postingStrategy: {
          when: 'within_day',
          postCount: 1,
          contentType: 'thought_leadership'
        }
      });
    });
    
    return insights;
  }

  /**
   * 📝 CREATE POSTING RECOMMENDATIONS: Turn insights into actionable posts
   */
  private async createPostingRecommendations(insights: StrategicInsight[], context: StrategicContext): Promise<any[]> {
    const recommendations = [];
    
    // Convert high-confidence, urgent insights into posting recommendations
    const actionableInsights = insights.filter(i => i.actionable && i.urgency > 0.5);
    
    for (const insight of actionableInsights.slice(0, 5)) {
      recommendations.push({
        trigger: insight.insight,
        urgency: insight.urgency,
        when: insight.postingStrategy.when,
        postCount: insight.postingStrategy.postCount,
        contentType: insight.postingStrategy.contentType,
        contentAngles: insight.contentAngles,
        estimatedEngagement: this.estimateEngagement(insight),
        strategicReason: `Human-like insight: ${insight.type}`
      });
    }
    
    return recommendations;
  }

  /**
   * 📖 GENERATE STRATEGIC NARRATIVE: Your internal monologue
   */
  private async generateStrategicNarrative(insights: StrategicInsight[], context: StrategicContext): Promise<string> {
    const narrativePrompt = `
    Write a strategic narrative like an expert Twitter user's internal monologue:
    
    INSIGHTS: ${insights.slice(0, 3).map(i => i.insight).join('; ')}
    CONTEXT: ${context.timeOfDay}, ${context.dayOfWeek}
    TRENDS: ${context.currentTrends.slice(0, 3).map(t => t.name).join(', ')}
    
    Write 2-3 sentences like: "I'm noticing Apple Watch keeps trending, and with that new FDA story, there's a perfect opportunity to post about wearable regulation. The timing is perfect since it's peak engagement hours..."
    `;
    
    try {
      const response = await openaiClient.generateCompletion(narrativePrompt, {
        maxTokens: 150,
        temperature: 0.7
      });
      
      return response;
    } catch (error) {
      return `Strategic analysis complete: ${insights.length} opportunities identified during ${context.timeOfDay} on ${context.dayOfWeek}.`;
    }
  }

  // Helper methods
  private generateContentAngles(theme: string): string[] {
    const angles = {
      'wearables': ['privacy implications', 'health data accuracy', 'FDA oversight'],
      'ai_health': ['diagnostic accuracy', 'doctor replacement fears', 'data bias'],
      'mental_health': ['app effectiveness', 'therapy accessibility', 'stigma reduction'],
      'regulation': ['innovation vs safety', 'global standards', 'startup impact'],
      'telehealth': ['rural access', 'insurance coverage', 'quality of care']
    };
    
    return angles[theme] || ['expert perspective', 'contrarian view', 'future implications'];
  }

  private estimateEngagement(insight: StrategicInsight): number {
    return Math.round(insight.confidence * insight.urgency * 30);
  }

  private getTimeOfDay(hour: number): string {
    if (hour < 6) return 'early_morning';
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    if (hour < 21) return 'evening';
    return 'night';
  }

  private getDayOfWeek(day: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day];
  }

  private isRecent(publishedAt: string, hours: number): boolean {
    const publishTime = new Date(publishedAt);
    const hoursAgo = (Date.now() - publishTime.getTime()) / (1000 * 60 * 60);
    return hoursAgo <= hours;
  }

  private async analyzeCompetitorActivity(): Promise<any> {
    // Placeholder for competitor analysis
    return { quietPeriod: Math.random() > 0.5 };
  }

  private async getWorldEvents(): Promise<any[]> {
    // Placeholder for world events
    return [];
  }

  private async analyzeMarketSentiment(): Promise<string> {
    // Placeholder for market sentiment
    return ['bullish', 'bearish', 'neutral'][Math.floor(Math.random() * 3)];
  }

  /**
   * 🛠️ HELPER: Extract JSON from OpenAI response that may include markdown
   */
  private extractJsonFromResponse(response: string): any {
    try {
      // First try direct parsing
      return JSON.parse(response);
    } catch (error) {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1]);
        } catch (innerError) {
          console.warn('Failed to parse extracted JSON:', innerError);
        }
      }
      
      // Try to find JSON object in the response
      const jsonObjectMatch = response.match(/\{[\s\S]*\}/);
      if (jsonObjectMatch) {
        try {
          return JSON.parse(jsonObjectMatch[0]);
        } catch (innerError) {
          console.warn('Failed to parse found JSON object:', innerError);
        }
      }
      
      throw error;
    }
  }
}

export const humanLikeStrategicMind = new HumanLikeStrategicMind(); 