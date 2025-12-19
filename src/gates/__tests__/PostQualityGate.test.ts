/**
 * Post Quality Gate Tests
 * 
 * Unit tests for single/thread validation
 */

import { checkPostQuality } from '../PostQualityGate';
import type { PostPlan } from '../../contracts/PostPlannerContract';

describe('PostQualityGate', () => {
  describe('Single Post Validation', () => {
    test('accepts clean single post', () => {
      const plan: PostPlan = {
        post_type: 'single',
        text: 'This is a clean single tweet about health benefits of walking.'
      };
      
      const result = checkPostQuality(plan);
      expect(result.passed).toBe(true);
      expect(result.reason).toBe('OK');
    });
    
    test('rejects single with numbering (1/5)', () => {
      const plan: PostPlan = {
        post_type: 'single',
        text: '1/5 This is the first tweet in a thread about health.'
      };
      
      const result = checkPostQuality(plan);
      expect(result.passed).toBe(false);
      expect(result.reason).toBe('SINGLE_WITH_THREAD_MARKERS');
      expect(result.issues).toContain(expect.stringContaining('thread markers'));
    });
    
    test('rejects single with thread emoji', () => {
      const plan: PostPlan = {
        post_type: 'single',
        text: '🧵 Let me tell you about the benefits of meditation.'
      };
      
      const result = checkPostQuality(plan);
      expect(result.passed).toBe(false);
      expect(result.reason).toBe('SINGLE_WITH_THREAD_MARKERS');
    });
    
    test('rejects single with "thread" keyword', () => {
      const plan: PostPlan = {
        post_type: 'single',
        text: 'In this thread, I will explain the science of sleep.'
      };
      
      const result = checkPostQuality(plan);
      expect(result.passed).toBe(false);
      expect(result.reason).toBe('SINGLE_WITH_THREAD_MARKERS');
    });
    
    test('rejects single with continuation phrases', () => {
      const phrases = [
        "Let's explore the benefits of fasting.",
        "Let's break this down step by step.",
        "More below on why this matters.",
        "See next tweet for details."
      ];
      
      phrases.forEach(text => {
        const plan: PostPlan = { post_type: 'single', text };
        const result = checkPostQuality(plan);
        expect(result.passed).toBe(false);
        expect(result.reason).toBe('SINGLE_WITH_THREAD_MARKERS');
      });
    });
    
    test('rejects single with part indicators', () => {
      const plan: PostPlan = {
        post_type: 'single',
        text: 'Part 1: Understanding the basics of nutrition.'
      };
      
      const result = checkPostQuality(plan);
      expect(result.passed).toBe(false);
      expect(result.reason).toBe('SINGLE_WITH_THREAD_MARKERS');
    });
    
    test('rejects single over 280 characters', () => {
      const plan: PostPlan = {
        post_type: 'single',
        text: 'A'.repeat(281)
      };
      
      const result = checkPostQuality(plan);
      expect(result.passed).toBe(false);
      expect(result.issues).toContain(expect.stringContaining('Too long'));
    });
  });
  
  describe('Thread Post Validation', () => {
    test('accepts valid thread', () => {
      const plan: PostPlan = {
        post_type: 'thread',
        tweets: [
          'The science of sleep is fascinating. Here\\'s what happens when you sleep.',
          'During REM sleep, your brain consolidates memories and processes emotions.',
          'Key takeaway: 7-9 hours of quality sleep is non-negotiable for health.'
        ],
        thread_goal: 'Explain the science of sleep and its importance'
      };
      
      const result = checkPostQuality(plan);
      expect(result.passed).toBe(true);
    });
    
    test('rejects thread with < 2 tweets', () => {
      const plan: PostPlan = {
        post_type: 'thread',
        tweets: ['Only one tweet here.'],
        thread_goal: 'Explain something'
      };
      
      const result = checkPostQuality(plan);
      expect(result.passed).toBe(false);
      expect(result.reason).toBe('THREAD_STRUCTURE_INVALID');
      expect(result.issues).toContain(expect.stringContaining('Too few'));
    });
    
    test('rejects thread with > 6 tweets', () => {
      const plan: PostPlan = {
        post_type: 'thread',
        tweets: Array(7).fill('Tweet content here'),
        thread_goal: 'Too many tweets'
      };
      
      const result = checkPostQuality(plan);
      expect(result.passed).toBe(false);
      expect(result.reason).toBe('THREAD_STRUCTURE_INVALID');
      expect(result.issues).toContain(expect.stringContaining('Too many'));
    });
    
    test('rejects thread with tweet over 280 chars', () => {
      const plan: PostPlan = {
        post_type: 'thread',
        tweets: [
          'First tweet is fine.',
          'A'.repeat(281)
        ],
        thread_goal: 'Test long tweet'
      };
      
      const result = checkPostQuality(plan);
      expect(result.passed).toBe(false);
      expect(result.reason).toBe('THREAD_STRUCTURE_INVALID');
      expect(result.issues).toContain(expect.stringContaining('too long'));
    });
    
    test('warns about short first tweet but passes', () => {
      const plan: PostPlan = {
        post_type: 'thread',
        tweets: [
          'Short.',
          'This is the second tweet with more content about health.',
          'Final takeaway: consistency matters.'
        ],
        thread_goal: 'Test short hook'
      };
      
      const result = checkPostQuality(plan);
      expect(result.passed).toBe(false); // Should fail on short hook
      expect(result.issues).toContain(expect.stringContaining('too short to be a hook'));
    });
    
    test('allows numbering in threads', () => {
      const plan: PostPlan = {
        post_type: 'thread',
        tweets: [
          '1/ The benefits of cold showers are backed by science.',
          '2/ Cold exposure activates brown fat and boosts metabolism.',
          '3/ Bottom line: start with 30 seconds and work your way up.'
        ],
        thread_goal: 'Explain cold shower benefits'
      };
      
      const result = checkPostQuality(plan);
      expect(result.passed).toBe(true);
    });
  });
});

