/**
 * Tests for the parent-author reply-detection logic.
 *
 * The DOM extractor inside replyAuthorEngagementChecker scans the parent's
 * thread page for articles authored by the parent author. For each such
 * article it pulls the "Replying to @X" target(s). We test that logic
 * against fixture HTML-like text (no real browser).
 */

import { describe, it, expect } from '@jest/globals';

// Replicates the in-page extraction logic for a single article's body text.
// Returns the lowercased usernames the parent author replied to.
function extractRepliedTo(articleBody: string, parentAuthor: string): Set<string> {
  // Regex equivalent to the in-page implementation.
  const rx = /Replying to\s+((?:@[a-zA-Z0-9_]+(?:[\s,]+)?)+)/gi;
  const replied = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = rx.exec(articleBody)) !== null) {
    const users = m[1].match(/@[a-zA-Z0-9_]+/g) || [];
    for (const u of users) replied.add(u.substring(1).toLowerCase());
  }
  return replied;
}

describe('replyAuthorEngagementChecker — parsing "Replying to @X"', () => {
  it('detects single reply target', () => {
    const body = 'Replying to @alice\nGreat point — agreed.';
    expect(Array.from(extractRepliedTo(body, 'parent_handle'))).toEqual(['alice']);
  });

  it('detects multiple reply targets in one block', () => {
    const body = 'Replying to @alice @bob @carol\nThanks all.';
    expect(extractRepliedTo(body, 'parent_handle')).toEqual(new Set(['alice', 'bob', 'carol']));
  });

  it('lowercases captured usernames (X is case-insensitive on handles)', () => {
    const body = 'Replying to @AliceCAT';
    expect(extractRepliedTo(body, 'parent_handle')).toEqual(new Set(['alicecat']));
  });

  it('returns empty when there is no reply context', () => {
    const body = 'Just a standalone tweet, no reply marker.';
    expect(extractRepliedTo(body, 'parent_handle').size).toBe(0);
  });

  it('handles separators (newlines, commas, tabs)', () => {
    const body = 'Replying to @alice,@bob\t@carol';
    expect(extractRepliedTo(body, 'parent_handle')).toEqual(new Set(['alice', 'bob', 'carol']));
  });

  it('does NOT match arbitrary @mentions in tweet body', () => {
    const body = 'Hey @alice, check out @bob — lots of cool stuff.';
    expect(extractRepliedTo(body, 'parent_handle').size).toBe(0);
  });
});

describe('replyAuthorEngagementChecker — flag resolution per row', () => {
  // Mirrors the per-row update decision: did the parent author reply to THIS
  // captured reply's author?
  function computeFlagPerRow(
    repliedTo: Set<string>,
    capturedReplyAuthors: string[],
  ): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    for (const author of capturedReplyAuthors) {
      out[author] = repliedTo.has(author.toLowerCase());
    }
    return out;
  }

  it('flags TRUE for reply authors the parent engaged with', () => {
    const result = computeFlagPerRow(new Set(['alice', 'bob']), ['alice', 'carol']);
    expect(result).toEqual({ alice: true, carol: false });
  });

  it('flags FALSE when parent author replied to someone we did not capture', () => {
    const result = computeFlagPerRow(new Set(['ghost']), ['alice', 'bob']);
    expect(result).toEqual({ alice: false, bob: false });
  });

  it('handles case mismatches (captured handle was uppercase)', () => {
    const result = computeFlagPerRow(new Set(['alice']), ['Alice']);
    expect(result).toEqual({ Alice: true });
  });
});
