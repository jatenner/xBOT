/**
 * 🚀 ENHANCED POSTING ORCHESTRATOR
 * Maximum OpenAI utilization with learning system integration
 * 
 * GOAL: Elite tweets that learn and improve continuously
 */

import { getOpenAIService } from '../services/openAIService';
import { getUnifiedDataManager } from '../lib/unifiedDataManager';
import { getContentQualityEnhancer } from '../ai/qualityEnhancer';
import { getGrowthAccelerationEngine } from '../ai/growthAccelerationEngine';
import { getOutcomeLearningEngine } from '../intelligence/outcomeLearningEngine';
import { getEnhancedMetricsCollector } from '../intelligence/enhancedMetricsCollector';
import { getPerformancePredictionEngine } from '../intelligence/performancePredictionEngine';
import { getAdvancedAIOrchestrator } from '../ai/advancedAIOrchestrator';
import { getViralTrendMonitor } from '../intelligence/viralTrendMonitor';
import { getAIContentDecisionEngine } from '../ai/aiContentDecisionEngine';
import { getPerformanceFeedbackPipeline } from '../intelligence/performanceFeedbackPipeline';

interface ElitePostRequest {
  topic?: string;
  urgency: 'low' | 'medium' | 'high' | 'viral';
  audience_analysis: any;
  recent_performance: any;
  learning_insights: any;
}

interface ElitePostResult {
  content: string;
  predicted_engagement: number;
  viral_probability: number;
  quality_score: number;
  learning_applied: string[];
  openai_reasoning: string;
}

export class EnhancedPostingOrchestrator {
  private static instance: EnhancedPostingOrchestrator;
  private openaiService = getOpenAIService();
  private dataManager = getUnifiedDataManager();
  private qualityEnhancer = getContentQualityEnhancer();
  private learningEngine = getOutcomeLearningEngine();
  private metricsCollector = getEnhancedMetricsCollector();
  private predictionEngine = getPerformancePredictionEngine();
  private advancedAI = getAdvancedAIOrchestrator();
  private trendMonitor = getViralTrendMonitor();
  private aiDecisionEngine = getAIContentDecisionEngine();
  private feedbackPipeline = getPerformanceFeedbackPipeline();

  private constructor() {}

  public static getInstance(): EnhancedPostingOrchestrator {
    if (!EnhancedPostingOrchestrator.instance) {
      EnhancedPostingOrchestrator.instance = new EnhancedPostingOrchestrator();
    }
    return EnhancedPostingOrchestrator.instance;
  }

  /**
   * 🎯 CREATE ELITE TWEET
   * Maximum OpenAI utilization with full learning integration
   */
  public async createEliteTweet(request: ElitePostRequest): Promise<ElitePostResult> {
    console.log('🎯 ENHANCED_ORCHESTRATOR: Creating elite tweet with maximum AI utilization...');

    try {
      // Step 1: Gather comprehensive learning data
      const learningContext = await this.gatherLearningContext();
      
      // Step 2: Analyze current performance patterns
      const performanceAnalysis = await this.analyzeCurrentPerformance();
      
      // Step 3: Generate elite content with OpenAI
      const eliteContent = await this.generateEliteContent(request, learningContext, performanceAnalysis);
      
      // Step 4: Apply quality enhancements
      const qualityEnhanced = await this.qualityEnhancer.enhanceContent(eliteContent.content, eliteContent.strategy);
      
      // Step 5: Predict performance with OpenAI
      const performancePrediction = await this.predictPerformance(qualityEnhanced.enhancedContent, learningContext);
      
      // Step 6: Final optimization pass
      const finalOptimized = await this.finalOptimizationPass(qualityEnhanced.enhancedContent, performancePrediction);

      return {
        content: finalOptimized.content,
        predicted_engagement: performancePrediction.engagement,
        viral_probability: performancePrediction.viral_probability,
        quality_score: qualityEnhanced.qualityScore.overallQuality,
        learning_applied: finalOptimized.learning_applied,
        openai_reasoning: finalOptimized.reasoning
      };

    } catch (error: any) {
      console.error('❌ ENHANCED_ORCHESTRATOR: Elite tweet creation failed:', error.message);
      throw error;
    }
  }

