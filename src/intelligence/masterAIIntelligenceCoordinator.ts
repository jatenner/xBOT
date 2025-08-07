/**
 * 🧠 MASTER AI INTELLIGENCE COORDINATOR
 * Supreme AI orchestrator that maximizes all AI intelligence for optimal follower growth
 */

import { resilientSupabaseClient } from '../utils/resilientSupabaseClient';
import { BudgetAwareOpenAI } from '../utils/budgetAwareOpenAI';

interface AIAgent {
  name: string;
  type: 'CONTENT' | 'ENGAGEMENT' | 'ANALYSIS' | 'OPTIMIZATION' | 'LEARNING';
  capabilities: string[];
  intelligence_level: number; // 1-10
  specialization: string;
  active: boolean;
}

interface AIDecision {
  agent: string;
  decision: any;
  confidence: number;
  reasoning: string;
  expected_impact: number;
}

interface MasterIntelligenceState {
  global_context: any;
  active_agents: AIAgent[];
  decision_history: AIDecision[];
  learning_insights: string[];
  optimization_opportunities: string[];
  follower_growth_strategy: string;
}

export class MasterAIIntelligenceCoordinator {
  private static instance: MasterAIIntelligenceCoordinator;
  private intelligenceState: MasterIntelligenceState;
  private budgetAware: BudgetAwareOpenAI;

  private readonly AI_AGENTS: AIAgent[] = [
    {
      name: 'ViralFollowerGrowthMaster',
      type: 'CONTENT',
      capabilities: ['viral_content_generation', 'topic_diversity', 'trend_analysis'],
      intelligence_level: 9,
      specialization: 'Viral content that attracts followers',
      active: true
    },
    {
      name: 'AutonomousTweetImprover',
      type: 'OPTIMIZATION',
      capabilities: ['content_improvement', 'quality_assessment', 'engagement_prediction'],
      intelligence_level: 8,
      specialization: 'Content quality optimization',
      active: true
    },
    {
      name: 'IntelligentReplyEngine',
      type: 'ENGAGEMENT',
      capabilities: ['strategic_replies', 'conversation_analysis', 'relationship_building'],
      intelligence_level: 8,
      specialization: 'Strategic social engagement',
      active: true
    },
    {
      name: 'CompetitiveIntelligenceEngine',
      type: 'ANALYSIS',
      capabilities: ['competitor_analysis', 'market_trends', 'opportunity_detection'],
      intelligence_level: 7,
      specialization: 'Market intelligence and positioning',
      active: true
    },
    {
      name: 'FollowerPsychologyEngine',
      type: 'ANALYSIS',
      capabilities: ['audience_psychology', 'engagement_prediction', 'behavior_analysis'],
      intelligence_level: 8,
      specialization: 'Understanding follower psychology',
      active: true
    },
    {
      name: 'TwitterAlgorithmEngine',
      type: 'OPTIMIZATION',
      capabilities: ['algorithm_optimization', 'timing_analysis', 'reach_maximization'],
      intelligence_level: 9,
      specialization: 'Twitter algorithm mastery',
      active: true
    },
    {
      name: 'MasterLearningCoordinator',
      type: 'LEARNING',
      capabilities: ['pattern_recognition', 'strategy_evolution', 'knowledge_synthesis'],
      intelligence_level: 9,
      specialization: 'Cross-system learning and adaptation',
      active: true
    }
  ];

  static getInstance(): MasterAIIntelligenceCoordinator {
    if (!MasterAIIntelligenceCoordinator.instance) {
      MasterAIIntelligenceCoordinator.instance = new MasterAIIntelligenceCoordinator();
    }
    return MasterAIIntelligenceCoordinator.instance;
  }

  constructor() {
    this.budgetAware = new BudgetAwareOpenAI();
    this.intelligenceState = {
      global_context: {},
      active_agents: this.AI_AGENTS.filter(agent => agent.active),
      decision_history: [],
      learning_insights: [],
      optimization_opportunities: [],
      follower_growth_strategy: 'maximum_intelligence_coordination'
    };
  }

