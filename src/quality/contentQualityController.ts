/**
 * CONTENT QUALITY CONTROLLER
 * Ensures content is complete, high-quality, and engaging before posting
 */

import OpenAI from 'openai';
import { hasSpecificity } from '../generators/sharedPatterns';

export interface QualityScore {
  overall: number;
  completeness: number;
  engagement: number;
  clarity: number;
  actionability: number;
  authenticity: number;
  issues: string[];
  improvements: string[];
  shouldPost: boolean;
}

export interface ContentImprovement {
  improvedContent: string;
  improvements: string[];
  qualityIncrease: number;
}

export class ContentQualityController {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * COMPREHENSIVE QUALITY GATE - Prevents posting bad content
   * 
   * Phase 1 Update: Now handles threads properly (validates each tweet separately)
   */
  async validateContentQuality(
    content: string,
    options?: {
      isThread?: boolean;
      threadParts?: string[];
    }
  ): Promise<QualityScore> {
    console.log('🔍 QUALITY_GATE: Comprehensive content validation');
    
    // NEW: Handle thread validation separately
    if (options?.isThread && options?.threadParts && options.threadParts.length > 1) {
      console.log(`🧵 THREAD_VALIDATION: Validating ${options.threadParts.length} tweets`);
      return await this.validateThread(options.threadParts);
    }

    const score: QualityScore = {
      overall: 0,
      completeness: 0,
      engagement: 0,
      clarity: 0,
      actionability: 0,
      authenticity: 0,
      issues: [],
      improvements: [],
      shouldPost: false
    };

    // 1. CRITICAL FAILURES - Instant rejection
    const criticalIssues = this.detectCriticalIssues(content);
    if (criticalIssues.length > 0) {
      score.issues = criticalIssues;
      score.overall = 0;
      score.shouldPost = false;
      console.log('❌ CRITICAL_FAILURE:', criticalIssues.join(', '));
      return score;
    }

    // 2. COMPLETENESS SCORING (40% weight)
    score.completeness = this.scoreCompleteness(content);
    if (score.completeness < 60) {
      score.issues.push('Content appears incomplete or cut off');
    }

    // 3. ENGAGEMENT POTENTIAL (25% weight)
    score.engagement = this.scoreEngagementPotential(content);
    if (score.engagement < 50) {
      score.issues.push('Low engagement potential - lacks hooks or value');
    }

    // 4. CLARITY & READABILITY (20% weight)
    score.clarity = this.scoreClarity(content);
    if (score.clarity < 50) {
      score.issues.push('Poor clarity - confusing or hard to read');
    }

    // 5. ACTIONABILITY (10% weight)
    score.actionability = this.scoreActionability(content);
    if (score.actionability < 30) {
      score.improvements.push('Add specific, actionable advice');
    }

    // 6. AUTHENTICITY (5% weight)
    score.authenticity = this.scoreAuthenticity(content);
    if (score.authenticity < 40) {
      score.issues.push('Sounds too robotic or corporate');
    }

    // Calculate weighted overall score
    score.overall = Math.round(
      score.completeness * 0.40 +
      score.engagement * 0.25 +
      score.clarity * 0.20 +
      score.actionability * 0.10 +
      score.authenticity * 0.05
    );

    // Posting decision
    // TEMPORARILY LOWERED: 75 → 72 to allow improved generators to post while collecting data
    // Will raise back to 75 after 1-2 weeks of data collection and prompt improvements
    score.shouldPost = score.overall >= 72 && score.completeness >= 80;

    console.log(`📊 QUALITY_SCORE: ${score.overall}/100 (Complete: ${score.completeness}, Engage: ${score.engagement})`);
    
    if (!score.shouldPost) {
      console.log('🚫 QUALITY_GATE: Content REJECTED for posting');
    }

    return score;
  }

