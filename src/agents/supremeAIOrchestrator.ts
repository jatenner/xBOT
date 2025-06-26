import { HumanLikeStrategicMind } from './humanLikeStrategicMind';
import { strategicOpportunityScheduler } from './strategicOpportunityScheduler';
import { PostTweetAgent } from './postTweet';
import { NewsAPIAgent } from './newsAPIAgent';
import { RealTimeTrendsAgent } from './realTimeTrendsAgent';
import { RealTimeEngagementTracker } from './realTimeEngagementTracker';
import { TimingOptimizationAgent } from './timingOptimizationAgent';
import { ViralContentAgent } from './viralContentAgent';
import { UltraViralGenerator } from './ultraViralGenerator';
import { CreativeContentAgent } from './creativeContentAgent';
import { StrategistAgent } from './strategistAgent';
import { AdaptiveContentLearner } from './adaptiveContentLearner';
import { openaiClient } from '../utils/openaiClient';
import { intelligenceCache } from '../utils/intelligenceCache';
import { supabaseClient } from '../utils/supabaseClient';

interface MasterStrategy {
  mode: 'trending_opportunity' | 'engagement_building' | 'thought_leadership' | 'viral_creation' | 'educational_value' | 'community_building';
  confidence: number;
  reasoning: string;
  contentStrategy: ContentStrategy;
  postingStrategy: PostingStrategy;
  agentOrchestration: AgentTask[];
}

interface ContentStrategy {
  primaryGoal: 'viral_reach' | 'engagement_depth' | 'authority_building' | 'community_growth' | 'educational_impact';
  contentMix: {
    trending: number; // 0-1
    original: number; // 0-1
    educational: number; // 0-1
    controversial: number; // 0-1
    community: number; // 0-1
  };
  toneAndStyle: string;
  targetAudience: string;
}

interface PostingStrategy {
  frequency: 'immediate' | 'burst' | 'steady' | 'opportunistic' | 'conservative';
  postCount: number;
  timeSpacing: number; // minutes between posts
  urgency: number; // 0-1
}

interface AgentTask {
  agent: string;
  task: string;
  priority: number;
  expectedOutput: string;
  dependencies: string[];
}

interface GlobalContext {
  currentTrends: any[];
  breakingNews: any[];
  engagementLevels: any;
  competitorActivity: any;
  audienceState: string;
  marketSentiment: string;
  timeContext: string;
  contentPerformanceHistory: any;
  strategicGoals: string[];
}

export class SupremeAIOrchestrator {
  private lastStartup: number = Date.now();
  // All AI agents under command
  private humanStrategicMind: HumanLikeStrategicMind;
  private strategicScheduler: typeof strategicOpportunityScheduler;
  private postTweetAgent: PostTweetAgent;
  private newsAgent: NewsAPIAgent;
  private trendsAgent: RealTimeTrendsAgent;
  private engagementTracker: RealTimeEngagementTracker;
  private timingAgent: TimingOptimizationAgent;
  private viralAgent: ViralContentAgent;
  private ultraViralGenerator: UltraViralGenerator;
  private creativeAgent: CreativeContentAgent;
  private strategistAgent: StrategistAgent;
  private learningAgent: AdaptiveContentLearner;

  // Master AI state
  private currentStrategy: MasterStrategy | null = null;
  private globalContext: GlobalContext | null = null;
  private lastDecisionTime: Date | null = null;
  private strategicMemory: Map<string, any> = new Map();
  private performanceMetrics: Map<string, number> = new Map();

  constructor() {
    this.humanStrategicMind = new HumanLikeStrategicMind();
    this.strategicScheduler = strategicOpportunityScheduler;
    this.postTweetAgent = new PostTweetAgent();
    this.newsAgent = NewsAPIAgent.getInstance();
    this.trendsAgent = new RealTimeTrendsAgent();
    this.engagementTracker = new RealTimeEngagementTracker();
    this.timingAgent = new TimingOptimizationAgent();
    this.viralAgent = new ViralContentAgent();
    this.ultraViralGenerator = new UltraViralGenerator();
    this.creativeAgent = new CreativeContentAgent();
    this.strategistAgent = new StrategistAgent();
    this.learningAgent = new AdaptiveContentLearner();
  }