  /**
   * 🧠 GATHER LEARNING CONTEXT
   * Pull all learning data for AI context
   */
  private async gatherLearningContext(): Promise<any> {
    console.log('🧠 ENHANCED_ORCHESTRATOR: Gathering comprehensive learning context...');

    try {
      // Get recent posts and their performance
      const recentPosts = await this.dataManager.getPostPerformance(7);
      
      // Get AI decisions and outcomes
      const aiDecisions = await this.dataManager.getAIDecisions(7);
      
      // Get learning engine insights
      const learningStatus = this.learningEngine.getLearningStatus();
      
      // Get optimal posting parameters
      const optimalFrequency = await this.dataManager.getOptimalPostingFrequency();
      const optimalTimes = await this.dataManager.getOptimalPostingTimes();

      return {
        recent_posts: recentPosts.slice(0, 10), // Last 10 posts
        top_performing: recentPosts.filter(p => p.followersAttributed > 0).slice(0, 5),
        worst_performing: recentPosts.filter(p => p.likes + p.retweets < 5).slice(0, 3),
        ai_decisions: aiDecisions.slice(0, 5),
        learning_patterns: learningStatus,
        optimal_frequency: optimalFrequency,
        optimal_times: optimalTimes,
        total_data_points: recentPosts.length
      };

    } catch (error: any) {
      console.error('❌ Learning context gathering failed:', error.message);
      return { total_data_points: 0 };
    }
  }

  /**
   * 📊 ANALYZE CURRENT PERFORMANCE
   * Use OpenAI to analyze what's working
   */
  private async analyzeCurrentPerformance(): Promise<any> {
    console.log('📊 ENHANCED_ORCHESTRATOR: Analyzing performance patterns with AI...');

    try {
      const recentPosts = await this.dataManager.getPostPerformance(14); // 2 weeks

      const analysisPrompt = `Analyze these Twitter health content performance patterns:

RECENT POSTS DATA:
${recentPosts.map(p => `
Post: "${p.content.substring(0, 100)}..."
Engagement: ${p.likes + p.retweets + p.replies} (${p.likes}L, ${p.retweets}RT, ${p.replies}R)
Followers: +${p.followersAttributed}
Length: ${p.contentLength} chars
Time: ${new Date(p.postedAt).getHours()}:00
`).join('\n')}

ANALYSIS TASK:
1. What content patterns drive highest engagement?
2. What timing patterns work best?
3. What content formats (length, style) perform?
4. What topics resonate most with audience?
5. What mistakes to avoid based on low performers?

Return JSON with specific, actionable insights:
{
  "high_performing_patterns": ["pattern1", "pattern2"],
  "optimal_content_length": number,
  "best_posting_hours": [numbers],
  "top_topics": ["topic1", "topic2"],
  "engagement_drivers": ["driver1", "driver2"],
  "avoid_patterns": ["pattern1", "pattern2"],
  "follower_acquisition_tactics": ["tactic1", "tactic2"],
  "recommendations": ["specific actionable advice"]
}`;

      const response = await this.openaiService.chatCompletion([
        {
          role: 'system',
          content: 'You are an expert Twitter growth analyst specializing in health content. Analyze data patterns to provide specific, actionable insights for content optimization.'
        },
        {
          role: 'user',
          content: analysisPrompt
        }
      ], {
        model: 'gpt-4o',
        temperature: 0.2,
        maxTokens: 1500,
        requestType: 'performance_analysis',
        priority: 'high'
      });

      let rawContent = response.choices[0]?.message?.content || '{}';
      
      // Clean up markdown code blocks if present
      if (rawContent.includes('```json')) {
        rawContent = rawContent.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
      }
      
      const analysis = JSON.parse(rawContent);
      console.log('✅ PERFORMANCE_ANALYSIS: Generated insights from', recentPosts.length, 'posts');
      
      return analysis;

    } catch (error: any) {
      console.error('❌ Performance analysis failed:', error.message);
      return { recommendations: ['Focus on engagement and followers'] };
    }
  }

