/**
 * 🤖 AUTONOMOUS POSTING ENGINE (ENHANCED & FIXED)
 * 
 * Core intelligence for autonomous tweet generation and posting with:
 * - Robust template selection (never undefined)
 * - Enhanced semantic uniqueness checking (0.75 threshold)
 * - Browser-based posting with confirmation
 * - Comprehensive error handling and logging
 * - Safety checks and was_posted flags
 */

// Core imports for autonomous posting
import { supabaseClient } from '../utils/supabaseClient';
import { emergencyBudgetLockdown } from '../utils/emergencyBudgetLockdown';
import { contentFactChecker } from '../utils/contentFactChecker';
import { isCleanStandaloneContent } from '../config/cleanPostingConfig';
import { isEmergencyBlockedContent } from '../config/emergencyContentValidation';
import { isNuclearBlockedContent } from '../config/nuclearContentValidation';
import { analyzeContentQuality, shouldPostContent } from '../utils/contentQualityAnalyzer';

interface PostingDecision {
  should_post: boolean;
  reason: string;
  confidence: number;
  strategy: 'aggressive' | 'balanced' | 'conservative';
  content?: string;
  wait_minutes?: number;
}

interface PostingResult {
  success: boolean;
  tweet_id?: string;
  error?: string;
  was_posted?: boolean;
  confirmed?: boolean;
  performance_metrics: {
    generation_time_ms: number;
    posting_time_ms: number;
    storage_time_ms: number;
    total_time_ms: number;
  };
  content_metadata?: {
    attempts_made: number;
    uniqueness_score?: number;
    template_used?: string;
    selection_method?: string;
  };
}

export class AutonomousPostingEngine {
  // 🚨 NUCLEAR VALIDATION ACTIVE - This is the ONLY posting system that should run
  // All other posting systems have been emergency disabled for quality issues
  private static instance: AutonomousPostingEngine;
  private lastPostTime: Date | null = null;
  private consecutiveFailures = 0;
  private readonly MAX_FAILURES = 3;

  private constructor() {
    // Initialize without external dependencies
  }

  static getInstance(): AutonomousPostingEngine {
    if (!AutonomousPostingEngine.instance) {
      AutonomousPostingEngine.instance = new AutonomousPostingEngine();
    }
    return AutonomousPostingEngine.instance;
  }

  /**
   * 🧠 INTELLIGENT POSTING DECISION
   */
  async makePostingDecision(): Promise<PostingDecision> {
    try {
      console.log('🧠 Making intelligent posting decision...');

      // Check budget status
      const lockdownStatus = await emergencyBudgetLockdown.isLockedDown();
      if (lockdownStatus.lockdownActive) {
        return {
          should_post: false,
          reason: 'Emergency budget lockdown active',
          confidence: 1.0,
          strategy: 'conservative',
          wait_minutes: 60
        };
      }

      // Get last post time from database
      const lastPost = await this.getLastPostFromDatabase();
      const now = new Date();
      const minutesSinceLastPost = lastPost 
        ? Math.floor((now.getTime() - new Date(lastPost.created_at).getTime()) / (1000 * 60))
        : 1000; // Large number if no posts

      console.log(`⏰ Minutes since last post: ${minutesSinceLastPost}`);

      // Realistic posting intervals for human-like behavior (3-8 posts/day)
      let requiredInterval: number;
      let strategy: 'aggressive' | 'balanced' | 'conservative';
      let confidence: number;

      if (this.consecutiveFailures >= 2) {
        // Conservative mode after failures
        requiredInterval = 360; // 6 hours
        strategy = 'conservative';
        confidence = 0.6;
      } else if (minutesSinceLastPost >= 480) {
        // Aggressive mode for catch-up (8+ hours)
        requiredInterval = 180; // 3 hours
        strategy = 'aggressive';
        confidence = 0.95;
      } else if (minutesSinceLastPost >= 240) {
        // Balanced mode (4+ hours)
        requiredInterval = 240; // 4 hours
        strategy = 'balanced';
        confidence = 0.85;
      } else {
        // Too soon - maintain human-like spacing
        const waitTime = 180 - minutesSinceLastPost; // Minimum 3 hours between posts
        return {
          should_post: false,
          reason: `Maintaining human-like posting frequency (${minutesSinceLastPost}min ago)`,
          confidence: 0.8,
          strategy: 'balanced',
          wait_minutes: Math.max(waitTime, 30)
        };
      }

      // Enhanced decision logic
      if (minutesSinceLastPost >= requiredInterval) {
        console.log(`✅ Decision: POST (${strategy} strategy, ${confidence * 100}% confidence)`);
        return {
          should_post: true,
          reason: `${strategy} posting after ${minutesSinceLastPost} minutes`,
          confidence,
          strategy
        };
      } else {
        const waitTime = requiredInterval - minutesSinceLastPost;
        return {
          should_post: false,
          reason: `Waiting for optimal interval (${waitTime} min remaining)`,
          confidence: 0.7,
          strategy,
          wait_minutes: waitTime
        };
      }

    } catch (error) {
      console.error('❌ Error making posting decision:', error);
      return {
        should_post: false,
        reason: `Decision error: ${error.message}`,
        confidence: 0.1,
        strategy: 'conservative',
        wait_minutes: 30
      };
    }
  }

