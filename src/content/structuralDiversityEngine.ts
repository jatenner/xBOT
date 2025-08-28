/**
 * 🎨 STRUCTURAL DIVERSITY ENGINE - DATABASE POWERED
 * 
 * Analyzes ENTIRE database history for maximum intelligence
 * - Connects to Supabase learning_posts and tweets tables
 * - Analyzes ALL historical posts for comprehensive pattern detection
 * - Advanced statistical analysis across complete dataset
 * - Sophisticated pattern frequency tracking across all time
 * - Database-driven diversity scoring and optimization
 * - Caches insights for performance with full dataset analysis
 */

interface ContentStructure {
  hook_type: 'question' | 'statement' | 'controversy' | 'number' | 'story' | 'myth_bust' | 'comparison';
  sentence_pattern: 'short_punchy' | 'compound' | 'list_format' | 'conversational' | 'declarative';
  engagement_driver: 'curiosity' | 'shock' | 'practical' | 'contrarian' | 'personal' | 'scientific';
  content_format: 'fact' | 'tip' | 'story' | 'study' | 'debate' | 'how_to' | 'myth_debunk';
  tone: 'authoritative' | 'friendly' | 'provocative' | 'educational' | 'conversational';
}

interface StructuralAnalysis {
  total_posts_analyzed: number;
  all_time_structures: ContentStructure[];
  recent_structures: ContentStructure[]; // For fallback compatibility
  overused_patterns: string[];
  underused_patterns: string[];
  needed_variety: ContentStructure;
  diversity_score: number;
  engagement_by_structure: Map<string, number>;
  temporal_patterns: {
    recent_30_days: ContentStructure[];
    recent_7_days: ContentStructure[];
    all_time_frequency: Map<string, number>;
  };
}

interface DatabasePost {
  id: string;
  content: string;
  created_at: string;
  viral_potential_score?: number;
  engagement_metrics?: {
    likes: number;
    retweets: number;
    replies: number;
    impressions: number;
  };
}

export class StructuralDiversityEngine {
  private static instance: StructuralDiversityEngine;
  private recentContent: { content: string; structure: ContentStructure; timestamp: number }[] = [];
  private maxHistorySize = 20; // For fallback mode
  private databaseCache: {
    lastUpdated: number;
    allTimeAnalysis: StructuralAnalysis | null;
    engagementPatterns: Map<string, number>;
  } = {
    lastUpdated: 0,
    allTimeAnalysis: null,
    engagementPatterns: new Map()
  };
  private cacheValidityMs = 30 * 60 * 1000; // 30 minutes cache

  private constructor() {}

  public static getInstance(): StructuralDiversityEngine {
    if (!StructuralDiversityEngine.instance) {
      StructuralDiversityEngine.instance = new StructuralDiversityEngine();
    }
    return StructuralDiversityEngine.instance;
  }

  /**
   * 🎯 MAIN FUNCTION: Get optimal content structure using ENTIRE database analysis
   */
  public async getOptimalStructure(topic: string): Promise<{
    structure: ContentStructure;
    prompt_modifications: string[];
    variety_instructions: string;
    diversity_score: number;
    total_posts_analyzed: number;
    engagement_insights: string[];
  }> {
    console.log('🎨 DATABASE_DIVERSITY: Analyzing ENTIRE database for maximum intelligence');

    // Get comprehensive analysis from entire database
    const analysis = await this.analyzeDatabaseStructures();
    
    // Generate optimal structure based on complete historical data
    const optimalStructure = this.generateOptimalStructure(analysis, topic);
    
    // Create advanced prompt modifications using database insights
    const promptMods = this.createAdvancedPromptModifications(optimalStructure, analysis);
    
    // Generate engagement-driven insights from database
    const engagementInsights = this.generateEngagementInsights(analysis);
    
    console.log(`🎨 DATABASE_STRUCTURE: ${optimalStructure.hook_type} + ${optimalStructure.sentence_pattern}`);
    console.log(`📊 ANALYZED: ${analysis.total_posts_analyzed} total posts (diversity: ${analysis.diversity_score.toFixed(2)})`);

    return {
      structure: optimalStructure,
      prompt_modifications: promptMods,
      variety_instructions: this.generateAdvancedVarietyInstructions(optimalStructure, analysis),
      diversity_score: analysis.diversity_score,
      total_posts_analyzed: analysis.total_posts_analyzed,
      engagement_insights: engagementInsights
    };
  }

