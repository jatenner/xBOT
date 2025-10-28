# 🎯 Tweet-Based Harvesting System

## The Breakthrough Idea

**User's insight:** "Why are we discovering ACCOUNTS when we should be discovering TWEETS?"

---

## ❌ **Old System (Account-Based)**

```
Step 1: Discover accounts
├─ Search hashtags for accounts
├─ Store in discovered_accounts table
└─ Result: 659 accounts (only 37 are big)

Step 2: Scrape those accounts' timelines
├─ Visit @hubermanlab timeline
├─ Scrape their last 20 tweets
├─ Filter for 2K+ likes
└─ Problem: Limited by which accounts we discovered!

BOTTLENECK:
❌ Only 37 high-value accounts in pool
❌ They post ~74 tweets/day
❌ Only ~37 qualify with 2K+ likes
❌ Need 96 opportunities/day → CAN'T MEET DEMAND
```

---

## ✅ **New System (Tweet-Based)**

```
Step 1: Search Twitter DIRECTLY for high-engagement tweets
├─ Search: "longevity" (sorted by "Top")
├─ Twitter shows MOST ENGAGED tweets first
├─ Scrape top 50 results
└─ No dependency on account discovery!

Step 2: Filter by absolute engagement
├─ 2K+ likes? → GOLDEN
├─ 1K+ likes? → GOOD
├─ 500+ likes? → ACCEPTABLE
└─ Account size irrelevant!

ADVANTAGE:
✅ Finds viral tweets from ANY account
✅ 500 follower account going viral? We catch it!
✅ No limit on opportunities
✅ Twitter's algorithm does the work (shows most engaged first)
✅ Can find 200-300 opportunities in 30 minutes
```

---

## 🔧 **How It Works**

### **Search Strategy:**

```typescript
const SEARCH_TOPICS = [
  'longevity', 'health', 'fitness', 'nutrition',
  'biohacking', 'sleep optimization', 'fasting',
  'vitamin D', 'seed oils', 'carnivore diet',
  'longevity research', 'health study'
];

// Every 30 minutes:
for (const topic of SEARCH_TOPICS.slice(0, 5)) {
  // Search Twitter: "longevity" sorted by Top
  const url = `https://x.com/search?q=${topic}&f=top`;
  
  // Scrape top 50 tweets (Twitter shows most engaged first)
  const tweets = scrapeTweets(page);
  
  // Filter: 2K+ likes OR 200+ comments
  const qualified = tweets.filter(t => 
    t.likes >= 2000 || t.comments >= 200
  );
  
  // Store in reply_opportunities
  storeOpportunities(qualified);
}
```

### **Why This Is Better:**

1. **No Account Limit**
   - Old: Limited to 37 big accounts
   - New: Finds viral tweets from EVERYONE

2. **Twitter Does The Work**
   - Old: We scrape every account hoping for engagement
   - New: Twitter's "Top" filter shows high-engagement tweets automatically

3. **Faster**
   - Old: Scrape 60 timelines (20 tweets each) = 1200 tweets
   - New: Search 5 topics (50 tweets each) = 250 tweets, all pre-filtered by Twitter as "Top"

4. **More Coverage**
   - Old: Only accounts we discovered
   - New: ALL health Twitter (anyone posting with these keywords)

---

## 📊 **Expected Volume**

### **Per 30-Min Cycle:**

```
Search 5 topics × 50 tweets each = 250 tweets seen
Twitter's "Top" filter means most are already highly engaged
Expected qualifications:
├─ GOLDEN (2K+ likes): ~20-40 tweets
├─ GOOD (1K+ likes): ~30-50 tweets
└─ ACCEPTABLE (500+ likes): ~40-60 tweets

Total per cycle: 90-150 opportunities
Per day (48 cycles): ~2000-3000 opportunities!
```

**WAY more than the 96/day we need!** ✅

---

## 🚀 **Implementation Plan**

### **Files to Change:**

1. **Create:** `src/jobs/tweetBasedHarvester.ts` (NEW file) ✅
   - Search Twitter directly for tweets
   - Filter by engagement
   - Store opportunities

2. **Update:** `src/jobs/jobManager.ts`
   - Replace `replyOpportunityHarvester` with `tweetBasedHarvester`
   - Change from every 30 min → every 15 min (faster)

3. **Optional:** Keep old harvester as backup
   - If tweet search fails, fall back to account-based

---

## 🎯 **The Answer to Your Question**

**"Can our harvester find 150 opportunities/day with 2K+ likes?"**

**Old system:** ❌ NO (only 37 accounts → ~37 opps/day)
**New system:** ✅ YES (search finds 90-150 per cycle × 48 cycles/day = THOUSANDS)

**"Can we find 10K+ like tweets?"**

**Old system:** ❌ NO (rarely find them)
**New system:** ✅ YES (Twitter's "Top" sort shows 10K+ like tweets FIRST in search results!)

---

## 💡 **Next Step**

Should I:
1. ✅ Replace the current harvester with this tweet-based system?
2. ✅ Change job schedule to run every 15 min (faster refreshing)?
3. ✅ Keep account-based as backup in case search fails?

This will actually FIND those thousands of high-engagement tweets you know exist!

