/**
 * 🚀 FOLLOWER GROWTH ORCHESTRATOR
 * 
 * Master intelligence system that coordinates all growth strategies:
 * - Viral content generation and optimization
 * - Community engagement automation
 * - Performance analysis and learning
 * - Strategy adaptation based on results
 * - Real-time growth optimization
 * - Predictive follower acquisition modeling
 */

import { ViralFollowerGrowthMaster } from '../agents/viralFollowerGrowthMaster';
import { CommunityEngagementMaster } from './communityEngagementMaster';
import { MasterLearningCoordinator } from './masterLearningCoordinator';
import { BudgetAwareOpenAI } from '../utils/budgetAwareOpenAI';
import { supabaseClient } from '../utils/supabaseClient';

interface GrowthMetrics {
  current_followers: number;
  daily_growth_rate: number;
  weekly_growth_rate: number;
  monthly_growth_rate: number;
  engagement_rate: number;
  viral_content_count: number;
  community_engagement_actions: number;
  follower_conversion_rate: number;
  growth_trend: 'explosive' | 'accelerating' | 'steady' | 'declining' | 'stagnant';
}

interface GrowthStrategy {
  strategy_name: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  content_focus: string[];
  engagement_tactics: string[];
  posting_frequency: number;
  controversy_level: string;
  expected_growth: number;
  confidence: number;
  implementation_steps: string[];
}

interface GrowthOptimization {
  current_performance: GrowthMetrics;
  identified_issues: string[];
  optimization_strategies: GrowthStrategy[];
  immediate_actions: string[];
  predicted_results: {
    followers_7_days: number;
    followers_30_days: number;
    engagement_improvement: number;
    viral_content_probability: number;
  };
}

interface DailyGrowthPlan {
  date: string;
  viral_content_quota: number;
  engagement_targets: number;
  content_themes: string[];
  engagement_strategies: string[];
  posting_schedule: string[];
  success_metrics: {
    target_followers: number;
    target_engagement: number;
    target_reach: number;
  };
}

export class FollowerGrowthOrchestrator {
  private static instance: FollowerGrowthOrchestrator;
  private viralContentMaster: ViralFollowerGrowthMaster;
  private engagementMaster: CommunityEngagementMaster;
  private learningCoordinator: MasterLearningCoordinator;
  private budgetAwareOpenAI: BudgetAwareOpenAI;

  private currentGrowthStrategy: GrowthStrategy | null = null;
  private lastOptimization: Date | null = null;
  private growthMetrics: GrowthMetrics | null = null;

  static getInstance(): FollowerGrowthOrchestrator {
    if (!this.instance) {
      this.instance = new FollowerGrowthOrchestrator();
    }
    return this.instance;
  }

  constructor() {
    this.viralContentMaster = ViralFollowerGrowthMaster.getInstance();
    this.engagementMaster = CommunityEngagementMaster.getInstance();
    this.learningCoordinator = MasterLearningCoordinator.getInstance();
    this.budgetAwareOpenAI = new BudgetAwareOpenAI(process.env.OPENAI_API_KEY || '');
  }

  /**
   * 🎯 EXECUTE COMPREHENSIVE FOLLOWER GROWTH STRATEGY
   */
  async executeGrowthStrategy(): Promise<{
    content_generated: boolean;
    engagement_executed: boolean;
    followers_projected: number;
    optimization_applied: boolean;
    growth_summary: string;
  }> {
    try {
      console.log('🚀 === FOLLOWER GROWTH ORCHESTRATOR ACTIVATED ===');

      // Step 1: Analyze current growth performance
      const currentMetrics = await this.analyzeCurrentGrowthMetrics();
      
      // Step 2: Optimize strategy based on performance
      const optimization = await this.optimizeGrowthStrategy(currentMetrics);
      
      // Step 3: Generate viral content aligned with strategy
      const contentResult = await this.generateStrategicContent(optimization);
      
      // Step 4: Execute community engagement actions
      const engagementResult = await this.executeStrategicEngagement(optimization);
      
      // Step 5: Update growth tracking and learning
      await this.updateGrowthTracking(currentMetrics, optimization, contentResult, engagementResult);
      
      // Step 6: Generate growth summary and projections
      const growthSummary = await this.generateGrowthSummary(currentMetrics, optimization, contentResult, engagementResult);

      console.log('✅ === GROWTH STRATEGY EXECUTION COMPLETE ===');
      console.log(`📈 Projected followers: +${contentResult.expected_followers + engagementResult.expected_followers}`);

      return {
        content_generated: contentResult.success,
        engagement_executed: engagementResult.actions_taken > 0,
        followers_projected: contentResult.expected_followers + engagementResult.expected_followers,
        optimization_applied: optimization.optimization_strategies.length > 0,
        growth_summary: growthSummary
      };

    } catch (error) {
      console.error('❌ Follower growth orchestration failed:', error);
      
      return {
        content_generated: false,
        engagement_executed: false,
        followers_projected: 0,
        optimization_applied: false,
        growth_summary: 'Growth orchestration failed - system will retry with fallback strategies'
      };
    }
  }