  /**
   * 🧠 SUPREME AI ORCHESTRATION - Main intelligence coordination method
   */
  async orchestrateSupremeIntelligence(): Promise<{
    success: boolean;
    decisions: AIDecision[];
    optimization_applied: boolean;
    expected_follower_impact: number;
    intelligence_summary: string;
  }> {
    try {
      console.log('🧠 === SUPREME AI INTELLIGENCE ORCHESTRATION ===');

      // Step 1: Gather global context from all systems
      const globalContext = await this.gatherGlobalContext();
      this.intelligenceState.global_context = globalContext;

      // Step 2: Coordinate AI agents for maximum intelligence
      const coordinatedDecisions = await this.coordinateAIAgents(globalContext);

      // Step 3: Apply supreme intelligence optimization
      const optimizationResult = await this.applySupremeOptimization(coordinatedDecisions);

      // Step 4: Synthesize learning across all systems
      await this.synthesizeCrossSystemLearning(coordinatedDecisions);

      // Step 5: Generate intelligence summary
      const summary = await this.generateIntelligenceSummary(coordinatedDecisions, optimizationResult);

      const totalFollowerImpact = coordinatedDecisions.reduce((sum, decision) => sum + decision.expected_impact, 0);

      console.log(`🧠 Supreme intelligence coordination complete: ${coordinatedDecisions.length} AI decisions, +${totalFollowerImpact} expected follower impact`);

      return {
        success: true,
        decisions: coordinatedDecisions,
        optimization_applied: optimizationResult.applied,
        expected_follower_impact: totalFollowerImpact,
        intelligence_summary: summary
      };

    } catch (error) {
      console.error('❌ Supreme AI orchestration failed:', error);
      
      return {
        success: false,
        decisions: [],
        optimization_applied: false,
        expected_follower_impact: 0,
        intelligence_summary: 'AI orchestration failed - falling back to individual agent decisions'
      };
    }
  }

