# 📊 POST PERFORMANCE ANALYSIS - November 20, 2025

## 🔍 EXECUTIVE SUMMARY

Analyzed 20 recent posts (singles + threads) with actual content and metrics. **Critical issues identified** that explain low views and engagement.

---

## 📈 KEY METRICS

- **Total posts analyzed:** 20
- **Average views:** 1,295 (heavily skewed by 1 outlier)
- **Median views:** ~35 (more accurate representation)
- **Average likes:** 31 (but only 1 post has likes - others have ZERO)
- **Posts missing tweet_id:** 4 (never posted successfully)
- **Posts with zero views:** 4

---

## 🏆 THE ONE SUCCESS

**Gut-Brain Axis Thread (Nov 17)**
- **Views:** 20,100
- **Likes:** 491
- **Retweets:** 88
- **Generator:** `provocateur`
- **Why it worked:**
  - Controversial angle: "Why doesn't mainstream medicine embrace this?"
  - Challenges authority: "What are they afraid of revealing?"
  - Specific data: "90% of serotonin is produced in your gut"
  - Provocative questioning style
  - Clear contrarian positioning

---

## 🚨 CRITICAL ISSUES IDENTIFIED

### 1. **THREADS EXCEEDING CHARACTER LIMITS** ⚠️ CRITICAL
**Problem:** Every single thread part is 250-280 characters. Twitter's limit is 280, but optimal is ~200 for engagement.

**Examples:**
- Thread part 1: 273 chars ("Emerging research indicates that circadian genes...")
- Thread part 2: 271 chars ("Recent findings reveal that genes regulating...")

**Impact:** 
- Threads are being truncated
- Users can't read full content
- Algorithm may penalize incomplete content

**Fix Required:**
- Cap thread parts at 200 characters MAX
- Current prompt allows 240-280 chars - needs immediate reduction

### 2. **MISSING TWEET IDs (Posts Never Posted)** ❌
**Problem:** 4 posts have no `tweet_id`, meaning they never successfully posted to Twitter.

**Affected Posts:**
- "The Secret Connection Between Your Gut Microbiome and Your Skin Health"
- "The Unseen Role of Senescent Cells in Aging"
- "Unlocking the Power of Neuroprotective Peptides"
- "Peptide therapy myth-busting"

**Possible Causes:**
- Posting failures
- Timeout issues
- Playwright errors
- Rate limiting

**Fix Required:**
- Check posting queue logs
- Verify error handling in posting system
- Ensure failed posts are retried

### 3. **ZERO LIKES DESPITE VIEWS** 🔴
**Problem:** Most posts get 10-50 views but ZERO likes. This indicates:
- Content isn't resonating
- Hook isn't strong enough
- No clear value proposition

**Examples:**
- Post with 106 views: 0 likes
- Post with 82 views: 0 likes
- Post with 50 views: 0 likes

**Why This Matters:**
- Algorithm sees low engagement → reduces reach
- Creates negative feedback loop
- Account appears inactive/unengaging

### 4. **GENERIC, AI-SOUNDING CONTENT** 🤖
**Problem:** Recent posts sound formulaic and robotic.

**Examples of Boring Hooks:**
- "Emerging research indicates that..." (generic academic tone)
- "Throughout history, various cultures..." (textbook opening)
- "To enhance skin health through gut microbiome, adopt this habit..." (instructional manual)

**Compare to Winner:**
- "Why doesn't mainstream medicine fully embrace..." (provocative, personal, challenges status quo)

**Issue:** Content reads like health blog articles, not engaging Twitter content.

### 5. **LOW VIEW COUNTS ON RECENT POSTS** 📉
**Recent Performance (Last 24-48 hours):**
- 12 views
- 16 views  
- 20 views
- 27 views

**Possible Causes:**
- Algorithmic suppression (low engagement signals)
- Account shadowbanning
- Poor posting timing
- Lack of follower engagement

---

## 📋 CONTENT ANALYSIS: HIGH vs LOW PERFORMERS

### 🟢 HIGH PERFORMER (20,100 views)

**Content Style:**
- ✅ Provocative questions ("Why doesn't...?", "What are they afraid of?")
- ✅ Challenges mainstream authority
- ✅ Controversial positioning
- ✅ Specific data points ("90% of serotonin...")
- ✅ Personal stake implied ("they're afraid of revealing")

**Generator:** `provocateur` (only 1 use, but massive success)

### 🔴 LOW PERFORMERS (10-50 views)

**Content Style:**
- ❌ Generic academic openings ("Emerging research indicates...")
- ❌ Educational tone (sounds like textbook)
- ❌ No controversy or hook
- ❌ Long, wordy sentences
- ❌ Missing urgency or curiosity gap

