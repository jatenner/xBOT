#!/usr/bin/env node

/**
 * 🧠 REAL-TIME CONTENT LEARNING ENGINE
 * 
 * Actively learns and improves content generation in real-time by:
 * 1. Analyzing every piece of content BEFORE and AFTER posting
 * 2. Learning from engagement patterns immediately
 * 3. Applying learned improvements to the NEXT content generation
 * 4. Building a dynamic content optimization database
 * 5. Continuously evolving content quality without human intervention
 */

import { openaiClient } from '../utils/openaiClient';
import { supabaseClient } from '../utils/supabaseClient';
import { globalContentFilter } from '../utils/globalContentInterceptor';
import { emergencyBudgetLockdown } from '../utils/emergencyBudgetLockdown';

interface ContentLearningData {
  content_id: string;
  original_content: string;
  improved_content?: string;
  content_score: number;
  improvement_actions: string[];
  engagement_prediction: number;
  actual_engagement?: number;
  learning_insights: string[];
  pattern_matches: string[];
  optimization_applied: boolean;
  timestamp: Date;
}

interface ContentPattern {
  pattern_id: string;
  pattern_type: 'viral_hook' | 'engagement_driver' | 'conversion_trigger' | 'human_touch' | 'authority_builder';
  description: string;
  example_content: string;
  success_rate: number;
  avg_engagement_boost: number;
  usage_frequency: number;
  last_used: Date;
  effectiveness_trend: 'improving' | 'stable' | 'declining';
}

export class RealTimeContentLearningEngine {
  private static instance: RealTimeContentLearningEngine | null = null;
  
  private contentHistory: Map<string, ContentLearningData> = new Map();
  private successfulPatterns: Map<string, ContentPattern> = new Map();
  private failedPatterns: Map<string, ContentPattern> = new Map();
  private improvementStrategies: string[] = [];
  private learningEnabled: boolean = true;

  constructor() {
    this.initializeBasePatterns();
    console.log('🧠 Real-Time Content Learning Engine initialized');
    console.log('📈 Active learning and improvement system ready');
  }

  public static getInstance(): RealTimeContentLearningEngine {
    if (!RealTimeContentLearningEngine.instance) {
      RealTimeContentLearningEngine.instance = new RealTimeContentLearningEngine();
    }
    return RealTimeContentLearningEngine.instance;
  }

  /**
   * 🎯 MAIN METHOD: Analyze and improve content in real-time
   */
  async analyzeAndImproveContent(content: string, contentType: string = 'tweet'): Promise<{
    original_content: string;
    improved_content: string;
    improvements_made: string[];
    content_score: number;
    engagement_prediction: number;
    learning_applied: boolean;
  }> {
    try {
      await emergencyBudgetLockdown.enforceBeforeAICall('content-learning');
      
      console.log('🧠 === REAL-TIME CONTENT LEARNING ===');
      console.log(`Analyzing: "${content.substring(0, 80)}..."`);
      
      // 1. Analyze current content quality
      const contentAnalysis = await this.analyzeContentQuality(content);
      
      // 2. Apply learned patterns to improve content
      const improvedContent = await this.applyLearningImprovements(content, contentAnalysis);
      
      // 3. Predict engagement for both versions
      const originalPrediction = await this.predictEngagement(content);
      const improvedPrediction = await this.predictEngagement(improvedContent.content);
      
      // 4. Store learning data
      const learningData: ContentLearningData = {
        content_id: `learning_${Date.now()}`,
        original_content: content,
        improved_content: improvedContent.content,
        content_score: improvedContent.score,
        improvement_actions: improvedContent.improvements,
        engagement_prediction: improvedPrediction,
        learning_insights: improvedContent.insights,
        pattern_matches: improvedContent.patterns_used,
        optimization_applied: true,
        timestamp: new Date()
      };
      
      this.contentHistory.set(learningData.content_id, learningData);
      
      // 5. Apply human filter
      const finalContent = globalContentFilter(improvedContent.content);
      
      console.log(`✅ Content improved: ${contentAnalysis.score}→${improvedContent.score} (+${improvedContent.score - contentAnalysis.score})`);
      console.log(`📈 Engagement prediction: ${originalPrediction.toFixed(1)}%→${improvedPrediction.toFixed(1)}% (+${(improvedPrediction - originalPrediction).toFixed(1)}%)`);
      console.log(`🎯 Improvements: ${improvedContent.improvements.join(', ')}`);
      
      return {
        original_content: content,
        improved_content: finalContent,
        improvements_made: improvedContent.improvements,
        content_score: improvedContent.score,
        engagement_prediction: improvedPrediction,
        learning_applied: true
      };
      
    } catch (error) {
      console.error('❌ Real-time learning error:', error);
      // Return original content if learning fails
      return {
        original_content: content,
        improved_content: globalContentFilter(content),
        improvements_made: [],
        content_score: 50,
        engagement_prediction: 3.0,
        learning_applied: false
      };
    }
  }

