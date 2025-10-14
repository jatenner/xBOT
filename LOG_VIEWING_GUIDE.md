# Railway Deployment Logs - Complete Guide

## ✅ Your Logs Are Now Connected!

`npm run logs` now pulls **actual Railway deployment logs** in real-time.

---

## 🚀 Quick Start - View Logs NOW

```bash
# Stream live deployment logs (Press Ctrl+C to stop)
npm run logs
```

---

## 📋 All Available Log Commands

### 1. **Live Railway Logs** (Most Common)
```bash
npm run logs                    # Stream live logs from Railway
railway logs                    # Direct Railway CLI
npm run railway:logs            # Alternative (safer wrapper)
./railway logs                  # Convenience script
```

**What you'll see:**
- Real-time deployment logs
- Application startup
- POST requests/responses
- Errors and warnings
- Database queries
- Any console.log() output

**To stop:** Press `Ctrl+C`

---

### 2. **Error Logs Only**
```bash
npm run railway:logs:errors     # Filter for errors only
./railway errors                # Convenience script
node railway-logs.js --errors   # Direct script
```

**Shows only:**
- Error messages
- Exceptions
- Failed requests
- Critical issues

---

### 3. **Search Logs**
```bash
# Search for specific terms
node railway-logs.js --search "POST_SUCCESS"
node railway-logs.js --search "PLAYWRIGHT"
node railway-logs.js --search "error"
node railway-logs.js --search "tweet"
```

---

### 4. **System Monitor** (Alternative)
```bash
npm run logs:monitor           # Old monitoring script
node bulletproof_system_monitor.js
```

---

## 🔍 What To Look For In Logs

### Deployment Health
```
✅ Good signs:
- "Build completed successfully"
- "Server listening on port..."
- "Database connected"
- "POST_SUCCESS"
- "PLAYWRIGHT_FACTORY_READY"

❌ Issues to investigate:
- "Error", "Exception", "Failed"
- "ECONNREFUSED", "ENOENT"
- "PGRST116" (database errors)
- "Target page, context or browser has been closed"
```

### Common Log Patterns
```
# Successful post
POST_SUCCESS: Posted tweet [id]

# Playwright ready
PLAYWRIGHT_FACTORY_READY: Browser initialized

# Database write
DB_WRITE: Saved to database

# Errors
ERROR: [description]
Exception: [stack trace]
```

---

## 🛠️ Troubleshooting With Logs

### Issue: Bot not posting
```bash
# Look for:
npm run railway:logs:errors
# Search for: POST_SKIPPED, PLAYWRIGHT, headless_shell
```

### Issue: Database errors
```bash
# Search for database errors:
node railway-logs.js --search "PGRST116"
node railway-logs.js --search "Supabase"
```

### Issue: Session/login problems
```bash
# Look for authentication issues:
node railway-logs.js --search "SESSION"
node railway-logs.js --search "LOGIN"
node railway-logs.js --search "auth_token"
```

### Issue: Build failures
```bash
# Check deployment logs:
railway logs
# Look for build errors at the top
```

---

## 📊 Log Monitoring Workflow

### Daily Check
```bash
# Quick status check
npm run railway:status

# View recent activity
npm run logs
# Let it run for 1-2 minutes, then Ctrl+C
```

### Debugging Issues
```bash
# Step 1: Check errors
npm run railway:logs:errors

# Step 2: Search for specific issue
node railway-logs.js --search "ERROR_TERM"

# Step 3: Full diagnostic
npm run railway:diagnostic

# Step 4: Check deployment status
railway status --json
```

### Performance Monitoring
```bash
# Monitor in real-time
npm run logs

# Look for:
# - Response times
# - Memory usage
# - Request patterns
# - Engagement metrics
```

---

## 🎯 Pro Tips

### 1. **Filter and Save Logs**
```bash
# Save last 100 lines of errors to file
railway logs 2>&1 | grep -i error | tail -100 > errors.log

# Search and save
railway logs 2>&1 | grep "POST_SUCCESS" > successful_posts.log
```

