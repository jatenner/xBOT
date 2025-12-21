# 🚨 REPLY CONTEXT FIX - CRITICAL
## Date: December 20, 2025

---

## 🔍 **PROBLEM IDENTIFIED**

**User Report:** Replies look like random standalone posts/threads, not contextual responses.

**Example:**
- **Target:** Elon Musk: "Wow" (about Georgia election fraud)
- **Bot Reply:** "Interestingly, my mood fluctuated wildly. Research shows sugar impacts neurotransmitters like SEROTONIN..."
- **Result:** Zero connection, looks spammy

---

## 🎯 **ROOT CAUSES FOUND**

### **Issue #1: Harvester Not Running Properly** 🚨
- **Evidence:** 0 NEW opportunities in last 6 hours
- **Last successful harvest:** More than 6 hours ago
- **Current opportunities:** 100 total, but all OLD (>6h)
- **Impact:** Reply job is using stale/expired opportunities with missing context

### **Issue #2: Low Health Relevance Filtering** ⚠️
- **Evidence:** Opportunities with health_relevance_score as low as 3/10 are being kept
- **Example:** Religious tweet about Jesus/Christmas scored 3/10 but not filtered out
- **Impact:** Bot replying to irrelevant content

### **Issue #3: Context IS Being Used (But With Bad Data)** ✅/⚠️
- **Code Review:** Line 874-899 in `replyJob.ts` DOES fetch context
- **Mapping:** `target_tweet_content` correctly mapped to `tweet_content`
- **BUT:** Old opportunities may have incomplete/missing `target_tweet_content`
- **Result:** AI generates generic content when context is missing

---

## 🔧 **FIXES REQUIRED**

### **Priority 1: Fix Harvester (CRITICAL)**

**Problem:** Harvester hasn't added new opportunities in 6+ hours

