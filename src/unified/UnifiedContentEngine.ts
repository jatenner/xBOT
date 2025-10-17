/**
 * 🚀 UNIFIED CONTENT ENGINE
 * 
 * ONE SYSTEM TO RULE THEM ALL
 * Combines the best features from all 15+ fragmented systems
 * 
 * Features:
 * - Learning-driven content generation
 * - Follower growth optimization
 * - Performance prediction
 * - Quality validation
 * - A/B testing integration
 * - Real-time improvement
 */

import { getOpenAIService } from '../services/openAIService';
import { getSupabaseClient } from '../db/index';
import { FollowerGrowthOptimizer } from '../intelligence/followerGrowthOptimizer';
import { PerformancePredictionEngine } from '../intelligence/performancePredictionEngine';
import { ContentQualityController } from '../quality/contentQualityController';

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export interface ContentRequest {
  topic?: string;
  format?: 'single' | 'thread';
  experimentArm?: 'control' | 'variant_a' | 'variant_b';
  forceGeneration?: boolean;
}

export interface GeneratedContent {
  content: string;
  threadParts?: string[];
  
  metadata: {
    quality_score: number;
    predicted_likes: number;
    predicted_followers: number;
    viral_probability: number;
    confidence: number;
    
    // Learning applied
    learning_insights_used: string[];
    viral_patterns_applied: string[];
    failed_patterns_avoided: string[];
    
    // Experimentation
    experiment_arm: string;
    variant_features: string[];
    
    // AI systems used
    systems_active: string[];
    generation_strategy: string;
  };
  
  reasoning: string;
}

interface ViralInsights {
  topHooks: string[];
  topFormats: string[];
  optimalTiming: { hour: number; day: number };
  successPatterns: Array<{ pattern: string; followers_gained: number }>;
  failedPatterns: Array<{ pattern: string; reason: string }>;
}

// ═══════════════════════════════════════════════════════════
// UNIFIED CONTENT ENGINE
// ═══════════════════════════════════════════════════════════

export class UnifiedContentEngine {
  private static instance: UnifiedContentEngine;
  private openai = getOpenAIService();
  private supabase = getSupabaseClient();
  private followerOptimizer = FollowerGrowthOptimizer.getInstance();
  private predictor = PerformancePredictionEngine.getInstance();
  private qualityController: ContentQualityController;
  
  private constructor() {
    const apiKey = process.env.OPENAI_API_KEY || '';
    this.qualityController = new ContentQualityController(apiKey);
  }
  
  public static getInstance(): UnifiedContentEngine {
    if (!UnifiedContentEngine.instance) {
      UnifiedContentEngine.instance = new UnifiedContentEngine();
    }
    return UnifiedContentEngine.instance;
  }
  
  // ═══════════════════════════════════════════════════════════
  // MAIN GENERATION METHOD
  // ═══════════════════════════════════════════════════════════
  