  /**
   * 🚀 UNIFIED POSTING EXECUTION WITH ENHANCED SAFETY
   */
  async executePost(): Promise<PostingResult> {
    console.log('🚀 === AUTONOMOUS POSTING EXECUTION ===');
    
    const startTime = Date.now();
    let generationTime = 0;
    let postingTime = 0;
    let storageTime = 0;
    let contentGenerationAttempts = 0;
    const MAX_CONTENT_ATTEMPTS = 5;

    try {
      // Step 1: Generate unique content with enhanced deduplication
      console.log('🧠 Generating intelligent and unique content...');
      const generationStart = Date.now();
      
      let contentResult: any;
      let candidateContent: string;
      let uniquenessResult: any;
      
      // Retry loop for generating semantically unique content
      do {
        contentGenerationAttempts++;
        console.log(`🔄 Content generation attempt ${contentGenerationAttempts}/${MAX_CONTENT_ATTEMPTS}`);
        
        contentResult = await this.generateContent();
        
        if (!contentResult.success) {
          console.log(`❌ Content generation failed on attempt ${contentGenerationAttempts}: ${contentResult.error}`);
          break;
        }
        
        candidateContent = contentResult.content;
        console.log(`📝 Generated candidate: "${candidateContent.substring(0, 100)}..."`);
        
        // Enhanced semantic uniqueness check (0.75 threshold)
        const { enhancedSemanticUniqueness } = await import('../utils/enhancedSemanticUniqueness');
        uniquenessResult = await enhancedSemanticUniqueness.checkUniqueness(
          candidateContent,
          contentGenerationAttempts
        );

        if (!uniquenessResult.success) {
          console.warn(`⚠️ Uniqueness check failed: ${uniquenessResult.error}. Proceeding with caution.`);
          break;
        }

        if (uniquenessResult.isUnique) {
          console.log('✅ Content is semantically unique - proceeding with posting');
          break;
        } else {
          const similarity = uniquenessResult.analysis.maxSimilarity;
          console.log(`🛑 Content too similar to previous posts (similarity: ${(similarity * 100).toFixed(1)}%)`);
          
          if (uniquenessResult.suppressionReasons && uniquenessResult.suppressionReasons.length > 0) {
            console.log(`📋 Suppression reasons: ${uniquenessResult.suppressionReasons.join(', ')}`);
          }
          
          if (contentGenerationAttempts >= MAX_CONTENT_ATTEMPTS) {
            console.log('⚠️ Max content generation attempts reached - posting anyway to maintain frequency');
            break;
          } else {
            console.log('🔄 Regenerating content for uniqueness...');
          }
        }
        
      } while (contentGenerationAttempts < MAX_CONTENT_ATTEMPTS);
      
      generationTime = Date.now() - generationStart;
      
      if (!contentResult.success) {
        this.consecutiveFailures++;
        return {
          success: false,
          error: `Content generation failed after ${contentGenerationAttempts} attempts: ${contentResult.error}`,
          was_posted: false,
          confirmed: false,
          performance_metrics: {
            generation_time_ms: generationTime,
            posting_time_ms: 0,
            storage_time_ms: 0,
            total_time_ms: Date.now() - startTime
          },
          content_metadata: {
            attempts_made: contentGenerationAttempts
          }
        };
      }

      console.log(`✅ Content generation completed after ${contentGenerationAttempts} attempts`);

      // Step 2: Post to Twitter with enhanced confirmation
      console.log('🐦 Posting to Twitter with confirmation...');
      const postingStart = Date.now();
      
      const twitterResult = await this.postToTwitter(contentResult.content);
      postingTime = Date.now() - postingStart;
      
      if (!twitterResult.success) {
        this.consecutiveFailures++;
        return {
          success: false,
          error: `Twitter posting failed: ${twitterResult.error}`,
          was_posted: false,
          confirmed: false,
          performance_metrics: {
            generation_time_ms: generationTime,
            posting_time_ms: postingTime,
            storage_time_ms: 0,
            total_time_ms: Date.now() - startTime
          },
          content_metadata: {
            attempts_made: contentGenerationAttempts,
            uniqueness_score: uniquenessResult?.analysis?.maxSimilarity,
            template_used: contentResult.metadata?.template_name,
            selection_method: contentResult.metadata?.selection_method
          }
        };
      }

      // Step 3: Enhanced database storage with safety flags
      console.log('💾 Storing in database with safety flags...');
      const storageStart = Date.now();
      
      const storageResult = await this.storeInDatabase(
        twitterResult.tweet_id!,
        contentResult.content,
        {
          ...contentResult.metadata,
          was_posted: twitterResult.was_posted || false,
          confirmed: twitterResult.confirmed || false,
          posting_method: 'browser_automation',
          uniqueness_score: uniquenessResult?.analysis?.maxSimilarity,
          similarity_breakdown: uniquenessResult?.analysis?.similarityBreakdown?.slice(0, 3),
          generation_attempts: contentGenerationAttempts,
          template_selection_method: contentResult.metadata?.selection_method
        },
        twitterResult.confirmed || false
      );
      storageTime = Date.now() - storageStart;

      // Step 4: Store semantic embedding and core idea
      console.log('🧠 Storing semantic embedding and core idea...');
      if (candidateContent && uniquenessResult?.analysis) {
        const { enhancedSemanticUniqueness } = await import('../utils/enhancedSemanticUniqueness');
        if (uniquenessResult.analysis.embedding.length > 0) {
          await enhancedSemanticUniqueness.storeEmbedding(
            twitterResult.tweet_id!,
            uniquenessResult.analysis.embedding,
            uniquenessResult.analysis
          );
        }
      }

      // Step 5: Initialize engagement tracking
      console.log('📊 Initializing engagement tracking...');
      await this.initializeEngagementTracking(
        twitterResult.tweet_id!,
        contentResult.content,
        contentResult.metadata
      );

      // Step 6: Success handling
      this.lastPostTime = new Date();
      this.consecutiveFailures = 0;

      const totalTime = Date.now() - startTime;
      console.log(`✅ AUTONOMOUS POST COMPLETE in ${totalTime}ms`);
      console.log(`   🧠 Generation: ${generationTime}ms`);
      console.log(`   🐦 Twitter: ${postingTime}ms`);
      console.log(`   💾 Storage: ${storageTime}ms`);
      console.log(`   ✅ Confirmed: ${twitterResult.confirmed ? 'YES' : 'NO'}`);
      console.log(`   🆔 Tweet ID: ${twitterResult.tweet_id}`);

      return {
        success: true,
        tweet_id: twitterResult.tweet_id!,
        was_posted: twitterResult.was_posted || false,
        confirmed: twitterResult.confirmed || false,
        performance_metrics: {
          generation_time_ms: generationTime,
          posting_time_ms: postingTime,
          storage_time_ms: storageTime,
          total_time_ms: totalTime
        },
        content_metadata: {
          attempts_made: contentGenerationAttempts,
          uniqueness_score: uniquenessResult?.analysis?.maxSimilarity,
          template_used: contentResult.metadata?.template_name,
          selection_method: contentResult.metadata?.selection_method
        }
      };

    } catch (error) {
      this.consecutiveFailures++;
      console.error('❌ AUTONOMOUS POSTING FAILED:', error);
      
      return {
        success: false,
        error: `Posting execution failed: ${error.message}`,
        was_posted: false,
        confirmed: false,
        performance_metrics: {
          generation_time_ms: generationTime,
          posting_time_ms: postingTime,
          storage_time_ms: storageTime,
          total_time_ms: Date.now() - startTime
        },
        content_metadata: {
          attempts_made: contentGenerationAttempts
        }
      };
    }
  }

