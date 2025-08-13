import fs from 'fs';
import path from 'path';

const SESSION_DIR = '/app/data';
const SESSION_FILE = path.join(SESSION_DIR, 'twitter_session.json');

/**
 * Ensures Twitter session is ready for Playwright consumption
 * Should be called BEFORE any Playwright imports to avoid timing issues
 */
export function ensureTwitterSessionReady(): void {
  // Ensure directory exists
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }

  // If TWITTER_SESSION_B64 env var is present, decode and write
  const sessionB64 = process.env.TWITTER_SESSION_B64;
  if (sessionB64 && sessionB64.trim().length > 0) {
    try {
      const decoded = Buffer.from(sessionB64.trim(), 'base64').toString('utf8');
      const sessionData = JSON.parse(decoded);
      
      // Count cookies for logging
      const cookieCount = sessionData.cookies ? sessionData.cookies.length : 0;
      
      // Write to file
      fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionData, null, 2));
      
      // Log success with cookie count (mask sensitive data)
      console.log(`SESSION_LOADER: wrote ${SESSION_FILE} with ${cookieCount} cookies`);
      
      // Optionally log masked cookie names for debugging
      if (sessionData.cookies && sessionData.cookies.length > 0) {
        const cookieNames = sessionData.cookies.map((c: any) => c.name).slice(0, 5);
        const displayNames = cookieNames.join(', ') + (sessionData.cookies.length > 5 ? '...' : '');
        console.log(`SESSION_LOADER: cookie names (first 5): ${displayNames}`);
      }
      
    } catch (error) {
      console.error('SESSION_LOADER: Failed to decode TWITTER_SESSION_B64:', error instanceof Error ? error.message : 'Unknown error');
    }
  } else {
    // Check if file already exists from previous sessions
    if (fs.existsSync(SESSION_FILE)) {
      try {
        const existing = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
        const cookieCount = existing.cookies ? existing.cookies.length : 0;
        console.log(`SESSION_LOADER: using existing ${SESSION_FILE} with ${cookieCount} cookies`);
      } catch {
        console.log(`SESSION_LOADER: existing ${SESSION_FILE} found but invalid, will create fresh session`);
      }
    } else {
      console.log(`SESSION_LOADER: TWITTER_SESSION_B64 not set; expected at ${SESSION_FILE}`);
    }
  }
}

/**
 * Save current storage state back to file after successful post
 * Optionally prints masked base64 for rotation if PRINT_SESSION_B64_ON_SAVE=true
 */
export function saveStorageStateBack(storageState: any): void {
  try {
    // Ensure directory exists
    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
    }
    
    // Write updated session
    fs.writeFileSync(SESSION_FILE, JSON.stringify(storageState, null, 2));
    
    const cookieCount = storageState.cookies ? storageState.cookies.length : 0;
    console.log(`SESSION_LOADER: saved updated session with ${cookieCount} cookies`);
    
    // Optional debug helper for session rotation
    if (process.env.PRINT_SESSION_B64_ON_SAVE === 'true') {
      const encoded = Buffer.from(JSON.stringify(storageState)).toString('base64');
      const masked = encoded.substring(0, 20) + '...' + encoded.substring(encoded.length - 20);
      console.log(`SESSION_EXPORT: base64 updated (masked: ${masked}) — copy to TWITTER_SESSION_B64 if you rotated login`);
    }
    
  } catch (error) {
    console.error('SESSION_LOADER: Failed to save storage state back:', error instanceof Error ? error.message : 'Unknown error');
  }
}