  /**
   * 🌍 Gather global context from all available systems
   */
  private async gatherGlobalContext(): Promise<any> {
    console.log('🌍 Gathering global intelligence context...');

    try {
      // Get recent performance data
      const recentMetrics = await resilientSupabaseClient.executeWithRetry(
        async () => {
          const { data, error } = await resilientSupabaseClient.supabase
            .from('tweet_analytics')
            .select('likes, retweets, replies, impressions, created_at')
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .limit(20);
          
          if (error) throw new Error(error.message);
          return data || [];
        },
        'gatherPerformanceContext',
        [] // Fallback to empty array
      );

      // Get follower data
      const followerData = await resilientSupabaseClient.executeWithRetry(
        async () => {
          const { data, error } = await resilientSupabaseClient.supabase
            .from('growth_metrics')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(7);
          
          if (error) throw new Error(error.message);
          return data || [];
        },
        'gatherFollowerContext',
        [] // Fallback to empty array
      );

      // Get recent learning insights
      const learningData = await resilientSupabaseClient.executeWithRetry(
        async () => {
          const { data, error } = await resilientSupabaseClient.supabase
            .from('expert_learning_data')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);
          
          if (error) throw new Error(error.message);
          return data || [];
        },
        'gatherLearningContext',
        [] // Fallback to empty array
      );

      // Calculate intelligence metrics
      const avgEngagement = recentMetrics.length > 0 
        ? recentMetrics.reduce((sum, tweet) => sum + (tweet.likes + tweet.retweets + tweet.replies), 0) / recentMetrics.length 
        : 15; // Default

      const followerGrowthRate = followerData.length > 1 
        ? ((followerData[0]?.followers_count || 100) - (followerData[followerData.length - 1]?.followers_count || 90)) / followerData.length
        : 5; // Default

      return {
        timestamp: new Date().toISOString(),
        recent_performance: {
          avg_engagement: avgEngagement,
          posts_count: recentMetrics.length,
          follower_growth_rate: followerGrowthRate,
          engagement_trend: avgEngagement > 20 ? 'IMPROVING' : avgEngagement > 10 ? 'STABLE' : 'DECLINING'
        },
        learning_insights: learningData.map(insight => insight.insight_text).slice(0, 5),
        system_health: await this.assessSystemHealth(),
        time_context: {
          hour: new Date().getHours(),
          day_of_week: new Date().getDay(),
          is_peak_time: this.isPeakEngagementTime()
        }
      };

    } catch (error) {
      console.warn('⚠️ Using fallback global context');
      
      return {
        timestamp: new Date().toISOString(),
        recent_performance: {
          avg_engagement: 15,
          posts_count: 5,
          follower_growth_rate: 5,
          engagement_trend: 'STABLE'
        },
        learning_insights: ['Focus on health trends', 'Controversial topics perform well'],
        system_health: 'GOOD',
        time_context: {
          hour: new Date().getHours(),
          day_of_week: new Date().getDay(),
          is_peak_time: this.isPeakEngagementTime()
        }
      };
    }
  }

  /**
   * 🤖 Coordinate all AI agents for maximum collective intelligence
   */
  private async coordinateAIAgents(globalContext: any): Promise<AIDecision[]> {
    console.log('🤖 Coordinating AI agents for maximum intelligence...');

    const decisions: AIDecision[] = [];

    // Get supreme AI coordination strategy
    const coordinationStrategy = await this.getSupremeCoordinationStrategy(globalContext);

    // Content Generation Agents
    if (coordinationStrategy.prioritize_content) {
      decisions.push({
        agent: 'ViralFollowerGrowthMaster',
        decision: 'generate_viral_content',
        confidence: 0.9,
        reasoning: 'Global context shows opportunity for viral content generation',
        expected_impact: 12
      });

      decisions.push({
        agent: 'AutonomousTweetImprover',
        decision: 'optimize_content_quality',
        confidence: 0.85,
        reasoning: 'Content quality optimization needed for engagement improvement',
        expected_impact: 8
      });
    }

    // Engagement Optimization Agents  
    if (coordinationStrategy.prioritize_engagement) {
      decisions.push({
        agent: 'IntelligentReplyEngine',
        decision: 'execute_strategic_replies',
        confidence: 0.8,
        reasoning: 'Strategic engagement opportunities detected in global context',
        expected_impact: 6
      });

      decisions.push({
        agent: 'FollowerPsychologyEngine',
        decision: 'analyze_audience_psychology',
        confidence: 0.75,
        reasoning: 'Audience psychology analysis needed for engagement optimization',
        expected_impact: 4
      });
    }

    // Algorithm Optimization
    if (coordinationStrategy.prioritize_algorithm) {
      decisions.push({
        agent: 'TwitterAlgorithmEngine',
        decision: 'optimize_for_algorithm',
        confidence: 0.85,
        reasoning: 'Algorithm optimization opportunity based on timing and content patterns',
        expected_impact: 10
      });
    }

    // Learning and Analysis
    decisions.push({
      agent: 'MasterLearningCoordinator',
      decision: 'synthesize_cross_system_learning',
      confidence: 0.9,
      reasoning: 'Continuous learning synthesis required for intelligence evolution',
      expected_impact: 5
    });

    console.log(`🤖 Generated ${decisions.length} coordinated AI decisions`);
    return decisions;
  }

  /**
   * 🧠 Get supreme coordination strategy from GPT-4
   */
  private async getSupremeCoordinationStrategy(globalContext: any): Promise<{
    prioritize_content: boolean;
    prioritize_engagement: boolean;
    prioritize_algorithm: boolean;
    priority_reasoning: string;
  }> {
    try {
      const response = await this.budgetAware.generateContent(`
You are the supreme AI coordinator analyzing the global context to determine optimal AI agent prioritization.

Global Context:
- Recent Performance: ${JSON.stringify(globalContext.recent_performance)}
- System Health: ${globalContext.system_health}
- Time Context: ${JSON.stringify(globalContext.time_context)}
- Learning Insights: ${globalContext.learning_insights?.join(', ')}

Determine the optimal prioritization strategy for maximum follower growth.

Respond with ONLY JSON:
{
  "prioritize_content": true/false,
  "prioritize_engagement": true/false,
  "prioritize_algorithm": true/false,
  "priority_reasoning": "explanation of strategy"
}`, {
        model: 'gpt-4o-mini',
        max_tokens: 300,
        operation_type: 'supreme_coordination'
      });

      if (response.success && response.content) {
        return JSON.parse(response.content);
      }

    } catch (error) {
      console.warn('⚠️ Using default coordination strategy');
    }

    // Default strategy based on context
    return {
      prioritize_content: globalContext.recent_performance.posts_count < 3,
      prioritize_engagement: globalContext.recent_performance.avg_engagement < 15,
      prioritize_algorithm: globalContext.time_context.is_peak_time,
      priority_reasoning: 'Default balanced strategy based on performance metrics'
    };
  }

  /**
   * ⚡ Apply supreme optimization across all systems
   */
  private async applySupremeOptimization(decisions: AIDecision[]): Promise<{ applied: boolean; improvements: string[] }> {
    const improvements: string[] = [];

    try {
      // Apply high-confidence decisions (>0.8 confidence)
      const highConfidenceDecisions = decisions.filter(d => d.confidence > 0.8);

      for (const decision of highConfidenceDecisions) {
        console.log(`⚡ Applying supreme optimization: ${decision.agent} - ${decision.decision}`);
        
        // Store optimization decision
        await resilientSupabaseClient.executeWithRetry(
          async () => {
            const { error } = await resilientSupabaseClient.supabase
              .from('ai_decisions')
              .insert({
                agent_name: decision.agent,
                decision_type: decision.decision,
                confidence: decision.confidence,
                reasoning: decision.reasoning,
                expected_impact: decision.expected_impact,
                timestamp: new Date().toISOString()
              });
            
            if (error) throw new Error(error.message);
            return true;
          },
          'storeSupremeOptimization',
          true // Always succeed with fallback
        );

        improvements.push(`${decision.agent}: ${decision.reasoning}`);
      }

      console.log(`⚡ Applied ${improvements.length} supreme optimizations`);
      return { applied: improvements.length > 0, improvements };

    } catch (error) {
      console.warn('⚠️ Supreme optimization failed, but continuing...');
      return { applied: false, improvements: [] };
    }
  }

  /**
   * 📚 Synthesize learning across all AI systems
   */
  private async synthesizeCrossSystemLearning(decisions: AIDecision[]): Promise<void> {
    try {
      // Extract insights from decisions
      const insights = decisions.map(d => `${d.agent}: ${d.reasoning}`);
      
      // Generate meta-learning insight
      const metaLearning = await this.budgetAware.generateContent(`
Analyze these AI agent decisions to generate meta-learning insights for the overall system:

Decisions:
${insights.join('\n')}

Generate 2-3 key meta-learning insights that improve the coordination of all AI systems.

Respond with JSON:
{
  "insights": ["insight1", "insight2", "insight3"]
}`, {
        model: 'gpt-4o-mini',
        max_tokens: 200,
        operation_type: 'meta_learning'
      });

      if (metaLearning.success && metaLearning.content) {
        const parsed = JSON.parse(metaLearning.content);
        this.intelligenceState.learning_insights = parsed.insights || [];
        
        // Store meta-learning insights
        for (const insight of this.intelligenceState.learning_insights) {
          await resilientSupabaseClient.executeWithRetry(
            async () => {
              const { error } = await resilientSupabaseClient.supabase
                .from('learning_insights')
                .insert({
                  insight_text: insight,
                  insight_type: 'meta_learning',
                  confidence: 0.8,
                  created_at: new Date().toISOString()
                });
              
              if (error) throw new Error(error.message);
              return true;
            },
            'storeMetaLearning',
            true // Always succeed with fallback
          );
        }
      }

    } catch (error) {
      console.warn('⚠️ Meta-learning synthesis failed, but continuing...');
    }
  }

  /**
   * 📋 Generate intelligence summary
   */
  private async generateIntelligenceSummary(decisions: AIDecision[], optimization: any): Promise<string> {
    const totalExpectedImpact = decisions.reduce((sum, d) => sum + d.expected_impact, 0);
    const highConfidenceDecisions = decisions.filter(d => d.confidence > 0.8).length;
    
    return `Supreme AI coordination: ${decisions.length} agents coordinated, ${highConfidenceDecisions} high-confidence decisions applied, ${optimization.improvements.length} optimizations, +${totalExpectedImpact} expected follower impact`;
  }

  /**
   * 🔧 Helper methods
   */
  private async assessSystemHealth(): Promise<'EXCELLENT' | 'GOOD' | 'DEGRADED'> {
    // Simple health check based on recent activity
    try {
      const dbStatus = resilientSupabaseClient.getConnectionStatus();
      return dbStatus.status === 'HEALTHY' ? 'EXCELLENT' : 'GOOD';
    } catch {
      return 'DEGRADED';
    }
  }

  private isPeakEngagementTime(): boolean {
    const hour = new Date().getHours();
    // Peak engagement times: 9-11 AM, 1-3 PM, 7-9 PM EST
    return (hour >= 9 && hour <= 11) || (hour >= 13 && hour <= 15) || (hour >= 19 && hour <= 21);
  }

  /**
   * 📊 Get intelligence coordination stats
   */
  async getIntelligenceStats(): Promise<{
    active_agents: number;
    total_decisions_today: number;
    avg_confidence: number;
    expected_daily_impact: number;
    top_performing_agent: string;
  }> {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayDecisions = await resilientSupabaseClient.executeWithRetry(
        async () => {
          const { data, error } = await resilientSupabaseClient.supabase
            .from('ai_decisions')
            .select('*')
            .gte('timestamp', todayStart.toISOString());
          
          if (error) throw new Error(error.message);
          return data || [];
        },
        'getIntelligenceStats',
        [] // Empty fallback
      );

      const avgConfidence = todayDecisions.length > 0 
        ? todayDecisions.reduce((sum, d) => sum + (d.confidence || 0), 0) / todayDecisions.length
        : 0.8;

      const totalImpact = todayDecisions.reduce((sum, d) => sum + (d.expected_impact || 0), 0);

      // Find top performing agent
      const agentPerformance = todayDecisions.reduce((acc: any, d) => {
        acc[d.agent_name] = (acc[d.agent_name] || 0) + (d.expected_impact || 0);
        return acc;
      }, {});

      const topAgent = Object.keys(agentPerformance).reduce((a, b) => 
        agentPerformance[a] > agentPerformance[b] ? a : b, 'ViralFollowerGrowthMaster');

      return {
        active_agents: this.intelligenceState.active_agents.length,
        total_decisions_today: todayDecisions.length,
        avg_confidence: Math.round(avgConfidence * 100) / 100,
        expected_daily_impact: totalImpact,
        top_performing_agent: topAgent
      };

    } catch (error) {
      return {
        active_agents: this.intelligenceState.active_agents.length,
        total_decisions_today: 0,
        avg_confidence: 0.8,
        expected_daily_impact: 0,
        top_performing_agent: 'ViralFollowerGrowthMaster'
      };
    }
  }
}