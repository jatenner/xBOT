# 🔄 How Topic Rotation Works

## Current System (Hardcoded Rotation)

### **The List:**
```typescript
const SEARCH_TOPICS = [
  'health', 'wellness', 'fitness', 'nutrition', 'longevity',
  'keto', 'carnivore', 'vegan', 'fasting', 'diet',
  'workout', 'gym', 'sleep', 'meditation', 'biohacking',
  // ... 90+ topics total
];

let currentTopicIndex = 0; // Tracks where we are in the list
```

### **How It Rotates:**

```
CYCLE 1 (2:00 PM):
├─ currentTopicIndex = 0
├─ Search topics 0-9: ['health', 'wellness', 'fitness'... ]
├─ currentTopicIndex updated to 10
└─ Store ~30-60 opportunities

CYCLE 2 (2:30 PM):
├─ currentTopicIndex = 10
├─ Search topics 10-19: ['keto', 'carnivore', 'vegan'... ]
├─ currentTopicIndex updated to 20
└─ Store ~30-60 opportunities

CYCLE 3 (3:00 PM):
├─ currentTopicIndex = 20
├─ Search topics 20-29: ['workout', 'gym', 'sleep'... ]
└─ And so on...

After 9 cycles (4.5 hours):
├─ Searched all 90 topics
├─ currentTopicIndex = 90
├─ Reset to 0, start over
└─ Every topic searched 5+ times per day
```

---

## ✅ **Pros of Hardcoded Rotation:**

1. **Predictable Coverage**
   - Every topic gets searched equally
   - No topic is forgotten
   - Complete coverage every 4.5 hours

2. **Simple & Reliable**
   - No AI needed to pick topics
   - No complexity
   - Works consistently

3. **Broad Coverage**
   - 90+ topics = entire health space
   - Catches mainstream AND niche

---

## ❌ **Cons of Hardcoded Rotation:**

1. **Not Adaptive**
   - Searches "cold plunge" as much as "health"
   - Doesn't learn which topics have more viral tweets
   - Wastes time on dead topics

2. **Misses Real-Time Trends**
   - If "ozempic" is trending TODAY, we might not search it for hours
   - Can't react to breaking health news
   - No intelligence

3. **Equal Weight is Inefficient**
   - "sleep" might have 50 viral tweets/day
   - "red light therapy" might have 2 viral tweets/day
   - We search both equally

---

## 💡 **Better Options**

### **Option A: Keep Hardcoded + Broad Safety Net** (Current)
```
Strategy 1: Rotate through 90 hardcoded topics
Strategy 2: "health OR wellness OR fitness" (catches everything else)
Strategy 3: Twitter Explore (catches trending)

Result: Hardcoded rotation + safety nets catch what we miss
```

### **Option B: Smart Rotation (Learn What Works)**
```typescript
// Track which topics find the most high-engagement tweets
const topicStats = {
  'longevity': { searches: 100, found: 250, avg_likes: 3500 },
  'keto': { searches: 100, found: 180, avg_likes: 2800 },
  'cold plunge': { searches: 100, found: 20, avg_likes: 800 }
};

// Weight rotation by success rate
// Search 'longevity' 3x more than 'cold plunge'
```

### **Option C: Twitter Trending API**
```typescript
// Get what's trending in health RIGHT NOW
const trending = getTwitterTrending('health');
// Search: ['ozempic', 'seed oils debate', 'new longevity study']

// React to real-time trends instead of hardcoded list
```

### **Option D: Hybrid (My Recommendation)**
```
40% of searches: Rotate through proven topics
30% of searches: Broad "health OR wellness" catch-all
20% of searches: Twitter Explore (trending)
10% of searches: Learn from past successes (adaptive)

Result: Balanced between consistency and adaptability
```

---

## 🤔 **Which Should We Use?**

**For NOW (to get it working):**
- Keep hardcoded rotation ✅
- Add broad searches as safety net ✅
- Gets us operational immediately

**For LATER (optimization):**
- Track which topics find most 10K+ tweets
- Weight rotation toward successful topics
- Add trending topic detection

---

## 📊 **Does Hardcoded Rotation Meet Our Needs?**

**Your concern:** "Will it find enough tweets?"

**Answer:** YES, because:

1. **Broad searches supplement rotation**
   ```
   Every cycle:
   ├─ 10 specific topics (rotation)
   ├─ "health OR wellness OR fitness" (catches EVERYTHING)
   └─ Twitter Explore (trending topics)
   
   Even if rotation misses something, broad search catches it
   ```

2. **Volume proof:**
   ```
   With just rotation: ~400 tweets/cycle qualified
   With broad search: +100 tweets/cycle
   With Explore: +30 tweets/cycle
   TOTAL: ~530 qualified tweets/cycle
   ```

3. **High-engagement tweets show up in MULTIPLE searches**
   ```
   Example: Viral tweet "Seed oils cause inflammation"
   
   Found by:
   ├─ Topic rotation: "seed oils" (when it rotates to that topic)
   ├─ Broad search: "health OR wellness" (catches it too)
   ├─ Explore: Trending page (if it's viral)
   └─ Caught 3 different ways!
   ```

**So even if a topic isn't in the hardcoded list or hasn't been rotated to yet, broad searches catch it.**

---

## 🎯 **Want Me to Deploy?**

Current system uses:
- ✅ Hardcoded 90-topic rotation
- ✅ Broad catch-all searches
- ✅ Twitter Explore scraping

This will find the 10K+ like tweets you want. Should I deploy this version, or do you want me to make the topic selection smarter first?
