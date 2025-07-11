import { SupremeAIOrchestrator } from '../agents/supremeAIOrchestrator';
import { IntelligentPostingDecisionAgent } from '../agents/intelligentPostingDecisionAgent';
import { StrategicOpportunityScheduler } from '../agents/strategicOpportunityScheduler';
import { TimingOptimizationAgent } from '../agents/timingOptimizationAgent';
import { RealTimeLimitsIntelligenceAgent } from '../agents/realTimeLimitsIntelligenceAgent';
import { AutonomousIntelligenceCore } from '../agents/autonomousIntelligenceCore';
import { DynamicPostingController } from './dynamicPostingController';
import { bulletproofManager } from './bulletproofOperationManager';
import { budgetEnforcer } from './budgetEnforcer'; // Updated import
import { getBudgetAwareOpenAI } from './budgetAwareOpenAI'; // New import
import { supabaseClient } from './supabaseClient';
import { AwarenessLogger } from './awarenessLogger'; // Fixed import

interface AIDecisionResult {
  shouldPost: boolean;
  strategy: string;
  postCount: number;
  urgency: number;
  reasoning: string;
  timeSpacing: number;
  budgetImpact: number;
  aiAgent: string;
  confidence: number;
  executionPlan: any[];
}

interface CoordinationState {
  lastPostTime: Date | null;
  postsToday: number;
  currentStrategy: string | null;
  activeAIAgent: string | null;
  burstProtectionActive: boolean;
  emergencyMode: boolean;
  budgetRemaining: number;
  lastDecisionTime: Date | null;
}

/**
 * 🏆 LEGENDARY AI COORDINATION SYSTEM
 * 
 * This system coordinates all your sophisticated AI agents to prevent burst posting
 * while maintaining intelligent, strategic content decisions.
 * 
 * Features:
 * - Coordinates SupremeAIOrchestrator with all other agents
 * - Prevents burst posting through intelligent spacing
 * - Maintains budget awareness across all decisions
 * - Uses real-time limits intelligence
 * - Leverages all existing sophisticated agents
 * - Provides legendary performance with human-like timing
 */
export class LegendaryAICoordinator {
  private supremeOrchestrator: SupremeAIOrchestrator;
  private intelligentDecisionAgent: IntelligentPostingDecisionAgent;
  private strategicScheduler: StrategicOpportunityScheduler;
  private timingAgent: TimingOptimizationAgent;
  private limitsAgent: RealTimeLimitsIntelligenceAgent;
  private autonomousCore: AutonomousIntelligenceCore;
  private dynamicController: DynamicPostingController;
  
  private coordinationState: CoordinationState;
  private isRunning: boolean = false;
  private coordinationInterval: NodeJS.Timeout | null = null;
  
  // LEGENDARY ANTI-BURST PROTECTION
  private readonly MINIMUM_POST_SPACING = 2 * 60 * 60 * 1000; // 2 hours minimum
  private readonly MAX_POSTS_PER_DAY = 6; // Professional limit
  private readonly BURST_DETECTION_THRESHOLD = 3; // 3 posts in 3 hours = burst
  private readonly EMERGENCY_COOLDOWN = 4 * 60 * 60 * 1000; // 4 hours emergency cooldown

  constructor() {
    this.supremeOrchestrator = new SupremeAIOrchestrator();
    this.intelligentDecisionAgent = new IntelligentPostingDecisionAgent();
    this.strategicScheduler = new StrategicOpportunityScheduler();
    this.timingAgent = new TimingOptimizationAgent();
    this.limitsAgent = new RealTimeLimitsIntelligenceAgent();
    this.autonomousCore = new AutonomousIntelligenceCore();
    this.dynamicController = new DynamicPostingController();
    
    this.coordinationState = {
      lastPostTime: null,
      postsToday: 0,
      currentStrategy: null,
      activeAIAgent: null,
      burstProtectionActive: true,
      emergencyMode: false,
      budgetRemaining: 0,
      lastDecisionTime: null
    };

    console.log('🏆 === LEGENDARY AI COORDINATOR INITIALIZED ===');
    console.log('👑 Supreme AI Orchestrator: READY');
    console.log('🧠 Intelligent Decision Agent: READY'); 
    console.log('🎯 Strategic Opportunity Scheduler: READY');
    console.log('⏰ Timing Optimization Agent: READY');
    console.log('🚀 Real-Time Limits Intelligence: READY');
    console.log('🤖 Autonomous Intelligence Core: READY');
    console.log('🛡️ Anti-Burst Protection: ACTIVE');
    console.log('💰 Budget Management: INTEGRATED');
    console.log('🏆 === LEGENDARY SYSTEM READY ===');
  }

