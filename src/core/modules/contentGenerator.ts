/**
 * 📝 CONTENT GENERATOR MODULE
 * 
 * Extracted from autonomousPostingEngine.ts to reduce file complexity
 * Handles all content generation logic including threads and singles
 */

import { logInfo, logWarn } from '../../utils/intelligentLogging';

export interface ContentGenerationOptions {
  brandNotes?: string;
  diverseSeeds?: string[];
  recentPosts?: any[];
  aggressiveDecision?: any;
}

export interface ContentGenerationResult {
  content: string | string[];  // string for singles, string[] for threads
  type: 'single' | 'thread';
  tweets?: string[];  // For threads: backup reference to tweet array
  topic?: string;     // For threads: topic information
  metadata?: {
    qualityScore?: number;
    optimized?: boolean;
    threadLength?: number;
  };
}

export class ContentGenerator {
  private static instance: ContentGenerator;

  private constructor() {}

  public static getInstance(): ContentGenerator {
    if (!ContentGenerator.instance) {
      ContentGenerator.instance = new ContentGenerator();
    }
    return ContentGenerator.instance;
  }

  /**
   * 🎯 Main content generation method
   */
  public async generateContent(options: ContentGenerationOptions = {}): Promise<ContentGenerationResult> {
    try {
      console.log('🎨 CONTENT_GENERATOR: Starting intelligent content generation');
      
      // Import social content operator
      const { getSocialContentOperator } = await import('../../ai/socialContentOperator');
      const operator = getSocialContentOperator();
      
      // Prepare generation parameters
      const brandNotes = options.brandNotes || "";
      const diverseSeeds = options.diverseSeeds || this.getRotatingTopicSeeds();
      const recentPosts = options.recentPosts || [];
      
      // Generate diverse content pack
      console.log('📊 Generating diverse content pack with learning integration');
      const contentPack = await operator.generateContentPack(brandNotes, diverseSeeds, recentPosts);
      
      // Intelligent format decision
      const decision = await this.makeFormatDecision(contentPack, options.aggressiveDecision);
      
      if (decision.type === 'thread') {
        return await this.generateThreadContent(contentPack, decision);
      } else {
        return await this.generateSingleContent(contentPack, decision);
      }
      
    } catch (error: any) {
      console.error('❌ Content generation failed:', error.message);
      return this.getEmergencyContent();
    }
  }

  /**
   * 🤔 Intelligent format decision logic
   */
  private async makeFormatDecision(contentPack: any, aggressiveDecision?: any): Promise<{
    type: 'single' | 'thread';
    reason: string;
    confidence: number;
  }> {
    const formatDecision = Math.random();
    
    // Check if content suggests thread mode
    const needsThreadContent = contentPack.singles?.some((single: string) => 
      single.toLowerCase().includes('deep') ||
      single.toLowerCase().includes('explore') ||
      single.toLowerCase().includes('dive') ||
      single.toLowerCase().includes('thread') ||
      single.toLowerCase().includes('more on this') ||
      single.toLowerCase().includes('here\'s what') ||
      single.length > 200
    );
    
    // IMPROVED THREAD LOGIC: Post threads more frequently (60% chance)
    if ((formatDecision < 0.6 || needsThreadContent) && contentPack.threads && contentPack.threads.length > 0) {
      return {
        type: 'thread',
        reason: needsThreadContent ? 'Content suggests deep dive' : 'Random thread selection',
        confidence: needsThreadContent ? 0.9 : 0.6
      };
    }
    
    return {
      type: 'single',
      reason: 'Single tweet format selected',
      confidence: 0.7
    };
  }

  /**
   * 🧵 Generate thread content
   */
  private async generateThreadContent(contentPack: any, decision: any): Promise<ContentGenerationResult> {
    console.log('🧵 THREAD_MODE: Generating thread content');
    
    const selectedThread = contentPack.threads[Math.floor(Math.random() * contentPack.threads.length)];
    console.log(`🧵 Selected thread on "${selectedThread.topic}" (${selectedThread.tweets.length} tweets)`);
    
    if (decision.reason.includes('deep dive')) {
      console.log('🧵 THREAD_FORCED: Single content mentioned deep content - posting thread instead');
    }
    
    // Return thread data for PostingManager to handle
    console.log(`🧵 THREAD_PREPARED: ${selectedThread.tweets.length} tweets ready for posting`);
    
    return {
      content: selectedThread.tweets,  // Array of tweets for thread
      tweets: selectedThread.tweets,   // Backup reference
      topic: selectedThread.topic,     // Topic for thread
      type: 'thread',
      metadata: {
        qualityScore: 85,
        optimized: false,
        threadLength: selectedThread.tweets.length
      }
    };
  }

