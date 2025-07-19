import { ViralFollowerGrowthAgent } from './viralFollowerGrowthAgent';
import { UltraViralGenerator } from './ultraViralGenerator';
import { CreativeContentAgent } from './creativeContentAgent';
import { StreamlinedPostAgent } from './streamlinedPostAgent';
import { ViralContentAgent } from './viralContentAgent';
import { HumanExpertPersonality } from './humanExpertPersonality';
import { DiversePerspectiveEngine } from './diversePerspectiveEngine';
import { followerGrowthLearner } from '../utils/followerGrowthLearner';

export interface ContentRequest {
  type: 'viral' | 'expert' | 'creative' | 'diverse' | 'streamlined';
  priority: 'high' | 'medium' | 'low';
  learningOptimized: boolean;
  fallbackOptions: string[];
  budgetConstraint?: number;
}

export interface ContentResult {
  success: boolean;
  content?: string;
  contentType?: string;
  viralPotential?: number;
  engagementHooks?: string[];
  followTriggers?: string[];
  source: string;
  cost?: number;
  error?: string;
}

/**
 * 🎯 UNIFIED CONTENT GENERATION HUB
 * 
 * Consolidates multiple overlapping content agents into a single, efficient system.
 * Provides intelligent routing, fallback mechanisms, and performance optimization.
 */
export class ContentGenerationHub {
  private viralFollowerAgent: ViralFollowerGrowthAgent;
  private ultraViralGenerator: UltraViralGenerator;
  private creativeAgent: CreativeContentAgent;
  private streamlinedAgent: StreamlinedPostAgent;
  private viralAgent: ViralContentAgent;
  private humanExpert: HumanExpertPersonality;
  private diverseEngine: DiversePerspectiveEngine;

  // Performance tracking
  private agentPerformance: Map<string, { successRate: number; avgLatency: number; lastUsed: Date }> = new Map();
  private contentCache: Map<string, { content: ContentResult; timestamp: Date; ttl: number }> = new Map();

  constructor() {
    this.viralFollowerAgent = new ViralFollowerGrowthAgent();
    this.ultraViralGenerator = new UltraViralGenerator();
    this.creativeAgent = new CreativeContentAgent();
    this.streamlinedAgent = new StreamlinedPostAgent();
    this.viralAgent = new ViralContentAgent();
    this.humanExpert = new HumanExpertPersonality();
    this.diverseEngine = new DiversePerspectiveEngine();

    this.initializePerformanceTracking();
  }

  /**
   * 🎯 MAIN CONTENT GENERATION METHOD
   * Routes requests to optimal agents based on type, performance, and availability
   */
  async generateContent(request: ContentRequest): Promise<ContentResult> {
    const startTime = Date.now();
    console.log(`🎯 ContentHub: Generating ${request.type} content (priority: ${request.priority})`);

    try {
      // 1. Check cache first for efficiency
      if (request.priority !== 'high') {
        const cached = this.getCachedContent(request);
        if (cached) {
          console.log('💾 Using cached content for efficiency');
          return cached;
        }
      }

      // 2. Apply learning optimizations if requested
      let learningInsights = null;
      if (request.learningOptimized) {
        learningInsights = await followerGrowthLearner.getLearningInsights();
        console.log(`🧠 Applied ${learningInsights.success_patterns.length} success patterns`);
      }

      // 3. Select optimal agent based on request type and performance
      const selectedAgent = this.selectOptimalAgent(request);
      console.log(`🤖 Selected agent: ${selectedAgent} for ${request.type} content`);

      // 4. Generate content with selected agent
      const result = await this.executeContentGeneration(selectedAgent, request, learningInsights);

      // 5. Apply learning optimizations to result
      if (request.learningOptimized && result.success && learningInsights) {
        result.content = await this.applyLearningOptimizations(result.content!, learningInsights);
      }

      // 6. Cache successful results
      if (result.success && request.priority !== 'high') {
        this.cacheContent(request, result);
      }

      // 7. Track performance
      this.trackAgentPerformance(selectedAgent, Date.now() - startTime, result.success);

      console.log(`✅ ContentHub: Generated ${request.type} content in ${Date.now() - startTime}ms`);
      return result;

    } catch (error) {
      console.error('❌ ContentHub generation failed:', error);
      
      // Try fallback options
      if (request.fallbackOptions.length > 0) {
        console.log('🔄 Attempting fallback content generation...');
        return this.generateFallbackContent(request);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Content generation failed',
        source: 'ContentGenerationHub'
      };
    }
  }

