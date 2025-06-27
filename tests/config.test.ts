/**
 * Tests for the configuration system
 */

import { defaults, getEnv } from '../src/utils/config.js';

describe('Configuration System', () => {
  test('defaults should have expected values', () => {
    expect(defaults.maxDailyTweets).toBe(6);
    expect(defaults.quality.readabilityMin).toBe(55);
    expect(defaults.quality.credibilityMin).toBe(0.85);
    expect(defaults.fallbackStaggerMinutes).toBe(90);
    expect(defaults.postingStrategy).toBe('balanced');
  });

  test('getEnv should return environment value or fallback', () => {
    // Test with existing env var
    process.env.TEST_VAR = 'test_value';
    expect(getEnv('TEST_VAR', 'fallback')).toBe('test_value');
    
    // Test with missing env var
    delete process.env.TEST_VAR;
    expect(getEnv('TEST_VAR', 'fallback')).toBe('fallback');
  });

  test('getEnv should handle empty string fallback', () => {
    delete process.env.NONEXISTENT_VAR;
    expect(getEnv('NONEXISTENT_VAR', '')).toBe('');
  });
}); 