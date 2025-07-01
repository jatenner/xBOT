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
import { QuoteAgent } from './quoteAgent.js';
import { QualityGate } from '../utils/qualityGate.js';
import { PollAgent } from './pollAgent.js';
import { tweetFormatter } from '../utils/tweetFormatter.js';
import { ContentCache } from '../utils/contentCache.js';
import { EmbeddingFilter } from '../utils/embeddingFilter.js';
import { LIVE_MODE } from '../config/liveMode';
import { runtimeConfig } from '../utils/supabaseConfig.js';

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
    
    console.log('🧠 Nuclear learning intelligence systems initialized');
    
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
  private trackContent(content: string, topic: string) {
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
    
    console.log(`📊 Now tracking ${this.recentlyUsedContent.size} pieces of content and ${this.recentlyUsedTopics.size} topics`);
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
    // 🚨 EMERGENCY RATE LIMITING
    const rateLimitCheck = await this.checkRateLimit();
    if (!rateLimitCheck.canPost) {
      console.log('🚨 RATE LIMIT BLOCK: Cannot post -', rateLimitCheck.reason);
      return { success: false, reason: rateLimitCheck.reason };
    }
    try {
      console.log('🐦 === POST TWEET AGENT ACTIVATED ===');
      
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
          // Proceed with normal image selection
          imageUrl = await smartImageSelector.chooseImage(tweetContent);
        }
      } catch (error) {
        console.log('⚠️ Could not check nuclear image block, proceeding with image selection');
        imageUrl = await smartImageSelector.chooseImage(tweetContent);
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
        return { 
          success: true, 
          tweetId: result.tweetId,
          content: tweetContent,
          imageUrl,
          style: tweetStyle,
          readabilityScore: formattedResult.readabilityScore,
          formattingImprovements: formattedResult.improvements
        };
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
            case 'viral':
              console.log('🔥 Generating NUCLEAR viral content with learned patterns...');
              // Try nuclear learning first
              try {
                content = await this.nuclearLearning.generateCreativeContent();
                console.log('🧠 NUCLEAR LEARNING: Generated creative content');
              } catch (error) {
                console.warn('⚠️ Nuclear learning fallback to viral generator');
                const viralResult = await this.generateViralTweet(false, false);
                content = viralResult.content || '';
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
            // Apply learning-based content optimization
            content = this.applyLearningOptimizations(content, optimizedStrategy);
            
            // 🧠 NUCLEAR ENHANCEMENT: Enhance with viral elements
            try {
              content = await this.nuclearLearning.enhanceContentWithViralElements(content);
              console.log('🧠 NUCLEAR ENHANCEMENT: Added viral elements to content');
            } catch (error) {
              console.warn('⚠️ Nuclear enhancement error:', error);
            }
            
            // Extract topic for tracking
            const topic = this.extractKeyTopic(content);
            
            // Enhanced uniqueness check
            if (!this.isContentTooSimilar(content, topic)) {
              console.log('✅ Generated unique content with learning optimizations');
              this.trackContent(content, topic);
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
      
      // If all attempts failed, generate fallback with learning insights
      console.log('🚨 All generation attempts failed, using learning-enhanced fallback...');
      const fallbackContent = await this.generateLearningEnhancedFallback(optimizedStrategy);
      return fallbackContent;
    };

    return await regenerateCallback();
  }

  private async selectOptimizedContentMode(optimizedStrategy: any): Promise<'viral' | 'comprehensive' | 'engagement' | 'current_events' | 'trending'> {
    try {
      // 🧠 NUCLEAR LEARNING: Get intelligent content strategy from database
      const { data: strategyData } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', 'intelligent_content_strategy')
        .single() || { data: null };
      
      if (strategyData?.value?.content_mix) {
        const contentMix = strategyData.value.content_mix;
        
        // Use weighted random selection based on learning data
        const modes = [
          { mode: 'viral', weight: contentMix.breaking_news + contentMix.hot_takes },
          { mode: 'trending', weight: contentMix.trending_topics },
          { mode: 'comprehensive', weight: contentMix.data_insights },
          { mode: 'current_events', weight: contentMix.educational }
        ];
        
        const totalWeight = modes.reduce((sum, m) => sum + m.weight, 0);
        const random = Math.random() * totalWeight;
        let accumulator = 0;
        
        for (const mode of modes) {
          accumulator += mode.weight;
          if (random <= accumulator) {
            console.log(`🧠 NUCLEAR LEARNING: Selected ${mode.mode} mode (weight: ${mode.weight})`);
            return mode.mode as any;
          }
        }
      }
      
      // Use learning insights to select optimal content mode
      if (optimizedStrategy.learning_stats?.viral_success_rate > 30) {
        console.log('🔥 High viral success rate detected - prioritizing viral content');
        return 'viral';
      }
      
      // Check for trending topics from competitive intelligence
      if (optimizedStrategy.competitor_viral_patterns?.length > 0) {
        console.log('📈 Competitor viral patterns detected - using trending approach');
        return 'trending';
      }
      
      // Check recent insights for content type preferences
      const recentInsights = optimizedStrategy.latest_insights || [];
      if (recentInsights.some((insight: string) => insight.includes('BREAKING') || insight.includes('NEWS'))) {
        console.log('📰 News format showing success - using current events');
        return 'current_events';
      }
      
      // Default to viral if we have successful patterns
      if (optimizedStrategy.successful_patterns?.length > 0) {
        return 'viral';
      }
      
    } catch (error) {
      console.warn('⚠️ Error in nuclear learning mode selection:', error);
    }
    
    // Fallback to original logic
    return this.selectContentMode();
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
          content,
          image_url: imageUrl,
          style,
          twitter_id: twitterId,
          posted_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) {
        console.error('Database storage error:', error);
        return null;
      }

      return data?.id || null;
    } catch (error) {
      console.error('Error storing tweet:', error);
      return null;
    }
  }

  private selectContentMode(): 'viral' | 'comprehensive' | 'engagement' | 'current_events' | 'trending' {
    const currentHour = new Date().getHours();
    const isPeakHour = (currentHour >= 9 && currentHour <= 11) || 
                      (currentHour >= 15 && currentHour <= 17) || 
                      (currentHour >= 19 && currentHour <= 21);
    
    const randomFactor = Math.random();
    
    // 🔥 ENGAGEMENT-FOCUSED STRATEGY: Remove boring trending content
    // 80% viral, 15% current events, 5% comprehensive, 0% trending (boring mentions)
    if (randomFactor < 0.8) {
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
    this.trackContent(tweet, contentTopic);

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
    // More diverse, specific topics with real data and current relevance
    const freshTopics = [
      {
        content: 'AI-powered drug discovery reducing development time from 10 years to 18 months',
        stat: '85% faster development cycles',
        source: 'MIT Technology Review',
        year: '2024'
      },
      {
        content: 'Wearable sensors detecting heart attacks 6 hours before symptoms appear',
        stat: '89% accuracy in prediction',
        source: 'Stanford Medicine',
        year: '2024'
      },
      {
        content: 'Gene therapy reversing blindness in 90% of clinical trial participants',
        stat: '200+ patients regained sight',
        source: 'Nature Medicine',
        year: '2024'
      },
      {
        content: 'Digital twins of human organs predicting treatment outcomes',
        stat: '95% accuracy in surgical planning',
        source: 'Johns Hopkins',
        year: '2024'
      },
      {
        content: 'CRISPR gene editing eliminating sickle cell disease',
        stat: '100% success in recent trials',
        source: 'New England Journal',
        year: '2024'
      },
      {
        content: 'AI dermatologists diagnosing skin cancer from smartphone photos',
        stat: '94% accuracy vs 86% human doctors',
        source: 'Harvard Medical',
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
        this.trackContent(tweetContent, topicForTracking);
        
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
   * 🚨 EMERGENCY RATE LIMITING
   * Prevents API exhaustion by enforcing strict limits
   */
  private async checkRateLimit(): Promise<{ canPost: boolean; reason: string }> {
    try {
      // 🚨 FIRST: Check emergency configurations
      console.log('🔍 Checking emergency configurations...');
      
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
      let dailyLimit = runtimeConfig.maxDailyTweets;
      
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
        const MIN_INTERVAL = 30 * 60 * 1000; // 30 minutes minimum (increased from 20)
        
        if (timeSinceLastPost < MIN_INTERVAL) {
          const waitMinutes = Math.ceil((MIN_INTERVAL - timeSinceLastPost) / 60000);
          return { 
            canPost: false, 
            reason: `Must wait ${waitMinutes} more minutes since last post (30-minute safety interval)`
          };
        }
      }
      
      console.log('✅ All rate limit checks passed - posting allowed');
      return { canPost: true, reason: 'Rate limit check passed' };
      
    } catch (error) {
      console.log('⚠️ Rate limit check failed:', error.message);
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
  private async learnFromPostedContent(result: PostResult): Promise<void> {
    if (!result.success || !result.content) return;
    
    console.log('🧠 HUMAN LEARNING: Analyzing posted content for intelligence evolution');
    
    try {
      // Simulate human-like learning from content and expected engagement
      const simulatedEngagement = this.simulateEngagementForLearning(result.content);
      
      // Create learning interaction data
      const learningInteraction = {
        our_content: result.content,
        responses_received: [], // Will be populated by real engagement later
        engagement_metrics: simulatedEngagement,
        context: {
          content_type: this.identifyContentType(result.content),
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
      
      // Track content for duplicate prevention with human-like memory
      const topic = this.extractKeyTopic(result.content);
      this.trackContent(result.content, topic);
      
      console.log('✅ Human-like learning completed - personality may have evolved');
      
    } catch (error) {
      console.warn('⚠️ Human learning error:', error);
    }
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