  /**
   * 🧠 SUPREME AI DECISION MAKING: The master mind that controls everything
   */
  async makeSupremeDecision(): Promise<{
    shouldPost: boolean,
    strategy: MasterStrategy,
    executionPlan: any[],
    reasoning: string
  }> {
    console.log('🧠 EMERGENCY: Supreme AI in conservation mode during startup');
    if (Date.now() - (this.lastStartup || 0) < 600000) {
      console.log('⚡ Skipping orchestrator run - recently started');
      return { shouldPost: false, strategy: null, executionPlan: [], reasoning: 'Startup conservation mode' };
    }
    console.log('🧠 SUPREME AI ORCHESTRATOR AWAKENING...');
    console.log('   👑 Analyzing global context with supreme intelligence');
    console.log('   🎯 Making master strategic decisions');
    console.log('   🤖 Orchestrating all AI agents');

    // 1. Gather supreme global context
    const context = await this.gatherSupremeContext();
    
    // 2. Analyze with supreme intelligence
    const strategy = await this.generateMasterStrategy(context);
    
    // 3. Create execution plan
    const executionPlan = await this.createExecutionPlan(strategy, context);
    
    // 4. Generate supreme reasoning
    const reasoning = await this.generateSupremeReasoning(strategy, context);

    console.log('🧠 SUPREME DECISION COMPLETE:');
    console.log(`   👑 Mode: ${strategy.mode}`);
    console.log(`   🔥 Confidence: ${(strategy.confidence * 100).toFixed(0)}%`);
    console.log(`   🎯 Primary goal: ${strategy.contentStrategy.primaryGoal}`);
    console.log(`   📝 Posts planned: ${strategy.postingStrategy.postCount}`);
    console.log(`   🤖 Agents activated: ${strategy.agentOrchestration.length}`);

    return {
      shouldPost: strategy.postingStrategy.postCount > 0,
      strategy,
      executionPlan,
      reasoning
    };
  }

  /**
   * 🌍 GATHER SUPREME CONTEXT: Omniscient awareness of everything
   */
  private async gatherSupremeContext(): Promise<GlobalContext> {
    console.log('🌍 Gathering supreme global context...');

    // Parallel intelligence gathering from all sources
    const [
      humanInsights,
      strategicOpportunities,
      trends,
      news,
      engagement,
      timing,
      contentHistory,
      competitorAnalysis
    ] = await Promise.all([
      this.humanStrategicMind.analyzeWorldLikeHuman(),
      this.strategicScheduler.analyzeStrategicOpportunities(),
      this.trendsAgent.getTrendingHealthTopics(),
      this.newsAgent.fetchHealthTechNews(10),
      this.engagementTracker.generateEngagementReport(),
      this.timingAgent.shouldPostNow(),
      this.getContentPerformanceHistory(),
      this.analyzeCompetitorLandscape()
    ]);

    const now = new Date();
    const timeContext = this.getTimeContext(now);
    const audienceState = this.analyzeAudienceState(engagement);
    const marketSentiment = await this.analyzeMarketSentiment();

    return {
      currentTrends: trends,
      breakingNews: news.filter(n => this.isRecent(n.publishedAt, 6)),
      engagementLevels: engagement,
      competitorActivity: competitorAnalysis,
      audienceState,
      marketSentiment,
      timeContext,
      contentPerformanceHistory: contentHistory,
      strategicGoals: await this.getStrategicGoals()
    };
  }