  /**
   * 🎨 GENERATE ELITE CONTENT
   * Maximum OpenAI utilization for content creation with growth acceleration
   */
  private async generateEliteContent(
    request: ElitePostRequest,
    learningContext: any,
    performanceAnalysis: any
  ): Promise<{ content: string; strategy: string; reasoning: string }> {
    console.log('🎨 ENHANCED_ORCHESTRATOR: Generating elite content with full AI power...');

    // 🚀 GROWTH ACCELERATION: Check if we should use advanced tactics
    const growthEngine = getGrowthAccelerationEngine();
    const nextAction = await growthEngine.getNextGrowthAction();
    
    console.log(`🚀 GROWTH_ACTION: ${nextAction.action} (${nextAction.priority} priority)`);
    
    // Apply growth acceleration based on current phase
    if (nextAction.action === 'Generate contrarian content' && nextAction.priority === 'high') {
      console.log('🔥 ENHANCED_ORCHESTRATOR: Applying contrarian content strategy...');
      const contrarianContent = await growthEngine.generateContrarianContent('health optimization');
      
      // Use contrarian approach in content generation
      if (contrarianContent.controversyLevel >= 6) {
        request.urgency = 'viral';
        console.log(`💥 CONTROVERSY_BOOST: Level ${contrarianContent.controversyLevel}/10 - upgrading to viral urgency`);
      }
    }

    const elitePrompt = `Create an elite Twitter post for health optimization account @SignalAndSynapse.

LEARNING CONTEXT:
- Recent performance data: ${learningContext.total_data_points} posts analyzed
- Top performers: ${learningContext.top_performing?.map(p => `${p.likes + p.retweets} eng`).join(', ')}
- Optimal frequency: ${learningContext.optimal_frequency?.optimalFrequency}/day
- Best times: ${learningContext.optimal_times?.join(', ')}

PERFORMANCE INSIGHTS:
- High-performing patterns: ${performanceAnalysis.high_performing_patterns?.join(', ')}
- Optimal length: ${performanceAnalysis.optimal_content_length} chars
- Top topics: ${performanceAnalysis.top_topics?.join(', ')}
- Engagement drivers: ${performanceAnalysis.engagement_drivers?.join(', ')}
- Avoid: ${performanceAnalysis.avoid_patterns?.join(', ')}

REQUIREMENTS:
1. Apply learned patterns from top performers
2. Use optimal content length (${performanceAnalysis.optimal_content_length || 250} chars)
3. Include engagement drivers
4. Avoid failed patterns
5. Target: health professionals, biohackers, optimization enthusiasts
6. Goal: Maximize followers + engagement

CONTENT SPECIFICATIONS:
- Hook: Use varied opener (NOT "🚨 BREAKING")
- Authority: Include specific study/source
- Value: Actionable insight or surprising fact
- Engagement: Clear question or call-to-action
- Personality: Unique perspective or contrarian view

URGENCY LEVEL: ${request.urgency}

Return JSON:
{
  "content": "optimized tweet content",
  "strategy": "content strategy used",
  "reasoning": "why this approach will work",
  "learning_applied": ["insight1", "insight2"],
  "predicted_performance": {
    "engagement_score": 0.8,
    "viral_probability": 0.6,
    "follower_potential": 0.7
  }
}`;

    try {
      const response = await this.openaiService.chatCompletion([
        {
          role: 'system',
          content: 'You are an elite Twitter content strategist specializing in health optimization. Create viral, high-engagement content that drives followers using data-driven insights.'
        },
        {
          role: 'user',
          content: elitePrompt
        }
      ], {
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 2000,
        requestType: 'elite_content_generation',
        priority: 'high'
      });

      let rawContent = response.choices[0]?.message?.content || '{}';
      
      // Clean up markdown code blocks if present
      if (rawContent.includes('```json')) {
        rawContent = rawContent.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
      }
      
      const result = JSON.parse(rawContent);
      console.log('✅ ELITE_CONTENT: Generated with strategy:', result.strategy);
      
      return {
        content: result.content || 'Elite content generation failed',
        strategy: result.strategy || 'fallback',
        reasoning: result.reasoning || 'AI reasoning unavailable'
      };

    } catch (error: any) {
      console.error('❌ Elite content generation failed:', error.message);
      throw error;
    }
  }

