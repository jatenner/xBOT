/**
 * 🧵 THREAD STRUCTURE ENGINE
 * 
 * Intelligently detects thread intent and structures content properly:
 * 1. Detects when content should be a thread vs single tweet
 * 2. Properly segments content into coherent, engaging tweets
 * 3. Ensures each tweet is standalone while building narrative
 * 4. Optimizes thread structure for maximum engagement
 */

// Use dynamic imports to avoid build issues
// import { BudgetAwareOpenAI } from '../utils/budgetAwareOpenAI';

export interface ThreadDetection {
  isThread: boolean;
  confidence: number;
  reasoning: string;
  suggestedTweetCount: number;
  segments?: string[];
}

export interface ThreadStructure {
  tweets: string[];
  threadType: 'narrative' | 'list' | 'tutorial' | 'breakdown' | 'argument';
  engagementStrategy: string;
  hookTweet: string;
  callToAction?: string;
  metadata: {
    totalCharacters: number;
    averageTweetLength: number;
    readabilityScore: number;
    engagementPotential: number;
  };
}

export class ThreadStructureEngine {
  private static instance: ThreadStructureEngine;
  private openai: any;

  constructor() {
    this.openai = null;
  }

  /**
   * 🔧 INITIALIZE DEPENDENCIES DYNAMICALLY
   */
  private async initializeDependencies(): Promise<void> {
    if (!this.openai) {
      try {
        const { BudgetAwareOpenAI } = await import('../utils/budgetAwareOpenAI');
        this.openai = new BudgetAwareOpenAI(process.env.OPENAI_API_KEY!);
      } catch (error) {
        console.warn('BudgetAwareOpenAI not available, using basic OpenAI client');
        const { OpenAI } = await import('openai');
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
      }
    }
  }

  static getInstance(): ThreadStructureEngine {
    if (!ThreadStructureEngine.instance) {
      ThreadStructureEngine.instance = new ThreadStructureEngine();
    }
    return ThreadStructureEngine.instance;
  }

  /**
   * 🕵️ INTELLIGENT THREAD DETECTION
   * Determines if content should be a thread and how to structure it
   */
  async detectThreadIntent(content: string): Promise<ThreadDetection> {
    console.log('🧵 Analyzing content for thread structure...');

    // Initialize dependencies
    await this.initializeDependencies();

    // Quick heuristic check first
    const heuristicResult = this.quickThreadDetection(content);
    
    if (!heuristicResult.needsAIAnalysis) {
      return heuristicResult.result;
    }

    // Advanced AI analysis for borderline cases
    const aiResult = await this.aiThreadDetection(content);
    
    // Combine heuristic and AI insights
    return this.combineDetectionResults(heuristicResult.result, aiResult);
  }

  /**
   * ⚡ QUICK HEURISTIC THREAD DETECTION
   */
  private quickThreadDetection(content: string): {
    result: ThreadDetection;
    needsAIAnalysis: boolean;
  } {
    let threadScore = 0;
    let singleScore = 0;
    const reasons: string[] = [];

    // Clear thread indicators
    const hasNumberedStructure = /(\d+[\.\)\/]\s|Tweet\s*\d+|Step\s*\d+)/i.test(content);
    const hasListPatterns = /(\d+\s+(ways|tips|reasons|myths|steps|hacks|strategies|benefits))/i.test(content);
    const hasThreadMarkers = /(thread|here's why|breakdown)/i.test(content);
    const hasMultiplePoints = content.split(/[.!?]+/).filter(s => s.trim().length > 10).length > 4;
    
    if (hasNumberedStructure) {
      threadScore += 8;
      reasons.push('Explicit numbered structure detected');
    }
    
    if (hasListPatterns) {
      threadScore += 7;
      reasons.push('List-based content pattern');
    }
    
    if (hasThreadMarkers) {
      threadScore += 6;
      reasons.push('Thread indicators present');
    }
    
    if (hasMultiplePoints) {
      threadScore += 5;
      reasons.push('Multiple distinct points');
    }

    // Clear single tweet indicators
    const isQuestion = /^[^.!]*\?[^.!]*$/m.test(content);
    const isShort = content.length < 200;
    const isSimpleStatement = content.split(/[.!?]+/).length <= 2;
    
    if (isQuestion && isShort) {
      singleScore += 6;
      reasons.push('Short question format');
    }
    
    if (isSimpleStatement && isShort) {
      singleScore += 7;
      reasons.push('Simple statement format');
    }

    // Length analysis
    if (content.length > 400) {
      threadScore += 4;
      reasons.push('Length suggests thread');
    } else if (content.length < 180) {
      singleScore += 4;
      reasons.push('Length suggests single tweet');
    }

    const isThread = threadScore > singleScore;
    const confidence = Math.abs(threadScore - singleScore) / Math.max(threadScore + singleScore, 1) * 100;
    
    // Need AI analysis if confidence is low or scores are close
    const needsAIAnalysis = confidence < 60 || Math.abs(threadScore - singleScore) < 3;
    
    return {
      result: {
        isThread,
        confidence,
        reasoning: reasons.join(', '),
        suggestedTweetCount: isThread ? Math.min(6, Math.max(2, Math.ceil(content.length / 250))) : 1
      },
      needsAIAnalysis
    };
  }

