/**
 * SOPHISTICATED CONTENT ENGINE - Fix for repetitive content
 * 
 * This prevents duplicate content and creates thread-worthy posts
 */

import { getSupabaseClient } from '../db/index';
import { logInfo, logError } from '../utils/intelligentLogging';

export interface ContentVariation {
  topic: string;
  angle: string;
  format: 'single' | 'thread';
  hooks: string[];
  depth: 'surface' | 'medium' | 'deep';
  uniqueness_score: number;
}

export class SophisticatedContentEngine {
  private static instance: SophisticatedContentEngine;
  private recentTopics: Set<string> = new Set();
  private usedHooks: Set<string> = new Set();
  private contentMemory: Map<string, Date> = new Map();

  private constructor() {}

  public static getInstance(): SophisticatedContentEngine {
    if (!SophisticatedContentEngine.instance) {
      SophisticatedContentEngine.instance = new SophisticatedContentEngine();
    }
    return SophisticatedContentEngine.instance;
  }

  /**
   * Generate unique, sophisticated content variations
   */
  public async generateUniqueContent(baseTopic: string): Promise<ContentVariation> {
    await this.loadContentHistory();
    
    // Check if topic was used recently (within 7 days)
    const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const topicKey = this.normalizeTopicKey(baseTopic);
    
    if (this.contentMemory.has(topicKey)) {
      const lastUsed = this.contentMemory.get(topicKey)!;
      if (lastUsed > recentCutoff) {
        // Find a fresh angle on the same topic
        return this.generateFreshAngle(baseTopic);
      }
    }

    // Generate sophisticated content variation
    const variation = await this.createSophisticatedVariation(baseTopic);
    
    // Store in memory
    this.contentMemory.set(topicKey, new Date());
    await this.saveContentHistory(variation);
    
    return variation;
  }

  /**
   * Create thread-worthy content with depth
   */
  public async generateThreadContent(topic: string): Promise<{
    hookTweet: string;
    threadTweets: string[];
    totalDepth: number;
  }> {
    const variation = await this.generateUniqueContent(topic);
    
    if (variation.depth === 'surface') {
      // Convert to deeper content
      return this.expandToThread(variation);
    }

    const threadStructure = this.getThreadStructure(variation);
    return {
      hookTweet: threadStructure.hook,
      threadTweets: threadStructure.body,
      totalDepth: threadStructure.body.length + 1
    };
  }

