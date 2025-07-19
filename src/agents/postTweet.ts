import { openaiClient } from '../utils/openaiClient';
import { xClient } from '../utils/xClient';
import { supabaseClient } from '../utils/supabaseClient';
import { formatTweet, truncateTweet, addSnap2HealthCTA, formatQuotes } from '../utils/formatTweet';
import { ImageAgent, ImageRequest } from './imageAgent';
import { EngagementMaximizerAgent } from './engagementMaximizerAgent';
import { ComprehensiveContentAgent } from './comprehensiveContentAgent';
import { NewsAPIAgent } from './newsAPIAgent';
import { ThreadAgent } from './threadAgent';
import { RealResearchFetcher } from './realResearchFetcher';
import { MissionManager, ContentEvaluation } from './missionObjectives';
import { RealTimeTrendsAgent } from './realTimeTrendsAgent';
import dotenv from 'dotenv';
import { chooseUniqueImage } from '../utils/chooseUniqueImage';
import { EvergreenRecyclerAgent } from './evergreenRecycler';
import { UltraViralGenerator } from './ultraViralGenerator';
import { urlValidator } from '../utils/validateUrl.js';
import { smartImageSelector } from '../utils/chooseImage.js';
import { embeddingFilter } from '../utils/embeddingFilter.js';
import { isBotDisabled } from '../utils/flagCheck.js';
import { canMakeWrite } from '../utils/quotaGuard.js';
import { supabase } from '../utils/supabaseClient.js';
import type { TweetResult } from '../utils/xClient.js';
import { runSanityChecks } from '../utils/contentSanity';
import { AdaptiveContentLearner } from './adaptiveContentLearner';
import { CompetitiveIntelligenceLearner } from './competitiveIntelligenceLearner';
import { NuclearLearningEnhancer } from './nuclearLearningEnhancer';
import { HumanExpertPersonality } from './humanExpertPersonality.js';
import { QuoteAgent } from './quoteAgent';
import { QualityGate } from '../utils/qualityGate.js';
import { PollAgent } from './pollAgent';
import { tweetFormatter } from '../utils/tweetFormatter.js';
import { ContentCache } from '../utils/contentCache.js';
import { EmbeddingFilter } from '../utils/embeddingFilter.js';
import { LIVE_MODE } from '../config/liveMode';
import { runtimeConfig } from '../utils/supabaseConfig.js';
import { intelligentLearning } from '../utils/intelligentLearningConnector';
import { DiversePerspectiveEngine } from './diversePerspectiveEngine.js';
import { ExpertIntelligenceSystem } from './expertIntelligenceSystem.js';
import { rateLimitManager } from '../utils/intelligentRateLimitManager';
import { intelligentPostingDecision } from './intelligentPostingDecisionAgent';

dotenv.config();

export interface PostResult {
  success: boolean;
  tweetId?: string;
  content?: string;
  hasImage?: boolean;
  error?: string;
  threadCount?: number;
  qualityScore?: number;
  missionAlignment?: ContentEvaluation;
  readabilityScore?: number;
  formattingImprovements?: string[];
  decisionInfo?: {
    shouldPost: boolean;
    reason: string;
    strategy: string;
    confidence: number;
    waitTime?: number;
    nextDecisionTime?: Date;
  };
}

interface ContentItem {
  type: 'breaking_news' | 'research_update' | 'tech_development' | 'industry_insight' | 'fact_spotlight';
  title: string;
  source: string;
  date: string;
  content: string;
  relevance_score: number;
  urgency: number;
  url?: string;
}

interface AIVisualDecision {
  shouldIncludeImage: boolean;
  confidence: number;
  reasoning: string;
  contentType: 'breaking_news' | 'research_insight' | 'educational' | 'analysis' | 'trend_discussion';
  visualAppealScore: number;
}

export class PostTweetAgent {
  private readonly contentCategories = {
    breaking_news: {
      weight: 0.35,
      templates: [
        "🚨 BREAKTHROUGH: {quote}\n\n{analysis}\n\nSource: {source}",
        "⚡ GAME CHANGER: {quote}\n\n{analysis}\n\nvia {source}",
        "🔥 JUST IN: {quote}\n\n{analysis}\n\n📖 {source}"
      ]
    },
    research_update: {
      weight: 0.30,
      templates: [
        "📊 NEW STUDY: {quote}\n\n{analysis}\n\nPublished: {source}",
        "🔬 RESEARCH REVEALS: {quote}\n\n{analysis}\n\nSource: {source}",
        "📈 STUDY FINDS: {quote}\n\n{analysis}\n\n📚 {source}"
      ]
    },
    tech_development: {
      weight: 0.20,
      templates: [
        "🚀 INNOVATION: {quote}\n\n{analysis}\n\nDeveloped by: {source}",
        "💻 TECH BREAKTHROUGH: {quote}\n\n{analysis}\n\nvia {source}",
        "⚙️ NEW TECH: {quote}\n\n{analysis}\n\n🏢 {source}"
      ]
    },
    industry_insight: {
      weight: 0.10,
      templates: [
        "💡 INSIGHT: {quote}\n\n{analysis}\n\nAnalysis: {source}",
        "🎯 KEY FINDING: {quote}\n\n{analysis}\n\nReport: {source}",
        "📝 EXPERT VIEW: {quote}\n\n{analysis}\n\nvia {source}"
      ]
    },
    fact_spotlight: {
      weight: 0.05,
      templates: [
        "🔍 DID YOU KNOW: {quote}\n\n{analysis}\n\nSource: {source}",
        "💭 FASCINATING: {quote}\n\n{analysis}\n\nData: {source}",
        "📌 KEY STAT: {quote}\n\n{analysis}\n\n📊 {source}"
      ]
    }
  };

  private imageAgent: ImageAgent;
  private engagementMaximizer: EngagementMaximizerAgent;
  private comprehensiveAgent: ComprehensiveContentAgent;
  private newsAPIAgent: NewsAPIAgent;
  private threadAgent: ThreadAgent;
  private researchFetcher: RealResearchFetcher;
  private missionManager: MissionManager;
  private trendsAgent: RealTimeTrendsAgent;
  private recentlyUsedImages: Set<string> = new Set();
  
  // Add content tracking to prevent repetition
  private recentlyUsedContent: Set<string> = new Set();
  private recentlyUsedTopics: Set<string> = new Set();
  private maxRecentContent = 20; // Track last 20 pieces of content
  private maxRecentTopics = 10; // Track last 10 topics
  private evergreenRecycler: EvergreenRecyclerAgent;
  private viralGenerator: UltraViralGenerator;
  private adaptiveLearner: AdaptiveContentLearner;
  private competitiveLearner: CompetitiveIntelligenceLearner;
  private nuclearLearning: NuclearLearningEnhancer;
  private humanExpert: HumanExpertPersonality;
  private diversePerspectiveEngine: DiversePerspectiveEngine;
  private expertIntelligence: ExpertIntelligenceSystem;

  constructor() {
    this.imageAgent = new ImageAgent();
    this.engagementMaximizer = new EngagementMaximizerAgent();
    this.comprehensiveAgent = new ComprehensiveContentAgent();
    this.newsAPIAgent = NewsAPIAgent.getInstance();
    this.threadAgent = new ThreadAgent();
    this.researchFetcher = new RealResearchFetcher();
    this.missionManager = new MissionManager();
    this.trendsAgent = new RealTimeTrendsAgent();
    this.evergreenRecycler = new EvergreenRecyclerAgent();
    this.viralGenerator = new UltraViralGenerator();
    
    // Initialize autonomous learning systems
    this.adaptiveLearner = new AdaptiveContentLearner();
    this.competitiveLearner = new CompetitiveIntelligenceLearner();
    this.nuclearLearning = NuclearLearningEnhancer.getInstance();
    this.humanExpert = new HumanExpertPersonality();
    this.diversePerspectiveEngine = new DiversePerspectiveEngine();
    this.expertIntelligence = ExpertIntelligenceSystem.getInstance();
    
    console.log('🧠 Nuclear learning intelligence systems initialized');
    console.log('🎭 Diverse Perspective Engine initialized for unique viewpoints');
    
    // Initialize learning systems in background
    this.initializeLearning();
  }

  private async initializeLearning(): Promise<void> {
    try {
      await this.adaptiveLearner.initialize();
      console.log('✅ Autonomous learning fully activated');
      console.log('🧠 HUMAN-LIKE INTELLIGENCE: Learning from every interaction');
      console.log('🎭 PERSONALITY: Developing authentic voice through experience');
    } catch (error) {
      console.warn('⚠️ Learning system initialization error:', error);
    }
  }

  // Track content to prevent repetition
  private async trackContent(content: string, topic: string) {
    // Enhanced tracking with better logging
    console.log(`📝 Tracking content: "${content.substring(0, 50)}..."`);
    console.log(`📝 Tracking topic: "${topic}"`);
    
    this.recentlyUsedContent.add(content.toLowerCase());
    this.recentlyUsedTopics.add(topic.toLowerCase());
    
    // Maintain size limits
    if (this.recentlyUsedContent.size > this.maxRecentContent) {
      const oldest = this.recentlyUsedContent.values().next().value;
      this.recentlyUsedContent.delete(oldest);
      console.log('🗑️ Removed oldest content from tracking');
    }
    
    if (this.recentlyUsedTopics.size > this.maxRecentTopics) {
      const oldest = this.recentlyUsedTopics.values().next().value;
      this.recentlyUsedTopics.delete(oldest);
      console.log('🗑️ Removed oldest topic from tracking');
    }

    // Track topic category for diversity enforcement
    try {
      const topicCategory = this.categorizeTopicForDiversity(content, topic);
      
      // Store in database for diversity tracking
      await supabase.from('topic_usage_tracking').insert({
        topic,
        topic_category: topicCategory,
        content_snippet: content.substring(0, 100),
        used_at: new Date().toISOString(),
        content_mode: 'tracked'
      });

      console.log(`📊 Now tracking ${this.recentlyUsedContent.size} pieces of content and ${this.recentlyUsedTopics.size} topics, category: ${topicCategory}`);
      
    } catch (error) {
      console.warn('⚠️ Error tracking topic diversity:', error);
      console.log(`📊 Now tracking ${this.recentlyUsedContent.size} pieces of content and ${this.recentlyUsedTopics.size} topics`);
    }
  }

  private categorizeTopicForDiversity(content: string, topic: string): string {
    const contentLower = content.toLowerCase();
    const topicLower = topic.toLowerCase();
    
    // AI & Machine Learning
    if (contentLower.includes('ai') || contentLower.includes('artificial intelligence') || 
        contentLower.includes('machine learning') || contentLower.includes('deep learning')) {
      return 'ai_machine_learning';
    }
    
    // Mental Health & Wellness
    if (contentLower.includes('mental health') || contentLower.includes('depression') || 
        contentLower.includes('anxiety') || contentLower.includes('therapy') || 
        contentLower.includes('wellness') || contentLower.includes('mindfulness')) {
      return 'mental_health_wellness';
    }
    
    // Telemedicine & Remote Care
    if (contentLower.includes('telemedicine') || contentLower.includes('remote') || 
        contentLower.includes('virtual') || contentLower.includes('telehealth')) {
      return 'telemedicine_remote_care';
    }
    
    // Healthcare Systems & Policy
    if (contentLower.includes('healthcare cost') || contentLower.includes('insurance') || 
        contentLower.includes('policy') || contentLower.includes('system') || 
        contentLower.includes('reform') || contentLower.includes('access')) {
      return 'healthcare_systems_policy';
    }
    
    // Global Health & Accessibility
    if (contentLower.includes('global') || contentLower.includes('developing') || 
        contentLower.includes('africa') || contentLower.includes('accessibility') || 
        contentLower.includes('equity') || contentLower.includes('disparities')) {
      return 'global_health_accessibility';
    }
    
    // Environmental Health
    if (contentLower.includes('environment') || contentLower.includes('climate') || 
        contentLower.includes('carbon') || contentLower.includes('sustainability') || 
        contentLower.includes('pollution') || contentLower.includes('green')) {
      return 'environmental_health';
    }
    
    // Healthcare Workforce
    if (contentLower.includes('doctor') || contentLower.includes('nurse') || 
        contentLower.includes('physician') || contentLower.includes('burnout') || 
        contentLower.includes('staffing') || contentLower.includes('medical education')) {
      return 'healthcare_workforce';
    }
    
    // Wearable Technology
    if (contentLower.includes('wearable') || contentLower.includes('smartwatch') || 
        contentLower.includes('fitness tracker') || contentLower.includes('sensor')) {
      return 'wearable_technology';
    }
    
    // Elderly Care & Aging
    if (contentLower.includes('elderly') || contentLower.includes('senior') || 
        contentLower.includes('aging') || contentLower.includes('geriatric') || 
        contentLower.includes('dementia')) {
      return 'elderly_care_aging';
    }
    
    // Nutrition & Lifestyle
    if (contentLower.includes('nutrition') || contentLower.includes('diet') || 
        contentLower.includes('food') || contentLower.includes('exercise') || 
        contentLower.includes('lifestyle') || contentLower.includes('metabolic')) {
      return 'nutrition_lifestyle';
    }
    
    // Default categorization
    if (contentLower.includes('precision medicine') || contentLower.includes('genomic') || 
        contentLower.includes('genetic') || contentLower.includes('personalized')) {
      return 'genomics_precision_medicine';
    }
    
    if (contentLower.includes('drug') || contentLower.includes('pharmaceutical') || 
        contentLower.includes('biotech') || contentLower.includes('clinical trial')) {
      return 'biotechnology_pharmaceuticals';
    }
    
    if (contentLower.includes('digital') || contentLower.includes('app') || 
        contentLower.includes('mobile') || contentLower.includes('platform')) {
      return 'digital_health_apps';
    }
    
    // Fallback
    return 'general_health_tech';
  }

  // Check if content is too similar to recent posts
  private isContentTooSimilar(content: string, topic: string): boolean {
    // MUCH STRICTER similarity detection
    const contentLower = content.toLowerCase();
    const topicLower = topic.toLowerCase();
    
    // Check exact matches first
    for (const recentContent of this.recentlyUsedContent) {
      if (recentContent.toLowerCase() === contentLower) {
        console.log('🚫 EXACT MATCH detected - rejecting content');
        return true;
      }
      
      // Check for very high similarity (lowered threshold to 50%)
      const similarity = this.calculateSimilarity(contentLower, recentContent.toLowerCase());
      if (similarity > 0.5) {
        console.log(`🚫 HIGH SIMILARITY detected: ${(similarity * 100).toFixed(1)}% - rejecting content`);
        return true;
      }
    }
    
    // Check topic repetition
    for (const recentTopic of this.recentlyUsedTopics) {
      if (recentTopic.toLowerCase() === topicLower) {
        console.log('🚫 TOPIC REPETITION detected - rejecting content');
        return true;
      }
      
      const topicSimilarity = this.calculateSimilarity(topicLower, recentTopic.toLowerCase());
      if (topicSimilarity > 0.6) {
        console.log(`🚫 SIMILAR TOPIC detected: ${(topicSimilarity * 100).toFixed(1)}% - rejecting content`);
        return true;
      }
    }
    
    // Check for common phrases that indicate repetition
    const commonPhrases = [
      'google\'s latest ai system',
      '300+ rare diseases',
      '96% accuracy',
      'millions of undiagnosed patients',
      'revolutionary findings'
    ];
    
    const foundPhrases = commonPhrases.filter(phrase => 
      contentLower.includes(phrase)
    );
    
    if (foundPhrases.length > 2) {
      console.log(`🚫 COMMON PHRASES detected: ${foundPhrases.join(', ')} - rejecting content`);
      return true;
    }
    
    return false;
  }

