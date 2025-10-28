# 📊 HOW TO ACCESS YOUR DASHBOARD

Your xBOT performance dashboard is now live on Railway!

---

## 🌐 **STEP 1: Get Your Railway URL**

1. Go to https://railway.app
2. Find your xBOT project
3. Click on your deployment
4. Look for the **Public URL** (should look like: `xbot-production.up.railway.app`)

---

## 🔑 **STEP 2: Get Your Auth Token**

Your auth token is in Railway environment variables:

1. In Railway dashboard, go to your project
2. Click **Variables** tab
3. Find `ADMIN_TOKEN`
4. Copy the value (default: `xbot-admin-2025`)

---

## 🚀 **STEP 3: Access Dashboard**

### **Method 1: URL with Token (Easiest)**
```
https://YOUR-RAILWAY-URL.railway.app/dashboard?token=YOUR_TOKEN

Example:
https://xbot-production.up.railway.app/dashboard?token=xbot-admin-2025
```

### **Method 2: Header Auth**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://YOUR-RAILWAY-URL.railway.app/dashboard
```

---

## 📊 **WHAT YOU'LL SEE**

### **Top Stats:**
- ✅ Total posts & replies
- ✅ Average engagement rate
- ✅ Avg likes per post
- ✅ Followers gained from replies

### **Generator Performance:**
- 🎭 Which generators perform best
- 📊 Posts per generator
- ❤️ Avg likes per generator
- 📈 Avg engagement rate per generator

### **Reply Opportunities:**
- 💎 Platinum tier count (10k+ likes)
- 💎 Diamond tier count (5k+ likes)
- 💎 Golden tier count (2k+ likes)

### **Recent Posts:**
- 📝 Last 10 posts
- 🎯 Generator used
- ❤️ Likes & retweets
- ⏰ Posted time

### **Reply Conversions:**
- 🎯 Target accounts
- 💎 Tier of opportunity
- 📈 Followers gained
- ⏰ When replied

---

## 🔄 **AUTO-REFRESH**

Dashboard automatically refreshes every 60 seconds to show latest data!

You can also manually refresh by clicking the **🔄 Refresh Data** button.

---

## 🔒 **SECURITY**

### **Your dashboard is protected:**
- ✅ Requires token authentication
- ✅ Token is in environment variables (not in code)
- ✅ Not publicly accessible without token
- ✅ Can change token anytime in Railway

### **To change token:**
1. Go to Railway dashboard
2. Click **Variables**
3. Update `ADMIN_TOKEN` value
4. Redeploy (Railway auto-redeploys on env change)

---

## 📱 **BOOKMARK IT**

Save this URL for easy access:
```
https://YOUR-RAILWAY-URL.railway.app/dashboard?token=YOUR_TOKEN
```

You can check your dashboard from:
- ✅ Desktop browser
- ✅ Mobile browser
- ✅ Tablet
- ✅ Anywhere with internet

---

## 🛠️ **TROUBLESHOOTING**

### **"Authentication Required"**
- Make sure you added `?token=YOUR_TOKEN` to the URL
- Check that your token matches Railway env variable
- Token is case-sensitive

### **"Dashboard Temporarily Unavailable"**
- Check Railway logs for errors
- Database might be temporarily down
- Try refreshing after 30 seconds

### **No data showing**
- System needs to run for 24 hours to collect data
- Make sure posts/replies are being posted
- Check Supabase database has data

---

## 🎯 **WHAT TO WATCH**

### **Daily:**
- Are 48 posts being posted? (2/hour × 24)
- Are 96-144 replies being posted? (4-6/hour × 24)
- Any generator dominating? (should be diverse)

### **Weekly:**
- Which generator has highest avg ER? → Use it more
- Which topics perform best? → Post more of those
- Reply conversions happening? → Good sign

### **Monthly:**
- Engagement rate trending up? → System learning
- Follower gains from replies? → ROI positive
- Content diversity improving? → Good variety

---

## 🚀 **NEXT LEVEL**

Want more advanced metrics? You can add:
- 📊 Charts (use Chart.js)
- 📈 Trend graphs (engagement over time)
- 🗺️ Heatmaps (best posting times)
- 🎯 A/B test results
- 💰 Cost per follower
- 🔥 Viral tweet detection

Just let me know what metrics matter most to you!

---

**Your dashboard is LIVE and ready to use!** 🎉

Bookmark it, check it daily, and watch your system improve! 📊