  /**
   * 🚀 START THE LEGENDARY SYSTEM
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Legendary AI Coordinator already running');
      return;
    }

    console.log('🏆 === STARTING LEGENDARY AI COORDINATION SYSTEM ===');
    
    // Initialize coordination state
    await this.initializeCoordinationState();
    
    // Start continuous coordination
    this.isRunning = true;
    this.coordinationInterval = setInterval(
      () => this.runCoordinationCycle(),
      15 * 60 * 1000 // Every 15 minutes
    );
    
    console.log('✅ Legendary AI Coordination System is now active');
    console.log('🛡️ Burst protection enabled with 2-hour minimum spacing');
    console.log('📅 Maximum 6 posts per day with intelligent distribution');
    console.log('🧠 All AI agents coordinated under supreme intelligence');
    
    // Run initial coordination cycle
    await this.runCoordinationCycle();
  }

  /**
   * 🧠 MAIN COORDINATION CYCLE
   * The heart of the legendary system that coordinates all AI agents
   */
  private async runCoordinationCycle(): Promise<void> {
    try {
      console.log('🏆 === LEGENDARY AI COORDINATION CYCLE ===');
      
      // 1. Update coordination state
      await this.updateCoordinationState();
      
      // 2. Check burst protection
      const burstCheck = await this.checkBurstProtection();
      if (!burstCheck.canPost) {
        console.log('⏳ Burst protection active - spacing posts optimally');
        // Log burst protection with simple console message
        console.log(`🛡️ Burst protection reason: ${burstCheck.reason}`);
        return;
      }
      
      // 3. Coordinate AI agents for decision making
      const aiDecision = await this.coordinateAIDecision();
      
      // 4. Execute if approved
      if (aiDecision.shouldPost) {
        await this.executeCoordinatedDecision(aiDecision);
      } else {
        console.log(`🤔 AI decided not to post: ${aiDecision.reasoning}`);
      }
      
      // 5. Update state after decision
      await this.updatePostDecisionState(aiDecision);
      
    } catch (error) {
      console.error('❌ Coordination cycle error:', error);
      console.error('🚨 Coordination error:', error.message);
    }
  }

  /**
   * 🧠 COORDINATE AI DECISION MAKING
   * Gets input from all AI agents and makes a coordinated decision
   */
  private async coordinateAIDecision(): Promise<AIDecisionResult> {
    console.log('🧠 Coordinating AI agents for decision making...');
    
    // Gather intelligence from all agents in parallel
    const [
      supremeDecision,
      intelligentDecision,
      strategicOpportunities,
      timingAnalysis,
      limitsStatus
    ] = await Promise.all([
      this.getSupremeDecision(),
      this.getIntelligentDecision(),
      this.getStrategicOpportunities(),
      this.getTimingAnalysis(),
      this.getLimitsStatus()
    ]);

    // Coordinate all inputs into final decision
    const coordinatedDecision = await this.synthesizeAIInputs({
      supremeDecision,
      intelligentDecision,
      strategicOpportunities,
      timingAnalysis,
      limitsStatus
    });

    console.log(`🎯 Coordinated AI Decision: ${coordinatedDecision.shouldPost ? 'POST' : 'WAIT'}`);
    console.log(`🤖 Primary AI Agent: ${coordinatedDecision.aiAgent}`);
    console.log(`📊 Confidence: ${coordinatedDecision.confidence}%`);
    console.log(`💭 Reasoning: ${coordinatedDecision.reasoning}`);

    return coordinatedDecision;
  }

  /**
   * 👑 GET SUPREME AI DECISION
   */
  private async getSupremeDecision(): Promise<any> {
    try {
      return await this.supremeOrchestrator.makeSupremeDecision();
    } catch (error) {
      console.warn('⚠️ Supreme AI decision failed:', error);
      return { shouldPost: false, strategy: null, reasoning: 'Supreme AI unavailable' };
    }
  }