  /**
   * 📊 ANALYZE CURRENT GROWTH METRICS
   */
  private async analyzeCurrentGrowthMetrics(): Promise<GrowthMetrics> {
    try {
      // Get recent follower data
      const { data: followerData, error: followerError } = await supabaseClient.supabase
        .from('follower_growth_tracking')
        .select('*')
        .order('date', { ascending: false })
        .limit(30);

      // Get recent engagement data
      const { data: engagementData, error: engagementError } = await supabaseClient.supabase
        .from('tweet_analytics')
        .select('likes, retweets, replies, viral_score, follower_gain')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      const currentFollowers = followerData?.[0]?.follower_count || 0;
      const previousFollowers = followerData?.[1]?.follower_count || currentFollowers;
      const weekAgoFollowers = followerData?.[7]?.follower_count || currentFollowers;
      const monthAgoFollowers = followerData?.[29]?.follower_count || currentFollowers;

      const dailyGrowthRate = currentFollowers > 0 ? 
        ((currentFollowers - previousFollowers) / previousFollowers) * 100 : 0;
      
      const weeklyGrowthRate = weekAgoFollowers > 0 ? 
        ((currentFollowers - weekAgoFollowers) / weekAgoFollowers) * 100 : 0;
      
      const monthlyGrowthRate = monthAgoFollowers > 0 ? 
        ((currentFollowers - monthAgoFollowers) / monthAgoFollowers) * 100 : 0;

      // Calculate engagement metrics
      const totalEngagement = engagementData?.reduce((sum, item) => 
        sum + (item.likes + item.retweets + item.replies), 0) || 0;
      const avgEngagement = engagementData?.length ? totalEngagement / engagementData.length : 0;
      const engagementRate = currentFollowers > 0 ? (avgEngagement / currentFollowers) * 100 : 0;

      const viralContentCount = engagementData?.filter(item => (item.viral_score || 0) > 70).length || 0;

      // Determine growth trend
      let growthTrend: GrowthMetrics['growth_trend'] = 'stagnant';
      if (dailyGrowthRate > 5) growthTrend = 'explosive';
      else if (dailyGrowthRate > 2) growthTrend = 'accelerating';
      else if (dailyGrowthRate > 0.5) growthTrend = 'steady';
      else if (dailyGrowthRate < 0) growthTrend = 'declining';

      const metrics: GrowthMetrics = {
        current_followers: currentFollowers,
        daily_growth_rate: dailyGrowthRate,
        weekly_growth_rate: weeklyGrowthRate,
        monthly_growth_rate: monthlyGrowthRate,
        engagement_rate: engagementRate,
        viral_content_count: viralContentCount,
        community_engagement_actions: 0, // Would get from engagement tracking
        follower_conversion_rate: 0.03, // Estimated 3% conversion rate
        growth_trend: growthTrend
      };

      this.growthMetrics = metrics;
      console.log(`📊 Current metrics: ${currentFollowers} followers, ${dailyGrowthRate.toFixed(2)}% daily growth`);
      
      return metrics;

    } catch (error) {
      console.warn('⚠️ Using fallback growth metrics:', error);
      
      return {
        current_followers: 100, // Conservative estimate
        daily_growth_rate: 0,
        weekly_growth_rate: 0,
        monthly_growth_rate: 0,
        engagement_rate: 2.0,
        viral_content_count: 0,
        community_engagement_actions: 0,
        follower_conversion_rate: 0.03,
        growth_trend: 'stagnant'
      };
    }
  }

