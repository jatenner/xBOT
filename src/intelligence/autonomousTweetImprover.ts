/**
 * 🚀 AUTONOMOUS TWEET IMPROVEMENT SYSTEM
 * 
 * Continuously learns from engagement data and improves tweet quality:
 * - Analyzes low-performing tweets to identify patterns
 * - Learns from high-performing content structures  
 * - Automatically adapts future content based on data
 * - Implements real-time feedback loops for optimization
 * - Prevents repeated mistakes that hurt engagement
 */

import { supabaseClient } from '../utils/supabaseClient';
import { BudgetAwareOpenAI } from '../utils/budgetAwareOpenAI';
import { PromiseDeliveryValidator } from '../utils/promiseDeliveryValidator';
import OpenAI from 'openai';

interface EngagementPattern {
  pattern_type: 'high_performing' | 'low_performing' | 'neutral';
  content_structure: string;
  engagement_metrics: {
    likes: number;
    retweets: number;
    replies: number;
    impressions: number;
    engagement_rate: number;
  };
  pattern_features: {
    has_question: boolean;
    has_numbers: boolean;
    has_thread_promise: boolean;
    delivers_on_promise: boolean;
    word_count: number;
    emoji_count: number;
    topic_category: string;
    hook_type: string;
  };
  sample_tweets: string[];
  confidence_score: number;
}

interface ImprovementInsight {
  insight_type: 'structural' | 'content' | 'timing' | 'format';
  problem_identified: string;
  solution_strategy: string;
  implementation_priority: 'high' | 'medium' | 'low';
  expected_impact: number; // 0-1 score
  evidence: string[];
  action_items: string[];
}

interface TweetImprovement {
  original_content: string;
  improved_content: string;
  improvement_type: 'promise_delivery' | 'engagement_optimization' | 'structure_fix' | 'content_quality';
  changes_made: string[];
  expected_performance_lift: number;
  confidence: number;
  reasoning: string;
}

export class AutonomousTweetImprover {
  private static instance: AutonomousTweetImprover;
  private budgetAwareOpenAI: BudgetAwareOpenAI;
  private openai: OpenAI;
  private promiseValidator: PromiseDeliveryValidator;
  
  // Learning state
  private engagementPatterns: Map<string, EngagementPattern> = new Map();
  private improvementInsights: ImprovementInsight[] = [];
  private lastLearningUpdate: number = 0;
  
  static getInstance(): AutonomousTweetImprover {
    if (!this.instance) {
      this.instance = new AutonomousTweetImprover();
    }
    return this.instance;
  }

  constructor() {
    this.budgetAwareOpenAI = new BudgetAwareOpenAI(process.env.OPENAI_API_KEY || '');
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.promiseValidator = new PromiseDeliveryValidator();
  }

  /**
   * 🎯 MAIN IMPROVEMENT PIPELINE - Analyzes and improves content before posting
   */
  async improveContentAutonomously(content: string | string[]): Promise<{
    improved_content: string | string[];
    improvements_made: TweetImprovement[];
    should_post: boolean;
    confidence_score: number;
    reasoning: string;
  }> {
    try {
      console.log('🚀 Starting autonomous tweet improvement analysis...');
      
      // Step 1: Update learning patterns if needed
      await this.updateLearningPatternsIfNeeded();
      
      // Step 2: Analyze promise delivery
      const promiseValidation = await this.promiseValidator.validatePromiseDelivery(content);
      
      // Step 3: Apply engagement-based improvements
      const engagementOptimization = await this.applyEngagementOptimizations(content);
      
      // Step 4: Structural improvements based on patterns
      const structuralImprovements = await this.applyStructuralImprovements(content);
      
      // Step 5: Combine all improvements
      const finalImprovement = await this.combineImprovements(
        content,
        promiseValidation,
        engagementOptimization,
        structuralImprovements
      );
      
      console.log(`✅ Autonomous improvement complete. Confidence: ${(finalImprovement.confidence_score * 100).toFixed(1)}%`);
      
      return finalImprovement;

    } catch (error) {
      console.error('❌ Autonomous improvement failed:', error);
      
      return {
        improved_content: content,
        improvements_made: [],
        should_post: true, // Default to allowing posts
        confidence_score: 0.5,
        reasoning: `Improvement analysis failed: ${error.message}`
      };
    }
  }

