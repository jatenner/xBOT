/**
 * Cadence Gate Tests
 * Validates posting interval logic and bootstrap behavior
 */

import { CadenceGate } from '../src/core/cadence/CadenceGate';

describe('CadenceGate', () => {
  let cadenceGate: CadenceGate;
  
  beforeEach(() => {
    // Use test configuration with shorter intervals
    cadenceGate = new CadenceGate({
      minIntervalMs: 60 * 60 * 1000, // 1 hour for testing
      bootstrapThreshold: 3,
      bootstrapIntervalMs: 10 * 60 * 1000, // 10 minutes
      backoffCheckMs: 5 * 60 * 1000 // 5 minutes
    });
    
    cadenceGate.reset();
  });

  describe('Bootstrap Mode', () => {
    test('should allow first post immediately', () => {
      const result = cadenceGate.isAllowed();
      
      expect(result.allowed).toBe(true);
      expect(result.waitMs).toBe(0);
      expect(result.reason).toContain('bootstrap mode - first post');
    });

    test('should respect bootstrap interval between posts', () => {
      const now = Date.now();
      
      // Record a post
      cadenceGate.recordPost(now);
      
      // Check immediately after
      const result = cadenceGate.isAllowed(now + 1000); // 1 second later
      
      expect(result.allowed).toBe(false);
      expect(result.waitMs).toBeGreaterThan(0);
      expect(result.reason).toContain('bootstrap cooldown');
    });

    test('should allow post after bootstrap interval', () => {
      const now = Date.now();
      
      // Record a post
      cadenceGate.recordPost(now);
      
      // Check after bootstrap interval
      const result = cadenceGate.isAllowed(now + 11 * 60 * 1000); // 11 minutes later
      
      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('bootstrap mode');
    });
  });

  describe('Normal Mode', () => {
    beforeEach(() => {
      // Get past bootstrap threshold
      const now = Date.now();
      for (let i = 0; i < 3; i++) {
        cadenceGate.recordPost(now - (3 - i) * 11 * 60 * 1000);
      }
    });

    test('should respect minimum interval in normal mode', () => {
      const now = Date.now();
      
      // Record a recent post
      cadenceGate.recordPost(now - 30 * 60 * 1000); // 30 minutes ago
      
      const result = cadenceGate.isAllowed(now);
      
      expect(result.allowed).toBe(false);
      expect(result.waitMs).toBeGreaterThan(0);
      expect(result.reason).toContain('minimum interval');
    });

    test('should allow post after minimum interval', () => {
      const now = Date.now();
      
      // Record an old post
      cadenceGate.recordPost(now - 70 * 60 * 1000); // 70 minutes ago
      
      const result = cadenceGate.isAllowed(now);
      
      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('interval met');
    });
  });

  describe('Wait Time Calculation', () => {
    test('should calculate correct wait time', () => {
      const now = Date.now();
      const postTime = now - 30 * 60 * 1000; // 30 minutes ago
      
      cadenceGate.recordPost(postTime);
      
      const result = cadenceGate.isAllowed(now);
      
      // Should wait approximately 30 more minutes (60 min interval - 30 min elapsed)
      const expectedWaitMs = 30 * 60 * 1000;
      expect(result.waitMs).toBeCloseTo(expectedWaitMs, -3); // Within 1 second
    });

    test('should provide reasonable next check interval', () => {
      cadenceGate.recordPost(Date.now() - 30 * 60 * 1000);
      
      const result = cadenceGate.isAllowed();
      
      expect(result.nextCheckMs).toBeGreaterThan(0);
      expect(result.nextCheckMs).toBeLessThanOrEqual(5 * 60 * 1000); // Max 5 minutes
    });
  });

  describe('Post Recording', () => {
    test('should increment total posts counter', () => {
      const initialState = cadenceGate.isAllowed();
      
      cadenceGate.recordPost();
      cadenceGate.recordPost();
      
      // Check that we're making progress toward bootstrap threshold
      const result = cadenceGate.isAllowed();
      expect(result.reason).toContain('2/3 posts');
    });
  });

  describe('Edge Cases', () => {
    test('should handle clock skew gracefully', () => {
      const now = Date.now();
      
      // Record post in the "future"
      cadenceGate.recordPost(now + 60 * 1000);
      
      // Should still work reasonably
      const result = cadenceGate.isAllowed(now);
      expect(result).toBeDefined();
      expect(typeof result.allowed).toBe('boolean');
    });

    test('should handle very old posts', () => {
      const now = Date.now();
      
      // Record very old post
      cadenceGate.recordPost(now - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      
      const result = cadenceGate.isAllowed(now);
      expect(result.allowed).toBe(true);
    });
  });
});