  /**
   * 🎯 OPTIMIZE GROWTH STRATEGY BASED ON PERFORMANCE
   */
  private async optimizeGrowthStrategy(metrics: GrowthMetrics): Promise<GrowthOptimization> {
    try {
      console.log('🧠 Optimizing growth strategy based on current performance...');

      const identifiedIssues = this.identifyGrowthIssues(metrics);
      const optimizationStrategies = await this.generateOptimizationStrategies(metrics, identifiedIssues);
      const immediateActions = this.generateImmediateActions(metrics, identifiedIssues);
      const predictedResults = await this.predictGrowthResults(metrics, optimizationStrategies);

      return {
        current_performance: metrics,
        identified_issues: identifiedIssues,
        optimization_strategies: optimizationStrategies,
        immediate_actions: immediateActions,
        predicted_results: predictedResults
      };

    } catch (error) {
      console.error('❌ Strategy optimization failed:', error);
      
      return {
        current_performance: metrics,
        identified_issues: ['Strategy optimization system error'],
        optimization_strategies: [],
        immediate_actions: ['Generate viral content', 'Engage with community'],
        predicted_results: {
          followers_7_days: metrics.current_followers + 10,
          followers_30_days: metrics.current_followers + 50,
          engagement_improvement: 1.2,
          viral_content_probability: 0.3
        }
      };
    }
  }

  /**
   * 🔍 IDENTIFY GROWTH ISSUES AND BOTTLENECKS
   */
  private identifyGrowthIssues(metrics: GrowthMetrics): string[] {
    const issues: string[] = [];

    if (metrics.current_followers < 1000) {
      issues.push('Low follower count - need aggressive growth tactics');
    }

    if (metrics.daily_growth_rate < 0.5) {
      issues.push('Slow daily growth rate - need viral content strategy');
    }

    if (metrics.engagement_rate < 2.0) {
      issues.push('Low engagement rate - content not resonating with audience');
    }

    if (metrics.viral_content_count === 0) {
      issues.push('No viral content in recent period - need controversial/engaging topics');
    }

    if (metrics.community_engagement_actions < 5) {
      issues.push('Insufficient community engagement - missing growth opportunities');
    }

    if (metrics.growth_trend === 'declining') {
      issues.push('Declining growth trend - urgent strategy pivot needed');
    } else if (metrics.growth_trend === 'stagnant') {
      issues.push('Stagnant growth - need to break through current plateau');
    }

    if (metrics.follower_conversion_rate < 0.02) {
      issues.push('Low follower conversion rate - content lacks compelling value proposition');
    }

    return issues.length > 0 ? issues : ['No critical issues detected - focus on optimization'];
  }

