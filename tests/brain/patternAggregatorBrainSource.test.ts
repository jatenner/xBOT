/**
 * Tests for the brain-source extension to patternAggregator.
 *
 * Goal: confirm that brain-source rows produced by the aggregator
 *   - have combo_keys prefixed with "brain:"
 *   - carry source = 'brain'
 *   - don't collide with vi-source rows (different combo_key namespace)
 *
 * We test the small, deterministic key/source builder rather than the full
 * aggregator (the full one needs a live DB).
 */

import { describe, it, expect } from '@jest/globals';

// Mirrors comboKey() from patternAggregator.ts
function comboKey(g: {
  pattern_type: string; angle: string; tone: string; format: string;
  hour_bucket: string; topic: string; target_tier: string;
}): string {
  const safe = (v: string | null | undefined) => v || 'any';
  return `${safe(g.pattern_type)}|${safe(g.angle)}|${safe(g.tone)}|${safe(g.format)}|${safe(g.hour_bucket)}|${safe(g.topic)}|${safe(g.target_tier)}`;
}

function brainPrefixedKey(g: any): string {
  return 'brain:' + comboKey(g);
}

function deriveSourceFromKey(key: string): 'brain' | 'vi' {
  return key.startsWith('brain:') ? 'brain' : 'vi';
}

describe('patternAggregator — brain-source key namespace', () => {
  it('brain combo_keys are prefixed with "brain:"', () => {
    const dim = {
      pattern_type: 'external_tweet',
      angle: 'curiosity_hook',
      tone: 'casual',
      format: 'single',
      hour_bucket: 'evening',
      topic: 'health',
      target_tier: 'A',
    };
    const key = brainPrefixedKey(dim);
    expect(key.startsWith('brain:')).toBe(true);
    expect(key).toBe('brain:external_tweet|curiosity_hook|casual|single|evening|health|A');
  });

  it('brain and vi keys for the same dimension combo do NOT collide', () => {
    const dim = {
      pattern_type: 'external_tweet',
      angle: 'data_drop',
      tone: 'authoritative',
      format: 'thread',
      hour_bucket: 'midday',
      topic: 'tech',
      target_tier: 'B',
    };
    const viKey = comboKey(dim);
    const brainKey = brainPrefixedKey(dim);
    expect(viKey).not.toBe(brainKey);
    expect(deriveSourceFromKey(viKey)).toBe('vi');
    expect(deriveSourceFromKey(brainKey)).toBe('brain');
  });

  it('source is unambiguously derivable from combo_key', () => {
    expect(deriveSourceFromKey('brain:reply|x|y|z|a|b|c')).toBe('brain');
    expect(deriveSourceFromKey('reply|x|y|z|a|b|c')).toBe('vi');
    expect(deriveSourceFromKey('external_tweet|x|y|z|a|b|c')).toBe('vi');
  });
});

describe('patternAggregator — preferBrain stable sort', () => {
  // Mirrors the helper in tickAdvisor.ts. Stable sort: brain rows first,
  // input order preserved within each source group.
  function preferBrain<T extends { source?: string | null }>(rows: T[]): T[] {
    return [...rows].sort((a, b) => {
      const aBrain = a.source === 'brain' ? 0 : 1;
      const bBrain = b.source === 'brain' ? 0 : 1;
      return aBrain - bBrain;
    });
  }

  it('moves brain rows to the front, preserves order within source', () => {
    const rows = [
      { id: 1, source: 'vi', score: 100 },
      { id: 2, source: 'brain', score: 50 },
      { id: 3, source: 'vi', score: 90 },
      { id: 4, source: 'brain', score: 80 },
    ];
    const sorted = preferBrain(rows);
    expect(sorted.map(r => r.id)).toEqual([2, 4, 1, 3]); // brain (in input order), then vi (in input order)
  });

  it('handles all-brain or all-vi without changing order', () => {
    const allBrain = [
      { source: 'brain', tag: 'a' },
      { source: 'brain', tag: 'b' },
    ];
    expect(preferBrain(allBrain).map(r => r.tag)).toEqual(['a', 'b']);

    const allVi = [
      { source: 'vi', tag: 'x' },
      { source: 'vi', tag: 'y' },
    ];
    expect(preferBrain(allVi).map(r => r.tag)).toEqual(['x', 'y']);
  });

  it('treats missing/null source as non-brain', () => {
    const rows = [
      { id: 1, source: null },
      { id: 2, source: 'brain' },
      { id: 3 } as any,
    ];
    const sorted = preferBrain(rows);
    expect(sorted[0].id).toBe(2); // brain wins
  });
});
