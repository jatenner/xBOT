/**
 * Unit tests for grounding phrase matcher
 * Tests robustness to casing, punctuation, and token overlap
 */

import { verifyGroundingPhrases } from '../groundingPhraseExtractor';

describe('verifyGroundingPhrases', () => {
  test('should pass for clearly grounded reply (exact phrase match)', () => {
    const tweet = 'Try @cbdMD_USA\'s Sleep Gummies: 25mg, melatonin = deep, uninterrupted sleep.';
    const requiredPhrases = ['Try @cbdMD_USA\'s Sleep Gummies', 'melatonin = deep'];
    const reply = 'I\'ve tried @cbdMD_USA\'s Sleep Gummies with 25mg melatonin = deep sleep works great!';
    
    const result = verifyGroundingPhrases(reply, requiredPhrases);
    expect(result.passed).toBe(true);
    expect(result.matchedPhrases.length).toBeGreaterThanOrEqual(2);
  });

  test('should fail for generic reply (no grounding)', () => {
    const tweet = 'Try @cbdMD_USA\'s Sleep Gummies: 25mg, melatonin = deep, uninterrupted sleep.';
    const requiredPhrases = ['Try @cbdMD_USA\'s Sleep Gummies', 'melatonin = deep'];
    const reply = 'Sleep is important for health. Make sure to get enough rest.';
    
    const result = verifyGroundingPhrases(reply, requiredPhrases);
    expect(result.passed).toBe(false);
    expect(result.matchedPhrases.length).toBe(0);
  });

  test('should pass for token-overlap grounded reply (1 phrase + tokens)', () => {
    const tweet = 'Host Disease post BMT. Melanoma 1A, Acute Myelogenous Leukemia in 2006';
    const requiredPhrases = ['Host Disease post BMT', 'Acute Myelogenous Leukemia'];
    // Reply has "Acute Myelogenous Leukemia" (exact) + "Melanoma", "BMT", "Disease" (token overlaps)
    const reply = 'Acute Myelogenous Leukemia is serious. Melanoma and BMT Disease treatment requires care.';
    
    const result = verifyGroundingPhrases(reply, requiredPhrases);
    expect(result.passed).toBe(true);
    // Should have at least 1 exact match + token overlaps
    expect(result.matchedPhrases.length).toBeGreaterThanOrEqual(1);
  });

  test('should handle casing variations', () => {
    const requiredPhrases = ['Try @cbdMD_USA\'s Sleep Gummies'];
    const reply = 'TRY @CBDMD_USA\'S SLEEP GUMMIES are great!';
    
    const result = verifyGroundingPhrases(reply, requiredPhrases);
    expect(result.passed).toBe(true);
  });

  test('should handle punctuation variations', () => {
    const requiredPhrases = ['Try @cbdMD_USA\'s Sleep Gummies'];
    const reply = 'Try @cbdMD_USA\'s Sleep Gummies!';
    
    const result = verifyGroundingPhrases(reply, requiredPhrases);
    expect(result.passed).toBe(true);
  });

  test('should pass with 4+ token overlaps even without exact phrases', () => {
    const tweet = 'Host Disease post BMT. Melanoma 1A, Acute Myelogenous Leukemia in 2006';
    const requiredPhrases = ['Host Disease post BMT', 'Acute Myelogenous Leukemia'];
    // Reply has no exact phrases but has 4+ overlapping tokens: "Melanoma", "Acute", "Leukemia", "Disease", "BMT"
    const reply = 'Melanoma treatment and Acute Leukemia Disease require BMT care.';
    
    const result = verifyGroundingPhrases(reply, requiredPhrases);
    expect(result.passed).toBe(true);
  });
});