  /**
   * 🔮 PREDICT PERFORMANCE
   * Use enhanced prediction engine with real data patterns
   */
  private async predictPerformance(content: string, learningContext: any): Promise<{
    engagement: number;
    viral_probability: number;
    follower_potential: number;
    confidence: number;
  }> {
    console.log('🔮 ENHANCED_ORCHESTRATOR: Predicting performance with enhanced AI...');

    try {
      // Use new performance prediction engine
      const predictionEngine = getPerformancePredictionEngine();
      const prediction = await predictionEngine.predictPerformance(content);
      
      console.log(`🎯 PREDICTION: ${prediction.predictedLikes} likes, ${(prediction.viralProbability * 100).toFixed(1)}% viral probability`);
      console.log(`💡 SUGGESTIONS: ${prediction.optimizationSuggestions.join(', ')}`);
      
      return {
        engagement: prediction.predictedLikes + prediction.predictedReplies + prediction.predictedRetweets,
        viral_probability: prediction.viralProbability,
        follower_potential: prediction.predictedFollowerGrowth,
        confidence: prediction.confidence
      };
    } catch (error: any) {
      console.warn('⚠️ Enhanced prediction failed, using fallback:', error.message);

      // Fallback to basic prediction
      return {
        engagement: 1.0,
        viral_probability: 0.1,
        follower_potential: 0.3,
        confidence: 0.3
      };
    }
  }

  /**
   * ✨ FINAL OPTIMIZATION PASS
   * Last AI enhancement before posting
   */
  private async finalOptimizationPass(
    content: string,
    prediction: any
  ): Promise<{ content: string; learning_applied: string[]; reasoning: string }> {
    console.log('✨ ENHANCED_ORCHESTRATOR: Final optimization with AI...');

    // If prediction scores are low, try to improve
    if (prediction.engagement < 0.7 || prediction.viral_probability < 0.5) {
      console.log('🔧 Performance prediction low, applying AI optimization...');

      const optimizationPrompt = `Optimize this tweet for maximum engagement and viral potential:

CURRENT CONTENT: "${content}"

PREDICTED PERFORMANCE:
- Engagement: ${prediction.engagement}/1.0
- Viral probability: ${prediction.viral_probability}/1.0
- Follower potential: ${prediction.follower_potential}/1.0

OPTIMIZATION GOALS:
1. Increase engagement to 0.8+
2. Increase viral probability to 0.6+
3. Maintain health optimization focus
4. Keep under 280 characters
5. Add specific, surprising element
6. Include strong call-to-action

Apply these improvements:
- Stronger hook (curiosity/surprise)
- More specific data/numbers
- Better engagement trigger
- Controversial but evidence-based angle
- Personal story element if possible

Return optimized version:
{
  "optimized_content": "improved tweet",
  "improvements_made": ["improvement1", "improvement2"],
  "reasoning": "why this will perform better"
}`;

      try {
        const response = await this.openaiService.chatCompletion([
          {
            role: 'system',
            content: 'You are a viral content optimizer. Take good content and make it exceptional for maximum engagement and follower growth.'
          },
          {
            role: 'user',
            content: optimizationPrompt
          }
        ], {
          model: 'gpt-4o',
          temperature: 0.6,
          maxTokens: 1000,
          requestType: 'content_optimization',
          priority: 'high'
        });

        let rawContent = response.choices[0]?.message?.content || '{}';
        
        // Clean up markdown code blocks if present
        if (rawContent.includes('```json')) {
          rawContent = rawContent.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
        }
        
        const optimization = JSON.parse(rawContent);
        console.log('✅ FINAL_OPTIMIZATION: Applied', optimization.improvements_made?.length || 0, 'improvements');
        
        return {
          content: optimization.optimized_content || content,
          learning_applied: optimization.improvements_made || [],
          reasoning: optimization.reasoning || 'Optimization applied'
        };

      } catch (error: any) {
        console.error('❌ Final optimization failed:', error.message);
        return {
          content,
          learning_applied: [],
          reasoning: 'Optimization failed, using original'
        };
      }
    }

    return {
      content,
      learning_applied: ['High prediction scores - no optimization needed'],
      reasoning: 'Content already optimized for high performance'
    };
  }

