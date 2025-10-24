/**
 * 🎨 CONTENT DIVERSITY ENGINE
 * Ensures maximum variety in tweet formats, hooks, styles, and structures
 */

export interface DiversityConfig {
  hooks: string[];
  formats: string[];
  styles: string[];
  lengths: string[];
  tones: string[];
}

export class ContentDiversityEngine {
  private static instance: ContentDiversityEngine;
  private recentHooks: string[] = [];
  private recentFormats: string[] = [];
  private recentStyles: string[] = [];
  private recentTopics: string[] = []; // ✅ NOW TRACKING TOPICS TOO!
  
  // Track last used to prevent repetition
  private readonly MEMORY_WINDOW = 10; // Remember last 10 posts

  public static getInstance(): ContentDiversityEngine {
    if (!ContentDiversityEngine.instance) {
      ContentDiversityEngine.instance = new ContentDiversityEngine();
    }
    return ContentDiversityEngine.instance;
  }

  /**
   * 🎭 Get diverse content configuration
   */
  getDiverseConfig(): DiversityConfig {
    return {
      hooks: [
        // Questions
        "Ever wonder why",
        "What happens when",
        "Why do most people",
        "Here's something wild:",
        "Plot twist:",
        
        // Direct statements
        "Your body does this crazy thing:",
        "Scientists just discovered:",
        "This will blow your mind:",
        "Nobody talks about this:",
        "Real talk:",
        
        // Story/scenario
        "Picture this:",
        "Imagine if",
        "Let me tell you about",
        "There's this thing that happens",
        "You know that feeling when",
        
        // Data/facts
        "New research shows:",
        "The data is clear:",
        "Here's what we know:",
        "Studies reveal:",
        "The numbers don't lie:",
        
        // Contrarian
        "Everyone's wrong about",
        "The opposite is true:",
        "Stop believing that",
        "This myth needs to die:",
        "Actually,",
        
        // Personal/relatable
        "If you're like most people,",
        "We've all been there:",
        "You probably think",
        "Most of us assume",
        "Here's the thing:",
        
        // No hook (direct)
        "", // Sometimes no hook at all
        "Quick reminder:",
        "Pro tip:",
        "Fun fact:",
        "Reality check:"
      ],
      
      formats: [
        "single_fact", // One key point
        "before_after", // Transformation story
        "numbered_list", // 3 quick tips
        "question_answer", // Ask then answer
        "story_based", // Mini narrative
        "data_driven", // Stats and numbers
        "how_to", // Step by step
        "myth_buster", // Debunk common belief
        "comparison", // X vs Y
        "timeline", // What happens over time
        "thread_starter", // First of multiple tweets
        "quote_react", // React to a concept
        "personal_insight", // First-hand observation
        "contrarian_take", // Go against conventional wisdom
        "simple_reminder" // Just a helpful nudge
      ],
      
      styles: [
        "educational", // Teaching something
        "conversational", // Like talking to a friend
        "authoritative", // Expert knowledge
        "curious", // Wondering and exploring
        "motivational", // Inspiring action
        "humorous", // Light and funny
        "serious", // Important health info
        "storytelling", // Narrative approach
        "scientific", // Research-backed
        "practical", // Actionable advice
        "philosophical", // Deeper thinking
        "urgent", // Time-sensitive info
        "reassuring", // Comforting message
        "challenging", // Push boundaries
        "simple" // Easy to understand
      ],
      
      lengths: [
        "ultra_short", // 50-80 chars
        "short", // 80-120 chars  
        "medium", // 120-200 chars
        "long", // 200-280 chars
        "tweet_storm" // Multiple connected tweets
      ],
      
      tones: [
        "friendly", // Warm and approachable
        "professional", // Expert but accessible
        "casual", // Relaxed and informal
        "enthusiastic", // Excited and energetic
        "thoughtful", // Reflective and deep
        "direct", // Straight to the point
        "encouraging", // Supportive and positive
        "matter_of_fact", // Just the facts
        "conversational", // Like chatting
        "inspiring" // Uplifting and motivating
      ]
    };
  }

  /**
   * 🎲 Get non-repetitive selections
   */
  selectDiverseElements(): {
    hook: string;
    format: string;
    style: string;
    length: string;
    tone: string;
  } {
    const config = this.getDiverseConfig();
    
    // Filter out recently used elements
    const availableHooks = config.hooks.filter(h => !this.recentHooks.includes(h));
    const availableFormats = config.formats.filter(f => !this.recentFormats.includes(f));
    const availableStyles = config.styles.filter(s => !this.recentStyles.includes(s));
    
    // Select random from available (or all if we've used everything)
    const hook = this.randomSelect(availableHooks.length > 0 ? availableHooks : config.hooks);
    const format = this.randomSelect(availableFormats.length > 0 ? availableFormats : config.formats);
    const style = this.randomSelect(availableStyles.length > 0 ? availableStyles : config.styles);
    const length = this.randomSelect(config.lengths);
    const tone = this.randomSelect(config.tones);
    
    // Update memory
    this.updateMemory(hook, format, style);
    
    console.log(`🎨 DIVERSITY: Selected hook="${hook}", format="${format}", style="${style}"`);
    
    return { hook, format, style, length, tone };
  }

  /**
   * 🧠 Update memory to prevent repetition
   */
  private updateMemory(hook: string, format: string, style: string): void {
    // Add to recent lists
    this.recentHooks.push(hook);
    this.recentFormats.push(format);
    this.recentStyles.push(style);
    
    // Keep only last N items
    if (this.recentHooks.length > this.MEMORY_WINDOW) {
      this.recentHooks = this.recentHooks.slice(-this.MEMORY_WINDOW);
    }
    if (this.recentFormats.length > this.MEMORY_WINDOW) {
      this.recentFormats = this.recentFormats.slice(-this.MEMORY_WINDOW);
    }
    if (this.recentStyles.length > this.MEMORY_WINDOW) {
      this.recentStyles = this.recentStyles.slice(-this.MEMORY_WINDOW);
    }
  }
  
  /**
   * ✅ Track topic usage to prevent repeats
   */
  public trackTopic(topic: string): void {
    this.recentTopics.push(topic);
    if (this.recentTopics.length > this.MEMORY_WINDOW) {
      this.recentTopics = this.recentTopics.slice(-this.MEMORY_WINDOW);
    }
    console.log(`[DIVERSITY_ENGINE] 📝 Tracked topic: "${topic}"`);
    console.log(`[DIVERSITY_ENGINE] Recent topics (last ${this.recentTopics.length}): ${this.recentTopics.join(', ')}`);
  }
  
  /**
   * ✅ Get recent topics to avoid
   */
  public getRecentTopics(): string[] {
    return [...this.recentTopics]; // Return copy
  }

  /**
   * 🎲 Random selection helper
   */
  private randomSelect<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * 📊 Get diversity stats
   */
  getDiversityStats(): {
    recentHooksUsed: number;
    recentFormatsUsed: number;
    recentStylesUsed: number;
    memoryWindow: number;
  } {
    return {
      recentHooksUsed: this.recentHooks.length,
      recentFormatsUsed: this.recentFormats.length,
      recentStylesUsed: this.recentStyles.length,
      memoryWindow: this.MEMORY_WINDOW
    };
  }

  /**
   * 🔄 Reset memory (for testing)
   */
  resetMemory(): void {
    this.recentHooks = [];
    this.recentFormats = [];
    this.recentStyles = [];
    console.log('🔄 DIVERSITY: Memory reset');
  }
}

// Export singleton
export const contentDiversityEngine = ContentDiversityEngine.getInstance();
