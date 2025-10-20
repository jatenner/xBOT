# 📋 **SYSTEMATIC FIXES - STATUS REPORT**

## **COMPLETED ✅**

### **1. Posting Rate Fixed**
- Changed `JOBS_PLAN_INTERVAL_MIN` from 60 to 720 (every 12 hours)
- Set `MAX_DAILY_POSTS` to 2
- Result: **2 tweets per day** instead of 48

### **2. Baseline Examples Added**
- Updated ALL 11 generators with gold standard examples
- Removed academic citation format ("et al.", "(n=X)")
- Added human-readable source format
- Result: **Minimum quality bar set**

### **3. Data Collection Fixed**
- Relaxed scraping validation (allow 0 likes for new tweets)
- Added database constraint for outcomes storage
- Result: **Scraping will now save data**

---

## **IN PROGRESS 🔄**

### **4. Generator Prompts Enhancement**
**Status:** 0/12 generators updated with hyper-specific prompts

**What needs to be done:**
- Remove ALL generic phrases ("be interesting", "add value", "be engaging")
- Add mandatory structures (opening → body → closing)
- Add testable fail criteria
- Make every instruction actionable and specific

**Example:**
```
❌ OLD: "Make it interesting"
✅ NEW: "Start with a number that contradicts common belief (8,000 steps, not 10,000)"

❌ OLD: "Be specific"
✅ NEW: "Include 2+ measurements (temps, dosages, timeframes) with units"

❌ OLD: "Add context"
✅ NEW: "Explain mechanism in < 20 words: X → Y → Z"
```

---

## **NOT STARTED ⏸️**

### **5. Reply System Fix**
**Problem:**
- 148 tweets discovered 2 days ago
- 0 tweets in last 24 hours
- Reply system needs fresh tweets (< 24hrs)
- No fresh tweets = 0 reply opportunities

**Solution:**
1. Add tweet discovery job (runs hourly)
2. Lower reply window threshold (24hrs → 72hrs temporarily)
3. Manual trigger to get fresh tweets now

### **6. Dynamic Few-Shot Integration**
**Problem:**
- System fetches YOUR top tweets
- But doesn't pass them to generators
- AI learns from generic examples, not YOUR proven content

**Solution:**
- Add `topTweets` parameter to all 12 generators
- Pass YOUR best-performing tweets into prompts
- AI learns YOUR voice and patterns

---

## **PRIORITY ORDER:**

1. ✅ **Data collection** (DONE - without data, learning is worthless)
2. 🔄 **Generator prompts** (IN PROGRESS - remove generic crap)
3. ⏸️ **Reply system** (NEXT - get replies working)
4. ⏸️ **Dynamic few-shot** (LATER - compound improvement)

---

## **USER'S REQUEST:**

> "ensure all 12 are updated not just one! also why don't our system ever reply to tweets what issue is causing that?"

**Answer:**
1. **All 12 generators:** Working on it now - will update systematically
2. **Reply system:** Found root cause - tweets too old, need fresh discovery

---

**NEXT ACTION: Update all 12 generators with hyper-specific, non-generic prompts.**