  /**
   * 🎯 CREATE SMART REPLY
   * AI-powered reply generation with learning
   */
  public async createSmartReply(
    originalTweet: string,
    context: string,
    objective: 'engage' | 'educate' | 'viral'
  ): Promise<{ reply: string; strategy: string; reasoning: string }> {
    console.log('🎯 ENHANCED_ORCHESTRATOR: Creating smart reply with AI...');

    const replyPrompt = `Create a smart reply for @SignalAndSynapse (health optimization account):

ORIGINAL TWEET: "${originalTweet}"

CONTEXT: ${context}

OBJECTIVE: ${objective}

REPLY REQUIREMENTS:
1. Add unique value (don't just agree)
2. Include health optimization angle
3. Use evidence/data if possible
4. Build authority and credibility
5. Encourage further engagement
6. Under 280 characters
7. Professional but personable tone

STRATEGY OPTIONS:
- "Supportive Expert": Add complementary insight
- "Evidence Provider": Share relevant study/data
- "Contrarian Thought": Respectful alternative view
- "Practical Application": How to implement the idea
- "Personal Experience": "In my work with clients..."

Return JSON:
{
  "reply": "optimized reply content",
  "strategy": "strategy used",
  "reasoning": "why this approach works",
  "follow_up_potential": "how this could lead to more engagement"
}`;

    try {
      const response = await this.openaiService.chatCompletion([
        {
          role: 'system',
          content: 'You are an expert at creating engaging Twitter replies that build authority in health optimization while driving meaningful conversations.'
        },
        {
          role: 'user',
          content: replyPrompt
        }
      ], {
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 800,
        requestType: 'smart_reply_generation',
        priority: 'medium'
      });

      let rawContent = response.choices[0]?.message?.content || '{}';
      
      // Clean up markdown code blocks if present
      if (rawContent.includes('```json')) {
        rawContent = rawContent.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
      }
      
      const result = JSON.parse(rawContent);
      console.log('✅ SMART_REPLY: Generated with strategy:', result.strategy);
      
      return {
        reply: result.reply || 'Great point! Health optimization is key.',
        strategy: result.strategy || 'supportive',
        reasoning: result.reasoning || 'AI-generated reply'
      };

    } catch (error: any) {
      console.error('❌ Smart reply generation failed:', error.message);
      return {
        reply: 'Interesting perspective! Health optimization requires this kind of thinking.',
        strategy: 'fallback',
        reasoning: 'Fallback reply due to AI error'
      };
    }
  }

  /**
   * 📊 COLLECT ENHANCED METRICS
   * Collect detailed performance data for learning
   */
  public async collectEnhancedMetrics(postId: string, content: string, initialMetrics: any): Promise<void> {
    console.log(`📊 ENHANCED_ORCHESTRATOR: Collecting enhanced metrics for ${postId}...`);

    try {
      // Collect detailed metrics using the enhanced collector
      const detailedMetrics = await this.metricsCollector.collectDetailedMetrics(postId, content, initialMetrics);
      
      // Get optimization recommendations for future posts
      const recommendations = await this.metricsCollector.getOptimizationRecommendations(content);
      
      console.log(`✅ ENHANCED_METRICS: Collected ${Object.keys(detailedMetrics).length} data points`);
      console.log(`💡 RECOMMENDATIONS: ${recommendations.recommendations.join(', ')}`);
      
      // Store insights for future content generation
      // Note: OutcomeLearningEngine processes automatically, we just trigger learning cycle
      await this.learningEngine.completeLearningCycle();
      
    } catch (error: any) {
      console.error('❌ Enhanced metrics collection failed:', error.message);
    }
  }

