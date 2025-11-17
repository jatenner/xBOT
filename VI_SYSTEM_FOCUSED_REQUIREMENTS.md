# 🎯 VI System - Focused Requirements

**User Clarification:** The VI system should learn about **format, spacing, visual components, tone, and angles** - NOT topics.

---

## ✅ **WHAT TO LEARN (User's Requirements)**

### **1. Format & Spacing** ✅
- Line breaks (how many, where)
- Character count (optimal length)
- Visual structure (how it's laid out)
- Spacing patterns (paragraph breaks, bullet spacing)

### **2. Visual Components** ✅
- Emoji usage (count, positions, which ones)
- Bullets, numbers, special characters
- Caps usage (when, how much)
- Media presence (images, cards, videos)

### **3. How It Sounds (Tone)** ✅
- Conversational vs authoritative
- Provocative vs educational
- Casual vs professional
- Which tones perform best?

### **4. Angles (Approach/Perspective)** ✅
- Provocative vs research_based
- Practical vs theoretical
- Controversial vs safe
- Which angles drive engagement?

### **5. Structure (Format Type)** ✅
- Question hooks vs stat hooks
- Story format vs list format
- Thread structure vs single tweet
- Which structures work best?

---

## ❌ **WHAT NOT TO LEARN**

### **Topics** ❌
- **User says:** "Topics are irrelevant - our random topic generator is fine"
- **Action:** Remove topic from intelligence building
- **Current problem:** System builds intelligence by topic/angle/tone/structure
- **Fix:** Build by angle/tone/structure only

---

## 🔍 **CURRENT SYSTEM ANALYSIS**

### **What It's Extracting (Good):**
✅ Line breaks, character count, spacing
✅ Emoji count and positions
✅ Visual components (bullets, caps, etc.)
✅ Tone classification
✅ Angle classification
✅ Structure classification

### **What It's Missing:**
❌ **No success correlation** - Doesn't check which formats/tones/angles had high ER
❌ **No "why it works"** - Doesn't explain why certain patterns succeed
❌ **Includes topic** - User doesn't need this
❌ **No filtering** - Learns from all tweets, not just successful ones

---

## 🎯 **WHAT NEEDS TO BE FIXED**

### **1. Remove Topic from Intelligence Building**
```typescript
// CURRENT (WRONG):
query_key: "sleep|provocative|conversational|question_hook"

// SHOULD BE (RIGHT):
query_key: "provocative|conversational|question_hook"
```

### **2. Correlate Format with Success**
```typescript
// NEEDED: Which line break patterns had highest ER?
SELECT 
  line_breaks,
  AVG(engagement_rate) as avg_er,
  COUNT(*) as sample_size
FROM vi_visual_formatting vf
JOIN vi_collected_tweets ct ON vf.tweet_id = ct.tweet_id
WHERE ct.engagement_rate >= 0.02  // Only successful tweets
GROUP BY line_breaks
ORDER BY avg_er DESC;
```

### **3. Correlate Tone/Angle with Success**
```typescript
// NEEDED: Which tones/angles perform best?
SELECT 
  cc.tone,
  cc.angle,
  AVG(ct.engagement_rate) as avg_er,
  COUNT(*) as sample_size
FROM vi_content_classification cc
JOIN vi_collected_tweets ct ON cc.tweet_id = ct.tweet_id
WHERE ct.engagement_rate >= 0.02
GROUP BY cc.tone, cc.angle
ORDER BY avg_er DESC;
```

### **4. Filter by Success**
```typescript
// CURRENT: Gets all tweets
const matches = await this.findMatches(combo);

// SHOULD: Filter by success
const successfulMatches = matches.filter(m => 
  m.engagement_rate >= 0.02 ||  // 2%+ ER
  m.viral_multiplier >= 0.3 ||   // 30%+ reach
  m.is_viral === true
);
```

### **5. Weight by Engagement**
```typescript
// CURRENT: Weights by tier (account size)
// SHOULD: Weight by engagement_rate
const weightedPatterns = tweets.map(tweet => ({
  pattern: tweet.visual_pattern,
  weight: tweet.engagement_rate * 100  // Higher ER = more weight
}));
```

---

## 📋 **REVISED INTELLIGENCE STRUCTURE**

### **Current (Wrong):**
```
Intelligence by: topic + angle + tone + structure
Example: "sleep|provocative|conversational|question_hook"
```

### **Should Be (Right):**
```
Intelligence by: angle + tone + structure
Example: "provocative|conversational|question_hook"

Why: Topics are irrelevant (user has topic generator)
Focus: Format, spacing, visual components, tone, angle
```

---

## 🎓 **LEARNING GOALS**

The system should learn:

1. **Format Patterns:**
   - "Tweets with 2-3 line breaks have 1.8x higher ER"
   - "Emojis at the end perform 2.3x better than at start"
   - "180-220 character tweets get most engagement"

2. **Tone Patterns:**
   - "Conversational tone has 1.5x higher ER than authoritative"
   - "Provocative tone drives 2x more replies"
   - "Educational tone gets most shares"

3. **Angle Patterns:**
   - "Provocative angles get 1.8x more engagement"
   - "Research-based angles build more credibility"
   - "Practical angles drive most profile clicks"

4. **Structure Patterns:**
   - "Question hooks get 2x more replies"
   - "Stat hooks drive most retweets"
   - "Story format has highest completion rate"

---

## ✅ **SUCCESS CRITERIA**

Before integrating, the system should:

- [ ] Remove topic from intelligence building
- [ ] Correlate format/spacing with success
- [ ] Correlate tone/angle with success
- [ ] Filter by engagement_rate (only learn from successful tweets)
- [ ] Weight patterns by success (high-ER tweets get more weight)
- [ ] Compare winners vs losers (what do winners do differently?)
- [ ] Explain WHY patterns work (not just what they are)

**Current Status:** ❌ **0/7 criteria met** - Needs fixes before integration