  /**
   * 🤖 AI-POWERED THREAD DETECTION
   */
  private async aiThreadDetection(content: string): Promise<ThreadDetection> {
    const prompt = `Analyze this content to determine if it should be a Twitter thread or single tweet:

CONTENT:
"${content}"

Consider:
1. Complexity of ideas presented
2. Natural breakpoints in the narrative
3. Engagement potential of different formats
4. Whether ideas build on each other
5. Whether splitting would improve readability

Return ONLY a JSON object:
{
  "isThread": boolean,
  "confidence": 0-100,
  "reasoning": "brief explanation",
  "suggestedTweetCount": 1-6
}`;

    try {
      let response;
      if (this.openai.createChatCompletion) {
        response = await this.openai.createChatCompletion([
          { role: 'user', content: prompt }
        ], {
          model: 'gpt-4o-mini',
          maxTokens: 150,
          temperature: 0.3,
          priority: 'medium',
          operationType: 'thread_detection'
        });
      } else {
        response = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 150,
          temperature: 0.3
        });
      }

      let responseText;
      if (response.response) {
        responseText = response.response;
      } else if (response.choices && response.choices[0]) {
        responseText = response.choices[0].message.content;
      } else {
        responseText = JSON.stringify(response);
      }

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          isThread: Boolean(result.isThread),
          confidence: Math.max(0, Math.min(100, result.confidence || 50)),
          reasoning: result.reasoning || 'AI analysis',
          suggestedTweetCount: Math.max(1, Math.min(6, result.suggestedTweetCount || 2))
        };
      }
      
      throw new Error('Invalid AI response format');
      
    } catch (error) {
      console.warn('⚠️ AI thread detection failed:', error);
      return {
        isThread: content.length > 280,
        confidence: 30,
        reasoning: 'Fallback: length-based detection',
        suggestedTweetCount: Math.ceil(content.length / 250)
      };
    }
  }

  /**
   * 🔄 COMBINE DETECTION RESULTS
   */
  private combineDetectionResults(heuristic: ThreadDetection, ai: ThreadDetection): ThreadDetection {
    // Weight heuristic more heavily for high confidence
    const heuristicWeight = heuristic.confidence > 70 ? 0.7 : 0.4;
    const aiWeight = 1 - heuristicWeight;
    
    const combinedConfidence = (heuristic.confidence * heuristicWeight) + (ai.confidence * aiWeight);
    
    // Choose thread if either method strongly suggests it
    const isThread = (heuristic.isThread && heuristic.confidence > 60) || 
                     (ai.isThread && ai.confidence > 70) ||
                     (heuristic.isThread && ai.isThread);
    
    return {
      isThread,
      confidence: Math.round(combinedConfidence),
      reasoning: `Heuristic: ${heuristic.reasoning}; AI: ${ai.reasoning}`,
      suggestedTweetCount: isThread ? Math.max(heuristic.suggestedTweetCount, ai.suggestedTweetCount) : 1
    };
  }

  /**
   * 🔨 CREATE OPTIMIZED THREAD STRUCTURE
   */
  async createThreadStructure(content: string, tweetCount: number): Promise<ThreadStructure> {
    console.log(`🧵 Creating ${tweetCount}-tweet thread structure...`);

    // Initialize dependencies
    await this.initializeDependencies();

    // Use AI to intelligently segment the content
    const segments = await this.segmentContentIntelligently(content, tweetCount);
    
    // Optimize each segment for engagement
    const optimizedTweets = await this.optimizeThreadTweets(segments);
    
    // Determine thread type and strategy
    const threadType = this.detectThreadType(content);
    const engagementStrategy = this.determineEngagementStrategy(threadType, optimizedTweets);
    
    // Create hook tweet (first tweet optimized for engagement)
    const hookTweet = this.createHookTweet(optimizedTweets[0], threadType);
    
    // Replace first tweet with optimized hook
    optimizedTweets[0] = hookTweet;
    
    // Calculate metadata
    const metadata = this.calculateThreadMetadata(optimizedTweets);
    
    return {
      tweets: optimizedTweets,
      threadType,
      engagementStrategy,
      hookTweet,
      metadata
    };
  }

  /**
   * ✂️ INTELLIGENT CONTENT SEGMENTATION
   */
  private async segmentContentIntelligently(content: string, targetCount: number): Promise<string[]> {
    const prompt = `Break this content into ${targetCount} Twitter-optimized segments. Each segment should:
- Be under 270 characters
- Stand alone as an engaging tweet
- Build naturally toward the next segment
- Maintain the core message

CONTENT TO SEGMENT:
"${content}"

Return ONLY a JSON array of exactly ${targetCount} strings:
["segment 1", "segment 2", ...]`;

    try {
      let response;
      if (this.openai.createChatCompletion) {
        response = await this.openai.createChatCompletion([
          { role: 'user', content: prompt }
        ], {
          model: 'gpt-4o',
          maxTokens: 600,
          temperature: 0.4,
          priority: 'medium',
          operationType: 'thread_segmentation'
        });
      } else {
        response = await this.openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 600,
          temperature: 0.4
        });
      }

      let responseText;
      if (response.response) {
        responseText = response.response;
      } else if (response.choices && response.choices[0]) {
        responseText = response.choices[0].message.content;
      } else {
        responseText = JSON.stringify(response);
      }

      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const segments = JSON.parse(jsonMatch[0]);
        if (Array.isArray(segments) && segments.length === targetCount) {
          return segments.map(s => String(s).trim());
        }
      }
      
      // Fallback to simple character-based splitting
      return this.fallbackSegmentation(content, targetCount);
      
    } catch (error) {
      console.warn('⚠️ AI segmentation failed, using fallback:', error);
      return this.fallbackSegmentation(content, targetCount);
    }
  }

  /**
   * 📏 FALLBACK SEGMENTATION
   */
  private fallbackSegmentation(content: string, targetCount: number): string[] {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const segments: string[] = [];
    const targetLength = Math.ceil(content.length / targetCount);
    
    let currentSegment = '';
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) continue;
      
      const potentialSegment = currentSegment ? `${currentSegment}. ${trimmedSentence}` : trimmedSentence;
      
      if (potentialSegment.length <= 270 && segments.length < targetCount - 1) {
        currentSegment = potentialSegment;
      } else {
        if (currentSegment) {
          segments.push(currentSegment.trim());
        }
        currentSegment = trimmedSentence;
      }
    }
    
    if (currentSegment) {
      segments.push(currentSegment.trim());
    }
    
    // Ensure we have exactly targetCount segments
    while (segments.length < targetCount && segments.length > 0) {
      const lastSegment = segments.pop()!;
      const words = lastSegment.split(' ');
      const mid = Math.ceil(words.length / 2);
      segments.push(words.slice(0, mid).join(' '));
      segments.push(words.slice(mid).join(' '));
    }
    
    return segments.slice(0, targetCount);
  }

  /**
   * ⚡ OPTIMIZE INDIVIDUAL TWEETS
   */
  private async optimizeThreadTweets(segments: string[]): Promise<string[]> {
    const optimizedTweets: string[] = [];
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const isFirst = i === 0;
      const isLast = i === segments.length - 1;
      
      // Add thread numbering for multi-tweet threads
      let optimized = segment;
      if (segments.length > 1) {
        optimized = `${i + 1}/${segments.length} ${segment}`;
      }
      
      // Ensure under character limit
      if (optimized.length > 270) {
        optimized = optimized.substring(0, 267) + '...';
      }
      
      optimizedTweets.push(optimized);
    }
    
    return optimizedTweets;
  }

  /**
   * 🎭 DETECT THREAD TYPE
   */
  private detectThreadType(content: string): ThreadStructure['threadType'] {
    if (content.match(/(\d+\s+(ways|tips|reasons|steps))/i)) {
      return 'list';
    }
    if (content.match(/(how to|step \d+|first|then|finally)/i)) {
      return 'tutorial';
    }
    if (content.match(/(analysis|breakdown|deep dive|examine)/i)) {
      return 'breakdown';
    }
    if (content.match(/(however|but|contrary|argument|debate)/i)) {
      return 'argument';
    }
    
    return 'narrative';
  }

  /**
   * 🎯 DETERMINE ENGAGEMENT STRATEGY
   */
  private determineEngagementStrategy(threadType: ThreadStructure['threadType'], tweets: string[]): string {
    const strategies = {
      'narrative': 'Story-driven engagement with emotional hooks',
      'list': 'Value-packed actionable insights',
      'tutorial': 'Step-by-step practical guidance',
      'breakdown': 'In-depth analytical exploration',
      'argument': 'Thought-provoking debate starter'
    };
    
    return strategies[threadType];
  }

  /**
   * 🪝 CREATE HOOK TWEET
   */
  private createHookTweet(firstTweet: string, threadType: ThreadStructure['threadType']): string {
    // Remove numbering for hook creation
    const cleanTweet = firstTweet.replace(/^\d+\/\d+\s/, '');
    
    // Add thread indicator if not present
    if (!cleanTweet.includes('thread') && !cleanTweet.includes('🧵')) {
      return `🧵 ${cleanTweet}`;
    }
    
    return firstTweet;
  }

  /**
   * 📊 CALCULATE THREAD METADATA
   */
  private calculateThreadMetadata(tweets: string[]): ThreadStructure['metadata'] {
    const totalCharacters = tweets.reduce((sum, tweet) => sum + tweet.length, 0);
    const averageTweetLength = totalCharacters / tweets.length;
    
    // Simple readability score based on sentence length and complexity
    const readabilityScore = this.calculateReadabilityScore(tweets);
    
    // Engagement potential based on structure and hooks
    const engagementPotential = this.calculateEngagementPotential(tweets);
    
    return {
      totalCharacters,
      averageTweetLength: Math.round(averageTweetLength),
      readabilityScore,
      engagementPotential
    };
  }

  /**
   * 📖 CALCULATE READABILITY SCORE
   */
  private calculateReadabilityScore(tweets: string[]): number {
    let score = 100;
    
    tweets.forEach(tweet => {
      const wordCount = tweet.split(/\s+/).length;
      const sentenceCount = tweet.split(/[.!?]+/).length - 1;
      
      if (wordCount > 30) score -= 10; // Penalty for long tweets
      if (sentenceCount > 3) score -= 5; // Penalty for complex tweets
      if (tweet.length > 250) score -= 10; // Penalty for near-limit tweets
    });
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * 🔥 CALCULATE ENGAGEMENT POTENTIAL
   */
  private calculateEngagementPotential(tweets: string[]): number {
    let score = 0;
    
    tweets.forEach((tweet, index) => {
      // Hook tweet gets more weight
      const weight = index === 0 ? 2 : 1;
      
      if (tweet.match(/(\d+%|study|research|surprising)/i)) score += 5 * weight;
      if (tweet.match(/(myth|truth|secret|hidden)/i)) score += 7 * weight;
      if (tweet.match(/[?!]/)) score += 3 * weight;
      if (tweet.includes('🧵') || tweet.includes('thread')) score += 2 * weight;
      if (tweet.match(/(what do you think|comment)/i)) score -= 5 * weight; // Penalty
    });
    
    return Math.max(0, Math.min(100, score));
  }
}