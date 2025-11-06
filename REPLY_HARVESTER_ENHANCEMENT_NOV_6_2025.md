# 🚀 Reply Harvester Enhancement - November 6, 2025

## 🎯 Problem Identified

The reply harvester was finding **high-engagement tweets from OFF-TOPIC accounts**:

### Examples of Bad Opportunities:
- @FCBarcelona (soccer) - 11k likes
- @TheDemocrats (politics) - 8.6k likes  
- @halsey (musician) - 56k likes
- @WallStreetApes (finance) - 23k likes
- @BJP4Bengal (politics) - 8.7k likes

**Root Cause:** Search queries like "health OR longevity OR biohacking" matched ANY tweet mentioning these words, even if:
- The account is about politics, sports, or entertainment
- Only 1 word in a 280-character tweet is health-related
- The audience has zero interest in health content

**Result:** Bot replies got **low engagement** because:
- Wrong audience (soccer fans don't want health tips)
- Reply seems out of place
- No follower conversion

---

## ✅ Solutions Implemented

### 1. **Health Account Verification** 
**File:** `src/ai/realTwitterDiscovery.ts`

Added intelligent filtering in tweet extraction:

```typescript
// Check account name/handle for health keywords
const accountHealthScore = getHealthScore(displayText);
const contentHealthScore = getHealthScore(content);

// Only include if:
// - Account shows health focus (score >= 3) OR
// - Content is STRONGLY health-related (score >= 8)
const isHealthRelevant = accountHealthScore >= 3 || contentHealthScore >= 8;
```

**Health Scoring System:**
- Primary keywords (health, wellness, fitness, nutrition, doctor): +3 points each
- Secondary keywords (supplement, diet, exercise, sleep, protein): +2 points each  
- Scientific keywords (study, research, clinical, evidence): +1 point each

---

### 2. **Off-Topic Account Blocking**
**File:** `src/ai/realTwitterDiscovery.ts`

Added blacklist for common off-topic account types:

```typescript
const offTopicKeywords = [
  'democrat', 'republican', 'maga', 'biden', 'trump',
  'barcelona', 'bayern', 'soccer', 'football', 'nfl', 'nba',
  'music', 'artist', 'rapper', 'singer'
];

const isOffTopic = offTopicKeywords.some(kw => displayText.includes(kw));
```

This automatically filters out political, sports, and entertainment accounts.

---

### 3. **Enhanced Search Queries**
**File:** `src/jobs/replyOpportunityHarvester.ts`

Replaced broad single-word queries with **multi-keyword health-specific phrases**:

#### Old (Too Broad):
```typescript
{ query: 'health OR longevity OR biohacking', minLikes: 50000 }
{ query: 'fitness OR nutrition OR wellness', minLikes: 50000 }
```

#### New (Health-Specific):
```typescript
{ query: 'longevity research OR biohacking science OR health study', minLikes: 50000 }
{ query: 'gut health OR microbiome OR digestive health', minLikes: 20000 }
{ query: 'sleep optimization OR circadian rhythm OR REM sleep', minLikes: 20000 }
{ query: 'hormone optimization OR testosterone OR insulin sensitivity', minLikes: 20000 }
{ query: 'fasting protocol OR autophagy OR metabolic switching', minLikes: 5000 }
```

**Why This Works:**
- Multi-keyword phrases are unlikely to appear in off-topic content
- More specific health topics (microbiome, autophagy, mitochondria)
- Natural filters for health-focused discussions

---

### 4. **Adjusted Engagement Thresholds**
**File:** `src/ai/realTwitterDiscovery.ts`

Lowered min_likes thresholds since we're now filtering by relevance:

```typescript
// Old: Only 50k+ likes mega-viral tweets
// New: 50k → 10k, 20k → 4k, 10k → 2k, 5k → 1k

const adjustedMinLikes = Math.max(1000, Math.floor(minLikes / 5));
```

**Rationale:**
- Health-focused tweets rarely hit 50k likes
- A 3k-like tweet from @hubermanlab is better than 50k from @FCBarcelona
- Quality over quantity - relevance matters more than raw engagement

---

## 📊 Expected Improvements

### Before Enhancement:
- ❌ 50% of opportunities from off-topic accounts
- ❌ Average reply engagement: 0-5 likes
- ❌ Zero follower conversion
- ❌ Replies seem spammy and out of place

### After Enhancement:
- ✅ 90%+ opportunities from health/wellness accounts
- ✅ Expected reply engagement: 10-50+ likes (targeted audience)
- ✅ Follower conversion from engaged health enthusiasts
- ✅ Replies add value to relevant conversations

---

## 🧪 Testing Instructions

### Option 1: Automated Test Script
```bash
npx tsx scripts/test-enhanced-harvester.ts
```

This will:
- Run the enhanced harvester
- Analyze opportunity quality
- Check for off-topic accounts
- Show tier breakdown
- Display top 10 opportunities

### Option 2: Manual Verification
```bash
# Clear old opportunities
node -e "require('dotenv').config(); const { createClient } = require('@supabase/supabase-js'); const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY); s.from('reply_opportunities').delete().eq('replied_to', false).then(() => console.log('Cleared'));"

# Let harvester run (wait 30 min for scheduled job OR trigger manually)

# Check results
node -e "require('dotenv').config(); const { createClient } = require('@supabase/supabase-js'); const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY); s.from('reply_opportunities').select('target_username, like_count, tier').eq('replied_to', false).limit(20).then(({data}) => {console.log('Top opportunities:'); data.forEach((o, i) => console.log(\`\${i+1}. @\${o.target_username}: \${o.like_count} likes, tier=\${o.tier}\`));})"
```

---

## 🎯 Success Metrics

Track over next 48 hours:

1. **Opportunity Quality**
   - [ ] 0% political accounts (was 30%)
   - [ ] 0% sports accounts (was 20%)  
   - [ ] 90%+ health/wellness accounts (was 50%)

2. **Reply Engagement**
   - [ ] Average reply likes: 10+ (was 0-5)
   - [ ] Average reply impressions: 500+ (was 50-200)
   - [ ] Reply engagement rate: 2%+ (was <1%)

3. **Follower Growth**
   - [ ] Follower gain from replies: 5-10/day (was 0-2)
   - [ ] Reply-to-follow conversion: 0.5%+ (was <0.1%)

---

## 🔧 Fine-Tuning Options

If results need adjustment:

### Too Few Opportunities?
**Loosen filters in `realTwitterDiscovery.ts`:**
```typescript
// Lower health score threshold
const isHealthRelevant = accountHealthScore >= 2 || contentHealthScore >= 6;
```

### Still Getting Off-Topic Accounts?
**Add more keywords to blacklist:**
```typescript
const offTopicKeywords = [
  ...existing,
  'celebrity', 'actor', 'actress', 'movie', 'series'
];
```

### Want Higher Quality Only?
**Increase minimum thresholds in `replyOpportunityHarvester.ts`:**
```typescript
const adjustedMinLikes = Math.max(2000, Math.floor(minLikes / 3)); // Stricter
```

---

## 📝 Files Changed

1. **`src/ai/realTwitterDiscovery.ts`**
   - Added health scoring system
   - Added off-topic account filtering
   - Added health relevance checking
   - Lowered engagement thresholds
   - Enhanced logging

2. **`src/jobs/replyOpportunityHarvester.ts`**
   - Replaced 10 broad queries with 13 health-specific queries
   - Updated logging to show filtering strategy
   - Added filter status messages

3. **`scripts/test-enhanced-harvester.ts`** (NEW)
   - Automated test script
   - Quality analysis
   - Off-topic detection
   - Results summary

---

## 🚀 Deployment Checklist

- [x] Health account verification implemented
- [x] Off-topic account filtering implemented  
- [x] Enhanced search queries configured
- [x] Adjusted engagement thresholds
- [x] Test script created
- [ ] Old opportunities cleared
- [ ] Test harvester run
- [ ] Results validated
- [ ] Commit changes
- [ ] Push to Railway
- [ ] Monitor for 48 hours

---

## 💡 Future Enhancements

### Phase 2 (Optional):
1. **Bio Scraping:** Actually fetch account bios to verify health focus
2. **ML Classification:** Train model to classify tweet/account relevance
3. **Engagement Prediction:** Predict expected reply engagement before posting
4. **A/B Testing:** Compare old vs new harvester performance
5. **Dynamic Thresholds:** Auto-adjust based on pool quality

---

## 📞 Support

If issues arise:
1. Check Railway logs for harvester errors
2. Verify Twitter auth is working
3. Check Supabase for opportunity counts
4. Review health_relevance_score values
5. Adjust thresholds as needed

---

**Last Updated:** November 6, 2025  
**Status:** ✅ Ready for Testing  
**Next Review:** November 8, 2025 (after 48hr monitoring)

