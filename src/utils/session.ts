import * as fs from 'fs';
import * as path from 'path';
import type { BrowserContext } from 'playwright';

const SESSION_FILE = process.env.NODE_ENV === 'production' 
  ? '/app/data/twitter_session.json' 
  : path.join(process.cwd(), 'data', 'twitter_session.json');

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
  const b64 = process.env.TWITTER_SESSION_B64;
  
  if (b64 && b64.trim().length > 0) {
    console.log(`SESSION_LOADER: TWITTER_SESSION_B64 detected; writing ${SESSION_FILE}`);
    
    // Ensure directory exists
    fs.mkdirSync(path.dirname(SESSION_FILE), { recursive: true });
    
    // Decode and write
    const sessionData = Buffer.from(b64.trim(), 'base64').toString('utf8');
    fs.writeFileSync(SESSION_FILE, sessionData);
    
    return SESSION_FILE;
  }
  
  // Fallback: check if file exists
  if (fs.existsSync(SESSION_FILE)) {
    return SESSION_FILE;
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
    console.log(`PLAYWRIGHT_STORAGE: loaded ${cookieCount} cookies (path: ${SESSION_FILE})`);
  }
  
  return browser.newContext({
    storageState: state ?? undefined
  });
}