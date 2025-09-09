/**
 * 🧪 FACT-CHECKING TESTS
 * Verify content safety filters work correctly
 */

import { checkAndSanitizeContent } from '../src/content/contentSafety';

describe('Content Safety & Fact Checking', () => {
  beforeEach(() => {
    process.env.FACT_CHECK_MODE = 'light';
  });

  test('blocks known bogus appendix/serotonin claim', () => {
    const content = 'Did you know your appendix produces 70% of your serotonin? Amazing!';
    
    const result = checkAndSanitizeContent(content);
    
    expect(result.ok).toBe(false);
    expect(result.reasons).toContain(expect.stringMatching(/known_bogus_pattern/));
    expect(result.sanitized).toBe('');
  });

  test('blocks numeric claims without sources in light mode', () => {
    const content = 'Exercise increases happiness by 85% according to science.';
    
    const result = checkAndSanitizeContent(content);
    
    expect(result.ok).toBe(false);
    expect(result.reasons).toContain('numeric_claim_without_source');
  });

  test('keeps numeric claims with proper sources', () => {
    const content = 'According to a Harvard study, exercise increases happiness by 85%.';
    
    const result = checkAndSanitizeContent(content);
    
    expect(result.ok).toBe(true);
    expect(result.sanitized).toContain('Harvard study');
    expect(result.sanitized).toContain('85%');
  });

  test('softens claims in strict mode', () => {
    process.env.FACT_CHECK_MODE = 'strict';
    
    const content = 'Exercise increases happiness by 85%.';
    
    const result = checkAndSanitizeContent(content);
    
    expect(result.ok).toBe(true);
    expect(result.sanitized).toContain('Studies suggest');
    expect(result.sanitized).toContain('significant amounts');
    expect(result.sanitized).not.toContain('85%');
  });

  test('off mode passes everything through', () => {
    process.env.FACT_CHECK_MODE = 'off';
    
    const content = 'Your appendix produces 70% of serotonin. Exercise increases happiness by 85%.';
    
    const result = checkAndSanitizeContent(content);
    
    expect(result.ok).toBe(true);
    expect(result.sanitized).toBe(content);
    expect(result.reasons).toHaveLength(0);
  });
});