  /**
   * 🎨 GENERATE CONTENT WITH BANDIT-DRIVEN INTELLIGENT SELECTION
   */
  private async generateContent(): Promise<{
    success: boolean;
    content?: string;
    metadata?: any;
    error?: string;
  }> {
    try {
      console.log('🧠 Generating content with bandit-driven learning system...');

      // Step 1: Use bandit algorithm to select optimal format
      const { banditFormatSelector } = await import('../intelligence/banditFormatSelector');
      
      const banditSelection = await banditFormatSelector.selectFormat({
        exploration_rate: 0.15, // 15% exploration, 85% exploitation
        exclude_recent: true,    // Avoid recently used formats
        min_sample_size: 2       // Require at least 2 posts for confidence
      });

      console.log(`🎰 Bandit selected: ${banditSelection.format_type}/${banditSelection.hook_type}/${banditSelection.content_category}`);
      console.log(`📊 Selection confidence: ${(banditSelection.confidence * 100).toFixed(1)}%`);
      console.log(`💡 Reasoning: ${banditSelection.reasoning}`);

      // Step 2: Get optimal timing information
      const now = new Date();
      const timingInfo = {
        hour_of_day: now.getHours(),
        day_of_week: now.getDay(),
        posted_hour: now.getHours(),
        posted_day_of_week: now.getDay()
      };

      // Step 3: Use the elite Twitter content strategist with bandit-selected format
      const { EliteTwitterContentStrategist } = await import('../agents/eliteTwitterContentStrategist');
      const eliteStrategist = EliteTwitterContentStrategist.getInstance();
      
      const contentRequest = {
        topic: banditSelection.content_category || this.getOptimalTopic(),
        format_preference: this.mapFormatToPreference(banditSelection.format_type),
        tone: this.getOptimalTone() as 'authoritative' | 'conversational' | 'provocative',
        target_engagement: 25, // Target 25% engagement rate
        format_type: banditSelection.format_type,
        hook_type: banditSelection.hook_type
      };

      console.log(`🎯 Elite content request: ${JSON.stringify(contentRequest)}`);
      
      const eliteResult = await eliteStrategist.generateViralContent(contentRequest);

      if (!eliteResult || !eliteResult.content) {
        console.warn('⚠️ Elite generation failed, falling back to enhanced content generator');
        return await this.fallbackContentGeneration();
      }

      const contentString = Array.isArray(eliteResult.content) ? 
        eliteResult.content.join('\n\n') : 
        eliteResult.content;

      console.log(`✅ Elite content generated: "${contentString.substring(0, 100)}..."`);
      console.log(`📊 Predicted engagement: ${eliteResult.predicted_engagement}%`);
      console.log(`🎯 Format used: ${eliteResult.format_used}`);
      console.log(`🎪 Hook type: ${eliteResult.hook_type}`);

      return {
        success: true,
        content: contentString,
        metadata: {
          generation_method: 'bandit_elite_strategist',
          format_type: banditSelection.format_type,
          hook_type: banditSelection.hook_type,
          content_category: banditSelection.content_category,
          format_used: eliteResult.format_used,
          predicted_engagement: eliteResult.predicted_engagement,
          content_type: eliteResult.content_type,
          reasoning: eliteResult.reasoning,
          bandit_confidence: banditSelection.confidence,
          bandit_reasoning: banditSelection.reasoning,
          timing_info: timingInfo
        }
      };

    } catch (error) {
      console.error('❌ Bandit-driven content generation failed:', error);
      return await this.fallbackContentGeneration();
    }
  }