  /**
   * 📝 Generate single content
   */
  private async generateSingleContent(contentPack: any, decision: any): Promise<ContentGenerationResult> {
    console.log('📝 SINGLE_MODE: Generating single tweet content');
    
    if (!contentPack.singles || contentPack.singles.length === 0) {
      return this.getEmergencyContent();
    }
    
    const randomIndex = Math.floor(Math.random() * contentPack.singles.length);
    let selectedContent = contentPack.singles[randomIndex];
    
    console.log(`🎯 Generated diverse content (quality: ${contentPack.metadata.qualityScores?.[randomIndex] || 'unknown'})`);
    console.log(`📊 Format mix: ${contentPack.metadata.formatMix?.join(', ')}`);
    
    // CRITICAL FIX: Remove thread emojis from single tweets
    selectedContent = this.cleanThreadEmojis(selectedContent);
    
    // Apply aggressive learning optimization
    const optimizedContent = await this.applyAggressiveLearning(selectedContent);
    
    return {
      content: optimizedContent.content,
      type: 'single',
      metadata: {
        qualityScore: contentPack.metadata.qualityScores?.[randomIndex] || 75,
        optimized: optimizedContent.optimized
      }
    };
  }

  /**
   * 🧠 Apply aggressive learning optimization
   */
  private async applyAggressiveLearning(content: string): Promise<{
    content: string;
    optimized: boolean;
  }> {
    try {
      const { AggressiveLearningEngine } = await import('../../intelligence/aggressiveLearningEngine');
      const learningEngine = AggressiveLearningEngine.getInstance();
      
      console.log('🧠 APPLYING_AGGRESSIVE_LEARNING: Optimizing content for maximum engagement');
      
      const optimization = await learningEngine.optimizeContentForMaxEngagement(content);
      
      if (optimization.predicted_engagement_boost > 0.1) {
        console.log(`🚀 CONTENT_OPTIMIZED: ${optimization.improvements_applied.join(', ')} (+${(optimization.predicted_engagement_boost * 100).toFixed(0)}% predicted boost)`);
        
        // Clean optimized content too
        const cleanOptimized = this.cleanThreadEmojis(optimization.optimized_content);
        return { content: cleanOptimized, optimized: true };
      } else {
        console.log('📝 CONTENT_UNCHANGED: Original content already optimal');
        return { content, optimized: false };
      }
    } catch (learningError) {
      console.warn('⚠️ Learning optimization failed, using original content:', learningError);
      return { content, optimized: false };
    }
  }

  /**
   * 🧹 Clean thread emojis from single tweets
   */
  private cleanThreadEmojis(content: string): string {
    const cleaned = content.replace(/🧵\s*/g, '').trim();
    console.log('🧹 SINGLE_CLEANUP: Removed thread indicators for single posting');
    return cleaned;
  }

  /**
   * 🧵 Post full thread using enhanced composer
   */
  private async postFullThread(tweets: string[], topic: string): Promise<string> {
    try {
      console.log(`🧵 POSTING_ORGANIZED_THREAD: ${tweets.length} tweets on "${topic}"`);
      
      const { EnhancedThreadComposer } = await import('../../posting/enhancedThreadComposer');
      const composer = EnhancedThreadComposer.getInstance();
      
      const result = await composer.postOrganizedThread(tweets, topic);
      
      if (result.success && result.rootTweetId) {
        console.log(`✅ THREAD_POSTED: Root tweet ${result.rootTweetId} with ${result.replyIds?.length || 0} replies`);
        return result.rootTweetId;
      } else {
        throw new Error(`Thread posting failed: ${result.error}`);
      }
      
    } catch (error: any) {
      console.error('❌ Thread posting failed:', error.message);
      throw error;
    }
  }

  /**
   * 🔄 Get rotating topic seeds for diversity
   */
  private getRotatingTopicSeeds(): string[] {
    const allSeeds = [
      // Health & Nutrition
      'metabolic health optimization', 'nutrient timing strategies', 'gut microbiome research',
      'inflammation reduction techniques', 'sleep quality improvement', 'stress management protocols',
      
      // Fitness & Performance  
      'strength training principles', 'cardiovascular health', 'recovery optimization',
      'movement quality', 'athletic performance', 'exercise physiology',
      
      // Mental Health & Wellness
      'cognitive enhancement', 'mental resilience', 'productivity optimization',
      'mindfulness practices', 'emotional regulation', 'habit formation',
      
      // Science & Research
      'latest health research', 'evidence-based practices', 'clinical studies',
      'health technology', 'preventive medicine', 'longevity research'
    ];
    
    // Rotate based on hour for consistency
    const currentHour = new Date().getHours();
    const seedsPerGroup = 6;
    const groupIndex = Math.floor(currentHour / 6) % Math.floor(allSeeds.length / seedsPerGroup);
    
    return allSeeds.slice(groupIndex * seedsPerGroup, (groupIndex + 1) * seedsPerGroup);
  }

  /**
   * 🚨 Emergency content fallback
   */
  private getEmergencyContent(): ContentGenerationResult {
    const emergencyContent = 'Health optimization starts with understanding your body\'s unique needs. Small, consistent changes compound into significant improvements over time.';
    
    console.log('🚨 Using emergency content generation');
    
    return {
      content: emergencyContent,
      type: 'single',
      metadata: {
        qualityScore: 60,
        optimized: false
      }
    };
  }
}