  /**
   * 🎯 GENERATE MASTER STRATEGY: Supreme intelligence strategic planning
   */
  private async generateMasterStrategy(context: GlobalContext): Promise<MasterStrategy> {
    console.log('🎯 Generating master strategy with supreme intelligence...');

    // Use AI to analyze the global situation and decide strategy
    const strategyPrompt = `
    As the SUPREME AI ORCHESTRATOR for a health tech Twitter account, analyze this global context and decide the optimal strategy:

    TRENDING TOPICS: ${context.currentTrends.map(t => t.name).slice(0, 5).join(', ')}
    BREAKING NEWS: ${context.breakingNews.map(n => n.title).slice(0, 3).join('; ')}
    ENGAGEMENT STATE: ${context.audienceState}
    TIME CONTEXT: ${context.timeContext}
    MARKET SENTIMENT: ${context.marketSentiment}
    
    STRATEGIC OPTIONS:
    1. TRENDING_OPPORTUNITY: Capitalize on hot trends (high viral potential)
    2. ENGAGEMENT_BUILDING: Focus on audience interaction (when trends are weak)
    3. THOUGHT_LEADERSHIP: Establish authority (when competitors are quiet)
    4. VIRAL_CREATION: Create original viral content (when nothing trending)
    5. EDUCATIONAL_VALUE: Provide deep value (during engagement windows)
    6. COMMUNITY_BUILDING: Strengthen follower relationships (quiet periods)

    Choose the OPTIMAL strategy and content mix. Consider:
    - If strong trends exist: lean trending (70%) + original (30%)
    - If weak trends: lean original (60%) + educational (40%)
    - If audience highly engaged: go viral/controversial
    - If audience quiet: provide value/education
    - If competitors quiet: thought leadership opportunity

    Return JSON:
    {
      "mode": "strategy_name",
      "confidence": 0.85,
      "reasoning": "why this strategy",
      "contentMix": {
        "trending": 0.4,
        "original": 0.4,
        "educational": 0.2,
        "controversial": 0.1,
        "community": 0.1
      },
      "primaryGoal": "viral_reach",
      "postCount": 2,
      "urgency": 0.7
    }
    `;

    try {
      const response = await openaiClient.generateCompletion(strategyPrompt, {
        maxTokens: 400,
        temperature: 0.7
      });

      const aiDecision = JSON.parse(response);

      return {
        mode: aiDecision.mode,
        confidence: aiDecision.confidence,
        reasoning: aiDecision.reasoning,
        contentStrategy: {
          primaryGoal: aiDecision.primaryGoal,
          contentMix: aiDecision.contentMix,
          toneAndStyle: this.getToneForStrategy(aiDecision.mode),
          targetAudience: this.getTargetAudience(aiDecision.mode)
        },
        postingStrategy: {
          frequency: this.getFrequencyForUrgency(aiDecision.urgency),
          postCount: aiDecision.postCount,
          timeSpacing: this.getSpacingForStrategy(aiDecision.mode),
          urgency: aiDecision.urgency
        },
        agentOrchestration: await this.orchestrateAgents(aiDecision)
      };

    } catch (error) {
      console.warn('⚠️ AI strategy generation failed, using fallback');
      return this.getFallbackStrategy(context);
    }
  }

  /**
   * 🤖 ORCHESTRATE AGENTS: Command all AI agents like a master
   */
  private async orchestrateAgents(strategy: any): Promise<AgentTask[]> {
    const tasks: AgentTask[] = [];

    // Based on strategy, assign tasks to different agents
    switch (strategy.mode) {
      case 'trending_opportunity':
        tasks.push(
          {
            agent: 'viralAgent',
            task: 'Generate trending topic content',
            priority: 1,
            expectedOutput: 'Viral trending content',
            dependencies: []
          },
          {
            agent: 'strategistAgent',
            task: 'Optimize for maximum reach',
            priority: 2,
            expectedOutput: 'Reach optimization strategy',
            dependencies: ['viralAgent']
          }
        );
        break;

      case 'engagement_building':
        tasks.push(
          {
            agent: 'creativeAgent',
            task: 'Create engaging original content',
            priority: 1,
            expectedOutput: 'High-engagement original content',
            dependencies: []
          },
          {
            agent: 'learningAgent',
            task: 'Optimize for audience interaction',
            priority: 2,
            expectedOutput: 'Engagement optimization',
            dependencies: ['creativeAgent']
          }
        );
        break;

      case 'thought_leadership':
        tasks.push(
          {
            agent: 'strategistAgent',
            task: 'Generate authoritative insights',
            priority: 1,
            expectedOutput: 'Thought leadership content',
            dependencies: []
          },
          {
            agent: 'creativeAgent',
            task: 'Add unique perspective',
            priority: 2,
            expectedOutput: 'Unique expert angle',
            dependencies: ['strategistAgent']
          }
        );
        break;

      case 'viral_creation':
        tasks.push(
          {
            agent: 'ultraViralGenerator',
            task: 'Create breakthrough viral content',
            priority: 1,
            expectedOutput: 'Ultra-viral original content',
            dependencies: []
          },
          {
            agent: 'viralAgent',
            task: 'Optimize viral mechanics',
            priority: 2,
            expectedOutput: 'Viral optimization',
            dependencies: ['ultraViralGenerator']
          }
        );
        break;

      case 'educational_value':
        tasks.push(
          {
            agent: 'creativeAgent',
            task: 'Create educational content',
            priority: 1,
            expectedOutput: 'High-value educational content',
            dependencies: []
          },
          {
            agent: 'strategistAgent',
            task: 'Ensure authority positioning',
            priority: 2,
            expectedOutput: 'Authority reinforcement',
            dependencies: ['creativeAgent']
          }
        );
        break;

      case 'community_building':
        tasks.push(
          {
            agent: 'creativeAgent',
            task: 'Create community-focused content',
            priority: 1,
            expectedOutput: 'Community engagement content',
            dependencies: []
          },
          {
            agent: 'learningAgent',
            task: 'Optimize for relationship building',
            priority: 2,
            expectedOutput: 'Relationship optimization',
            dependencies: ['creativeAgent']
          }
        );
        break;
    }

    return tasks;
  }

