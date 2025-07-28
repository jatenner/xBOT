# 🎭 Playwright Twitter Scraping Setup Guide

## 📋 Quick Setup Checklist

### ✅ Prerequisites
- [x] Playwright installed (`playwright: ^1.40.0` in package.json)
- [x] Chromium browser installed (`npx playwright install chromium`)
- [x] Render-compatible browser launch arguments configured
- [x] Session management system ready

### 🔧 Installation Complete
```bash
# Playwright is already installed, but if you need to reinstall:
npm install playwright
npx playwright install chromium
```

## 🔑 Twitter Session Setup

### 1. Initialize Twitter Session (Required First Step)
```bash
npm run init-session
```

**What this does:**
- Opens Chromium browser in non-headless mode
- Navigates to Twitter login page
- Waits for you to manually log in
- Saves cookies to `twitter-auth.json`
- **You need to complete this step locally before deploying**

### 2. Test Session Validity
```bash
npm run test-session
```

**What this checks:**
- Session file exists and is valid
- Cookies are properly formatted
- Session can access Twitter without re-login

## 🧪 Testing Scraper Functionality

### Quick Test (Recommended)
```bash
npm run test-scraper-quick
```
Tests basic "ai health" search with 5 tweets.

### Full Test Suite
```bash
npm run test-scraper
```
Comprehensive test including:
- Session validation
- Scraper initialization
- AI health search
- Multiple search queries
- Trending topics
- Cleanup and session persistence

### Manual Test Commands
```bash
# Test just session file
node dist/test/testScraper.js session

# Test initialization only
node dist/test/testScraper.js init

# Test search functionality
node dist/test/testScraper.js search
```

## 📁 File Structure

```
twitter-auth.json          # Session cookies (auto-generated)
src/
├── utils/
│   └── initTwitterSession.ts    # Session initialization
├── scraper/
│   └── scrapeTweets.ts          # Main scraper with session loading
├── test/
│   └── testScraper.ts           # Comprehensive test suite
└── jobs/
    └── updateTweetPerformance.ts # Performance tracking scraper
```

## 🚀 Render Deployment

### Essential Files for Deployment
1. **twitter-auth.json** - Your session file (must be created locally first)
2. **All Playwright files** - Already configured for Render compatibility

### Render Configuration
Browser launch arguments are already optimized for Render:
```typescript
args: [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  // ... other optimizations
]
```

### Environment Variables (Render)
Add these to your Render environment:
```bash
# Your existing variables plus:
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0  # Ensure browser downloads
```

## 🔧 Usage Examples

### Basic Scraping
```typescript
import { StealthTweetScraper } from './scraper/scrapeTweets';

const scraper = new StealthTweetScraper();
await scraper.initialize();
const result = await scraper.searchTweets('ai health', 5);
await scraper.close();
```

### Session Management
```typescript
import { TwitterSessionInitializer } from './utils/initTwitterSession';

const initializer = new TwitterSessionInitializer();
await initializer.initialize(); // Manual login
const isValid = await initializer.testSession(); // Test
```

## 🚨 Troubleshooting

### Session Issues
```bash
# Session expired or corrupted
rm twitter-auth.json
npm run init-session

# Test if session works
npm run test-session
```

### Scraper Issues
```bash
# Check if browser launches
npm run test-scraper-quick

# Check session and all functionality
npm run test-scraper
```

### Render Deployment Issues
1. **Session missing**: Create `twitter-auth.json` locally first
2. **Browser fails**: Render should auto-install Chromium
3. **Timeout errors**: Normal - Render may be slower than local

## 📊 What Each Script Does

| Script | Purpose | Usage |
|--------|---------|-------|
| `npm run init-session` | Create Twitter session | **Run locally first** |
| `npm run test-session` | Verify session validity | Before deployment |
| `npm run test-scraper` | Full functionality test | Pre-deployment check |
| `npm run test-scraper-quick` | Quick search test | Development testing |

## 🎯 Success Indicators

### ✅ Ready for Deployment When:
- [ ] `npm run test-session` returns "Session is valid"
- [ ] `npm run test-scraper-quick` successfully scrapes tweets
- [ ] `twitter-auth.json` file exists
- [ ] All tests in `npm run test-scraper` pass

### 🔄 During Render Deployment:
- Browser auto-installs (may take 2-3 minutes first time)
- Scraper uses saved session
- Performance tracking runs every 30 minutes
- Reply system runs every 60 minutes

## 🚀 Integration with Existing Bot

Your bot already uses Playwright scraping in:
- **Performance Tracking**: `updateTweetPerformance.ts` (every 30 min)
- **Reply System**: `scrapeTweets.ts` (every 60 min)
- **Analytics**: All Twitter API calls replaced with scraping

The session you create will be shared across all these systems! 