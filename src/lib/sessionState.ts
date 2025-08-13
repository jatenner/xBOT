// src/lib/sessionState.ts
import fs from "fs";
import path from "path";
// Use a simple type instead of importing from playwright
export interface StorageState {
  cookies?: Array<{
    name: string;
    value: string;
    domain?: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: string;
  }>;
  origins?: Array<{
    origin: string;
    localStorage?: Array<{
      name: string;
      value: string;
    }>;
  }>;
}

export const SESSION_FILE = path.resolve(
  process.env.TWITTER_SESSION_PATH ?? path.join(process.cwd(), "data", "twitter_session.json")
);

export function ensureSessionDir() {
  fs.mkdirSync(path.dirname(SESSION_FILE), { recursive: true });
}

export function writeSessionFromB64(b64: string): number {
  ensureSessionDir();
  const buf = Buffer.from(b64, "base64");
  fs.writeFileSync(SESSION_FILE, buf);
  const s = readSession();
  return s?.cookies?.length ?? 0;
}

export function readSession(): StorageState | null {
  try {
    if (!fs.existsSync(SESSION_FILE)) return null;
    const raw = fs.readFileSync(SESSION_FILE, "utf8");
    return JSON.parse(raw) as StorageState;
  } catch {
    return null;
  }
}

export function cookieNames(state: StorageState | null): string[] {
  return state?.cookies?.map(c => c.name) ?? [];
}