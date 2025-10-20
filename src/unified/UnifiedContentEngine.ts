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
import { HumanVoiceEngine } from '../ai/humanVoiceEngine';
import { generateNewsReporterContent } from '../generators/newsReporterGenerator';
import { generateStorytellerContent } from '../generators/storytellerGenerator';
import { generateInterestingContent } from '../generators/interestingContentGenerator';
import { generateProvocateurContent } from '../generators/provocateurGenerator';
import { generateDataNerdContent } from '../generators/dataNerdGenerator';
import { generateMythBusterContent } from '../generators/mythBusterGenerator';
import { generateCoachContent } from '../generators/coachGenerator';
import { generateThoughtLeaderContent } from '../generators/thoughtLeaderGenerator';
import { generateContrarianContent } from '../generators/contrarianGenerator';
import { generateExplorerContent } from '../generators/explorerGenerator';
import { generatePhilosopherContent } from '../generators/philosopherGenerator';
import { multiOptionGenerator, ContentOption } from '../ai/multiOptionGenerator';
import { aiContentJudge } from '../ai/aiContentJudge';
import { aiContentRefiner } from '../ai/aiContentRefiner';
import { getViralExamplesForTopic } from '../intelligence/viralTweetDatabase';
import { getCachedTopTweets, formatTopTweetsForPrompt } from '../intelligence/dynamicFewShotProvider';
import { validateAndImprove } from '../generators/contentAutoImprover';
import { validateContent } from '../generators/preQualityValidator';
import { PreGenerationIntelligence } from '../intelligence/preGenerationIntelligence';
import { PostGenerationIntelligence } from '../intelligence/postGenerationIntelligence';
import { IntelligenceEnhancer } from '../intelligence/intelligenceEnhancer';
import { intelligenceConfig, getIntelligenceStatus } from '../intelligence/intelligenceConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export interface ContentRequest {
  topic?: string;
  format?: 'single' | 'thread';
  experimentArm?: 'control' | 'variant_a' | 'variant_b';
  forceGeneration?: boolean;
  enableEnrichment?: boolean; // Enable contrast injection (disabled by default)
  useMultiOption?: boolean; // Enable multi-option generation with AI judge (NEW)
  recentGenerators?: string[]; // For rotation avoidance (DATA COLLECTION MODE)
  recentContent?: string[]; // 🆕 Recent posts to avoid topic repetition
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
    
    // Generator tracking (for autonomous learning)
    generator_name?: string;
    generator_confidence?: number;
    
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
  
  // 🎭 REAL CONTENT GENERATORS (The actual personas you built!)
  private humanVoice = HumanVoiceEngine.getInstance();
  
  // 🧠 INTELLIGENCE MODULES (NEW!)
  private preGenIntelligence = new PreGenerationIntelligence();
  private postGenIntelligence = new PostGenerationIntelligence();
  private intelligenceEnhancer = new IntelligenceEnhancer();
  
  private constructor() {
    const apiKey = process.env.OPENAI_API_KEY || '';
    this.qualityController = new ContentQualityController(apiKey);
    
    const intelligenceStatus = getIntelligenceStatus();
    if (intelligenceStatus !== 'Disabled') {
      console.log(`🧠 UnifiedContentEngine initialized with Intelligence: ${intelligenceStatus}`);
    }
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
    let intelligence: IntelligencePackage | undefined;
    
    try {
      // ═══════════════════════════════════════════════════════════
      // STEP 0: PRE-GENERATION INTELLIGENCE (NEW!)
      // ═══════════════════════════════════════════════════════════
      if (intelligenceConfig.preGeneration.enabled) {
        try {
          console.log('🧠 STEP 0: Gathering deep intelligence on topic...');
          
          const initialTopic = request.topic || 'health and wellness';
          intelligence = await this.preGenIntelligence.analyzeTopicIntelligence(initialTopic);
          
          // 🆕 ADD RECENT CONTENT CONTEXT to intelligence package
          if (request.recentContent && request.recentContent.length > 0) {
            intelligence.recentPosts = request.recentContent.slice(0, 10); // Last 10 posts
            console.log(`  📚 Loaded ${intelligence.recentPosts.length} recent posts for diversity`);
          }
          
          console.log(`  ✓ Research: ${intelligence.research.surprise_factor}`);
          console.log(`  ✓ Perspectives: ${intelligence.perspectives.length} unique angles found`);
          console.log(`  ✓ Context: ${intelligence.context.gaps.length} narrative gaps identified`);
          
          systemsActive.push('Pre-Gen Intelligence');
        } catch (error: any) {
          console.warn(`  ⚠️ Pre-Gen Intelligence failed (continuing without): ${error.message}`);
          // Continue without intelligence - graceful degradation
        }
      }
      
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
      // STEP 3.3: FETCH YOUR TOP TWEETS (Budget Optimization)
      // ═══════════════════════════════════════════════════════════
      console.log('🏆 STEP 3.3: Loading YOUR top-performing tweets for examples...');
      const yourTopTweets = await getCachedTopTweets();
      
      if (yourTopTweets.length > 0) {
        console.log(`  ✓ Found ${yourTopTweets.length} top tweets from YOUR history`);
        console.log(`  ✓ Best: ${yourTopTweets[0].likes} likes, ${yourTopTweets[0].retweets} RTs`);
        systemsActive.push('Dynamic Few-Shot (YOUR Data)');
      } else {
        console.log(`  ℹ️ No historical tweets yet, using curated examples`);
      }
      
      // ═══════════════════════════════════════════════════════════
      // STEP 3.5: MULTI-OPTION GENERATION (NEW - if enabled)
      // ═══════════════════════════════════════════════════════════
      const useMultiOption = request.useMultiOption ?? (process.env.ENABLE_MULTI_OPTION === 'true');
      
      let generatorName: string;
      let generatedContent: any;
      let confidence: number;
      let judgeReasoning: string | undefined;
      
      if (useMultiOption) {
        console.log('🎯 STEP 3.5: MULTI-OPTION GENERATION (5 options)...');
        
        // Generate 5 options in parallel
        const options = await multiOptionGenerator.generateOptions({
          topic: topicHint,
          format: request.format || 'single'
        });
        
        console.log(`  ✓ Generated ${options.length} options`);
        systemsActive.push('Multi-Option Generation');
        
        // AI judge selects best
        const judgment = await aiContentJudge.selectBest(options);
        console.log(`  ✓ Winner: ${judgment.winner.generator_name} (${judgment.score}/10)`);
        console.log(`  ✓ Reasoning: ${judgment.reasoning}`);
        systemsActive.push('AI Content Judge');
        
        // Get viral examples for refinement
        const viralExamples = getViralExamplesForTopic(topicHint, 3);
        
        // Refine winner
        console.log('  ✨ Refining winner...');
        const refinement = await aiContentRefiner.refine({
          content: judgment.winner.raw_content,
          format: judgment.winner.format,
          judge_feedback: {
            strengths: judgment.strengths,
            improvements: judgment.improvements,
            score: judgment.score
          },
          viral_examples: viralExamples
        });
        console.log(`  ✓ Improvements: ${refinement.improvements_made.join(', ')}`);
        systemsActive.push('AI Content Refiner');
        
        generatorName = judgment.winner.generator_name;
        generatedContent = refinement.refined_content;
        confidence = judgment.viral_probability;
        judgeReasoning = judgment.reasoning;
        
      } else {
        // ═══════════════════════════════════════════════════════════
        // STEP 4: SELECT CONTENT GENERATOR (LEGACY - single option)
        // ═══════════════════════════════════════════════════════════
        console.log('🎭 STEP 4: Selecting content generator persona (legacy mode)...');
        const result = await this.selectAndGenerateWithPersona({
          topic: topicHint,
          format: request.format || 'single',
          insights,
          viralAnalysis,
          experimentArm,
          intelligence, // 🆕 PASS INTELLIGENCE
          recentGenerators: request.recentGenerators // 🆕 For rotation
        });
        
        generatorName = result.generatorName;
        generatedContent = result.content;
        confidence = result.confidence;
      }
      
      systemsActive.push(`Persona: ${generatorName}`);
      
      console.log(`  ✓ Used generator: ${generatorName}`);
      console.log(`  ✓ Confidence: ${(confidence * 100).toFixed(1)}%`);
      
      // ═══════════════════════════════════════════════════════════
      // STEP 5: EXTRACT CONTENT
      // ═══════════════════════════════════════════════════════════
      const aiResponse: any = {};
      if (request.format === 'thread' && Array.isArray(generatedContent)) {
        aiResponse.thread = generatedContent;
        aiResponse.content = generatedContent.join('\n\n');
      } else if (typeof generatedContent === 'string') {
        aiResponse.content = generatedContent;
      } else {
        aiResponse.content = Array.isArray(generatedContent) ? generatedContent[0] : String(generatedContent);
      }
      
      // ═══════════════════════════════════════════════════════════
      // STEP 5.3: PRE-QUALITY VALIDATION & AUTO-IMPROVEMENT
      // ═══════════════════════════════════════════════════════════
      let rawContent = aiResponse.content || aiResponse.tweet || aiResponse.text || '';
      
      console.log('🔍 STEP 5.3: Validating content quality...');
      const preValidation = validateContent(
        request.format === 'thread' && Array.isArray(generatedContent) ? generatedContent : rawContent
      );
      
      console.log(`  📊 Quality score: ${preValidation.score}/100 (threshold: 78)`);
      
      // ✅ FIX #1: Auto-improver DISABLED - it was making content MORE academic
      // Generators should create RIGHT content from the start, not "fix" it after
      if (!preValidation.passes && !request.forceGeneration) {
        console.log(`  ⚠️ Content failed pre-validation (${preValidation.score}/100)`);
        console.log(`  Issues: ${preValidation.issues.join(', ')}`);
        console.log(`  🚫 Auto-improvement DISABLED (was making content worse)`);
        console.log(`  📊 Proceeding with original generator content...`);
        systemsActive.push('Pre-Validation [LOW_SCORE_ACCEPTED]');
        
        // OLD APPROACH (commented out - made content worse):
        // const improvement = await validateAndImprove(...);
        // Problem: Made content MORE academic, opposite of goal
        // Solution: Fix generators to create good content from start
      } else {
        console.log(`  ✅ Content passes pre-validation (${preValidation.score}/100)`);
        systemsActive.push('Pre-Validation [PASSED]');
      }
      
      // ═══════════════════════════════════════════════════════════
      // STEP 5.4: POST-GENERATION INTELLIGENCE SCORING
      // ═══════════════════════════════════════════════════════════
      if (intelligenceConfig.postGeneration.enabled && intelligence) {
        try {
          console.log('🧠 STEP 5.4: Scoring content intelligence...');
          const finalContent = request.format === 'thread' && Array.isArray(generatedContent) 
            ? generatedContent.join('\n\n') 
            : rawContent;
          
          const intelligenceScores = await this.postGenIntelligence.scoreIntelligence(finalContent);
          
          console.log(`  📊 Intelligence Scores:`);
          console.log(`     • Engagement: ${intelligenceScores.engagement_potential}/100`);
          console.log(`     • Actionability: ${intelligenceScores.actionability_score}/100`);
          console.log(`     • Intelligence: ${intelligenceScores.intelligence_score}/100`);
          console.log(`     • Overall: ${intelligenceScores.overall_score}/100`);
          
          // ✅ FIX #2: Intelligence Enhancement DISABLED - it was breaking character limits
          // Adding "intelligence" = adding complexity = longer content = cut off sentences
          // Generators already have intelligence package as INPUT - use it there, not patch after
          
          if (intelligenceConfig.enhancement.enabled && intelligenceScores.overall_score < intelligenceConfig.enhancement.minScoreToEnhance) {
            console.log(`  ⚠️ Low intelligence score (${intelligenceScores.overall_score}/100)`);
            console.log(`  🚫 Intelligence enhancement DISABLED (was breaking content)`);
            console.log(`  📊 Original content from generator will be used`);
            systemsActive.push('Intelligence Enhancement [DISABLED]');
            
            // OLD APPROACH (commented out - broke content):
            // const enhanced = await this.intelligenceEnhancer.boostIntelligence(...);
            // Problem: Added complexity, ran out of 280 chars, cut sentences
            // Solution: Generators already have intelligence package - use it there
          } else {
            console.log(`  ✅ Intelligence score acceptable (${intelligenceScores.overall_score}/100)`);
            systemsActive.push('Intelligence Scoring [ACCEPTED]');
          }
        } catch (error: any) {
          console.error(`  ❌ Intelligence scoring failed: ${error.message}`);
          systemsActive.push('Intelligence Scoring [FAILED]');
        }
      }
      
      // ═══════════════════════════════════════════════════════════
      // STEP 5.5: CONTENT SANITIZATION (Safety Net)
      // ═══════════════════════════════════════════════════════════
      const content = rawContent;
      
      console.log('🛡️ STEP 5.5: Sanitizing content for violations...');
      const { sanitizeContent, formatViolationReport, shouldRetry, trackViolation } = await import('../generators/contentSanitizer');
      const sanitization = sanitizeContent(content);
      
      console.log(formatViolationReport(sanitization));
      
      if (!sanitization.passed) {
        systemsActive.push('Content Sanitization [FAILED]');
        
        // Track violations in database (don't await - fire and forget)
        for (const violation of sanitization.violations) {
          trackViolation({
            generatorName: generatorName,
            topic: request.topic,
            format: request.format || 'single',
            violation,
            content,
            specificityScore: sanitization.specificity_score,
            specificityMatches: sanitization.specificity_matches,
            actionTaken: shouldRetry(sanitization) ? 'retried' : 'rejected',
            retrySucceeded: undefined // Will be updated if retry succeeds
          }).catch(err => console.error('Failed to track violation:', err));
        }
        
        // Check if we should retry with different generator
        if (shouldRetry(sanitization) && !request.forceGeneration) {
          console.log('🔄 SANITIZATION_RETRY: Attempting with different generator...');
          
          // Retry generation (will use different generator due to weighted random)
          return this.generateContent({
            ...request,
            forceGeneration: true // Prevent infinite loop
          });
        }
        
        // If forceGeneration is true, we've already retried - throw error
        throw new Error(`Content quality violation: ${sanitization.violations[0]?.detected || 'Unknown violation'}`);
      }
      
      systemsActive.push('Content Sanitization [PASSED]');
      console.log(`  ✓ Specificity score: ${sanitization.specificity_score}`);
      if (sanitization.specificity_matches.length > 0) {
        console.log(`  ✓ Found: ${sanitization.specificity_matches.slice(0, 3).join(', ')}`);
      }
      
      // ═══════════════════════════════════════════════════════════
      // STEP 5.7: CONTENT ENRICHMENT (Optional - adds contrast)
      // ═══════════════════════════════════════════════════════════
      // NOTE: This is currently DISABLED by default
      // Enable by setting request.enableEnrichment = true
      let finalContent = content;
      
      if (request.enableEnrichment) {
        console.log('🎨 STEP 5.7: Enriching content with contrast injection...');
        const { enrichContent } = await import('../generators/contentEnricher');
        
        const enrichmentResult = await enrichContent({
          content: content,
          topic: request.topic || 'health optimization',
          format: request.format || 'single',
          force: false // Use 60% probability
        });
        
        if (enrichmentResult.enriched) {
          finalContent = Array.isArray(enrichmentResult.enriched_content) 
            ? enrichmentResult.enriched_content.join('\n\n') 
            : enrichmentResult.enriched_content;
          
          console.log(`  ✓ Enrichment applied (score: ${enrichmentResult.improvement_score}/100)`);
          console.log(`  ✓ ${enrichmentResult.explanation}`);
          systemsActive.push('Content Enrichment [APPLIED]');
        } else {
          console.log(`  ⊘ Enrichment skipped: ${enrichmentResult.explanation}`);
          systemsActive.push('Content Enrichment [SKIPPED]');
        }
      }
      
      // ═══════════════════════════════════════════════════════════
      // STEP 6: VALIDATE QUALITY
      // ═══════════════════════════════════════════════════════════
      console.log('🔍 STEP 6: Validating content quality...');
      const qualityResult = await this.qualityController.validateContentQuality(
        finalContent,
        {
          isThread: request.format === 'thread',
          threadParts: aiResponse.thread || aiResponse.thread_parts || aiResponse.threadParts || []
        }
      );
      systemsActive.push('Quality Validation');
      
      console.log(`  ✓ Quality score: ${qualityResult.overall}/100`);
      console.log(`  ✓ Engagement potential: ${qualityResult.engagement}/100`);
      console.log(`  ✓ Authenticity: ${qualityResult.authenticity}/100`);
      
      // PHASE 6 FIX: Quality gate (temporarily lowered to allow learning)
      // Will raise back to 75+ after generators improve from real data
      const MIN_QUALITY = parseFloat(process.env.MIN_QUALITY_SCORE || '72');
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
      const prediction = await this.predictor.predictPerformance(finalContent);
      systemsActive.push('Performance Prediction');
      
      console.log(`  ✓ Predicted likes: ${prediction.predictedLikes}`);
      console.log(`  ✓ Predicted followers: ${prediction.predictedFollowerGrowth}`);
      console.log(`  ✓ Viral probability: ${(prediction.viralProbability * 100).toFixed(1)}%`);
      console.log(`  ✓ Confidence: ${(prediction.confidence * 100).toFixed(1)}%`);
      
      // ═══════════════════════════════════════════════════════════
      // STEP 7.5: VIRAL PROBABILITY GATE (adaptive threshold)
      // ═══════════════════════════════════════════════════════════
      const MIN_VIRAL_PROBABILITY = useMultiOption ? 0.25 : 0.15; // Higher for multi-option (better quality)
      
      if (prediction.viralProbability < MIN_VIRAL_PROBABILITY && !request.forceGeneration) {
        console.log(`❌ VIRAL_GATE_FAILED: ${(prediction.viralProbability * 100).toFixed(1)}% < ${(MIN_VIRAL_PROBABILITY * 100).toFixed(0)}% threshold`);
        console.log(`  🔄 RETRYING: Attempting with different generator...`);
        
        systemsActive.push('Viral Probability Gate [FAILED - RETRY]');
        
        // Retry with different generator (will use weighted random)
        return this.generateContent({
          ...request,
          forceGeneration: true // Prevent infinite loop
        });
      }
      
      if (prediction.viralProbability >= MIN_VIRAL_PROBABILITY) {
        console.log(`  ✅ VIRAL_GATE_PASSED: ${(prediction.viralProbability * 100).toFixed(1)}% >= ${(MIN_VIRAL_PROBABILITY * 100).toFixed(0)}%`);
        systemsActive.push('Viral Probability Gate [PASSED]');
      } else if (request.forceGeneration) {
        console.log(`  ⚠️ VIRAL_GATE_BYPASSED: forceGeneration=true (${(prediction.viralProbability * 100).toFixed(1)}%)`);
        systemsActive.push('Viral Probability Gate [BYPASSED]');
      }
      
      // ═══════════════════════════════════════════════════════════
      // STEP 8: ASSEMBLE RESULT
      // ═══════════════════════════════════════════════════════════
      const threadParts = aiResponse.thread || (aiResponse.content?.includes('\n\n') 
        ? aiResponse.content.split('\n\n').filter((s: string) => s.trim()) 
        : undefined);
      
      const result: GeneratedContent = {
        content: finalContent,
        threadParts,
        metadata: {
          quality_score: qualityResult.overall / 100,
          predicted_likes: prediction.predictedLikes,
          predicted_followers: prediction.predictedFollowerGrowth,
          viral_probability: prediction.viralProbability,
          confidence: prediction.confidence,
          
          // GENERATOR TRACKING (for autonomous learning)
          generator_name: generatorName,
          generator_confidence: confidence,
          
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
  // DYNAMIC WEIGHT LOADING (AUTONOMOUS LEARNING)
  // ═══════════════════════════════════════════════════════════
  
  /**
   * Load generator weights from database (autonomous learning system)
   */
  private async loadDynamicWeights(experimentArm: string, recentGenerators: string[] = []): Promise<Record<string, number>> {
    try {
      // ═══════════════════════════════════════════════════════════
      // USE EXISTING EXPLORATION MODE MANAGER
      // ═══════════════════════════════════════════════════════════
      const { getCurrentMode } = await import('../exploration/explorationModeManager');
      const explorationMode = await getCurrentMode();
      
      const hasEnoughData = explorationMode === 'exploitation';
      
      if (!hasEnoughData) {
        console.log(`🔬 EXPLORATION_MODE: followers < 200 or engagement < 10`);
        console.log(`🎲 Using EQUAL WEIGHTS for all generators (exploring)`);
        
        // EQUAL WEIGHTS for all 12 generators
        const equalWeights = {
          humanVoice: 1/12,
          newsReporter: 1/12,
          storyteller: 1/12,
          interesting: 1/12,
          provocateur: 1/12,
          dataNerd: 1/12,
          mythBuster: 1/12,
          coach: 1/12,
          thoughtLeader: 1/12,
          contrarian: 1/12,
          explorer: 1/12,
          philosopher: 1/12
        };
        
        // ROTATION LOGIC: Reduce weight for recently used to force variety
        if (recentGenerators.length > 0) {
          console.log(`🔄 Avoiding recently used: ${recentGenerators.slice(0, 3).join(', ')}`);
          
          for (const gen of recentGenerators.slice(0, 3)) { // Avoid last 3
            if (equalWeights[gen]) {
              equalWeights[gen] *= 0.01; // Almost zero chance of repeating
            }
          }
          
          // Renormalize to sum to 1.0
          const total = Object.values(equalWeights).reduce((sum, w) => sum + w, 0);
          for (const gen in equalWeights) {
            equalWeights[gen] /= total;
          }
        }
        
        return equalWeights;
      }
      
      // ═══════════════════════════════════════════════════════════
      // EXPLOITATION MODE: Use performance-based weights
      // ═══════════════════════════════════════════════════════════
      console.log(`🧠 EXPLOITATION_MODE: Using learned weights from performance data`);
      
      // Query database for current weights
      const { data, error } = await this.supabase
        .from('generator_weights')
        .select('generator_name, weight')
        .eq('status', 'active');
      
      if (error) {
        console.warn('⚠️ UNIFIED_ENGINE: Failed to load weights from DB, using defaults:', error.message);
        return this.getDefaultWeights(experimentArm);
      }
      
      if (!data || data.length === 0) {
        console.warn('⚠️ UNIFIED_ENGINE: No weights in DB, using defaults');
        return this.getDefaultWeights(experimentArm);
      }
      
      // Convert to weight object
      const weights: Record<string, number> = {};
      for (const row of data) {
        const typedRow = row as { generator_name: string; weight: number };
        weights[typedRow.generator_name] = typedRow.weight;
      }
      
      console.log(`✅ UNIFIED_ENGINE: Loaded ${data.length} generator weights from database`);
      
      // Apply experiment arm adjustments
      if (experimentArm === 'variant_a') {
        // Moderate exploration - flatten weights slightly
        return this.flattenWeights(weights, 0.3);
      } else if (experimentArm === 'variant_b') {
        // Aggressive exploration - boost low performers
        return this.boostLowPerformers(weights);
      }
      
      return weights;
      
    } catch (error: any) {
      console.error('❌ UNIFIED_ENGINE: Weight loading failed:', error.message);
      return this.getDefaultWeights(experimentArm);
    }
  }
  
  /**
   * Get default weights (fallback if DB fails)
   */
  private getDefaultWeights(experimentArm: string): Record<string, number> {
    return experimentArm === 'control'
      ? {
          // REBALANCED: More provocative/engaging, less protocol/academic
          humanVoice: 0.15,
          provocateur: 0.15,      // ↑ from 0.10 (more engaging)
          contrarian: 0.15,       // ↑ from 0.04 (more interesting)
          storyteller: 0.13,      // ↑ from 0.12 (better engagement)
          interesting: 0.10,
          dataNerd: 0.10,
          mythBuster: 0.10,
          thoughtLeader: 0.05,
          newsReporter: 0.04,     // ↓ from 0.12 (too academic)
          coach: 0.03,            // ↓ from 0.08 (too protocol-heavy)
          explorer: 0.02,
          philosopher: 0.02
        }
      : experimentArm === 'variant_a'
      ? {
          humanVoice: 0.10,
          newsReporter: 0.08,
          storyteller: 0.08,
          interesting: 0.08,
          provocateur: 0.08,
          dataNerd: 0.09,
          mythBuster: 0.09,
          coach: 0.10,
          thoughtLeader: 0.08,
          contrarian: 0.08,
          explorer: 0.07,
          philosopher: 0.07
        }
      : {
          humanVoice: 0.05,
          newsReporter: 0.06,
          storyteller: 0.10,
          interesting: 0.10,
          provocateur: 0.10,
          dataNerd: 0.08,
          mythBuster: 0.08,
          coach: 0.08,
          thoughtLeader: 0.10,
          contrarian: 0.10,
          explorer: 0.08,
          philosopher: 0.07
        };
  }
  
  /**
   * Flatten weight distribution for exploration
   */
  private flattenWeights(weights: Record<string, number>, factor: number): Record<string, number> {
    const avg = Object.values(weights).reduce((a, b) => a + b, 0) / Object.keys(weights).length;
    const flattened: Record<string, number> = {};
    
    for (const [gen, weight] of Object.entries(weights)) {
      flattened[gen] = weight * (1 - factor) + avg * factor;
    }
    
    // Normalize
    const total = Object.values(flattened).reduce((a, b) => a + b, 0);
    for (const gen in flattened) {
      flattened[gen] /= total;
    }
    
    return flattened;
  }
  
  /**
   * Boost low performers for exploration
   */
  private boostLowPerformers(weights: Record<string, number>): Record<string, number> {
    const boosted: Record<string, number> = {};
    const sorted = Object.entries(weights).sort((a, b) => a[1] - b[1]);
    const lowPerformers = sorted.slice(0, Math.ceil(sorted.length / 3)).map(([name]) => name);
    
    for (const [gen, weight] of Object.entries(weights)) {
      if (lowPerformers.includes(gen)) {
        boosted[gen] = weight * 1.3; // 30% boost
      } else {
        boosted[gen] = weight * 0.9; // 10% reduction
      }
    }
    
    // Normalize
    const total = Object.values(boosted).reduce((a, b) => a + b, 0);
    for (const gen in boosted) {
      boosted[gen] /= total;
    }
    
    return boosted;
  }
  
  // ═══════════════════════════════════════════════════════════
  // PERSONA SELECTION & GENERATION (THE REAL GENERATORS!)
  // ═══════════════════════════════════════════════════════════
  
  /**
   * Select and use one of the 12 REAL content generators you built
   * COMPLETE LIST:
   * 1. HumanVoice (5 voice styles)
   * 2. NewsReporter
   * 3. Storyteller
   * 4. InterestingContent
   * 5. Provocateur
   * 6. DataNerd
   * 7. MythBuster
   * 8. Coach
   * 9. ThoughtLeader
   * 10. Contrarian
   * 11. Explorer
   * 12. Philosopher
   */
  private async selectAndGenerateWithPersona(params: {
    topic: string;
    format: 'single' | 'thread';
    insights: ViralInsights;
    viralAnalysis: any;
    experimentArm: string;
    intelligence?: IntelligencePackage; // 🆕 ACCEPT INTELLIGENCE
    recentGenerators?: string[]; // 🆕 For rotation avoidance
  }): Promise<{ generatorName: string; content: string | string[]; confidence: number }> {
    
    // LOAD DYNAMIC WEIGHTS (with data collection mode + rotation avoidance)
    const generatorWeights = await this.loadDynamicWeights(
      params.experimentArm, 
      params.recentGenerators || []
    );
    
    // Weighted random selection using dynamic weights
    const random = Math.random();
    let cumulativeWeight = 0;
    let selectedGenerator: keyof typeof generatorWeights;
    
    for (const [gen, weight] of Object.entries(generatorWeights)) {
      cumulativeWeight += weight;
      if (random <= cumulativeWeight) {
        selectedGenerator = gen as keyof typeof generatorWeights;
        break;
      }
    }
    selectedGenerator = selectedGenerator! || 'humanVoice';
    
    console.log(`  🎯 Selected: ${selectedGenerator} (arm: ${params.experimentArm})`);
    
    try {
      // ═══════════════════════════════════════════════════════════
      // GENERATOR 1: HUMAN VOICE ENGINE (5 voice styles)
      // ═══════════════════════════════════════════════════════════
      if (selectedGenerator === 'humanVoice') {
        const result = await this.humanVoice.generateHumanContent({
          topic: params.topic,
          format: params.format,
          context: params.insights.topHooks.slice(0, 3).join(', ')
        });
        
        return {
          generatorName: `HumanVoice (${result.style_used})`,
          content: result.content,
          confidence: result.authenticity_score / 100
        };
      }
      
      // ═══════════════════════════════════════════════════════════
      // GENERATOR 2: NEWS REPORTER
      // ═══════════════════════════════════════════════════════════
      if (selectedGenerator === 'newsReporter') {
        const result = await generateNewsReporterContent({
          topic: params.topic,
          format: params.format,
          intelligence: params.intelligence
        });
        
        return {
          generatorName: 'NewsReporter',
          content: result.content,
          confidence: result.confidence
        };
      }
      
      // ═══════════════════════════════════════════════════════════
      // GENERATOR 3: STORYTELLER
      // ═══════════════════════════════════════════════════════════
      if (selectedGenerator === 'storyteller') {
        const result = await generateStorytellerContent({
          topic: params.topic,
          format: params.format,
          intelligence: params.intelligence
        });
        
        return {
          generatorName: 'Storyteller',
          content: result.content,
          confidence: result.confidence
        };
      }
      
      // ═══════════════════════════════════════════════════════════
      // GENERATOR 4: INTERESTING CONTENT
      // ═══════════════════════════════════════════════════════════
      if (selectedGenerator === 'interesting') {
        const result = await generateInterestingContent({
          topic: params.topic,
          format: params.format,
          intelligence: params.intelligence
        });
        
        return {
          generatorName: 'InterestingContent',
          content: result.content,
          confidence: result.confidence
        };
      }
      
      // ═══════════════════════════════════════════════════════════
      // GENERATOR 5: PROVOCATEUR
      // ═══════════════════════════════════════════════════════════
      if (selectedGenerator === 'provocateur') {
        const result = await generateProvocateurContent({
          topic: params.topic,
          format: params.format,
          intelligence: params.intelligence
        });
        
        return {
          generatorName: 'Provocateur',
          content: result.content,
          confidence: result.confidence
        };
      }
      
      // ═══════════════════════════════════════════════════════════
      // GENERATOR 6: DATA NERD
      // ═══════════════════════════════════════════════════════════
      if (selectedGenerator === 'dataNerd') {
        const result = await generateDataNerdContent({
          topic: params.topic,
          format: params.format,
          intelligence: params.intelligence // 🆕 PASS INTELLIGENCE
        });
        
        return {
          generatorName: 'DataNerd',
          content: result.content,
          confidence: result.confidence
        };
      }
      
      // ═══════════════════════════════════════════════════════════
      // GENERATOR 7: MYTH BUSTER
      // ═══════════════════════════════════════════════════════════
      if (selectedGenerator === 'mythBuster') {
        const result = await generateMythBusterContent({
          topic: params.topic,
          format: params.format,
          intelligence: params.intelligence
        });
        
        return {
          generatorName: 'MythBuster',
          content: result.content,
          confidence: result.confidence
        };
      }
      
      // ═══════════════════════════════════════════════════════════
      // GENERATOR 8: COACH
      // ═══════════════════════════════════════════════════════════
      if (selectedGenerator === 'coach') {
        const result = await generateCoachContent({
          topic: params.topic,
          format: params.format,
          intelligence: params.intelligence
        });
        
        return {
          generatorName: 'Coach',
          content: result.content,
          confidence: result.confidence
        };
      }
      
      // ═══════════════════════════════════════════════════════════
      // GENERATOR 9: THOUGHT LEADER
      // ═══════════════════════════════════════════════════════════
      if (selectedGenerator === 'thoughtLeader') {
        const result = await generateThoughtLeaderContent({
          topic: params.topic,
          format: params.format,
          intelligence: params.intelligence // 🆕 PASS INTELLIGENCE
        });
        
        return {
          generatorName: 'ThoughtLeader',
          content: result.content,
          confidence: result.confidence
        };
      }
      
      // ═══════════════════════════════════════════════════════════
      // GENERATOR 10: CONTRARIAN
      // ═══════════════════════════════════════════════════════════
      if (selectedGenerator === 'contrarian') {
        const result = await generateContrarianContent({
          topic: params.topic,
          format: params.format,
          intelligence: params.intelligence // 🆕 PASS INTELLIGENCE
        });
        
        return {
          generatorName: 'Contrarian',
          content: result.content,
          confidence: result.confidence
        };
      }
      
      // ═══════════════════════════════════════════════════════════
      // GENERATOR 11: EXPLORER
      // ═══════════════════════════════════════════════════════════
      if (selectedGenerator === 'explorer') {
        const result = await generateExplorerContent({
          topic: params.topic,
          format: params.format,
          intelligence: params.intelligence
        });
        
        return {
          generatorName: 'Explorer',
          content: result.content,
          confidence: result.confidence
        };
      }
      
      // ═══════════════════════════════════════════════════════════
      // GENERATOR 12: PHILOSOPHER
      // ═══════════════════════════════════════════════════════════
      if (selectedGenerator === 'philosopher') {
        const result = await generatePhilosopherContent({
          topic: params.topic,
          format: params.format,
          intelligence: params.intelligence
        });
        
        return {
          generatorName: 'Philosopher',
          content: result.content,
          confidence: result.confidence
        };
      }
      
      // Fallback (shouldn't reach here)
      throw new Error('No generator selected');
      
    } catch (error: any) {
      console.warn(`⚠️ ${selectedGenerator} failed: ${error.message}`);
      
      // Try fallback generators in order (avoiding first-person prone ones)
      const fallbackOrder = ['newsReporter', 'thoughtLeader', 'mythBuster', 'coach'];
      
      for (const fallbackGen of fallbackOrder) {
        if (fallbackGen === selectedGenerator) continue; // Skip if already tried
        
        try {
          console.log(`  🔄 Trying fallback: ${fallbackGen}...`);
          
          let result;
          switch (fallbackGen) {
            case 'newsReporter':
              result = await generateNewsReporterContent({
                topic: params.topic,
                format: params.format,
                intelligence: params.intelligence
              });
              break;
            case 'thoughtLeader':
              result = await generateThoughtLeaderContent({
                topic: params.topic,
                format: params.format,
                intelligence: params.intelligence
              });
              break;
            case 'mythBuster':
              result = await generateMythBusterContent({
                topic: params.topic,
                format: params.format,
                intelligence: params.intelligence
              });
              break;
            case 'coach':
              result = await generateCoachContent({
                topic: params.topic,
                format: params.format,
                intelligence: params.intelligence
              });
              break;
          }
          
          if (result) {
            console.log(`  ✅ Fallback ${fallbackGen} succeeded`);
            return {
              generatorName: `${fallbackGen} [Fallback]`,
              content: result.content,
              confidence: result.confidence
            };
          }
        } catch (fallbackError: any) {
          console.warn(`  ⚠️ Fallback ${fallbackGen} also failed: ${fallbackError.message}`);
          continue;
        }
      }
      
      // All fallbacks failed - throw error instead of using HumanVoice
      throw new Error(`All generators failed. Original: ${error.message}`);
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

