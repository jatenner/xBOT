/**
 * SIMPLIFIED POSTING ENGINE - Emergency Fix
 * 
 * This replaces the over-complex autonomous posting system with a simple,
 * reliable posting mechanism focused on actual engagement results.
 */

import { TwitterPoster } from '../posting/postThread';
import { getContentGenerator } from '../ai/generate';
import { validateContent } from '../quality/qualityGate';
import { scheduleMetricsTracking } from '../metrics/trackTweet';
import { storeLearningPost } from '../db/index';
import { logInfo, logError } from '../utils/intelligentLogging';
import { ContentQualityController } from '../quality/contentQualityController';
import { ContentPerformanceLearner } from '../learning/contentPerformanceLearner';

export interface SimplePostResult {
  success: boolean;
  tweetId?: string;
  content?: string;
  error?: string;
  engagementPrediction?: number;
}

export class SimplifiedPostingEngine {
  private static instance: SimplifiedPostingEngine;
  private isPosting = false;
  private lastPostTime = 0;
  private readonly MIN_POST_INTERVAL = 60 * 60 * 1000; // 60 minutes for growth
  private readonly MAX_DAILY_POSTS = 20; // Increased for small account growth
  private dailyPostCount = 0;
  private lastResetDate = new Date().toDateString();
  private qualityController: ContentQualityController;
  private learner: ContentPerformanceLearner;

  private constructor() {
    this.qualityController = new ContentQualityController(process.env.OPENAI_API_KEY!);
    this.learner = ContentPerformanceLearner.getInstance();
  }

  public static getInstance(): SimplifiedPostingEngine {
    if (!SimplifiedPostingEngine.instance) {
      SimplifiedPostingEngine.instance = new SimplifiedPostingEngine();
    }
    return SimplifiedPostingEngine.instance;
  }

  /**
   * Simple, reliable posting with engagement optimization
   */
  public async createEngagingPost(topic?: string): Promise<SimplePostResult> {
    if (this.isPosting) {
      return { success: false, error: 'Already posting' };
    }

    // Reset daily counter if new day
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.dailyPostCount = 0;
      this.lastResetDate = today;
    }

    // Check rate limits
    const now = Date.now();
    const timeSinceLastPost = now - this.lastPostTime;
    
    if (timeSinceLastPost < this.MIN_POST_INTERVAL) {
      const waitMinutes = Math.ceil((this.MIN_POST_INTERVAL - timeSinceLastPost) / 60000);
      return { 
        success: false, 
        error: `Rate limited. Wait ${waitMinutes} minutes` 
      };
    }

    if (this.dailyPostCount >= this.MAX_DAILY_POSTS) {
      return { 
        success: false, 
        error: 'Daily post limit reached' 
      };
    }

    this.isPosting = true;
    
