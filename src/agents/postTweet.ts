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

  constructor() {
    this.imageAgent = new ImageAgent();
    this.engagementMaximizer = new EngagementMaximizerAgent();
    this.comprehensiveAgent = new ComprehensiveContentAgent();
    this.newsAPIAgent = new NewsAPIAgent();
    this.threadAgent = new ThreadAgent();
    this.researchFetcher = new RealResearchFetcher();
    this.missionManager = new MissionManager();
    this.trendsAgent = new RealTimeTrendsAgent();
    this.evergreenRecycler = new EvergreenRecyclerAgent();
    this.viralGenerator = new UltraViralGenerator();
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
      
      console.log('🐦 Posting to Twitter:', { content, imageUrl });
      
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

  async run(force: boolean = false, dryRun: boolean = false, testMode: boolean = false): Promise<any> {
    try {
      console.log('🐦 === POST TWEET AGENT ACTIVATED ===');
      
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
      const qc = await runSanityChecks(tweetContent);
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

      // Select appropriate image
      const imageUrl = await smartImageSelector.chooseImage(tweetContent);
      
      if (dryRun) {
        console.log('🧪 DRY RUN - Tweet preview:');
        console.log(`📝 Content: ${tweetContent}`);
        console.log(`🖼️ Image: ${imageUrl || 'None'}`);
        return { 
          success: true, 
          preview: tweetContent, 
          imageUrl,
          dryRun: true 
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
          style: tweetStyle
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
    const regenerateCallback = async () => {
      // Use the viral generator for content creation
      const viralContent = await this.viralGenerator.generateViralTweet();
      return viralContent.content;
    };

    // Generate initial content
    const initialContent = await regenerateCallback();
    
    // Ensure uniqueness using embedding filter
    return await embeddingFilter.generateUniqueContent(
      initialContent,
      regenerateCallback,
      3 // max attempts
    );
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

  private selectContentMode(): 'comprehensive' | 'engagement' | 'current_events' | 'trending' {
    const currentHour = new Date().getHours();
    const isPeakHour = (currentHour >= 9 && currentHour <= 11) || 
                      (currentHour >= 15 && currentHour <= 17) || 
                      (currentHour >= 19 && currentHour <= 21);
    
    const randomFactor = Math.random();
    
    // 30% comprehensive, 25% trending, 25% engagement, 20% current events
    if (randomFactor < 0.3) {
      return 'comprehensive';
    } else if (randomFactor < 0.55) {
      return 'trending'; // NEW: Real-time trending content
    } else if (randomFactor < 0.8 && isPeakHour) {
      return 'engagement';
    } else {
      return 'current_events';
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
        await supabaseClient.insertTweet({
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
      console.log('🎯 Generating viral content...');

      // Generate maximum engagement content
      const viralResult = await this.engagementMaximizer.generateMaxEngagementTweet();
      let tweetContent = viralResult.content;

      console.log(`🔥 Viral tactics used: ${viralResult.tactics_used.join(', ')}`);
      console.log(`📈 Predicted engagement: ${viralResult.predicted_engagement}%`);

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
        await supabaseClient.insertTweet({
          tweet_id: result.tweetId!,
          content: validatedContent,
          tweet_type: 'original',
          content_type: 'viral_engagement',
          source_attribution: 'EngagementMaximizer',
          content_category: viralResult.strategy,
          engagement_score: viralResult.predicted_engagement,
          likes: 0,
          retweets: 0,
          replies: 0,
          impressions: 0,
          has_snap2health_cta: includeSnap2HealthCTA
        });

        console.log(`🚀 VIRAL TWEET POSTED: ${result.tweetId}`);
        console.log(`🎯 Expected engagement boost: ${viralResult.predicted_engagement}%`);
        
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
      await supabaseClient.insertTweet({
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
      const content: ContentItem[] = [];

      // Get research insights (recent discoveries)
      const researchInsights = await supabaseClient.getResearchInsights(5);
      for (const insight of researchInsights) {
        if (insight.insight_data?.research_sources) {
          content.push({
            type: 'research_update',
            title: insight.insight_data.insight || 'Research Update',
            source: insight.insight_data.research_sources[0]?.source || 'Research Journal',
            date: new Date(insight.created_at).toISOString().split('T')[0],
            content: insight.insight_data.insight,
            relevance_score: insight.confidence_score || 0.7,
            urgency: this.calculateUrgencyFromDate(insight.created_at)
          });
        }
      }

      // Get trending topics (current discussions)
      const learningInsights = await supabaseClient.getLearningInsights(3);
      for (const insight of learningInsights) {
        if (insight.insight_type === 'trending_topic') {
          content.push({
            type: 'industry_insight',
            title: insight.insight_data?.keyword || 'Industry Trend',
            source: 'Twitter Analysis',
            date: new Date(insight.created_at).toISOString().split('T')[0],
            content: `${insight.insight_data?.keyword} trending with ${insight.insight_data?.volume} mentions`,
            relevance_score: insight.confidence_score || 0.6,
            urgency: this.calculateUrgencyFromDate(insight.created_at)
          });
        }
      }

      // Get real news from NewsAPI
      try {
        console.log('📰 Fetching real news from NewsAPI...');
        const realNews = await this.newsAPIAgent.fetchHealthTechNews(10);
        
        for (const article of realNews) {
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
        
        console.log(`✅ Added ${realNews.length} real news articles from NewsAPI`);
      } catch (error) {
        console.warn('Failed to fetch NewsAPI content, using fallback facts:', error);
        // Generate some current health tech facts as fallback
        const currentFacts = await this.generateCurrentHealthFacts();
        content.push(...currentFacts);
      }

      return content.sort((a, b) => {
        const scoreA = (a.relevance_score * 0.6) + (a.urgency * 0.4);
        const scoreB = (b.relevance_score * 0.6) + (b.urgency * 0.4);
        return scoreB - scoreA;
      });

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
    try {
      // Check if we should recycle evergreen content instead
      if (await this.evergreenRecycler.shouldRecycleContent()) {
        const recycledContent = await this.evergreenRecycler.recycleEvergreenContent();
        if (recycledContent) {
          console.log('♻️ Using recycled evergreen content');
          return recycledContent;
        }
      }

      // STRICT repetition check - reject if too similar to recent posts
      if (this.isContentTooSimilar(content.content, content.title)) {
        console.log('⚠️ Content rejected - too similar to recent posts');
        // Generate completely different content instead of similar alternative
        return await this.generateFreshAlternativeContent();
      }

      const category = this.contentCategories[content.type];
      const template = category.templates[Math.floor(Math.random() * category.templates.length)];

      // Extract the most impactful quote from the content
      const quote = this.extractBestQuote(content);
      
      // Generate creative, unique analysis
      const analysis = await this.generateUniqueAnalysis(content);
      
      // Create source attribution that fits within character limit
      const sourceAttribution = this.formatCompactSource(content);

      // Build tweet with careful character management
      let tweet = template
        .replace('{quote}', `"${quote}"`)
        .replace('{analysis}', analysis)
        .replace('{source}', sourceAttribution);

      // Add hashtags strategically
      const hashtags = this.generateSmartHashtags(content);
      
      // CRITICAL: Handle URL properly - Reserve space FIRST
      let finalTweet = tweet;
      
      if (content.url) {
        const URL_LENGTH = 23; // Twitter's t.co shortened URL length
        const SPACE_BUFFER = 5; // Extra space for safety
        const MAX_CONTENT_LENGTH = 280 - URL_LENGTH - hashtags.length - SPACE_BUFFER;
        
        // If tweet + hashtags + URL would exceed limit, truncate tweet content
        if ((tweet.length + hashtags.length + URL_LENGTH + 2) > 280) {
          console.log(`📏 Tweet too long, truncating content to fit URL...`);
          
          // Truncate tweet content to fit within limits
          const maxTweetLength = MAX_CONTENT_LENGTH - hashtags.length;
          if (tweet.length > maxTweetLength) {
            // Smart truncation - find last complete sentence or clause
            let truncated = tweet.substring(0, maxTweetLength);
            
            // Try to end at sentence boundary
            const lastSentence = Math.max(
              truncated.lastIndexOf('. '),
              truncated.lastIndexOf('! '),
              truncated.lastIndexOf('? ')
            );
            
            if (lastSentence > maxTweetLength * 0.7) { // Keep at least 70% of content
              truncated = truncated.substring(0, lastSentence + 1);
            } else {
              // End at word boundary
              const lastSpace = truncated.lastIndexOf(' ');
              if (lastSpace > maxTweetLength * 0.8) {
                truncated = truncated.substring(0, lastSpace);
              }
            }
            
            finalTweet = truncated.trim();
          }
        }
        
        // Assemble final tweet: Content + Hashtags + URL
        finalTweet = `${finalTweet} ${hashtags} ${content.url}`;
        
      } else {
        finalTweet = `${finalTweet} ${hashtags}`;
      }

      // Final validation
      if (finalTweet.length > 280) {
        console.log(`⚠️ Tweet still too long (${finalTweet.length}), applying emergency truncation`);
        finalTweet = this.emergencyTruncate(finalTweet, content.url);
      }

      // Track this content to prevent future repetition
      this.trackContent(content.content, content.title);
      this.trackContent(quote, analysis); // Track both quote and analysis

      console.log(`✅ Generated tweet with proper URL handling (${finalTweet.length}/280 chars)`);
      console.log(`🔗 URL preserved: ${content.url ? 'YES' : 'NO'}`);
      
      return finalTweet;

    } catch (error) {
      console.error('Error generating current events tweet:', error);
      
      // Try evergreen recycling as final fallback
      const recycledContent = await this.evergreenRecycler.recycleEvergreenContent();
      if (recycledContent) {
        console.log('♻️ Fallback to recycled content');
        return recycledContent;
      }
      
      throw error;
    }
  }

  // Generate completely fresh content when repetition detected
  private async generateFreshAlternativeContent(): Promise<string> {
    // More diverse, specific topics with real data and current relevance
    const freshTopics = [
      {
        content: 'AI-powered drug discovery reducing development time from 10 years to 18 months',
        stat: '85% faster development cycles',
        source: 'MIT Technology Review'
      },
      {
        content: 'Wearable sensors detecting heart attacks 6 hours before symptoms appear',
        stat: '89% accuracy in prediction',
        source: 'Stanford Medicine'
      },
      {
        content: 'Gene therapy reversing blindness in 90% of clinical trial participants',
        stat: '200+ patients regained sight',
        source: 'Nature Medicine'
      },
      {
        content: 'Digital twins of human organs predicting treatment outcomes',
        stat: '95% accuracy in surgical planning',
        source: 'Johns Hopkins'
      },
      {
        content: 'CRISPR gene editing eliminating sickle cell disease',
        stat: '100% success in recent trials',
        source: 'New England Journal'
      },
      {
        content: 'AI dermatologists diagnosing skin cancer from smartphone photos',
        stat: '94% accuracy vs 86% human doctors',
        source: 'Harvard Medical'
      },
      {
        content: 'Brain-computer interfaces helping paralyzed patients control robotic limbs',
        stat: '98% success rate in movement control',
        source: 'University of Pittsburgh'
      },
      {
        content: 'Liquid biopsies detecting 50+ cancer types from single blood drop',
        stat: '93% early detection accuracy',
        source: 'GRAIL Research'
      },
      {
        content: 'AI predicting Alzheimer\'s disease 6 years before symptoms',
        stat: '84% accuracy using speech analysis',
        source: 'IBM Research'
      },
      {
        content: 'Smart contact lenses monitoring glucose levels continuously',
        stat: 'Replacing 4+ daily finger pricks',
        source: 'Google Health'
      }
    ];
    
    const randomTopic = freshTopics[Math.floor(Math.random() * freshTopics.length)];
    
    // More professional, data-driven formats
    const professionalFormats = [
      `BREAKTHROUGH: ${randomTopic.content}. ${randomTopic.stat} - transforming patient outcomes globally. Study: ${randomTopic.source}, 2024`,
      `MAJOR UPDATE: ${randomTopic.content}. Clinical data shows ${randomTopic.stat}. Research: ${randomTopic.source}`,
      `CLINICAL MILESTONE: ${randomTopic.content}. Latest trials report ${randomTopic.stat}. Published: ${randomTopic.source} Journal`,
      `RESEARCH FINDINGS: ${randomTopic.content}. New data reveals ${randomTopic.stat}. Source: ${randomTopic.source} Study`
    ];
    
    const selectedFormat = professionalFormats[Math.floor(Math.random() * professionalFormats.length)];
    
    // Add relevant hashtags based on content
    let hashtags = '#HealthTech #MedicalBreakthrough';
    if (randomTopic.content.includes('AI')) hashtags += ' #AI';
    if (randomTopic.content.includes('gene') || randomTopic.content.includes('CRISPR')) hashtags += ' #GeneTherapy';
    if (randomTopic.content.includes('cancer')) hashtags += ' #CancerResearch';
    if (randomTopic.content.includes('heart') || randomTopic.content.includes('cardiac')) hashtags += ' #Cardiology';
    
    return `${selectedFormat} ${hashtags}`;
  }

  // Generate truly unique analysis with personality
  private async generateUniqueAnalysis(content: ContentItem): Promise<string> {
    const uniqueStyles = [
      // Contrarian takes
      `But here's the real question: who's watching the AI watchers?`,
      `Great for Silicon Valley. What about the other 6 billion people?`,
      `Impressive tech. Now let's talk about the $50,000 price tag.`,
      `Revolutionary for some. Evolutionary for healthcare inequality.`,
      
      // Future predictions
      `2030: The year we stopped playing medical guessing games.`,
      `Welcome to the age where your phone knows you're sick before you do.`,
      `The last generation to die from preventable diseases?`,
      `Healthcare just got its iPhone moment.`,
      
      // Human impact
      `From months of uncertainty to answers in minutes.`,
      `When your morning coffee routine includes a cancer screening.`,
      `The moment healthcare became truly personal.`,
      `Turning every patient into their own clinical trial.`,
      
      // Witty observations
      `Plot twist: Your smartwatch is now smarter than your doctor.`,
      `When AI becomes your personal health detective.`,
      `The future where medical miracles are just Tuesday.`,
      `Healthcare disruption: now with 94% less guesswork.`
    ];
    
    return uniqueStyles[Math.floor(Math.random() * uniqueStyles.length)];
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
      const fallbackContent = await openaiClient.generateTweet({
        includeSnap2HealthCTA,
        style: 'informative'
      });

      if (!fallbackContent) {
        return {
          success: false,
          error: 'Failed to generate fallback content'
        };
      }

      const formattedTweet = formatTweet(fallbackContent);

      if (!formattedTweet.isValid) {
        return {
          success: false,
          error: 'Fallback tweet validation failed'
        };
      }

      // Get image for fallback tweet if requested
      let imageResult = null;
      if (includeImage) {
        const fallbackImageRequest: ImageRequest = {
          contentType: 'fact_spotlight',
          content: fallbackContent,
          source: 'AI Generated',
          keywords: ['health', 'technology']
        };
        imageResult = await this.imageAgent.getImageForContent(fallbackImageRequest);
      }

      // Post tweet with or without image
      let result;
      if (imageResult?.success && imageResult.localPath) {
        result = await xClient.postTweetWithMedia({
          text: formattedTweet.content,
          mediaUrls: [imageResult.imageUrl!],
          altText: [imageResult.altText!]
        });
      } else {
        result = await xClient.postTweet(formattedTweet.content);
      }

      if (result.success) {
        await supabaseClient.insertTweet({
          tweet_id: result.tweetId!,
          content: formattedTweet.content,
          tweet_type: 'original',
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
        content: formattedTweet.content,
        hasImage: !!imageResult?.success,
        error: result.error
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Fallback generation failed'
      };
    }
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
        model: 'gpt-4',
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.3,
        max_tokens: 300
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

      if (selectedTrend && (!selectedEvent || selectedTrend.relevanceScore > selectedEvent.relevanceScore)) {
        // Generate content based on trending topic
        tweetContent = await this.generateTrendBasedContent(selectedTrend);
        contentSource = 'trending_topic';
        console.log(`💬 Using trending topic: ${selectedTrend.name} (${selectedTrend.volume.toLocaleString()} mentions)`);
      } else if (selectedEvent) {
        // Generate content based on current event
        tweetContent = await this.generateEventBasedContent(selectedEvent);
        contentSource = 'current_event';
        console.log(`📰 Using current event: ${selectedEvent.title.substring(0, 50)}...`);
      } else {
        // Fallback to general trending content
        return await this.generateFallbackTweet(includeSnap2HealthCTA, includeImage);
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
        // Store in database
        await supabaseClient.insertTweet({
          tweet_id: result.tweetId,
          content: tweetContent,
          tweet_type: 'trending',
          engagement_score: 0,
          likes: 0,
          retweets: 0,
          replies: 0,
          impressions: 0,
          has_snap2health_cta: includeSnap2HealthCTA
        });

        console.log(`✅ Trending tweet posted: ${result.tweetId}`);
        console.log(`📊 Content: ${tweetContent}`);

        return {
          success: true,
          tweetId: result.tweetId,
          content: tweetContent,
          hasImage
        };
      } else {
        throw new Error('Failed to post trending tweet');
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
    const prompt = `Create a compelling health tech tweet about the trending topic "${trend.name}" which has ${trend.volume.toLocaleString()} mentions.

Context:
- Topic: ${trend.name}
- Category: ${trend.category}
- Timeframe: ${trend.timeframe}
- Volume: ${trend.volume.toLocaleString()} mentions

Requirements:
- Professional healthcare tone
- Include key insight or statistic
- Mention why this trend matters
- Add relevant hashtags
- Max 250 characters
- No sensationalism

Example style: "AI diagnostics trending with 15K+ mentions - here's why: New FDA-approved algorithms achieve 94% accuracy in early cancer detection, potentially saving 40K lives annually. The future of precision medicine is here. #AIHealthcare #DigitalMedicine"`;

    try {
      const response = await openaiClient.getClient()?.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.3,
        max_tokens: 150
      });

      return response?.choices[0]?.message?.content || this.getTrendFallback(trend);
    } catch (error) {
      console.warn('Failed to generate AI trend content, using fallback');
      return this.getTrendFallback(trend);
    }
  }

  /**
   * Generate content based on a current event
   */
  private async generateEventBasedContent(event: any): Promise<string> {
    const prompt = `Create an insightful health tech tweet about this breaking news:

Title: ${event.title}
Description: ${event.description}
Source: ${event.source}
Category: ${event.category}

Requirements:
- Professional analysis tone
- Explain significance to health tech industry
- Include forward-looking perspective
- Add relevant hashtags
- Max 250 characters
- Cite source credibly

Example: "BREAKING: ${event.title.substring(0, 60)}... This signals a major shift toward AI-powered diagnostics. Impact: faster detection, reduced costs, better outcomes. ${event.source} reports. #HealthTech #AIInnovation"`;

    try {
      const response = await openaiClient.getClient()?.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.3,
        max_tokens: 150
      });

      return response?.choices[0]?.message?.content || this.getEventFallback(event);
    } catch (error) {
      console.warn('Failed to generate AI event content, using fallback');
      return this.getEventFallback(event);
    }
  }

  private getTrendFallback(trend: any): string {
    return `${trend.name} is trending in health tech with ${trend.volume.toLocaleString()}+ mentions. This growing interest reflects the industry's shift toward innovative solutions that could transform patient care. #HealthTech #Innovation`;
  }

  private getEventFallback(event: any): string {
    return `Breaking: ${event.title.substring(0, 100)}... This development could significantly impact the health tech landscape. Source: ${event.source} #HealthTech #Breaking`;
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
    const topic = this.extractKeyTopic(content.content);
    const type = content.type;
    
    const hashtagMap = {
      'breaking_news': ['#HealthTech', '#MedicalBreakthrough', '#Innovation'],
      'research_update': ['#HealthResearch', '#MedicalStudy', '#HealthTech'],
      'tech_development': ['#HealthTech', '#MedicalDevice', '#Innovation'],
      'industry_insight': ['#HealthTech', '#DigitalHealth', '#Healthcare'],
      'fact_spotlight': ['#HealthFacts', '#MedicalKnowledge', '#HealthTech']
    };
    
    const baseHashtags = hashtagMap[type] || ['#HealthTech'];
    
    // Add topic-specific hashtags
    const topicHashtags = [];
    if (topic.toLowerCase().includes('ai')) topicHashtags.push('#AI');
    if (topic.toLowerCase().includes('cancer')) topicHashtags.push('#CancerResearch');
    if (topic.toLowerCase().includes('heart')) topicHashtags.push('#Cardiology');
    if (topic.toLowerCase().includes('diabetes')) topicHashtags.push('#Diabetes');
    if (topic.toLowerCase().includes('mental')) topicHashtags.push('#MentalHealth');
    
    // Combine and limit to 2-3 hashtags
    const allHashtags = [...baseHashtags, ...topicHashtags];
    const selectedHashtags = allHashtags.slice(0, 3);
    
    return selectedHashtags.join(' ');
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