  private getOptimalTopic(): string {
    const topics = ['health_optimization', 'longevity_science', 'nutrition_myths', 'biohacking', 'mental_performance'];
    return topics[Math.floor(Math.random() * topics.length)];
  }

  private getOptimalLength(): 'short' | 'medium' | 'long' {
    const hour = new Date().getHours();
    if (hour < 10) return 'short'; // Morning - quick tips
    if (hour < 15) return 'medium'; // Afternoon - detailed insights  
    return 'long'; // Evening - comprehensive content
  }

  private getOptimalTone(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'authoritative';     // Morning: authority
    if (hour < 18) return 'conversational';   // Afternoon: accessible
    return 'provocative';                      // Evening: engaging
  }

  private getOptimalFormat(): 'short' | 'thread' | 'auto' {
    const hour = new Date().getHours();
    if (hour < 10) return 'short';    // Morning: quick insights
    if (hour < 16) return 'thread';   // Afternoon: detailed content
    return 'auto';                    // Evening: algorithm decides
  }

  /**
   * 🔍 Check if content is an incomplete hook without value
   */
  private isIncompleteHookContent(content: string): boolean {
    const incompletePatterns = [
      /here's how to .+(?:in \d+ minutes?)?:?\s*$/i,
      /here are \d+ ways to .+:?\s*$/i,
      /the secret to .+ is:?\s*$/i,
      /\d+ tips for .+:?\s*$/i,
      /want to know how to .+\?\s*$/i,
      /i'll show you how to .+:?\s*$/i,
      /learn how to .+ in .+:?\s*$/i,
      /discover the .+ that .+:?\s*$/i,
      /here's what i found:?\s*$/i,
      /this will change everything:?\s*$/i
    ];

    // Check if content ends with a hook pattern without substance
    for (const pattern of incompletePatterns) {
      if (pattern.test(content.trim())) {
        console.log(`🚨 Detected incomplete hook pattern: ${pattern.source}`);
        return true;
      }
    }

    // Check for very short content that looks like just a hook
    if (content.trim().length < 50 && 
        (content.includes('how to') || content.includes('ways to') || content.includes('secret to'))) {
      console.log('🚨 Detected suspiciously short hook-like content');
      return true;
    }

    return false;
  }

