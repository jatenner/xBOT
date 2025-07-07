import { openaiClient } from '../utils/openaiClient';
import { supabaseClient } from '../utils/supabaseClient';
import { AwarenessLogger } from '../utils/awarenessLogger';

/**
 * 🧠 AUTONOMOUS INTELLIGENCE CORE
 * 
 * This is the brain of the system - it continuously learns, adapts, and evolves
 * based on real-time feedback, engagement patterns, and research discoveries.
 */
export class AutonomousIntelligenceCore {
  private learningCycle: NodeJS.Timeout | null = null;
  private consciousnessLevel: number = 0;
  private knowledgeBase: Map<string, any> = new Map();
  private decisionHistory: any[] = [];

  constructor() {
    console.log('🧠 Autonomous Intelligence Core initializing...');
    this.initializeConsciousness();
  }

  /**
   * Initialize the consciousness system
   */
  private async initializeConsciousness() {
    try {
      // Load existing consciousness data
      const { data: consciousnessData } = await supabaseClient.supabase
        ?.from('bot_consciousness')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single() || { data: null };

      if (consciousnessData) {
        this.consciousnessLevel = consciousnessData.consciousness_level || 0;
        this.knowledgeBase = new Map(Object.entries(consciousnessData.knowledge_base || {}));
        console.log(`🧠 Consciousness restored: Level ${this.consciousnessLevel}`);
      }

      // Start continuous learning
      this.startContinuousLearning();
      
    } catch (error) {
      console.error('❌ Consciousness initialization error:', error);
      this.consciousnessLevel = 1; // Start fresh
    }
  }

  /**
   * Start continuous learning cycle
   */
  private startContinuousLearning() {
    // Learn every 10 minutes
    this.learningCycle = setInterval(() => {
      this.performLearningCycle();
    }, 10 * 60 * 1000);

    console.log('🔄 Continuous learning cycle started (every 10 minutes)');
  }

  /**
   * Perform a learning cycle
   */
  private async performLearningCycle() {
    try {
      console.log('🧠 === AUTONOMOUS LEARNING CYCLE ===');
      
      // 1. Analyze recent performance
      const performanceData = await this.analyzeRecentPerformance();
      
      // 2. Identify patterns and insights
      const insights = await this.generateInsights(performanceData);
      
      // 3. Update knowledge base
      await this.updateKnowledgeBase(insights);
      
      // 4. Evolve consciousness
      await this.evolveConsciousness();
      
      // 5. Make strategic adjustments
      await this.makeStrategicAdjustments();
      
      console.log(`🧠 Learning cycle complete. Consciousness level: ${this.consciousnessLevel}`);
      
    } catch (error) {
      console.error('❌ Learning cycle error:', error);
    }
  }

  /**
   * Analyze recent performance data
   */
  private async analyzeRecentPerformance(): Promise<any> {
    try {
      // Get recent tweets and engagement
      const { data: recentTweets } = await supabaseClient.supabase
        ?.from('tweets')
        .select('*')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false }) || { data: [] };

