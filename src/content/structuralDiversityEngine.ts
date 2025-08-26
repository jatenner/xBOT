/**
 * 🎨 STRUCTURAL DIVERSITY ENGINE
 * 
 * Ensures tweet structures vary dramatically to prevent repetition
 * - Tracks recent content patterns and structures
 * - Forces variety in sentence patterns, hooks, and formats
 * - Prevents boring, repetitive posting
 * - Optimizes for engagement through structural variety
 */

interface ContentStructure {
  hook_type: 'question' | 'statement' | 'controversy' | 'number' | 'story' | 'myth_bust' | 'comparison';
  sentence_pattern: 'short_punchy' | 'compound' | 'list_format' | 'conversational' | 'declarative';
  engagement_driver: 'curiosity' | 'shock' | 'practical' | 'contrarian' | 'personal' | 'scientific';
  content_format: 'fact' | 'tip' | 'story' | 'study' | 'debate' | 'how_to' | 'myth_debunk';
  tone: 'authoritative' | 'friendly' | 'provocative' | 'educational' | 'conversational';
}

interface StructuralAnalysis {
  recent_structures: ContentStructure[];
  overused_patterns: string[];
  needed_variety: ContentStructure;
  diversity_score: number;
}

export class StructuralDiversityEngine {
  private static instance: StructuralDiversityEngine;
  private recentContent: { content: string; structure: ContentStructure; timestamp: number }[] = [];
  private maxHistorySize = 20; // Track last 20 posts

  private constructor() {}

  public static getInstance(): StructuralDiversityEngine {
    if (!StructuralDiversityEngine.instance) {
      StructuralDiversityEngine.instance = new StructuralDiversityEngine();
    }
    return StructuralDiversityEngine.instance;
  }

  /**
   * 🎯 MAIN FUNCTION: Get optimal content structure for maximum variety
   */
  public async getOptimalStructure(topic: string): Promise<{
    structure: ContentStructure;
    prompt_modifications: string[];
    variety_instructions: string;
    diversity_score: number;
  }> {
    console.log('🎨 STRUCTURAL_DIVERSITY: Analyzing content patterns for maximum variety');

    // Analyze recent content structures
    const analysis = this.analyzeRecentStructures();
    
    // Generate optimal structure based on what's been underused
    const optimalStructure = this.generateOptimalStructure(analysis, topic);
    
    // Create prompt modifications to enforce this structure
    const promptMods = this.createPromptModifications(optimalStructure, analysis);
    
    console.log(`🎨 STRUCTURE_SELECTED: ${optimalStructure.hook_type} + ${optimalStructure.sentence_pattern} (diversity: ${analysis.diversity_score.toFixed(2)})`);

    return {
      structure: optimalStructure,
      prompt_modifications: promptMods,
      variety_instructions: this.generateVarietyInstructions(optimalStructure, analysis),
      diversity_score: analysis.diversity_score
    };
  }

  /**
   * 📊 Analyze recent content for structural patterns
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
      recent_structures: recentStructures,
      overused_patterns: overusedPatterns,
      needed_variety: neededVariety,
      diversity_score: diversityScore
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
   * 📝 Create prompt modifications to enforce structure
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
   * 📋 Generate comprehensive variety instructions
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
   * 📊 Get diversity report
   */
  public getDiversityReport(): any {
    const analysis = this.analyzeRecentStructures();
    return {
      diversity_score: analysis.diversity_score,
      recent_posts: this.recentContent.length,
      overused_patterns: analysis.overused_patterns,
      variety_health: analysis.diversity_score > 0.7 ? 'EXCELLENT' : 
                     analysis.diversity_score > 0.5 ? 'GOOD' : 'NEEDS_IMPROVEMENT'
    };
  }
}