### 2. **Monitor Specific Features**
```bash
# Track posting activity
node railway-logs.js --search "POST_"

# Monitor Playwright
node railway-logs.js --search "PLAYWRIGHT"

# Watch database operations
node railway-logs.js --search "DB_"
```

### 3. **Multiple Terminal Windows**
Open 2-3 terminals:
- **Terminal 1**: `npm run logs` (live logs)
- **Terminal 2**: `npm run railway:status` (status checks)
- **Terminal 3**: Working directory (for fixes)

### 4. **Quick Health Check**
```bash
# One-liner to check if system is healthy
railway logs 2>&1 | head -50 | grep -E "POST_SUCCESS|PLAYWRIGHT_FACTORY_READY|Server listening"
```

---

## 🆘 Common Issues & Solutions

### "No logs appearing"
```bash
# Check connection
npm run railway:diagnostic

# Verify deployment is running
railway status

# Check if service is deployed
railway domain
```

### "Logs stop suddenly"
```bash
# Normal - logs stream continuously
# Press Ctrl+C to stop manually
# Or connection timed out - just restart: npm run logs
```

### "Too many logs to read"
```bash
# Use filtering
npm run railway:logs:errors           # Errors only
node railway-logs.js --search "term"  # Search specific
railway logs 2>&1 | tail -50          # Last 50 lines
```

---

## 📱 Access Logs Anywhere

### From Your Computer
```bash
npm run logs                   # In this directory
railway logs                   # From anywhere (if linked)
```

### From Railway Dashboard
1. Visit: https://railway.app/project/c987ff2e-2bc7-4c65-9187-11c1a82d4ac1
2. Click on "xBOT" service
3. Click "Deployments"
4. Click on latest deployment
5. View logs in browser

### Quick Dashboard Access
```bash
railway open                   # Opens project in browser
npm run railway:open          # Alternative
```

---

## 📈 Understanding Log Output

### Format
```
[timestamp] [level] [component] message

Example:
2025-10-14T10:30:45.123Z INFO MAIN_BULLETPROOF Server started
2025-10-14T10:30:46.456Z POST_SUCCESS Posted tweet 123456789
2025-10-14T10:30:47.789Z ERROR DB_WRITE Failed to save
```

### Log Levels
- **INFO**: Normal operations
- **WARN**: Warnings, not critical
- **ERROR**: Errors requiring attention
- **DEBUG**: Detailed debugging info

### Component Prefixes (from your code)
- `SESSION_LOADER`: Session management
- `PLAYWRIGHT_STORAGE`: Browser automation
- `LOGIN_CHECK`: Authentication
- `POST_START`: Post initiation
- `POST_SUCCESS`: Successful post
- `DB_WRITE`: Database operations

---

## 🔄 Log Commands Summary

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run logs` | Live Railway logs | Daily monitoring |
| `npm run railway:logs:errors` | Error logs only | Debugging |
| `node railway-logs.js --search` | Search logs | Find specific issues |
| `npm run logs:monitor` | System monitor | Alternative monitoring |
| `railway status` | Connection status | Quick health check |
| `railway open` | Dashboard | Visual monitoring |

---

## ✨ Best Practices

1. **Regular Monitoring**: Check logs daily with `npm run logs`
2. **Error Tracking**: Run `npm run railway:logs:errors` after deployments
3. **Search First**: Use `--search` to find specific issues quickly
4. **Keep Logs**: Save important error logs for debugging
5. **Multiple Views**: Use dashboard + CLI for complete picture
6. **React Fast**: Address errors as soon as they appear

---

## 🎉 You're All Set!

Your logs are now connected and ready to use. Start with:

```bash
npm run logs
```

Press Ctrl+C when you're done viewing!

---

**Last Updated**: October 14, 2025  
**Status**: ✅ Fully Operational  
**Railway Project**: XBOT (xbot-production-844b.up.railway.app)