  /**
   * 📊 UPDATE LEARNING PATTERNS from recent engagement data
   */
  private async updateLearningPatternsIfNeeded(): Promise<void> {
    const now = Date.now();
    const sixHours = 6 * 60 * 60 * 1000;
    
    if (now - this.lastLearningUpdate < sixHours) {
      return; // Don't update too frequently
    }

    try {
      console.log('📊 Updating engagement learning patterns...');
      
      // Get recent tweet performance data
      const { data: recentTweets, error } = await supabaseClient.supabase
        .from('tweet_analytics')
        .select(`
          content,
          likes,
          retweets,
          replies,
          impressions,
          engagement_rate,
          created_at
        `)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
        .order('created_at', { ascending: false })
        .limit(50);

      if (error || !recentTweets || recentTweets.length === 0) {
        console.warn('⚠️ No recent tweet data available for learning');
        return;
      }

      // Analyze patterns from high vs low performing tweets
      const highPerforming = recentTweets.filter(t => t.engagement_rate > 0.05); // 5%+ engagement
      const lowPerforming = recentTweets.filter(t => t.engagement_rate < 0.02); // <2% engagement

      // Extract patterns from high performers
      for (const tweet of highPerforming) {
        const pattern = await this.extractEngagementPattern(tweet, 'high_performing');
        this.engagementPatterns.set(`high_${tweet.content.substring(0, 20)}`, pattern);
      }

      // Extract patterns from low performers
      for (const tweet of lowPerforming) {
        const pattern = await this.extractEngagementPattern(tweet, 'low_performing');
        this.engagementPatterns.set(`low_${tweet.content.substring(0, 20)}`, pattern);
      }

      // Generate improvement insights
      await this.generateImprovementInsights();
      
      this.lastLearningUpdate = now;
      console.log(`✅ Updated learning patterns from ${recentTweets.length} tweets`);

    } catch (error) {
      console.error('❌ Failed to update learning patterns:', error);
    }
  }

  /**
   * 🔍 EXTRACT patterns from individual tweets
   */
  private async extractEngagementPattern(tweet: any, type: 'high_performing' | 'low_performing'): Promise<EngagementPattern> {
    const content = tweet.content || '';
    
    // Analyze content features
    const features = {
      has_question: /\?/.test(content),
      has_numbers: /\d+/.test(content),
      has_thread_promise: /\d+\s+(ways|tips|reasons|steps)/.test(content),
      delivers_on_promise: true, // Would need more analysis
      word_count: content.split(/\s+/).length,
      emoji_count: (content.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu) || []).length,
      topic_category: await this.extractTopicCategory(content),
      hook_type: await this.extractHookType(content)
    };

