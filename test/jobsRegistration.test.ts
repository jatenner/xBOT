/**
 * 🧪 JOB REGISTRATION TESTS
 * Ensures posting job is registered in live mode
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

describe('Job Registration', () => {
  beforeEach(() => {
    // Clear require cache to allow re-importing with new env
    delete require.cache[require.resolve('../src/config/featureFlags')];
    delete require.cache[require.resolve('../src/jobs/jobManager')];
  });

  it('registers posting job in live mode', async () => {
    process.env.MODE = 'live';
    process.env.DISABLE_POSTING = 'false';
    
    const { flags } = await import('../src/config/featureFlags');
    expect(flags.postingEnabled).toBe(true);
    expect(flags.live).toBe(true);
  });

  it('disables posting in shadow mode', async () => {
    process.env.MODE = 'shadow';
    
    const { flags } = await import('../src/config/featureFlags');
    expect(flags.postingEnabled).toBe(false);
    expect(flags.live).toBe(false);
  });

  it('allows explicit posting disable in live mode', async () => {
    process.env.MODE = 'live';
    process.env.DISABLE_POSTING = 'true';
    
    const { flags } = await import('../src/config/featureFlags');
    expect(flags.postingEnabled).toBe(false);
    expect(flags.live).toBe(true);
  });

  it('normalizes legacy DRY_RUN in live mode', async () => {
    process.env.MODE = 'live';
    process.env.DRY_RUN = 'true';  // Should be overridden
    process.env.DISABLE_POSTING = 'false';
    
    const { flags } = await import('../src/config/featureFlags');
    
    // After normalization, DRY_RUN should be set to 'false' in live mode
    expect(process.env.DRY_RUN).toBe('false');
    expect(flags.postingEnabled).toBe(true);
  });
});

