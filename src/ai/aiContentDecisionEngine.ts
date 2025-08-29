/**
 * 🤖 AI CONTENT DECISION ENGINE
 * 
 * MAXIMUM OpenAI utilization - AI makes EVERY content decision
 * - Topic selection based on trending analysis
 * - Hook type choice (personal vs contrarian vs data)
 * - Content length optimization
 * - Formatting decisions (thread vs single, line breaks, emphasis)
 * - Timing recommendations
 * - Controversy level calibration
 * - Tone and voice adaptation
 * 
 * 10-15 OpenAI calls per content piece for micro-specialized decisions
 */

import { getOpenAIService } from '../services/openAIService';
import { getUnifiedDataManager } from '../lib/unifiedDataManager';

interface ContentDecision {
  decision_type: string;
  ai_reasoning: string;
  confidence: number;
  alternatives_considered: string[];
  data_used: string[];
}

interface ComprehensiveContentPlan {
  // Topic & Strategy
  topic: string;
  topic_reasoning: ContentDecision;
  
  // Content Structure
  hook_type: 'personal' | 'contrarian' | 'data_driven' | 'question' | 'story';
  hook_decision: ContentDecision;
  
  content_format: 'single' | 'thread';
  format_decision: ContentDecision;
  
  // Content Elements
  controversy_level: number; // 1-10
  controversy_decision: ContentDecision;
  
  target_length: number;
  length_decision: ContentDecision;
  
  // Formatting & Presentation
  formatting_style: {
    line_breaks: 'minimal' | 'standard' | 'generous';
    emphasis_type: 'none' | 'caps' | 'bullets' | 'numbers';
    structure: 'paragraph' | 'list' | 'story' | 'data_points';
  };
  formatting_decision: ContentDecision;
  
  // Timing & Strategy
  optimal_timing: {
    immediate: boolean;
    preferred_hour: number;
    day_factor: number;
  };
  timing_decision: ContentDecision;
  
  // Voice & Tone
  voice_adaptation: {
    formality: 'casual' | 'professional' | 'friendly';
    energy: 'calm' | 'excited' | 'urgent';
    authority: 'humble' | 'confident' | 'expert';
  };
  voice_decision: ContentDecision;
  
  // Quality Assurance
  expected_performance: {
    viral_probability: number;
    engagement_score: number;
    follower_potential: number;
  };
  
  total_ai_calls: number;
  decision_confidence: number;
}

export class AIContentDecisionEngine {
  private static instance: AIContentDecisionEngine;
  private openaiService = getOpenAIService();
  private dataManager = getUnifiedDataManager();
  
  private constructor() {}

  public static getInstance(): AIContentDecisionEngine {
    if (!AIContentDecisionEngine.instance) {
      AIContentDecisionEngine.instance = new AIContentDecisionEngine();
    }
    return AIContentDecisionEngine.instance;
  }

