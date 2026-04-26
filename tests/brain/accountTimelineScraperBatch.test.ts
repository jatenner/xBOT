/**
 * Tests that the account timeline scraper dispatches per-account work
 * concurrently via brainBrowserPool.submitBatch (anon) + submitBatchAuth
 * (auth) instead of the old serial loop.
 *
 * We mock the pool, db, and discoveryEngine so this is a pure orchestration
 * test — not an integration test against a real browser.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('../../src/brain/feeds/brainBrowserPool', () => ({
  submitBatch: jest.fn(),
  submitBatchAuth: jest.fn(),
}));

jest.mock('../../src/brain/feeds/brainNavigator', () => ({
  brainGoto: jest.fn(async () => ({ success: true, loginWall: false, consentAccepted: false })),
  waitForTweets: jest.fn(async () => 5),
}));

jest.mock('../../src/brain/discoveryEngine', () => ({
  extractTweetsFromPage: jest.fn(async () => []),
  extractFollowerCount: jest.fn(async () => 1234),
  ingestFeedResults: jest.fn(async () => ({ total_ingested: 0, total_deduplicated: 0, accounts_discovered: 0 })),
}));

jest.mock('../../src/brain/db', () => ({
  getAccountsForScraping: jest.fn(),
  updateAccountAfterScrape: jest.fn(async () => undefined),
}));

describe('accountTimelineScraper — dispatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('submits N anon tasks (one per account) to submitBatch', async () => {
    const { submitBatch, submitBatchAuth } = await import('../../src/brain/feeds/brainBrowserPool');
    const { getAccountsForScraping } = await import('../../src/brain/db');

    (getAccountsForScraping as jest.Mock).mockResolvedValue([
      { username: 'alice', tier: 'B', growth_status: 'boring' },
      { username: 'bob',   tier: 'A', growth_status: 'boring' },
      { username: 'carol', tier: 'C', growth_status: 'boring' },
    ] as any);

    (submitBatch as jest.Mock).mockResolvedValue({ completed: 3, errors: 0 } as any);
    (submitBatchAuth as jest.Mock).mockResolvedValue({ completed: 0, errors: 0 } as any);

    const { runAccountTimelineScraper } = await import('../../src/brain/feeds/accountTimelineScraper');
    await runAccountTimelineScraper();

    // Three accounts → three anon tasks dispatched in a single submitBatch call.
    expect(submitBatch).toHaveBeenCalledTimes(1);
    const [priority, tasks] = (submitBatch as jest.Mock).mock.calls[0] as [string, Array<unknown>];
    expect(priority).toBe('medium');
    expect(tasks.length).toBe(3);
  });

  it('only submits auth tasks for growing/interesting accounts', async () => {
    const { submitBatch, submitBatchAuth } = await import('../../src/brain/feeds/brainBrowserPool');
    const { getAccountsForScraping } = await import('../../src/brain/db');

    (getAccountsForScraping as jest.Mock).mockResolvedValue([
      { username: 'alice', tier: 'B', growth_status: 'boring' },      // anon only
      { username: 'bob',   tier: 'A', growth_status: 'hot' },         // anon + auth
      { username: 'carol', tier: 'C', growth_status: 'interesting' }, // anon + auth
      { username: 'dave',  tier: 'B', growth_status: 'explosive' },   // anon + auth
    ] as any);

    (submitBatch as jest.Mock).mockResolvedValue({ completed: 4, errors: 0 } as any);
    (submitBatchAuth as jest.Mock).mockResolvedValue({ completed: 3, errors: 0 } as any);

    const { runAccountTimelineScraper } = await import('../../src/brain/feeds/accountTimelineScraper');
    await runAccountTimelineScraper();

    expect(submitBatch).toHaveBeenCalledTimes(1);
    expect(submitBatchAuth).toHaveBeenCalledTimes(1);

    const anonTasks = (submitBatch as jest.Mock).mock.calls[0][1] as Array<unknown>;
    const authTasks = (submitBatchAuth as jest.Mock).mock.calls[0][1] as Array<unknown>;
    expect(anonTasks.length).toBe(4);
    expect(authTasks.length).toBe(3); // bob, carol, dave only
  });

  it('skips submitBatchAuth entirely if no growing accounts', async () => {
    const { submitBatch, submitBatchAuth } = await import('../../src/brain/feeds/brainBrowserPool');
    const { getAccountsForScraping } = await import('../../src/brain/db');

    (getAccountsForScraping as jest.Mock).mockResolvedValue([
      { username: 'alice', tier: 'B', growth_status: 'boring' },
      { username: 'bob',   tier: 'A', growth_status: 'boring' },
    ] as any);

    (submitBatch as jest.Mock).mockResolvedValue({ completed: 2, errors: 0 } as any);

    const { runAccountTimelineScraper } = await import('../../src/brain/feeds/accountTimelineScraper');
    await runAccountTimelineScraper();

    expect(submitBatch).toHaveBeenCalledTimes(1);
    expect(submitBatchAuth).not.toHaveBeenCalled();
  });

  it('falls back gracefully when auth pool is unavailable', async () => {
    const { submitBatch, submitBatchAuth } = await import('../../src/brain/feeds/brainBrowserPool');
    const { getAccountsForScraping } = await import('../../src/brain/db');

    (getAccountsForScraping as jest.Mock).mockResolvedValue([
      { username: 'alice', tier: 'A', growth_status: 'hot' },
    ] as any);

    (submitBatch as jest.Mock).mockResolvedValue({ completed: 1, errors: 0 } as any);
    // Auth pool throws — e.g. session unavailable.
    (submitBatchAuth as jest.Mock).mockRejectedValue(new Error('Auth pool unavailable: no browsers initialized'));

    const { runAccountTimelineScraper } = await import('../../src/brain/feeds/accountTimelineScraper');

    // Must not throw — graceful degradation to anon-only.
    await expect(runAccountTimelineScraper()).resolves.toBeDefined();
  });
});
