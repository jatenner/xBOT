# 🚀 DEPLOYMENT MODE CONTROL - PREVENT BOT CONFLICTS

## 🚨 CRITICAL: Only One Bot Instance at a Time

To prevent Twitter API conflicts (429 errors), ensure only ONE bot runs:

## 🏠 **LOCAL DEVELOPMENT MODE**

When testing locally:

```bash
# 1. Make sure Render is NOT running
# 2. Start local bot
npm start
```

## ☁️ **PRODUCTION MODE (Render)**

When deploying to Render:

```bash
# 1. STOP local bot first
pkill -f "node dist/main.js"
pkill -f "npm start"

# 2. Push to git (triggers Render deployment)
git add .
git commit -m "Deploy to production"
git push origin main

# 3. Verify local is stopped
ps aux | grep -E "(node.*main\.js|npm.*start)" | grep -v grep
```

## 🔧 **AUTOMATIC CONFLICT PREVENTION**

### Quick Stop Script
```bash
#!/bin/bash
echo "🛑 Stopping all local bot processes..."
pkill -f "node dist/main.js" 2>/dev/null || true
pkill -f "npm start" 2>/dev/null || true
pkill -f "nodemon" 2>/dev/null || true
echo "✅ Local bots stopped - Render can run safely"
```

### Status Check Script
```bash
#!/bin/bash
echo "🔍 Bot Instance Status Check"
echo "================================"

LOCAL_PROCESSES=$(ps aux | grep -E "(node.*main\.js|npm.*start)" | grep -v grep | wc -l)
if [ $LOCAL_PROCESSES -gt 0 ]; then
    echo "❌ LOCAL BOT RUNNING - Will conflict with Render!"
    echo "Run: pkill -f 'node dist/main.js'"
else
    echo "✅ No local bots running - Safe for Render deployment"
fi

echo ""
echo "🌐 Check Render status at: https://dashboard.render.com"
```

## 🎯 **DEPLOYMENT WORKFLOW**

### For Production Deployment:
1. **Stop Local**: `pkill -f "node dist/main.js"`
2. **Verify Stopped**: `ps aux | grep node | grep -v grep`
3. **Push Code**: `git push origin main`
4. **Monitor Render**: Check deployment logs
5. **Verify Only Render Running**: Check Twitter posting

### For Local Testing:
1. **Stop Render**: Pause service in Render dashboard
2. **Start Local**: `npm start`
3. **Test Features**: Run your tests
4. **Stop Local**: `Ctrl+C`
5. **Resume Render**: Unpause in dashboard

## 🚨 **CONFLICT DETECTION**

Signs of dual instance conflict:
- ❌ 429 errors (Too Many Requests)
- ❌ `x-app-limit-24hour-remaining: 0`
- ❌ Rapid posting attempts
- ❌ Database storage failures

## 💡 **BEST PRACTICES**

1. **Environment Variables**: Use different env files
   ```bash
   # Local: .env.local
   MODE=development
   
   # Render: Environment Variables
   MODE=production
   ```

2. **Process Lock**: Add deployment mode check
3. **Health Monitoring**: Monitor both instances
4. **Clear Communication**: Document which is running

## 🎪 **CURRENT STATUS**

✅ Local bot stopped
✅ Render deployment active  
✅ No conflicts detected
✅ Ready for autonomous operation 