  /**
   * 🗄️ COMPREHENSIVE DATABASE ANALYSIS - Analyze ENTIRE post history
   */
  private async analyzeDatabaseStructures(): Promise<StructuralAnalysis> {
    // Check cache first for performance
    const now = Date.now();
    if (this.databaseCache.allTimeAnalysis && 
        (now - this.databaseCache.lastUpdated) < this.cacheValidityMs) {
      console.log('📋 CACHE_HIT: Using cached database analysis');
      return this.databaseCache.allTimeAnalysis;
    }

    console.log('🗄️ DATABASE_FETCH: Loading complete post history for analysis');

    try {
      // Fetch ALL posts from database
      const allPosts = await this.fetchAllDatabasePosts();
      console.log(`📊 LOADED: ${allPosts.length} total posts from database`);

      // Analyze structures for all posts
      const allTimeStructures = allPosts.map(post => ({
        structure: this.analyzeContentStructure(post.content),
        engagement: this.calculatePostEngagement(post),
        timestamp: new Date(post.created_at).getTime()
      }));

      // Calculate comprehensive pattern frequencies
      const patternFrequencies = this.calculateAllTimePatternFrequencies(allTimeStructures);
      
      // Calculate engagement by structure type
      const engagementByStructure = this.calculateEngagementByStructure(allTimeStructures);
      
      // Identify temporal patterns (recent vs historical)
      const temporalPatterns = this.analyzeTemporalPatterns(allTimeStructures);
      
      // Identify overused and underused patterns across all time
      const { overused, underused } = this.identifyPatternUsage(patternFrequencies, allTimeStructures.length);
      
      // Calculate comprehensive diversity score
      const diversityScore = this.calculateComprehensiveDiversityScore(patternFrequencies, allTimeStructures.length);
      
      // Generate optimal structure based on full analysis
      const neededVariety = this.identifyOptimalVariety(patternFrequencies, engagementByStructure, temporalPatterns);

      const analysis: StructuralAnalysis = {
        total_posts_analyzed: allPosts.length,
        all_time_structures: allTimeStructures.map(item => item.structure),
        recent_structures: allTimeStructures.slice(-10).map(item => item.structure), // For compatibility
        overused_patterns: overused,
        underused_patterns: underused,
        needed_variety: neededVariety,
        diversity_score: diversityScore,
        engagement_by_structure: engagementByStructure,
        temporal_patterns: temporalPatterns
      };

      // Cache the results
      this.databaseCache = {
        lastUpdated: now,
        allTimeAnalysis: analysis,
        engagementPatterns: engagementByStructure
      };

      console.log(`✅ DATABASE_ANALYSIS: Processed ${allPosts.length} posts, diversity: ${diversityScore.toFixed(3)}`);
      return analysis;

    } catch (error) {
      console.error('❌ DATABASE_ANALYSIS_FAILED:', error);
      // Fallback to local analysis if database fails
      return this.analyzeRecentStructures();
    }
  }

  /**
   * 📊 FALLBACK: Analyze recent content for structural patterns (backup method)
   */
  private analyzeRecentStructures(): StructuralAnalysis {
    const recentStructures = this.recentContent.slice(-10).map(item => item.structure);
    
    // Count pattern frequencies
    const patternCounts = {
      hook_types: new Map<string, number>(),
      sentence_patterns: new Map<string, number>(),
      engagement_drivers: new Map<string, number>(),
      content_formats: new Map<string, number>(),
      tones: new Map<string, number>()
    };

    recentStructures.forEach(structure => {
      this.incrementCount(patternCounts.hook_types, structure.hook_type);
      this.incrementCount(patternCounts.sentence_patterns, structure.sentence_pattern);
      this.incrementCount(patternCounts.engagement_drivers, structure.engagement_driver);
      this.incrementCount(patternCounts.content_formats, structure.content_format);
      this.incrementCount(patternCounts.tones, structure.tone);
    });

    // Identify overused patterns (used >30% of the time)
    const overusedPatterns: string[] = [];
    const threshold = Math.max(2, Math.floor(recentStructures.length * 0.3));

    Object.values(patternCounts).forEach(countMap => {
      countMap.forEach((count, pattern) => {
        if (count >= threshold) {
          overusedPatterns.push(pattern);
        }
      });
    });

    // Calculate diversity score (0-1, higher = more diverse)
    const diversityScore = this.calculateDiversityScore(patternCounts);

    // Determine needed variety
    const neededVariety = this.identifyNeededVariety(patternCounts);

    return {
      total_posts_analyzed: recentStructures.length,
      all_time_structures: recentStructures,
      recent_structures: recentStructures,
      overused_patterns: overusedPatterns,
      underused_patterns: [], // No underused patterns in limited fallback
      needed_variety: neededVariety,
      diversity_score: diversityScore,
      engagement_by_structure: new Map(),
      temporal_patterns: {
        recent_30_days: recentStructures,
        recent_7_days: recentStructures,
        all_time_frequency: new Map()
      }
    };
  }

  /**
   * 🎲 Generate optimal structure based on what's been underused
   */
  private generateOptimalStructure(analysis: StructuralAnalysis, topic: string): ContentStructure {
    // Start with needed variety, but adjust for topic appropriateness
    let structure = { ...analysis.needed_variety };

    // Topic-specific adjustments
    if (topic.toLowerCase().includes('study') || topic.toLowerCase().includes('research')) {
      structure.content_format = 'study';
      structure.engagement_driver = 'scientific';
    } else if (topic.toLowerCase().includes('myth') || topic.toLowerCase().includes('wrong')) {
      structure.content_format = 'myth_debunk';
      structure.engagement_driver = 'contrarian';
      structure.hook_type = 'controversy';
    } else if (topic.toLowerCase().includes('how') || topic.toLowerCase().includes('tip')) {
      structure.content_format = 'how_to';
      structure.engagement_driver = 'practical';
    }

    // Ensure we avoid overused patterns
    analysis.overused_patterns.forEach(overused => {
      if (Object.values(structure).includes(overused as any)) {
        // Find alternative for this overused pattern
        structure = this.findAlternativePattern(structure, overused);
      }
    });

    return structure;
  }

