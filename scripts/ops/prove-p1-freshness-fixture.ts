#!/usr/bin/env tsx
/**
 * 🧪 P1 FRESHNESS FIXTURE PROOF
 * 
 * Deterministic test of P1 freshness gate override.
 * Tests checkFreshness() with various tweet ages to verify P1_TARGET_MAX_AGE_HOURS override works.
 * 
 * Usage:
 *   P1_MODE=true P1_TARGET_MAX_AGE_HOURS=6 pnpm run ops:prove:p1-freshness-fixture
 */

import { checkFreshness } from '../../src/ai/freshnessController';

interface Fixture {
  tweetId: string;
  likeCount: number;
  ageMinutes: number;
  expectedAccept: boolean;
  description: string;
}

function calculateVelocity(likeCount: number, ageMinutes: number): number {
  if (ageMinutes <= 0) return 0;
  return likeCount / ageMinutes;
}

function main(): void {
  const p1Mode = process.env.P1_MODE === 'true';
  const p1MaxAgeHours = parseInt(process.env.P1_TARGET_MAX_AGE_HOURS || '6', 10);
  const p1MaxAgeMinutes = p1Mode ? p1MaxAgeHours * 60 : undefined;

  console.log(`[P1_FIXTURE] Starting P1 freshness gate fixture proof`);
  console.log(`[P1_FIXTURE] P1_MODE=${p1Mode} P1_TARGET_MAX_AGE_HOURS=${p1MaxAgeHours} p1MaxAgeMinutes=${p1MaxAgeMinutes || 'N/A'}`);

  if (!p1Mode) {
    console.error(`[P1_FIXTURE] FAIL: P1_MODE must be true`);
    process.exit(1);
  }

  // Create fixtures with specific ages
  const now = Date.now();
  const fixtures: Fixture[] = [
    {
      tweetId: 'fixture_45min',
      likeCount: 2000, // Tier D (below 2500)
      ageMinutes: 45,
      expectedAccept: true,
      description: '45 minutes old (within tier D default 90min)'
    },
    {
      tweetId: 'fixture_95min',
      likeCount: 2000,
      ageMinutes: 95,
      expectedAccept: true,
      description: '95 minutes old (slightly above tier D default, within P1 override)'
    },
    {
      tweetId: 'fixture_185min',
      likeCount: 2000,
      ageMinutes: 185,
      expectedAccept: true,
      description: '185 minutes old (above tier D absolute max 180min, within P1 override 360min)'
    },
    {
      tweetId: 'fixture_300min',
      likeCount: 2000,
      ageMinutes: 300,
      expectedAccept: true,
      description: '300 minutes old (5 hours, within P1 override 360min)'
    },
    {
      tweetId: 'fixture_420min',
      likeCount: 2000,
      ageMinutes: 420,
      expectedAccept: false,
      description: '420 minutes old (7 hours, exceeds P1 override 360min)'
    }
  ];

  console.log(`[P1_FIXTURE] Testing ${fixtures.length} fixtures with p1MaxAgeMinutes=${p1MaxAgeMinutes}`);
  console.log(`[P1_FIXTURE] Expected: accept ages <= ${p1MaxAgeMinutes}min, reject ages > ${p1MaxAgeMinutes}min`);
  console.log('');

  let passed = 0;
  let failed = 0;

  for (const fixture of fixtures) {
    const velocity = calculateVelocity(fixture.likeCount, fixture.ageMinutes);
    const result = checkFreshness(fixture.likeCount, fixture.ageMinutes, velocity, p1MaxAgeMinutes);

    const actualAccept = result.pass;
    const match = actualAccept === fixture.expectedAccept;

    console.log(`[P1_FIXTURE] tweet_id=${fixture.tweetId} age_minutes=${fixture.ageMinutes} like_count=${fixture.likeCount}`);
    console.log(`[P1_FRESHNESS] tweet_id=${fixture.tweetId} created_at=fixture age_minutes=${fixture.ageMinutes} applied_max_age_minutes=${p1MaxAgeMinutes || 'tier_default'} decision=${actualAccept ? 'accept' : 'reject'} reason=${result.reason}`);

    if (match) {
      console.log(`[P1_FIXTURE] ✅ PASS: ${fixture.description} - ${actualAccept ? 'accepted' : 'rejected'} as expected`);
      passed++;
    } else {
      console.log(`[P1_FIXTURE] ❌ FAIL: ${fixture.description} - expected ${fixture.expectedAccept ? 'accept' : 'reject'}, got ${actualAccept ? 'accept' : 'reject'}`);
      failed++;
    }
    console.log('');
  }

  console.log(`[P1_FIXTURE] Summary: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log(`[P1_FIXTURE] ✅ PASS: All fixtures match expected behavior`);
    process.exit(0);
  } else {
    console.log(`[P1_FIXTURE] ❌ FAIL: ${failed} fixture(s) did not match expected behavior`);
    process.exit(1);
  }
}

main();