  /**
   * 🧠 GET INTELLIGENT DECISION
   */
  private async getIntelligentDecision(): Promise<any> {
    try {
      return await this.intelligentDecisionAgent.makePostingDecision();
    } catch (error) {
      console.warn('⚠️ Intelligent decision failed:', error);
      return { shouldPost: false, reasoning: 'Intelligent agent unavailable' };
    }
  }

  /**
   * 🎯 GET STRATEGIC OPPORTUNITIES
   */
  private async getStrategicOpportunities(): Promise<any> {
    try {
      return await this.strategicScheduler.analyzeStrategicOpportunities();
    } catch (error) {
      console.warn('⚠️ Strategic analysis failed:', error);
      return { opportunities: [], totalRecommendedPosts: 0 };
    }
  }

  /**
   * ⏰ GET TIMING ANALYSIS
   */
  private async getTimingAnalysis(): Promise<any> {
    try {
      return await this.timingAgent.shouldPostNow();
    } catch (error) {
      console.warn('⚠️ Timing analysis failed:', error);
      return { shouldPost: false, confidence: 0 };
    }
  }

  /**
   * 🚀 GET LIMITS STATUS
   */
  private async getLimitsStatus(): Promise<any> {
    try {
      return await this.limitsAgent.getCurrentLimits();
    } catch (error) {
      console.warn('⚠️ Limits check failed:', error);
      return { canPost: false, reason: 'Limits check unavailable' };
    }
  }

  /**
   * 🔀 SYNTHESIZE AI INPUTS
   * Combines all AI agent inputs into a coordinated decision
   */
  private async synthesizeAIInputs(inputs: any): Promise<AIDecisionResult> {
    const {
      supremeDecision,
      intelligentDecision,
      strategicOpportunities,
      timingAnalysis,
      limitsStatus
    } = inputs;

    // Score each recommendation
    const scores = {
      supreme: this.scoreSupremeDecision(supremeDecision),
      intelligent: this.scoreIntelligentDecision(intelligentDecision),
      strategic: this.scoreStrategicOpportunities(strategicOpportunities),
      timing: this.scoreTimingAnalysis(timingAnalysis),
      limits: this.scoreLimitsStatus(limitsStatus)
    };

    // Calculate weighted decision
    const totalScore = Object.values(scores).reduce((sum, score) => sum + score.weight * score.confidence, 0);
    const totalWeight = Object.values(scores).reduce((sum, score) => sum + score.weight, 0);
    const overallConfidence = totalScore / totalWeight;

    // Determine if we should post
    const shouldPost = overallConfidence > 0.6 && this.coordinationState.postsToday < this.MAX_POSTS_PER_DAY;

    // Select primary AI agent
    const primaryAgent = this.selectPrimaryAgent(scores);

    // Create execution plan
    const executionPlan = this.createExecutionPlan(inputs, primaryAgent);

    return {
      shouldPost,
      strategy: primaryAgent.strategy,
      postCount: shouldPost ? Math.min(primaryAgent.postCount, this.MAX_POSTS_PER_DAY - this.coordinationState.postsToday) : 0,
      urgency: primaryAgent.urgency,
      reasoning: primaryAgent.reasoning,
      timeSpacing: this.calculateOptimalSpacing(),
      budgetImpact: this.estimateBudgetImpact(primaryAgent.postCount),
      aiAgent: primaryAgent.name,
      confidence: Math.round(overallConfidence * 100),
      executionPlan
    };
  }

