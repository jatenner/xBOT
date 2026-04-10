/**
 * Single source of truth for OpenAI API key resolution in worker/runtime.
 * Use this for all OpenAI client construction so the same key is used everywhere.
 *
 * Env precedence: OPENAI_API_KEY > OPENAI_KEY > OPENAI_API_TOKEN
 * Key is trimmed and surrounding quotes are stripped; result is written back to
 * process.env.OPENAI_API_KEY so config/env and all clients see the same value.
 */

const LOG_PREFIX = '[OPENAI_API_KEY]';

/** Mask key for logs: first 4 chars + "..." + last 4 chars only. Never log full key. */
function maskKey(key: string): string {
  if (!key || key.length < 9) return key ? `${key.slice(0, 2)}***` : 'none';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

export interface ResolveResult {
  key: string;
  sourceVar: 'OPENAI_API_KEY' | 'OPENAI_KEY' | 'OPENAI_API_TOKEN';
  wasTrimmed: boolean;
  length: number;
  masked: string;
}

/** Optional context for proof logging (cwd, pid, which env file(s) were loaded). */
export interface OpenAIApiKeyProofContext {
  cwd?: string;
  pid?: number;
  dotenvLoaded?: string[];
}

let resolvedOnce: ResolveResult | null = null;

/**
 * Resolve API key from env with explicit precedence, trim and strip quotes,
 * sync back to process.env.OPENAI_API_KEY. Safe to call multiple times; logs proof once.
 * Call immediately after loading env (e.g. loadEnvForWorker) and before any OpenAI client.
 */
export function resolveAndSyncOpenAIApiKey(proofContext?: OpenAIApiKeyProofContext): ResolveResult {
  if (resolvedOnce) return resolvedOnce;

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
  const OPENAI_KEY = process.env.OPENAI_KEY ?? '';
  const OPENAI_API_TOKEN = process.env.OPENAI_API_TOKEN ?? '';

  let raw: string;
  let sourceVar: 'OPENAI_API_KEY' | 'OPENAI_KEY' | 'OPENAI_API_TOKEN';
  if (OPENAI_API_KEY.trim()) {
    raw = OPENAI_API_KEY;
    sourceVar = 'OPENAI_API_KEY';
  } else if (OPENAI_KEY.trim()) {
    raw = OPENAI_KEY;
    sourceVar = 'OPENAI_KEY';
  } else if (OPENAI_API_TOKEN.trim()) {
    raw = OPENAI_API_TOKEN;
    sourceVar = 'OPENAI_API_TOKEN';
  } else {
    resolvedOnce = { key: '', sourceVar: 'OPENAI_API_KEY', wasTrimmed: false, length: 0, masked: 'none' };
    logOpenAIApiKeyProof(resolvedOnce, { openaiApiKey: !!OPENAI_API_KEY, openaiKey: !!OPENAI_KEY, openaiApiToken: !!OPENAI_API_TOKEN }, proofContext);
    return resolvedOnce;
  }

  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  const wasTrimmed = key !== raw;
  if (key) process.env.OPENAI_API_KEY = key;

  resolvedOnce = {
    key,
    sourceVar,
    wasTrimmed,
    length: key.length,
    masked: maskKey(key),
  };
  logOpenAIApiKeyProof(resolvedOnce, {
    openaiApiKey: !!OPENAI_API_KEY.trim(),
    openaiKey: !!OPENAI_KEY.trim(),
    openaiApiToken: !!OPENAI_API_TOKEN.trim(),
  }, proofContext);
  return resolvedOnce;
}

/**
 * Get the resolved key (triggers resolution if not done). Use this when constructing OpenAI clients.
 */
export function getResolvedOpenAIApiKey(): string {
  const r = resolveAndSyncOpenAIApiKey();
  return r.key;
}

/**
 * Safe proof logging: cwd, pid, source var, masked key, length, dotenv loaded, conflicts.
 * Never logs the full secret.
 */
export function logOpenAIApiKeyProof(
  result: ResolveResult,
  otherVars?: { openaiApiKey?: boolean; openaiKey?: boolean; openaiApiToken?: boolean },
  proofContext?: OpenAIApiKeyProofContext
): void {
  const present = !!result.key;
  const conflicts: string[] = [];
  if (otherVars) {
    if (result.sourceVar !== 'OPENAI_API_KEY' && otherVars.openaiApiKey) conflicts.push('OPENAI_API_KEY');
    if (result.sourceVar !== 'OPENAI_KEY' && otherVars.openaiKey) conflicts.push('OPENAI_KEY');
    if (result.sourceVar !== 'OPENAI_API_TOKEN' && otherVars.openaiApiToken) conflicts.push('OPENAI_API_TOKEN');
  }
  const cwd = proofContext?.cwd ?? process.cwd();
  const pid = proofContext?.pid ?? process.pid;
  const dotenvLoaded = proofContext?.dotenvLoaded?.length ? proofContext.dotenvLoaded.join(',') : 'none';
  console.log(
    `${LOG_PREFIX} cwd=${cwd} pid=${pid} source=${result.sourceVar} present=${present} length=${result.length} masked=${result.masked} trimmed=${result.wasTrimmed} dotenv_loaded=${dotenvLoaded}` +
      (conflicts.length ? ` other_vars_set=[${conflicts.join(',')}]` : '')
  );
  if (conflicts.length) {
    console.warn(`${LOG_PREFIX} Multiple OpenAI key env vars set; precedence used: OPENAI_API_KEY > OPENAI_KEY > OPENAI_API_TOKEN`);
  }
}
