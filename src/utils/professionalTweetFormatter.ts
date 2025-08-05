/**
 * 🎯 PROFESSIONAL TWEET FORMATTER
 * Elite-level tweet formatting that mimics top Twitter accounts
 * Focuses on quality, context, completeness, and engagement
 */

import { addProfessionalEmojis } from './tweetFormatting';

export interface TweetQualityScore {
  overall: number;
  completeness: number;
  readability: number;
  engagement: number;
  professionalism: number;
  issues: string[];
}

export interface TopAccountPattern {
  accountType: 'health_expert' | 'scientist' | 'influencer' | 'brand';
  avgLength: number;
  commonStructures: string[];
  emojiUsage: 'minimal' | 'strategic' | 'frequent';
  hookPatterns: string[];
  endingPatterns: string[];
}

/**
 * 🏆 ELITE TWEET FORMATTER - Format like top accounts
 */
export class ProfessionalTweetFormatter {
  
  /**
   * 🎯 MAIN FORMATTING FUNCTION - Transform content to professional standard
   */
  static formatTweet(content: string): string {
    let formatted = content;
    
    // Step 1: Remove amateur formatting
    formatted = this.removeAmateurElements(formatted);
    
    // Step 2: Ensure completeness
    formatted = this.ensureCompleteness(formatted);
    
    // Step 3: Perfect punctuation and spacing
    formatted = this.perfectPunctuation(formatted);
    
    // Step 4: Add strategic line breaks
    formatted = this.addStrategicBreaks(formatted);
    
    // Step 5: Professional emoji enhancement
    formatted = addProfessionalEmojis(formatted);
    
    // Step 6: Final quality check
    const qualityScore = this.analyzeQuality(formatted);
    if (qualityScore.overall < 80) {
      formatted = this.improveLowQuality(formatted, qualityScore);
    }
    
    return formatted.trim();
  }
  
  /**
   * 🧹 REMOVE AMATEUR ELEMENTS - Strip unprofessional formatting
   */
  private static removeAmateurElements(content: string): string {
    return content
      // Remove hashtags completely
      .replace(/#\w+/g, '')
      
      // Remove excessive punctuation
      .replace(/[!]{2,}/g, '!')
      .replace(/[?]{2,}/g, '?')
      .replace(/\.{4,}/g, '...')
      
      // Remove corporate headers
      .replace(/^\s*\*{0,2}(Tweet|Thread)[^:]*:?\*{0,2}\s*/im, '')
      
      // Remove amateur intros
      .replace(/^\s*Here's\s+what\s+you\s+need\s+to\s+know[:\s]*/i, '')
      .replace(/^\s*Let\s+me\s+explain[:\s]*/i, '')
      
      // Remove excessive emojis (more than 3 different types)
      .replace(/([\u{1F600}-\u{1F64F}]|\u{1F300}-\u{1F5FF}|\u{1F680}-\u{1F6FF}|\u{1F1E0}-\u{1F1FF}){4,}/gu, '')
      
      .trim();
  }
  
  /**
   * ✅ ENSURE COMPLETENESS - No mid-sentence cuts, complete thoughts
   */
  private static ensureCompleteness(content: string): string {
    let complete = content;
    
    // Check if ends mid-sentence (no proper punctuation)
    if (!/[.!?]$/.test(complete.trim())) {
      // If it's a statement, add period
      if (!/[?]/.test(complete)) {
        complete += '.';
      } else {
        complete += '?';
      }
    }
    
    // Ensure questions are properly formed
    complete = complete.replace(/([A-Z][^.!?]*)\?([^?])/g, '$1? $2');
    
    // Fix incomplete comparisons
    complete = complete.replace(/(\d+)% (better|more|faster|higher)(?!\s+(than|compared))/gi, '$1% $2 than average');
    
    return complete;
  }
  
  /**
   * 📝 PERFECT PUNCTUATION - Professional punctuation and spacing
   */
  private static perfectPunctuation(content: string): string {
    return content
      // Fix spacing around punctuation
      .replace(/\s+([.!?])/g, '$1')
      .replace(/([.!?])([A-Z])/g, '$1 $2')
      
      // Fix comma spacing
      .replace(/\s*,\s*/g, ', ')
      
      // Fix colon spacing
      .replace(/\s*:\s*/g, ': ')
      
      // Fix dash spacing
      .replace(/\s*-\s*/g, ' - ')
      .replace(/\s*—\s*/g, ' — ')
      
      // Fix parentheses spacing
      .replace(/\s*\(\s*/g, ' (')
      .replace(/\s*\)\s*/g, ') ')
      
      // Clean up multiple spaces
      .replace(/\s{2,}/g, ' ')
      
      // Fix quote marks
      .replace(/"\s*([^"]+)\s*"/g, '"$1"')
      
      .trim();
  }
  
  /**
   * 📱 ADD STRATEGIC BREAKS - Mobile-optimized line breaks
   */
  private static addStrategicBreaks(content: string): string {
    let formatted = content;
    
    // Don't add breaks if content is already well-formatted
    if (formatted.includes('\n\n')) {
      return formatted;
    }
    
    // Add break after strong opening hook (if > 140 chars)
    if (formatted.length > 140) {
      // Break after first complete sentence if it's a strong hook
      const firstSentence = formatted.match(/^[^.!?]*[.!?]/);
      if (firstSentence && firstSentence[0].length > 30 && firstSentence[0].length < 100) {
        const isStrongHook = /^(Most people|Did you know|New study|Scientists|Research shows)/i.test(firstSentence[0]);
        if (isStrongHook) {
          formatted = formatted.replace(firstSentence[0], firstSentence[0] + '\n\n');
        }
      }
    }
    
    // Add break before questions (if they're calls to action)
    formatted = formatted.replace(/\.\s+(What|Which|How|Why|Have you)\s+/g, '.\n\n$1 ');
    
    // Add break before numbered lists
    formatted = formatted.replace(/\.\s+(1\.|\d+\)|①)/g, '.\n\n$1');
    
    return formatted;
  }
  