  /**
   * 📊 Analyze content quality and identify improvement opportunities
   */
  private async analyzeContentQuality(content: string): Promise<{
    score: number;
    issues: string[];
    opportunities: string[];
    pattern_matches: string[];
  }> {
    const analysis = {
      score: 50,
      issues: [] as string[],
      opportunities: [] as string[],
      pattern_matches: [] as string[]
    };

    // Human authenticity check
    if (content.includes('#')) {
      analysis.issues.push('Contains hashtags (not human-like)');
      analysis.score -= 15;
    } else {
      analysis.score += 10;
      analysis.pattern_matches.push('hashtag-free');
    }

    // Conversational tone check
    if (content.includes("I've") || content.includes("I'm") || content.includes("Been") || content.includes("what I")) {
      analysis.score += 15;
      analysis.pattern_matches.push('conversational-tone');
    } else {
      analysis.opportunities.push('Add personal perspective');
    }

    // Engagement hooks
    if (content.includes('?')) {
      analysis.score += 10;
      analysis.pattern_matches.push('engagement-question');
    } else {
      analysis.opportunities.push('Add engaging question');
    }

    // Data/specificity
    if (/\d+%|\d+x|\$\d+|\d+ years|\d+ hours/.test(content)) {
      analysis.score += 15;
      analysis.pattern_matches.push('specific-data');
    } else {
      analysis.opportunities.push('Add specific data or numbers');
    }

    // Length optimization
    if (content.length > 250) {
      analysis.issues.push('Too long (may get truncated)');
      analysis.score -= 10;
    } else if (content.length < 100) {
      analysis.opportunities.push('Could be more detailed');
    } else {
      analysis.score += 5;
    }

    // Authority indicators
    if (content.includes('research') || content.includes('study') || content.includes('data shows')) {
      analysis.score += 10;
      analysis.pattern_matches.push('authority-building');
    } else {
      analysis.opportunities.push('Add research backing');
    }

    // Avoid robotic language
    if (content.includes('BREAKING:') || content.includes('Key takeaway:') || content.includes('🚨')) {
      analysis.issues.push('Contains robotic marketing language');
      analysis.score -= 20;
    }

    return analysis;
  }