  /**
   * 📋 CREATE EXECUTION PLAN: Master plan for content execution
   */
  private async createExecutionPlan(strategy: MasterStrategy, context: GlobalContext): Promise<any[]> {
    const plan = [];

    for (let i = 0; i < strategy.postingStrategy.postCount; i++) {
      const contentType = this.selectContentType(strategy.contentStrategy.contentMix, i);
      const agentToUse = this.selectAgentForContent(contentType, strategy.agentOrchestration);
      
      plan.push({
        sequence: i + 1,
        contentType,
        agent: agentToUse,
        timing: this.calculateOptimalTiming(i, strategy.postingStrategy),
        contentHint: this.generateContentHint(contentType, context),
        expectedEngagement: this.estimateEngagement(contentType, strategy),
        strategicPurpose: this.getStrategicPurpose(contentType, strategy.mode)
      });
    }

    return plan;
  }

  /**
   * 🧠 GENERATE SUPREME REASONING: Master AI's thought process
   */
  private async generateSupremeReasoning(strategy: MasterStrategy, context: GlobalContext): Promise<string> {
    const reasoningPrompt = `
    As the SUPREME AI ORCHESTRATOR, explain your strategic decision in a confident, intelligent manner:

    CHOSEN STRATEGY: ${strategy.mode}
    CONFIDENCE: ${(strategy.confidence * 100).toFixed(0)}%
    CONTENT MIX: ${Object.entries(strategy.contentStrategy.contentMix).map(([k,v]) => `${k}: ${(v*100).toFixed(0)}%`).join(', ')}
    POST COUNT: ${strategy.postingStrategy.postCount}

    Write 2-3 sentences explaining your supreme intelligence decision like:
    "My analysis reveals [situation]. Therefore, I'm implementing [strategy] with [confidence]% confidence. This approach will [expected outcome]."
    `;

    try {
      const response = await openaiClient.generateCompletion(reasoningPrompt, {
        maxTokens: 150,
        temperature: 0.6
      });
      
      return response;
    } catch (error) {
      return `Supreme analysis complete: Implementing ${strategy.mode} strategy with ${(strategy.confidence * 100).toFixed(0)}% confidence for optimal engagement.`;
    }
  }

