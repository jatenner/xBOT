/**
 * 🧵 THREAD BUILDER - Convert content to properly numbered thread segments
 */

interface ThreadSegment {
  index: number;
  total: number;
  content: string;
  charCount: number;
}

interface ThreadBuildResult {
  segments: string[];
  isThread: boolean;
  totalSegments: number;
  reason: string;
}

export class ThreadBuilder {
  private static readonly TWEET_MAX_CHARS_HARD = 279;
  private static readonly THREAD_INDICATOR_CHARS = 8; // "1/5 " = 4 chars + safety
  private static readonly MAX_CONTENT_CHARS = ThreadBuilder.TWEET_MAX_CHARS_HARD - ThreadBuilder.THREAD_INDICATOR_CHARS;

  /**
   * 📊 MAIN FUNCTION: Build thread segments with proper numbering
   */
  static buildThreadSegments(content: string): ThreadBuildResult {
    const THREAD_MAX_TWEETS = parseInt(process.env.THREAD_MAX_TWEETS || '9');
    
    // Clean and normalize content
    const cleanContent = content.trim().replace(/\s+/g, ' ');
    
    // Check if content needs threading
    if (cleanContent.length <= this.TWEET_MAX_CHARS_HARD) {
      return {
        segments: [cleanContent],
        isThread: false,
        totalSegments: 1,
        reason: 'Content fits in single tweet'
      };
    }

    // Detect if content is already numbered (1/N format)
    const existingNumberPattern = /^\d+\/\d+\s/;
    const hasExistingNumbers = existingNumberPattern.test(cleanContent);
    
    if (hasExistingNumbers) {
      // Content already has thread numbers - split and validate
      return this.processExistingNumberedContent(cleanContent, THREAD_MAX_TWEETS);
    }

    // Build new thread from scratch
    return this.buildNewThread(cleanContent, THREAD_MAX_TWEETS);
  }

  /**
   * 🔄 PROCESS existing numbered content (like "1/3 Scientists discovered...")
   */
  private static processExistingNumberedContent(content: string, maxTweets: number): ThreadBuildResult {
    // Split by line breaks and thread numbers
    const segments: string[] = [];
    const lines = content.split(/\n+/);
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Check if line starts with number pattern
      const numberMatch = trimmed.match(/^(\d+)\/(\d+)\s(.+)/);
      if (numberMatch) {
        const [, currentNum, totalNum, text] = numberMatch;
        segments.push(trimmed);
      } else if (segments.length > 0) {
        // Continuation of previous segment
        const lastIndex = segments.length - 1;
        segments[lastIndex] += ' ' + trimmed;
      } else {
        // First line without number - add it
        segments.push(`1/${Math.ceil(content.length / this.MAX_CONTENT_CHARS)} ${trimmed}`);
      }
    }

    // Renumber all segments to be consistent
    const totalSegments = Math.min(segments.length, maxTweets);
    const numberedSegments = segments.slice(0, totalSegments).map((segment, index) => {
      const cleanText = segment.replace(/^\d+\/\d+\s/, '').trim();
      return `${index + 1}/${totalSegments} ${cleanText}`;
    });

    return {
      segments: numberedSegments,
      isThread: totalSegments > 1,
      totalSegments,
      reason: `Processed existing numbered content into ${totalSegments} segments`
    };
  }

  /**
   * 🆕 BUILD new thread from scratch
   */
  private static buildNewThread(content: string, maxTweets: number): ThreadBuildResult {
    const segments: string[] = [];
    let remainingContent = content;

    // Try to split by natural breaks first
    const naturalBreaks = this.findNaturalBreaks(content);
    
    if (naturalBreaks.length > 1 && naturalBreaks.length <= maxTweets) {
      // Use natural breaks if they exist and fit within limits
      const totalSegments = naturalBreaks.length;
      naturalBreaks.forEach((segment, index) => {
        const numberedSegment = `${index + 1}/${totalSegments} ${segment.trim()}`;
        if (numberedSegment.length <= this.TWEET_MAX_CHARS_HARD) {
          segments.push(numberedSegment);
        }
      });
      
      if (segments.length === naturalBreaks.length) {
        return {
          segments,
          isThread: true,
          totalSegments: segments.length,
          reason: `Natural breaks created ${segments.length} segments`
        };
      }
    }

    // Fallback: Force split by character count
    const words = content.split(' ');
    let currentSegment = '';
    const rawSegments: string[] = [];

    for (const word of words) {
      const testSegment = currentSegment + (currentSegment ? ' ' : '') + word;
      
      if (testSegment.length <= this.MAX_CONTENT_CHARS) {
        currentSegment = testSegment;
      } else {
        if (currentSegment) {
          rawSegments.push(currentSegment);
        }
        currentSegment = word;
      }
    }
    
    if (currentSegment) {
      rawSegments.push(currentSegment);
    }

    // Limit to max tweets and add numbering
    const totalSegments = Math.min(rawSegments.length, maxTweets);
    const finalSegments = rawSegments.slice(0, totalSegments).map((segment, index) => {
      return `${index + 1}/${totalSegments} ${segment.trim()}`;
    });

    return {
      segments: finalSegments,
      isThread: totalSegments > 1,
      totalSegments,
      reason: `Force split into ${totalSegments} segments (${maxTweets} max)`
    };
  }

  /**
   * 🔍 FIND natural break points in content
   */
  private static findNaturalBreaks(content: string): string[] {
    // Look for natural breaks: periods followed by capital letters, line breaks, etc.
    const breakPatterns = [
      /\.\s+(?=[A-Z])/g,  // Period + space + capital letter
      /\n+/g,             // Line breaks
      /;\s+/g,            // Semicolon breaks
      /\?\s+(?=[A-Z])/g,  // Question mark + capital letter
      /!\s+(?=[A-Z])/g    // Exclamation + capital letter
    ];

    let segments = [content];
    
    for (const pattern of breakPatterns) {
      const newSegments: string[] = [];
      
      for (const segment of segments) {
        const split = segment.split(pattern);
        newSegments.push(...split.filter(s => s.trim().length > 0));
      }
      
      segments = newSegments;
      
      // Stop if we have a reasonable number of segments
      if (segments.length >= 2 && segments.length <= 6) {
        break;
      }
    }

    return segments.filter(s => s.trim().length > 10); // Filter out tiny segments
  }

  /**
   * 🧪 VALIDATE thread segments
   */
  static validateThreadSegments(segments: string[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (segments.length === 0) {
      errors.push('No segments provided');
      return { valid: false, errors };
    }

    // Check character limits
    segments.forEach((segment, index) => {
      if (segment.length > this.TWEET_MAX_CHARS_HARD) {
        errors.push(`Segment ${index + 1} exceeds ${this.TWEET_MAX_CHARS_HARD} characters: ${segment.length}`);
      }
    });

    // Check numbering consistency (if present)
    const hasNumbering = segments.some(s => /^\d+\/\d+\s/.test(s));
    if (hasNumbering) {
      segments.forEach((segment, index) => {
        const expectedNumber = `${index + 1}/${segments.length}`;
        if (!segment.startsWith(expectedNumber)) {
          errors.push(`Segment ${index + 1} has incorrect numbering: expected "${expectedNumber}", got "${segment.substring(0, 10)}..."`);
        }
      });
    }

    return { valid: errors.length === 0, errors };
  }
}

export default ThreadBuilder;