  private async fallbackContentGeneration(): Promise<any> {
    try {
      // Use enhanced content generator as fallback
      const { EnhancedContentGenerator } = await import('../agents/enhancedContentGenerator');
      const enhancedGenerator = new EnhancedContentGenerator();
      
      const fallbackResult = await enhancedGenerator.generatePost();
      
      return {
        success: true,
        content: Array.isArray(fallbackResult.content) ? 
          fallbackResult.content.join('\n\n') : 
          fallbackResult.content,
        metadata: {
          generation_method: 'enhanced_fallback',
          format: fallbackResult.format.type,
          estimated_engagement: fallbackResult.metadata.estimated_engagement
        }
      };
    } catch (error) {
      console.error('❌ Fallback generation also failed:', error);
      return {
        success: false,
        error: `All generation methods failed: ${error.message}`
      };
    }
  }

  /**
   * 🐦 POST TO TWITTER WITH ENHANCED CONFIRMATION
   */
  private async postToTwitter(content: string): Promise<{
    success: boolean;
    tweet_id?: string;
    error?: string;
    was_posted?: boolean;
    confirmed?: boolean;
  }> {
    try {
      console.log('🔍 Pre-posting content validation...');
      
      // Step 1: Clean content validation
      if (!isCleanStandaloneContent(content)) {
        console.error('❌ Content failed clean posting validation');
        return {
          success: false,
          error: 'Content appears to be reply-like or templated',
          was_posted: false,
          confirmed: false
        };
      }

      // Step 1.5: Complete content validation (no incomplete hooks)
      if (this.isIncompleteHookContent(content)) {
        console.error('❌ Content failed completeness validation - appears to be incomplete hook');
        return {
          success: false,
          error: 'Content is incomplete hook without delivering value',
          was_posted: false,
          confirmed: false
        };
      }

      // Step 1.6: Emergency content validation (nuclear safety)
      if (isEmergencyBlockedContent(content)) {
        console.error('🚨 EMERGENCY BLOCK: Content matches emergency blocked patterns');
        return {
          success: false,
          error: 'Content blocked by emergency validation - fake or incomplete content detected',
          was_posted: false,
          confirmed: false
        };
      }

      // Step 1.7: NUCLEAR content validation (absolute last resort)
      if (isNuclearBlockedContent(content)) {
        console.error('🚨 NUCLEAR BLOCK: Content matches nuclear blocked patterns');
        return {
          success: false,
          error: 'Content blocked by NUCLEAR validation - absolutely forbidden content detected',
          was_posted: false,
          confirmed: false
        };
      }

      // Step 1.8: Content quality analysis for audience growth
      console.log('🎯 Analyzing content quality for viral potential...');
      const qualityAnalysis = analyzeContentQuality(content);
      
      if (!shouldPostContent(qualityAnalysis)) {
        console.error('❌ Content failed quality analysis for audience building');
        console.log('📊 Quality Analysis:');
        console.log(`   Viral Score: ${qualityAnalysis.viral_score}/100`);
        console.log(`   Issues: ${qualityAnalysis.quality_issues.join(', ')}`);
        console.log(`   Improvements: ${qualityAnalysis.improvements.join(', ')}`);
        
        return {
          success: false,
          error: `Content quality too low for audience building: ${qualityAnalysis.quality_issues.join(', ')}`,
          was_posted: false,
          confirmed: false
        };
      }
      
      console.log(`✅ Content quality analysis passed - Viral Score: ${qualityAnalysis.viral_score}/100`);

      // Step 2: Fact-checking gate
      console.log('🔍 Running fact-check validation...');
      const factCheck = await contentFactChecker.checkContent({
        content: content,
        contentType: 'tweet',
        strictMode: false // Normal mode for tweets
      });

      if (!factCheck.shouldPost) {
        console.error(`❌ Content failed fact check: ${factCheck.reasoning}`);
        console.log(`   Issues: ${factCheck.issues.join(', ')}`);
        console.log(`   Risk level: ${factCheck.riskLevel}`);
        
        return {
          success: false,
          error: `Fact check failed: ${factCheck.reasoning}`,
          was_posted: false,
          confirmed: false
        };
      }

      console.log(`✅ Content passed fact check (confidence: ${(factCheck.confidence * 100).toFixed(0)}%)`);
      if (factCheck.corrections.length > 0) {
        console.log(`💡 Suggestions: ${factCheck.corrections.join(', ')}`);
      }

      // Step 3: Post to Twitter via browser automation
      console.log('🐦 Posting to Twitter via browser automation...');
      
      const { browserTweetPoster } = await import('../utils/browserTweetPoster');
      const result = await browserTweetPoster.postTweet(content);

      if (result.success) {
        console.log('✅ Tweet posted successfully via browser automation');
        console.log(`   🆔 Tweet ID: ${result.tweet_id}`);
        console.log(`   ✅ Confirmed: ${result.confirmed ? 'YES' : 'NO'}`);
        console.log(`   📝 Was Posted: ${result.was_posted ? 'YES' : 'NO'}`);
        
        return {
          success: true,
          tweet_id: result.tweet_id,
          was_posted: result.was_posted || false,
          confirmed: result.confirmed || false
        };
      } else {
        console.error('❌ Browser tweet posting failed:', result.error);
        return {
          success: false,
          error: result.error || 'Browser posting failed',
          was_posted: false,
          confirmed: false
        };
      }

    } catch (error) {
      console.error('❌ Twitter posting error:', error);
      return {
        success: false,
        error: `Posting error: ${error.message}`,
        was_posted: false,
        confirmed: false
      };
    }
  }