  /**
   * 📊 ANALYZE QUALITY - Comprehensive quality scoring
   */
  static analyzeQuality(content: string): TweetQualityScore {
    const issues: string[] = [];
    let completeness = 100;
    let readability = 100;
    let engagement = 100;
    let professionalism = 100;
    
    // Check completeness
    if (!/[.!?]$/.test(content.trim())) {
      completeness -= 30;
      issues.push('Incomplete sentence');
    }
    
    if (content.includes('...') && !content.includes('?')) {
      completeness -= 20;
      issues.push('Ends with ellipsis without clear continuation');
    }
    
    // Check readability
    if (content.length > 280) {
      readability -= 40;
      issues.push('Too long for single tweet');
    }
    
    if (content.split(/[.!?]/).length > 5 && !content.includes('\n')) {
      readability -= 30;
      issues.push('Too many sentences without breaks');
    }
    
    // 🚨 ESSAY DETECTION - Prevent academic walls of text
    if (content.length > 350 && !content.includes('\n\n')) {
      readability -= 50;
      issues.push('Essay-like wall of text detected');
    }
    
    if (content.split(/[.!?]/).length > 6) {
      readability -= 40;
      issues.push('Too many sentences - sounds like academic paper');
    }
    
    // Check for academic language patterns
    const academicPatterns = [
      /Research shows that.{50,}/i,
      /Studies indicate that.{50,}/i,
      /Here's the real story:/i,
      /\b(furthermore|moreover|additionally|consequently)\b/gi
    ];
    
    let academicScore = 0;
    academicPatterns.forEach(pattern => {
      if (pattern.test(content)) academicScore++;
    });
    
    if (academicScore >= 2) {
      readability -= 35;
      issues.push('Academic writing style not suitable for viral content');
    }
    
    // Check engagement
    const hasHook = /^(Most people|Did you know|New study|Scientists|Research shows|Breakthrough)/i.test(content);
    if (!hasHook) {
      engagement -= 25;
      issues.push('Weak or missing hook');
    }
    
    const hasCTA = /(What|Which|How|Why|Try|Start|Implement).{0,20}[?]|Try this|Start with/i.test(content);
    if (!hasCTA && content.length > 100) {
      engagement -= 20;
      issues.push('Missing call to action');
    }
    
    // Check professionalism
    if (content.includes('#')) {
      professionalism -= 25;
      issues.push('Contains hashtags');
    }
    
    const emojiCount = (content.match(/[\u{1F600}-\u{1F64F}]|\u{1F300}-\u{1F5FF}|\u{1F680}-\u{1F6FF}|\u{1F1E0}-\u{1F1FF}/gu) || []).length;
    if (emojiCount > 3) {
      professionalism -= 20;
      issues.push('Too many emojis');
    }
    
    if (/[!]{2,}|[?]{2,}|[.]{4,}/.test(content)) {
      professionalism -= 15;
      issues.push('Excessive punctuation');
    }
    
    const overall = Math.round((completeness + readability + engagement + professionalism) / 4);
    
    return {
      overall,
      completeness,
      readability,
      engagement,
      professionalism,
      issues
    };
  }
  
