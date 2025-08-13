import { writeSessionFromB64, readSession, SESSION_FILE, cookieNames } from "../lib/sessionState";

export function ensureSessionStorageFile() {
  const b64 = process.env.TWITTER_SESSION_B64;
  if (b64 && b64.trim().length > 0) {
    const n = writeSessionFromB64(b64.trim());
    // Log absolute path and cookie names (not values)
    const names = cookieNames(readSession());
    console.log(`SESSION_LOADER: wrote ${SESSION_FILE} with ${n} cookies → [${names.join(", ")}]`);
  } else {
    console.log(`SESSION_LOADER: TWITTER_SESSION_B64 not set; expected at ${SESSION_FILE}`);
  }
}