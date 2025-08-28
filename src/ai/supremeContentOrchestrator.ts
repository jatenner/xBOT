import OpenAI from 'openai';
import { admin } from '../lib/supabaseClients';

interface ContextData {
  trending_topics: string[];
  recent_posts: Array<{ content: string; engagement: number; timestamp: string }>;
  competitor_activity: Array<{ content: string; performance: number }>;
  audience_sentiment: 'positive' | 'negative' | 'neutral';
  time_of_day: string;
  engagement_window: 'peak' | 'medium' | 'low';
  follower_growth_rate: number;
  current_events: string[];
}

interface StrategicDecision {
  strategy: 'viral_trending' | 'counter_narrative' | 'educational_deep_dive' | 'controversial_take' | 'audience_building' | 'engagement_farming';
  content_type: 'thread' | 'single' | 'poll' | 'quote_tweet';
  timing: 'immediate' | 'delay_30min' | 'delay_60min' | 'peak_window';
  agent_selection: string[];
  reasoning: string;
  expected_outcome: string;
  confidence_score: number;
}

interface ContentStrategy {
  primary_approach: string;
  content_hooks: string[];
  engagement_tactics: string[];
  viral_elements: string[];
  audience_targeting: string[];
}

/**
 * 🧠 SUPREME AI CONTENT ORCHESTRATOR
 * The "God AI" that makes intelligent strategic decisions about content creation
 * Analyzes global context and orchestrates optimal posting strategies
 */
export class SupremeContentOrchestrator {
  private static instance: SupremeContentOrchestrator;
  private openai: OpenAI;
  private lastAnalysis: Date | null = null;
  private currentStrategy: StrategicDecision | null = null;