  /**
   * 🤖 CREATE VIRAL CONTENT WITH ADVANCED AI
   * Use multi-model AI orchestration for elite content
   */
  public async createViralContent(
    topic: string,
    urgency: 'immediate' | 'high' | 'medium' = 'high'
  ): Promise<{
    content: string;
    viral_probability: number;
    confidence: number;
    emotional_triggers: string[];
    model_contributions: string[];
    optimization_applied: string[];
  }> {
    console.log(`🤖 ENHANCED_ORCHESTRATOR: Creating viral content with advanced AI for ${topic}...`);

    try {
      // Gather context for AI orchestration
      const learningContext = await this.gatherLearningContext();
      const performanceAnalysis = await this.analyzeCurrentPerformance();
      
      // Use advanced AI orchestrator for multi-model content creation
      const advancedContent = await this.advancedAI.createEliteContent(
        topic,
        {
          audience_size: 25,
          recent_performance: performanceAnalysis,
          learning_insights: learningContext,
          account_voice: 'health optimization expert',
          target_demographic: 'health enthusiasts, biohackers, optimization seekers'
        },
        {
          urgency,
          viral_threshold: 0.7, // 70% viral probability minimum
          engagement_target: 'maximize',
          follower_growth: 'prioritize'
        }
      );

      console.log(`🚀 VIRAL_CONTENT: Generated with ${(advancedContent.viral_probability * 100).toFixed(1)}% viral probability`);
      console.log(`💝 EMOTIONAL_TRIGGERS: ${advancedContent.emotional_triggers.join(', ')}`);
      console.log(`🤖 MODEL_CONTRIBUTIONS: ${advancedContent.model_contributions.join(', ')}`);

      return {
        content: advancedContent.content,
        viral_probability: advancedContent.viral_probability,
        confidence: advancedContent.confidence,
        emotional_triggers: advancedContent.emotional_triggers,
        model_contributions: advancedContent.model_contributions,
        optimization_applied: [advancedContent.reasoning]
      };
    } catch (error: any) {
      console.error('❌ Advanced viral content creation failed:', error.message);
      
      // Fallback to standard elite content
      const fallbackRequest: ElitePostRequest = {
        topic,
        urgency: urgency === 'immediate' ? 'viral' : 'high',
        audience_analysis: {},
        recent_performance: {},
        learning_insights: {}
      };
      
      const fallbackContent = await this.createEliteTweet(fallbackRequest);
      
      return {
        content: fallbackContent.content,
        viral_probability: fallbackContent.viral_probability,
        confidence: fallbackContent.quality_score,
        emotional_triggers: ['curiosity'],
        model_contributions: ['Fallback Generator'],
        optimization_applied: ['Fallback due to advanced AI failure']
      };
    }
  }

  /**
   * 📈 START VIRAL TREND MONITORING
   * Begin real-time monitoring for viral opportunities
   */
  public async startViralMonitoring(): Promise<void> {
    console.log('📈 ENHANCED_ORCHESTRATOR: Starting viral trend monitoring...');
    
    try {
      await this.trendMonitor.startMonitoring();
      console.log('✅ VIRAL_MONITORING: Real-time trend monitoring active');
    } catch (error: any) {
      console.error('❌ Viral monitoring failed to start:', error.message);
    }
  }

  /**
   * 🛑 STOP VIRAL TREND MONITORING
   */
  public stopViralMonitoring(): void {
    console.log('🛑 ENHANCED_ORCHESTRATOR: Stopping viral trend monitoring...');
    this.trendMonitor.stopMonitoring();
  }

  /**
   * 📊 GET VIRAL MONITORING STATUS
   */
  public getViralMonitoringStatus(): any {
    return this.trendMonitor.getStatus();
  }