  /**
   * 🛡️ CHECK BURST PROTECTION
   */
  private async checkBurstProtection(): Promise<{ canPost: boolean; reason: string }> {
    const now = new Date();
    
    // Check minimum spacing
    if (this.coordinationState.lastPostTime) {
      const timeSinceLastPost = now.getTime() - this.coordinationState.lastPostTime.getTime();
      if (timeSinceLastPost < this.MINIMUM_POST_SPACING) {
        const hoursRemaining = Math.ceil((this.MINIMUM_POST_SPACING - timeSinceLastPost) / (60 * 60 * 1000));
        return {
          canPost: false,
          reason: `Minimum 2-hour spacing enforced. ${hoursRemaining}h remaining.`
        };
      }
    }

    // Check daily limit
    if (this.coordinationState.postsToday >= this.MAX_POSTS_PER_DAY) {
      return {
        canPost: false,
        reason: `Daily limit of ${this.MAX_POSTS_PER_DAY} posts reached. Prevents burst posting.`
      };
    }

    // Check for recent burst pattern
    const recentPosts = await this.getRecentPostHistory(3 * 60 * 60 * 1000); // Last 3 hours
    if (recentPosts.length >= this.BURST_DETECTION_THRESHOLD) {
      return {
        canPost: false,
        reason: `Burst pattern detected: ${recentPosts.length} posts in 3 hours. Cooling down.`
      };
    }

    // Check budget
    const budgetStatus = await budgetEnforcer.getBudgetStatus();
    if (budgetStatus.remainingBudget <= 1) {
      return {
        canPost: false,
        reason: `Daily budget exhausted: $${budgetStatus.remainingBudget.toFixed(2)} remaining.`
      };
    }

    return { canPost: true, reason: 'All burst protection checks passed' };
  }

  /**
   * 🚀 EXECUTE COORDINATED DECISION
   */
  private async executeCoordinatedDecision(decision: AIDecisionResult): Promise<void> {
    console.log(`🚀 Executing coordinated decision via ${decision.aiAgent}`);
    console.log(`📝 Strategy: ${decision.strategy}`);
    console.log(`🎯 Post count: ${decision.postCount}`);
    console.log(`💰 Budget impact: $${decision.budgetImpact.toFixed(2)}`);

    try {
      let executionResult;

      // Route to appropriate AI agent for execution
      switch (decision.aiAgent) {
        case 'SupremeAIOrchestrator':
          executionResult = await this.supremeOrchestrator.executeSupremeStrategy(
            decision.strategy as any,
            decision.executionPlan
          );
          break;
        case 'DynamicPostingController':
          executionResult = await this.dynamicController.executeSupremeDecision(decision);
          break;
        case 'BulletproofManager':
          executionResult = await bulletproofManager.guaranteedPost();
          break;
        default:
          // Fallback to bulletproof posting
          executionResult = await bulletproofManager.guaranteedPost();
      }

      // Update coordination state
      if (executionResult.success) {
        this.coordinationState.lastPostTime = new Date();
        this.coordinationState.postsToday += executionResult.executedPosts || 1;
        this.coordinationState.currentStrategy = decision.strategy;
        this.coordinationState.activeAIAgent = decision.aiAgent;

        console.log(`✅ Execution successful: ${executionResult.executedPosts || 1} posts created`);
        console.log(`🤖 AI Agent: ${decision.aiAgent}, Strategy: ${decision.strategy}, Confidence: ${decision.confidence}`);
      } else {
        console.log('❌ Execution failed');
        console.log('📊 Decision:', JSON.stringify(decision, null, 2));
        console.log('📈 Result:', JSON.stringify(executionResult, null, 2));
      }

    } catch (error) {
      console.error('❌ Execution error:', error);
      console.error('📊 Decision that failed:', JSON.stringify(decision, null, 2));
    }
  }

  /**
   * 📊 UPDATE COORDINATION STATE
   */
  private async updateCoordinationState(): Promise<void> {
    try {
      // Get today's post count
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const postsToday = await this.getTodaysPostCount();
      this.coordinationState.postsToday = postsToday;

      // Update budget remaining
      const budgetStatus = await budgetEnforcer.getBudgetStatus();
      this.coordinationState.budgetRemaining = budgetStatus.remainingBudget;

      // Check for emergency mode
      this.coordinationState.emergencyMode = budgetStatus.remainingBudget < 1;

      console.log(`📊 Coordination State: ${postsToday}/${this.MAX_POSTS_PER_DAY} posts, $${budgetStatus.remainingBudget.toFixed(2)} budget`);

    } catch (error) {
      console.warn('⚠️ State update failed:', error);
    }
  }