  private constructor() {
    this.openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });
  }

  public static getInstance(): SupremeContentOrchestrator {
    if (!SupremeContentOrchestrator.instance) {
      SupremeContentOrchestrator.instance = new SupremeContentOrchestrator();
    }
    return SupremeContentOrchestrator.instance;
  }

  /**
   * 🎯 MAIN ORCHESTRATION: Analyze context and make strategic decisions
   */
  public async orchestrateOptimalStrategy(): Promise<StrategicDecision> {
    console.log('🧠 SUPREME_AI: Beginning strategic analysis...');

    try {
      // 1. Gather comprehensive context
      const context = await this.gatherGlobalContext();
      
      // 2. Analyze using advanced AI
      const decision = await this.makeStrategicDecision(context);
      
      // 3. Cache and log decision
      this.currentStrategy = decision;
      this.lastAnalysis = new Date();
      
      console.log(`🎯 SUPREME_AI: Strategy decided: ${decision.strategy} (${decision.confidence_score}% confidence)`);
      console.log(`🧠 REASONING: ${decision.reasoning}`);
      
      return decision;

    } catch (error: any) {
      console.error('❌ SUPREME_AI: Strategic analysis failed:', error.message);
      
      // Fallback decision
      return {
        strategy: 'audience_building',
        content_type: 'single',
        timing: 'immediate',
        agent_selection: ['socialContentOperator'],
        reasoning: 'Fallback: Strategic analysis failed, using safe audience building approach',
        expected_outcome: 'Steady engagement with minimal risk',
        confidence_score: 60
      };
    }
  }

  /**
   * 🌍 CONTEXT GATHERING: Collect data from all available sources
   */
  private async gatherGlobalContext(): Promise<ContextData> {
    console.log('📊 SUPREME_AI: Gathering global context...');

    try {
      // Get recent posts performance
      const { data: recentPosts } = await admin
        .from('tweets')
        .select('content, likes_count, retweets_count, replies_count, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      // Calculate engagement rates
      const postsWithEngagement = recentPosts?.map(post => ({
        content: post.content?.substring(0, 100) || '',
        engagement: (post.likes_count || 0) + (post.retweets_count || 0) + (post.replies_count || 0),
        timestamp: post.created_at
      })) || [];

      // Get current time context
      const now = new Date();
      const hour = now.getHours();
      
      let engagementWindow: 'peak' | 'medium' | 'low' = 'low';
      if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 21)) {
        engagementWindow = 'peak';
      } else if ((hour >= 10 && hour <= 16) || (hour >= 21 && hour <= 23)) {
        engagementWindow = 'medium';
      }

      // Calculate follower growth rate (simplified)
      const avgEngagement = postsWithEngagement.reduce((sum, post) => sum + post.engagement, 0) / Math.max(postsWithEngagement.length, 1);
      const followerGrowthRate = Math.min(avgEngagement / 10, 100); // Estimate growth rate

      return {
        trending_topics: await this.getTrendingTopics(),
        recent_posts: postsWithEngagement,
        competitor_activity: await this.getCompetitorActivity(),
        audience_sentiment: avgEngagement > 20 ? 'positive' : avgEngagement > 10 ? 'neutral' : 'negative',
        time_of_day: hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening',
        engagement_window: engagementWindow,
        follower_growth_rate: followerGrowthRate,
        current_events: await this.getCurrentEvents()
      };

    } catch (error: any) {
      console.warn('⚠️ Context gathering failed, using defaults:', error.message);
      
      return {
        trending_topics: ['health optimization', 'productivity', 'wellness'],
        recent_posts: [],
        competitor_activity: [],
        audience_sentiment: 'neutral',
        time_of_day: 'afternoon',
        engagement_window: 'medium',
        follower_growth_rate: 50,
        current_events: []
      };
    }
  }

  /**
   * 🧠 STRATEGIC DECISION MAKING: Use AI to analyze context and choose optimal strategy
   */
  private async makeStrategicDecision(context: ContextData): Promise<StrategicDecision> {
    const prompt = `You are the Supreme AI Content Orchestrator for a health optimization Twitter account (@SignalAndSynapse). 

CURRENT CONTEXT:
- Trending Topics: ${context.trending_topics.join(', ')}
- Recent Performance: Average ${context.recent_posts.reduce((sum, p) => sum + p.engagement, 0) / Math.max(context.recent_posts.length, 1)} engagement
- Audience Sentiment: ${context.audience_sentiment}
- Time: ${context.time_of_day} (${context.engagement_window} engagement window)
- Follower Growth: ${context.follower_growth_rate}%
- Current Events: ${context.current_events.join(', ')}

Your job is to analyze this context and choose the optimal content strategy. Consider:
1. What type of content will maximize follower growth?
2. Should we ride trending topics or create counter-narratives?
3. What content format will perform best right now?
4. How can we differentiate from competitors?

STRATEGY OPTIONS:
- viral_trending: Capitalize on hot topics for maximum reach
- counter_narrative: Take contrarian view on trending topics
- educational_deep_dive: Share comprehensive educational content
- controversial_take: Make bold claims to spark debate
- audience_building: Focus on building genuine connections
- engagement_farming: Optimize for replies and interactions

CONTENT TYPES:
- thread: Multi-tweet educational content
- single: Standalone tweet with high impact
- poll: Interactive content for engagement
- quote_tweet: Commentary on trending content

TIMING OPTIONS:
- immediate: Post right now
- delay_30min: Wait for better positioning
- delay_60min: Wait for peak window
- peak_window: Wait for optimal engagement time

Respond in JSON format:
{
  "strategy": "[chosen strategy]",
  "content_type": "[chosen format]", 
  "timing": "[chosen timing]",
  "agent_selection": ["[list of AI agents to use]"],
  "reasoning": "[detailed explanation of choice]",
  "expected_outcome": "[predicted results]",
  "confidence_score": [1-100]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' },
        max_tokens: 500
      });

      const decision = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      // Validate and ensure all required fields
      return {
        strategy: decision.strategy || 'audience_building',
        content_type: decision.content_type || 'single',
        timing: decision.timing || 'immediate',
        agent_selection: decision.agent_selection || ['socialContentOperator'],
        reasoning: decision.reasoning || 'AI analysis complete',
        expected_outcome: decision.expected_outcome || 'Positive engagement expected',
        confidence_score: Math.min(Math.max(decision.confidence_score || 75, 0), 100)
      };

    } catch (error: any) {
      console.error('❌ AI strategic decision failed:', error.message);
      
      // Intelligent fallback based on context
      let strategy: StrategicDecision['strategy'] = 'audience_building';
      
      if (context.engagement_window === 'peak' && context.trending_topics.length > 0) {
        strategy = 'viral_trending';
      } else if (context.audience_sentiment === 'negative') {
        strategy = 'educational_deep_dive';
      } else if (context.follower_growth_rate < 30) {
        strategy = 'controversial_take';
      }

      return {
        strategy,
        content_type: context.engagement_window === 'peak' ? 'thread' : 'single',
        timing: 'immediate',
        agent_selection: ['socialContentOperator'],
        reasoning: 'Fallback strategy based on context analysis',
        expected_outcome: 'Moderate engagement with growth potential',
        confidence_score: 65
      };
    }
  }

  /**
   * 📈 Get trending topics from multiple sources
   */
  private async getTrendingTopics(): Promise<string[]> {
    // In a real implementation, this would connect to Twitter API, Google Trends, etc.
    // For now, return health-focused trending topics
    const healthTopics = [
      'sleep optimization', 'metabolic health', 'cognitive enhancement',
      'stress management', 'longevity research', 'biohacking',
      'nutrition science', 'exercise physiology', 'mental health',
      'productivity optimization', 'habit formation', 'wellness technology'
    ];

    // Simulate trend analysis by rotating topics
    const today = new Date().getDate();
    const startIndex = today % healthTopics.length;
    return healthTopics.slice(startIndex, startIndex + 3).concat(
      healthTopics.slice(0, Math.max(0, startIndex + 3 - healthTopics.length))
    ).slice(0, 3);
  }

  /**
   * 🔍 Analyze competitor activity patterns
   */
  private async getCompetitorActivity(): Promise<Array<{ content: string; performance: number }>> {
    // In a real implementation, this would scrape competitor profiles
    // For now, return simulated competitor insights
    return [
      { content: "New study on intermittent fasting...", performance: 85 },
      { content: "5 biohacking tips for better sleep...", performance: 72 },
      { content: "Controversial take on supplements...", performance: 91 }
    ];
  }

  /**
   * 📰 Get current health/tech events
   */
  private async getCurrentEvents(): Promise<string[]> {
    // In a real implementation, this would connect to news APIs
    return [
      'New AI health monitoring device launched',
      'Study reveals optimal sleep duration',
      'Breakthrough in longevity research'
    ];
  }

  /**
   * 🎯 Generate strategic content based on decision
   */
  public async generateStrategicContent(decision: StrategicDecision, topic?: string): Promise<string> {
    console.log(`🎯 SUPREME_AI: Generating ${decision.strategy} content...`);

    const contentStrategy = await this.createContentStrategy(decision, topic);
    
    const prompt = `You are generating ${decision.content_type} content using the ${decision.strategy} strategy.

STRATEGY DETAILS:
${contentStrategy.primary_approach}

CONTENT HOOKS TO USE: ${contentStrategy.content_hooks.join(', ')}
ENGAGEMENT TACTICS: ${contentStrategy.engagement_tactics.join(', ')}
VIRAL ELEMENTS: ${contentStrategy.viral_elements.join(', ')}
TARGET AUDIENCE: ${contentStrategy.audience_targeting.join(', ')}

TOPIC: ${topic || 'health optimization'}

Create high-quality ${decision.content_type === 'thread' ? 'multi-tweet thread (5-7 tweets)' : 'single tweet'} that implements this strategy.

REQUIREMENTS:
- Sound human and authentic
- Include specific, actionable insights
- Use engaging hooks and viral elements
- No hashtags
- Optimize for ${decision.strategy.replace('_', ' ')}

${decision.content_type === 'thread' ? 'Structure as numbered thread (1/, 2/, etc.)' : 'Single impactful tweet under 280 characters'}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: decision.content_type === 'thread' ? 800 : 300
      });

      const content = response.choices[0]?.message?.content?.trim() || '';
      
      console.log(`✅ SUPREME_AI: Generated ${decision.strategy} content (${content.length} chars)`);
      
      return content;

    } catch (error: any) {
      console.error('❌ Strategic content generation failed:', error.message);
      
      // Fallback content based on strategy
      const fallbacks = {
        viral_trending: "🚨 BREAKING: New research reveals the #1 factor that predicts longevity. Most people ignore it completely.",
        counter_narrative: "Unpopular opinion: The health advice everyone follows is actually making us sicker. Here's what works instead.",
        educational_deep_dive: "The science of sleep optimization: How small changes to your evening routine can improve recovery by 40%.",
        controversial_take: "Hot take: Supplements are a $40B scam. Here's what actually moves the needle for health.",
        audience_building: "3 years ago I was exhausted every day. Today I wake up energized. Here's exactly what changed.",
        engagement_farming: "What's the #1 health habit that changed your life? Wrong answers only 👇"
      };

      return fallbacks[decision.strategy] || fallbacks.audience_building;
    }
  }

  /**
   * 🎨 Create detailed content strategy based on decision
   */
  private async createContentStrategy(decision: StrategicDecision, topic?: string): Promise<ContentStrategy> {
    const strategies = {
      viral_trending: {
        primary_approach: "Capitalize on trending topics with authoritative, shareable insights that position us as thought leaders",
        content_hooks: ["🚨 BREAKING:", "📊 DATA REVEALS:", "🔥 TRENDING:", "⚡ JUST IN:"],
        engagement_tactics: ["shocking statistics", "contrarian angles", "exclusive insights", "call-to-action"],
        viral_elements: ["numbered lists", "specific data points", "controversy", "urgency"],
        audience_targeting: ["health enthusiasts", "early adopters", "influencers"]
      },
      counter_narrative: {
        primary_approach: "Challenge conventional wisdom with evidence-based contrarian perspectives that spark debate",
        content_hooks: ["Unpopular opinion:", "Hot take:", "Everyone's wrong about:", "The truth about:"],
        engagement_tactics: ["debate starters", "myth-busting", "provocative questions", "bold claims"],
        viral_elements: ["controversy", "surprising facts", "paradigm shifts", "social proof"],
        audience_targeting: ["skeptics", "critical thinkers", "health rebels"]
      },
      educational_deep_dive: {
        primary_approach: "Provide comprehensive, actionable education that establishes expertise and builds trust",
        content_hooks: ["Complete guide to:", "The science of:", "Everything you need to know:", "Deep dive:"],
        engagement_tactics: ["step-by-step guides", "scientific explanations", "practical examples", "saved content"],
        viral_elements: ["actionable insights", "comprehensive value", "bookmark-worthy", "shareability"],
        audience_targeting: ["students", "professionals", "health optimizers"]
      },
      controversial_take: {
        primary_approach: "Make bold, provocative statements that challenge industry norms and spark conversation",
        content_hooks: ["Controversial take:", "🔥 Hot take:", "Unpopular truth:", "Industry secret:"],
        engagement_tactics: ["inflammatory statements", "industry callouts", "sacred cow slaughter", "truth bombs"],
        viral_elements: ["shock value", "insider knowledge", "industry secrets", "bold predictions"],
        audience_targeting: ["industry insiders", "rebels", "truth seekers"]
      },
      audience_building: {
        primary_approach: "Share relatable, personal experiences that build connection and encourage following",
        content_hooks: ["Personal story:", "3 years ago:", "Lessons learned:", "My experience:"],
        engagement_tactics: ["vulnerability", "relatability", "personal transformation", "lessons learned"],
        viral_elements: ["authenticity", "transformation stories", "relatability", "inspiration"],
        audience_targeting: ["fellow travelers", "inspiration seekers", "personal growth enthusiasts"]
      },
      engagement_farming: {
        primary_approach: "Create interactive content designed to maximize comments, replies, and engagement",
        content_hooks: ["What's your:", "Wrong answers only:", "Rate this 1-10:", "Agree or disagree:"],
        engagement_tactics: ["open questions", "polls", "opinion requests", "community participation"],
        viral_elements: ["interactivity", "community building", "opinion sharing", "participation"],
        audience_targeting: ["community members", "active participants", "opinion leaders"]
      }
    };

    return strategies[decision.strategy] || strategies.audience_building;
  }

  /**
   * 📊 Get current strategic decision (if cached)
   */
  public getCurrentStrategy(): StrategicDecision | null {
    return this.currentStrategy;
  }

  /**
   * ⏰ Check if analysis is recent enough to use cached decision
   */
  public needsNewAnalysis(): boolean {
    if (!this.lastAnalysis) return true;
    
    const timeSinceAnalysis = Date.now() - this.lastAnalysis.getTime();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    
    return timeSinceAnalysis > maxAge;
  }
}

export const getSupremeOrchestrator = () => SupremeContentOrchestrator.getInstance();
