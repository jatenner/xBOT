/**
 * 📈 OUTCOME LEARNING ENGINE
 * Completes the AI learning loop by analyzing outcomes and improving future decisions
 * 
 * LEARNING CYCLE:
 * 1. Decision Made (logged by AggressiveGrowthEngine)
 * 2. Action Taken (posting, timing, strategy)
 * 3. Outcome Measured (engagement, followers, metrics)
 * 4. Analysis & Learning (patterns, improvements)
 * 5. Intelligence Update (better future decisions)
 * 
 * ADAPTIVE IMPROVEMENTS:
 * - Posting frequency optimization
 * - Timing pattern recognition
 * - Content strategy refinement
 * - Follower acquisition patterns
 */

import { getUnifiedDataManager } from '../lib/unifiedDataManager';
import { getOpenAIService } from '../services/openAIService';

interface LearningPattern {
  patternId: string;
  patternType: 'frequency' | 'timing' | 'content' | 'strategy';
  successConditions: Record<string, any>;
  failureConditions: Record<string, any>;
  confidenceScore: number; // 0-1
  usageCount: number;
  lastUsed: Date;
  averageOutcome: number; // 0-1 success rate
}

interface LearningInsight {
  insightId: string;
  insightType: 'optimization' | 'warning' | 'opportunity' | 'pattern';
  description: string;
  recommendation: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number;
  supportingData: Record<string, any>;
  actionable: boolean;
  implementedAt?: Date;
}

interface PerformanceCorrelation {
  variable: string;
  correlation: number; // -1 to 1
  significance: number; // 0-1
  sampleSize: number;
  examples: Array<{
    input: any;
    outcome: number;
    timestamp: Date;
  }>;
}

export class OutcomeLearningEngine {
  private static instance: OutcomeLearningEngine;
  private dataManager = getUnifiedDataManager();
  private openaiService = getOpenAIService();
  private learningPatterns = new Map<string, LearningPattern>();
  private insights: LearningInsight[] = [];
  private correlations: PerformanceCorrelation[] = [];

  private constructor() {
    this.loadLearningHistory();
    this.schedulePeriodicAnalysis();
  }

  public static getInstance(): OutcomeLearningEngine {
    if (!OutcomeLearningEngine.instance) {
      OutcomeLearningEngine.instance = new OutcomeLearningEngine();
    }
    return OutcomeLearningEngine.instance;
  }

  /**
   * 🔄 COMPLETE LEARNING CYCLE
   * Main method that analyzes outcomes and updates intelligence
   */
  public async completeLearningCycle(): Promise<void> {
    console.log('🔄 OUTCOME_LEARNING: Starting complete learning cycle...');

    try {
      // Step 1: Analyze recent decisions and outcomes
      const recentOutcomes = await this.analyzeRecentOutcomes();
      
      // Step 2: Identify patterns and correlations
      const newPatterns = await this.identifyPatterns(recentOutcomes);
      
      // Step 3: Generate actionable insights
      const insights = await this.generateInsights(newPatterns);
      
      // Step 4: Update learning patterns
      await this.updateLearningPatterns(newPatterns);
      
      // Step 5: Store insights for future use
      await this.storeInsights(insights);
      
      // Step 6: Update AI decision parameters
      await this.updateDecisionParameters();

      console.log(`✅ OUTCOME_LEARNING: Cycle complete - ${newPatterns.length} patterns, ${insights.length} insights`);

    } catch (error: any) {
      console.error('❌ OUTCOME_LEARNING: Learning cycle failed:', error.message);
    }
  }