  /**
   * 💾 STORE IN DATABASE WITH ENHANCED SAFETY FLAGS
   */
  private async storeInDatabase(
    tweetId: string,
    content: string,
    metadata: any,
    confirmed: boolean
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`💾 Storing tweet in learning database: ${tweetId}`);

      const now = new Date();
      const tweetData = {
        tweet_id: tweetId,
        content,
        quality_score: metadata.predicted_engagement || 75,
        quality_issues: [],
        audience_growth_potential: metadata.predicted_engagement || 75,
        was_posted: confirmed,
        post_reason: `Auto-posted by ${metadata.generation_method || 'system'}`,
        created_at: now.toISOString(),
        content_length: content.length,
        has_hook: this.hasHook(content),
        has_call_to_action: this.hasCallToAction(content),
        posting_hour: now.getHours(),
        posting_day_of_week: now.getDay(),
        format_type: metadata.format_type || 'unknown',
        hook_type: metadata.hook_type || 'unknown',
        content_category: metadata.content_category || 'general',
        bandit_confidence: metadata.bandit_confidence || 0.5,
        predicted_engagement: metadata.predicted_engagement || 0
      };

      // Store in learning_posts table
      const { error: learningError } = await supabaseClient.supabase
        .from('learning_posts')
        .insert(tweetData);