  /**
   * 🎯 EXECUTE SUPREME STRATEGY: Command all agents to execute the plan
   */
  async executeSupremeStrategy(strategy: MasterStrategy, executionPlan: any[]): Promise<{
    success: boolean,
    executedPosts: number,
    results: any[]
  }> {
    console.log('🎯 EXECUTING SUPREME STRATEGY...');
    console.log(`   👑 Mode: ${strategy.mode}`);
    console.log(`   📝 Posts: ${executionPlan?.length || 0}`);
    console.log(`   🤖 Agents: ${strategy.agentOrchestration?.length || 0}`);

    const results = [];
    let executedPosts = 0;

    // Handle case where executionPlan is null/undefined
    const safePlan = executionPlan || [];
    
    for (const plan of safePlan) {
      try {
        console.log(`🤖 Executing post ${plan.sequence}/${safePlan.length}`);
        console.log(`   🎯 Type: ${plan.contentType}`);
        console.log(`   🤖 Agent: ${plan.agent}`);
        console.log(`   💡 Purpose: ${plan.strategicPurpose}`);

        // Execute with the designated agent
        const result = await this.executeWithAgent(plan.agent, plan.contentHint, plan.contentType);
        
        if (result.success) {
          executedPosts++;
          results.push({
            post: plan.sequence,
            success: true,
            content: result.content,
            agent: plan.agent,
            type: plan.contentType
          });

          // Wait between posts if not the last one
          if (plan.sequence < safePlan.length) {
            const delay = strategy.postingStrategy.timeSpacing * 60 * 1000;
            console.log(`⏰ Waiting ${strategy.postingStrategy.timeSpacing} minutes before next post...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } else {
          results.push({
            post: plan.sequence,
            success: false,
            error: result.error,
            agent: plan.agent
          });
        }

      } catch (error) {
        console.error(`❌ Post ${plan.sequence} execution failed:`, error);
        results.push({
          post: plan.sequence,
          success: false,
          error: error.message,
          agent: plan.agent
        });
      }
    }

    console.log(`🎯 SUPREME STRATEGY EXECUTION COMPLETE:`);
    console.log(`   ✅ Successful posts: ${executedPosts}/${safePlan.length}`);
    console.log(`   📊 Success rate: ${safePlan.length > 0 ? (executedPosts/safePlan.length*100).toFixed(0) : 0}%`);

    return {
      success: executedPosts > 0,
      executedPosts,
      results
    };
  }

  // Helper methods for the Supreme AI
  private async executeWithAgent(agentName: string, contentHint: string, contentType: string): Promise<any> {
    try {
      switch (agentName) {
        case 'viralAgent':
          const viralResult = await this.viralAgent.generateViralTweet();
          return { success: true, content: viralResult.content };
        case 'ultraViralGenerator':
          const ultraViralResult = await this.ultraViralGenerator.generateViralTweet(contentHint);
          return { success: true, content: ultraViralResult.content };
        case 'creativeAgent':
          const creativeResult = await this.creativeAgent.generateCreativeContent({
            type: 'original' as const,
            topic_focus: contentHint,
            audience_type: 'professional',
            creativity_level: 'innovative',
            engagement_goal: 'discussion'
          });
          return { success: true, content: creativeResult.content };
        case 'strategistAgent':
          // Strategist agent doesn't have a direct content generation method
          // Use the main posting agent for strategic content
          const strategicResult = await this.postTweetAgent.run(false, false, false);
          return strategicResult;
        default:
          // Fallback to main posting agent
          return await this.postTweetAgent.run(false, false, false);
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private selectContentType(contentMix: any, index: number): string {
    // Weighted selection based on content mix
    const rand = Math.random();
    let cumulative = 0;
    
    for (const [type, weight] of Object.entries(contentMix)) {
      cumulative += weight as number;
      if (rand <= cumulative) {
        return type;
      }
    }
    
    return 'original'; // fallback
  }

  private selectAgentForContent(contentType: string, agentTasks: AgentTask[]): string {
    const agentMap = {
      'trending': 'viralAgent',
      'original': 'creativeAgent',
      'educational': 'strategistAgent',
      'controversial': 'ultraViralGenerator',
      'community': 'creativeAgent'
    };
    
    return agentMap[contentType] || 'creativeAgent';
  }

  private calculateOptimalTiming(index: number, strategy: PostingStrategy): Date {
    const now = new Date();
    const spacing = strategy.timeSpacing * index;
    return new Date(now.getTime() + spacing * 60 * 1000);
  }

  private generateContentHint(contentType: string, context: GlobalContext): string {
    const hints = {
      'trending': `Trending topic: ${context.currentTrends[0]?.name || 'health tech'}`,
      'original': 'Original health tech insight',
      'educational': 'Educational health tech content',
      'controversial': 'Controversial health tech take',
      'community': 'Community engagement content'
    };
    
    return hints[contentType] || 'Health tech content';
  }

  private estimateEngagement(contentType: string, strategy: MasterStrategy): number {
    const baseEngagement = {
      'trending': 25,
      'original': 15,
      'educational': 12,
      'controversial': 30,
      'community': 18
    };
    
    return (baseEngagement[contentType] || 15) * strategy.confidence;
  }

  private getStrategicPurpose(contentType: string, mode: string): string {
    return `${contentType} content for ${mode.replace('_', ' ')} strategy`;
  }

  private getToneForStrategy(mode: string): string {
    const tones = {
      'trending_opportunity': 'enthusiastic and timely',
      'engagement_building': 'conversational and inviting',
      'thought_leadership': 'authoritative and insightful',
      'viral_creation': 'bold and provocative',
      'educational_value': 'informative and helpful',
      'community_building': 'warm and inclusive'
    };
    
    return tones[mode] || 'professional';
  }

  private getTargetAudience(mode: string): string {
    const audiences = {
      'trending_opportunity': 'trend followers and viral seekers',
      'engagement_building': 'active community members',
      'thought_leadership': 'industry professionals',
      'viral_creation': 'broad health tech audience',
      'educational_value': 'learners and professionals',
      'community_building': 'loyal followers'
    };
    
    return audiences[mode] || 'health tech professionals';
  }

  private getFrequencyForUrgency(urgency: number): PostingStrategy['frequency'] {
    if (urgency > 0.8) return 'immediate';
    if (urgency > 0.6) return 'burst';
    if (urgency > 0.4) return 'steady';
    if (urgency > 0.2) return 'opportunistic';
    return 'conservative';
  }

  private getSpacingForStrategy(mode: string): number {
    const spacing = {
      'trending_opportunity': 5, // 5 minutes for trending
      'engagement_building': 15,
      'thought_leadership': 30,
      'viral_creation': 10,
      'educational_value': 20,
      'community_building': 25
    };
    
    return spacing[mode] || 15;
  }

  private getFallbackStrategy(context: GlobalContext): MasterStrategy {
    return {
      mode: 'engagement_building',
      confidence: 0.6,
      reasoning: 'Fallback strategy for consistent engagement',
      contentStrategy: {
        primaryGoal: 'engagement_depth',
        contentMix: {
          trending: 0.3,
          original: 0.4,
          educational: 0.3,
          controversial: 0.0,
          community: 0.0
        },
        toneAndStyle: 'conversational',
        targetAudience: 'health tech community'
      },
      postingStrategy: {
        frequency: 'steady',
        postCount: 1,
        timeSpacing: 15,
        urgency: 0.5
      },
      agentOrchestration: []
    };
  }

  private getTimeContext(date: Date): string {
    const hour = date.getHours();
    const day = date.getDay();
    
    if (hour < 6) return 'early_morning_weekday';
    if (hour < 12) return 'morning_prime';
    if (hour < 17) return 'afternoon_peak';
    if (hour < 21) return 'evening_engagement';
    return 'night_quiet';
  }

  private analyzeAudienceState(engagement: any): string {
    if (!engagement) return 'unknown';
    
    const recent = engagement.recentEngagement || 0;
    const average = engagement.averageEngagement || 5;
    const ratio = recent / Math.max(average, 1);
    
    if (ratio > 2) return 'highly_engaged';
    if (ratio > 1.5) return 'engaged';
    if (ratio > 0.8) return 'normal';
    if (ratio > 0.5) return 'low_engagement';
    return 'very_quiet';
  }

  private async analyzeMarketSentiment(): Promise<string> {
    // Placeholder for market sentiment analysis
    return ['bullish', 'bearish', 'neutral', 'volatile'][Math.floor(Math.random() * 4)];
  }

  private async getContentPerformanceHistory(): Promise<any> {
    // Placeholder for content performance history
    return { trending: 0.7, original: 0.6, educational: 0.5 };
  }

  private async analyzeCompetitorLandscape(): Promise<any> {
    // Placeholder for competitor analysis
    return { activity: 'moderate', gaps: ['AI regulation', 'wearable privacy'] };
  }

  private async getStrategicGoals(): Promise<string[]> {
    return ['increase_engagement', 'build_authority', 'grow_following', 'drive_traffic'];
  }

  private isRecent(publishedAt: string, hours: number): boolean {
    const publishTime = new Date(publishedAt);
    const hoursAgo = (Date.now() - publishTime.getTime()) / (1000 * 60 * 60);
    return hoursAgo <= hours;
  }
}

export const supremeAIOrchestrator = new SupremeAIOrchestrator(); 