  /**
   * 📝 ADVANCED: Create database-driven prompt modifications
   */
  private createAdvancedPromptModifications(structure: ContentStructure, analysis: StructuralAnalysis): string[] {
    const modifications: string[] = [];

    // Hook type instructions with engagement data
    const engagementScore = analysis.engagement_by_structure.get(`hook:${structure.hook_type}`) || 0;
    modifications.push(`HOOK STYLE (${engagementScore.toFixed(1)} avg engagement): ${this.getAdvancedHookInstruction(structure.hook_type, analysis)}`);

    // Sentence pattern with database insights
    const patternEngagement = analysis.engagement_by_structure.get(`pattern:${structure.sentence_pattern}`) || 0;
    modifications.push(`SENTENCE PATTERN (${patternEngagement.toFixed(1)} performance): ${this.getAdvancedPatternInstruction(structure.sentence_pattern, analysis)}`);

    // Engagement driver with historical performance
    const driverEngagement = analysis.engagement_by_structure.get(`driver:${structure.engagement_driver}`) || 0;
    modifications.push(`ENGAGEMENT DRIVER (${driverEngagement.toFixed(1)} viral score): ${this.getAdvancedDriverInstruction(structure.engagement_driver, analysis)}`);

    // Add comprehensive avoidance patterns from database
    if (analysis.overused_patterns.length > 0) {
      modifications.push(`AVOID OVERUSED PATTERNS (from ${analysis.total_posts_analyzed} posts): ${analysis.overused_patterns.slice(0, 5).join(', ')}`);
    }

    // Add underused pattern opportunities
    if (analysis.underused_patterns.length > 0) {
      modifications.push(`OPPORTUNITY PATTERNS (underused): Consider incorporating ${analysis.underused_patterns.slice(0, 3).join(', ')}`);
    }

    return modifications;
  }

  /**
   * 📝 FALLBACK: Create prompt modifications to enforce structure (backup)
   */
  private createPromptModifications(structure: ContentStructure, analysis: StructuralAnalysis): string[] {
    const modifications: string[] = [];

    // Hook type instructions
    const hookInstructions = {
      question: "Start with a compelling question that makes people think",
      statement: "Begin with a bold, declarative statement that challenges assumptions",
      controversy: "Open with a controversial but defensible opinion",
      number: "Lead with a specific, surprising statistic or number",
      story: "Start with a brief personal anecdote or case study",
      myth_bust: "Begin by calling out a common misconception",
      comparison: "Start with a before/after or this-vs-that comparison"
    };

    // Sentence pattern instructions
    const patternInstructions = {
      short_punchy: "Use short, punchy sentences. Maximum 15 words per sentence.",
      compound: "Use compound sentences with connecting words like 'but', 'and', 'because'",
      list_format: "Structure as numbered points or bullet-like format",
      conversational: "Write like you're talking to a friend - use contractions and casual language",
      declarative: "Use strong, definitive statements without hedging"
    };

    // Engagement driver instructions
    const engagementInstructions = {
      curiosity: "Create curiosity gaps - hint at valuable information without giving it all away",
      shock: "Include surprising or counterintuitive information that challenges common beliefs",
      practical: "Focus on immediately actionable advice people can use today",
      contrarian: "Take a stance that goes against popular opinion (but support it with evidence)",
      personal: "Include relatable personal experiences or scenarios",
      scientific: "Reference studies, mechanisms, or scientific explanations"
    };

    modifications.push(`HOOK STYLE: ${hookInstructions[structure.hook_type]}`);
    modifications.push(`SENTENCE PATTERN: ${patternInstructions[structure.sentence_pattern]}`);
    modifications.push(`ENGAGEMENT DRIVER: ${engagementInstructions[structure.engagement_driver]}`);

    // Add variety enforcement
    if (analysis.overused_patterns.length > 0) {
      modifications.push(`AVOID OVERUSED PATTERNS: Never use these recently overused styles: ${analysis.overused_patterns.join(', ')}`);
    }

    return modifications;
  }