  /**
   * 🤖 CREATE FULLY AI-DRIVEN CONTENT
   * Maximum OpenAI utilization - AI makes EVERY decision
   */
  public async createFullyAIDrivenContent(
    initialTopic?: string,
    urgency: 'immediate' | 'high' | 'medium' = 'high'
  ): Promise<{
    content: string;
    ai_decisions_made: number;
    decision_breakdown: any;
    performance_prediction: any;
    feedback_applied: string[];
    confidence: number;
  }> {
    console.log('🤖 ENHANCED_ORCHESTRATOR: Creating fully AI-driven content with maximum OpenAI utilization...');

    try {
      // Step 1: Get performance feedback to guide AI decisions
      const feedbackReport = await this.feedbackPipeline.generateComprehensiveFeedbackReport(14);
      console.log(`📊 FEEDBACK: Applied insights from ${feedbackReport.successful_patterns.length} successful patterns`);

      // Step 2: AI makes ALL content decisions (8-12 OpenAI calls)
      const contentPlan = await this.aiDecisionEngine.createComprehensiveContentPlan(
        initialTopic,
        {
          feedback_insights: feedbackReport,
          recent_performance: feedbackReport.overall_performance,
          audience_preferences: feedbackReport.audience_insights
        }
      );

      console.log(`🧠 AI_DECISIONS: Made ${contentPlan.total_ai_calls} AI decisions with ${contentPlan.decision_confidence}% confidence`);

      // Step 3: Generate content using AI plan + advanced orchestrator
      const aiContent = await this.advancedAI.createEliteContent(
        contentPlan.topic,
        {
          ai_content_plan: contentPlan,
          voice_adaptation: contentPlan.voice_adaptation,
          formatting_requirements: contentPlan.formatting_style,
          target_length: contentPlan.target_length,
          controversy_level: contentPlan.controversy_level
        },
        {
          urgency,
          viral_threshold: 0.7,
          hook_type: contentPlan.hook_type,
          format: contentPlan.content_format
        }
      );

      // Step 4: Apply AI-driven formatting based on decisions
      const formattedContent = await this.applyAIFormattingDecisions(
        aiContent.content,
        contentPlan.formatting_style
      );

      // Step 5: Final AI optimization based on predictions
      const finalContent = contentPlan.expected_performance.viral_probability < 0.6
        ? await this.aiOptimizeUnderperformingContent(formattedContent, contentPlan)
        : formattedContent;

      console.log(`✅ FULLY_AI_DRIVEN: Content created with ${contentPlan.total_ai_calls + 4} total AI decisions`);
      console.log(`🎯 PREDICTED_VIRAL: ${(contentPlan.expected_performance.viral_probability * 100).toFixed(1)}%`);
      console.log(`📈 APPLIED_INSIGHTS: ${feedbackReport.content_recommendations.length} feedback insights`);

      return {
        content: finalContent,
        ai_decisions_made: contentPlan.total_ai_calls + 4,
        decision_breakdown: {
          topic_decision: contentPlan.topic_reasoning,
          hook_decision: contentPlan.hook_decision,
          format_decision: contentPlan.format_decision,
          controversy_decision: contentPlan.controversy_decision,
          length_decision: contentPlan.length_decision,
          formatting_decision: contentPlan.formatting_decision,
          timing_decision: contentPlan.timing_decision,
          voice_decision: contentPlan.voice_decision
        },
        performance_prediction: contentPlan.expected_performance,
        feedback_applied: feedbackReport.content_recommendations.slice(0, 3),
        confidence: contentPlan.decision_confidence / 100
      };

    } catch (error: any) {
      console.error('❌ Fully AI-driven content creation failed:', error.message);
      
      // Fallback to advanced AI without full decision engine
      const fallbackContent = await this.createViralContent(initialTopic || 'health optimization', urgency);
      
      return {
        content: fallbackContent.content,
        ai_decisions_made: 3,
        decision_breakdown: { fallback: 'Used advanced AI fallback' },
        performance_prediction: {
          viral_probability: fallbackContent.viral_probability,
          engagement_score: 0.6,
          follower_potential: 0.5
        },
        feedback_applied: ['Fallback mode - limited feedback applied'],
        confidence: fallbackContent.confidence
      };
    }
  }