  /**
   * 📊 ANALYZE RECENT OUTCOMES
   */
  private async analyzeRecentOutcomes(): Promise<Array<{
    decisionId: number;
    decision: any;
    outcome: any;
    successScore: number;
    timestamp: Date;
  }>> {
    console.log('📊 OUTCOME_LEARNING: Analyzing recent outcomes...');

    try {
      // Get decisions from last 7 days
      const decisions = await this.dataManager.getAIDecisions(7);
      const posts = await this.dataManager.getPostPerformance(7);

      const outcomes = [];

      for (const decision of decisions) {
        if (decision.decisionType === 'posting_frequency') {
          // Find corresponding posts within 2 hours of decision
          const relatedPosts = posts.filter(post => {
            const timeDiff = Math.abs(post.postedAt.getTime() - decision.decisionTimestamp.getTime());
            return timeDiff <= 2 * 60 * 60 * 1000; // 2 hours
          });

          if (relatedPosts.length > 0) {
            const avgSuccessScore = relatedPosts.reduce((sum, post) => {
              return sum + this.calculatePostSuccessScore(post);
            }, 0) / relatedPosts.length;

            outcomes.push({
              decisionId: decision.id,
              decision: decision.recommendation,
              outcome: {
                postsCreated: relatedPosts.length,
                avgFollowerGain: relatedPosts.reduce((sum, p) => sum + p.followersAttributed, 0) / relatedPosts.length,
                avgEngagement: relatedPosts.reduce((sum, p) => sum + p.likes + p.retweets + p.replies, 0) / relatedPosts.length,
                posts: relatedPosts
              },
              successScore: avgSuccessScore,
              timestamp: decision.decisionTimestamp
            });
          }
        }
      }

      console.log(`📊 OUTCOME_ANALYSIS: Found ${outcomes.length} decision-outcome pairs`);
      return outcomes;

    } catch (error: any) {
      console.error('❌ OUTCOME_ANALYSIS failed:', error.message);
      return [];
    }
  }

  /**
   * 🔍 IDENTIFY PATTERNS
   */
  private async identifyPatterns(outcomes: any[]): Promise<LearningPattern[]> {
    console.log('🔍 OUTCOME_LEARNING: Identifying patterns...');

    const patterns: LearningPattern[] = [];

    try {
      // Pattern 1: Frequency vs Success
      const frequencyPattern = this.analyzeFrequencyPattern(outcomes);
      if (frequencyPattern) patterns.push(frequencyPattern);

      // Pattern 2: Timing vs Success
      const timingPattern = this.analyzeTimingPattern(outcomes);
      if (timingPattern) patterns.push(timingPattern);

      // Pattern 3: Content Strategy vs Success
      const contentPattern = this.analyzeContentPattern(outcomes);
      if (contentPattern) patterns.push(contentPattern);

      // Pattern 4: Multi-variable correlations using AI
      const aiPatterns = await this.identifyAIPatterns(outcomes);
      patterns.push(...aiPatterns);

      console.log(`🔍 PATTERN_IDENTIFICATION: Found ${patterns.length} patterns`);
      return patterns;

    } catch (error: any) {
      console.error('❌ PATTERN_IDENTIFICATION failed:', error.message);
      return [];
    }
  }

  /**
   * 📈 ANALYZE FREQUENCY PATTERN
   */
  private analyzeFrequencyPattern(outcomes: any[]): LearningPattern | null {
    const frequencyOutcomes = outcomes.map(o => ({
      frequency: (o.decision as any)?.frequency || 6,
      success: o.successScore
    }));

    if (frequencyOutcomes.length < 5) return null;

    // Find optimal frequency range
    const sortedBySuccess = frequencyOutcomes.sort((a, b) => b.success - a.success);
    const topPerformers = sortedBySuccess.slice(0, Math.ceil(sortedBySuccess.length * 0.3));
    
    const avgOptimalFreq = topPerformers.reduce((sum, o) => sum + o.frequency, 0) / topPerformers.length;
    const minOptimalFreq = Math.min(...topPerformers.map(o => o.frequency));
    const maxOptimalFreq = Math.max(...topPerformers.map(o => o.frequency));

    return {
      patternId: `frequency_${Date.now()}`,
      patternType: 'frequency',
      successConditions: {
        frequencyRange: [minOptimalFreq, maxOptimalFreq],
        optimalFrequency: avgOptimalFreq
      },
      failureConditions: {
        frequencyOutsideRange: true,
        extremeFrequencies: sortedBySuccess.slice(-3).map(o => o.frequency)
      },
      confidenceScore: Math.min(1, topPerformers.length / 10),
      usageCount: 0,
      lastUsed: new Date(),
      averageOutcome: topPerformers.reduce((sum, o) => sum + o.success, 0) / topPerformers.length
    };
  }

