/**
 * 📝 CONTENT GENERATOR MODULE
 * 
 * Extracted from autonomousPostingEngine.ts to reduce file complexity
 * Handles all content generation logic including threads and singles
 */

import { logInfo, logWarn } from '../../utils/intelligentLogging';
import LanguageVarietyEngine from '../../content/languageVariety';
import CollinRuggStyleGenerator from '../../ai/collinRuggStyle';

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
    
    // CRITICAL DEBUG: Log thread availability
    console.log(`🔍 THREAD_DECISION_DEBUG: contentPack.threads exists: ${!!contentPack.threads}`);
    console.log(`🔍 THREAD_DECISION_DEBUG: contentPack.threads.length: ${contentPack.threads?.length || 0}`);
    console.log(`🔍 THREAD_DECISION_DEBUG: formatDecision: ${formatDecision.toFixed(3)}`);
    console.log(`🔍 THREAD_DECISION_DEBUG: needsThreadContent: ${needsThreadContent}`);
    
    // ULTRA-AGGRESSIVE THREAD LOGIC: Force threads 80% of the time if available
    // AND generate emergency threads if none exist!
    if (!contentPack.threads || contentPack.threads.length === 0) {
      console.log('🚨 THREAD_EMERGENCY: No threads in contentPack! Generating emergency thread...');
      
      // Create emergency thread if none exist - STAR QUALITY CONTENT
      const emergencyThreads = [
        {
          tweets: [
            'Most people approach health optimization completely wrong.',
            'They chase complex biohacks while ignoring fundamentals.',
            'Reality: 90% of results come from mastering 4 basics.',
            'Sleep consistency (same bedtime ±30 minutes)',
            'Movement patterns (walk + resistance training)',
            'Nutrition timing (protein every 4-6 hours)',
            'Stress recovery (5-10 minutes daily breathing practice)',
            'Master these first. Everything else is just noise.'
          ],
          topic: 'health fundamentals mastery',
          format: 'deep-dive-protocol',
          engagementHooks: ['myth-correction', 'actionable-protocol']
        },
        {
          tweets: [
            'Your morning routine determines your entire day.',
            'Most people start reactive. Checking emails, rushing, cortisol spiking.',
            'High performers start proactive. Here\'s the science-backed morning protocol:',
            '1. 10 minutes sunlight (circadian reset + vitamin D)',
            '2. 2 minutes breathing practice (parasympathetic activation)', 
            '3. 20g protein within 1 hour (stable blood sugar)',
            '4. No phone for first 60 minutes (dopamine regulation)',
            'This simple sequence optimizes hormones, energy, and focus for 12+ hours.'
          ],
          topic: 'morning optimization protocol',
          format: 'step-by-step-guide',
          engagementHooks: ['science-backed', 'immediate-results']
        },
        {
          tweets: [
            'The supplement industry sold you a lie.',
            '"Just take this pill and transform your health."',
            'Reality: 95% of supplements are marketing, not medicine.',
            'Only 4 supplements have compelling research:',
            'Vitamin D3 (if deficient) - immune + bone health',
            'Magnesium glycinate - sleep + muscle recovery', 
            'Omega-3 (EPA/DHA) - brain + heart health',
            'Creatine - energy + cognitive function',
            'Everything else? Expensive urine. Focus on food first.'
          ],
          topic: 'supplement truth',
          format: 'myth-busting-expose',
          engagementHooks: ['industry-secrets', 'money-saving']
        }
      ];
      
      // Randomly select one emergency thread for variety
      contentPack.threads = [emergencyThreads[Math.floor(Math.random() * emergencyThreads.length)]];
      
      console.log('✅ THREAD_EMERGENCY: Created emergency thread with 6 tweets');
    }
    
    // FORCE THREAD MODE: 95% chance for health content (massively increased!)
    if (formatDecision < 0.95 || needsThreadContent) {
      console.log(`✅ THREAD_SELECTED: Reason - ${needsThreadContent ? 'Content suggests deep dive' : 'Ultra-aggressive thread selection (95% chance for health)'}`);
      return {
        type: 'thread',
        reason: needsThreadContent ? 'Content suggests deep dive' : 'Ultra-aggressive thread selection (95% chance for health)',
        confidence: needsThreadContent ? 0.95 : 0.90
      };
    }
    
    console.log('📝 SINGLE_SELECTED: Only 20% chance - rare occurrence');
    return {
      type: 'single',
      reason: 'Single tweet format selected (rare 20% chance)',
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
   * 📝 Generate single content with Colin Rugg style variety
   */
  private async generateSingleContent(contentPack: any, decision: any): Promise<ContentGenerationResult> {
    console.log('📝 SINGLE_MODE: Generating single tweet with language variety');
    
    if (!contentPack.singles || contentPack.singles.length === 0) {
      return this.getEmergencyContent();
    }
    
    // Get language variety engine for diverse formatting
    const varietyEngine = LanguageVarietyEngine.getInstance();
    
    const randomIndex = Math.floor(Math.random() * contentPack.singles.length);
    let selectedContent = contentPack.singles[randomIndex];
    
    // 30% chance to apply Colin Rugg style formatting
    if (Math.random() < 0.3) {
      console.log('🎯 RUGG_STYLE: Applying Colin Rugg formatting techniques');
      selectedContent = this.applyRuggStyleFormatting(selectedContent, varietyEngine);
    }
    
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
      
      const { NativeThreadComposer } = await import('../../posting/nativeThreadComposer');
      const composer = NativeThreadComposer.getInstance();
      
      const result = await composer.postNativeThread(tweets, topic);
      
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
   * 🎯 Apply Colin Rugg style formatting to content
   */
  private applyRuggStyleFormatting(content: string, varietyEngine: LanguageVarietyEngine): string {
    const patterns = [
      'breaking_news',
      'explainer', 
      'data_story',
      'investigative'
    ];
    
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];
    
    switch (pattern) {
      case 'breaking_news':
        const newsOpeners = ["BREAKING:", "NEW STUDY:", "MAJOR DISCOVERY:", "EXCLUSIVE:"];
        const opener = newsOpeners[Math.floor(Math.random() * newsOpeners.length)];
        return `${opener} ${content}`;
        
      case 'explainer':
        const explainers = ["Let me break this down:", "Here's what's really happening:", "The truth:"];
        const explainer = explainers[Math.floor(Math.random() * explainers.length)];
        return `${explainer}\n\n${content}`;
        
      case 'data_story':
        const dataOpeners = ["The numbers are staggering:", "New data reveals:", "Research shows:"];
        const dataOpener = dataOpeners[Math.floor(Math.random() * dataOpeners.length)];
        return `${dataOpener}\n\n${content}`;
        
      case 'investigative':
        const investigations = ["I investigated this. What I found:", "After digging deeper:", "Nobody talks about this:"];
        const investigation = investigations[Math.floor(Math.random() * investigations.length)];
        return `${investigation}\n\n${content}`;
        
      default:
        return content;
    }
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