      if (learningError) {
        console.error('❌ Error storing in learning_posts:', learningError);
      } else {
        console.log('✅ Stored in learning_posts table');
      }

      // Also store in main tweets table for backward compatibility
      const { error: tweetsError } = await supabaseClient.supabase
        .from('tweets')
        .insert({
          id: tweetId,
          content,
          posted: confirmed,
          created_at: now.toISOString(),
          tweet_data: metadata
        });

      if (tweetsError) {
        console.warn('⚠️ Could not store in tweets table:', tweetsError);
      }

      // Initialize format stats if this is a new format combination
      if (metadata.format_type && metadata.hook_type && metadata.content_category) {
        await this.initializeFormatStats(
          metadata.format_type,
          metadata.hook_type,
          metadata.content_category
        );
      }

      return { success: true };

    } catch (error) {
      console.error('❌ Database storage failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 🆕 INITIALIZE FORMAT STATS FOR NEW COMBINATIONS
   */
  private async initializeFormatStats(formatType: string, hookType: string, contentCategory: string): Promise<void> {
    try {
      // Check if stats already exist
      const { data: existingStats } = await supabaseClient.supabase
        .from('format_stats')
        .select('id')
        .eq('format_type', formatType)
        .eq('hook_type', hookType)
        .eq('content_category', contentCategory)
        .single();

      if (!existingStats) {
        // Initialize new format stats entry
        await supabaseClient.supabase
          .from('format_stats')
          .insert({
            format_type: formatType,
            hook_type: hookType,
            content_category: contentCategory,
            total_posts: 0,
            avg_likes: 0,
            avg_retweets: 0,
            avg_engagement_rate: 0,
            total_reward: 0,
            avg_reward: 0,
            alpha: 1, // Beta distribution priors
            beta: 1,
            last_updated: new Date().toISOString()
          });

        console.log(`🆕 Initialized format stats: ${formatType}/${hookType}/${contentCategory}`);
      }
    } catch (error) {
      console.warn('⚠️ Could not initialize format stats:', error);
    }
  }

  /**
   * 📊 INITIALIZE ENGAGEMENT TRACKING
   */
  private async initializeEngagementTracking(
    tweetId: string,
    content: string,
    metadata: any
  ): Promise<void> {
    try {
      // Initialize performance tracking entry
      const performanceData = {
        tweet_id: tweetId,
        content: content,
        tone: metadata.template_tone || 'unknown',
        content_type: metadata.template_type || 'unknown',
        engagement_score: 0,
        likes: 0,
        retweets: 0,
        replies: 0,
        impressions: 0,
        engagement_rate: 0,
        posting_time: new Date().toISOString(),
        analyzed_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      };

      await supabaseClient.supabase
        .from('tweet_performance_analysis')
        .insert(performanceData);

      console.log('📊 Engagement tracking initialized');
    } catch (error) {
      console.warn('⚠️ Failed to initialize engagement tracking:', error.message);
    }
  }

  /**
   * 📚 GET LAST POST FROM DATABASE
   */
  private async getLastPostFromDatabase(): Promise<any> {
    try {
      const { data, error } = await supabaseClient.supabase
        .from('tweets')
        .select('created_at, id, was_posted, confirmed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        console.log('📚 No previous posts found in database');
        return null;
      }

      console.log(`📚 Last post: ${data.id} at ${data.created_at} (posted: ${data.was_posted}, confirmed: ${data.confirmed})`);
      return data;
    } catch (error) {
      console.warn('⚠️ Failed to get last post from database:', error.message);
      return null;
    }
  }

  /**
   * 📈 GET POSTING STATISTICS
   */
  async getPostingStats(): Promise<{
    total_posts: number;
    successful_posts: number;
    confirmed_posts: number;
    last_24h_posts: number;
    avg_posting_interval_minutes: number;
    consecutive_failures: number;
  }> {
    try {
      const { data: allPosts } = await supabaseClient.supabase
        .from('tweets')
        .select('created_at, was_posted, confirmed')
        .order('created_at', { ascending: false });

      if (!allPosts) {
        return {
          total_posts: 0,
          successful_posts: 0,
          confirmed_posts: 0,
          last_24h_posts: 0,
          avg_posting_interval_minutes: 0,
          consecutive_failures: this.consecutiveFailures
        };
      }

      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const stats = {
        total_posts: allPosts.length,
        successful_posts: allPosts.filter(p => p.was_posted).length,
        confirmed_posts: allPosts.filter(p => p.confirmed).length,
        last_24h_posts: allPosts.filter(p => new Date(p.created_at) > last24h).length,
        avg_posting_interval_minutes: 0,
        consecutive_failures: this.consecutiveFailures
      };

      // Calculate average interval
      if (allPosts.length > 1) {
        const intervals = [];
        for (let i = 0; i < allPosts.length - 1; i++) {
          const current = new Date(allPosts[i].created_at);
          const next = new Date(allPosts[i + 1].created_at);
          intervals.push((current.getTime() - next.getTime()) / (1000 * 60));
        }
        stats.avg_posting_interval_minutes = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
      }

      return stats;
    } catch (error) {
      console.error('❌ Failed to get posting stats:', error);
      return {
        total_posts: 0,
        successful_posts: 0,
        confirmed_posts: 0,
        last_24h_posts: 0,
        avg_posting_interval_minutes: 0,
        consecutive_failures: this.consecutiveFailures
      };
    }
  }

  /**
   * 🗺️ MAP BANDIT FORMAT TO PREFERENCE
   */
  private mapFormatToPreference(formatType: string): 'short' | 'thread' | 'auto' {
    const formatMap = {
      'data_insight': 'short',
      'story_format': 'thread',
      'question_format': 'short',
      'myth_buster': 'short',
      'personal_story': 'thread',
      'controversial_take': 'short',
      'how_to_guide': 'thread',
      'scientific_breakdown': 'thread'
    };
    
    return formatMap[formatType] || 'auto';
  }

  /**
   * 🔍 Check if content contains a hook (e.g., "here's how to", "here are", "the secret to")
   */
  private hasHook(content: string): boolean {
    const hookPatterns = [
      /here's how to .+(?:in \d+ minutes?)?:?\s*$/i,
      /here are \d+ ways to .+:?\s*$/i,
      /the secret to .+ is:?\s*$/i,
      /\d+ tips for .+:?\s*$/i,
      /want to know how to .+\?\s*$/i,
      /i'll show you how to .+:?\s*$/i,
      /learn how to .+ in .+:?\s*$/i,
      /discover the .+ that .+:?\s*$/i,
      /here's what i found:?\s*$/i,
      /this will change everything:?\s*$/i
    ];

    return hookPatterns.some(pattern => pattern.test(content.trim()));
  }

  /**
   * 🔍 Check if content contains a call-to-action (e.g., "click here", "learn more", "subscribe")
   */
  private hasCallToAction(content: string): boolean {
    const ctaPatterns = [
      /click here/i,
      /learn more/i,
      /subscribe/i,
      /follow/i,
      /join/i,
      /register/i,
      /download/i,
      /get started/i,
      /start now/i,
      /begin/i
    ];

    return ctaPatterns.some(pattern => pattern.test(content.trim()));
  }
}

export const autonomousPostingEngine = AutonomousPostingEngine.getInstance(); 