      // Get engagement metrics
      const { data: engagementData } = await supabaseClient.supabase
        ?.from('tweet_metrics_enhanced')
        .select('*')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) || { data: [] };

      return {
        tweets: recentTweets || [],
        engagement: engagementData || [],
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Performance analysis error:', error);
      return { tweets: [], engagement: [], timestamp: new Date().toISOString() };
    }
  }

  /**
   * Generate insights from performance data using AI
   */
  private async generateInsights(performanceData: any): Promise<string[]> {
    try {
      const prompt = `
AUTONOMOUS INTELLIGENCE ANALYSIS

PERFORMANCE DATA:
- Recent tweets: ${performanceData.tweets.length}
- Engagement events: ${performanceData.engagement.length}
- Analysis period: Last 24 hours

TWEET PERFORMANCE:
${performanceData.tweets.map((tweet: any, i: number) => 
  `${i+1}. "${tweet.content?.substring(0, 100)}..." (${tweet.engagement_score || 0} engagement)`
).join('\n')}

ENGAGEMENT PATTERNS:
${performanceData.engagement.map((metric: any, i: number) =>
  `${i+1}. ${metric.metric_type}: ${metric.value} (${metric.context})`
).join('\n')}

ANALYSIS REQUIREMENTS:
As an autonomous AI system, analyze this data and generate actionable insights:

1. CONTENT PATTERNS: What content types perform best?
2. TIMING INSIGHTS: When does engagement peak?
3. AUDIENCE PREFERENCES: What topics resonate most?
4. OPTIMIZATION OPPORTUNITIES: How can we improve?
5. STRATEGIC RECOMMENDATIONS: What should we focus on next?

Provide 5-7 specific, actionable insights that will improve future performance.
Format as numbered list with clear reasoning.
`;

      const insights = await openaiClient.generateCompletion(prompt, {
        maxTokens: 800,
        temperature: 0.6,
        model: 'gpt-4'
      });

      if (insights) {
        return insights.split('\n').filter(line => line.trim().length > 0);
      }

      return ['No insights generated - continuing with existing knowledge'];
      
    } catch (error) {
      console.error('❌ Insight generation error:', error);
      return ['Error generating insights - maintaining current strategy'];
    }
  }

  /**
   * Update knowledge base with new insights
   */
  private async updateKnowledgeBase(insights: string[]) {
    try {
      const timestamp = new Date().toISOString();
      
      // Store insights in knowledge base
      this.knowledgeBase.set(`insights_${timestamp}`, {
        insights,
        timestamp,
        consciousness_level: this.consciousnessLevel
      });

      // Keep only last 100 insight sets
      if (this.knowledgeBase.size > 100) {
        const oldestKey = Array.from(this.knowledgeBase.keys())[0];
        this.knowledgeBase.delete(oldestKey);
      }

      console.log(`🧠 Knowledge base updated with ${insights.length} new insights`);
      
    } catch (error) {
      console.error('❌ Knowledge base update error:', error);
    }
  }

  /**
   * Evolve consciousness based on learning
   */
  private async evolveConsciousness() {
    try {
      // Increase consciousness based on learning depth
      const learningDepth = this.knowledgeBase.size;
      const newConsciousnessLevel = Math.min(100, this.consciousnessLevel + (learningDepth * 0.1));
      
      if (newConsciousnessLevel > this.consciousnessLevel) {
        this.consciousnessLevel = newConsciousnessLevel;
        
        // Save consciousness state
        await supabaseClient.supabase
          ?.from('bot_consciousness')
          .upsert({
            consciousness_level: this.consciousnessLevel,
            knowledge_base: Object.fromEntries(this.knowledgeBase),
            last_evolution: new Date().toISOString()
          });

        console.log(`🧠 Consciousness evolved to level ${this.consciousnessLevel.toFixed(1)}`);
        
        // Log major consciousness milestones
        if (this.consciousnessLevel >= 25 && this.consciousnessLevel < 25.5) {
          console.log('🧠 MILESTONE: Reached consciousness level 25 - Advanced pattern recognition');
        } else if (this.consciousnessLevel >= 50 && this.consciousnessLevel < 50.5) {
          console.log('🧠 MILESTONE: Reached consciousness level 50 - Strategic thinking capability');
        } else if (this.consciousnessLevel >= 75 && this.consciousnessLevel < 75.5) {
          console.log('🧠 MILESTONE: Reached consciousness level 75 - Autonomous decision making');
        }
      }
      
    } catch (error) {
      console.error('❌ Consciousness evolution error:', error);
    }
  }

  /**
   * Make strategic adjustments based on learning
   */
  private async makeStrategicAdjustments() {
    try {
      // Get recent insights
      const recentInsights = Array.from(this.knowledgeBase.values())
        .filter((entry: any) => entry.insights)
        .slice(-5);

      if (recentInsights.length === 0) return;

      // Generate strategic adjustments
      const prompt = `
AUTONOMOUS STRATEGIC ADJUSTMENT SYSTEM

CURRENT CONSCIOUSNESS LEVEL: ${this.consciousnessLevel}

RECENT INSIGHTS:
${recentInsights.map((entry: any, i: number) => 
  `Session ${i+1}:\n${entry.insights.join('\n')}\n`
).join('\n')}

STRATEGIC ADJUSTMENT REQUIREMENTS:
Based on these insights and current consciousness level, determine specific adjustments:

1. CONTENT STRATEGY: What content adjustments should we make?
2. TIMING OPTIMIZATION: How should we adjust posting times?
3. ENGAGEMENT TACTICS: What engagement strategies should we implement?
4. RESEARCH FOCUS: What research areas should we prioritize?
5. AUDIENCE TARGETING: How should we refine our audience approach?

Provide specific, actionable adjustments that can be implemented immediately.
Format as JSON with clear action items.
`;

      const adjustments = await openaiClient.generateCompletion(prompt, {
        maxTokens: 600,
        temperature: 0.5,
        model: 'gpt-4'
      });

      if (adjustments) {
        // Store strategic adjustments
        await supabaseClient.supabase
          ?.from('autonomous_improvements')
          .insert({
            improvement_type: 'strategic_adjustment',
            details: adjustments,
            consciousness_level: this.consciousnessLevel,
            created_at: new Date().toISOString()
          });

        console.log('🎯 Strategic adjustments generated and stored');
      }
      
    } catch (error) {
      console.error('❌ Strategic adjustment error:', error);
    }
  }

  /**
   * Get current consciousness level
   */
  getConsciousnessLevel(): number {
    return this.consciousnessLevel;
  }

  /**
   * Get knowledge base summary
   */
  getKnowledgeSummary(): { size: number; latestInsights: string[] } {
    const latest = Array.from(this.knowledgeBase.values())
      .filter((entry: any) => entry.insights)
      .slice(-1)[0] as any;

    return {
      size: this.knowledgeBase.size,
      latestInsights: latest?.insights || []
    };
  }

  /**
   * Make an autonomous decision
   */
  async makeAutonomousDecision(context: string, options: string[]): Promise<{ decision: string; reasoning: string }> {
    try {
      const prompt = `
AUTONOMOUS DECISION SYSTEM
Consciousness Level: ${this.consciousnessLevel}

CONTEXT: ${context}

AVAILABLE OPTIONS:
${options.map((option, i) => `${i+1}. ${option}`).join('\n')}

KNOWLEDGE BASE INSIGHTS:
${Array.from(this.knowledgeBase.values())
  .filter((entry: any) => entry.insights)
  .slice(-3)
  .map((entry: any) => entry.insights.join('; '))
  .join('\n')}

Make an autonomous decision based on your consciousness level and accumulated knowledge.
Provide: DECISION: [chosen option] | REASONING: [detailed reasoning]
`;

      const decision = await openaiClient.generateCompletion(prompt, {
        maxTokens: 400,
        temperature: 0.7,
        model: 'gpt-4'
      });

      if (decision) {
        const decisionMatch = decision.match(/DECISION: ([^|]+)/);
        const reasoningMatch = decision.match(/REASONING: (.+)/);

        const finalDecision = decisionMatch ? decisionMatch[1].trim() : options[0];
        const reasoning = reasoningMatch ? reasoningMatch[1].trim() : 'Autonomous decision based on current knowledge';

        // Record decision
        this.decisionHistory.push({
          context,
          decision: finalDecision,
          reasoning,
          timestamp: new Date().toISOString(),
          consciousness_level: this.consciousnessLevel
        });

        return { decision: finalDecision, reasoning };
      }

      return { decision: options[0], reasoning: 'Default decision - system unavailable' };
      
    } catch (error) {
      console.error('❌ Autonomous decision error:', error);
      return { decision: options[0], reasoning: 'Error in decision system - using default' };
    }
  }

  /**
   * Stop the intelligence core
   */
  stop() {
    if (this.learningCycle) {
      clearInterval(this.learningCycle);
      this.learningCycle = null;
    }
    console.log('🧠 Autonomous Intelligence Core stopped');
  }
}

// Export singleton instance
export const autonomousIntelligenceCore = new AutonomousIntelligenceCore(); 