  /**
   * 🎯 Generate engagement insights from database analysis
   */
  private generateEngagementInsights(analysis: StructuralAnalysis): string[] {
    const insights: string[] = [];

    // Top performing structures
    const sortedEngagement = Array.from(analysis.engagement_by_structure.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    insights.push(`Top performers: ${sortedEngagement.map(([key, score]) => `${key} (${score.toFixed(1)})`).join(', ')}`);

    // Temporal insights
    const recentVsTotal = analysis.temporal_patterns.recent_7_days.length / Math.max(1, analysis.total_posts_analyzed);
    if (recentVsTotal > 0.3) {
      insights.push('High recent activity - focus on variety to prevent fatigue');
    } else {
      insights.push('Lower recent activity - opportunity for consistent posting');
    }

    // Pattern opportunities
    if (analysis.underused_patterns.length > 0) {
      insights.push(`Underused opportunities: ${analysis.underused_patterns.slice(0, 2).join(', ')}`);
    }

    return insights;
  }

  /**
   * 📋 ADVANCED: Generate comprehensive variety instructions with database insights
   */
  private generateAdvancedVarietyInstructions(structure: ContentStructure, analysis: StructuralAnalysis): string {
    const hookEngagement = analysis.engagement_by_structure.get(`hook:${structure.hook_type}`) || 0;
    const patternEngagement = analysis.engagement_by_structure.get(`pattern:${structure.sentence_pattern}`) || 0;
    
    return `
DATABASE-DRIVEN STRUCTURAL VARIETY (${analysis.total_posts_analyzed} posts analyzed):

TARGET STRUCTURE (engagement-optimized):
- Hook Type: ${structure.hook_type} (${hookEngagement.toFixed(1)} avg engagement)
- Sentence Pattern: ${structure.sentence_pattern} (${patternEngagement.toFixed(1)} performance)
- Engagement Driver: ${structure.engagement_driver}
- Content Format: ${structure.content_format}
- Tone: ${structure.tone}

HISTORICAL INSIGHTS:
- Diversity Score: ${analysis.diversity_score.toFixed(3)}/1.0 across all posts
- Overused Patterns: ${analysis.overused_patterns.length} identified
- Recent Activity: ${analysis.temporal_patterns.recent_7_days.length} posts in last 7 days
- Optimal Structures: Based on engagement data from ${analysis.total_posts_analyzed} posts

VARIETY ENFORCEMENT:
${analysis.overused_patterns.length > 0 ? 
  `- STRICT AVOIDANCE: ${analysis.overused_patterns.slice(0, 3).join(', ')} (overused)` : 
  '- No major overuse detected - maintain current variety'
}
${analysis.underused_patterns.length > 0 ? 
  `- OPPORTUNITIES: ${analysis.underused_patterns.slice(0, 2).join(', ')} (underused)` : 
  '- Pattern distribution is balanced'
}

PERFORMANCE TARGETS:
- Structure must be different from last ${Math.min(10, analysis.temporal_patterns.recent_7_days.length)} posts
- Target engagement: >${(Array.from(analysis.engagement_by_structure.values()).reduce((a, b) => a + b, 0) / analysis.engagement_by_structure.size).toFixed(1)}
- Viral potential: Based on ${analysis.total_posts_analyzed} post analysis

NEVER USE HASHTAGS - Hashtags are banned in all content.
    `.trim();
  }

  /**
   * 🎨 Advanced instruction generators
   */
  private getAdvancedHookInstruction(hookType: string, analysis: StructuralAnalysis): string {
    const engagement = analysis.engagement_by_structure.get(`hook:${hookType}`) || 0;
    const baseInstruction = this.getHookExample(hookType);
    
    if (engagement > 50) {
      return `${baseInstruction} - HIGH PERFORMER in your history`;
    } else if (engagement < 20) {
      return `${baseInstruction} - UNDERUSED opportunity for differentiation`;
    } else {
      return `${baseInstruction} - Standard performance pattern`;
    }
  }

  private getAdvancedPatternInstruction(pattern: string, analysis: StructuralAnalysis): string {
    const engagement = analysis.engagement_by_structure.get(`pattern:${pattern}`) || 0;
    
    const instructions = {
      short_punchy: "Use short, punchy sentences. Maximum 15 words per sentence.",
      compound: "Use compound sentences with connecting words like 'but', 'and', 'because'",
      list_format: "Structure as numbered points or bullet-like format",
      conversational: "Write like you're talking to a friend - use contractions and casual language",
      declarative: "Use strong, definitive statements without hedging"
    };

    const baseInstruction = instructions[pattern as keyof typeof instructions] || "Standard sentence structure";
    
    if (engagement > 50) {
      return `${baseInstruction} - PROVEN HIGH ENGAGEMENT`;
    } else {
      return `${baseInstruction} - FRESH OPPORTUNITY`;
    }
  }

  private getAdvancedDriverInstruction(driver: string, analysis: StructuralAnalysis): string {
    const engagement = analysis.engagement_by_structure.get(`driver:${driver}`) || 0;
    
    const instructions = {
      curiosity: "Create curiosity gaps - hint at valuable information without giving it all away",
      shock: "Include surprising or counterintuitive information that challenges common beliefs",
      practical: "Focus on immediately actionable advice people can use today",
      contrarian: "Take a stance that goes against popular opinion (but support it with evidence)",
      personal: "Include relatable personal experiences or scenarios",
      scientific: "Reference studies, mechanisms, or scientific explanations"
    };

    const baseInstruction = instructions[driver as keyof typeof instructions] || "Standard engagement approach";
    
    if (engagement > 50) {
      return `${baseInstruction} - TOP PERFORMER (${engagement.toFixed(1)} avg)`;
    } else {
      return `${baseInstruction} - UNTAPPED POTENTIAL`;
    }
  }

  /**
   * 📋 FALLBACK: Generate comprehensive variety instructions (backup)
   */
  private generateVarietyInstructions(structure: ContentStructure, analysis: StructuralAnalysis): string {
    return `
STRUCTURAL VARIETY REQUIREMENTS:
- Hook Type: ${structure.hook_type} (${this.getHookExample(structure.hook_type)})
- Sentence Pattern: ${structure.sentence_pattern}
- Engagement Driver: ${structure.engagement_driver}
- Content Format: ${structure.content_format}
- Tone: ${structure.tone}

VARIETY ENFORCEMENT:
${analysis.overused_patterns.length > 0 ? 
  `- AVOID these overused patterns: ${analysis.overused_patterns.join(', ')}` : 
  '- No overused patterns detected - maintain current variety'
}
- Diversity Score: ${analysis.diversity_score.toFixed(2)}/1.0 (target: >0.7)
- Structure completely different from last ${this.recentContent.length} posts

NEVER USE HASHTAGS - Hashtags are banned in all content.
    `.trim();
  }

  /**
   * 💾 Store content structure for future analysis
   */
  public storeContentStructure(content: string): void {
    const structure = this.analyzeContentStructure(content);
    
    this.recentContent.push({
      content,
      structure,
      timestamp: Date.now()
    });

    // Keep only recent content
    if (this.recentContent.length > this.maxHistorySize) {
      this.recentContent = this.recentContent.slice(-this.maxHistorySize);
    }

    console.log(`🎨 STRUCTURE_STORED: ${structure.hook_type} + ${structure.sentence_pattern}`);
  }

  /**
   * 🔍 Analyze structure of existing content
   */
  private analyzeContentStructure(content: string): ContentStructure {
    const lowerContent = content.toLowerCase();

    // Detect hook type
    let hook_type: ContentStructure['hook_type'] = 'statement';
    if (content.includes('?')) hook_type = 'question';
    else if (lowerContent.includes('unpopular') || lowerContent.includes('controversial')) hook_type = 'controversy';
    else if (/\d+/.test(content.substring(0, 50))) hook_type = 'number';
    else if (lowerContent.includes('myth') || lowerContent.includes('wrong')) hook_type = 'myth_bust';
    else if (lowerContent.includes('vs') || lowerContent.includes('compared')) hook_type = 'comparison';

    // Detect sentence pattern
    let sentence_pattern: ContentStructure['sentence_pattern'] = 'declarative';
    const sentences = content.split(/[.!?]/).filter(s => s.trim().length > 0);
    const avgLength = sentences.reduce((sum, s) => sum + s.split(' ').length, 0) / sentences.length;
    
    if (avgLength < 8) sentence_pattern = 'short_punchy';
    else if (content.includes(' and ') || content.includes(' but ') || content.includes(' because ')) sentence_pattern = 'compound';
    else if (/\d+\.|\n/.test(content)) sentence_pattern = 'list_format';
    else if (content.includes("'") || content.includes("you'll") || content.includes("don't")) sentence_pattern = 'conversational';

    // Detect engagement driver
    let engagement_driver: ContentStructure['engagement_driver'] = 'practical';
    if (lowerContent.includes('study') || lowerContent.includes('research')) engagement_driver = 'scientific';
    else if (lowerContent.includes('stop') || lowerContent.includes('wrong')) engagement_driver = 'contrarian';
    else if (lowerContent.includes('try') || lowerContent.includes('do this')) engagement_driver = 'practical';
    else if (lowerContent.includes('surprising') || lowerContent.includes('shocking')) engagement_driver = 'shock';
    else if (content.includes('?')) engagement_driver = 'curiosity';

    // Detect content format
    let content_format: ContentStructure['content_format'] = 'fact';
    if (lowerContent.includes('how to') || lowerContent.includes('step')) content_format = 'how_to';
    else if (lowerContent.includes('myth') || lowerContent.includes('belief')) content_format = 'myth_debunk';
    else if (lowerContent.includes('study') || lowerContent.includes('research')) content_format = 'study';
    else if (lowerContent.includes('tip') || lowerContent.includes('try')) content_format = 'tip';

    // Detect tone
    let tone: ContentStructure['tone'] = 'friendly';
    if (lowerContent.includes('unpopular') || lowerContent.includes('wrong')) tone = 'provocative';
    else if (content.includes("you'll") || content.includes("don't")) tone = 'conversational';
    else if (lowerContent.includes('study') || lowerContent.includes('research')) tone = 'authoritative';
    else if (lowerContent.includes('try') || lowerContent.includes('simple')) tone = 'friendly';

    return {
      hook_type,
      sentence_pattern,
      engagement_driver,
      content_format,
      tone
    };
  }

  /**
   * 🔢 Helper methods
   */
  private incrementCount(map: Map<string, number>, key: string): void {
    map.set(key, (map.get(key) || 0) + 1);
  }

  private calculateDiversityScore(patternCounts: any): number {
    let totalPatterns = 0;
    let uniquePatterns = 0;

    Object.values(patternCounts).forEach((countMap: Map<string, number>) => {
      countMap.forEach(count => totalPatterns += count);
      uniquePatterns += countMap.size;
    });

    return uniquePatterns / Math.max(1, totalPatterns);
  }

  private identifyNeededVariety(patternCounts: any): ContentStructure {
    // Find least used patterns
    const leastUsed = {
      hook_type: this.findLeastUsed(patternCounts.hook_types, ['question', 'statement', 'controversy', 'number', 'story', 'myth_bust', 'comparison']),
      sentence_pattern: this.findLeastUsed(patternCounts.sentence_patterns, ['short_punchy', 'compound', 'list_format', 'conversational', 'declarative']),
      engagement_driver: this.findLeastUsed(patternCounts.engagement_drivers, ['curiosity', 'shock', 'practical', 'contrarian', 'personal', 'scientific']),
      content_format: this.findLeastUsed(patternCounts.content_formats, ['fact', 'tip', 'story', 'study', 'debate', 'how_to', 'myth_debunk']),
      tone: this.findLeastUsed(patternCounts.tones, ['authoritative', 'friendly', 'provocative', 'educational', 'conversational'])
    };

    return leastUsed as ContentStructure;
  }

  private findLeastUsed(countMap: Map<string, number>, options: string[]): string {
    return options.reduce((least, option) => {
      const currentCount = countMap.get(option) || 0;
      const leastCount = countMap.get(least) || 0;
      return currentCount < leastCount ? option : least;
    }, options[0]);
  }

  private findAlternativePattern(structure: ContentStructure, overusedPattern: string): ContentStructure {
    const alternatives = {
      question: 'statement',
      statement: 'controversy',
      controversy: 'number',
      short_punchy: 'compound',
      compound: 'conversational',
      curiosity: 'practical',
      practical: 'scientific'
    };

    const newStructure = { ...structure };
    Object.entries(newStructure).forEach(([key, value]) => {
      if (value === overusedPattern && alternatives[overusedPattern as keyof typeof alternatives]) {
        (newStructure as any)[key] = alternatives[overusedPattern as keyof typeof alternatives];
      }
    });

    return newStructure;
  }

  /**
   * 🗄️ DATABASE CONNECTION FUNCTIONS
   */
  private async fetchAllDatabasePosts(): Promise<any[]> {
    try {
      // Import admin client for database access
      const { admin } = await import('../lib/supabaseClients');
      
      const allPosts: any[] = [];
      
      // Fetch from learning_posts table
      try {
        const { data: learningPosts, error: learningError } = await admin
          .from('learning_posts')
          .select('content, created_at, likes_count, retweets_count, replies_count, engagement_score')
          .order('created_at', { ascending: false });
          
        if (learningError) {
          console.warn('⚠️ Learning posts fetch failed:', learningError);
        } else if (learningPosts) {
          allPosts.push(...learningPosts);
          console.log(`📊 DATABASE_LOADED: ${learningPosts.length} unique posts from learning_posts`);
        }
      } catch (error) {
        console.warn('⚠️ Learning posts fetch failed:', error);
      }
      
      // Fetch from tweets table
      try {
        const { data: tweets, error: tweetsError } = await admin
          .from('tweets')
          .select('content, created_at, likes_count, retweets_count, replies_count, engagement_score')
          .order('created_at', { ascending: false });
          
        if (tweetsError) {
          console.warn('⚠️ Tweets fetch failed:', tweetsError);
        } else if (tweets) {
          // Deduplicate by content
          const existingContent = new Set(allPosts.map(p => p.content));
          const newTweets = tweets.filter(t => !existingContent.has(t.content));
          allPosts.push(...newTweets);
          console.log(`📊 DATABASE_LOADED: ${tweets.length} posts from tweets (${newTweets.length} unique)`);
        }
      } catch (error) {
        console.warn('⚠️ Tweets fetch failed:', error);
      }
      
      console.log(`📊 DATABASE_LOADED: ${allPosts.length} unique posts from database`);
      return allPosts;
      
    } catch (error) {
      console.error('❌ DATABASE_FETCH_FAILED:', error);
      return [];
    }
  }

  /**
   * 📈 Calculate engagement score for a post
   */
  private calculatePostEngagement(post: DatabasePost): number {
    if (!post.engagement_metrics) return post.viral_potential_score || 0;
    
    const metrics = post.engagement_metrics;
    const totalEngagement = metrics.likes + (metrics.retweets * 2) + (metrics.replies * 3);
    const engagementRate = metrics.impressions > 0 ? totalEngagement / metrics.impressions : 0;
    
    return Math.min(100, engagementRate * 100 + (post.viral_potential_score || 0));
  }

  /**
   * 📊 Calculate pattern frequencies across all posts
   */
  private calculateAllTimePatternFrequencies(structures: any[]): Map<string, Map<string, number>> {
    const frequencies = new Map([
      ['hook_types', new Map<string, number>()],
      ['sentence_patterns', new Map<string, number>()],
      ['engagement_drivers', new Map<string, number>()],
      ['content_formats', new Map<string, number>()],
      ['tones', new Map<string, number>()]
    ]);

    structures.forEach(item => {
      const structure = item.structure;
      this.incrementCount(frequencies.get('hook_types')!, structure.hook_type);
      this.incrementCount(frequencies.get('sentence_patterns')!, structure.sentence_pattern);
      this.incrementCount(frequencies.get('engagement_drivers')!, structure.engagement_driver);
      this.incrementCount(frequencies.get('content_formats')!, structure.content_format);
      this.incrementCount(frequencies.get('tones')!, structure.tone);
    });

    return frequencies;
  }

  /**
   * 📈 Calculate engagement by structure type
   */
  private calculateEngagementByStructure(structures: any[]): Map<string, number> {
    const engagementByStructure = new Map<string, number>();
    const structureCounts = new Map<string, number>();

    structures.forEach(item => {
      const structure = item.structure;
      const engagement = item.engagement;
      
      // Track all structure combinations
      const structureKeys = [
        `hook:${structure.hook_type}`,
        `pattern:${structure.sentence_pattern}`,
        `driver:${structure.engagement_driver}`,
        `format:${structure.content_format}`,
        `tone:${structure.tone}`
      ];

      structureKeys.forEach(key => {
        const currentTotal = engagementByStructure.get(key) || 0;
        const currentCount = structureCounts.get(key) || 0;
        
        engagementByStructure.set(key, currentTotal + engagement);
        structureCounts.set(key, currentCount + 1);
      });
    });

    // Calculate averages
    const averageEngagement = new Map<string, number>();
    engagementByStructure.forEach((total, key) => {
      const count = structureCounts.get(key) || 1;
      averageEngagement.set(key, total / count);
    });

    return averageEngagement;
  }

  /**
   * ⏱️ Analyze temporal patterns (recent vs historical)
   */
  private analyzeTemporalPatterns(structures: any[]): {
    recent_30_days: ContentStructure[];
    recent_7_days: ContentStructure[];
    all_time_frequency: Map<string, number>;
  } {
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

    const recent30Days = structures
      .filter(item => item.timestamp >= thirtyDaysAgo)
      .map(item => item.structure);

    const recent7Days = structures
      .filter(item => item.timestamp >= sevenDaysAgo)
      .map(item => item.structure);

    const allTimeFrequency = new Map<string, number>();
    structures.forEach(item => {
      const key = `${item.structure.hook_type}-${item.structure.sentence_pattern}`;
      this.incrementCount(allTimeFrequency, key);
    });

    return {
      recent_30_days: recent30Days,
      recent_7_days: recent7Days,
      all_time_frequency: allTimeFrequency
    };
  }

  /**
   * 🎯 Identify pattern usage (overused vs underused)
   */
  private identifyPatternUsage(frequencies: Map<string, Map<string, number>>, totalPosts: number): {
    overused: string[];
    underused: string[];
  } {
    const overused: string[] = [];
    const underused: string[] = [];
    const overuseThreshold = Math.max(3, Math.floor(totalPosts * 0.25)); // 25% threshold
    const underuseThreshold = Math.max(1, Math.floor(totalPosts * 0.05)); // 5% threshold

    frequencies.forEach((categoryMap, category) => {
      categoryMap.forEach((count, pattern) => {
        if (count >= overuseThreshold) {
          overused.push(`${category}:${pattern}`);
        } else if (count <= underuseThreshold) {
          underused.push(`${category}:${pattern}`);
        }
      });
    });

    return { overused, underused };
  }

  /**
   * 📊 Calculate comprehensive diversity score
   */
  private calculateComprehensiveDiversityScore(frequencies: Map<string, Map<string, number>>, totalPosts: number): number {
    let totalVariance = 0;
    let categoryCount = 0;

    frequencies.forEach((categoryMap, category) => {
      const values = Array.from(categoryMap.values());
      if (values.length > 1) {
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const normalizedVariance = variance / (mean * mean); // Coefficient of variation squared
        
        totalVariance += (1 / (1 + normalizedVariance)); // Convert to diversity score (higher variance = lower diversity)
        categoryCount++;
      }
    });

    return categoryCount > 0 ? totalVariance / categoryCount : 0;
  }

  /**
   * 🎯 Identify optimal variety based on complete analysis
   */
  private identifyOptimalVariety(
    frequencies: Map<string, Map<string, number>>, 
    engagementByStructure: Map<string, number>,
    temporalPatterns: any
  ): ContentStructure {
    // Find the combination of underused patterns with highest engagement
    const hookCounts = frequencies.get('hook_types') || new Map();
    const patternCounts = frequencies.get('sentence_patterns') || new Map();
    const driverCounts = frequencies.get('engagement_drivers') || new Map();
    const formatCounts = frequencies.get('content_formats') || new Map();
    const toneCounts = frequencies.get('tones') || new Map();

    // Get least used options with their engagement scores
    const hookOptions = this.getOptimalOptions(hookCounts, engagementByStructure, 'hook', ['question', 'statement', 'controversy', 'number', 'story', 'myth_bust', 'comparison']);
    const patternOptions = this.getOptimalOptions(patternCounts, engagementByStructure, 'pattern', ['short_punchy', 'compound', 'list_format', 'conversational', 'declarative']);
    const driverOptions = this.getOptimalOptions(driverCounts, engagementByStructure, 'driver', ['curiosity', 'shock', 'practical', 'contrarian', 'personal', 'scientific']);
    const formatOptions = this.getOptimalOptions(formatCounts, engagementByStructure, 'format', ['fact', 'tip', 'story', 'study', 'debate', 'how_to', 'myth_debunk']);
    const toneOptions = this.getOptimalOptions(toneCounts, engagementByStructure, 'tone', ['authoritative', 'friendly', 'provocative', 'educational', 'conversational']);

    return {
      hook_type: hookOptions[0] as any,
      sentence_pattern: patternOptions[0] as any,
      engagement_driver: driverOptions[0] as any,
      content_format: formatOptions[0] as any,
      tone: toneOptions[0] as any
    };
  }

  /**
   * 🏆 Get optimal options balancing low usage and high engagement
   */
  private getOptimalOptions(counts: Map<string, number>, engagement: Map<string, number>, prefix: string, options: string[]): string[] {
    return options.sort((a, b) => {
      const countA = counts.get(a) || 0;
      const countB = counts.get(b) || 0;
      const engagementA = engagement.get(`${prefix}:${a}`) || 0;
      const engagementB = engagement.get(`${prefix}:${b}`) || 0;
      
      // Score = (engagement * 2) - (usage_frequency)
      const scoreA = (engagementA * 2) - countA;
      const scoreB = (engagementB * 2) - countB;
      
      return scoreB - scoreA; // Higher score first
    });
  }

  private getHookExample(hookType: string): string {
    const examples = {
      question: '"What if everything you know about X is wrong?"',
      statement: '"Most people get this completely backwards."',
      controversy: '"Unpopular opinion: X is actually harmful."',
      number: '"73% of people who try X see results in 48 hours."',
      story: '"I spent $5000 to learn this one thing:"',
      myth_bust: '"Myth: You need X for Y. Reality: Z works better."',
      comparison: '"Before vs After doing X for 30 days:"'
    };
    return examples[hookType as keyof typeof examples] || 'Bold opening statement';
  }

  /**
   * 📊 Get comprehensive diversity report from entire database
   */
  public async getDiversityReport(): Promise<any> {
    try {
      const analysis = await this.analyzeDatabaseStructures();
      
      return {
        database_analysis: {
          total_posts_analyzed: analysis.total_posts_analyzed,
          diversity_score: analysis.diversity_score,
          overused_patterns: analysis.overused_patterns,
          underused_patterns: analysis.underused_patterns,
          variety_health: analysis.diversity_score > 0.7 ? 'EXCELLENT' : 
                         analysis.diversity_score > 0.5 ? 'GOOD' : 'NEEDS_IMPROVEMENT'
        },
        temporal_insights: {
          recent_7_days: analysis.temporal_patterns.recent_7_days.length,
          recent_30_days: analysis.temporal_patterns.recent_30_days.length,
          activity_trend: analysis.temporal_patterns.recent_7_days.length > analysis.temporal_patterns.recent_30_days.length / 4 ? 'INCREASING' : 'STABLE'
        },
        engagement_insights: {
          top_performing_structures: Array.from(analysis.engagement_by_structure.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([key, score]) => ({ structure: key, avg_engagement: score.toFixed(1) })),
          avg_engagement: (Array.from(analysis.engagement_by_structure.values()).reduce((a, b) => a + b, 0) / analysis.engagement_by_structure.size).toFixed(1)
        },
        recommendations: {
          should_use: analysis.underused_patterns.slice(0, 3),
          should_avoid: analysis.overused_patterns.slice(0, 3),
          next_optimal_structure: analysis.needed_variety
        }
      };
    } catch (error) {
      console.error('❌ Database diversity report failed:', error);
      // Fallback to local analysis
      const analysis = this.analyzeRecentStructures();
      return {
        fallback_analysis: {
          diversity_score: analysis.diversity_score,
          recent_posts: this.recentContent.length,
          overused_patterns: analysis.overused_patterns,
          variety_health: analysis.diversity_score > 0.7 ? 'EXCELLENT' : 
                         analysis.diversity_score > 0.5 ? 'GOOD' : 'NEEDS_IMPROVEMENT'
        },
        note: 'Using fallback analysis - database connection failed'
      };
    }
  }

}
