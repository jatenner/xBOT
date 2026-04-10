import * as fs from 'fs';
import * as path from 'path';
import type { BrowserContext } from 'playwright';

/** Session file path: use resolver when RUNNER_MODE so local executor never uses /app/data. */
function getSessionFile(): string {
  if (process.env.RUNNER_MODE === 'true' || process.env.RUNNER_MODE === '1') {
    const { resolveSessionPath } = require('./sessionPathResolver');
    return resolveSessionPath();
  }
  return process.env.NODE_ENV === 'production'
    ? '/app/data/twitter_session.json'
    : path.join(process.cwd(), 'data', 'twitter_session.json');
}

export interface StorageState {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
  }>;
  origins: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
  }>;
}

export function ensureSessionFromEnv(): string | null {
  const sessionFile = getSessionFile();
  const b64 = process.env.TWITTER_SESSION_B64;

  if (b64 && b64.trim().length > 0) {
    console.log(`SESSION_LOADER: TWITTER_SESSION_B64 detected; writing ${sessionFile}`);

    fs.mkdirSync(path.dirname(sessionFile), { recursive: true });

    const sessionData = Buffer.from(b64.trim(), 'base64').toString('utf8');
    fs.writeFileSync(sessionFile, sessionData);

    return sessionFile;
  }

  if (fs.existsSync(sessionFile)) {
    return sessionFile;
  }

  return null;
}

export function loadSessionState(): StorageState | null {
  const sessionPath = ensureSessionFromEnv();
  
  if (!sessionPath) {
    return null;
  }
  
  try {
    const raw = fs.readFileSync(sessionPath, 'utf8');
    return JSON.parse(raw) as StorageState;
  } catch {
    return null;
  }
}

export function createContextWithSession(browser: any): Promise<BrowserContext> {
  const state = loadSessionState();

  if (state) {
    const cookieCount = state.cookies?.length ?? 0;
    console.log(`PLAYWRIGHT_STORAGE: loaded ${cookieCount} cookies (path: ${getSessionFile()})`);
  }

  return browser.newContext({
    storageState: state ?? undefined
  });
}