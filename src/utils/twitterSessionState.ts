import fs from 'fs';
import { SessionLoader } from './sessionLoader';
import type { BrowserContext } from 'playwright';

export type TwitterStorageState = Awaited<ReturnType<BrowserContext['storageState']>>;

type CookieEntry = TwitterStorageState['cookies'][number];

export interface TwitterStorageStateResult {
  storageState?: TwitterStorageState;
  source: 'env' | 'file' | 'none';
  cookieCount: number;
  updatedAt?: string;
  warnings?: string[];
}

type RawStorageState = Partial<TwitterStorageState> | CookieEntry[] | null | undefined;

/**
 * Load Twitter storage state from the canonical session sources (env or file)
 * and normalize cookie domains for both .twitter.com and .x.com.
 */
export async function loadTwitterStorageState(): Promise<TwitterStorageStateResult> {
  const warnings: string[] = [];

  try {
    const sessionResult = SessionLoader.load();

    if (sessionResult.ok && fs.existsSync(sessionResult.path)) {
      const raw = JSON.parse(fs.readFileSync(sessionResult.path, 'utf8')) as RawStorageState;
      const storageState = normalizeStorageState(raw);

      return {
        storageState,
        source: sessionResult.source,
        cookieCount: storageState.cookies.length,
        updatedAt: sessionResult.updatedAt,
        warnings,
      };
    }
  } catch (error) {
    warnings.push(`SessionLoader load failed: ${(error as Error).message}`);
  }

  // Fallback to direct environment variable decoding
  const sessionB64 = process.env.TWITTER_SESSION_B64?.trim();
  if (sessionB64) {
    try {
      const jsonString = sessionB64.startsWith('{') || sessionB64.startsWith('[')
        ? sessionB64
        : Buffer.from(sessionB64, 'base64').toString('utf8');

      const raw = JSON.parse(jsonString) as RawStorageState;
      const storageState = normalizeStorageState(raw);

      return {
        storageState,
        source: 'env',
        cookieCount: storageState.cookies.length,
        warnings,
      };
    } catch (error) {
      warnings.push(`Env decode failed: ${(error as Error).message}`);
    }
  }

  return {
    storageState: undefined,
    source: 'none',
    cookieCount: 0,
    warnings,
  };
}

/**
 * Create a deep clone of the provided storage state. Playwright mutates the
 * storage object internally, so callers should supply a fresh object per context.
 */
export function cloneStorageState(state: TwitterStorageState): TwitterStorageState {
  return {
    cookies: state.cookies.map(cookie => ({ ...cookie })),
    origins: state.origins.map(origin => ({
      origin: origin.origin,
      localStorage: origin.localStorage.map(entry => ({ ...entry })),
    })),
  };
}

/**
 * Normalize cookies for cross-domain compatibility between twitter.com and x.com.
 */
function normalizeStorageState(raw: RawStorageState): TwitterStorageState {
  const cookies = extractCookies(raw);
  const origins = extractOrigins(raw);

  const seen = new Set<string>();
  const normalizedCookies: CookieEntry[] = [];

  for (const cookie of cookies) {
    if (!cookie?.name || cookie.value === undefined || cookie.value === null) {
      continue;
    }

    const sanitized = sanitizeCookie(cookie);
    const variants = expandDomains(sanitized);

    for (const variant of variants) {
      const key = `${variant.name}|${variant.domain}|${variant.path}|${variant.secure}`;
      if (seen.has(key)) continue;
      seen.add(key);
      normalizedCookies.push(variant);
    }
  }

  return {
    cookies: normalizedCookies,
    origins,
  };
}

function extractCookies(raw: RawStorageState): CookieEntry[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as CookieEntry[];
  const maybeState = raw as TwitterStorageState;
  if (Array.isArray(maybeState.cookies)) {
    return maybeState.cookies!;
  }
  return [];
}

function extractOrigins(raw: RawStorageState): TwitterStorageState['origins'] {
  if (!raw) return [];
  const maybeState = raw as TwitterStorageState;
  if (Array.isArray(maybeState.origins)) {
    return maybeState.origins!.map(origin => ({
      origin: origin.origin,
      localStorage: Array.isArray(origin.localStorage)
        ? origin.localStorage.map(entry => ({ ...entry }))
        : [],
    }));
  }
  return [];
}

function sanitizeCookie(cookie: CookieEntry): CookieEntry {
  const defaultExpires = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  const sanitizedSameSiteDefault: CookieEntry['sameSite'] = 'Lax';

  const sanitized: CookieEntry = {
    name: cookie.name,
    value: String(cookie.value ?? ''),
    domain: formatDomain(cookie.domain),
    path: cookie.path && cookie.path.length > 0 ? cookie.path : '/',
    secure: cookie.secure !== undefined ? !!cookie.secure : true,
    httpOnly: !!cookie.httpOnly,
    expires: defaultExpires,
    sameSite: sanitizedSameSiteDefault,
  };

  const expires = sanitizeExpires(cookie.expires);
  if (expires !== undefined) {
    sanitized.expires = expires;
  }

  const sameSite = sanitizeSameSite(cookie.sameSite as any);
  if (sameSite) {
    sanitized.sameSite = sameSite;
  }

  return sanitized;
}

function sanitizeExpires(value: CookieEntry['expires']): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.floor(value);
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.floor(parsed);
    }
  }
  return undefined;
}

function sanitizeSameSite(
  value: CookieEntry['sameSite'],
): CookieEntry['sameSite'] | undefined {
  if (!value) return undefined;
  const normalized = String(value).toLowerCase();
  if (normalized === 'lax') return 'Lax';
  if (normalized === 'strict') return 'Strict';
  if (normalized === 'none' || normalized === 'no_restriction') return 'None';
  return undefined;
}

function formatDomain(domain?: string): string {
  if (!domain || domain.trim().length === 0) {
    return '.x.com';
  }
  const trimmed = domain.replace(/^https?:\/\//i, '').trim();
  if (trimmed.startsWith('.')) return trimmed.toLowerCase();
  return `.${trimmed.toLowerCase()}`;
}

function expandDomains(cookie: CookieEntry): CookieEntry[] {
  const domains = new Set<string>();
  const base = cookie.domain;

  domains.add(base);

  if (base.endsWith('.twitter.com')) {
    domains.add('.twitter.com');
    domains.add(base.replace(/\.twitter\.com$/, '.x.com'));
    domains.add('.x.com');
  } else if (base.endsWith('.x.com')) {
    domains.add('.x.com');
    domains.add(base.replace(/\.x\.com$/, '.twitter.com'));
    domains.add('.twitter.com');
  } else if (base.includes('twitter.com')) {
    domains.add('.twitter.com');
    domains.add('.x.com');
  } else if (base.includes('x.com')) {
    domains.add('.twitter.com');
    domains.add('.x.com');
  }

  const variants: CookieEntry[] = [];
  for (const domain of domains) {
    const formatted = formatDomain(domain);
    variants.push({ ...cookie, domain: formatted });
  }

  return variants;
}