  /**
   * 📈 GET TODAY'S POST COUNT
   */
  private async getTodaysPostCount(): Promise<number> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count } = await supabaseClient.supabase!
        .from('tweets')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString());
      
      return count || 0;
    } catch (error) {
      console.warn('⚠️ Could not get today\'s post count:', error);
      return 0;
    }
  }

  /**
   * 📊 GET RECENT POST HISTORY
   */
  private async getRecentPostHistory(timeWindowMs: number): Promise<any[]> {
    try {
      const cutoff = new Date(Date.now() - timeWindowMs);
      
      const { data } = await supabaseClient.supabase!
        .from('tweets')
        .select('created_at')
        .gte('created_at', cutoff.toISOString())
        .order('created_at', { ascending: false });
      
      return data || [];
    } catch (error) {
      console.warn('⚠️ Could not get recent post history:', error);
      return [];
    }
  }

  // Helper methods for scoring and decision making
  private scoreSupremeDecision(decision: any): { weight: number; confidence: number; agent: string } {
    if (!decision || !decision.shouldPost) {
      return { weight: 0, confidence: 0, agent: 'SupremeAIOrchestrator' };
    }
    return {
      weight: 0.4, // Highest weight for supreme decision
      confidence: decision.strategy?.confidence || 0.5,
      agent: 'SupremeAIOrchestrator'
    };
  }

  private scoreIntelligentDecision(decision: any): { weight: number; confidence: number; agent: string } {
    if (!decision || !decision.shouldPost) {
      return { weight: 0, confidence: 0, agent: 'IntelligentDecisionAgent' };
    }
    return {
      weight: 0.3,
      confidence: decision.confidence || 0.5,
      agent: 'IntelligentDecisionAgent'
    };
  }

  private scoreStrategicOpportunities(opportunities: any): { weight: number; confidence: number; agent: string } {
    if (!opportunities || !opportunities.opportunities?.length) {
      return { weight: 0, confidence: 0, agent: 'StrategicScheduler' };
    }
    return {
      weight: 0.2,
      confidence: opportunities.confidenceScore || 0.5,
      agent: 'StrategicScheduler'
    };
  }

  private scoreTimingAnalysis(timing: any): { weight: number; confidence: number; agent: string } {
    if (!timing || !timing.shouldPost) {
      return { weight: 0, confidence: 0, agent: 'TimingAgent' };
    }
    return {
      weight: 0.1,
      confidence: timing.confidence || 0.5,
      agent: 'TimingAgent'
    };
  }

  private scoreLimitsStatus(limits: any): { weight: number; confidence: number; agent: string } {
    if (!limits || !limits.canPost) {
      return { weight: 0, confidence: 0, agent: 'LimitsAgent' };
    }
    return {
      weight: 0.1,
      confidence: 0.8, // High confidence in limits intelligence
      agent: 'LimitsAgent'
    };
  }

  private selectPrimaryAgent(scores: any): any {
    // Find the highest scoring agent
    let maxScore = 0;
    let primaryAgent = {
      name: 'BulletproofManager',
      strategy: 'fallback',
      postCount: 1,
      urgency: 0.3,
      reasoning: 'Fallback to bulletproof posting'
    };

    Object.entries(scores).forEach(([key, score]: [string, any]) => {
      const totalScore = score.weight * score.confidence;
      if (totalScore > maxScore) {
        maxScore = totalScore;
        primaryAgent = {
          name: score.agent,
          strategy: this.getStrategyForAgent(score.agent),
          postCount: 1,
          urgency: score.confidence,
          reasoning: `${score.agent} scored highest with ${totalScore.toFixed(2)}`
        };
      }
    });

    return primaryAgent;
  }

  private getStrategyForAgent(agent: string): string {
    const strategies = {
      'SupremeAIOrchestrator': 'supreme_intelligence',
      'IntelligentDecisionAgent': 'intelligent_timing',
      'StrategicScheduler': 'strategic_opportunity',
      'TimingAgent': 'optimal_timing',
      'LimitsAgent': 'safe_posting',
      'BulletproofManager': 'guaranteed_delivery'
    };
    return strategies[agent] || 'fallback';
  }

  private createExecutionPlan(inputs: any, primaryAgent: any): any[] {
    return [
      {
        sequence: 1,
        agent: primaryAgent.name,
        strategy: primaryAgent.strategy,
        contentType: 'ai_coordinated',
        timing: 'immediate',
        budgetImpact: this.estimateBudgetImpact(1)
      }
    ];
  }

  private calculateOptimalSpacing(): number {
    // Always use minimum 2-hour spacing
    return 120; // minutes
  }

  private estimateBudgetImpact(postCount: number): number {
    // Rough estimate: $1-2 per post including API calls and processing
    return postCount * 1.5;
  }

  private async updatePostDecisionState(decision: AIDecisionResult): Promise<void> {
    this.coordinationState.lastDecisionTime = new Date();
    
    // Save coordination state to database for persistence
    try {
      await supabaseClient.setBotConfig('coordination_state', JSON.stringify(this.coordinationState));
    } catch (error) {
      console.warn('⚠️ Could not save coordination state:', error);
    }
  }

  private async initializeCoordinationState(): Promise<void> {
    try {
      // Load previous state if exists
      const savedState = await supabaseClient.getBotConfig('coordination_state');
      if (savedState) {
        const parsed = JSON.parse(savedState);
        this.coordinationState = { ...this.coordinationState, ...parsed };
        if (this.coordinationState.lastPostTime) {
          this.coordinationState.lastPostTime = new Date(this.coordinationState.lastPostTime);
        }
      }

      // Update with current data
      await this.updateCoordinationState();
      
      console.log('📊 Coordination state initialized:', {
        postsToday: this.coordinationState.postsToday,
        budgetRemaining: this.coordinationState.budgetRemaining,
        burstProtectionActive: this.coordinationState.burstProtectionActive
      });

    } catch (error) {
      console.warn('⚠️ Could not initialize coordination state:', error);
    }
  }

  /**
   * 🛑 STOP THE LEGENDARY SYSTEM
   */
  async stop(): Promise<void> {
    console.log('🛑 Stopping Legendary AI Coordination System...');
    
    this.isRunning = false;
    
    if (this.coordinationInterval) {
      clearInterval(this.coordinationInterval);
      this.coordinationInterval = null;
    }
    
    console.log('✅ Legendary AI Coordination System stopped');
  }

  /**
   * 📊 GET SYSTEM STATUS
   */
  getSystemStatus(): any {
    return {
      isRunning: this.isRunning,
      coordinationState: this.coordinationState,
      burstProtection: {
        minimumSpacing: this.MINIMUM_POST_SPACING,
        maxPostsPerDay: this.MAX_POSTS_PER_DAY,
        burstThreshold: this.BURST_DETECTION_THRESHOLD
      },
      aiAgents: {
        supremeOrchestrator: 'active',
        intelligentDecisionAgent: 'active',
        strategicScheduler: 'active',
        timingAgent: 'active',
        limitsAgent: 'active',
        autonomousCore: 'active'
      }
    };
  }

  /**
   * 🔧 MANUAL POST TRIGGER
   */
  async manualPost(reason: string = 'Manual trigger'): Promise<any> {
    console.log(`🔧 Manual post triggered: ${reason}`);
    
    // Check burst protection first
    const burstCheck = await this.checkBurstProtection();
    if (!burstCheck.canPost) {
      console.log(`🛡️ Manual post blocked by burst protection: ${burstCheck.reason}`);
      return { success: false, reason: burstCheck.reason };
    }

    // Force a posting decision
    const decision: AIDecisionResult = {
      shouldPost: true,
      strategy: 'manual_override',
      postCount: 1,
      urgency: 0.8,
      reasoning: reason,
      timeSpacing: this.calculateOptimalSpacing(),
      budgetImpact: this.estimateBudgetImpact(1),
      aiAgent: 'BulletproofManager',
      confidence: 95,
      executionPlan: [{
        sequence: 1,
        agent: 'BulletproofManager',
        strategy: 'manual_override',
        contentType: 'manual',
        timing: 'immediate'
      }]
    };

    await this.executeCoordinatedDecision(decision);
    
    return { success: true, decision };
  }

  async getSystemLimits(): Promise<any> {
    try {
      return await this.limitsAgent.getCurrentLimits();
    } catch (error) {
      console.error('Error getting system limits:', error);
      return null;
    }
  }
}

// Export singleton instance
export const legendaryAICoordinator = new LegendaryAICoordinator(); 