**Generators:** `coach` (6 posts, avg 28 views), `interestingContent` (3 posts, avg 17 views)

---

## 🎯 ROOT CAUSE ANALYSIS

### Why Posts Aren't Getting Views:

1. **Thread Length Issues**
   - Parts too long (273 chars vs optimal 200)
   - Truncation reduces readability
   - Algorithm may penalize

2. **Content Quality**
   - Sounds AI-generated/robotic
   - Generic health advice without personality
   - Missing provocative angles
   - No clear hook or curiosity gap

3. **Posting Failures**
   - 4 posts never posted (missing tweet_id)
   - Reduces overall content volume
   - May indicate technical issues

4. **Algorithm Suppression**
   - Low engagement signals (zero likes)
   - Algorithm reduces reach over time
   - Account appears unengaging

5. **Generator Selection**
   - `provocateur` worked (1 post, 20k views)
   - `coach` underperforming (6 posts, avg 28 views)
   - Need more controversial/contrarian content

---

## 💡 RECOMMENDATIONS

### IMMEDIATE FIXES (Priority 1)

1. **Fix Thread Character Limits**
   - Change prompt to max 200 chars per part (not 240-280)
   - Add validation to reject parts > 200 chars
   - Test truncation handling

2. **Investigate Missing tweet_ids**
   - Check posting queue error logs
   - Verify Playwright posting works
   - Implement retry logic for failed posts

3. **Improve Content Hooks**
   - Use more provocative angles (like the gut-brain winner)
   - Challenge mainstream assumptions
   - Create curiosity gaps
   - Avoid generic academic openings

### CONTENT IMPROVEMENTS (Priority 2)

4. **Increase `provocateur` Generator Usage**
   - Only used 1 time but got 20k views
   - Balance with other generators but increase frequency

5. **Reduce Generic Health Advice**
   - Current posts read like health blogs
   - Need more personality, controversy, edge
   - Use contrarian angles more often

6. **Fix "Zero Likes" Problem**
   - Content needs stronger value proposition
   - Add actionable insights that prompt engagement
   - Create shareable, surprising content

### LONG-TERM OPTIMIZATION (Priority 3)

7. **A/B Test Generator Performance**
   - Track which generators get views/likes
   - Optimize generator selection algorithm
   - Reduce use of underperforming generators

8. **Improve Posting Timing**
   - Analyze when high-performing post was posted
   - Test different times of day
   - Consider follower activity patterns

9. **Monitor Account Health**
   - Check for shadowbanning
   - Verify account isn't flagged
   - Monitor follower growth/engagement

---

## 📊 GENERATOR PERFORMANCE

| Generator | Posts | Avg Views | Status |
|-----------|-------|-----------|--------|
| provocateur | 1 | 20,100 | ⭐ WINNER |
| thoughtLeader | 2 | 91 | 🟡 OK |
| coach | 6 | 28 | 🔴 UNDERPERFORMING |
| interestingContent | 3 | 17 | 🔴 UNDERPERFORMING |
| contrarian | 2 | 29 | 🔴 UNDERPERFORMING |
| culturalBridge | 3 | 32 | 🔴 UNDERPERFORMING |

**Recommendation:** Increase `provocateur` usage. Current generators are too safe/generic.

---

## 🎯 CONTENT PATTERN ANALYSIS

### What Works:
- ✅ Provocative questions challenging authority
- ✅ Controversial/contrarian angles
- ✅ Specific data with surprising facts
- ✅ Clear value proposition
- ✅ Personal stakes/urgency

### What Doesn't Work:
- ❌ Generic academic openings
- ❌ Educational textbook tone
- ❌ Long, wordy sentences
- ❌ Generic health advice
- ❌ Missing hooks or curiosity gaps

---

## 🔧 TECHNICAL ISSUES TO FIX

1. **Thread Character Limits:** All threads exceed 200 chars
2. **Posting Failures:** 4 posts missing tweet_id
3. **Metrics Scraping:** Some posts have zero views (may be scraping issue)
4. **Validation:** Need checks for character limits before posting

---

## 📝 NEXT STEPS

1. ✅ **Immediate:** Fix thread character limit in prompts (200 chars max)
2. ✅ **Immediate:** Investigate why 4 posts have no tweet_id
3. ✅ **Short-term:** Update content generation to use more provocative angles
4. ✅ **Short-term:** Increase `provocateur` generator frequency
5. ✅ **Long-term:** A/B test generators and optimize selection algorithm

---

**Analysis Date:** November 20, 2025  
**Data Source:** Last 20 posted singles/threads from `content_metadata` table