  /**
   * 🎨 APPLY AI FORMATTING DECISIONS
   * Use AI formatting decisions to optimize presentation
   */
  private async applyAIFormattingDecisions(content: string, formattingStyle: any): Promise<string> {
    console.log('🎨 ENHANCED_ORCHESTRATOR: Applying AI formatting decisions...');

    const prompt = `Apply these AI-decided formatting rules to this content:

Original Content: "${content}"

Formatting Decisions:
- Line breaks: ${formattingStyle.line_breaks}
- Emphasis: ${formattingStyle.emphasis_type}
- Structure: ${formattingStyle.structure}

Apply formatting for maximum readability and engagement on Twitter.
Return only the formatted content.`;

    try {
      const response = await this.openaiService.chatCompletion([
        {
          role: 'system',
          content: 'You apply specific formatting decisions to optimize Twitter content presentation.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        model: 'gpt-4o-mini',
        temperature: 0.3,
        maxTokens: 400,
        requestType: 'ai_formatting_application',
        priority: 'medium'
      });

      const formattedContent = response.choices[0]?.message?.content || content;
      console.log('✅ AI_FORMATTING: Applied AI formatting decisions');
      
      return formattedContent;
    } catch (error) {
      console.warn('⚠️ AI formatting application failed, using original content');
      return content;
    }
  }

  /**
   * ⚡ AI OPTIMIZE UNDERPERFORMING CONTENT
   * AI fixes content with low viral probability
   */
  private async aiOptimizeUnderperformingContent(content: string, plan: any): Promise<string> {
    console.log('⚡ ENHANCED_ORCHESTRATOR: AI optimizing underperforming content...');

    const prompt = `This content has low viral probability (${(plan.expected_performance.viral_probability * 100).toFixed(1)}%). Optimize it:

Content: "${content}"

AI Plan Context:
- Topic: ${plan.topic}
- Hook Type: ${plan.hook_type}
- Target Viral: 70%+

Optimization Tasks:
1. Strengthen the hook for immediate attention
2. Add emotional triggers or controversy
3. Include a compelling call-to-action
4. Optimize for shareability

Return only the optimized content that will achieve 70%+ viral probability.`;

    try {
      const response = await this.openaiService.chatCompletion([
        {
          role: 'system',
          content: 'You optimize low-performing content to achieve viral potential using proven engagement tactics.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 400,
        requestType: 'ai_viral_optimization',
        priority: 'high'
      });

      const optimizedContent = response.choices[0]?.message?.content || content;
      console.log('✅ AI_OPTIMIZATION: Boosted viral potential through AI optimization');
      
      return optimizedContent;
    } catch (error) {
      console.warn('⚠️ AI viral optimization failed, using original content');
      return content;
    }
  }

  /**
   * 📊 COLLECT PERFORMANCE FEEDBACK
   * Automatically collect and analyze performance for continuous improvement
   */
  public async collectPerformanceFeedback(postId: string, content: string, metrics: any): Promise<void> {
    console.log(`📊 ENHANCED_ORCHESTRATOR: Collecting performance feedback for ${postId}...`);

    try {
      // Collect enhanced metrics as before
      await this.collectEnhancedMetrics(postId, content, metrics);

      // Generate feedback report for continuous learning
      const feedbackReport = await this.feedbackPipeline.generateComprehensiveFeedbackReport(7);
      
      // Apply feedback to improve future content
      const appliedFeedback = await this.feedbackPipeline.applyFeedbackToContentGeneration(feedbackReport);
      
      console.log(`✅ FEEDBACK_COLLECTED: Applied ${appliedFeedback.optimization_applied.length} optimizations`);
      console.log(`📈 EXPECTED_IMPROVEMENT: ${(appliedFeedback.expected_improvement * 100).toFixed(1)}%`);
      
    } catch (error: any) {
      console.error('❌ Performance feedback collection failed:', error.message);
    }
  }

  /**
   * 🎯 GET CONTENT OPTIMIZATION PREVIEW
   * Preview optimization suggestions before posting
   */
  public async getContentOptimizationPreview(content: string): Promise<{
    predictions: any;
    suggestions: string[];
    confidence: number;
  }> {
    console.log('🎯 ENHANCED_ORCHESTRATOR: Generating optimization preview...');

    try {
      // Get performance prediction
      const prediction = await this.predictionEngine.predictPerformance(content);
      
      // Get optimization recommendations
      const recommendations = await this.metricsCollector.getOptimizationRecommendations(content);
      
      console.log(`🔮 PREVIEW: ${prediction.predictedLikes} likes predicted, ${recommendations.recommendations.length} suggestions`);
      
      return {
        predictions: {
          likes: prediction.predictedLikes,
          replies: prediction.predictedReplies,
          retweets: prediction.predictedRetweets,
          viralProbability: prediction.viralProbability,
          followerGrowth: prediction.predictedFollowerGrowth
        },
        suggestions: recommendations.recommendations,
        confidence: prediction.confidence
      };
    } catch (error: any) {
      console.error('❌ Optimization preview failed:', error.message);
      return {
        predictions: { likes: 1, replies: 0, retweets: 0, viralProbability: 0.1, followerGrowth: 0 },
        suggestions: ['Add personal story', 'Include specific metrics'],
        confidence: 0.3
      };
    }
  }
}

export const getEnhancedPostingOrchestrator = () => EnhancedPostingOrchestrator.getInstance();