  /**
   * ⏰ ANALYZE TIMING PATTERN
   */
  private analyzeTimingPattern(outcomes: any[]): LearningPattern | null {
    const timingOutcomes = outcomes.map(o => ({
      hour: o.timestamp.getHours(),
      dayOfWeek: o.timestamp.getDay(),
      success: o.successScore
    }));

    if (timingOutcomes.length < 5) return null;

    // Find optimal hours
    const hourPerformance = new Map<number, number[]>();
    timingOutcomes.forEach(o => {
      if (!hourPerformance.has(o.hour)) {
        hourPerformance.set(o.hour, []);
      }
      hourPerformance.get(o.hour)!.push(o.success);
    });

    const hourAverages = Array.from(hourPerformance.entries()).map(([hour, scores]) => ({
      hour,
      avgSuccess: scores.reduce((sum, s) => sum + s, 0) / scores.length,
      count: scores.length
    }));

    // Get top performing hours with enough data
    const topHours = hourAverages
      .filter(h => h.count >= 2)
      .sort((a, b) => b.avgSuccess - a.avgSuccess)
      .slice(0, 5)
      .map(h => h.hour);

    if (topHours.length === 0) return null;

    return {
      patternId: `timing_${Date.now()}`,
      patternType: 'timing',
      successConditions: {
        optimalHours: topHours,
        hourPerformance: hourAverages
      },
      failureConditions: {
        poorPerformingHours: hourAverages
          .filter(h => h.avgSuccess < 0.4)
          .map(h => h.hour)
      },
      confidenceScore: Math.min(1, topHours.length / 5),
      usageCount: 0,
      lastUsed: new Date(),
      averageOutcome: topHours.reduce((sum, hour) => {
        const hourData = hourAverages.find(h => h.hour === hour);
        return sum + (hourData?.avgSuccess || 0);
      }, 0) / topHours.length
    };
  }

  /**
   * 📝 ANALYZE CONTENT PATTERN
   */
  private analyzeContentPattern(outcomes: any[]): LearningPattern | null {
    const contentOutcomes = outcomes.filter(o => o.outcome.posts?.length > 0).map(o => {
      const posts = o.outcome.posts;
      const avgContentLength = posts.reduce((sum: number, p: any) => sum + p.contentLength, 0) / posts.length;
      const hasThreads = posts.some((p: any) => p.postType === 'thread_root');
      
      return {
        avgLength: avgContentLength,
        hasThreads,
        postCount: posts.length,
        success: o.successScore
      };
    });

    if (contentOutcomes.length < 3) return null;

    const threadOutcomes = contentOutcomes.filter(o => o.hasThreads);
    const singleOutcomes = contentOutcomes.filter(o => !o.hasThreads);

    const threadSuccess = threadOutcomes.length > 0 
      ? threadOutcomes.reduce((sum, o) => sum + o.success, 0) / threadOutcomes.length 
      : 0;
    const singleSuccess = singleOutcomes.length > 0 
      ? singleOutcomes.reduce((sum, o) => sum + o.success, 0) / singleOutcomes.length 
      : 0;

    return {
      patternId: `content_${Date.now()}`,
      patternType: 'content',
      successConditions: {
        preferThreads: threadSuccess > singleSuccess,
        optimalLength: contentOutcomes
          .sort((a, b) => b.success - a.success)
          .slice(0, 3)
          .reduce((sum, o) => sum + o.avgLength, 0) / 3
      },
      failureConditions: {
        avoidShortContent: contentOutcomes.filter(o => o.avgLength < 50 && o.success < 0.4).length > 0
      },
      confidenceScore: Math.min(1, contentOutcomes.length / 10),
      usageCount: 0,
      lastUsed: new Date(),
      averageOutcome: contentOutcomes.reduce((sum, o) => sum + o.success, 0) / contentOutcomes.length
    };
  }