  /**
   * IMPROVE CONTENT - AI-powered content enhancement
   */
  async improveContent(content: string, qualityScore: QualityScore): Promise<ContentImprovement> {
    console.log('🔧 CONTENT_IMPROVER: Enhancing content quality');

    const improvementPrompt = `IMPROVE THIS CONTENT FOR MAXIMUM QUALITY:

ORIGINAL CONTENT:
"${content}"

QUALITY ISSUES DETECTED:
${qualityScore.issues.map(issue => `- ${issue}`).join('\n')}

IMPROVEMENT REQUIREMENTS:
- Make content COMPLETE (no cut-offs, ellipses, or incomplete sentences)
- Add ENGAGING hooks and curiosity gaps
- Include SPECIFIC, ACTIONABLE advice
- Sound HUMAN and conversational (not robotic)
- Keep under 280 characters if single tweet
- Each sentence should add value

RULES:
❌ NEVER use: "Let's dive in", "Stay tuned", "Thread below", "More soon", "..."
❌ NEVER end sentences incomplete or with ellipses
❌ NEVER use corporate or robotic language
✅ USE specific numbers, timeframes, examples
✅ USE conversational, human tone
✅ MAKE each sentence complete and valuable

Return ONLY the improved content, nothing else:`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: improvementPrompt }],
        temperature: 0.7,
        max_tokens: 300
      });

      const improvedContent = response.choices[0]?.message?.content?.trim() || content;
      
      // Validate improvement
      const newScore = await this.validateContentQuality(improvedContent);
      const qualityIncrease = newScore.overall - qualityScore.overall;

      console.log(`✅ CONTENT_IMPROVED: Quality increased by ${qualityIncrease} points`);

      return {
        improvedContent,
        improvements: [
          ...qualityScore.improvements,
          `Quality score improved from ${qualityScore.overall} to ${newScore.overall}`
        ],
        qualityIncrease
      };

    } catch (error) {
      console.error('❌ Content improvement failed:', error);
      return {
        improvedContent: content,
        improvements: [],
        qualityIncrease: 0
      };
    }
  }

  /**
   * THREAD VALIDATION - Phase 1 Addition
   * Validates each tweet in thread separately to avoid TOO_LONG errors
   */
  private async validateThread(threadParts: string[]): Promise<QualityScore> {
    const tweetScores: QualityScore[] = [];
    
    // Validate each tweet
    for (let i = 0; i < threadParts.length; i++) {
      const tweet = threadParts[i];
      console.log(`   [${i + 1}/${threadParts.length}] "${tweet.substring(0, 40)}..."`);
      
      const tweetScore = await this.validateSingleTweet(tweet);
      tweetScores.push(tweetScore);
      
      if (!tweetScore.shouldPost) {
        console.log(`   ❌ Tweet ${i + 1} failed: ${tweetScore.issues.join(', ')}`);
      }
    }
    
    // Aggregate
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const allPass = tweetScores.every(s => s.shouldPost);
    
    const threadScore: QualityScore = {
      overall: avg(tweetScores.map(s => s.overall)),
      completeness: avg(tweetScores.map(s => s.completeness)),
      engagement: avg(tweetScores.map(s => s.engagement)),
      clarity: avg(tweetScores.map(s => s.clarity)),
      actionability: avg(tweetScores.map(s => s.actionability)),
      authenticity: avg(tweetScores.map(s => s.authenticity)),
      shouldPost: allPass,
      issues: allPass ? [] : ['Some tweets failed validation'],
      improvements: []
    };
    
    console.log(`🧵 THREAD: ${threadScore.overall.toFixed(1)}/100 (${allPass ? 'PASS' : 'FAIL'})`);
    return threadScore;
  }

  /**
   * SINGLE TWEET VALIDATION - Phase 1 Addition
   */
  private async validateSingleTweet(content: string): Promise<QualityScore> {
    const score: QualityScore = {
      overall: 0,
      completeness: 0,
      engagement: 0,
      clarity: 0,
      actionability: 0,
      authenticity: 0,
      issues: [],
      improvements: [],
      shouldPost: false
    };

    // Critical failures
    const criticalIssues = this.detectCriticalIssues(content);
    if (criticalIssues.length > 0) {
      score.issues = criticalIssues;
      return score;
    }

    // Score all dimensions
    score.completeness = this.scoreCompleteness(content);
    score.engagement = this.scoreEngagementPotential(content);
    score.clarity = this.scoreClarity(content);
    score.actionability = this.scoreActionability(content);
    score.authenticity = this.scoreAuthenticity(content);

    // Calculate overall
    score.overall = Math.round(
      score.completeness * 0.40 +
      score.engagement * 0.25 +
      score.clarity * 0.20 +
      score.actionability * 0.10 +
      score.authenticity * 0.05
    );

    // Decision
    score.shouldPost = score.overall >= 72 && score.completeness >= 80;

    return score;
  }

  /**
   * DETECT CRITICAL ISSUES - Instant rejection triggers
   */
  private detectCriticalIssues(content: string): string[] {
    const issues: string[] = [];

    // Incomplete content patterns
    const incompletePatterns = [
      /\.\.\.+$/,           // Ends with ellipses
      /each nigh$/,         // Cut off mid-word
      /\w+$/,               // Ends abruptly without punctuation
      /more details/i,      // Incomplete teasers
      /stay tuned/i,        // Incomplete teasers
      /coming soon/i,       // Incomplete teasers
      /thread below/i,      // Incomplete references
    ];

    for (const pattern of incompletePatterns) {
      if (pattern.test(content)) {
        issues.push('INCOMPLETE_CONTENT');
        break;
      }
    }

    // AI tells and robotic language
    const roboticPatterns = [
      /crazy, right\?/i,
      /let's dive in/i,
      /let's explore/i,
      /dive deep/i,
      /comprehensive guide/i,
      /ultimate guide/i,
    ];

    for (const pattern of roboticPatterns) {
      if (pattern.test(content)) {
        issues.push('ROBOTIC_LANGUAGE');
        break;
      }
    }

    // Length issues
    if (content.length > 280) {
      issues.push('TOO_LONG');
    }

    if (content.length < 30) {
      issues.push('TOO_SHORT');
    }

    // Empty or meaningless content
    if (!content.trim() || content.trim() === '.' || content.trim().length < 10) {
      issues.push('EMPTY_CONTENT');
    }
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // NEW: SPECIFICITY REQUIREMENT
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Every post MUST include at least ONE of:
    // - Study citation (Lally et al. 2009)
    // - Specific measurement (10,000 lux, 500mg, 16:8)
    // - Timeframe/range (66 days, 18-254)
    // - Percentage/ratio (40% increase)
    // - Mechanism pathway (480nm blue → ipRGC)
    
    const specificityCheck = hasSpecificity(content);
    if (specificityCheck.score === 0) {
      issues.push('NO_SPECIFICITY: Must include study citation, measurement, or mechanism');
    }

    return issues;
  }

  /**
   * SCORE COMPLETENESS (40% of total score)
   */
  private scoreCompleteness(content: string): number {
    let score = 100;

    // Deduct for incomplete endings
    if (content.endsWith('...')) score -= 50;
    if (content.endsWith('..')) score -= 40;
    if (!content.match(/[.!?]$/)) score -= 30;

    // Deduct for mid-sentence cuts
    if (content.includes('each nigh')) score -= 70;
    if (content.includes('unexpect')) score -= 60;

    // Deduct for teaser language
    if (content.includes('more details')) score -= 40;
    if (content.includes('stay tuned')) score -= 40;

    return Math.max(0, score);
  }

  /**
   * SCORE ENGAGEMENT POTENTIAL (25% of total score)
   */
  private scoreEngagementPotential(content: string): number {
    let score = 50; // Base score

    // Add points for engagement elements
    if (content.match(/\d+%/)) score += 15; // Statistics
    if (content.match(/\$\d+|\d+ days|\d+ minutes/)) score += 10; // Specific numbers
    if (content.includes('?')) score += 10; // Questions
    if (content.match(/most people|you don't know|secret|truth/i)) score += 15; // Curiosity gaps

    // Deduct for boring patterns
    if (content.includes('comprehensive')) score -= 20;
    if (content.includes('ultimate guide')) score -= 20;
    if (content.length > 200 && !content.includes('?') && !content.match(/\d/)) score -= 15;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * SCORE CLARITY (20% of total score)
   */
  private scoreClarity(content: string): number {
    let score = 80; // Start high

    const words = content.split(' ');
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;

    // Deduct for complexity
    if (avgWordLength > 6) score -= 20;
    if (content.includes(',') && content.split(',').length > 4) score -= 15;
    if (content.split(' ').length > 40) score -= 10;

    return Math.max(0, score);
  }

  /**
   * SCORE ACTIONABILITY (10% of total score)
   */
  private scoreActionability(content: string): number {
    let score = 30; // Low base

    // Add points for actionable elements
    if (content.match(/try|do|use|add|avoid|start|stop/i)) score += 25;
    if (content.match(/\d+ minutes|\d+ times|\d+ days/)) score += 20;
    if (content.includes('instead')) score += 15;
    if (content.match(/step \d|tip \d/i)) score += 20;

    return Math.min(100, score);
  }

  /**
   * SCORE AUTHENTICITY (5% of total score)
   */
  private scoreAuthenticity(content: string): number {
    let score = 70; // Start decent

    // Deduct for corporate/robotic language
    if (content.includes('comprehensive')) score -= 30;
    if (content.includes('leverage')) score -= 25;
    if (content.includes('utilize')) score -= 20;
    if (content.includes('furthermore')) score -= 25;

    // Add for human elements
    if (content.match(/I tried|I discovered|I found/i)) score += 15;
    if (content.includes('honestly')) score += 10;

    return Math.max(0, score);
  }
}