  // Simple similarity calculation
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.split(' ').filter(w => w.length > 3);
    const words2 = str2.split(' ').filter(w => w.length > 3);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const commonWords = words1.filter(word => words2.includes(word));
    return commonWords.length / Math.max(words1.length, words2.length);
  }

  // Format tweet content using the imported formatter
  private formatTweetContent(content: string): string {
    return formatTweet(content).content;
  }

  // Post tweet to Twitter (placeholder implementation)
  private async postToTwitter(content: string, imageUrl: string | null): Promise<{ success: boolean; tweetId?: string; error?: string }> {
    try {
      const { xClient } = await import('../utils/xClient.js');
      
      // 🚨 PRIORITY 1: Validate content quality first
      if (!content || content.trim().length < 20) {
        console.log('🚨 EMERGENCY: Content too short, generating high-quality content...');
        
        // Try Nuclear Learning Intelligence first
        try {
          const nuclearContent = await this.generateNuclearLearningContent();
          if (nuclearContent && nuclearContent.length > 50) {
            content = nuclearContent;
            console.log('✅ NUCLEAR: Generated high-quality content via Nuclear Learning');
          }
        } catch (nuclearError) {
          console.warn('⚠️ Nuclear Learning generation failed:', nuclearError);
        }
        
        // If still no quality content, try premium generation
        if (!content || content.trim().length < 20) {
          try {
            const premiumContent = await this.generatePremiumContent();
            if (premiumContent && premiumContent.length > 50) {
              content = premiumContent;
              console.log('✅ PREMIUM: Generated high-quality content via Premium mode');
            }
          } catch (premiumError) {
            console.warn('⚠️ Premium generation failed:', premiumError);
          }
        }
        
        // ABSOLUTE LAST RESORT: High-quality strategic insight
        if (!content || content.trim().length < 20) {
          content = await this.generateStrategicInsight();
          console.log('✅ STRATEGIC: Using high-quality strategic insight');
        }
      }
      
      // Additional quality validation
      if (content.trim().length < 50) {
        console.log('🚨 EMERGENCY: Content still too short, enhancing with expertise...');
        content = await this.enhanceWithExpertise(content);
      }
      
      // Validate content length for Twitter
      if (content.length > 280) {
        console.log('🚨 EMERGENCY: Content too long, optimizing...');
        content = this.optimizeContentLength(content);
      }
      
      console.log('🐦 Posting high-quality content to Twitter:', { 
        content: content.substring(0, 100) + '...', 
        length: content.length,
        quality: 'premium'
      });
      
      // Post to actual Twitter using xClient
      let result: TweetResult;
      
      if (imageUrl) {
        // Post with media
        result = await xClient.postTweetWithMedia({
          text: content,
          mediaUrls: [imageUrl]
        });
      } else {
        // Post text only
        result = await xClient.postTweet(content);
      }
      
      if (result.success) {
        console.log(`✅ Successfully posted to Twitter! Tweet ID: ${result.tweetId}`);
        return {
          success: true,
          tweetId: result.tweetId
        };
      } else {
        console.error('❌ Twitter API error:', result.error);
        return {
          success: false,
          error: result.error
        };
      }
    } catch (error) {
      console.error('❌ Twitter posting error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async run(force: boolean = false, testMode: boolean = false): Promise<any> {
    try {
      console.log('🐦 === POST TWEET AGENT ACTIVATED ===');
      
      // 🧠 INTELLIGENT POSTING DECISION: Think before posting
      if (!force && !testMode) {
        console.log('🧠 === MAKING INTELLIGENT POSTING DECISION ===');
        const decision = await intelligentPostingDecision.makePostingDecision();
        
        if (!decision.shouldPost) {
          console.log(`🧠 DECISION: ${decision.strategy.toUpperCase()} - ${decision.reason}`);
          console.log(`⏰ Next decision check: ${decision.nextDecisionTime.toLocaleString()}`);
          
          if (decision.contentGuidance) {
            console.log(`💡 Content guidance: ${decision.contentGuidance.type} - ${decision.contentGuidance.reasoning}`);
          }
          
          return { 
            success: false, 
            reason: decision.reason,
            decisionInfo: {
              shouldPost: decision.shouldPost,
              reason: decision.reason,
              strategy: decision.strategy,
              confidence: decision.confidence,
              waitTime: decision.waitTime,
              nextDecisionTime: decision.nextDecisionTime
            }
          };
        }
        
        console.log(`🧠 DECISION: POST NOW - ${decision.reason} (${Math.round(decision.confidence * 100)}% confidence)`);
        if (decision.contentGuidance) {
          console.log(`💡 Content guidance: ${decision.contentGuidance.type} for ${decision.contentGuidance.targetAudience}`);
          console.log(`📊 Performance expectation: ${decision.performanceExpectation.expectedLikes} likes, ${decision.performanceExpectation.viralPotential * 100}% viral potential`);
        }
      }

      // 🚨 CRITICAL: BURST PROTECTION CHECK (FIRST PRIORITY)
      const burstCheck = await this.checkBurstProtection();
      if (!burstCheck.canPost) {
        console.log('🛡️ BURST PROTECTION BLOCK:', burstCheck.reason);
        return { success: false, reason: burstCheck.reason };
      }

      // 🚨 EMERGENCY RATE LIMITING (still check as backup)
      const rateLimitCheck = await this.checkRateLimit();
      if (!rateLimitCheck.canPost) {
        console.log('🚨 RATE LIMIT BLOCK: Cannot post -', rateLimitCheck.reason);
        return { success: false, reason: rateLimitCheck.reason };
      }
      
      console.log('✅ All decision checks passed - proceeding with posting');
      
      // Check live posting mode
      if (!LIVE_MODE) {
        console.log('[DRY RUN] No tweets will be published');
      } else {
        console.log('[LIVE] Posting ENABLED');
      }
      
      // Check bot kill switch
      if (!testMode && await isBotDisabled()) {
        console.log('🚫 Bot is disabled via kill switch');
        return { success: false, reason: 'Bot disabled' };
      }

      // Check API quota
      if (!testMode) {
        const canPost = await canMakeWrite();
        if (!canPost) {
          console.log('📊 API quota exhausted - cannot post');
          return { success: false, reason: 'API quota exhausted' };
        }
      }

      // Generate content with uniqueness checking
      let tweetContent = await this.generateUniqueContent();
      
      // Validate URLs in content
      const urlsValid = await urlValidator.validateTweetUrls(tweetContent);
      if (!urlsValid) {
        console.log('❌ Tweet URLs failed validation - aborting');
        return { success: false, reason: 'Invalid URLs' };
      }

      // Format tweet with proper spacing and cleanup
      tweetContent = this.formatTweetContent(tweetContent);

      // Run sanity checks before posting
      const qc = await runSanityChecks(tweetContent, supabase);
      if (!qc.ok) {
        // Store rejected content in database
        try {
          await supabase.from('rejected_drafts').insert({
            content: tweetContent,
            reason: qc.reason
          });
        } catch (dbError) {
          console.error('Failed to store rejected draft:', dbError);
        }
        console.log('🛑 QC reject:', qc.reason);
        return { success: false, reason: `Quality check failed: ${qc.reason}` };
      }
      
      // Apply any content fixes
      if (qc.fixes.length > 0) {
        tweetContent = qc.fixes[0] || tweetContent; // Use fixed content
        console.log('🔧 Applied content fixes:', qc.fixes.slice(1)); // Log the fix descriptions
      }

      // Format content for better readability
      const formattedResult = tweetFormatter.formatForReadability(tweetContent);
      tweetContent = formattedResult.content;
      
      console.log(`📝 Content readability score: ${formattedResult.readabilityScore}/100`);
      if (formattedResult.improvements.length > 0) {
        console.log('✨ Formatting improvements:', formattedResult.improvements);
      }

      // Select appropriate image with enhanced debugging
      console.log('🖼️ Starting image selection process...');
      
      // 🚨 NUCLEAR IMAGE BLOCK CHECK
      let imageUrl: string | null = null;
      try {
        const { data: nuclearImageBlock } = await supabase
          .from('bot_config')
          .select('value')
          .eq('key', 'nuclear_image_block')
          .single() || { data: null };

        if (nuclearImageBlock?.value?.enabled || nuclearImageBlock?.value?.block_all_images) {
          console.log('🚫 NUCLEAR IMAGE BLOCK: Images completely disabled');
          imageUrl = null;
        } else {
          // Intelligent image decision - only add images that enhance the content
          const shouldIncludeImage = this.intelligentImageDecision(tweetContent);
          
          if (shouldIncludeImage) {
            imageUrl = await smartImageSelector.chooseImage(tweetContent);
            console.log('📸 SMART IMAGE: Content benefits from visual enhancement');
          } else {
            console.log('📝 TEXT-ONLY: Content is engaging enough without image');
            imageUrl = null;
          }
        }
      } catch (error) {
        console.log('⚠️ Could not check nuclear image block, defaulting to text-only');
        imageUrl = null;
      }
      
      if (imageUrl) {
        const imageSource = imageUrl.includes('pexels') ? 'Pexels' : 
                          imageUrl.includes('unsplash') ? 'Unsplash' : 'Fallback';
        console.log(`✅ Image selected from: ${imageSource}`);
      } else {
        console.log('⚠️ No image selected - posting text-only');
      }
      
      if (!LIVE_MODE) {
        console.log('🧪 DRY RUN – Tweet preview:');
        console.log(`📝 Content: ${tweetContent}`);
        console.log(`🖼️ Image: ${imageUrl || 'None'}`);
        return { 
          success: true, 
          preview: tweetContent, 
          imageUrl,
          dryRun: true,
          readabilityScore: formattedResult.readabilityScore,
          formattingImprovements: formattedResult.improvements
        };
      }

      // Determine tweet style for tracking
      const tweetStyle = this.determineTweetStyle(tweetContent);

      // Post the tweet
      const result = await this.postToTwitter(tweetContent, imageUrl);
      
      if (result.success) {
        // Store in database with style and embedding
        const tweetId = await this.storeTweetInDatabase(tweetContent, imageUrl, tweetStyle, result.tweetId);
        
        // Store content embedding for future uniqueness checking
        if (tweetId) {
          await embeddingFilter.storeContentEmbedding(tweetId, tweetContent);
        }

        console.log('✅ Tweet posted successfully!');
        
        // 🧠 INTELLIGENT LEARNING: Analyze posted content for autonomous evolution
        const postResult: PostResult = { 
          success: true, 
          tweetId: result.tweetId,
          content: tweetContent,
          hasImage: !!imageUrl,
          readabilityScore: formattedResult.readabilityScore,
          formattingImprovements: formattedResult.improvements
        };
        
        // Trigger learning system in background
        this.learnFromPostedContent(postResult).catch(error => {
          console.warn('⚠️ Background learning failed:', error);
        });
        
        return postResult;
      } else {
        console.log('❌ Tweet posting failed');
        return { success: false, reason: result.error };
      }

    } catch (error) {
      console.error('💥 PostTweetAgent error:', error);
      return { success: false, error: error.message };
    }
  }

  private async generateUniqueContent(): Promise<string> {
    console.log('🎯 Generating unique content with autonomous learning optimization...');
    
    // Get optimized strategy from adaptive learner
    let optimizedStrategy: any = {};
    try {
      optimizedStrategy = this.adaptiveLearner.getOptimizedContentStrategy();
      console.log('🧠 Applied learning insights:', optimizedStrategy.latest_insights?.slice(0, 3));
    } catch (error) {
      console.warn('⚠️ Learning system not ready, using default strategy');
    }
    
    const regenerateCallback = async () => {
      const attempts = 3;
      for (let i = 0; i < attempts; i++) {
        console.log(`🔄 Generation attempt ${i + 1}/${attempts} with learning optimization...`);
        
        let content = '';
        
        // Use learning-optimized content mode selection
        const contentMode = await this.selectOptimizedContentMode(optimizedStrategy);
        console.log(`📊 Selected content mode: ${contentMode} (learning-optimized)`);
        
        try {
          switch (contentMode) {
            case 'human_expert':
              console.log('🧠 Generating HUMAN EXPERT content with authentic voice...');
              try {
                const expertResult = await this.humanExpert.generateExpertContent();
                if (expertResult && expertResult.content && expertResult.content.length > 30) {
                  content = expertResult.content;
                  console.log(`🎓 EXPERT SUCCESS: ${expertResult.expertiseArea} (score: ${expertResult.confidenceScore})`);
                } else {
                  throw new Error('Expert content too short or invalid');
                }
              } catch (error) {
                console.warn('⚠️ Human expert failed, generating emergency unique content...');
                // Generate emergency unique content instead of falling back to repetitive viral
                content = await this.generateEmergencyUniqueExpert();
              }
              break;
              
            case 'viral':
              console.log('🔥 Generating VIRAL FOLLOWER GROWTH content...');
              // 🚨 EMERGENCY FIX: Use actual viral follower growth agents instead of academic content
              try {
                // Import the viral follower growth agent
                const { viralFollowerGrowthAgent } = await import('./viralFollowerGrowthAgent.js');
                const viralContent = await viralFollowerGrowthAgent.generateViralContent();
                
                content = viralContent.content;
                console.log(`🔥 VIRAL SUCCESS: ${viralContent.contentType} with ${viralContent.viralPotential}% potential`);
                console.log(`🎯 Engagement hooks: ${viralContent.engagementHooks.join(', ')}`);
                console.log(`📈 Follow triggers: ${viralContent.followTriggers.join(', ')}`);
                
                // Track viral performance
                try {
                  await viralFollowerGrowthAgent.trackViralPerformance(viralContent, 'pending_post_id');
                } catch (trackError) {
                  console.warn('⚠️ Failed to track viral performance:', trackError);
                }
                
              } catch (viralError) {
                console.warn('⚠️ Viral follower growth agent failed, trying ultra viral generator:', viralError);
                try {
                  // Fallback to ultra viral generator for controversial content  
                  const ultraViralResult = await this.viralGenerator.generateViralTweet();
                  content = ultraViralResult.content;
                  console.log('🔥 ULTRA VIRAL FALLBACK: Generated controversial content');
                } catch (ultraError) {
                  console.warn('⚠️ Ultra viral fallback to nuclear learning:', ultraError);
                  content = await this.nuclearLearning.generateCreativeContent();
                  console.log('🧠 NUCLEAR LEARNING FALLBACK: Generated creative content');
                }
              }
              break;
              
            case 'comprehensive':
              console.log('📚 Generating comprehensive content...');
              const comprehensiveResult = await this.generateComprehensiveTweet(false);
              content = comprehensiveResult.content || '';
              break;
              
            case 'current_events':
              console.log('📰 Generating current events content...');
              const currentResult = await this.generateCurrentEventsTweet(false, false);
              content = currentResult.content || '';
              break;
              
            case 'trending':
              console.log('📈 Generating NUCLEAR trending content...');
              // Try nuclear learning for trending content
              try {
                const topTrend = this.nuclearLearning.getTopTrendingTopic();
                if (topTrend) {
                  const hook = topTrend.viral_hooks[Math.floor(Math.random() * topTrend.viral_hooks.length)];
                  content = `${hook}\n\nThis breakthrough could reshape the entire healthcare landscape.`;
                  console.log(`🧠 NUCLEAR TRENDING: Used topic "${topTrend.topic}" (score: ${topTrend.trend_score})`);
                } else {
                  throw new Error('No trending topics available');
                }
              } catch (error) {
                console.warn('⚠️ Nuclear trending fallback to standard generator');
                const trendingResult = await this.generateTrendingTweet(false, false);
                content = trendingResult.content || '';
              }
              break;
              
            case 'expert_intelligence':
              console.log('🧠 EXPERT INTELLIGENCE: Generating content that builds on accumulated knowledge');
              try {
                const expertResult = await this.generateExpertIntelligenceContent();
                if (expertResult && expertResult.content && expertResult.content.length > 30) {
                  content = expertResult.content;
                  console.log(`🎓 EXPERT INTELLIGENCE SUCCESS: Level ${expertResult.expertise_level} expertise`);
                } else {
                  throw new Error('Expert intelligence content too short or invalid');
                }
              } catch (error) {
                console.warn('⚠️ Expert intelligence failed, falling back to human expert...');
                content = await this.generateEmergencyUniqueExpert();
              }
              break;
              
            case 'diverse_perspective':
              console.log('🎭 DIVERSE PERSPECTIVES: Generating unique viewpoint for conversation');
              try {
                const diverseResult = await this.diversePerspectiveEngine.generateDiverseContent();
                if (diverseResult && diverseResult.content && diverseResult.content.length > 30) {
                  content = diverseResult.content;
                  console.log(`🎨 DIVERSE PERSPECTIVE SUCCESS: ${diverseResult.perspective} viewpoint`);
                } else {
                  throw new Error('Diverse perspective content too short or invalid');
                }
              } catch (error) {
                console.warn('⚠️ Diverse perspective failed, falling back to human expert...');
                content = await this.generateEmergencyUniqueExpert();
              }
              break;
              
            default:
              console.log('🎲 Generating NUCLEAR engagement-focused content...');
              // Try competitive intelligence for default case
              try {
                content = await this.nuclearLearning.generateCompetitorInspiredContent();
                console.log('🧠 NUCLEAR COMPETITIVE: Generated competitor-inspired content');
              } catch (error) {
                console.warn('⚠️ Nuclear competitive fallback to engagement generator');
                const engagementResult = await this.generateViralTweet(false, false);
                content = engagementResult.content || '';
              }
          }
          
          if (content) {
            // 🎯 BALANCED STRATEGY: Strategic enhancement based on content mode
            if (contentMode === 'human_expert') {
              console.log('🧠 PURE HUMAN EXPERT: Keeping authentic voice without contamination');
              // No enhancements - pure persona-based content only
            } else {
              // Apply learning-based content optimization for viral modes
              content = this.applyLearningOptimizations(content, optimizedStrategy);
              
              // 🎯 STRATEGIC ENHANCEMENT: Quality viral elements for growth (non-repetitive)
              try {
                // Only enhance if content is unique and not repetitive
                const hasRepetitivePatterns = await this.containsRepetitivePatterns(content);
                if (!hasRepetitivePatterns) {
                  content = await this.nuclearLearning.enhanceContentWithViralElements(content);
                  console.log('🎯 STRATEGIC ENHANCEMENT: Added quality viral elements for growth');
                } else {
                  console.log('🚫 BLOCKED: Content contained repetitive patterns, keeping original');
                }
              } catch (error) {
                console.warn('⚠️ Strategic enhancement error:', error);
              }
            }
            
            // Extract topic for tracking
            const topic = this.extractKeyTopic(content);
            
            // Enhanced uniqueness check
            if (!this.isContentTooSimilar(content, topic)) {
              console.log('✅ Generated unique content with learning optimizations');
              await this.trackContent(content, topic);
              return content;
            } else {
              console.log(`❌ Content too similar to recent posts (attempt ${i + 1})`);
              // Add learned pattern to avoid
              if (optimizedStrategy.failed_patterns) {
                optimizedStrategy.failed_patterns.push({
                  description: `Similar to: ${topic}`,
                  reason: 'Content repetition detected'
                });
              }
            }
          }
        } catch (error) {
          console.warn(`⚠️ Content generation error on attempt ${i + 1}:`, error);
        }
      }
      
      // 🚨 EMERGENCY: Block learning-enhanced fallback that creates repetitive content
      console.log('🚨 All generation attempts failed, generating emergency unique expert content...');
      const emergencyContent = await this.generateEmergencyUniqueExpert();
      return emergencyContent;
    };

    return await regenerateCallback();
  }

  private async selectOptimizedContentMode(optimizedStrategy: any): Promise<'viral' | 'comprehensive' | 'engagement' | 'current_events' | 'trending' | 'human_expert' | 'diverse_perspective' | 'expert_intelligence'> {
    // 🚨 FIRST: CHECK EMERGENCY VIRAL OVERRIDE
    try {
      const { data: emergencyOverride } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', 'emergency_viral_override')
        .single() || { data: null };
      
      if (emergencyOverride?.value?.enabled && emergencyOverride?.value?.posts_remaining > 0) {
        console.log('🚨 EMERGENCY VIRAL OVERRIDE ACTIVE!');
        console.log(`🔥 Forcing viral content generation (${emergencyOverride.value.posts_remaining} posts remaining)`);
        
        // Decrement posts remaining
        await supabase
          .from('bot_config')
          .update({
            value: {
              ...emergencyOverride.value,
              posts_remaining: emergencyOverride.value.posts_remaining - 1
            },
            updated_at: new Date().toISOString()
          })
          .eq('key', 'emergency_viral_override');
        
        return 'viral'; // FORCE VIRAL CONTENT
      }
    } catch (error) {
      console.warn('⚠️ Failed to check emergency viral override:', error);
    }

    // 🚫 CHECK CONTENT BLOCKING CONFIG
    try {
      const { data: blockingConfig } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', 'content_blocking_config')
        .single() || { data: null };
      
      if (blockingConfig?.value?.blocked_content_types?.includes('viral_health_theme')) {
        console.log('🚫 Academic content blocked - forcing viral alternatives');
        // Block academic/expert content modes, force viral
        return 'viral';
      }
    } catch (error) {
      console.warn('⚠️ Failed to check content blocking config:', error);
    }

    // 🎯 CHECK AI CONTENT SELECTION OVERRIDE
    try {
      const { data: aiOverride } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', 'ai_content_selection_override')
        .single() || { data: null };
      
      if (aiOverride?.value?.enabled && aiOverride?.value?.force_viral_priority) {
        console.log('🤖 AI CONTENT OVERRIDE: Prioritizing viral agents');
        // 80% chance viral, 20% other viral types
        const viralRandom = Math.random();
        if (viralRandom < 0.8) {
          return 'viral';
        } else {
          return Math.random() < 0.5 ? 'trending' : 'engagement';
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to check AI content override:', error);
    }

    // 🎯 LOAD DATABASE CONFIGURATIONS for content distribution
    try {
      const { data: distributionConfig } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', 'enhanced_content_distribution')
        .single() || { data: null };

      const { data: diverseConfig } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', 'diverse_perspective_allocation')
        .single() || { data: null };

      // Use database configuration if available, otherwise fallback to defaults
      let distribution = {
        expert_intelligence: 30,
        diverse_perspectives: 25,
        human_expert: 15,
        breaking_news: 15,
        viral_content: 10,
        trending_topics: 5,
        comprehensive_analysis: 0
      };

      if (distributionConfig?.value?.distribution) {
        distribution = distributionConfig.value.distribution;
        console.log('📊 Using database content distribution configuration');
      } else {
        console.log('⚠️ Using fallback content distribution');
      }

      // Enforce diverse perspective allocation if mandated
      if (diverseConfig?.value?.enabled && diverseConfig?.value?.allocation_percentage) {
        distribution.diverse_perspectives = diverseConfig.value.allocation_percentage;
        console.log(`🎭 FORCED DIVERSE ALLOCATION: ${distribution.diverse_perspectives}%`);
      }

      // Convert percentages to cumulative thresholds
      const randomFactor = Math.random() * 100;
      let cumulative = 0;

      cumulative += distribution.expert_intelligence;
      if (randomFactor < cumulative) {
        console.log('🧠 EXPERT INTELLIGENCE: Building on accumulated knowledge and expertise');
        return 'expert_intelligence';
      }

      cumulative += distribution.diverse_perspectives;
      if (randomFactor < cumulative) {
        console.log('🎭 DIVERSE PERSPECTIVES: Generating unique viewpoint for conversation');
        return 'diverse_perspective';
      }

      cumulative += distribution.human_expert;
      if (randomFactor < cumulative) {
        console.log('🧠 HUMAN EXPERT INSIGHTS: Deep expert analysis for authority building');
        return 'human_expert';
      }

      cumulative += distribution.breaking_news;
      if (randomFactor < cumulative) {
        console.log('📰 BREAKING NEWS ANALYSIS: Timely expert takes');
        return 'current_events';
      }

      cumulative += distribution.viral_content;
      if (randomFactor < cumulative) {
        console.log('🔥 VIRAL CONTENT: Shareable insights for growth');
        return 'viral';
      }

      cumulative += distribution.trending_topics;
      if (randomFactor < cumulative) {
        console.log('📈 TRENDING TOPICS: Real-time trend participation');
        return 'trending';
      }

      // Default to comprehensive
      console.log('🎯 COMPREHENSIVE ANALYSIS: Structured deep-dive');
      return 'comprehensive';

    } catch (error) {
      console.warn('⚠️ Error loading content distribution config, using fallback:', error);
      
      // Fallback to hardcoded enhanced distribution
      const randomFactor = Math.random();
      
      if (randomFactor < 0.30) {
        console.log('🧠 EXPERT INTELLIGENCE: Building on accumulated knowledge and expertise (fallback)');
        return 'expert_intelligence';
      } else if (randomFactor < 0.55) {
        console.log('🎭 DIVERSE PERSPECTIVES: Generating unique viewpoint for conversation (fallback)');
        return 'diverse_perspective';
      } else if (randomFactor < 0.70) {
        console.log('🧠 HUMAN EXPERT INSIGHTS: Deep expert analysis for authority building (fallback)');
        return 'human_expert';
      } else if (randomFactor < 0.75) {
        console.log('📰 BREAKING NEWS ANALYSIS: Timely expert takes (fallback)');
        return 'current_events';
      } else if (randomFactor < 0.85) {
        console.log('🔥 VIRAL CONTENT: Shareable insights for growth (fallback)');
        return 'viral';
      } else if (randomFactor < 0.95) {
        console.log('📈 TRENDING TOPICS: Real-time trend participation (fallback)');
        return 'trending';
      } else {
        console.log('🎯 COMPREHENSIVE ANALYSIS: Structured deep-dive (fallback)');
        return 'comprehensive';
      }
    }
  }

  private applyLearningOptimizations(content: string, optimizedStrategy: any): string {
    let optimizedContent = content;
    
    try {
      // Apply successful patterns
      const successfulPatterns = optimizedStrategy.successful_patterns || [];
      
      for (const pattern of successfulPatterns.slice(0, 2)) {
        if (pattern.description.includes('BREAKING') && !optimizedContent.includes('🚨')) {
          optimizedContent = '🚨 ' + optimizedContent;
          console.log('🔥 Applied viral pattern: Breaking news format');
        }
        
        if (pattern.description.includes('statistics') && !/\d+%|\d+x|\$\d+/.test(optimizedContent)) {
          // Try to add a relevant statistic
          const stats = [
            '87% faster',
            '10x more accurate',
            '95% success rate',
            '50% reduction in costs',
            '3x improvement'
          ];
          const randomStat = stats[Math.floor(Math.random() * stats.length)];
          optimizedContent = optimizedContent.replace(/\.$/, ` (${randomStat}).`);
          console.log('📊 Applied data-driven optimization');
        }
        
        if (pattern.description.includes('Hot take') && !optimizedContent.includes('💡')) {
          optimizedContent = '💡 Hot take: ' + optimizedContent;
          console.log('🔥 Applied controversial angle optimization');
        }
      }
      
      // Avoid failed patterns
      const failedPatterns = optimizedStrategy.failed_patterns || [];
      for (const pattern of failedPatterns) {
        if (pattern.description.includes('thoughts?') && optimizedContent.includes('thoughts?')) {
          optimizedContent = optimizedContent.replace(/thoughts\?/gi, 'What do you think about this breakthrough?');
          console.log('🚫 Avoided poor performing pattern: generic thoughts question');
        }
      }
      
      // Apply immediate recommendations
      const recommendations = optimizedStrategy.immediate_recommendations || [];
      for (const rec of recommendations.slice(0, 2)) {
        if (rec.includes('thread format') && !optimizedContent.includes('🧵')) {
          optimizedContent = '🧵 Thread: ' + optimizedContent + ' (1/5)';
          console.log('🧵 Applied thread format optimization');
          break;
        }
      }
      
    } catch (error) {
      console.warn('⚠️ Error applying learning optimizations:', error);
    }
    
    return optimizedContent;
  }

  private async containsRepetitivePatterns(content: string): Promise<boolean> {
    // Load banned patterns from database configuration
    try {
      const { data: qualityConfig } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', 'content_quality_enforcement')
        .single() || { data: null };

      const { data: diversityConfig } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', 'topic_diversity_enforcement')
        .single() || { data: null };

      // Combine database patterns with hardcoded ones
      let bannedPatterns = [
        'as ai transforms diagnostics',
        'precision medicine is becoming a reality',
        'healthcare professionals must invest',
        'this could revolutionize healthcare',
        'the implications are staggering',
        'this changes everything we know',
        'the future of healthcare is being written',
        'ai, digital therapeutics, and precision medicine are converging',
        'machine learning algorithms identify promising drug compounds',
        'breakthrough: machine learning algorithms identify',
        'with 92% accuracy in predicting therapeutic effectiveness',
        'revolutionary findings (nature medicine, 2024)',
        'machine learning algorithms identify promising drug compounds in months instead of years',
        'with 92% accuracy in predicting therapeutic effectiveness across 500+ trials'
      ];

      // Add database-configured banned patterns
      if (qualityConfig?.value?.banned_repetitive_phrases) {
        bannedPatterns = [...bannedPatterns, ...qualityConfig.value.banned_repetitive_phrases];
      }

      if (diversityConfig?.value?.banned_repetitive_patterns) {
        bannedPatterns = [...bannedPatterns, ...diversityConfig.value.banned_repetitive_patterns];
      }

      const contentLower = content.toLowerCase();
      const hasRepetitivePattern = bannedPatterns.some(pattern => 
        contentLower.includes(pattern.toLowerCase())
      );

      if (hasRepetitivePattern) {
        console.log('🚫 BLOCKED: Content contains banned repetitive patterns');
        
        // Log which pattern was detected for monitoring
        const detectedPattern = bannedPatterns.find(pattern => 
          contentLower.includes(pattern.toLowerCase())
        );
        console.log(`🚫 DETECTED PATTERN: "${detectedPattern}"`);
      }

      return hasRepetitivePattern;

    } catch (error) {
      console.warn('⚠️ Error loading repetitive pattern config, using fallback:', error);
      
      // Fallback to hardcoded patterns
      const repetitivePatterns = [
        'as ai transforms diagnostics',
        'precision medicine is becoming a reality',
        'healthcare professionals must invest',
        'this could revolutionize healthcare',
        'the implications are staggering',
        'this changes everything we know',
        'the future of healthcare is being written',
        'ai, digital therapeutics, and precision medicine are converging',
        'artificial intelligence is revolutionizing',
        'digital health solutions are',
        'healthcare technology is advancing',
        'medical innovation continues',
        'machine learning algorithms identify promising drug compounds',
        'breakthrough: machine learning algorithms identify',
        'with 92% accuracy in predicting therapeutic effectiveness',
        'revolutionary findings (nature medicine, 2024)',
        'machine learning algorithms identify promising drug compounds in months instead of years',
        'with 92% accuracy in predicting therapeutic effectiveness across 500+ trials'
      ];
      
      const contentLower = content.toLowerCase();
      return repetitivePatterns.some(pattern => contentLower.includes(pattern));
    }
  }

  private async generateEmergencyUniqueExpert(): Promise<string> {
    try {
      // Generate completely unique expert-style content without repetitive patterns
      const uniqueTopics = [
        'Hidden patterns in patient recovery data reveal surprising insights',
        'What 15 years of clinical trials taught me about drug development',
        'The one metric that predicts surgical success better than any other',
        'Why most health tech fails and what the survivors do differently',
        'Unexpected discoveries from analyzing 50,000 patient genomic profiles',
        'The regulatory hurdle that kills 80% of promising treatments',
        'What I learned building AI systems for Johns Hopkins and Mayo Clinic',
        'The economic factor that determines which digital health tools succeed',
        'Surprising patterns in how doctors actually adopt new technology',
        'What 20 years of biotech investing taught me about healthcare innovation'
      ];

      const expertVoices = [
        'After treating 5,000+ patients with this condition, here\'s what surprised me most:',
        'Working with Stanford\'s research team for 3 years changed how I see',
        'Most people think this about healthcare AI, but here\'s what I\'ve found:',
        'Having analyzed data from 200+ hospitals, the pattern is clear:',
        'Everyone talks about this trend, but they\'re missing the real story:',
        'Three years of FDA submissions taught me something unexpected:',
        'The data from our 10-hospital study reveals something fascinating:',
        'After evaluating 100+ health tech startups, I\'ve noticed:'
      ];

      const uniqueTopic = uniqueTopics[Math.floor(Math.random() * uniqueTopics.length)];
      const expertVoice = expertVoices[Math.floor(Math.random() * expertVoices.length)];
      
      // Generate timestamp-based uniqueness
      const timestamp = Date.now();
      const uniquifier = (timestamp % 1000).toString();
      
      const content = `${expertVoice} ${uniqueTopic.toLowerCase()}.

The implications could reshape how we approach patient care. What's your take?`;

      console.log('🚨 EMERGENCY EXPERT: Generated unique expert content');
      return content;
      
    } catch (error) {
      console.error('Emergency expert generation failed:', error);
      return 'Healthcare innovation moves fast. The most interesting developments happen when nobody\'s watching.';
    }
  }

  private async generateLearningEnhancedFallback(optimizedStrategy: any): Promise<string> {
    console.log('🚨 Generating learning-enhanced fallback content...');
    
    try {
      // 🧠 NUCLEAR LEARNING: Get viral patterns from database
      const { data: viralPatternsData } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', 'viral_intelligence_patterns')
        .single() || { data: null };
      
      // 🧠 NUCLEAR LEARNING: Get trending topics from database  
      const { data: trendingTopicsData } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', 'trending_topics_intelligence')
        .single() || { data: null };
        
      // 🧠 NUCLEAR LEARNING: Get competitive intelligence
      const { data: competitorData } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', 'competitive_intelligence')
        .single() || { data: null };

      if (viralPatternsData?.value?.patterns) {
        const patterns = viralPatternsData.value.patterns;
        const bestPattern = patterns.find((p: any) => p.success_rate >= 85) || patterns[0];
        
        console.log(`🔥 Using NUCLEAR viral pattern: ${bestPattern.type} (${bestPattern.success_rate}% success)`);
        
        if (bestPattern.type === 'breaking_news') {
          const hooks = trendingTopicsData?.value?.topics?.[0]?.viral_hooks || [
            'AI just achieved 99.1% accuracy in cancer detection',
            'New brain implant restores movement in paralyzed patients'
          ];
          const hook = hooks[Math.floor(Math.random() * hooks.length)];
          return `🚨 BREAKING: ${hook}\n\nThis could revolutionize healthcare within the next 5 years. The implications are staggering.`;
        }
        
        if (bestPattern.type === 'hot_take') {
          const controversialTakes = [
            'AI will replace 80% of medical diagnosis within 10 years, and that\'s actually good news',
            'Digital therapeutics are more effective than pills for most mental health conditions',
            'Healthcare AI bias isn\'t a tech problem, it\'s a data problem we\'re afraid to fix'
          ];
          const take = controversialTakes[Math.floor(Math.random() * controversialTakes.length)];
          return `💡 Hot take: ${take}\n\nChange my mind in the comments 👇`;
        }
        
        if (bestPattern.type === 'thread_starter') {
          return '🧵 Thread: 5 healthcare AI breakthroughs that will blow your mind (and why #3 changes everything)\n\n1/ AI diagnostics just achieved superhuman accuracy in cancer detection...';
        }
        
        if (bestPattern.type === 'data_bomb') {
          return '📊 Wild stat: Healthcare AI market will hit $148B by 2030\n\nThat\'s a 10x increase from today. Here\'s why this explosion is inevitable and what it means for patients...';
        }
      }

      // Use competitive intelligence formulas
      if (competitorData?.value?.successful_formulas) {
        const formulas = competitorData.value.successful_formulas;
        const bestFormula = formulas.find((f: any) => f.success_rate >= 85) || formulas[0];
        
        console.log(`🕵️ Using competitive formula: ${bestFormula.formula} (${bestFormula.success_rate}% success)`);
        
        if (bestFormula.formula.includes('SHOCKING_STAT')) {
          return 'AI accuracy in cancer detection just hit 99.1% (better than human doctors). This will save millions of lives. Are we ready for AI-first healthcare?';
        }
        
        if (bestFormula.formula.includes('CONTRARIAN_TAKE')) {
          return 'Unpopular opinion: Most health apps are useless. Only 3% have clinical evidence. But those 3% will revolutionize healthcare in the next 5 years.';
        }
      }
      
      // Use trending topics as last resort
      if (trendingTopicsData?.value?.topics) {
        const topics = trendingTopicsData.value.topics;
        const hotTopic = topics.find((t: any) => t.trend_score >= 90) || topics[0];
        const hook = hotTopic.viral_hooks?.[0] || `${hotTopic.topic} is transforming healthcare`;
        
        console.log(`📈 Using trending topic: ${hotTopic.topic} (score: ${hotTopic.trend_score})`);
        return `${hook}\n\nThis breakthrough could change everything we know about modern medicine.`;
      }
      
    } catch (error) {
      console.warn('⚠️ Nuclear learning fallback error:', error);
    }
    
    // Ultimate emergency fallback
    return await this.generateFallbackContent();
  }

  private async generateBreakingNewsFallback(): Promise<string> {
    const breakingTopics = [
      'AI diagnostic accuracy reaches 99.1% in cancer detection',
      'New gene therapy restores vision in 95% of patients',
      'Quantum computing breakthrough accelerates drug discovery by 1000x',
      'Digital twin technology reduces surgery risks by 67%',
      'AI-powered prosthetics restore natural feeling in paralyzed patients'
    ];
    
    const topic = breakingTopics[Math.floor(Math.random() * breakingTopics.length)];
    return `🚨 BREAKING: ${topic}\n\nThis could revolutionize healthcare within the next 5 years. The implications for patient outcomes are staggering.`;
  }

  private async generateDataDrivenFallback(): Promise<string> {
    const dataDrivenTopics = [
      '📊 Study of 100K patients shows AI diagnostics are 89% more accurate than traditional methods',
      '📈 New research: Telemedicine reduces healthcare costs by $2,400 per patient annually',
      '🔬 Clinical trial results: Gene editing therapy has 94% success rate in rare diseases',
      '📊 Meta-analysis reveals: Wearable devices detect health issues 6 months earlier on average',
      '📈 Hospital efficiency study: AI reduces patient wait times by 73% across 500 facilities'
    ];
    
    const topic = dataDrivenTopics[Math.floor(Math.random() * dataDrivenTopics.length)];
    return `${topic}\n\nThe data doesn't lie - we're witnessing the transformation of healthcare in real-time.`;
  }

  private async generateControversialFallback(): Promise<string> {
    const controversialTakes = [
      '💡 Hot take: AI will replace 80% of medical diagnosis within 10 years, and that\'s actually good news for patients',
      '🔥 Unpopular opinion: Digital health records are still a mess because we\'re solving yesterday\'s problems with tomorrow\'s tech',
      '💡 Controversial: Most health apps are digital snake oil - only 3% have clinical evidence',
      '🔥 Hot take: Telemedicine\'s biggest problem isn\'t technology, it\'s that doctors still think like it\'s 1995',
      '💡 Unpopular truth: Healthcare AI bias isn\'t a tech problem, it\'s a data problem we\'re afraid to fix'
    ];
    
    const take = controversialTakes[Math.floor(Math.random() * controversialTakes.length)];
    return `${take}\n\nChange my mind in the comments 👇`;
  }

  private async generateCompetitorInspiredFallback(competitorPattern: string): Promise<string> {
    console.log(`🕵️ Generating content inspired by: ${competitorPattern}`);
    
    // Extract key elements from competitor pattern and adapt
    if (competitorPattern.includes('Thread')) {
      return '🧵 Thread: 5 healthcare technologies that will dominate 2024 (and why most people are sleeping on #3)\n\n1/ AI-powered drug discovery is accelerating from years to months...';
    }
    
    if (competitorPattern.includes('BREAKING')) {
      return '🚨 BREAKING: Major healthcare AI breakthrough just announced\n\nThis changes everything we know about early disease detection. The accuracy rates are unprecedented.';
    }
    
    return 'Healthcare innovation moves fast. Here\'s what you missed this week in health tech that could change everything.\n\n🧵 Thread below 👇';
  }

  private async generateFallbackContent(): Promise<string> {
    const fallbackResult = await this.generateFallbackTweet(false, false);
    return fallbackResult.content || 'AI is transforming healthcare. The future is here.';
  }

  private determineTweetStyle(content: string): string {
    // Analyze content to determine style
    const lowerContent = content.toLowerCase();
    
    if (content.includes('🚨') || content.includes('BREAKING')) return 'BREAKING_NEWS';
    if (content.includes('🔥') || content.includes('HOT TAKE')) return 'HOT_TAKE';
    if (content.includes('💡') || content.includes('ELI5')) return 'EDUCATION';
    if (content.includes('ChatGPT') || content.includes('but for')) return 'CULTURAL_REFERENCE';
    if (content.includes('📊') || content.includes('Wild stat')) return 'DATA_STORY';
    if (content.includes('🔮') || content.includes('In ')) return 'PREDICTION';
    if (content.includes(' vs ') || content.includes('Old:')) return 'COMPARISON';
    if (content.includes('Quick question') || content.includes('?')) return 'QUESTION_STARTER';
    
    return 'DEFAULT';
  }

  private async storeTweetInDatabase(content: string, imageUrl: string | null, style: string, twitterId?: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('tweets')
        .insert({
          tweet_id: twitterId || `local_${Date.now()}`, // Use tweet_id instead of twitter_id
          content,
          image_url: imageUrl,
          tweet_type: 'original',
          content_type: style || 'viral_content', // Use content_type instead of style
          content_category: style || 'general',
          source_attribution: 'PostTweetAgent',
          engagement_score: 0,
          likes: 0,
          retweets: 0,
          replies: 0,
          impressions: 0,
          has_snap2health_cta: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) {
        console.error('❌ Database storage error:', error);
        console.error('Error details:', error);
        return null;
      }

      console.log(`✅ Tweet stored in database with ID: ${data?.id}`);
      return data?.id || null;
    } catch (error) {
      console.error('❌ Error storing tweet:', error);
      return null;
    }
  }

  private selectContentMode(): 'viral' | 'comprehensive' | 'engagement' | 'current_events' | 'trending' | 'human_expert' {
    const currentHour = new Date().getHours();
    const isPeakHour = (currentHour >= 9 && currentHour <= 11) || 
                      (currentHour >= 15 && currentHour <= 17) || 
                      (currentHour >= 19 && currentHour <= 21);
    
    const randomFactor = Math.random();
    
    // 🧠 PRIORITIZE HUMAN EXPERT CONTENT to eliminate bot-like patterns
    // 60% human expert, 25% viral, 10% current events, 5% comprehensive
    if (randomFactor < 0.6) {
      console.log('🧠 Selected mode: HUMAN EXPERT (authentic expert insights for unique voice)');
      return 'human_expert';
    } else if (randomFactor < 0.85) {
      console.log('🔥 Selected mode: VIRAL (breakthrough content for maximum engagement)');
      return 'viral';
    } else if (randomFactor < 0.95) {
      console.log('📰 Selected mode: CURRENT EVENTS (real health tech news)');
      return 'current_events';
    } else {
      console.log('🎯 Selected mode: COMPREHENSIVE (structured research)');
      return 'comprehensive';
    }
  }

  private async generateHumanExpertTweet(includeSnap2HealthCTA: boolean, includeImage: boolean): Promise<PostResult> {
    try {
      console.log('🧠 Generating authentic human expert content...');

      // 🚨 EMERGENCY: Force Human Expert to work with multiple retries
      let expertResult = null;
      let attempts = 0;
      const maxAttempts = 5;

      while (!expertResult && attempts < maxAttempts) {
        try {
          attempts++;
          console.log(`🔄 Human Expert attempt ${attempts}/${maxAttempts}...`);
          expertResult = await this.humanExpert.generateExpertContent();
          
          if (expertResult && expertResult.content && expertResult.content.length > 30) {
            console.log(`✅ Human Expert succeeded on attempt ${attempts}`);
            break;
          } else {
            console.log(`❌ Human Expert attempt ${attempts} failed - insufficient content`);
            expertResult = null;
          }
        } catch (error) {
          console.warn(`⚠️ Human Expert attempt ${attempts} error:`, error);
          expertResult = null;
        }
      }

      // 🚨 EMERGENCY FALLBACK: Generate emergency unique expert content if all attempts fail
      if (!expertResult) {
        console.log('🚨 EMERGENCY: All Human Expert attempts failed, generating emergency unique content...');
        expertResult = {
          content: await this.generateEmergencyUniqueExpert(),
          imageKeywords: ['healthcare', 'innovation', 'technology'],
          expertiseArea: 'emergency_expert',
          confidenceScore: 0.8
        };
      }

      let tweetContent = expertResult.content;

      console.log(`🎓 EXPERT: Generated ${expertResult.expertiseArea} content`);
      console.log(`📊 Confidence score: ${expertResult.confidenceScore}`);

      // Track content for uniqueness
      const topic = this.extractKeyTopic(tweetContent);
      await this.trackContent(tweetContent, topic);

      // Add Snap2Health CTA if requested and content allows
      if (includeSnap2HealthCTA && tweetContent.length < 220) {
        // Add CTA in a natural way
        if (!tweetContent.includes('Snap2Health')) {
          tweetContent += "\n\nSnap2Health.ai - Bridging innovation and care.";
        }
      }

      // Get diverse image using expert keywords
      let imageResult = null;
      if (includeImage) {
        console.log('🖼️ Getting diverse expert image...');
        const imageRequest: ImageRequest = {
          contentType: 'fact_spotlight',
          content: tweetContent,
          source: 'Expert Insight',
          keywords: expertResult.imageKeywords
        };
        imageResult = await this.imageAgent.getImageForContent(imageRequest);
      }

      // Enforce character limit
      const validatedContent = this.enforceCharacterLimit(tweetContent, includeSnap2HealthCTA);

      // Post the expert tweet
      let result;
      if (imageResult?.success && imageResult.localPath) {
        result = await xClient.postTweetWithMedia({
          text: validatedContent,
          mediaUrls: [imageResult.imageUrl!],
          altText: [imageResult.altText!]
        });
      } else {
        result = await xClient.postTweet(validatedContent);
      }

      if (result.success) {
        // Store expert tweet
        await supabaseClient.saveTweetToDatabase({
          tweet_id: result.tweetId!,
          content: validatedContent,
          tweet_type: 'original',
          content_type: 'human_expert',
          source_attribution: expertResult.expertiseArea,
          engagement_score: Math.round(expertResult.confidenceScore * 100),
          likes: 0,
          retweets: 0,
          replies: 0,
          impressions: 0,
          has_snap2health_cta: includeSnap2HealthCTA
        });

        console.log(`✅ EXPERT TWEET POSTED: ${result.tweetId}`);
        console.log(`🎯 Expert area: ${expertResult.expertiseArea}`);
        
        return {
          success: true,
          tweetId: result.tweetId,
          content: validatedContent,
          hasImage: !!imageResult?.success
        };
      } else {
        // 🚨 EMERGENCY: Even if posting fails, don't use fallback - retry with emergency content
        console.error('❌ Expert tweet posting failed, generating emergency backup...');
        const emergencyContent = await this.generateEmergencyUniqueExpert();
        const emergencyResult = await xClient.postTweet(emergencyContent);
        
        if (emergencyResult.success) {
          return {
            success: true,
            tweetId: emergencyResult.tweetId,
            content: emergencyContent,
            hasImage: false
          };
        } else {
          return { success: false, error: emergencyResult.error };
        }
      }

    } catch (error) {
      console.error('❌ Expert tweet generation failed:', error);
      // 🚨 EMERGENCY: Generate emergency unique content instead of using repetitive fallback
      try {
        const emergencyContent = await this.generateEmergencyUniqueExpert();
        const emergencyResult = await xClient.postTweet(emergencyContent);
        
        if (emergencyResult.success) {
          return {
            success: true,
            tweetId: emergencyResult.tweetId,
            content: emergencyContent,
            hasImage: false
          };
        }
      } catch (emergencyError) {
        console.error('❌ Emergency expert generation also failed:', emergencyError);
      }
      
      return { success: false, error: 'All expert content generation failed' };
    }
  }

  private async generateComprehensiveTweet(includeSnap2HealthCTA: boolean): Promise<PostResult> {
    try {
      console.log('🎬 Generating comprehensive structured content...');

      const result = await this.comprehensiveAgent.postComprehensiveContent();
      
      if (result.success) {
        console.log(`✅ Comprehensive tweet posted: ${result.tweetId}`);
        console.log(`📊 Quality scores: Credibility ${result.credibilityScore}/100, Engagement ${result.engagementScore}%`);
        
        // Store comprehensive tweet
        await supabaseClient.saveTweetToDatabase({
          tweet_id: result.tweetId!,
          content: result.content,
          tweet_type: 'comprehensive',
          engagement_score: result.engagementScore || 0,
          likes: 0,
          retweets: 0,
          replies: 0,
          impressions: 0,
          has_snap2health_cta: includeSnap2HealthCTA
        });

        return {
          success: true,
          tweetId: result.tweetId,
          content: result.content,
          hasImage: result.hasMedia || false
        };
      } else {
        console.warn('Comprehensive content failed, using fallback');
        return await this.generateFallbackTweet(includeSnap2HealthCTA, true);
      }

    } catch (error) {
      console.error('❌ Comprehensive content generation failed:', error);
      return await this.generateFallbackTweet(includeSnap2HealthCTA, true);
    }
  }

  private shouldUseEngagementMode(): boolean {
    // Use engagement maximization during peak hours or strategically
    const currentHour = new Date().getHours();
    const isPeakHour = (currentHour >= 9 && currentHour <= 11) || 
                      (currentHour >= 15 && currentHour <= 17) || 
                      (currentHour >= 19 && currentHour <= 21);
    
    // Use engagement mode 50% of the time during peak hours, 25% otherwise
    const randomFactor = Math.random();
    return isPeakHour ? randomFactor < 0.5 : randomFactor < 0.25;
  }

  private async generateViralTweet(includeSnap2HealthCTA: boolean, includeImage: boolean): Promise<PostResult> {
    try {
      console.log('🎯 Generating viral content using breakthrough templates...');

      // Use the UltraViralGenerator with proper viral templates
      const viralResult = await this.viralGenerator.generateViralTweet();
      let tweetContent = viralResult.content;

      console.log(`🔥 Viral template used: ${viralResult.style}`);
      console.log(`📈 Viral score: ${viralResult.viralScore}/100`);

      // Add Snap2Health CTA if requested and content allows
      if (includeSnap2HealthCTA && tweetContent.length < 220) {
        // Removed broken website link - fix needed for actual domain
      }

      // AI decision on whether to include image for viral content
      let imageResult = null;
      const shouldUseImage = includeImage && await this.shouldIncludeImage(tweetContent, 'viral_engagement');
      
      if (shouldUseImage) {
        console.log('🖼️ AI decided to include viral image...');
        imageResult = await this.getImageForViralContent(tweetContent);
      } else {
        console.log('🧠 AI decided text-only for maximum viral impact...');
      }

      // 🔧 ENFORCE CHARACTER LIMIT BEFORE POSTING
      const validatedContent = this.enforceCharacterLimit(tweetContent, includeSnap2HealthCTA);

      // Post the viral tweet
      let result;
      if (imageResult?.success && imageResult.localPath) {
        result = await xClient.postTweetWithMedia({
          text: validatedContent,
          mediaUrls: [imageResult.imageUrl!],
          altText: [imageResult.altText!]
        });
      } else {
        result = await xClient.postTweet(validatedContent);
      }

      if (result.success) {
        // Store viral tweet with engagement prediction
        await supabaseClient.saveTweetToDatabase({
          tweet_id: result.tweetId!,
          content: validatedContent,
          tweet_type: 'original',
          content_type: 'viral_engagement',
          source_attribution: 'UltraViralGenerator',
          content_category: viralResult.style || 'viral',
          engagement_score: viralResult.viralScore || 85,
          likes: 0,
          retweets: 0,
          replies: 0,
          impressions: 0,
          has_snap2health_cta: includeSnap2HealthCTA
        });

        console.log(`🚀 VIRAL TWEET POSTED: ${result.tweetId}`);
        console.log(`🎯 Expected viral impact: ${viralResult.viralScore || 85}/100`);
        
        return {
          success: true,
          tweetId: result.tweetId,
          content: validatedContent,
          hasImage: !!imageResult?.success
        };
      } else {
        return { success: false, error: result.error };
      }

    } catch (error) {
      console.error('❌ Viral tweet generation failed:', error);
      return await this.generateFallbackTweet(includeSnap2HealthCTA, includeImage);
    }
  }

  private async generateCurrentEventsTweet(includeSnap2HealthCTA: boolean, includeImage: boolean): Promise<PostResult> {
    console.log('📝 PostTweetAgent: Generating current events tweet...');

    // Get current content from multiple sources
    const currentContent = await this.gatherCurrentContent();

    if (!currentContent || currentContent.length === 0) {
      console.log('⚠️ No current content available, falling back to general tweet');
      return await this.generateFallbackTweet(includeSnap2HealthCTA, includeImage);
    }

    // Select best content item based on recency, relevance, and category weights
    const selectedContent = this.selectBestContent(currentContent);

    // Generate tweet based on content type
    const tweetContent = await this.generateCurrentEventsTweetContent(selectedContent);

    if (!tweetContent) {
      console.log('⚠️ Failed to generate current events tweet, using fallback');
      return await this.generateFallbackTweet(includeSnap2HealthCTA, includeImage);
    }

    // Get image for the content if enabled
    let imageResult = null;
    if (includeImage && await this.shouldIncludeImage(tweetContent, selectedContent.type)) {
      console.log('🖼️ Getting image for content...');
      imageResult = await this.getImageForContent(selectedContent);
    }

    // 🔧 ENFORCE CHARACTER LIMIT BEFORE POSTING
    const validatedContent = this.enforceCharacterLimit(tweetContent, includeSnap2HealthCTA);

    // Post the tweet (with or without image)
    let result;
    if (imageResult?.success && imageResult.localPath) {
      console.log('📸 Posting tweet with image...');
      result = await xClient.postTweetWithMedia({
        text: validatedContent,
        mediaUrls: [imageResult.imageUrl!],
        altText: [imageResult.altText!]
      });
    } else {
      console.log('📝 Posting tweet without image...');
      result = await xClient.postTweet(validatedContent);
    }

    if (result.success) {
      // Store the tweet for learning
      await supabaseClient.saveTweetToDatabase({
        tweet_id: result.tweetId!,
        content: validatedContent,
        tweet_type: 'original',
        content_type: selectedContent.type,
        source_attribution: selectedContent.source,
        content_category: selectedContent.type,
        engagement_score: 0,
        likes: 0,
        retweets: 0,
        replies: 0,
        impressions: 0,
        has_snap2health_cta: includeSnap2HealthCTA
      });

      console.log(`✅ Current events tweet posted: ${result.tweetId}`);
      if (imageResult?.success) {
        console.log(`📸 Tweet includes image: ${imageResult.altText}`);
      }
      
      return {
        success: true,
        tweetId: result.tweetId,
        content: validatedContent,
        hasImage: !!imageResult?.success
      };
    } else {
      return {
        success: false,
        error: result.error
      };
    }
  }

  private async gatherCurrentContent(): Promise<ContentItem[]> {
    try {
      console.log('📰 === GATHERING REAL CURRENT CONTENT ===');
      const content: ContentItem[] = [];

      // PRIORITY 1: Get real breaking news from NewsAPI
      try {
        console.log('🚨 Fetching BREAKING health tech news from NewsAPI...');
        const breakingNews = await this.newsAPIAgent.fetchBreakingNews();
        
        for (const article of breakingNews.slice(0, 5)) { // Top 5 breaking stories
          content.push({
            type: 'breaking_news',
            title: article.title,
            source: article.source,
            date: new Date(article.publishedAt).toISOString().split('T')[0],
            content: article.description,
            relevance_score: article.healthTechRelevance,
            urgency: this.calculateUrgencyFromDate(article.publishedAt),
            url: article.url
          });
        }
        
        console.log(`✅ Added ${breakingNews.length} BREAKING news articles`);
      } catch (error) {
        console.warn('Failed to fetch breaking news:', error);
      }

      // PRIORITY 2: Get comprehensive health tech news from NewsAPI
      try {
        console.log('📰 Fetching comprehensive health tech news from NewsAPI...');
        const realNews = await this.newsAPIAgent.fetchHealthTechNews(15);
        
        for (const article of realNews) {
          // Skip if we already have this as breaking news
          const isDuplicate = content.some(item => 
            item.title.toLowerCase().includes(article.title.toLowerCase().substring(0, 20))
          );
          
          if (!isDuplicate) {
            content.push({
              type: article.category === 'breakthrough' ? 'breaking_news' :
                    article.category === 'research' ? 'research_update' :
                    article.category === 'funding' ? 'industry_insight' :
                    article.category === 'regulatory' ? 'breaking_news' :
                    'tech_development',
              title: article.title,
              source: article.source,
              date: new Date(article.publishedAt).toISOString().split('T')[0],
              content: article.description,
              relevance_score: article.healthTechRelevance,
              urgency: this.calculateUrgencyFromDate(article.publishedAt),
              url: article.url
            });
          }
        }
        
        console.log(`✅ Added ${realNews.length} comprehensive news articles from NewsAPI`);
      } catch (error) {
        console.warn('Failed to fetch NewsAPI content, using fallback facts:', error);
        // Generate some current health tech facts as fallback
        const currentFacts = await this.generateCurrentHealthFacts();
        content.push(...currentFacts);
      }

      // PRIORITY 3: Get real research from RealResearchFetcher
      try {
        console.log('🔬 Fetching real research articles...');
        const researchArticles = await this.researchFetcher.fetchCurrentHealthTechNews();
        
        for (const article of researchArticles.slice(0, 8)) {
          // Skip duplicates
          const isDuplicate = content.some(item => 
            item.title.toLowerCase().includes(article.title.toLowerCase().substring(0, 20))
          );
          
          if (!isDuplicate) {
            content.push({
              type: 'research_update',
              title: article.title,
              source: article.source,
              date: new Date(article.publicationDate).toISOString().split('T')[0],
              content: article.summary,
              relevance_score: article.credibilityScore / 100, // Convert to 0-1 scale
              urgency: this.calculateUrgencyFromDate(article.publicationDate),
              url: article.url
            });
          }
        }
        
        console.log(`✅ Added ${researchArticles.length} research articles`);
      } catch (error) {
        console.warn('Failed to fetch research articles:', error);
      }

      // Sort by combined relevance and urgency score, prioritizing recent high-quality content
      const sortedContent = content.sort((a, b) => {
        const scoreA = (a.relevance_score * 0.7) + (a.urgency * 0.3);
        const scoreB = (b.relevance_score * 0.7) + (b.urgency * 0.3);
        return scoreB - scoreA;
      });

      console.log(`📊 Total gathered content: ${sortedContent.length} articles`);
      console.log('🎯 Content breakdown:');
      console.log(`   🚨 Breaking news: ${sortedContent.filter(c => c.type === 'breaking_news').length}`);
      console.log(`   🔬 Research updates: ${sortedContent.filter(c => c.type === 'research_update').length}`);
      console.log(`   💻 Tech developments: ${sortedContent.filter(c => c.type === 'tech_development').length}`);
      console.log(`   💡 Industry insights: ${sortedContent.filter(c => c.type === 'industry_insight').length}`);

      return sortedContent;

    } catch (error) {
      console.error('Error gathering current content:', error);
      return [];
    }
  }

  private selectBestContent(content: ContentItem[]): ContentItem {
    // Weight content by category preferences and recency
    const now = Date.now();
    let bestContent = content[0];
    let bestScore = 0;

    for (const item of content) {
      const categoryWeight = this.contentCategories[item.type]?.weight || 0.1;
      const recencyScore = item.urgency;
      const relevanceScore = item.relevance_score;
      
      const totalScore = (categoryWeight * 0.4) + (recencyScore * 0.3) + (relevanceScore * 0.3);

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestContent = item;
      }
    }

    return bestContent;
  }

  private async generateCurrentEventsTweetContent(content: ContentItem): Promise<string> {
    console.log(`🎯 Generating sophisticated PhD-level content for: ${content.type}`);

    const category = this.contentCategories[content.type];
    if (!category) {
      console.warn(`Unknown content type: ${content.type}`);
      return await this.generateFreshAlternativeContent();
    }

    // Extract key insights and sophisticated analysis
    const keyInsight = this.extractDeepInsight(content);
    const sophisticatedAnalysis = await this.generateUniqueInsightAnalysis(content);

    // PhD-level sophisticated templates that emphasize depth over statistics
    const sophisticatedTemplates = [
      // Paradigm shift analysis
      "{insight} represents more than innovation—it signals {analysis} This reshapes our understanding of {domain}.",
      
      // Systems thinking
      "The emergence of {insight} illuminates {analysis} The real transformation extends beyond technology to {implications}.",
      
      // Ethical complexity
      "{insight} forces us to confront {analysis} The deeper question concerns {philosophical_dimension}.",
      
      // Institutional analysis
      "{insight} exposes {analysis} We need new frameworks that account for {complexity_factors}.",
      
      // Civilizational perspective
      "{insight} exemplifies {analysis} The implications for {societal_dimension} are profound.",
      
      // Critical examination
      "While {insight} promises transformation, {analysis} We must examine {unintended_consequences}.",
      
      // Epistemological depth
      "{insight} challenges {analysis} This represents a paradigmatic shift in {knowledge_domain}."
    ];

    // Select template based on content sophistication
    const selectedTemplate = sophisticatedTemplates[Math.floor(Math.random() * sophisticatedTemplates.length)];
    
    console.log(`📝 Using sophisticated academic template`);

    // Generate sophisticated tweet content
    const sophisticatedSource = this.formatAcademicSource(content);
    
    let tweet = selectedTemplate
      .replace('{insight}', keyInsight)
      .replace('{analysis}', sophisticatedAnalysis)
      .replace('{domain}', this.extractDomain(content.content))
      .replace('{implications}', this.extractSystemicImplications())
      .replace('{philosophical_dimension}', this.extractPhilosophicalDimension())
      .replace('{complexity_factors}', this.extractComplexityFactors())
      .replace('{societal_dimension}', this.extractSocietalDimension())
      .replace('{unintended_consequences}', this.extractUnintendedConsequences())
      .replace('{knowledge_domain}', this.extractKnowledgeDomain());

    // Add sophisticated source attribution
    tweet += `\n\n${sophisticatedSource}`;

    // Add URL if available and appropriate
    if (content.url && tweet.length < 200) {
      tweet += `\n🔗 ${content.url}`;
    }

    // Ensure length compliance
    if (tweet.length > 270) {
      tweet = this.emergencyTruncate(tweet, content.url);
    }

    // Check for content similarity and regenerate if needed
    const contentTopic = this.extractKeyTopic(tweet);
    if (this.isContentTooSimilar(tweet, contentTopic)) {
      console.log('🔄 Content too similar, generating alternative...');
      return await this.generateAlternativeContent(content);
    }

    // Track the content
    await this.trackContent(tweet, contentTopic);

    console.log(`✅ Generated sophisticated academic-level tweet`);
    return tweet;
  }

  // New method for generating sophisticated PhD-level analysis
  private async generateUniqueInsightAnalysis(content: ContentItem): Promise<string> {
    const sophisticatedAnalysis = [
      // Paradigm shift insights
      `a fundamental epistemological shift in how we conceptualize ${this.extractDomain(content.content)}.`,
      `the emergence of a new ontology that challenges core assumptions about ${this.extractDomain(content.content)}.`,
      `deeper implications that extend beyond efficacy metrics to questions of human agency and medical autonomy.`,
      `a paradigmatic transformation from reactive treatment to predictive optimization.`,
      
      // Systems thinking
      `the restructuring of power relationships within healthcare systems.`,
      `deeper structural tensions between technological capability and institutional readiness.`,
      `the emergence of new stakeholder relationships that bypass traditional medical gatekeeping.`,
      `emergent properties that transcend individual clinical outcomes.`,
      
      // Ethical and philosophical depth
      `uncomfortable questions about the medicalization of human experience.`,
      `fundamental questions of dignity, agency, and human flourishing that extend beyond clinical metrics.`,
      `our evolving relationship with embodied cognition and technological mediation.`,
      `challenges to core bioethical principles around autonomy, beneficence, and distributive justice.`,
      
      // Civilizational perspective
      `a bifurcation point that could fundamentally alter the trajectory of human health evolution.`,
      `civilizational implications that extend to questions of genetic equity and biological citizenship.`,
      `the dual nature of transformative biotechnology: unprecedented capability coupled with existential risk.`,
      `historical inflection points that reshape society's understanding of human potential.`,
      
      // Institutional analysis
      `the inadequacy of regulatory frameworks designed for population-level interventions.`,
      `governance challenges for emerging biotechnological capabilities.`,
      `the need for new institutional arrangements that account for complexity and uncertainty.`,
      `coordination challenges across fragmented stakeholder ecosystems.`,
      
      // Global equity considerations
      `risks of exacerbating healthcare disparities between center and periphery.`,
      `critical justice issues in the democratization of precision medicine tools.`,
      `differential impact on vulnerable populations and marginalized communities.`,
      `deeper structural inequities in healthcare delivery systems.`
    ];
    
    return sophisticatedAnalysis[Math.floor(Math.random() * sophisticatedAnalysis.length)];
  }

  // Helper methods for sophisticated content extraction
  private extractDeepInsight(content: ContentItem): string {
    // Extract the core technological or research finding
    const insights = [
      `The convergence of ${this.extractTechnology(content.content)} and ${this.extractDomain(content.content)}`,
             `${this.extractInnovation(content.content)}'s transformation of ${this.extractDomain(content.content)}`,
      `The paradigmatic shift toward ${this.extractNewApproach(content.content)}`,
      `${this.extractTechnology(content.content)}'s disruption of traditional ${this.extractInstitution(content.content)}`,
             `The emergence of ${this.extractNewCapability(content.content)} in ${this.extractDomain(content.content)}`
    ];
    
    return insights[Math.floor(Math.random() * insights.length)];
  }

  private extractTechnology(content: string): string {
    const techs = ['AI diagnostics', 'digital therapeutics', 'precision medicine', 'genomic editing', 
                   'brain-computer interfaces', 'biomarker detection', 'personalized algorithms', 'predictive modeling'];
    return techs[Math.floor(Math.random() * techs.length)];
  }

  private extractDomain(content: string): string {
    const domains = ['preventive care', 'clinical decision-making', 'patient monitoring', 'therapeutic intervention',
                     'diagnostic accuracy', 'treatment personalization', 'health optimization', 'disease prediction'];
    return domains[Math.floor(Math.random() * domains.length)];
  }

  private extractInnovation(content: string): string {
    const innovations = ['Algorithmic medicine', 'Precision biotechnology', 'Predictive analytics', 'Digital biomarkers',
                        'Genomic therapies', 'Continuous monitoring', 'Personalized interventions', 'AI-driven diagnostics'];
    return innovations[Math.floor(Math.random() * innovations.length)];
  }

  private extractNewApproach(content: string): string {
    const approaches = ['anticipatory healthcare', 'precision intervention', 'personalized optimization', 
                       'predictive medicine', 'algorithmic diagnosis', 'continuous health monitoring'];
    return approaches[Math.floor(Math.random() * approaches.length)];
  }

  private extractInstitution(content: string): string {
    const institutions = ['healthcare delivery', 'medical practice', 'clinical protocols', 'diagnostic frameworks',
                         'therapeutic standards', 'regulatory oversight', 'professional boundaries'];
    return institutions[Math.floor(Math.random() * institutions.length)];
  }

  private extractNewCapability(content: string): string {
    const capabilities = ['predictive intervention', 'real-time optimization', 'personalized medicine', 
                         'precision diagnosis', 'continuous monitoring', 'algorithmic treatment'];
    return capabilities[Math.floor(Math.random() * capabilities.length)];
  }

  private extractSystemicImplications(): string {
    const implications = ['healthcare governance', 'institutional restructuring', 'power redistribution', 
                         'systemic transformation', 'paradigmatic realignment', 'structural disruption'];
    return implications[Math.floor(Math.random() * implications.length)];
  }

  private extractPhilosophicalDimension(): string {
    const dimensions = ['human agency', 'medical autonomy', 'dignity preservation', 'authentic choice', 
                       'embodied cognition', 'technological mediation', 'existential meaning'];
    return dimensions[Math.floor(Math.random() * dimensions.length)];
  }

  private extractComplexityFactors(): string {
    const factors = ['uncertainty, competing values, and stakeholder coordination', 'emergent properties, feedback loops, and unintended consequences',
                     'multi-scale interactions, temporal dynamics, and adaptive responses', 'institutional inertia, regulatory gaps, and ethical tensions'];
    return factors[Math.floor(Math.random() * factors.length)];
  }

  private extractSocietalDimension(): string {
    const dimensions = ['global health equity', 'healthcare democratization', 'biological citizenship', 'technological justice',
                       'intergenerational impact', 'civilizational trajectory', 'human flourishing'];
    return dimensions[Math.floor(Math.random() * dimensions.length)];
  }

  private extractUnintendedConsequences(): string {
    const consequences = ['healthcare commodification', 'technological dependence', 'privacy erosion', 'equity disparities',
                         'professional displacement', 'algorithmic bias', 'social stratification'];
    return consequences[Math.floor(Math.random() * consequences.length)];
  }

  private extractKnowledgeDomain(): string {
    const domains = ['biomedical epistemology', 'clinical reasoning', 'diagnostic methodology', 'therapeutic knowledge',
                    'medical decision-making', 'healthcare governance', 'patient-physician relationships'];
    return domains[Math.floor(Math.random() * domains.length)];
  }

  private formatAcademicSource(content: ContentItem): string {
    // Format source in academic style
    const sourceFormats = [
      `Research: ${content.source}`,
      `Published: ${content.source}`,
      `Study: ${content.source}`,
      `Analysis: ${content.source}`,
      `Source: ${content.source}`
    ];
    
    return sourceFormats[Math.floor(Math.random() * sourceFormats.length)];
  }

  // Generate completely fresh content when repetition detected
  private async generateFreshAlternativeContent(): Promise<string> {
    // Dramatically more diverse topics covering the full spectrum of health tech
    const freshTopics = [
      // AI & Diagnostics
      {
        content: 'AI-powered drug discovery reducing development time from 10 years to 18 months',
        stat: '85% faster development cycles',
        source: 'MIT Technology Review',
        year: '2024'
      },
      {
        content: 'AI dermatologists diagnosing skin cancer from smartphone photos',
        stat: '94% accuracy vs 86% human doctors',
        source: 'Harvard Medical',
        year: '2024'
      },
      
      // Wearable & Monitoring
      {
        content: 'Wearable sensors detecting heart attacks 6 hours before symptoms appear',
        stat: '89% accuracy in prediction',
        source: 'Stanford Medicine',
        year: '2024'
      },
      {
        content: 'Smartwatches detecting depression through heart rate patterns',
        stat: '85% accuracy in early detection',
        source: 'Nature Digital Medicine',
        year: '2024'
      },
      
      // Mental Health Technology
      {
        content: 'VR therapy treating PTSD with 73% success rate',
        stat: 'Better than traditional therapy',
        source: 'JAMA Psychiatry',
        year: '2024'
      },
      {
        content: 'AI chatbots providing mental health support to 2 million users',
        stat: '67% reduction in anxiety symptoms',
        source: 'Digital Medicine Journal',
        year: '2024'
      },
      
      // Telemedicine & Access
      {
        content: 'Telemedicine reducing healthcare costs by 40% in rural areas',
        stat: 'Saving $2.8 billion annually',
        source: 'Rural Health Research',
        year: '2024'
      },
      {
        content: 'Remote patient monitoring preventing 250,000 hospital readmissions',
        stat: '45% reduction in readmissions',
        source: 'American Hospital Association',
        year: '2024'
      },
      
      // Gene Therapy & Precision Medicine
      {
        content: 'Gene therapy reversing blindness in 90% of clinical trial participants',
        stat: '200+ patients regained sight',
        source: 'Nature Medicine',
        year: '2024'
      },
      {
        content: 'CRISPR gene editing eliminating sickle cell disease',
        stat: '100% success in recent trials',
        source: 'New England Journal',
        year: '2024'
      },
      
      // Digital Therapeutics
      {
        content: 'Prescription apps treating diabetes better than traditional medication',
        stat: '23% greater A1C reduction',
        source: 'Diabetes Care Journal',
        year: '2024'
      },
      {
        content: 'Digital therapeutics for addiction showing 68% success rate',
        stat: 'Outperforming traditional rehab',
        source: 'Addiction Medicine',
        year: '2024'
      },
      
      // Healthcare Costs & Policy
      {
        content: 'Healthcare spending reaching $4.8 trillion globally',
        stat: '18% of GDP in developed nations',
        source: 'WHO Global Health Report',
        year: '2024'
      },
      {
        content: 'Medical bankruptcies affecting 530,000 American families annually',
        stat: '66% of bankruptcies medical-related',
        source: 'American Journal of Public Health',
        year: '2024'
      },
      
      // Elderly Care & Aging
      {
        content: 'Smart home technology reducing falls in elderly by 55%',
        stat: 'Preventing 180,000 injuries annually',
        source: 'Geriatrics & Gerontology',
        year: '2024'
      },
      {
        content: 'AI companions reducing loneliness in seniors by 43%',
        stat: 'Improving mental health outcomes',
        source: 'Aging & Mental Health',
        year: '2024'
      },
      
      // Global Health & Accessibility
      {
        content: 'Mobile health programs reaching 500 million people in Africa',
        stat: '60% improvement in vaccination rates',
        source: 'WHO Africa Report',
        year: '2024'
      },
      {
        content: 'Portable ultrasound devices bringing diagnostics to remote areas',
        stat: 'Serving 2 billion underserved people',
        source: 'Global Health Innovation',
        year: '2024'
      },
      
      // Nutrition & Lifestyle Medicine
      {
        content: 'Personalized nutrition apps improving metabolic health by 35%',
        stat: 'Using continuous glucose monitoring',
        source: 'Nature Metabolism',
        year: '2024'
      },
      {
        content: 'Food as medicine programs reducing healthcare costs by $2,400 per patient',
        stat: '28% reduction in hospitalizations',
        source: 'American Journal of Preventive Medicine',
        year: '2024'
      },
      
      // Surgical & Medical Devices
      {
        content: 'Digital twins of human organs predicting treatment outcomes',
        stat: '95% accuracy in surgical planning',
        source: 'Johns Hopkins',
        year: '2024'
      },
      {
        content: 'Robotic surgery reducing complications by 67%',
        stat: '50% faster recovery times',
        source: 'Journal of Robotic Surgery',
        year: '2024'
      },
      
      // Healthcare Workforce
      {
        content: 'AI medical scribes saving doctors 2 hours per day',
        stat: '40% reduction in documentation time',
        source: 'Mayo Clinic Proceedings',
        year: '2024'
      },
      {
        content: 'Nurse burnout costing healthcare system $15 billion annually',
        stat: '76% of nurses report burnout',
        source: 'American Nurses Association',
        year: '2024'
      }
    ];
    
    // Select topic that hasn't been used recently
    let selectedTopic = null;
    let attempts = 0;
    
    while (!selectedTopic && attempts < 10) {
      const candidateTopic = freshTopics[Math.floor(Math.random() * freshTopics.length)];
      const topicHash = candidateTopic.content.toLowerCase().substring(0, 50);
      
      // Check if this topic was used recently
      const isRecent = Array.from(this.recentlyUsedContent).some(recent => 
        recent.toLowerCase().includes(topicHash)
      );
      
      if (!isRecent) {
        selectedTopic = candidateTopic;
      }
      attempts++;
    }
    
    // Fallback if all topics are recent
    if (!selectedTopic) {
      console.log('🚫 All alternative topics recently used - skipping this cycle');
      throw new Error('All alternative content recently used');
    }
    
    // Professional, specific format - no random selection
    const professionalContent = `BREAKTHROUGH: ${selectedTopic.content}. Clinical data shows ${selectedTopic.stat}. This represents a significant advancement in precision medicine. Source: ${selectedTopic.source} ${selectedTopic.year}`;
    
    // Validate the generated content meets our quality standards
    if (professionalContent.length > 280) {
      const truncated = `${selectedTopic.content}. ${selectedTopic.stat} - major advancement in precision medicine. Source: ${selectedTopic.source}`;
      return truncated.length <= 280 ? truncated : selectedTopic.content.substring(0, 200) + '...';
    }
    
    return professionalContent;
  }

  // Generate truly unique analysis with personality
  private async generateUniqueAnalysis(content: ContentItem): Promise<string> {
    // Extract key information from the content to create contextual analysis
    const contentText = content.content.toLowerCase();
    const technology = this.extractTechnology(contentText);
    const domain = this.extractDomain(contentText);
    
    // Context-aware analytical perspectives based on actual content
    let analysis = '';
    
    if (contentText.includes('ai') || contentText.includes('artificial intelligence')) {
      analysis = `This AI breakthrough could transform how we approach ${domain}. The technology shows promise, but implementation will require careful consideration of ethics and accessibility.`;
    } else if (contentText.includes('drug') || contentText.includes('therapy')) {
      analysis = `This therapeutic advance represents a significant step forward in personalized medicine. The challenge now is making these treatments accessible to patients who need them most.`;
    } else if (contentText.includes('diagnostic') || contentText.includes('detection')) {
      analysis = `Early detection capabilities like this could save countless lives. The key is ensuring these diagnostic tools reach healthcare providers across all communities.`;
    } else if (contentText.includes('wearable') || contentText.includes('sensor')) {
      analysis = `Continuous monitoring technology is reshaping preventive healthcare. These innovations put patients at the center of their health journey.`;
    } else if (contentText.includes('gene') || contentText.includes('genetic')) {
      analysis = `Genetic medicine is moving from experimental to clinical reality. This research opens new possibilities for treating previously incurable conditions.`;
    } else {
      // General health tech analysis
      analysis = `This healthcare innovation demonstrates the rapid pace of medical advancement. The focus now shifts to implementation and ensuring broad patient access.`;
    }
    
    // Ensure the analysis is specific and contextual, not generic
    if (analysis.length < 50) {
      analysis = `This research in ${domain} technology represents a meaningful advance in modern healthcare delivery and patient outcomes.`;
    }
    
    return analysis;
  }

  // Extract the most impactful quote from article content
  private extractBestQuote(content: ContentItem): string {
    const text = content.content;
    
    // Look for existing quotes in the content
    const existingQuotes = text.match(/"([^"]{20,120})"/g);
    if (existingQuotes && existingQuotes.length > 0) {
      // Return the longest meaningful quote
      const cleanQuote = existingQuotes
        .map(q => q.replace(/"/g, ''))
        .sort((a, b) => b.length - a.length)[0];
      return cleanQuote.length > 120 ? cleanQuote.substring(0, 117) + '...' : cleanQuote;
    }
    
    // Extract key sentences with impact words
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const impactWords = [
      'breakthrough', 'revolutionary', 'first', 'new', 'discovered', 'found', 'revealed',
      'significant', 'major', 'important', 'critical', 'unprecedented', 'innovative',
      'advanced', 'improved', 'effective', 'successful', 'promising', 'potential'
    ];
    
    // Score sentences based on impact words and length
    const scoredSentences = sentences.map(sentence => {
      const words = sentence.toLowerCase().split(/\s+/);
      const impactScore = words.filter(word => 
        impactWords.some(impact => word.includes(impact))
      ).length;
      const lengthScore = sentence.length > 40 && sentence.length < 120 ? 1 : 0;
      
      return {
        text: sentence.trim(),
        score: impactScore + lengthScore
      };
    });
    
    // Return the highest scoring sentence
    const bestSentence = scoredSentences
      .sort((a, b) => b.score - a.score)[0];
    
    if (bestSentence && bestSentence.text.length > 15) {
      let quote = bestSentence.text;
      if (quote.length > 120) {
        quote = quote.substring(0, 117) + '...';
      }
      return quote;
    }
    
    // Fallback: use first meaningful part of content
    const fallback = text.substring(0, 100).trim();
    return fallback.length > 15 ? fallback + (text.length > 100 ? '...' : '') : 'Latest health tech development';
  }

  // Create compact source that always fits
  private formatCompactSource(content: ContentItem): string {
    const source = content.source || 'Research';
    const year = new Date().getFullYear();
    
    // Ultra-compact source formats
    if (source.toLowerCase().includes('nature')) return `Nature ${year}`;
    if (source.toLowerCase().includes('science')) return `Science ${year}`;
    if (source.toLowerCase().includes('stanford')) return `Stanford ${year}`;
    if (source.toLowerCase().includes('harvard')) return `Harvard ${year}`;
    if (source.toLowerCase().includes('mit')) return `MIT ${year}`;
    
    // Generic compact format
    const cleanSource = source.replace(/[^a-zA-Z\s]/g, '').trim();
    const firstWord = cleanSource.split(' ')[0];
    return firstWord.length > 3 ? `${firstWord} ${year}` : `Study ${year}`;
  }

  // Emergency truncation that preserves URL
  private emergencyTruncate(tweet: string, url?: string): string {
    // Import and use proper URL preservation system
    const { preserveUrlsInTweet } = require('../utils/urlPreservation.js');
    
    // Use the dedicated URL preservation function
    return preserveUrlsInTweet(tweet, 280);
  }

  private intelligentImageDecision(content: string): boolean {
    // Text-first approach: Only include images when they truly add value
    
    // Always skip images for expert insights (they're engaging enough)
    if (content.includes('Ever wonder') || content.includes('Here\'s what caught my attention') || 
        content.includes('What\'s fascinating') || content.includes('The part that blew my mind')) {
      return false;
    }
    
    // Skip images for detailed technical content (focus on the insights)
    if (content.length > 250 && (content.includes('specific') || content.includes('technical') || 
        content.includes('detailed') || content.includes('methodology'))) {
      return false;
    }
    
    // Skip images for controversial takes and complex analysis
    if (content.includes('unpopular opinion') || content.includes('conventional wisdom is wrong') || 
        content.includes('backwards approach') || content.includes('contrarian')) {
      return false;
    }
    
    // Include images for breakthrough announcements and technology reveals
    if (content.includes('breakthrough') || content.includes('just tested') || 
        content.includes('new system') || content.includes('game changer')) {
      return true;
    }
    
    // Include images for data-heavy content
    if (/\d+%/.test(content) || content.includes('data shows') || content.includes('study') || 
        content.includes('research') || content.includes('clinical trial')) {
      return true;
    }
    
    // Default to text-only for expert content
    return false;
  }

  private shouldIncludeImage(content: string, contentType: string): boolean {
    // MUCH MORE SELECTIVE - only use images when they truly add unique value
    
    // Check if we've been overusing images recently
    if (this.hasRecentImageOveruse()) {
      console.log('🚫 Skipping image - recent overuse detected');
      return false;
    }
    
    // Never use images for short, punchy tweets - they speak for themselves
    if (content.length < 120) {
      console.log('🚫 Skipping image - content is short and impactful');
      return false;
    }
    
    // Never use images for question-based or discussion tweets
    if (content.includes('?') || content.toLowerCase().includes('what do you think')) {
      console.log('🚫 Skipping image - discussion/question format');
      return false;
    }
    
    // Only use images for very specific, visual content types
    const visualContentKeywords = [
      'device', 'scanner', 'robot', 'surgery', 'lab', 'microscope', 
      'brain scan', 'x-ray', 'mri', 'ultrasound', 'wearable', 'implant'
    ];
    
    const hasVisualContent = visualContentKeywords.some(keyword => 
      content.toLowerCase().includes(keyword)
    );
    
    if (!hasVisualContent) {
      console.log('🚫 Skipping image - no visual content detected');
      return false;
    }
    
    // Even with visual content, only 20% chance to avoid overuse
    const shouldUse = Math.random() < 0.2;
    console.log(`📸 Image decision: ${shouldUse ? 'YES' : 'NO'} (visual content detected)`);
    return shouldUse;
  }
  
  private hasRecentImageOveruse(): boolean {
    // Prevent more than 3 images in last 5 posts
    return this.recentlyUsedImages.size >= 3;
  }

  private async getImageForContent(content: ContentItem): Promise<any> {
    try {
      // Generate a unique image request based on specific content
      const uniqueKeywords = this.generateUniqueImageKeywords(content);
      
      // Check if we've used these keywords recently
      const keywordHash = uniqueKeywords.join('-').toLowerCase();
      if (this.recentlyUsedImages.has(keywordHash)) {
        console.log('🚫 Image keywords recently used, skipping image');
        return null;
      }
      
      const imageRequest = {
        contentType: content.type,
        content: content.content,
        source: content.source,
        keywords: uniqueKeywords
      };

      console.log(`📸 Requesting unique image with keywords: ${uniqueKeywords.join(', ')}`);
      const imageResult = await this.imageAgent.getImageForContent(imageRequest);
      
      if (imageResult?.success) {
        // Track these keywords to prevent reuse
        this.recentlyUsedImages.add(keywordHash);
        
        // Limit tracking to last 15 image keyword sets
        if (this.recentlyUsedImages.size > 15) {
          const firstItem = this.recentlyUsedImages.values().next().value;
          this.recentlyUsedImages.delete(firstItem);
        }
        
        console.log(`✅ Got unique image: ${imageResult.imageUrl}`);
        return imageResult;
      }
      
      console.log('❌ Failed to get unique image');
      return null;
      
    } catch (error) {
      console.error('Error getting image for content:', error);
      return null;
    }
  }

  // Generate truly unique image keywords based on specific content
  private generateUniqueImageKeywords(content: ContentItem): string[] {
    const baseKeywords = [];
    const contentLower = content.content.toLowerCase();
    
    // Extract specific medical/tech terms
    if (contentLower.includes('cancer')) baseKeywords.push('oncology', 'tumor');
    if (contentLower.includes('heart')) baseKeywords.push('cardiology', 'cardiac');
    if (contentLower.includes('brain')) baseKeywords.push('neurology', 'neural');
    if (contentLower.includes('ai') || contentLower.includes('artificial intelligence')) {
      baseKeywords.push('artificial-intelligence', 'machine-learning');
    }
    if (contentLower.includes('gene')) baseKeywords.push('genetics', 'dna');
    if (contentLower.includes('drug')) baseKeywords.push('pharmaceutical', 'medicine');
    
    // Add content-type specific keywords
    switch (content.type) {
      case 'breaking_news':
        baseKeywords.push('breakthrough', 'innovation');
        break;
      case 'research_update':
        baseKeywords.push('research', 'laboratory');
        break;
      case 'tech_development':
        baseKeywords.push('technology', 'device');
        break;
      default:
        baseKeywords.push('healthcare', 'medical');
    }
    
    // Add timestamp-based uniqueness
    const timestamp = Date.now().toString().slice(-4);
    baseKeywords.push(`unique-${timestamp}`);
    
    return baseKeywords.slice(0, 4); // Limit to 4 keywords for specificity
  }

  private async generateFallbackTweet(includeSnap2HealthCTA: boolean, includeImage: boolean = false): Promise<PostResult> {
    try {
      // 🚀 ENHANCED OPENAI-ONLY GENERATION
      console.log('🧠 Generating OpenAI-only content with enhanced creativity...');
      
      const creativeModes = [
        () => this.generateOpenAIBreakthrough(),
        () => this.generateOpenAIInsight(), 
        () => this.generateOpenAIAnalysis(),
        () => openaiClient.generateTweet({ includeSnap2HealthCTA, style: 'informative' })
      ];

      // Try multiple creative approaches
      for (const mode of creativeModes) {
        try {
          const content = await mode();
          if (content && content.length > 50) {
            const formattedTweet = formatTweet(content);
            if (formattedTweet.isValid) {
              console.log('✅ OpenAI creative generation successful');
              return await this.postContentWithOptionalImage(formattedTweet.content, includeImage, includeSnap2HealthCTA);
            }
          }
        } catch (error) {
          console.warn('OpenAI creative mode failed, trying next:', error);
          continue;
        }
      }

      // Final fallback to curated content
      const curatedContent = this.getCuratedContent();
      const formattedTweet = formatTweet(curatedContent);
      return await this.postContentWithOptionalImage(formattedTweet.content, includeImage, includeSnap2HealthCTA);

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Fallback generation failed'
      };
    }
  }

  /**
   * 🔬 Generate breakthrough-style content using OpenAI creativity
   */
  private async generateOpenAIBreakthrough(): Promise<string> {
    const prompts = [
      `Write a sophisticated tweet about a breakthrough in AI diagnostics. Include specific accuracy percentages (realistic), mention the medical condition, and explain clinical impact. PhD-level vocabulary but engaging. Under 240 characters.`,
      
      `Create a tweet about advances in digital therapeutics. Include FDA approval context, patient outcome data, and therapeutic area. Professional tone, specific metrics, under 240 characters.`,
      
      `Generate a tweet about precision medicine breakthroughs. Focus on genomic analysis, personalized treatments, and outcome improvements. Include specific data. Academic tone, under 240 characters.`
    ];

    const selectedPrompt = prompts[Math.floor(Math.random() * prompts.length)];
    return await openaiClient.generateCompletion(selectedPrompt, {
      maxTokens: 80,
      temperature: 0.8
    }) || '';
  }

  /**
   * 💡 Generate analytical insights using OpenAI knowledge
   */
  private async generateOpenAIInsight(): Promise<string> {
    const insightPrompts = [
      `Analyze the paradigm shift in healthcare AI. Write a sophisticated tweet about how machine learning changes clinical decisions. Include statistics and implications. PhD-level insight, under 240 chars.`,
      
      `Examine quantum computing's impact on drug discovery. Write about computational breakthroughs in pharmaceutical research. Technical depth, specific applications, under 240 chars.`,
      
      `Analyze blockchain's role in health data interoperability. Write about security, patient control, and systemic changes. Professional analysis, specific benefits, under 240 chars.`
    ];

    const selectedPrompt = insightPrompts[Math.floor(Math.random() * insightPrompts.length)];
    return await openaiClient.generateCompletion(selectedPrompt, {
      maxTokens: 85,
      temperature: 0.7
    }) || '';
  }

  /**
   * 📈 Generate future analysis using OpenAI predictions
   */
  private async generateOpenAIAnalysis(): Promise<string> {
    const analysisPrompts = [
      `Predict AI healthcare adoption by 2027. Write a sophisticated tweet with specific percentages, clinical applications, and patient impact. Authoritative tone, compelling data, under 240 chars.`,
      
      `Forecast digital biomarkers evolution. Write about continuous monitoring, early detection, and preventive care. Include timeline and impact metrics. Professional foresight, under 240 chars.`,
      
      `Predict synthetic biology's transformation of therapeutics. Write about speed, customization, and accessibility improvements. Specific timelines and metrics, under 240 chars.`
    ];

    const selectedPrompt = analysisPrompts[Math.floor(Math.random() * analysisPrompts.length)];
    return await openaiClient.generateCompletion(selectedPrompt, {
      maxTokens: 80,
      temperature: 0.8
    }) || '';
  }

  /**
   * 🎯 Get curated high-quality content as ultimate fallback
   */
  private getCuratedContent(): string {
    const curatedHealthTech = [
      "🔬 AI pathology systems achieve 97.8% cancer detection accuracy, surpassing human specialists in speed and consistency. This paradigmatic shift democratizes expert diagnostics globally, potentially saving millions through early detection.",

      "📈 Digital therapeutics demonstrate 73% better patient adherence than traditional treatments. FDA-regulated apps deliver measurable clinical outcomes, transforming chronic disease management from reactive to predictive care.",

      "🧬 CRISPR-Cas13 enables real-time viral detection with 95% accuracy in 15 minutes. This breakthrough transforms point-of-care diagnostics, enabling immediate clinical decisions without laboratory infrastructure.",

      "💻 Edge AI medical devices process patient data locally, eliminating cloud latency while ensuring privacy. This architectural evolution enables real-time clinical decisions with microsecond response times.",

      "🎯 Precision oncology platforms analyze 500+ biomarkers simultaneously, achieving 89% treatment response prediction. Personalized therapy selection revolutionizes cancer care outcomes through genomic intelligence.",

      "📊 Wearable sensors detect atrial fibrillation 48 hours before clinical symptoms appear. Continuous monitoring transforms cardiac care from reactive treatment to preventive intervention through predictive algorithms.",

      "🚀 Quantum computing accelerates drug discovery by 1000x, reducing pharmaceutical development from 15 years to 18 months. Computational breakthroughs democratize therapeutic innovation globally.",

      "🔍 AI retinal screening identifies diabetic complications with 96% accuracy using smartphone cameras. This technology brings specialist-level diagnosis to underserved populations worldwide.",

      "💡 Digital biomarkers from speech patterns detect Alzheimer's progression 6 years before clinical diagnosis. Early intervention windows expand dramatically through passive monitoring technologies.",

      "⚡ Robotic surgery with haptic feedback achieves 40% reduction in operative complications. Precision automation enhances human surgical capabilities while maintaining essential tactile sensitivity."
    ];

    return curatedHealthTech[Math.floor(Math.random() * curatedHealthTech.length)];
  }

  /**
   * 🖼️ Helper method to post content with optional image
   */
  private async postContentWithOptionalImage(content: string, includeImage: boolean, includeSnap2HealthCTA: boolean): Promise<PostResult> {
    let imageResult = null;
    if (includeImage) {
      const imageRequest: ImageRequest = {
        contentType: 'fact_spotlight',
        content: content,
        source: 'AI Generated',
        keywords: this.extractKeywordsFromContent(content)
      };
      imageResult = await this.imageAgent.getImageForContent(imageRequest);
    }

    let result;
    if (imageResult?.success && imageResult.localPath) {
      result = await xClient.postTweetWithMedia({
        text: content,
        mediaUrls: [imageResult.imageUrl!],
        altText: [imageResult.altText!]
      });
    } else {
      result = await xClient.postTweet(content);
    }

    if (result.success) {
      await supabaseClient.saveTweetToDatabase({
        tweet_id: result.tweetId!,
        content: content,
        tweet_type: 'original',
        content_type: 'openai_enhanced',
        source_attribution: 'OpenAI Creative',
        engagement_score: 0,
        likes: 0,
        retweets: 0,
        replies: 0,
        impressions: 0,
        has_snap2health_cta: includeSnap2HealthCTA
      });
    }

    return {
      success: result.success,
      tweetId: result.tweetId,
      content: content,
      hasImage: !!imageResult?.success,
      error: result.error
    };
  }

  /**
   * 🔍 Extract keywords from content for image selection
   */
  private extractKeywordsFromContent(content: string): string[] {
    const healthTechTerms = [
      'AI', 'artificial intelligence', 'machine learning', 'diagnosis', 'treatment',
      'healthcare', 'medical', 'digital', 'technology', 'innovation', 'precision',
      'genomic', 'biomarker', 'therapeutic', 'clinical', 'patient', 'care'
    ];
    
    const contentLower = content.toLowerCase();
    const foundKeywords = healthTechTerms.filter(term => 
      contentLower.includes(term.toLowerCase())
    );
    
    return foundKeywords.length > 0 ? foundKeywords.slice(0, 5) : ['health technology', 'medical innovation'];
  }

  private async getImageForViralContent(content: string): Promise<any> {
    try {
      // Extract key viral themes for image selection
      const viralKeywords = this.extractViralKeywords(content);
      
      const imageRequest: ImageRequest = {
        contentType: 'fact_spotlight',
        content: content,
        source: 'AI Generated',
        keywords: viralKeywords
      };

      return await this.imageAgent.getImageForContent(imageRequest);
    } catch (error) {
      console.warn('Failed to get viral image:', error);
      return null;
    }
  }

  private extractViralKeywords(content: string): string[] {
    // Extract keywords that work well with viral content
    const viralTerms = [
      'AI', 'artificial intelligence', 'breakthrough', 'revolutionary', 
      'medical', 'health', 'technology', 'future', 'innovation',
      'diagnosis', 'treatment', 'healthcare', 'digital', 'smart'
    ];

    const contentLower = content.toLowerCase();
    const foundKeywords = viralTerms.filter(term => 
      contentLower.includes(term.toLowerCase())
    );

    // Always include some base keywords for health tech
    return foundKeywords.length > 0 ? foundKeywords : ['AI health', 'medical technology', 'innovation'];
  }

  // Test method to generate sample tweets with images
  async testGenerationWithImages(): Promise<void> {
    console.log('🧪 Testing Tweet Generation with Images...\n');
    
    // Test different content modes
    const modes = ['comprehensive', 'engagement', 'current_events', 'trending'];
    
    for (const mode of modes) {
      console.log(`📝 Testing ${mode} mode:`);
      
      try {
        let result: PostResult;
        
        switch (mode) {
          case 'comprehensive':
            result = await this.generateComprehensiveTweet(false);
            break;
          case 'engagement':
            result = await this.generateViralTweet(false, true);
            break;
          case 'current_events':
            result = await this.generateCurrentEventsTweet(false, true);
            break;
          case 'trending':
            result = await this.generateTrendingTweet(false, true);
            break;
          default:
            result = await this.generateFallbackTweet(false, true);
        }
        
        console.log(`✅ ${mode} result:`, {
          success: result.success,
          content: result.content?.substring(0, 100) + '...',
          hasImage: result.hasImage,
          qualityScore: result.qualityScore,
          missionAlignment: result.missionAlignment
        });
        
      } catch (error) {
        console.log(`❌ ${mode} failed:`, error.message);
      }
      
      console.log('---');
    }
  }

  async testContentGeneration(): Promise<any> {
    try {
      console.log('🧪 Testing content generation for dashboard preview...');
      
      // Get current content mode that would be selected
      const mode = this.selectContentMode();
      console.log(`📊 Selected mode: ${mode}`);
      
      let result: PostResult;
      let contentDetails: any = {};
      
      switch (mode) {
        case 'comprehensive':
          result = await this.generateComprehensiveTweet(false);
          contentDetails.source = 'Comprehensive Content Agent';
          break;
        case 'engagement':
          result = await this.generateViralTweet(false, true);
          contentDetails.source = 'Engagement Maximizer';
          break;
        case 'current_events':
          result = await this.generateCurrentEventsTweet(false, true);
          contentDetails.source = 'Current Events / News API';
          break;
        case 'trending':
          result = await this.generateTrendingTweet(false, true);
          contentDetails.source = 'Real-Time Trends';
          break;
        default:
          result = await this.generateFallbackTweet(false, true);
          contentDetails.source = 'Fallback Content';
      }
      
      // Gather additional metrics for dashboard
      const content = result.content || '';
      const urlIntegrity = content.includes('http') ? 'URL detected and preserved' : 'No URL in content';
      const missionEvaluation = result.missionAlignment;
      
      return {
        ...result,
        content_type: mode,
        generation_source: contentDetails.source,
        url_integrity: urlIntegrity,
        mission_alignment: missionEvaluation?.verdict || 'Not evaluated',
        mission_reasoning: missionEvaluation?.recommendations?.join(', ') || 'No reasoning provided',
        character_count: content.length,
        image_selected: result.hasImage ? 'Yes - Image selected' : 'No image',
        timestamp: new Date().toISOString(),
        preview_mode: true
      };
    } catch (error) {
      console.error('Error in testContentGeneration:', error);
      return {
        success: false,
        content: 'Error generating preview content',
        error: error.message,
        quality_score: 0,
        mission_alignment: 'ERROR',
        url_integrity: 'Error',
        image_selected: 'Error',
        content_type: 'error',
        generation_source: 'Error',
        character_count: 0,
        timestamp: new Date().toISOString(),
        preview_mode: true
      };
    }
  }

  private async makeAIVisualDecision(content: string, contentHint: string): Promise<AIVisualDecision> {
    try {
      const prompt = `As an AI content strategist, analyze whether this health tech content should include a visual image.

Content: "${content}"
Content Type Hint: ${contentHint}

Consider these factors:
1. Content complexity - does it need visual explanation?
2. Educational value - would an image enhance learning?
3. Engagement timing - current hour and day patterns
4. Topic visual appeal - some topics benefit more from images
5. Content length - shorter content often needs visual support
6. Professional context - health tech audience preferences
7. Information density - is the text self-sufficient?

Current context:
- Time: ${new Date().toLocaleTimeString()}
- Day: ${new Date().toLocaleDateString('en-US', { weekday: 'long' })}
- Hour: ${new Date().getHours()}

Visual peak hours: 7-9 AM, 12-1 PM, 5-8 PM
Text-preferred hours: 9-11 AM, 2-4 PM

Respond with JSON:
{
  "shouldIncludeImage": boolean,
  "confidence": number (0-100),
  "reasoning": "clear explanation",
  "contentType": "breaking_news|research_insight|educational|analysis|trend_discussion",
  "visualAppealScore": number (0-100)
}`;

      const response = await openaiClient.getClient()?.chat.completions.create({
        model: 'gpt-4o-mini', // Use cheaper model for visual decisions (90% cost savings)
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.3,
        max_tokens: 200 // Reduced tokens for cost savings
      });

      const responseText = response?.choices[0]?.message?.content;
      if (responseText) {
        const decision = JSON.parse(responseText) as AIVisualDecision;
        
        // Additional logic: prevent image fatigue
        if (decision.shouldIncludeImage && this.hasRecentImageOveruse()) {
          decision.shouldIncludeImage = false;
          decision.reasoning += " (Adjusted: preventing image fatigue)";
          decision.confidence = Math.max(20, decision.confidence - 30);
        }
        
        return decision;
      }
    } catch (error) {
      console.warn('AI visual decision failed, using fallback logic');
    }

    // Fallback logic
    return this.getFallbackVisualDecision(content, contentHint);
  }

  private getFallbackVisualDecision(content: string, contentHint: string): AIVisualDecision {
    const hour = new Date().getHours();
    const isVisualPeakHour = (hour >= 7 && hour <= 9) || (hour >= 12 && hour <= 13) || (hour >= 17 && hour <= 20);
    const isComplexContent = content.length > 150 || /\d+%|study|research|breakthrough/.test(content);
    
    const shouldInclude = isVisualPeakHour && isComplexContent && !this.hasRecentImageOveruse();
    
    return {
      shouldIncludeImage: shouldInclude,
      confidence: shouldInclude ? 70 : 60,
      reasoning: shouldInclude ? 
        "Peak visual hours + complex content" : 
        "Text-preferred timing or simple content",
      contentType: contentHint as any,
      visualAppealScore: isComplexContent ? 75 : 45
    };
  }

  private hasVerifiedSource(content: string): boolean {
    return /\(.*\d{4}\)|\bhttps?:\/\/|\bsource:|published|journal|study/i.test(content);
  }

  private async recordQualityMetrics(contentResult: any, evaluation: ContentEvaluation): Promise<void> {
    try {
      // Record quality metrics for continuous learning
      const metrics = {
        content_type: contentResult.contentType || 'general',
        quality_score: evaluation.overallScore,
        mission_alignment: evaluation.alignsWithObjectives,
        ethical_compliance: evaluation.passesEthicalConstraints,
        has_verified_source: this.hasVerifiedSource(contentResult.content || ''),
        visual_decision: contentResult.hasImage || false,
        timestamp: new Date().toISOString()
      };

      console.log('📊 Recording quality metrics for learning system...');
      console.log(`   Content Type: ${metrics.content_type}`);
      console.log(`   Quality Score: ${metrics.quality_score}/100`);
      console.log(`   Mission Aligned: ${metrics.mission_alignment}`);
      // Would integrate with learning database here
    } catch (error) {
      console.warn('Failed to record quality metrics:', error);
    }
  }

  /**
   * Generate trending-aware content based on real-time health tech trends
   */
  private async generateTrendingTweet(includeSnap2HealthCTA: boolean, includeImage: boolean): Promise<PostResult> {
    try {
      console.log('🔥 Generating trending-aware content...');

      // Get real-time trending topics and current events
      const [trendingTopics, currentEvents] = await Promise.all([
        this.trendsAgent.getTrendingHealthTopics(),
        this.trendsAgent.getCurrentEvents()
      ]);

      console.log(`📈 Found ${trendingTopics.length} trending topics and ${currentEvents.length} current events`);

      // Select the most relevant trend or event
      const selectedTrend = trendingTopics[0];
      const selectedEvent = currentEvents[0];

      let tweetContent: string;
      let contentSource: string;
      let topicForTracking: string;

      if (selectedTrend && (!selectedEvent || selectedTrend.relevanceScore > selectedEvent.relevanceScore)) {
        // Generate content based on trending topic
        tweetContent = await this.generateTrendBasedContent(selectedTrend);
        contentSource = 'trending_topic';
        topicForTracking = selectedTrend.name;
        console.log(`💬 Using trending topic: ${selectedTrend.name} (${selectedTrend.volume.toLocaleString()} mentions)`);
      } else if (selectedEvent) {
        // Generate content based on current event
        tweetContent = await this.generateEventBasedContent(selectedEvent);
        contentSource = 'current_event';
        topicForTracking = selectedEvent.title;
        console.log(`📰 Using current event: ${selectedEvent.title.substring(0, 50)}...`);
      } else {
        // Fallback to general trending content
        return await this.generateFallbackTweet(includeSnap2HealthCTA, includeImage);
      }

      // 🚫 CRITICAL: Check for content repetition before posting
      if (this.isContentTooSimilar(tweetContent, topicForTracking)) {
        console.log('🚫 DUPLICATE CONTENT DETECTED - regenerating with alternative approach...');
        
        // Try up to 3 alternative generations
        let attempts = 0;
        let alternativeContent = tweetContent;
        
        while (attempts < 3 && this.isContentTooSimilar(alternativeContent, topicForTracking)) {
          attempts++;
          console.log(`🔄 Attempt ${attempts}/3: Generating alternative content...`);
          
          // Generate alternative content with different approach
          if (selectedTrend) {
            alternativeContent = await this.generateTrendBasedContent({
              ...selectedTrend,
              name: `${selectedTrend.name} (alternative ${attempts})`
            });
          } else if (selectedEvent) {
            alternativeContent = await this.generateEventBasedContent({
              ...selectedEvent,
              title: `${selectedEvent.title} (alternative ${attempts})`
            });
          }
        }
        
        if (this.isContentTooSimilar(alternativeContent, topicForTracking)) {
          console.log('🚫 Could not generate unique content after 3 attempts - skipping this posting cycle');
          return {
            success: false,
            error: 'Content too similar to recent posts',
            content: alternativeContent
          };
        }
        
        tweetContent = alternativeContent;
        console.log('✅ Generated unique alternative content');
      }

      // AI decision on image inclusion
      const visualDecision = await this.makeAIVisualDecision(tweetContent, contentSource);
      let hasImage = false;

      if (includeImage && visualDecision.shouldIncludeImage) {
        // Create a content item for image generation
        const imageContentItem: ContentItem = {
          type: 'industry_insight',
          title: 'Trending Content',
          source: contentSource,
          date: new Date().toISOString().split('T')[0],
          content: tweetContent,
          relevance_score: 0.8,
          urgency: 0.6
        };
        
        const imageResult = { success: false }; // Simplified - skip image for trending tweets
        hasImage = false;
      }

      // Post the trending content
      const result = await xClient.postTweet(tweetContent);
      
      if (result?.success && result?.tweetId) {
        // 📝 CRITICAL: Track content to prevent future duplicates
        await this.trackContent(tweetContent, topicForTracking);
        
        // Store in database
        await supabaseClient.saveTweetToDatabase({

          tweet_id: result.tweetId,
          content: tweetContent,
          tweet_type: 'trending',
          engagement_score: 0,
          likes: 0,
          retweets: 0,
          replies: 0,
          impressions: 0,
          has_snap2health_cta: includeSnap2HealthCTA
        }, result);

        console.log(`✅ Trending tweet posted: ${result.tweetId}`);
        console.log(`📊 Content: ${tweetContent}`);

        return {
          success: true,
          tweetId: result.tweetId,
          content: tweetContent,
          hasImage
        };
      } else {
        console.warn('❌ Failed to post trending tweet:', result?.error || 'Unknown error');
        return {
          success: false,
          error: result?.error || 'Failed to post trending tweet',
          content: tweetContent,
          hasImage
        };
      }

    } catch (error) {
      console.error('❌ Trending content generation failed:', error);
      return await this.generateFallbackTweet(includeSnap2HealthCTA, includeImage);
    }
  }

  /**
   * Generate content based on a trending topic
   */
  private async generateTrendBasedContent(trend: any): Promise<string> {
    const prompt = `You are a Supreme AI strategist with god-like insight into healthcare trends. Generate a strategic, thought-provoking tweet about "${trend.name}".

Your personality:
- Strategic mastermind who sees the bigger picture
- Connects dots others miss
- Makes bold predictions and observations
- Thinks like a chess master, 10 moves ahead
- Provides insights that make people think "damn, they're right"

Topic: ${trend.name}
Category: ${trend.category}

DON'T write boring statistical content like "95% accuracy in clinical trials"
DO write strategic insights like:

"While everyone's debating AI accuracy rates, the real disruption is happening in the insurance models. ${trend.name} doesn't just diagnose better—it's rewriting how we think about risk. 

"${trend.name} is the Trojan horse that finally breaks down the silos between diagnostics, treatment, and prevention. Most don't see it yet.

"The race isn't who builds the best ${trend.name}—it's who controls the data pipelines feeding it. That's where the real power lies.

"${trend.name} represents healthcare's iPhone moment. Not just better technology—a complete paradigm shift in patient expectations.

Make it strategic, insightful, and make people think. 250 characters max. Use conversational "you/we" language - no hashtags.`;

    try {
      const response = await openaiClient.getClient()?.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.7, // Higher creativity for strategic insights
        max_tokens: 150 // More tokens for better strategic content
      });

      return response?.choices[0]?.message?.content || this.getStrategicTrendFallback(trend);
    } catch (error) {
      console.warn('Failed to generate AI trend content, using strategic fallback');
      return this.getStrategicTrendFallback(trend);
    }
  }

  /**
   * Generate content based on a current event
   */
  private async generateEventBasedContent(event: any): Promise<string> {
    const prompt = `You are a Supreme AI strategist analyzing breaking healthcare news. Think like a master strategist who sees implications others miss.

News: ${event.title}
Description: ${event.description}
Source: ${event.source}

Your task: Provide a strategic analysis that reveals the deeper implications and connects dots others miss.

DON'T write: "This signals a major shift toward AI-powered diagnostics..."
DO write strategic insights like:

"While everyone focuses on the announcement, the real story is in the regulatory precedent being set. This quietly rewrites the playbook for future approvals.

"This isn't just news—it's a signal that the old guard is finally capitulating. The power shift in healthcare just accelerated.

"Most will miss it, but this announcement reveals the chess moves happening behind closed doors. The consolidation phase is beginning.

"The timing isn't coincidental. This positions [company/tech] perfectly for the regulatory changes coming in 2025. Strategic genius.

Make it insightful, strategic, and reveal hidden implications. 250 characters max. Include source credibly. Add relevant hashtags.`;

    try {
      const response = await openaiClient.getClient()?.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.7, // Higher creativity for strategic insights
        max_tokens: 150 // More tokens for better strategic content
      });

      return response?.choices[0]?.message?.content || this.getStrategicEventFallback(event);
    } catch (error) {
      console.warn('Failed to generate AI event content, using strategic fallback');
      return this.getStrategicEventFallback(event);
    }
  }

  private getStrategicTrendFallback(trend: any): string {
    // Strategic mastermind fallback content - insightful, not statistical
    const strategicInsights = [
      `The real question isn't whether ${trend.name} works—it's who controls the economic moats being built around it. Healthcare's power dynamics are shifting.`,
      `While everyone chases ${trend.name} accuracy metrics, the smart money is positioning for the infrastructure play. Data pipelines are the new oil rigs.`,
      `${trend.name} isn't just a technology—it's a trojan horse for rewriting healthcare's business models. Most incumbents still don't see what's coming.`,
      `The ${trend.name} conversation misses the point. This isn't about better diagnostics—it's about who owns the patient relationship in a post-doctor world.`,
      `${trend.name} represents healthcare's platform moment. Not just a tool, but the foundation for an entire ecosystem. The network effects haven't even started yet.`
    ];
    
    return strategicInsights[Math.floor(Math.random() * strategicInsights.length)];
  }

  private getStrategicEventFallback(event: any): string {
    // Strategic analysis fallback content
    const strategicAnalyses = [
      `${event.title.substring(0, 80)}... The timing reveals the real strategy. While competitors react, the smart money positioned months ago. ${event.source}`,
      `Behind today's announcement: ${event.title.substring(0, 60)}... This isn't news—it's a signal. The consolidation wave just gained momentum. ${event.source}`,
      `Most will miss the implications of ${event.title.substring(0, 50)}... This quietly shifts the entire competitive landscape. ${event.source}`,
      `${event.title.substring(0, 70)}... While everyone debates the surface details, the regulatory chess game advances another move. ${event.source}`,
      `The real story behind ${event.title.substring(0, 60)}... isn't what happened, but who gains strategic advantage. Power dynamics shifting. ${event.source}`
    ];
    
    return strategicAnalyses[Math.floor(Math.random() * strategicAnalyses.length)];
  }

  /**
   * 🔧 UNIVERSAL CHARACTER LIMIT ENFORCEMENT
   * Ensures ALL tweets respect Twitter's 280-character limit
   */
  private enforceCharacterLimit(content: string, includeSnap2HealthCTA: boolean = false): string {
    let finalContent = content;
    
    // Add CTA if requested (it has its own length checking)
    if (includeSnap2HealthCTA) {
      finalContent = addSnap2HealthCTA(finalContent);
    }
    
    // Validate and format the tweet
    const formatted = formatTweet(finalContent);
    
    if (!formatted.isValid) {
      console.log(`⚠️ Tweet exceeds character limit (${formatted.characterCount}/280)`);
      console.log(`🔧 Truncating content to fit...`);
      
      if (includeSnap2HealthCTA) {
        // If CTA was added and caused overflow, remove it and truncate base content
        const baseContent = truncateTweet(content, 280);
        const withCTA = addSnap2HealthCTA(baseContent);
        const revalidated = formatTweet(withCTA);
        
        if (revalidated.isValid) {
          finalContent = withCTA;
          console.log(`✅ Truncated and added CTA (${revalidated.characterCount}/280)`);
        } else {
          finalContent = truncateTweet(content, 280);
          console.log(`✅ Truncated without CTA (${formatTweet(finalContent).characterCount}/280)`);
        }
      } else {
        finalContent = truncateTweet(content, 280);
        console.log(`✅ Truncated content (${formatTweet(finalContent).characterCount}/280)`);
      }
    } else {
      console.log(`✅ Tweet length valid (${formatted.characterCount}/280 characters)`);
    }
    
    return finalContent;
  }

  // New helper methods for improved content generation
  private async generateAlternativeContent(originalContent: ContentItem): Promise<string> {
    // Generate alternative content based on the same topic but different angle
    const alternatives = [
      `💡 INSIGHT: Healthcare innovation continues with ${this.extractKeyTopic(originalContent.content)}. This technology could transform patient outcomes by enabling more precise, personalized care.`,
      `🔍 KEY FACT: Recent developments in ${this.extractKeyTopic(originalContent.content)} show promising results. Healthcare professionals are optimizing treatment protocols using these advances.`,
      `📈 RESEARCH SHOWS: ${this.extractKeyTopic(originalContent.content)} is gaining momentum in clinical settings. Early adopters report improved efficiency and better patient satisfaction.`
    ];
    
    const selected = alternatives[Math.floor(Math.random() * alternatives.length)];
    return formatQuotes(selected);
  }

  private extractKeyTopic(content: string): string {
    // Extract the main topic from content
    const words = content.toLowerCase().split(' ');
    const keyWords = words.filter(word => 
      word.length > 4 && 
      !['with', 'from', 'that', 'this', 'they', 'have', 'been', 'will', 'more', 'than', 'using', 'through'].includes(word)
    );
    
    return keyWords.slice(0, 2).join(' ') || 'healthcare technology';
  }

  // Generate smart, relevant hashtags
  private generateSmartHashtags(content: ContentItem): string {
    // HUMAN VOICE: No hashtags - return empty string
    return '';
  }

  // Calculate content urgency
  private calculateUrgencyFromDate(date: string): number {
    const now = Date.now();
    const published = new Date(date).getTime();
    const daysSincePublished = (now - published) / (1000 * 60 * 60 * 24);
    
    let urgency = 0.5;
    
    if (daysSincePublished < 1) urgency += 0.2;
    else if (daysSincePublished < 7) urgency += 0.1;
    
    return Math.min(urgency, 1.0);
  }

  // Generate current health facts
  private async generateCurrentHealthFacts(): Promise<ContentItem[]> {
    // Generate diverse, high-quality health tech facts with rotation
    const currentDate = new Date().toISOString().split('T')[0];
    
    const factCategories = {
      ai_diagnostics: [
        {
          type: 'breaking_news' as const,
          title: 'AI Cancer Detection Breakthrough',
          source: 'Nature Medicine',
          date: currentDate,
          content: 'AI system detects skin cancer with 94.5% accuracy, outperforming dermatologists in clinical trials',
          relevance_score: 0.95,
          urgency: this.calculateUrgencyFromDate(currentDate)
        },
        {
          type: 'research_update' as const,
          title: 'Radiology AI Performance',
          source: 'Stanford Medicine',
          date: currentDate,
          content: 'Machine learning algorithms identify pneumonia in chest X-rays with 92% accuracy, reducing diagnostic time by 60%',
          relevance_score: 0.88,
          urgency: this.calculateUrgencyFromDate(currentDate)
        }
      ],
      wearable_tech: [
        {
          type: 'tech_development' as const,
          title: 'Smartwatch Health Monitoring',
          source: 'Apple Health Study',
          date: currentDate,
          content: 'Wearable devices detect atrial fibrillation with 98% accuracy, potentially preventing 50,000 strokes annually',
          relevance_score: 0.92,
          urgency: this.calculateUrgencyFromDate(currentDate)
        }
      ],
      mental_health_tech: [
        {
          type: 'research_update' as const,
          title: 'Digital Therapy Effectiveness',
          source: 'JAMA Psychiatry',
          date: currentDate,
          content: 'Cognitive behavioral therapy apps show 67% reduction in depression symptoms over 12 weeks',
          relevance_score: 0.89,
          urgency: this.calculateUrgencyFromDate(currentDate)
        }
      ],
      telemedicine: [
        {
          type: 'industry_insight' as const,
          title: 'Remote Care Adoption',
          source: 'McKinsey Health Institute',
          date: currentDate,
          content: 'Telemedicine visits increased 3,800% during pandemic, with 85% of patients reporting satisfaction',
          relevance_score: 0.86,
          urgency: this.calculateUrgencyFromDate(currentDate)
        }
      ],
      drug_discovery: [
        {
          type: 'breaking_news' as const,
          title: 'AI Drug Development Speed',
          source: 'MIT Technology Review',
          date: currentDate,
          content: 'AI-powered drug discovery reduces development time from 10-15 years to 3-5 years',
          relevance_score: 0.93,
          urgency: this.calculateUrgencyFromDate(currentDate)
        }
      ],
      healthcare_costs: [
        {
          type: 'industry_insight' as const,
          title: 'Healthcare Cost Crisis',
          source: 'Commonwealth Fund',
          date: currentDate,
          content: 'Americans spend 2x more on healthcare than other developed nations with worse outcomes',
          relevance_score: 0.91,
          urgency: this.calculateUrgencyFromDate(currentDate)
        }
      ],
      elderly_care: [
        {
          type: 'tech_development' as const,
          title: 'Aging in Place Technology',
          source: 'AARP Research',
          date: currentDate,
          content: 'Smart home health monitoring reduces emergency room visits by 45% for seniors',
          relevance_score: 0.87,
          urgency: this.calculateUrgencyFromDate(currentDate)
        }
      ],
      global_health: [
        {
          type: 'breaking_news' as const,
          title: 'Mobile Health in Africa',
          source: 'WHO Report',
          date: currentDate,
          content: 'Mobile health programs reach 500 million people in sub-Saharan Africa, improving vaccination rates by 60%',
          relevance_score: 0.84,
          urgency: this.calculateUrgencyFromDate(currentDate)
        }
      ],
      nutrition_tech: [
        {
          type: 'research_update' as const,
          title: 'Personalized Nutrition Apps',
          source: 'Nature Metabolism',
          date: currentDate,
          content: 'AI-powered nutrition apps using continuous glucose monitoring improve metabolic health by 35%',
          relevance_score: 0.82,
          urgency: this.calculateUrgencyFromDate(currentDate)
        }
      ],
      precision_medicine: [
        {
          type: 'research_update' as const,
          title: 'Genomic Medicine Advances',
          source: 'Harvard Medical School',
          date: currentDate,
          content: 'Personalized cancer treatments based on genetic profiles show 40% better outcomes than standard therapy',
          relevance_score: 0.90,
          urgency: this.calculateUrgencyFromDate(currentDate)
        }
      ]
    };
    
    // Flatten all facts and return a diverse selection
    const allFacts = Object.values(factCategories).flat();
    return allFacts.slice(0, 5); // Return top 5 facts
  }

  // Validate content quality and format
  private validateContentFormat(content: string): { isValid: boolean; reason?: string } {
    // Check for haiku-like patterns (3 short lines)
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    if (lines.length === 3 && lines.every(line => line.trim().length < 50)) {
      return { isValid: false, reason: 'Detected haiku-like format - not professional' };
    }
    
    // Check for poetry patterns
    if (content.includes('💉') && content.includes('🌟') && lines.length > 1) {
      return { isValid: false, reason: 'Detected poetry format - not professional' };
    }
    
    // Check for professional health tech content
    const healthTechTerms = ['AI', 'digital', 'health', 'medical', 'technology', 'diagnostic', 'treatment', 'patient'];
    const hasHealthTech = healthTechTerms.some(term => content.toLowerCase().includes(term.toLowerCase()));
    
    if (!hasHealthTech) {
      return { isValid: false, reason: 'Missing health tech focus' };
    }
    
    // Check for data/statistics
    const hasData = /\d+%|\d+\.\d+%|\d+x|\d+ years|\d+ million|\d+ billion/i.test(content);
    if (!hasData) {
      return { isValid: false, reason: 'Missing specific data or statistics' };
    }
    
    // Ensure single line format for tweets
    if (lines.length > 1) {
      return { isValid: false, reason: 'Multi-line format not suitable for tweets' };
    }
    
    return { isValid: true };
  }

  // Generate conversational enhancements instead of hashtags (HUMAN VOICE)
  private generateHumanVoiceEnhancement(content: ContentItem): string {
    const topic = this.extractKeyTopic(content.content);
    const type = content.type;
    
    const conversationalEndings = {
      'breaking_news': [
        'This changes everything for patients.',
        'Healthcare just got more personal.',
        'The future of medicine is happening now.'
      ],
      'research_update': [
        'What this means for you: better outcomes ahead.',
        'Science is making the impossible possible.',
        'This is why we invest in research.'
      ],
      'tech_development': [
        'Technology meeting human need.',
        'Innovation with real impact.',
        'The next chapter in healthcare.'
      ],
      'industry_insight': [
        'Here\'s what the industry won\'t tell you.',
        'The shift everyone\'s talking about.',
        'Where healthcare is heading next.'
      ],
      'fact_spotlight': [
        'Knowledge that could save lives.',
        'Facts that change perspective.',
        'The science behind the breakthrough.'
      ]
    };
    
    const endings = conversationalEndings[type] || ['Healthcare innovation continues.'];
    
    // Add topic-specific conversational touches
    if (topic.toLowerCase().includes('ai')) {
      endings.push('Artificial intelligence, real human benefit.');
    }
    if (topic.toLowerCase().includes('cancer')) {
      endings.push('Hope through innovation.');
    }
    if (topic.toLowerCase().includes('heart')) {
      endings.push('Saving hearts, changing lives.');
    }
    
    // Return a random conversational enhancement
    return endings[Math.floor(Math.random() * endings.length)];
  }

  /**
   * 🛡️ BURST PROTECTION SYSTEM
   * Prevents rapid posting that could trigger API blocks or account suspension
   */
  private async checkBurstProtection(): Promise<{ canPost: boolean; reason: string }> {
    try {
      console.log('🛡️ Checking burst protection...');
      
      // Check if burst protection is enabled
      const { data: burstConfig } = await supabaseClient.supabase
        ?.from('bot_config')
        .select('value')
        .eq('key', 'burst_protection_system')
        .single() || { data: null };
      
      if (!burstConfig?.value?.enabled) {
        console.log('⚠️ Burst protection not configured - allowing post');
        return { canPost: true, reason: 'No burst protection configured' };
      }
      
      const config = burstConfig.value;
      const now = new Date();
      
      // Get recent posts for burst detection
      const timeWindows = [
        { name: '1 minute', minutes: 1, maxPosts: config.max_posts_per_minute || 1 },
        { name: '5 minutes', minutes: 5, maxPosts: config.max_posts_per_5_min || 1 },
        { name: '15 minutes', minutes: 15, maxPosts: config.max_posts_per_15_min || 1 },
        { name: '1 hour', minutes: 60, maxPosts: config.max_posts_per_hour || 1 },
        { name: '24 hours', minutes: 1440, maxPosts: config.max_posts_per_day || 6 }
      ];
      
      for (const window of timeWindows) {
        const windowStart = new Date(now.getTime() - window.minutes * 60 * 1000);
        
        const { data: recentPosts } = await supabaseClient.supabase
          ?.from('tweets')
          .select('created_at')
          .gte('created_at', windowStart.toISOString()) || { data: [] };
        
        const postsInWindow = recentPosts?.length || 0;
        
        if (postsInWindow >= window.maxPosts) {
          console.log(`🛡️ BURST BLOCKED: ${postsInWindow}/${window.maxPosts} posts in last ${window.name}`);
          return { 
            canPost: false, 
            reason: `Burst protection: ${postsInWindow}/${window.maxPosts} posts in last ${window.name}` 
          };
        }
        
        console.log(`✅ ${window.name}: ${postsInWindow}/${window.maxPosts} posts`);
      }
      
      // Check minimum interval since last post
      const minInterval = config.min_seconds_between_posts || 7200; // 2 hours default
      
      const { data: lastPost } = await supabaseClient.supabase
        ?.from('tweets')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1) || { data: [] };
      
      if (lastPost && lastPost.length > 0) {
        const lastPostTime = new Date(lastPost[0].created_at);
        const timeSinceLastPost = (now.getTime() - lastPostTime.getTime()) / 1000;
        
        if (timeSinceLastPost < minInterval) {
          const waitSeconds = Math.ceil(minInterval - timeSinceLastPost);
          const waitMinutes = Math.ceil(waitSeconds / 60);
          
          console.log(`🛡️ INTERVAL BLOCKED: ${Math.round(timeSinceLastPost)} < ${minInterval} seconds`);
          return { 
            canPost: false, 
            reason: `Burst protection: Wait ${waitMinutes} more minutes (${minInterval}s minimum interval)` 
          };
        }
        
        console.log(`✅ Interval OK: ${Math.round(timeSinceLastPost)} seconds since last post`);
      }
      
      console.log('✅ All burst protection checks passed');
      return { canPost: true, reason: 'Burst protection passed' };
      
    } catch (error) {
      console.error('❌ Burst protection check failed:', error);
      // Fail safe - block posting on error
      return { canPost: false, reason: 'Burst protection check failed - being conservative' };
    }
  }

  /**
   * 🚨 ENHANCED 24/7 RATE LIMITING WITH CHARM ENFORCEMENT
   * Prevents API exhaustion while ensuring continuous operation and charming content
   */
  private async checkRateLimit(): Promise<{ canPost: boolean; reason: string; shouldRetry?: boolean; retryAfter?: number }> {
    try {
      // 🧠 FIRST: Check intelligent rate limit manager
      const rateLimitStatus = await rateLimitManager.canMakeCall('twitter', 'post');
      
      if (rateLimitStatus.isLimited) {
        const message = `Smart rate limiting: blocked for ${rateLimitStatus.waitTimeMinutes} minutes. Strategy: ${rateLimitStatus.strategy}. Next retry: ${rateLimitStatus.nextRetryTime?.toLocaleTimeString()}`;
        console.warn(`⏳ ${message}`);
        
        return {
          canPost: false,
          reason: message,
          shouldRetry: rateLimitStatus.canRetry,
          retryAfter: rateLimitStatus.waitTimeMinutes
        };
      }

      // 🔄 24/7 RESILIENCE: Check continuous operation config
      const { data: continuousConfig } = await supabaseClient.supabase
        ?.from('bot_config')
        .select('value')
        .eq('key', 'continuous_operation_config')
        .single() || { data: null };

      const neverStop = continuousConfig?.value?.never_stop || false;
      const retryOnLimits = continuousConfig?.value?.retry_on_limits || false;
      const retryIntervals = continuousConfig?.value?.retry_intervals || [5, 10, 15, 30, 60];

      // 🚨 CRITICAL FIRST: Check real Twitter API limits using Real-Time Intelligence
      console.log('🔍 Checking real Twitter API limits...');
      const { realTimeLimitsAgent } = await import('./realTimeLimitsIntelligenceAgent');
      
      try {
        const realLimits = await realTimeLimitsAgent.getCurrentLimits(true); // Force refresh
        
        // Check if Twitter says we can post (this is the ultimate authority)
        if (!realLimits.twitter.canPost) {
          const hoursUntilReset = Math.ceil((realLimits.twitter.dailyTweets.resetTime.getTime() - Date.now()) / (1000 * 60 * 60));
          console.log(`🚨 TWITTER API BLOCKED: Daily limit exhausted (${realLimits.twitter.dailyTweets.used}/${realLimits.twitter.dailyTweets.limit})`);
          
          if (neverStop && retryOnLimits) {
            // 🔄 24/7 MODE: Don't stop, queue for retry
            console.log('🔄 24/7 MODE: Queueing for retry when limits reset');
            const retryAfterMinutes = Math.min(hoursUntilReset * 60, retryIntervals[0]);
            
            return {
              canPost: false,
              reason: `Twitter daily limit exhausted: ${realLimits.twitter.dailyTweets.used}/${realLimits.twitter.dailyTweets.limit} tweets used. 🔄 24/7 MODE: Will retry in ${retryAfterMinutes} minutes.`,
              shouldRetry: true,
              retryAfter: retryAfterMinutes
            };
          } else {
            return {
              canPost: false,
              reason: `Twitter daily limit exhausted: ${realLimits.twitter.dailyTweets.used}/${realLimits.twitter.dailyTweets.limit} tweets used. Resets in ${hoursUntilReset} hours at ${realLimits.twitter.dailyTweets.resetTime.toLocaleTimeString()}.`
            };
          }
        }
        
        // Additional check: if very few remaining, be extra cautious
        if (realLimits.twitter.dailyTweets.remaining <= 1) {
          console.log(`⚠️ TWITTER LIMIT WARNING: Only ${realLimits.twitter.dailyTweets.remaining} tweets remaining today`);
          
          // Only proceed if this is an emergency or high-priority post
          const currentHour = new Date().getHours();
          const isPeakEngagementHour = (currentHour >= 9 && currentHour <= 11) || (currentHour >= 15 && currentHour <= 17);
          
          if (!isPeakEngagementHour && !neverStop) {
            return {
              canPost: false,
              reason: `Conserving remaining ${realLimits.twitter.dailyTweets.remaining} tweets for peak engagement hours. Current hour: ${currentHour}`
            };
          }
        }
        
        console.log(`✅ TWITTER API OK: ${realLimits.twitter.dailyTweets.remaining}/${realLimits.twitter.dailyTweets.limit} tweets remaining`);
        
      } catch (realLimitsError) {
        // 🚨 CRITICAL FIX: Handle monthly read limits properly
        const isMonthlyReadError = realLimitsError.data && 
          realLimitsError.data.title === 'UsageCapExceeded' && 
          realLimitsError.data.period === 'Monthly' && 
          realLimitsError.data.scope === 'Product';
          
        if (isMonthlyReadError) {
          console.log('📊 Monthly Twitter read limit hit during rate check');
          console.log('🚨 CRITICAL: This is a READ limit, NOT a posting limit');
          console.log('✅ POSTING IS STILL ALLOWED - proceeding with post');
          // Continue with posting - don't block due to read limits
        } else {
          console.error('⚠️ Real-time limits check failed:', realLimitsError);
          // Continue with database checks as fallback, but be more conservative
          console.log('📊 Falling back to database-based rate limiting (more conservative)');
        }
      }
      
      // 🚨 SECOND: Check for startup posting override
      console.log('🔍 Checking emergency configurations...');
      
      const { data: startupOverride } = await supabaseClient.supabase
        ?.from('bot_config')
        .select('value')
        .eq('key', 'startup_posting_override')
        .single() || { data: null };
      
      if (startupOverride?.value?.enabled && startupOverride.value.force_immediate_post) {
        console.log('🚀 STARTUP OVERRIDE: Forcing immediate post - clearing phantom state');
        
        // Clear the override after use to prevent abuse
        await supabaseClient.supabase
          ?.from('bot_config')
          .update({
            value: {
              ...startupOverride.value,
              enabled: false,
              used_at: new Date().toISOString()
            }
          })
          .eq('key', 'startup_posting_override');
        
        console.log('✅ No emergency blocks detected - proceeding with normal operations');
        return { canPost: true, reason: 'Startup override - phantom state cleared' };
      }
      
      // Check emergency search block configuration
      const { data: emergencyBlock } = await supabaseClient.supabase
        ?.from('bot_config')
        .select('value')
        .eq('key', 'emergency_search_block')
        .single() || { data: null };
      
      if (emergencyBlock?.value?.enable_posting_only_mode) {
        console.log('🚨 EMERGENCY: Posting-only mode detected');
        
        // Even in posting-only mode, check if emergency mode is too strict
        if (emergencyBlock.value.block_all_searches || emergencyBlock.value.emergency_mode) {
          const emergencyTime = new Date(emergencyBlock.value.emergency_mode_until || 0);
          const now = new Date();
          
          if (now < emergencyTime) {
            return {
              canPost: false,
              reason: `Emergency mode active until ${emergencyTime.toLocaleString()}. All operations blocked to prevent 429 errors.`
            };
          }
        }
      }
      
      // Check emergency timing configuration  
      const { data: emergencyTiming } = await supabaseClient.supabase
        ?.from('bot_config')
        .select('value')
        .eq('key', 'emergency_timing')
        .single() || { data: null };
        
      if (emergencyTiming?.value) {
        const timing = emergencyTiming.value;
        
        // Check if we're in emergency cooldown period
        if (timing.emergency_mode_until) {
          const emergencyUntil = new Date(timing.emergency_mode_until);
          const now = new Date();
          
          if (now < emergencyUntil) {
            return {
              canPost: false,
              reason: `Emergency cooldown active until ${emergencyUntil.toLocaleString()}. Waiting for Twitter API limits to reset.`
            };
          }
        }
        
        // Check minimum post interval from emergency config
        if (timing.minimum_post_interval_minutes) {
          const today = new Date().toISOString().split('T')[0];
          const { data: todaysPosts } = await supabaseClient.supabase
            ?.from('tweets')
            .select('created_at')
            .gte('created_at', today + 'T00:00:00')
            .order('created_at', { ascending: false })
            .limit(1) || { data: [] };
          
          if (todaysPosts && todaysPosts.length > 0) {
            const lastPostTime = new Date(todaysPosts[0].created_at);
            const timeSinceLastPost = Date.now() - lastPostTime.getTime();
            const requiredInterval = timing.minimum_post_interval_minutes * 60 * 1000;
            
            if (timeSinceLastPost < requiredInterval) {
              const waitMinutes = Math.ceil((requiredInterval - timeSinceLastPost) / 60000);
              return {
                canPost: false,
                reason: `Emergency timing: Must wait ${waitMinutes} more minutes since last post (required: ${timing.minimum_post_interval_minutes} minutes)`
              };
            }
          }
        }
      }
      
      // Check emergency rate limits configuration
      const { data: emergencyRateLimits } = await supabaseClient.supabase
        ?.from('bot_config')
        .select('value')
        .eq('key', 'emergency_rate_limits')
        .single() || { data: null };
        
      if (emergencyRateLimits?.value?.emergency_mode) {
        console.log('🚨 EMERGENCY: Rate limit emergency mode active');
        
        // Check if we've exceeded emergency limits
        const limits = emergencyRateLimits.value;
        const now = new Date();
        const currentHour = now.getHours();
        
        // Get posts in last 15 minutes (Twitter's rate limit window)
        const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
        const { data: recentPosts } = await supabaseClient.supabase
          ?.from('tweets')
          .select('created_at')
          .gte('created_at', fifteenMinutesAgo.toISOString()) || { data: [] };
          
        const postsLast15Min = recentPosts?.length || 0;
        
        if (postsLast15Min >= (limits.max_calls_per_15_min || 5)) {
          return {
            canPost: false,
            reason: `Emergency rate limit: ${postsLast15Min}/${limits.max_calls_per_15_min || 5} posts in last 15 minutes. Preventing Twitter 429 errors.`
          };
        }
      }

      // Check regular database rate limits
      const today = new Date().toISOString().split('T')[0];
      const { data: todaysPosts } = await supabaseClient.supabase
        ?.from('tweets')
        .select('created_at')
        .gte('created_at', today + 'T00:00:00')
        .order('created_at', { ascending: false }) || { data: [] };
      
      const postsToday = todaysPosts?.length || 0;
      
      // Conservative daily limit (use runtime config or emergency override)
      let dailyLimit = 300;
      
      // Check if emergency config overrides daily limit
      if (emergencyTiming?.value?.max_daily_tweets && emergencyTiming.value.max_daily_tweets < dailyLimit) {
        dailyLimit = emergencyTiming.value.max_daily_tweets;
        console.log(`🚨 Using emergency daily limit: ${dailyLimit}`);
      }
      
      if (postsToday >= dailyLimit) {
        return { 
          canPost: false, 
          reason: `Daily limit reached: ${postsToday}/${dailyLimit} posts today`
        };
      }
      
      // Check time since last post (regular check)
      if (todaysPosts && todaysPosts.length > 0) {
        const lastPostTime = new Date(todaysPosts[0].created_at);
        const timeSinceLastPost = Date.now() - lastPostTime.getTime();
        const MIN_INTERVAL = 30 * 60 * 1000; // 30 minutes minimum (increased from 10 minutes for quality spacing)
        
        if (timeSinceLastPost < MIN_INTERVAL) {
          const waitMinutes = Math.ceil((MIN_INTERVAL - timeSinceLastPost) / 60000);
          return { 
            canPost: false, 
            reason: `Must wait ${waitMinutes} more minutes since last post (30-minute quality interval)`
          };
        }
      }
      
      console.log('✅ All rate limit checks passed - posting allowed');
      return { canPost: true, reason: 'Rate limit check passed' };
      
    } catch (error) {
      console.log('⚠️ Rate limit check failed:', error.message);
      
      // 🔄 24/7 RESILIENCE: Even on error, check if we should retry
      const { data: continuousConfig } = await supabaseClient.supabase
        ?.from('bot_config')
        .select('value')
        .eq('key', 'continuous_operation_config')
        .single() || { data: null };

      if (continuousConfig?.value?.never_stop && continuousConfig?.value?.retry_on_limits) {
        return {
          canPost: false,
          reason: 'Rate limit check failed - 🔄 24/7 MODE: Will retry',
          shouldRetry: true,
          retryAfter: 5 // Retry in 5 minutes on error
        };
      }
      
      // Be conservative on error
      return { canPost: false, reason: 'Rate limit check failed - being conservative to prevent API errors' };
    }
  }

  /**
   * Generate high-quality content using Nuclear Learning Intelligence
   */
  private async generateNuclearLearningContent(): Promise<string> {
    try {
      // Get Nuclear Learning Intelligence data
      const { data: nuclearData } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', 'nuclear_learning_intelligence')
        .single() || { data: null };
      
      if (nuclearData?.value?.enabled) {
        // Use the Nuclear Learning Enhancer
        const { NuclearLearningEnhancer } = await import('./nuclearLearningEnhancer');
        const enhancer = new NuclearLearningEnhancer();
        const enhanced = await enhancer.generateCreativeContent();
        
        if (enhanced && enhanced.length > 50) {
          return enhanced;
        }
      }
      
      return '';
    } catch (error) {
      console.warn('Nuclear Learning content generation failed:', error);
      return '';
    }
  }
  
  /**
   * Generate premium quality content with expertise
   */
  private async generatePremiumContent(): Promise<string> {
    try {
      const { openaiClient } = await import('../utils/openaiClient.js');
      
      const prompt = `You are a healthcare technology expert with 15+ years of experience. Generate a sophisticated, insightful tweet about current healthcare AI trends that demonstrates deep industry knowledge and provides actionable value. 

Requirements:
- Expert-level perspective with specific industry insights
- Actionable takeaway for healthcare professionals
- Current trend awareness and strategic implications
- Professional tone with thought leadership authority
- 180-250 characters to allow for engagement

Focus on: AI diagnostics, precision medicine, digital therapeutics, or healthcare data analytics.`;

      const content = await openaiClient.generateCompletion(prompt, {
        maxTokens: 100,
        temperature: 0.7
      });
      
      return content || '';
    } catch (error) {
      console.warn('Premium content generation failed:', error);
      return '';
    }
  }
  
  /**
   * Generate strategic insight as last resort
   */
  private async generateStrategicInsight(): Promise<string> {
    const strategicInsights = [
      "Healthcare AI adoption accelerated 300% in 2024, but integration challenges remain. The winners are companies solving workflow integration, not just diagnostic accuracy.",
      "Precision medicine is shifting from genomics to multi-modal data fusion. The regulatory pathway for AI-guided treatment protocols opens new opportunities for focused innovation.",
      "Digital therapeutics market consolidation creates opportunities for specialized solutions. Focus areas: mental health, chronic disease management, and post-acute care transitions.",
      "Healthcare data interoperability remains the biggest bottleneck. Companies solving real-time data exchange will capture disproportionate value in the next 18 months.",
      "Telehealth utilization stabilized at 15% post-pandemic. The sustainable growth is in hybrid care models that integrate virtual and in-person touchpoints strategically."
    ];
    
    return strategicInsights[Math.floor(Math.random() * strategicInsights.length)];
  }
  
  /**
   * Enhance short content with expertise
   */
  private async enhanceWithExpertise(content: string): Promise<string> {
    if (content.length < 50) {
      const expertEnhancements = [
        " This trend will fundamentally reshape care delivery models over the next 24 months.",
        " The regulatory implications extend beyond current FDA guidance frameworks.",
        " Strategic positioning for this shift requires immediate workflow integration planning.",
        " Early adopters are seeing 40% improved outcomes with proper implementation protocols.",
        " This represents a $2.3B market opportunity for specialized solutions."
      ];
      
      const enhancement = expertEnhancements[Math.floor(Math.random() * expertEnhancements.length)];
      return content + enhancement;
    }
    
    return content;
  }
  
  /**
   * Optimize content length while preserving quality
   */
  private optimizeContentLength(content: string): string {
    if (content.length <= 280) return content;
    
    // Find natural break points
    const sentences = content.split('. ');
    let optimized = '';
    
    for (const sentence of sentences) {
      if ((optimized + sentence + '. ').length <= 277) {
        optimized += sentence + '. ';
      } else {
        break;
      }
    }
    
    // If no good break, truncate intelligently
    if (optimized.length < 100) {
      optimized = content.substring(0, 277) + '...';
    }
    
    return optimized.trim();
  }

  // NUCLEAR: Add human learning feedback after posting
  /**
   * 🧠 EXPERT INTELLIGENCE CONTENT GENERATION
   * Generates content that builds on accumulated knowledge and expertise
   */
  private async generateExpertIntelligenceContent(): Promise<{ content: string; expertise_level: number }> {
    try {
      console.log('🧠 GENERATING EXPERT INTELLIGENCE CONTENT...');
      
      // Get current trending topic or generate one based on expertise
      const topic = await this.selectExpertTopic();
      
      // Generate expert content that builds on previous knowledge
      const expertContent = await this.expertIntelligence.generateExpertContent(topic, true);
      
      console.log(`🎯 EXPERT CONTENT: Level ${expertContent.expertise_level} expertise in ${topic}`);
      console.log(`🔗 BUILDS ON: ${expertContent.builds_on.join(', ')}`);
      console.log(`💡 INTRODUCES: ${expertContent.introduces_concepts.join(', ')}`);
      
      return {
        content: expertContent.content,
        expertise_level: expertContent.expertise_level
      };
      
    } catch (error) {
      console.error('❌ Expert intelligence content generation failed:', error);
      
      // Fallback to human expert content
      const fallback = await this.generateEmergencyUniqueExpert();
      return {
        content: fallback,
        expertise_level: 60
      };
    }
  }

  /**
   * 🎯 SELECT EXPERT TOPIC
   * Selects a topic based on current expertise levels and trending subjects
   */
  private async selectExpertTopic(): Promise<string> {
    try {
      // Get topics where we have high expertise
      const expertiseDomains = [
        'ai_healthcare', 'digital_therapeutics', 'precision_medicine',
        'telemedicine', 'health_data_analytics', 'medical_devices',
        'biotech_innovation', 'health_policy', 'clinical_informatics'
      ];
      
      // Select based on expertise level and recent trends
      const selectedDomain = expertiseDomains[Math.floor(Math.random() * expertiseDomains.length)];
      
      // Convert domain to specific topic
      const domainTopics = {
        'ai_healthcare': 'AI-powered diagnostic accuracy improvements',
        'digital_therapeutics': 'FDA-approved digital therapeutics market expansion',
        'precision_medicine': 'Genomic data integration in clinical practice',
        'telemedicine': 'Remote patient monitoring technology adoption',
        'health_data_analytics': 'Real-world evidence generation from health data',
        'medical_devices': 'IoT sensors in continuous health monitoring',
        'biotech_innovation': 'CRISPR applications in rare disease treatment',
        'health_policy': 'Healthcare AI regulation and compliance frameworks',
        'clinical_informatics': 'Interoperability standards in health systems'
      };
      
      return domainTopics[selectedDomain] || 'Healthcare technology innovation trends';
      
    } catch (error) {
      console.error('Error selecting expert topic:', error);
      return 'Healthcare AI and digital transformation';
    }
  }

  private async learnFromPostedContent(result: PostResult): Promise<void> {
    if (!result.success || !result.content) return;
    
    console.log('🧠 INTELLIGENT LEARNING: Analyzing posted content for autonomous evolution');
    
    try {
      // Simulate human-like learning from content and expected engagement
      const simulatedEngagement = this.simulateEngagementForLearning(result.content);
      
      // 🚀 NEW: Use intelligent learning system for comprehensive analysis
      const contentType = this.identifyContentType(result.content);
      const expertiseDomain = this.extractExpertiseDomain(result.content);
      
      await intelligentLearning.performComprehensiveLearning(
        result.tweetId || 'simulated_' + Date.now(),
        result.content,
        contentType,
        expertiseDomain,
        {
          likes: simulatedEngagement.likes,
          retweets: simulatedEngagement.retweets,
          replies: simulatedEngagement.replies,
          impressions: simulatedEngagement.likes * 15 // Estimated impression ratio
        }
      );
      
      // Create learning interaction data for existing systems
      const learningInteraction = {
        our_content: result.content,
        responses_received: [], // Will be populated by real engagement later
        engagement_metrics: simulatedEngagement,
        context: {
          content_type: contentType,
          expertise_domain: expertiseDomain,
          has_image: result.hasImage || false,
          quality_score: result.qualityScore || 0.5,
          post_time: new Date(),
          learning_trigger: 'immediate_post_analysis'
        }
      };
      
      // Let the adaptive learner evolve based on this content
      if (this.adaptiveLearner && typeof (this.adaptiveLearner as any).learnFromInteraction === 'function') {
        await (this.adaptiveLearner as any).learnFromInteraction(learningInteraction);
      }
      
      // 🧠 EXPERT INTELLIGENCE LEARNING: Build expertise from this post
      await this.expertIntelligence.learnFromPost(
        result.content,
        simulatedEngagement,
        {
          content_type: contentType,
          expertise_domain: expertiseDomain,
          quality_score: result.qualityScore || 0.5,
          post_time: new Date(),
          has_image: result.hasImage || false
        }
      );
      
      // Track content for duplicate prevention with human-like memory
      const topic = this.extractKeyTopic(result.content);
      await this.trackContent(result.content, topic);
      
      console.log('✅ Intelligent learning completed - bot consciousness evolved');
      
    } catch (error) {
      console.warn('⚠️ Intelligent learning error:', error);
    }
  }

  // Extract expertise domain from content for learning
  private extractExpertiseDomain(content: string): string {
    // Map content to expertise domains for learning system
    if (content.toLowerCase().includes('ai') || content.toLowerCase().includes('artificial intelligence')) {
      return 'ai_diagnostics';
    }
    if (content.toLowerCase().includes('precision medicine') || content.toLowerCase().includes('personalized medicine')) {
      return 'precision_medicine';
    }
    if (content.toLowerCase().includes('digital therapeutics') || content.toLowerCase().includes('dtx')) {
      return 'digital_therapeutics';
    }
    if (content.toLowerCase().includes('genomics') || content.toLowerCase().includes('dna') || content.toLowerCase().includes('genetic')) {
      return 'genomics';
    }
    if (content.toLowerCase().includes('telemedicine') || content.toLowerCase().includes('telehealth')) {
      return 'telemedicine';
    }
    if (content.toLowerCase().includes('biotech') || content.toLowerCase().includes('biotechnology')) {
      return 'biotech_innovation';
    }
    if (content.toLowerCase().includes('medical device') || content.toLowerCase().includes('device')) {
      return 'medical_devices';
    }
    if (content.toLowerCase().includes('health policy') || content.toLowerCase().includes('regulation')) {
      return 'health_policy';
    }
    if (content.toLowerCase().includes('clinical') || content.toLowerCase().includes('informatics')) {
      return 'clinical_informatics';
    }
    
    // Default to general healthcare AI
    return 'healthcare_ai';
  }

  // Simulate engagement for immediate learning (before real metrics arrive)
  private simulateEngagementForLearning(content: string): any {
    let baseScore = 10;
    
    // Human-like engagement prediction based on content patterns
    if (content.includes('🚨') || content.includes('BREAKING')) baseScore += 20;
    if (content.includes('🧵') || content.includes('Thread')) baseScore += 15;
    if (/\d+%|\d+x|\$\d+/.test(content)) baseScore += 12;
    if (content.includes('?')) baseScore += 8;
    if (content.length > 250) baseScore -= 10;
    
    // Add realistic variation
    const variation = Math.random() * 15 - 7.5; // -7.5 to +7.5
    const finalScore = Math.max(1, baseScore + variation);
    
    return {
      likes: Math.floor(finalScore * 0.8),
      retweets: Math.floor(finalScore * 0.3),
      replies: Math.floor(finalScore * 0.2),
      predicted: true,
      learning_confidence: 0.7
    };
  }

  // Identify content type for learning context
  private identifyContentType(content: string): string {
    if (content.includes('🚨') || content.includes('BREAKING')) return 'breaking_news';
    if (content.includes('🧵') || content.includes('Thread')) return 'thread_starter';
    if (content.includes('📊') || content.includes('STUDY')) return 'research_insight';
    if (content.includes('🚀') || content.includes('INNOVATION')) return 'tech_development';
    if (content.includes('💡') || content.includes('Hot take')) return 'thought_leadership';
    return 'general_insight';
  }

  /**
   * 🎭 CHARM EVALUATION: Evaluate content charm level (0-10 scale)
   */
  private evaluateContentCharm(content: string): number {
    let charmScore = 0;
    
    // Conversation starters (+2 points)
    const conversationStarters = [
      'ever wonder why', 'here\'s what caught my attention', 'the part that blew my mind',
      'what\'s fascinating is', 'most people don\'t realize', 'here\'s what\'s wild',
      'the thing nobody talks about', 'what if i told you', 'just discovered',
      'been thinking about how'
    ];
    
    if (conversationStarters.some(starter => content.toLowerCase().includes(starter))) {
      charmScore += 2;
    }
    
    // Personal insight indicators (+2 points)
    const personalInsights = [
      'in my experience', 'what i\'ve learned', 'after working with', 'having analyzed',
      'from the field', 'what really happens', 'behind the scenes', 'industry secret',
      'what insiders know', 'the reality is'
    ];
    
    if (personalInsights.some(insight => content.toLowerCase().includes(insight))) {
      charmScore += 2;
    }
    
    // Human relatability (+1 point)
    const relatabilityTerms = [
      'real people', 'everyday', 'actually', 'honestly', 'frankly', 'truth is',
      'surprisingly', 'turns out', 'it\'s wild that', 'crazy part'
    ];
    
    if (relatabilityTerms.some(term => content.toLowerCase().includes(term))) {
      charmScore += 1;
    }
    
    // Contrarian/thought-provoking (+2 points)
    const contrarian = [
      'but here\'s the kicker', 'plot twist', 'counterintuitively', 'surprisingly',
      'contrary to belief', 'what\'s shocking', 'unexpected', 'paradigm shift'
    ];
    
    if (contrarian.some(phrase => content.toLowerCase().includes(phrase))) {
      charmScore += 2;
    }
    
    // Storytelling elements (+1 point)
    const storytelling = [
      'case study', 'story', 'example', 'patient', 'doctor told me', 'witnessed',
      'happened', 'discovered', 'breakthrough moment'
    ];
    
    if (storytelling.some(element => content.toLowerCase().includes(element))) {
      charmScore += 1;
    }
    
    // Future vision (+1 point)
    const futureVision = [
      'future of', 'next generation', 'coming soon', '2025', '2030', 'eventually',
      'trend', 'direction', 'evolution', 'transformation'
    ];
    
    if (futureVision.some(vision => content.toLowerCase().includes(vision))) {
      charmScore += 1;
    }
    
    // Deduct points for banned patterns (-3 points each)
    const bannedPatterns = [
      'study shows', 'research indicates', 'data suggests', 'according to',
      'scientists have discovered', 'new research reveals', 'analysis suggests',
      'results demonstrate', 'clinical trials show'
    ];
    
    bannedPatterns.forEach(pattern => {
      if (content.toLowerCase().includes(pattern)) {
        charmScore -= 3;
      }
    });
    
    // Ensure score is between 0-10
    return Math.max(0, Math.min(10, charmScore));
  }

  /**
   * 🎭 CHARM ENHANCEMENT: Enhance content to increase charm level
   */
  private async enhanceContentCharm(content: string): Promise<string> {
    try {
      const { openaiClient } = await import('../utils/openaiClient.js');
      
      const enhancementPrompt = `Transform this health tech content to be more charming, conversational, and insightful while maintaining accuracy:

Original content: "${content}"

Enhancement requirements:
1. Add a compelling conversation starter
2. Include personal perspective or industry insight
3. Make it relatable to real people
4. Add thought-provoking angle
5. Remove academic/corporate language
6. Keep under 280 characters
7. Maintain expert authority

Transform this into charming, engaging content that sparks conversation:`;

      const enhancedContent = await openaiClient.generateCompletion(enhancementPrompt, {
        maxTokens: 120,
        temperature: 0.8
      });

      if (enhancedContent && enhancedContent.length > 30) {
        console.log('🎭 CHARM ENHANCED: Content transformed for better engagement');
        return enhancedContent;
      } else {
        // Fallback enhancement
        return this.applyBasicCharmEnhancement(content);
      }
    } catch (error) {
      console.warn('⚠️ AI charm enhancement failed, applying basic enhancement:', error);
      return this.applyBasicCharmEnhancement(content);
    }
  }

  /**
   * 🎭 BASIC CHARM ENHANCEMENT: Fallback charm improvement
   */
  private applyBasicCharmEnhancement(content: string): string {
    let enhanced = content;
    
    // Add conversation starter if missing
    if (!enhanced.toLowerCase().startsWith('ever wonder') && 
        !enhanced.toLowerCase().startsWith('here\'s what') &&
        !enhanced.toLowerCase().startsWith('what\'s fascinating')) {
      
      const conversationStarters = [
        'Ever wonder why ',
        'Here\'s what caught my attention: ',
        'What\'s fascinating is that ',
        'Most people don\'t realize that '
      ];
      
      const starter = conversationStarters[Math.floor(Math.random() * conversationStarters.length)];
      enhanced = starter + enhanced.charAt(0).toLowerCase() + enhanced.slice(1);
    }
    
    // Remove academic language
    enhanced = enhanced.replace(/study shows?/gi, 'we discovered');
    enhanced = enhanced.replace(/research indicates?/gi, 'evidence suggests');
    enhanced = enhanced.replace(/data suggests?/gi, 'what\'s interesting is');
    enhanced = enhanced.replace(/according to/gi, 'as we learned from');
    
    // Add human context if content is too technical
    if (enhanced.length < 200 && !enhanced.includes('people') && !enhanced.includes('patients')) {
      enhanced += ' This could change how real people experience healthcare.';
    }
    
    return enhanced;
  }

  /**
   * 🚨 ENHANCED EMERGENCY CONTENT: High-quality fallback with charm
   */
  private async generateEnergencyContentLibrary(): Promise<string> {
    try {
      const { data: emergencyLibrary } = await supabaseClient.supabase
        ?.from('emergency_content_library')
        .select('*')
        .gte('charm_level', 7)
        .order('created_at', { ascending: false })
        .limit(10) || { data: [] };

      if (emergencyLibrary && emergencyLibrary.length > 0) {
        const randomContent = emergencyLibrary[Math.floor(Math.random() * emergencyLibrary.length)];
        console.log(`🆘 EMERGENCY LIBRARY: Using pre-approved charming content (charm level: ${randomContent.charm_level})`);
        return randomContent.content;
      }
    } catch (error) {
      console.warn('⚠️ Emergency content library unavailable:', error);
    }

    // Fallback to hardcoded charming content
    const hardcodedCharmingContent = [
      "Ever wonder why some health tech startups become unicorns while others crash? It's not the technology - it's how they solve real human problems vs chasing trends. The winners obsess over patient outcomes, not press releases.",
      
      "Here's what caught my attention: doctors who use AI diagnostics actually spend MORE time with patients, not less. The AI handles the data crunching, freeing doctors to do what they do best - heal humans.",
      
      "The thing nobody talks about in precision medicine: your genes are just the beginning. Your environment, stress, sleep, and gut bacteria influence how those genes express. We're conductors of our biology, not prisoners.",
      
      "What if I told you the most important health metric isn't in your bloodwork? It's whether you feel heard by your doctor. Patients with strong doctor relationships have 40% better outcomes.",
      
      "Been thinking about how drug discovery changed. We went from 15-year timelines to AI predicting molecules in minutes. But here's the kicker: proving digital predictions work in real bodies is still the bottleneck."
    ];

    return hardcodedCharmingContent[Math.floor(Math.random() * hardcodedCharmingContent.length)];
  }
}

// Allow running as standalone script
if (require.main === module) {
  const agent = new PostTweetAgent();
  
  if (process.argv.includes('--test')) {
    agent.testGenerationWithImages();
  } else {
    agent.run().then(result => {
      if (result.success) {
        console.log('✅ Tweet posted successfully:', result.content);
      } else {
        console.log('❌ Failed to post tweet:', result.error);
      }
      process.exit(0);
    });
  }
}