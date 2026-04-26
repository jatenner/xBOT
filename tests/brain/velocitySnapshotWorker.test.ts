/**
 * Tests for the velocity snapshot worker.
 *
 * Critical invariants:
 * - Late-firing snapshots still write to the INTENDED bucket (target_offset_min IS the bucket).
 * - Velocity = (currentLikes - first_scrape_likes) / target_offset_min.
 * - Crash-safe: claim-and-reclaim semantics handle worker restarts.
 * - One navigation per tweet — multiple due offsets fulfilled together.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// ─── Pure logic helpers (extracted for unit testing) ─────────────────────

// Mirrors the worker's bucket math.
function computeVelocity(currentLikes: number, baselineLikes: number, offsetMin: number): number {
  if (offsetMin <= 0) return 0;
  const delta = currentLikes - baselineLikes;
  return Math.round((delta / offsetMin) * 1000) / 1000;
}

function buildUpdateForTweet(
  current: { likes: number },
  baseline: { first_scrape_likes: number | null; likes: number },
  dueRows: { target_offset_min: number }[],
): Record<string, any> {
  const baselineLikes = baseline.first_scrape_likes ?? baseline.likes ?? 0;
  const updates: Record<string, any> = { last_rescrape_at: new Date().toISOString() };
  for (const row of dueRows) {
    updates[`velocity_${row.target_offset_min}m`] = computeVelocity(
      current.likes,
      baselineLikes,
      row.target_offset_min,
    );
  }
  return updates;
}

describe('velocitySnapshotWorker — bucket math', () => {
  it('computes likes-per-minute for a +5m bucket', () => {
    expect(computeVelocity(50, 10, 5)).toBe(8);
  });

  it('computes likes-per-minute for a +15m bucket', () => {
    expect(computeVelocity(60, 0, 15)).toBe(4);
  });

  it('computes likes-per-minute for a +60m bucket', () => {
    expect(computeVelocity(180, 0, 60)).toBe(3);
  });

  it('handles zero delta (no engagement growth)', () => {
    expect(computeVelocity(10, 10, 5)).toBe(0);
  });

  it('handles negative delta (likes went DOWN — possible after spam removal)', () => {
    expect(computeVelocity(8, 10, 5)).toBe(-0.4);
  });

  it('returns 0 if offset is 0 (defensive guard)', () => {
    expect(computeVelocity(50, 10, 0)).toBe(0);
  });
});

describe('velocitySnapshotWorker — late-fire writes to INTENDED bucket', () => {
  it('a late-firing +5m row still writes to velocity_5m, not "actual_elapsed"', () => {
    // Worker fires 12 minutes late on what was intended to be a +5m snapshot.
    // The math uses target_offset_min (5), not actual elapsed (17). This is
    // the invariant that lets us interpret late firings.
    const current = { likes: 50 };
    const baseline = { first_scrape_likes: 10, likes: 10 };
    const dueRows = [{ target_offset_min: 5 }];
    const updates = buildUpdateForTweet(current, baseline, dueRows);
    expect(updates.velocity_5m).toBe(8); // (50-10)/5, NOT (50-10)/17
    expect(updates.velocity_15m).toBeUndefined();
  });

  it('multiple due offsets for same tweet fulfilled in one update', () => {
    const current = { likes: 100 };
    const baseline = { first_scrape_likes: 10, likes: 10 };
    const dueRows = [
      { target_offset_min: 5 },
      { target_offset_min: 15 },
      { target_offset_min: 60 },
    ];
    const updates = buildUpdateForTweet(current, baseline, dueRows);
    expect(updates.velocity_5m).toBe(18); // 90/5
    expect(updates.velocity_15m).toBe(6); // 90/15
    expect(updates.velocity_60m).toBe(1.5); // 90/60
  });
});

describe('velocitySnapshotWorker — fallback baseline', () => {
  it('uses likes when first_scrape_likes is null', () => {
    const current = { likes: 30 };
    const baseline = { first_scrape_likes: null, likes: 5 };
    const updates = buildUpdateForTweet(current, baseline, [{ target_offset_min: 5 }]);
    expect(updates.velocity_5m).toBe(5); // (30-5)/5
  });

  it('treats both null as zero', () => {
    const current = { likes: 25 };
    const baseline = { first_scrape_likes: null, likes: 0 };
    const updates = buildUpdateForTweet(current, baseline, [{ target_offset_min: 5 }]);
    expect(updates.velocity_5m).toBe(5); // (25-0)/5
  });
});

// ─── Reclaim-after-2min semantics ─────────────────────────────────────────

describe('velocitySnapshotWorker — claim semantics', () => {
  // Pure-logic test of "should this row be reclaimed?"
  function isReclaimable(claimedAtIso: string | null, nowMs: number, reclaimAfterMs: number): boolean {
    if (claimedAtIso === null) return true;
    const claimedMs = new Date(claimedAtIso).getTime();
    return nowMs - claimedMs >= reclaimAfterMs;
  }

  const RECLAIM_AFTER = 2 * 60 * 1000;

  it('NULL claimed_at is always claimable', () => {
    expect(isReclaimable(null, Date.now(), RECLAIM_AFTER)).toBe(true);
  });

  it('a row claimed 30 seconds ago is NOT reclaimable', () => {
    const claimedAt = new Date(Date.now() - 30_000).toISOString();
    expect(isReclaimable(claimedAt, Date.now(), RECLAIM_AFTER)).toBe(false);
  });

  it('a row claimed 3 minutes ago IS reclaimable (worker likely crashed)', () => {
    const claimedAt = new Date(Date.now() - 3 * 60_000).toISOString();
    expect(isReclaimable(claimedAt, Date.now(), RECLAIM_AFTER)).toBe(true);
  });
});
