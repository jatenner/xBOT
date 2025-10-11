# Twitter Posting - Reliable & Compliant Implementation

This document describes the improved Twitter posting system that focuses on reliability and compliance rather than anti-detection.

## Overview

The system provides two posting methods:
1. **Playwright Browser Automation** (default) - Reliable headless browser posting
2. **Official X API** (optional) - Direct API posting via feature flag

## Environment Variables

### Required for Playwright Method
```bash
TWITTER_SESSION_B64=<base64-encoded-session-cookies>
```

### Required for X API Method
```bash
FEATURE_X_API_POSTING=true
X_API_BEARER_TOKEN=<your-bearer-token>
# Optional OAuth 1.0a credentials:
X_API_ACCESS_TOKEN=<your-access-token>
X_API_ACCESS_TOKEN_SECRET=<your-access-token-secret>
```

### System Configuration
```bash
MODE=live                    # live, shadow, or dry
NODE_ENV=production         # production or development
```

## Installation & Setup

### 1. Install Dependencies
```bash
npm install
npx playwright install chromium --with-deps
```

### 2. Create Artifacts Directory
```bash
mkdir -p artifacts
```

### 3. Set Environment Variables
Create `.env` file with required variables (see above).

### 4. Build Application
```bash
npm run build
```

## Usage

### Local Development
```bash
npm start
```

### Railway Deployment
The system automatically detects container environments and runs in headless mode.

Ensure your Railway service has these environment variables set:
- `TWITTER_SESSION_B64` (for Playwright method)
- `FEATURE_X_API_POSTING=true` and X API credentials (for API method)

## Feature Flag: X API Posting

To use the official X API instead of browser automation:

1. Set `FEATURE_X_API_POSTING=true`
2. Provide X API credentials
3. Restart the application

The system will automatically switch to API posting for all new tweets.

## Session Management

### Playwright Method
- Uses `storageState` for persistent authentication
- Automatically refreshes from `TWITTER_SESSION_B64` when needed
- Saves session to `twitter-auth.json` for reuse

### X API Method
- No session management needed
- Uses OAuth bearer token for authentication

## Troubleshooting

### Common Issues

**1. "Missing X server or $DISPLAY" errors**
- Solution: System now enforces `headless: true` in containers
- Check that you're not overriding headless mode

**2. "page.goto timeout" errors**
- Solution: System uses `domcontentloaded` instead of `networkidle`
- Check network connectivity to x.com

**3. "Not logged in to Twitter"**
- Solution: Refresh your `TWITTER_SESSION_B64` value
- Or switch to X API method with `FEATURE_X_API_POSTING=true`

**4. "CreateTweet failed" network errors**
- Solution: Check Twitter's API status
- Verify session/credentials are valid

### Debug Artifacts

When posting fails, the system automatically captures:
- `artifacts/failure-{timestamp}.png` - Screenshot of the page
- `artifacts/trace-{timestamp}.zip` - Full browser trace
- `artifacts/error-{timestamp}.json` - Error details and context

### Logs

Look for these log prefixes:
- `BROWSER_FACTORY:` - Browser initialization
- `ULTIMATE_POSTER:` - Posting process
- `X_API_POSTER:` - API posting process
- `[POSTING_QUEUE]` - Queue processing

## Validation

Test the posting system:
```bash
node scripts/validate-posting.mjs
```

This will:
1. Detect which posting method is configured
2. Attempt to post a test tweet
3. Report success/failure with details

## Architecture

### Key Components

- `src/browser/browserFactory.ts` - Reliable browser management
- `src/posting/UltimateTwitterPoster.ts` - Playwright-based posting
- `src/posting/xApiPoster.ts` - X API posting
- `src/config/env.ts` - Environment configuration
- `src/jobs/postingQueue.ts` - Queue processing with method selection

### Design Principles

1. **Reliability First** - Stable selectors, proper error handling, retry logic
2. **Compliance** - No anti-detection attempts, respects rate limits
3. **Observability** - Comprehensive logging, failure artifacts
4. **Flexibility** - Multiple posting methods via feature flags

## Security Notes

- Never commit API credentials to version control
- Use Railway's environment variable encryption
- Rotate API tokens regularly
- Monitor for unauthorized API usage

## Performance

- Browser instances are reused when possible
- Contexts are cleaned up after use
- Network monitoring for efficient verification
- Minimal resource usage in containers
