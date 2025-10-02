#!/usr/bin/env node
/**
 * 🏠 LOCAL BROWSER SERVER
 * Runs Playwright browser on your Mac, controlled by Railway
 * 
 * Railway sends posting requests → Your Mac executes them → Returns result
 */

const express = require('express');
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));

// Security: Only accept requests from Railway
const RAILWAY_SECRET = process.env.BROWSER_SERVER_SECRET || 'change-me-in-production';
const PORT = process.env.BROWSER_SERVER_PORT || 3100;
const SESSION_PATH = path.join(__dirname, 'data', 'twitter_session.json');

// Middleware: Verify requests from Railway
function verifyRailway(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== RAILWAY_SECRET) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
}

// Apply stealth techniques
async function applyStealth(context) {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { description: 'Portable Document Format', filename: 'internal-pdf-viewer', length: 1, name: 'PDF Viewer' }
      ],
    });
    window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {}, app: {} };
  });
}

// Load session cookies
function loadSession() {
  try {
    const raw = fs.readFileSync(SESSION_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('❌ Failed to load session:', error.message);
    return null;
  }
}

/**
 * POST /post - Post a tweet
 * Body: { text: string }
 */
app.post('/post', verifyRailway, async (req, res) => {
  const { text } = req.body;
  
  if (!text) {
    return res.status(400).json({ success: false, error: 'Missing text' });
  }
  
  console.log(`\n🚀 [${new Date().toISOString()}] Posting tweet (${text.length} chars)...`);
  
  let context;
  try {
    // Launch browser with stealth
    console.log('🌐 Launching browser...');
    context = await chromium.launchPersistentContext('/tmp/xbot-local-profile', {
      headless: false, // VISIBLE for debugging
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
      ],
      viewport: { width: 1920, height: 1080 },
    });
    
    await applyStealth(context);
    
    // Load session cookies
    const session = loadSession();
    if (session?.cookies) {
      await context.addCookies(session.cookies);
      console.log(`🍪 Loaded ${session.cookies.length} cookies`);
    }
    
    const page = await context.newPage();
    await page.goto('https://twitter.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Check if logged in
    const composeButton = page.locator('[data-testid="SideNav_NewTweet_Button"]');
    const isLoggedIn = await composeButton.isVisible({ timeout: 5000 });
    
    if (!isLoggedIn) {
      console.error('❌ Not logged in to Twitter');
      await context.close();
      return res.json({ success: false, error: 'Not logged in' });
    }
    
    console.log('✅ Logged in, composing tweet...');
    
    // Compose tweet
    await composeButton.click();
    await page.waitForTimeout(1000);
    
    const textarea = page.locator('[data-testid="tweetTextarea_0"]');
    await textarea.fill(text);
    await page.waitForTimeout(1500);
    
    // Post tweet
    const postButton = page.locator('[data-testid="tweetButtonInline"]');
    await postButton.click();
    await page.waitForTimeout(5000); // Wait for post to complete
    
    // Extract tweet ID from URL
    const currentUrl = page.url();
    const tweetIdMatch = currentUrl.match(/\/status\/(\d+)/);
    const tweetId = tweetIdMatch ? tweetIdMatch[1] : `posted_${Date.now()}`;
    
    await context.close();
    
    console.log(`✅ Posted successfully! ID: ${tweetId}\n`);
    
    res.json({
      success: true,
      tweetId,
      postedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (context) await context.close().catch(() => {});
    
    res.json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /thread - Post a thread
 * Body: { tweets: string[] }
 */
app.post('/thread', verifyRailway, async (req, res) => {
  const { tweets } = req.body;
  
  if (!tweets || !Array.isArray(tweets) || tweets.length === 0) {
    return res.status(400).json({ success: false, error: 'Missing tweets array' });
  }
  
  console.log(`\n🧵 [${new Date().toISOString()}] Posting thread (${tweets.length} tweets)...`);
  
  let context;
  const postedIds = [];
  
  try {
    context = await chromium.launchPersistentContext('/tmp/xbot-local-profile', {
      headless: false,
      args: ['--disable-blink-features=AutomationControlled', '--disable-web-security'],
      viewport: { width: 1920, height: 1080 },
    });
    
    await applyStealth(context);
    
    const session = loadSession();
    if (session?.cookies) {
      await context.addCookies(session.cookies);
    }
    
    const page = await context.newPage();
    await page.goto('https://twitter.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    const composeButton = page.locator('[data-testid="SideNav_NewTweet_Button"]');
    const isLoggedIn = await composeButton.isVisible({ timeout: 5000 });
    
    if (!isLoggedIn) {
      await context.close();
      return res.json({ success: false, error: 'Not logged in' });
    }
    
    // Post first tweet
    await composeButton.click();
    await page.waitForTimeout(1000);
    await page.locator('[data-testid="tweetTextarea_0"]').fill(tweets[0]);
    await page.waitForTimeout(1500);
    await page.locator('[data-testid="tweetButtonInline"]').click();
    await page.waitForTimeout(5000);
    
    const firstUrl = page.url();
    const firstIdMatch = firstUrl.match(/\/status\/(\d+)/);
    postedIds.push(firstIdMatch ? firstIdMatch[1] : `thread_0_${Date.now()}`);
    console.log(`✅ Posted tweet 1/${tweets.length}`);
    
    // Post subsequent tweets as replies
    for (let i = 1; i < tweets.length; i++) {
      await page.waitForTimeout(2000);
      await page.locator('[data-testid="reply"]').first().click();
      await page.waitForTimeout(1000);
      await page.locator('[data-testid="tweetTextarea_0"]').fill(tweets[i]);
      await page.waitForTimeout(1500);
      await page.locator('[data-testid="tweetButtonInline"]').click();
      await page.waitForTimeout(5000);
      
      postedIds.push(`thread_${i}_${Date.now()}`);
      console.log(`✅ Posted tweet ${i + 1}/${tweets.length}`);
    }
    
    await context.close();
    console.log(`✅ Thread posted successfully!\n`);
    
    res.json({
      success: true,
      tweetIds: postedIds,
      postedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (context) await context.close().catch(() => {});
    
    res.json({
      success: false,
      error: error.message,
      partialIds: postedIds
    });
  }
});

/**
 * GET /health - Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    browserServer: 'running',
    sessionExists: fs.existsSync(SESSION_PATH),
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║     🏠 LOCAL BROWSER SERVER RUNNING               ║');
  console.log('╚════════════════════════════════════════════════════╝');
  console.log(`\n✅ Server listening on: http://0.0.0.0:${PORT}`);
  console.log(`🔐 Secret: ${RAILWAY_SECRET.substring(0, 10)}...`);
  console.log(`🍪 Session file: ${SESSION_PATH}`);
  console.log(`\n📝 Endpoints:`);
  console.log(`   POST /post    - Post a single tweet`);
  console.log(`   POST /thread  - Post a thread`);
  console.log(`   GET  /health  - Health check`);
  console.log(`\n⏳ Waiting for requests from Railway...\n`);
});