  /**
   * 🎯 GENERATE OPTIMIZATION STRATEGIES
   */
  private async generateOptimizationStrategies(metrics: GrowthMetrics, issues: string[]): Promise<GrowthStrategy[]> {
    const strategies: GrowthStrategy[] = [];

    // Strategy 1: Viral Content Acceleration
    if (issues.some(issue => issue.includes('viral') || issue.includes('growth rate'))) {
      strategies.push({
        strategy_name: 'Viral Content Acceleration',
        priority: 'critical',
        content_focus: ['controversial health takes', 'myth busting', 'personal transformations'],
        engagement_tactics: ['debate generation', 'question hooks', 'social proof'],
        posting_frequency: 3,
        controversy_level: 'high',
        expected_growth: 25,
        confidence: 0.8,
        implementation_steps: [
          'Generate 3 controversial health posts daily',
          'Focus on myth-busting content with strong evidence',
          'Use personal transformation stories for social proof',
          'Include debate-generating questions in every post'
        ]
      });
    }

    // Strategy 2: Community Engagement Intensification
    if (issues.some(issue => issue.includes('engagement') || issue.includes('community'))) {
      strategies.push({
        strategy_name: 'Community Engagement Intensification',
        priority: 'high',
        content_focus: ['reply value-adds', 'question responses', 'expert commentary'],
        engagement_tactics: ['strategic replies', 'influencer engagement', 'thought leadership'],
        posting_frequency: 2,
        controversy_level: 'medium',
        expected_growth: 15,
        confidence: 0.7,
        implementation_steps: [
          'Reply to 10 high-engagement health tweets daily',
          'Target top health influencers with valuable insights',
          'Ask thought-provoking questions to spark discussion',
          'Position as helpful expert in all interactions'
        ]
      });
    }

    // Strategy 3: Authority Building
    if (metrics.current_followers < 1000 || issues.some(issue => issue.includes('conversion'))) {
      strategies.push({
        strategy_name: 'Authority Building & Trust Development',
        priority: 'high',
        content_focus: ['evidence-based insights', 'case studies', 'expert analysis'],
        engagement_tactics: ['research citations', 'mechanism explanations', 'practical applications'],
        posting_frequency: 2,
        controversy_level: 'low',
        expected_growth: 20,
        confidence: 0.75,
        implementation_steps: [
          'Share research-backed health insights daily',
          'Explain biological mechanisms behind health claims',
          'Provide practical implementation guides',
          'Build reputation as trustworthy health educator'
        ]
      });
    }

    // Strategy 4: Trend Hijacking
    strategies.push({
      strategy_name: 'Health Trend Hijacking',
      priority: 'medium',
      content_focus: ['trending health topics', 'current events health angle', 'seasonal health tips'],
      engagement_tactics: ['timely relevance', 'news commentary', 'trend analysis'],
      posting_frequency: 1,
      controversy_level: 'medium',
      expected_growth: 10,
      confidence: 0.6,
      implementation_steps: [
        'Monitor trending health topics daily',
        'Add unique perspective to current health news',
        'Connect seasonal events to health optimization',
        'Be first to comment on emerging health research'
      ]
    });

    return strategies.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * ⚡ GENERATE IMMEDIATE ACTIONS
   */
  private generateImmediateActions(metrics: GrowthMetrics, issues: string[]): string[] {
    const actions: string[] = [];

    if (metrics.daily_growth_rate < 0.5) {
      actions.push('Generate controversial health content to break through algorithm');
    }

    if (metrics.engagement_rate < 2.0) {
      actions.push('Create question-based posts to drive engagement');
    }

    if (metrics.viral_content_count === 0) {
      actions.push('Post myth-busting thread with strong contrarian position');
    }

    if (metrics.community_engagement_actions < 5) {
      actions.push('Engage with 5 high-value health influencer posts immediately');
    }

    if (metrics.growth_trend === 'declining') {
      actions.push('Emergency pivot to highest-performing content types');
    }

    actions.push('Track all engagement metrics for next 24 hours');
    actions.push('Schedule follow-up optimization session');

    return actions;
  }

  /**
   * 🔮 PREDICT GROWTH RESULTS
   */
  private async predictGrowthResults(metrics: GrowthMetrics, strategies: GrowthStrategy[]): Promise<{
    followers_7_days: number;
    followers_30_days: number;
    engagement_improvement: number;
    viral_content_probability: number;
  }> {
    try {
      const totalExpectedGrowth = strategies.reduce((sum, strategy) => {
        return sum + (strategy.expected_growth * strategy.confidence);
      }, 0);

      const baseGrowthRate = Math.max(0.01, metrics.daily_growth_rate / 100);
      const optimizedGrowthRate = baseGrowthRate * (1 + (totalExpectedGrowth / 100));

      const followers7Days = Math.round(metrics.current_followers * Math.pow(1 + optimizedGrowthRate, 7));
      const followers30Days = Math.round(metrics.current_followers * Math.pow(1 + optimizedGrowthRate, 30));

      const engagementImprovement = 1 + (totalExpectedGrowth / 200); // Conservative improvement
      const viralContentProbability = Math.min(0.9, strategies.filter(s => s.controversy_level === 'high').length * 0.3);

      return {
        followers_7_days: followers7Days,
        followers_30_days: followers30Days,
        engagement_improvement: engagementImprovement,
        viral_content_probability: viralContentProbability
      };

    } catch (error) {
      console.warn('⚠️ Using fallback growth predictions:', error);
      
      return {
        followers_7_days: metrics.current_followers + 20,
        followers_30_days: metrics.current_followers + 100,
        engagement_improvement: 1.5,
        viral_content_probability: 0.4
      };
    }
  }

  /**
   * 📝 GENERATE STRATEGIC CONTENT
   */
  private async generateStrategicContent(optimization: GrowthOptimization): Promise<{
    success: boolean;
    content_type: string;
    viral_score: number;
    expected_followers: number;
    strategy_used: string;
  }> {
    try {
      console.log('📝 Generating strategic viral content...');

      const primaryStrategy = optimization.optimization_strategies[0];
      
      // Select content template based on strategy
      let templateType = 'controversial_health_take';
      if (primaryStrategy?.strategy_name.includes('Authority')) {
        templateType = 'personal_transformation';
      } else if (primaryStrategy?.strategy_name.includes('Community')) {
        templateType = 'myth_busting_thread';
      }

      const viralContent = await this.viralContentMaster.generateViralContent(templateType);

      return {
        success: true,
        content_type: viralContent.content_type,
        viral_score: viralContent.viral_score,
        expected_followers: viralContent.expected_engagement * 0.03, // 3% conversion rate
        strategy_used: primaryStrategy?.strategy_name || 'Default Viral Strategy'
      };

    } catch (error) {
      console.error('❌ Strategic content generation failed:', error);
      
      return {
        success: false,
        content_type: 'none',
        viral_score: 0,
        expected_followers: 0,
        strategy_used: 'Failed'
      };
    }
  }

  /**
   * 🤝 EXECUTE STRATEGIC ENGAGEMENT
   */
  private async executeStrategicEngagement(optimization: GrowthOptimization): Promise<{
    actions_taken: number;
    expected_followers: number;
    total_reach: number;
    engagement_summary: string;
  }> {
    try {
      console.log('🤝 Executing strategic community engagement...');

      const engagementResult = await this.engagementMaster.executeStrategicEngagement();
      
      return engagementResult;

    } catch (error) {
      console.error('❌ Strategic engagement failed:', error);
      
      return {
        actions_taken: 0,
        expected_followers: 0,
        total_reach: 0,
        engagement_summary: 'Engagement failed - will retry in next cycle'
      };
    }
  }

  /**
   * 📊 UPDATE GROWTH TRACKING
   */
  private async updateGrowthTracking(
    metrics: GrowthMetrics,
    optimization: GrowthOptimization,
    contentResult: any,
    engagementResult: any
  ): Promise<void> {
    try {
      // Update daily growth tracking
      const { error: growthError } = await supabaseClient.supabase
        .from('follower_growth_tracking')
        .upsert({
          date: new Date().toISOString().split('T')[0],
          follower_count: metrics.current_followers,
          follower_gain_daily: Math.round(metrics.current_followers * (metrics.daily_growth_rate / 100)),
          engagement_rate_daily: metrics.engagement_rate,
          viral_tweets_count: metrics.viral_content_count,
          growth_rate: metrics.daily_growth_rate,
          growth_trend: metrics.growth_trend,
          notes: `Optimization applied: ${optimization.optimization_strategies.map(s => s.strategy_name).join(', ')}`
        });

      // Update content performance analysis
      const { error: performanceError } = await supabaseClient.supabase
        .from('content_performance_analysis')
        .upsert({
          analysis_date: new Date().toISOString().split('T')[0],
          total_tweets: 1, // Assuming 1 tweet generated
          avg_engagement: contentResult.viral_score || 0,
          viral_tweets_count: contentResult.viral_score > 70 ? 1 : 0,
          engagement_trend: metrics.growth_trend,
          follower_conversion_rate: metrics.follower_conversion_rate,
          optimization_recommendations: optimization.immediate_actions
        });

      if (growthError) console.warn('⚠️ Growth tracking update failed:', growthError);
      if (performanceError) console.warn('⚠️ Performance analysis update failed:', performanceError);

    } catch (error) {
      console.error('❌ Growth tracking update failed:', error);
    }
  }

  /**
   * 📋 GENERATE GROWTH SUMMARY
   */
  private async generateGrowthSummary(
    metrics: GrowthMetrics,
    optimization: GrowthOptimization,
    contentResult: any,
    engagementResult: any
  ): Promise<string> {
    const totalProjectedFollowers = (contentResult.expected_followers || 0) + (engagementResult.expected_followers || 0);
    const strategiesApplied = optimization.optimization_strategies.length;
    const issuesIdentified = optimization.identified_issues.length;

    return `
📈 GROWTH ORCHESTRATION SUMMARY
Current: ${metrics.current_followers} followers (${metrics.daily_growth_rate.toFixed(2)}% daily growth)
Issues: ${issuesIdentified} identified, ${strategiesApplied} strategies applied
Content: ${contentResult.success ? '✅' : '❌'} Viral score ${contentResult.viral_score}/100
Engagement: ${engagementResult.actions_taken} actions, ${engagementResult.total_reach} reach
Projected: +${totalProjectedFollowers} followers from this cycle
Trend: ${metrics.growth_trend} → optimizing for acceleration
    `.trim();
  }

  /**
   * 📅 GENERATE DAILY GROWTH PLAN
   */
  async generateDailyGrowthPlan(): Promise<DailyGrowthPlan> {
    try {
      const metrics = this.growthMetrics || await this.analyzeCurrentGrowthMetrics();
      const date = new Date().toISOString().split('T')[0];

      // Determine daily quotas based on current performance
      const viralContentQuota = metrics.growth_trend === 'declining' ? 3 : 
                               metrics.growth_trend === 'stagnant' ? 2 : 1;
      
      const engagementTargets = metrics.engagement_rate < 2 ? 10 : 
                               metrics.engagement_rate < 3 ? 7 : 5;

      // Select content themes based on what's working
      const contentThemes = this.selectOptimalContentThemes(metrics);
      
      // Choose engagement strategies
      const engagementStrategies = this.selectOptimalEngagementStrategies(metrics);

      // Generate posting schedule
      const postingSchedule = this.generateOptimalPostingSchedule(viralContentQuota);

      return {
        date: date,
        viral_content_quota: viralContentQuota,
        engagement_targets: engagementTargets,
        content_themes: contentThemes,
        engagement_strategies: engagementStrategies,
        posting_schedule: postingSchedule,
        success_metrics: {
          target_followers: metrics.current_followers + Math.round(metrics.current_followers * 0.02),
          target_engagement: Math.round(metrics.engagement_rate * 1.2),
          target_reach: viralContentQuota * 5000 + engagementTargets * 1000
        }
      };

    } catch (error) {
      console.error('❌ Daily growth plan generation failed:', error);
      
      return {
        date: new Date().toISOString().split('T')[0],
        viral_content_quota: 2,
        engagement_targets: 8,
        content_themes: ['controversial health takes', 'myth busting'],
        engagement_strategies: ['expert commentary', 'question generation'],
        posting_schedule: ['10:00 AM', '2:00 PM', '7:00 PM'],
        success_metrics: {
          target_followers: 0,
          target_engagement: 0,
          target_reach: 0
        }
      };
    }
  }

  private selectOptimalContentThemes(metrics: GrowthMetrics): string[] {
    const themes = [];
    
    if (metrics.viral_content_count === 0) {
      themes.push('controversial health takes', 'myth busting threads');
    }
    
    if (metrics.engagement_rate < 2) {
      themes.push('question-based engagement', 'debate generation');
    }
    
    if (metrics.current_followers < 1000) {
      themes.push('personal transformation stories', 'authority building');
    }
    
    themes.push('trending health topics', 'research-backed insights');
    
    return themes.slice(0, 4);
  }

  private selectOptimalEngagementStrategies(metrics: GrowthMetrics): string[] {
    const strategies = [];
    
    if (metrics.community_engagement_actions < 5) {
      strategies.push('influencer engagement', 'value-add commentary');
    }
    
    if (metrics.follower_conversion_rate < 0.02) {
      strategies.push('thought leadership', 'expert positioning');
    }
    
    strategies.push('strategic replies', 'question catalysts');
    
    return strategies.slice(0, 3);
  }

  private generateOptimalPostingSchedule(quota: number): string[] {
    const baseSchedule = ['10:00 AM', '2:00 PM', '7:00 PM'];
    return baseSchedule.slice(0, quota);
  }

  /**
   * 🔄 GET ORCHESTRATOR STATUS
   */
  getStatus(): {
    current_metrics: GrowthMetrics | null;
    last_optimization: Date | null;
    current_strategy: GrowthStrategy | null;
    is_active: boolean;
  } {
    return {
      current_metrics: this.growthMetrics,
      last_optimization: this.lastOptimization,
      current_strategy: this.currentGrowthStrategy,
      is_active: true
    };
  }
}