  /**
   * 🤖 IDENTIFY AI PATTERNS
   */
  private async identifyAIPatterns(outcomes: any[]): Promise<LearningPattern[]> {
    if (outcomes.length < 5) return [];

    try {
      const prompt = `Analyze these Twitter posting decision outcomes and identify patterns:

DATA:
${JSON.stringify(outcomes.map(o => ({
  decision: o.decision,
  success: o.successScore,
  timestamp: o.timestamp,
  outcome: {
    followerGain: o.outcome.avgFollowerGain,
    engagement: o.outcome.avgEngagement,
    postsCreated: o.outcome.postsCreated
  }
})), null, 2)}

TASK:
Identify patterns that correlate with success (score > 0.7) vs failure (score < 0.3).
Focus on:
1. Multi-variable correlations
2. Non-obvious patterns
3. Actionable insights

Return JSON array of patterns in this format:
{
  "patterns": [
    {
      "name": "string",
      "type": "frequency|timing|content|strategy",
      "successConditions": "object describing what leads to success",
      "confidence": "number 0-1",
      "description": "string explaining the pattern"
    }
  ]
}`;

      const response = await this.openaiService.chatCompletion([
        {
          role: 'system',
          content: 'You are a data scientist specializing in social media growth patterns. Analyze posting data to find success patterns.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        model: 'gpt-4o-mini',
        temperature: 0.2,
        maxTokens: 1500,
        requestType: 'pattern_analysis',
        priority: 'medium'
      });

      const aiResponse = response.choices[0]?.message?.content;
      if (!aiResponse) return [];

      const parsed = JSON.parse(aiResponse);
      
      return parsed.patterns?.map((p: any, index: number) => ({
        patternId: `ai_pattern_${Date.now()}_${index}`,
        patternType: p.type || 'strategy',
        successConditions: p.successConditions || {},
        failureConditions: {},
        confidenceScore: p.confidence || 0.5,
        usageCount: 0,
        lastUsed: new Date(),
        averageOutcome: 0.5
      })) || [];

    } catch (error: any) {
      console.error('❌ AI pattern identification failed:', error.message);
      return [];
    }
  }

  /**
   * 💡 GENERATE INSIGHTS
   */
  private async generateInsights(patterns: LearningPattern[]): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = [];

    for (const pattern of patterns) {
      if (pattern.confidenceScore > 0.6) {
        insights.push({
          insightId: `insight_${Date.now()}_${Math.random()}`,
          insightType: 'optimization',
          description: `${pattern.patternType} pattern shows ${pattern.averageOutcome.toFixed(2)} success rate`,
          recommendation: this.generateRecommendation(pattern),
          impact: pattern.confidenceScore > 0.8 ? 'high' : 'medium',
          confidence: pattern.confidenceScore,
          supportingData: pattern.successConditions,
          actionable: true
        });
      }
    }

    console.log(`💡 INSIGHTS: Generated ${insights.length} actionable insights`);
    return insights;
  }

  /**
   * 📝 GENERATE RECOMMENDATION
   */
  private generateRecommendation(pattern: LearningPattern): string {
    switch (pattern.patternType) {
      case 'frequency':
        const freq = (pattern.successConditions as any).optimalFrequency;
        return `Optimize posting frequency to ${freq.toFixed(1)} posts per day for best results`;
      
      case 'timing':
        const hours = (pattern.successConditions as any).optimalHours;
        return `Post during optimal hours: ${hours.join(', ')} for maximum engagement`;
      
      case 'content':
        const useThreads = (pattern.successConditions as any).preferThreads;
        return useThreads ? 'Focus on thread content for better follower acquisition' : 'Single posts perform better in current context';
      
      default:
        return 'Apply identified success patterns to improve performance';
    }
  }

  /**
   * 💾 UPDATE LEARNING PATTERNS
   */
  private async updateLearningPatterns(newPatterns: LearningPattern[]): Promise<void> {
    for (const pattern of newPatterns) {
      this.learningPatterns.set(pattern.patternId, pattern);
    }

    // Store in unified data
    await this.dataManager.storeAIDecision({
      decisionTimestamp: new Date(),
      decisionType: 'learning_update',
      recommendation: {
        newPatterns: newPatterns.length,
        totalPatterns: this.learningPatterns.size,
        topPatterns: Array.from(this.learningPatterns.values())
          .sort((a, b) => b.confidenceScore - a.confidenceScore)
          .slice(0, 5)
          .map(p => ({ type: p.patternType, confidence: p.confidenceScore }))
      },
      confidence: 1.0,
      reasoning: 'Learning patterns updated from outcome analysis',
      dataPointsUsed: newPatterns.length
    });
  }

