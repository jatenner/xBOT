import * as fs from 'fs';
import * as path from 'path';

// Set correct Playwright browsers path before any Playwright imports
if (!process.env.PLAYWRIGHT_BROWSERS_PATH || process.env.PLAYWRIGHT_BROWSERS_PATH === "0") {
  process.env.PLAYWRIGHT_BROWSERS_PATH = "/ms-playwright";
}

// Decode TWITTER_SESSION_B64 env var into data/twitter_session.json
if (process.env.TWITTER_SESSION_B64) {
  try {
    const dataDir = path.resolve('data');
    const sessionPath = path.join(dataDir, 'twitter_session.json');
    
    // Create data directory if it doesn't exist
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Decode base64 session data
    const sessionData = Buffer.from(process.env.TWITTER_SESSION_B64, 'base64').toString('utf8');
    const sessionJson = JSON.parse(sessionData);
    
    // Write session file
    fs.writeFileSync(sessionPath, JSON.stringify(sessionJson, null, 2));
    
    const cookieCount = (sessionJson.cookies || []).length;
    console.log(`✅ SESSION: Decoded TWITTER_SESSION_B64 → data/twitter_session.json (${cookieCount} cookies)`);
  } catch (error) {
    console.error('❌ SESSION: Failed to decode TWITTER_SESSION_B64:', error instanceof Error ? error.message : error);
  }
}