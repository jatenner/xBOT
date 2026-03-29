#!/usr/bin/env tsx
/**
 * Verify OpenAI API key resolution (same path as worker/executor).
 * Uses the SAME env load order as railwayEntrypoint (loadEnvForWorker) so verify and worker
 * always resolve the same key. Logs cwd, pid, source var, masked key, length, dotenv_loaded.
 * Never prints the full secret.
 *
 * Usage: pnpm exec tsx scripts/ops/verify-openai-key-resolution.ts
 */

import { loadEnvForWorker } from '../../src/config/loadEnv';
import { resolveAndSyncOpenAIApiKey, getResolvedOpenAIApiKey } from '../../src/config/openaiApiKey';

async function main() {
  // Same load order as railwayEntrypoint: .env then .env.local (override) so .env.local wins
  const { loaded: dotenvLoaded, cwd } = loadEnvForWorker();

  console.log('[VERIFY_OPENAI] Resolving OpenAI API key (worker path)...');
  const result = resolveAndSyncOpenAIApiKey({
    cwd,
    pid: process.pid,
    dotenvLoaded,
  });
  console.log('[VERIFY_OPENAI] Proof:', {
    cwd,
    pid: process.pid,
    sourceVar: result.sourceVar,
    present: !!result.key,
    length: result.length,
    masked: result.masked,
    wasTrimmed: result.wasTrimmed,
    dotenv_loaded: dotenvLoaded.length ? dotenvLoaded : 'none',
  });

  const key = getResolvedOpenAIApiKey();
  if (!key) {
    console.error('No key resolved. Set OPENAI_API_KEY, OPENAI_KEY, or OPENAI_API_TOKEN.');
    process.exit(1);
  }
  if (!key.startsWith('sk-')) {
    console.error('Resolved key does not start with sk- (invalid format).');
    process.exit(1);
  }
  console.log('[VERIFY_OPENAI] Verification: key present, format sk-*, length', key.length);
  console.log('[VERIFY_OPENAI] SUCCESS: Same env contract as worker — masked key above should match worker boot.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
