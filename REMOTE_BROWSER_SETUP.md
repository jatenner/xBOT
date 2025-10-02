# 🏠 Remote Browser Setup Guide

Run Playwright browser on your **local Mac** (trusted IP) while keeping Railway for AI/scheduling.

---

## 🎯 Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────┐
│   Railway       │  HTTP   │   Your Mac       │ Browser │   Twitter   │
│  (AI/Schedule)  │────────▶│  (Browser Server)│────────▶│   (Post)    │
└─────────────────┘         └──────────────────┘         └─────────────┘
```

**Benefits:**
- ✅ Railway handles AI content generation, scheduling, learning
- ✅ Your Mac handles posting (trusted IP, no blocks)
- ✅ No need to run full xBOT locally (just lightweight browser server)

---

## 📦 Step 1: Install ngrok (Expose Your Mac to Railway)

```bash
# Install ngrok
brew install ngrok

# Sign up at https://dashboard.ngrok.com/signup
# Get your auth token from: https://dashboard.ngrok.com/get-started/your-authtoken

# Add your token
ngrok config add-authtoken YOUR_TOKEN_HERE
```

---

## 🚀 Step 2: Start Local Browser Server

In xBOT directory:

```bash
# Make sure you have a valid Twitter session
npm run auth:session

# Start the browser server
./start-browser-server.sh
```

You'll see:
```
╔════════════════════════════════════════════════════╗
║     🏠 LOCAL BROWSER SERVER RUNNING               ║
╚════════════════════════════════════════════════════╝

✅ Server listening on: http://0.0.0.0:3100
🔐 Secret: abc123...
⏳ Waiting for requests from Railway...
```

**Copy the secret** - you'll need it for Railway!

---

## 🌐 Step 3: Expose with ngrok

In a **new terminal**:

```bash
ngrok http 3100
```

You'll see:
```
Forwarding  https://abc-123-xyz.ngrok-free.app -> http://localhost:3100
```

**Copy the HTTPS URL** - this is your `BROWSER_SERVER_URL`!

---

## ⚙️ Step 4: Configure Railway

Add these environment variables to Railway:

```bash
BROWSER_SERVER_URL=https://abc-123-xyz.ngrok-free.app
BROWSER_SERVER_SECRET=your-secret-from-step-2
```

### Via Railway Dashboard:
1. Go to https://railway.app
2. Select xBOT project
3. Click **Variables** tab
4. Add both variables
5. Click **Deploy**

### Via CLI:
```bash
railway variables --set BROWSER_SERVER_URL=https://abc-123-xyz.ngrok-free.app
railway variables --set BROWSER_SERVER_SECRET=your-secret-here
```

---

## ✅ Step 5: Test It!

Once Railway redeploys (~2 min), watch your Mac terminal. You should see:

```
🚀 [2025-10-02T...] Posting tweet (268 chars)...
🌐 Launching browser...
✅ Logged in, composing tweet...
✅ Posted successfully! ID: 1234567890

Railway will see:
[POSTING_QUEUE] 🌐 Using remote browser (local machine)...
[REMOTE_POSTER] ✅ Posted successfully via local browser!
```

---

## 🔒 Security Notes

1. **ngrok free tier** shows a warning page first. To avoid this:
   - Upgrade to ngrok Pro ($8/mo)
   - Or use **Cloudflare Tunnel** (free, no warning)

2. **Keep the secret safe** - it's the only authentication

3. **Firewall**: ngrok handles this automatically

---

## 🔄 Alternative: Cloudflare Tunnel (Free, No Warnings)

```bash
# Install cloudflared
brew install cloudflare/cloudflare/cloudflared

# Login
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create xbot-browser

# Start tunnel
cloudflared tunnel --url http://localhost:3100
```

Use the `.trycloudflare.com` URL as your `BROWSER_SERVER_URL`.

---

## 📊 Monitoring

### Check Browser Server Health:
```bash
curl http://localhost:3100/health
```

### Check from Railway:
```bash
curl https://xbot-production-844b.up.railway.app/status
```

Look for `remote_browser_healthy: true`

---

## 🛑 Troubleshooting

### "Remote browser not reachable"
- ✅ Check browser server is running: `curl http://localhost:3100/health`
- ✅ Check ngrok is running: `curl YOUR_NGROK_URL/health`
- ✅ Check Railway has correct env vars

### "Not logged in"
- ✅ Run `npm run auth:session` again
- ✅ Check `data/twitter_session.json` exists
- ✅ Restart browser server

### Posts still failing
- ✅ Watch both terminals (browser server + Railway logs)
- ✅ Check Railway has the correct secret
- ✅ Try posting manually: 
  ```bash
  curl -X POST http://localhost:3100/post \
    -H "Authorization: Bearer YOUR_SECRET" \
    -H "Content-Type: application/json" \
    -d '{"text":"Test tweet from local browser!"}'
  ```

---

## 💰 Cost Comparison

| Option | Cost | Setup Time |
|--------|------|------------|
| **ngrok Free** | $0/mo | 5 min |
| ngrok Pro | $8/mo | 5 min |
| **Cloudflare Tunnel** | $0/mo | 10 min |
| Residential Proxy | $75-500/mo | 2-3 days |

**Recommended:** Start with ngrok free or Cloudflare Tunnel!

---

## 🎓 How It Works

1. Railway's scheduler decides "time to post"
2. Railway calls `postTweetRemote(text)`
3. HTTP request sent to **your Mac** via ngrok
4. Browser server launches Playwright with **your IP**
5. Playwright logs in and posts (Twitter trusts your home IP)
6. Result sent back to Railway
7. Railway stores in database

**Your Mac becomes a "posting worker" for Railway!**