**Likely Causes:**
1. Browser pool overload (we fixed this earlier - verify it's working)
2. Harvester job not running
3. Harvester failing silently

**Fix Steps:**
```bash
# 1. Check Railway logs for harvester
railway logs --service xBOT | grep "HARVESTER" | tail -n 50

# 2. Look for errors
railway logs --service xBOT | grep "HARVESTER.*error\|HARVESTER.*fail" | tail -n 20

# 3. Verify harvester job is registered
# Check jobManager.ts line ~394 for megaViralHarvester registration

# 4. If not running, force a harvest cycle
# Add env var: FORCE_HARVEST=true
railway variables --set "FORCE_HARVEST=true" --service xBOT
```

---

### **Priority 2: Increase Health Relevance Threshold**

**Problem:** Accepting tweets with health_relevance_score as low as 3/10

**Current:** Threshold appears to be very low or non-existent
**Recommended:** Minimum score of 6/10

**Fix:**
```typescript
// In megaViralHarvesterJob.ts or wherever opportunities are filtered
const MIN_HEALTH_RELEVANCE = 6; // Up from ~3

// Filter opportunities
const qualityOpportunities = opportunities.filter(opp => 
  opp.health_relevance_score >= MIN_HEALTH_RELEVANCE
);
```

**Alternative:** Add to env vars:
```bash
railway variables --set "MIN_HEALTH_RELEVANCE_SCORE=6" --service xBOT
```

---

### **Priority 3: Add Context Validation Gate**

**Problem:** No validation that `target_tweet_content` exists before generating reply

**Fix:**
```typescript
// In replyJob.ts around line 874
const parentText = target.tweet_content || target.target_tweet_content || '';

// ✅ ADD VALIDATION:
if (!parentText || parentText.length < 20) {
  console.log(`[REPLY_SKIP] target_id=${tweetIdFromUrl} reason=missing_context`);
  continue; // Skip this opportunity
}

console.log(`[REPLY_CONTEXT] ok=true parent_id=${tweetIdFromUrl} content_length=${parentText.length}`);
```

---

### **Priority 4: Clean Up Stale Opportunities**

**Problem:** 100 opportunities exist, but many are old/expired

**Fix:**
```sql
-- Manual cleanup (run in Supabase SQL editor)
DELETE FROM reply_opportunities
WHERE created_at < NOW() - INTERVAL '48 hours'
  OR status = 'expired'
  OR replied_to = true;
  
-- Should leave only fresh, unrepli

ed opportunities
```

**Or run reconciliation:**
```bash
# If there's a cleanup script
pnpm reply:cleanup:stale
```

---

### **Priority 5: Improve AI Prompt for Contextual Replies**

**Current Prompt (line 899):**
```typescript
const explicitReplyPrompt = `You are replying to @${target.account.username}'s tweet: "${parentText}"\n\nYour reply must:\n1. Reference at least one keyword from their tweet: ${keywords.join(', ')}\n2. Be ≤220 characters\n3. Be conversational and contextual\n4. NO JSON, NO brackets, NO lists\n5. Sound like a genuine human reply, not a bot\n\nReply:`;
```

**Enhanced Prompt:**
```typescript
const explicitReplyPrompt = `You are replying to @${target.account.username}'s tweet about: "${parentText}"

CRITICAL RULES:
1. Your reply MUST directly address their specific point
2. Reference their exact topic: ${keywords.join(', ')}
3. Be ≤220 characters
4. Sound like a natural conversation, NOT a standalone post
5. Do NOT start with generic phrases like "Interestingly,", "Research shows", "Studies suggest"
6. Do NOT sound like you're starting a thread or article
7. If their tweet isn't health-related, politely connect it to health (or skip)

Example of what NOT to do:
- "Interestingly, my mood fluctuated wildly..." (sounds like a standalone post)
- "Research shows..." (sounds like you're lecturing, not replying)

Example of what to DO:
- "That's a great point! Similar pattern seen in..." (acknowledges their tweet)
- "Makes sense - when you consider how..." (builds on their idea)

Reply:`;
```

---

## 📊 **VERIFICATION STEPS**

After applying fixes:

### **Step 1: Verify Harvester is Working**
```bash
# Should see new opportunities being added
railway logs | grep "HARVESTER.*Harvested:" | tail -n 10

# Check opportunity count increases
# Run this every 30 min, should see increase
pnpm exec tsx -e "
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { count } = await supabase.from('reply_opportunities').select('*', {count: 'exact', head: true}).gte('created_at', new Date(Date.now() - 60*60*1000).toISOString());
console.log(\`Opportunities last hour: \${count}\`);
"
```

### **Step 2: Verify Context is Being Used**
```bash
# Should see context logs
railway logs | grep "REPLY_CONTEXT" | tail -n 10

# Should show:
# [REPLY_CONTEXT] ok=true parent_id=... keywords=... content_length=...
```

### **Step 3: Manual Reply Test**
```bash
# Generate one reply and inspect
railway logs | grep "REPLY.*generated\|REPLY_CONTEXT" | tail -n 20

# Should see:
# 1. Context extracted
# 2. Keywords identified
# 3. Reply generated that references those keywords
```

### **Step 4: Check Reply Quality on X**
- Go to `@SignalAndSynapse` on X
- Find recent replies
- Verify they:
  - ✅ Reference the parent tweet's topic
  - ✅ Sound conversational
  - ❌ Don't sound like standalone posts
  - ❌ Don't use generic "Research shows..." openers

---

## 🎯 **EXPECTED OUTCOMES**

### **Before Fix:**
- Reply: "Interestingly, my mood fluctuated wildly. Research shows sugar impacts neurotransmitters..."
- Target: "Wow" (about election fraud)
- Connection: **ZERO**

### **After Fix:**
- Reply: "The data here is wild. Similar patterns of statistical anomalies seen in..."
- Target: "Wow" (about election fraud)  
- Connection: **CLEAR** (references "data", "anomalies", builds on their point)

---

## 🚨 **IMMEDIATE ACTION ITEMS**

1. ✅ **Check harvester logs** (5 min)
   ```bash
   railway logs | grep "HARVESTER" | tail -n 100
   ```

2. ✅ **Force harvester to run** (if not running)
   ```bash
   railway variables --set "FORCE_HARVEST=true"
   ```

3. ✅ **Clean up stale opportunities** (2 min)
   ```sql
   DELETE FROM reply_opportunities WHERE created_at < NOW() - INTERVAL '48 hours';
   ```

4. ✅ **Increase health relevance threshold** (1 min)
   ```bash
   railway variables --set "MIN_HEALTH_RELEVANCE_SCORE=6"
   ```

5. ✅ **Add context validation** (code change + deploy)
   - Add validation gate in `replyJob.ts` line 874
   - Commit and push
   - Railway auto-deploys

6. ✅ **Monitor for 2 hours**
   - Watch for new opportunities
   - Check reply quality on X
   - Verify context is being used

---

## 📋 **LONG-TERM IMPROVEMENTS**

1. **Reply Quality Monitoring**
   - Track engagement on replies (likes, retweets, quote tweets)
   - Flag low-engagement replies for review
   - Learn which reply styles work best

2. **Context Enrichment**
   - Store full conversation thread (parent + grandparent)
   - Include account bio/recent tweets for more context
   - Add topic categorization for better matching

3. **Smart Opportunity Selection**
   - Prioritize high-health-relevance opportunities (8+/10)
   - Avoid topics outside health domain
   - Target accounts more likely to engage

4. **Reply Diversity**
   - Rotate between reply styles (agree, question, add-info, challenge)
   - Avoid repetitive patterns
   - Match tone to target account (casual vs formal)

---

**This fix is CRITICAL for reply engagement and account reputation. Contextless replies = spam = shadow ban risk!**

