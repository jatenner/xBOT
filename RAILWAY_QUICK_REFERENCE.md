# Railway CLI - Quick Reference Guide

## 🚀 Most Used Commands

```bash
# View live logs
railway logs

# Check connection status  
railway status

# View environment variables
railway variables

# Open project in browser
railway open
```

## 🔧 Helper Scripts

```bash
# Run diagnostics
node railway-diagnostic.js

# View filtered logs
node railway-logs.js --errors

# Fix connection issues
node fix_railway_connection.js
```

## ⚡ Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Not connected | `node fix_railway_connection.js` |
| Can't see logs | `railway status` then `node railway-logs.js` |
| Wrong project | `node fix_railway_connection.js` |
| Not authenticated | `railway login` |

## 📊 Current Configuration

- **Project**: XBOT
- **Environment**: production
- **Service**: xBOT
- **Account**: jonahtenner@yahoo.com

## 🔗 Useful Links

- Dashboard: https://railway.app
- Project ID: c987ff2e-2bc7-4c65-9187-11c1a82d4ac1
- Docs: https://docs.railway.app

---

**Status**: ✅ Connected | **Last Verified**: October 14, 2025

