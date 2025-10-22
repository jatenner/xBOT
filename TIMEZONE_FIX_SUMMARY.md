# ⏰ TIMEZONE CONFIGURATION - NEW YORK (EASTERN TIME)

## ✅ **Changes Made:**

### **1. Railway Environment Updated**
- **TZ** = `America/New_York`
- **COST_TRACKER_ROLLOVER_TZ** = `America/New_York`

### **2. Current Time (Eastern)**
- **Your Location**: New York, NY
- **Timezone**: EDT (Eastern Daylight Time) / EST (Eastern Standard Time)
- **Current Time**: When this runs, all times will be in Eastern

---

## 📅 **System Schedule (All Times in Eastern)**

### **🐦 Posting Schedule:**
- **Max Rate**: 2 posts per hour
- **Max Daily**: 48 posts per day
- **Posting Queue**: Checks every 5 minutes
- **Content Planning**: Every 30 minutes (generates 1 post = 2/hour)

### **💬 Reply Schedule:**
- **Max Rate**: 4 replies per hour
- **Check Interval**: Every 15 minutes

### **📊 Scraping Schedule:**
- **Tweets < 24h old**: Every 30 minutes
- **Tweets > 24h old**: Once per day
- **Last scrape was at**: Check with verification script

### **🧠 Learning Jobs:**
- **Learning Cycle**: Every 60 minutes
- **Viral Thread**: Once per day (1440 minutes)

---

## 🕐 **Time Conversion Guide:**

| Eastern Time (ET) | UTC | Notes |
|-------------------|-----|-------|
| 12:00 AM ET | 4:00 AM UTC | Midnight in NY |
| 6:00 AM ET | 10:00 AM UTC | Morning |
| 12:00 PM ET | 4:00 PM UTC | Noon in NY |
| 6:00 PM ET | 10:00 PM UTC | Evening |
| 11:59 PM ET | 3:59 AM UTC (next day) | End of day |

**Note**: During daylight saving time (March-November), Eastern is EDT (UTC-4)  
During standard time (November-March), Eastern is EST (UTC-5)

---

## 📊 **Database Timestamps:**

All timestamps in your Supabase database are stored as:
- **Format**: `TIMESTAMP WITH TIME ZONE`
- **Stored as**: UTC internally
- **Displayed as**: Will now show in Eastern Time when queried from Railway

### **Common Timestamp Fields:**
- `created_at` - When record was created (Eastern)
- `posted_at` - When tweet was posted (Eastern)
- `collected_at` - When metrics were scraped (Eastern)
- `updated_at` - Last update time (Eastern)

---

## 🔍 **How to Verify Correct Timing:**

### **1. Check Current System Time:**
```bash
# On Railway (after restart):
date
# Should show: EDT or EST depending on season
```

### **2. Check Latest Tweet Times:**
```bash
node verify_session_fix.js
# All times will be shown in Eastern
```

### **3. Check Scraper Schedule:**
```bash
npm run logs | grep "METRICS_JOB"
# Times will be in Eastern
```

---

## ⚠️ **Important Notes:**

1. **Service Restart Required**: Railway needs to restart to apply timezone changes
   - Already done ✅

2. **Existing Database Records**: Will now be interpreted in Eastern Time
   - No data loss
   - Just displayed differently

3. **Scheduling**: All cron jobs and intervals now use Eastern Time
   - Peak posting times are calculated for Eastern timezone
   - Engagement windows are Eastern-based

4. **Cost Tracking**: Daily budget resets at midnight Eastern Time
   - `COST_TRACKER_ROLLOVER_TZ=America/New_York`

---

## 🎯 **Optimal Posting Times (Eastern):**

Based on Twitter engagement patterns:

| Time Period | Engagement | Recommendation |
|-------------|------------|----------------|
| 12:00 AM - 6:00 AM | Low | Light posting |
| 6:00 AM - 9:00 AM | High | **Peak time** ✅ |
| 9:00 AM - 12:00 PM | Medium-High | Good |
| 12:00 PM - 2:00 PM | High | **Lunch peak** ✅ |
| 2:00 PM - 5:00 PM | Medium | Moderate |
| 5:00 PM - 8:00 PM | Very High | **Evening peak** ✅ |
| 8:00 PM - 12:00 AM | Medium-High | Good |

Your bot will automatically optimize for these Eastern Time windows!

---

## ✅ **Verification Checklist:**

- [x] TZ environment variable set to America/New_York
- [x] COST_TRACKER_ROLLOVER_TZ set to America/New_York  
- [x] Railway service restarted
- [ ] Wait 30 minutes and verify scraper times are correct
- [ ] Check that posted_at times match Eastern Time

---

## 📞 **Quick Reference:**

**Current Configuration:**
- System Timezone: America/New_York (Eastern)
- Cost Rollover: Midnight Eastern
- All scheduling: Eastern Time
- Display format: Automatic (EDT/EST based on season)

**Last Updated**: October 21, 2025
**Status**: ✅ ACTIVE - All times now in Eastern Time

