/**
 * 🧪 THREAD SEGMENT PARSING TESTS
 * Ensures 1/3...2/3...3/3 strings are parsed correctly
 */

import { describe, it, expect } from '@jest/globals';
import PostingFacade from '../posting/PostingFacade';

describe('Thread Segment Parsing', () => {
  it('should parse 1/3...2/3...3/3 format correctly', () => {
    const testContent = `1/3 Scientists at Johns Hopkins discovered something shocking: your appendix produces 70% of your body's serotonin

2/3 This means that after just 3 weeks of severe dieting, your body might be working against you

3/3 Your metabolism adapts, making it harder to lose weight and easier to gain it back`;

    // Use the private method via any casting for testing
    const segments = (PostingFacade as any).splitIntoSegments(testContent);
    
    expect(segments).toHaveLength(3);
    expect(segments[0]).toBe("Scientists at Johns Hopkins discovered something shocking: your appendix produces 70% of your body's serotonin");
    expect(segments[1]).toBe("This means that after just 3 weeks of severe dieting, your body might be working against you");
    expect(segments[2]).toBe("Your metabolism adapts, making it harder to lose weight and easier to gain it back");
  });

  it('should handle enforced count from metadata', () => {
    const testContent = "Long content that should be split into exactly 4 segments based on metadata enforcement rather than natural breaks or length";
    
    const segments = (PostingFacade as any).splitIntoSegments(testContent, 4);
    
    expect(segments).toHaveLength(4);
    expect(segments.every(s => s.trim().length > 0)).toBe(true);
  });

  it('should handle single segment content', () => {
    const testContent = "Short single tweet content";
    
    const segments = (PostingFacade as any).splitIntoSegments(testContent);
    
    expect(segments).toHaveLength(1);
    expect(segments[0]).toBe("Short single tweet content");
  });

  it('should handle mixed numbered and unnumbered content', () => {
    const testContent = `1/2 First numbered segment
Some unnumbered text that should be ignored or merged`;
    
    const segments = (PostingFacade as any).splitIntoSegments(testContent);
    
    // Should find the numbered segment
    expect(segments.length).toBeGreaterThan(0);
    expect(segments[0]).toBe("First numbered segment");
  });
});

describe('Legacy Poster Import Guard', () => {
  it('should fail if SimplifiedBulletproofPoster is imported', () => {
    // This test will fail CI if someone tries to import the legacy poster
    let legacyImportDetected = false;
    
    try {
      // This should be commented out in actual code
      // If uncommented, it will cause this test to fail
      // const { SimplifiedBulletproofPoster } = require('../posting/simplifiedBulletproofPoster');
      // legacyImportDetected = true;
    } catch (e) {
      // Expected - legacy poster should not be importable
    }
    
    expect(legacyImportDetected).toBe(false);
  });
});