  /**
   * 🎯 INTELLIGENT AGENT SELECTION
   * Selects the optimal agent based on request type, performance history, and availability
   */
  private selectOptimalAgent(request: ContentRequest): string {
    const agentOptions = this.getAgentOptionsForType(request.type);
    
    // Filter by availability and performance
    const availableAgents = agentOptions.filter(agent => {
      const perf = this.agentPerformance.get(agent);
      return !perf || perf.successRate > 0.7; // Only use agents with >70% success rate
    });

    if (availableAgents.length === 0) {
      return agentOptions[0]; // Fallback to first option
    }

    // Select best performing agent
    let bestAgent = availableAgents[0];
    let bestScore = 0;

    for (const agent of availableAgents) {
      const perf = this.agentPerformance.get(agent);
      if (perf) {
        // Score based on success rate and recency (prefer recently successful agents)
        const recencyBonus = Math.max(0, 1 - (Date.now() - perf.lastUsed.getTime()) / (24 * 60 * 60 * 1000));
        const score = perf.successRate + (recencyBonus * 0.2);
        
        if (score > bestScore) {
          bestScore = score;
          bestAgent = agent;
        }
      }
    }

    return bestAgent;
  }

  /**
   * 🎯 AGENT EXECUTION WITH ERROR HANDLING
   */
  private async executeContentGeneration(agent: string, request: ContentRequest, learningInsights: any): Promise<ContentResult> {
    try {
      switch (agent) {
        case 'viralFollowerAgent':
          const viralResult = await this.viralFollowerAgent.generateViralContent();
          return {
            success: true,
            content: viralResult.content,
            contentType: viralResult.contentType,
            viralPotential: viralResult.viralPotential,
            engagementHooks: viralResult.engagementHooks,
            followTriggers: viralResult.followTriggers,
            source: 'ViralFollowerGrowthAgent'
          };

        case 'ultraViralGenerator':
          const ultraResult = await this.ultraViralGenerator.generateViralTweet('Generate high-engagement content optimized for follower growth');
          return {
            success: true,
            content: ultraResult.content,
            viralPotential: ultraResult.viralScore || 0,
            source: 'UltraViralGenerator'
          };

        case 'creativeAgent':
          const creativeResult = await this.creativeAgent.generateCreativeContent({
            type: 'original',
            topic_focus: 'health technology innovation',
            audience_type: 'professional',
            creativity_level: 'innovative',
            engagement_goal: 'discussion'
          });
          return {
            success: true,
            content: creativeResult.content,
            viralPotential: creativeResult.engagement_prediction * 100,
            source: 'CreativeContentAgent'
          };

        case 'streamlinedAgent':
          const streamResult = await this.streamlinedAgent.run(false);
          return {
            success: streamResult.success,
            content: streamResult.content,
            contentType: streamResult.contentType,
            source: 'StreamlinedPostAgent',
            error: streamResult.reason
          };

        case 'humanExpert':
          const expertResult = await this.humanExpert.generateExpertContent();
          return {
            success: true,
            content: expertResult.content,
            source: 'HumanExpertPersonality'
          };

        case 'diverseEngine':
          const diverseResult = await this.diverseEngine.generateDiverseContent();
          return {
            success: true,
            content: diverseResult.content,
            viralPotential: diverseResult.controversyLevel * 10,
            source: 'DiversePerspectiveEngine'
          };

        default:
          throw new Error(`Unknown agent: ${agent}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Agent execution failed',
        source: agent
      };
    }
  }

  /**
   * 🎯 PERFORMANCE TRACKING
   */
  private trackAgentPerformance(agent: string, latency: number, success: boolean): void {
    const current = this.agentPerformance.get(agent) || { successRate: 0, avgLatency: 0, lastUsed: new Date() };
    
    // Update success rate (exponential moving average)
    current.successRate = current.successRate * 0.9 + (success ? 1 : 0) * 0.1;
    
    // Update average latency
    current.avgLatency = current.avgLatency * 0.9 + latency * 0.1;
    
    // Update last used time
    current.lastUsed = new Date();
    
    this.agentPerformance.set(agent, current);
  }

  /**
   * 🎯 CONTENT CACHING
   */
  private getCachedContent(request: ContentRequest): ContentResult | null {
    const cacheKey = this.getCacheKey(request);
    const cached = this.contentCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp.getTime() < cached.ttl) {
      return cached.content;
    }
    
    return null;
  }

  private cacheContent(request: ContentRequest, result: ContentResult): void {
    const cacheKey = this.getCacheKey(request);
    const ttl = request.priority === 'low' ? 60 * 60 * 1000 : 30 * 60 * 1000; // 1h for low priority, 30m for others
    
    this.contentCache.set(cacheKey, {
      content: result,
      timestamp: new Date(),
      ttl
    });
  }

  private getCacheKey(request: ContentRequest): string {
    return `${request.type}_${request.priority}_${request.learningOptimized}`;
  }

  /**
   * 🎯 HELPER METHODS
   */
  private getAgentOptionsForType(type: string): string[] {
    switch (type) {
      case 'viral':
        return ['viralFollowerAgent', 'ultraViralGenerator', 'viralAgent'];
      case 'expert':
        return ['humanExpert', 'streamlinedAgent'];
      case 'creative':
        return ['creativeAgent', 'diverseEngine', 'ultraViralGenerator'];
      case 'diverse':
        return ['diverseEngine', 'creativeAgent', 'viralFollowerAgent'];
      case 'streamlined':
        return ['streamlinedAgent', 'viralFollowerAgent'];
      default:
        return ['viralFollowerAgent', 'ultraViralGenerator', 'creativeAgent'];
    }
  }

  private initializePerformanceTracking(): void {
    const agents = ['viralFollowerAgent', 'ultraViralGenerator', 'creativeAgent', 'streamlinedAgent', 'humanExpert', 'diverseEngine'];
    
    agents.forEach(agent => {
      this.agentPerformance.set(agent, {
        successRate: 0.8, // Start with optimistic assumption
        avgLatency: 2000, // 2 seconds default
        lastUsed: new Date()
      });
    });
  }

  private async generateFallbackContent(request: ContentRequest): Promise<ContentResult> {
    for (const fallback of request.fallbackOptions) {
      try {
        const result = await this.executeContentGeneration(fallback, request, null);
        if (result.success) {
          result.source = `${result.source} (fallback)`;
          return result;
        }
      } catch (error) {
        console.warn(`Fallback ${fallback} failed:`, error);
      }
    }

    return {
      success: false,
      error: 'All fallback options exhausted',
      source: 'ContentGenerationHub'
    };
  }

  private async applyLearningOptimizations(content: string, learningInsights: any): Promise<string> {
    // Apply successful patterns and avoid failed patterns
    let optimizedContent = content;

    // Apply successful engagement hooks
    if (learningInsights.success_patterns.length > 0) {
      const bestPattern = learningInsights.success_patterns[0];
      if (bestPattern.pattern?.engagement_hooks) {
        // Enhance content with successful engagement elements
        const hooks = bestPattern.pattern.engagement_hooks;
        if (hooks.includes('breaking_news') && !optimizedContent.includes('🚨')) {
          optimizedContent = `🚨 ${optimizedContent}`;
        }
      }
    }

    return optimizedContent;
  }

  /**
   * 🎯 PUBLIC UTILITY METHODS
   */
  getPerformanceMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};
    
    this.agentPerformance.forEach((perf, agent) => {
      metrics[agent] = {
        successRate: Math.round(perf.successRate * 100),
        avgLatencyMs: Math.round(perf.avgLatency),
        lastUsed: perf.lastUsed.toISOString()
      };
    });
    
    return metrics;
  }

  clearCache(): void {
    this.contentCache.clear();
    console.log('💾 ContentHub cache cleared');
  }

  resetPerformanceMetrics(): void {
    this.initializePerformanceTracking();
    console.log('📊 ContentHub performance metrics reset');
  }
}

// Export singleton instance
export const contentGenerationHub = new ContentGenerationHub(); 