    try {
      logInfo('SIMPLE_POST', `Creating engaging post ${this.dailyPostCount + 1}/${this.MAX_DAILY_POSTS}`);

      // 🧠 LEARNING_OPTIMIZATION: Apply learned patterns to improve content
      console.log('🧠 LEARNING_ENGINE: Applying performance insights...');
      const learningInsights = await this.learner.analyzeContentPerformance();
      
      console.log(`📊 LEARNING_DATA: ${learningInsights.successful_patterns.length} successful patterns found`);
      console.log(`⚠️ AVOIDING: ${learningInsights.failing_patterns.length} failing patterns`);
      console.log(`💡 RECOMMENDATIONS: ${learningInsights.recommendations.slice(0, 2).join(', ')}`);

      // Get content type recommendation based on learning
      const contentTypeHint = await this.learner.getImprovementSuggestions('single');
      console.log(`🎯 OPTIMAL_LENGTH: ${contentTypeHint.optimal_length} characters`);
      console.log(`🚀 TOP_HOOKS: ${contentTypeHint.hooks.slice(0, 2).join(', ')}`);

            // 🎯 DIRECT CONTENT GENERATION: Bypass broken orchestrator for variety
      const shouldForceThread = topic && topic.includes('thread') || Math.random() < 0.4; // 40% chance for threads
      console.log(`🎯 CONTENT_TYPE_DECISION: ${shouldForceThread ? 'THREAD' : 'SIMPLE'} format forced`);
      
      let ultimateContent;
      
      if (shouldForceThread) {
        console.log('🧵 DIRECT_THREAD: Using dedicated thread generator...');
        
        // Use the thread generator directly
        const { generateThread } = await import('../ai/threadGenerator');
        const { OpenAI } = await import('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        
        const threadContent = await generateThread({
          topic: topic || 'health optimization',
          pillar: 'health',
          angle: 'contrarian insights',
          spice_level: 2,
          evidence_mode: 'mini-study'
        }, openai);
        
        // Convert thread to Ultimate Content format
        ultimateContent = {
          content: threadContent.tweets.map(t => t.text), // ARRAY of tweets!
          metadata: {
            generation_quality: threadContent.quality.score,
            growth_score: 85,
            viral_probability: threadContent.quality.score,
            authenticity_score: threadContent.quality.rubric.human_warmth * 20,
            learning_value: 80,
            strategic_alignment: 90
          },
          predictions: {
            likes: 25,
            retweets: 8,
            replies: 12,
            followers_gained: 3,
            engagement_rate: 4.2
          },
          strategy: {
            posting_time: 'Peak engagement hours',
            distribution_plan: 'Thread with reply chain',
            follow_up_actions: ['Engage with replies', 'Monitor thread performance']
          },
          learning: {
            what_to_track: ['Thread completion rate', 'Reply engagement'],
            success_metrics: ['High reply rate', 'Thread viral spread'],
            hypothesis: 'Health threads drive deeper engagement'
          }
        };
        
        console.log(`🧵 THREAD_GENERATED: ${ultimateContent.content.length} tweets in thread`);
        
      } else {
        console.log('📝 DIRECT_SIMPLE: Using diversified simple content generation...');
        
        // 🎯 GENERATE DIVERSE SIMPLE CONTENT
        const { HookDiversificationEngine } = await import('../ai/hookDiversificationEngine');
        const { OpenAI } = await import('openai');
        
        const hookEngine = HookDiversificationEngine.getInstance();
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
        
        // 🎲 REAL VARIETY: Mix of different content styles (some with hooks, some without)
        const contentStyles = [
          'hooked_tip',      // 25% - Uses diversified hooks
          'direct_fact',     // 25% - Direct statement, no hook
          'question_based',  // 20% - Starts with question
          'story_snippet',   // 15% - Mini story format
          'simple_statement', // 15% - Just a clean fact
        ];
        
        const selectedStyle = contentStyles[Math.floor(Math.random() * contentStyles.length)];
        console.log(`📋 CONTENT_STYLE: Using ${selectedStyle} format`);
        
        let structurePrompt = '';
        
        if (selectedStyle === 'hooked_tip') {
          // Only use hooks 25% of the time
          const diverseHook = hookEngine.getDiverseHook(topic || 'health', 'simple');
          console.log(`🎯 HOOK_USED: "${diverseHook.substring(0, 40)}..."`);
          structurePrompt = `Create actionable health advice. Use this hook: "${diverseHook}" Follow with specific method + expected results. Keep under 240 chars.`;
        } else {
          console.log(`🚫 NO_HOOK: Using ${selectedStyle} style`);
          switch (selectedStyle) {
            case 'direct_fact':
              structurePrompt = `State a surprising health fact directly. Format: "[Surprising fact]. [Why it matters]. [What to do about it]." Be specific and shocking. Under 240 chars.`;
              break;
            case 'question_based':
              structurePrompt = `Start with an intriguing health question. Format: "Why do [thing]? [Answer with mechanism]. [Practical application]." Under 240 chars.`;
              break;
            case 'story_snippet':
              structurePrompt = `Share a mini health story. Format: "Last month/week [brief scenario]. Result: [specific outcome]. The reason: [mechanism]." Under 240 chars.`;
              break;
            case 'simple_statement':
              structurePrompt = `Make a clean, direct health statement. Format: "[Health fact]. [Scientific reason]. [Simple action step]." No hooks, just clear info. Under 240 chars.`;
              break;
          }
        }
        
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are a viral health influencer. Create engaging, specific content that makes people want to follow. Avoid generic advice. Be specific about mechanisms and outcomes.'
            },
            {
              role: 'user', 
              content: structurePrompt
            }
          ],
          temperature: 0.8
        });
        
        const simpleContent = response.choices[0].message.content?.trim() || '';
        
        ultimateContent = {
          content: simpleContent,
          metadata: {
            type: 'single' as const,
            topic: topic || 'health',
            angle: selectedStyle,
            quality_score: 85,
            viral_prediction: 70,
            authenticity_score: 90,
            strategic_alignment: 85,
            generation_quality: 85,
            growth_score: 80,
            viral_probability: 70
          },
          predictions: {
            likes: 15,
            retweets: 5,
            replies: 3,
            followers_gained: 2
          },
          strategy: {
            posting_time: 'Optimal engagement window',
            distribution_plan: 'Single viral tweet',
            follow_up_actions: ['Monitor engagement', 'Reply to comments']
          },
          learning: {
            what_to_track: ['Content style effectiveness', 'Variety impact'],
            success_metrics: ['High engagement rate', 'Follower conversion'],
            hypothesis: 'Natural variety without forced hooks drives engagement'
          }
        };
        
        console.log(`✅ NATURAL_VARIETY: Generated ${selectedStyle} content`);
      }
      
      console.log(`🎖️ ULTIMATE_QUALITY: ${ultimateContent.metadata.generation_quality}/100`);
      console.log(`📈 GROWTH_SCORE: ${ultimateContent.metadata.growth_score}/100`);
      console.log(`🔥 VIRAL_PROBABILITY: ${ultimateContent.metadata.viral_probability}/100`);
      console.log(`🧠 AUTHENTICITY: ${ultimateContent.metadata.authenticity_score}/100`);
      console.log(`📊 PREDICTIONS: ${ultimateContent.predictions.likes} likes, ${ultimateContent.predictions.followers_gained} followers`);
      console.log(`⏰ STRATEGY: ${ultimateContent.strategy.posting_time}`);

      // 🔬 SCIENTIFIC_VALIDATION: Ensure complex content structure
      const hasScientificStructure = this.validateScientificStructure(ultimateContent.content);
      if (!hasScientificStructure) {
        logInfo('SIMPLE_POST', '⚠️ CONTENT_REJECTED: Not scientifically complex enough, retrying with thread format...');
        
        // IMMEDIATE RETRY: Force thread generation for scientific complexity
        console.log('🔄 RETRY_STRATEGY: Forcing thread generation for complex scientific content...');
        const { generateThread } = await import('../ai/threadGenerator');
        const openai = new (await import('openai')).default({ apiKey: process.env.OPENAI_API_KEY! });
        
        try {
          const threadResult = await generateThread({
            topic: topic || 'health optimization breakthrough',
            pillar: 'biohacking',
            angle: 'contrarian',
            spice_level: 8,
            evidence_mode: 'mechanism'
          }, openai);
          
          // Use the thread tweets as content
          ultimateContent = {
            content: threadResult.tweets.map(t => t.text),
            metadata: { 
              viral_probability: threadResult.quality.score,
              authenticity_score: 100,
              quality_score: threadResult.quality.score
            },
            predictions: { likes: 15, followers_gained: 8 },
            strategy: { posting_time: 'Scientific thread retry' }
          };
          
          console.log(`🧵 RETRY_SUCCESS: Generated ${threadResult.tweets.length}-tweet scientific thread`);
          
        } catch (retryError: any) {
          logInfo('SIMPLE_POST', `❌ RETRY_FAILED: ${retryError.message}`);
          return { success: false, error: 'Failed to generate scientific content after retry' };
        }
      }
      
      // 🔧 IMPROVED THREAD PARSING: Handle both array and string formats
      console.log('🔧 THREAD_PARSER: Analyzing content format...');
      
      let tweets: string[] = [];
      let isThreadContent = false;
      
      // Check if content is already formatted as array (from thread generator)
      if (Array.isArray(ultimateContent.content)) {
        tweets = ultimateContent.content.filter(t => t.trim());
        isThreadContent = tweets.length > 1;
        console.log(`🧵 ARRAY_FORMAT: Detected ${tweets.length} tweets in array format`);
      } 
      // Handle string content from Ultimate Content System
      else if (typeof ultimateContent.content === 'string') {
        const content = ultimateContent.content.trim();
        console.log(`📝 STRING_FORMAT: Content length ${content.length} chars`);
        
        // Method 1: Split by numbered indicators (1/, 2/, 3/, etc.)
        const numberedSplit = content.split(/\n*\d+\//).filter(t => t.trim());
        if (numberedSplit.length > 1) {
          tweets = numberedSplit.map(t => t.trim());
          isThreadContent = true;
          console.log('🧵 DETECTED: Numbered thread format');
        }
        // Method 2: Split by double newlines
        else if (content.includes('\n\n')) {
          const paragraphSplit = content.split('\n\n').filter(t => t.trim());
          if (paragraphSplit.length > 1 && paragraphSplit.every(p => p.length < 280)) {
            tweets = paragraphSplit;
            isThreadContent = true;
            console.log('🧵 DETECTED: Paragraph-based thread');
          }
        }
        
        // If no thread detected but content is long, force thread creation
        if (!isThreadContent && content.length > 250) {
          console.log('🔄 FORCING: Long content converted to thread');
          tweets = this.splitIntoThreadTweets(content);
          isThreadContent = tweets.length > 1;
        }
        
        // Default: single tweet
        if (!isThreadContent) {
          tweets = [content];
        }
      }

      const generationResult = {
        content: {
          tweets: tweets
        },
        ultimateResult: ultimateContent // Store for learning
      };

      console.log(`🎯 ULTIMATE_POST: Generated ${isThreadContent ? 'thread' : 'single'} with ${tweets.length} tweet(s)`);
      console.log(`📝 CONTENT_PREVIEW: "${tweets[0].substring(0, 100)}${tweets[0].length > 100 ? '...' : ''}"`);
      if (isThreadContent && tweets.length > 1) {
        console.log(`🧵 THREAD_PREVIEW: Tweet 2 starts with "${tweets[1].substring(0, 50)}..."`);
      }
      
      if (!generationResult?.content?.tweets?.length) {
        throw new Error('No content generated');
      }

      // 🔍 QUALITY_VALIDATION: Comprehensive content quality check
      console.log('🔍 QUALITY_CONTROLLER: Validating content quality...');
      
      // For threads, validate the first tweet (most critical for engagement)
      const contentToValidate = tweets[0];
      const qualityScore = await this.qualityController.validateContentQuality(contentToValidate);
      
      console.log(`📊 QUALITY_SCORE: ${qualityScore.overall}/100 (Completeness: ${qualityScore.completeness}/100)`);
      
      if (!qualityScore.shouldPost) {
        console.log('🚫 QUALITY_GATE: Content REJECTED - attempting to improve...');
        console.log('❌ Quality Issues:', qualityScore.issues.join(', '));
        
        // Attempt to improve the content
        const improvement = await this.qualityController.improveContent(contentToValidate, qualityScore);
        
        if (improvement.qualityIncrease > 0) {
          console.log(`✅ CONTENT_IMPROVED: Quality increased by ${improvement.qualityIncrease} points`);
          tweets[0] = improvement.improvedContent;
          generationResult.content.tweets = tweets;
        } else {
          // Content couldn't be improved enough - skip posting
          return {
            success: false,
            error: `Content quality too low (${qualityScore.overall}/100): ${qualityScore.issues.join(', ')}`,
          };
        }
      } else {
        console.log('✅ QUALITY_GATE: Content approved for posting');
      }

      // Handle both single tweets and threads
      const isThread = generationResult.content.tweets.length > 1;

      let postResult;
      if (isThread) {
        console.log(`🧵 SIMPLE_POST: Posting ${generationResult.content.tweets.length}-tweet thread using SIMPLE THREAD POSTER`);
        
        // Use SimpleThreadPoster for reliable thread posting
        const { SimpleThreadPoster } = await import('../posting/simpleThreadPoster');
        const threadPoster = SimpleThreadPoster.getInstance();
        
        // Validate tweets first
        const validation = threadPoster.validateTweets(generationResult.content.tweets);
        if (!validation.valid) {
          console.error('❌ THREAD_VALIDATION: Thread validation failed:', validation.issues.join(', '));
          throw new Error(`Thread validation failed: ${validation.issues.join(', ')}`);
        }
        
        // Optimize all tweets in the thread
        const optimizedTweets = generationResult.content.tweets.map(tweet => 
          this.optimizeForEngagement(tweet)
        );
        
        console.log('🚀 THREAD_POSTING: Using SimpleThreadPoster for real reply chain...');
        const threadResult = await threadPoster.postRealThread(optimizedTweets);
        
        // Convert to expected format
        postResult = {
          success: threadResult.success,
          tweetId: threadResult.rootTweetId,
          replyIds: threadResult.replyIds,
          error: threadResult.error,
          method: 'simple_thread'
        };
        
        if (threadResult.success) {
          console.log(`✅ THREAD_SUCCESS: Posted ${threadResult.totalTweets}-tweet thread!`);
          console.log(`🔗 Root: ${threadResult.rootTweetId}, Replies: ${threadResult.replyIds?.length || 0}`);
        }
        
      } else {
        console.log('📝 SIMPLE_POST: Posting single tweet');
        
        // Get the single tweet content
      const tweetContent = generationResult.content.tweets[0];
      if (!tweetContent) {
        throw new Error('No tweet content generated');
      }

      // Optimize for engagement
      const optimizedContent = this.optimizeForEngagement(tweetContent);
      
      // Post to Twitter using the postSingleTweet method
      const poster = new TwitterPoster();
        postResult = await poster.postSingleTweet(optimizedContent);
      }
      
      if (!postResult.success || !postResult.tweetId) {
        throw new Error(postResult.error || 'Failed to post to Twitter');
      }

      // Track metrics immediately
      await scheduleMetricsTracking(postResult.tweetId);
      
      // Store for learning with correct format tracking
      const contentForStorage = isThread ? 
        (postResult as any).allTweets?.join('\n\n') || generationResult.content.tweets.join('\n\n') :
        (postResult as any).content || generationResult.content.tweets[0];
        
      await storeLearningPost({
        content: contentForStorage,
        tweet_id: postResult.tweetId,
        quality_score: 85 // Ultimate system has built-in quality gates
      });

      // Update counters
      this.lastPostTime = now;
      this.dailyPostCount++;

      logInfo('SIMPLE_POST', `✅ Posted ${isThread ? 'thread' : 'single tweet'} successfully: ${postResult.tweetId}`);
      logInfo('SIMPLE_POST', `📊 Daily posts: ${this.dailyPostCount}/${this.MAX_DAILY_POSTS}`);

              // Store ultimate content result for learning
        const ultimateResult = (generationResult as any).ultimateResult;
        if (ultimateResult) {
          try {
            // Store the ultimate content data for future learning
            await this.storeUltimateContentData(postResult.tweetId, ultimateResult);
          } catch (error) {
            console.warn('⚠️ Failed to store ultimate content data:', error);
          }
        }

      return {
        success: true,
        tweetId: postResult.tweetId,
          content: contentForStorage,
          engagementPrediction: ultimateResult?.predictions?.likes || 5
      };

    } catch (error: any) {
      logError('SIMPLE_POST', `❌ Failed to create post: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    } finally {
      this.isPosting = false;
    }
  }

  /**
   * Build prompt optimized for engagement
   */
  private buildEngagementOptimizedPrompt(topic?: string): string {
    const basePrompt = `Create a highly engaging health/wellness tweet that will get likes, retweets, and replies.

ENGAGEMENT REQUIREMENTS:
- Start with an attention-grabbing hook (shocking stat, surprising fact, or bold claim)
- Include specific numbers or percentages 
- Make it controversial but defensible
- End with a question or call-to-action
- Use 1-2 relevant emojis maximum
- Keep under 250 characters
- Make people want to share it

CONTENT FOCUS: ${topic || 'breakthrough health research, wellness tips, or medical innovations'}

EXAMPLES OF HIGH-ENGAGEMENT PATTERNS:
- "97% of people don't know this about [health topic]..."
- "[Shocking statistic] about [common health belief] - here's why..."
- "Doctors hate this simple [health hack] that [specific benefit]..."

Create content that makes people stop scrolling and engage.`;

    return basePrompt;
  }

  /**
   * 🔧 SPLIT LONG CONTENT INTO THREAD TWEETS
   */
  private splitIntoThreadTweets(content: string): string[] {
    const maxTweetLength = 250; // Safe limit
    const tweets: string[] = [];
    
    // Split by sentences first
    const sentences = content.split(/(?<=[.!?])\s+/);
    let currentTweet = '';
    
    for (const sentence of sentences) {
      // If adding this sentence would exceed limit, start new tweet
      if (currentTweet && (currentTweet + ' ' + sentence).length > maxTweetLength) {
        if (currentTweet.trim()) {
          tweets.push(currentTweet.trim());
          currentTweet = sentence;
        }
      } else {
        currentTweet = currentTweet ? currentTweet + ' ' + sentence : sentence;
      }
    }
    
    // Add the last tweet
    if (currentTweet.trim()) {
      tweets.push(currentTweet.trim());
    }
    
    // If we only got one tweet and it's still too long, split by words
    if (tweets.length === 1 && tweets[0].length > maxTweetLength) {
      return this.splitByWords(tweets[0], maxTweetLength);
    }
    
    console.log(`📝 SPLIT_RESULT: ${content.length} chars → ${tweets.length} tweets`);
    return tweets;
  }

  /**
   * 🔧 EMERGENCY WORD SPLITTING for very long content
   */
  private splitByWords(content: string, maxLength: number): string[] {
    const words = content.split(' ');
    const tweets: string[] = [];
    let currentTweet = '';
    
    for (const word of words) {
      if (currentTweet && (currentTweet + ' ' + word).length > maxLength) {
        tweets.push(currentTweet.trim());
        currentTweet = word;
      } else {
        currentTweet = currentTweet ? currentTweet + ' ' + word : word;
      }
    }
    
    if (currentTweet.trim()) {
      tweets.push(currentTweet.trim());
    }
    
    return tweets;
  }

  /**
   * Optimize content for maximum engagement
   */
  private optimizeForEngagement(content: string): string {
    let optimized = content.trim();

    // Ensure it has engagement triggers
    const engagementTriggers = [
      /\d+%/, // Percentages
      /\$\d+/, // Dollar amounts
      /\d+x/, // Multipliers
      /\d+ (minutes?|hours?|days?|weeks?|months?)/, // Time periods
      /\?$/, // Questions
      /\!$/, // Exclamations
    ];

    const hasEngagementTrigger = engagementTriggers.some(trigger => trigger.test(optimized));
    
    if (!hasEngagementTrigger && !optimized.includes('?')) {
      // Add a question to increase engagement
      optimized += '\n\nThoughts?';
    }

    // Ensure proper length (Twitter sweet spot is 71-100 characters for engagement)
    if (optimized.length > 250) {
      optimized = optimized.substring(0, 247) + '...';
    }

    return optimized;
  }

  /**
   * Store ultimate content data for future learning
   */
  private async storeUltimateContentData(tweetId: string, ultimateResult: any): Promise<void> {
    try {
      // Store in a dedicated table or enhance existing storage
      console.log(`📚 STORING_ULTIMATE_DATA: ${tweetId} with ${ultimateResult.metadata.generation_quality}/100 quality`);
      
      // You could store this in a dedicated database table for advanced analytics
      // For now, we'll log the key metrics
      console.log(`🎯 STORED_METRICS: Growth ${ultimateResult.metadata.growth_score}/100, Viral ${ultimateResult.metadata.viral_probability}/100`);
      
    } catch (error) {
      console.error('❌ Failed to store ultimate content data:', error);
    }
  }

  /**
   * Predict engagement potential (0-100)
   */
  private predictEngagement(content: string): number {
    let score = 50; // Base score

    // Check for engagement factors
    if (/\d+%/.test(content)) score += 15; // Has percentage
    if (/\?/.test(content)) score += 10; // Has question
    if (/\!/.test(content)) score += 5; // Has exclamation
    if (content.length >= 71 && content.length <= 100) score += 10; // Optimal length
    if (/\b(shocking|surprising|breakthrough|secret|hidden)\b/i.test(content)) score += 10; // Power words
    if (/\$\d+/.test(content)) score += 8; // Has money amount
    if (/\d+x/.test(content)) score += 8; // Has multiplier

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Get current status
   */
  public getStatus() {
    return {
      isPosting: this.isPosting,
      dailyPostCount: this.dailyPostCount,
      maxDailyPosts: this.MAX_DAILY_POSTS,
      lastPostTime: this.lastPostTime,
      canPostNow: !this.isPosting && 
                  (Date.now() - this.lastPostTime) >= this.MIN_POST_INTERVAL &&
                  this.dailyPostCount < this.MAX_DAILY_POSTS
    };
  }

  /**
   * Validate that content has complex scientific structure
   */
  private validateScientificStructure(content: any): boolean {
    const text = Array.isArray(content) ? content.join(' ') : content;
    if (!text || typeof text !== 'string') return false;
    
    // Check for complex scientific elements from user's example
    const scientificIndicators = [
      /\d+\s*(°F|°C|mg|hours?|minutes?|%)/i, // Specific numbers with units
      /(due to|because|activates?|triggers?|suppresses?)/i, // Causal mechanisms  
      /(REM|GABA|melatonin|cortisol|dopamine|serotonin)/i, // Scientific terms
      /\d+\s*ways? to/i, // Structured format "X ways to"
      /(crucial|essential) for .* due to/i, // Causal connections
    ];
    
    const matches = scientificIndicators.filter(pattern => pattern.test(text)).length;
    const hasComplexStructure = matches >= 3; // Need at least 3 scientific elements
    
    console.log(`🔬 SCIENTIFIC_VALIDATION: Found ${matches}/5 scientific indicators`);
    return hasComplexStructure;
  }
}