  /**
   * 🧠 CREATE COMPREHENSIVE CONTENT PLAN
   * AI makes every single decision about the content
   */
  public async createComprehensiveContentPlan(
    initialTopic?: string,
    context?: any
  ): Promise<ComprehensiveContentPlan> {
    console.log('🧠 AI_DECISION_ENGINE: Creating comprehensive AI-driven content plan...');
    
    let aiCallCount = 0;
    
    try {
      // Step 1: AI decides topic (if not provided)
      const topicDecision = await this.aiDecideTopic(initialTopic, context);
      aiCallCount++;
      
      // Step 2: AI decides hook type based on performance data
      const hookDecision = await this.aiDecideHookType(topicDecision.topic, context);
      aiCallCount++;
      
      // Step 3: AI decides content format (single vs thread)
      const formatDecision = await this.aiDecideContentFormat(topicDecision.topic, hookDecision.hook_type, context);
      aiCallCount++;
      
      // Step 4: AI decides controversy level
      const controversyDecision = await this.aiDecideControversyLevel(topicDecision.topic, context);
      aiCallCount++;
      
      // Step 5: AI decides optimal content length
      const lengthDecision = await this.aiDecideContentLength(formatDecision.content_format, context);
      aiCallCount++;
      
      // Step 6: AI decides formatting style
      const formattingDecision = await this.aiDecideFormattingStyle(formatDecision.content_format, lengthDecision.target_length);
      aiCallCount++;
      
      // Step 7: AI decides optimal timing
      const timingDecision = await this.aiDecideOptimalTiming(topicDecision.topic, controversyDecision.controversy_level);
      aiCallCount++;
      
      // Step 8: AI decides voice adaptation
      const voiceDecision = await this.aiDecideVoiceAdaptation(topicDecision.topic, hookDecision.hook_type, context);
      aiCallCount++;
      
      // Step 9: AI predicts expected performance
      const performancePrediction = await this.aiPredictPerformance({
        topic: topicDecision.topic,
        hook_type: hookDecision.hook_type,
        format: formatDecision.content_format,
        controversy: controversyDecision.controversy_level,
        length: lengthDecision.target_length
      });
      aiCallCount++;

      const plan: ComprehensiveContentPlan = {
        topic: topicDecision.topic,
        topic_reasoning: topicDecision.decision,
        
        hook_type: hookDecision.hook_type,
        hook_decision: hookDecision.decision,
        
        content_format: formatDecision.content_format,
        format_decision: formatDecision.decision,
        
        controversy_level: controversyDecision.controversy_level,
        controversy_decision: controversyDecision.decision,
        
        target_length: lengthDecision.target_length,
        length_decision: lengthDecision.decision,
        
        formatting_style: formattingDecision.formatting_style,
        formatting_decision: formattingDecision.decision,
        
        optimal_timing: timingDecision.optimal_timing,
        timing_decision: timingDecision.decision,
        
        voice_adaptation: voiceDecision.voice_adaptation,
        voice_decision: voiceDecision.decision,
        
        expected_performance: performancePrediction,
        total_ai_calls: aiCallCount,
        decision_confidence: this.calculateOverallConfidence([
          topicDecision.decision,
          hookDecision.decision,
          formatDecision.decision,
          controversyDecision.decision,
          lengthDecision.decision,
          formattingDecision.decision,
          timingDecision.decision,
          voiceDecision.decision
        ])
      };

      console.log(`✅ AI_PLAN_COMPLETE: ${aiCallCount} AI decisions made with ${plan.decision_confidence.toFixed(1)}% confidence`);
      console.log(`🎯 TOPIC: ${plan.topic}`);
      console.log(`🎭 HOOK: ${plan.hook_type}`);
      console.log(`📝 FORMAT: ${plan.content_format}`);
      console.log(`🔥 CONTROVERSY: ${plan.controversy_level}/10`);
      console.log(`📏 LENGTH: ${plan.target_length} chars`);
      console.log(`🚀 PREDICTED VIRAL: ${(plan.expected_performance.viral_probability * 100).toFixed(1)}%`);
      
      return plan;
      
    } catch (error: any) {
      console.error('❌ AI decision engine failed:', error.message);
      
      // Fallback plan with basic decisions
      return this.createFallbackPlan(initialTopic || 'health optimization', aiCallCount);
    }
  }