  /**
   * 🔧 IMPROVE LOW QUALITY - Fix issues found in quality analysis
   */
  private static improveLowQuality(content: string, qualityScore: TweetQualityScore): string {
    let improved = content;
    
    // Fix completeness issues
    if (qualityScore.issues.includes('Incomplete sentence')) {
      if (!improved.trim().endsWith('.') && !improved.trim().endsWith('!') && !improved.trim().endsWith('?')) {
        improved += '.';
      }
    }
    
    // Fix readability issues
    if (qualityScore.issues.includes('Too many sentences without breaks')) {
      improved = this.addStrategicBreaks(improved);
    }
    
    // Fix engagement issues
    if (qualityScore.issues.includes('Weak or missing hook')) {
      improved = this.enhanceHook(improved);
    }
    
    return improved;
  }
  
  /**
   * 🎯 ENHANCE HOOK - Improve opening hook for engagement
   */
  private static enhanceHook(content: string): string {
    // Don't modify if already has a strong hook
    if (/^(Most people|Did you know|New study|Scientists|Research shows|Breakthrough)/i.test(content)) {
      return content;
    }
    
    // Transform weak starts into stronger hooks
    if (/^(There is|Studies show|It is|You can)/i.test(content)) {
      return content
        .replace(/^There is evidence that/, 'Research shows')
        .replace(/^Studies show that/, 'New research reveals')
        .replace(/^It is proven that/, 'Scientists have proven')
        .replace(/^You can improve/, 'Want to improve');
    }
    
    return content;
  }
}

/**
 * 🎯 TOP ACCOUNT ANALYZER - Learn from successful health accounts
 */
export class TopAccountAnalyzer {
  
  /**
   * 📊 ANALYZE ACCOUNT PATTERNS - Extract patterns from top accounts
   */
  static getHealthAccountPatterns(): TopAccountPattern[] {
    return [
      {
        accountType: 'health_expert',
        avgLength: 180,
        commonStructures: [
          'Hook + Fact + Evidence + Action',
          'Question + Answer + Proof + CTA',
          'Contrarian + Truth + Explanation'
        ],
        emojiUsage: 'minimal',
        hookPatterns: [
          'Most people believe...',
          'New research reveals...',
          'Did you know...',
          'Scientists discovered...'
        ],
        endingPatterns: [
          'What will you try first?',
          'Which approach works for you?',
          'Try this and see the difference.',
          'The results might surprise you.'
        ]
      },
      {
        accountType: 'scientist',
        avgLength: 220,
        commonStructures: [
          'Study + Findings + Implications',
          'Data + Context + Meaning',
          'Hypothesis + Evidence + Conclusion'
        ],
        emojiUsage: 'strategic',
        hookPatterns: [
          'Breakthrough study shows...',
          'Latest research indicates...',
          'Meta-analysis reveals...',
          'Clinical trial demonstrates...'
        ],
        endingPatterns: [
          'More research is needed.',
          'Implications are significant.',
          'This changes everything.',
          'The data is clear.'
        ]
      }
    ];
  }
  
  /**
   * 🎯 OPTIMIZE FOR ACCOUNT TYPE - Format based on account type patterns
   */
  static optimizeForAccountType(content: string, accountType: 'health_expert' | 'scientist' | 'influencer'): string {
    const patterns = this.getHealthAccountPatterns().find(p => p.accountType === accountType);
    if (!patterns) return content;
    
    let optimized = content;
    
    // Apply hook patterns if content doesn't have a strong hook
    const hasStrongHook = patterns.hookPatterns.some(hook => 
      new RegExp(hook.replace('...', ''), 'i').test(optimized)
    );
    
    if (!hasStrongHook && optimized.length > 100) {
      // Try to transform into a stronger hook
      if (accountType === 'scientist' && /study|research|data/i.test(optimized)) {
        optimized = optimized.replace(/^/, 'New research shows: ');
      } else if (accountType === 'health_expert') {
        optimized = optimized.replace(/^/, 'Most people don\'t know: ');
      }
    }
    
    return optimized;
  }
}