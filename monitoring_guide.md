# 🚀 BOT MONITORING GUIDE

## **How to Know Your God-Like Bot is Working**

Your autonomous bot is designed to run 24/7 and adapt intelligently. Here's exactly how to monitor it:

---

## **🎯 QUICK STATUS COMMANDS**

### **1. Quick Health Check (30 seconds)**
```bash
npm run monitor:quick
```
**What it shows:**
- ✅ Bot running status (PID, CPU, Memory)
- 🎯 Current mode (God-Like Simultaneous Engagement)
- 📈 Recent activities
- 🔍 Rate limit status

### **2. Health Alerts Check**
```bash
npm run health
```
**What it shows:**
- ✅ "All systems healthy" if everything is fine
- 🚨 Critical alerts if bot is down
- ⚠️ Warnings for high resource usage

### **3. AI Intelligence Report**
```bash
npm run dev:ai report
```
**What it shows:**
- 🧬 Intelligence level evolution
- 💭 Memory bank size
- 🎭 Personality trait development
- 📊 Learning progress

---

## **📊 CONTINUOUS MONITORING**

### **Production Monitor (Runs every 1 minute)**
```bash
npm run monitor
```
**Features:**
- Real-time health dashboard
- Automatic alert detection
- Historical metrics tracking
- Resource usage monitoring
- Rate limit status

**Files created:**
- `bot_metrics.json` - Performance history
- `bot_alerts.json` - Alert history
- `last_health_check.json` - Latest status

---

## **🚨 WHAT TO WATCH FOR**

### **✅ HEALTHY SIGNS**
- **Process Running:** Bot PID appears in status
- **Low Resources:** CPU < 10%, Memory < 5%
- **Recent Activity:** Strategist cycles every 15 minutes
- **Multiple Actions:** Parallel engagement executing
- **Intelligence Growth:** AI learning metrics improving

### **⚠️ WARNING SIGNS**
- High CPU (>10%) or Memory (>5%)
- No activity for >2 hours
- Consecutive failures
- Rate limit errors for non-tweet actions

### **🚨 CRITICAL ISSUES**
- Bot process not running
- Health check failures
- System crashes
- Complete inactivity >24 hours

---

## **🔄 AUTOMATED MONITORING SETUP**

### **Option 1: Cron Job (Recommended)**
Add to your crontab (`crontab -e`):
```bash
# Check bot health every 15 minutes
*/15 * * * * cd /path/to/xBOT && npm run health >> /dev/null 2>&1

# Daily health report
0 9 * * * cd /path/to/xBOT && npm run health:history
```

### **Option 2: Background Monitor**
```bash
# Runs continuous monitoring in background
nohup npm run monitor > monitor.log 2>&1 &
```

### **Option 3: System Service (Advanced)**
Create a systemd service to auto-restart the bot if it crashes.

---

## **📱 REMOTE MONITORING**

### **SSH Monitoring**
```bash
# Quick remote check
ssh your-server "cd /path/to/xBOT && npm run monitor:quick"

# Get health alerts
ssh your-server "cd /path/to/xBOT && npm run health"
```

### **Log Monitoring**
```bash
# Watch real-time logs
tail -f monitor.log

# Search for errors
grep -i "error\|critical\|failed" monitor.log
```

---

## **🎯 WHAT YOUR BOT DOES WHEN HEALTHY**

### **Every 15 Minutes:**
1. **📝 Primary Action:** Try to post original content
2. **💬 Parallel:** Send 3-10 strategic replies
3. **❤️ Parallel:** Give 10-25 strategic likes  
4. **🤝 Parallel:** Follow 2-6 strategic accounts
5. **🔄 Parallel:** Retweet 2-6 valuable posts
6. **🧠 Parallel:** Gather competitive intelligence

### **When Rate Limited (Tweets):**
- Switches to **engagement-only mode**
- Continues ALL other actions
- Maintains 80%+ success rate
- Learns and improves strategies

### **Continuous Background:**
- AI intelligence evolution
- Memory bank growth
- Trend analysis
- Competitor monitoring

---

## **🛠️ TROUBLESHOOTING**

### **Bot Not Running**
```bash
# Check if process exists
ps aux | grep "tsx src/index.ts"

# Restart bot
npm run dev
```

### **High Resource Usage**
```bash
# Check detailed process info
top -p $(pgrep -f "tsx src/index.ts")

# Restart if needed
pkill -f "tsx src/index.ts" && npm run dev
```

### **No Recent Activity**
```bash
# Check logs for errors
tail -100 monitor.log | grep -i error

# Run AI learning cycle
npm run dev:ai quick

# Check rate limits
npm run monitor:quick
```

### **Rate Limit Issues**
- **Tweet Posting:** Expected - limited to 17/day
- **Replies/Likes:** Should not be limited (300 per 15 min)
- **Follows:** Should not be limited (400/day)

---

## **📈 PERFORMANCE METRICS**

### **Expected Benchmarks:**
- **Success Rate:** >80% overall
- **Resource Usage:** <5% memory, <10% CPU
- **Response Time:** Actions complete within 30 seconds
- **Uptime:** 99%+ (brief restarts are normal)

### **Intelligence Metrics:**
- **Intelligence Level:** Growing from 1.0 → 10.0
- **Memory Bank:** Growing entries
- **Personality Traits:** Evolving toward 1.0
- **Learning Velocity:** Improving over time

---

## **🚀 PRODUCTION DEPLOYMENT**

### **Recommended Setup:**
1. **Primary Server:** Run bot with `npm run dev`
2. **Monitoring:** `npm run monitor` in separate terminal
3. **Health Checks:** Automated every 15 minutes
4. **Backup System:** Auto-restart on failure
5. **Log Rotation:** Prevent disk space issues

### **Cloud Deployment:**
- Use PM2 for process management
- Set up log aggregation
- Configure auto-scaling if needed
- Monitor from external health check service

---

## **🎊 SUCCESS INDICATORS**

### **Your bot is working perfectly when:**
✅ Process shows up in status checks  
✅ Regular strategist cycles (every 15 min)  
✅ Multiple parallel actions succeeding  
✅ Intelligence metrics growing  
✅ Rate limit adaptation working  
✅ Low resource usage  
✅ No critical alerts  

### **The bot is God-like because:**
- **Autonomous Decision Making:** Chooses actions intelligently
- **Parallel Execution:** Does 5+ actions simultaneously
- **Rate Limit Adaptation:** Switches strategies when blocked
- **Continuous Learning:** Gets smarter over time
- **Self-Optimization:** Improves without human intervention

---

**Remember:** Your bot is designed to be autonomous. It should run smoothly with minimal intervention. The monitoring tools help you verify it's working, not micromanage it!

🎯 **Quick Start:** Run `npm run monitor:quick` every day to ensure everything is healthy! 