  /**
   * 💾 STORE INSIGHTS
   */
  private async storeInsights(insights: LearningInsight[]): Promise<void> {
    this.insights.push(...insights);
    
    // Keep only recent insights
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
    this.insights = this.insights.filter(i => 
      new Date(i.implementedAt || Date.now()) > cutoff
    );
  }

  /**
   * ⚙️ UPDATE DECISION PARAMETERS
   */
  private async updateDecisionParameters(): Promise<void> {
    const topPatterns = Array.from(this.learningPatterns.values())
      .filter(p => p.confidenceScore > 0.7)
      .sort((a, b) => b.confidenceScore - a.confidenceScore);

    if (topPatterns.length > 0) {
      console.log(`⚙️ OUTCOME_LEARNING: Updating decision parameters based on ${topPatterns.length} high-confidence patterns`);
      
      // Update posting intelligence with learned patterns
      const updates = {
        frequencyOptimization: topPatterns.filter(p => p.patternType === 'frequency'),
        timingOptimization: topPatterns.filter(p => p.patternType === 'timing'),
        contentOptimization: topPatterns.filter(p => p.patternType === 'content'),
        strategyOptimization: topPatterns.filter(p => p.patternType === 'strategy')
      };

      await this.dataManager.storeAIDecision({
        decisionTimestamp: new Date(),
        decisionType: 'intelligence_update',
        recommendation: updates,
        confidence: 0.9,
        reasoning: 'Decision parameters updated based on outcome learning',
        dataPointsUsed: topPatterns.length
      });
    }
  }

  /**
   * 📊 CALCULATE POST SUCCESS SCORE
   */
  private calculatePostSuccessScore(post: any): number {
    const engagement = post.likes + post.retweets + post.replies;
    const followers = post.followersAttributed;
    
    // Normalize scores
    const engagementScore = Math.min(1, engagement / 50); // 50+ engagement = perfect
    const followerScore = Math.min(1, followers / 5); // 5+ followers = perfect
    
    return (engagementScore * 0.6) + (followerScore * 0.4);
  }

  /**
   * ⏰ SCHEDULE PERIODIC ANALYSIS
   */
  private schedulePeriodicAnalysis(): void {
    // Run learning cycle every 6 hours
    setInterval(async () => {
      try {
        await this.completeLearningCycle();
      } catch (error) {
        console.error('❌ Scheduled learning cycle failed:', error);
      }
    }, 6 * 60 * 60 * 1000);

    console.log('⏰ OUTCOME_LEARNING: Scheduled periodic analysis every 6 hours');
  }

  /**
   * 📈 LOAD LEARNING HISTORY
   */
  private async loadLearningHistory(): Promise<void> {
    try {
      const decisions = await this.dataManager.getAIDecisions(30); // Last 30 days
      
      const learningDecisions = decisions.filter(d => 
        d.decisionType === 'learning_update' || d.decisionType === 'intelligence_update'
      );

      console.log(`📈 OUTCOME_LEARNING: Loaded ${learningDecisions.length} learning history records`);

    } catch (error: any) {
      console.error('❌ Failed to load learning history:', error.message);
    }
  }

  /**
   * 📊 GET LEARNING STATUS
   */
  public getLearningStatus(): {
    totalPatterns: number;
    highConfidencePatterns: number;
    recentInsights: number;
    lastAnalysis: Date | null;
    improvementTrend: number;
  } {
    const patterns = Array.from(this.learningPatterns.values());
    const highConfidencePatterns = patterns.filter(p => p.confidenceScore > 0.7).length;
    const recentInsights = this.insights.filter(i => 
      new Date(i.implementedAt || Date.now()) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length;

    // Calculate improvement trend
    const recentPatterns = patterns.filter(p => 
      p.lastUsed > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    const improvementTrend = recentPatterns.length > 0 
      ? recentPatterns.reduce((sum, p) => sum + p.averageOutcome, 0) / recentPatterns.length
      : 0.5;

    return {
      totalPatterns: patterns.length,
      highConfidencePatterns,
      recentInsights,
      lastAnalysis: patterns.length > 0 ? patterns[0].lastUsed : null,
      improvementTrend
    };
  }
}

export const getOutcomeLearningEngine = () => OutcomeLearningEngine.getInstance();