  /**
   * 🚀 Apply learned patterns to improve content
   */
  private async applyLearningImprovements(content: string, analysis: any): Promise<{
    content: string;
    score: number;
    improvements: string[];
    insights: string[];
    patterns_used: string[];
  }> {
    let improvedContent = content;
    const improvements: string[] = [];
    const insights: string[] = [];
    const patternsUsed: string[] = [];
    let score = analysis.score;

    // Get best performing patterns
    const topPatterns = Array.from(this.successfulPatterns.values())
      .filter(p => p.success_rate > 70)
      .sort((a, b) => b.avg_engagement_boost - a.avg_engagement_boost)
      .slice(0, 5);

    // Apply improvements based on learned patterns
    const improvementPrompt = `Improve this content using proven engagement patterns:

Original content: "${content}"

Issues to fix: ${analysis.issues.join(', ') || 'None'}
Opportunities: ${analysis.opportunities.join(', ') || 'Already optimized'}

Apply these proven patterns:
${topPatterns.map(p => `- ${p.description}: ${p.example_content}`).join('\n')}

Improvement requirements:
1. NEVER use hashtags (proven to reduce authenticity)
2. Add personal perspective ("I've noticed", "Been tracking", "In my experience")
3. Include specific data or timeframes
4. Add engaging question at the end
5. Keep conversational and human-like
6. Maintain professional credibility
7. Stay under 250 characters
8. Remove any robotic marketing language

Return only the improved content, nothing else.`;

    const improvedResponse = await openaiClient.generateCompletion(improvementPrompt, {
      maxTokens: 150,
      temperature: 0.7
    });

    if (improvedResponse && improvedResponse.trim() !== content) {
      improvedContent = improvedResponse.trim();
      improvements.push('Applied learned engagement patterns');
      score += 20;
      patternsUsed.push('learned-optimization');
    }

    // Remove hashtags if any remain
    if (improvedContent.includes('#')) {
      improvedContent = improvedContent.replace(/#\w+/g, '').replace(/\s+/g, ' ').trim();
      improvements.push('Removed hashtags for authenticity');
      score += 10;
    }

    // Ensure human voice
    if (!improvedContent.includes("I") && !improvedContent.includes("Been") && !improvedContent.includes("what")) {
      // Add personal touch
      const personalStarters = ["I've been tracking this:", "Been noticing:", "What I find interesting:"];
      const randomStarter = personalStarters[Math.floor(Math.random() * personalStarters.length)];
      improvedContent = `${randomStarter} ${improvedContent}`;
      improvements.push('Added personal perspective');
      score += 15;
      patternsUsed.push('human-voice');
    }

    // Add question if missing
    if (!improvedContent.includes('?')) {
      const questions = [
        "What's your take?",
        "Thoughts?",
        "Anyone else seeing this?",
        "What do you think?",
        "Am I missing something?"
      ];
      const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
      improvedContent = `${improvedContent} ${randomQuestion}`;
      improvements.push('Added engagement question');
      score += 10;
      patternsUsed.push('engagement-driver');
    }

    // Learning insights
    insights.push(`Applied ${patternsUsed.length} successful patterns`);
    insights.push(`Content score improved: ${analysis.score}→${score}`);
    if (improvements.length > 0) {
      insights.push(`Improvements: ${improvements.join(', ')}`);
    }

    return {
      content: improvedContent,
      score: Math.min(100, score),
      improvements,
      insights,
      patterns_used: patternsUsed
    };
  }

  /**
   * 📈 Predict engagement based on learned patterns
   */
  private async predictEngagement(content: string): Promise<number> {
    let baseScore = 3.0; // Base engagement rate

    // Apply learned multipliers
    if (!content.includes('#')) baseScore += 1.5; // Hashtag-free bonus
    if (content.includes('?')) baseScore += 1.0; // Question bonus
    if (/\d+%|\d+x|\$\d+/.test(content)) baseScore += 1.2; // Data bonus
    if (content.includes("I've") || content.includes("Been")) baseScore += 0.8; // Personal bonus
    if (content.length > 100 && content.length < 200) baseScore += 0.5; // Length bonus

    // Pattern bonuses from successful patterns
    for (const pattern of this.successfulPatterns.values()) {
      if (pattern.success_rate > 80 && content.toLowerCase().includes(pattern.description.toLowerCase())) {
        baseScore += pattern.avg_engagement_boost;
      }
    }

    return Math.min(12.0, baseScore); // Cap at 12% engagement rate
  }

  /**
   * 📊 Learn from posted content performance
   */
  async learnFromPerformance(contentId: string, actualEngagement: {
    likes: number;
    retweets: number;
    replies: number;
    impressions?: number;
  }): Promise<void> {
    try {
      const learningData = this.contentHistory.get(contentId);
      if (!learningData) return;

      // Calculate actual engagement rate
      const totalEngagement = actualEngagement.likes + actualEngagement.retweets + (actualEngagement.replies * 2);
      const engagementRate = actualEngagement.impressions 
        ? (totalEngagement / actualEngagement.impressions) * 100
        : totalEngagement * 0.1; // Estimate if impressions not available

      learningData.actual_engagement = engagementRate;

      // Learn from performance
      if (engagementRate > learningData.engagement_prediction * 1.2) {
        // Great performance - strengthen patterns
        await this.strengthenSuccessfulPatterns(learningData);
        console.log(`🔥 High performance: ${engagementRate.toFixed(1)}% engagement - learning from success!`);
      } else if (engagementRate < learningData.engagement_prediction * 0.6) {
        // Poor performance - mark patterns to avoid
        await this.markFailedPatterns(learningData);
        console.log(`⚠️ Low performance: ${engagementRate.toFixed(1)}% engagement - learning from failure`);
      }

      // Update learning insights
      learningData.learning_insights.push(`Actual engagement: ${engagementRate.toFixed(1)}% (predicted: ${learningData.engagement_prediction.toFixed(1)}%)`);
      
      // Store performance data for future learning
      await this.storePerformanceLearning(learningData, engagementRate);

    } catch (error) {
      console.error('❌ Error learning from performance:', error);
    }
  }

  /**
   * 🎯 Get current learning insights for content generation
   */
  getOptimizationStrategy(): {
    successful_patterns: string[];
    failed_patterns: string[];
    improvement_strategies: string[];
    engagement_boosters: string[];
    content_guidelines: string[];
  } {
    const successful = Array.from(this.successfulPatterns.values())
      .filter(p => p.success_rate > 70)
      .sort((a, b) => b.avg_engagement_boost - a.avg_engagement_boost)
      .slice(0, 5);

    const failed = Array.from(this.failedPatterns.values())
      .slice(0, 3);

    return {
      successful_patterns: successful.map(p => p.description),
      failed_patterns: failed.map(p => p.description),
      improvement_strategies: this.improvementStrategies,
      engagement_boosters: [
        'Add personal perspective ("I\'ve noticed", "Been tracking")',
        'Include specific data and numbers',
        'Ask engaging questions',
        'Remove all hashtags',
        'Keep conversational tone',
        'Add research backing'
      ],
      content_guidelines: [
        'NEVER use hashtags',
        'Always sound human and conversational',
        'Include personal opinions and observations',
        'Back claims with data when possible',
        'End with engaging questions',
        'Keep under 250 characters',
        'Avoid robotic marketing language'
      ]
    };
  }

  /**
   * 📈 Initialize base successful patterns from your existing data
   */
  private initializeBasePatterns(): void {
    // Based on your human-style tweets that performed well
    this.successfulPatterns.set('human_observation', {
      pattern_id: 'human_observation',
      pattern_type: 'human_touch',
      description: 'Personal observation pattern',
      example_content: 'I keep noticing this pattern in healthcare AI...',
      success_rate: 95,
      avg_engagement_boost: 2.5,
      usage_frequency: 0,
      last_used: new Date(),
      effectiveness_trend: 'improving'
    });

    this.successfulPatterns.set('tracking_trend', {
      pattern_id: 'tracking_trend',
      pattern_type: 'authority_builder',
      description: 'Trend tracking pattern',
      example_content: 'Been tracking this trend: AI-assisted diagnostics are showing...',
      success_rate: 90,
      avg_engagement_boost: 2.0,
      usage_frequency: 0,
      last_used: new Date(),
      effectiveness_trend: 'improving'
    });

    this.successfulPatterns.set('no_hashtags', {
      pattern_id: 'no_hashtags',
      pattern_type: 'human_touch',
      description: 'Hashtag-free content',
      example_content: 'Content without any hashtags for authenticity',
      success_rate: 100,
      avg_engagement_boost: 1.5,
      usage_frequency: 0,
      last_used: new Date(),
      effectiveness_trend: 'stable'
    });

    // Patterns to avoid (based on poor performance)
    this.failedPatterns.set('hashtag_heavy', {
      pattern_id: 'hashtag_heavy',
      pattern_type: 'engagement_driver',
      description: 'Multiple hashtags',
      example_content: 'Content with #AI #HealthTech #Innovation hashtags',
      success_rate: 10,
      avg_engagement_boost: -1.0,
      usage_frequency: 0,
      last_used: new Date(),
      effectiveness_trend: 'declining'
    });

    this.failedPatterns.set('robotic_language', {
      pattern_id: 'robotic_language',
      pattern_type: 'viral_hook',
      description: 'Marketing language',
      example_content: 'BREAKING: Key takeaway: Industry insight:',
      success_rate: 15,
      avg_engagement_boost: -0.8,
      usage_frequency: 0,
      last_used: new Date(),
      effectiveness_trend: 'declining'
    });

    console.log('📊 Initialized base learning patterns');
    console.log(`✅ ${this.successfulPatterns.size} successful patterns loaded`);
    console.log(`❌ ${this.failedPatterns.size} failed patterns to avoid`);
  }

  private async strengthenSuccessfulPatterns(learningData: ContentLearningData): Promise<void> {
    // Strengthen patterns that led to success
    for (const patternId of learningData.pattern_matches) {
      const pattern = this.successfulPatterns.get(patternId);
      if (pattern) {
        pattern.success_rate = Math.min(100, pattern.success_rate + 2);
        pattern.avg_engagement_boost += 0.1;
        pattern.effectiveness_trend = 'improving';
        pattern.last_used = new Date();
      }
    }
  }

  private async markFailedPatterns(learningData: ContentLearningData): Promise<void> {
    // Learn from patterns that didn't work
    for (const patternId of learningData.pattern_matches) {
      const pattern = this.successfulPatterns.get(patternId);
      if (pattern) {
        pattern.success_rate = Math.max(0, pattern.success_rate - 5);
        pattern.effectiveness_trend = 'declining';
        
        // Move to failed patterns if success rate drops too low
        if (pattern.success_rate < 30) {
          this.failedPatterns.set(patternId, pattern);
          this.successfulPatterns.delete(patternId);
        }
      }
    }
  }

  private async storePerformanceLearning(learningData: ContentLearningData, engagementRate: number): Promise<void> {
    try {
      // Store in database for persistent learning
      await supabaseClient.supabase?.from('bot_config').upsert({
        key: `content_learning_${learningData.content_id}`,
        value: {
          ...learningData,
          actual_engagement: engagementRate
        },
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Failed to store learning data:', error);
    }
  }
} 