  /**
   * 🎯 AI DECIDES TOPIC
   */
  private async aiDecideTopic(initialTopic?: string, context?: any): Promise<{
    topic: string;
    decision: ContentDecision;
  }> {
    if (initialTopic) {
      return {
        topic: initialTopic,
        decision: {
          decision_type: 'topic_selection',
          ai_reasoning: 'Topic provided by user',
          confidence: 1.0,
          alternatives_considered: [],
          data_used: ['user_input']
        }
      };
    }

    const prompt = `Decide on the best health optimization topic for a Twitter post right now.

Account Context:
- 25 followers, health optimization niche
- Goal: Maximum engagement and follower growth
- Brand: Evidence-based health optimization

Current Trends: ${JSON.stringify(context?.trending_topics || ['morning routines', 'sleep optimization', 'nutrition myths'])}
Recent Performance: ${JSON.stringify(context?.recent_performance || 'Limited data')}

Consider:
1. Trending relevance
2. Engagement potential for small accounts
3. Authority building opportunity
4. Contrarian angle potential
5. Personal experience angle

Return JSON:
{
  "chosen_topic": "specific topic",
  "reasoning": "why this topic now",
  "confidence": 0.85,
  "alternatives": ["topic1", "topic2"],
  "data_factors": ["factor1", "factor2"]
}`;

    try {
      const response = await this.openaiService.chatCompletion([
        {
          role: 'system',
          content: 'You are an expert at selecting viral health content topics based on data and trends.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 400,
        requestType: 'ai_topic_decision',
        priority: 'high'
      });

      const decision = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      return {
        topic: decision.chosen_topic || 'morning routine optimization',
        decision: {
          decision_type: 'topic_selection',
          ai_reasoning: decision.reasoning || 'AI topic selection',
          confidence: decision.confidence || 0.7,
          alternatives_considered: decision.alternatives || [],
          data_used: decision.data_factors || []
        }
      };
    } catch (error) {
      console.warn('⚠️ AI topic decision failed, using fallback');
      return {
        topic: 'morning routine optimization',
        decision: {
          decision_type: 'topic_selection',
          ai_reasoning: 'Fallback topic due to AI error',
          confidence: 0.5,
          alternatives_considered: [],
          data_used: ['fallback']
        }
      };
    }
  }

  /**
   * 🎭 AI DECIDES HOOK TYPE
   */
  private async aiDecideHookType(topic: string, context?: any): Promise<{
    hook_type: 'personal' | 'contrarian' | 'data_driven' | 'question' | 'story';
    decision: ContentDecision;
  }> {
    const prompt = `Decide the best hook type for this health topic: "${topic}"

Hook Types:
- personal: "I tried X for Y days..."
- contrarian: "Everyone says X, but I discovered Y..."
- data_driven: "New study shows X..."
- question: "What if X isn't actually Y?"
- story: "This happened when I..."

Account Data:
- 25 followers, health optimization focus
- Recent performance: ${JSON.stringify(context?.recent_performance || 'Limited data')}

Consider:
1. Topic fit (which hook works best for this topic)
2. Account size (what works for small accounts)
3. Engagement potential
4. Authority building
5. Personal authenticity

Return JSON:
{
  "chosen_hook": "hook_type",
  "reasoning": "why this hook for this topic",
  "confidence": 0.9,
  "alternatives": ["hook1", "hook2"],
  "expected_engagement": "high/medium/low"
}`;

    try {
      const response = await this.openaiService.chatCompletion([
        {
          role: 'system',
          content: 'You are an expert at selecting the most engaging hook types for health content based on topic and audience data.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        model: 'gpt-4o',
        temperature: 0.6,
        maxTokens: 300,
        requestType: 'ai_hook_decision',
        priority: 'high'
      });

      const decision = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      return {
        hook_type: decision.chosen_hook || 'personal',
        decision: {
          decision_type: 'hook_selection',
          ai_reasoning: decision.reasoning || 'AI hook selection',
          confidence: decision.confidence || 0.7,
          alternatives_considered: decision.alternatives || [],
          data_used: ['topic_analysis', 'audience_size', 'engagement_patterns']
        }
      };
    } catch (error) {
      console.warn('⚠️ AI hook decision failed, using fallback');
      return {
        hook_type: 'personal',
        decision: {
          decision_type: 'hook_selection',
          ai_reasoning: 'Fallback to personal hook due to AI error',
          confidence: 0.5,
          alternatives_considered: [],
          data_used: ['fallback']
        }
      };
    }
  }

  /**
   * 📝 AI DECIDES CONTENT FORMAT
   */
  private async aiDecideContentFormat(
    topic: string, 
    hookType: string, 
    context?: any
  ): Promise<{
    content_format: 'single' | 'thread';
    decision: ContentDecision;
  }> {
    const prompt = `Decide between single tweet vs thread for this content:

Topic: "${topic}"
Hook Type: ${hookType}

Format Considerations:
- Single: Better for simple, punchy messages
- Thread: Better for complex topics, storytelling, authority building

Account Context:
- 25 followers (threads can be risky for small accounts)
- Health optimization niche
- Goal: Maximum engagement

Return JSON:
{
  "chosen_format": "single|thread",
  "reasoning": "why this format works best",
  "confidence": 0.8,
  "thread_length": 3,
  "engagement_prediction": "prediction"
}`;

    try {
      const response = await this.openaiService.chatCompletion([
        {
          role: 'system',
          content: 'You decide optimal content format based on topic complexity and audience size.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        model: 'gpt-4o-mini',
        temperature: 0.5,
        maxTokens: 250,
        requestType: 'ai_format_decision',
        priority: 'medium'
      });

      const decision = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      return {
        content_format: decision.chosen_format || 'single',
        decision: {
          decision_type: 'format_selection',
          ai_reasoning: decision.reasoning || 'AI format selection',
          confidence: decision.confidence || 0.7,
          alternatives_considered: ['single', 'thread'],
          data_used: ['topic_complexity', 'hook_type', 'audience_size']
        }
      };
    } catch (error) {
      console.warn('⚠️ AI format decision failed, using fallback');
      return {
        content_format: 'single',
        decision: {
          decision_type: 'format_selection',
          ai_reasoning: 'Fallback to single tweet due to AI error',
          confidence: 0.5,
          alternatives_considered: [],
          data_used: ['fallback']
        }
      };
    }
  }

  /**
   * 🔥 AI DECIDES CONTROVERSY LEVEL
   */
  private async aiDecideControversyLevel(topic: string, context?: any): Promise<{
    controversy_level: number;
    decision: ContentDecision;
  }> {
    const prompt = `Decide the optimal controversy level (1-10) for this health topic: "${topic}"

Controversy Scale:
1-3: Safe, conventional advice
4-6: Mild disagreement with mainstream
7-8: Strong contrarian position (sweet spot for engagement)
9-10: Highly controversial (risky)

Account Context:
- 25 followers, growing health account
- Goal: Engagement without damaging reputation
- Audience: Health optimization enthusiasts

Consider:
1. Topic sensitivity
2. Evidence availability
3. Engagement potential
4. Risk of backlash
5. Authority building

Return JSON:
{
  "controversy_level": 7,
  "reasoning": "why this level",
  "confidence": 0.8,
  "risk_assessment": "low/medium/high",
  "engagement_prediction": "expected engagement boost"
}`;

    try {
      const response = await this.openaiService.chatCompletion([
        {
          role: 'system',
          content: 'You optimize controversy levels for maximum engagement while minimizing risk for health content.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        model: 'gpt-4o',
        temperature: 0.4,
        maxTokens: 300,
        requestType: 'ai_controversy_decision',
        priority: 'high'
      });

      const decision = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      return {
        controversy_level: decision.controversy_level || 6,
        decision: {
          decision_type: 'controversy_calibration',
          ai_reasoning: decision.reasoning || 'AI controversy calibration',
          confidence: decision.confidence || 0.7,
          alternatives_considered: ['safe_approach', 'moderate_stance', 'contrarian_angle'],
          data_used: ['topic_sensitivity', 'audience_tolerance', 'engagement_patterns']
        }
      };
    } catch (error) {
      console.warn('⚠️ AI controversy decision failed, using fallback');
      return {
        controversy_level: 6,
        decision: {
          decision_type: 'controversy_calibration',
          ai_reasoning: 'Fallback to moderate controversy due to AI error',
          confidence: 0.5,
          alternatives_considered: [],
          data_used: ['fallback']
        }
      };
    }
  }

  /**
   * 📏 AI DECIDES CONTENT LENGTH
   */
  private async aiDecideContentLength(format: string, context?: any): Promise<{
    target_length: number;
    decision: ContentDecision;
  }> {
    const prompt = `Decide optimal content length for ${format} format.

Format: ${format}
Constraints:
- Single tweet: 280 characters max
- Thread tweets: 280 characters each

Account Context:
- 25 followers, health optimization
- Goal: Maximum engagement
- Audience: Busy professionals interested in health

Consider:
1. Attention span of audience
2. Platform algorithm preferences
3. Message complexity
4. Engagement optimization

Return JSON:
{
  "target_length": 240,
  "reasoning": "why this length",
  "confidence": 0.9,
  "readability_score": "high",
  "engagement_optimization": "explanation"
}`;

    try {
      const response = await this.openaiService.chatCompletion([
        {
          role: 'system',
          content: 'You optimize content length for maximum readability and engagement on Twitter.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        model: 'gpt-4o-mini',
        temperature: 0.3,
        maxTokens: 200,
        requestType: 'ai_length_decision',
        priority: 'medium'
      });

      const decision = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      return {
        target_length: decision.target_length || (format === 'single' ? 240 : 260),
        decision: {
          decision_type: 'length_optimization',
          ai_reasoning: decision.reasoning || 'AI length optimization',
          confidence: decision.confidence || 0.8,
          alternatives_considered: ['short_punchy', 'medium_detailed', 'full_length'],
          data_used: ['format_type', 'audience_attention', 'algorithm_preferences']
        }
      };
    } catch (error) {
      console.warn('⚠️ AI length decision failed, using fallback');
      return {
        target_length: format === 'single' ? 240 : 260,
        decision: {
          decision_type: 'length_optimization',
          ai_reasoning: 'Fallback length optimization due to AI error',
          confidence: 0.6,
          alternatives_considered: [],
          data_used: ['fallback']
        }
      };
    }
  }

  /**
   * 🎨 AI DECIDES FORMATTING STYLE
   */
  private async aiDecideFormattingStyle(format: string, length: number): Promise<{
    formatting_style: {
      line_breaks: 'minimal' | 'standard' | 'generous';
      emphasis_type: 'none' | 'caps' | 'bullets' | 'numbers';
      structure: 'paragraph' | 'list' | 'story' | 'data_points';
    };
    decision: ContentDecision;
  }> {
    const prompt = `Decide optimal formatting for ${format} content with ${length} characters.

Formatting Options:
Line Breaks: minimal, standard, generous
Emphasis: none, caps, bullets, numbers  
Structure: paragraph, list, story, data_points

Consider:
1. Readability on mobile
2. Visual appeal
3. Engagement optimization
4. Content length constraints

Return JSON:
{
  "line_breaks": "standard",
  "emphasis_type": "bullets",
  "structure": "list",
  "reasoning": "why this formatting",
  "confidence": 0.85
}`;

    try {
      const response = await this.openaiService.chatCompletion([
        {
          role: 'system',
          content: 'You optimize content formatting for maximum readability and visual appeal on Twitter.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        model: 'gpt-4o-mini',
        temperature: 0.4,
        maxTokens: 200,
        requestType: 'ai_formatting_decision',
        priority: 'medium'
      });

      const decision = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      return {
        formatting_style: {
          line_breaks: decision.line_breaks || 'standard',
          emphasis_type: decision.emphasis_type || 'none',
          structure: decision.structure || 'paragraph'
        },
        decision: {
          decision_type: 'formatting_optimization',
          ai_reasoning: decision.reasoning || 'AI formatting optimization',
          confidence: decision.confidence || 0.7,
          alternatives_considered: ['minimal_format', 'standard_format', 'enhanced_format'],
          data_used: ['content_length', 'format_type', 'readability_requirements']
        }
      };
    } catch (error) {
      console.warn('⚠️ AI formatting decision failed, using fallback');
      return {
        formatting_style: {
          line_breaks: 'standard',
          emphasis_type: 'none',
          structure: 'paragraph'
        },
        decision: {
          decision_type: 'formatting_optimization',
          ai_reasoning: 'Fallback formatting due to AI error',
          confidence: 0.6,
          alternatives_considered: [],
          data_used: ['fallback']
        }
      };
    }
  }

  /**
   * ⏰ AI DECIDES OPTIMAL TIMING
   */
  private async aiDecideOptimalTiming(topic: string, controversyLevel: number): Promise<{
    optimal_timing: {
      immediate: boolean;
      preferred_hour: number;
      day_factor: number;
    };
    decision: ContentDecision;
  }> {
    const prompt = `Decide optimal posting timing for health content.

Topic: "${topic}"
Controversy Level: ${controversyLevel}/10

Consider:
1. Health content audience behavior
2. Controversy level impact
3. Platform algorithm timing
4. Audience engagement patterns

Return JSON:
{
  "immediate": false,
  "preferred_hour": 9,
  "day_factor": 1.2,
  "reasoning": "timing strategy",
  "confidence": 0.8
}`;

    try {
      const response = await this.openaiService.chatCompletion([
        {
          role: 'system',
          content: 'You optimize posting timing based on content type and audience behavior patterns.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        model: 'gpt-4o-mini',
        temperature: 0.3,
        maxTokens: 200,
        requestType: 'ai_timing_decision',
        priority: 'medium'
      });

      const decision = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      return {
        optimal_timing: {
          immediate: decision.immediate || false,
          preferred_hour: decision.preferred_hour || 9,
          day_factor: decision.day_factor || 1.0
        },
        decision: {
          decision_type: 'timing_optimization',
          ai_reasoning: decision.reasoning || 'AI timing optimization',
          confidence: decision.confidence || 0.7,
          alternatives_considered: ['immediate_post', 'peak_hours', 'off_peak'],
          data_used: ['audience_behavior', 'content_type', 'controversy_level']
        }
      };
    } catch (error) {
      console.warn('⚠️ AI timing decision failed, using fallback');
      return {
        optimal_timing: {
          immediate: false,
          preferred_hour: 9,
          day_factor: 1.0
        },
        decision: {
          decision_type: 'timing_optimization',
          ai_reasoning: 'Fallback timing due to AI error',
          confidence: 0.6,
          alternatives_considered: [],
          data_used: ['fallback']
        }
      };
    }
  }

  /**
   * 🎭 AI DECIDES VOICE ADAPTATION
   */
  private async aiDecideVoiceAdaptation(topic: string, hookType: string, context?: any): Promise<{
    voice_adaptation: {
      formality: 'casual' | 'professional' | 'friendly';
      energy: 'calm' | 'excited' | 'urgent';
      authority: 'humble' | 'confident' | 'expert';
    };
    decision: ContentDecision;
  }> {
    const prompt = `Decide optimal voice and tone for this content:

Topic: "${topic}"
Hook Type: ${hookType}

Voice Dimensions:
Formality: casual, professional, friendly
Energy: calm, excited, urgent
Authority: humble, confident, expert

Account Context:
- Small growing health account (25 followers)
- Goal: Build authority while staying relatable
- Audience: Health optimization seekers

Return JSON:
{
  "formality": "friendly",
  "energy": "excited", 
  "authority": "confident",
  "reasoning": "voice strategy",
  "confidence": 0.9
}`;

    try {
      const response = await this.openaiService.chatCompletion([
        {
          role: 'system',
          content: 'You optimize voice and tone for health content based on topic and audience dynamics.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        model: 'gpt-4o-mini',
        temperature: 0.5,
        maxTokens: 200,
        requestType: 'ai_voice_decision',
        priority: 'medium'
      });

      const decision = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      return {
        voice_adaptation: {
          formality: decision.formality || 'friendly',
          energy: decision.energy || 'calm',
          authority: decision.authority || 'confident'
        },
        decision: {
          decision_type: 'voice_optimization',
          ai_reasoning: decision.reasoning || 'AI voice optimization',
          confidence: decision.confidence || 0.7,
          alternatives_considered: ['casual_approach', 'professional_tone', 'expert_voice'],
          data_used: ['topic_type', 'hook_style', 'audience_preference']
        }
      };
    } catch (error) {
      console.warn('⚠️ AI voice decision failed, using fallback');
      return {
        voice_adaptation: {
          formality: 'friendly',
          energy: 'calm',
          authority: 'confident'
        },
        decision: {
          decision_type: 'voice_optimization',
          ai_reasoning: 'Fallback voice settings due to AI error',
          confidence: 0.6,
          alternatives_considered: [],
          data_used: ['fallback']
        }
      };
    }
  }

  /**
   * 📊 AI PREDICTS PERFORMANCE
   */
  private async aiPredictPerformance(contentPlan: any): Promise<{
    viral_probability: number;
    engagement_score: number;
    follower_potential: number;
  }> {
    const prompt = `Predict performance for this content plan:

${JSON.stringify(contentPlan, null, 2)}

Account: 25 followers, health optimization niche

Predict (0-1 scale):
- Viral probability
- Engagement score  
- Follower potential

Return JSON:
{
  "viral_probability": 0.65,
  "engagement_score": 0.7,
  "follower_potential": 0.8,
  "reasoning": "prediction logic"
}`;

    try {
      const response = await this.openaiService.chatCompletion([
        {
          role: 'system',
          content: 'You predict content performance based on comprehensive content planning data.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        model: 'gpt-4o',
        temperature: 0.2,
        maxTokens: 300,
        requestType: 'ai_performance_prediction',
        priority: 'high'
      });

      const prediction = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      return {
        viral_probability: prediction.viral_probability || 0.5,
        engagement_score: prediction.engagement_score || 0.6,
        follower_potential: prediction.follower_potential || 0.5
      };
    } catch (error) {
      console.warn('⚠️ AI performance prediction failed, using fallback');
      return {
        viral_probability: 0.5,
        engagement_score: 0.6,
        follower_potential: 0.5
      };
    }
  }

  /**
   * 🔢 CALCULATE OVERALL CONFIDENCE
   */
  private calculateOverallConfidence(decisions: ContentDecision[]): number {
    const avgConfidence = decisions.reduce((sum, decision) => sum + decision.confidence, 0) / decisions.length;
    return Math.round(avgConfidence * 100);
  }

  /**
   * 🚨 CREATE FALLBACK PLAN
   */
  private createFallbackPlan(topic: string, aiCallsMade: number): ComprehensiveContentPlan {
    return {
      topic,
      topic_reasoning: {
        decision_type: 'fallback_topic',
        ai_reasoning: 'Fallback plan due to AI failures',
        confidence: 0.5,
        alternatives_considered: [],
        data_used: ['fallback']
      },
      hook_type: 'personal',
      hook_decision: {
        decision_type: 'fallback_hook',
        ai_reasoning: 'Fallback to personal hook',
        confidence: 0.5,
        alternatives_considered: [],
        data_used: ['fallback']
      },
      content_format: 'single',
      format_decision: {
        decision_type: 'fallback_format',
        ai_reasoning: 'Fallback to single tweet',
        confidence: 0.5,
        alternatives_considered: [],
        data_used: ['fallback']
      },
      controversy_level: 5,
      controversy_decision: {
        decision_type: 'fallback_controversy',
        ai_reasoning: 'Fallback to moderate controversy',
        confidence: 0.5,
        alternatives_considered: [],
        data_used: ['fallback']
      },
      target_length: 240,
      length_decision: {
        decision_type: 'fallback_length',
        ai_reasoning: 'Fallback to standard length',
        confidence: 0.5,
        alternatives_considered: [],
        data_used: ['fallback']
      },
      formatting_style: {
        line_breaks: 'standard',
        emphasis_type: 'none',
        structure: 'paragraph'
      },
      formatting_decision: {
        decision_type: 'fallback_formatting',
        ai_reasoning: 'Fallback formatting',
        confidence: 0.5,
        alternatives_considered: [],
        data_used: ['fallback']
      },
      optimal_timing: {
        immediate: false,
        preferred_hour: 9,
        day_factor: 1.0
      },
      timing_decision: {
        decision_type: 'fallback_timing',
        ai_reasoning: 'Fallback timing',
        confidence: 0.5,
        alternatives_considered: [],
        data_used: ['fallback']
      },
      voice_adaptation: {
        formality: 'friendly',
        energy: 'calm',
        authority: 'confident'
      },
      voice_decision: {
        decision_type: 'fallback_voice',
        ai_reasoning: 'Fallback voice settings',
        confidence: 0.5,
        alternatives_considered: [],
        data_used: ['fallback']
      },
      expected_performance: {
        viral_probability: 0.3,
        engagement_score: 0.4,
        follower_potential: 0.4
      },
      total_ai_calls: aiCallsMade,
      decision_confidence: 50
    };
  }
}

export const getAIContentDecisionEngine = () => AIContentDecisionEngine.getInstance();