  /**
   * Generate content using unified pipeline with ALL features active
   */
  public async generateContent(request: ContentRequest = {}): Promise<GeneratedContent> {
    console.log('🚀 UNIFIED_ENGINE: Starting generation with all systems active');
    
    const systemsActive: string[] = [];
    
    try {
      // ═══════════════════════════════════════════════════════════
      // STEP 1: RETRIEVE LEARNING INSIGHTS
      // ═══════════════════════════════════════════════════════════
      console.log('🧠 STEP 1: Retrieving learning insights from past performance...');
      const insights = await this.retrieveLearningInsights();
      systemsActive.push('Learning Retrieval');
      
      console.log(`  ✓ Top hooks: ${insights.topHooks.slice(0, 3).join(', ')}`);
      console.log(`  ✓ Success patterns: ${insights.successPatterns.length}`);
      console.log(`  ✓ Failed patterns to avoid: ${insights.failedPatterns.length}`);
      
      // ═══════════════════════════════════════════════════════════
      // STEP 2: DETERMINE EXPERIMENT ARM
      // ═══════════════════════════════════════════════════════════
      console.log('🧪 STEP 2: Determining experiment arm (exploitation vs exploration)...');
      const experimentArm = request.experimentArm || this.selectExperimentArm();
      const variantFeatures: string[] = [];
      
      console.log(`  ✓ Experiment arm: ${experimentArm}`);
      systemsActive.push('A/B Testing');
      
      // ═══════════════════════════════════════════════════════════
      // STEP 3: OPTIMIZE FOR FOLLOWER GROWTH
      // ═══════════════════════════════════════════════════════════
      console.log('📈 STEP 3: Optimizing for follower growth...');
      const topicHint = request.topic || await this.selectOptimalTopic(insights);
      const viralAnalysis = await this.followerOptimizer.analyzeViralPotential(topicHint);
      systemsActive.push('Follower Growth Optimizer');
      
      console.log(`  ✓ Topic: "${topicHint}"`);
      console.log(`  ✓ Viral score: ${viralAnalysis.viralScore}/100`);
      console.log(`  ✓ Follower potential: ${viralAnalysis.followerPotential}/100`);
      
      // ═══════════════════════════════════════════════════════════
      // STEP 4: BUILD INTELLIGENT PROMPT
      // ═══════════════════════════════════════════════════════════
      console.log('🎨 STEP 4: Building intelligent prompt with all insights...');
      const prompt = this.buildIntelligentPrompt({
        topic: topicHint,
        format: request.format || 'single',
        insights,
        viralAnalysis,
        experimentArm,
        variantFeatures
      });
      systemsActive.push('Intelligent Prompting');
      
      // ═══════════════════════════════════════════════════════════
      // STEP 5: GENERATE WITH AI
      // ═══════════════════════════════════════════════════════════
      console.log('🤖 STEP 5: Generating content with AI...');
      const temperature = experimentArm === 'variant_b' ? 0.95 : 0.85; // Explore vs exploit
      
      const response = await this.openai.chatCompletion([
        {
          role: 'system',
          content: 'You are an elite Twitter content creator specializing in health content. Your posts consistently gain followers and go viral. You understand psychology, trends, and the Twitter algorithm. Always respond in valid JSON format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        model: 'gpt-4o-mini',
        temperature,
        maxTokens: 400,
        requestType: 'unified_content_generation',
        response_format: { type: 'json_object' }
      });
      
      const rawContent = response.choices[0]?.message?.content;
      if (!rawContent) throw new Error('Empty AI response');
      
      const aiResponse = JSON.parse(rawContent);
      systemsActive.push('GPT-4 Generation');
      
      // ═══════════════════════════════════════════════════════════
      // STEP 6: VALIDATE QUALITY
      // ═══════════════════════════════════════════════════════════
      console.log('🔍 STEP 6: Validating content quality...');
      const content = aiResponse.content || aiResponse.tweet || aiResponse.text || '';
      const qualityResult = await this.qualityController.validateContentQuality(content);
      systemsActive.push('Quality Validation');
      
      console.log(`  ✓ Quality score: ${qualityResult.overall}/100`);
      console.log(`  ✓ Engagement potential: ${qualityResult.engagement}/100`);
      console.log(`  ✓ Authenticity: ${qualityResult.authenticity}/100`);
      
      // Strict quality gate
      const MIN_QUALITY = parseFloat(process.env.MIN_QUALITY_SCORE || '75');
      if (qualityResult.overall < MIN_QUALITY && !request.forceGeneration) {
        console.log(`  ❌ REJECTED: Quality ${qualityResult.overall} below ${MIN_QUALITY}`);
        
        if (qualityResult.issues.length > 0) {
          console.log(`  Issues: ${qualityResult.issues.join(', ')}`);
        }
        
        // Retry once with improvements
        console.log('  🔄 Retrying with quality improvements...');
        return this.generateContent({
          ...request,
          topic: topicHint,
          forceGeneration: true // Prevent infinite loop
        });
      }
      
      // ═══════════════════════════════════════════════════════════
      // STEP 7: PREDICT PERFORMANCE
      // ═══════════════════════════════════════════════════════════
      console.log('🔮 STEP 7: Predicting performance...');
      const prediction = await this.predictor.predictPerformance(content);
      systemsActive.push('Performance Prediction');
      
      console.log(`  ✓ Predicted likes: ${prediction.predictedLikes}`);
      console.log(`  ✓ Predicted followers: ${prediction.predictedFollowerGrowth}`);
      console.log(`  ✓ Viral probability: ${(prediction.viralProbability * 100).toFixed(1)}%`);
      console.log(`  ✓ Confidence: ${(prediction.confidence * 100).toFixed(1)}%`);
      
      // ═══════════════════════════════════════════════════════════
      // STEP 8: ASSEMBLE RESULT
      // ═══════════════════════════════════════════════════════════
      const threadParts = aiResponse.thread || (aiResponse.content?.includes('\n\n') 
        ? aiResponse.content.split('\n\n').filter((s: string) => s.trim()) 
        : undefined);
      
      const result: GeneratedContent = {
        content,
        threadParts,
        metadata: {
          quality_score: qualityResult.overall / 100,
          predicted_likes: prediction.predictedLikes,
          predicted_followers: prediction.predictedFollowerGrowth,
          viral_probability: prediction.viralProbability,
          confidence: prediction.confidence,
          
          learning_insights_used: insights.topHooks.slice(0, 3),
          viral_patterns_applied: insights.successPatterns.slice(0, 3).map(p => p.pattern),
          failed_patterns_avoided: insights.failedPatterns.slice(0, 3).map(p => p.pattern),
          
          experiment_arm: experimentArm,
          variant_features: variantFeatures,
          
          systems_active: systemsActive,
          generation_strategy: experimentArm === 'control' 
            ? 'exploit_learned_patterns' 
            : experimentArm === 'variant_a'
            ? 'moderate_exploration'
            : 'aggressive_exploration'
        },
        reasoning: prediction.reasoning
      };
      
      console.log('✅ UNIFIED_ENGINE: Generation complete with all systems active');
      console.log(`   Systems used: ${systemsActive.length}`);
      console.log(`   Quality: ${result.metadata.quality_score.toFixed(2)}`);
      console.log(`   Viral probability: ${(result.metadata.viral_probability * 100).toFixed(1)}%`);
      
      return result;
      
    } catch (error: any) {
      console.error('❌ UNIFIED_ENGINE: Generation failed:', error.message);
      throw error;
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // LEARNING RETRIEVAL
  // ═══════════════════════════════════════════════════════════
  
  private async retrieveLearningInsights(): Promise<ViralInsights> {
    try {
      // Get top performing content patterns
      const { data: topPerformers } = await this.supabase
        .from('comprehensive_metrics')
        .select('hook_type, shareability_score, followers_attributed, post_id')
        .gte('followers_attributed', 1)
        .order('followers_attributed', { ascending: false })
        .limit(20);
      
      // Get failed patterns (low shareability despite impressions)
      const { data: failedContent } = await this.supabase
        .from('comprehensive_metrics')
        .select('hook_type, shareability_score, post_id')
        .lte('shareability_score', 30)
        .limit(10);
      
      // Extract top hooks
      const hookCounts = new Map<string, number>();
      topPerformers?.forEach(p => {
        if (p.hook_type) {
          hookCounts.set(p.hook_type as string, (hookCounts.get(p.hook_type as string) || 0) + 1);
        }
      });
      
      const topHooks = Array.from(hookCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([hook]) => hook);
      
      // Build success patterns
      const successPatterns = topPerformers
        ?.filter(p => (p.followers_attributed as number) > 0)
        .map(p => ({
          pattern: (p.hook_type as string) || 'unknown',
          followers_gained: (p.followers_attributed as number) || 0
        })) || [];
      
      // Build failed patterns
      const failedPatterns = failedContent
        ?.map(p => ({
          pattern: (p.hook_type as string) || 'unknown',
          reason: `Low shareability (${p.shareability_score}/100)`
        })) || [];
      
      // Get optimal timing
      const { data: timingData } = await this.supabase
        .from('comprehensive_metrics')
        .select('posted_hour, posted_day_of_week, followers_attributed')
        .gte('followers_attributed', 1)
        .order('followers_attributed', { ascending: false })
        .limit(50);
      
      const avgHour = timingData && timingData.length > 0
        ? Math.round(timingData.reduce((sum, d) => sum + ((d.posted_hour as number) || 0), 0) / timingData.length)
        : 9;
      
      const avgDay = timingData && timingData.length > 0
        ? Math.round(timingData.reduce((sum, d) => sum + ((d.posted_day_of_week as number) || 0), 0) / timingData.length)
        : 2;
      
      return {
        topHooks: topHooks.length > 0 ? topHooks : ['data_driven', 'controversial', 'personal'],
        topFormats: ['single', 'thread'],
        optimalTiming: { hour: avgHour, day: avgDay },
        successPatterns,
        failedPatterns
      };
      
    } catch (error: any) {
      console.warn('⚠️ Learning retrieval failed, using defaults:', error.message);
      
      // Fallback to sensible defaults
      return {
        topHooks: ['data_driven', 'controversial', 'personal'],
        topFormats: ['single'],
        optimalTiming: { hour: 9, day: 2 },
        successPatterns: [],
        failedPatterns: []
      };
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // EXPERIMENTATION
  // ═══════════════════════════════════════════════════════════
  
  /**
   * Select experiment arm using epsilon-greedy strategy
   * 60% exploit (use learned patterns)
   * 40% explore (try new approaches)
   */
  private selectExperimentArm(): 'control' | 'variant_a' | 'variant_b' {
    const random = Math.random();
    
    if (random < 0.60) {
      return 'control'; // Exploit: Use proven patterns
    } else if (random < 0.85) {
      return 'variant_a'; // Moderate exploration
    } else {
      return 'variant_b'; // Aggressive exploration
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // PROMPT BUILDING
  // ═══════════════════════════════════════════════════════════
  
  private buildIntelligentPrompt(params: {
    topic: string;
    format: string;
    insights: ViralInsights;
    viralAnalysis: any;
    experimentArm: string;
    variantFeatures: string[];
  }): string {
    const { topic, format, insights, viralAnalysis, experimentArm } = params;
    
    const successPatternsText = insights.successPatterns.length > 0
      ? insights.successPatterns.slice(0, 3).map(p => `"${p.pattern}" (gained ${p.followers_gained} followers)`).join(', ')
      : 'data-driven content, personal stories, controversial takes';
    
    const avoidPatternsText = insights.failedPatterns.length > 0
      ? insights.failedPatterns.slice(0, 3).map(p => `"${p.pattern}" (${p.reason})`).join(', ')
      : 'academic language, generic advice, obvious information';
    
    const explorationInstructions = experimentArm === 'control'
      ? 'Use proven patterns that have gained followers in the past.'
      : experimentArm === 'variant_a'
      ? 'Try a slight variation on proven patterns - add a twist.'
      : 'Be creative and try a completely new approach - break the mold.';
    
    return `Generate a ${format === 'thread' ? 'thread' : 'single tweet'} about: ${topic}

PROVEN SUCCESS PATTERNS (use these):
${successPatternsText}

FAILED PATTERNS (avoid these):
${avoidPatternsText}

VIRAL OPTIMIZATION:
${viralAnalysis.algorithmOptimization.slice(0, 3).join('\n')}

EXPERIMENT STRATEGY: ${explorationInstructions}

REQUIREMENTS:
- Make it THE BEST health content on Twitter
- Must gain followers (not just likes)
- Sound human and authentic, not robotic
- Include specific, actionable insights
- Use hooks that have worked: ${insights.topHooks.slice(0, 3).join(', ')}
- No hashtags
- Max 2 emojis
- Focus on value and intrigue

GOAL: This content must be so good that people WANT to follow for more.

Return JSON: ${format === 'thread' ? '{"thread": ["tweet1", "tweet2", ...]}' : '{"content": "tweet text"}'}`;
  }
  
  // ═══════════════════════════════════════════════════════════
  // TOPIC SELECTION
  // ═══════════════════════════════════════════════════════════
  
  private async selectOptimalTopic(insights: ViralInsights): Promise<string> {
    // Topic rotation to ensure diversity
    const healthTopics = [
      'sleep optimization',
      'stress reduction',
      'nutrition science',
      'exercise benefits',
      'mental health',
      'longevity research',
      'habit formation',
      'productivity health',
      'inflammation',
      'gut health'
    ];
    
    // Select random topic (simple for now, can be made smarter)
    return healthTopics[Math.floor(Math.random() * healthTopics.length)];
  }
}