    return {
      pattern_type: type,
      content_structure: this.analyzeContentStructure(content),
      engagement_metrics: {
        likes: tweet.likes || 0,
        retweets: tweet.retweets || 0,
        replies: tweet.replies || 0,
        impressions: tweet.impressions || 0,
        engagement_rate: tweet.engagement_rate || 0
      },
      pattern_features: features,
      sample_tweets: [content],
      confidence_score: 0.8
    };
  }

  /**
   * 💡 GENERATE improvement insights from patterns
   */
  private async generateImprovementInsights(): Promise<void> {
    const highPatterns = Array.from(this.engagementPatterns.values())
      .filter(p => p.pattern_type === 'high_performing');
    
    const lowPatterns = Array.from(this.engagementPatterns.values())
      .filter(p => p.pattern_type === 'low_performing');

    if (highPatterns.length === 0 || lowPatterns.length === 0) {
      return;
    }

    // Analyze differences between high and low performing content
    const insights: ImprovementInsight[] = [];

    // Question pattern analysis
    const highQuestionRate = highPatterns.filter(p => p.pattern_features.has_question).length / highPatterns.length;
    const lowQuestionRate = lowPatterns.filter(p => p.pattern_features.has_question).length / lowPatterns.length;
    
    if (highQuestionRate > lowQuestionRate + 0.2) {
      insights.push({
        insight_type: 'structural',
        problem_identified: 'Low use of engaging questions',
        solution_strategy: 'Include more thought-provoking questions in tweets',
        implementation_priority: 'high',
        expected_impact: 0.3,
        evidence: [`High performers use questions ${(highQuestionRate * 100).toFixed(1)}% vs ${(lowQuestionRate * 100).toFixed(1)}%`],
        action_items: ['Add questions to statement-only tweets', 'Test question hooks']
      });
    }

    // Thread promise analysis
    const highPromiseFailures = highPatterns.filter(p => 
      p.pattern_features.has_thread_promise && !p.pattern_features.delivers_on_promise
    ).length;
    
    if (highPromiseFailures > 0) {
      insights.push({
        insight_type: 'content',
        problem_identified: 'Unfulfilled thread promises hurt engagement',
        solution_strategy: 'Ensure all numbered promises deliver actual content',
        implementation_priority: 'high',
        expected_impact: 0.4,
        evidence: [`${highPromiseFailures} high-potential tweets failed to deliver promises`],
        action_items: ['Validate promise delivery before posting', 'Generate missing content']
      });
    }

    this.improvementInsights = insights;
    console.log(`💡 Generated ${insights.length} improvement insights`);
  }

  /**
   * 🎯 APPLY engagement-based optimizations
   */
  private async applyEngagementOptimizations(content: string | string[]): Promise<TweetImprovement | null> {
    const text = Array.isArray(content) ? content.join(' ') : content;
    
    // Find relevant insights for this content
    const applicableInsights = this.improvementInsights.filter(insight => 
      this.isInsightApplicable(insight, text)
    );

    if (applicableInsights.length === 0) {
      return null;
    }

    // Apply the highest priority insight
    const topInsight = applicableInsights.sort((a, b) => {
      const priorityScore = { high: 3, medium: 2, low: 1 };
      return priorityScore[b.implementation_priority] - priorityScore[a.implementation_priority];
    })[0];

    try {
      const improvedContent = await this.applySpecificImprovement(text, topInsight);
      
      return {
        original_content: text,
        improved_content: improvedContent,
        improvement_type: 'engagement_optimization',
        changes_made: topInsight.action_items,
        expected_performance_lift: topInsight.expected_impact,
        confidence: 0.8,
        reasoning: `Applied insight: ${topInsight.solution_strategy}`
      };

    } catch (error) {
      console.warn('⚠️ Failed to apply engagement optimization:', error);
      return null;
    }
  }

  /**
   * 🏗️ APPLY structural improvements
   */
  private async applyStructuralImprovements(content: string | string[]): Promise<TweetImprovement | null> {
    const text = Array.isArray(content) ? content.join(' ') : content;
    
    // Check for common structural issues
    const issues: string[] = [];
    
    // Issue 1: Too many characters for single tweet
    if (text.length > 280 && !Array.isArray(content)) {
      issues.push('Single tweet too long - should be thread');
    }
    
    // Issue 2: Thread with only one tweet
    if (Array.isArray(content) && content.length === 1) {
      issues.push('Unnecessary thread format for single idea');
    }
    
    // Issue 3: Missing hook
    if (!this.hasEngagingHook(text)) {
      issues.push('Lacks engaging opening hook');
    }

    if (issues.length === 0) {
      return null;
    }

    // Fix the most critical issue
    const improvedContent = await this.fixStructuralIssue(text, issues[0]);
    
    return {
      original_content: text,
      improved_content: improvedContent,
      improvement_type: 'structure_fix',
      changes_made: [issues[0]],
      expected_performance_lift: 0.2,
      confidence: 0.7,
      reasoning: `Fixed structural issue: ${issues[0]}`
    };
  }

  /**
   * 🔧 COMBINE all improvements into final result
   */
  private async combineImprovements(
    originalContent: string | string[],
    promiseValidation: any,
    engagementOpt: TweetImprovement | null,
    structuralOpt: TweetImprovement | null
  ): Promise<{
    improved_content: string | string[];
    improvements_made: TweetImprovement[];
    should_post: boolean;
    confidence_score: number;
    reasoning: string;
  }> {
    
    let finalContent = originalContent;
    const improvements: TweetImprovement[] = [];
    let shouldPost = true;
    let confidence = 0.8;
    const reasoningParts: string[] = [];

    // Apply promise validation fixes first (highest priority)
    if (promiseValidation.hasUnfulfilledPromise) {
      shouldPost = false;
      confidence = 0.3;
      reasoningParts.push(`Unfulfilled promise detected: ${promiseValidation.promiseDetection.promiseText}`);
      
      if (promiseValidation.improvedContent) {
        finalContent = promiseValidation.improvedContent;
        improvements.push({
          original_content: Array.isArray(originalContent) ? originalContent.join(' ') : originalContent,
          improved_content: promiseValidation.improvedContent,
          improvement_type: 'promise_delivery',
          changes_made: ['Fixed unfulfilled promise'],
          expected_performance_lift: 0.5,
          confidence: 0.9,
          reasoning: 'Converted promise-making tweet to deliverable content'
        });
        shouldPost = true;
        confidence = 0.7;
        reasoningParts.push('Applied promise delivery fix');
      }
    }

    // Apply engagement optimizations
    if (engagementOpt) {
      finalContent = engagementOpt.improved_content;
      improvements.push(engagementOpt);
      confidence = Math.min(confidence + 0.1, 0.95);
      reasoningParts.push('Applied engagement optimization');
    }

    // Apply structural improvements
    if (structuralOpt) {
      finalContent = structuralOpt.improved_content;
      improvements.push(structuralOpt);
      confidence = Math.min(confidence + 0.05, 0.95);
      reasoningParts.push('Applied structural improvements');
    }

    return {
      improved_content: finalContent,
      improvements_made: improvements,
      should_post: shouldPost,
      confidence_score: confidence,
      reasoning: reasoningParts.join('; ') || 'No improvements needed'
    };
  }

  /**
   * 🔧 HELPER METHODS
   */
  private analyzeContentStructure(content: string): string {
    if (content.includes('?')) return 'question_format';
    if (/\d+\s+(ways|tips|reasons)/.test(content)) return 'numbered_promise';
    if (content.length < 100) return 'short_statement';
    if (content.split('.').length > 3) return 'multi_point';
    return 'standard_format';
  }

  private async extractTopicCategory(content: string): Promise<string> {
    // Simplified topic extraction
    if (/sleep|rest|recovery/.test(content)) return 'sleep';
    if (/exercise|workout|fitness/.test(content)) return 'fitness';
    if (/nutrition|diet|food/.test(content)) return 'nutrition';
    if (/stress|mental|anxiety/.test(content)) return 'mental_health';
    return 'general';
  }

  private async extractHookType(content: string): Promise<string> {
    if (content.startsWith('Did you know')) return 'did_you_know';
    if (content.includes('?')) return 'question';
    if (/\d+\s+(ways|tips)/.test(content)) return 'numbered_list';
    if (/new study|research/.test(content)) return 'science_based';
    return 'statement';
  }

  private isInsightApplicable(insight: ImprovementInsight, content: string): boolean {
    if (insight.insight_type === 'structural' && insight.problem_identified.includes('question')) {
      return !content.includes('?');
    }
    return true;
  }

  private async applySpecificImprovement(content: string, insight: ImprovementInsight): Promise<string> {
    const prompt = `Improve this tweet based on the insight: ${insight.solution_strategy}

Original tweet: "${content}"

Problem: ${insight.problem_identified}
Solution: ${insight.solution_strategy}

Return only the improved tweet (under 280 chars):`;

    const response = await this.budgetAwareOpenAI.createChatCompletion([
      { role: 'user', content: prompt }
    ], {
      model: 'gpt-4o-mini',
      maxTokens: 150,
      temperature: 0.7,
      priority: 'important',
      operationType: 'content_improvement'
    });

    return (response.response || content).trim();
  }

  private hasEngagingHook(content: string): boolean {
    const hooks = [
      /^(did you know|here's why|the problem with|most people don't realize)/i,
      /\?$/,
      /^(breaking|new study|researchers found)/i
    ];
    
    return hooks.some(hook => hook.test(content));
  }

  private async fixStructuralIssue(content: string, issue: string): Promise<string> {
    // Simplified structural fixes
    if (issue.includes('hook')) {
      return `Did you know that ${content.toLowerCase()}`;
    }
    
    return content;
  }
}