  /**
   * Prevent duplicate content by checking similarity
   */
  private async isDuplicate(content: string): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();
      const { data: recentPosts } = await supabase
        .from('post_history')
        .select('original_content')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!recentPosts) return false;

      for (const post of recentPosts) {
        const similarity = this.calculateSimilarity(content, post.original_content as string);
        if (similarity > 0.7) { // 70% similarity threshold
          logInfo('CONTENT_ENGINE', `Duplicate detected: ${similarity * 100}% similar`);
          return true;
        }
      }

      return false;
    } catch (error: any) {
      logError('CONTENT_ENGINE', `Error checking duplicates: ${error.message}`);
      return false;
    }
  }

  /**
   * Generate fresh angle on existing topic
   */
  private generateFreshAngle(baseTopic: string): ContentVariation {
    const angles = [
      'contrarian_take',
      'personal_story',
      'scientific_breakdown',
      'practical_implementation',
      'common_mistakes',
      'advanced_strategies',
      'beginner_guide',
      'myth_busting'
    ];

    const unusedAngles = angles.filter(angle => 
      !this.usedHooks.has(`${baseTopic}_${angle}`)
    );

    const selectedAngle = unusedAngles[Math.floor(Math.random() * unusedAngles.length)] || angles[0];
    
    return {
      topic: baseTopic,
      angle: selectedAngle,
      format: Math.random() > 0.7 ? 'thread' : 'single', // 30% threads
      hooks: this.getUniqueHooks(selectedAngle),
      depth: this.selectDepth(selectedAngle),
      uniqueness_score: 0.9
    };
  }

  /**
   * Create sophisticated content variation
   */
  private async createSophisticatedVariation(topic: string): Promise<ContentVariation> {
    const sophisticatedAngles = [
      'meta_analysis',
      'systems_thinking',
      'first_principles',
      'contrarian_data',
      'behavioral_psychology',
      'evolutionary_perspective',
      'economic_implications',
      'cognitive_biases'
    ];

    const angle = sophisticatedAngles[Math.floor(Math.random() * sophisticatedAngles.length)];
    
    return {
      topic,
      angle,
      format: Math.random() > 0.5 ? 'thread' : 'single', // 50% threads for sophisticated content
      hooks: this.getSophisticatedHooks(angle),
      depth: 'deep',
      uniqueness_score: 0.95
    };
  }

  /**
   * Expand single tweet to thread format
   */
  private expandToThread(variation: ContentVariation): {
    hookTweet: string;
    threadTweets: string[];
    totalDepth: number;
  } {
    const hook = this.createViralHook(variation);
    const threadParts = this.createThreadBody(variation);
    
    return {
      hookTweet: hook,
      threadTweets: threadParts,
      totalDepth: threadParts.length + 1
    };
  }

  /**
   * Create viral hook for thread
   */
  private createViralHook(variation: ContentVariation): string {
    const hookPatterns = [
      `🧵 THREAD: The ${variation.topic} breakthrough nobody talks about`,
      `🚨 UNPOPULAR OPINION: ${variation.topic} advice is mostly wrong`,
      `📊 DATA DEEP-DIVE: What 10,000 people taught me about ${variation.topic}`,
      `🔬 SCIENCE BREAKDOWN: The real reason ${variation.topic} matters`,
      `💡 COUNTERINTUITIVE: Why doing ${variation.topic} backwards works better`
    ];

    return hookPatterns[Math.floor(Math.random() * hookPatterns.length)];
  }

  /**
   * Create thread body with progressive depth
   */
  private createThreadBody(variation: ContentVariation): string[] {
    const threadLength = Math.floor(Math.random() * 3) + 3; // 3-5 tweets
    const parts: string[] = [];

    for (let i = 0; i < threadLength; i++) {
      const tweetNumber = i + 2; // Start from 2 (hook is 1)
      parts.push(`${tweetNumber}/ ${this.generateThreadPart(variation, i, threadLength)}`);
    }

    return parts;
  }

  /**
   * Generate individual thread part
   */
  private generateThreadPart(variation: ContentVariation, index: number, total: number): string {
    const threadTemplates = [
      "Here's what the research actually shows:",
      "The surprising truth:",
      "What most people get wrong:",
      "The practical application:",
      "Why this matters for you:"
    ];

    const template = threadTemplates[Math.min(index, threadTemplates.length - 1)];
    return `${template} [Content about ${variation.topic} from ${variation.angle} perspective]`;
  }

  /**
   * Get unique hooks to avoid repetition
   */
  private getUniqueHooks(angle: string): string[] {
    const hookSets = {
      'contrarian_take': [
        'Unpopular opinion:',
        'Hot take:',
        'Controversial but true:',
        'Nobody wants to hear this:'
      ],
      'scientific_breakdown': [
        'The science shows:',
        'Research reveals:',
        'Data proves:',
        'Studies confirm:'
      ],
      'practical_implementation': [
        'Here\'s how to actually:',
        'Step-by-step guide:',
        'Real-world application:',
        'Practical tips:'
      ]
    };

    return hookSets[angle as keyof typeof hookSets] || ['Interesting insight:'];
  }

  /**
   * Get sophisticated hooks for deep content
   */
  private getSophisticatedHooks(angle: string): string[] {
    const sophisticatedHooks = {
      'meta_analysis': [
        'After analyzing 47 studies:',
        'Meta-analysis reveals:',
        'Systematic review shows:'
      ],
      'systems_thinking': [
        'The feedback loops are fascinating:',
        'System-level perspective:',
        'Emergent patterns suggest:'
      ],
      'first_principles': [
        'Breaking it down fundamentally:',
        'From first principles:',
        'Core mechanisms explain:'
      ]
    };

    return sophisticatedHooks[angle as keyof typeof sophisticatedHooks] || ['Deep dive:'];
  }

  /**
   * Select content depth based on angle
   */
  private selectDepth(angle: string): 'surface' | 'medium' | 'deep' {
    const depthMap = {
      'practical_implementation': 'medium',
      'beginner_guide': 'surface',
      'advanced_strategies': 'deep',
      'scientific_breakdown': 'deep',
      'contrarian_take': 'medium'
    };

    return (depthMap[angle as keyof typeof depthMap] || 'medium') as 'surface' | 'medium' | 'deep';
  }

  /**
   * Calculate content similarity
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * Normalize topic for comparison
   */
  private normalizeTopicKey(topic: string): string {
    return topic.toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .trim();
  }

  /**
   * Load content history from database
   */
  private async loadContentHistory(): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      const { data: posts } = await supabase
        .from('post_history')
        .select('original_content, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (posts) {
        this.contentMemory.clear();
        for (const post of posts) {
          const topicKey = this.extractTopicFromContent(post.original_content as string);
          this.contentMemory.set(topicKey, new Date(post.created_at as string));
        }
      }
    } catch (error: any) {
      logError('CONTENT_ENGINE', `Failed to load content history: ${error.message}`);
    }
  }

  /**
   * Extract topic from existing content
   */
  private extractTopicFromContent(content: string): string {
    // Simple topic extraction - could be enhanced with NLP
    const keywords = content.toLowerCase().match(/\b\w{4,}\b/g) || [];
    return keywords.slice(0, 3).join('_');
  }

  /**
   * Save content variation to database
   */
  private async saveContentHistory(variation: ContentVariation): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      await supabase
        .from('content_variations')
        .insert({
          topic: variation.topic,
          angle: variation.angle,
          format: variation.format,
          depth: variation.depth,
          uniqueness_score: variation.uniqueness_score,
          created_at: new Date().toISOString()
        });
    } catch (error: any) {
      logError('CONTENT_ENGINE', `Failed to save content history: ${error.message}`);
    }
  }

  /**
   * Get thread structure
   */
  private getThreadStructure(variation: ContentVariation): {
    hook: string;
    body: string[];
  } {
    const hook = this.createViralHook(variation);
    const body = this.createThreadBody(variation);
    
    return { hook, body };
  }
}
